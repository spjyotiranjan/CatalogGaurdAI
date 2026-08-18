# CatalogGuard AI Orchestration

Internal FastAPI service for CatalogGuard AI validation orchestration.

## Local development

```powershell
uv sync
uv run uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

The development API runs at `http://127.0.0.1:8000`. Liveness and readiness
checks are available at `/health` and `/ready`.

## Checks

```powershell
uv run ruff check --no-cache .
uv run pytest -p no:cacheprovider
```

