from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import AnyHttpUrl, Field, SecretStr, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Validated process configuration (SEC-01, SEC-02, OPS-01)."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        env_prefix="CATALOGGUARD_",
        extra="forbid",
        case_sensitive=False,
    )

    environment: Literal["development", "test", "staging", "production"]
    service_name: str = Field(min_length=1, max_length=80)
    service_version: str = Field(min_length=1, max_length=80)
    log_level: Literal["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"] = "INFO"

    operational_db_path: Path
    auto_migrate_operational_store: bool = True
    fake_storage_root: Path
    private_storage_backend: Literal["fake"] = "fake"
    web_service_id: str = Field(min_length=3, max_length=80)
    web_service_key_version: str = Field(min_length=1, max_length=40)
    web_service_secret: SecretStr = Field(min_length=32)
    callback_service_id: str = Field(min_length=3, max_length=80)
    callback_key_version: str = Field(min_length=1, max_length=40)
    callback_signing_secret: SecretStr = Field(min_length=32)

    service_auth_max_clock_skew_seconds: int = Field(default=300, ge=30, le=900)
    replay_nonce_retention_seconds: int = Field(default=900, ge=60, le=3600)
    max_job_request_bytes: int = Field(default=262_144, ge=1_024, le=1_048_576)
    job_timeout_seconds: int = Field(default=900, ge=30, le=7200)
    callback_timeout_seconds: int = Field(default=10, ge=1, le=120)
    callback_max_attempts: int = Field(default=5, ge=1, le=10)
    callback_backoff_base_seconds: float = Field(default=1.0, ge=0.1, le=30.0)
    callback_backoff_max_seconds: float = Field(default=30.0, ge=1.0, le=300.0)

    otel_exporter_otlp_endpoint: AnyHttpUrl | None = None
    enable_metrics: bool = True

    @model_validator(mode="after")
    def validate_security_and_retry_policy(self) -> "Settings":
        if self.replay_nonce_retention_seconds < self.service_auth_max_clock_skew_seconds * 2:
            raise ValueError(
                "replay_nonce_retention_seconds must cover both sides of the clock-skew window"
            )
        if self.callback_backoff_max_seconds < self.callback_backoff_base_seconds:
            raise ValueError("callback_backoff_max_seconds must not be below its base")
        if self.web_service_id == self.callback_service_id:
            raise ValueError("inbound and callback service IDs must be distinct")
        if (
            self.web_service_secret.get_secret_value()
            == self.callback_signing_secret.get_secret_value()
        ):
            raise ValueError("inbound and callback signing secrets must be distinct")
        if self.environment in {"staging", "production"}:
            if self.auto_migrate_operational_store:
                raise ValueError(
                    "auto_migrate_operational_store must be disabled in staging and production"
                )
            if not self.operational_db_path.is_absolute():
                raise ValueError("operational_db_path must be absolute outside local environments")
            if not self.fake_storage_root.is_absolute():
                raise ValueError("fake_storage_root must be absolute outside local environments")
            endpoint = self.otel_exporter_otlp_endpoint
            if endpoint is None or endpoint.scheme != "https":
                raise ValueError("an HTTPS OTLP endpoint is required in staging and production")
        if self.environment == "production" and self.private_storage_backend == "fake":
            raise ValueError("the fake private-storage backend is forbidden in production")
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]


def clear_settings_cache() -> None:
    get_settings.cache_clear()
