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

| Phase                                                 | Status | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ----------------------------------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Phase -1: Prove risky mechanics                       | Active | Source-policy, raw DB, cross-tenant, and public DB runtime proofs have passing focused evidence                                                                                                                                                                                                                                                                                                                                                                                  |
| Phase 0: Freeze unsafe growth                         | Active | Source-policy, packed export gate, focused runtime security proofs, cross-tenant ban, touched example typechecks, maintained examples doctor, starter fixture doctor, and `test:security` wiring pass; broader release gates still pending                                                                                                                                                                                                                                       |
| Phase 1: Backend authority cutover                    | Active | `authenticated` and `workspace` backend lanes now exist with focused runtime proof; production-copyable workspace bootstrap and direct CLI operation scaffolds now use guardless app operations registered through `mutation.authenticated(...)`; `workspace(...)` now requires concrete permission metadata; `protected(...)` now refuses `guard: open`; duplicate permission matrix keys fail closed; broader protected operation registrations still need lane classification |
| Phase 2: Operations, replay, trusted proofs           | Active | Opaque transport proof cutover and framework JTI replay claim/complete/fail pass focused tests; domain idempotency remains app-owned and webhook recovery is still pending                                                                                                                                                                                                                                                                                                       |
| Phase 3: MCP cutover                                  | Active | Operation-backed consumer fixture proof now runs in `test:security`; broader release gates still pending                                                                                                                                                                                                                                                                                                                                                                         |
| Phase 4: Webhooks, delegation, server routes          | Active | HMAC helper parse-before-idempotency, example 04 backend delivery idempotency, example 03 delegation, and example 07 MCP/webhook delegation pass focused gates                                                                                                                                                                                                                                                                                                                   |
| Phase 5: Client auth lifecycle                        | Passed | Better Auth session sync, upstream-authoritative sign-out, stale protected navigation, auth proxy body handling, and Nuxt auth smoke have focused proof                                                                                                                                                                                                                                                                                                                          |
| Phase 6: Examples, docs, public surface, release gate | Active | Phase A security contract exists and is wired into `test:security`; maintained examples doctor, starter fixture doctor, consumer MCP fixture proof, proof inventory, route metadata, delegation metadata, webhook verifier metadata, and service replay/audit metadata pass; broader docs/release gates remain                                                                                                                                                                   |

## Proof Spike Ledger

| Spike                    | Status | Evidence                                                                                                                                                                                                                                                                                                                                                                     | Next step                                                                                        |
| ------------------------ | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Raw DB removal           | Passed | Handler-visible `ctx.db` no longer carries raw DB by reference, symbol, or descriptor; destructive internals still pass tests                                                                                                                                                                                                                                                | Remove `escapeIsolation` normal-lane API in cross-tenant capability spike                        |
| Public-safe DB facade    | Passed | Public `ctx.db` is read-only and table-limited; public writes require operation-backed `publicWrite` narrow methods and emit `db.public_write.used`                                                                                                                                                                                                                          | Keep regression coverage while moving to trusted proof/replay work                               |
| Strict evaluator         | Passed | Core auth and MCP checks require exact boolean results                                                                                                                                                                                                                                                                                                                       | Covered by expanded `test:security`; keep release gates green                                    |
| Cross-tenant capability  | Passed | Normal handler `ctx.db` no longer exposes `escapeIsolation`; named `crossTenant` capabilities are table-limited, read-only by default, and write mode requires operation metadata                                                                                                                                                                                            | Keep policy gate banning generic escape hatches and continue with public-safe DB facade proof    |
| Service subject          | Passed | Examples 03 and 07 configure webhook services as derived, table-restricted access scoped from `workspaceId`; core runtime proves unconfigured services fail before handler execution, unlisted tables deny with an observation event, and service callers cannot enter undeclared function refs; security contract and doctor now require replay/audit metadata              | Keep maintained example service metadata and target-scope proofs green                           |
| Trusted proof            | Passed | Server/MCP forwarding now uses branded `transportProof.*(...)`; raw `auth: 'trusted'` rejects before fetch; source policy scans the server helper                                                                                                                                                                                                                            | Keep proof-object coverage while finishing webhook/delegation lanes                              |
| Replay store             | Active | `jti-redemption` and `operation-confirmation` envelopes carry signed replay mode and use `trustedReplay` to claim before handler execution, then mark `completed` or `failed`; duplicate JTI tests execute the handler once; the security contract now inventories maintained example route-retry and backend duplicate-delivery proofs                                      | Decide whether webhook recovery needs framework support before marking complete                  |
| Webhook idempotency      | Active | `verifyHmacWebhookDelivery(...)` reads raw body once, rejects blank/stale/tampered deliveries, parses before idempotency; examples 03, 04, and 07 store delivery/idempotency rows with the business write; maintained example idempotency/retry proofs and verifier canonicalization metadata are now contract-visible                                                       | Keep maintained example proof inventory in `test:security` while finishing replay/audit metadata |
| Delegation binding       | Passed | `delegateToUser` is replaced by required binding evidence; examples 03 and 07 create short-lived bindings and Convex revalidates service/user/workspace/purpose/expiry before writing; doctor verifies maintained examples do not forward raw callers outside `transportProof.*(...)`; docs/API reference and maintained-example forged/expired/wrong-binding coverage exist | Keep delegation docs and maintained example tests green                                          |
| MCP operation migration  | Passed | Production-copyable MCP write tools, generated resource MCP create/delete tools, and consumer-style workspace MCP fixture tools use operation-backed bindings without public tool-local safety stamping                                                                                                                                                                      | Keep scaffold and starter proofs in `test:security`                                              |
| Better Auth sync         | Passed | Better Auth `$sessionSignal` is observed by the auth transport, routed through `authEngine.refreshAuth({ trigger: 'auth-session-signal' })`, and focused tests prove fresh-token adoption and stale-token clearing                                                                                                                                                           | Keep Nuxt auth smoke green                                                                       |
| Sign-out ordering        | Passed | Local logout now commits only after upstream Better Auth sign-out succeeds; failed upstream logout keeps the existing session represented with an auth error and skips local invalidation                                                                                                                                                                                    | Keep Nuxt auth smoke green                                                                       |
| Protected navigation     | Passed | Route middleware waits for session-driven refresh before deciding protected navigation and fails closed if auth remains pending                                                                                                                                                                                                                                              | Keep Nuxt auth smoke in release gates                                                            |
| Auth proxy body handling | Passed | DELETE bodies are forwarded, non-body methods with declared bodies reject before upstream fetch, and critical auth endpoints keep method-specific 405s                                                                                                                                                                                                                       | Covered by expanded `test:security`                                                              |
| Packed exports           | Passed | Stale `dist` failed with 25 banned public export violations; rebuilt package entries now pass packed export gate                                                                                                                                                                                                                                                             | Covered by expanded `test:security`; keep release gates green                                    |
| Security contract        | Passed | Phase A generated contract inventories public exports, banned export absence, source-policy rules, public read tables, service subjects with replay/audit metadata, maintained example proofs, server route metadata, delegation bindings, webhook verifier metadata, backend lanes, operations, MCP tools, and runtime proof files                                          | Keep contract drift check green through release gates                                            |

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
- Added service contract metadata to `defineServices(...)` as the service
  subject source of truth:
  - source and purpose
  - allowed operation ids and function refs
  - replay mode
  - acting-for allowance
  - audit event, audit table, and audit correlation id
- Added runtime service-target enforcement so a service principal can enter
  only handlers whose declared `identityForwardingFunctionRef` or operation
  metadata matches its configured service metadata.
- Updated maintained webhook services in examples 03 and 07 to colocate
  replay/audit metadata with their table-restricted service access.
- Updated doctor inventory and the generated security contract to fail service
  subjects without restricted access plus replay/audit/target metadata.
- Updated the advanced caller-model docs so the public `defineServices(...)`
  examples include required metadata and describe runtime target enforcement.
- Strengthened `release:pack` so the packed Trellis tarball is extracted and
  checked by the same unsafe packed-export policy used by `test:security`.
- Cut the bridge package over to the safe verified identity-forwarding wrapper
  so it no longer depends on raw context mutation helpers removed from the
  backend first-reader export.
- Wired production doctor gates for maintained examples and generated starter
  fixtures into `pnpm check` and `release:verify`, keeping the generated
  fixture validator as the single source of truth.
- Removed the internal first-reader caller sentinel from the public auth barrel:
  `@lupinum/trellis/auth` no longer exports `authRequired`,
  `isAuthRequiredGuard`, or `AuthRequiredGuard`; backend lane internals import
  the sentinel directly from `define-guard`.
- Updated permission docs to point application code at
  `authenticated(...)`, `workspace(...)`, or real custom `protected(...)`
  guards instead of `guard: authRequired`.
- Added the removed auth sentinel symbols to the packed-export security policy
  and security contract, and added `tests/unit/auth-index.test.ts` to
  `test:security` runtime proofs.
- Made the security contract generator normalize its generated JSON through
  `oxfmt` so the contract snapshot, drift check, and format gate share one
  output shape.
- Added the missing `guard.workspace_required` observability reason code type
  used by workspace lane denials.
- Verification passed for this slice:
  - `node_modules/.bin/vitest run --project=unit tests/unit/auth-index.test.ts tests/unit/auth-primitives.test.ts tests/unit/functions-defineHandler.test.ts tests/unit/security-contract.test.ts`
  - `node_modules/.bin/eslint src/runtime/auth/index.ts src/runtime/functions/index.ts src/runtime/observability/types.ts scripts/check-security-packed-exports.mjs scripts/lib/security-contract.mjs tests/unit/auth-index.test.ts tests/unit/auth-primitives.test.ts tests/unit/functions-defineHandler.test.ts tests/unit/security-contract.test.ts`
  - `node_modules/.bin/oxfmt --check src/runtime/auth/index.ts src/runtime/functions/index.ts src/runtime/observability/types.ts scripts/check-security-packed-exports.mjs scripts/lib/security-contract.mjs tests/unit/auth-index.test.ts tests/unit/auth-primitives.test.ts tests/unit/functions-defineHandler.test.ts tests/unit/security-contract.test.ts tests/types/authenticated-guard.types.ts apps/docs/content/docs/08.permissions/0.backend-builders.md apps/docs/content/docs/08.permissions/3.guards.md package.json security-contract.generated.json`
  - `CI=true pnpm run test:types:contracts`
  - `CI=true pnpm run check:security:contract`
  - `CI=true pnpm run check:docs:api-surface`
  - `CI=true pnpm run check:docs:links`
  - `CI=true pnpm run test:security`
  - `git diff --check`

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

- `node scripts/generate-security-contract.mjs --check`
  - Result: passed.
  - Interpretation: service replay/audit metadata and maintained-example
    service subjects are reflected in the generated contract.
- `pnpm exec vitest run --project=unit tests/unit/security-contract.test.ts tests/unit/functions-defineTrellis.test.ts tests/unit/cli-doctor.test.ts -t "service"`
  - Result: passed.
  - Evidence: 2 test files passed, 1 skipped; 5 focused service tests passed.
  - Interpretation: service metadata contract, doctor inventory, service table
    scoping, unconfigured service failure, and undeclared target-function
    failure are covered.
- `node_modules/.bin/eslint src/runtime/auth/define-services.ts src/runtime/auth/index.ts src/runtime/functions/index.ts src/cli/lib/inventory.ts src/cli/lib/inventory-findings.ts scripts/lib/security-contract.mjs tests/unit/security-contract.test.ts tests/unit/cli-doctor.test.ts tests/unit/functions-defineTrellis.test.ts examples/03-team-workspace/convex/auth/services.ts examples/07-mcp-reference/convex/auth/services.ts`
  - Result: passed.
- `node_modules/.bin/oxfmt --check ...`
  - Result: passed on the touched auth/runtime/CLI/contract/example/docs
    files.
- `CI=true pnpm run test:security`
  - Result: passed.
  - Evidence: source policy passed, security contract drift passed, module
    build succeeded, packed export policy passed, and 21 unit files / 221 tests
    passed.
- `pnpm run check:examples:doctor`
  - Result: passed.
  - Evidence: maintained examples 03, 04, 05, 06, 07, and 08 all completed with
    0 failures; examples 03 and 07 reported service subjects with static
    restricted access plus replay and audit metadata.
- `pnpm run test:docs`
  - Result: not run.
  - Evidence: package has no `test:docs` script.
- `pnpm run check:docs:api-surface`
  - Result: passed.
- `pnpm run check:docs:links`
  - Result: passed.
