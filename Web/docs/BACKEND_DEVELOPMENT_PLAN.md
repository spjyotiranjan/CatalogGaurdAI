# Web backend development plan

This plan covers the Next.js backend-for-frontend and canonical application services. It owns identity, authorization, MongoDB data, storage coordination, reviews, readiness, audit, and the FastAPI handoff. FastAPI owns parsing and deterministic validation; the Web backend must not duplicate that logic.

## Required source references

| Backend concern | Required source reference |
| --- | --- |
| All BFF behavior, security, tenant isolation, idempotency, workflow, audit, observability, tests, and release gates | [Backend Rules](../../CatalogGuard_AI_Backend_Rules.pdf). |
| MongoDB entities, fields, relationships, types, and indexes | [Entity Details workbook](../../CatalogGuard_AI_Entity_Details.xlsx). |
| MVP scope, roles, supported feed flow, and success criteria | [PRD](../../CatalogGuard_AI_PRD.pdf). |
| User-visible route behavior or a payload that changes what a user sees | [Implementation Design](../../CatalogGuard_AI_Implementation_Design.pdf), coordinated with the UI track. |

When a source conflicts with the shared decisions, record and resolve the discrepancy before changing code or schema.

## OpenAPI and Swagger phase gate

Every phase must reconcile `/api/openapi.json` and `/api/docs` with its implemented Web endpoints and Zod models. Added, changed, deprecated, or removed requests, responses, errors, authentication/authorization requirements, headers, status codes, and safe examples must be reflected in OpenAPI and covered by documentation-drift tests before that phase can be marked complete. Cross-service models must also pass compatibility checks against Orchestration. Swagger is enabled for local development/testing and disabled by default in production.

## Phase 1 - BFF foundation, identity, and persistence baseline

**Goal:** Establish secure server-side identity, tenant isolation, persistence conventions, and observability.

- Create validated environment configuration, correlation-ID middleware, structured safe logs, OpenTelemetry trace propagation, health/readiness checks, and stable client-safe error envelopes.
- Configure Auth.js, password hashing, active-user enforcement, session expiry/refresh, CSRF-safe cookies, and authentication audit events.
- Implement `ADMIN`, `CATALOG_REVIEWER`, and `SELLER_OPERATOR` authorization services. Derive role and seller scope from verified sessions at route and service boundaries.
- Set up MongoDB/Mongoose connection, repository interfaces, migration/index workflow, and core `SELLER`, `USER`, `CATEGORY`, and append-only `AUDIT_LOG` schemas.
- Add baseline rate limits, input schemas, repository projections, and tests for unauthenticated, disabled-user, role-denied, and cross-seller behavior.
- Reconcile Swagger/OpenAPI for all Phase 1 health, readiness, Auth.js, account, password, security, request, response, and safe-error contracts.

**Exit criteria:** Protected mutations/read paths are server-authorized and tenant-scoped; core entities/indexes are in place; user/auth events are audited; every request/error is safely traceable by correlation ID.

### Phase 1 completion record - 2026-08-12

**Status:** Complete.

**Implemented:**

