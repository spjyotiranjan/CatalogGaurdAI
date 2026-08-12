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
also forbidden in production.

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
