import json
import os
import time
from collections.abc import Iterator
from copy import deepcopy
from pathlib import Path
from typing import Any
from uuid import UUID, uuid4

import pytest
from fastapi.testclient import TestClient

os.environ.update(
    {
        "CATALOGGUARD_ENVIRONMENT": "test",
        "CATALOGGUARD_SERVICE_NAME": "catalogguard-orchestration",
        "CATALOGGUARD_SERVICE_VERSION": "test",
        "CATALOGGUARD_OPERATIONAL_DB_PATH": ".data/import-test.db",
        "CATALOGGUARD_FAKE_STORAGE_ROOT": ".data/import-fake-storage",
        "CATALOGGUARD_WEB_SERVICE_ID": "web-bff",
        "CATALOGGUARD_WEB_SERVICE_KEY_VERSION": "web-k1",
        "CATALOGGUARD_WEB_SERVICE_SECRET": "web-test-secret-with-at-least-32-characters",
        "CATALOGGUARD_CALLBACK_SERVICE_ID": "validation-orchestrator",
        "CATALOGGUARD_CALLBACK_KEY_VERSION": "orchestration-k1",
        "CATALOGGUARD_CALLBACK_SIGNING_SECRET": (
            "callback-test-secret-at-least-32-characters"
        ),
    }
)

from app.core.config import Settings  # noqa: E402
from app.main import create_app  # noqa: E402
from app.security.signing import sign_http_message  # noqa: E402

TEST_WEB_SECRET = "web-test-secret-with-at-least-32-characters"
TEST_CALLBACK_SECRET = "callback-test-secret-at-least-32-characters"


@pytest.fixture
def settings(tmp_path: Path) -> Settings:
    return Settings(
        _env_file=None,
        environment="test",
        service_name="catalogguard-orchestration",
        service_version="0.1.0-test",
        log_level="INFO",
        operational_db_path=tmp_path / "operational.db",
        fake_storage_root=tmp_path / "private-storage",
        web_service_id="web-bff",
        web_service_key_version="web-k1",
        web_service_secret=TEST_WEB_SECRET,
        callback_service_id="validation-orchestrator",
        callback_key_version="orchestration-k1",
        callback_signing_secret=TEST_CALLBACK_SECRET,
    )


@pytest.fixture
def client(settings: Settings) -> Iterator[TestClient]:
    with TestClient(create_app(settings), raise_server_exceptions=False) as test_client:
        yield test_client


@pytest.fixture
def anyio_backend() -> str:
    return "asyncio"


@pytest.fixture
def valid_job() -> dict[str, Any]:
    correlation_id = uuid4()
    return {
        "contractVersion": "v1",
        "jobId": str(uuid4()),
        "idempotencyKey": f"feed-validation:{uuid4()}",
        "feed": {
            "feedUploadId": "66bb4f8b683bb83a83c26222",
            "sellerId": "66bb4f8b683bb83a83c26111",
            "fileType": "CSV",
            "feedType": "PRODUCT_LISTING",
            "checksum": "a" * 64,
            "storageObjectKey": "seller/66bb4f8b/feed.csv",
            "mappingVersion": "catalog-map/v1",
        },
        "execution": {
            "correlationId": str(correlation_id),
            "actorType": "SYSTEM",
            "actorService": "web-bff",
        },
    }


def json_body(payload: dict[str, Any]) -> bytes:
    return json.dumps(payload, sort_keys=True, separators=(",", ":")).encode("utf-8")


def signed_headers(
    settings: Settings,
    *,
    path: str,
    body: bytes = b"",
    method: str = "POST",
    timestamp: int | None = None,
    nonce: UUID | None = None,
    service_id: str = "web-bff",
    secret: str = TEST_WEB_SECRET,
    correlation_id: str | None = None,
) -> dict[str, str]:
    signed = sign_http_message(
        secret=secret,
        key_version="web-k1",
        service_id=service_id,
        timestamp=timestamp or int(time.time()),
        nonce=nonce or uuid4(),
        method=method,
        path=path,
        body=body,
    )
    headers = signed.as_http_headers()
    if correlation_id is not None:
        headers["X-Correlation-ID"] = correlation_id
    return headers


def clone_job(job: dict[str, Any]) -> dict[str, Any]:
    return deepcopy(job)
