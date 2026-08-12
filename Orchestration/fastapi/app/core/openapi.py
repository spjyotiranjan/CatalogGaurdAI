from collections.abc import Callable
from typing import Any

from fastapi import FastAPI
from fastapi.openapi.utils import get_openapi
from pydantic import BaseModel
from pydantic.json_schema import models_json_schema

from app.api.health import HealthResponse
from app.contracts.errors import ErrorEnvelope
from app.contracts.jobs import (
    AcceptedJobResponseV1,
    JobStatusResponseV1,
    ValidationJobRequestV1,
)
from app.contracts.results import ValidationJobResultV1

SERVICE_AUTH_SCHEMES = {
    "catalogguardKeyVersion": {
        "type": "apiKey",
        "in": "header",
        "name": "X-CatalogGuard-Key-Version",
        "description": "Configured signing-key version; enables controlled secret rotation.",
    },
    "catalogguardService": {
        "type": "apiKey",
        "in": "header",
        "name": "X-CatalogGuard-Service",
        "description": "Authenticated internal caller service ID.",
    },
    "catalogguardTimestamp": {
        "type": "apiKey",
        "in": "header",
        "name": "X-CatalogGuard-Timestamp",
        "description": "Unix timestamp in seconds within the configured clock-skew window.",
    },
    "catalogguardNonce": {
        "type": "apiKey",
        "in": "header",
        "name": "X-CatalogGuard-Nonce",
        "description": "Unique UUID persisted for replay rejection.",
    },
    "catalogguardSignature": {
        "type": "apiKey",
        "in": "header",
        "name": "X-CatalogGuard-Signature",
        "description": "Lowercase HMAC-SHA256 of the D-012 canonical message.",
    },
}

SERVICE_AUTH_REQUIREMENT = {name: [] for name in SERVICE_AUTH_SCHEMES}

DOCUMENTED_MODELS: tuple[type[BaseModel], ...] = (
    HealthResponse,
    ErrorEnvelope,
    ValidationJobRequestV1,
    AcceptedJobResponseV1,
    JobStatusResponseV1,
    ValidationJobResultV1,
)


def _model_definitions() -> dict[str, Any]:
    _, schema = models_json_schema(
        [(model, "validation") for model in DOCUMENTED_MODELS],
        by_alias=True,
        ref_template="#/components/schemas/{model}",
    )
    return schema.get("$defs", {})


def _correlation_parameter() -> dict[str, Any]:
    return {
        "name": "X-Correlation-ID",
        "in": "header",
        "required": False,
        "description": (
            "Optional UUID trace identifier propagated through jobs, callbacks, logs, and errors. "
            "Invalid or missing values are replaced safely."
        ),
        "schema": {"type": "string", "format": "uuid"},
    }


def _document_native_docs(schema: dict[str, Any]) -> None:
    schema["paths"]["/openapi.json"] = {
        "get": {
            "tags": ["operations"],
            "operationId": "getOrchestrationOpenApiDocument",
            "summary": "Download the Orchestration OpenAPI document",
            "description": "Returns this OpenAPI 3.1 document when API docs are enabled.",
            "responses": {
                "200": {
                    "description": "OpenAPI 3.1 document.",
                    "content": {"application/json": {"schema": {"type": "object"}}},
                }
            },
        }
    }
    schema["paths"]["/docs"] = {
        "get": {
            "tags": ["operations"],
            "operationId": "getOrchestrationSwaggerUi",
            "summary": "Open Orchestration Swagger UI",
            "description": "Interactive Swagger UI backed by `/openapi.json`.",
            "responses": {
                "200": {
                    "description": "Swagger UI HTML.",
                    "content": {"text/html": {}},
                }
            },
        }
    }


def build_openapi_schema(application: FastAPI) -> dict[str, Any]:
    schema = get_openapi(
        title=application.title,
        version=application.version,
        openapi_version=application.openapi_version,
        summary="Trusted CatalogGuard validation-job API",
        description=application.description,
        routes=application.routes,
        tags=[
            {"name": "health", "description": "Process liveness and dependency readiness."},
            {
                "name": "validation-jobs",
                "description": "Authenticated Web-to-Orchestration job intake and status.",
            },
            {
                "name": "operations",
                "description": "Internal metrics and executable API documentation.",
            },
        ],
    )
    components = schema.setdefault("components", {})
    components.setdefault("schemas", {}).update(_model_definitions())
    components.setdefault("securitySchemes", {}).update(SERVICE_AUTH_SCHEMES)

    for path, path_item in schema.get("paths", {}).items():
        for method, operation in path_item.items():
            if method not in {"get", "post", "put", "patch", "delete"}:
                continue
            parameters = operation.setdefault("parameters", [])
            if not any(parameter.get("name") == "X-Correlation-ID" for parameter in parameters):
                parameters.append(_correlation_parameter())
            if path.startswith("/internal/v1/jobs"):
                operation["security"] = [SERVICE_AUTH_REQUIREMENT]
                for parameter in parameters:
                    if parameter.get("name", "").lower() in {
                        "x-catalogguard-key-version",
                        "x-catalogguard-service",
                        "x-catalogguard-timestamp",
                        "x-catalogguard-nonce",
                        "x-catalogguard-signature",
                    }:
                        parameter["required"] = True

    _document_native_docs(schema)
    return schema


def install_openapi_schema(application: FastAPI) -> Callable[[], dict[str, Any]]:
    def custom_openapi() -> dict[str, Any]:
        if application.openapi_schema is None:
            application.openapi_schema = build_openapi_schema(application)
        return application.openapi_schema

    application.openapi = custom_openapi
    return custom_openapi
