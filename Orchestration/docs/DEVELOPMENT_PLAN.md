# Orchestration development plan

This six-phase plan delivers FastAPI validation first and adds LangGraph/LangChainJS only after deterministic processing is reliable. It must stay synchronized with the Web plan's phase handoffs.

## OpenAPI and Swagger phase gate

Every phase must reconcile `/openapi.json` and `/docs` with its implemented FastAPI endpoints and Pydantic models. Added, changed, deprecated, or removed requests, responses, errors, service-authentication requirements, headers, status codes, and safe examples must be reflected in OpenAPI and covered by documentation-drift tests before that phase can be marked complete. Cross-service models must also pass compatibility checks against Web. Swagger is enabled for local development/testing and disabled by default in production.

## Phase 1 - FastAPI foundation and trusted contract

**Goal:** Establish a secure internal service with a versioned job boundary before parsing any files.

- Create the FastAPI application, Pydantic v2 settings validation, health versus dependency-readiness endpoints, safe error envelope, correlation-ID middleware, structured logging, OpenTelemetry, and service authentication.
- Define `ValidationJobRequest v1`, `ValidationJobResult v1`, per-record result, issue, and AI-advisory schemas. Reject unknown fields and unsupported versions.
- Define job status, idempotency, execution-context, actor, signature, replay-protection, timeout, and callback retry policies jointly with Web.
- Implement an operational job/checkpoint repository and queue abstraction. No canonical product/review/approval persistence is added here.
- Build fixture-based contract tests with the Web callback schema and a local fake private-storage client.
- Reconcile Swagger/OpenAPI for all Phase 1 health, readiness, metrics, job-intake/status, service-authentication, request, response, and safe-error contracts.

**Exit criteria:** A trusted caller can submit one schema-valid job; untrusted/stale/replayed/unknown-field messages fail safely; a fixture result is signed and accepted by contract tests; logs/metrics contain correlation ID without private payloads.

### Phase 1 completion record - 2026-08-12

**Status:** Complete.

- Implemented the strict FastAPI foundation in `Orchestration/fastapi`: validated settings, fail-fast environment policy, liveness/readiness, safe stable errors, correlation middleware, redacted JSON logging, Prometheus metrics, and OpenTelemetry instrumentation.
- Added D-012 to the shared architecture decisions and implemented versioned HMAC-SHA256 service authentication with body binding, constant-time comparison, clock-skew checks, durable nonce replay rejection, trusted actor matching, and an interoperable signature test vector.
- Published strict generated `ValidationJobRequest v1` and `ValidationJobResult v1` JSON Schemas, including per-record normalized candidates, transport findings, AI advisory provenance, count reconciliation, CSV/product-listing constraints, and a Web callback fixture. Unknown properties and unsupported versions are rejected.
- Added an operational-only SQLite repository with atomic job idempotency, durable nonce storage, job/checkpoint fields, and a durable queue seam. Schema v1 uses an explicit migration command; automatic migration is limited to development/test. No Web-owned canonical product, review, approval, or validation-issue record is persisted.
- Added a scoped, bounded fake private-storage adapter for automated contract testing only. Phase 2 replaces all non-test wiring—including local development—with the Cloudflare R2 implementation selected in D-013.
- Defined bounded callback classification/backoff and outbound result signing. Worker consumption, file parsing, deterministic rule execution, AI invocation, and callback delivery remain assigned to their later phases.
- Added the D-014 OpenAPI 3.1 inventory at `/openapi.json` and native Swagger UI at `/docs`. Phase 1 health, readiness, metrics, job intake/status, D-012 security headers, Pydantic request/result/error models, response variants, correlation metadata, and safe examples are documented. Production documentation is disabled by default.

**Verification:** Ruff passed; 44 automated tests passed, including OpenAPI drift/security/model and Swagger availability checks; generated JSON Schemas validated against the request/result fixtures and fixed signature vector; the dependency lock is current; the dependency audit found no known vulnerabilities. A live Uvicorn smoke test returned `200` for liveness and readiness, rejected unsigned job intake with `401`, and accepted a correctly signed job with `202` and a status location.

