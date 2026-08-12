import logging
from uuid import UUID, uuid4

from fastapi import Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from app.contracts.errors import ErrorDetail, ErrorEnvelope
from app.core.errors import AppError
from app.core.logging import log_event


def _correlation_id(request: Request) -> UUID:
    return getattr(request.state, "correlation_id", uuid4())


async def app_error_handler(request: Request, error: AppError) -> JSONResponse:
    correlation_id = _correlation_id(request)
    logger = request.app.state.logger
    log_event(
        logger,
        logging.WARNING if error.status_code < 500 else logging.ERROR,
        "Request rejected" if error.status_code < 500 else "Request failed",
        correlationId=str(correlation_id),
        operation=f"{request.method} {request.url.path}",
        outcomeCode=error.code,
        retryable=error.retryable,
    )
    envelope = ErrorEnvelope(
        error=ErrorDetail(
            category=error.category,
            code=error.code,
            message=error.message,
            correlation_id=correlation_id,
            retryable=error.retryable,
            field_errors=error.field_errors,
        )
    )
    return JSONResponse(
        status_code=error.status_code,
        content=envelope.model_dump(mode="json", by_alias=True, exclude_none=True),
    )


async def validation_error_handler(
    request: Request,
    error: RequestValidationError,
) -> JSONResponse:
    field_errors: dict[str, list[str]] = {}
    for issue in error.errors():
        location = ".".join(str(part) for part in issue["loc"] if part != "body") or "body"
        field_errors.setdefault(location, []).append(issue["msg"])
    return await app_error_handler(
        request,
        AppError(
            category="validation",
            code="REQUEST_VALIDATION_FAILED",
            message="The request did not match the supported contract.",
            status_code=422,
            field_errors={key: tuple(messages) for key, messages in field_errors.items()},
        ),
    )


async def unexpected_error_handler(request: Request, error: Exception) -> JSONResponse:
    logger = request.app.state.logger
    correlation_id = _correlation_id(request)
    log_event(
        logger,
        logging.ERROR,
        "Unexpected request failure",
        correlationId=str(correlation_id),
        operation=f"{request.method} {request.url.path}",
        outcomeCode=type(error).__name__,
    )
    return await app_error_handler(
        request,
        AppError(
            category="internal",
            code="INTERNAL_ERROR",
            message="The operation could not be completed.",
            status_code=500,
            retryable=True,
        ),
    )