- `git diff --check`
  - Result: passed.
- `pnpm --dir packages/trellis-bridge run build`
  - Result: passed after replacing raw forwarding context mutation with
    `withVerifiedIdentityForwardingContext(...)` and tightening forwarded
    bridge caller subjects to canonical `Subject`.
- `pnpm run release:pack`
  - Result: failed before the bridge cutover, then passed.
  - Evidence: wrote 2 tarballs to `.pack/` and printed
    `[trellis] security packed export policy passed` from the extracted
    `@lupinum/trellis` tarball.
  - Interpretation: release pack now proves packed artifact unsafe exports, not
    only in-repo `dist` entries.
- `pnpm run check:packs:no-workspace-refs`
  - Result: passed.
  - Evidence: packed and inspected
    `lupinum-trellis-0.2.0.tgz` and `lupinum-trellis-bridge-0.2.0.tgz`.
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
- Initially fixed the lower-level route-side HMAC body reader so optional
  idempotency hooks ran after parse; this intermediate path was later deleted
  in the hard cutover to backend/domain-owned idempotency.
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

### 2026-06-04 Phase 5 Client Auth Lifecycle Completion

- Added stale protected-navigation proof:
  - `src/runtime/auth/middleware/route-protection.global.ts` now fails closed
    when protected navigation still has pending auth after any client wait.
  - `tests/nuxt/route-protection-middleware.nuxt.test.ts` proves protected
    navigation waits for a session-driven refresh, does not redirect while the
    refresh is unresolved, then redirects after the refresh settles
    unauthenticated.
- Fixed auth proxy method/body behavior:
  - DELETE is now treated as a body-capable auth proxy method.
  - Request bodies on non-body proxy methods now reject with
    `BCN_AUTH_PROXY_BODY_NOT_ALLOWED` before upstream fetch.
  - Critical endpoints still keep endpoint-specific method allow-lists and
    return 405 before proxying unsupported methods.
- Added focused auth proxy tests:
  - DELETE request bodies are read and forwarded.
  - GET request bodies are rejected before upstream fetch.
- Finding:
  - The old proxy path silently ignored DELETE bodies because it only read
    POST/PUT/PATCH bodies while advertising DELETE as an allowed generic auth
    proxy method. That could make supported Better Auth endpoints behave
    differently through Trellis than they do upstream.
- Verification:
  - `pnpm exec vitest run --project=unit
tests/unit/auth-proxy-handler.server.test.ts` passed: 1 file / 20 tests.
  - `pnpm exec vitest run --project=nuxt
tests/nuxt/route-protection-middleware.nuxt.test.ts` passed:
    1 file / 1 test.
  - Broader Nuxt auth smoke from the Trellis workspace:
    `pnpm exec vitest run --project=nuxt
tests/nuxt/useConvexAuthFlow.nuxt.test.ts
tests/nuxt/token-lifecycle.nuxt.test.ts
tests/nuxt/useConvexAuthInternal.nuxt.test.ts
tests/nuxt/owasp.nuxt.test.ts
tests/nuxt/auth-engine.nuxt.test.ts
tests/nuxt/configured-auth-bootstrap.nuxt.test.ts
tests/nuxt/identity-continuity.nuxt.test.ts
tests/nuxt/route-protection-middleware.nuxt.test.ts`
    passed: 8 files / 61 tests.
  - `pnpm run test:security` passed:
    - source-policy check
    - security contract drift check
    - module build
    - packed-export policy
    - 19 focused runtime/security test files / 200 tests
  - `git diff --check` passed.
- Current state:
  - Phase 5 acceptance is covered:
    - Other-tab/session-switch behavior: Better Auth `$sessionSignal` tests.
    - Failed sign-out behavior: upstream-authoritative sign-out Nuxt tests.
    - Stale protected navigation: route middleware Nuxt test.
    - Nuxt auth smoke from Trellis workspace: 8-file auth smoke pass.
    - Auth proxy DELETE/body behavior: unit proxy hardening tests.

### 2026-06-04 MCP Operation Migration Scaffold Proof

- Removed the stale public `stampMcpToolSafety` template from generated
  MCP-facing resources.
- MCP-enabled generated resources now create backend-owned operation metadata
  for both create and delete:
  - `createXOp` is an `operation.mutation(...)`.
  - `removeXOp` remains an `operation.destructive(...)`.
  - Generated `domain.create` and `domain.remove` bind through those operations.
  - Generated `server/mcp/tools/create-x.ts` and `delete-x.ts` both use
    `tool.operation(...)`.
- Added scaffold assertions proving the generated project-style create MCP tool:
  - uses `tool.operation(createProjectOp, ...)`;
  - executes through `executeOperationRef(...)`;
  - does not import or call `stampMcpToolSafety`.
- Finding:
  - Existing maintained MCP examples had mostly migrated, but the resource
    generator still produced new app code using the removed first-reader safety
    stamp helper. That would let unsafe 0.2-era MCP patterns regrow through
    fresh scaffolds.
- Verification:
  - `pnpm exec vitest run --project=unit
tests/unit/cli-add-resource.test.ts` passed: 1 file / 9 tests.
  - `pnpm exec vitest run --project=unit
tests/unit/cli-add-resource.test.ts
tests/unit/phase0-workspace-mcp-fixture.test.ts
tests/unit/mcp-descriptor-boundary.test.ts
tests/unit/define-convex-tool.test.ts` passed: 4 files / 45 tests.
  - `pnpm exec eslint src/cli/lib/resource.ts
tests/unit/cli-add-resource.test.ts` passed.
  - `pnpm run check:security:source-policy` passed.
  - `pnpm run test:security` passed:
    - source-policy check
    - security contract drift check
    - module build
    - packed-export policy
    - 20 focused runtime/security test files / 209 tests
- Current state:
  - MCP operation migration has consumer-style scaffold proof in the security
    gate.
  - Remaining active 0.3.0 work is service subject, replay/idempotency,
    delegation binding coverage, security contract Phase B, and broader
    examples/docs/release gates.

### 2026-06-04 Service Subject Runtime Proof

- Added core runtime regression coverage for service principals:
  - unconfigured service callers reject before handler execution;
  - global services remain table-restricted even when row-unscoped;
  - unlisted table access emits `service.access.denied` through Trellis
    observability.
- Confirmed maintained webhook service lanes:
  - example 03 `todo-sync-webhook` uses derived table access over
    `processedEvents`, `todos`, and `users`;
  - example 07 `runbook-webhook` uses derived table access over
    `runbookWebhookDeliveries`, `runbooks`, and `users`.
- Verification:
  - `pnpm exec vitest run --project=unit
tests/unit/functions-defineTrellis.test.ts` passed:
    1 file / 44 tests.
  - `pnpm exec vitest run --config vitest.config.ts
convex/todos.test.ts server/api/webhook.post.test.ts`
    in `examples/03-team-workspace` passed: 2 files / 17 tests.
  - `pnpm exec vitest run --config vitest.config.ts
test/mcpReference.test.ts server/api/runbook-webhook.post.test.ts`
    in `examples/07-mcp-reference` passed: 2 files / 15 tests.
  - `pnpm exec eslint tests/unit/functions-defineTrellis.test.ts` passed.
  - `pnpm run test:security` passed:
    - source-policy check
    - security contract drift check
    - module build
    - packed-export policy
    - 20 focused runtime/security test files / 210 tests
- Current state:
  - Service runtime/table scope has focused proof in `test:security`.
  - Service subject remains active until production doctor/replay/audit metadata
    coverage exists.

### 2026-06-04 Service Subject Contract Metadata

- Extended the generated security contract to inventory `defineServices(...)`
  declarations from source-controlled maintained apps and starter fixtures.
- The contract now records each service subject's file, line, export, service
  id, access mode, table list, tenant mode, and `deriveTenant` presence.
- Tightened the contract unit test to prove:
  - example 03 `todo-sync-webhook` is restricted, derived, and scoped to
    `processedEvents`, `todos`, and `users`;
  - example 07 `runbook-webhook` is restricted, derived, and scoped to
    `runbooks`, `runbookWebhookDeliveries`, and `users`;
  - no current source-controlled service subject is marked unrestricted.
- Updated the runtime proof file inventory to include the auth proxy and
  generated resource MCP operation scaffold tests now covered by
  `test:security`.
- Replaced the Phase B omission note for generic service-subject contract
  metadata with the narrower remaining gap:
  service-subject doctor/replay/audit metadata.
- Verification:
  - `pnpm exec vitest run --project=unit
tests/unit/security-contract.test.ts` passed: 1 file / 2 tests.
  - `pnpm exec eslint scripts/lib/security-contract.mjs
tests/unit/security-contract.test.ts` passed.
  - `pnpm run check:security:contract` passed.
  - `pnpm run test:security` passed:
    - source-policy check
    - security contract drift check
    - module build
    - packed-export policy
    - 20 focused runtime/security test files / 210 tests
- Current state:
  - Service-subject contract metadata is no longer deferred.
  - Service subject remains active until production doctor/replay/audit metadata
    coverage exists.

### 2026-06-04 Service Subject Doctor Metadata

- Extended the CLI doctor inventory with static `defineServices(...)` service
  subject rows.
- Doctor JSON now records each service subject's id, source, access mode, table
  list, tenant mode, and `deriveTenant` presence.
- Added `service-subject-access` doctor finding:
  - passes when no service subjects exist;
  - passes when all detected service subjects use static restricted table
    access;
  - fails on unrestricted or unknown service access, missing static table lists,
    missing tenant mode, or derived tenant access without `deriveTenant`.
- Added CLI doctor coverage proving:
  - a derived webhook service is inventoried as restricted with explicit tables;
  - an unrestricted service is inventoried and fails doctor through
    `service-subject-access`;
  - the finding sources point to the `serviceSubjects` inventory path.
- Updated the operation/tool agreement doctor assertion to match the current
  MCP scaffold cutover: generated workspace MCP apps now have operation-backed
  tools, so a new unbound destructive operation reports missing exact bindings
  instead of no operation-backed tools.
- Verification:
  - `pnpm run build:cli` passed.
  - `pnpm exec vitest run --project=unit tests/unit/cli-doctor.test.ts -t
"surfaces service subject inventory"` passed: 1 test, 60 skipped.
  - `pnpm exec vitest run --project=unit
tests/unit/cli-doctor.test.ts` passed: 1 file / 61 tests.
  - `pnpm exec eslint src/cli/lib/inventory.ts
src/cli/lib/inventory-findings.ts tests/unit/cli-doctor.test.ts` passed.
  - Focused `oxfmt --check` for touched CLI/security files passed.
  - `git diff --check` passed.
- Current state:
  - Service-subject doctor metadata is no longer deferred.
  - Service subject remains active until production replay/audit metadata
    coverage exists.

### 2026-06-04 Maintained Examples Doctor Gate

- Fixed the forwarded-caller doctor scanner false positive:
  - `caller` objects passed directly to `transportProof.server(...)`,
    `transportProof.webhook(...)`, or `transportProof.mcp(...)` are now treated
    as verified forwarding evidence.
  - colocated `*.test.*` and `*.spec.*` files under `server/` are ignored by
    the production-path scanner.
- Kept the raw misuse path intact:
  - raw server call options with `caller` still fail
    `forwarded-caller-trusted-path`.
- Added CLI doctor coverage for:
  - raw forwarded caller options failing doctor;
  - transport proof caller options passing doctor;
  - colocated server test fixtures not contributing production scanner
    findings.
- Verification:
  - `pnpm run build:cli` passed.
  - `pnpm exec vitest run --project=unit tests/unit/cli-doctor.test.ts -t
"transport proof objects|server call forwards caller"` passed:
    2 tests, 60 skipped.
  - `pnpm exec vitest run --project=unit
tests/unit/cli-doctor.test.ts` passed: 1 file / 62 tests.
  - `pnpm run check:examples:doctor` passed:
    examples 03, 04, 05, 06, 07, and 08 all completed with zero failures.
  - `pnpm exec eslint src/cli/lib/project.ts
tests/unit/cli-doctor.test.ts` passed.
  - Focused `oxfmt --check` for `src/cli/lib/project.ts` and
    `tests/unit/cli-doctor.test.ts` passed.
  - `git diff --check` passed.
- Current state:
  - Maintained examples doctor gate is green.
  - The remaining delegation-binding work is docs/API reference and missing
    forged/expired/wrong-binding negative coverage.

### 2026-06-04 Delegation Binding Negative Proof

- Added maintained example 07 negative coverage for forged service webhook
  delegation evidence:
  - wrong service id fails before the handler can treat the delegated user as
    valid;
  - wrong purpose fails before the write;
  - expired delegation evidence fails before the write.
