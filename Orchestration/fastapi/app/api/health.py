from typing import Literal

from fastapi import APIRouter, Request
from pydantic import ConfigDict
from pydantic.main import BaseModel

from app.core.config import Settings
from app.core.errors import AppError

router = APIRouter(tags=["health"])


class HealthResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    service: str
    status: Literal["ok", "ready"]
    version: str
    dependencies: dict[str, Literal["ready"]] | None = None


@router.get("/health", response_model=HealthResponse, response_model_exclude_none=True)
async def health(request: Request) -> HealthResponse:
    settings: Settings = request.app.state.settings
    return HealthResponse(
        service=settings.service_name,
        status="ok",
        version=settings.service_version,
    )


@router.get("/ready", response_model=HealthResponse, response_model_exclude_none=True)
async def ready(request: Request) -> HealthResponse:
    settings: Settings = request.app.state.settings
    try:
        await request.app.state.repository.ping()
        await request.app.state.queue.readiness_check()
        await request.app.state.storage.readiness_check()
    except Exception as error:
        raise AppError(
            category="dependency",
            code="DEPENDENCY_UNAVAILABLE",
            message="A required dependency is unavailable.",
            status_code=503,
            retryable=True,
        ) from error
    return HealthResponse(
        service=settings.service_name,
        status="ready",
        version=settings.service_version,
        dependencies={
            "operationalStore": "ready",
            "queue": "ready",
            "privateStorage": "ready",
        },
    )
