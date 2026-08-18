# CatalogGuard AI

CatalogGuard AI prevents flawed seller catalog data from reaching customers. Sellers upload private catalog feeds, deterministic validation runs first, bounded AI analysis may add advisory findings where semantics are ambiguous, and authorized human reviewers control approval. AI never approves or publishes catalog data.

This is the starting point for a new developer. Read it once to understand the system and start both backends; use the linked area documentation before implementing a phase.

## System at a glance

```text
Browser or API client
        |
        v
Web/ - Next.js application and backend-for-frontend (port 3000)
  |-- Auth.js sessions, RBAC, and seller isolation
  |-- canonical MongoDB application data and audit records
  |-- private upload coordination and workflow state
  |
  |  signed, versioned internal job and callback contracts
  v
Orchestration/fastapi/ - FastAPI validation service (port 8000)
  |-- durable operational jobs and checkpoints
  |-- parsing, normalization, and deterministic rules
  `-- bounded advisory AI orchestration in a later phase

Cloudflare R2 - private feed objects shared per environment through separate,
least-privilege Web and Orchestration credentials (implemented in Phase 2)
```

`Web/` owns identity, authorization, tenant isolation, canonical application data, reviews, readiness, and audit history. `Orchestration/` owns feed-processing jobs and validation results; it cannot access browser sessions, approve products, or write canonical catalog data. Service-to-service requests use the signed D-012 contract rather than browser credentials.

## Current implementation status

Phase 1 is complete for both backends:

- Web has validated configuration, MongoDB migrations and repositories, Auth.js credential sessions, RBAC/seller-scope guards, account and password APIs, audit logging, health/readiness endpoints, and OpenAPI documentation.
- Orchestration has validated configuration, SQLite operational migrations, strict versioned Pydantic contracts, HMAC request authentication and replay protection, idempotent job intake/status, callback signing primitives, health/readiness/metrics endpoints, and OpenAPI documentation.
- Parsing real feeds, deterministic catalog rules, real callbacks, and real Cloudflare R2 access begin in later phases. The current fake-storage seam exists only to support automated tests and Phase 1 infrastructure verification; it is not an approved real workflow.
- Product screens and end-user workflows belong to the separate UI plan and are not prerequisites for exercising the backend APIs.

See the completion records in the [Web backend plan](../Web/docs/BACKEND_DEVELOPMENT_PLAN.md) and [Orchestration plan](../Orchestration/docs/DEVELOPMENT_PLAN.md) for exact delivered and deferred scope.

## Prerequisites

Install these before the first run:

- Node.js `20.19.0` or newer and npm.
- Python `3.13` or `3.14`.
- [uv](https://docs.astral.sh/uv/) for Python dependency and virtual-environment management.
- MongoDB reachable through a replica-set URI. Transactions used by the Web backend do not work with a standalone MongoDB server.
- PowerShell for the commands below. In a PowerShell execution-policy-restricted environment, use `npm.cmd` instead of `npm`.

Cloudflare R2 credentials are not needed to boot Phase 1. Phase 2 real local and production feed workflows require two private buckets: one selected by `.env.local` for local development and another selected by `.env.prod` for production. Fake storage remains test-only.

## First-time setup

Clone the repository, then open two terminals at its root. There is intentionally no single root process: Web and Orchestration have independent dependencies, migrations, configuration, and release lifecycles.

### 1. Start the Web backend

```powershell
cd Web
npm.cmd install
Copy-Item .env.example .env.local
npm.cmd run db:migrate
npm.cmd run dev
```

Review `.env.local` before startup. At minimum, replace `AUTH_SECRET`, confirm `AUTH_URL`, and point `MONGODB_URI` at your replica-set-enabled local database. Never commit the environment file.

Web is then available at `http://127.0.0.1:3000`:

| Resource | URL |
| --- | --- |
| Liveness | `http://127.0.0.1:3000/api/health` |
| Dependency readiness | `http://127.0.0.1:3000/api/ready` |
| Swagger UI | `http://127.0.0.1:3000/api/docs` |
| OpenAPI JSON | `http://127.0.0.1:3000/api/openapi.json` |

`/api/ready` will report unavailable until MongoDB is reachable and migrations are current. Phase 1 provides authentication APIs but no public registration or seed-user command; use test fixtures for automated authentication coverage until an approved provisioning flow is implemented.

### 2. Start Orchestration

In the second terminal:

```powershell
cd Orchestration\fastapi
uv sync
Copy-Item .env.example .env
uv run python -m scripts.migrate_operational_store
uv run uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Replace both example service secrets in `.env` with distinct values of at least 32 characters. The Phase 1 application reads `.env`; environment-specific `.env.local` and `.env.prod` R2 loading is a Phase 2 deliverable. Do not commit any of these files.

Orchestration is then available at `http://127.0.0.1:8000`:

| Resource | URL |
| --- | --- |
| Liveness | `http://127.0.0.1:8000/health` |
| Dependency readiness | `http://127.0.0.1:8000/ready` |
| Prometheus metrics | `http://127.0.0.1:8000/internal/metrics` |
| Swagger UI | `http://127.0.0.1:8000/docs` |
| OpenAPI JSON | `http://127.0.0.1:8000/openapi.json` |

