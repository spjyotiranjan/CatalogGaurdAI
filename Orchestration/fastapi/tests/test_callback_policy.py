from app.services.callback_policy import classify_callback_response


def test_callback_retry_policy_uses_bounded_exponential_backoff() -> None:
    first = classify_callback_response(
        attempt=1,
        max_attempts=5,
        base_seconds=1,
        max_seconds=3,
        status_code=503,
    )
    later = classify_callback_response(
        attempt=4,
        max_attempts=5,
        base_seconds=1,
        max_seconds=3,
        status_code=None,
    )

    assert first.classification == "retryable"
    assert first.delay_seconds == 1
    assert later.delay_seconds == 3


def test_callback_policy_does_not_retry_permanent_contract_failures() -> None:
    decision = classify_callback_response(
        attempt=1,
        max_attempts=5,
        base_seconds=1,
        max_seconds=30,
        status_code=422,
    )

    assert decision.classification == "permanent"
    assert decision.delay_seconds is None


def test_callback_policy_accepts_success_and_stops_after_attempt_limit() -> None:
    success = classify_callback_response(
        attempt=1,
        max_attempts=5,
        base_seconds=1,
        max_seconds=30,
        status_code=204,
    )
    exhausted = classify_callback_response(
        attempt=5,
        max_attempts=5,
        base_seconds=1,
        max_seconds=30,
        status_code=500,
    )

    assert success.classification == "success"
    assert exhausted.classification == "permanent"