- Existing example 03 coverage already proves:
  - signed service forwarding succeeds only with backend-valid delegation
    binding;
  - forged workspace binding rejects;
  - expired binding rejects.
- Updated the server API reference to document `requireDelegationBinding(...)`
  and the required backend-side `actingFor` revalidation responsibilities:
  expected service id, workspace, purpose, grant source, expiry, and app-owned
  state such as membership, MCP key binding, account connection, or revocation
  version.
- Verification:
  - `pnpm exec vitest run --config vitest.config.ts
test/mcpReference.test.ts` in `examples/07-mcp-reference` passed:
    1 file / 11 tests.
  - `pnpm exec eslint examples/07-mcp-reference/test/mcpReference.test.ts`
    passed.
  - `pnpm exec vitest run --project=unit
tests/unit/api-surface-doc.test.ts` passed: 1 file / 2 tests.
  - Focused `oxfmt --check` for the changed example test and server API
    reference doc passed.
- Current state:
  - Delegation binding spike is passed.
  - Remaining 0.3.0 work is replay/idempotency recovery, service replay/audit
    metadata, security contract Phase B metadata, and broader docs/consumer
    release gates.

### 2026-06-04 Maintained Example Proof Contract Metadata

- Extended the generated security contract with `maintainedExampleProofs` for
  replay/idempotency and delegation evidence in production-copyable examples.
- The contract now records proof id, file, test name, proof claims, and source
  line for:
  - example 03 route retry after backend dispatch failure;
  - example 03 backend duplicate webhook rejection;
  - example 03 forged and expired delegation rejection;
  - example 07 route retry after backend dispatch failure;
  - example 07 backend duplicate webhook rejection;
  - example 07 forged service/purpose delegation rejection.
- Tightened the contract unit test so the maintained example proof list is not
  silent drift: representative route retry, backend idempotency, and forged
  binding rows must stay present.
- Verification:
  - `pnpm exec oxfmt scripts/lib/security-contract.mjs
tests/unit/security-contract.test.ts` passed.
  - `pnpm exec vitest run --project=unit
tests/unit/security-contract.test.ts` passed: 1 file / 2 tests.
  - `pnpm run security:contract` regenerated
    `security-contract.generated.json`.
  - `pnpm run check:security:contract` passed.
  - `pnpm exec eslint scripts/lib/security-contract.mjs
tests/unit/security-contract.test.ts` passed.
  - `pnpm run test:security` passed:
    - source-policy check
    - security contract drift check
    - module build
    - packed-export policy
    - 20 focused runtime/security test files / 210 tests
- Current state:
  - Maintained example replay/idempotency and delegation proof metadata is
    covered by the security contract.
  - Replay store and webhook idempotency remain active until production
    replay/audit metadata and broader release gates are complete.

### 2026-06-04 Server Route Contract Metadata

- Extended the generated security contract with `serverRoutes` rows for tracked
  production `server/api` routes in the harness and maintained examples.
- Each route row records:
  - HTTP method inferred from the Nuxt route filename;
  - HMAC webhook verifier use;
  - transport proof kind;
  - replay mode declarations such as `domain-idempotency`;
  - delegation binding use;
  - route-side idempotency use;
  - forwarded Convex query/mutation/action calls;
  - raw trusted auth and explicit no-auth markers.
- Tightened the contract unit test to prove:
  - examples 03 and 07 webhook routes use HMAC verification,
    `transportProof.webhook(...)`, `domainIdempotency(...)`, and delegation
    binding;
  - example 04 uses HMAC verification with explicit unauthenticated internal
    forwarding and no transport proof;
  - no tracked route uses raw `auth: 'trusted'`.
- Removed route proof kind and trusted route idempotency source from the Phase B
  omission list.
- Verification:
  - `pnpm exec oxfmt scripts/lib/security-contract.mjs
tests/unit/security-contract.test.ts` passed.
  - `pnpm run security:contract` regenerated
    `security-contract.generated.json`.
  - `pnpm exec vitest run --project=unit
tests/unit/security-contract.test.ts` passed: 1 file / 2 tests.
  - `pnpm run check:security:contract` passed.
  - `pnpm exec eslint scripts/lib/security-contract.mjs
tests/unit/security-contract.test.ts` passed.
  - `pnpm run test:security` passed:
    - source-policy check
    - security contract drift check
    - module build
    - packed-export policy
    - 20 focused runtime/security test files / 210 tests
- Current state:
  - Server route metadata is no longer deferred from the security contract.
  - Security contract still needs delegation source detail, webhook verifier
    canonicalization metadata, and service replay/audit metadata before Phase B
    can be considered complete.

### 2026-06-04 Delegation Binding Contract Metadata

- Extended the generated security contract with `delegationBindings` rows for
  tracked `requireDelegationBinding({ ... })` calls.
- Each binding row records:
  - source file and line;
  - service id;
  - purpose;
  - grant source;
  - presence of grant id, expiry, reason, target user, and workspace fields.
- Tightened the contract unit test to prove the maintained example 03 and 07
  webhook bindings keep explicit service, purpose, grant source, grant id,
  expiry, reason, target user, and workspace evidence.
- Removed delegation binding source from the Phase B omission list.
- Verification:
  - `pnpm exec oxfmt scripts/lib/security-contract.mjs
tests/unit/security-contract.test.ts` passed.
  - `pnpm run security:contract` regenerated
    `security-contract.generated.json`.
  - `pnpm exec vitest run --project=unit
tests/unit/security-contract.test.ts` passed: 1 file / 2 tests.
  - `pnpm run check:security:contract` passed.
  - `pnpm exec eslint scripts/lib/security-contract.mjs
tests/unit/security-contract.test.ts` passed.
  - `pnpm run test:security` passed:
    - source-policy check
    - security contract drift check
    - module build
    - packed-export policy
    - 20 focused runtime/security test files / 210 tests
- Current state:
  - Delegation binding source metadata is no longer deferred from the security
    contract.
  - Security contract still needs webhook verifier canonicalization metadata and
    service replay/audit metadata before Phase B can be considered complete.

### 2026-06-04 Webhook Verifier Contract Metadata

- Extended the generated security contract with `webhookVerifier` metadata
  derived from `src/runtime/server/webhooks.ts`.
- The contract now records the HMAC verifier's:
  - helper and signature factory names;
  - `sha256` algorithm and `sha256=` prefix;
  - UTF-8 payload encoding;
  - `.` payload separator;
  - timestamp, delivery id, and raw body binding;
  - five-minute default tolerance;
  - seconds/milliseconds timestamp normalization;
  - single-value header requirement;
  - timing-safe comparison use;
  - raw body read path;
  - parse-before-idempotency ordering;
  - default signature, timestamp, and delivery id headers.
- Added the existing `tests/unit/server-boundaries.test.ts` HMAC boundary proof
  to `securityRuntimeProofs` and the `test:security` gate.
- Tightened the contract unit test so the verifier canonicalization facts and
  proof file cannot drift silently.
- Removed webhook verifier canonicalization metadata from the Phase B omission
  list.
- Verification:
  - `node_modules/.bin/oxfmt scripts/lib/security-contract.mjs
tests/unit/security-contract.test.ts package.json` passed.
  - `node scripts/generate-security-contract.mjs` regenerated
    `security-contract.generated.json`.
  - `node_modules/.bin/vitest run --project=unit
tests/unit/security-contract.test.ts tests/unit/server-boundaries.test.ts`
    passed: 2 files / 12 tests.
  - `node scripts/generate-security-contract.mjs --check` passed.
  - `node_modules/.bin/eslint scripts/lib/security-contract.mjs
tests/unit/security-contract.test.ts` passed.
  - `CI=true pnpm run test:security` passed after network escalation restored
    `node_modules`:
    - source-policy check
    - security contract drift check
    - module build
    - packed-export policy
    - 21 focused runtime/security test files / 220 tests
- Current state:
  - Webhook verifier canonicalization metadata is no longer deferred from the
    security contract.
  - Security contract still needs service replay/audit metadata before Phase B
    can be considered complete.

### 2026-06-04 Starter Fixture Doctor Gate

- Kept generated starter doctor validation in
  `scripts/check-starter-fixtures.mjs` as the single source of truth.
- Added explicit `check:starter-fixtures:doctor` package script and wired it
  into `pnpm check` after the maintained examples doctor gate.
- Wired both `check:examples:doctor` and `check:starter-fixtures:doctor` into
  `release:verify` immediately after `test:security`.
- Ignored the workspace-local `.pnpm-store/` cache that pnpm created while
  restoring dependencies for the doctor gates.
- Kept `check:starter-fixtures` as an alias to the explicit doctor gate so
  existing callers still run the production doctor proof.
- Verification:
  - `CI=true pnpm run check:starter-fixtures:doctor` passed after network
    escalation restored the pnpm dependency store:
    - public starter: 32 pass / 0 warn / 0 fail;
    - personal starter: 32 pass / 0 warn / 0 fail;
    - workspace starter: 32 pass / 0 warn / 0 fail;
    - workspace MCP starter: 32 pass / 0 warn / 0 fail.
  - `CI=true pnpm run check:examples:doctor` passed after network escalation
    restored the pnpm dependency store:
    - examples 03, 04, 05, 06, 07, and 08 all completed with zero failures.
  - Package-script assertion passed: `release:verify` runs `test:security`,
    then `check:examples:doctor`, then `check:starter-fixtures:doctor`, before
    the broader `test` and `test:e2e` gates.
- Current state:
  - The release acceptance item for starter fixtures passing production
    security doctor now has explicit normal-check and release-check gates.

### 2026-06-04 Consumer MCP Migration Gate

- Wired the existing consumer-style workspace MCP fixture proofs into
  `test:security`:
  - `tests/unit/operation-ref-codegen.test.ts`
  - `tests/unit/phase0-workspace-mcp-fixture.test.ts`
- Added those proof files to the generated security contract runtime proof
  inventory.
- The fixture proves:
  - generated operation and MCP tool refs come from the starter manifest;
  - MCP tools do not import Convex implementation files directly;
  - destructive MCP execute forwards through operation-execute with
    operation-confirmation replay metadata.
- Verification:
  - `node_modules/.bin/vitest run --project=unit
tests/unit/operation-ref-codegen.test.ts
tests/unit/phase0-workspace-mcp-fixture.test.ts
tests/unit/security-contract.test.ts` passed: 3 files / 7 tests.
  - `node scripts/generate-security-contract.mjs --check` passed.
  - `node_modules/.bin/eslint scripts/lib/security-contract.mjs
tests/unit/security-contract.test.ts tests/unit/operation-ref-codegen.test.ts
tests/unit/phase0-workspace-mcp-fixture.test.ts` passed.
  - `CI=true pnpm run test:security` passed:
    - source-policy check;
    - security contract drift check;
    - module build;
    - packed-export policy;
    - 23 focused runtime/security test files / 226 tests.
- Current state:
  - Consumer-style workspace MCP migration proof is now part of the focused
    security gate and generated contract.

### 2026-06-04 Backend Lane Cutover Runtime Surface

- Added first-class `authenticated` and `workspace` backend lanes across query,
  mutation, action, and internal builder containers.
- `authenticated(...)` injects the signed-in caller boundary internally instead
  of requiring app code to spell `guard: authRequired`.
- `workspace(...)` injects the same signed-in boundary and fails before
  `load`/`handler` when `appIdentity.workspaceId` is missing.
- Kept `protected(...)` available for custom guard predicates and migration-only
  code; examples/starters still need a hard cutover from legacy
  `protected(..., authRequired)` spelling.
- Updated backend builder and API reference docs to describe the new normal
  lane choice and treat `authRequired` as compatibility-only.
- Verification:
  - `node_modules/.bin/vitest run --project=unit
tests/unit/functions-defineTrellis.test.ts
tests/unit/functions-defineHandler.test.ts` passed: 2 files / 64 tests.
  - `node_modules/.bin/eslint src/runtime/functions/index.ts
src/runtime/functions/define-handler.ts tests/unit/functions-defineTrellis.test.ts`
    passed.
  - `pnpm run check:docs:links` passed.
  - `pnpm run check:docs:api-surface` passed.
  - `CI=true pnpm run test:security` passed:
    - source-policy check;
    - security contract drift check;
    - module build;
    - packed-export policy;
    - 23 focused runtime/security test files / 229 tests.
