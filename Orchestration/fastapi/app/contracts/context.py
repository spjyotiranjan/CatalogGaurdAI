from typing import Literal
from uuid import UUID

from pydantic import Field

from app.contracts.base import NonEmptyString, ObjectIdString, StrictContractModel


class RequestExecutionMetadata(StrictContractModel):
    """Trusted Web execution identity carried by a validation-job request."""

    correlation_id: UUID = Field(description="End-to-end trace identifier.")
    actor_type: Literal["SYSTEM"] = Field(description="Internal service actor type.")
    actor_service: NonEmptyString = Field(
        max_length=80,
        description="Service identity that must match the authenticated caller.",
    )


class ResultExecutionMetadata(StrictContractModel):
    """Trusted Orchestration execution identity returned with a result."""

    correlation_id: UUID = Field(description="Original end-to-end trace identifier.")
    actor_type: Literal["SYSTEM"] = Field(description="Internal service actor type.")
    actor_service: NonEmptyString = Field(
        max_length=80,
        description="Configured Orchestration callback service identity.",
    )


class ExecutionContext(StrictContractModel):
    """Internal immutable context propagated through job processing."""

    correlation_id: UUID
    actor_type: Literal["SYSTEM", "AI"]
    actor_service: NonEmptyString = Field(max_length=80)
    job_id: UUID
    idempotency_key: NonEmptyString = Field(max_length=128)
    feed_upload_id: ObjectIdString
    seller_id: ObjectIdString
