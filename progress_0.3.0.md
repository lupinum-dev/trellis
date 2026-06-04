# Trellis 0.3.0 Implementation Progress

Status: Active
Started: 2026-06-04
Scope source: `0.3.0.md`

## Operating Rules

- Implement from evidence, not confidence.
- Run Phase -1 proofs before broad API work.
- Keep Phase 0 small and blocking.
- Record failures as useful findings.
- Do not keep old unsafe paths and new safe paths side by side as normal
  options.
- Do not mark 0.3.0 viable until proof gates, security gates, examples, packed
  exports, and consumer migration gates pass.

## Phase Status

| Phase | Status | Notes |
| --- | --- | --- |
| Phase -1: Prove risky mechanics | Active | Source-policy, raw DB, cross-tenant, and public DB runtime proofs have passing focused evidence |
| Phase 0: Freeze unsafe growth | Active | Source-policy, packed export gate, focused runtime security proofs, cross-tenant ban, touched example typechecks pass, and `test:security` is wired into `check`/`release:verify`; broader release gates still pending |
| Phase 1: Backend authority cutover | Pending | Waiting on Phase -1 proofs |
| Phase 2: Operations, replay, trusted proofs | Active | Opaque transport proof cutover and framework JTI replay claim/complete/fail pass focused tests; domain idempotency remains app-owned and webhook recovery is still pending |
| Phase 3: MCP cutover | Pending | Waiting on operation-backed consumer fixture proof |
| Phase 4: Webhooks, delegation, server routes | Active | HMAC helper parse-before-idempotency, example 04 backend delivery idempotency, example 03 delegation, and example 07 MCP/webhook delegation pass focused gates |
| Phase 5: Client auth lifecycle | Active | Better Auth `$sessionSignal` and upstream-authoritative sign-out have focused Nuxt proof; stale protected-navigation smoke remains |
| Phase 6: Examples, docs, public surface, release gate | Active | Phase A security contract exists and is wired into `test:security`; broader examples/docs/consumer/release gates remain |

## Proof Spike Ledger

| Spike | Status | Evidence | Next step |
| --- | --- | --- | --- |
| Raw DB removal | Passed | Handler-visible `ctx.db` no longer carries raw DB by reference, symbol, or descriptor; destructive internals still pass tests | Remove `escapeIsolation` normal-lane API in cross-tenant capability spike |
| Public-safe DB facade | Passed | Public `ctx.db` is read-only and table-limited; public writes require operation-backed `publicWrite` narrow methods and emit `db.public_write.used` | Keep regression coverage while moving to trusted proof/replay work |
| Strict evaluator | Passed | Core auth and MCP checks require exact boolean results | Covered by expanded `test:security`; keep release gates green |
| Cross-tenant capability | Passed | Normal handler `ctx.db` no longer exposes `escapeIsolation`; named `crossTenant` capabilities are table-limited, read-only by default, and write mode requires operation metadata | Keep policy gate banning generic escape hatches and continue with public-safe DB facade proof |
| Service subject | Active | Example 03 `todo-sync-webhook` service is configured as derived, table-restricted access scoped from `workspaceId` | Extend proof to remaining maintained service lanes |
| Trusted proof | Passed | Server/MCP forwarding now uses branded `transportProof.*(...)`; raw `auth: 'trusted'` rejects before fetch; source policy scans the server helper | Keep proof-object coverage while finishing webhook/delegation lanes |
| Replay store | Active | `jti-redemption` and `operation-confirmation` envelopes carry signed replay mode and use `trustedReplay` to claim before handler execution, then mark `completed` or `failed`; duplicate JTI tests execute the handler once | Prove webhook/domain idempotency recovery and add release-gate coverage |
| Webhook idempotency | Active | `verifyHmacWebhookDelivery(...)` reads raw body once, rejects blank/stale/tampered deliveries, parses before idempotency; examples 03, 04, and 07 store delivery/idempotency rows with the business write | Add broader maintained-example/release-gate coverage |
| Delegation binding | Active | `delegateToUser` is replaced by required binding evidence; examples 03 and 07 create short-lived bindings and Convex revalidates service/user/workspace/purpose/expiry before writing | Extend docs/API reference and add forged/expired/wrong-binding negative coverage where missing |
| MCP operation migration | Active | Production-copyable MCP write tools no longer use tool-local safety stamping | Add consumer fixture/assertions for operation-backed MCP writes |
| Better Auth sync | Passed | Better Auth `$sessionSignal` is observed by the auth transport, routed through `authEngine.refreshAuth({ trigger: 'auth-session-signal' })`, and focused tests prove fresh-token adoption and stale-token clearing | Add browser/Nuxt protected-navigation smoke before release viability |
| Sign-out ordering | Passed | Local logout now commits only after upstream Better Auth sign-out succeeds; failed upstream logout keeps the existing session represented with an auth error and skips local invalidation | Keep Nuxt auth smoke green and add stale protected-navigation proof |
| Packed exports | Passed | Stale `dist` failed with 25 banned public export violations; rebuilt package entries now pass packed export gate | Covered by expanded `test:security`; keep release gates green |
| Security contract | Active | Phase A generated contract inventories public exports, banned export absence, source-policy rules, public read tables, backend lanes, operations, MCP tools, and runtime proof files | Phase B route/delegation/service metadata remains explicitly deferred |

## Implementation Log

### 2026-06-04

- Created `progress_0.3.0.md`.
- Added initial Phase 0 source-policy script scaffold:
  `scripts/check-security-source-policy.mjs`.
- Added package scripts:
  - `check:security:source-policy`
  - `check:security:packed-exports`
  - `test:security`
- Hardened `runCheck` to require exact boolean authorization results.
- Added focused regression tests proving async/object/string guard results are
  invalid instead of truthy:
  - primitive `can` and `enforce`
  - composed `and`/`or`/`not` guards
  - permission explanations
  - access-context permission projection
  - protected structured handlers before business logic runs
- Hardened MCP tool checks to require exact boolean results after awaiting
  async checks.
- Added MCP strict-evaluator regression tests proving invalid discovery checks
  reject and invalid handler-time checks fail closed before business logic runs.
- Removed the hidden raw DB symbol from handler-visible `ctx.db`.
- Replaced direct DB mutation in `decorateDb` with a proxy plus internal
  WeakMap so Trellis destructive-operation internals can still access raw DB
  without exposing it through handler-visible symbols/descriptors.