**Operational assumption:** Phase 1 SQLite and its repository-backed queue are the durable single-instance baseline. Before Phase 4 production/horizontal workers, retain the repository/queue interfaces while selecting a concurrency-safe production datastore and broker.

## Phase 2 - Streaming ingestion, mapping, and normalization

**Goal:** Reliably turn one private CSV source into bounded normalized row candidates.

- Implement scoped, read-only Cloudflare R2 object access using the trusted bucket/key configuration and job-granted object key; recheck object size and checksum before streaming. Use the local-development R2 bucket selected by `.env.local` for real local workflows and the isolated production R2 bucket selected by `.env.prod` in production. Keep R2 credentials, endpoints, bucket names, object keys, and signed URLs out of logs, errors, browser payloads, and AI inputs.
- Retain the Phase 1 fake-storage adapter only for unit, contract, and isolated integration tests. Development servers, manual local workflows, staging-like runs, and production must use R2 and fail fast when R2 configuration is missing or fake storage is selected.
- Load `CATALOGGUARD_R2_ACCOUNT_ID`, `CATALOGGUARD_R2_ENDPOINT`, `CATALOGGUARD_R2_BUCKET_NAME`, `CATALOGGUARD_R2_ACCESS_KEY_ID`, and `CATALOGGUARD_R2_SECRET_ACCESS_KEY` from the uncommitted environment file. `.env.local` identifies the local-development bucket and `.env.prod` identifies the production bucket. Orchestration credentials are read-only and distinct from Web credentials.
- Preserve `sourceRowNumber`, source identifiers, raw row evidence/reference, safe `errorSummary`, mapping version, and normalized candidate separately.
- Implement versioned field mappings for required core values: SKU/external product identifier, title, description, category, price, inventory quantity, and supported optional fields.
- Normalize whitespace/casing, identifiers, currencies, measurement units, booleans, decimals, and dates. Reject ambiguous decimal/date input; preserve numeric zero and boolean false.
- Add safe checkpoints and per-row progress so repeated jobs resume rather than duplicate completed work.
- Reconcile Swagger/OpenAPI for every Phase 2 storage, parser, mapping, normalization, progress, request/response, and error contract.

**Exit criteria:** A feed of bounded batches produces deterministic source-row results; bad rows do not hide good ones; full-file failure is terminal and safe; repeated processing resumes from a recorded checkpoint; CSV is the only enabled format.

## Phase 3 - Deterministic rule engine and validation result

**Goal:** Make FastAPI the authoritative deterministic validation service.

- Create the versioned rule registry and stable finding schema. Rules must produce `ruleId`, rule version, field path, severity, message, detected value, and expected/suggested value as applicable.
- Implement the MVP rules: missing required fields, empty title/description, invalid data types, invalid/non-positive price values, negative or invalid inventory, duplicate SKU within upload, unsupported/inactive category, and category-required attribute checks when configured.
- Add business validations from the entities: decimal-safe price comparison, `salePrice <= listPrice`, integer stock/reserved constraints, derived availability, valid currency, active/assignable category, and source consistency checks.
- Define finding deduplication key `(product version or candidate identity, fieldPath, ruleId)` and deterministic severity behavior. `ERROR` blocks approval; `BLOCKER` also blocks processing/readiness; no rule approves.
- Return chunked or callback-ready validated result data with count reconciliation, mapping/rule versions, safe errors, and per-record outcomes.
- Reconcile Swagger/OpenAPI for every Phase 3 rule, finding, validation-result, request/response, and error contract.

**Exit criteria:** Rules are repeatable for identical input/version; coverage includes each severity and edge case; duplicate SKU and malformed-row behavior are proven; output validates against the shared contract and contains no raw secret/private data.

## Phase 4 - Reliable workers and Web callback handoff

**Goal:** Make async validation operationally safe at MVP scale.

