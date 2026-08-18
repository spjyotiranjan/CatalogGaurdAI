import logging
import time
from uuid import UUID, uuid4

from fastapi import Request, Response
from opentelemetry import trace
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint

from app.core.logging import log_event
from app.core.metrics import OrchestrationMetrics

CORRELATION_ID_HEADER = "X-Correlation-ID"


def resolve_correlation_id(value: str | None) -> UUID:
    if value is not None:
        try:
            return UUID(value)
        except ValueError:
            pass
    return uuid4()


class CorrelationMiddleware(BaseHTTPMiddleware):
    def __init__(
        self,
        app: object,
        *,
        logger: logging.Logger,
        metrics: OrchestrationMetrics,
    ) -> None:
        super().__init__(app)  # type: ignore[arg-type]
        self._logger = logger
        self._metrics = metrics

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        correlation_id = resolve_correlation_id(request.headers.get(CORRELATION_ID_HEADER))
        request.state.correlation_id = correlation_id
        trace.get_current_span().set_attribute(
            "catalogguard.correlation_id",
            str(correlation_id),
        )
        started = time.perf_counter()
        response = await call_next(request)
        duration = time.perf_counter() - started
        response.headers[CORRELATION_ID_HEADER] = str(correlation_id)

        route = request.scope.get("route")
        route_path = getattr(route, "path", request.url.path)
        self._metrics.http_requests.labels(
            request.method,
            route_path,
            str(response.status_code),
        ).inc()
        self._metrics.http_duration.labels(request.method, route_path).observe(duration)
        log_event(
            self._logger,
            logging.INFO,
            "Request completed",
            correlationId=str(correlation_id),
            operation=f"{request.method} {route_path}",
            outcomeCode=str(response.status_code),
            durationMs=round(duration * 1000, 3),
        )
        return response
