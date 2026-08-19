from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor

from app.api.errors import (
    app_error_handler,
    unexpected_error_handler,
    validation_error_handler,
)
from app.api.health import router as health_router
from app.api.jobs import router as jobs_router
from app.api.metrics import router as metrics_router
from app.core.config import Settings, get_settings
from app.core.errors import AppError
from app.core.logging import configure_logging
from app.core.metrics import OrchestrationMetrics
from app.core.middleware import CorrelationMiddleware
from app.core.openapi import install_openapi_schema
from app.core.telemetry import configure_telemetry
from app.integrations.fake_storage import FakePrivateStorageClient
from app.repositories.operational import OperationalRepository
from app.security.service_auth import ServiceAuthenticator
from app.services.jobs import JobService
from app.workers.queue import DurableQueue


def create_app(settings: Settings | None = None) -> FastAPI:
    resolved_settings = settings or get_settings()
    logger = configure_logging(resolved_settings)
    metrics = OrchestrationMetrics()
    repository = OperationalRepository(resolved_settings.operational_db_path)
    queue = DurableQueue(repository)
    storage = FakePrivateStorageClient(resolved_settings.fake_storage_root)

    @asynccontextmanager
    async def lifespan(application: FastAPI) -> AsyncIterator[None]:
        resolved_settings.fake_storage_root.mkdir(parents=True, exist_ok=True)
        if resolved_settings.auto_migrate_operational_store:
            await repository.migrate()
        else:
            await repository.verify_schema()
        application.state.settings = resolved_settings
        application.state.logger = logger
        application.state.metrics = metrics
        application.state.repository = repository
        application.state.queue = queue
        application.state.storage = storage
        application.state.authenticator = ServiceAuthenticator(resolved_settings, repository)
        application.state.job_service = JobService(repository)
        yield

    docs_enabled = resolved_settings.api_docs_enabled
    application = FastAPI(
        title="CatalogGuard AI Orchestration",
        description=(
            "Private validation-orchestration service for authenticated job intake, "
            "operational status, deterministic validation, and signed Web callbacks. "
            "Browser traffic to internal APIs is unsupported."
        ),
        version=resolved_settings.service_version,
        lifespan=lifespan,
        openapi_url="/openapi.json" if docs_enabled else None,
        docs_url="/docs" if docs_enabled else None,
        redoc_url=None,
    )
    application.add_middleware(CorrelationMiddleware, logger=logger, metrics=metrics)
    application.add_exception_handler(AppError, app_error_handler)
    application.add_exception_handler(RequestValidationError, validation_error_handler)
    application.add_exception_handler(Exception, unexpected_error_handler)
    application.include_router(health_router)
    application.include_router(jobs_router)
    if resolved_settings.enable_metrics:
        application.include_router(metrics_router)
    install_openapi_schema(application)

    provider = configure_telemetry(resolved_settings)
    FastAPIInstrumentor.instrument_app(application, tracer_provider=provider)
    return application


app = create_app()