- Added fail-fast, typed server configuration with a committed [environment template](../.env.example), canonical Auth.js URL validation, production HTTPS enforcement, and replica-set-aware MongoDB configuration.
- Added request correlation in [proxy.ts](../proxy.ts), safe structured log redaction, OpenTelemetry registration, stable client-safe error envelopes, and separate `GET /api/health` liveness and `GET /api/ready` dependency-readiness routes.
- Configured Auth.js v5 credentials sessions with locked dependency versions, `httpOnly`/`sameSite`/environment-secure cookies, server-controlled expiry and refresh, bcrypt cost-12 password hashes, non-enumerating login failures, baseline login rate limiting, current-user status revalidation, and correlated login/failure/logout/password-change audit events.
- Added route-boundary session checks and service-boundary authorization for `ADMIN`, `CATALOG_REVIEWER`, and `SELLER_OPERATOR`. Role and seller scope are re-derived from the active database user; invalid role/seller combinations and cross-seller access are denied.
- Added protected `GET /api/account` and same-origin-protected `PATCH /api/account/password` backend routes. Password changes recheck the current password and write the new hash plus audit event in one MongoDB transaction.
- Added strict Mongoose models and projected repositories for `SELLER`, `USER`, `CATEGORY`, and append-only `AUDIT_LOG`. The controlled [migration runner](../scripts/migrate.mts) creates database validators and named indexes without enabling automatic schema/index creation at application startup; run it with `npm run db:migrate` against a replica-set-capable MongoDB deployment.
- Resolved the authentication-audit entity mismatch before schema implementation in shared decision D-011: `AUDIT_LOG.entityType` now includes `AUTH`, `USER`, and `CATEGORY`, while a null `entityId` is allowed only for pre-identity authentication events with a one-way email fingerprint.
- Added the D-014 OpenAPI 3.1 inventory at `/api/openapi.json` and Swagger UI at `/api/docs`. Phase 1 health, readiness, Auth.js provider/sign-in/error/session/CSRF/credentials/sign-out, account, and password operations now include Zod-derived component models, security requirements, status/error responses, correlation headers, and safe examples. Production documentation is disabled by default.
- Kept this phase backend-only: no product page, product component, styling, or customer-facing UI implementation was changed. `/api/docs` is developer-only executable API documentation, not application UI. The in-process login limiter is the Phase 1 baseline and must be backed by shared state before horizontally scaled production deployment.

**Verification evidence:** `npm run typecheck`, `npm run lint`, and `npm run build` pass. `npm test` passes 11 files and 33 tests, covering OpenAPI drift/security/model/availability checks, environment validation, safe errors/logging, correlation propagation, password hashing, CSRF origin checks, unauthenticated and disabled-user rejection, role denial, cross-seller isolation, model invariants, repeatable real-MongoDB migration/index validation, and transactional login auditing. A live documentation smoke check returned `200` for `/api/openapi.json` and `/api/docs`; the production-server behavior checks remain liveness `200`, anonymous Auth.js session `200` with `null`, protected account access `401`, and readiness `503` when MongoDB is intentionally unavailable.

### Phase 1 cross-service bridge completion record - 2026-08-18

**Status:** Complete.

- Added the Web-owned strict Zod representations of `ValidationJobRequest v1` and `ValidationJobResult v1`, verified directly against the committed Orchestration schemas and result fixture.
- Added D-012-compatible HMAC-SHA256 canonical-message signing and verification, with the committed language-neutral signature vector as the compatibility proof. The configured Web service identity/secret matches Orchestration job intake; the distinct configured callback identity/secret verifies Orchestration results.
- Added protected `POST /api/internal/validation-results`. It verifies exact body bytes, required service headers, timestamp window, UUID nonce, configured callback actor, and correlation identity before accepting the Phase 1 fixture. It deliberately records only an audit receipt; feed/product/issue application remains a later-phase responsibility.
- Added durable MongoDB replay protection (`004-orchestration-phase-one-bridge`) using a unique service/key-version/nonce ledger and expiry index. The nonce claim and callback-receipt audit event commit in one transaction.
- Added the callback contract operation and strict result model to Web OpenAPI/Swagger. The matching environment values are documented in `.env.example`; the corresponding values must match `Orchestration/fastapi/.env` without reusing the two signing secrets.

**Verification evidence:** the Web compatibility suite reads Orchestration's committed `signature-test-vector.json` and `validation-job-result.v1.json`, accepts the signed fixture once, records the audit receipt, and rejects the replay and an unknown-field contract variant.

## Sub Phase 1.5 - Access requests and administrator approval

**Goal:** Let prospective sellers and reviewers submit a controlled proposal while preserving administrator-only authority over account activation.

