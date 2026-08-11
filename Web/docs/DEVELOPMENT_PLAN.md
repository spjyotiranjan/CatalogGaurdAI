# Web development plan index

The Web track is intentionally split into two coordinated plans:

| Plan | Owns | Does not own |
| --- | --- | --- |
| [UI development plan](UI_DEVELOPMENT_PLAN.md) | Next.js screens, layouts, components, client state, form interaction, accessibility, visual quality, and user-visible loading/error states. | Authentication authority, persistence, authorization, workflow transitions, or validation outcomes. |
| [Backend development plan](BACKEND_DEVELOPMENT_PLAN.md) | Next.js BFF routes/actions, Auth.js, RBAC, MongoDB, storage coordination, job dispatch/callback application, workflow, readiness, audit, read models, and exports. | FastAPI parsing/rules, LangGraph, model prompts, or AI provider calls. |

The UI may use mocked contract fixtures while the backend is being built, but it must replace them with typed backend contracts before a slice is considered complete. The backend must not merge a UI feature without its required UI states and accessibility acceptance criteria.

## Coordination milestones

| Milestone | UI plan | Backend plan | Shared proof |
| --- | --- | --- | --- |
| M1: Secure foundation | UI phase 1 | Backend phase 1 | Role-aware shell, sign-in/error states, protected-route behavior. |
| M2: Feed intake | UI phase 2 | Backend phase 2 | Seller completes a CSV submission and sees persisted processing status. |
| M3: Catalog correction | UI phase 3 | Backend phase 3 | Versioned product data and issues render correctly; stale correction conflicts visibly. |
| M4: Human review | UI phase 4 | Backend phase 4 | Reviewer sees evidence and makes a safe, audited decision. |
| M5: Operations | UI phase 5 | Backend phase 5 | Role-specific dashboards and lists use real scoped read models. |
| M6: Release | UI phase 6 | Backend phase 6 | Full workflow, security, accessibility, performance, and recovery gates pass. |

## Orchestration flow dependencies

This map mirrors the `Web dependencies` section in the [Orchestration development plan](../../Orchestration/docs/DEVELOPMENT_PLAN.md). It identifies when each Web milestone needs an Orchestration capability or must provide a prerequisite for it. It does not change ownership: Web remains the authenticated BFF and canonical-data owner; Orchestration only validates granted private sources and returns signed results.

| Web milestone | Orchestration phase | Dependency required for the flow | Required handoff and proof |
| --- | --- | --- | --- |
| M1: Secure foundation | Phase 1 - FastAPI foundation and trusted contract | Establish the secure boundary before any feed is dispatched. | Web provides service credentials, the versioned callback schema, and a fake private-storage seam; Orchestration accepts only authenticated, schema-valid job fixtures and signs a fixture result that Web can verify. |
| M2: Feed intake | Phase 2 - Streaming ingestion, mapping, and normalization | Process a persisted CSV after Web has accepted it safely. | Web persists feed metadata, checksum, mapping configuration, and a private scoped object reference before dispatch; Orchestration reads only that grant, normalizes bounded CSV batches, and returns safe row-level outcomes. |
| M3: Catalog correction | Phase 3 - Deterministic rule engine and validation result | Turn normalized records into deterministic validation evidence that Web can apply to canonical versions and issues. | Orchestration returns versioned rule findings and validated result data; Web applies results atomically and idempotently, then exposes product/version/issue data needed for correction. |
| M4: Human review | Phase 4 - Reliable workers and Web callback handoff | Deliver durable, resumable validation completions before users act on review evidence. | Web supplies durable outbox dispatch, callback idempotency, and persisted feed-progress read models; Orchestration supplies checkpointed execution, signed retryable callbacks, and safe redelivery. |
| M5: Operations | Phase 5 - Controlled AI advisory runtime | Add bounded AI advisory evidence to the existing deterministic and human-review flow. | Orchestration returns only schema-valid advisory data or a safe deterministic-only fallback; Web presents AI analysis separately from deterministic issues and never grants it approval authority. |
| M6: Release | Phase 6 - Hardening, observability, and release | Prove the full cross-service flow is production-ready. | Both services run the upload-to-readiness E2E suite in a production-like environment, share correlation-ID telemetry, and verify operational dashboards, alerts, recovery, and contract compatibility. |

## Authentication and authorization handoff

Authentication and authorization are established by the backend in phase 1 and remain mandatory for every later phase. UI renders the resulting session, role, scope, capability, and failure states, but never evaluates or enforces authority itself.

| Milestone | UI responsibility | Backend responsibility | Joint proof |
| --- | --- | --- | --- |
| M1: Secure foundation | Present sign-in, session, role-aware navigation, and access-failure states from typed BFF data. | Authenticate sessions; derive roles and seller scope; enforce RBAC and tenant isolation. | Unauthenticated, disabled-user, role-denied, and allowed routes have the correct server result and UI state. |
| M2: Feed intake | Present only server-confirmed seller scope and permitted feed actions. | Authorize every feed/upload/download/dispatch action using the verified seller scope. | A seller cannot access or act on another seller's feed, including through direct navigation. |
| M3: Catalog correction | Render scoped catalog evidence and BFF-provided correction/export capabilities. | Authorize catalog, correction, revalidation, and export operations at route and service boundaries. | Cross-seller reads and mutations are rejected while the UI shows a safe access state. |
| M4: Human review | Present reviewer evidence, reauthentication, and unavailable-decision states. | Require active reviewer/admin authority and re-check it before issue, decision, waiver, and readiness actions. | Ineligible users cannot decide or waive, even if they invoke a route directly. |
| M5: Operations | Render role-specific operational views and direct-route failure states. | Enforce role/scope rules for dashboards, administration, audit, and exports. | Every privileged route is safe for both hidden-control and direct-URL attempts. |
| M6: Release | Verify the user-visible behavior for all authentication and authorization failures. | Run session, CSRF, disabled-user, RBAC, tenant-isolation, and secret-rotation checks. | End-to-end tests prove authorization is server-enforced and communicated accessibly. |

## Working rules

- Start a milestone with its typed request/response schema, screen-state contract, and acceptance tests agreed by both tracks.
- UI must contain UI/UX behavior only: it must never derive or enforce authority from hidden/visible controls, invoke backend/domain logic, invent processing progress, or optimistically confirm an irreversible mutation.
- Backend must return field-addressable errors, stable status/error codes, correlation IDs, and only data the current role may see.
- Changes to a shared payload or workflow are cross-track changes. Update the architecture decision and contract before implementation.
- A milestone is complete only when the corresponding phases in both plans meet their exit criteria and the integration proof above passes.
