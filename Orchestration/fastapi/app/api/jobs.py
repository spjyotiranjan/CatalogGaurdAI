import logging
from uuid import UUID

from fastapi import APIRouter, Header, Request, Response

from app.contracts.jobs import (
    AcceptedJobResponseV1,
    JobStatusResponseV1,
    ValidationJobRequestV1,
)
from app.core.errors import AppError
from app.core.logging import log_event
from app.security.signing import (
    KEY_VERSION_HEADER,
    NONCE_HEADER,
    SERVICE_HEADER,
    SIGNATURE_HEADER,
    TIMESTAMP_HEADER,
)

router = APIRouter(prefix="/internal/v1", tags=["validation-jobs"])


async def _authenticate(request: Request, body: bytes):
    key_version = request.headers.get(KEY_VERSION_HEADER)
    service_id = request.headers.get(SERVICE_HEADER)
    timestamp = request.headers.get(TIMESTAMP_HEADER)
    nonce = request.headers.get(NONCE_HEADER)
    signature = request.headers.get(SIGNATURE_HEADER)
    if not all((key_version, service_id, timestamp, nonce, signature)):
        request.app.state.metrics.service_authentication.labels("missing_headers").inc()
        raise AppError(
            category="authentication",
            code="SERVICE_AUTHENTICATION_FAILED",
            message="Service authentication failed.",
            status_code=401,
        )
    try:
        authenticated = await request.app.state.authenticator.authenticate(
            key_version=key_version,
            service_id=service_id,
            timestamp_header=timestamp,
            nonce_header=nonce,
            signature=signature,
            method=request.method,
            path=request.url.path,
            body=body,
        )
    except AppError:
        request.app.state.metrics.service_authentication.labels("rejected").inc()
        raise
    request.app.state.metrics.service_authentication.labels("accepted").inc()
    return authenticated


@router.post(
    "/jobs",
    response_model=AcceptedJobResponseV1,
    status_code=202,
    openapi_extra={
        "requestBody": {
            "required": True,
            "content": {
                "application/json": {
                    "schema": ValidationJobRequestV1.model_json_schema(by_alias=True)
                }
            },
        }
    },
)
async def submit_job(
    request: Request,
    response: Response,
    x_catalogguard_key_version: str | None = Header(default=None),
    x_catalogguard_service: str | None = Header(default=None),
    x_catalogguard_timestamp: str | None = Header(default=None),
    x_catalogguard_nonce: str | None = Header(default=None),
    x_catalogguard_signature: str | None = Header(default=None),
) -> AcceptedJobResponseV1:
    del (
        x_catalogguard_key_version,
        x_catalogguard_service,
        x_catalogguard_timestamp,
        x_catalogguard_nonce,
        x_catalogguard_signature,
    )
    declared_length = request.headers.get("content-length")
    if declared_length is not None:
        try:
            request_too_large = int(declared_length) > (
                request.app.state.settings.max_job_request_bytes
            )
        except ValueError:
            request_too_large = False
        if request_too_large:
            raise AppError(
                category="validation",
                code="JOB_REQUEST_TOO_LARGE",
                message="The validation job request exceeds the supported size.",
                status_code=413,
            )
    body = await request.body()
    caller = await _authenticate(request, body)
    if len(body) > request.app.state.settings.max_job_request_bytes:
        raise AppError(
            category="validation",
            code="JOB_REQUEST_TOO_LARGE",
            message="The validation job request exceeds the supported size.",
            status_code=413,
        )
    if request.headers.get("content-type", "").split(";", 1)[0].strip() != "application/json":
        raise AppError(
            category="validation",
            code="CONTENT_TYPE_UNSUPPORTED",
            message="The validation job request must use application/json.",
            status_code=415,
        )
    try:
        contract = ValidationJobRequestV1.model_validate_json(body)
    except ValueError as error:
        raise AppError(
            category="validation",
            code="JOB_CONTRACT_INVALID",
            message="The validation job does not match contract v1.",
            status_code=422,
        ) from error

    correlation_id = request.state.correlation_id
    if contract.execution.correlation_id != correlation_id:
        raise AppError(
            category="conflict",
            code="CORRELATION_ID_MISMATCH",
            message="The request and execution correlation IDs do not match.",
            status_code=409,
        )
    accepted = await request.app.state.job_service.accept_job(contract, caller)
    response.headers["Location"] = f"/internal/v1/jobs/{accepted.job_id}"
    request.app.state.metrics.job_intake.labels(
        "duplicate" if accepted.duplicate else "accepted"
    ).inc()
    log_event(
        request.app.state.logger,
        logging.INFO,
        "Validation job accepted",
        correlationId=str(correlation_id),
        operation="validation_job.accept",
        outcomeCode="DUPLICATE" if accepted.duplicate else "ACCEPTED",
        actorType="SYSTEM",
        actorService=caller.service_id,
        jobId=str(accepted.job_id),
        feedUploadId=contract.feed.feed_upload_id,
        sellerId=contract.feed.seller_id,
    )
    return accepted


@router.get("/jobs/{job_id}", response_model=JobStatusResponseV1)
async def job_status(
    job_id: str,
    request: Request,
    x_catalogguard_key_version: str | None = Header(default=None),
    x_catalogguard_service: str | None = Header(default=None),
    x_catalogguard_timestamp: str | None = Header(default=None),
    x_catalogguard_nonce: str | None = Header(default=None),
    x_catalogguard_signature: str | None = Header(default=None),
) -> JobStatusResponseV1:
    del (
        x_catalogguard_key_version,
        x_catalogguard_service,
        x_catalogguard_timestamp,
        x_catalogguard_nonce,
        x_catalogguard_signature,
    )
    await _authenticate(request, b"")
    try:
        parsed_job_id = UUID(job_id)
    except ValueError as error:
        raise AppError(
            category="validation",
            code="JOB_ID_INVALID",
            message="The job ID is invalid.",
            status_code=422,
        ) from error
    return await request.app.state.job_service.get_job(
        parsed_job_id,
        request.state.correlation_id,
    )
