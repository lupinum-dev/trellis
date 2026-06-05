# Sprint Plan: Adoption Contract and Executable Trust

## Product Owner Decision

Approve the direction, but do not run this as a docs-only sprint.

The feedback is directionally useful, but the safest read is: Trellis already has
a strong architecture thesis, and the next risk is adoption fear caused by
surface area, taxonomy drift, and proof gaps. Adding many new docs would make
that worse if the CLI, starters, ADRs, examples, doctor output, and docs still
describe slightly different products.

This sprint should ratify and prove one product contract:

> Trellis is the opinionated Nuxt + Convex framework for apps that need one
> backend authorization model across browser UI, server routes, webhooks, and
> MCP agents. Start with the smallest lane that matches the product. Add auth,
> workspace, and MCP only when those requirements are real.

## Sprint Goal

A new evaluator can decide whether Trellis fits, choose the smallest correct
starting lane, generate a project, run doctor/tests, and understand how risky
auth, workspace, server, webhook, and MCP surfaces are verified.

This should be true without reading ADRs first and without accidentally treating
MCP, service forwarding, `actingFor`, `crossTenant`, `publicWrite`, or `unsafe`
as day-one concepts.

## Non-Goals

- Do not add new framework abstractions.
- Do not make Trellis stack-neutral.
- Do not expand CMS positioning unless there is a maintained first-class CMS
  starter and example.
- Do not create many overlapping docs that repeat the same positioning.
- Do not add compatibility shims or dual paths for unreleased starter taxonomy.
- Do not make MCP look like the normal first evaluation path.
- Do not claim security maturity from prose alone; tie claims to tests, doctor,
  lint, fixtures, or explicit manual review.

## Working Principles

- Prefer one adoption contract over parallel explanations.
- Prefer generated/project checks over reassuring documentation.
- Keep public apps free of auth, workspace, permissions, and MCP vocabulary.
- Keep personal apps about signed-in identity, not tenant roles.
- Keep workspace apps about tenant isolation, roles, permissions, and `_can`
  projection.
- Keep MCP advanced and workspace-based unless agent access is a real product
  requirement.
- Every escape hatch must have a safer default, a required reason, and a required
  verification path.

## Official Adoption Lanes

Ratify these lanes unless implementation review finds a stronger reason to
choose a different taxonomy.

| Lane | Purpose | Concepts present | Concepts intentionally absent |
| --- | --- | --- | --- |
| `public` | Public Nuxt + Convex app with SSR/live queries and simple mutations. | Nuxt module, Convex helpers, shared contracts, public query/mutation lanes. | Better Auth, app identity, workspaces, permissions, MCP, destructive confirmation. |
| `personal` | Signed-in user app without tenant/workspace roles. | Better Auth, app-owned user identity, authenticated query/mutation lanes. | Workspace roles, tenant isolation, `_can`, MCP, service forwarding. |
| `workspace` | SaaS/workspace baseline with tenant boundaries and backend-owned permissions. | appIdentity, workspace membership, roles, guards, tenant indexes, `_can`, protected handlers. | MCP by default, agent sessions, MCP bearer keys, destructive agent tool flows. |
| `workspace-mcp` | Agent-enabled workspace starter for products where MCP is already a requirement. | Everything in `workspace`, plus MCP app setup, bearer validation, operation-backed tools, destructive confirmation where needed. | Treating MCP as onboarding, raw agent mutation shortcuts, unbounded tool writes. |

Decision: make `workspace-mcp` an official advanced lane because the current repo
already has a maintained fixture and example path for it. Still document the
preferred growth path as `public -> personal -> workspace -> add mcp` when a
team is unsure.

Follow-up decision needed during implementation: remove, deprecate, or clearly
relabel ambiguous `init --mcp` aliases. The cleaner product rule is "choose a
lane at init; add capabilities intentionally after init."

## Backlog

### P0. Ratify Starter and Adoption Taxonomy

Problem:
Feedback points to taxonomy drift: docs and ADRs mention starter concepts like
`cms` or "MCP as capability only," while the CLI and fixtures expose
`workspace-mcp`. That drift makes the framework feel heavier and less governed.

