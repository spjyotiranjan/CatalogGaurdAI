from typing import Literal
from uuid import UUID

from pydantic import Field

from app.contracts.base import StrictContractModel

ErrorCategory = Literal[
    "validation", "authentication", "authorization", "conflict", "dependency", "internal"
]


class ErrorDetail(StrictContractModel):
    category: ErrorCategory
    code: str = Field(min_length=1, max_length=80)
    message: str = Field(min_length=1, max_length=500)
    correlation_id: UUID
    retryable: bool
    field_errors: dict[str, tuple[str, ...]] | None = None


class ErrorEnvelope(StrictContractModel):
    error: ErrorDetail
