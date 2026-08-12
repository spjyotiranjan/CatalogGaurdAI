import time
from uuid import uuid4

from fastapi.testclient import TestClient

from app.core.config import Settings
from tests.conftest import json_body, signed_headers

PATH = "/internal/v1/jobs"


def _submit(
    client: TestClient,
    settings: Settings,
    job: dict,
    *,
    headers: dict[str, str] | None = None,
):
    body = json_body(job)
    request_headers = headers or signed_headers(
        settings,
        path=PATH,
        body=body,
        correlation_id=job["execution"]["correlationId"],
    )
    request_headers.setdefault("content-type", "application/json")
    return client.post(PATH, content=body, headers=request_headers)


def test_missing_service_credentials_are_rejected(
    client: TestClient,
    valid_job: dict,
) -> None:
    response = client.post(PATH, json=valid_job)

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "SERVICE_AUTHENTICATION_FAILED"


def test_bad_signature_is_rejected_without_secret_details(
    client: TestClient,
    settings: Settings,
    valid_job: dict,
) -> None:
    body = json_body(valid_job)
    headers = signed_headers(
        settings,
        path=PATH,
        body=body,
        secret="wrong-secret-that-is-still-long-enough-for-hmac",
        correlation_id=valid_job["execution"]["correlationId"],
    )
    response = _submit(client, settings, valid_job, headers=headers)

    assert response.status_code == 401
    serialized = response.text.lower()
    assert "wrong-secret" not in serialized
    assert "signature" not in serialized


def test_unknown_signing_key_version_is_rejected(
    client: TestClient,
    settings: Settings,
    valid_job: dict,
) -> None:
    body = json_body(valid_job)
    headers = signed_headers(
        settings,
        path=PATH,
        body=body,
        correlation_id=valid_job["execution"]["correlationId"],
    )
    headers["X-CatalogGuard-Key-Version"] = "retired-key"

    response = _submit(client, settings, valid_job, headers=headers)

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "SERVICE_AUTHENTICATION_FAILED"


def test_stale_message_is_rejected(
    client: TestClient,
    settings: Settings,
    valid_job: dict,
) -> None:
    body = json_body(valid_job)
    headers = signed_headers(
        settings,
        path=PATH,
        body=body,
        timestamp=int(time.time()) - settings.service_auth_max_clock_skew_seconds - 1,
        correlation_id=valid_job["execution"]["correlationId"],
    )
    response = _submit(client, settings, valid_job, headers=headers)

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "SERVICE_MESSAGE_STALE"


def test_nonce_replay_is_rejected(
    client: TestClient,
    settings: Settings,
    valid_job: dict,
) -> None:
    body = json_body(valid_job)
    headers = signed_headers(
        settings,
        path=PATH,
        body=body,
        nonce=uuid4(),
        correlation_id=valid_job["execution"]["correlationId"],
    )

    first = _submit(client, settings, valid_job, headers=headers)
    replay = _submit(client, settings, valid_job, headers=headers)

    assert first.status_code == 202
    assert replay.status_code == 409
    assert replay.json()["error"]["code"] == "SERVICE_MESSAGE_REPLAYED"


def test_authenticated_service_must_match_execution_actor(
    client: TestClient,
    settings: Settings,
    valid_job: dict,
) -> None:
    valid_job["execution"]["actorService"] = "another-service"
    response = _submit(client, settings, valid_job)

    assert response.status_code == 403
    assert response.json()["error"]["code"] == "ACTOR_IDENTITY_MISMATCH"