Scope:
- Audit all references to starter names, presets, templates, `workspace-mcp`,
  `--mcp`, and `cms`.
- Choose the official terms from "Official Adoption Lanes" above.
- Make README, Start Here, CLI help, starter READMEs, examples index, docs
  navigation, and ADR status text agree.
- Remove `cms` from first-class starter language unless there is a maintained
  generated starter, tested fixture, and public example.
- Decide whether `init --mcp` remains:
  - Preferred: remove or mark legacy if not released.
  - If retained: describe it as an alias for `workspace-mcp`, not a separate
    concept.
- Ensure `trellis add mcp` remains the normal progressive path for an existing
  workspace app.

Files to inspect/update:
- `README.md`
- `apps/docs/content/docs/01.getting-started/1.start-here.md`
- `apps/docs/content/docs/01.getting-started/2.installation.md`
- `apps/docs/content/docs/01.getting-started/5.canonical-app-layout.md`
- `apps/docs/content/docs/5.examples.md`
- `src/cli/commands/init.ts`
- `src/cli/lib/init.ts`
- `src/cli/starter-fixtures/*/README.md`
- `meta/adr/0002-first-class-starters.md`
- `meta/adr/0008-mcp-as-workspace-capability.md`
- `examples/README.md`

Acceptance criteria:
- A user sees the same lane names in CLI help, README, Start Here, starter
  READMEs, and examples.
- `cms` is not described as first-class starter taxonomy unless the codebase
  actually maintains it as one.
- `workspace-mcp` is consistently described as advanced and agent-enabled.
- No beginner-facing public or personal path recommends MCP as a first step.
- Upgrade/doctor messaging for deleted starter spellings matches the new
  official terms.

Verification:
- `rg -n "workspace-mcp|--mcp|template|preset|cms|starter" README.md apps/docs src/cli meta/adr examples`
- Focused unit tests for init option parsing and generated starter selection.
- Existing package export tests if public CLI/API wording changes package
  surface.

### P0. Rewrite Start Here Around Progressive Adoption

Problem:
Start Here already has the right instinct, but it should become the short,
authoritative route into the adoption lanes. It should not duplicate long
architecture material or make advanced capabilities look day-one.

Scope:
- Replace the current "fastest on-ramp" with a progressive lane table.
- For each lane, list:
  - when to use it
  - what it introduces
  - what it intentionally omits
  - verification command
  - next step
- State the adoption rule near the top:
  "Start public. Add auth only when identity is real. Add workspace only when
  tenant isolation is real. Add MCP only when agent access is a product
  requirement."
- Link to the Adoption Decision Guide for teams unsure whether Trellis fits.
- Keep "Everything else is a deeper layer, not day-one homework."

Acceptance criteria:
- A public-app evaluator can read the page without being forced through
  workspace or MCP terminology.
- The first MCP mention is framed as advanced.
- The page points to one decision guide, one evaluation checklist, and the
  examples ladder.
- The Start Here page does not repeat the full escape-hatch or security
  checklist content.

Verification:
- Docs build.
- Manual read-through from the perspective of a public-only app and a workspace
  SaaS app.

### P0. Add Adoption Decision Guide

New file:
- `apps/docs/content/docs/01.getting-started/0.adoption-decision.md`

Purpose:
Answer "Should we use Trellis?" before the user installs or copies examples.

Required sections:
- "The short answer"
- "Use Trellis if"
- "Skip Trellis if"
- "Choose your starting lane"
- "Do not evaluate through MCP first"
- "One-afternoon evaluation"
- "One-week pilot"
- "Decision outcomes"

Content requirements:
- Say Trellis is not a neutral Nuxt helper.
- Say raw Nuxt + Convex is better for tiny/simple apps.
- Say Trellis is strongest for workspace SaaS, server boundaries, webhooks, and
  MCP/agent workflows that need one backend authorization path.
- Explain that adoption means accepting the canonical shape, not cherry-picking
  random security wrappers.
- Include a clear stop condition:
  "If the team cannot explain why anonymous denial, tenant isolation, and
  destructive confirmation pass after the pilot, do not adopt Trellis yet."

