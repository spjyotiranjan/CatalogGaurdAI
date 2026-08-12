import hashlib
import hmac
from dataclasses import dataclass
from uuid import UUID

SIGNATURE_VERSION = "v1"
KEY_VERSION_HEADER = "X-CatalogGuard-Key-Version"
SERVICE_HEADER = "X-CatalogGuard-Service"
TIMESTAMP_HEADER = "X-CatalogGuard-Timestamp"
NONCE_HEADER = "X-CatalogGuard-Nonce"
SIGNATURE_HEADER = "X-CatalogGuard-Signature"


@dataclass(frozen=True, slots=True)
class SignedHeaders:
    key_version: str
    service_id: str
    timestamp: int
    nonce: UUID
    signature: str

    def as_http_headers(self) -> dict[str, str]:
        return {
            KEY_VERSION_HEADER: self.key_version,
            SERVICE_HEADER: self.service_id,
            TIMESTAMP_HEADER: str(self.timestamp),
            NONCE_HEADER: str(self.nonce),
            SIGNATURE_HEADER: self.signature,
        }


def body_sha256(body: bytes) -> str:
    return hashlib.sha256(body).hexdigest()


def canonical_message(
    *,
    key_version: str,
    service_id: str,
    timestamp: int,
    nonce: UUID,
    method: str,
    path: str,
    body: bytes,
) -> bytes:
    components = (
        SIGNATURE_VERSION,
        key_version,
        service_id,
        str(timestamp),
        str(nonce),
        method.upper(),
        path,
        body_sha256(body),
    )
    return "\n".join(components).encode("utf-8")


def sign_http_message(
    *,
    secret: str,
    key_version: str,
    service_id: str,
    timestamp: int,
    nonce: UUID,
    method: str,
    path: str,
    body: bytes,
) -> SignedHeaders:
    signature = hmac.new(
        secret.encode("utf-8"),
        canonical_message(
            service_id=service_id,
            key_version=key_version,
            timestamp=timestamp,
            nonce=nonce,
            method=method,
            path=path,
            body=body,
        ),
        hashlib.sha256,
    ).hexdigest()
    return SignedHeaders(
        key_version=key_version,
        service_id=service_id,
        timestamp=timestamp,
        nonce=nonce,
        signature=signature,
    )