- Added a raw DB recovery regression test covering direct reference equality,
  own symbols, descriptors, known string access, and normal query usability.
- Removed banned helpers from first-reader public barrels:
  - `delegateToUser` and shared-secret webhook body reader from
    `src/runtime/server/index.ts`
  - raw identity-forwarding envelope/context mutation primitives from
    `src/runtime/backend/index.ts`
  - `stampMcpToolSafety` and `trellisMcpToolSafetyKey` from
    `src/runtime/mcp/index.ts`
  - standalone app-write `defineTool` from `src/runtime/mcp/advanced.ts`
- Updated MCP public export tests to assert the removed APIs stay absent.
- Removed unsafe copy-paste guidance from docs and starter AGENTS while the
  0.3 proof/delegation APIs are not implemented.
- Removed the example 03 public MCP email resolver projection.
- Removed the example 06 public demo seed mutation and its frontend seed UI.
- Migrated MCP bounded-write examples from tool-local safety stamping to
  operation-backed tools:
  - harness task/comment/note/post create tools
  - example 07 runbook create/update tools
  - example 08 page create/save-draft tools
  - workspace MCP starter create-todo tool
- Disabled examples 03 and 07 webhook-forwarding routes until the 0.3 proof
  object, backend-revalidated delegation, and recoverable idempotency APIs are
  implemented.
- Upgraded example 04 webhook route from shared-secret comparison to
  timestamped HMAC verification.
- Disabled example 07 MCP acting-for delegation until backend-revalidated
  delegation evidence exists.
- Added the missing `@lupinum/trellis-bridge` workspace dependency to example
  08 so its component bridge import resolves during Nuxt typecheck.
- Added a packed export security gate:
  `scripts/check-security-packed-exports.mjs`.
- Wired `test:security` to run source-policy, rebuild the module package, and
  verify built public entries do not export removed unsafe APIs.
- Replaced the broad normal-lane `ctx.db.escapeIsolation(...)` API with named
  `crossTenant` capabilities on structured handlers and operations.
- Added runtime enforcement for cross-tenant capabilities:
  - declared table allow-list
  - read-only default mode
  - write mode allowed only on operation-backed handlers
  - `db.cross_tenant.used` observability events for capability table touches
- Migrated maintained cross-tenant consumers to named capabilities:
  - harness cross-tenant fixtures
  - example 05 visibility access
  - example 06 multi-workspace
  - example 07 MCP reference
- Added source-policy coverage for `apps/harness/convex` and banned
  `escapeIsolation` from production-copyable roots.
- Added a minimal public-safe DB runtime contract:
  - `defineTrellis({ public: { readTables } })` declares public-readable tables
  - public handlers receive a read-only DB facade
  - unlisted table reads fail before reaching Convex
  - public `ctx.db` writes fail before reaching Convex
  - public handlers default to no DB table access
- Narrowed public lane TypeScript context so `query.public` and
  `mutation.public` expose only `get`, `normalizeId`, and `query` on `ctx.db`.
- Fixed backend lane wrapping to preserve non-enumerable operation metadata when
  adding lane metadata for runtime customization.
- Updated maintained public-read examples to declare public read tables:
  - example 01 public todo: `todos`
  - example 08 component mini CMS: `pages`
- Replaced the old boolean acting-for helper with binding evidence:
  - `requireDelegationBinding(...)`
  - `assertDelegationBinding(...)`
  - backend and server exports share one binding shape
- Re-enabled example 03 webhook forwarding with the 0.3 lane:
  - timestamped HMAC delivery verification
  - `transportProof.webhook(...)`
  - `domainIdempotency(...)`
  - backend-revalidated delegation binding
  - service caller configured through derived, table-restricted service access
  - workspace-scoped `processedEvents` idempotency rows
- Added example 03 route/backend regression coverage for valid signed
  forwarding, forged workspace binding, expired binding, invalid HMAC, missing
  fields, missing route secret, and backend retry after dispatch failure.
- Updated server-route docs to use transport proof auth and
  `requireDelegationBinding(...)` instead of `auth: 'trusted'` and
  `delegateToUser(...)`.

## Findings And Failures

The strict evaluator Phase -1 proof passes across core auth, access context,
structured handlers, and MCP tool checks.
The raw DB removal Phase -1 proof passes for normal handler-visible DB objects
and destructive-operation internals.

Resolved Phase 0 source-policy baseline:

- First run found 67 source-policy violations.
- This proved the scanner could see the unsafe baseline before removal.
- After the first public barrel export cut, the source-policy gate reports 55
  remaining violations.
- After docs/starter cleanup, public resolver/seed removal, and MCP
  operation-backed migration, the source-policy gate reports 17 remaining
  violations.
- After disabling old forwarding examples, upgrading example 04 to HMAC, and
  removing example 07 boolean MCP delegation, `pnpm run test:security` passes.

Current residual findings:

- The source-policy gate only covers production-copyable source and first-reader
  public barrels. It does not prove the future trusted proof API, replay store,
  or delegation binding yet. Packed public entries are now covered by
  `check:security:packed-exports`.
- Public `ctx.db` is now narrow at runtime and in public lane types.
- Maintained public-write examples now use operation-backed write contracts in
  the touched examples. Continue migration pressure through consumer gates
  rather than adding table-level public write allow-lists.
- The current public read contract is table-level. That is a secure default only
  if teams do not add private identity tables to `public.readTables`; the next
  security contract/doctor pass should inventory and review public read tables.
- Cross-tenant access now has a narrow runtime contract. The current capability
  access object is intentionally table-limited and narrower than full Convex DB;
  callers should not treat it as a general database facade.
- Server/MCP/webhook forwarding now uses opaque transport proof objects instead
  of raw `auth: 'trusted'` strings. JTI replay claim/complete/fail is enforced
  for JTI modes; domain idempotency remains app-owned and must be colocated
  with the business write.
- Example 03 proved that derived service access requires every touched table to
  be tenant-scoped. The webhook touched `processedEvents`, so the table gained
  optional `workspaceId` and a workspace-aware index for the service path.
- Example 08 typecheck previously failed on missing
  `@lupinum/trellis-bridge/component` module resolution. The example used the
  bridge package in app source but did not declare it as a dependency. Adding
  the workspace dependency fixed the blocker.

