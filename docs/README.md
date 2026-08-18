# CatalogGuard AI development documentation

CatalogGuard AI prevents flawed seller catalog data from reaching customers. Sellers upload feeds, deterministic validation runs first, AI adds bounded advisory findings only where semantics are ambiguous, and human reviewers control approval.

## Documentation map

| Area | Start here | Purpose |
| --- | --- | --- |
| Whole project | [AGENTS.md](AGENTS.md) | Instructions that apply to every AI-assisted change. |
| Architecture decisions | [ARCHITECTURE_DECISIONS.md](ARCHITECTURE_DECISIONS.md) | Service ownership, contracts, source conflicts, and non-negotiable decisions. |
| Web | [Web/AGENTS.md](../Web/docs/AGENTS.md) | Next.js application and normal backend guidance. |
| Web coordination | [Web/DEVELOPMENT_PLAN.md](../Web/docs/DEVELOPMENT_PLAN.md) | UI/backend ownership, milestones, and shared completion criteria. |
| Web UI delivery | [Web/UI_DEVELOPMENT_PLAN.md](../Web/docs/UI_DEVELOPMENT_PLAN.md) | Six delivery phases for screens, components, accessibility, and visual quality. |
| Web backend delivery | [Web/BACKEND_DEVELOPMENT_PLAN.md](../Web/docs/BACKEND_DEVELOPMENT_PLAN.md) | Six delivery phases for the Next.js BFF and canonical application backend. |
| Web build guide | [Web/IMPLEMENTATION_GUIDE.md](../Web/docs/IMPLEMENTATION_GUIDE.md) | Routes, UX rules, API surface, persistence responsibilities, and tests. |
| Orchestration | [Orchestration/AGENTS.md](../Orchestration/docs/AGENTS.md) | FastAPI-first validation and AI-orchestration guidance. |
| Orchestration delivery | [Orchestration/DEVELOPMENT_PLAN.md](../Orchestration/docs/DEVELOPMENT_PLAN.md) | Six delivery phases for validation and AI work. |
| Orchestration build guide | [Orchestration/IMPLEMENTATION_GUIDE.md](../Orchestration/docs/IMPLEMENTATION_GUIDE.md) | Job protocol, rule engine, AI boundary, callback contract, and tests. |

## Product boundary

`Web/` is the Next.js and TypeScript product application. It includes the normal backend-for-frontend: Auth.js, role and tenant checks, MongoDB domain persistence, private-file coordination, seller corrections, reviews, customer-readiness evaluation, audit events, dashboards, and the internal completion callback.

`Orchestration/` is not a general application backend. It begins with FastAPI for feed parsing, normalization, deterministic validation, job execution, and validation-result validation. Its later AI phase adds an internal Node runtime only because the approved design specifies LangGraph and LangChainJS. That runtime cannot access web routes, approve products, or write canonical catalog data.

## Source material and precedence

The following inputs were reviewed to create these plans:

1. [CatalogGuard_AI_Backend_Rules.pdf](../CatalogGuard_AI_Backend_Rules.pdf) - mandatory runtime, security, workflow, reliability, and testing invariants.
2. [CatalogGuard_AI_Entity_Details.xlsx](../CatalogGuard_AI_Entity_Details.xlsx) - baseline entity fields, relationships, and data constraints.
3. [CatalogGuard_AI_Implementation_Design.pdf](../CatalogGuard_AI_Implementation_Design.pdf) - desktop information architecture, UX states, and interaction constraints.
4. [CatalogGuard_AI_PRD.pdf](../CatalogGuard_AI_PRD.pdf) - MVP goals, user outcomes, delivery scope, and success criteria.

When sources differ, an explicit decision in [ARCHITECTURE_DECISIONS.md](ARCHITECTURE_DECISIONS.md) wins. Do not resolve a conflict by silently changing code or schemas.

## Definition of an MVP slice

A slice is complete only when its happy path and failure path work across the service boundary; authorization and tenant isolation have tests; mutations are idempotent and audited; observability carries the same correlation ID; and the relevant exit criteria in both development plans are met.
