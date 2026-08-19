# CatalogGuard internal contract v1

These schemas are generated from the strict Pydantic transport models in
`fastapi/app/contracts`. Regenerate them from `Orchestration/fastapi` with:

```powershell
uv run python -m scripts.export_contracts
```

`validation-job-request.schema.json` is the Web-to-Orchestration intake contract.
`validation-job-result.schema.json` is the Orchestration-to-Web callback body contract.
Both reject unknown fields. D-012 in the shared architecture decisions defines message
authentication, replay protection, idempotency, and the distinction between transport
findings and Web-owned canonical `VALIDATION_ISSUE` records.
