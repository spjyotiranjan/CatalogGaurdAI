# Architecture decisions and shared contracts

This register turns the supplied designs into implementation decisions. It is the shared source of truth for both delivery tracks.

## Service map

```text
Browser
  -> Next.js Web BFF
       -> private object storage
       -> MongoDB canonical data and audit trail
       -> durable validation-job dispatch
  -> FastAPI Orchestration
       -> controlled source read and validation worker
       -> internal Node AI runtime (later phase only)
       -> signed result callback
  -> Next.js Web BFF verifies callback and commits canonical outcome
```

The FastAPI service is authoritative for deterministic validation behavior. The Web BFF is authoritative for canonical catalog persistence, review decisions, visibility gating, and user-facing authorization. A valid result callback is necessary but never sufficient for approval or customer readiness.

## Decision register

### D-001: Delivery ownership

`Web/` owns the Next.js desktop application and normal backend work. `Orchestration/` owns only validation and AI-orchestration capabilities. FastAPI is the first orchestration deliverable; the internal Node AI runtime is introduced after deterministic validation is stable.

### D-002: MVP upload scope

The PRD specifies CSV uploads, while the backend rules and UX design list CSV, XLSX, and JSON. The first releasable MVP accepts CSV only. The upload contract includes `fileType` and is designed to add XLSX or JSON behind a feature flag after parser, security, and acceptance tests are complete. Do not advertise or accept those formats early.

### D-003: Canonical data ownership

The Web BFF owns MongoDB records described in the entity workbook: sellers, users, feed uploads, source details, product aggregates and details, categories, issues, reviews, AI analysis history, and audit logs. Orchestration may keep job and checkpoint data needed for reliable execution, but it must not directly create approval decisions, mutate canonical product records, or mark customer readiness.

### D-004: Workflow normalization

The entity workbook splits `catalogStatus` and `PRODUCT_WORKFLOW_STATE`, while the rules define a richer state machine. Implement a single authoritative `workflowStatus` in `PRODUCT_WORKFLOW_STATE` with these values:

`DRAFT -> VALIDATING -> PENDING_REVIEW -> APPROVED -> READY_FOR_CUSTOMER_USE`

Permitted side paths are `VALIDATING -> BLOCKED`, `PENDING_REVIEW -> CHANGES_REQUESTED | REJECTED`, and `CHANGES_REQUESTED -> VALIDATING`. The existing `catalogStatus` is a derived compatibility/read-model field, not a client-writable state. Its exact mapping must be covered by tests and documented in the schema migration.

### D-005: Validation severity and issue lifecycle

Rule results use `INFO`, `WARNING`, `ERROR`, and `BLOCKER`. Issues are keyed by product version, `fieldPath`, and `ruleId` to prevent duplicate open findings. Valid issue transitions are `OPEN -> IN_REVIEW -> RESOLVED | WAIVED`. Only reviewers or administrators may waive blockers. Errors and blockers block approval; blockers also prevent processing or readiness where specified.

### D-006: Internal job and callback contract

Web persists a `FEED_UPLOAD`, private object metadata, checksum, idempotency key, and outbox record before dispatching a validation job. The FastAPI result callback is accepted only when all of the following are true:

- service authentication and signature are valid, timestamp is within the replay window, and the declared contract version is supported;
- `jobId`, `feedUploadId`, seller scope, checksum, and idempotency key match the persisted dispatch;
- the payload validates against the Web-owned schema and contains no unknown executable or control fields;
- the completion has not already been applied, or it is byte-for-byte the same idempotent completion.

The Web BFF persists feed status, product versions, issues, AI-analysis history, workflow changes, and audit events atomically where possible. A rejected callback must be observable, safe to retry, and must not partially change the catalog.

### D-007: AI containment

AI is allowed only for semantic or ambiguous checks such as title/description/category consistency and clear correction phrasing. Inputs are minimized and sanitized. Output is strict structured data containing an advisory finding, allowed category reference when applicable, confidence, evidence, prompt version, and model metadata. Model/provider failure degrades gracefully to deterministic validation and review; it never blocks a valid deterministic result merely because the AI system is unavailable.

### D-008: Product version and human decision

Corrections create a new product version and trigger revalidation. Review requests include `productId`, `reviewedVersion`, `decision`, conditional note, and idempotency key. The decision transaction re-checks authorization, the current version, and unresolved errors/blockers. A stale version returns a conflict; it is never silently merged or approved.

### D-009: Source preservation and exports

Private original files are immutable, accessed only through scoped short-lived URLs after authorization. Raw source payload is never customer-facing. CSV/XLSX exports must neutralize formula-injection values and must enforce the same role, tenant, and filtering rules as the screen that requested them.

### D-010: Observability contract

