# Web agent instructions

## Scope

This directory owns the desktop-first Next.js and TypeScript application and its normal backend-for-frontend. It is responsible for:

- sign-in, session handling, RBAC, tenant isolation, and profile security;
- private upload coordination and feed lifecycle UI;
- canonical MongoDB persistence for the entities in the supplied workbook;
- seller catalog browsing, versioned corrections, revalidation requests, and reports;
- reviewer queues, decisions, readiness evaluation, and audit events;
- administrator seller, user, taxonomy, validation-rule, and audit surfaces;
- dashboard read models, server-side exports, and user-facing error states;
- reliable handoff to and signed callback receipt from FastAPI Orchestration.

Do not put parsing, deterministic validation rules, LangGraph, provider prompts, or model calls here. Call the versioned Orchestration contract instead.

## Required reading and implementation order

Read the root [AGENTS.md](../../docs/AGENTS.md), [ARCHITECTURE_DECISIONS.md](../../docs/ARCHITECTURE_DECISIONS.md), and [IMPLEMENTATION_GUIDE.md](IMPLEMENTATION_GUIDE.md) before implementation. Use [DEVELOPMENT_PLAN.md](DEVELOPMENT_PLAN.md) to coordinate work, then follow the relevant [UI development plan](UI_DEVELOPMENT_PLAN.md) or [backend development plan](BACKEND_DEVELOPMENT_PLAN.md). For all UI or user-facing behavior, refer to the approved [Implementation Design](../../CatalogGuard_AI_Implementation_Design.pdf) as the intended reference for screen composition, route behavior, semantic states, and interactions. Do not start review, approval, or dashboard work before the required persistence, upload, and workflow foundations exist.

## Source reference routing

Read the source material that governs the slice being changed. Do not infer missing behavior from a different scope.

| Work being changed | Required source reference |
| --- | --- |
| Screen layout, navigation, component behavior, loading/empty/error states, accessibility treatment | [Implementation Design](../../CatalogGuard_AI_Implementation_Design.pdf) and [PRD](../../CatalogGuard_AI_PRD.pdf). |
| UI fields, product/issue/review labels, and role-specific data presentation | [Entity Details](../../CatalogGuard_AI_Entity_Details.xlsx), plus the Implementation Design. |
| Auth, RBAC, tenant isolation, uploads, BFF mutations, callbacks, audit, workflow, readiness, exports, security, or release work | [Backend Rules](../../CatalogGuard_AI_Backend_Rules.pdf), [Entity Details](../../CatalogGuard_AI_Entity_Details.xlsx), and the PRD scope. |
| FastAPI validation, rule execution, LangGraph, or model calls | Do not implement in Web. Follow the Orchestration documentation and shared contract instead. |

## Application structure

Use a feature-oriented layout. Keep route handlers thin, domain behavior explicit, and database access isolated.

```text
app/                         App Router pages, layouts, route handlers
features/<feature>/          UI, server actions, queries, feature schemas
components/                  Shared accessible UI components and page chrome
lib/auth/                    Auth.js configuration and session helpers
lib/contracts/               Zod schemas, error shape, service contracts
server/services/             Domain services and workflow/readiness services
server/repositories/         MongoDB/Mongoose repositories only
server/models/               Entity schemas, indexes, migrations support
server/integrations/         Storage, Orchestration client, telemetry
tests/                       Unit, integration, contract, and E2E tests
```

Adapt names to the repository if one is already established, but keep the same dependency direction: route or action -> service -> repository/integration. A repository must not call a route, a component must not query MongoDB directly, and a page must not decide authorization from client state.

## Server and data rules

- Derive `actorUserId`, role, and seller scope from the verified server session. `ADMIN` and `CATALOG_REVIEWER` normally have no seller scope; `SELLER_OPERATOR` must have one.
- Check authorization in both the route/action boundary and the domain service. Seller-bound repository queries must include the trusted `sellerId`.
- Use Zod for browser/API schemas and reject unknown fields. Define stable client-safe error codes with `correlationId`; never expose stack traces, private object references, prompts, or passwords.
- Only repositories access MongoDB collections. Use projections, pagination, indexed stable ordering, bounded bulk operations, and MongoDB transactions whenever multiple related collections change together.
- Preserve `rawPayload` and the original object. Product correction creates a new canonical version with optimistic concurrency; never edit raw evidence in place.
- Store money as Decimal128, stored timestamps as UTC, stock/reserved quantities as non-negative integers, and calculate `availableQuantity` server-side.
- Treat `catalogStatus` as derived. Only the workflow service may move `workflowStatus`; clients never submit a target state.
- Write business audit events in the same transaction as the mutation. Respect the USER/SYSTEM/AI actor-field combinations in the backend rules.

## Internal Orchestration boundary

1. Persist the feed, immutable storage metadata, checksum, and dispatch/outbox record before publishing a job.
2. Dispatch a typed `ValidationJobRequest v1` with service authentication, correlation ID, and idempotency key.
3. Do not invent processing progress. Render only persisted updates or bounded polling/streaming updates from the backend.
4. Accept the result only through the protected callback. Verify authentication/signature, replay protection, dispatch identity, contract version, and schema before application.
5. Apply a result idempotently. Atomically persist the feed outcome, product/version data, issues, AI-history copy, workflow effects, and audit events; otherwise leave no partial canonical records.

## UX and accessibility rules

- Build the supplied desktop design faithfully: a 1440 x 1024 reference canvas, 244 px navigation rail, 72 px top bar, 8 px spacing grid, 12 px panel radius, and 44 px form controls. Keep desktop layouts usable from 1280 px upward; mobile requires a separate design decision.
- Navigation visibility improves usability only. Every screen, loader, and mutation must still get a server-side role and tenant check.
- Create shared components for navigation, page headers, metric cards, processing timeline, filter bar, data table, status badge, issue row, advisory panel, empty state, error state, and decision bar. States have different semantics: purple action, teal AI advisory, blue system, green readiness, amber warning, red blocker.
- Every data region needs loading, loaded, empty, partial-error, stale, authorization-failure, and recoverable-error behavior. Use structure-matching skeletons. Never show a zero count while data is loading.
- Show server field errors at the affected field and blocking errors at the action boundary. Preserve source, normalized, and corrected values as distinct concepts.
- Use visible focus, semantic headings, labels, accessible names for icon-only controls, text plus color for statuses, live regions for asynchronous progress/results, and confirmation dialogs for destructive actions.
- Do not use optimistic updates for feed submission, corrections, review decisions, access changes, or taxonomy changes. Optimism is restricted to reversible local preferences.

## Tests required with a change

| Change | Minimum proof |
| --- | --- |
| Protected page or endpoint | unauthenticated, disabled-user, role-denied, and allowed-path tests. |
| Seller data read/mutation | cross-seller access denial and trusted-scope query test. |
| Upload or callback | schema, signature/replay, duplicate/idempotency, and partial-failure tests. |
| Correction or decision | stale-version conflict, workflow transition, audit, and transaction rollback tests. |
| Listing/dashboard/export | pagination/order, filter scope, projection, and no-data/error-state tests. |
| Shared component | keyboard/accessibility state and semantic-status tests. |

## Completion checklist

Before handing off a Web change, verify the matching UI or backend plan acceptance criteria, run type/lint/test checks supplied by the repository, and state any skipped validation. A cross-service change also requires the Orchestration contract test and a documented compatibility check.