- Public users may submit seller-onboarding or reviewer-access proposals through `POST /api/access-requests`. Passwords are bcrypt-hashed before persistence in an `ACCESS_REQUEST`; no active account is created on submission.
- An authenticated administrator may use `GET /api/admin/access-requests` and the protected approve/revoke actions. Approval and revocation notes are optional. Approval is transactional: reviewer approval creates an active reviewer; seller approval creates an active seller and linked seller operator.
- The protected `POST /api/admin/access-requests/{id}/dismiss` action hides only completed approved/revoked records from the acting administrator's list. It does not delete the request or audit history, and it remains visible to other administrators.
- Support controlled manual administrator provisioning through `POST /api/internal/bootstrap/admin` and the server-only bootstrap-secret header. It may create multiple administrators; it is not a one-time bootstrap switch.
- Keep raw credentials out of logs and audit snapshots. Write append-only submitted, approved, revoked, and dismissed access-request audit events; enforce one pending request or user account per email; and return only safe, field-addressable error envelopes.
- Ship migrations `002-access-requests` and `003-access-request-dismissals` with the normal migration runner. The email/invitation/notification layer is intentionally deferred. An approved user can sign in using the submitted credentials.

**Exit criteria:** Public submission cannot grant authority; only an active administrator can decide a pending request; approval creates correctly scoped active identities atomically; revocation and dismissal are auditable; a dismissed record stays preserved but does not reappear for that administrator.

### Sub Phase 1.5 completion record - 2026-08-18

**Status:** Complete.

**Implemented:** Typed access-request contracts, public proposal submission, active-admin-only review and decision endpoints, transactionally provisioned reviewer/seller identities, per-administrator dismissal, multi-admin bootstrap provisioning, migrations, audit events, and matching OpenAPI/Swagger operations. Decision notes are optional, and safe field errors are returned for proposal validation. The UI integration is recorded in the UI plan as the matching M1.5 slice.

**Operational note:** Apply the access-request migrations with `npm.cmd run db:migrate` for each environment before using the feature.

## Phase 2 - Private feed intake and validation-job dispatch

**Goal:** Persist a CSV upload safely and deliver exactly one trusted job to Orchestration.

- Implement private Cloudflare R2 upload coordination, filename sanitization, CSV-only type gate, file size/MIME/signature/basic-structure checks, checksum calculation, and seller-scoped duplicate detection. Use the local-development R2 bucket from `.env.local` for every real local workflow and the isolated production R2 bucket from `.env.prod` in production. Keep both buckets private and all credentials, endpoints, bucket names, object keys, and signed URLs server-only.
- Authenticate every feed route, derive the seller scope from the verified session, and authorize the actor before upload, list, detail, download, or dispatch work; never trust a browser-supplied seller identifier.
- Persist `FEED_UPLOAD`, ownership, immutable R2 object metadata/key, feed configuration, checksum, processing status, and dispatch/outbox record before publishing a job. Dispatch only the trusted scoped object key; never accept a browser-supplied storage key or URL as authority.
- Implement the typed `ValidationJobRequest v1` client with service authentication, correlation ID, idempotency key, timeout, retry classification, and durable dispatch status.
- Implement feed list/detail query services with pagination, projections, authorization-gated short-lived R2 download URL creation, and backend-derived processing status.
- Implement the protected signed callback endpoint with contract validation, identity match, replay protection, and idempotent fixture-result application path.
- Fail startup outside automated tests when R2 configuration is missing, the fake adapter is selected, or environment isolation is invalid. Fake storage may be injected only by unit, contract, and isolated integration tests.
- Load server-only `R2_ACCOUNT_ID`, `R2_ENDPOINT`, `R2_BUCKET_NAME`, `R2_ACCESS_KEY_ID`, and `R2_SECRET_ACCESS_KEY` from the uncommitted environment file. `.env.local` identifies the local-development bucket and `.env.prod` identifies the production bucket; public `NEXT_PUBLIC_*` storage variables are forbidden.
- Reconcile Swagger/OpenAPI for every Phase 2 feed, upload, download, dispatch, callback, R2-related request/response, and error contract.