- Implement durable queue consumption, idempotent job claim, heartbeat, progress, checkpoint, graceful shutdown, bounded retries/backoff, terminal failure, cancellation, and dead-letter path.
- Ensure acknowledgement occurs only after the operational checkpoint/state is committed. Limit worker and per-seller concurrency.
- Add signed callback delivery with timestamp/nonce, exponential retry, response classification, terminal callback failure alerting, and support for idempotent redelivery.
- Add result-size/chunk strategy if a 1,000-row job cannot safely fit one callback. Completion must reconcile chunk count/checksum before Web exposes a feed as completed.
- Provide job-status metrics and a runbook-friendly failure reason taxonomy.
- Reconcile Swagger/OpenAPI for every Phase 4 worker-control, job state, callback, cancellation, retry/dead-letter, request/response, and error contract.

**Exit criteria:** The same job can run repeatedly without duplicating effects; interrupted workers resume safely; a rejected callback is retried or terminally surfaced; 1,000-record feed testing stays within defined memory, time, and concurrency limits.

## Phase 5 - Controlled AI advisory runtime

**Goal:** Add semantic assistance without weakening deterministic validation or human review.

- Introduce a private Node `ai-runtime` service with LangGraph for state flow and LangChainJS for the structured model call. FastAPI remains the caller and validator.
- Implement the graph: eligible-record selection -> minimized/sanitized input -> structured request -> schema parse -> retry/fallback -> advisory result. Include bounded model timeout/retry/concurrency.
- Limit initial analysis to title/description/category consistency and clear correction suggestions. Supply only active, assignable category IDs/labels as the taxonomy allow-list.
- Validate the returned schema in Node and again in FastAPI. Store/return provider, model, prompt version, sanitized input snapshot, advisory output, confidence, evidence, safe failure reason, latency, usage, and cost attribution.
- Convert low confidence, model outage, and invalid output to non-blocking advisory/fallback behavior. FastAPI must still return deterministic results and callbacks.
- Reconcile Swagger/OpenAPI for every Phase 5 AI-runtime, advisory, fallback, request/response, and safe-error contract while excluding prompts and provider secrets.

**Exit criteria:** Saved-response contract tests cover valid, malformed, timeout, unavailable, unknown category, and low-confidence outcomes; no AI path has a direct canonical-data or approval capability; UI can clearly distinguish advisory evidence from deterministic issues.

## Phase 6 - Hardening, observability, and release

**Goal:** Prove the orchestration path is secure, observable, recoverable, and compatible with Web release gates.

- Execute parser/rule/job/AI/callback integration suites plus full upload-to-readiness E2E tests with Web.
- Stress test a 1,000-product feed and controlled concurrent feeds. Tune batch size, worker concurrency, callback chunking, queue limits, and provider limits from measured results.
- Finish dashboards and alerts for stuck jobs, worker failures, queue age/depth, retries/dead letters, parser error rate, rule/severity trends, callback errors, AI health/cost, and processing duration.
- Validate secret configuration, encryption in transit, private-storage scope, dependency health, feature flags, graceful deployment, backup/restore for operational state, and incident runbooks.
- Version deployment metadata with application, contract, mapping, rule-set, and prompt versions.
- Perform a full Swagger/OpenAPI inventory against all Phase 6 routes and models, verify every security requirement and safe example, and fail the release when implementation and documentation differ.

**Exit criteria:** Cross-service release gate passes; operations can trace a feed using one correlation ID; failure modes have alert, dashboard, and recovery action; AI may be disabled without breaking deterministic processing.

## Web dependencies

| Orchestration phase | Web capability required |
| --- | --- |
| 1 | service credentials, callback endpoint schema, private-storage test seam. |
| 2 | persisted feed metadata, private scoped object reference, mapping configuration. |
| 3 | atomic result-application service and issue/product-version schema. |
| 4 | outbox dispatch, callback idempotency, feed progress/read model. |
| 5 | AI-analysis presentation and human-review separation. |
| 6 | production-like E2E environment, telemetry backend, operational dashboards. |
