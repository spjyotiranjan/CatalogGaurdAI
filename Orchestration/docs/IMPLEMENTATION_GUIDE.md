# Orchestration implementation guide

## Boundary and architecture

FastAPI is the authoritative deterministic validation service. It receives a trusted job from Web, reads only the private object granted by that job, processes it with bounded resources, optionally asks a private AI runtime for advisory analysis, and sends a signed typed result to Web. Web owns canonical MongoDB data and applies result effects.

Use the [Backend Rules](../../CatalogGuard_AI_Backend_Rules.pdf) as the mandatory implementation constraint set, the [Entity Details workbook](../../CatalogGuard_AI_Entity_Details.xlsx) to shape result and AI-analysis/issue data, and the [PRD](../../CatalogGuard_AI_PRD.pdf) to keep validation and AI work within MVP scope. Consult the [Implementation Design](../../CatalogGuard_AI_Implementation_Design.pdf) only when a new contract field changes a user-visible status, evidence panel, or workflow presentation; coordinate that change with Web.

```text
Web outbox -> FastAPI job API -> durable queue/worker
  -> stream CSV -> mapping/normalization -> deterministic rules
  -> eligible advisory analysis -> FastAPI result validation
  -> signed callback with retry -> Web atomic application
```

There is no browser-to-FastAPI path and no FastAPI route that decides a review outcome or customer visibility.

### Phase 1 Web bridge

The Phase 1 bridge is contract-only: Web verifies the signed `ValidationJobResult v1` fixture using the shared D-012 canonical HMAC message and records an auditable receipt after durable nonce replay protection. It does not execute a worker callback or apply canonical catalog effects. The live sequence shown above is introduced incrementally by the later feed, validation, and callback phases.

The executable endpoint and model inventory is `/openapi.json`, rendered at `/docs` by FastAPI Swagger UI when `CATALOGGUARD_ENABLE_API_DOCS=true`. Pydantic models remain the schema source. Document all D-012 security headers, response/error variants, and synthetic non-sensitive examples. Reconcile this inventory and its drift tests in every phase; production documentation is disabled by default.

## Execution context

Every job/service method takes explicit context:

```python
ExecutionContext(
    correlation_id: str,
    actor_type: Literal["SYSTEM", "AI"],
    actor_service: str,
    job_id: str,
    idempotency_key: str,
    feed_upload_id: str,
    seller_id: str,
)
```

`USER` context belongs to Web user actions. AI-runtime-originated events use `actor_type="AI"` and a non-empty AI service name. Never read actor values from a file, model response, or mutable global context.

## Job lifecycle

| State | Meaning | Allowed next state |
| --- | --- | --- |
| `PENDING` | Accepted and persisted, not claimed. | `PROCESSING`, `CANCELLED`, `FAILED` |
| `PROCESSING` | Worker has a leased claim and checkpoint. | `COMPLETED`, `FAILED`, `CANCELLED` |
| `COMPLETED` | Result callback acknowledged or terminally recorded for retry/reconciliation. | none |
| `FAILED` | Permanent parse/dependency/retry-exhausted failure. | retry only through a new controlled attempt |
| `CANCELLED` | Explicit terminal cancellation with a safe checkpoint. | none |

The idempotency key maps to exactly one logical job/result. Store attempt count, lease/heartbeat, progress, last successful checkpoint, bounded failure details, and callback delivery state. Acknowledge a queue message only after the appropriate operational transaction commits.

## Parser and normalizer contract

The first parser supports CSV only. For every real workflow, read the job-granted object from Cloudflare R2 through a scoped, read-only adapter. `.env.local` selects the isolated local-development bucket and `.env.prod` selects the isolated production bucket. Before parsing, verify object identity, file size, signature/MIME where available, declared checksum, and mapping version. Parse as streams/batches, not a complete unbounded in-memory file. The Phase 1 fake adapter is retained only for unit, contract, and isolated integration tests.

### Phase 2 implementation boundary

The R2 adapter reads a job-granted object only and checks its bounded byte count and SHA-256 checksum. `CsvIngestionService` consumes chunks, maps `catalog-map/v1`, and commits each row outcome and safe checkpoint to the operational store. These are operational row results, not Web canonical records. Phase 3 adds deterministic rules plus one bounded, single-process completion callback; Web alone applies canonical products and issues. Queue durability, callback retries, and chunked result delivery remain Phase 4 responsibilities.

For each row return or retain:

