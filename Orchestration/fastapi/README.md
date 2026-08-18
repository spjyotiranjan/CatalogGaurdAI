# CatalogGuard AI Orchestration

Internal FastAPI service for CatalogGuard AI validation orchestration.

## Local development

```powershell
uv sync
Copy-Item .env.example .env
uv run python -m scripts.migrate_operational_store
uv run uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

The development API runs at `http://127.0.0.1:8000`. Liveness and readiness
checks are available at `/health` and `/ready`; Prometheus metrics are exposed at
`/internal/metrics`. Job intake and status are internal service endpoints under
`/internal/v1/jobs` and reject unsigned browser traffic.

Development and test may set `CATALOGGUARD_AUTO_MIGRATE_OPERATIONAL_STORE=true`.
Staging and production must disable it and run the migration command as a controlled
release step before application startup. The Phase 1 fake private-storage adapter is
for automated tests only. Phase 2 real workflows use the local-development R2 bucket
loaded from `.env.local` or the separate production R2 bucket loaded from `.env.prod`;
both environments reject fake storage.

## API documentation

With `CATALOGGUARD_ENABLE_API_DOCS=true`, FastAPI serves the generated OpenAPI 3.1
document at `/openapi.json` and interactive Swagger UI at `/docs`. The document
includes Pydantic request/result/error models, D-012 service-authentication headers,
safe examples, response descriptions, and operational endpoints. Documentation is
enabled by default outside production and disabled by default in production.

Every endpoint or Pydantic contract change must reconcile OpenAPI and its drift tests
in the same phase. Never add real signatures, credentials, private object keys, raw
feed rows, or model prompts to examples.

Service-message authentication follows D-012 in the shared architecture decisions.
Every internal job request requires the key version, service ID, Unix timestamp,
unique nonce, and HMAC-SHA256 signature headers. See
`../contracts/v1/signature-test-vector.json` for the language-neutral test vector.

## Contracts

Strict JSON Schemas for both directions live in `../contracts/v1` and are generated
from the Pydantic transport models:

```powershell
uv run python -m scripts.export_contracts
```

## Checks

```powershell
uv run ruff check --no-cache .
uv run pytest -q -p no:cacheprovider
uv lock --check
```