- Current state:
  - Phase 1 is active: the target lane surface exists and has runtime proof.
  - The next lane work is removing the operation API's need for a caller-boundary
    guard sentinel once operation definitions can declare the signed-in lane
    directly.

### 2026-06-04 Backend Lane Starter/Example Registration Cutover

- Migrated workspace bootstrap mutation registrations from
  `mutation.protected(createWorkspaceOp)` to
  `mutation.authenticated(createWorkspaceOp)` in maintained examples 03, 04,
  05, 07 and in the workspace / workspace-MCP starter fixtures.
- Kept the operation definitions' `guard: authRequired` sentinel in place for
  this slice because `operation.mutation(...)` still owned the old guard
  spelling in the copied examples at that point.
- Temporarily narrowed the signed-in lane builder rule so operation-backed
  definitions could carry only the current `authRequired` sentinel; this was
  removed in the following hard-cutover slice once the bootstrap operation
  definitions became guardless.
- Updated the storage URL docs sample from
  `query.protected({ guard: authRequired })` to `query.workspace(...)`.
- Verification:
  - `node_modules/.bin/vitest run --project=unit
tests/unit/functions-defineTrellis.test.ts` passed: 1 file / 50 tests.
  - `node_modules/.bin/eslint src/runtime/functions/index.ts
tests/unit/functions-defineTrellis.test.ts
examples/03-team-workspace/convex/features/workspaces/domain.ts
examples/04-saas-platform/convex/features/workspaces/domain.ts
examples/05-visibility-access/convex/features/workspaces/domain.ts
examples/07-mcp-reference/convex/features/workspaces/domain.ts
src/cli/starter-fixtures/workspace/convex/features/workspaces/domain.ts
src/cli/starter-fixtures/workspace-mcp/convex/features/workspaces/domain.ts`
    passed.
  - `CI=true pnpm run check:starter-fixtures:doctor` passed:
    - public starter: 32 pass / 0 warn / 0 fail;
    - personal starter: 32 pass / 0 warn / 0 fail;
    - workspace starter: 32 pass / 0 warn / 0 fail;
    - workspace MCP starter: 32 pass / 0 warn / 0 fail.
  - `CI=true pnpm run check:examples:doctor` passed for maintained examples
    03 through 08 with zero failures.
  - `pnpm run check:docs:links` passed.
  - `git diff --check` passed.
  - `CI=true pnpm run test:security` passed:
    - source-policy check;
    - security contract drift check;
    - module build;
    - packed-export policy;
    - 23 focused runtime/security test files / 231 tests.
- Current state:
  - Production-copyable `protected(..., authRequired)` workspace bootstrap
    registrations are cut over to the authenticated lane.
  - Follow-up hard-cutover removed the remaining bootstrap operation
    `authRequired` sentinels.

### 2026-06-04 Backend Lane Operation Sentinel Removal

- Removed `guard: authRequired` and the corresponding auth imports from the
  workspace bootstrap operations in maintained examples 03, 04, 05, 07 and the
  workspace / workspace-MCP starter fixtures.
- Removed the temporary signed-in-lane exception for operation-carried
  `authRequired`; `authenticated(...)` and `workspace(...)` now reject any
  explicit `guard` and own the signed-in boundary themselves.
- Replaced the focused runtime test with a guardless app-operation registration
  proof, while keeping the custom-guard rejection proof.
- Deleted the redundant `requireAuth(...)` call from example 07 workspace
  bootstrap because `mutation.authenticated(...)` already enforces the
  non-anonymous caller boundary before handler execution.
- Fixed example 05 and 07 direct typecheck failures caused by the stricter
  cross-tenant/public-write DB boundary:
  - capability factories receive `db` as `unknown`;
  - copied examples now cast at the narrow capability boundary before using the
    reviewed cross-scope reader/writer;
  - example 07 runbook public fallback uses `enforce(...)` for appIdentity
    narrowing before workspace/private reads.
- Verification:
  - `node_modules/.bin/vitest run --project=unit
tests/unit/functions-defineTrellis.test.ts` passed: 1 file / 50 tests.
  - `node_modules/.bin/eslint src/runtime/functions/index.ts
tests/unit/functions-defineTrellis.test.ts
examples/03-team-workspace/convex/features/workspaces/domain.ts
examples/04-saas-platform/convex/features/workspaces/domain.ts
examples/05-visibility-access/convex/features/workspaces/domain.ts
examples/07-mcp-reference/convex/features/workspaces/domain.ts
src/cli/starter-fixtures/workspace/convex/features/workspaces/domain.ts
src/cli/starter-fixtures/workspace-mcp/convex/features/workspaces/domain.ts`
    passed.
  - `CI=true pnpm run check:starter-fixtures:doctor` passed:
    - public starter: 32 pass / 0 warn / 0 fail;
    - personal starter: 32 pass / 0 warn / 0 fail;
    - workspace starter: 32 pass / 0 warn / 0 fail;
    - workspace MCP starter: 32 pass / 0 warn / 0 fail.
  - `CI=true pnpm run check:examples:doctor` passed for maintained examples
    03 through 08 with zero failures.
  - `pnpm --dir examples/03-team-workspace typecheck` passed.
  - `pnpm --dir examples/04-saas-platform typecheck` passed.
  - `pnpm --dir examples/05-visibility-access typecheck` passed after fixing
    the cross-tenant capability DB cast.
  - `pnpm --dir examples/07-mcp-reference typecheck` passed after fixing the
    cross-tenant/public-write DB casts and appIdentity narrowing.
  - `node_modules/.bin/eslint
examples/05-visibility-access/convex/features/articles/domain.ts
examples/07-mcp-reference/convex/features/mcpKeys/domain.ts
examples/07-mcp-reference/convex/features/runbooks/domain.ts
examples/07-mcp-reference/convex/features/users/domain.ts` passed.
  - `git diff --check` passed.
  - `CI=true pnpm run test:security` passed:
    - source-policy check;
    - security contract drift check;
    - module build;
    - packed-export policy;
    - 23 focused runtime/security test files / 231 tests.
- Current state:
  - Production-copyable workspace bootstrap operations are guardless app
    operations registered through the authenticated lane.
  - Remaining protected operation registrations should be classified by actual
    lane semantics next: custom guard, authenticated, workspace, public, or
    destructive preview/execute.

### 2026-06-04 Protected Lane Open Guard Rejection

- Made `protected(...)` reject `guard: open` at registration time. Open access
  now has one backend spelling: `public(...)`.
- Replaced protected-lane unit-test fixtures that only needed a permissive
  custom guard with an explicit `allowAll` guard so the tests continue to cover
  protected/custom-guard behavior without normalizing open access on protected
  handlers.
- Added a focused rejection proof for `runtime.query.protected({ guard: open
})`.
- Verification:
  - `node_modules/.bin/vitest run --project=unit
tests/unit/functions-defineTrellis.test.ts` passed: 1 file / 51 tests.
  - `node_modules/.bin/eslint src/runtime/functions/index.ts
tests/unit/functions-defineTrellis.test.ts` passed.
  - `git diff --check` passed.
  - `CI=true pnpm run test:security` passed:
    - source-policy check;
    - security contract drift check;
    - module build;
    - packed-export policy;
    - 23 focused runtime/security test files / 232 tests.
- Current state:
  - Public backend access is represented by `public(...)`; protected handlers
    require a real non-open guard.

### 2026-06-04 Direct Operation Scaffold Lane Cutover

- Updated `trellis add operation ...` scaffolds so new operation definitions no
  longer import or carry `guard: authRequired`.
- Registered generated destructive operation preview/execute handlers through
  `mutation.authenticated(...)`; the signed-in boundary now lives in the
  backend lane instead of the operation definition.
- Left resource scaffolds on `protected(...)` because they generate concrete
  permission guards rather than caller-boundary sentinels.
- Verification:
  - `pnpm run build` passed after rebuilding the CLI fixture artifacts required
    by CLI tests.
  - `node_modules/.bin/vitest run --project=unit
tests/unit/cli-doctor.test.ts tests/unit/functions-defineTrellis.test.ts`
    passed after rebuild: 2 files / 113 tests.
  - `node_modules/.bin/eslint src/cli/lib/init.ts
tests/unit/cli-doctor.test.ts src/runtime/functions/index.ts
tests/unit/functions-defineTrellis.test.ts` passed.
  - `git diff --check` passed.
  - `CI=true pnpm run test:security` passed:
    - source-policy check;
    - security contract drift check;
    - module build;
    - packed-export policy;
    - 23 focused runtime/security test files / 232 tests.
- Current state:
  - New direct operation scaffolds no longer introduce the legacy
    `authRequired` guard sentinel.

### 2026-06-04 Workspace Lane Permission Metadata Cutover

- Made the workspace backend lane consume concrete operation `permission`
  metadata as its guard when the metadata is a `definePermission(...)` object.
- Kept workspace lanes fail-closed for metadata-only permission keys: string
  permissions are rejected at registration time instead of becoming unenforced
  documentation.
- Moved workspace and workspace-MCP todo starter operations from
  `guard: ...` plus `query.protected(...)` / `mutation.protected(...)` to
  `permission: ...` plus `query.workspace(...)` / `mutation.workspace(...)`.
- Kept the personal starter on its explicit `isAuthenticated` protected guard
  because that guard proves `appIdentity` exists, while the authenticated lane
  only proves a non-anonymous caller.
- Updated public starter writes to use `operation.publicMutation(...)` and
  reviewed `publicWrite` capabilities instead of raw public `ctx.db` writes.
- Updated the workspace-MCP public MCP-key touch path to use `publicWrite`, with
  explicit public read table declarations for MCP key validation.
- Regenerated `security-contract.generated.json` after the runtime policy
  change.
- Verification:
  - `node_modules/.bin/vitest run --project=unit
tests/unit/functions-defineTrellis.test.ts
tests/unit/phase0-starter-manifest.test.ts` passed: 2 files / 58 tests.
  - `node_modules/.bin/eslint --no-warn-ignored
src/runtime/functions/index.ts
tests/unit/functions-defineTrellis.test.ts
tests/unit/phase0-starter-manifest.test.ts
tests/unit/cli-doctor.test.ts
src/cli/starter-fixtures/workspace/convex/features/todos/domain.ts
src/cli/starter-fixtures/workspace/convex/features/todos/operations.ts
src/cli/starter-fixtures/workspace-mcp/convex/features/todos/domain.ts
src/cli/starter-fixtures/workspace-mcp/convex/features/todos/operations.ts
src/cli/starter-fixtures/workspace-mcp/convex/features/mcpKeys/domain.ts
src/cli/starter-fixtures/workspace-mcp/convex/functions.ts` passed.
  - `CI=true pnpm run check:starter-fixtures:build` passed:
    - public starter: doctor 32 pass / 0 warn / 0 fail; install, codegen,
      prepare, typecheck, and build passed;
    - personal starter: doctor 32 pass / 0 warn / 0 fail; install, codegen,
      prepare, typecheck, and build passed;
    - workspace starter: doctor 32 pass / 0 warn / 0 fail; install, codegen,
      prepare, typecheck, and build passed;
    - workspace MCP starter: doctor 32 pass / 0 warn / 0 fail; install,
      codegen, prepare, typecheck, and build passed.
  - `CI=true pnpm run test:security` passed:
    - source-policy check;
    - security contract drift check;
    - module build;
    - packed-export policy;
    - 23 focused runtime/security test files / 234 tests.
- Current state:
  - Workspace starter fixtures now model workspace permission checks through the
    workspace lane, without keeping protected-lane and workspace-lane paths side
    by side.
  - Public starter writes remain possible only through named, reviewed
    `publicWrite` capabilities.

### 2026-06-04 Duplicate Permission Matrix Key Rejection

- Made `buildPermissionMatrix(...)` reject duplicate permission keys before
  projection filtering.
- Added regression coverage for both duplicate projected permissions and a
  projected/internal duplicate hidden by `project: false`.
- Added `tests/unit/auth-primitives.test.ts` to `test:security` so primitive
  auth invariants stay in the security gate.
- Regenerated `security-contract.generated.json` so the proof-file inventory
  includes the added primitive test file.
- Verification:
  - `node_modules/.bin/vitest run --project=unit
tests/unit/auth-primitives.test.ts` passed: 1 file / 24 tests.
  - `node_modules/.bin/eslint src/runtime/auth/build-permission-matrix.ts
tests/unit/auth-primitives.test.ts` passed.
  - `CI=true pnpm run test:security` passed:
    - source-policy check;
    - security contract drift check;
    - module build;
    - packed-export policy;
    - 24 focused runtime/security test files / 258 tests.