Resolved initial violation classes:

- historical proposal text still documents the removed unsafe baseline
- maintained examples previously used `readSharedSecretWebhookBody`
- maintained MCP tools previously imported/called `stampMcpToolSafety`
- example 03 previously exposed a public MCP email resolver
- example 06 previously exposed a public agency/demo seed mutation
- runtime server barrel previously exported the shared-secret webhook helper
- runtime backend barrel previously exported raw identity-forwarding primitives
- runtime MCP barrel previously exported tool-local safety stamping
- runtime MCP advanced surface previously exposed a write-capable low-level helper
- starter AGENTS files previously taught raw trusted auth

## Verification Log

### 2026-06-04

- `pnpm run test:security`
  - Result: failed as expected.
  - Evidence: `scripts/check-security-source-policy.mjs` reported 67
    violation(s).
  - Interpretation: Phase 0 source-policy scaffold is active; current unsafe
    baseline remains to be removed/quarantined.
- `git diff --check`
  - Result: passed.
- `pnpm run build:module`
  - Result: passed.
  - Interpretation: public-write type plumbing, app entrypoint export, and
    observability event changes compile into package declarations and dist
    entries.
- `pnpm exec vitest run --project=unit tests/unit/functions-defineTrellis.test.ts tests/unit/app-index-exports.test.ts`
  - Result: passed.
  - Evidence: 2 test files, 48 tests.
  - Interpretation: focused public-write invariants passed before example
    migration.
- `pnpm --dir examples/01-public-todo typecheck`
  - Result: passed.
  - Interpretation: example 01 now uses `operation.publicMutation(...)` with
    `ctx.publicWrite` narrow methods instead of broad public `ctx.db` writes.
- `pnpm exec vitest run --project=unit tests/unit/functions-defineTrellis.test.ts tests/unit/app-index-exports.test.ts tests/unit/observability.test.ts`
  - Result: passed.
  - Evidence: 3 test files, 62 tests.
  - Interpretation: public-write capability use is operation-backed,
    table-limited, invalid outside public mutations, and emits
    `db.public_write.used` rather than `db.cross_tenant.used`.
- `pnpm --dir examples/05-visibility-access typecheck:tests`
  - Result: passed.
- `pnpm --dir examples/06-multi-workspace typecheck`
  - Result: passed.
- `pnpm --dir examples/08-component-mini-cms typecheck`
  - Result: passed.
- `pnpm run check:security:source-policy`
  - Result: passed.
- `pnpm run check:security:packed-exports`
  - Result: passed.
- `pnpm --dir examples/01-public-todo typecheck`
  - Result: passed.
  - Interpretation: example 01 stayed green after rebuilding dist.
- `pnpm run check:publish-surface`
  - Result: passed.
- `git diff --check`
  - Result: passed.
- `pnpm exec vitest run --project=unit tests/unit/functions-defineTrellis.test.ts tests/unit/functions-isolation.test.ts`
  - Result: passed.
  - Evidence: 2 test files, 39 tests.
  - Interpretation: normal handler `ctx.db` does not expose `escapeIsolation`;
    named cross-tenant read capabilities are table-limited and read-only; write
    capabilities require operation metadata; operation-backed write capability
    paths work.
- `pnpm exec vitest run --project=unit tests/unit/functions-defineTrellis.test.ts`
  - Result: failed on first public-safe DB facade run.
  - Evidence: 5 failures.
  - Interpretation: public facade denied unlisted tables as intended, but the
    test expected async promise rejection instead of synchronous table denial;
    service-scope tests also needed explicit public read-table declarations;
    lane wrapping dropped non-enumerable operation metadata through object
    spread.
- `pnpm exec vitest run --project=unit tests/unit/functions-defineTrellis.test.ts`
  - Result: passed after fixing descriptor-preserving lane wrapping and public
    facade tests.
  - Evidence: 1 test file, 36 tests.
  - Interpretation: public DB runtime facade allows declared public reads,
    blocks unlisted reads, blocks writes, defaults to no table access, preserves
    operation projection metadata, and keeps service-scope tests meaningful.
- `pnpm run build:module`
  - Result: passed.
  - Interpretation: new `public.readTables` option and lane metadata compile and
    produce package declarations.
- `pnpm --dir examples/05-visibility-access typecheck:tests`
  - Result: failed before rebuilding after public context narrowing.
  - Interpretation: public lane `ctx.db` narrowing initially leaked into
    `crossTenant.access` typing. Runtime already passes a separate capability
    DB, so `crossTenant.access` typing was decoupled from lane `ctx.db`.
- `pnpm --dir examples/05-visibility-access typecheck:tests`
  - Result: passed after rebuilding.
- `pnpm --dir examples/06-multi-workspace typecheck`
  - Result: failed after public context narrowing.
  - Interpretation: agency helpers had broader Convex context types than their
    actual read needs. Narrowing the helper to `auth` plus read queries and
    removing a redundant scoped-appIdentity check fixed it.
- `pnpm --dir examples/06-multi-workspace typecheck`
  - Result: passed.
- `pnpm --dir examples/08-component-mini-cms typecheck`
  - Result: failed after public context narrowing.
  - Interpretation: public published-page operations were annotated with full
    `QueryCtx`; removing those annotations and declaring `public.readTables`
    fixed the read-only public path.
- `pnpm --dir examples/08-component-mini-cms typecheck`
  - Result: passed.
- `pnpm --dir examples/01-public-todo typecheck`
  - Result: failed.
  - Evidence: public create/toggle/remove operations require full `MutationCtx`
    but `mutation.public(...)` now exposes read-only public `ctx.db`.
  - Interpretation: this is the remaining public-write contract gap. Do not fix
    it with `unsafe`, `any`, or table-level public write allow-lists.
- `pnpm run build:module`
  - Result: passed after public context type narrowing.
- `pnpm exec vitest run --project=unit tests/unit/functions-defineTrellis.test.ts tests/unit/functions-isolation.test.ts tests/unit/observability.test.ts`
  - Result: passed.
  - Evidence: 3 test files, 56 tests.
  - Interpretation: public-safe DB facade, cross-tenant capability, isolation,
    service-scope, and observability focused coverage all pass together.
- `pnpm run check:security:source-policy`
  - Result: passed.
