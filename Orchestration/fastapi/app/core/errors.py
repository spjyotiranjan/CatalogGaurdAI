from dataclasses import dataclass

from app.contracts.errors import ErrorCategory


@dataclass(slots=True)
class AppError(Exception):
    category: ErrorCategory
    code: str
    message: str
    status_code: int
    retryable: bool = False
    field_errors: dict[str, tuple[str, ...]] | None = None

    def __str__(self) -> str:
        return self.message