Every request, job, callback, model call, audit event, and user-visible error carries the same correlation ID. Structured events include service, operation, safe outcome code, duration, actor type, and available feed/product identifiers. Trace context uses OpenTelemetry; centralized collection is Grafana Loki. Do not log complete private payloads, secrets, tokens, or prompts.

### D-011: Phase-one authentication audit subjects

The entity workbook's initial `AUDIT_LOG.entityType` enum omits authentication, user, and category subjects even though backend rules `AUTH-06` and `AUD-10` require those events. Extend the enum compatibly with `AUTH`, `USER`, and `CATEGORY`. `entityId` remains required for identified entity events, but may be null only for a pre-identity `AUTH` event such as a failed login for an unknown or invalid account. Such events use a `SYSTEM` actor, a non-empty `actorService`, a correlation ID, and sanitized metadata such as a one-way email fingerprint; they never store the submitted email, password, token, or session contents.

### D-012: Validation transport findings and service-message authentication

The entity workbook requires `VALIDATION_ISSUE.productRecordId`, but Orchestration produces validation evidence before Web creates or resolves the canonical product/version. `ValidationJobResult v1` therefore carries strict transport `ValidationFinding` objects keyed by `sourceRowNumber`, candidate identity, `fieldPath`, and stable rule ID/version. A transport finding is not a canonical `VALIDATION_ISSUE`. Web assigns the resulting product/version identifiers and enforces the canonical issue deduplication key while applying a verified result atomically. Orchestration must never invent or directly persist a Web-owned product ID.

Web-to-Orchestration jobs and Orchestration-to-Web callbacks use the same v1 HMAC-SHA256 message-authentication format. Required headers are `X-CatalogGuard-Key-Version`, `X-CatalogGuard-Service`, `X-CatalogGuard-Timestamp` as Unix seconds, `X-CatalogGuard-Nonce` as a UUID, and `X-CatalogGuard-Signature` as lowercase hexadecimal. The signed canonical bytes are the UTF-8 encoding of `v1\n{keyVersion}\n{serviceId}\n{timestamp}\n{nonce}\n{HTTP_METHOD}\n{path}\n{sha256(body)}`. Verifiers compare signatures in constant time, allow no more than five minutes of clock skew, and persist accepted `(serviceId, nonce)` pairs for at least the replay window. A nonce replay, stale timestamp, unknown service/key version, malformed header, or bad signature is rejected before domain processing. The key-version header enables controlled secret rotation outside the payload contract; secrets and signatures are never logged.

`ValidationJobRequest v1` identity fields (`contractVersion`, `jobId`, `idempotencyKey`, feed/seller/checksum identity, and execution context) are immutable after acceptance. Reusing an idempotency key with byte-identical canonical request content returns the existing logical job; reusing it with different content is a conflict. `PENDING`, `PROCESSING`, `COMPLETED`, `FAILED`, and `CANCELLED` are operational job states. Callback retry policy is bounded exponential backoff: schema/authentication/identity `4xx` responses are permanent, `408`, `429`, `5xx`, network failures, and timeouts are retryable, and the exact result identity and payload are retained across attempts.

## Shared payload shapes

The code should define these as versioned schemas in both services. Fields may be expanded only with a compatible versioned contract.

### `ValidationJobRequest` v1

```json
{
  "contractVersion": "v1",
  "jobId": "uuid",
  "idempotencyKey": "string",
  "feed": {
    "feedUploadId": "object-id",
    "sellerId": "object-id",
    "fileType": "CSV",
    "feedType": "PRODUCT_LISTING",
    "checksum": "sha256-hex",
    "storageObjectKey": "private-reference",
    "mappingVersion": "catalog-map/v1"
  },
  "execution": {
    "correlationId": "uuid",
    "actorType": "SYSTEM",
    "actorService": "web-bff"
  }
}
```

### `ValidationJobResult` v1

```json
{
  "contractVersion": "v1",
  "jobId": "uuid",
  "feedUploadId": "object-id",
  "sellerId": "object-id",
  "checksum": "sha256-hex",
  "idempotencyKey": "string",
  "outcome": "COMPLETED",
  "summary": { "totalRows": 0, "processedRows": 0, "acceptedRows": 0, "rejectedRows": 0 },
  "records": [],
  "execution": {
    "correlationId": "uuid",
    "actorType": "SYSTEM",
    "actorService": "validation-orchestrator"
  }
}
```

Each record carries its source row number, normalized product candidate, rule-set version, deterministic issues, and optional validated AI advisory result. Results must not carry raw source file content, model prompts, credentials, or browser-supplied authorization data.

## Shared release gate

A release requires schema and migration checks, tenant-isolation and RBAC tests, workflow and readiness tests, repeat-job idempotency tests, contract compatibility tests, privacy/log-redaction checks, dashboard metrics checks, and a complete upload-to-review-to-readiness end-to-end test.
