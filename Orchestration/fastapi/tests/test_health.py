from pathlib import Path

from fastapi.testclient import TestClient

from app.core.config import Settings


def test_health_reports_application_liveness(client: TestClient) -> None:
    correlation_id = "4f864f99-aa42-49f5-93cd-77369c20f213"
    response = client.get("/health", headers={"X-Correlation-ID": correlation_id})

    assert response.status_code == 200
    assert response.headers["X-Correlation-ID"] == correlation_id
    assert response.json() == {
        "service": "catalogguard-orchestration",
        "status": "ok",
        "version": "0.1.0-test",
    }


def test_readiness_checks_operational_dependencies(client: TestClient) -> None:
    response = client.get("/ready")

    assert response.status_code == 200
    assert response.json()["dependencies"] == {
        "operationalStore": "ready",
        "queue": "ready",
        "privateStorage": "ready",
    }


def test_readiness_fails_safely_while_liveness_remains_healthy(
    client: TestClient,
    settings: Settings,
) -> None:
    Path(settings.fake_storage_root).rmdir()

    readiness = client.get("/ready")
    liveness = client.get("/health")

    assert readiness.status_code == 503
    assert readiness.json()["error"] == {
        "category": "dependency",
        "code": "DEPENDENCY_UNAVAILABLE",
        "message": "A required dependency is unavailable.",
        "correlationId": readiness.headers["X-Correlation-ID"],
        "retryable": True,
    }
    assert liveness.status_code == 200


def test_metrics_endpoint_exposes_phase_one_counters(client: TestClient) -> None:
    client.get("/health")
    response = client.get("/internal/metrics")

    assert response.status_code == 200
    assert "catalogguard_http_requests_total" in response.text
