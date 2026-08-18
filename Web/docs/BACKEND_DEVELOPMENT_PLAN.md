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

## Phase 1 - BFF foundation, identity, and persistence baseline

**Goal:** Establish secure server-side identity, tenant isolation, persistence conventions, and observability.

- Create validated environment configuration, correlation-ID middleware, structured safe logs, OpenTelemetry trace propagation, health/readiness checks, and stable client-safe error envelopes.
- Configure Auth.js, password hashing, active-user enforcement, session expiry/refresh, CSRF-safe cookies, and authentication audit events.
- Implement `ADMIN`, `CATALOG_REVIEWER`, and `SELLER_OPERATOR` authorization services. Derive role and seller scope from verified sessions at route and service boundaries.
- Set up MongoDB/Mongoose connection, repository interfaces, migration/index workflow, and core `SELLER`, `USER`, `CATEGORY`, and append-only `AUDIT_LOG` schemas.
- Add baseline rate limits, input schemas, repository projections, and tests for unauthenticated, disabled-user, role-denied, and cross-seller behavior.

**Exit criteria:** Protected mutations/read paths are server-authorized and tenant-scoped; core entities/indexes are in place; user/auth events are audited; every request/error is safely traceable by correlation ID.

## Phase 2 - Private feed intake and validation-job dispatch

**Goal:** Persist a CSV upload safely and deliver exactly one trusted job to Orchestration.

- Implement private-object upload coordination, filename sanitization, CSV-only type gate, file size/MIME/signature/basic-structure checks, checksum calculation, and seller-scoped duplicate detection.
- Authenticate every feed route, derive the seller scope from the verified session, and authorize the actor before upload, list, detail, download, or dispatch work; never trust a browser-supplied seller identifier.
- Persist `FEED_UPLOAD`, ownership, immutable object metadata, feed configuration, checksum, processing status, and dispatch/outbox record before publishing a job.
- Implement the typed `ValidationJobRequest v1` client with service authentication, correlation ID, idempotency key, timeout, retry classification, and durable dispatch status.
- Implement feed list/detail query services with pagination, projections, authorized short-lived download URL creation, and backend-derived processing status.
- Implement the protected signed callback endpoint with contract validation, identity match, replay protection, and idempotent fixture-result application path.

**Exit criteria:** A valid, authorized seller CSV creates one immutable feed and one logical validation job; malformed/duplicate uploads are safe; callbacks cannot be spoofed/replayed; cross-seller access is denied; a rejected callback changes no canonical catalog data.

## Phase 3 - Canonical catalog, result application, and corrections

**Goal:** Convert validated results into versioned, seller-scoped catalog data.

- Implement product aggregate/detail schemas, source-detail linkage, unique/index constraints, Decimal128 price handling, integer inventory invariants, mapping/rule-version traceability, and D-004 workflow-state migration.
- Atomically apply validated callback results to source detail, product/version details, validation issues, AI-analysis history, feed counters, workflow records, and audit events. Make duplicate result delivery harmless.
- Implement scoped product/feed/issue queries, stable pagination/filtering/search, and safe export job creation with formula-injection protection.
- Enforce verified-session authentication and role/seller-scope authorization at both route and domain-service boundaries for every catalog, issue, correction, revalidation, and export operation.
- Implement correction drafts and save-and-revalidate as distinct idempotent domain actions. Require current product version and create a new version rather than mutating raw evidence.
- Reconcile recurring/obsolete findings through issue lifecycle updates and dispatch revalidation only after correction data is committed.

**Exit criteria:** Canonical result application is atomic/idempotent; protected reads and mutations remain authenticated and tenant-scoped; product versions cannot cross sellers or overwrite newer data; corrections preserve immutable evidence; data invariants and callback failure paths have integration tests.

## Phase 4 - Review, workflow, customer readiness, and governance

**Goal:** Implement the human-controlled decision system and the only readiness gate.

- Implement reviewer queue/read services with indexed stable ordering by severity, impact, age, and tie-breaker; restrict cross-seller reads to reviewer/admin roles.
- Require a verified, active reviewer or administrator session for review and issue operations; re-check role, seller scope where applicable, and session freshness in every decision/waiver domain service.
- Implement issue lifecycle actions with allowed transitions, resolution/waiver authority, notes, timestamps, and audit events.
- Implement immutable `REVIEW_DECISION` creation with reauthentication where required, idempotency, current-version conflict check, unresolved error/blocker validation, transaction behavior, and audit.
- Implement workflow transitions and the atomic customer-readiness gate. Verify active seller, required fields, current approved version, category/pricing/inventory validity, and absence of unresolved error/blocker issues.
- Implement administrator seller/user/category/rule actions, explicit override reason, and append-only audit-log access.

**Exit criteria:** Only authenticated, qualified human actors can decide/waive as allowed; stale decisions conflict; approvals do not bypass validation; readiness cannot be set through any route except the gate; all material actions are auditable.

## Phase 5 - Read models, operational controls, and backend resilience

**Goal:** Support dashboards and administration without weakening performance or policy.

- Create indexed query/read-model services or bounded aggregations for seller, reviewer, and administrator dashboards; avoid unbounded collection scans and full history loads.
- Authenticate and authorize every dashboard, administration, audit, and export request against the same trusted role and tenant scope used by its backing query; do not rely on a UI route or filter for access control.
- Add paginated server-side data services for feeds, products, issues, sellers, users, categories, rules, and audit events with strict projections and filter validation.
- Implement asynchronous large exports, download authorization, formula-injection neutralization, result retention, and audit events.
- Complete rate limiting for login, upload, AI-facing, and review endpoints; add explicit dependency timeouts and retry boundaries.
- Add metrics for throughput, feed/row outcomes, callback failures, queue/review backlog, readiness failures, database latency, and user-facing safe error codes.

**Exit criteria:** Operational pages have performant, authenticated scoped read paths; privileged/export endpoints retain tenant/role enforcement; metrics reveal application health without exposing sensitive data.

## Phase 6 - Security, recovery, and release hardening

**Goal:** Prove the BFF and canonical data layer can be deployed and recovered safely.

- Run full API, repository, migration, authorization, tenant-isolation, workflow, callback, idempotency, transaction-rollback, and contract suites.
- Exercise authentication lifecycle controls across every phase: sign-in/session expiry and refresh, disabled-user rejection, CSRF-safe mutation handling, role/scope denial, direct-route denial, and credential/secret rotation.
- Execute end-to-end tests with Orchestration for upload -> result callback -> correction -> revalidation -> review -> readiness, including AI unavailable, malformed callback, callback retry, and stale product version.
- Load-test a 1,000-product MVP batch; review indexes, aggregation plans, callback application, export behavior, and rate-limit boundaries using measurements.
- Validate backup/restore, schema migration forward-fix, feature flags, secret rotation, graceful shutdown, health versus dependency readiness, deployment record metadata, and alert/runbook coverage.
- Confirm audit/log redaction and production configuration checks prevent secrets, prompts, storage locations, and raw sensitive payloads from escaping.

**Exit criteria:** The shared release gate passes with no failing schema, authentication, workflow, tenant, authorization, contract, security, or E2E tests; recovery and operational procedures have been exercised in a production-like environment.
