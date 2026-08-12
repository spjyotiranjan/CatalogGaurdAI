# CatalogGuard AI agent instructions

## Read before changing anything

1. Read [ARCHITECTURE_DECISIONS.md](ARCHITECTURE_DECISIONS.md).
2. Read the `docs/AGENTS.md` for the area you will change.
3. Read the matching implementation guide and only the phase currently being implemented.
4. If a change crosses `Web/` and `Orchestration/`, update the shared contract documentation before changing either implementation.

The backend rules are mandatory constraints, not optional implementation ideas. Preserve their rule IDs in code comments, test names, telemetry, or documentation where that improves traceability.

## System-wide invariants

- Server-side code derives role and seller scope from verified identity. Never trust a role, `sellerId`, workflow status, or actor identity from a browser or seller payload.
- Raw source rows and original files are immutable evidence. Corrections create a new canonical product version; they do not rewrite source evidence.
- Deterministic validation executes before AI analysis. AI is advisory, schema-validated, and never approves, publishes, changes taxonomy, or directly mutates an approved product.
- Every state-changing operation needs an idempotency boundary, explicit actor, correlation ID, audit event, and safe failure behavior.
- Use Decimal128 or another decimal-safe representation for money, UTC for stored timestamps, and integer validation for inventory.
- The customer-readiness gate is the only operation that can mark a product ready for customer use.
- Logs, browser errors, API responses, and audit snapshots must not leak credentials, tokens, internal prompts, private storage locations, or full sensitive feed payloads.

## Ownership and communication

| Concern | Owner | Other service may do |
| --- | --- | --- |
| Sessions, RBAC, tenant isolation, canonical MongoDB data, reviews, readiness, audit | Web | Consume a signed, schema-valid validation result. |
| Parsing, normalization, deterministic rules, validation-job checkpoints, AI-result validation | Orchestration | Return a signed result; retain only operational state allowed by its guide. |
| Model calls and LangGraph flow | Internal AI runtime under Orchestration | Produce constrained advisory output only. |

No service may bypass this table for convenience. A new cross-service write path requires an architecture decision and contract version.

## Delivery habits for AI-assisted work

- Make small vertical slices. Do not scaffold a broad feature surface without a validated contract and acceptance criteria.
- Use typed request and response schemas at every boundary. Reject unknown fields for external and internal HTTP messages unless a documented extension mechanism exists.
- Prefer a dedicated domain service over route-handler logic and a repository over direct collection access.
- Add tests with the change. Include authorization, tenant-boundary, idempotency, stale-version, and failure-path tests for every mutation when applicable.
- Run the focused checks first, then the service suite and an end-to-end handoff test for boundary changes. Report commands run and any unverified risk in the handoff.
- Keep secrets in validated environment configuration. Never add credentials, copied production payloads, or provider prompts to the repository.
- Update [README.md](README.md) in the same phase whenever prerequisites, setup commands, environment-file conventions, ports, migrations, service ownership, API documentation locations, supported workflows, or current phase boundaries change.

## Stop and update the design when

- a source document conflicts with an existing decision;
- a request needs a new workflow state, product status, role, entity, or public API field;
- a service needs direct access to data owned by the other service;
- an AI result would affect approval, readiness, taxonomy activation, or a seller account;
- a change would accept a new upload format, expose a private object, or relax a rule or severity.

Add or amend an entry in `ARCHITECTURE_DECISIONS.md`, then update any affected plan and contract before implementation.
