from pathlib import Path

import pytest

from app.core.errors import AppError
from app.integrations.fake_storage import FakePrivateStorageClient


@pytest.mark.anyio
async def test_fake_private_storage_reads_only_scoped_fixture(tmp_path: Path) -> None:
    root = tmp_path / "private"
    fixture = root / "seller" / "feed.csv"
    fixture.parent.mkdir(parents=True)
    fixture.write_bytes(b"sku,title\nSKU-1,Fixture")
    storage = FakePrivateStorageClient(root)

    assert await storage.read_fixture("seller/feed.csv") == fixture.read_bytes()


@pytest.mark.anyio
async def test_fake_private_storage_blocks_path_traversal(tmp_path: Path) -> None:
    root = tmp_path / "private"
    root.mkdir()
    storage = FakePrivateStorageClient(root)

    with pytest.raises(AppError, match="outside the configured storage scope") as error:
        await storage.read_fixture("../outside.csv")

    assert error.value.code == "STORAGE_SCOPE_DENIED"


@pytest.mark.anyio
async def test_fake_private_storage_enforces_bounded_reads(tmp_path: Path) -> None:
    root = tmp_path / "private"
    root.mkdir()
    (root / "feed.csv").write_bytes(b"1234")
    storage = FakePrivateStorageClient(root)

    with pytest.raises(AppError) as error:
        await storage.read_fixture("feed.csv", max_bytes=3)

    assert error.value.code == "STORAGE_FIXTURE_TOO_LARGE"
