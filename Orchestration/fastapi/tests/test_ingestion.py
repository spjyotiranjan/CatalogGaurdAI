import hashlib
import json

import pytest

from app.contracts.jobs import ValidationJobRequestV1
from app.integrations.fake_storage import FakePrivateStorageClient
from app.repositories.operational import OperationalRepository
from app.services.ingestion import CsvIngestionService


@pytest.mark.anyio
async def test_csv_ingestion_checkpoints_good_and_bad_rows(tmp_path, valid_job: dict) -> None:
    storage_root = tmp_path / "private"
    key = valid_job["feed"]["storageObjectKey"]
    path = storage_root / key
    path.parent.mkdir(parents=True)
    path.write_text(
        "sku,title,price,inventory\nSKU-1,Valid item,10.25,0\nSKU-2,,12,3\n",
        encoding="utf-8",
    )
    valid_job["feed"]["checksum"] = hashlib.sha256(path.read_bytes()).hexdigest()
    repository = OperationalRepository(tmp_path / "operational.db")
    await repository.migrate()
    contract = ValidationJobRequestV1.model_validate(valid_job)
    await repository.accept_job(contract)

    await CsvIngestionService(repository, FakePrivateStorageClient(storage_root)).process(
        contract.job_id
    )

    job = await repository.get_job(contract.job_id)
    assert job is not None
    assert job.status == "COMPLETED"
    assert job.total_rows == 2
    assert job.processed_rows == 2
    assert job.last_checkpoint == "row:3"
    assert json.loads(job.request_payload)["feed"]["mappingVersion"] == "catalog-map/v1"
