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
    """Immutable private CSV identity granted by the trusted Web job."""

    feed_upload_id: ObjectIdString = Field(description="Web-owned feed upload identifier.")
    seller_id: ObjectIdString = Field(description="Trusted Web-owned seller scope.")
    file_type: Literal["CSV"] = Field(description="Enabled MVP input format.")
    feed_type: Literal["PRODUCT_LISTING"] = Field(description="Enabled MVP feed purpose.")
    checksum: Sha256Hex = Field(description="Expected lowercase SHA-256 content checksum.")
    storage_object_key: NonEmptyString = Field(
        max_length=512,
        pattern=r"^[^\x00-\x1f]+$",
        description="Scoped private object key; never a public or seller-provided URL.",
    )
    mapping_version: Literal["catalog-map/v1"] = Field(
        description="Versioned source-to-candidate field mapping."
    )


class ValidationJobRequestV1(StrictContractModel):
    """Strict authenticated Web-to-Orchestration validation-job contract."""

    contract_version: ContractVersion = Field(description="Transport contract version.")
    job_id: UUID = Field(description="Stable logical validation-job identifier.")
    idempotency_key: NonEmptyString = Field(
        max_length=128,
        description="Stable key binding one canonical request to one logical job.",
    )
    feed: FeedReferenceV1
    execution: RequestExecutionMetadata


class AcceptedJobResponseV1(StrictContractModel):
    """Acknowledgement for a newly accepted or identical repeated job request."""

    contract_version: ContractVersion = "v1"
    job_id: UUID
    status: JobStatus
    duplicate: bool
    correlation_id: UUID


class JobStatusResponseV1(StrictContractModel):
    """Persisted operational job state and safe progress projection."""

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
