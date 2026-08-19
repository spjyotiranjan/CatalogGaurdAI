import codecs
import csv
import hashlib
import json
from decimal import Decimal, InvalidOperation
from uuid import UUID

from app.contracts.jobs import ValidationJobRequestV1
from app.core.errors import AppError
from app.integrations.storage import PrivateObjectStorage
from app.repositories.operational import OperationalRepository

ALIASES = {
    "externalProductId": (
        "external_product_id",
        "external product id",
        "product_id",
        "product id",
        "sku",
    ),
    "sku": ("sku", "stock keeping unit"),
    "title": ("title", "product title", "name"),
    "description": ("description", "product description"),
    "categoryId": ("category_id", "category id"),
    "currency": ("currency",),
    "listPrice": ("price", "list_price", "list price"),
    "salePrice": ("sale_price", "sale price"),
    "stockQuantity": ("inventory", "inventory quantity", "stock", "quantity"),
}


def _clean(value: str | None) -> str | None:
    if value is None:
        return None
    compact = " ".join(value.strip().split())
    return compact or None


def _decimal(value: str | None) -> str | None:
    value = _clean(value)
    if value is None:
        return None
    if "," in value or "e" in value.lower():
        raise ValueError("Use an unambiguous decimal number.")
    try:
        parsed = Decimal(value)
    except InvalidOperation as error:
        raise ValueError("Use a valid decimal number.") from error
    if parsed.as_tuple().exponent < -4 or len(parsed.as_tuple().digits) > 19:
        raise ValueError("Decimal precision is not supported.")
    return format(parsed, "f")


def _integer(value: str | None) -> int | None:
    value = _clean(value)
    if value is None:
        return None
    if not value.isdecimal():
        raise ValueError("Use a non-negative integer.")
    return int(value)


def normalize_row(row: dict[str, str | None]) -> tuple[str, dict[str, object] | None, str | None]:
    source = {
        " ".join(key.strip().lower().split()): value
        for key, value in row.items()
        if key is not None
    }

    def get(field: str) -> str | None:
        return next((source[key] for key in ALIASES[field] if key in source), None)

    try:
        external_product_id = _clean(get("externalProductId"))
        sku = _clean(get("sku"))
        title = _clean(get("title"))
        if not external_product_id or not sku or not title:
            return (
                external_product_id or sku or "unidentified-row",
                None,
                "SKU, external product identifier, and title are required.",
            )
        category = _clean(get("categoryId"))
        currency = _clean(get("currency"))
        candidate: dict[str, object] = {
            "externalProductId": external_product_id.upper(),
            "sku": sku.upper(),
            "title": title,
            "description": _clean(get("description")),
            "categoryId": category if category and len(category) == 24 else None,
            "currency": currency.upper() if currency else None,
            "listPrice": _decimal(get("listPrice")),
            "salePrice": _decimal(get("salePrice")),
            "stockQuantity": _integer(get("stockQuantity")),
            "reservedQuantity": None,
            "attributes": {},
        }
        return (external_product_id.upper(), candidate, None)
    except ValueError as error:
        return (
            external_product_id
            if "external_product_id" in locals() and external_product_id
            else "unidentified-row",
            None,
            str(error),
        )


class CsvIngestionService:
    def __init__(self, repository: OperationalRepository, storage: PrivateObjectStorage) -> None:
        self._repository = repository
        self._storage = storage

    async def process(self, job_id: UUID) -> None:
        job = await self._repository.claim_for_processing(job_id)
        if job is None:
            return
        try:
            request = ValidationJobRequestV1.model_validate_json(job.request_payload)
            decoder = codecs.getincrementaldecoder("utf-8-sig")("strict")
            buffer = ""
            header: list[str] | None = None
            source_row = 1
            async for chunk in self._storage.stream(
                request.feed.storage_object_key,
                expected_checksum=request.feed.checksum,
            ):
                buffer += decoder.decode(chunk)
                lines = buffer.splitlines(keepends=True)
                buffer = ""
                if lines and not lines[-1].endswith(("\n", "\r")):
                    buffer = lines.pop()
                for line in lines:
                    parsed = next(csv.reader([line]))
                    if header is None:
                        header = [" ".join(value.strip().lower().split()) for value in parsed]
                        if not header or len(header) < 2:
                            raise AppError(
                                category="validation",
                                code="CSV_HEADER_INVALID",
                                message="The CSV header is invalid.",
                                status_code=422,
                            )
                        continue
                    source_row += 1
                    if len(parsed) != len(header):
                        identity, candidate, error = (
                            "unidentified-row",
                            None,
                            "The row does not match the CSV header.",
                        )
                    else:
                        identity, candidate, error = normalize_row(
                            dict(zip(header, parsed, strict=True))
                        )
                    await self._repository.record_row(
                        job_id=job_id,
                        source_row_number=source_row,
                        candidate_identity=identity[:256],
                        outcome="ACCEPTED" if candidate else "FAILED",
                        normalized_candidate=json.dumps(
                            candidate, sort_keys=True, separators=(",", ":")
                        )
                        if candidate
                        else None,
                        error_summary=error,
                        mapping_version=request.feed.mapping_version,
                        raw_row_hash=hashlib.sha256(line.encode()).hexdigest(),
                    )
            if buffer:
                parsed = next(csv.reader([buffer]))
                source_row += 1
                if header is None:
                    raise AppError(
                        category="validation",
                        code="CSV_HEADER_INVALID",
                        message="The CSV header is invalid.",
                        status_code=422,
                    )
                identity, candidate, error = (
                    normalize_row(dict(zip(header, parsed, strict=True)))
                    if len(parsed) == len(header)
                    else ("unidentified-row", None, "The row does not match the CSV header.")
                )
                await self._repository.record_row(
                    job_id=job_id,
                    source_row_number=source_row,
                    candidate_identity=identity[:256],
                    outcome="ACCEPTED" if candidate else "FAILED",
                    normalized_candidate=json.dumps(
                        candidate, sort_keys=True, separators=(",", ":")
                    )
                    if candidate
                    else None,
                    error_summary=error,
                    mapping_version=request.feed.mapping_version,
                    raw_row_hash=hashlib.sha256(buffer.encode()).hexdigest(),
                )
            if header is None:
                raise AppError(
                    category="validation",
                    code="CSV_HEADER_INVALID",
                    message="The CSV is empty.",
                    status_code=422,
                )
            await self._repository.finish_processing(
                job_id=job_id, total_rows=max(0, source_row - 1)
            )
        except AppError as error:
            await self._repository.fail_processing(job_id=job_id, code=error.code)
        except UnicodeDecodeError:
            await self._repository.fail_processing(job_id=job_id, code="CSV_ENCODING_INVALID")
        except Exception:
            await self._repository.fail_processing(job_id=job_id, code="INGESTION_FAILED")