Acceptance criteria:
- The page makes it easy to decide "no."
- The page does not sell MCP as the main reason to start Trellis unless the app
  actually has agent requirements.
- The page links to Start Here, Examples, Evaluation Checklist, and Escape
  Hatches.
- The page does not introduce implementation-only APIs.

Verification:
- Docs build.
- Link check if available.

### P0. Add Evaluation Checklist

New file:
- `apps/docs/content/docs/12.testing/4.evaluation-checklist.md`

Purpose:
Merge "pilot acceptance tests" and "security review checklist" into one
test-driven page. Avoid two docs that drift.

Required structure:
- "Minimum pilot checks"
- "Production security review"
- "Mapping to tests, doctor, lint, or manual review"
- "When to stop adoption"

Minimum pilot checks:
- Anonymous callers cannot read protected data.
- Viewer/read-only roles cannot write.
- Members cannot modify records outside their authorization boundary.
- Cross-workspace IDs are rejected.
- Forged workspace IDs do not override backend appIdentity.
- Own-record versus other-record behavior is tested.
- UI `_can` state is treated as projection only; backend authorization still
  rejects forbidden writes.
- Duplicate webhook deliveries are idempotent where webhook writes exist.
- Expired forwarding evidence fails where forwarding exists.
- Destructive operations cannot execute without a valid confirmation.

Production review checks:
- Inventory every `public`, `publicWrite`, `crossTenant`, and `unsafe` use.
- Review every server Convex call with `auth: 'none'`.
- Verify webhook HMAC uses raw body, timestamp tolerance, delivery ID, and
  constant-time comparison where applicable.
- Verify replay/idempotency state is stored with or before the domain write.
- Verify forwarding envelopes cover function ref, transport, purpose, args hash,
  TTL, and replay/JTI where applicable.
- Verify confirmation tokens are hashed, scoped, expiring, single-use, and bound
  to args/preview/operation.
- Verify MCP bearer keys are hashed at rest and can be revoked.
- Verify MCP rate limiting uses a distributed store in production when the app
  has rate-limited tools.
- Verify service callers have restricted tables, tenant derivation, replay mode,
  actingFor rules, and audit metadata.

Checklist table columns:
- Risk
- Required proof
- Example source
- Doctor/lint coverage
- Manual review required?

Acceptance criteria:
- Every row maps to test, doctor, lint, example, or manual review.
- The page is usable as a pilot sign-off checklist.
- The page does not imply Trellis is audited or proven without app-specific
  verification.

Verification:
- Docs build.
- Cross-check examples 03 and 07 for links to tests that already prove the
  listed failure modes.

### P0. Add Escape Hatches and Anti-Patterns Page

Preferred file:
- Expand or replace `apps/docs/content/docs/08.permissions/6.cross-scope-and-raw-access.md`

Do not create a second escape-hatches page unless the existing page cannot carry
the job. One source of truth is required.

Purpose:
Make dangerous APIs understandable and reviewable without normalizing their use.

Required surfaces:
- `query.public`
- `mutation.public`
- `publicWrite`
- `crossTenant`
- `unsafe`
- `actingFor`
- service callers
- forwarded callers
- raw server calls with `auth: 'none'`
- public table reads where configured

For each surface, document:
- What it bypasses
- What still applies
- Valid use cases
- Invalid use cases
- Safer default
- Required reason/metadata
- Required test
- Doctor/lint coverage
- Manual review notes

Required anti-pattern snippets:
- Bad: trusting `workspaceId` from args as authorization.
- Good: derive workspace from appIdentity or validate membership after load.
- Bad: hiding a button as the only authorization.
- Good: `_can` for UX plus backend `authorize`.
- Bad: webhook route directly mutates tenant data after HMAC only.
- Good: route verifies transport; Convex revalidates app/service/workspace
  binding.
- Bad: server helper uses `auth: 'none'` to bypass identity setup.
- Good: use `auth: 'required'`, trusted forwarding, or an explicitly public
  handler with reason.
- Bad: MCP destructive tool directly calls a mutation.
- Good: MCP tool binds to operation preview/confirm/execute.

