from decimal import Decimal
from typing import Literal
from uuid import UUID

from pydantic import Field, JsonValue, model_validator

from app.contracts.base import (
    NonEmptyString,
    ObjectIdString,
    Sha256Hex,
    StrictContractModel,
)
from app.contracts.context import ResultExecutionMetadata


class NormalizedProductCandidateV1(StrictContractModel):
    """Versioned normalized candidate produced from one immutable source row."""

    external_product_id: NonEmptyString = Field(max_length=128)
    sku: NonEmptyString = Field(max_length=128)
    title: NonEmptyString = Field(max_length=500)
    description: str | None = Field(default=None, max_length=10_000)
    category_id: ObjectIdString | None = None
    currency: str | None = Field(default=None, pattern=r"^[A-Z]{3}$")
    list_price: Decimal | None = Field(default=None, ge=0, max_digits=19, decimal_places=4)
    sale_price: Decimal | None = Field(default=None, ge=0, max_digits=19, decimal_places=4)
    stock_quantity: int | None = Field(default=None, ge=0)
    reserved_quantity: int | None = Field(default=None, ge=0)
    attributes: dict[str, JsonValue] = Field(default_factory=dict, max_length=100)

    @model_validator(mode="after")
    def validate_price_and_inventory_relationships(self) -> "NormalizedProductCandidateV1":
        if (
            self.sale_price is not None
            and self.list_price is not None
            and self.sale_price > self.list_price
        ):
            raise ValueError("salePrice must not exceed listPrice")
        if (
            self.reserved_quantity is not None
            and self.stock_quantity is not None
            and self.reserved_quantity > self.stock_quantity
        ):
            raise ValueError("reservedQuantity must not exceed stockQuantity")
        return self


class ValidationFindingV1(StrictContractModel):
    """Transport-only deterministic finding for Web canonical issue application."""

    rule_id: NonEmptyString = Field(max_length=100)
    rule_version: NonEmptyString = Field(max_length=40)
    field_path: NonEmptyString = Field(max_length=256)
    issue_type: Literal["MISSING", "INVALID", "INCONSISTENT", "DUPLICATE"]
    severity: Literal["INFO", "WARNING", "ERROR", "BLOCKER"]
    message: NonEmptyString = Field(max_length=500)
    detected_value: JsonValue | None = None
    expected_value: JsonValue | None = None
    suggested_value: JsonValue | None = None


class AIUsageV1(StrictContractModel):
    """Bounded provider usage and optional cost attribution for one advisory."""

    input_tokens: int = Field(ge=0)
    output_tokens: int = Field(ge=0)
    cost_microunits: int | None = Field(default=None, ge=0)


class AIAdvisoryV1(StrictContractModel):
    """Strict non-authoritative AI category-consistency evidence."""

    advisory_type: Literal["CATEGORY_CHECK"]
    status: Literal["COMPLETED", "FAILED", "SKIPPED"]
    consistent: bool | None = None
    suggested_category_id: ObjectIdString | None = None
    suggestion: str | None = Field(default=None, max_length=500)
    confidence: Decimal | None = Field(default=None, ge=0, le=1, max_digits=5, decimal_places=4)
    evidence: tuple[str, ...] = Field(default=(), max_length=5)
    provider: str | None = Field(default=None, max_length=80)
    model: str | None = Field(default=None, max_length=120)
    prompt_version: str | None = Field(default=None, max_length=80)
    input_snapshot_hash: Sha256Hex | None = None
    latency_ms: int | None = Field(default=None, ge=0)
    usage: AIUsageV1 | None = None
    failure_reason: str | None = Field(default=None, max_length=120)

    @model_validator(mode="after")
    def validate_outcome_shape(self) -> "AIAdvisoryV1":
        if self.status == "COMPLETED":
            required = (
                self.consistent,
                self.suggestion,
                self.confidence,
                self.provider,
                self.model,
                self.prompt_version,
                self.input_snapshot_hash,
            )
            if any(value is None for value in required):
                raise ValueError("completed advisory metadata is incomplete")
            if not self.evidence:
                raise ValueError("completed advisory requires evidence")
        elif not self.failure_reason:
            raise ValueError("failed or skipped advisory requires a safe failure reason")
        return self


class RecordValidationResultV1(StrictContractModel):
    """Outcome, evidence, and normalized data for one source row."""

    source_row_number: int = Field(ge=1)
    candidate_identity: NonEmptyString = Field(max_length=256)
    source_product_id: str | None = Field(default=None, max_length=128)
    outcome: Literal["ACCEPTED", "REJECTED", "FAILED"]
    normalized_candidate: NormalizedProductCandidateV1 | None = None
    rule_set_version: NonEmptyString = Field(max_length=80)
    issues: tuple[ValidationFindingV1, ...] = Field(default=(), max_length=200)
    ai_advisory: AIAdvisoryV1 | None = None
    error_summary: str | None = Field(default=None, max_length=500)

    @model_validator(mode="after")
    def validate_record_outcome(self) -> "RecordValidationResultV1":
        if self.outcome == "ACCEPTED" and self.normalized_candidate is None:
            raise ValueError("accepted records require a normalized candidate")
        if self.outcome == "FAILED" and not self.error_summary:
            raise ValueError("failed records require a safe error summary")
        return self


class ResultSummaryV1(StrictContractModel):
    """Reconciled job-level source-row counts."""

    total_rows: int = Field(ge=0)
    processed_rows: int = Field(ge=0)
    accepted_rows: int = Field(ge=0)
    rejected_rows: int = Field(ge=0)

    @model_validator(mode="after")
    def reconcile_counts(self) -> "ResultSummaryV1":
        if self.processed_rows > self.total_rows:
            raise ValueError("processedRows cannot exceed totalRows")
        if self.accepted_rows + self.rejected_rows != self.processed_rows:
            raise ValueError("acceptedRows plus rejectedRows must equal processedRows")
        return self


class ValidationJobResultV1(StrictContractModel):
    """Strict terminal Orchestration-to-Web callback body contract."""

    contract_version: Literal["v1"]
    job_id: UUID
    feed_upload_id: ObjectIdString
    seller_id: ObjectIdString
    checksum: Sha256Hex
    idempotency_key: NonEmptyString = Field(max_length=128)
    outcome: Literal["COMPLETED", "FAILED", "CANCELLED"]
    summary: ResultSummaryV1
    records: tuple[RecordValidationResultV1, ...] = Field(max_length=1_000)
    execution: ResultExecutionMetadata

    @model_validator(mode="after")
    def reconcile_records(self) -> "ValidationJobResultV1":
        if len(self.records) != self.summary.processed_rows:
            raise ValueError(
                "records length must equal processedRows for the v1 non-chunked result"
            )
        if self.outcome == "COMPLETED" and self.summary.processed_rows != self.summary.total_rows:
            raise ValueError("completed results must account for every row")
        return self
