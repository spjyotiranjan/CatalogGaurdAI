import hashlib
import hmac
import json
from pathlib import Path
from uuid import UUID

import jsonschema
import pytest
from pydantic import ValidationError

from app.contracts.jobs import ValidationJobRequestV1
from app.contracts.results import ValidationJobResultV1
from app.core.config import Settings
from app.integrations.callback import CallbackSigner
from app.security.signing import canonical_message, sign_http_message

ORCHESTRATION_ROOT = Path(__file__).resolve().parents[2]
CONTRACT_ROOT = ORCHESTRATION_ROOT / "contracts" / "v1"
FIXTURE_ROOT = Path(__file__).resolve().parent / "fixtures"


def test_generated_request_schema_matches_strict_pydantic_contract(valid_job: dict) -> None:
    schema = json.loads((CONTRACT_ROOT / "validation-job-request.schema.json").read_text())

    jsonschema.Draft202012Validator.check_schema(schema)
    jsonschema.validate(valid_job, schema)
    assert ValidationJobRequestV1.model_validate(valid_job).contract_version == "v1"
    assert schema["additionalProperties"] is False


def test_web_callback_fixture_matches_result_schema() -> None:
    fixture = json.loads((FIXTURE_ROOT / "validation-job-result.v1.json").read_text())
    schema = json.loads((CONTRACT_ROOT / "validation-job-result.schema.json").read_text())

    jsonschema.Draft202012Validator.check_schema(schema)
    jsonschema.validate(fixture, schema)
    result = ValidationJobResultV1.model_validate(fixture)
    assert result.summary.processed_rows == len(result.records)
    assert schema["additionalProperties"] is False


def test_result_contract_rejects_executable_or_unknown_fields() -> None:
    fixture = json.loads((FIXTURE_ROOT / "validation-job-result.v1.json").read_text())
    fixture["records"][0]["approveProduct"] = True

    with pytest.raises(ValidationError):
        ValidationJobResultV1.model_validate(fixture)


def test_result_contract_reconciles_summary_counts() -> None:
    fixture = json.loads((FIXTURE_ROOT / "validation-job-result.v1.json").read_text())
    fixture["summary"]["acceptedRows"] = 0

    with pytest.raises(ValidationError, match="acceptedRows plus rejectedRows"):
        ValidationJobResultV1.model_validate(fixture)


def test_signature_vector_is_language_neutral_and_stable() -> None:
    vector = json.loads((CONTRACT_ROOT / "signature-test-vector.json").read_text())
    body = vector["body"].encode("utf-8")
    nonce = UUID(vector["nonce"])

    assert hashlib.sha256(body).hexdigest() == vector["bodySha256"]
    message = canonical_message(
        key_version=vector["keyVersion"],
        service_id=vector["serviceId"],
        timestamp=vector["timestamp"],
        nonce=nonce,
        method=vector["method"],
        path=vector["path"],
        body=body,
    )
    independent_signature = hmac.new(
        vector["secret"].encode(),
        message,
        hashlib.sha256,
    ).hexdigest()
    signed = sign_http_message(
        secret=vector["secret"],
        key_version=vector["keyVersion"],
        service_id=vector["serviceId"],
        timestamp=vector["timestamp"],
        nonce=nonce,
        method=vector["method"],
        path=vector["path"],
        body=body,
    )

    assert independent_signature == vector["signature"]
    assert signed.signature == vector["signature"]


def test_fixture_result_is_signed_for_web_callback(
    settings: Settings,
) -> None:
    fixture = json.loads((FIXTURE_ROOT / "validation-job-result.v1.json").read_text())
    result = ValidationJobResultV1.model_validate(fixture)

    body, headers = CallbackSigner(settings).sign_result(
        result,
        path="/api/internal/validation-results",
        timestamp=1_786_520_000,
    )

    assert ValidationJobResultV1.model_validate_json(body) == result
    assert len(headers.signature) == 64
    assert headers.service_id == "validation-orchestrator"


def test_callback_signer_rejects_an_untrusted_result_actor(settings: Settings) -> None:
    fixture = json.loads((FIXTURE_ROOT / "validation-job-result.v1.json").read_text())
    fixture["execution"]["actorService"] = "unexpected-service"
    result = ValidationJobResultV1.model_validate(fixture)

    with pytest.raises(ValueError, match="actorService"):
        CallbackSigner(settings).sign_result(
            result,
            path="/api/internal/validation-results",
        )