- `sourceRowNumber`: 1-based, stable original row number;
- source identifier and raw-row evidence/reference, never overwritten;
- normalized candidate data with explicitly parsed decimal/date/boolean/integer values;
- mapping version and row-level safe failure summary;
- per-row outcome independent from later rows.

Unknown columns may remain in source evidence but never enter the canonical candidate automatically. `0` and `false` are valid values, not missing values. Normalization must be deterministic and versioned.

## Deterministic rules

Implement rules as pure functions over a normalized candidate, the configured taxonomy/rule context, and rule version. Use a registry such as:

```text
ruleId: REQUIRED_FIELD_TITLE
version: 1.0.0
appliesWhen: product listing candidate
severity: ERROR
result: fieldPath, message, detectedValue, expectedValue, suggestedValue?
```

Initial rules cover required fields, title/description emptiness, type parsing, price validity and comparisons, inventory constraints, duplicate SKU inside the feed, supported/active category, and category attributes. Keep category, mapping, and rule definitions cached only for bounded controlled periods and record versions in every result.

Issue semantics are fixed:

- `INFO`: informational only.
- `WARNING`: recommends attention but does not independently block approval.
- `ERROR`: blocks approval until resolved or validly waived.
- `BLOCKER`: blocks processing/customer readiness until resolved or validly waived under allowed governance.

Rules do not approve records. A result is evidence that Web uses with its own workflow and readiness checks.

## AI advisory runtime

The `ai-runtime` is an internal service reachable only from FastAPI. LangGraph owns graph state: eligibility, request, parse, retry/fallback, and handoff. LangChainJS owns constrained provider invocation and parsing. FastAPI owns final response validation.

### Eligible input

Send only sanitized title, description, current category context, and active/assignable taxonomy candidates needed for category consistency. Exclude seller account data, user data, secret values, raw file content, credentials, and arbitrary URLs. Skip rows that lack meaningful semantic input or that cannot be safely categorized.

### Required advisory response

```json
{
  "advisoryType": "CATEGORY_CHECK",
  "consistent": false,
  "suggestedCategoryId": "allowed-category-id-or-null",
  "suggestion": "short user-facing guidance",
  "confidence": 0.0,
  "evidence": ["short grounded reason"]
}
```

FastAPI checks the exact schema, confidence range, allowed category reference, evidence limits, and absence of unsupported actions. Reject malformed output. Low confidence becomes a review suggestion; no output is ever silently accepted as a correction. Model unavailability is a graceful deterministic-only completion, not an approval or processing failure.

## Callback protocol

Callbacks include the shared contract version, job/feed/seller/checksum/idempotency identity, correlation ID, signed body, timestamp, and nonce. Sign canonical serialized bytes with the designated service credential. Web must return a classified safe response; retry only retryable failures with bounded exponential backoff.

On `2xx`, record callback acknowledgment. On a permanent `4xx` contract/identity failure, record terminal callback failure and alert; do not change a result to success. On retryable failures, preserve the exact same result identity/payload and retry. If result data is chunked, Web must acknowledge/reconcile all chunks before the logical job completes.

## Operational safeguards

- Set explicit deadlines for storage reads, queue leases, parser batches, AI calls, and callbacks.
- Enforce bounded concurrency at worker, AI, feed, and seller levels.
- Use a safe provider failure taxonomy: timeout, rate limit, unavailable, malformed response, schema invalid, taxonomy invalid, and unknown internal error.
- Emit metrics for feed/job duration, row outcomes, processing checkpoint age, queue depth, retries, dead letters, issue count by rule/severity, AI latency/failure/token/cost, and callback delivery.
- Alert on stuck jobs, repeated worker failures, growing queue/review backlogs, callback terminal failures, and abnormal AI cost/failure rates.

## Verification scenarios

| Scenario | Expected result |
| --- | --- |
| Same request delivered twice | One logical job; same safe result and no duplicate completed work. |
| Worker dies after checkpoint | New worker resumes from checkpoint; completed batches are not reprocessed as new effects. |
| One malformed row | Row-level structured failure; other valid rows continue. |
| Full unreadable file | Safe terminal file failure; no partial success result. |
| Duplicate SKU | Deterministic issue with stable rule/version and row/product references. |
| AI timeout or malformed JSON | Deterministic result completes; advisory is absent/failure-recorded without approval effect. |
| Callback replay or bad signature | Rejected safely; no Web canonical mutation. |
| Valid result redelivery | Idempotent accepted result with no duplicate products/issues/audit effects. |