**Exit criteria:** A valid, authorized seller CSV creates one immutable feed and one logical validation job; malformed/duplicate uploads are safe; callbacks cannot be spoofed/replayed; cross-seller access is denied; a rejected callback changes no canonical catalog data.

### Phase 2 completion record - 2026-08-18

**Status:** Complete.

- Added immutable seller-scoped `FEED_UPLOAD` persistence and migration `005-feed-intake`: private object reference, checksum, mapping version, job/idempotency identity, safe counters, and seller/status indexes.
- Added active-seller-only `POST /api/feeds`, `GET /api/feeds`, `GET /api/feeds/{id}`, and `POST /api/feeds/{id}/download`. Uploads are same-origin protected, CSV-only, checksum-addressed, stored privately in R2, audited, and dispatched with the signed v1 job contract. Reads derive seller scope from the active database user; no object key or credential is returned.
- The callback now verifies persisted feed/job/checksum/idempotency identity before atomically updating feed-level state and audit alongside nonce claim. It creates no canonical products, source details, issues, or AI effects.
- A dedicated retrying outbox consumer remains Phase 4; the Phase 2 feed holds the durable logical dispatch identity and Orchestration intake is idempotent.
- `/api/openapi.json` and `/api/docs` now cover feed upload/list/detail/download plus the callback behavior.

**Verification evidence:** `npm.cmd run typecheck`, `npm.cmd run lint`, `npm.cmd test` (41 tests), and `npm.cmd run build` pass.

## Phase 3 - Canonical catalog, result application, and corrections

**Goal:** Convert validated results into versioned, seller-scoped catalog data.

- Implement product aggregate/detail schemas, source-detail linkage, unique/index constraints, Decimal128 price handling, integer inventory invariants, mapping/rule-version traceability, and D-004 workflow-state migration.
- Establish the Phase 3 live-result path: accept one bounded, non-chunked signed result per completed job, verify its persisted job/feed/checksum/idempotency identity, and atomically apply it to source detail, product/version details, validation issues, feed counters, workflow records, and audit events. Make duplicate delivery harmless. AI-analysis history remains Phase 5 work.
- Define canonical product identity and reconciliation before application: seller-scoped external product identifier/SKU constraints, concurrent-feed ordering, version creation, and explicit no-delete behavior for products absent from a feed.
- Provide Orchestration the bounded, versioned category and rule context needed for deterministic validation; Web remains the authoritative category and rule-configuration owner.
- Implement scoped product/feed/issue queries, stable pagination/filtering/search, and safe export job creation with formula-injection protection.
- Enforce verified-session authentication and role/seller-scope authorization at both route and domain-service boundaries for every catalog, issue, correction, revalidation, and export operation.
- Implement correction drafts and save-and-revalidate as distinct idempotent domain actions. Require current product version and create a new version rather than mutating raw evidence.
- Reconcile recurring/obsolete findings through issue lifecycle updates and dispatch revalidation only after correction data is committed.
- Reconcile Swagger/OpenAPI for every Phase 3 catalog, issue, correction, revalidation, result-application, request/response, and error contract.

**Exit criteria:** A real uploaded feed reaches a signed, bounded deterministic result and is applied atomically/idempotently; protected reads and mutations remain authenticated and tenant-scoped; product versions cannot cross sellers or overwrite newer data; corrections preserve immutable evidence; data invariants and callback failure paths have integration tests.

## Phase 4 - Review, workflow, customer readiness, and governance

**Goal:** Implement the human-controlled decision system and the only readiness gate.