Acceptance criteria:
- There is one canonical escape-hatch page.
- Every dangerous surface has a safer default and required proof.
- The page clearly says escape hatches are exceptional, not a normal ladder step.
- Beginner docs link here only when they introduce an escape hatch.

Verification:
- Docs build.
- `rg -n "publicWrite|crossTenant|unsafe|actingFor|auth: 'none'|auth: \"none\"" apps/docs` to ensure references point to the canonical page.

### P1. Make Doctor Adoption-Facing

Problem:
Doctor should be the trust gate in the adoption flow, not a maintainer-only
diagnostic. The feedback repeatedly says prose is not enough.

Scope:
Run a gap pass from the Evaluation Checklist to current doctor/inventory/lint.
Add only missing checks. Prefer inventory/reporting over hard failures when a
pattern can be valid with context.

Required checks to verify or add:
- Server helpers using `auth: 'none'` are inventoried.
- Known generated-safe `auth: 'none'` patterns are classified separately.
- Unknown `auth: 'none'` patterns warn unless they have explicit reason metadata
  or are inside a documented transport-proof wrapper.
- `publicWrite`, `crossTenant`, and `unsafe` are inventoried with reason, tables,
  and file locations.
- Missing reason/metadata on escape hatches warns or fails depending on
  production profile.
- Service subjects without restricted tables, tenant derivation, replay mode,
  actingFor rules, or audit metadata fail production doctor.
- MCP destructive tools not bound to operation preview/confirm fail production
  doctor.
- Missing distributed MCP rate-limit store warns/fails in production when
  rate-limited MCP tools exist.
- Missing tenant indexes for workspace tables are detected where inventory can
  prove the table is tenant-scoped.
- Weak or exposed identity-forwarding keys fail production doctor.

Implementation notes:
- Prefer extending existing inventory structures over adding a parallel scanner.
- If a rule cannot be reliably enforced statically, report "manual review
  required" rather than inventing a brittle check.
- Add fixture tests for every new finding.
- Keep findings actionable: include file location, why it matters, safer default,
  and what proof is expected.

Files to inspect/update:
- `src/analysis/project.ts`
- `src/analysis/validation.ts`
- `src/cli/lib/inventory.ts`
- `src/cli/lib/inventory-findings.ts`
- `src/cli/commands/doctor.ts`
- `src/cli/commands/upgrade.ts`
- `src/eslint/rules/*`
- `tests/fixtures/*`
- existing doctor/unit tests

Acceptance criteria:
- `trellis doctor --production` is explicitly referenced from adoption docs.
- New dangerous-pattern findings have fixture tests.
- Findings do not require users to understand internal scanner names.
- Valid generated starter patterns do not produce noisy false positives.

Verification:
- Focused doctor/inventory tests.
- `pnpm run check` before handoff if doctor/lint/package behavior changed.

### P1. Add Starter Smoke and Acceptance Matrix

Problem:
The adoption contract should be executable for each lane.

Scope:
- Create a starter acceptance matrix in docs and, where feasible, tests.
- Verify each supported starter can be generated by the documented command.
- Verify generated file lists are stable enough for intended contracts.
- Verify each starter has a README that describes only concepts present in that
  starter.
- Add or update smoke tests for init command behavior if missing.

Matrix columns:
- Lane
- Init command
- Add command progression
- Concepts present
- Concepts intentionally absent
- Required local command
- Required doctor mode
- Example to read next

Expected entries:
- `public`: generate, install, doctor, dev loop.
- `personal`: generate, auth environment, doctor, auth smoke path.
- `workspace`: generate, tenant/role tests, doctor production or equivalent.
- `workspace-mcp`: generate, MCP bearer validation, operation-backed writes,
  destructive safety, production doctor.

Acceptance criteria:
- Every official lane has a documented verification path.
- Public starter docs do not mention workspace/MCP concepts.
- Personal starter docs do not mention tenant roles unless pointing to the
  workspace next step.
- Workspace starter docs do not require MCP.
- Workspace-MCP starter docs clearly say it is advanced.

Verification:
- Focused CLI init tests.
- Starter fixture tests where existing harness supports them.
- Manual `rg` pass over starter READMEs for premature vocabulary.

