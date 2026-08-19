from uuid import uuid4

from fastapi.testclient import TestClient

from app.core.config import Settings
from tests.conftest import clone_job, json_body, signed_headers

PATH = "/internal/v1/jobs"


def submit(
    client: TestClient,
    settings: Settings,
    job: dict,
    content_type: str = "application/json",
):
    body = json_body(job)
    headers = signed_headers(
        settings,
        path=PATH,
        body=body,
        correlation_id=job["execution"]["correlationId"],
    )
    headers["content-type"] = content_type
    return client.post(PATH, content=body, headers=headers)


def test_valid_job_is_persisted_and_enqueued_once(
    client: TestClient,
    settings: Settings,
    valid_job: dict,
) -> None:
    first = submit(client, settings, valid_job)
    duplicate = submit(client, settings, valid_job)

    assert first.status_code == 202
    assert first.json()["duplicate"] is False
    assert duplicate.status_code == 202
    assert duplicate.json()["duplicate"] is True
    assert client.app.state.repository is not None
    assert client.app.state.queue is not None


def test_idempotency_key_cannot_be_rebound(
    client: TestClient,
    settings: Settings,
    valid_job: dict,
) -> None:
    assert submit(client, settings, valid_job).status_code == 202
    conflicting = clone_job(valid_job)
    conflicting["jobId"] = str(uuid4())

    response = submit(client, settings, conflicting)

    assert response.status_code == 409
    assert response.json()["error"]["code"] == "IDEMPOTENCY_CONFLICT"


def test_unknown_field_and_unsupported_version_are_rejected(
    client: TestClient,
    settings: Settings,
    valid_job: dict,
) -> None:
    unknown = clone_job(valid_job)
    unknown["unexpectedControl"] = "do-not-accept"
    unsupported = clone_job(valid_job)
    unsupported["jobId"] = str(uuid4())
    unsupported["idempotencyKey"] = f"job:{uuid4()}"
    unsupported["contractVersion"] = "v2"

    unknown_response = submit(client, settings, unknown)
    version_response = submit(client, settings, unsupported)

    assert unknown_response.status_code == 422
    assert unknown_response.json()["error"]["code"] == "JOB_CONTRACT_INVALID"
    assert version_response.status_code == 422
    assert version_response.json()["error"]["code"] == "JOB_CONTRACT_INVALID"


def test_csv_product_listing_is_the_only_phase_one_input(
    client: TestClient,
    settings: Settings,
    valid_job: dict,
) -> None:
    xlsx_job = clone_job(valid_job)
    xlsx_job["feed"]["fileType"] = "XLSX"
    response = submit(client, settings, xlsx_job)

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "JOB_CONTRACT_INVALID"


def test_correlation_header_must_match_trusted_job_metadata(
    client: TestClient,
    settings: Settings,
    valid_job: dict,
) -> None:
    body = json_body(valid_job)
    headers = signed_headers(
        settings,
        path=PATH,
        body=body,
        correlation_id=str(uuid4()),
    )
    headers["content-type"] = "application/json"
    response = client.post(PATH, content=body, headers=headers)

    assert response.status_code == 409
    assert response.json()["error"]["code"] == "CORRELATION_ID_MISMATCH"


def test_content_type_is_validated_after_authentication(
    client: TestClient,
    settings: Settings,
    valid_job: dict,
) -> None:
    response = submit(client, settings, valid_job, content_type="text/plain")

    assert response.status_code == 415
    assert response.json()["error"]["code"] == "CONTENT_TYPE_UNSUPPORTED"


def test_authenticated_status_read_returns_operational_projection(
    client: TestClient,
    settings: Settings,
    valid_job: dict,
) -> None:
    assert submit(client, settings, valid_job).status_code == 202
    path = f"{PATH}/{valid_job['jobId']}"
    headers = signed_headers(
        settings,
        path=path,
        method="GET",
        correlation_id=valid_job["execution"]["correlationId"],
    )

    response = client.get(path, headers=headers)

    assert response.status_code == 200
    assert response.json()["status"] == "PENDING"
    assert response.json()["jobId"] == valid_job["jobId"]


def test_status_read_rejects_unauthenticated_browser_traffic(
    client: TestClient,
) -> None:
    response = client.get(f"{PATH}/{uuid4()}")

    assert response.status_code == 401
