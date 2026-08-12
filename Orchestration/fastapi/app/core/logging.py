import json
import logging
from collections.abc import Mapping
from datetime import UTC, datetime
from typing import Any

from app.core.config import Settings

_SENSITIVE_FRAGMENTS = (
    "authorization",
    "checksum_payload",
    "cookie",
    "credential",
    "password",
    "prompt",
    "raw_payload",
    "secret",
    "signature",
    "storage_object_key",
    "storage_url",
    "token",
)


def _is_sensitive_key(key: str) -> bool:
    normalized = key.lower().replace("-", "_")
    compact = normalized.replace("_", "")
    return any(fragment.replace("_", "") in compact for fragment in _SENSITIVE_FRAGMENTS)


def _sanitize(value: Any) -> Any:
    if isinstance(value, Mapping):
        return {
            str(key): _sanitize(nested)
            for key, nested in value.items()
            if not _is_sensitive_key(str(key))
        }
    if isinstance(value, (list, tuple)):
        return [_sanitize(item) for item in value]
    if isinstance(value, (str, int, float, bool)) or value is None:
        return value
    return str(value)


class JsonFormatter(logging.Formatter):
    def __init__(self, settings: Settings) -> None:
        super().__init__()
        self._settings = settings

    def format(self, record: logging.LogRecord) -> str:
        context = getattr(record, "context", {})
        payload = {
            "timestamp": datetime.now(UTC).isoformat(),
            "level": record.levelname,
            "message": record.getMessage(),
            "service": self._settings.service_name,
            "environment": self._settings.environment,
            **_sanitize(context),
        }
        return json.dumps(payload, separators=(",", ":"), ensure_ascii=True)


def configure_logging(settings: Settings) -> logging.Logger:
    logger = logging.getLogger("catalogguard.orchestration")
    logger.handlers.clear()
    handler = logging.StreamHandler()
    handler.setFormatter(JsonFormatter(settings))
    logger.addHandler(handler)
    logger.setLevel(settings.log_level)
    logger.propagate = False
    return logger


def log_event(
    logger: logging.Logger,
    level: int,
    message: str,
    **context: Any,
) -> None:
    logger.log(level, message, extra={"context": context})
