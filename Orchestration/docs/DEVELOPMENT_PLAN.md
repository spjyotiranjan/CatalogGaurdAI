# Orchestration development plan

This six-phase plan delivers FastAPI validation first and adds LangGraph/LangChainJS only after deterministic processing is reliable. It must stay synchronized with the Web plan's phase handoffs.

## Phase 1 - FastAPI foundation and trusted contract

**Goal:** Establish a secure internal service with a versioned job boundary before parsing any files.

- Create the FastAPI application, Pydantic v2 settings validation, health versus dependency-readiness endpoints, safe error envelope, correlation-ID middleware, structured logging, OpenTelemetry, and service authentication.
- Define `ValidationJobRequest v1`, `ValidationJobResult v1`, per-record result, issue, and AI-advisory schemas. Reject unknown fields and unsupported versions.
- Define job status, idempotency, execution-context, actor, signature, replay-protection, timeout, and callback retry policies jointly with Web.
- Implement an operational job/checkpoint repository and queue abstraction. No canonical product/review/approval persistence is added here.
- Build fixture-based contract tests with the Web callback schema and a local fake private-storage client.

**Exit criteria:** A trusted caller can submit one schema-valid job; untrusted/stale/replayed/unknown-field messages fail safely; a fixture result is signed and accepted by contract tests; logs/metrics contain correlation ID without private payloads.

## Phase 2 - Streaming ingestion, mapping, and normalization

**Goal:** Reliably turn one private CSV source into bounded normalized row candidates.

- Implement scoped private-object access, checksum recheck, CSV parser, row and file limits, controlled batch size, and malformed-file versus malformed-row behavior.
- Preserve `sourceRowNumber`, source identifiers, raw row evidence/reference, safe `errorSummary`, mapping version, and normalized candidate separately.
- Implement versioned field mappings for required core values: SKU/external product identifier, title, description, category, price, inventory quantity, and supported optional fields.
- Normalize whitespace/casing, identifiers, currencies, measurement units, booleans, decimals, and dates. Reject ambiguous decimal/date input; preserve numeric zero and boolean false.
- Add safe checkpoints and per-row progress so repeated jobs resume rather than duplicate completed work.

**Exit criteria:** A feed of bounded batches produces deterministic source-row results; bad rows do not hide good ones; full-file failure is terminal and safe; repeated processing resumes from a recorded checkpoint; CSV is the only enabled format.

## Phase 3 - Deterministic rule engine and validation result

**Goal:** Make FastAPI the authoritative deterministic validation service.

- Create the versioned rule registry and stable finding schema. Rules must produce `ruleId`, rule version, field path, severity, message, detected value, and expected/suggested value as applicable.
- Implement the MVP rules: missing required fields, empty title/description, invalid data types, invalid/non-positive price values, negative or invalid inventory, duplicate SKU within upload, unsupported/inactive category, and category-required attribute checks when configured.
- Add business validations from the entities: decimal-safe price comparison, `salePrice <= listPrice`, integer stock/reserved constraints, derived availability, valid currency, active/assignable category, and source consistency checks.
- Define finding deduplication key `(product version or candidate identity, fieldPath, ruleId)` and deterministic severity behavior. `ERROR` blocks approval; `BLOCKER` also blocks processing/readiness; no rule approves.
- Return chunked or callback-ready validated result data with count reconciliation, mapping/rule versions, safe errors, and per-record outcomes.

**Exit criteria:** Rules are repeatable for identical input/version; coverage includes each severity and edge case; duplicate SKU and malformed-row behavior are proven; output validates against the shared contract and contains no raw secret/private data.

## Phase 4 - Reliable workers and Web callback handoff

**Goal:** Make async validation operationally safe at MVP scale.

- Implement durable queue consumption, idempotent job claim, heartbeat, progress, checkpoint, graceful shutdown, bounded retries/backoff, terminal failure, cancellation, and dead-letter path.
- Ensure acknowledgement occurs only after the operational checkpoint/state is committed. Limit worker and per-seller concurrency.
- Add signed callback delivery with timestamp/nonce, exponential retry, response classification, terminal callback failure alerting, and support for idempotent redelivery.
- Add result-size/chunk strategy if a 1,000-row job cannot safely fit one callback. Completion must reconcile chunk count/checksum before Web exposes a feed as completed.
- Provide job-status metrics and a runbook-friendly failure reason taxonomy.

**Exit criteria:** The same job can run repeatedly without duplicating effects; interrupted workers resume safely; a rejected callback is retried or terminally surfaced; 1,000-record feed testing stays within defined memory, time, and concurrency limits.

## Phase 5 - Controlled AI advisory runtime

**Goal:** Add semantic assistance without weakening deterministic validation or human review.

- Introduce a private Node `ai-runtime` service with LangGraph for state flow and LangChainJS for the structured model call. FastAPI remains the caller and validator.
- Implement the graph: eligible-record selection -> minimized/sanitized input -> structured request -> schema parse -> retry/fallback -> advisory result. Include bounded model timeout/retry/concurrency.
- Limit initial analysis to title/description/category consistency and clear correction suggestions. Supply only active, assignable category IDs/labels as the taxonomy allow-list.
- Validate the returned schema in Node and again in FastAPI. Store/return provider, model, prompt version, sanitized input snapshot, advisory output, confidence, evidence, safe failure reason, latency, usage, and cost attribution.
- Convert low confidence, model outage, and invalid output to non-blocking advisory/fallback behavior. FastAPI must still return deterministic results and callbacks.

**Exit criteria:** Saved-response contract tests cover valid, malformed, timeout, unavailable, unknown category, and low-confidence outcomes; no AI path has a direct canonical-data or approval capability; UI can clearly distinguish advisory evidence from deterministic issues.

## Phase 6 - Hardening, observability, and release

**Goal:** Prove the orchestration path is secure, observable, recoverable, and compatible with Web release gates.

- Execute parser/rule/job/AI/callback integration suites plus full upload-to-readiness E2E tests with Web.
- Stress test a 1,000-product feed and controlled concurrent feeds. Tune batch size, worker concurrency, callback chunking, queue limits, and provider limits from measured results.
- Finish dashboards and alerts for stuck jobs, worker failures, queue age/depth, retries/dead letters, parser error rate, rule/severity trends, callback errors, AI health/cost, and processing duration.
- Validate secret configuration, encryption in transit, private-storage scope, dependency health, feature flags, graceful deployment, backup/restore for operational state, and incident runbooks.
- Version deployment metadata with application, contract, mapping, rule-set, and prompt versions.

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
