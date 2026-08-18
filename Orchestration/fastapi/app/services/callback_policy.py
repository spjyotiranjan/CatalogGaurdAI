from dataclasses import dataclass
from typing import Literal


@dataclass(frozen=True, slots=True)
class CallbackAttemptDecision:
    classification: Literal["success", "retryable", "permanent"]
    delay_seconds: float | None


def classify_callback_response(
    *,
    attempt: int,
    max_attempts: int,
    base_seconds: float,
    max_seconds: float,
    status_code: int | None,
) -> CallbackAttemptDecision:
    if status_code is not None and 200 <= status_code < 300:
        return CallbackAttemptDecision("success", None)
    retryable = status_code is None or status_code in {408, 429} or status_code >= 500
    if not retryable or attempt >= max_attempts:
        return CallbackAttemptDecision("permanent", None)
    return CallbackAttemptDecision(
        "retryable",
        min(max_seconds, base_seconds * (2 ** max(0, attempt - 1))),
    )
