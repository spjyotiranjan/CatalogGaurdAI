# Web UI development plan

This plan covers the Next.js user interface only: pages, layouts, components, client-side interaction, accessible feedback, and visual quality. It relies on typed BFF contracts from the backend plan and must not put business authority in the browser.

## UI-only boundary

Every phase in this document is limited to UI/UX work. Do not add route handlers, server actions, repositories, database or storage access, session validation, RBAC checks, tenant-scope derivation, workflow transitions, audit writes, or other backend/domain logic here. The backend plan owns authentication and authorization enforcement. UI may consume typed, server-confirmed session, role, scope, capability, and error-state data only to render the correct experience; it must never treat displayed navigation, a hidden control, client state, or a browser-supplied identifier as an authorization decision.

## Required design reference

Before implementing or changing a user-facing route, consult the approved [Implementation Design](../../CatalogGuard_AI_Implementation_Design.pdf). It is the intended reference for desktop composition, role navigation, page hierarchy, screen states, processing timelines, evidence separation, and interaction expectations. Use the [PRD](../../CatalogGuard_AI_PRD.pdf) for MVP user goals, roles, dashboard scope, and intentionally excluded features. When a screen displays or edits a defined entity, validate its fields and relationships against the [Entity Details workbook](../../CatalogGuard_AI_Entity_Details.xlsx). The implementation guide and this plan define engineering constraints; the design document defines the intended experience. When sources conflict, stop and record a decision rather than silently deviating.

## Phase 1 - Application shell and access experience

**Goal:** Establish the desktop-first visual system and the public/protected screen states.

- Build the shared 1440 x 1024 desktop canvas: 244 px role navigation rail, 72 px top bar, 8 px spacing grid, 12 px panel radius, and 44 px controls. Preserve usability from 1280 px upward.
- Create the shared component family: app shell, role navigation, page header, buttons, form controls, metric card, status badge, alert, empty state, error state, skeleton, modal, and toast/live-region primitives.
- Implement sign-in, reset-password request, profile, access denied, session expired, route not found, and recoverable system-error views.
- Render navigation from server-confirmed role data. Provide loading and unauthorized states for every protected route.
- Render only the typed session, role, and capability states supplied by the BFF; authentication and authorization decisions remain outside UI components.
- Establish component stories/tests for keyboard operation, focus visibility, labels, semantic headings, and status text-plus-color treatment.

**Exit criteria:** The shared shell and public/protected states visually match the supplied design direction, have keyboard coverage, and do not infer authorization from client state.

## Sub Phase 1.5 - Access-request and administrator portal UI

**Goal:** Give prospective sellers and reviewers a safe application path, and give administrators a clear, protected request-review workspace.

- On the normal `/login` screen, provide distinct **Join as seller** and **Join as reviewer** actions that open the matching proposal form. Keep the administrator portal as a separate login presentation, with administrator-specific copy and a route back to the normal access-request actions.
- Submit proposals through the typed access-request contract. Map server field errors to the exact form controls, retain entered non-sensitive details after validation failure, label unavailable password-reset functionality honestly, and never display raw server/internal errors.
- After a successful proposal, close and reset the modal and announce the result through the shared toast/live region. The form submit action must remain clearly visible and usable in a long modal.
- Build `/admin/access-requests` from server-confirmed data only. Its protected-route state must direct an unauthenticated visitor to the administrator login context; a non-administrator receives the normal safe access-denied behavior.
- Let administrators approve or revoke pending proposals with an optional note. Show pending, approved, and revoked status distinctly; wait for the server response before changing a card; and show operation-specific success/error feedback.
- Let an administrator dismiss an approved or revoked request from their own view. Remove it only after server confirmation and explain that dismissal does not delete the request or audit history.
- Provide keyboard-accessible modal, focus, loading, empty, authorization-failure, and recoverable error states. UI affordances are never the authorization boundary.

**Exit criteria:** A prospective seller or reviewer can submit a proposal and understand that access is pending; an authenticated administrator can review, approve, revoke, or dismiss the appropriate records; field and operation errors are clear; and all authority remains server-enforced.

## Phase 2 - Seller feed-intake experience

**Goal:** Make feed submission understandable, safe, and transparent.

- Build seller dashboard, upload-feed, feed-history, and feed-detail screens from typed screen-state fixtures and backend-owned contracts; queries, uploads, and mutations are outside this UI plan.
- Implement file selection/drop zone, local preflight feedback, selected-file summary, seller/feed-type/currency/timezone configuration, and explicit submit confirmation state.
- Render backend-derived processing timeline, checksum/source-integrity information, status, counts, correlation ID, authorized download action, and next permitted action.
- Provide loading, rejected-file, duplicate-upload, submission-error, polling/reconnect, partial-result, and completed states. Do not simulate progress with timers.
- Present only server-confirmed seller scope, session-expiry, access-denied, and permitted-action states; never select a seller or enable a restricted action from browser state.
- Make status/issue summaries screen-reader visible and retain context when moving from history to detail or corrections.

