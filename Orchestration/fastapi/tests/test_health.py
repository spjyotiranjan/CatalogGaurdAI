from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health_reports_service_is_alive() -> None:
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {
        "service": "catalogguard-orchestration",
        "status": "ok",
        "version": "0.1.0",
    }


def test_readiness_reports_service_is_ready() -> None:
    response = client.get("/ready")

    assert response.status_code == 200
    assert response.json() == {
        "service": "catalogguard-orchestration",
        "status": "ready",
        "version": "0.1.0",
    }
