from fastapi import FastAPI

from app.api.health import router as health_router
from app.core.config import get_settings

settings = get_settings()

app = FastAPI(
    title="CatalogGuard AI Orchestration",
    description="Internal validation-orchestration service.",
    version=settings.service_version,
)
app.include_router(health_router)