- `pnpm run check:security:packed-exports`
  - Result: passed after rebuilding the module package.
- `pnpm run check:publish-surface`
  - Result: passed.
- `git diff --check`
  - Result: passed.
- `pnpm run build:module`
  - Result: passed.
  - Interpretation: the opaque transport proof API, server barrel exports, MCP
    caller updates, and package declarations build cleanly.
- `pnpm exec vitest run --project=unit tests/unit/server-convex-utils.test.ts tests/unit/mcp-convex-caller.test.ts tests/unit/server-index-exports.test.ts tests/unit/define-convex-tool.test.ts tests/unit/phase0-workspace-mcp-fixture.test.ts`
  - Result: passed.
  - Evidence: 5 test files, 77 tests.
  - Interpretation: raw `auth: 'trusted'` is rejected before fetch, branded
    transport proofs drive server/MCP forwarding, write proofs require replay
    intent, and MCP operation preview/execute paths pass focused regression
    coverage.
- `pnpm run check:security:source-policy`
  - Result: passed.
  - Interpretation: production-copyable source no longer contains the banned
    first-reader unsafe auth snippets, and the gate now scans the server helper
    that previously could have hidden raw trusted auth strings.
- `pnpm run check:security:packed-exports`
  - Result: passed.
  - Interpretation: rebuilt package entries do not re-export the removed unsafe
    APIs through checked public package subpaths.
- `pnpm run check:publish-surface`
  - Result: passed.
- `pnpm --dir examples/07-mcp-reference typecheck`
  - Result: failed during the first pass, then passed after the public-lane
    migration fixes.
  - Evidence: public handlers in example 07 still depended on normal-lane DB
    capabilities before `mcpKeys`, `users`, `runbooks`, and `workspaces` were
    tightened to explicit public/cross-tenant operation contracts.
  - Interpretation: the narrower public lane is doing useful work by exposing
    unsafe or ambiguous consumer usage during typecheck.
- `pnpm --dir examples/08-component-mini-cms typecheck`
  - Result: passed.
- Parallel example typecheck attempt
  - Result: failed due to command sequencing, then passed when rerun serially.
  - Evidence: example 07/08 typechecks were started while `pnpm run
    build:module` had cleaned `dist`, so local package declarations were
    temporarily unavailable.
  - Interpretation: consumer gates must run after package build completes; do
    not parallelize example typechecks against a rebuilding package.
- `git diff --check`
  - Result: passed.
- `pnpm run check:security:source-policy`
  - Result: passed after public context type narrowing.
- `pnpm run check:publish-surface`
  - Result: passed after public context type narrowing.
- `git diff --check`
  - Result: passed after public context type narrowing.
- `pnpm --dir examples/05-visibility-access typecheck:tests`
  - Result: passed.
  - Interpretation: visibility/share-token example compiles after replacing the
    broad escape hatch with a named cross-tenant read capability.
- `pnpm --dir examples/06-multi-workspace typecheck`
  - Result: passed.
  - Interpretation: multi-workspace access context, dashboard, and workspace
    flows compile with named read/write cross-tenant capabilities.
- `pnpm --dir examples/07-mcp-reference typecheck`
  - Result: passed.
  - Interpretation: MCP reference runbook/workspace flows compile with named
    cross-tenant capabilities and without `query.unsafe` catalog fallbacks.
- `pnpm run check:security:source-policy`
  - Result: passed after adding `apps/harness/convex` coverage and banning
    `escapeIsolation`.
  - Interpretation: production-copyable roots cannot reintroduce the generic
    cross-tenant escape hatch.
- `pnpm exec vitest run --project=unit tests/unit/functions-defineTrellis.test.ts tests/unit/functions-isolation.test.ts tests/unit/observability.test.ts`
  - Result: passed.
  - Evidence: 3 test files, 53 tests.
  - Interpretation: cross-tenant runtime behavior and renamed
    `db.cross_tenant.used` observability event are covered.
- `pnpm --dir examples/05-visibility-access typecheck:tests`
  - Result: passed.
- `pnpm --dir examples/06-multi-workspace typecheck`
  - Result: passed.
- `pnpm --dir examples/07-mcp-reference typecheck`
  - Result: passed.
- `pnpm run test:security`
  - Result: passed.
  - Evidence: source policy passed, module build succeeded, declaration checks
    passed, and packed export policy passed.
- `pnpm run check:publish-surface`
  - Result: passed.
- `git diff --check`
  - Result: passed.
- `pnpm run test:security`
  - Result: passed.
  - Evidence: `[trellis] security source policy passed`.
  - Interpretation: Phase 0 source-policy freeze is now active and green for
    tracked production-copyable source.
- `pnpm exec vitest run --project=unit tests/unit/mcp-index-exports.test.ts tests/unit/auth-primitives.test.ts tests/unit/auth-access-context.test.ts tests/unit/functions-defineHandler.test.ts tests/unit/define-convex-tool.test.ts`
  - Result: passed.
  - Evidence: 5 test files, 80 tests.
  - Interpretation: exact-boolean evaluator behavior is covered across core
    auth, access-context projection, structured handlers, and MCP tool checks.
- `pnpm exec vitest run --project=unit tests/unit/functions-defineTrellis.test.ts`
  - Result: passed.
  - Evidence: 1 test file, 30 tests.
  - Interpretation: handler-visible `ctx.db` raw DB recovery fails while
    existing destructive operation paths still work.
- `pnpm exec vitest run --project=unit tests/unit/functions-defineTrellis.test.ts tests/unit/functions-isolation.test.ts tests/unit/observability.test.ts`
  - Result: passed.
  - Evidence: 3 test files, 50 tests.
- `pnpm run check:publish-surface`
  - Result: passed.
- `pnpm run test:security`
  - Result: passed.
- `pnpm exec nuxi prepare --dotenv .env.local`
  - Workdir: `examples/03-team-workspace`
  - Result: passed.
  - Interpretation: needed before running newly included example 03 server
    tests because its tsconfig references generated `.nuxt` tsconfigs.
- `pnpm exec vitest run --config vitest.config.ts server/api/webhook.post.test.ts`
  - Workdir: `examples/03-team-workspace`
  - Result: passed.
  - Evidence: 1 test file, 1 test.