### P1. Tighten Server Boundary Teaching

Problem:
Server route and webhook examples can be copied as production patterns. The docs
must make the default boundary explicit: transport proof is not business
permission.

Scope:
- Review server route docs and webhook/forwarding docs.
- Make the default teaching path:
  - Browser/session server route: `serverConvexQuery`/`serverConvexMutation`
    with `auth: 'required'`.
  - Public data: `auth: 'none'` only when calling genuinely public handlers.
  - Verified webhook/external service: route verifies transport; Convex
    revalidates service/user/workspace binding through forwarding or explicit
    service policy.
  - Route-owned `auth: 'none'` internal calls are advanced and require explicit
    reason, idempotency, and tests.
- Review Example 04 messaging. If it uses a narrower HMAC + internal mutation
  pattern, label it as narrow and not the default production identity model.
- Prefer linking to Example 03/07 stronger forwarding patterns where appropriate.

Files to inspect/update:
- `apps/docs/content/docs/07.server-side/2.server-routes.md`
- `apps/docs/content/docs/07.server-side/3.webhooks-and-identity-forwarding.md`
- `apps/docs/content/docs/13.api-reference/4.server.md`
- `examples/04-saas-platform/README.md`
- relevant example webhook route files

Acceptance criteria:
- No beginner doc teaches `auth: 'none'` as a shortcut around identity.
- Webhook docs say HMAC gates reach; backend still owns business authorization.
- Example 04 is either aligned to the stronger lane or explicitly framed as a
  narrow advanced pattern with required tests.

Verification:
- Docs build.
- `rg -n "auth: 'none'|auth: \"none\"|webhook|forwarding" apps/docs examples`

### P1. Embed Bad/Good Snippets Where Mistakes Happen

Problem:
A standalone bad/good page will rot and be read out of context.

Scope:
Add short Trellis-specific bad/good snippets inside the relevant docs:
- Workspace ID trust: isolation or escape-hatch docs.
- Frontend-only authorization: `_can` or authorization docs.
- Webhook route mutation: server/webhook docs.
- Raw `auth: 'none'`: server docs and escape-hatch docs.
- Broad public reads: public/cross-scope docs.
- MCP destructive direct-call: MCP destructive tools docs.

Acceptance criteria:
- Each snippet is near the rule it explains.
- Snippets are short and do not introduce new example architectures.
- Each "bad" snippet links to a maintained safe pattern.

Verification:
- Docs build.
- Manual read-through for duplication.

### P2. API Vocabulary Tiering

Problem:
The framework vocabulary is powerful but heavy. A sprint-wide subjective API
audit could become churn, so the deliverable must be a concrete classification.

New or updated file:
- Prefer adding a section to `apps/docs/content/docs/13.api-reference/7.api-surface.md`
  before creating another page.
- If a separate page is necessary, use
  `apps/docs/content/docs/13.api-reference/0.api-ladder.md`.

Required tiers:
- Day-one public app APIs:
  `useConvexQuery`, `useConvexMutation`, `useConvex`, query/mutation public
  lanes, args/contracts, basic server helper only when public SSR requires it.
- Auth app APIs:
  Better Auth helpers, auth bootstrap, authenticated lanes, app user identity.
- Workspace app APIs:
  `workspace` lanes, `workspaceScope`, guards, permissions, access context,
  record access, `_can`, tenant indexes.
- Server/webhook APIs:
  `serverConvex*`, explicit auth modes, transport proof, signed forwarding,
  service callers.
- MCP/agent APIs:
  MCP app, MCP bearer keys, scoped tools, sessions/resources/prompts,
  operation-backed tools.
- Advanced escape hatches:
  `unsafe`, `publicWrite`, `crossTenant`, `actingFor`, raw `auth: 'none'`,
  public table reads.

Scope:
- Classify docs and examples by tier.
- Remove advanced terms from day-one docs unless they are explicitly named as
  "you do not need this yet."
- Do not rename exports in this sprint unless a name is actively misleading and
  unreleased.

Acceptance criteria:
- Public and personal docs are materially easier to read.
- Advanced surfaces are still discoverable from API reference and escape-hatch
  docs.
