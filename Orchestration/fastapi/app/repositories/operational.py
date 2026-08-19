import hashlib
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from pathlib import Path
from uuid import UUID

import aiosqlite

from app.contracts.jobs import JobStatus, ValidationJobRequestV1
from app.core.errors import AppError


@dataclass(frozen=True, slots=True)
class AcceptedJob:
    job_id: UUID
    status: JobStatus
    duplicate: bool


@dataclass(frozen=True, slots=True)
class OperationalJob:
    job_id: UUID
    status: JobStatus
    request_payload: str
    request_hash: str
    attempt_count: int
    processed_rows: int
    total_rows: int | None
    last_checkpoint: str | None
    safe_failure_code: str | None
    created_at: datetime
    updated_at: datetime


class OperationalRepository:
    """The sole data-access boundary for Orchestration operational state (DB-01)."""

    def __init__(self, database_path: Path) -> None:
        self._database_path = database_path

    @asynccontextmanager
    async def _connection(self) -> AsyncIterator[aiosqlite.Connection]:
        connection = await aiosqlite.connect(self._database_path, timeout=5.0)
        connection.row_factory = aiosqlite.Row
        try:
            await connection.execute("PRAGMA busy_timeout = 5000")
            await connection.execute("PRAGMA foreign_keys = ON")
            yield connection
        finally:
            await connection.close()

    SCHEMA_VERSION = 2

    async def migrate(self) -> None:
        """Apply the explicitly invoked, forward-only operational schema migration."""
        self._database_path.parent.mkdir(parents=True, exist_ok=True)
        async with self._connection() as connection:
            await connection.execute("PRAGMA journal_mode = WAL")
            await connection.executescript(
                """
                CREATE TABLE IF NOT EXISTS schema_migrations (
                    version INTEGER PRIMARY KEY,
                    applied_at TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS operational_jobs (
                    job_id TEXT PRIMARY KEY,
                    idempotency_key TEXT NOT NULL UNIQUE,
                    request_hash TEXT NOT NULL,
                    request_payload TEXT NOT NULL,
                    status TEXT NOT NULL CHECK (
                        status IN ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED')
                    ),
                    attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
                    processed_rows INTEGER NOT NULL DEFAULT 0 CHECK (processed_rows >= 0),
                    total_rows INTEGER CHECK (total_rows IS NULL OR total_rows >= 0),
                    last_checkpoint TEXT,
                    safe_failure_code TEXT,
                    callback_state TEXT NOT NULL DEFAULT 'NOT_READY' CHECK (
                        callback_state IN ('NOT_READY', 'PENDING', 'ACKNOWLEDGED', 'FAILED')
                    ),
                    callback_attempt_count INTEGER NOT NULL DEFAULT 0,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                );
                CREATE INDEX IF NOT EXISTS operational_jobs_status_updated
                    ON operational_jobs(status, updated_at);

                CREATE TABLE IF NOT EXISTS accepted_nonces (
                    service_id TEXT NOT NULL,
                    nonce TEXT NOT NULL,
                    accepted_at TEXT NOT NULL,
                    expires_at TEXT NOT NULL,
                    PRIMARY KEY (service_id, nonce)
                );
                CREATE INDEX IF NOT EXISTS accepted_nonces_expires
                    ON accepted_nonces(expires_at);

                CREATE TABLE IF NOT EXISTS queue_messages (
                    message_id INTEGER PRIMARY KEY AUTOINCREMENT,
                    job_id TEXT NOT NULL UNIQUE REFERENCES operational_jobs(job_id),
                    status TEXT NOT NULL CHECK (status IN ('AVAILABLE', 'LEASED', 'ACKNOWLEDGED')),
                    available_at TEXT NOT NULL,
                    lease_owner TEXT,
                    lease_expires_at TEXT,
                    delivery_count INTEGER NOT NULL DEFAULT 0,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                );
                CREATE INDEX IF NOT EXISTS queue_messages_available
                    ON queue_messages(status, available_at);

                CREATE TABLE IF NOT EXISTS operational_row_results (
                    job_id TEXT NOT NULL REFERENCES operational_jobs(job_id),
                    source_row_number INTEGER NOT NULL CHECK (source_row_number >= 1),
                    candidate_identity TEXT NOT NULL,
                    outcome TEXT NOT NULL CHECK (outcome IN ('ACCEPTED', 'FAILED')),
                    normalized_candidate TEXT,
                    error_summary TEXT,
                    mapping_version TEXT NOT NULL,
                    raw_row_hash TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    PRIMARY KEY (job_id, source_row_number)
                );
                CREATE INDEX IF NOT EXISTS operational_row_results_job_outcome
                    ON operational_row_results(job_id, outcome, source_row_number);
                """
            )
            await connection.execute(
                """
                INSERT OR IGNORE INTO schema_migrations(version, applied_at)
                VALUES (?, ?)
                """,
                (self.SCHEMA_VERSION, datetime.now(UTC).isoformat()),
            )
            await connection.commit()

    async def verify_schema(self) -> None:
        """Fail readiness/startup when the controlled migration has not been applied."""
        async with self._connection() as connection:
            try:
                cursor = await connection.execute("SELECT MAX(version) FROM schema_migrations")
                row = await cursor.fetchone()
            except aiosqlite.OperationalError as error:
                raise RuntimeError("The operational store schema is not applied.") from error
            applied_version = row[0] if row is not None else None
            if applied_version != self.SCHEMA_VERSION:
                raise RuntimeError(
                    "Operational store schema version mismatch: "
                    f"required v{self.SCHEMA_VERSION}, found v{applied_version}."
                )

    async def ping(self) -> None:
        async with self._connection() as connection:
            await connection.execute("SELECT 1")

    async def accept_nonce(
        self,
        *,
        service_id: str,
        nonce: UUID,
        accepted_at: datetime,
        retention_seconds: int,
    ) -> bool:
        expires_at = accepted_at + timedelta(seconds=retention_seconds)
        async with self._connection() as connection:
            await connection.execute(
                "DELETE FROM accepted_nonces WHERE expires_at <= ?",
                (accepted_at.isoformat(),),
            )
            cursor = await connection.execute(
                """
                INSERT OR IGNORE INTO accepted_nonces(service_id, nonce, accepted_at, expires_at)
                VALUES (?, ?, ?, ?)
                """,
                (service_id, str(nonce), accepted_at.isoformat(), expires_at.isoformat()),
            )
            await connection.commit()
            return cursor.rowcount == 1

    async def accept_job(self, request: ValidationJobRequestV1) -> AcceptedJob:
        payload = request.model_dump_json(by_alias=True)
        request_hash = hashlib.sha256(payload.encode("utf-8")).hexdigest()
        now = datetime.now(UTC).isoformat()

        async with self._connection() as connection:
            await connection.execute("BEGIN IMMEDIATE")
            existing = await connection.execute_fetchall(
                """
                SELECT job_id, request_hash, status
                FROM operational_jobs
                WHERE idempotency_key = ? OR job_id = ?
                """,
                (request.idempotency_key, str(request.job_id)),
            )
            if existing:
                row = existing[0]
                if row["request_hash"] != request_hash or row["job_id"] != str(request.job_id):
                    await connection.rollback()
                    raise AppError(
                        category="conflict",
                        code="IDEMPOTENCY_CONFLICT",
                        message=(
                            "The idempotency key or job ID is already bound to another request."
                        ),
                        status_code=409,
                    )
                await connection.commit()
                return AcceptedJob(
                    job_id=UUID(row["job_id"]),
                    status=row["status"],
                    duplicate=True,
                )

            await connection.execute(
                """
                INSERT INTO operational_jobs(
                    job_id, idempotency_key, request_hash, request_payload, status,
                    created_at, updated_at
                ) VALUES (?, ?, ?, ?, 'PENDING', ?, ?)
                """,
                (
                    str(request.job_id),
                    request.idempotency_key,
                    request_hash,
                    payload,
                    now,
                    now,
                ),
            )
            await connection.execute(
                """
                INSERT INTO queue_messages(job_id, status, available_at, created_at, updated_at)
                VALUES (?, 'AVAILABLE', ?, ?, ?)
                """,
                (str(request.job_id), now, now, now),
            )
            await connection.commit()
            return AcceptedJob(job_id=request.job_id, status="PENDING", duplicate=False)

    async def get_job(self, job_id: UUID) -> OperationalJob | None:
        async with self._connection() as connection:
            cursor = await connection.execute(
                """
                SELECT job_id, status, request_payload, request_hash, attempt_count,
                       processed_rows, total_rows, last_checkpoint, safe_failure_code,
                       created_at, updated_at
                FROM operational_jobs WHERE job_id = ?
                """,
                (str(job_id),),
            )
            row = await cursor.fetchone()
        if row is None:
            return None
        return OperationalJob(
            job_id=UUID(row["job_id"]),
            status=row["status"],
            request_payload=row["request_payload"],
            request_hash=row["request_hash"],
            attempt_count=row["attempt_count"],
            processed_rows=row["processed_rows"],
            total_rows=row["total_rows"],
            last_checkpoint=row["last_checkpoint"],
            safe_failure_code=row["safe_failure_code"],
            created_at=datetime.fromisoformat(row["created_at"]),
            updated_at=datetime.fromisoformat(row["updated_at"]),
        )

    async def queue_depth(self) -> int:
        async with self._connection() as connection:
            cursor = await connection.execute(
                "SELECT COUNT(*) FROM queue_messages WHERE status = 'AVAILABLE'"
            )
            row = await cursor.fetchone()
            return int(row[0]) if row is not None else 0

    async def claim_for_processing(self, job_id: UUID) -> OperationalJob | None:
        now = datetime.now(UTC).isoformat()
        async with self._connection() as connection:
            await connection.execute("BEGIN IMMEDIATE")
            row = await connection.execute_fetchall(
                "SELECT * FROM operational_jobs WHERE job_id = ?", (str(job_id),)
            )
            if not row or row[0]["status"] in {"COMPLETED", "FAILED", "CANCELLED"}:
                await connection.commit()
                return None
            await connection.execute(
                "UPDATE operational_jobs SET status='PROCESSING', "
                "attempt_count=attempt_count+1, updated_at=? WHERE job_id=?",
                (now, str(job_id)),
            )
            await connection.commit()
        return await self.get_job(job_id)

    async def record_row(
        self,
        *,
        job_id: UUID,
        source_row_number: int,
        candidate_identity: str,
        outcome: str,
        normalized_candidate: str | None,
        error_summary: str | None,
        mapping_version: str,
        raw_row_hash: str,
    ) -> bool:
        now = datetime.now(UTC).isoformat()
        async with self._connection() as connection:
            await connection.execute("BEGIN IMMEDIATE")
            cursor = await connection.execute(
                "INSERT OR IGNORE INTO operational_row_results("
                "job_id, source_row_number, candidate_identity, outcome, normalized_candidate, "
                "error_summary, mapping_version, raw_row_hash, created_at) "
                "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
                (
                    str(job_id),
                    source_row_number,
                    candidate_identity,
                    outcome,
                    normalized_candidate,
                    error_summary,
                    mapping_version,
                    raw_row_hash,
                    now,
                ),
            )
            if cursor.rowcount:
                accepted = 1 if outcome == "ACCEPTED" else 0
                rejected = 1 if outcome == "FAILED" else 0
                await connection.execute(
                    "UPDATE operational_jobs SET processed_rows=processed_rows+1, "
                    "last_checkpoint=?, updated_at=? WHERE job_id=?",
                    (f"row:{source_row_number}", now, str(job_id)),
                )
                if accepted or rejected:
                    await connection.execute(
                        "UPDATE operational_jobs SET updated_at=? WHERE job_id=?",
                        (now, str(job_id)),
                    )
            await connection.commit()
            return cursor.rowcount == 1

    async def finish_processing(self, *, job_id: UUID, total_rows: int) -> OperationalJob:
        now = datetime.now(UTC).isoformat()
        async with self._connection() as connection:
            await connection.execute(
                "UPDATE operational_jobs SET status='COMPLETED', total_rows=?, "
                "last_checkpoint=COALESCE(last_checkpoint, 'header'), updated_at=? WHERE job_id=?",
                (total_rows, now, str(job_id)),
            )
            await connection.commit()
        job = await self.get_job(job_id)
        if job is None:
            raise RuntimeError("Operational job disappeared during completion")
        return job

    async def fail_processing(self, *, job_id: UUID, code: str) -> None:
        async with self._connection() as connection:
            await connection.execute(
                "UPDATE operational_jobs SET status='FAILED', safe_failure_code=?, "
                "updated_at=? WHERE job_id=?",
                (code, datetime.now(UTC).isoformat(), str(job_id)),
            )
            await connection.commit()
