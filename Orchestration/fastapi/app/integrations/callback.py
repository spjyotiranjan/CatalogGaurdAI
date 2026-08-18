import json
import time
from uuid import uuid4

from app.contracts.results import ValidationJobResultV1
from app.core.config import Settings
from app.security.signing import SignedHeaders, sign_http_message


class CallbackSigner:
    def __init__(self, settings: Settings) -> None:
        self._settings = settings

    def sign_result(
        self,
        result: ValidationJobResultV1,
        *,
        path: str,
        timestamp: int | None = None,
    ) -> tuple[bytes, SignedHeaders]:
        if result.execution.actor_service != self._settings.callback_service_id:
            raise ValueError("result actorService must match the configured callback service")
        body = json.dumps(
            result.model_dump(mode="json", by_alias=True),
            sort_keys=True,
            separators=(",", ":"),
        ).encode("utf-8")
        headers = sign_http_message(
            secret=self._settings.callback_signing_secret.get_secret_value(),
            key_version=self._settings.callback_key_version,
            service_id=self._settings.callback_service_id,
            timestamp=timestamp or int(time.time()),
            nonce=uuid4(),
            method="POST",
            path=path,
            body=body,
        )
        return body, headers