- Implement reviewer queue/read services with indexed stable ordering by severity, impact, age, and tie-breaker; restrict cross-seller reads to reviewer/admin roles.
- Require a verified, active reviewer or administrator session for review and issue operations; re-check role, seller scope where applicable, and session freshness in every decision/waiver domain service.
- Implement issue lifecycle actions with allowed transitions, resolution/waiver authority, notes, timestamps, and audit events.
- Implement immutable `REVIEW_DECISION` creation with reauthentication where required, idempotency, current-version conflict check, unresolved error/blocker validation, transaction behavior, and audit.
- Implement workflow transitions and the atomic customer-readiness gate. Verify active seller, required fields, current approved version, category/pricing/inventory validity, and absence of unresolved error/blocker issues.
- Implement administrator seller/user/category/rule actions, explicit override reason, and append-only audit-log access.
- Replace the Phase 3 single-process result path with a durable dispatch/outbox handoff, and retain callback receipts and retry state so completion remains recoverable across Web restarts.
- Reconcile Swagger/OpenAPI for every Phase 4 review, decision, waiver, workflow, readiness, governance, request/response, and error contract.

**Exit criteria:** Only authenticated, qualified human actors can decide/waive as allowed; stale decisions conflict; approvals do not bypass validation; readiness cannot be set through any route except the gate; all material actions are auditable.

## Phase 5 - Read models, operational controls, and backend resilience

**Goal:** Support dashboards and administration without weakening performance or policy.

- Create indexed query/read-model services or bounded aggregations for seller, reviewer, and administrator dashboards; avoid unbounded collection scans and full history loads.
- Authenticate and authorize every dashboard, administration, audit, and export request against the same trusted role and tenant scope used by its backing query; do not rely on a UI route or filter for access control.
- Add paginated server-side data services for feeds, products, issues, sellers, users, categories, rules, and audit events with strict projections and filter validation.
- Implement asynchronous large exports, download authorization, formula-injection neutralization, result retention, and audit events.
- Complete rate limiting for login, upload, AI-facing, and review endpoints; add explicit dependency timeouts and retry boundaries.
- Add metrics for throughput, feed/row outcomes, callback failures, queue/review backlog, readiness failures, database latency, and user-facing safe error codes.
- Reconcile Swagger/OpenAPI for every Phase 5 dashboard, export, retry, operational-control, request/response, and error contract.

**Exit criteria:** Operational pages have performant, authenticated scoped read paths; privileged/export endpoints retain tenant/role enforcement; metrics reveal application health without exposing sensitive data.

## Phase 6 - Security, recovery, and release hardening

**Goal:** Prove the BFF and canonical data layer can be deployed and recovered safely.

- Run full API, repository, migration, authorization, tenant-isolation, workflow, callback, idempotency, transaction-rollback, and contract suites.
- Exercise authentication lifecycle controls across every phase: sign-in/session expiry and refresh, disabled-user rejection, CSRF-safe mutation handling, role/scope denial, direct-route denial, and credential/secret rotation.
- Execute end-to-end tests with Orchestration for upload -> result callback -> correction -> revalidation -> review -> readiness, including AI unavailable, malformed callback, callback retry, and stale product version.
- Load-test a 1,000-product MVP batch; review indexes, aggregation plans, callback application, export behavior, and rate-limit boundaries using measurements.
- Validate backup/restore, schema migration forward-fix, feature flags, secret rotation, graceful shutdown, health versus dependency readiness, deployment record metadata, and alert/runbook coverage.
- Confirm audit/log redaction and production configuration checks prevent secrets, prompts, storage locations, and raw sensitive payloads from escaping.
- Perform a full Swagger/OpenAPI inventory against all Phase 6 routes and models, verify every security requirement and safe example, and fail the release when implementation and documentation differ.

**Exit criteria:** The shared release gate passes with no failing schema, authentication, workflow, tenant, authorization, contract, security, or E2E tests; recovery and operational procedures have been exercised in a production-like environment.
