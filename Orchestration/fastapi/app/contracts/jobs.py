from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import Field

from app.contracts.base import (
    NonEmptyString,
    ObjectIdString,
    Sha256Hex,
    StrictContractModel,
)
from app.contracts.context import RequestExecutionMetadata

ContractVersion = Literal["v1"]
JobStatus = Literal["PENDING", "PROCESSING", "COMPLETED", "FAILED", "CANCELLED"]


class FeedReferenceV1(StrictContractModel):
    feed_upload_id: ObjectIdString
    seller_id: ObjectIdString
    file_type: Literal["CSV"]
    feed_type: Literal["PRODUCT_LISTING"]
    checksum: Sha256Hex
    storage_object_key: NonEmptyString = Field(max_length=512, pattern=r"^[^\x00-\x1f]+$")
    mapping_version: Literal["catalog-map/v1"]


class ValidationJobRequestV1(StrictContractModel):
    contract_version: ContractVersion
    job_id: UUID
    idempotency_key: NonEmptyString = Field(max_length=128)
    feed: FeedReferenceV1
    execution: RequestExecutionMetadata


class AcceptedJobResponseV1(StrictContractModel):
    contract_version: ContractVersion = "v1"
    job_id: UUID
    status: JobStatus
    duplicate: bool
    correlation_id: UUID


class JobStatusResponseV1(StrictContractModel):
    contract_version: ContractVersion = "v1"
    job_id: UUID
    status: JobStatus
    correlation_id: UUID
    attempt_count: int = Field(ge=0)
    processed_rows: int = Field(ge=0)
    total_rows: int | None = Field(default=None, ge=0)
    last_checkpoint: str | None = Field(default=None, max_length=256)
    safe_failure_code: str | None = Field(default=None, max_length=80)
    created_at: datetime
    updated_at: datetime
