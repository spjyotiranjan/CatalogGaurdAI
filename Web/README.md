# CatalogGuard AI Web

Next.js App Router application and backend-for-frontend for CatalogGuard AI.

Read the instructions and current phase in [`docs/`](docs/) before adding a
feature.

## Local development

```powershell
npm install
npm run dev
```

The app runs at `http://127.0.0.1:3000`. Its bootstrap health check is
available at `/api/health`.

## API documentation

With `API_DOCS_ENABLED=true`, the generated OpenAPI 3.1 document is available at
`/api/openapi.json` and interactive Swagger UI at `/api/docs`. Component schemas
are generated from the same strict Zod contracts used by the backend. Documentation
is enabled by default outside production and disabled by default in production; do
not place real credentials, cookies, private object keys, or sensitive examples in it.

Every backend endpoint or model change must update the OpenAPI operation and its
drift tests in the same phase.

## Checks

```powershell
npm run lint
npm run typecheck
npm test
npm run build
```
