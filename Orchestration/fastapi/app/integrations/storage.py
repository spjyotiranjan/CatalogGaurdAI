import asyncio
import base64
import hashlib
import hmac
import urllib.error
import urllib.parse
import urllib.request
from collections.abc import AsyncIterator
from datetime import UTC, datetime
from typing import Protocol

from app.core.config import Settings
from app.core.errors import AppError


class PrivateObjectStorage(Protocol):
    async def readiness_check(self) -> None: ...
    async def stream(
        self,
        storage_object_key: str,
        expected_size: int | None = None,
        expected_checksum: str | None = None,
    ) -> AsyncIterator[bytes]: ...


class R2PrivateStorageClient:
    """Scoped, read-only S3-compatible R2 adapter. Keys come only from signed Web jobs."""

    def __init__(self, settings: Settings) -> None:
        self._endpoint = str(settings.r2_endpoint).rstrip("/")
        self._bucket = settings.r2_bucket_name or ""
        self._access_key = (
            settings.r2_access_key_id.get_secret_value() if settings.r2_access_key_id else ""
        )
        self._secret = (
            settings.r2_secret_access_key.get_secret_value()
            if settings.r2_secret_access_key
            else ""
        )
        self._max_bytes = settings.r2_max_object_bytes

    def _url(self, key: str) -> str:
        if not key or key.startswith("/") or ".." in key.split("/"):
            raise AppError(
                category="authorization",
                code="STORAGE_SCOPE_DENIED",
                message="The private object reference is outside the granted scope.",
                status_code=403,
            )
        bucket = urllib.parse.quote(self._bucket, safe="")
        object_key = urllib.parse.quote(key, safe="/~")
        return f"{self._endpoint}/{bucket}/{object_key}"

    def _request(self, method: str, key: str) -> urllib.request.Request:
        url = self._url(key)
        parsed = urllib.parse.urlsplit(url)
        now = datetime.now(UTC)
        stamp = now.strftime("%Y%m%dT%H%M%SZ")
        date = now.strftime("%Y%m%d")
        payload_hash = "UNSIGNED-PAYLOAD"
        canonical_headers = (
            f"host:{parsed.netloc}\nx-amz-content-sha256:{payload_hash}\nx-amz-date:{stamp}\n"
        )
        signed_headers = "host;x-amz-content-sha256;x-amz-date"
        canonical = "\n".join(
            [method, parsed.path, "", canonical_headers, signed_headers, payload_hash]
        )
        scope = f"{date}/auto/s3/aws4_request"
        string_to_sign = "\n".join(
            ["AWS4-HMAC-SHA256", stamp, scope, hashlib.sha256(canonical.encode()).hexdigest()]
        )

        def sign(key_bytes: bytes, value: str) -> bytes:
            return hmac.new(key_bytes, value.encode(), hashlib.sha256).digest()

        signing_key = sign(
            sign(sign(sign(("AWS4" + self._secret).encode(), date), "auto"), "s3"), "aws4_request"
        )
        signature = hmac.new(signing_key, string_to_sign.encode(), hashlib.sha256).hexdigest()
        authorization = (
            "AWS4-HMAC-SHA256 "
            f"Credential={self._access_key}/{scope}, "
            f"SignedHeaders={signed_headers}, Signature={signature}"
        )
        return urllib.request.Request(
            url,
            method=method,
            headers={
                "Host": parsed.netloc,
                "x-amz-content-sha256": payload_hash,
                "x-amz-date": stamp,
                "Authorization": authorization,
            },
        )

    async def readiness_check(self) -> None:
        if not self._endpoint or not self._bucket or not self._access_key or not self._secret:
            raise AppError(
                category="dependency",
                code="PRIVATE_STORAGE_UNAVAILABLE",
                message="The private-storage dependency is unavailable.",
                status_code=503,
                retryable=True,
            )

    async def stream(
        self,
        storage_object_key: str,
        expected_size: int | None = None,
        expected_checksum: str | None = None,
    ) -> AsyncIterator[bytes]:
        await self.readiness_check()
        try:
            response = await asyncio.to_thread(
                urllib.request.urlopen, self._request("GET", storage_object_key), timeout=10
            )
        except (urllib.error.URLError, urllib.error.HTTPError) as error:
            raise AppError(
                category="dependency",
                code="PRIVATE_OBJECT_NOT_FOUND",
                message="The private object could not be read.",
                status_code=404 if getattr(error, "code", None) == 404 else 503,
                retryable=getattr(error, "code", None) != 404,
            ) from error
        content_length = response.headers.get("Content-Length")
        if content_length and int(content_length) > self._max_bytes:
            response.close()
            raise AppError(
                category="validation",
                code="PRIVATE_OBJECT_TOO_LARGE",
                message="The private object exceeds the allowed feed size.",
                status_code=422,
            )
        if expected_checksum:
            actual_checksum = response.headers.get("x-amz-checksum-sha256")
            expected_base64 = base64.b64encode(bytes.fromhex(expected_checksum)).decode()
            if actual_checksum and actual_checksum != expected_base64:
                response.close()
                raise AppError(
                    category="validation",
                    code="PRIVATE_OBJECT_MISMATCH",
                    message="The private object does not match its trusted metadata.",
                    status_code=422,
                )
        seen = 0
        digest = hashlib.sha256()
        try:
            while chunk := await asyncio.to_thread(response.read, 64 * 1024):
                seen += len(chunk)
                digest.update(chunk)
                if seen > self._max_bytes:
                    raise AppError(
                        category="validation",
                        code="PRIVATE_OBJECT_TOO_LARGE",
                        message="The private object exceeds the allowed feed size.",
                        status_code=422,
                    )
                yield chunk
        finally:
            response.close()
        if expected_size is not None and seen != expected_size:
            raise AppError(
                category="validation",
                code="PRIVATE_OBJECT_MISMATCH",
                message="The private object does not match its trusted metadata.",
                status_code=422,
            )
        if expected_checksum is not None and digest.hexdigest() != expected_checksum:
            raise AppError(
                category="validation",
                code="PRIVATE_OBJECT_MISMATCH",
                message="The private object does not match its trusted metadata.",
                status_code=422,
            )
