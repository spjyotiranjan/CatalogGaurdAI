# Orchestration agent instructions

## Scope

This directory owns validation and AI-orchestration features only. Its first deliverable is FastAPI for authenticated job intake, controlled source reading, streaming parsing, normalization, deterministic rules, checkpointed background execution, result validation, and signed callbacks. A small internal Node runtime is introduced only in the later AI phase because the approved design calls for LangGraph and LangChainJS.

This directory does not own user sessions, browser endpoints, seller management, MongoDB canonical product persistence, reviewer decisions, approval, category activation, or customer-readiness mutation. Those are Web responsibilities.

## Read before changing anything

Read root [AGENTS.md](../../docs/AGENTS.md), [ARCHITECTURE_DECISIONS.md](../../docs/ARCHITECTURE_DECISIONS.md), and [IMPLEMENTATION_GUIDE.md](IMPLEMENTATION_GUIDE.md). Work in phase order from [DEVELOPMENT_PLAN.md](DEVELOPMENT_PLAN.md). Update the shared contract before making a breaking or additive boundary change.

## Source reference routing

| Work being changed | Required source reference |
| --- | --- |
| Job security, queue/worker behavior, parsing/normalization, deterministic validation, AI safeguards, issue lifecycle, reliability, observability, testing, and deployment | [Backend Rules](../../CatalogGuard_AI_Backend_Rules.pdf). |
| Feed/product/category/issue/AI-analysis fields, constraints, and relationships carried in a contract or result | [Entity Details workbook](../../CatalogGuard_AI_Entity_Details.xlsx). |
| MVP validation goals, AI category-check purpose, user roles, scale target, and intentionally excluded AI features | [PRD](../../CatalogGuard_AI_PRD.pdf). |
| A new result/status/advisory field that will be displayed to users | Coordinate with Web and consult the [Implementation Design](../../CatalogGuard_AI_Implementation_Design.pdf) for the intended evidence and state presentation. |

The Backend Rules are mandatory for every Orchestration change. Do not substitute a model-provider convention or framework default for a documented rule.

## Target structure

```text
fastapi/
  app/api/                 Internal job/status/callback-facing routes only
  app/contracts/           Pydantic v2 request, result, error, and signature schemas
  app/services/            Job, parsing, normalization, validation, AI-result services
  app/rules/               Versioned deterministic rules and registry
  app/workers/             Queue consumers, checkpoints, retries, dead-letter handling
  app/repositories/        Operational job/checkpoint persistence only
  app/integrations/        Private storage, Web callback, telemetry, AI runtime client
  tests/                   Unit, integration, contract, and workflow tests
ai-runtime/                Later-phase private Node LangGraph/LangChainJS service
contracts/                 Versioned shared JSON schema/generated artifacts where useful
```

Keep FastAPI route handlers thin: authenticate the service, validate schemas, pass explicit execution context to a service, and format a safe response. Rules/services do not read mutable global request state. Repository modules are the only code that accesses an Orchestration-owned store.

## Mandatory execution rules

- Receive `correlationId`, `jobId`, idempotency key, and SYSTEM actor identity from trusted job metadata. Propagate them unchanged through the worker, AI runtime, callback, telemetry, and audit-relevant result metadata.
- Authenticate calls from Web and authenticate/sign callbacks back to Web. Reject stale/replayed or unsupported contract messages. Never accept browser traffic as a substitute for service authentication.
- Make job execution idempotent. Persist/check a stable key, commit checkpointed work before acknowledgement, use bounded exponential backoff, and expose terminal failure or cancellation. Retrying must resume a safe checkpoint rather than reset completed work.
- Read large sources as streams or bounded batches. Preserve row number and raw source representation as needed for the result, but never normalize over raw evidence. Treat malformed rows independently unless the file itself is unreadable.
- Normalize whitespace, casing, identifiers, currencies, decimal/date formats, and units consistently. Never treat `0` or `false` as missing. Record the mapping version.
- Run deterministic rules before AI. Rules are deterministic for the same normalized input and rule-set version, use stable rule IDs, and create structured findings containing field path, severity, message, detected value, and expected/suggested value when appropriate.
- Never let an LLM approve, reject, publish, make a product ready, activate a category, mutate a seller, or directly write canonical product data. AI output is advisory evidence only.
- Validate all AI output twice: strict structured schema plus taxonomy/allow-list and business constraints. Schema-invalid or timed-out output falls back cleanly without blocking deterministic results.
- Use UTC timestamps, decimal-safe values, timeouts on external calls, controlled concurrency, and structured safe logs.

## Rule and AI conventions

- Put every deterministic rule in a versioned registry with a stable `ruleId`, semantic version, severity, applicability criteria, and examples/fixtures.
- Do not use AI for required fields, types, ranges, arithmetic, price comparisons, inventory rules, duplicate SKU checks, or active-category checks. Those belong to deterministic validation.
- Eligible AI records require meaningful sanitized title/description/category context and an active, assignable taxonomy context. Low confidence is a review suggestion, never an automatic correction.
- Store in result metadata the provider, model, prompt version, sanitized input snapshot hash/reference, output, confidence, latency, usage/cost when available, and safe failure reason. Never return prompt text or provider internals to Web users.

## Security, privacy, and reliability

- Allow only the private object reference granted by the job. Do not fetch seller-provided URLs or expose storage locations.
- Enforce source file type/size constraints and parser defenses. CSV is phase-one support; XLSX/JSON remain disabled until explicitly enabled by a documented feature flag.
- Do not log secrets, tokens, credentials, full raw feed rows, prompts, or unredacted provider errors. Sanitize callback failures.
- Bound batch sizes, worker concurrency, AI concurrency, retries, callback retries, job age, and per-seller concurrency to protect MongoDB, storage, and the model provider.
- Emit metrics for job duration, rows, rejected rows, checkpoint age, queue depth, retries, dead letters, rules/findings, AI latency/failure/usage/cost, callback status, and safe error code.

## Required tests

| Change | Minimum proof |
| --- | --- |
| Contract | Pydantic/JSON schema acceptance and unknown-field rejection; service-auth/signature/replay tests. |
| Parser/normalizer | stream/batch behavior, source row number, zero/false, malformed rows, ambiguous decimal/date, mapping version. |
| Rule | deterministic fixtures, stable ID/version, field/severity output, duplicate-open-finding behavior. |
| Job worker | repeat execution, checkpoint resume, bounded retry, cancellation, dead-letter, acknowledgement after commit. |
| AI integration | saved structured-response contract tests, malformed/timeout/low-confidence fallback, no direct mutation capability. |
| Callback | correct signature, idempotent delivery, retry classification, Web rejection handling without dropped terminal outcome. |

## Done means

Run focused unit and integration tests, the contract suite against Web schemas, and a full worker handoff test for boundary changes. Include a failure-path test. State the actual commands run, changed contract version, and any unverified operational assumption in the handoff.