- `pnpm exec vitest run --config vitest.config.ts server/api/webhook.post.test.ts`
  - Workdir: `examples/04-saas-platform`
  - Result: passed.
  - Evidence: 1 test file, 4 tests.
- `pnpm exec vitest run --config vitest.config.ts server/api/runbook-webhook.post.test.ts`
  - Workdir: `examples/07-mcp-reference`
  - Result: passed.
  - Evidence: 1 test file, 1 test.
- `pnpm run check:publish-surface`
  - Result: passed.
- `pnpm run test:types:harness-server`
  - Result: passed after fixing operation-tool response arg casts and removing
    the unused harness `defineTool` wrapper.
- `pnpm --dir examples/04-saas-platform typecheck:tests`
  - Result: passed.
- `pnpm --dir examples/06-multi-workspace typecheck`
  - Result: passed.
- `pnpm --dir examples/07-mcp-reference typecheck`
  - Result: passed after tightening operation-tool middleware arg casts.
- `pnpm --dir examples/08-component-mini-cms typecheck`
  - Result: failed before the dependency fix.
  - Evidence: `convex/features/pages/bridge.ts` could not resolve
    `@lupinum/trellis-bridge/component`.
  - Interpretation: example 08 was missing a required workspace dependency.
- `pnpm install --lockfile-only`
  - Result: passed.
  - Interpretation: refreshed workspace dependency metadata after adding
    example 08's bridge dependency.
- `pnpm --dir examples/08-component-mini-cms typecheck`
  - Result: passed.
  - Interpretation: the component bridge dependency now resolves.
- `git diff --check`
  - Result: passed.
- `pnpm exec vitest run --project=unit tests/unit/auth-primitives.test.ts tests/unit/auth-access-context.test.ts tests/unit/functions-defineHandler.test.ts`
  - Result: passed.
  - Evidence: 3 test files, 43 tests.
  - Interpretation: central auth evaluator no longer coerces invalid guard
    results into allow decisions on core auth and handler paths.
- `pnpm run check:security:source-policy`
  - Result: failed as expected.
  - Evidence: violation count dropped from 67 to 55 after public barrel export
    cut.
  - Interpretation: runtime first-reader export removals took effect; docs,
    examples, starter fixtures, trusted proof, webhook, delegation, MCP
    migration, and demo-seed issues remain.
- `pnpm exec vitest run --project=unit tests/unit/mcp-index-exports.test.ts tests/unit/auth-primitives.test.ts tests/unit/auth-access-context.test.ts tests/unit/functions-defineHandler.test.ts`
  - Result: passed.
  - Evidence: 4 test files, 47 tests.
  - Interpretation: export-surface cut did not regress the focused auth/MCP
    unit tests.
- `pnpm run check:security:source-policy`
  - Result: failed as expected.
  - Evidence: violation count dropped from 55 to 39 after docs/starter cleanup,
    then to 35 after public resolver/demo seed removal, then to 25 after
    operation-backed migration in consumer examples, then to 17 after harness
    MCP operation-backed migration.
  - Interpretation: MCP tool-local safety stamping has been removed from
    production-copyable surfaces; remaining violations require the trusted
    proof, webhook idempotency, and delegation evidence work.
- `pnpm exec vitest run --project=unit tests/unit/mcp-index-exports.test.ts tests/unit/auth-primitives.test.ts tests/unit/auth-access-context.test.ts tests/unit/functions-defineHandler.test.ts tests/unit/define-convex-tool.test.ts`
  - Result: passed.
  - Evidence: 5 test files, 78 tests.
- `pnpm run check:security:packed-exports`
  - Result: failed as expected before rebuilding.
  - Evidence: 25 stale `dist` public export violations across server, backend,
    MCP, and MCP advanced entries.
  - Interpretation: source-only checks were insufficient; the packed gate
    catches stale built artifacts that still expose removed APIs.
- `pnpm run test:security`
  - Result: passed.
  - Evidence: source policy passed, `build:module` rebuilt and cleaned `dist`,
    declaration specifiers normalized, and packed export policy passed.
  - Interpretation: rebuilt public package entries no longer expose the removed
    unsafe APIs through the checked package subpaths.
  - Interpretation: focused auth and MCP unit coverage still passes after
    operation-backed MCP migration.
- `git diff --check`
  - Result: passed.

## Latest Status

### 2026-06-04

- Opaque trusted transport proof cutover is implemented and verified.
- Framework JTI replay redemption is implemented for `jti-redemption` and
  `operation-confirmation` modes via `defineTrellis({ trustedReplay: { table }
  })`.
- Verified commands:
  - `pnpm run build:module`
  - `pnpm run test:security`
  - `pnpm exec vitest run --project=unit tests/unit/identity-forwarding-envelope.test.ts tests/unit/server-convex-utils.test.ts tests/unit/functions-defineTrellis.test.ts tests/unit/mcp-convex-caller.test.ts tests/unit/define-convex-tool.test.ts tests/unit/phase0-workspace-mcp-fixture.test.ts`
  - `pnpm run test:types:harness-server`
  - `pnpm exec vitest run --project=unit tests/unit/server-convex-utils.test.ts tests/unit/mcp-convex-caller.test.ts tests/unit/server-index-exports.test.ts tests/unit/define-convex-tool.test.ts tests/unit/phase0-workspace-mcp-fixture.test.ts`
  - `pnpm run check:security:source-policy`
  - `pnpm run check:security:packed-exports`
  - `pnpm run check:publish-surface`
  - `pnpm --dir examples/03-team-workspace typecheck`
  - `pnpm --dir examples/04-saas-platform typecheck:tests`
  - `pnpm --dir examples/05-visibility-access typecheck`
  - `pnpm --dir examples/07-mcp-reference typecheck`
  - `pnpm --dir examples/08-component-mini-cms typecheck`
  - `git diff --check`
- Finding: trusted write proofs now require replay metadata, and JTI-backed
  modes are durably claimed before handler execution. `domainIdempotency(...)`
  remains a target handler/operation responsibility.
- Finding: webhook recovery is partially proven in example 04. Identity-forwarded
  webhook routes still need backend-revalidated delegation and domain
  idempotency proof before Phase 4 can move.
- Finding: example typechecks must run after `build:module` completes; parallel
  runs against a rebuilding package can fail because `dist` is temporarily
  unavailable.

