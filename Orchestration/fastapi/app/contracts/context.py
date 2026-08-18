from typing import Literal
from uuid import UUID

from pydantic import Field

from app.contracts.base import NonEmptyString, ObjectIdString, StrictContractModel


class RequestExecutionMetadata(StrictContractModel):
    correlation_id: UUID
    actor_type: Literal["SYSTEM"]
    actor_service: NonEmptyString = Field(max_length=80)


class ResultExecutionMetadata(StrictContractModel):
    correlation_id: UUID
    actor_type: Literal["SYSTEM"]
    actor_service: NonEmptyString = Field(max_length=80)


class ExecutionContext(StrictContractModel):
    correlation_id: UUID
    actor_type: Literal["SYSTEM", "AI"]
    actor_service: NonEmptyString = Field(max_length=80)
    job_id: UUID
    idempotency_key: NonEmptyString = Field(max_length=128)
    feed_upload_id: ObjectIdString
    seller_id: ObjectIdString
