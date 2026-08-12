import hmac
from dataclasses import dataclass
from datetime import UTC, datetime
from uuid import UUID

from app.core.config import Settings
from app.core.errors import AppError
from app.repositories.operational import OperationalRepository
from app.security.signing import canonical_message


@dataclass(frozen=True, slots=True)
class AuthenticatedService:
    service_id: str
    timestamp: datetime
    nonce: UUID


class ServiceAuthenticator:
    def __init__(self, settings: Settings, repository: OperationalRepository) -> None:
        self._settings = settings
        self._repository = repository

    async def authenticate(
        self,
        *,
        key_version: str,
        service_id: str,
        timestamp_header: str,
        nonce_header: str,
        signature: str,
        method: str,
        path: str,
        body: bytes,
        now: datetime | None = None,
    ) -> AuthenticatedService:
        safe_error = AppError(
            category="authentication",
            code="SERVICE_AUTHENTICATION_FAILED",
            message="Service authentication failed.",
            status_code=401,
        )
        if (
            service_id != self._settings.web_service_id
            or key_version != self._settings.web_service_key_version
        ):
            raise safe_error
        try:
            timestamp_value = int(timestamp_header)
            timestamp = datetime.fromtimestamp(timestamp_value, tz=UTC)
            nonce = UUID(nonce_header)
        except (OverflowError, TypeError, ValueError) as error:
            raise safe_error from error
        if len(signature) != 64 or any(
            character not in "0123456789abcdef" for character in signature
        ):
            raise safe_error

        current_time = now or datetime.now(UTC)
        age_seconds = abs((current_time - timestamp).total_seconds())
        if age_seconds > self._settings.service_auth_max_clock_skew_seconds:
            raise AppError(
                category="authentication",
                code="SERVICE_MESSAGE_STALE",
                message="The service message is outside the accepted time window.",
                status_code=401,
            )

        expected = hmac.digest(
            self._settings.web_service_secret.get_secret_value().encode("utf-8"),
            canonical_message(
                key_version=key_version,
                service_id=service_id,
                timestamp=timestamp_value,
                nonce=nonce,
                method=method,
                path=path,
                body=body,
            ),
            "sha256",
        ).hex()
        if not hmac.compare_digest(expected, signature):
            raise safe_error

        accepted = await self._repository.accept_nonce(
            service_id=service_id,
            nonce=nonce,
            accepted_at=current_time,
            retention_seconds=self._settings.replay_nonce_retention_seconds,
        )
        if not accepted:
            raise AppError(
                category="conflict",
                code="SERVICE_MESSAGE_REPLAYED",
                message="The service message nonce has already been accepted.",
                status_code=409,
            )
        return AuthenticatedService(service_id=service_id, timestamp=timestamp, nonce=nonce)