- Current state:
  - Permission projection now has one key source of truth at runtime; duplicate
    keys cannot silently collapse into ambiguous client/MCP-visible rows.

### 2026-06-04 Workspace Lane Permission Requirement

- Removed the workspace lane's fallback to the `authRequired` sentinel when a
  handler or operation omitted `permission`.
- `query.workspace(...)` / `mutation.workspace(...)` now reject registration
  unless `permission` is a concrete `definePermission(...)` object.
- Kept authenticated/onboarding flows on `authenticated(...)`; workspace lanes
  now represent workspace identity plus explicit permission, matching the 0.3.0
  authority model.
- Updated backend-builder, guard, file-upload, and API-reference docs so
  examples include concrete permissions on workspace lanes.
- Verification:
  - `node_modules/.bin/vitest run --project=unit
tests/unit/functions-defineTrellis.test.ts
tests/unit/phase0-starter-manifest.test.ts` passed: 2 files / 59 tests.
  - `node_modules/.bin/eslint src/runtime/functions/index.ts
tests/unit/functions-defineTrellis.test.ts` passed.
  - `node_modules/.bin/oxfmt --check src/runtime/functions/index.ts
tests/unit/functions-defineTrellis.test.ts
apps/docs/content/docs/08.permissions/0.backend-builders.md
apps/docs/content/docs/08.permissions/3.guards.md
apps/docs/content/docs/06.file-uploads/3.storage-urls.md
apps/docs/content/docs/13.api-reference/3.functions.md` passed.
  - `CI=true pnpm run check:docs:api-surface` passed.
  - `CI=true pnpm run check:docs:links` passed.
  - `CI=true pnpm run test:security` passed:
    - source-policy check;
    - security contract drift check;
    - module build;
    - packed-export policy;
    - 24 focused runtime/security test files / 259 tests.
  - `CI=true pnpm run check:starter-fixtures:build` passed:
    - public starter: doctor 32 pass / 0 warn / 0 fail; install, codegen,
      prepare, typecheck, and build passed;
    - personal starter: doctor 32 pass / 0 warn / 0 fail; install, codegen,
      prepare, typecheck, and build passed;
    - workspace starter: doctor 32 pass / 0 warn / 0 fail; install, codegen,
      prepare, typecheck, and build passed;
    - workspace MCP starter: doctor 32 pass / 0 warn / 0 fail; install,
      codegen, prepare, typecheck, and build passed.
- Current state:
  - Workspace lanes no longer degrade to signed-in-only authority when
    permission metadata is missing.

### 2026-06-04 Route-Side Webhook Idempotency Helper Removal

- Deleted the shared-secret webhook body reader and lower-level
  route-side-idempotency HMAC body reader from `src/runtime/server/webhooks.ts`.
- Removed `isSharedSecretWebhookSignatureValid`,
  `readHmacVerifiedWebhookBody`, and `ReadHmacVerifiedWebhookBodyOptions` from
  the public server barrel.
- Kept the single first-reader route helper:
  `verifyHmacWebhookDelivery(event, options)`, which verifies timestamp,
  delivery id, and raw body-bound HMAC, then parses the payload.
- Strengthened the source policy, packed-export policy, and generated security
  contract so shared-secret helpers and route-side webhook idempotency helpers
  cannot reappear on production-copyable/public server surfaces.
- Updated webhook security proof metadata from the obsolete
  `parsesBeforeIdempotency` fact to the stronger
  `routeSideIdempotencyHook: 'absent'` fact.
- Verification:
  - `node_modules/.bin/vitest run --project=unit tests/unit/server-boundaries.test.ts tests/unit/server-index-exports.test.ts tests/unit/example-webhook-security.test.ts tests/unit/security-contract.test.ts`
    passed: 4 files / 15 tests.
  - `node_modules/.bin/eslint src/runtime/server/webhooks.ts src/runtime/server/index.ts scripts/lib/security-source-policy.mjs scripts/check-security-packed-exports.mjs scripts/lib/security-contract.mjs tests/unit/server-boundaries.test.ts tests/unit/server-index-exports.test.ts tests/unit/example-webhook-security.test.ts tests/unit/security-contract.test.ts`
    passed.
  - `node_modules/.bin/oxfmt --check src/runtime/server/webhooks.ts src/runtime/server/index.ts scripts/lib/security-source-policy.mjs scripts/check-security-packed-exports.mjs scripts/lib/security-contract.mjs tests/unit/server-boundaries.test.ts tests/unit/server-index-exports.test.ts tests/unit/example-webhook-security.test.ts tests/unit/security-contract.test.ts security-contract.generated.json`
    passed.
  - `CI=true pnpm run check:security:contract` passed.
  - `CI=true pnpm run check:docs:api-surface` passed.
  - `CI=true pnpm run test:types:contracts` passed.
  - `CI=true pnpm run test:security` passed:
    - source-policy check;
    - security contract drift check;
    - module build;
    - packed-export policy;
    - 25 focused runtime/security test files / 255 tests.
- Current state:
  - Webhook route verification no longer has a public route-side consume hook.
  - Delivery idempotency remains a backend/domain mutation responsibility,
    colocated with the business write or framework replay store.

### 2026-06-04 Access Context Public Lane Cutover

- Removed the redundant `guard: open` property from
  `defineAccessContext(...)` definitions.
- Converted maintained access-context registrations from
  `query.protected(...)` to `query.public(...)`.
- Added explicit `public.readTables` declarations for public access-context
  and already-public catalog/share-token/MCP-key reads in examples and starter
  fixtures.
- Kept the public lane strict: public handlers still reject caller-provided
  guards, and protected handlers still reject `guard: open`.
- Tightened the multi-workspace example's cross-tenant access factories so they
  accept the framework callback shape and cast only the local DB aliases they
  use.
- Verification:
  - `node_modules/.bin/vitest run --project=unit
tests/unit/auth-access-context.test.ts tests/unit/functions-defineTrellis.test.ts
tests/unit/security-contract.test.ts` passed: 3 files / 61 tests.
  - `pnpm exec vitest run --config vitest.config.ts convex/todos.test.ts
server/api/webhook.post.test.ts` in `examples/03-team-workspace` passed:
    2 files / 17 tests.
  - `pnpm --dir examples/03-team-workspace typecheck` passed.
  - `pnpm --dir examples/04-saas-platform typecheck` passed.
  - `pnpm --dir examples/05-visibility-access typecheck` passed.
  - `pnpm --dir examples/06-multi-workspace typecheck` passed.
  - `pnpm --dir examples/07-mcp-reference typecheck` passed.
  - ESLint passed for the touched access-context, function-registration,
    multi-workspace, and todo-domain files.
  - `node_modules/.bin/oxfmt --check` passed for the same touched files.
  - `CI=true pnpm run security:contract` regenerated
    `security-contract.generated.json`.
  - `CI=true pnpm run check:security:contract` passed.
  - `CI=true pnpm run test:types:contracts` passed.
  - `CI=true pnpm run test:security` passed:
    - source-policy check;
    - security contract drift check;
    - module build;
    - packed-export policy;
    - 25 focused runtime/security test files / 255 tests.
  - `CI=true pnpm run check:starter-fixtures:build` passed:
    - public starter: doctor 32 pass / 0 warn / 0 fail; install, codegen,
      prepare, typecheck, and build passed;
    - personal starter: doctor 32 pass / 0 warn / 0 fail; install, codegen,
      prepare, typecheck, and build passed;
    - workspace starter: doctor 32 pass / 0 warn / 0 fail; install, codegen,
      prepare, typecheck, and build passed;
    - workspace MCP starter: doctor 32 pass / 0 warn / 0 fail; install,
      codegen, prepare, typecheck, and build passed.
- Current state:
  - Access context has one registration path: public query lane plus explicit
    public read-table policy.
  - The stale protected-open access-context path is gone from maintained
    examples and starter fixtures.

### 2026-06-04 Guardless Destructive Preview Workspace Cutover

- Made `previewOf(...)` preserve operation `permission` metadata and omit
  `guard` when the source operation has no guard.
- Tightened app operation projection so guardless app operations do not carry an
  optional guard slot in their public type.
- Moved the example 03 todo destructive preview and execute registrations from
  `mutation.protected(...)` to `mutation.workspace(...)`.
- Removed the duplicate `guard: todoRead` from the destructive todo operation;
  `permission: todoRead` is now the single authority source for preview and
  execute.
- Added a unit proof that guardless destructive app operations can register both
  preview and execute through workspace lanes.
- Verification:
  - `node_modules/.bin/vitest run --project=unit tests/unit/functions-defineTrellis.test.ts tests/unit/app-index-exports.test.ts`
    passed: 2 files / 63 tests.
  - `CI=true pnpm run test:types:contracts` passed.
  - `pnpm --dir examples/03-team-workspace typecheck` passed.
  - `pnpm exec vitest run --config vitest.config.ts convex/todos.test.ts server/api/webhook.post.test.ts`
    in `examples/03-team-workspace` passed: 2 files / 17 tests.
  - ESLint passed for touched app, operation, todo-domain, and focused test
    files.
  - `node_modules/.bin/oxfmt --check` passed for the same touched files.
  - `CI=true pnpm run security:contract` regenerated
    `security-contract.generated.json`.
  - `CI=true pnpm run check:security:contract` passed.
  - `CI=true pnpm run test:security` passed:
    - source-policy check;
    - security contract drift check;
    - module build;
    - packed-export policy;
    - 25 focused runtime/security test files / 256 tests.
- Current state:
  - Destructive app operation previews can share the same workspace-lane
    permission source as execute handlers.
  - Example 03 todo destructive preview/execute no longer keep protected-lane
    and workspace-lane authority paths side by side.

### 2026-06-04 Example 04 Project Workspace Lane Cutover

- Converted the example 04 project feature from protected-lane registrations
  to workspace-lane registrations:
  - `query.workspace(...)` for project list, get, and export.
  - `mutation.workspace(...)` for project create, archive preview, and archive
    execute.
- Replaced project operation `guard` metadata with concrete `permission`
  metadata for list, get, create, and export.
- Removed the duplicate `guard: projectArchive` from the destructive archive
  operation; `permission: projectArchive` is now the single authority source
  for preview and execute.
- Added explicit `requireAuth(...)` narrowing before touched handlers read
  `appIdentity.userId`.
- Regenerated `security-contract.generated.json`; the contract now records the
  project operations as guardless and no longer lists project-domain protected
  backend lane entries.
- Verification:
  - `pnpm --dir examples/04-saas-platform typecheck` passed.
  - `pnpm exec vitest run --config vitest.config.ts convex/projectBoard.test.ts`
    in `examples/04-saas-platform` passed: 1 file / 12 tests.
  - `node_modules/.bin/vitest run --project=unit tests/unit/functions-defineTrellis.test.ts tests/unit/security-contract.test.ts`
    passed: 2 files / 57 tests.
  - ESLint passed for the touched project domain and operation files.
  - `node_modules/.bin/oxfmt --check` passed for the touched project domain and
    operation files.
  - `CI=true pnpm run security:contract` regenerated
    `security-contract.generated.json`.
  - `CI=true pnpm run check:security:contract` passed.
  - `CI=true pnpm run test:security` passed:
    - source-policy check;
    - security contract drift check;
    - module build;
    - packed-export policy;
    - 25 focused runtime/security test files / 256 tests.
- Current state:
  - Example 04 project authority is no longer split between operation guards and
    workspace-lane permissions.
  - The project feature no longer has `query.protected(...)`,
    `mutation.protected(...)`, or `guard: project*` registrations.

### 2026-06-04 Example 04 Task Workspace Lane Cutover

- Converted the example 04 task feature from protected-lane registrations to
  workspace-lane registrations:
  - `query.workspace(...)` for task list, get, and export reads.
  - `mutation.workspace(...)` for task create, move, assign, bulk update,
    remove preview, and remove execute.
- Replaced task operation `guard` metadata with concrete `permission` metadata.
- Added `task.update` as the named outer permission for task movement and bulk
  status updates, replacing the inline
  `hasWorkspace.and(hasRole('owner', 'admin', 'member'))` guard.
- Removed the duplicate `guard: taskRead` from the destructive remove operation;
  `permission: taskRead` is now the lane source for preview and execute.
- Added explicit `requireAuth(...)` narrowing before touched handlers read
  `appIdentity.userId`.
- Regenerated `security-contract.generated.json`; the contract no longer lists
  task-domain protected backend lane entries and records task operations as
  guardless.