### 2026-06-04 Webhook Idempotency Slice

- Added `verifyHmacWebhookDelivery(event, options)` as the first-reader HMAC
  helper. It reads the raw body once, validates timestamp/delivery/body-bound
  HMAC, then parses the payload.
- Fixed `readHmacVerifiedWebhookBody(...)` so optional idempotency hooks run
  after parse, preventing parse-failure poisoning.
- Updated example 04 so the route does not route-consume deliveries. It passes
  `deliveryId` to the internal Convex mutation, and the backend mutation stores
  the delivery id with the task in the same transaction.
- Verified commands:
  - `pnpm run build:module`
  - `pnpm exec vitest run --project=unit tests/unit/server-boundaries.test.ts`
  - `pnpm exec vitest run --project=unit tests/unit/server-boundaries.test.ts tests/unit/server-index-exports.test.ts`
  - `pnpm exec vitest run --config vitest.config.ts server/api/webhook.post.test.ts` in `examples/04-saas-platform`
  - `pnpm exec vitest run --config vitest.config.ts convex/projectBoard.test.ts` in `examples/04-saas-platform`
  - `pnpm exec vitest run --config vitest.config.ts server/api/webhook.post.test.ts convex/projectBoard.test.ts` in `examples/04-saas-platform`
  - `pnpm --dir examples/04-saas-platform typecheck:tests`
  - `pnpm run check:security:source-policy`
  - `pnpm run check:security:packed-exports`
  - `pnpm run check:publish-surface`
  - `git diff --check`
- Finding: example 04 now proves backend dispatch failure after verification is
  retryable at the route layer, and duplicate valid delivery ids are rejected in
  the backend mutation.
- Finding: examples 03 and 07 remain disabled until backend-revalidated
  delegation evidence lands.
- Failure: one attempted `pnpm --dir examples/04-saas-platform typecheck:tests`
  command was run from inside the example directory and failed with an `ENOENT`
  nested-path error. Rerunning the command from the repo root passed.

### 2026-06-04 Delegation Binding Slice

- Replaced `delegateToUser(...)` with binding evidence:
  - server routes create `requireDelegationBinding(...)`
  - backend resolvers check `assertDelegationBinding(...)`
  - the server barrel explicitly does not expose `delegateToUser`
- Re-enabled example 03 webhook forwarding through the 0.3 path:
  - HMAC delivery verification
  - `transportProof.webhook(...)`
  - required domain idempotency metadata
  - service subject `todo-sync-webhook`
  - backend membership revalidation for service/user/workspace/purpose/expiry
- Added a derived service contract for `todo-sync-webhook` instead of making the
  service lane unrestricted.
- Added `workspaceId` to example 03 processed event rows for the service path so
  derived service access can safely touch the idempotency table.
- Verified commands:
  - `pnpm run build:module`
  - `pnpm exec vitest run --project=unit tests/unit/server-boundaries.test.ts tests/unit/server-index-exports.test.ts`
  - `pnpm exec vitest run --project=unit tests/unit/identity-forwarding.test.ts tests/unit/server-convex-utils.test.ts`
  - `pnpm exec vitest run --project=unit tests/unit/server-boundaries.test.ts tests/unit/server-index-exports.test.ts tests/unit/identity-forwarding.test.ts tests/unit/server-convex-utils.test.ts`
  - `pnpm exec vitest run --config vitest.config.ts server/api/webhook.post.test.ts convex/todos.test.ts` in `examples/03-team-workspace`
  - `pnpm --dir examples/03-team-workspace typecheck`
  - `pnpm run check:security:source-policy`
  - `pnpm run check:security:packed-exports`
  - `pnpm run check:publish-surface`
  - `pnpm run build:cli`
  - `git diff --check`
- Findings:
  - Function-ref metadata is required for signed forwarding. The example 03
    webhook mutation now declares
    `identityForwardingFunctionRef:
    'features/todos/webhooks:processTodoSyncWebhookMutation'`.
  - Backend operation metadata types were missing the `webhook` transport even
    though the forwarding envelope supported it. Runtime types now include
    `webhook`.
  - A derived service cannot safely touch unscoped idempotency rows. Example 03
    now stores workspace-scoped processed events for the webhook path.
- Failures:
  - The first example rerun failed because stale `dist` did not yet export
    `requireDelegationBinding(...)`; rebuilding fixed it.
  - The first signed backend tests failed before delegation validation because
    function-ref metadata was missing.
  - After adding function-ref metadata, the service subject failed closed because
    `todo-sync-webhook` was not configured in `defineTrellis({ services })`.
  - Example 03 typecheck caught the missing `webhook` transport type in backend
    operation metadata.

### 2026-06-04 Example 07 Delegation Work In Progress

- Started replacing the disabled example 07 runbook webhook route with the 0.3
  proof-object lane:
  - HMAC delivery verification
  - `transportProof.webhook(...)`
  - `domainIdempotency(...)`
  - `requireDelegationBinding(...)`
  - backend-owned delivery idempotency through `runbookWebhookDeliveries`
- Started hardening example 07 `actingFor`:
  - MCP agent delegation must be backed by a live active `mcpKeys` row.
  - Webhook service delegation must match `runbook-webhook`,
    `runbook-webhook:create`, `workspace-service-policy`, and the target
    workspace user.
  - `appIdentity` rechecks that caller id and binding service id match before
    resolving delegated identity.
- Narrowed the `runbook-webhook` service definition to derived, table-restricted
  access over `runbookWebhookDeliveries`, `runbooks`, and `users`.
- Replaced the placeholder route test with HMAC/proof/idempotency handoff
  assertions.
- Updated the MCP reference integration tests so delegated MCP principals use a
  real `mcpKeys` row as binding evidence and delegated webhook writes call the
  webhook-specific mutation.
- Verification is pending.
- Partial verification:
  - In-process TypeScript compiler diagnostics for `examples/07-mcp-reference`
    reported no project-local diagnostics after the current fixes.
  - Static source-policy simulation on the changed example 07 files reported no
    banned delegation/trusted-auth/open-guard patterns.
