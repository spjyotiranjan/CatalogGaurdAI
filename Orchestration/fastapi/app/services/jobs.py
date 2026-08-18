from uuid import UUID

from app.contracts.context import ExecutionContext
from app.contracts.jobs import (
    AcceptedJobResponseV1,
    JobStatusResponseV1,
    ValidationJobRequestV1,
)
from app.core.errors import AppError
from app.repositories.operational import OperationalRepository
from app.security.service_auth import AuthenticatedService


class JobService:
    def __init__(self, repository: OperationalRepository) -> None:
        self._repository = repository

    @staticmethod
    def execution_context(
        request: ValidationJobRequestV1,
        caller: AuthenticatedService,
    ) -> ExecutionContext:
        if request.execution.actor_service != caller.service_id:
            raise AppError(
                category="authorization",
                code="ACTOR_IDENTITY_MISMATCH",
                message="The execution actor does not match the authenticated service.",
                status_code=403,
            )
        return ExecutionContext(
            correlation_id=request.execution.correlation_id,
            actor_type=request.execution.actor_type,
            actor_service=caller.service_id,
            job_id=request.job_id,
            idempotency_key=request.idempotency_key,
            feed_upload_id=request.feed.feed_upload_id,
            seller_id=request.feed.seller_id,
        )

    async def accept_job(
        self,
        request: ValidationJobRequestV1,
        caller: AuthenticatedService,
    ) -> AcceptedJobResponseV1:
        context = self.execution_context(request, caller)
        accepted = await self._repository.accept_job(request)
        return AcceptedJobResponseV1(
            job_id=accepted.job_id,
            status=accepted.status,
            duplicate=accepted.duplicate,
            correlation_id=context.correlation_id,
        )

    async def get_job(
        self,
        job_id: UUID,
        correlation_id: UUID,
    ) -> JobStatusResponseV1:
        job = await self._repository.get_job(job_id)
        if job is None:
            raise AppError(
                category="validation",
                code="JOB_NOT_FOUND",
                message="The validation job was not found.",
                status_code=404,
            )
        return JobStatusResponseV1(
            job_id=job.job_id,
            status=job.status,
            correlation_id=correlation_id,
            attempt_count=job.attempt_count,
            processed_rows=job.processed_rows,
            total_rows=job.total_rows,
            last_checkpoint=job.last_checkpoint,
            safe_failure_code=job.safe_failure_code,
            created_at=job.created_at,
            updated_at=job.updated_at,
        )