- Verification:
  - `pnpm --dir examples/04-saas-platform typecheck` passed.
  - `pnpm exec vitest run --config vitest.config.ts convex/projectBoard.test.ts`
    in `examples/04-saas-platform` passed: 1 file / 12 tests.
  - `node_modules/.bin/vitest run --project=unit tests/unit/permissions-codegen.test.ts tests/unit/permission-metadata.test.ts tests/unit/security-contract.test.ts tests/unit/functions-defineTrellis.test.ts`
    passed: 4 files / 61 tests.
  - ESLint passed for the touched task domain, operation, permission, and index
    files.
  - `node_modules/.bin/oxfmt --check` passed for the same touched task files.
  - `CI=true pnpm run security:contract` regenerated
    `security-contract.generated.json`.
  - `CI=true pnpm run check:security:contract` passed.
  - `CI=true pnpm run test:security` passed:
    - source-policy check;
    - security contract drift check;
    - module build;
    - packed-export policy;
    - 25 focused runtime/security test files / 256 tests.
- Current state:
  - Example 04 task authority is no longer split between operation guards and
    workspace-lane permissions.
  - The task feature no longer has `query.protected(...)`,
    `mutation.protected(...)`, or task inline guard registrations.

### 2026-06-04 Example 04 Comment Workspace Lane Cutover

- Converted the example 04 comment feature from protected-lane registrations to
  workspace-lane registrations:
  - `query.workspace(...)` for comment list-by-task.
  - `mutation.workspace(...)` for comment create.
- Replaced comment operation `guard` metadata with concrete `permission`
  metadata.
- Used the existing task read permission as the authority source for comment
  listing, since comments are task-child reads.
- Kept `commentCreate` as the authority source for comment creation.
- Added explicit `requireAuth(...)` narrowing before the create handler reads
  `appIdentity.userId`.
- Regenerated `security-contract.generated.json`; the contract no longer lists
  comment-domain protected backend lane entries and records comment operations
  as guardless.
- Verification:
  - `pnpm --dir examples/04-saas-platform typecheck` passed.
  - `pnpm exec vitest run --config vitest.config.ts convex/projectBoard.test.ts`
    in `examples/04-saas-platform` passed: 1 file / 12 tests.
  - `node_modules/.bin/vitest run --project=unit tests/unit/security-contract.test.ts tests/unit/functions-defineTrellis.test.ts tests/unit/permissions-codegen.test.ts tests/unit/permission-metadata.test.ts`
    passed: 4 files / 61 tests.
  - ESLint passed for the touched comment domain file.
  - `node_modules/.bin/oxfmt --check` passed for the touched comment domain
    file.
  - `CI=true pnpm run security:contract` regenerated
    `security-contract.generated.json`.
  - `CI=true pnpm run check:security:contract` passed.
  - `CI=true pnpm run test:security` passed:
    - source-policy check;
    - security contract drift check;
    - module build;
    - packed-export policy;
    - 25 focused runtime/security test files / 256 tests.
- Current state:
  - Example 04 comment authority is no longer split between operation guards and
    workspace-lane permissions.
  - The comment feature no longer has `query.protected(...)`,
    `mutation.protected(...)`, or `guard:` registrations.

### 2026-06-04 Example 04 Member Workspace Lane Cutover

- Converted the example 04 member listing feature from `query.protected(...)`
  to `query.workspace(...)`.
- Replaced `guard: projectRead` with `permission: projectRead`; member listing
  now shares the project-read workspace permission source instead of keeping a
  protected-lane guard path.
- Regenerated `security-contract.generated.json`; the contract no longer lists
  the member-domain protected backend lane entry and records the member list
  operation as guardless.
- Verification:
  - `pnpm --dir examples/04-saas-platform typecheck` passed.
  - `pnpm exec vitest run --config vitest.config.ts convex/projectBoard.test.ts`
    in `examples/04-saas-platform` passed: 1 file / 12 tests.
  - `node_modules/.bin/vitest run --project=unit tests/unit/security-contract.test.ts tests/unit/functions-defineTrellis.test.ts`
    passed: 2 files / 57 tests.
  - ESLint passed for the touched member domain file.
  - `node_modules/.bin/oxfmt --check` passed for the touched member domain
    file.
  - `CI=true pnpm run security:contract` regenerated
    `security-contract.generated.json`.
  - `CI=true pnpm run check:security:contract` passed.
  - `CI=true pnpm run test:security` passed:
    - source-policy check;
    - security contract drift check;
    - module build;
    - packed-export policy;
    - 25 focused runtime/security test files / 256 tests.
- Current state:
  - Example 04 member authority is no longer split between operation guards and
    workspace-lane permissions.
  - The member feature no longer has `query.protected(...)` or `guard:`
    registrations.

### 2026-06-04 Example 06 Membership Workspace Lane Cutover

- Converted the example 06 membership listing feature from
  `query.protected(...)` to `query.workspace(...)`.
- Replaced `guard: membershipRead` with `permission: membershipRead`; member
  listing now uses the workspace-lane permission source directly.
- While verifying the slice, the example 06 runtime test exposed workspace
  bootstrap and workspace-switch mutations still registered on the public lane
  while writing through `ctx.db`.
- Moved `createWorkspaceMutation` and `switchWorkspace` from
  `mutation.public(...)` to `mutation.authenticated(...)`, matching the
  existing workspace bootstrap pattern in examples 03/04 and starter fixtures.
- Regenerated `security-contract.generated.json`; the contract no longer lists
  the membership-domain protected backend lane entry or public lane entries for
  the workspace bootstrap/switch writes, and records the membership list
  operation as guardless.
- Verification:
  - `pnpm --dir examples/06-multi-workspace typecheck` passed.
  - `pnpm exec vitest run --config vitest.config.ts convex/agency.test.ts` in
    `examples/06-multi-workspace` passed: 1 file / 5 tests.
  - `node_modules/.bin/vitest run --project=unit tests/unit/security-contract.test.ts tests/unit/functions-defineTrellis.test.ts`
    passed: 2 files / 57 tests.
  - ESLint passed for the touched membership and workspace domain files.
  - `node_modules/.bin/oxfmt --check` passed for the touched membership and
    workspace domain files.
  - `CI=true pnpm run security:contract` regenerated
    `security-contract.generated.json`.
  - `CI=true pnpm run check:security:contract` passed.
  - `CI=true pnpm run test:security` passed:
    - source-policy check;
    - security contract drift check;
    - module build;
    - packed-export policy;
    - 25 focused runtime/security test files / 256 tests.
- Current state:
  - Example 06 membership listing authority is no longer split between
    operation guards and workspace-lane permissions.
  - Example 06 workspace bootstrap/switch writes no longer use the public lane.
  - The membership feature no longer has `query.protected(...)` or `guard:`
    registrations.

### 2026-06-04 Example 06 Project Workspace Lane Cutover

- Converted the example 06 project feature from protected-lane registrations
  to workspace-lane registrations:
  - `query.workspace(...)` for project listing.
  - `mutation.workspace(...)` for project create and status toggle.
- Replaced project operation `guard` metadata with concrete `permission`
  metadata:
  - `projectRead` for listing.
  - `projectCreate` for create and status toggle.
- Regenerated `security-contract.generated.json`; the contract no longer lists
  the example 06 project-domain protected backend lane entries and records
  project operations as guardless.
- Verification:
  - `pnpm --dir examples/06-multi-workspace typecheck` passed.
  - `pnpm exec vitest run --config vitest.config.ts convex/agency.test.ts` in
    `examples/06-multi-workspace` passed: 1 file / 5 tests.
  - `node_modules/.bin/vitest run --project=unit tests/unit/security-contract.test.ts tests/unit/functions-defineTrellis.test.ts`
    passed: 2 files / 57 tests.
  - ESLint passed for the touched project domain file.
  - `node_modules/.bin/oxfmt --check` passed for the touched project domain
    file.
  - `CI=true pnpm run security:contract` regenerated
    `security-contract.generated.json`.
  - `CI=true pnpm run check:security:contract` passed.
  - `CI=true pnpm run test:security` passed:
    - source-policy check;
    - security contract drift check;
    - module build;
    - packed-export policy;
    - 25 focused runtime/security test files / 256 tests.
- Current state:
  - Example 06 project authority is no longer split between operation guards and
    workspace-lane permissions.
  - The project feature no longer has `query.protected(...)`,
    `mutation.protected(...)`, or `guard:` registrations.

### 2026-06-04 Example 05 Article Workspace Lane Cutover

- Converted the example 05 article feature from protected-lane registrations to
  workspace-lane registrations:
  - `query.workspace(...)` for article list and authenticated article view.
  - `mutation.workspace(...)` for article create, publish, completion marking,
    share-token create, share-token revoke preview/execute, and demo seeding.
- Replaced article operation `guard` metadata with concrete `permission`
  metadata:
  - `articleRead` for listing, authenticated view, and completion marking.
  - `articleCreate` for create, publish, and demo seeding.
  - `shareCreate` for share-token creation.
- Removed the duplicate `guard: shareCreate` from the destructive share-token
  revoke operation; `permission: shareCreate` is now the single authority
  source for preview and execute.
- Split the old mixed public article view into two explicit lanes:
  - `view` is now the authenticated workspace article read.
  - `viewShared` is the public share-token read and only uses the narrow
    cross-tenant share-token resolver.
- Kept example 05 `public.readTables` unchanged instead of adding private
  knowledge-base, enrollment, progress, or article-share tables to public
  reads.
- Updated the article page and runtime tests so token links call `viewShared`
  and normal app navigation calls `view`.
- Regenerated `security-contract.generated.json`; the contract no longer lists
  article-domain protected backend lane entries and records the article
  operations as guardless.
- Verification:
  - `pnpm --dir examples/05-visibility-access typecheck` passed.
  - `pnpm exec vitest run --config vitest.config.ts convex/knowledgeBase.test.ts`
    in `examples/05-visibility-access` passed: 1 file / 20 tests.
  - `node_modules/.bin/vitest run --project=unit tests/unit/security-contract.test.ts tests/unit/functions-defineTrellis.test.ts`
    passed: 2 files / 57 tests.
  - ESLint passed for the touched article domain, operation, contract, page, and
    runtime test files.
  - `node_modules/.bin/oxfmt --check` passed for the same touched files.
  - `CI=true pnpm run security:contract` regenerated
    `security-contract.generated.json`.
  - `CI=true pnpm run check:security:contract` passed.
  - `CI=true pnpm run test:security` passed:
    - source-policy check;
    - security contract drift check;
    - module build;
    - packed-export policy;
    - 25 focused runtime/security test files / 256 tests.
- Current state:
  - Example 05 article authority is no longer split between operation guards and
    workspace-lane permissions.
  - The article feature no longer has `query.protected(...)`,
    `mutation.protected(...)`, or `guard:` registrations.
  - Public article access no longer carries authenticated knowledge-base access
    through the public DB facade.

### 2026-06-04 Example 05 Knowledge Base Workspace Lane Cutover

- Converted the example 05 knowledge-base feature from protected-lane
  registrations to workspace-lane registrations:
  - `query.workspace(...)` for knowledge-base list and get.
  - `mutation.workspace(...)` for create, publish, enroll, and enroll-by-email.
- Replaced knowledge-base operation `guard` metadata with concrete
  `permission` metadata:
  - `kbRead` for list and get.
  - `kbCreate` for create and publish.
  - `enrollmentManage` for enrollment writes.
- Added explicit `requireAuth(...)` narrowing before the create handler reads
  `appIdentity.userId`.
- Regenerated `security-contract.generated.json`; the contract no longer lists
  knowledge-base-domain protected backend lane entries and records the
  knowledge-base operations as guardless.
- Verification:
  - `pnpm --dir examples/05-visibility-access typecheck` passed.
  - `pnpm exec vitest run --config vitest.config.ts convex/knowledgeBase.test.ts`
    in `examples/05-visibility-access` passed: 1 file / 20 tests.
  - `node_modules/.bin/vitest run --project=unit tests/unit/security-contract.test.ts tests/unit/functions-defineTrellis.test.ts`
    passed: 2 files / 57 tests.
  - ESLint passed for the touched knowledge-base domain file.
  - `node_modules/.bin/oxfmt --check` passed for the touched knowledge-base
    domain file.
  - `CI=true pnpm run security:contract` regenerated
    `security-contract.generated.json`.
  - `CI=true pnpm run check:security:contract` passed.
  - `CI=true pnpm run test:security` passed:
    - source-policy check;
    - security contract drift check;
    - module build;
    - packed-export policy;
    - 25 focused runtime/security test files / 256 tests.
