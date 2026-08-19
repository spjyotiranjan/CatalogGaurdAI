from pathlib import Path

import aiosqlite
import pytest

from app.contracts.jobs import ValidationJobRequestV1
from app.repositories.operational import OperationalRepository


@pytest.mark.anyio
async def test_operational_job_and_queue_survive_repository_restart(
    tmp_path: Path,
    valid_job: dict,
) -> None:
    database_path = tmp_path / "operational.db"
    first = OperationalRepository(database_path)
    await first.migrate()
    contract = ValidationJobRequestV1.model_validate(valid_job)

    accepted = await first.accept_job(contract)
    restarted = OperationalRepository(database_path)
    await restarted.verify_schema()
    persisted = await restarted.get_job(contract.job_id)

    assert accepted.duplicate is False
    assert persisted is not None
    assert persisted.status == "PENDING"
    assert await restarted.queue_depth() == 1


@pytest.mark.anyio
async def test_unmigrated_operational_store_fails_schema_verification(
    tmp_path: Path,
) -> None:
    repository = OperationalRepository(tmp_path / "missing.db")

    with pytest.raises(RuntimeError, match="not applied"):
        await repository.verify_schema()


@pytest.mark.anyio
async def test_newer_operational_schema_rejects_an_older_service(
    tmp_path: Path,
) -> None:
    database_path = tmp_path / "future.db"
    repository = OperationalRepository(database_path)
    await repository.migrate()
    async with aiosqlite.connect(database_path) as connection:
        await connection.execute(
            "INSERT INTO schema_migrations(version, applied_at) VALUES (3, 'future')"
        )
        await connection.commit()

    with pytest.raises(RuntimeError, match="required v2, found v3"):
        await repository.verify_schema()