Internal job routes under `/internal/v1/jobs` require all D-012 service ID, key-version, timestamp, nonce, and HMAC-SHA256 signature headers. Swagger describes the headers, but a request still needs a signature calculated over its exact body. The shared conformance example is [`Orchestration/contracts/v1/signature-test-vector.json`](../Orchestration/contracts/v1/signature-test-vector.json).

## Everyday commands

Run these from their respective service directories.

| Task | Web (`Web/`) | Orchestration (`Orchestration/fastapi/`) |
| --- | --- | --- |
| Install/sync dependencies | `npm.cmd install` | `uv sync` |
| Development server | `npm.cmd run dev` | `uv run uvicorn app.main:app --reload --host 127.0.0.1 --port 8000` |
| Apply migrations | `npm.cmd run db:migrate` | `uv run python -m scripts.migrate_operational_store` |
| Lint | `npm.cmd run lint` | `uv run ruff check --no-cache .` |
| Type check | `npm.cmd run typecheck` | Pydantic/runtime tests are the current Python contract check |
| Test once | `npm.cmd test` | `uv run pytest -q -p no:cacheprovider` |
| Watch tests | `npm.cmd run test:watch` | No watch command is currently configured; rerun the focused pytest target |
| Production build/start | `npm.cmd run build`, then `npm.cmd run start` | Run migrations, then start Uvicorn with deployment-managed workers |
| Verify dependency lock | `npm.cmd ci` | `uv lock --check` |
| Export shared schemas | OpenAPI is generated at runtime | `uv run python -m scripts.export_contracts` |

Before handing off a backend change, run the service's lint, type/contract checks, tests, and build or lock check. For a cross-service contract change, also run the integration/conformance tests documented by both implementation guides.

## Configuration and security

- Copy example environment files; never edit them with real credentials and never commit local/prod environment files.
- Swagger is enabled by default outside production. Set `API_DOCS_ENABLED=false` for Web and `CATALOGGUARD_ENABLE_API_DOCS=false` for Orchestration when it should not be exposed; both default off in production.
- Web uses browser sessions. Orchestration accepts authenticated service messages only. Do not call Orchestration directly from frontend code.
- Never put secrets, cookies, signatures, private R2 locations, raw feed rows, or model prompts in logs, errors, examples, Swagger, or commits.
- Staging and production must apply migrations as a controlled release step. Do not rely on automatic migration at application startup.

## Where to read before changing code

| Area | Start here | Purpose |
| --- | --- | --- |
| Whole project | [AGENTS.md](AGENTS.md) | Mandatory instructions for every change. |
| Architecture decisions | [ARCHITECTURE_DECISIONS.md](ARCHITECTURE_DECISIONS.md) | Ownership, contracts, source conflicts, and non-negotiable decisions. |
| Web rules | [Web/AGENTS.md](../Web/docs/AGENTS.md) | Next.js application and backend guidance. |
| Web coordination | [Web/DEVELOPMENT_PLAN.md](../Web/docs/DEVELOPMENT_PLAN.md) | UI/backend ownership, milestones, and cross-service dependencies. |
| Web UI plan | [Web/UI_DEVELOPMENT_PLAN.md](../Web/docs/UI_DEVELOPMENT_PLAN.md) | UI/UX-only phases; backend logic is prohibited here. |
| Web backend plan | [Web/BACKEND_DEVELOPMENT_PLAN.md](../Web/docs/BACKEND_DEVELOPMENT_PLAN.md) | Next.js BFF phases, status, and exit criteria. |
| Web implementation | [Web/IMPLEMENTATION_GUIDE.md](../Web/docs/IMPLEMENTATION_GUIDE.md) | Routes, contracts, persistence, security, and tests. |
| Orchestration rules | [Orchestration/AGENTS.md](../Orchestration/docs/AGENTS.md) | FastAPI validation and AI-orchestration guidance. |
| Orchestration plan | [Orchestration/DEVELOPMENT_PLAN.md](../Orchestration/docs/DEVELOPMENT_PLAN.md) | Orchestration phases, status, and Web dependencies. |
| Orchestration implementation | [Orchestration/IMPLEMENTATION_GUIDE.md](../Orchestration/docs/IMPLEMENTATION_GUIDE.md) | Job protocol, rule engine, AI boundary, callbacks, and tests. |

The source-of-truth order is: explicit decisions in [ARCHITECTURE_DECISIONS.md](ARCHITECTURE_DECISIONS.md), mandatory backend rules, entity workbook constraints, implementation design, then PRD detail. Never resolve a conflict silently.

## Phase workflow and documentation maintenance

For each change:

1. Read the root instructions, the affected area's `AGENTS.md`, its implementation guide, and only the phase being implemented.
2. Update a shared contract or architecture decision before code when the change crosses Web and Orchestration.
3. Keep authentication, authorization, tenant isolation, failure handling, auditability, and idempotency in the phase's acceptance criteria.
4. Reconcile Swagger/OpenAPI request models, responses, descriptions, security requirements, examples, and drift tests whenever an endpoint or model changes.
5. Record phase completion and implementation details in the relevant development plan.
6. Update this README in the same change whenever prerequisites, setup, environment files, ports, migrations, commands, service ownership, API locations, supported workflows, or known phase boundaries change.

A slice is complete only when its happy and failure paths work across the relevant boundary, authorization and tenant isolation are tested, mutations are idempotent and audited, correlation IDs remain traceable, and both affected plans' exit criteria are met.