- Current state:
  - Example 05 knowledge-base authority is no longer split between operation
    guards and workspace-lane permissions.
  - The knowledge-base feature no longer has `query.protected(...)`,
    `mutation.protected(...)`, or `guard:` registrations.

### 2026-06-04 Example 07 MCP Management Workspace Lane Cutover

- Converted the example 07 MCP key management and MCP-bound user listing paths
  from protected-lane registrations to workspace-lane registrations:
  - `query.workspace(...)` for MCP key list and MCP-bound user list.
  - `mutation.workspace(...)` for MCP key create and revoke.
- Replaced MCP management operation `guard` metadata with concrete
  `permission: mcpManage` metadata.
- Added explicit `requireAuth(...)` narrowing before touched handlers read the
  caller role or user id.
- Kept MCP bearer-key validation and touch on their existing public lanes; they
  remain the explicit bearer-key boundary and do not use workspace UI
  permissions.
- Regenerated `security-contract.generated.json`; the contract no longer lists
  the MCP key/user management protected backend lane entries and records those
  operations as guardless.
- Verification:
  - `pnpm --dir examples/07-mcp-reference typecheck` passed.
  - `pnpm exec vitest run --config vitest.config.ts test/mcpReference.test.ts`
    in `examples/07-mcp-reference` passed: 1 file / 11 tests.
  - `node_modules/.bin/vitest run --project=unit tests/unit/security-contract.test.ts tests/unit/functions-defineTrellis.test.ts`
    passed: 2 files / 57 tests.
  - ESLint passed for the touched MCP key and user domain files.
  - `node_modules/.bin/oxfmt --check` passed for the touched MCP key and user
    domain files.
  - `CI=true pnpm run security:contract` regenerated
    `security-contract.generated.json`.
  - `CI=true pnpm run check:security:contract` passed.
  - `CI=true pnpm run test:security` passed:
    - source-policy check;
    - security contract drift check;
    - module build;
    - packed-export policy;
    - 25 focused runtime/security test files / 256 tests.
- Current state:
  - Example 07 MCP key management authority is no longer split between
    operation guards and workspace-lane permissions.
  - The MCP key and MCP-bound user listing features no longer have
    `query.protected(...)`, `mutation.protected(...)`, or `guard:`
    registrations.

### 2026-06-04 Example 07 Runbook Workspace Lane Cutover

- Converted the example 07 runbook workspace UI feature from protected-lane
  registrations to workspace-lane registrations:
  - `query.workspace(...)` for workspace runbook list, get, and overview.
  - `mutation.workspace(...)` for runbook create, update, remove
    preview/execute, and bulk-remove preview/execute.
- Replaced runbook operation `guard` metadata with concrete `permission`
  metadata:
  - `runbookRead` for workspace list, get, update lane entry, and overview.
  - `runbookCreate` for create.
  - Existing record-level update authorization still uses `canUpdateRunbook`.
  - Existing destructive record-level authorization still uses
    `canDeleteRunbook`.
- Removed duplicate destructive operation guards from runbook remove and bulk
  remove operations; `permission: runbookDelete` and
  `permission: runbookBulkDelete` are now the lane authority sources for their
  preview and execute handlers.
- Added explicit `requireAuth(...)` narrowing before touched handlers read user
  id or publish permissions.
- Kept the runbook webhook creation mutation on the protected lane for a
  separate webhook transport cutover; it uses `identityForwardingTransport:
  'webhook'` and validates `args.workspaceId` inside the handler.
- Regenerated `security-contract.generated.json`; the contract no longer lists
  runbook workspace UI/destructive protected backend lane entries and records
  those operations as guardless.
- Verification:
  - `pnpm --dir examples/07-mcp-reference typecheck` passed.
  - `pnpm exec vitest run --config vitest.config.ts test/mcpReference.test.ts`
    in `examples/07-mcp-reference` passed: 1 file / 11 tests.
  - `node_modules/.bin/vitest run --project=unit tests/unit/security-contract.test.ts tests/unit/functions-defineTrellis.test.ts`
    passed: 2 files / 57 tests.
  - ESLint passed for the touched runbook domain and operation files.
  - `node_modules/.bin/oxfmt --check` passed for the touched runbook domain and
    operation files.
  - `CI=true pnpm run security:contract` regenerated
    `security-contract.generated.json`.
  - `CI=true pnpm run check:security:contract` passed.
  - `CI=true pnpm run test:security` passed:
    - source-policy check;
    - security contract drift check;
    - module build;
    - packed-export policy;
    - 25 focused runtime/security test files / 256 tests.
- Current state:
  - Example 07 runbook workspace UI/destructive authority is no longer split
    between operation guards and workspace-lane permissions.
  - The remaining example 07 runbook protected registration is the webhook
    transport mutation.

### 2026-06-04 Auth-Only Todo Authenticated Lane Cutover

- Converted example 02 auth-only todo operations from protected-lane
  `guard: isAuthenticated` registrations to authenticated-lane registrations:
  - `query.authenticated(...)` for todo list.
  - `mutation.authenticated(...)` for create, toggle, and remove.
- Converted the personal starter fixture todo operations from protected-lane
  `guard: isAuthenticated` registrations to authenticated-lane registrations:
  - `query.authenticated(...)` for todo list.
  - `mutation.authenticated(...)` for create and toggle.
- Removed redundant `isAuthenticated` operation guards from those auth-only
  operations; the authenticated lane is now the single sign-in authority source.
- Added explicit `requireAuth(...)` narrowing before handlers/loaders read
  `appIdentity.userId`.
- Taught public-surface metadata extraction to recognize
  `operation.publicMutation(...)` as a safe operation builder, so public starter
  mutations remain visible in doctor inventory and generated operation maps.
- Fixed the composed `trellis add mcp` path to add `mcpKeys` to
  `convex/functions.ts` public read tables, matching the workspace-MCP preset
  output.
- Regenerated `security-contract.generated.json`; the contract no longer lists
  example 02 or personal starter todo protected backend lane entries and records
  the touched todo operations as guardless.
- Verification:
  - `pnpm --dir examples/02-auth-todo typecheck` passed.
  - `pnpm exec vitest run --config vitest.config.ts convex/todos.test.ts` in
    `examples/02-auth-todo` passed: 1 file / 1 test.
  - `node_modules/.bin/vitest run --project=unit tests/unit/public-surface-codegen.test.ts`
    passed: 1 file / 3 tests.
  - `node_modules/.bin/vitest run --project=unit tests/unit/phase0-starter-manifest.test.ts tests/unit/cli-doctor.test.ts`
    passed: 2 files / 67 tests.
  - ESLint passed for the touched auth-only todo, CLI init, public-surface
    codegen, and test files.
  - `node_modules/.bin/oxfmt --check` passed for the touched auth-only todo,
    CLI init, public-surface codegen, and test files.
  - `pnpm run check:starter-fixtures:build` passed for public, personal,
    workspace, and workspace-MCP generated fixtures.
  - `CI=true pnpm run security:contract` regenerated
    `security-contract.generated.json`.
  - `CI=true pnpm run check:security:contract` passed.
  - `CI=true pnpm run test:security` passed:
    - source-policy check;
    - security contract drift check;
    - module build;
    - packed-export policy;
    - 25 focused runtime/security test files / 256 tests.
  - `git diff --check` passed.
- Current state:
  - Example 02 and the personal starter no longer keep
    `guard: isAuthenticated` beside authenticated-lane registration.
  - No `query.protected(...)`, `mutation.protected(...)`, or `guard:`
    registrations remain in the touched auth-only todo domains.
  - Public starter `operation.publicMutation(...)` operations are included in
    public-surface inventory.
  - Composed workspace-to-MCP initialization and the workspace-MCP preset produce
    the same public read table configuration.

### 2026-06-04 Webhook Transport Authenticated Lane Cutover

- Converted the remaining maintained example webhook transport mutations from
  protected-lane operation guards to authenticated-lane registrations:
  - Example 03 todo sync webhook:
    `mutation.authenticated(processTodoSyncWebhookOp)`.
  - Example 07 runbook webhook:
    `mutation.authenticated(createRunbookFromWebhookOp)`.
- Removed webhook operation `guard` metadata:
  - `guard: todoCreate` from the example 03 todo sync webhook operation.
  - `guard: runbookCreate` from the example 07 runbook webhook operation.
- Kept webhook authorization semantics by moving delegated-user create
  permission decisions into the handlers after backend delegation binding
  validation:
  - `can(appIdentity, todoCreate.check)` before synced todo writes.
  - `can(appIdentity, runbookCreate.check)` before runbook writes.
- Added explicit `requireAuth(...)` narrowing in the example 03 webhook handler
  before reading delegated `appIdentity` fields.
- Kept domain idempotency in the webhook handlers; replay protection remains
  owned by the backend mutation, not route orchestration.
- Regenerated `security-contract.generated.json`; the contract no longer lists
  example 03 or example 07 webhook mutations as protected backend lane entries,
  and records their operations as guardless.
- Verification:
  - `pnpm --dir examples/03-team-workspace typecheck` passed.
  - `pnpm exec vitest run --config vitest.config.ts convex/todos.test.ts server/api/webhook.post.test.ts`
    in `examples/03-team-workspace` passed: 2 files / 17 tests.
  - `pnpm --dir examples/07-mcp-reference typecheck` passed.
  - `pnpm exec vitest run --config vitest.config.ts test/mcpReference.test.ts server/api/runbook-webhook.post.test.ts`
    in `examples/07-mcp-reference` passed: 2 files / 16 tests.
  - ESLint passed for the touched webhook files.
  - `node_modules/.bin/oxfmt --check` passed for the touched webhook files.
  - `rg "query\\.protected|mutation\\.protected|guard:" examples/03-team-workspace/convex/features/todos examples/07-mcp-reference/convex/features/runbooks`
    found no remaining protected/guard registrations in those touched feature
    folders.
  - `CI=true pnpm run security:contract` regenerated
    `security-contract.generated.json`.
  - `CI=true pnpm run check:security:contract` passed.
  - `node_modules/.bin/vitest run --project=unit tests/unit/security-contract.test.ts tests/unit/functions-defineTrellis.test.ts tests/unit/example-webhook-security.test.ts`
    passed: 3 files / 58 tests.
  - `CI=true pnpm run test:security` passed:
    - source-policy check;
    - security contract drift check;
    - module build;
    - packed-export policy;
    - 25 focused runtime/security test files / 256 tests.
- Current state:
  - Maintained example webhook transport mutations no longer use the protected
    lane or operation guards.
  - Webhook authority is now split by responsibility, not duplicated:
    authenticated lane admits non-anonymous service/user callers; backend
    delegation binding validates acting-for/workspace evidence; handler domain
    checks enforce delegated-user create permissions; handler idempotency owns
    duplicate delivery rejection.

### 2026-06-04 Component Mini CMS Authenticated Lane Cutover

- Converted the component mini CMS studio read/write handlers to the
  authenticated backend lane:
  - `query.authenticated(listStudioPagesOp)`.
  - `query.authenticated(listDraftPagesOp)`.
  - `mutation.authenticated(createPageOp)`.
  - `mutation.authenticated(saveDraftOp)`.
- Removed `guard: canManagePages` from those four operation definitions so
  signed-in access is no longer represented twice.
- Updated the anonymous studio-read proof to expect the signed-in lane denial
  (`Forbidden: authRequired`) instead of the removed component guard label.
- Kept `canManagePages` only on `publishPageOp` because
  `transportMutation(publishPageOp)` consumes the operation guard directly and
  Trellis does not currently expose an authenticated transport lane. Adding a
  transport-lane API for this example would add surface area without a current
  requirement.
- Regenerated `security-contract.generated.json`; the component operations
  inventory now records the studio list/draft/create/save operations as
  guardless while keeping the destructive publish operation guarded.
- Verification:
  - `pnpm --dir examples/08-component-mini-cms typecheck` passed.
  - `pnpm exec vitest run --config vitest.config.ts test/componentMiniCms.test.ts`
    in `examples/08-component-mini-cms` passed: 1 file / 10 tests.
  - ESLint passed for the touched component files.
  - `node_modules/.bin/oxfmt --check` passed for the touched component files.
  - `CI=true pnpm run security:contract` regenerated
    `security-contract.generated.json`.
  - `CI=true pnpm run check:security:contract` passed.
  - `node_modules/.bin/vitest run --project=unit tests/unit/security-contract.test.ts tests/unit/functions-defineTrellis.test.ts`
    passed: 2 files / 57 tests.
  - `CI=true pnpm run test:security` passed:
    - source-policy check;
    - security contract drift check;
    - module build;
    - packed-export policy;
    - 25 focused runtime/security test files / 256 tests.
  - `pnpm run build:cli` passed after `test:security`.