- Focused test status:
  - `node ./node_modules/vitest/vitest.mjs run --config vitest.config.ts
    server/api/runbook-webhook.post.test.ts test/mcpReference.test.ts`
    successfully ran once and reported 9 passing tests / 6 failing tests.
  - Fixed the reported stale test import by switching from removed
    `createIdentityForwardingEnvelope` to
    `createIdentityForwardingEnvelopeArgs(...)`.
  - Fixed first-workspace onboarding by replacing the appIdentity-oriented
    `authRequired` runtime behavior so it enforces a non-anonymous caller
    without requiring appIdentity before the handler. The example 07 workspace
    bootstrap path now stays on `authRequired` and keeps `requireAuth(caller)`
    in the handler.
  - Fixed public/cross-tenant `db.get(id)` table inference for Convex test ids
    by teaching `getServiceTableFromId(...)` to recognize the
    `digits + tableName` id shape used by `convex-test`.
  - Updated `functions-defineHandler` unit expectations to match the corrected
    `authRequired` contract: authenticated callers without appIdentity may
    reach the handler, while `authorize` still fails without appIdentity.
- Failure: after the first example 07 test attempt, the local environment
  stopped spawning new processes with `Resource temporarily unavailable (os
  error 35)`. Even `pwd` could not spawn, so focused tests, typecheck, search,
  and diff checks could not run yet.
- Failure: the process limit recurred after the fixes above, so the focused
  example 07 tests still need to be rerun and confirmed green.
- Failure: after the authRequired/unit-test fixes, shell process creation still
  failed with `Resource temporarily unavailable (os error 35)`. In-process
  TypeScript diagnostics reported no changed-file diagnostics, but Vitest,
  example typecheck, security gates, and diff checks remain pending.
- Recovered verification:
  - `node ./node_modules/vitest/vitest.mjs run --config vitest.config.ts
    server/api/runbook-webhook.post.test.ts test/mcpReference.test.ts` passed:
    2 files / 15 tests.
  - `node ./node_modules/vitest/vitest.mjs run --project=unit
    tests/unit/functions-defineHandler.test.ts` passed: 1 file / 16 tests.
  - `node ./node_modules/vitest/vitest.mjs run --project=unit
    tests/unit/functions-defineTrellis.test.ts
    tests/unit/functions-defineHandler.test.ts` passed: 2 files / 59 tests.
  - `pnpm --dir examples/07-mcp-reference typecheck` passed.
  - `pnpm run build:module` passed.
  - `pnpm run check:security:source-policy` passed.
  - `pnpm run check:security:packed-exports` passed.
  - `pnpm run check:publish-surface` passed.
  - `git diff --check` passed.
- Current state:
  - Example 07 delegated MCP access and runbook webhook creation now have
    green focused tests, typecheck, source-policy, packed-export, and
    publish-surface coverage.
  - Continue with the next 0.3.0 implementation slice; this does not make the
    full 0.3.0 objective complete.

### 2026-06-04 Security Gate Wiring

- Wired the existing `test:security` command into:
  - `pnpm run check`
  - `pnpm run release:verify`
- Rationale:
  - 0.3.0 requires the local and release gates to run the security source
    policy, module build, and packed-export security checks.
  - This keeps the gate derived from source/build artifacts instead of adding a
    manual approval layer.
- Verification:
  - Package script assertion passed:
    `node -e "const s=require('./package.json').scripts; ..."` confirmed both
    `check` and `release:verify` include `pnpm run test:security`.
  - First `pnpm run test:security` attempt failed before security checks because
    pnpm wanted to repair `node_modules` after `package.json` changed and the
    sandbox could not resolve npm registry hosts.
  - Restored dependencies with `CI=true pnpm install` using network escalation;
    install completed with the lockfile unchanged.
  - `pnpm run test:security` passed:
    - `check:security:source-policy`
    - `build:module`
    - `check:security:packed-exports`
  - `git diff --check` passed.
- Current state:
  - The Phase 0 security gate now participates in both normal local checks and
    release verification.
  - Full `pnpm run check` and `pnpm run release:verify` are still broader
    release gates and have not been run in this slice.

### 2026-06-04 Security Gate Runtime Proof Expansion

- Strengthened `test:security` so it no longer only checks static policy and
  packed exports.
- Added the focused runtime/security proof group to `test:security`:
  - `functions-defineTrellis.test.ts`
  - `functions-defineHandler.test.ts`
  - `auth-access-context.test.ts`
  - `define-convex-tool.test.ts`
  - `mcp-convex-caller.test.ts`
  - `server-index-exports.test.ts`
  - `backend-index-exports.test.ts`
  - `mcp-index-exports.test.ts`
  - `example-webhook-security.test.ts`
  - `identity-forwarding-envelope.test.ts`
  - `identity-forwarding.test.ts`
  - `destructive-confirmation.test.ts`
  - `mcp-operation-binding.test.ts`
  - `mcp-descriptor-boundary.test.ts`
  - `mcp-definition-preflight.test.ts`
  - `mcp-invalid-bearer-throttle.test.ts`
  - `use-mcp-session.test.ts`
- Fixed stale webhook-security expectations:
  - The test no longer expects removed shared-secret helper usage.
  - It now asserts maintained webhook examples use
    `verifyHmacWebhookDelivery(...)`, do not use raw trusted auth, and that
    forwarded examples use `transportProof.webhook(...)`,
    `domainIdempotency(...)`, and `requireDelegationBinding(...)`.
- Verification:
  - Focused runtime group passed before wiring: 17 files / 178 tests.
  - Expanded `pnpm run test:security` passed:
    - source-policy check
    - module build
    - packed-export policy
    - 17 focused runtime/security test files / 178 tests
  - Script assertion passed: `check`, `release:verify`, and `test:security`
    all include the required security gate/runtime proof wiring.
  - `git diff --check` passed.
- Failure/recovery:
  - Because `package.json` changed, pnpm attempted dependency repair in the
    restricted sandbox and failed DNS resolution.
  - Restored `node_modules` with `CI=true pnpm install` using network
    escalation; the lockfile stayed up to date.

### 2026-06-04 Phase A Security Contract

- Added a deterministic Phase A security contract generator:
  - `scripts/generate-security-contract.mjs`
  - `scripts/lib/security-contract.mjs`
  - `security-contract.generated.json`
- Refactored source-policy checks into a shared helper so source policy and the
  contract do not drift:
  - `scripts/lib/security-source-policy.mjs`
  - `scripts/check-security-source-policy.mjs`
