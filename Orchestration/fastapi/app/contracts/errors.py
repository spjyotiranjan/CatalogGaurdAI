from typing import Literal
from uuid import UUID

from pydantic import Field

from app.contracts.base import StrictContractModel

ErrorCategory = Literal[
    "validation", "authentication", "authorization", "conflict", "dependency", "internal"
]


class ErrorDetail(StrictContractModel):
    """Stable client-safe failure details without stack traces or private payloads."""

    category: ErrorCategory = Field(description="Stable high-level error category.")
    code: str = Field(
        min_length=1,
        max_length=80,
        description="Stable machine-readable outcome code.",
    )
    message: str = Field(
        min_length=1,
        max_length=500,
        description="Safe human-readable summary.",
    )
    correlation_id: UUID = Field(description="Trace identifier for support and operations.")
    retryable: bool = Field(description="Whether the caller may retry this operation safely.")
    field_errors: dict[str, tuple[str, ...]] | None = Field(
        default=None,
        description="Optional safe validation messages grouped by field path.",
    )


class ErrorEnvelope(StrictContractModel):
    """Uniform error response returned by Orchestration endpoints."""

    error: ErrorDetail