- No package export changes are made without updating API surface docs and tests.

Verification:
- `pnpm test tests/unit/package-subpath-exports.test.ts` if exports change.
- Docs build.

### P2. Release Acceptance Script or Checklist

Problem:
The sprint should leave maintainers with one repeatable gate for this adoption
contract.

Scope:
- Add a documented release/adoption verification checklist if a script is too
  expensive.
- Prefer commands already used by the repo:
  - `pnpm run check`
  - `pnpm run release:verify`
  - focused doctor/init tests
- Include starter-specific checks only if they are not too slow for normal CI.
- If full generated-app install/typecheck is expensive, document it as a manual
  or pre-release smoke, not a default unit test.

Acceptance criteria:
- Maintainers know exactly what to run before claiming the adoption path works.
- The checklist covers all official lanes.
- No `.pack/`, `dist/`, `.nuxt/`, or `.output/` artifacts are committed.

## Proposed Sprint Sequence

1. Inventory taxonomy drift and decide final lane names.
2. Update CLI/help/docs/ADR language to one starter contract.
3. Rewrite Start Here and add Adoption Decision Guide.
4. Add Evaluation Checklist.
5. Expand the canonical escape-hatch doc.
6. Run doctor gap pass and implement only missing high-value checks.
7. Add fixture tests for new doctor findings.
8. Add or update starter smoke tests and starter README matrix.
9. Tighten server-boundary docs and Example 04 messaging.
10. Add contextual bad/good snippets.
11. Add API vocabulary tiering.
12. Run focused tests, docs build, lint/typecheck, then broader check.

## Sprint Acceptance Criteria

- A new evaluator can open the README and know in under two minutes whether
  Trellis is probably for them.
- CLI, README, Start Here, ADRs, starter READMEs, examples, and upgrade/doctor
  messaging use the same lane names.
- Public and personal starter paths do not expose workspace or MCP concepts as
  required day-one knowledge.
- Workspace path proves or points to tests for anonymous denial, tenant
  isolation, role boundaries, own-record versus other-record behavior, and
  backend authorization.
- Workspace-MCP path is clearly advanced and makes destructive agent writes
  operation-backed by default.
- Every documented escape hatch has a safer default, required reason, required
  test, and doctor/lint/manual-review mapping.
- `trellis doctor --production` is part of the adoption story.
- Doctor reports server `auth: 'none'` and dangerous escape hatches in a way a
  reviewer can act on.
- No beginner doc implies UI `_can` checks replace backend authorization.
- No beginner doc teaches raw forwarded caller data or route-owned
  `auth: 'none'` as the default identity model.
- The sprint does not add new framework layers, compatibility paths, or
  speculative abstractions.

## Verification Plan

Run focused checks while implementing:

```bash
pnpm test tests/unit/package-subpath-exports.test.ts
pnpm run check:docs:api-surface
pnpm run check
```

Run broader release gate before handoff if code changes touch CLI, doctor, lint,
package metadata, public API, starter fixtures, MCP, auth, permissions, or
server-boundary behavior:

```bash
pnpm run release:verify
```

Do not run live publish commands.

## Risks and Tradeoffs

- More docs can increase perceived heaviness. Mitigation: add three canonical
  pages at most and consolidate existing content instead of scattering guidance.
- Doctor can become noisy. Mitigation: classify valid generated patterns and
  prefer warnings/manual review when static proof is weak.
- Removing aliases can break users if already released. Mitigation: check release
  status and SemVer expectations before deleting any CLI spelling.
- API tiering can become subjective churn. Mitigation: produce classification
  first; only rename/move exports when an existing name is actively misleading.
- Example 04 may need careful handling. Mitigation: either align it with the
  stronger forwarding path or explicitly label its narrower pattern with required
  tests and limits.

## Out of Scope for This Sprint

- New MCP DSLs.
- Existing-app migration framework.
- CMS starter expansion.
- Stack-neutral adapters.
- New public bridge exports from core Trellis.
- New read models, projections, caches, background jobs, or state machines.
- Broad API renames without a concrete adoption bug.
