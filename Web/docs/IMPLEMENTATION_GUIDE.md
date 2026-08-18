# Web implementation guide

## Responsibilities

The Web application is the user-facing Next.js product and normal backend. It stores canonical data, applies authorized product/version mutations, controls human decisions and customer readiness, and presents validation/AI evidence returned by Orchestration. It does not decide deterministic validation outcomes itself.

## Role-based route inventory

| Area | Routes and primary purpose | Allowed roles |
| --- | --- | --- |
| Shared | `/login`, `/reset-password`, `/profile`, access denied, session expired | public for entry routes; authenticated for profile. |
| Seller | `/seller/dashboard`, `/seller/feeds/new`, `/seller/feeds`, `/seller/feeds/[feedId]`, `/seller/products`, `/seller/products/[productId]/correct` | `SELLER_OPERATOR`, trusted seller scope. |
| Reviewer | `/reviewer/dashboard`, `/reviewer/queue`, `/reviewer/queue/[productId]`, `/reviewer/issues`, `/reviewer/products`, `/reviewer/feeds` | `CATALOG_REVIEWER` or `ADMIN` where appropriate. |
| Administrator | `/admin/access-requests`, `/admin/dashboard`, `/admin/feeds`, `/admin/products`, `/admin/sellers`, `/admin/users`, `/admin/categories`, `/admin/validation-rules`, `/admin/audit-log` | `ADMIN`. |

Direct navigation must work when authorized. A missing role is `403`, a missing resource is `404`, and a session-expired mutation prompts reauthentication without submitting the original action.

## API surface and service ownership

Route names may change, but each capability must have an equivalent typed schema, service, authorization check, audit behavior, and test.

The executable backend inventory is `/api/openapi.json`, rendered at `/api/docs` by Swagger UI when `API_DOCS_ENABLED=true`. Generate component schemas from runtime Zod contracts, document authentication/authorization and same-origin requirements, and use only synthetic non-sensitive examples. Reconcile this inventory and its drift tests in every backend phase; production documentation is disabled by default.

| Capability | Representative endpoint/action | Service rules |
| --- | --- | --- |
| Feed creation | `POST /api/feeds` | Verify upload intent/object, checksum and seller scope; create feed plus outbox atomically. |
| Feed read/download | `GET /api/feeds`, `GET /api/feeds/:id`, `POST /api/feeds/:id/download` | Pagination and projections; scoped signed URL only after authorization. |
| Orchestration callback | `POST /api/internal/validation-results` | Service auth, signature/replay, job correlation, schema, idempotent atomic result application. |
| Products | `GET /api/products`, `GET /api/products/:id` | Server filters, stable cursor/page, no raw source payload by default. |
| Correction | `POST /api/products/:id/corrections`, `POST /api/products/:id/revalidate` | Current-version check, new version, audit, validation dispatch. |
| Review queue | `GET /api/review-queue`, `GET /api/issues` | Reviewer/admin only; stable indexed ordering and filters. |
| Decision | `POST /api/products/:id/review-decisions` | Recheck role, product version, unresolved issues, idempotency, transaction, audit. |
| Access request | `POST /api/access-requests` | Public seller/reviewer proposal only; validate and hash submitted credentials, create no active account, return safe field errors, and audit submission. |
| Access-request administration | `GET /api/admin/access-requests`, `POST /api/admin/access-requests/:id/approve`, `POST /api/admin/access-requests/:id/revoke`, `POST /api/admin/access-requests/:id/dismiss` | Active administrator only and same-origin protected for mutations. Approve/revoke notes are optional; approval atomically provisions the scoped active identity. Dismissal is per administrator and preserves the request/audit record. |
| Administrator bootstrap | `POST /api/internal/bootstrap/admin` | Server-only bootstrap-secret header; creates a named administrator and supports multiple administrators. Never expose this operation or its secret in product UI. |
| Administration | seller/user/category/rule management actions | Admin only; explicit override reason and audit for exceptional actions. |
| Reporting | `POST /api/exports` | Same role/scope/filter rules as displayed data; large exports asynchronous. |

## Canonical entity implementation notes

- Implement the workbook entities as separate collection schemas or clearly bounded embedded documents. The product aggregate must preserve the one-to-one detail relationships and product-version semantics.
- Required indexes include normalized user email, `(sellerId, externalProductId)` uniqueness, feed status/upload time, product workflow/review fields, open issue product/status/severity, review queue ordering fields, and audit `(entityType, entityId, occurredAt)`.
- Add unique `(feedUploadId, sourceRowNumber)` for source details and an open-issue uniqueness strategy around product version, `fieldPath`, and `ruleId`.
- Persist mapping version, rule-set version, source row number, checksum, correlation ID, job ID, and idempotency key where they allow a result or audit event to be traced without exposing raw content.
- Use a migration to add the authoritative `workflowStatus` field and to derive the legacy `catalogStatus` compatibility view described in D-004.

## Feed and callback sequence

```text
Seller -> Web: choose CSV + configuration
Web -> Cloudflare R2: private object upload
Web -> MongoDB: FEED_UPLOAD + checksum + outbox (commit)
Web -> Orchestration: ValidationJobRequest v1
Orchestration -> Web: signed ValidationJobResult v1 callback
Web -> MongoDB: source/product/issues/AI history/feed/audit (one idempotent application)
Web -> seller/reviewer: persisted status and next permitted action
```

The browser never calls FastAPI directly, never receives internal storage identifiers, and never supplies a trusted `sellerId` for a seller-owned request.

Real local-development and production feed flows both use private Cloudflare R2. `.env.local` selects the dedicated local-development bucket; `.env.prod` selects the separate production bucket. The corresponding Web and Orchestration environment files target the same bucket for that environment with separate least-privilege credentials. Fake object storage is permitted only inside automated tests.

## UX implementation requirements

The supplied visual design defines a sober operational console: dark role rail, neutral work surface, large clear page headers, semantic status colors, metric cards, tables, a processing timeline, and explicitly separated AI advisory panels.

- Keep data dense but scannable. Use tables for catalog, feeds, issues, review queue, users, categories, and audit logs.
- Give every timeline a backend-derived stage and never simulate completion with timers.
- A review pane must place original/canonical values, deterministic findings, AI suggestion/confidence/evidence, and human decision controls in distinct sections.
- Empty review queue should explain that no eligible products await review and offer a useful safe next action.
- Error messages name the failed operation, say whether a mutation occurred, show a correlation/reference ID, and offer a safe retry or navigation action.
- Use user-supplied data only as text or sanitized rich text. Sanitize filenames, validation messages, descriptions, and other seller content before display.

## Verification matrix

| Flow | Acceptance test |
| --- | --- |
| Seller upload | private object, correct seller scope, duplicate checksum blocked, feed persisted before dispatch, status visible. |
| Result callback | invalid signature/schema/replay rejected; duplicate result does not duplicate rows/issues/audit; valid result is visible in feed detail. |
| Correction | source remains immutable, new version created, stale version conflicts, revalidation dispatched. |
| Review | only eligible reviewer/admin can decide; errors/blockers prevent approval; reject/request changes require note; decision immutable/audited. |
| Controlled onboarding | seller/reviewer proposal creates no active identity; only an active administrator can approve/revoke; approval provisions the correct role/seller scope atomically; optional decision note is accepted; dismissal hides a completed record only for the dismissing administrator and remains auditable. |
| Readiness | only approved current version with active seller, valid category/price/inventory/fields and no blockers becomes ready. |
| Access | seller A cannot read/export/mutate seller B; disabled sessions are rejected; admin-only surfaces do not leak to reviewers. |
