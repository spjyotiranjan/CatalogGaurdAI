from fastapi.testclient import TestClient

from app.core.config import Settings
from app.main import create_app


def test_openapi_documents_every_phase_one_endpoint_and_model(
    client: TestClient,
) -> None:
    response = client.get("/openapi.json")

    assert response.status_code == 200
    schema = response.json()
    assert schema["openapi"] == "3.1.0"
    assert set(schema["paths"]) == {
        "/docs",
        "/health",
        "/internal/metrics",
        "/internal/v1/jobs",
        "/internal/v1/jobs/{job_id}",
        "/openapi.json",
        "/ready",
    }
    assert {
        "ErrorEnvelope",
        "ValidationJobRequestV1",
        "ValidationJobResultV1",
        "AcceptedJobResponseV1",
        "JobStatusResponseV1",
    }.issubset(schema["components"]["schemas"])

    for path_item in schema["paths"].values():
        for method, operation in path_item.items():
            if method not in {"get", "post", "put", "patch", "delete"}:
                continue
            assert operation["operationId"]
            assert operation["summary"]
            assert operation["description"]
            assert operation["responses"]


def test_job_openapi_requires_all_d012_service_auth_headers(client: TestClient) -> None:
    schema = client.get("/openapi.json").json()
    operation = schema["paths"]["/internal/v1/jobs"]["post"]

    assert operation["security"] == [
        {
            "catalogguardKeyVersion": [],
            "catalogguardService": [],
            "catalogguardTimestamp": [],
            "catalogguardNonce": [],
            "catalogguardSignature": [],
        }
    ]
    parameters = {parameter["name"]: parameter for parameter in operation["parameters"]}
    for header in (
        "x-catalogguard-key-version",
        "x-catalogguard-service",
        "x-catalogguard-timestamp",
        "x-catalogguard-nonce",
        "x-catalogguard-signature",
    ):
        assert parameters[header]["required"] is True
    request_schema = operation["requestBody"]["content"]["application/json"]["schema"]
    assert request_schema == {"$ref": "#/components/schemas/ValidationJobRequestV1"}


def test_swagger_ui_is_rendered_from_the_generated_document(client: TestClient) -> None:
    response = client.get("/docs")

    assert response.status_code == 200
    assert "/openapi.json" in response.text
    assert "Swagger UI" in response.text


def test_documentation_endpoints_can_be_disabled(
    settings: Settings,
) -> None:
    disabled = settings.model_copy(update={"enable_api_docs": False})

    with TestClient(create_app(disabled)) as client:
        assert client.get("/openapi.json").status_code == 404
        assert client.get("/docs").status_code == 404
