from typing import Literal

from fastapi import APIRouter, Request
from pydantic import ConfigDict, Field
from pydantic.main import BaseModel

from app.contracts.errors import ErrorEnvelope
from app.core.config import Settings
from app.core.errors import AppError

router = APIRouter(tags=["health"])


class HealthResponse(BaseModel):
    model_config = ConfigDict(
        extra="forbid",
        json_schema_extra={
            "examples": [
                {
                    "service": "catalogguard-orchestration",
                    "status": "ok",
                    "version": "0.1.0",
                }
            ]
        },
    )

    service: str = Field(description="Configured service name.")
    status: Literal["ok", "ready"] = Field(description="Liveness or readiness outcome.")
    version: str = Field(description="Running application version.")
    dependencies: dict[str, Literal["ready"]] | None = Field(
        default=None,
        description="Required dependency readiness states; omitted from liveness.",
    )


@router.get(
    "/health",
    response_model=HealthResponse,
    response_model_exclude_none=True,
    operation_id="getOrchestrationHealth",
    summary="Check process liveness",
    description=(
        "Returns FastAPI process liveness without probing the operational store, queue, "
        "or private storage. Safe for platform liveness checks."
    ),
    response_description="The Orchestration process is alive.",
)
async def health(request: Request) -> HealthResponse:
    settings: Settings = request.app.state.settings
    return HealthResponse(
        service=settings.service_name,
        status="ok",
        version=settings.service_version,
    )


@router.get(
    "/ready",
    response_model=HealthResponse,
    response_model_exclude_none=True,
    operation_id="getOrchestrationReadiness",
    summary="Check dependency readiness",
    description=(
        "Checks the operational store, durable queue seam, and private-storage adapter. "
        "A readiness failure does not imply that the process is not alive."
    ),
    response_description="All required Orchestration dependencies are ready.",
    responses={
        503: {
            "model": ErrorEnvelope,
            "description": "A required dependency is unavailable.",
        }
    },
)
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
