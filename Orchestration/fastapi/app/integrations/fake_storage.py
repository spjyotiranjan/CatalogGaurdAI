import hashlib
from collections.abc import AsyncIterator
from pathlib import Path

from app.core.errors import AppError


class FakePrivateStorageClient:
    """Local-only scoped private-storage seam for contract fixtures."""

    def __init__(self, root: Path) -> None:
        self._root = root.resolve()

    def _resolve(self, storage_object_key: str) -> Path:
        candidate = (self._root / storage_object_key).resolve()
        if candidate == self._root or self._root not in candidate.parents:
            raise AppError(
                category="authorization",
                code="STORAGE_SCOPE_DENIED",
                message="The private object reference is outside the configured storage scope.",
                status_code=403,
            )
        return candidate

    async def readiness_check(self) -> None:
        if not self._root.exists() or not self._root.is_dir():
            raise AppError(
                category="dependency",
                code="PRIVATE_STORAGE_UNAVAILABLE",
                message="The private-storage dependency is unavailable.",
                status_code=503,
                retryable=True,
            )

    async def read_fixture(self, storage_object_key: str, max_bytes: int = 1_048_576) -> bytes:
        path = self._resolve(storage_object_key)
        try:
            with path.open("rb") as fixture:
                content = fixture.read(max_bytes + 1)
            if len(content) > max_bytes:
                raise AppError(
                    category="validation",
                    code="STORAGE_FIXTURE_TOO_LARGE",
                    message="The private-storage fixture exceeds the allowed test size.",
                    status_code=422,
                )
            return content
        except FileNotFoundError as error:
            raise AppError(
                category="dependency",
                code="PRIVATE_OBJECT_NOT_FOUND",
                message="The private object could not be read.",
                status_code=404,
            ) from error

    async def stream(
        self,
        storage_object_key: str,
        expected_size: int | None = None,
        expected_checksum: str | None = None,
    ) -> AsyncIterator[bytes]:
        content = await self.read_fixture(storage_object_key, max_bytes=1_048_576)
        if expected_size is not None and len(content) != expected_size:
            raise AppError(
                category="validation",
                code="PRIVATE_OBJECT_MISMATCH",
                message="The private object does not match its trusted metadata.",
                status_code=422,
            )
        if (
            expected_checksum is not None
            and hashlib.sha256(content).hexdigest() != expected_checksum
        ):
            raise AppError(
                category="validation",
                code="PRIVATE_OBJECT_MISMATCH",
                message="The private object does not match its trusted metadata.",
                status_code=422,
            )
        for offset in range(0, len(content), 64 * 1024):
            yield content[offset : offset + 64 * 1024]