- Added package scripts:
  - `pnpm run security:contract`
  - `pnpm run check:security:contract`
- Wired `check:security:contract` into `test:security`.
- Added `tests/unit/security-contract.test.ts`.
- Contract scope:
  - public package exports
  - banned public export absence rules
  - source-policy roots and policies
  - source-policy violation count
  - focused runtime proof files
  - public `readTables`
  - backend function lane inventory
  - operation inventory
  - MCP tool inventory
- Explicitly deferred to Phase B:
  - verified route proof kind
  - trusted route idempotency source
  - delegation binding source
  - webhook verifier canonicalization metadata
  - service-subject contract metadata
- Verification:
  - `node scripts/check-security-source-policy.mjs` passed.
  - `node scripts/generate-security-contract.mjs --check` passed.
  - `node ./node_modules/vitest/vitest.mjs run --project=unit
    tests/unit/security-contract.test.ts` passed: 1 file / 2 tests.
  - `pnpm run test:security` passed:
    - source-policy check
    - security contract drift check
    - module build
    - packed-export policy
    - 18 focused runtime/security test files / 180 tests
  - Package script assertion passed and confirmed `test:security` runs the
    contract check and the contract unit test.
  - `git diff --check` passed.
- Failure/recovery:
  - After script changes, refreshed `node_modules` with `CI=true pnpm install`
    using network escalation so pnpm would not stop on non-TTY dependency
    repair during gate execution.

### 2026-06-04 Better Auth Session Sync Proof

- Confirmed the correct hook source from the installed Better Auth client:
  `authClient.$store.listen('$sessionSignal', ...)`.
- Kept session observation in `initAuthClient(...)` and Trellis state mutation
  in the shared auth engine:
  - `auth-client` observes Better Auth session signal changes.
  - `plugin.client` maps the signal to
    `authEngine.refreshAuth({ trigger: 'auth-session-signal' })`.
  - The engine performs the forced token exchange and is still the only writer
    for token/user/error state.
- Added `auth-session-signal` to the auth trigger vocabulary so logs and tests
  can distinguish session-driven refreshes from manual refreshes and auth
  actions.
- Added/expanded focused unit coverage:
  - `tests/unit/auth-client.test.ts` proves the transport ignores the initial
    Better Auth store notification and only forwards real signal changes.
  - `tests/unit/plugin-client-refresh.test.ts` proves a Better Auth session
    signal adopts a fresh token.
  - `tests/unit/plugin-client-refresh.test.ts` proves a Better Auth session
    signal with no Better Auth token clears stale Trellis token/user state.
- Failure/recovery:
  - An attempted plugin-level session bridge created a duplicate listener in
    focused tests. Removed it and kept one source of truth: the auth transport
    observes Better Auth, and the auth engine owns state writes.
  - `pnpm exec tsc --noEmit --pretty false` is not a valid repo gate here; it
    typechecks starter/fixture sources without generated Convex/Nuxt files and
    fails on missing generated modules. Use repo scripts instead.
  - `pnpm run typecheck` is not present in this package.
- Verification:
  - `pnpm exec vitest run --project=unit
    tests/unit/plugin-client-refresh.test.ts tests/unit/auth-client.test.ts`
    passed: 2 files / 9 tests.
  - `pnpm run test:security` passed:
    - source-policy check
    - security contract drift check
    - module build
    - packed-export policy
    - 18 focused runtime/security test files / 180 tests
- Current state:
  - Better Auth session mutation no longer relies on callers remembering to
    manually refresh Trellis auth state.
  - Phase 5 remains active until protected-navigation/session-switch and
    sign-out smoke are covered by the appropriate Nuxt/browser gates.

### 2026-06-04 Upstream-Authoritative Sign-Out Proof

- Changed sign-out ordering to match the 0.3.0 contract:
  - Begin a pending auth operation immediately and invalidate older refreshes.
  - Call upstream Better Auth `signOut()` before committing local logout.
  - Commit local token/user clearing only after upstream sign-out succeeds.
  - If upstream sign-out fails, keep the existing token/user represented,
    surface the auth error, clear pending, and skip local Convex invalidation.
  - If upstream sign-out succeeds but local transport invalidation fails, clear
    local token/user because Better Auth is already signed out, keep the error,
    and reject.
- Updated Nuxt auth tests away from the old fake-logout behavior:
  - `tests/nuxt/identity-continuity.nuxt.test.ts` now proves failed upstream
    sign-out leaves the real Better Auth session represented and does not call
    local invalidation.
  - `tests/nuxt/auth-engine.nuxt.test.ts` now proves pending sign-out keeps the
    existing session represented until upstream logout resolves.
- Finding:
  - The prior behavior was intentionally fail-closed but wrong for 0.3.0:
    a failed upstream logout could make Trellis look unauthenticated while the
    Better Auth session still existed. That is a confusing and unsafe source of
    truth split.
- Verification:
  - Focused Nuxt auth runtime pass:
    `pnpm exec vitest run --project=nuxt
    tests/nuxt/identity-continuity.nuxt.test.ts
    tests/nuxt/auth-engine.nuxt.test.ts
    tests/nuxt/useConvexAuthInternal.nuxt.test.ts
    tests/nuxt/owasp.nuxt.test.ts
    tests/nuxt/token-lifecycle.nuxt.test.ts`
    passed: 5 files / 38 tests.
  - Broader Nuxt auth smoke from the Trellis workspace:
    `pnpm exec vitest run --project=nuxt
    tests/nuxt/useConvexAuthFlow.nuxt.test.ts
    tests/nuxt/token-lifecycle.nuxt.test.ts
    tests/nuxt/useConvexAuthInternal.nuxt.test.ts
    tests/nuxt/owasp.nuxt.test.ts
    tests/nuxt/auth-engine.nuxt.test.ts
    tests/nuxt/configured-auth-bootstrap.nuxt.test.ts
    tests/nuxt/identity-continuity.nuxt.test.ts`
    passed: 7 files / 60 tests.
  - `pnpm run test:security` passed:
    - source-policy check
    - security contract drift check
    - module build
    - packed-export policy
    - 18 focused runtime/security test files / 180 tests
  - `git diff --check` passed.
- Current state:
  - Failed sign-out acceptance has focused Nuxt proof.
  - Phase 5 still needs stale protected-navigation proof before it can be
    treated as fully covered.