**Exit criteria:** A seller can see the exact accepted/rejected state of an upload and navigate from a feed outcome to the permitted next action without ambiguous or fabricated progress.

### Phase 2 completion record - 2026-08-18

**Status:** Complete.

- Added protected seller upload, feed-history, and feed-detail screens using real typed API contracts rather than fixtures.
- Upload presents CSV selection and server-confirmed errors; history/detail render persisted status, integrity checksum, counts, timeline, download permission, empty/error states, and next action.
- Active feed detail polls the backend read model only; browser timers never simulate processing completion.

## Phase 3 - Seller catalog and correction workspace

**Goal:** Present versioned catalog evidence and let sellers prepare safe corrections.

- Depend on the Phase 3 bounded deterministic-result handoff; do not show catalog evidence or correction affordances for feeds that have not received a server-confirmed completed result.
- Build seller product catalog controls for search, filters, pagination, status badges, issue counts, and export-request affordance using typed screen-state contracts.
- Build product detail/correction workspace with distinct original source, normalized canonical value, issue evidence, and proposed correction sections.
- Implement accessible field validation, blocking-error summary, draft-saving feedback, save-and-revalidate confirmation, unsaved-change warning, and stale-version conflict recovery.
- Clearly label deterministic issues separately from AI advisory suggestions; AI confidence/evidence must never look like an automated correction or approval.
- Render products, fields, and available correction/export actions only from BFF-provided scope and capability data; UI controls are not an authorization boundary.
- Preserve filter, sort, page, and selected-product context in safe URLs where appropriate.

**Exit criteria:** Corrections are visually version-aware, field errors map to their controls, a stale save has a clear reload path, and source evidence cannot be mistaken for editable canonical data.

## Phase 4 - Reviewer decision workspace

**Goal:** Give reviewers enough evidence to make an explicit human decision.

- Build reviewer dashboard, priority queue, validation-issue workspace, reviewer catalog context, and reviewer feed-history screens.
- Present backend-supplied queue ordering, severity/risk, age, seller context, and stable filters; show an explanatory empty queue state.
- Build review detail with product version, canonical fields, deterministic findings, AI advisory panel, issue lifecycle controls, decision notes, and approve/reject/request-changes actions in separate sections.
- Handle disabled actions, reauthentication prompt, version conflict, unresolved blockers, decision success, next eligible record, and recoverable error states.
- Render reviewer capabilities and authorization failures from server responses; hiding or disabling a decision control must never stand in for server-side reviewer/admin authorization.
- Ensure decision controls are keyboard usable, do not use color alone, and never show approval as completed until the server confirms it.

**Exit criteria:** Reviewers can distinguish evidence from authority, understand why a decision is unavailable, and recover safely from stale or failed submissions.

## Phase 5 - Administrator and operational UI

**Goal:** Complete the designed role-specific operational experience.

- Build administrator dashboard, feeds, products, sellers, users, categories, validation-rules, audit-log, and profile screens.
- Implement dense but readable table controls, filter/sort/pagination interaction, scoped export feedback, audit detail, and explicit confirmation/reason capture for privileged mutations.
- Build seller, reviewer, and administrator dashboards with metric cards, charts, action lists, processing timelines, and operational notes from typed backend read-model contracts.
- Finish shared loading, empty, stale, partial-error, authorization-failure, and system-error treatments across every designed route.
- Render privileged navigation and actions from server-confirmed capabilities, while retaining direct-route access-denied and expired-session experiences for every role.
- Validate navigation/route coverage against the implementation design and record any intentionally deferred page or interaction.

**Exit criteria:** Every designed desktop route has an accessible implementation or an explicit scope note; all operational views are role-aware and render server-authoritative data.

## Phase 6 - UI quality, accessibility, and release verification

**Goal:** Make the experience reliable under real data, latency, and failure conditions.

- Run visual regression checks against the supplied desktop reference at 1440 px and usability checks at 1280 px and above.
- Perform keyboard-only, screen-reader, focus-order, contrast, live-region, reduced-motion, dialog, and error-recovery testing on core flows.
- Test slow loading, empty data, expired session, rate limit, field error, callback delay, AI-unavailable, conflict, and safe retry experiences.
- Test the UI states returned for unauthenticated, disabled-user, role-denied, and cross-seller/cross-role requests against the backend contract; do not create client-only access rules.
- Remove fixture-only behavior, verify error-code-to-copy mapping, and ensure all irreversible mutations wait for server confirmation.
- Execute end-to-end UI coverage for sign-in -> upload -> feed result -> correction -> revalidation -> review -> readiness.

**Exit criteria:** Core journeys are accessible and visually consistent, no mock state remains on a release path, and UI E2E tests prove clear behavior for success, failure, and recovery.