- Current state:
  - Component mini CMS studio reads/writes use the direct authenticated lane.
  - Component destructive publish still uses the operation guard as the single
    authority source for preview and transport execution.

### 2026-06-04 Security Contract Lane Inventory Coverage

- Fixed the security contract backend function extractor so it records every
  backend lane:
  - `public`;
  - `authenticated`;
  - `workspace`;
  - `protected`;
  - `unsafe`.
- Before this fix, `security-contract.generated.json` only saw
  `public`/`protected`/`unsafe` handlers, so the 0.3.0 authenticated/workspace
  lane cutovers were visible indirectly through operation inventory but missing
  from backend function inventory.
- Added a unit proof that maintained examples appear in the contract with their
  actual lanes:
  - example 02 todo `list` as `query.authenticated`;
  - example 03 todo `list` as `query.workspace`;
  - example 03 webhook dispatch as `mutation.authenticated`;
  - example 08 component studio `listStudio` as `query.authenticated`.
- Regenerated `security-contract.generated.json`; backend function inventory now
  records:
  - 49 public handlers;
  - 21 authenticated handlers;
  - 60 workspace handlers;
  - 18 protected handlers;
  - 11 unsafe handlers.
- Verification:
  - `CI=true pnpm run security:contract` regenerated
    `security-contract.generated.json`.
  - ESLint passed for `scripts/lib/security-contract.mjs` and
    `tests/unit/security-contract.test.ts`.
  - `node_modules/.bin/oxfmt --check tests/unit/security-contract.test.ts`
    passed.
  - `node_modules/.bin/vitest run --project=unit tests/unit/security-contract.test.ts`
    passed: 1 file / 2 tests.
  - `CI=true pnpm run check:security:contract` passed.
  - `node_modules/.bin/vitest run --project=unit tests/unit/functions-defineTrellis.test.ts tests/unit/security-contract.test.ts`
    passed: 2 files / 57 tests.
  - `CI=true pnpm run test:security` passed:
    - source-policy check;
    - security contract drift check;
    - module build;
    - packed-export policy;
    - 25 focused runtime/security test files / 256 tests.
  - `pnpm run build:cli` passed after `test:security`.
- Current state:
  - The security contract can now prove the lane cutover state directly from
    backend function exports, instead of treating authenticated/workspace lanes
    as absent from inventory.

### 2026-06-04 Transport Mutation Authenticated Lane Cutover

- Added `transportMutation.authenticated(...)` as the signed-in lane for trusted
  destructive transport execute mutations.
- Reused the existing authenticated lane builder instead of adding a separate
  transport authorization path:
  - definitions with `guard` are rejected before registration;
  - the lane injects `authRequired`;
  - transport execution still requires a trusted `operation-execute` forwarding
    envelope before the handler runs.
- Converted example 08 component publish to the authenticated transport lane:
  - removed `guard: canManagePages` from `publishPageOp`;
  - changed `previewPublish` from `query.protected(...)` to
    `query.authenticated(...)`;
  - changed component publish execute from `transportMutation(publishPageOp)` to
    `transportMutation.authenticated(publishPageOp)`;
  - deleted the now-unused `canManagePages` guard from the component runtime.
- Extended the security contract backend function extractor to inventory
  `transportMutation.<lane>(...)` exports and pinned example 08 component
  publish as `functionType: "transportMutation"` / `lane: "authenticated"`.
- Updated docs to mention `transportMutation.authenticated(...)` in the backend
  builder/API reference.
- Regenerated `security-contract.generated.json`; maintained examples and
  starter fixtures now have:
  - no `query.protected(...)`;
  - no `mutation.protected(...)`;
  - no `action.protected(...)`;
  - no operation `guard:` registrations;
  - no `canManagePages` guard.
- Verification:
  - `pnpm run build:module` passed before example typecheck so local
    `@lupinum/trellis` declarations included `transportMutation.authenticated`.
  - `pnpm --dir examples/08-component-mini-cms typecheck` passed.
  - `pnpm exec vitest run --config vitest.config.ts test/componentMiniCms.test.ts`
    in `examples/08-component-mini-cms` passed: 1 file / 10 tests.
  - `CI=true pnpm run security:contract` regenerated
    `security-contract.generated.json`.
  - `node_modules/.bin/vitest run --project=unit tests/unit/functions-defineTrellis.test.ts tests/unit/security-contract.test.ts`
    passed: 2 files / 58 tests.
  - ESLint passed for the touched runtime, component, contract, and unit test
    files.
  - `node_modules/.bin/oxfmt --check` passed for the touched TypeScript files.
  - `rg "query\\.protected|mutation\\.protected|action\\.protected|guard:\\s*|canManagePages" examples src/cli/starter-fixtures`
    found no remaining matches.
  - Contract inspection found no protected backend functions and no guarded
    operations under `examples/` or `src/cli/starter-fixtures/`.
  - `CI=true pnpm run check:security:contract` passed.
  - `CI=true pnpm run test:security` passed:
    - source-policy check;
    - security contract drift check;
    - module build;
    - packed-export policy;
    - 25 focused runtime/security test files / 257 tests.
  - `pnpm run build:cli` passed after `test:security`.
  - `pnpm run check:docs:api-surface` passed.
  - `pnpm run check:docs:links` passed.
  - `pnpm --dir apps/docs build` was attempted but could not run in the current
    checkout because Nuxt content could not load the missing
    `better-sqlite3` native binding and `@nuxtjs/og-image` reported missing
    `@resvg/resvg-js`.
- Current state:
  - Maintained examples and starter fixtures no longer carry protected-lane or
    operation-guard compatibility paths.
  - Trusted transport execute keeps one authority source: authenticated lane
    admission plus operation-execute forwarding proof.

### 2026-06-04 CLI Resource Generator Lane Cutover

- Cut over `trellis add entity` resource generation from the old protected lane
  output to explicit backend lanes:
  - personal and author-owned resources now emit `query.authenticated(...)` and
    `mutation.authenticated(...)`;
  - workspace resources now emit `query.workspace(...)` and
    `mutation.workspace(...)`.
- Removed generated operation `guard:` metadata so new resources do not
  reintroduce the deprecated guard path.
- Kept MCP operation `permission` metadata as the descriptive tool policy source
  for generated MCP bindings.
- Added generated `requireAuth(appIdentity)` narrowing before generated handlers
  read user or workspace identity fields.
- Generated destructive remove operations now authorize against the loaded
  resource:
  - personal/author-owned resources compare the record owner field to
    `appIdentity.userId`;
  - workspace resources compare the tenant field to `appIdentity.workspaceId`.
- Updated the doctor preview finding hint so destructive previews are exported on
  the same trust lane as the execute handler, such as
  `mutation.workspace(previewOf(operation))` or
  `mutation.authenticated(previewOf(operation))`.
- Verification:
  - `node_modules/.bin/vitest run --project=unit tests/unit/cli-add-resource.test.ts`
    passed: 1 file / 9 tests.
  - `node_modules/.bin/vitest run --project=unit tests/unit/cli-doctor.test.ts -t "adds entity resources"`
    passed: 1 selected test.
  - ESLint passed for the touched CLI generator, inventory, and unit test files.
  - `node_modules/.bin/oxfmt --check` passed for the touched TypeScript files.
  - `rg -n "query\\.protected|mutation\\.protected|guard:\\s*|protected preview|protected\\(previewOf" src/cli/lib/resource.ts src/cli/lib/inventory-findings.ts tests/unit/cli-add-resource.test.ts tests/unit/cli-doctor.test.ts`
    found no stale generator or hint output.
  - `CI=true pnpm run test:security` passed:
    - source-policy check;
    - security contract drift check;
    - module build;
    - packed-export policy;
    - 25 focused runtime/security test files / 257 tests.
  - `pnpm run build:cli` passed after `test:security`.
- Current state:
  - New generated resources now follow the 0.3.0 explicit-lane model instead of
    generating protected/guard compatibility paths.

### 2026-06-04 First-Reader Docs Lane Cutover

- Cut over the first-reader docs that still taught protected/guard as the normal
  app path:
  - getting-started signed-in todo app now uses
    `query.authenticated(...)`/`mutation.authenticated(...)` and `requireAuth`
    instead of a copied `isAuthenticated` guard;
  - call-pattern examples now use public/authenticated lanes and same-lane
    destructive previews;
  - destructive-operation docs now describe operation `permission`, same-lane
    preview/execute projections, and lane admission instead of operation guards;
  - permission setup now registers access context with `query.public(...)`, as
    the starter fixtures do;
  - authorization/rate-limit examples now use workspace lane permissions rather
    than `mutation.protected({ guard: ... })`;
  - bridge package-author guidance now points app-owned code at explicit root
    lanes;
  - glossary language now frames guards as custom protected-lane or migration
    machinery, not the default operation authority.
- Left the explicit custom-guard/protected references in the backend-builder,
  cross-scope, guards, and API reference docs because those pages intentionally
  document the custom/migration lane.
- Verification:
  - Broad docs scan for protected/guard examples now only finds intentional
    custom-guard/protected-lane reference material.
  - `node scripts/check-doc-links.mjs` passed.
  - `node scripts/generate-api-surface.mjs --check` passed.
  - `git diff --check` passed.
  - `pnpm run check:docs:links` and `pnpm run check:docs:api-surface` both
    exited immediately with lifecycle code `-35` in this shell, while their
    underlying scripts passed directly.
- Current state:
  - Beginner and first-reader docs no longer teach protected/guard as the normal
    signed-in, workspace, destructive-operation, or access-context path.

### 2026-06-04 Upgrade Hint Lane Cutover

- Updated the `trellis upgrade --check` backend root-builder finding so it no
  longer suggests `.protected(...)` as a normal migration target.
- The hint now points legacy `query(...)`, `mutation(...)`, and `action(...)`
  calls at explicit 0.3 lanes:
  - `.public(...)`;
  - `.authenticated(...)`;
  - `.workspace(...)`;
  - `.unsafe(...)`.
- Verification:
  - `node node_modules/vitest/vitest.mjs run --project=unit --pool=threads --maxWorkers=1 --no-file-parallelism tests/unit/cli-upgrade.test.ts`
    passed: 1 file / 24 tests.
  - `node node_modules/eslint/bin/eslint.js src/cli/commands/upgrade.ts` passed.
  - `node node_modules/oxfmt/bin/oxfmt --check src/cli/commands/upgrade.ts`
    passed.
- Current state:
  - Upgrade guidance now matches the explicit-lane model instead of nudging
    migration users back to protected-lane defaults.

### 2026-06-04 Public-Surface Fixture Lane Cutover

- Cut over public-surface codegen and CLI explain test fixtures that still
  modeled operation projection with `mutation.protected(...)`,
  `query.protected(...)`, and `guard: true`.
- The fixtures now use:
  - `mutation.authenticated(...)` for personal destructive projection examples;
  - `mutation.workspace(...)` for workspace operation execute and preview
    projections;
  - operation `permission` metadata instead of operation `guard` metadata.
- Verification:
  - `node node_modules/vitest/vitest.mjs run --project=unit --pool=threads --maxWorkers=1 --no-file-parallelism tests/unit/public-surface-codegen.test.ts`
    passed: 1 file / 3 tests.
  - `node node_modules/vitest/vitest.mjs run --project=unit --pool=threads --maxWorkers=1 --no-file-parallelism tests/unit/cli-explain.test.ts -t "explains an operation as versioned JSON"`
    passed: 1 selected test.
  - `node node_modules/vitest/vitest.mjs run --project=unit --pool=threads --maxWorkers=1 --no-file-parallelism tests/unit/cli-explain.test.ts`
    passed: 1 file / 9 tests.
  - `node node_modules/eslint/bin/eslint.js tests/unit/public-surface-codegen.test.ts tests/unit/cli-explain.test.ts`
    passed.
  - `node node_modules/oxfmt/bin/oxfmt --check --threads=1 tests/unit/public-surface-codegen.test.ts tests/unit/cli-explain.test.ts`
    passed.
  - A combined first run of both test files passed
    `tests/unit/public-surface-codegen.test.ts` but failed
    `tests/unit/cli-explain.test.ts` before assertions because every helper CLI
    subprocess returned `status: null` under transient OS process-limit
    pressure; the file passed when rerun after process creation recovered.
- Current state:
  - Public-surface and explain fixtures no longer normalize protected/guard as
    the default operation projection model.
