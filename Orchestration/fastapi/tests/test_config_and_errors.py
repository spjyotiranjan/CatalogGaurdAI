import json
import logging
from pathlib import Path

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.core.config import Settings
from app.core.logging import JsonFormatter


def test_production_configuration_requires_https_telemetry_and_absolute_paths(
    settings: Settings,
) -> None:
    values = settings.model_dump()
    values.update(
        environment="production",
        operational_db_path=Path("relative.db"),
        fake_storage_root=Path("relative-storage"),
        otel_exporter_otlp_endpoint="http://telemetry.example/v1/traces",
    )

    with pytest.raises(ValidationError):
        Settings(_env_file=None, **values)


def test_replay_retention_must_cover_clock_skew(settings: Settings) -> None:
    values = settings.model_dump()
    values.update(
        service_auth_max_clock_skew_seconds=300,
        replay_nonce_retention_seconds=599,
    )

    with pytest.raises(ValidationError, match="cover both sides"):
        Settings(_env_file=None, **values)


def test_staging_disallows_automatic_schema_migrations(settings: Settings) -> None:
    values = settings.model_dump()
    values.update(
        environment="staging",
        operational_db_path=Path("C:/catalogguard/operational.db"),
        fake_storage_root=Path("C:/catalogguard/private-storage"),
        otel_exporter_otlp_endpoint="https://telemetry.example/v1/traces",
        auto_migrate_operational_store=True,
    )

    with pytest.raises(ValidationError, match="auto_migrate_operational_store"):
        Settings(_env_file=None, **values)


def test_production_disallows_fake_private_storage(settings: Settings) -> None:
    values = settings.model_dump()
    values.update(
        environment="production",
        operational_db_path=Path("C:/catalogguard/operational.db"),
        auto_migrate_operational_store=False,
        fake_storage_root=Path("C:/catalogguard/private-storage"),
        otel_exporter_otlp_endpoint="https://telemetry.example/v1/traces",
        private_storage_backend="fake",
    )

    with pytest.raises(ValidationError, match="fake private-storage"):
        Settings(_env_file=None, **values)


def test_structured_logger_redacts_sensitive_context(settings: Settings) -> None:
    formatter = JsonFormatter(settings)
    record = logging.LogRecord(
        name="test",
        level=logging.INFO,
        pathname=__file__,
        lineno=1,
        msg="Safe event",
        args=(),
        exc_info=None,
    )
    record.context = {
        "correlationId": "4f864f99-aa42-49f5-93cd-77369c20f213",
        "operation": "test.log",
        "storageObjectKey": "private/do-not-log.csv",
        "rawPayload": {"password": "do-not-log"},
        "signature": "do-not-log",
    }

    payload = json.loads(formatter.format(record))

    assert payload["operation"] == "test.log"
    assert "storageObjectKey" not in payload
    assert "rawPayload" not in payload
    assert "signature" not in payload
    assert "do-not-log" not in json.dumps(payload)


def test_unexpected_errors_return_no_stack_or_exception_details(client: TestClient) -> None:
    async def fail() -> None:
        raise RuntimeError("private-storage-key=do-not-expose")

    app: FastAPI = client.app
    app.add_api_route("/test/unexpected", fail, methods=["GET"])

    response = client.get("/test/unexpected")

    assert response.status_code == 500
    assert response.json()["error"]["code"] == "INTERNAL_ERROR"
    assert "do-not-expose" not in response.text
    assert "traceback" not in response.text.lower()
