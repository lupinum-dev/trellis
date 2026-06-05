# Trellis 0.3.0 Implementation Progress

Status: Refactor and release-prep acceptance proven
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

| Phase                                                 | Status | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ----------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Phase -1: Prove risky mechanics                       | Passed | Source-policy, raw DB, cross-tenant, and public DB runtime proofs have passing focused evidence                                                                                                                                                                                                                                                                                                                                                   |
| Phase 0: Freeze unsafe growth                         | Passed | Source-policy, packed export gate, focused runtime security proofs, cross-tenant ban, maintained examples doctor, starter fixture doctor, `test:security` wiring, `pnpm run check`, `pnpm run release:verify`, and `pnpm run release:pack` pass                                                                                                                                                                                                   |
| Phase 1: Backend authority cutover                    | Passed | `authenticated` and `workspace` backend lanes now exist with focused runtime proof; production-copyable workspace bootstrap and direct CLI operation scaffolds now use guardless app operations registered through `mutation.authenticated(...)`; `workspace(...)` requires concrete permission metadata; `protected(...)` refuses `guard: open`; duplicate permission matrix keys fail closed; remaining protected/guard inventory is classified |
| Phase 2: Operations, replay, trusted proofs           | Passed | Opaque transport proof cutover, framework JTI replay claim/complete/fail, operation confirmation replay prevention, domain-idempotent webhook writes, and failed-domain-write recovery pass focused tests and broad gates                                                                                                                                                                                                                         |
| Phase 3: MCP cutover                                  | Passed | Operation-backed maintained tools, generated tools, and consumer fixture proof run through `test:security`; `pnpm run check`, `pnpm run release:verify`, and `pnpm run release:pack` pass                                                                                                                                                                                                                                                         |
| Phase 4: Webhooks, delegation, server routes          | Passed | HMAC helper parse-before-idempotency, examples 03/04/07 backend delivery idempotency, delegation binding, and maintained route metadata pass focused gates and broad release gates                                                                                                                                                                                                                                                                |
| Phase 5: Client auth lifecycle                        | Passed | Better Auth session sync, upstream-authoritative sign-out, stale protected navigation, auth proxy body handling, and Nuxt auth smoke have focused proof                                                                                                                                                                                                                                                                                           |
| Phase 6: Examples, docs, public surface, release gate | Passed | Phase A security contract is wired into `test:security`; maintained examples doctor, starter fixture doctor, consumer MCP fixture proof, proof inventory, route metadata, delegation metadata, webhook verifier metadata, service replay/audit metadata, docs production build, `pnpm run check`, `pnpm run release:verify`, and `pnpm run release:pack` pass; release metadata, compatibility metadata, and release notes are aligned on `0.3.0` |

## Proof Spike Ledger

| Spike                    | Status | Evidence                                                                                                                                                                                                                                                                                                                                                                     | Next step                                                                                     |
| ------------------------ | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Raw DB removal           | Passed | Handler-visible `ctx.db` no longer carries raw DB by reference, symbol, or descriptor; destructive internals still pass tests                                                                                                                                                                                                                                                | Remove `escapeIsolation` normal-lane API in cross-tenant capability spike                     |
| Public-safe DB facade    | Passed | Public `ctx.db` is read-only and table-limited; public writes require operation-backed `publicWrite` narrow methods and emit `db.public_write.used`                                                                                                                                                                                                                          | Keep regression coverage while moving to trusted proof/replay work                            |
| Strict evaluator         | Passed | Core auth and MCP checks require exact boolean results                                                                                                                                                                                                                                                                                                                       | Covered by expanded `test:security`; keep release gates green                                 |
| Cross-tenant capability  | Passed | Normal handler `ctx.db` no longer exposes `escapeIsolation`; named `crossTenant` capabilities are table-limited, read-only by default, and write mode requires operation metadata                                                                                                                                                                                            | Keep policy gate banning generic escape hatches and continue with public-safe DB facade proof |
| Service subject          | Passed | Examples 03 and 07 configure webhook services as derived, table-restricted access scoped from `workspaceId`; core runtime proves unconfigured services fail before handler execution, unlisted tables deny with an observation event, and service callers cannot enter undeclared function refs; security contract and doctor now require replay/audit metadata              | Keep maintained example service metadata and target-scope proofs green                        |
| Trusted proof            | Passed | Server/MCP forwarding now uses branded `transportProof.*(...)`; raw `auth: 'trusted'` rejects before fetch; source policy scans the server helper                                                                                                                                                                                                                            | Keep proof-object coverage while finishing webhook/delegation lanes                           |
| Replay store             | Passed | `jti-redemption` and `operation-confirmation` envelopes carry signed replay mode and use `trustedReplay` to claim before handler execution, then mark `completed` or `failed`; duplicate JTI tests execute the handler once; maintained example route-retry and backend duplicate-delivery proofs are contract-visible and pass broad gates                                  | Keep replay proof inventory in `test:security` and release gates                              |
| Webhook idempotency      | Passed | `verifyHmacWebhookDelivery(...)` reads raw body once, rejects blank/stale/tampered deliveries, parses before idempotency; examples 03, 04, and 07 store delivery/idempotency rows with the business write; maintained example idempotency/retry proofs and verifier canonicalization metadata are contract-visible and pass broad gates                                      | Keep maintained example proof inventory in `test:security` and release gates                  |
| Delegation binding       | Passed | `delegateToUser` is replaced by required binding evidence; examples 03 and 07 create short-lived bindings and Convex revalidates service/user/workspace/purpose/expiry before writing; doctor verifies maintained examples do not forward raw callers outside `transportProof.*(...)`; docs/API reference and maintained-example forged/expired/wrong-binding coverage exist | Keep delegation docs and maintained example tests green                                       |
| MCP operation migration  | Passed | Production-copyable MCP write tools, generated resource MCP create/delete tools, and consumer-style workspace MCP fixture tools use operation-backed bindings without public tool-local safety stamping                                                                                                                                                                      | Keep scaffold and starter proofs in `test:security`                                           |
| Better Auth sync         | Passed | Better Auth `$sessionSignal` is observed by the auth transport, routed through `authEngine.refreshAuth({ trigger: 'auth-session-signal' })`, and focused tests prove fresh-token adoption and stale-token clearing                                                                                                                                                           | Keep Nuxt auth smoke green                                                                    |
| Sign-out ordering        | Passed | Local logout now commits only after upstream Better Auth sign-out succeeds; failed upstream logout keeps the existing session represented with an auth error and skips local invalidation                                                                                                                                                                                    | Keep Nuxt auth smoke green                                                                    |
| Protected navigation     | Passed | Route middleware waits for session-driven refresh before deciding protected navigation and fails closed if auth remains pending                                                                                                                                                                                                                                              | Keep Nuxt auth smoke in release gates                                                         |
| Auth proxy body handling | Passed | DELETE bodies are forwarded, non-body methods with declared bodies reject before upstream fetch, and critical auth endpoints keep method-specific 405s                                                                                                                                                                                                                       | Covered by expanded `test:security`                                                           |
| Packed exports           | Passed | Stale `dist` failed with 25 banned public export violations; rebuilt package entries now pass packed export gate                                                                                                                                                                                                                                                             | Covered by expanded `test:security`; keep release gates green                                 |
| Security contract        | Passed | Phase A generated contract inventories public exports, banned export absence, source-policy rules, public read tables, service subjects with replay/audit metadata, maintained example proofs, server route metadata, delegation bindings, webhook verifier metadata, backend lanes, operations, MCP tools, and runtime proof files                                          | Keep contract drift check green through release gates                                         |

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
  separate webhook transport cutover; it still validates `args.workspaceId`
  inside the handler.
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

### 2026-06-05 Operation Descriptor Permission Fixture Cutover

- Cut over `tests/unit/operation-descriptor.test.ts` from operation `guard`
  fixtures to operation `permission` fixtures.
- The descriptor tests now exercise operation permission metadata and descriptor
  drift checks without keeping stale guard-normalized operation fixtures.
- Verification:
  - `node node_modules/vitest/vitest.mjs run --project=unit --pool=threads --maxWorkers=1 --no-file-parallelism tests/unit/operation-descriptor.test.ts`
    passed: 1 file / 7 tests.
  - `node node_modules/eslint/bin/eslint.js tests/unit/operation-descriptor.test.ts`
    passed.
  - `node node_modules/oxfmt/bin/oxfmt --check --threads=1 tests/unit/operation-descriptor.test.ts`
    passed.
- Current state:
  - `tests/unit/operation-descriptor.test.ts` no longer contains operation
    `guard:` fixtures.

### 2026-06-05 Feature Inventory Permission Fixture Cutover

- Cut over the operation-definition inventory fixture in
  `tests/unit/feature-compose.test.ts` from operation `guard` metadata to
  operation `permission` metadata.
- Left custom protected-lane/runtime guard coverage untouched; this slice only
  removes stale normal-path fixture style from feature inventory tests.
- Verification:
  - `node node_modules/vitest/vitest.mjs run --project=unit --pool=threads --maxWorkers=1 --no-file-parallelism tests/unit/feature-compose.test.ts`
    passed: 1 file / 11 tests.
  - `node node_modules/eslint/bin/eslint.js tests/unit/feature-compose.test.ts`
    passed.
  - `node node_modules/oxfmt/bin/oxfmt --check --threads=1 tests/unit/feature-compose.test.ts`
    passed.
- Current state:
  - `tests/unit/feature-compose.test.ts` no longer contains operation
    `guard:` fixtures.

### 2026-06-05 Generated Type Consumer Permission Fixture Cutover

- Cut over the generated public-surface consumer fixture in
  `tests/unit/generated-type-consumers.test.ts` from a synthetic `guard: open`
  operation example to operation `permission` metadata.
- Removed the fixture-only `open` constant so generated type consumer coverage
  no longer normalizes old operation guard style.
- Verification:
  - `node node_modules/vitest/vitest.mjs run --project=unit --pool=threads --maxWorkers=1 --no-file-parallelism tests/unit/generated-type-consumers.test.ts`
    passed: 1 file / 2 tests.
  - `node node_modules/eslint/bin/eslint.js tests/unit/generated-type-consumers.test.ts`
    passed.
  - `node node_modules/oxfmt/bin/oxfmt --check --threads=1 tests/unit/generated-type-consumers.test.ts`
    passed.
- Current state:
  - `tests/unit/generated-type-consumers.test.ts` no longer contains operation
    `guard:` fixtures.

### 2026-06-05 App Entrypoint Guardless Operation Fixture Cutover

- Cut over beginner operation-ladder fixtures in
  `tests/unit/app-index-exports.test.ts` so app operations no longer pass
  `guard: open` as normal-path metadata.
- Removed the test-only `open` import from the app entrypoint export fixture.
- Verification:
  - `node node_modules/vitest/vitest.mjs run --project=unit --pool=threads --maxWorkers=1 --no-file-parallelism tests/unit/app-index-exports.test.ts`
    passed: 1 file / 8 tests.
  - `node node_modules/eslint/bin/eslint.js tests/unit/app-index-exports.test.ts`
    passed.
  - `node node_modules/oxfmt/bin/oxfmt --check --threads=1 tests/unit/app-index-exports.test.ts`
    passed.
- Current state:
  - `tests/unit/app-index-exports.test.ts` no longer contains operation
    `guard:` fixtures.

### 2026-06-05 MCP Operation Tool Permission Fixture Cutover

- Cut over operation-first MCP tool fixtures in
  `tests/unit/define-convex-tool.test.ts` from synthetic `guard: open`
  operation definitions to operation `permission` metadata.
- Added one local test access resolver for the fixture permission so these tests
  continue proving MCP confirmation and forwarding behavior instead of failing
  at permission visibility.
- Verification:
  - `node node_modules/vitest/vitest.mjs run --project=unit --pool=threads --maxWorkers=1 --no-file-parallelism tests/unit/define-convex-tool.test.ts`
    passed: 1 file / 33 tests.
  - `node node_modules/eslint/bin/eslint.js tests/unit/define-convex-tool.test.ts`
    passed.
  - `node node_modules/oxfmt/bin/oxfmt --check --threads=1 tests/unit/define-convex-tool.test.ts`
    passed.
- Current state:
  - `tests/unit/define-convex-tool.test.ts` no longer contains operation
    `guard:` fixtures.

### 2026-06-05 Doctor Operation Inventory Fixture Cutover

- Cut over destructive-operation inventory/agreement fixtures in
  `tests/unit/cli-doctor.test.ts` from `guard: open` and
  `query.protected(previewOf(...))` snippets to permission-backed operation
  metadata and authenticated preview/execute projections.
- Kept the snippets on backend `defineOperation({ kind: 'destructive' })`
  because this doctor inventory test intentionally exercises the backend
  destructive-operation inventory path.
- Verification:
  - `node node_modules/vitest/vitest.mjs run --project=unit --pool=threads --maxWorkers=1 --no-file-parallelism tests/unit/cli-doctor.test.ts -t "destructive operation inventory|operation/tool agreement"`
    passed: 1 file / 2 selected tests.
  - `node node_modules/eslint/bin/eslint.js tests/unit/cli-doctor.test.ts`
    passed.
  - `node node_modules/oxfmt/bin/oxfmt --check --threads=1 tests/unit/cli-doctor.test.ts`
    passed.
- Current state:
  - `tests/unit/cli-doctor.test.ts` only retains old-path strings as negative
    assertions in generator checks.

### 2026-06-05 App Operation Guard Allowance Removal

- Removed the app operation type allowance for `guard` from
  `src/runtime/app/index.ts`.
- Updated `tests/dts/app.types.ts` so app operation type examples use
  guardless or permission-backed operation definitions, and added a negative
  type assertion proving app operations reject protected-lane guards.
- Verification:
  - `node node_modules/vitest/vitest.mjs run --project=unit --pool=threads --maxWorkers=1 --no-file-parallelism tests/unit/app-index-exports.test.ts`
    passed: 1 file / 8 tests.
  - `node node_modules/eslint/bin/eslint.js src/runtime/app/index.ts tests/dts/app.types.ts`
    passed.
  - `node node_modules/oxfmt/bin/oxfmt --check --threads=1 src/runtime/app/index.ts tests/dts/app.types.ts`
    passed.
  - A single-file TypeScript program over `tests/dts/app.types.ts` with the
    `tsconfig.types.public.json` public path mappings passed.
  - `CI=true pnpm run test:types:public` still fails before this slice's app
    assertions because `tests/dts/mcp.types.ts` imports removed
    `@lupinum/trellis/mcp/advanced` symbol `defineTool`; the direct app dts
    check above passed.
- Current state:
  - `@lupinum/trellis/app` operation helpers no longer accept `guard` in their
    public type shape.

### 2026-06-05 Public DTS Operation Permission Cutover

- Cut over `tests/dts/mcp.types.ts` and
  `tests/dts/type-primitives.types.ts` from backend operation `guard: open`
  fixtures to app operation permission fixtures.
- Replaced the stale `@lupinum/trellis/mcp/advanced` `defineTool` type fixture
  with the surviving advanced toolkit export `defineMcpTool`.
- Relaxed `OperationShape.guard` to optional in
  `src/runtime/functions/define-operation.ts` so metadata-only and app
  operation definitions can flow through type-primitives without carrying
  protected-lane guard metadata.
- Verification:
  - `CI=true pnpm run test:types:public` passed.
  - `node node_modules/vitest/vitest.mjs run --project=unit --pool=threads --maxWorkers=1 --no-file-parallelism tests/unit/operation-descriptor.test.ts tests/unit/feature-compose.test.ts tests/unit/generated-type-consumers.test.ts tests/unit/app-index-exports.test.ts tests/unit/define-convex-tool.test.ts tests/unit/functions-defineTrellis.test.ts tests/unit/functions-defineHandler.test.ts`
    passed: 7 files / 133 tests.
  - `node node_modules/eslint/bin/eslint.js src/runtime/functions/define-operation.ts src/runtime/app/index.ts tests/dts/app.types.ts tests/dts/mcp.types.ts tests/dts/type-primitives.types.ts`
    passed.
  - `node node_modules/oxfmt/bin/oxfmt --check --threads=1 src/runtime/functions/define-operation.ts src/runtime/app/index.ts tests/dts/app.types.ts tests/dts/mcp.types.ts tests/dts/type-primitives.types.ts`
    passed.
- Current state:
  - Public dts fixtures no longer require operation `guard` fixtures for app,
    MCP, or type-primitives operation metadata coverage.

### 2026-06-05 DefineTrellis App Destructive Lane Fixture Cutover

- Cut over the app destructive-operation metadata fixture in
  `tests/unit/functions-defineTrellis.test.ts` from
  `runtime.mutation.protected(...)` plus operation guard metadata to
  authenticated preview/execute lanes with operation `permission` metadata.
- Left protected-lane custom guard and destructive confirmation runtime tests in
  the same file untouched because those intentionally cover the surviving custom
  protected lane and confirmation internals.
- Verification:
  - `node node_modules/vitest/vitest.mjs run --project=unit --pool=threads --maxWorkers=1 --no-file-parallelism tests/unit/functions-defineTrellis.test.ts`
    passed: 1 file / 56 tests.
  - `node node_modules/oxfmt/bin/oxfmt --check --threads=1 tests/unit/functions-defineTrellis.test.ts`
    passed.
- Current state:
  - App-operation metadata fixtures in `tests/unit/functions-defineTrellis.test.ts`
    no longer use protected-lane registration for the normal app destructive
    operation path.

### 2026-06-05 ESLint Fixture Explicit Lane Cutover

- Cut over unrelated "good" eslint rule fixtures in
  `tests/unit/eslint-plugin.test.ts` from `query.protected({ guard: ... })`
  to explicit `query.public(...)` and `query.workspace(...)` lanes.
- Updated the appIdentity narrowing fixture to call `requireAuth(appIdentity)`
  directly under the workspace lane.
- Left the `guard-no-db` fixture on `mutation.protected({ guard: async ... })`
  because that test intentionally proves the custom protected-lane guard purity
  rule.
- Verification:
  - `node node_modules/vitest/vitest.mjs run --project=unit --pool=threads --maxWorkers=1 --no-file-parallelism tests/unit/eslint-plugin.test.ts`
    passed: 1 file / 15 tests.
  - `node node_modules/eslint/bin/eslint.js tests/unit/eslint-plugin.test.ts`
    passed.
  - `node node_modules/oxfmt/bin/oxfmt --check --threads=1 tests/unit/eslint-plugin.test.ts`
    passed.
- Current state:
  - `tests/unit/eslint-plugin.test.ts` only retains protected/guard snippets for
    the guard-specific negative lint rule.

### 2026-06-05 Focused Security Validation

- Ran the broader security gate after the operation permission fixture cutovers,
  app operation guard type removal, public dts cutover, and eslint fixture
  cutover.
- Verification:
  - `CI=true pnpm run check:security:contract` passed.
  - `CI=true pnpm run check:docs:api-surface` passed.
  - `CI=true pnpm run test:security` passed:
    - source policy;
    - security contract drift check;
    - module build;
    - packed export policy;
    - 25 security/runtime unit files / 257 tests.
- Current state:
  - Security contract remains up to date after this fixture/type hard-cut pass.
  - Packed public exports still satisfy the removed unsafe API policy.

### 2026-06-05 Mini CMS Example AuthRequired Expectation Cleanup

- Updated `examples/08-component-mini-cms/test/componentMiniCms.test.ts` so the
  unauthenticated studio-list denial assertion checks for forbidden behavior
  without naming the internal `authRequired` sentinel.
- Verification:
  - `pnpm exec vitest run test/componentMiniCms.test.ts` from
    `examples/08-component-mini-cms` passed: 1 file / 10 tests.
  - `node node_modules/oxfmt/bin/oxfmt --check --threads=1 examples/08-component-mini-cms/test/componentMiniCms.test.ts`
    passed.
- Current state:
  - Maintained example tests no longer assert `Forbidden: authRequired` as a
    user-visible contract.

### 2026-06-05 MCP Advanced DefineMcpTool Cutover

- Replaced stale maintained docs, consumer-smoke fixture, and doctor custom-tool
  fixture references to standalone `defineTool(...)` with the current
  `defineMcpTool(...)` advanced helper.
- Cut the doctor custom-app-write scanner, public-surface source labels,
  explain test typing, and MCP ESLint rules over to `defineMcpTool(...)` so the
  static-analysis path has one current custom-tool name.
- Left the packed/source security bans for `defineTool` in place because those
  still prove the old advanced export has not reappeared.
- Verification:
  - `pnpm run build:cli` passed.
  - `node node_modules/vitest/vitest.mjs run --project=unit --pool=threads --maxWorkers=1 --no-file-parallelism tests/unit/cli-doctor.test.ts tests/unit/cli-explain.test.ts tests/unit/eslint-plugin.test.ts`
    passed: 3 files / 86 tests.
  - `pnpm run check:docs:links` passed.
  - `pnpm run check:docs:api-surface` passed.
  - `node node_modules/eslint/bin/eslint.js src/cli/lib/project.ts src/cli/lib/inventory.ts src/cli/lib/inventory-findings.ts src/module-internals/public-surface-codegen.ts src/eslint/rules/mcp.ts tests/unit/cli-doctor.test.ts tests/unit/cli-explain.test.ts tests/unit/eslint-plugin.test.ts tests/fixtures/consumer-smoke/server/api/trellis-smoke.get.ts --ignore-pattern '**/_generated/**'`
    passed.
  - `node node_modules/oxfmt/bin/oxfmt --check --threads=1 src/cli/lib/project.ts src/cli/lib/inventory.ts src/cli/lib/inventory-findings.ts src/module-internals/public-surface-codegen.ts src/eslint/rules/mcp.ts tests/unit/cli-doctor.test.ts tests/unit/cli-explain.test.ts tests/unit/eslint-plugin.test.ts tests/fixtures/consumer-smoke/server/api/trellis-smoke.get.ts apps/docs/content/docs/14.mcp-tools/2.define-tools.md apps/docs/content/docs/13.api-reference/5.mcp.md`
    passed.
  - `git diff --check` passed.
- Current state:
  - Maintained docs/fixtures and static-analysis surfaces now refer to the
    current advanced helper name for standalone custom MCP tools.

### 2026-06-05 Phase0 Workspace MCP Fixture Operation Permission Cutover

- Removed the duplicate backend operation `guard: projectDelete` from
  `tests/fixtures/phase0-workspace-mcp/convex/features/projects/operations.ts`.
- Kept `permission: projectDelete` as the single operation authorization
  descriptor because the shared descriptor and fixture tests already assert
  `permissionKey: 'projects.delete'`.
- Verification:
  - `node node_modules/vitest/vitest.mjs run --project=unit --pool=threads --maxWorkers=1 --no-file-parallelism tests/unit/phase0-workspace-mcp-fixture.test.ts tests/unit/operation-ref-codegen.test.ts`
    passed: 2 files / 5 tests.
  - `node node_modules/eslint/bin/eslint.js tests/fixtures/phase0-workspace-mcp/convex/features/projects/operations.ts --ignore-pattern '**/_generated/**'`
    passed.
  - `node node_modules/oxfmt/bin/oxfmt --check --threads=1 tests/fixtures/phase0-workspace-mcp/convex/features/projects/operations.ts`
    passed.
  - `rg -n "query\\.protected|mutation\\.protected|action\\.protected|guard:\\s*|authRequired|delegateToUser|readSharedSecretWebhookBody|stampMcpToolSafety|escapeIsolation|trellisUnsafeDb" tests/fixtures/phase0-workspace-mcp --glob '!node_modules/**' --glob '!dist/**'`
    returned no hits.
- Current state:
  - The phase0 workspace MCP fixture no longer carries old protected/guard
    normal-path metadata.

### 2026-06-05 Harness Auth-Only Operation Lane Cutover

- Cut auth-only harness app operations from operation `guard` metadata plus
  `mutation.protected(...)` to explicit lanes:
  - `apps/harness/convex/tasks.ts` now registers `addTaskOp` through
    `mutation.authenticated(...)`;
  - `apps/harness/convex/comments.ts` now uses
    `permission: commentCreatePermission` plus `mutation.workspace(...)`;
  - `apps/harness/convex/notes.ts` now models anonymous note creation as
    `operation.publicMutation(...)` with an explicit `publicWrite` facade and
    registers through `mutation.public(...)`;
  - `apps/harness/convex/posts.ts` now registers post creation through
    `mutation.authenticated(...)` and moves identity-scoped post list/get reads
    from `query.public(...)` to `query.authenticated(...)`.
- Added `commentCreatePermission` to the harness permission registry and MCP
  access snapshot so the new workspace-lane comment operation has concrete
  permission metadata.
- Cut `apps/harness/convex/crossTenant.ts` auth-only protected probes to
  `query.authenticated(...)` while preserving the named `crossTenant`
  capability proof.
- Left `apps/harness/convex/functionsProbe.ts`, `mcpKeys.ts`, and
  `organizations.ts` protected/guard registrations for later classification.
- Verification:
  - `CI=true pnpm run test:types:harness-server:prepared` passed.
  - `node node_modules/vitest/vitest.mjs run --project=convex --pool=threads --maxWorkers=1 --no-file-parallelism apps/harness/convex/posts.test.ts apps/harness/convex/crossTenant.test.ts apps/harness/convex/testingPackage.test.ts`
    passed: 3 files / 30 tests.
  - `node node_modules/eslint/bin/eslint.js apps/harness/convex/tasks.ts apps/harness/convex/comments.ts apps/harness/convex/notes.ts apps/harness/convex/auth/permissions.ts apps/harness/convex/posts.ts apps/harness/convex/posts.test.ts apps/harness/convex/crossTenant.ts apps/harness/server/mcp/runtime.ts --ignore-pattern '**/_generated/**'`
    passed.
  - `node node_modules/oxfmt/bin/oxfmt --check --threads=1 apps/harness/convex/tasks.ts apps/harness/convex/comments.ts apps/harness/convex/notes.ts apps/harness/convex/auth/permissions.ts apps/harness/convex/posts.ts apps/harness/convex/posts.test.ts apps/harness/convex/crossTenant.ts apps/harness/server/mcp/runtime.ts`
    passed.
- Current state:
  - The touched harness auth-only operations and identity-scoped read probes no
    longer use protected/guard as normal-path authorization.

### 2026-06-05 Harness Post Workspace Lane Completion

- Converted the remaining `apps/harness/convex/posts.ts` update, remove,
  confirmation remove, preview remove, and publish paths from
  `mutation.protected(...)` plus `guard: canManagePosts` to app operation
  definitions registered through `mutation.workspace(...)`.
- Added explicit harness permission handles for `post.update` and
  `post.publish`; reused `post.delete` for both direct and confirmation-backed
  deletes.
- Replaced the backend `implementOperation(...)` confirmation delete shape with
  an app `operation.destructive(...)` definition using the shared
  `removePostDescriptor` id/name/validators.
- Verification:
  - `CI=true pnpm run test:types:harness-server:prepared` passed.
  - `node node_modules/vitest/vitest.mjs run --project=convex --pool=threads --maxWorkers=1 --no-file-parallelism apps/harness/convex/posts.test.ts apps/harness/convex/crossTenant.test.ts apps/harness/convex/testingPackage.test.ts`
    passed: 3 files / 30 tests.
  - `node node_modules/eslint/bin/eslint.js apps/harness/convex/tasks.ts apps/harness/convex/comments.ts apps/harness/convex/notes.ts apps/harness/convex/auth/permissions.ts apps/harness/convex/posts.ts apps/harness/convex/posts.test.ts apps/harness/convex/crossTenant.ts apps/harness/server/mcp/runtime.ts --ignore-pattern '**/_generated/**'`
    passed.
  - `node node_modules/oxfmt/bin/oxfmt --check --threads=1 apps/harness/convex/tasks.ts apps/harness/convex/comments.ts apps/harness/convex/notes.ts apps/harness/convex/auth/permissions.ts apps/harness/convex/posts.ts apps/harness/convex/posts.test.ts apps/harness/convex/crossTenant.ts apps/harness/server/mcp/runtime.ts`
    passed.
  - `rg -n "query\\.protected|mutation\\.protected|action\\.protected|guard:\\s*|authRequired|defineGuard|implementOperation" apps/harness/convex/tasks.ts apps/harness/convex/comments.ts apps/harness/convex/notes.ts apps/harness/convex/auth/permissions.ts apps/harness/convex/posts.ts apps/harness/convex/posts.test.ts apps/harness/convex/crossTenant.ts apps/harness/server/mcp/runtime.ts`
    returned no hits.
- Current state:
  - `apps/harness/convex/posts.ts` no longer uses protected/guard registrations.
  - Remaining harness protected/guard hits are now limited to
    `functionsProbe.ts`, `mcpKeys.ts`, and `organizations.ts`.

### 2026-06-05 Harness Organization And MCP Key Lane Cutover

- Converted `apps/harness/convex/organizations.ts` from
  `mutation.protected(...)` plus an auth-only create guard to
  `mutation.authenticated(...)`.
- Moved `organizations.list` from `query.public(...)` to
  `query.authenticated(...)` because it reads the `organizations` table and is
  not part of the public-safe read table contract.
- Converted `apps/harness/convex/mcpKeys.ts` from protected guard
  registrations to:
  - `query.authenticated(...)` for list;
  - `operation.mutation(...)` plus `mutation.workspace(...)` for create and
    revoke.
- Added `mcpKeyManagePermission` to the harness permission registry and MCP
  access snapshot.
- Verification:
  - `node node_modules/vitest/vitest.mjs run --project=convex --pool=threads --maxWorkers=1 --no-file-parallelism apps/harness/convex/organizations.test.ts apps/harness/convex/mcpKeys.test.ts`
    passed: 2 files / 6 tests.
  - `CI=true pnpm run test:types:harness-server:prepared` passed.
  - `node node_modules/eslint/bin/eslint.js apps/harness/convex/tasks.ts apps/harness/convex/comments.ts apps/harness/convex/notes.ts apps/harness/convex/auth/permissions.ts apps/harness/convex/posts.ts apps/harness/convex/posts.test.ts apps/harness/convex/crossTenant.ts apps/harness/convex/organizations.ts apps/harness/convex/organizations.test.ts apps/harness/convex/mcpKeys.ts apps/harness/server/mcp/runtime.ts --ignore-pattern '**/_generated/**'`
    passed.
  - `node node_modules/oxfmt/bin/oxfmt --check --threads=1 apps/harness/convex/tasks.ts apps/harness/convex/comments.ts apps/harness/convex/notes.ts apps/harness/convex/auth/permissions.ts apps/harness/convex/posts.ts apps/harness/convex/posts.test.ts apps/harness/convex/crossTenant.ts apps/harness/convex/organizations.ts apps/harness/convex/organizations.test.ts apps/harness/convex/mcpKeys.ts apps/harness/server/mcp/runtime.ts`
    passed.
  - `rg -n "query\\.protected|mutation\\.protected|action\\.protected|guard:\\s*|authRequired|delegateToUser|readSharedSecretWebhookBody|stampMcpToolSafety|escapeIsolation|trellisUnsafeDb" apps/harness --glob '!node_modules/**' --glob '!dist/**'`
    now returns only `apps/harness/convex/functionsProbe.ts`.
- Current state:
  - The harness app surface no longer has stale protected/guard normal-path
    handlers outside the intentional `functionsProbe.ts` custom protected-lane
    runtime probes.

### 2026-06-05 Backend DTS Open Guard Fixture Cleanup

- Replaced the `guard: open` fixture in `tests/dts/functions.types.ts` with a
  named custom `defineGuard(...)` fixture.
- Tried cutting this backend `defineOperation(...)` fixture to operation
  `permission` metadata, but `CI=true pnpm run test:types:public` proved that
  the backend operation surface still requires a `guard`; app-operation
  permission metadata is covered in the app/type-primitives DTS fixtures.
- Verification:
  - `CI=true pnpm run test:types:public` passed.
  - `node node_modules/eslint/bin/eslint.js tests/dts/functions.types.ts`
    passed.
  - `node node_modules/oxfmt/bin/oxfmt --check --threads=1 tests/dts/functions.types.ts`
    passed.
  - `rg -n "guard:\\s*open|authRequired|open" tests/dts/functions.types.ts`
    returned no hits.
- Current state:
  - `tests/dts/functions.types.ts` remains backend custom-guard type coverage
    without teaching the banned `guard: open` path.

### 2026-06-05 MCP Runtime Type Open Guard Fixture Cleanup

- Replaced the destructive operation `guard: open` fixture in
  `tests/types/mcp-runtime.types.ts` with a named custom `defineGuard(...)`
  fixture.
- Left `tests/types/authenticated-guard.types.ts` untouched because it
  intentionally proves handler context narrowing for `open`, `authRequired`,
  and custom guards.
- Verification:
  - `CI=true pnpm run test:types:contracts` passed.
  - `node node_modules/eslint/bin/eslint.js tests/types/mcp-runtime.types.ts`
    passed.
  - `node node_modules/oxfmt/bin/oxfmt --check --threads=1 tests/types/mcp-runtime.types.ts`
    passed.
  - `rg -n "guard:\\s*open|authRequired|open" tests/types/mcp-runtime.types.ts`
    returned no hits.
- Current state:
  - `tests/types/mcp-runtime.types.ts` remains backend/MCP custom-guard type
    coverage without using the banned open guard fixture.

### 2026-06-05 MCP Tool Safety Fixture Descriptor Cutover

- Replaced the remaining direct `stampMcpToolSafety(...)` calls in
  `tests/unit/define-convex-tool.test.ts` with
  `defineMcpToolRefDescriptor(...)` plus `projectMcpToolRef(...)`.
- Kept direct `stampMcpToolSafety(...)` only in
  `src/runtime/mcp/operation-binding.ts`, where it is the internal projection
  implementation used by `projectMcpToolRef(...)`, and in security/export
  guardrail strings that assert the public unsafe helper does not reappear.
- Verification:
  - `node node_modules/vitest/vitest.mjs run --project=unit --pool=threads --maxWorkers=1 --no-file-parallelism tests/unit/define-convex-tool.test.ts`
    passed: 1 file / 33 tests.
  - `node node_modules/eslint/bin/eslint.js tests/unit/define-convex-tool.test.ts`
    passed.
  - `node node_modules/oxfmt/bin/oxfmt --check --threads=1 tests/unit/define-convex-tool.test.ts`
    passed after formatting.
  - `rg -n "stampMcpToolSafety" tests/unit/define-convex-tool.test.ts`
    returned no hits.
- Current state:
  - MCP tool tests use descriptor projection for direct mutation safety instead
    of calling the low-level stamper fixture directly.

### 2026-06-05 Internal Skill Reference Hard-Cut Cleanup

- Cut over stale internal skill references in `meta/skill/references` so future
  local guidance no longer teaches removed 0.2-era normal paths:
  - replaced raw `auth: 'trusted'` server/MCP guidance with
    verifier-produced `transportProof.*(...)` auth plus replay intent;
  - removed `delegateToUser` from the documented server helper surface and
    pointed acting-for flows at `requireDelegationBinding(...)`;
  - replaced low-level MCP `defineTool(...)` naming with
    `defineMcpTool(...)`;
  - replaced the backend reference's `mutation.protected(...)` plus `guard`
    canonical handler with `mutation.workspace(...)` plus `permission`;
  - replaced normal `ctx.db.escapeIsolation(...)` guidance with
    definition-visible `crossTenant` capabilities;
  - classified `authRequired` and `open` as internal/runtime sentinels, not
    public app-author primitives.
- Verification:
  - `rg -n "guard:\\s*open|stampMcpToolSafety|defineTool|escapeIsolation|query\\.protected|mutation\\.protected|action\\.protected|authRequired|delegateToUser|auth:\\s*'trusted'|readSharedSecretWebhookBody" meta/skill/references apps/docs tests/types tests/dts --glob '!node_modules/**' --glob '!dist/**'`
    now returns only intentional custom protected-lane docs, explicit
    `authRequired` anti-guidance, and the
    `tests/types/authenticated-guard.types.ts` narrowing fixture.
- Current state:
  - `meta/skill/references` no longer contains stale normal-path
    `auth: 'trusted'`, `delegateToUser`, `escapeIsolation`,
    `mutation.protected(...)`, or low-level MCP `defineTool(...)` guidance.

### 2026-06-05 Escape Isolation ESLint Rule Removal

- Deleted the obsolete `@lupinum/trellis/escape-isolation-requires-reason`
  ESLint rule and removed it from the recommended config.
- Removed the test fixture that treated `ctx.db.escapeIsolation({})` as a
  repairable lint issue. Normal handler `ctx.db` no longer exposes
  `escapeIsolation`, and production-copyable source is covered by the stronger
  source-policy ban, so keeping a "just add a reason" lint rule preserved the
  wrong path.
- Verification:
  - `rg -n "escape-isolation-requires-reason|reasons on isolation escapes|escapeIsolation\\(\\{\\}\\)|escapeIsolation" src/eslint tests/unit/eslint-plugin.test.ts`
    returned no hits.
  - `node node_modules/vitest/vitest.mjs run --project=unit --pool=threads --maxWorkers=1 --no-file-parallelism tests/unit/eslint-plugin.test.ts`
    passed: 1 file / 15 tests.
  - `node node_modules/eslint/bin/eslint.js src/eslint/rules/isolation.ts src/eslint/rules/index.ts tests/unit/eslint-plugin.test.ts`
    passed.
- Current state:
  - The ESLint plugin no longer offers a weaker compatibility-style
    `escapeIsolation` reason rule; source policy remains the enforcement path
    for the removed normal-lane API.

### 2026-06-05 Escape Isolation Doctor Finding Hard-Fail Cutover

- Changed the CLI doctor cross-scope escape finding from an advanced pass-only
  inventory to a core failure when deleted `ctx.db.escapeIsolation(...)` usage
  is present.
- Updated the doctor regression fixture so the unsafe permit inventory still
  passes as review inventory, while generic `escapeIsolation` usage fails with
  a `crossTenant` migration hint.
- Verification:
  - `pnpm run build:cli` passed after the doctor implementation change.
  - `node node_modules/vitest/vitest.mjs run --project=unit --pool=threads --maxWorkers=1 --no-file-parallelism tests/unit/cli-doctor.test.ts -t "unsafe inventory and fails deleted cross-scope escapes"`
    passed: 1 selected test.
  - `node node_modules/vitest/vitest.mjs run --project=unit --pool=threads --maxWorkers=1 --no-file-parallelism tests/unit/cli-doctor.test.ts`
    passed: 1 file / 62 tests.
  - `node node_modules/eslint/bin/eslint.js src/cli/lib/inventory-findings.ts tests/unit/cli-doctor.test.ts`
    passed.
  - `rg -n 'No \`ctx\\.db\\.escapeIsolation|Review each isolation escape|No action needed unless the app adds cross-scope|escape-isolation-requires-reason|reasons on isolation escapes' src tests apps/docs meta/skill/references --glob '!dist/**' --glob '!node_modules/**'`
    returned no hits.
- Current state:
  - CLI doctor now treats `ctx.db.escapeIsolation(...)` as a deleted API to
    remove, not an advanced escape hatch to review with a reason string.

### 2026-06-05 MCP Direct Mutation First-Reader Guidance Cutover

- Removed `tool.mutation(...)` as normal first-reader MCP write guidance from:
  - concepts call-pattern docs;
  - MCP getting-started docs;
  - MCP define-tools docs;
  - generated starter AGENTS files;
  - internal server/MCP skill reference.
- Reframed MCP writes as operation-backed by default so permission, replay,
  preview, and audit metadata remain backend-owned.
- Kept the API/reference docs honest that `tool.mutation(...)` still exists as
  a narrow advanced bounded-write lane for backend-stamped refs, without
  presenting it as the app-write path.
- Updated starter AGENTS guidance from generic protected signed-in handlers to
  explicit `authenticated(...)` and `workspace(...)` lanes.
- Verification:
  - `rg -n 'tool\\.mutation|mcp\\.tool\\.mutation|protected handlers for signed-in|bounded writes through|Bounded writes via' apps/docs/content/docs/02.concepts apps/docs/content/docs/13.api-reference/5.mcp.md apps/docs/content/docs/14.mcp-tools src/cli/starter-fixtures meta/skill/references/server-mcp.md`
    now returns only the API/reference advanced bounded-write mentions.
  - `node node_modules/oxfmt/bin/oxfmt --check --threads=1 apps/docs/content/docs/02.concepts/4.call-patterns.md apps/docs/content/docs/13.api-reference/5.mcp.md apps/docs/content/docs/14.mcp-tools/1.getting-started.md apps/docs/content/docs/14.mcp-tools/2.define-tools.md src/cli/starter-fixtures/public/AGENTS.md src/cli/starter-fixtures/personal/AGENTS.md src/cli/starter-fixtures/workspace/AGENTS.md src/cli/starter-fixtures/workspace-mcp/AGENTS.md meta/skill/references/server-mcp.md`
    passed.
  - `pnpm run check:docs:links` passed.
  - `pnpm run check:docs:api-surface` passed.
  - `pnpm run check:starter-fixtures:doctor` passed for public, personal,
    workspace, and workspace-MCP starters.
- Current state:
  - First-reader MCP guidance no longer points app authors at direct mutation
    tools for writes; operation-backed MCP write projection is the default
    documented path.

### 2026-06-05 Advanced MCP App-Write Type Guard

- Added a public DTS assertion proving standalone
  `@lupinum/trellis/mcp/advanced` `defineMcpTool(...)` handlers do not expose
  app-write helpers:
  - `extra.mutation(...)` is a type error;
  - `extra.action(...)` is a type error.
- This pins the current quarantine for the surviving advanced MCP export: it
  can define custom toolkit tools, but it is not a Trellis app-write path.
- Verification:
  - `CI=true pnpm run test:types:public` passed.
  - `node node_modules/eslint/bin/eslint.js tests/dts/mcp.types.ts` passed.
  - `node node_modules/oxfmt/bin/oxfmt --check --threads=1 tests/dts/mcp.types.ts`
    passed.
- Current state:
  - Public type coverage now proves the advanced MCP subpath cannot directly
    call Convex mutations/actions through Trellis-provided handler context.

### 2026-06-05 Meta Trusted Transport Guidance Cutover

- Cut stale raw `auth: 'trusted'` guidance from meta planning/RFC documents:
  - `meta/rfc/0006-narrow-trusted-mcp-convex-caller.md` now describes
    `transportProof.mcp(...)` instead of raw trusted caller options;
  - `meta/vnext-roadmap.md` now uses `transportProof.*(...)`, explicit
    `authenticated(...)` / `workspace(...)` backend lanes, and
    operation-backed MCP write guidance.
- Left raw `auth: 'trusted'` only in intentional negative/security tests.
- Verification:
  - `rg -n "auth:\\s*['\\\"]trusted['\\\"]" . --glob '!node_modules/**' --glob '!dist/**' --glob '!progress_0.3.0.md' --glob '!0.3.0.md' --glob '!auth-review-rfc.md' --glob '!library-review-state.md' --glob '!summary.md' --glob '!SPEC.md' --glob '!a_target.md' --glob '!handover_0.3.0.md'`
    now returns only `tests/unit/server-convex-utils.test.ts` rejection
    coverage and `tests/unit/example-webhook-security.test.ts` negative
    assertions.
  - `node node_modules/oxfmt/bin/oxfmt --check --threads=1 meta/rfc/0006-narrow-trusted-mcp-convex-caller.md meta/vnext-roadmap.md`
    passed.
  - `git diff --check` passed.
- Current state:
  - Current meta guidance no longer teaches raw trusted auth, protected
    signed-in handlers, or direct MCP mutation as normal future/starter paths.

### 2026-06-05 Starter Guard Scaffold Removal

- Removed unused/generated starter guard scaffold files:
  - `src/cli/starter-fixtures/personal/convex/auth/guards.ts`;
  - `src/cli/starter-fixtures/workspace/convex/auth/guards.ts`;
  - `src/cli/starter-fixtures/workspace-mcp/convex/auth/guards.ts`.
- Replaced workspace and workspace-MCP starter permission composition with
  direct `definePermission(...)` check predicates in the feature permission
  modules, so permission files are the single source of truth.
- Updated backend builder docs and internal backend reference so
  `protected(...)` is described as the intentional custom-guard lane, not a
  migration-only spelling.
- Updated permission setup docs so the generated scaffold list no longer
  promises `convex/auth/guards.ts`.
- Verification:
  - `rg -n "from ['\\\"].*/auth/guards|auth/guards|defineGuard|guard:" src/cli/starter-fixtures/personal src/cli/starter-fixtures/workspace src/cli/starter-fixtures/workspace-mcp --glob '!node_modules/**' --glob '!dist/**'`
    returned no hits.
  - `pnpm run check:starter-fixtures:doctor` passed for public, personal,
    workspace, and workspace-MCP starters.
  - `pnpm run check:docs:links` passed.
  - `pnpm run check:docs:api-surface` passed.
  - `node node_modules/oxfmt/bin/oxfmt --check --threads=1 src/cli/starter-fixtures/workspace/convex/features/todos/permissions.ts src/cli/starter-fixtures/workspace-mcp/convex/features/todos/permissions.ts apps/docs/content/docs/08.permissions/0.backend-builders.md apps/docs/content/docs/08.permissions/1.setup.md meta/skill/references/backend-auth-permissions.md`
    passed.
- Current state:
  - Generated starters no longer carry guard helper scaffolding as a normal
    signed-in/workspace authorization path.

### 2026-06-05 Add Resource Guard Import Removal

- Removed stale `auth/guards` assumptions from CLI add-resource generation:
  - deleted `guardImportPath` from the resource generator context;
  - generated personal/author-owned resource permissions now use direct
    `appIdentity !== null` predicates;
  - generated workspace resource permissions now use local role/workspace
    predicate helpers in the permission file.
- Removed deleted starter guard paths from `trellis add auth` /
  `trellis add workspace` fixture file lists.
- Updated phase0 starter manifest and CLI add-resource tests so they no longer
  expect guard scaffold files or generated guard-helper imports.
- Verification:
  - `node node_modules/vitest/vitest.mjs run --project=unit --pool=threads --maxWorkers=1 --no-file-parallelism tests/unit/phase0-starter-manifest.test.ts tests/unit/cli-add-resource.test.ts`
    passed: 2 files / 14 tests.
  - `node node_modules/eslint/bin/eslint.js src/cli/lib/resource.ts src/cli/lib/init.ts tests/unit/phase0-starter-manifest.test.ts tests/unit/cli-add-resource.test.ts`
    passed.
  - `node node_modules/oxfmt/bin/oxfmt --check --threads=1 src/cli/lib/resource.ts src/cli/lib/init.ts tests/unit/phase0-starter-manifest.test.ts tests/unit/cli-add-resource.test.ts`
    passed.
  - `pnpm run check:starter-fixtures:doctor` passed for public, personal,
    workspace, and workspace-MCP starters.
  - `rg -n "convex/auth/guards\\.ts|auth/guards|guardImportPath|check: isAuthenticated|hasWorkspace\\.and\\(hasMinimumRole|from ['\\\"].*/auth/guards" src/cli tests/unit/phase0-starter-manifest.test.ts tests/unit/cli-add-resource.test.ts apps/docs meta/skill/references --glob '!dist/**' --glob '!node_modules/**'`
    now returns only intentional maintained example index and dedicated guard
    docs references.
- Current state:
  - New CLI-generated resource slices no longer depend on or recreate the
    removed starter guard scaffold.

### 2026-06-05 Maintained Example Auth-Only Guard Cleanup

- Deleted unused `examples/02-auth-todo/convex/auth/guards.ts`; the example now
  uses authenticated lanes and direct appIdentity checks instead of an
  auth-only guard helper file.
- Cut `examples/03-team-workspace/convex/features/todos/permissions.ts` from
  auth guard composition to direct permission predicates. The example keeps its
  `convex/auth/guards.ts` file only for record-specific custom guard helpers
  still used by `checks.ts` and recordAccess.
- Updated the examples index so the `02-auth-todo` read-first file list no
  longer points at the deleted guard file.
- Verification:
  - `pnpm --dir examples/02-auth-todo exec vue-tsc --noEmit` passed.
  - `pnpm --dir examples/03-team-workspace exec vue-tsc --noEmit` passed.
  - `node node_modules/oxfmt/bin/oxfmt --check --threads=1 examples/03-team-workspace/convex/features/todos/permissions.ts apps/docs/content/docs/5.examples.md`
    passed.
  - `pnpm run check:docs:links` passed.
- Current state:
  - Example 02 no longer carries a normal-path auth-only guard scaffold.
  - Example 03 permissions are direct permission predicates; remaining guard
    helpers there are intentional custom record checks.

### 2026-06-05 Phase0 MCP Create Tool Operation Cutover

- Cut the phase0 workspace-MCP fixture's `create-project` tool from the
  MCP-local `tool.mutation(...)` / `defineMcpToolRefDescriptor(...)` path to
  an operation-backed `tool.operation(...)` binding.
- Added `createProjectDescriptor` and `projectCreate` permission metadata so
  create and delete project tools share the operation descriptor path.
- Deleted obsolete fixture-local generated MCP tool refs:
  - `tests/fixtures/phase0-workspace-mcp/generated/mcp-tool-refs.ts`;
  - `tests/fixtures/phase0-workspace-mcp/shared/features/projects/tools.ts`.
- Updated operation-ref codegen to emit formatter-stable multi-descriptor
  imports, then updated phase0 fixture/codegen tests to expect operation refs as
  the single generated binding file.
- Verification:
  - `node node_modules/vitest/vitest.mjs run --project=unit --pool=threads --maxWorkers=1 --no-file-parallelism tests/unit/phase0-workspace-mcp-fixture.test.ts tests/unit/operation-ref-codegen.test.ts tests/unit/phase0-starter-manifest.test.ts`
    passed: 3 files / 10 tests.
  - `node node_modules/eslint/bin/eslint.js src/module-internals/ref-codegen.ts tests/unit/phase0-workspace-mcp-fixture.test.ts tests/unit/operation-ref-codegen.test.ts tests/unit/phase0-starter-manifest.test.ts tests/fixtures/phase0-workspace-mcp/shared/features/projects/permissions.ts tests/fixtures/phase0-workspace-mcp/convex/features/projects/permissions.ts tests/fixtures/phase0-workspace-mcp/shared/features/projects/operations.ts tests/fixtures/phase0-workspace-mcp/shared/features/projects/feature.ts tests/fixtures/phase0-workspace-mcp/convex/features/projects/operations.ts tests/fixtures/phase0-workspace-mcp/convex/features/projects/domain.ts tests/fixtures/phase0-workspace-mcp/generated/operation-refs.ts tests/fixtures/phase0-workspace-mcp/server/mcp/tools/create-project.ts --ignore-pattern '**/_generated/**'`
    passed.
  - `node node_modules/oxfmt/bin/oxfmt --check --threads=1 src/module-internals/ref-codegen.ts tests/fixtures/phase0-workspace-mcp/shared/features/projects/permissions.ts tests/fixtures/phase0-workspace-mcp/convex/features/projects/permissions.ts tests/fixtures/phase0-workspace-mcp/shared/features/projects/operations.ts tests/fixtures/phase0-workspace-mcp/shared/features/projects/feature.ts tests/fixtures/phase0-workspace-mcp/convex/features/projects/operations.ts tests/fixtures/phase0-workspace-mcp/convex/features/projects/domain.ts tests/fixtures/phase0-workspace-mcp/generated/operation-refs.ts tests/fixtures/phase0-workspace-mcp/server/mcp/tools/create-project.ts tests/unit/operation-ref-codegen.test.ts tests/unit/phase0-starter-manifest.test.ts tests/unit/phase0-workspace-mcp-fixture.test.ts`
    passed.
  - `rg -n "createProjectToolDescriptor|generated/mcp-tool-refs|shared/features/projects/tools|tool\\.mutation\\(" tests/fixtures/phase0-workspace-mcp tests/unit/phase0-workspace-mcp-fixture.test.ts tests/unit/operation-ref-codegen.test.ts tests/unit/phase0-starter-manifest.test.ts`
    now returns only negative assertions.
  - `rg -n "tool\\.mutation\\(" tests/fixtures/phase0-workspace-mcp src/cli/starter-fixtures examples --glob '!node_modules/**' --glob '!dist/**' --glob '!.nuxt/**'`
    now returns only the Example 07 negative assertion.
- Current state:
  - Maintained starter/example/phase0 fixture paths no longer expose
    production-template MCP writes through direct `tool.mutation(...)`.

### 2026-06-05 MCP Direct Write Guidance Hint Cleanup

- Removed remaining CLI upgrade/doctor fix hints that pointed custom MCP app
  writes at direct `tool.mutation(...)` bounded-write helpers.
- Reworded those hints to send app writes through operation descriptors and
  `tool.operation(...)`, using `safety: "bounded-write"` for bounded write
  operations.
- Updated the roadmap's MCP safety "bad" example so it no longer names
  `tool.mutation(...)` as the destructive anti-pattern.
- Verification:
  - `node node_modules/vitest/vitest.mjs run --project=unit --pool=threads --maxWorkers=1 --no-file-parallelism tests/unit/cli-doctor.test.ts -t "standalone custom MCP tool calls Convex writes"`
    passed: 1 selected test.
  - `node node_modules/vitest/vitest.mjs run --project=unit --pool=threads --maxWorkers=1 --no-file-parallelism tests/unit/cli-upgrade.test.ts -t "MCP|mcp|upgrade-mcp|tool.fromOperation"`
    passed: 3 selected tests.
  - `node node_modules/eslint/bin/eslint.js src/cli/commands/upgrade.ts src/cli/lib/inventory-findings.ts`
    passed.
  - `node node_modules/oxfmt/bin/oxfmt --check --threads=1 src/cli/commands/upgrade.ts src/cli/lib/inventory-findings.ts meta/vnext-roadmap.md`
    passed.
  - `rg -n 'Use \`tool\\.mutation|defineMcpApp\\(\\.\\.\\.\\)\\.tool\\.mutation|bounded writes or \`tool\\.operation|tool\\.mutation\\(' src/cli meta/vnext-roadmap.md meta/skill/references src/cli/starter-fixtures tests/fixtures/phase0-workspace-mcp examples apps/docs/content/docs/02.concepts apps/docs/content/docs/14.mcp-tools apps/docs/content/docs/13.api-reference/5.mcp.md --glob '!node_modules/**' --glob '!dist/**' --glob '!.nuxt/\*\*'`
    now returns only deliberate API/reference docs for the surviving advanced
    bounded-write helper and the Example 07 negative assertion.
- Current state:
  - Normal migration and doctor guidance no longer recommends direct MCP
    mutation helpers for app writes.

### 2026-06-05 MCP Tool Ref Codegen Branch Removal

- Removed the now-unused starter fixture `mcpToolRefs` generated-file branch
  from `src/module-internals/starter-fixture-codegen.ts`.
- Deleted `src/module-internals/mcp-tool-ref-codegen.ts`; phase0 and starter
  generation now use operation refs as the single generated MCP write binding
  path.
- Tightened stale advanced MCP wording:
  - `src/runtime/mcp/types.ts` now says custom app writes use operation-backed
    MCP tools;
  - `meta/rfc/0011-hard-cut-operation-ladder-release.md` now describes
    `mcp/advanced` as standalone read, diagnostic, or external-service tooling
    and keeps app writes operation-backed.
- Verification:
  - `node node_modules/vitest/vitest.mjs run --project=unit --pool=threads --maxWorkers=1 --no-file-parallelism tests/unit/operation-ref-codegen.test.ts tests/unit/phase0-starter-manifest.test.ts`
    passed: 2 files / 8 tests.
  - `node node_modules/eslint/bin/eslint.js src/module-internals/starter-fixture-codegen.ts src/module-internals/ref-codegen.ts src/runtime/mcp/types.ts`
    passed.
  - `node node_modules/oxfmt/bin/oxfmt --check --threads=1 src/module-internals/starter-fixture-codegen.ts src/module-internals/ref-codegen.ts src/runtime/mcp/types.ts meta/rfc/0011-hard-cut-operation-ladder-release.md`
    passed.
  - `rg -n "mcpToolRefs|renderMcpToolRefsModule|McpToolRefBindingInput|projectMcpToolRefImport|mcp-tool-ref-codegen" src tests scripts --glob '!dist/**' --glob '!node_modules/**'`
    returned no hits.
- Current state:
  - Starter fixture generation no longer has a parallel MCP-local ref codegen
    path beside operation refs.

### 2026-06-05 Operation Ladder RFC Stale Surface Cleanup

- Updated `meta/rfc/0011-hard-cut-operation-ladder-release.md` so its
  operation-ladder example no longer teaches `mutation.protected({ guard })` as
  the normal implementation shape.
- Replaced the example with `mutation.workspace({ permission })` and direct
  `ctx.workspaceId` usage.
- Removed the nonexistent `@lupinum/trellis/backend/advanced` subpath from the
  RFC's advanced import guidance; low-level backend builders now point at the
  surviving `@lupinum/trellis/backend` surface.
- Tightened the same RFC's MCP advanced text so standalone advanced tools are
  read, diagnostic, or external-service tools while app writes remain
  operation-backed.
- Verification:
  - `rg -n "query\\.protected|mutation\\.protected|action\\.protected|guard:\\s*|authRequired|tool\\.mutation|tool\\.fromOperation|@lupinum/trellis/backend/advanced|used by protected handlers" meta/rfc/0011-hard-cut-operation-ladder-release.md`
    returned no hits.
  - `node node_modules/oxfmt/bin/oxfmt --check --threads=1 meta/rfc/0011-hard-cut-operation-ladder-release.md`
    passed.
- Current state:
  - The operation-ladder RFC no longer creates a second old-path story for
    operation authoring, advanced backend imports, or MCP app writes.

### 2026-06-05 Functions API Reference Authorization Wording Cleanup

- Updated `apps/docs/content/docs/13.api-reference/3.functions.md` so the
  public authorization model no longer centers business authorization on
  `guard`.
- Reframed `defineTrellis(...)` as the entrypoint for explicit lane containers,
  with operation permission metadata, lane choice, `load`, `authorize`, and
  `handler` as the normal authorization story.
- Kept `query.protected` / `mutation.protected` in the reference as
  custom-guard lanes, not migration/default lanes.
- Verification:
  - `pnpm run check:docs:links` passed.
  - `pnpm run check:docs:api-surface` passed.
  - `rg -n 'public authorization model: keep business authorization in \`guard\`|protected query|migration lanes|guard:\\s\*|authRequired' apps/docs/content/docs/13.api-reference/3.functions.md`
    returned no hits.
  - `node node_modules/oxfmt/bin/oxfmt --check --threads=1 apps/docs/content/docs/13.api-reference/3.functions.md meta/rfc/0011-hard-cut-operation-ladder-release.md progress_0.3.0.md`
    passed before this ledger entry.
- Current state:
  - The functions API reference no longer describes guard-first authorization
    as the public model.

### 2026-06-05 MCP Define Tools Guide Direct Mutation Removal

- Removed `tool.mutation(...)` from
  `apps/docs/content/docs/14.mcp-tools/2.define-tools.md` so the guide presents
  normal app-backed MCP writes through `tool.operation(...)` only.
- Deleted the guide's "Advanced bounded writes" section; the narrow surviving
  direct mutation surface is left to the API reference instead of first-reader
  tool authoring guidance.
- Updated the same guide's backend enforcement wording from guard-centered
  language to permission or custom-guard checks.
- Verification:
  - `pnpm run check:docs:links` passed.
  - `pnpm run check:docs:api-surface` passed.
  - `rg -n "tool\\.mutation\\(" apps/docs/content/docs src/cli/starter-fixtures tests/fixtures/phase0-workspace-mcp examples meta/skill meta/rfc --glob '!node_modules/**' --glob '!dist/**' --glob '!.nuxt/**'`
    now returns only the MCP API reference and the Example 07 negative
    assertion.
  - `node node_modules/oxfmt/bin/oxfmt --check --threads=1 apps/docs/content/docs/14.mcp-tools/2.define-tools.md`
    passed.
- Current state:
  - First-reader MCP tool-definition docs no longer present direct mutation
    tools as an authoring option.

### 2026-06-05 Direct MCP Mutation Factory Removal

- Removed `defineMcpApp(...).tool.mutation(...)` from the runtime MCP app
  surface so app-backed MCP writes have one path: operation-backed tools.
- Deleted the MCP-local write-safety projection helpers from
  `src/runtime/mcp/operation-binding.ts`:
  - `defineMcpToolRefDescriptor(...)`;
  - `projectMcpToolRef(...)`;
  - `stampMcpToolSafety(...)`;
  - `trellisMcpToolSafetyKey`;
  - `getMcpToolSafety(...)`.
- Removed the direct mutation factory from `ToolFactory` and `ToolOptions`
  safety metadata in `src/runtime/mcp/define-mcp-app.ts`.
- Converted remaining middleware/rate-limit tests to direct read tools and
  deleted direct mutation safety tests that only covered the removed path.
- Removed `tool.mutation(...)` from the MCP API reference and added a public
  DTS assertion proving `runtime.tool.mutation(...)` is no longer available.
- Verification:
  - `node node_modules/vitest/vitest.mjs run --project=unit --pool=threads --maxWorkers=1 --no-file-parallelism tests/unit/define-convex-tool.test.ts tests/unit/mcp-operation-binding.test.ts tests/unit/mcp-index-exports.test.ts tests/unit/operation-ref-codegen.test.ts tests/unit/phase0-workspace-mcp-fixture.test.ts`
    passed: 5 files / 48 tests.
  - `CI=true pnpm run test:types:public` passed.
  - `node node_modules/eslint/bin/eslint.js src/runtime/mcp/define-mcp-app.ts src/runtime/mcp/operation-binding.ts tests/unit/define-convex-tool.test.ts tests/unit/mcp-operation-binding.test.ts tests/dts/mcp.types.ts`
    passed.
  - `pnpm run check:security:source-policy` passed.
  - `pnpm run check:publish-surface` passed.
  - `pnpm run check:docs:links` passed.
  - `pnpm run check:docs:api-surface` passed.
  - `rg -n "tool\\.mutation|mcp\\.tool\\.mutation|defineMcpToolRefDescriptor|projectMcpToolRef|getMcpToolSafety|stampMcpToolSafety|trellisMcpToolSafetyKey|McpToolRefDescriptor|TrellisMcpToolSafety" src tests apps/docs examples meta --glob '!node_modules/**' --glob '!dist/**' --glob '!progress_0.3.0.md'`
    now returns only negative assertions, legacy-detection fixtures, and the
    public DTS `@ts-expect-error` assertion for the deleted factory.
- Current state:
  - Trellis MCP app writes no longer have a parallel direct mutation path or
    MCP-local safety-stamping path beside operation-backed tools.

### 2026-06-05 Security Contract Deleted File Hard-Cut Fix

- Fixed `scripts/lib/security-contract.mjs` so tracked source collection uses
  the current worktree state, not only `git ls-files`; deleted-but-unstaged
  files from this broad hard cut are no longer read during contract generation.
- Regenerated `security-contract.generated.json` after the harness lane and
  direct MCP mutation cutovers. The generated contract now records current
  explicit lanes such as authenticated/workspace/public instead of stale
  protected/guard entries for already-cut harness files.
- Verification:
  - `pnpm run check:security:contract` passed after regeneration.
  - `node node_modules/vitest/vitest.mjs run --project=unit --pool=threads --maxWorkers=1 --no-file-parallelism tests/unit/security-contract.test.ts`
    passed: 1 file / 2 tests.
  - `pnpm run check:security:source-policy` passed.
  - `node node_modules/eslint/bin/eslint.js scripts/lib/security-contract.mjs tests/unit/security-contract.test.ts`
    passed.
  - `node node_modules/oxfmt/bin/oxfmt --check --threads=1 scripts/lib/security-contract.mjs tests/unit/security-contract.test.ts progress_0.3.0.md`
    passed before this ledger entry.
- Current state:
  - Security contract generation no longer depends on deleted starter/example
    files and the generated security inventory matches the current worktree.

### 2026-06-05 Exact MCP Entrypoint Surface Test

- Tightened `tests/unit/mcp-index-exports.test.ts` from
  `expect.arrayContaining(...)` to exact runtime export lists for both
  `@lupinum/trellis/mcp` and `@lupinum/trellis/mcp/advanced`.
- Updated stale MCP comments in `src/runtime/mcp/index.ts` and
  `src/runtime/mcp/advanced.ts` so `defineMcpApp` is documented as returning
  `tool.query` and `tool.operation`, with no deleted direct mutation lane.
- Verification:
  - `node node_modules/vitest/vitest.mjs run --project=unit --pool=threads --maxWorkers=1 --no-file-parallelism tests/unit/mcp-index-exports.test.ts`
    passed: 1 file / 4 tests.
  - `pnpm exec eslint tests/unit/mcp-index-exports.test.ts src/runtime/mcp/index.ts src/runtime/mcp/advanced.ts`
    passed.
  - `pnpm exec oxfmt --check tests/unit/mcp-index-exports.test.ts src/runtime/mcp/index.ts src/runtime/mcp/advanced.ts`
    passed.
  - `pnpm run check:publish-surface` passed.
  - `git diff --check` passed.
- Current state:
  - Extra MCP entrypoint runtime exports now fail a focused unit test instead
    of being accepted beside the blessed surface.

### 2026-06-05 Advanced MCP Tool Shape Cleanup

- Cut `tests/fixtures/shared-schema-mcp-boundary/server/mcp/tools/create-task.ts`
  from the deleted advanced `defineTool(...)` symbol and Trellis-only
  `schema/effect` shape to the surviving raw toolkit `defineMcpTool(...)`
  helper with `inputSchema`.
- Updated `apps/docs/content/docs/14.mcp-tools/2.define-tools.md` so standalone
  advanced tools no longer show Trellis-only `schema`, `effect`, `permit`,
  `ctx.ok`, or app-call helper semantics. The guide now keeps app-backed reads
  on `tool.query(...)` and app writes on `tool.operation(...)`.
- Removed stale `safety` from the server/MCP skill reference's normal tool
  option list.
- Updated the CLI doctor standalone-write fixture to use
  `defineMcpTool(...)`/`inputSchema` while preserving the intentional bad
  `ctx.mutation(...)` call that doctor detects.
- Verification:
  - `node node_modules/vitest/vitest.mjs run --project=unit --pool=threads --maxWorkers=1 --no-file-parallelism tests/unit/shared-schema-mcp-boundary-build.test.ts tests/unit/cli-doctor.test.ts -t "standalone custom MCP tool calls Convex writes|shared schema"`
    passed: 2 files / 2 selected tests.
  - `pnpm exec eslint tests/fixtures/shared-schema-mcp-boundary/server/mcp/tools/create-task.ts tests/unit/cli-doctor.test.ts --ignore-pattern '**/_generated/**'`
    passed.
  - `pnpm run check:docs:links` passed.
  - `pnpm run check:docs:api-surface` passed.
  - `pnpm exec oxfmt --check tests/fixtures/shared-schema-mcp-boundary/server/mcp/tools/create-task.ts tests/unit/cli-doctor.test.ts apps/docs/content/docs/14.mcp-tools/2.define-tools.md meta/skill/references/server-mcp.md`
    passed.
  - `rg -n 'import \\{ defineTool \\} from .*runtime/mcp/advanced|export default defineTool\\(|effect:|permit:|ctx\\.ok|Standalone \`defineMcpTool\\(\\.\\.\\.\\)\` also accepts \`rateLimitStore\`|\`safety\`' apps/docs/content/docs/14.mcp-tools/2.define-tools.md meta/skill/references/server-mcp.md tests/fixtures/shared-schema-mcp-boundary/server/mcp/tools/create-task.ts`
    returned no hits.
  - `git diff --check` passed.
- Current state:
  - First-reader MCP docs and the shared-schema fixture no longer preserve the
    deleted Trellis advanced `defineTool(...)` semantics beside raw
    `defineMcpTool(...)`.

### 2026-06-05 Internal MCP DefineTool Name Removal

- Removed the exported `defineTool(...)` helper from
  `src/runtime/mcp/define-convex-tool.ts`; `defineMcpApp(...)` now calls the
  internal `defineConvexToolInternal(...)` builder directly.
- Renamed the direct unit-test import/calls in
  `tests/unit/define-convex-tool.test.ts` to `defineConvexToolInternal(...)`
  so tests no longer normalize the deleted advanced helper name as an internal
  API.
- Updated MCP runtime and schema-projection diagnostics from `defineTool` to
  `defineMcpApp.tool`, keeping user-facing errors aligned with the supported
  app-tool entrypoint.
- Verification:
  - `node node_modules/vitest/vitest.mjs run --project=unit --pool=threads --maxWorkers=1 --no-file-parallelism tests/unit/define-convex-tool.test.ts tests/unit/mcp-index-exports.test.ts`
    passed: 2 files / 33 tests.
  - `pnpm exec eslint src/runtime/mcp/define-convex-tool.ts src/runtime/mcp/define-mcp-app.ts src/runtime/mcp/convex-to-mcp-zod.ts tests/unit/define-convex-tool.test.ts tests/unit/mcp-index-exports.test.ts`
    passed.
  - `pnpm run check:security:source-policy` passed.
  - `pnpm run check:security:contract` passed and reported the contract up to
    date.
  - `pnpm run check:publish-surface` passed.
  - `pnpm exec oxfmt --check src/runtime/mcp/define-convex-tool.ts src/runtime/mcp/define-mcp-app.ts src/runtime/mcp/convex-to-mcp-zod.ts tests/unit/define-convex-tool.test.ts tests/unit/mcp-index-exports.test.ts`
    passed.
  - `rg -n "defineTool" src/runtime/mcp tests/unit/define-convex-tool.test.ts tests/unit/mcp-index-exports.test.ts scripts/lib/security-contract.mjs scripts/lib/security-source-policy.mjs scripts/check-security-packed-exports.mjs --glob '!dist/**'`
    now returns only security bans and the negative MCP export assertion.
  - `git diff --check` passed.
- Current state:
  - The deleted advanced `defineTool(...)` name is no longer exported from or
    used by the MCP runtime implementation; retained hits are deliberate
    anti-regression checks.

### 2026-06-05 Type Fixture Operation Permission Cutover

- Cut stale operation `guard` metadata out of type-only normal-path fixtures:
  - `tests/types/mcp-runtime.types.ts` now uses `appOperation.destructive(...)`
    with `permission` and explicit `safety` for the operation-backed MCP write
    fixture;
  - `tests/types/dx-typing.types.ts` now uses `appOperation.mutation(...)` with
    `permission` for its operation typing fixture.
- Left `tests/types/authenticated-guard.types.ts` untouched because it is
  explicit structured-guard narrowing coverage for the surviving custom-guard
  runtime path.
- Verification:
  - `pnpm run test:types:contracts` passed.
  - `pnpm exec eslint tests/types/mcp-runtime.types.ts tests/types/dx-typing.types.ts`
    passed.
  - `pnpm exec oxfmt --check tests/types/mcp-runtime.types.ts tests/types/dx-typing.types.ts`
    passed.
  - `rg -n "defineOperation|guard:\\s*|authRequired|defineGuard" tests/types/mcp-runtime.types.ts tests/types/dx-typing.types.ts`
    returned no hits.
  - `git diff --check` passed.
- Current state:
  - Type fixtures for MCP runtime and DX operation typing no longer preserve
    backend `defineOperation({ guard })` as the normal app-operation metadata
    shape.

### 2026-06-05 MCP Docs Protected-Default Wording Cleanup

- Updated MCP first-reader docs so app-backed tools no longer describe backend
  authorization as a protected-handler default:
  - `apps/docs/content/docs/14.mcp-tools/1.getting-started.md`;
  - `apps/docs/content/docs/14.mcp-tools/3.auth-and-permissions.md`;
  - `apps/docs/content/docs/13.api-reference/5.mcp.md`.
- Reworded the examples index and Example 03 README to present explicit
  workspace lanes and operation-backed MCP writes instead of protected-default
  or bounded-direct-write language:
  - `apps/docs/content/docs/5.examples.md`;
  - `examples/03-team-workspace/README.md`.
- Verification:
  - `pnpm run check:docs:links` passed.
  - `pnpm run check:docs:api-surface` passed.
  - `pnpm exec oxfmt --check apps/docs/content/docs/14.mcp-tools/1.getting-started.md apps/docs/content/docs/14.mcp-tools/3.auth-and-permissions.md apps/docs/content/docs/13.api-reference/5.mcp.md apps/docs/content/docs/5.examples.md examples/03-team-workspace/README.md`
    passed.
  - `rg -n "protected workspace app|protected workspace MCP|protected handler|protected Convex handler|protected backend contract|guard -> load|bounded writes|tool\\.mutation|defineTool|stampMcpToolSafety|trellisMcpToolSafetyKey" apps/docs/content/docs/14.mcp-tools apps/docs/content/docs/13.api-reference/5.mcp.md apps/docs/content/docs/5.examples.md examples/03-team-workspace/README.md --glob '!node_modules/**' --glob '!dist/**'`
    returned no hits.
  - `git diff --check` passed.
- Current state:
  - MCP first-reader docs and example index wording no longer preserve
    protected-handler or direct bounded-write language as the default
    app-backed MCP story.

### 2026-06-05 Example Overview MCP And Workspace Wording Cleanup

- Updated `examples/README.md` so the example ladder describes Example 03 as
  the canonical explicit-lane workspace app and Example 07 as using
  operation-backed MCP writes instead of bounded writes.
- Updated `examples/07-mcp-reference/README.md` so the MCP reference example
  no longer frames the prerequisite model or runbook convergence as
  protected-default backend handling.
- Verification:
  - `pnpm run check:docs:links` passed.
  - `pnpm exec oxfmt --check examples/README.md examples/07-mcp-reference/README.md`
    passed after formatting `examples/README.md`.
  - `rg -n "protected app|protected workspace|protected runbook|same protected|bounded writes|tool\\.mutation|guard -> load|Guards, access context" examples/README.md examples/07-mcp-reference/README.md --glob '!node_modules/**' --glob '!dist/**'`
    returned no hits.
  - `git diff --check` passed.
- Current state:
  - Maintained example overview docs no longer preserve protected-app or direct
    bounded-write wording for the normal 0.3 workspace/MCP path.

### 2026-06-05 Maintained Example Protected-App Wording Cleanup

- Updated maintained example README wording so the workspace examples describe
  explicit workspace/lane models instead of protected-app defaults:
  - `examples/03-team-workspace/README.md`;
  - `examples/04-saas-platform/README.md`;
  - `examples/05-visibility-access/README.md`;
  - `examples/06-multi-workspace/README.md`;
  - `examples/08-component-mini-cms/README.md`.
- Updated Example 03 visible app/config copy to match the explicit-lane
  workspace model:
  - `examples/03-team-workspace/nuxt.config.ts`;
  - `examples/03-team-workspace/app/features/team-workspace/components/TeamWorkspacePage.vue`.
- Verification:
  - `rg -n "protected app|protected workspace|protected server|protected root|protected model|protected mutation|nested resource guards|guard -> load|bounded writes|tool\\.mutation" examples/03-team-workspace examples/04-saas-platform/README.md examples/05-visibility-access/README.md examples/06-multi-workspace/README.md examples/08-component-mini-cms/README.md --glob '!node_modules/**' --glob '!dist/**' --glob '!.nuxt/**'`
    returned no hits.
  - `pnpm exec oxfmt --check examples/03-team-workspace/README.md examples/04-saas-platform/README.md examples/05-visibility-access/README.md examples/06-multi-workspace/README.md examples/08-component-mini-cms/README.md examples/03-team-workspace/nuxt.config.ts examples/03-team-workspace/app/features/team-workspace/components/TeamWorkspacePage.vue`
    passed.
  - `pnpm run check:docs:links` passed.
  - `pnpm --dir examples/03-team-workspace exec vue-tsc --noEmit` passed.
  - `git diff --check` passed.
- Current state:
  - Maintained example docs and Example 03 visible copy no longer frame the
    normal workspace path as a protected app or protected workspace model.

### 2026-06-05 First-Reader Docs Protected-Default Wording Cleanup

- Updated docs metadata, the docs landing page, signed-in getting-started flow,
  auth/route-protection docs, server-route/webhook docs, advanced caller docs,
  testing docs, and the testing API reference so they no longer present
  protected handlers or protected backend models as the default app path:
  - `apps/docs/nuxt.config.ts`;
  - `apps/docs/content/index.md`;
  - `apps/docs/content/docs/01.getting-started/4.build-a-signed-in-todo-app.md`;
  - `apps/docs/content/docs/05.auth-security/1.authentication.md`;
  - `apps/docs/content/docs/05.auth-security/2.route-protection.md`;
  - `apps/docs/content/docs/07.server-side/2.server-routes.md`;
  - `apps/docs/content/docs/07.server-side/3.webhooks-and-identity-forwarding.md`;
  - `apps/docs/content/docs/08.permissions/8.advanced-caller-models.md`;
  - `apps/docs/content/docs/12.testing/1.getting-started.md`;
  - `apps/docs/content/docs/12.testing/2.testing-protected-handlers.md`;
  - `apps/docs/content/docs/12.testing/3.testing-server-and-mcp.md`;
  - `apps/docs/content/docs/13.api-reference/6.testing.md`.
- Updated Example 04 visible copy from protected workspace patterns to explicit
  workspace lanes in
  `examples/04-saas-platform/app/features/project-board/components/HomePage.vue`.
- Verification:
  - `pnpm exec oxfmt --check apps/docs/nuxt.config.ts apps/docs/content/index.md apps/docs/content/docs/01.getting-started/4.build-a-signed-in-todo-app.md apps/docs/content/docs/05.auth-security/1.authentication.md apps/docs/content/docs/05.auth-security/2.route-protection.md apps/docs/content/docs/07.server-side/2.server-routes.md apps/docs/content/docs/07.server-side/3.webhooks-and-identity-forwarding.md apps/docs/content/docs/08.permissions/8.advanced-caller-models.md apps/docs/content/docs/12.testing/1.getting-started.md apps/docs/content/docs/12.testing/2.testing-protected-handlers.md apps/docs/content/docs/12.testing/3.testing-server-and-mcp.md apps/docs/content/docs/13.api-reference/6.testing.md examples/04-saas-platform/app/features/project-board/components/HomePage.vue`
    passed.
  - `pnpm run check:docs:links` passed.
  - `pnpm run check:docs:api-surface` passed.
  - `pnpm --dir examples/04-saas-platform exec vue-tsc --noEmit` passed.
  - `rg -n "protected app|protected backend|protected handler|protected Convex handler|protected query|protected mutation|protected workspace|protected business|same protected|normal guards|server's guards|guard and authorize|guards and all|Testing protected handlers|Protected backend|protected model" apps/docs/nuxt.config.ts apps/docs/content/index.md apps/docs/content/docs/01.getting-started/4.build-a-signed-in-todo-app.md apps/docs/content/docs/05.auth-security/1.authentication.md apps/docs/content/docs/05.auth-security/2.route-protection.md apps/docs/content/docs/07.server-side/2.server-routes.md apps/docs/content/docs/07.server-side/3.webhooks-and-identity-forwarding.md apps/docs/content/docs/08.permissions/8.advanced-caller-models.md apps/docs/content/docs/12.testing apps/docs/content/docs/13.api-reference/6.testing.md examples/04-saas-platform/app/features/project-board/components/HomePage.vue --glob '!node_modules/**' --glob '!dist/**'`
    returned no hits.
  - `rg -n "protected handler|protected Convex handler|protected backend|protected app|protected workspace|guard -> load|bounded writes|tool\\.mutation|defineTool|stampMcpToolSafety|trellisMcpToolSafetyKey|normal.*guard|guard.*normal" apps/docs/nuxt.config.ts apps/docs/content/index.md apps/docs/content/docs/01.getting-started/4.build-a-signed-in-todo-app.md apps/docs/content/docs/05.auth-security/1.authentication.md apps/docs/content/docs/05.auth-security/2.route-protection.md apps/docs/content/docs/07.server-side/2.server-routes.md apps/docs/content/docs/07.server-side/3.webhooks-and-identity-forwarding.md apps/docs/content/docs/08.permissions/8.advanced-caller-models.md apps/docs/content/docs/12.testing apps/docs/content/docs/13.api-reference/6.testing.md examples/04-saas-platform/app/features/project-board/components/HomePage.vue --glob '!node_modules/**' --glob '!dist/**'`
    returned no hits.
  - `git diff --check` passed.
- Current state:
  - Touched first-reader docs and Example 04 visible copy now describe
    authenticated, workspace, and operation-backed backend paths instead of a
    protected-default app model.

### 2026-06-05 Skill And Bridge Reference Protected-Handler Wording Cleanup

- Removed remaining protected-handler-as-default wording from internal skill
  references and component bridge docs:
  - `meta/skill/references/server-mcp.md`;
  - `meta/skill/references/testing-examples-docs.md`;
  - `apps/docs/content/docs/07.server-side/5.component-bridge.md`.
- Updated the Example 07 access-identity comment so it refers to backend
  handlers rather than a protected-handler surface:
  - `examples/07-mcp-reference/convex/auth/appIdentity.ts`.
- Verification:
  - `pnpm exec oxfmt --check meta/skill/references/server-mcp.md meta/skill/references/testing-examples-docs.md apps/docs/content/docs/07.server-side/5.component-bridge.md examples/07-mcp-reference/convex/auth/appIdentity.ts`
    passed.
  - `pnpm run check:docs:links` passed.
  - `pnpm exec eslint examples/07-mcp-reference/convex/auth/appIdentity.ts --ignore-pattern '**/_generated/**'`
    passed.
  - `rg -n "protected handler|protected Convex handler|protected backend|protected app|protected workspace|guard -> load|normal.*guard|guard.*normal" meta/skill/references/server-mcp.md meta/skill/references/testing-examples-docs.md apps/docs/content/docs/07.server-side/5.component-bridge.md examples/07-mcp-reference/convex/auth/appIdentity.ts --glob '!node_modules/**' --glob '!dist/**'`
    returned no hits.
  - `git diff --check` passed.
- Remaining broad stale-path hits are classified as:
  - operation `safety: 'bounded-write'` fixtures/tests and CLI hints for the
    surviving operation safety model;
  - custom protected-lane docs/tests;
  - deleted MCP API negative assertions;
  - legacy-detection fixtures.
- Current state:
  - Maintained skill references, bridge docs, and Example 07 comments no longer
    describe protected handlers as the normal backend path.

### 2026-06-05 Custom Protected-Lane Docs Wording Cleanup

- Tightened custom protected-lane docs so remaining `query.protected(...)` and
  `mutation.protected(...)` examples are framed as custom-guard lanes, not the
  normal backend model:
  - `apps/docs/content/docs/08.permissions/0.backend-builders.md`;
  - `apps/docs/content/docs/08.permissions/3.guards.md`;
  - `apps/docs/content/docs/13.api-reference/3.functions.md`.
- Kept the protected-lane API examples because `protected(...)` remains the
  intentional custom-guard lane.
- Verification:
  - `pnpm exec oxfmt --check apps/docs/content/docs/13.api-reference/3.functions.md apps/docs/content/docs/08.permissions/3.guards.md apps/docs/content/docs/08.permissions/0.backend-builders.md`
    passed.
  - `pnpm run check:docs:links` passed.
  - `pnpm run check:docs:api-surface` passed.
  - `rg -n "protected handler|protected backend|protected app|protected workspace|normal.*guard|guard.*normal" apps/docs/content/docs/13.api-reference/3.functions.md apps/docs/content/docs/08.permissions/3.guards.md apps/docs/content/docs/08.permissions/0.backend-builders.md --glob '!node_modules/**' --glob '!dist/**'`
    returned no hits.
  - `git diff --check` passed.
- Remaining broad stale-path hits are now limited to:
  - operation `safety: 'bounded-write'` fixtures/tests and CLI hints for the
    surviving operation safety model;
  - custom protected-lane runtime tests and runtime error assertions;
  - deleted MCP API negative assertions;
  - legacy-detection fixtures.
- Current state:
  - Maintained docs no longer contain protected-default wording in the audited
    first-reader, API reference, backend-builder, bridge, MCP, testing, or
    example surfaces.

### 2026-06-05 Maintained Webhook Example Protected-Wording Cleanup

- Removed stale protected-default wording from maintained webhook/example
  labels:
  - `examples/04-saas-platform/server/api/webhook.post.ts` now points readers
    at the backend operation path instead of protected root refs;
  - `examples/03-team-workspace/convex/todos.test.ts` now names anonymous
    denial coverage as workspace todo query coverage;
  - `examples/04-saas-platform/convex/projectBoard.test.ts` now names
    anonymous denial coverage as workspace mutation coverage.
- Verification:
  - `pnpm exec oxfmt --check examples/04-saas-platform/server/api/webhook.post.ts examples/03-team-workspace/convex/todos.test.ts examples/04-saas-platform/convex/projectBoard.test.ts`
    passed.
  - `pnpm --dir examples/03-team-workspace exec vitest run convex/todos.test.ts`
    passed: 1 file / 12 tests.
  - `pnpm --dir examples/04-saas-platform exec vitest run convex/projectBoard.test.ts`
    passed: 1 file / 12 tests.
  - `rg -n "protected root refs|protected mutations|protected todo queries|protected handler|protected app|protected workspace" examples/03-team-workspace examples/04-saas-platform examples/07-mcp-reference --glob '!node_modules/**' --glob '!dist/**' --glob '!_generated/**'`
    returned no hits.
- Current state:
  - Maintained webhook examples and denial test labels no longer describe the
    normal example path with protected-default wording.

### 2026-06-05 Starter Script Stale Legacy Naming Cleanup

- Renamed stale internal script variables from legacy-template terminology to
  removed-template terminology:
  - `scripts/copy-cli-templates.mjs`;
  - `scripts/check-starter-fixtures.mjs`.
- This did not add compatibility behavior; the scripts still delete obsolete
  build output directories and assert starter output does not contain `.tpl`
  template references.
- Verification:
  - `pnpm exec eslint scripts/copy-cli-templates.mjs scripts/check-starter-fixtures.mjs`
    passed.
  - `pnpm exec oxfmt --check scripts/copy-cli-templates.mjs scripts/check-starter-fixtures.mjs`
    passed.
  - `node scripts/copy-cli-templates.mjs` passed.
  - `node scripts/check-starter-fixtures.mjs` passed:
    - public: 18 files, doctor 32 pass / 0 warn / 0 fail;
    - personal: 26 files, doctor 32 pass / 0 warn / 0 fail;
    - workspace: 38 files, doctor 32 pass / 0 warn / 0 fail;
    - workspace-mcp: 44 files, doctor 32 pass / 0 warn / 0 fail.
  - `rg -n "deletedLegacyDirs|legacyTemplateExtension|legacyDir" scripts/copy-cli-templates.mjs scripts/check-starter-fixtures.mjs`
    returned no hits.
- Current state:
  - Starter fixture scripts no longer create false-positive legacy/debt audit
    hits for internal variable names.

### 2026-06-05 Public Surface Agreement Audit

- Audited the current package subpath surface against package exports, generated
  API docs, public type mappings, and subpath tests.
- No code changes were needed:
  - deleted `@lupinum/trellis/functions` and `@lupinum/trellis/bridge`
    subpaths remain only in negative assertions or migration detectors;
  - `@lupinum/trellis/mcp/advanced` remains the deliberate standalone
    custom-tool subpath and is consistently documented/tested as such.
- Verification:
  - `pnpm run check:publish-surface` passed.
  - `node node_modules/vitest/vitest.mjs run --project=unit --pool=threads --maxWorkers=1 --no-file-parallelism tests/unit/package-subpath-exports.test.ts`
    passed: 1 file / 4 tests.
  - `pnpm run check:docs:api-surface` passed.
  - `rg -n "@lupinum/trellis/bridge|@lupinum/trellis/functions|@lupinum/trellis/backend/advanced" package.json apps/docs/content/docs/13.api-reference/7.api-surface.md tests/unit/package-subpath-exports.test.ts tsconfig.types.public.json vitest.config.ts --glob '!node_modules/**' --glob '!dist/**'`
    returned only negative subpath assertions in
    `tests/unit/package-subpath-exports.test.ts`.
  - `rg -n "@lupinum/trellis/mcp/advanced" package.json apps/docs/content/docs/13.api-reference/7.api-surface.md tests/unit/package-subpath-exports.test.ts tsconfig.types.public.json tests/dts/mcp.types.ts apps/docs/content/docs/13.api-reference/5.mcp.md apps/docs/content/docs/14.mcp-tools/2.define-tools.md --glob '!node_modules/**' --glob '!dist/**'`
    returned only the expected type mapping, docs, and type fixture hits.
- Current state:
  - Package exports, API surface docs, public type mappings, and package subpath
    tests agree on the current 0.3 public subpath surface.

### 2026-06-05 Unrestricted Service Access Hard Cut

- Removed `access: 'unrestricted'` from the authored service subject runtime and
  public type surface:
  - `src/runtime/auth/define-services.ts` now only accepts restricted,
    table-scoped service access;
  - `src/runtime/functions/index.ts` no longer carries an unrestricted service
    access branch and rejects raw-JS unrestricted service definitions before
    handler execution.
- Kept CLI inventory/doctor detection for scanned projects that still contain
  `access: 'unrestricted'`; that path remains migration/diagnostic coverage,
  not a Trellis runtime capability.
- Added public type and runtime invariant coverage:
  - `tests/dts/auth.types.ts` asserts `defineServices(...)` rejects
    unrestricted service access;
  - `tests/unit/functions-defineTrellis.test.ts` asserts an unrestricted
    service definition fails before handler execution.
- Verification:
  - `node node_modules/vitest/vitest.mjs run --project=unit --pool=threads --maxWorkers=1 --no-file-parallelism tests/unit/functions-defineTrellis.test.ts -t "service"`
    passed: 1 file / 5 selected tests.
  - `CI=true pnpm run test:types:public` passed.
  - `node node_modules/vitest/vitest.mjs run --project=unit --pool=threads --maxWorkers=1 --no-file-parallelism tests/unit/cli-doctor.test.ts -t "service subject inventory"`
    passed: 1 selected test.
  - `node node_modules/vitest/vitest.mjs run --project=unit --pool=threads --maxWorkers=1 --no-file-parallelism tests/unit/security-contract.test.ts`
    passed: 1 file / 2 tests.
  - `pnpm exec eslint src/runtime/auth/define-services.ts src/runtime/functions/index.ts tests/unit/functions-defineTrellis.test.ts tests/dts/auth.types.ts --ignore-pattern '**/_generated/**'`
    passed.
  - `pnpm exec oxfmt --check src/runtime/auth/define-services.ts src/runtime/functions/index.ts tests/unit/functions-defineTrellis.test.ts tests/dts/auth.types.ts`
    passed.
  - `rg -n "access:\\s*'unrestricted'|access: \\"unrestricted\\"|access === 'unrestricted'|access !== 'restricted'|unrestricted" src/runtime src/cli tests/dts tests/unit/security-contract.test.ts tests/unit/cli-doctor.test.ts tests/unit/functions-defineTrellis.test.ts --glob '!dist/**' --glob '!node_modules/**'`
    now returns only negative assertions, runtime rejection coverage, security
    contract assertions, and CLI inventory/doctor detection.
  - `git diff --check` passed.
- Current state:
  - Service subjects no longer have an ambient backend-authority path in the
    authored Trellis runtime/type surface; service access is restricted by
    table and tenant scope.

### 2026-06-05 Forwarded Service Replay Mode Enforcement

- Enforced service subject replay metadata at runtime for signed
  identity-forwarding service calls:
  - `src/runtime/functions/index.ts` now compares a forwarded service caller's
    signed envelope replay mode with `defineServices(...).metadata.replayMode`
    before allowing the target handler to run.
- Left direct in-process service callers alone; this slice only binds
  transport-backed service calls to their signed replay contract.
- Added runtime tests in `tests/unit/functions-defineTrellis.test.ts` proving:
  - a forwarded service caller whose envelope has no matching replay mode fails
    before handler execution;
  - a forwarded service caller with matching `domain-idempotency` replay mode
    can enter its declared target.
- Verification:
  - `node node_modules/vitest/vitest.mjs run --project=unit --pool=threads --maxWorkers=1 --no-file-parallelism tests/unit/functions-defineTrellis.test.ts -t "service"`
    passed: 1 file / 7 selected tests.
  - `node node_modules/vitest/vitest.mjs run --project=unit --pool=threads --maxWorkers=1 --no-file-parallelism tests/unit/functions-defineTrellis.test.ts`
    passed: 1 file / 59 tests.
  - `pnpm exec eslint src/runtime/functions/index.ts tests/unit/functions-defineTrellis.test.ts --ignore-pattern '**/_generated/**'`
    passed.
  - `pnpm exec oxfmt --check src/runtime/functions/index.ts tests/unit/functions-defineTrellis.test.ts`
    passed.
  - `rg -n "replayMode" src/runtime/functions/index.ts tests/unit/functions-defineTrellis.test.ts src/runtime/auth/define-services.ts examples/03-team-workspace/convex/auth/services.ts examples/07-mcp-reference/convex/auth/services.ts --glob '!dist/**' --glob '!node_modules/**'`
    confirmed the runtime check, tests, service type metadata, and maintained
    example service declarations.
  - `git diff --check` passed.
- Current state:
  - Forwarded service traffic can no longer drift from its declared service
    replay mode; service replay metadata is now runtime-enforced for signed
    transport calls.

### 2026-06-05 Service Audit Table Metadata Hard Cut

- Made `defineServices(...).metadata.auditTable` required in the public service
  subject type:
  - `src/runtime/auth/define-services.ts` now matches doctor/security-contract
    expectations that every safe service subject names durable
    audit/idempotency storage.
- Added public type coverage in `tests/dts/auth.types.ts` proving service
  metadata without `auditTable` is rejected.
- Verification:
  - `CI=true pnpm run test:types:public` passed.
  - `pnpm exec eslint src/runtime/auth/define-services.ts tests/dts/auth.types.ts --ignore-pattern '**/_generated/**'`
    passed.
  - `pnpm exec oxfmt --check src/runtime/auth/define-services.ts tests/dts/auth.types.ts`
    passed.
  - `rg -n "auditTable\\?:|service metadata must name|auditTable: TTableName|auditTable:" src/runtime/auth/define-services.ts tests/dts/auth.types.ts examples/03-team-workspace/convex/auth/services.ts examples/07-mcp-reference/convex/auth/services.ts apps/docs/content/docs/08.permissions/8.advanced-caller-models.md src/cli/lib/inventory-findings.ts --glob '!dist/**' --glob '!node_modules/**'`
    confirmed no optional `auditTable` type remains and maintained service
    declarations/docs still name audit tables.
  - `git diff --check` passed.
- Current state:
  - Service subject metadata has one source of truth for audit storage:
    authored service subjects must declare an audit/idempotency table, and
    doctor/security contract continue to inventory that field.

### 2026-06-05 Forwarded Service Acting-For Contract Enforcement

- Enforced service subject acting-for metadata at runtime for signed
  identity-forwarding service calls:
  - `src/runtime/functions/index.ts` now rejects a forwarded service caller
    carrying delegated acting-for evidence when
    `defineServices(...).metadata.actingFor` is `false`.
- Kept the check at the service target boundary, after the envelope has already
  been verified and before target handler execution, so the service contract is
  the single source of truth for whether delegated evidence can cross the
  transport.
- Added runtime tests in `tests/unit/functions-defineTrellis.test.ts` proving:
  - forwarded service acting-for evidence is denied before handler execution
    when service metadata forbids it;
  - the same forwarded evidence is allowed when service metadata explicitly
    permits acting-for delegation.
- Verification:
  - `node node_modules/vitest/vitest.mjs run --project=unit --pool=threads --maxWorkers=1 --no-file-parallelism tests/unit/functions-defineTrellis.test.ts -t "service"`
    passed: 1 file / 9 selected tests.
  - `node node_modules/vitest/vitest.mjs run --project=unit --pool=threads --maxWorkers=1 --no-file-parallelism tests/unit/functions-defineTrellis.test.ts`
    passed: 1 file / 61 tests.
  - `pnpm exec eslint src/runtime/functions/index.ts tests/unit/functions-defineTrellis.test.ts --ignore-pattern '**/_generated/**'`
    passed.
- Current state:
  - Forwarded service traffic can no longer carry acting-for evidence unless
    the configured service subject explicitly declares that delegation is part
    of its contract.

### 2026-06-05 Service Contract Runtime Metadata Enforcement

- Hardened the service subject runtime contract so raw JavaScript and bad casts
  cannot bypass the same metadata requirements enforced by doctor/security
  inventory:
  - `src/runtime/functions/index.ts` now rejects service callers whose
    configured service subject is missing non-empty `source`, `purpose`,
    `auditEvent`, `auditTable`, or `auditCorrelationId`;
  - service metadata must declare a valid replay mode and an explicit boolean
    `actingFor` contract;
  - allowed operation ids/function refs, when present, must be arrays of
    non-empty strings;
  - service access must name at least one allowed table before a service DB
    facade is built;
  - derived service access must declare `deriveTenant` and resolve a non-empty
    tenant id before handler execution.
- Added runtime invariant coverage in `tests/unit/functions-defineTrellis.test.ts`
  proving incomplete audit metadata, empty table allow-lists, and missing
  derived tenant scope fail before handler execution.
- Verification:
  - `node node_modules/vitest/vitest.mjs run --project=unit --pool=threads --maxWorkers=1 --no-file-parallelism tests/unit/functions-defineTrellis.test.ts -t "service"`
    passed: 1 file / 12 selected tests.
  - `node node_modules/vitest/vitest.mjs run --project=unit --pool=threads --maxWorkers=1 --no-file-parallelism tests/unit/functions-defineTrellis.test.ts`
    passed: 1 file / 64 tests.
  - `pnpm exec eslint src/runtime/functions/index.ts tests/unit/functions-defineTrellis.test.ts --ignore-pattern '**/_generated/**'`
    passed.
  - `pnpm exec oxfmt --check src/runtime/functions/index.ts tests/unit/functions-defineTrellis.test.ts`
    passed.
  - `git diff --check` passed.
- Current state:
  - Service subjects now fail closed at runtime unless their single
    `defineServices(...)` contract carries scoped access, target allow-lists,
    replay behavior, acting-for policy, and audit/idempotency metadata.

### 2026-06-05 Service Target Allow-List Type Hard Cut

- Tightened the public service subject type surface so authored
  `defineServices(...)` metadata must name at least one backend target list:
  - `src/runtime/auth/define-services.ts` now requires either
    `allowedOperations` or `allowedFunctionRefs` in `ServiceContractMetadata`;
  - both lists remain optional only as alternatives to each other, matching the
    runtime and doctor/security inventory contract that a service subject cannot
    have no declared target.
- Updated public dts coverage in `tests/dts/auth.types.ts`:
  - the valid service example now names a function ref allow-list;
  - a negative assertion proves service metadata without both target lists is
    rejected.
- Verification:
  - `CI=true pnpm run test:types:public` passed.
  - `pnpm exec eslint src/runtime/auth/define-services.ts tests/dts/auth.types.ts --ignore-pattern '**/_generated/**'`
    passed.
  - `pnpm exec oxfmt --check src/runtime/auth/define-services.ts tests/dts/auth.types.ts`
    passed.
  - `git diff --check` passed.
- Current state:
  - Service subjects now require declared target authority in both the authored
    TypeScript surface and runtime fail-closed path.

### 2026-06-05 Trusted Write Missing Replay Fail-Closed

- Closed the trusted mutation/action forwarding path that previously returned
  early when a signed identity-forwarding envelope had no replay mode:
  - `src/runtime/functions/index.ts` now rejects trusted `mutation` and
    `action` envelopes without declared replay behavior before handler
    execution;
  - trusted queries remain allowed without replay mode, matching the 0.3.0
    distinction between signed reads and replay-conscious writes.
- Added runtime coverage in `tests/unit/functions-defineTrellis.test.ts`
  proving a trusted mutation envelope without replay behavior fails before the
  handler runs.
- Kept the service replay mismatch coverage by making that fixture use an
  explicit wrong replay mode (`domain-idempotency` envelope against a
  `jti-redemption` service contract), so generic missing-replay rejection and
  service replay-contract mismatch are both covered.
- Verification:
  - `node node_modules/vitest/vitest.mjs run --project=unit --pool=threads --maxWorkers=1 --no-file-parallelism tests/unit/functions-defineTrellis.test.ts -t "trusted|replay"`
    passed: 1 file / 10 selected tests.
  - `node node_modules/vitest/vitest.mjs run --project=unit --pool=threads --maxWorkers=1 --no-file-parallelism tests/unit/functions-defineTrellis.test.ts`
    passed: 1 file / 65 tests.
  - `pnpm exec eslint src/runtime/functions/index.ts tests/unit/functions-defineTrellis.test.ts --ignore-pattern '**/_generated/**'`
    passed.
  - `pnpm exec oxfmt --check src/runtime/functions/index.ts tests/unit/functions-defineTrellis.test.ts`
    passed.
  - `git diff --check` passed.
- Current state:
  - Plain trusted mutation/action forwarding can no longer enter a handler
    without either domain idempotency or framework replay redemption declared in
    the signed envelope.

### 2026-06-05 Operation Execute Replay Mode Enforcement

- Bound destructive operation-execute identity forwarding to the confirmation
  replay mode:
  - `src/runtime/functions/index.ts` now rejects `operation-execute` envelopes
    unless their signed replay mode is `operation-confirmation`;
  - generic trusted JTI redemption now skips `operation-confirmation`, leaving
    destructive confirmation state as the single replay source of truth for
    operation execution.
- Cut over manual operation-execute envelope fixtures in
  `tests/unit/functions-defineTrellis.test.ts` to declare
  `replayMode: 'operation-confirmation'`.
- Added a negative runtime test proving an operation-execute envelope without
  operation-confirmation replay mode is rejected before handler execution.
- Verification:
  - `node node_modules/vitest/vitest.mjs run --project=unit --pool=threads --maxWorkers=1 --no-file-parallelism tests/unit/functions-defineTrellis.test.ts -t "operation-execute|transport mutation|confirmation"`
    passed: 1 file / 13 selected tests.
  - `node node_modules/vitest/vitest.mjs run --project=unit --pool=threads --maxWorkers=1 --no-file-parallelism tests/unit/functions-defineTrellis.test.ts`
    passed: 1 file / 66 tests.
  - `pnpm exec eslint src/runtime/functions/index.ts tests/unit/functions-defineTrellis.test.ts --ignore-pattern '**/_generated/**'`
    passed.
  - `pnpm exec oxfmt --check src/runtime/functions/index.ts tests/unit/functions-defineTrellis.test.ts`
    passed.
  - `git diff --check` passed.
- Current state:
  - Destructive operation execution replay is no longer an implicit
    purpose-only convention; valid operation-execute envelopes must carry the
    confirmation replay mode, and confirmation storage owns redemption.

### 2026-06-05 Operation Confirmation Replay Purpose Enforcement

- Closed the inverse replay-mode mismatch after operation-execute enforcement:
  - `src/runtime/functions/index.ts` now rejects signed trusted envelopes that
    use `operation-confirmation` replay mode unless the envelope purpose is
    `operation-execute`;
  - this prevents normal trusted mutation/action forwarding from bypassing the
    generic JTI replay table path by declaring the destructive confirmation
    replay mode.
- Added runtime coverage in `tests/unit/functions-defineTrellis.test.ts`
  proving a normal trusted mutation envelope with `operation-confirmation`
  replay mode fails before handler execution.
- Verification:
  - `node node_modules/vitest/vitest.mjs run --project=unit --pool=threads --maxWorkers=1 --no-file-parallelism tests/unit/functions-defineTrellis.test.ts -t "trusted|replay|operation-confirmation"`
    passed: 1 file / 12 selected tests.
  - `node node_modules/vitest/vitest.mjs run --project=unit --pool=threads --maxWorkers=1 --no-file-parallelism tests/unit/functions-defineTrellis.test.ts`
    passed: 1 file / 67 tests.
  - `pnpm exec eslint src/runtime/functions/index.ts tests/unit/functions-defineTrellis.test.ts --ignore-pattern '**/_generated/**'`
    passed.
  - `pnpm exec oxfmt --check src/runtime/functions/index.ts tests/unit/functions-defineTrellis.test.ts`
    passed.
  - `git diff --check` passed.
- Current state:
  - `operation-confirmation` is now a purpose-bound replay mode: it is accepted
    only for destructive operation execution and cannot be used as a generic
    trusted write replay declaration.

### 2026-06-05 Server Transport Proof Operation Confirmation Fail-Fast

- Mirrored the backend replay-mode/purpose invariant at the server route helper
  boundary:
  - `src/runtime/convex/server/convex.ts` now rejects
    `operationConfirmation(...)` replay unless the effective transport proof
    purpose is `operation-execute`;
  - invalid server-route transport proofs fail before any Convex network
    request is sent.
- Added focused coverage in `tests/unit/server-convex-utils.test.ts` proving a
  normal `serverConvexMutation(...)` with `operationConfirmation(...)` and no
  `operation-execute` purpose is rejected locally.
- Verification:
  - `node node_modules/vitest/vitest.mjs run --project=unit --pool=threads --maxWorkers=1 --no-file-parallelism tests/unit/server-convex-utils.test.ts -t "transport proof"`
    passed: 1 file / 7 selected tests.
  - `node node_modules/vitest/vitest.mjs run --project=unit --pool=threads --maxWorkers=1 --no-file-parallelism tests/unit/server-convex-utils.test.ts`
    passed: 1 file / 28 tests.
  - `pnpm exec eslint src/runtime/convex/server/convex.ts tests/unit/server-convex-utils.test.ts --ignore-pattern '**/_generated/**'`
    passed.
  - `pnpm exec oxfmt --check src/runtime/convex/server/convex.ts tests/unit/server-convex-utils.test.ts`
    passed.
  - `git diff --check` passed.
- Current state:
  - Production-copyable server routes cannot send operation-confirmation replay
    proofs for normal trusted writes; the server helper and backend runtime now
    agree on the replay-mode/purpose boundary.

### 2026-06-05 Security Contract Server Transport Proof Coverage

- Added server transport proof helper coverage to the generated security
  contract runtime proof set:
  - `scripts/lib/security-contract.mjs` now includes
    `tests/unit/server-convex-utils.test.ts`;
  - `tests/unit/security-contract.test.ts` asserts that proof file remains in
    the contract;
  - regenerated `security-contract.generated.json`.
- This keeps the checked-in contract aware that replay/purpose fail-fast
  behavior is covered at the production-copyable server route helper boundary,
  not only in backend runtime tests.
- Verification:
  - `CI=true pnpm run security:contract` regenerated
    `security-contract.generated.json`.
  - `node node_modules/vitest/vitest.mjs run --project=unit --pool=threads --maxWorkers=1 --no-file-parallelism tests/unit/security-contract.test.ts`
    passed: 1 file / 2 tests.
  - `CI=true pnpm run check:security:contract` passed.
  - `pnpm exec eslint scripts/lib/security-contract.mjs tests/unit/security-contract.test.ts --ignore-pattern '**/_generated/**'`
    passed.
  - `pnpm exec oxfmt --check scripts/lib/security-contract.mjs tests/unit/security-contract.test.ts progress_0.3.0.md`
    passed.
  - `git diff --check` passed.
- Current state:
  - The generated security contract now names the server transport proof tests
    that enforce local replay metadata and replay-mode/purpose boundaries.

### 2026-06-05 Remaining Protected/Guard Inventory Audit

- Re-ran the handover protected/guard inventory audit after the service and
  replay hardening slices:
  - `rg -n "query\\.protected|mutation\\.protected|action\\.protected|guard:\\s*|protected\\(previewOf|protected preview|authRequired" tests/unit src/cli src/module-internals src/runtime scripts examples src/cli/starter-fixtures --glob '!dist/**' --glob '!node_modules/**'`
- Current classification:
  - no hits remain in maintained `examples/`, `src/cli/starter-fixtures/`,
    `src/cli/`, or `src/module-internals/`;
  - runtime hits are intentional protected-lane/custom-guard machinery in
    `src/runtime/functions/index.ts`,
    `src/runtime/functions/define-handler.ts`,
    `src/runtime/functions/define-operation.ts`, and
    `src/runtime/auth/define-guard.ts`;
  - scanner/contract hits are intentional legacy/deleted-surface detectors in
    `scripts/lib/security-contract.mjs`,
    `scripts/lib/security-source-policy.mjs`, and
    `scripts/check-security-packed-exports.mjs`;
  - unit-test hits are intentional custom protected-lane, destructive
    confirmation, internal `authRequired`, legacy upgrade/doctor, and lint-rule
    fixtures in `tests/unit/functions-defineTrellis.test.ts`,
    `tests/unit/functions-defineHandler.test.ts`,
    `tests/unit/cli-upgrade.test.ts`, `tests/unit/cli-doctor.test.ts`,
    `tests/unit/eslint-plugin.test.ts`, `tests/unit/cli-add-resource.test.ts`,
    `tests/unit/auth-index.test.ts`, and `tests/unit/security-contract.test.ts`.
- Verification:
  - `rg -n "query\\.protected|mutation\\.protected|action\\.protected|guard:\\s*|protected\\(previewOf|protected preview|authRequired" examples src/cli/starter-fixtures src/cli src/module-internals --glob '!dist/**' --glob '!node_modules/**'`
    returned no hits.
  - Count summary of remaining hits by file:
    - scripts: security source/contract/packed-export policies only;
    - runtime: protected-lane/custom-guard implementation only;
    - tests: custom protected-lane runtime coverage, legacy detection, and
      negative assertions only.
- Current state:
  - The audited protected/guard/authRequired remnants are no longer in
    production-copyable examples, starter fixtures, generator code, or
    first-reader source paths; remaining occurrences are classified intentional
    coverage or internal machinery.

### 2026-06-05 Debt And Compatibility Terminology Audit

- Ran the handover debt/compatibility audit:
  - `rg -n "deprecated|compat|legacy|shim|TODO|FIXME|temporary|migration-only|old path|backcompat|backward" src tests examples apps/docs packages scripts --glob '!dist/**' --glob '!node_modules/**'`
- Classification:
  - `compatibilityDate` hits in Nuxt configs and `compatibility.json` tooling
    are framework/release metadata, not transitional compatibility paths;
  - `src/cli/commands/upgrade.ts`, `tests/unit/cli-upgrade.test.ts`, and
    `tests/unit/cli-doctor.test.ts` use `legacy` intentionally for migration
    detection and removed-flow guidance;
  - docs/example hits such as cached-query temporary seed wording, temporary MCP
    shortcuts, HMAC secret names, and Plausible SSR compatibility are domain or
    framework wording, not old Trellis implementation paths;
  - test/support hits are fixtures or expected behavior labels, not production
    code paths.
- No code deletion was made from this audit because the hits were classified as
  intentional migration support, framework metadata, test fixtures, or domain
  wording rather than abandoned 0.3.0 scaffolding.
- Verification:
  - Count summary of remaining terms by file was captured from the audit; the
    only source implementation hits were Nuxt/module compatibility metadata,
    upgrade-command legacy detectors, validator compatibility wording, and
    maintained example webhook/domain text.
  - `pnpm exec oxfmt --check progress_0.3.0.md` passed.
  - `git diff --check` passed.
- Current state:
  - The debt/compatibility terminology audit is recorded for final cleanup, and
    no unclassified transitional helper/shim path was found in this slice.

### 2026-06-05 Obsolete Package Subpath Audit

- Ran the handover obsolete package/subpath audit:
  - `rg -n "@lupinum/trellis/bridge|@lupinum/trellis/functions|@lupinum/trellis/backend/advanced|@lupinum/trellis/mcp/advanced" . --glob '!node_modules/**' --glob '!dist/**'`
- Current classification:
  - `@lupinum/trellis/functions` and `@lupinum/trellis/bridge` remain only in
    upgrade/doctor detectors, negative export/type tests, migration/reference
    inventory scripts, and historical planning notes;
  - no maintained package export, Nuxt alias, starter fixture, or docs
    production example imports the deleted core package subpaths;
  - `@lupinum/trellis/backend/advanced` has no maintained production-surface
    hit and appears only in historical progress/handover text;
  - `@lupinum/trellis/mcp/advanced` remains the deliberate standalone
    custom-tool subpath in `package.json`, the generated API surface docs,
    public type config, security packed-export checks, and focused MCP docs/tests.
- No code deletion was made in this audit because the live hits are the
  intentional migration detectors, negative assertions, or the retained
  standalone MCP advanced surface.
- Verification:
  - `tests/unit/package-subpath-exports.test.ts` already asserts that
    `./functions` and `./bridge` are absent from package exports and
    `typesVersions`, that Vitest no longer aliases them, and that Node package
    exports reject the deleted subpaths.
  - `apps/docs/content/docs/13.api-reference/7.api-surface.md` lists the
    retained package subpaths and keeps bridge APIs on
    `@lupinum/trellis-bridge`.
- Current state:
  - The obsolete core subpaths are hard-cut from the maintained public surface;
    the only retained scanned subpath is the explicit
    `@lupinum/trellis/mcp/advanced` custom-tool entrypoint.

### 2026-06-05 Harness Structured Probe Authenticated Lane Cutover

- Cut over the remaining structured probe reads in
  `apps/harness/convex/functionsProbe.ts` from `query.protected(...)` plus a
  signed-in custom guard to `query.authenticated(...)`.
- Kept the loaded-object owner check in the structured `authorize` phase, so the
  probe still proves isolation and object-level authorization without teaching a
  protected-lane signed-in prefilter.
- Updated `withTrustedCaller(...)` in `apps/harness/convex/test.helpers.ts` so
  trusted query fixtures sign envelopes as `operation: 'query'` instead of
  reusing mutation metadata.
- Added explicit `jti-redemption` replay metadata to the trusted organization
  mutation fixtures, matching the current fail-closed trusted-write runtime
  contract and the harness `trustedReplay` table.
- Verification:
  - `node node_modules/vitest/vitest.mjs run --project=convex --pool=threads --maxWorkers=1 --no-file-parallelism apps/harness/convex/functions.test.ts apps/harness/convex/organizations.test.ts`
    passed: 2 files / 15 tests.
  - `node node_modules/eslint/bin/eslint.js apps/harness/convex/functionsProbe.ts apps/harness/convex/functions.test.ts apps/harness/convex/organizations.test.ts apps/harness/convex/test.helpers.ts --ignore-pattern '**/_generated/**'`
    passed.
  - `node node_modules/oxfmt/bin/oxfmt --check --threads=1 apps/harness/convex/functionsProbe.ts apps/harness/convex/functions.test.ts apps/harness/convex/organizations.test.ts apps/harness/convex/test.helpers.ts`
    passed.
  - `rg -n "query\\.protected|mutation\\.protected|action\\.protected|guard:\\s*|authRequired|delegateToUser|readSharedSecretWebhookBody|stampMcpToolSafety|escapeIsolation|trellisUnsafeDb" apps/harness/convex/functionsProbe.ts apps/harness/convex/functions.test.ts apps/harness/convex/organizations.test.ts apps/harness/convex/test.helpers.ts --glob '!node_modules/**' --glob '!dist/**'`
    returned no hits.
- Current state:
  - The touched harness structured probes no longer use protected/guard as a
    normal signed-in lane, and trusted forwarding test envelopes now distinguish
    read-only forwarding from replay-conscious writes.

### 2026-06-05 Public Functions DTS Permission Operation Cutover

- Cut over `tests/dts/functions.types.ts` from a backend operation `guard`
  fixture to operation `permission` metadata.
- Tightened `src/runtime/functions/define-operation.ts` so
  `defineOperation(...)` no longer requires a protected-lane guard when an
  operation is permission-backed; authored custom-guard operations can still
  carry `guard`, but metadata-only and permission-backed operations do not need
  to duplicate authorization sources.
- Verification:
  - `CI=true pnpm run test:types:public` passed.
  - `node node_modules/vitest/vitest.mjs run --project=unit --pool=threads --maxWorkers=1 --no-file-parallelism tests/unit/operation-descriptor.test.ts`
    passed: 1 file / 7 tests.
  - `node node_modules/eslint/bin/eslint.js src/runtime/functions/define-operation.ts tests/dts/functions.types.ts`
    passed.
  - `node node_modules/oxfmt/bin/oxfmt --check --threads=1 src/runtime/functions/define-operation.ts tests/dts/functions.types.ts`
    passed.
  - `rg -n "defineGuard|guard:\\s*|authRequired" tests/dts/functions.types.ts src/runtime/functions/define-operation.ts --glob '!node_modules/**' --glob '!dist/**'`
    now reports only the intentional runtime metadata preservation path for
    authored custom-guard operations.
- Current state:
  - The public functions dts operation fixture now uses the same
    permission-backed operation metadata style as the app, MCP, descriptor, and
    type-primitives public dts coverage.

### 2026-06-05 Protected Builder Docs Custom Guard Clarification

- Tightened `apps/docs/content/docs/08.permissions/0.backend-builders.md` so the
  protected-lane `rename` example no longer names a normal-looking
  `projectWrite` guard.
- Renamed the example guard to `integrationProjectWriter` and added explicit
  guidance that ordinary workspace permission checks should use
  `workspace(...)`, not `protected(...)`.
- Verification:
  - `pnpm run check:docs:links` passed.
  - `pnpm run check:docs:api-surface` passed.
  - `node node_modules/oxfmt/bin/oxfmt --check --threads=1 apps/docs/content/docs/08.permissions/0.backend-builders.md`
    passed.
  - `rg -n "projectWrite|integrationProjectWriter|query\\.protected|mutation\\.protected|guard:" apps/docs/content/docs/08.permissions/0.backend-builders.md apps/docs/content/docs/08.permissions/6.cross-scope-and-raw-access.md`
    now shows protected examples only in explicit custom-guard/cross-scope
    docs sections.
- Current state:
  - First-reader backend builder docs still document the surviving custom
    protected lane, but no longer use an ambiguous normal workspace-permission
    guard name in the protected examples.

### 2026-06-05 Authenticated Guard Type Fixture Classification

- Added an explicit source comment to
  `tests/types/authenticated-guard.types.ts` classifying its `open`,
  `authRequired`, and custom `guard` usage as intentional internal
  protected-lane narrowing coverage.
- This keeps the type fixture from reading like app-author operation guidance
  while preserving the proof that `buildStructuredFunctions(...)` narrows
  runtime sentinel and custom guard contexts correctly.
- Verification:
  - `CI=true pnpm run test:types:contracts` passed.
  - `node node_modules/eslint/bin/eslint.js tests/types/authenticated-guard.types.ts`
    passed.
  - `node node_modules/oxfmt/bin/oxfmt --check --threads=1 tests/types/authenticated-guard.types.ts`
    passed.
- Current state:
  - The remaining `authRequired`/`guard` type fixture is now classified
    in-source as intentional internal protected-lane coverage.

### 2026-06-05 Recoverable Failed Trusted Replay Claims

- Made failed `jti-redemption` trusted replay claims recoverable when a retry
  presents the same signed envelope metadata:
  - `src/runtime/functions/index.ts` now reclaims a `failed` trusted replay row
    by moving it back to `claimed` only when function ref, purpose, transport,
    replay mode, args hash, subject, issuer, and audience match the original
    failed claim;
  - completed claims and in-flight claimed rows remain single-use blockers;
  - failed claims with changed envelope metadata are rejected before handler
    execution.
- Updated `tests/unit/functions-defineTrellis.test.ts` so failed trusted JTI
  redemption retries are proven recoverable for the same envelope and denied for
  changed args.
- Regenerated `security-contract.generated.json` after the current runtime and
  harness lane changes so the checked-in security contract matches the current
  worktree.
- Verification:
  - `node node_modules/vitest/vitest.mjs run --project=unit --pool=threads --maxWorkers=1 --no-file-parallelism tests/unit/functions-defineTrellis.test.ts -t "trusted JTI redemption|trusted|replay"`
    passed: 1 file / 13 selected tests.
  - `node node_modules/vitest/vitest.mjs run --project=unit --pool=threads --maxWorkers=1 --no-file-parallelism tests/unit/functions-defineTrellis.test.ts`
    passed: 1 file / 68 tests.
  - `CI=true pnpm run security:contract` regenerated
    `security-contract.generated.json`.
  - `CI=true pnpm run check:security:contract` passed.
  - `node node_modules/vitest/vitest.mjs run --project=unit --pool=threads --maxWorkers=1 --no-file-parallelism tests/unit/security-contract.test.ts`
    passed: 1 file / 2 tests.
  - `node node_modules/eslint/bin/eslint.js src/runtime/functions/index.ts tests/unit/functions-defineTrellis.test.ts --ignore-pattern '**/_generated/**'`
    passed.
  - `node node_modules/oxfmt/bin/oxfmt --check --threads=1 src/runtime/functions/index.ts tests/unit/functions-defineTrellis.test.ts security-contract.generated.json`
    passed.
  - `git diff --check` passed.
- Current state:
  - Trusted write replay is no longer permanently blocked by a failed handler
    attempt when the same signed delivery is retried; failure recovery is tied
    to the original envelope metadata, keeping the replay row as the single
    backend source of truth.

### 2026-06-05 Maintained Consumer Doctor Gate

- Ran the maintained consumer and starter doctor gates from the handover's
  broader release-verification list.
- Verification:
  - `pnpm run check:examples:doctor` passed for maintained examples 03 through
    08 with zero failures:
    - examples 03, 04, 05, 06, 07, and 08 all completed static diagnostics;
    - remaining warnings were runtime engine baseline warnings on examples and
      the documented backend-only destructive-operation warning for
      `examples/03-team-workspace`;
    - no deleted cross-scope escape API, forwarded-caller misuse, unsafe MCP
      app-write bypass, or destructive MCP binding failure was reported.
  - `pnpm run check:starter-fixtures:doctor` passed after `pnpm run build:cli`:
    - `public`: 18 files, doctor 32 pass / 0 warn / 0 fail;
    - `personal`: 26 files, doctor 32 pass / 0 warn / 0 fail;
    - `workspace`: 38 files, doctor 32 pass / 0 warn / 0 fail;
    - `workspace-mcp`: 44 files, doctor 32 pass / 0 warn / 0 fail.
- Current state:
  - The maintained examples and starter fixtures pass the current doctor gates
    against the hard-cut operation/permission, service, replay, MCP, and unsafe
    surface rules.

### 2026-06-05 Broad Check Gate and Bridge Replay Cutover

- Reran the full local `pnpm run check` gate after the operation descriptor and
  replay hardening slices, then fixed the concrete regressions exposed by the
  broad gate:
  - `examples/07-mcp-reference/test/mcpReference.test.ts` now signs forwarded
    user mutation fixtures with domain-idempotency replay evidence before
    asserting the create permission boundary;
  - `packages/trellis-bridge/src/bridge-forwarding.ts` now attaches replay
    metadata to signed bridge writes: ordinary bridge mutations/actions use
    `jti-redemption`, while `operation-execute` uses `operation-confirmation`;
  - `packages/trellis-bridge/src/create-component-bridge.ts` now uses a bridge
    definition's `forwardingPurpose` as the single source of truth for both
    envelope signing and component-side verification;
  - `examples/08-component-mini-cms/convex/features/pages/domain.ts` now sends
    component publish calls through the `operation-execute` bridge purpose.
- Kept the existing hard-cut behavior: trusted forwarded writes fail before
  domain permissions unless replay metadata is present; destructive operation
  execution requires operation-confirmation replay.
- Regenerated `security-contract.generated.json` after the bridge and example
  source changes.
- Verification:
  - `pnpm --dir examples/07-mcp-reference test -- test/mcpReference.test.ts`
    passed: 3 files / 19 tests.
  - `node node_modules/vitest/vitest.mjs run --project=unit --pool=threads --maxWorkers=1 --no-file-parallelism tests/unit/create-component-bridge.test.ts`
    passed: 1 file / 12 tests.
  - `pnpm --dir examples/08-component-mini-cms test` passed: 1 file / 10
    tests.
  - `CI=true pnpm run security:contract` regenerated
    `security-contract.generated.json`.
  - `CI=true pnpm run check:security:contract` passed.
  - `pnpm run check` passed end-to-end:
    - format, lint, publish surface, security tests, type checks, contract
      tests, CLI check, maintained example doctor checks, and starter fixture
      doctor checks all completed successfully;
    - prepared examples 01 through 08 passed, including the replay-updated MCP
      reference and component mini CMS examples;
    - maintained doctor checks still report only existing warnings such as the
      runtime engine baseline warnings and the documented backend-only
      destructive-operation warning for `examples/03-team-workspace`.
- Current state:
  - The current worktree passes the full local check gate under the 0.3.0
    replay and operation-execute invariants.

### 2026-06-05 Remaining Protected/Guard Inventory Classification

- Audited the remaining protected/guard/authRequired matches after the operation
  descriptor cutover with:
  - `rg -n "query\\.protected|mutation\\.protected|action\\.protected|guard:\\s*|protected\\(previewOf|protected preview|authRequired" tests/unit src/cli src/module-internals src/runtime scripts examples src/cli/starter-fixtures --glob '!dist/**' --glob '!node_modules/**'`
- Confirmed `tests/unit/operation-descriptor.test.ts` remains on explicit
  operation `permission` fixtures instead of old operation `guard` fixtures.
- Classified every remaining scoped audit hit instead of deleting intentional
  boundary coverage:
  - runtime/internal machinery:
    `src/runtime/functions/index.ts`,
    `src/runtime/functions/define-handler.ts`,
    `src/runtime/functions/define-operation.ts`, and
    `src/runtime/auth/define-guard.ts`;
  - security detector surfaces:
    `scripts/lib/security-source-policy.mjs`,
    `scripts/lib/security-contract.mjs`,
    `scripts/check-security-packed-exports.mjs`,
    `tests/unit/security-contract.test.ts`, and
    `tests/unit/auth-index.test.ts`;
  - legacy/generator negative detection:
    `tests/unit/cli-doctor.test.ts`,
    `tests/unit/cli-upgrade.test.ts`,
    `tests/unit/eslint-plugin.test.ts`, and
    `tests/unit/cli-add-resource.test.ts`;
  - surviving custom protected-lane runtime coverage:
    `tests/unit/functions-defineTrellis.test.ts` and
    `tests/unit/functions-defineHandler.test.ts`.
- Added short file-level classification comments to the legacy detector and
  custom protected-lane test files so these old-looking fixtures are documented
  as intentional 0.3.0 boundary coverage, not normal-path app-author guidance.
- Verification:
  - `node node_modules/eslint/bin/eslint.js tests/unit/functions-defineTrellis.test.ts tests/unit/functions-defineHandler.test.ts tests/unit/eslint-plugin.test.ts tests/unit/cli-upgrade.test.ts tests/unit/cli-doctor.test.ts tests/unit/cli-add-resource.test.ts`
    passed.
  - `node node_modules/oxfmt/bin/oxfmt --check --threads=1 tests/unit/functions-defineTrellis.test.ts tests/unit/functions-defineHandler.test.ts tests/unit/eslint-plugin.test.ts tests/unit/cli-upgrade.test.ts tests/unit/cli-doctor.test.ts tests/unit/cli-add-resource.test.ts`
    passed.
  - `git diff --check` passed.
- Current state:
  - The scoped inventory has no stale maintained example, starter, generator, or
    first-reader doc normal-path hits left unclassified. Remaining matches are
    internal machinery, security detectors, runtime boundary tests, or
    legacy/generator negative assertions.

### 2026-06-05 Descriptor Implementation Guard Hard Cut

- Tightened `implementOperation(...)` so descriptor-bound implementations cannot
  carry protected-lane `guard` metadata:
  - `DescriptorBoundOperationShape` now rejects `guard` at the type boundary;
  - runtime assertion rejects any escaped `guard` value before descriptor
    permission binding;
  - `tests/unit/operation-descriptor.test.ts` covers the escaped runtime
    rejection path;
  - `tests/dts/functions.types.ts` covers the compiler-facing rejection.
- Kept the surviving generic `defineOperation(...)` custom protected-lane
  machinery intact for the classified runtime coverage. This cut only removes
  the stale descriptor implementation path where cross-surface operation
  metadata should be permission-owned.
- Corrected `tests/dts/removed-subpaths.types.ts` comments from "1.0 public
  surface" to the current 0.3.0 public surface.
- Verification:
  - `node node_modules/vitest/vitest.mjs run --project=unit --pool=threads --maxWorkers=1 --no-file-parallelism tests/unit/operation-descriptor.test.ts`
    passed: 1 file / 8 tests.
  - `CI=true pnpm run test:types:contracts` passed.
  - `node node_modules/eslint/bin/eslint.js src/runtime/functions/define-operation.ts tests/unit/operation-descriptor.test.ts`
    passed.
  - `node node_modules/oxfmt/bin/oxfmt --check --threads=1 src/runtime/functions/define-operation.ts tests/unit/operation-descriptor.test.ts tests/dts/functions.types.ts tests/dts/removed-subpaths.types.ts`
    passed.
- Current state:
  - Shared operation descriptors now have one authorization metadata path:
    descriptor/implementation permission, not descriptor permission plus hidden
    protected-lane guard.

### 2026-06-05 Service Contract Target Allow-List Enforcement

- Tightened the service-subject runtime contract so
  `assertServiceContractConfigured(...)` is the single metadata-validity gate
  for target allow-lists.
- `defineTrellis({ services })` now rejects escaped service metadata that omits
  both `allowedOperations` and `allowedFunctionRefs` before handler execution,
  instead of relying on a later target-specific branch to discover the missing
  allow-list.
- Removed the duplicate "both allow-lists empty" check from
  `assertServiceTargetAllowed(...)`; after this slice, target enforcement can
  assume service metadata is already structurally valid.
- Added focused runtime coverage in `tests/unit/functions-defineTrellis.test.ts`
  proving a service caller with no target allow-list is denied before the
  handler runs.
- Verification:
  - `node node_modules/vitest/vitest.mjs run --project=unit --pool=threads --maxWorkers=1 --no-file-parallelism tests/unit/functions-defineTrellis.test.ts -t "service"`
    passed: 1 file / 13 selected tests.
  - `node node_modules/vitest/vitest.mjs run --project=unit --pool=threads --maxWorkers=1 --no-file-parallelism tests/unit/functions-defineTrellis.test.ts`
    passed: 1 file / 69 tests.
  - `CI=true pnpm run check:security:contract` passed.
  - `node node_modules/vitest/vitest.mjs run --project=unit --pool=threads --maxWorkers=1 --no-file-parallelism tests/unit/security-contract.test.ts`
    passed: 1 file / 2 tests.
  - `node node_modules/eslint/bin/eslint.js src/runtime/functions/index.ts tests/unit/functions-defineTrellis.test.ts --ignore-pattern '**/_generated/**'`
    passed.
  - `node node_modules/oxfmt/bin/oxfmt --check --threads=1 src/runtime/functions/index.ts tests/unit/functions-defineTrellis.test.ts`
    passed.
- Current state:
  - Service metadata validity is enforced in one place before service target,
    replay, acting-for, or table-scope enforcement proceeds.

### 2026-06-05 Runtime Debt-Word Audit Narrowing

- Cleaned up the misleading "compatibility" wording in
  `tests/unit/functions-defineHandler.test.ts`.
- The protected-lane helper test now describes `buildStructuredFunctions(...)`
  as intentional custom protected-lane runtime and narrowing coverage, not as a
  compatibility path or app-author guidance.
- Verification:
  - `node node_modules/eslint/bin/eslint.js tests/unit/functions-defineHandler.test.ts`
    passed.
  - `node node_modules/oxfmt/bin/oxfmt --check --threads=1 tests/unit/functions-defineHandler.test.ts`
    passed.
  - `rg -n "deprecated|compat|legacy|shim|TODO|FIXME|temporary|migration-only|old path|backcompat|backward" src/runtime tests/unit/functions-defineHandler.test.ts tests/unit/functions-defineTrellis.test.ts apps/docs/content/docs/08.permissions apps/docs/content/docs/13.api-reference --glob '!dist/**' --glob '!node_modules/**'`
    now reports only `src/runtime/convex/server/validate.ts` using
    "H3-compatible" in its ordinary technical sense.
  - `git diff --check` passed.
- Current state:
  - The focused runtime/first-reader API cleanup audit no longer has
    protected-lane "compatibility" wording that reads like a retained migration
    path.

### 2026-06-05 Shared Schema MCP Boundary Public Import Cutover

- Cut the shared-schema MCP boundary fixture off relative `src/runtime` imports
  in its app-facing server/shared files:
  - `server/mcp/tools/create-task.ts` now imports `defineMcpTool` through the
    generated `#trellis/mcp/advanced` alias;
  - `shared/task.ts` now imports `defineArgs` from the public
    `@lupinum/trellis/args` subpath.
- Added an invariant to
  `tests/unit/shared-schema-mcp-boundary-build.test.ts` proving fixture
  `server/` and `shared/` files stay on public/generated Trellis imports. The
  fixture `nuxt.config.ts` can still use local source aliases because it is the
  module-under-test wiring.
- Verification:
  - `node node_modules/vitest/vitest.mjs run --project=unit --pool=threads --maxWorkers=1 --no-file-parallelism tests/unit/shared-schema-mcp-boundary-build.test.ts`
    passed: 1 file / 2 tests.
  - `node node_modules/eslint/bin/eslint.js tests/unit/shared-schema-mcp-boundary-build.test.ts tests/fixtures/shared-schema-mcp-boundary/server/mcp/tools/create-task.ts tests/fixtures/shared-schema-mcp-boundary/shared/task.ts --ignore-pattern '**/_generated/**'`
    passed.
  - `node node_modules/oxfmt/bin/oxfmt --check --threads=1 tests/unit/shared-schema-mcp-boundary-build.test.ts tests/fixtures/shared-schema-mcp-boundary/server/mcp/tools/create-task.ts tests/fixtures/shared-schema-mcp-boundary/shared/task.ts`
    passed.
  - `rg -n "src/runtime|\\.\\./.*src/runtime" tests/fixtures/shared-schema-mcp-boundary/server tests/fixtures/shared-schema-mcp-boundary/shared --glob '!node_modules/**' --glob '!.nuxt/**' --glob '!.output/**'`
    returned no hits.
- Current state:
  - The shared-schema MCP boundary fixture now proves consumer-facing server and
    shared files use the same public/generated Trellis surfaces documented for
    0.3.0.

### 2026-06-05 Phase0 Operation Ref Public Import Cutover

- Cut the phase0 workspace-MCP generated operation refs from a relative
  `src/runtime/functions/define-operation` helper import to the public
  `@lupinum/trellis/backend` subpath.
- Updated `tests/fixtures/phase0-workspace-mcp/starter.manifest.json` so
  starter codegen renders the public backend import as the source of truth, then
  updated the checked-in `generated/operation-refs.ts` fixture to match.
- Added fixture assertions proving generated operation refs import
  `projectOperationRef` from `@lupinum/trellis/backend` and do not contain
  `src/runtime`.
- Updated shared ref codegen formatting so generated files separate bare package
  imports from relative imports, matching `oxfmt` output.
- Verification:
  - `node node_modules/vitest/vitest.mjs run --project=unit --pool=threads --maxWorkers=1 --no-file-parallelism tests/unit/operation-ref-codegen.test.ts tests/unit/phase0-workspace-mcp-fixture.test.ts`
    passed: 2 files / 5 tests.
  - `node node_modules/eslint/bin/eslint.js src/module-internals/ref-codegen.ts tests/fixtures/phase0-workspace-mcp/generated/operation-refs.ts tests/unit/phase0-workspace-mcp-fixture.test.ts --ignore-pattern '**/_generated/**'`
    passed.
  - `node node_modules/oxfmt/bin/oxfmt --check --threads=1 src/module-internals/ref-codegen.ts tests/fixtures/phase0-workspace-mcp/generated/operation-refs.ts tests/unit/phase0-workspace-mcp-fixture.test.ts tests/fixtures/phase0-workspace-mcp/starter.manifest.json`
    passed.
  - `rg -n "projectOperationRefImport|src/runtime/functions/define-operation|from '@lupinum/trellis/backend'" tests/fixtures/phase0-workspace-mcp/starter.manifest.json tests/fixtures/phase0-workspace-mcp/generated/operation-refs.ts tests/unit/phase0-workspace-mcp-fixture.test.ts src/module-internals/ref-codegen.ts`
    shows the manifest and generated fixture on `@lupinum/trellis/backend` with
    no stale `src/runtime/functions/define-operation` import.
- Current state:
  - Operation ref starter generation no longer preserves a relative runtime
    helper import for the `projectOperationRef` public backend API.

### 2026-06-05 Phase0 MCP Runtime Public Import Narrowing

- Cut additional phase0 workspace-MCP fixture files from relative runtime
  imports to existing public surfaces where the direct unit harness can load
  them:
  - `server/mcp/runtime.ts` now imports `operationPreview` from
    `@lupinum/trellis/backend`;
  - `shared/app-inventory.ts` now imports `defineAppInventory` from
    `@lupinum/trellis/workspace`.
- Kept `server/mcp/runtime.ts` on the direct
  `src/runtime/mcp/define-mcp-app` import for `defineMcpApp` because the
  top-level MCP barrel imports Nitro runtime helpers and cannot be loaded by
  this direct Node unit fixture outside a Nuxt/Nitro context. The test now
  documents that exception explicitly instead of hiding it behind a partial
  alias.
- Added assertions proving the operation tools, app inventory, and generated
  operation refs do not contain stale `src/runtime` imports.
- Verification:
  - `node node_modules/vitest/vitest.mjs run --project=unit --pool=threads --maxWorkers=1 --no-file-parallelism tests/unit/phase0-workspace-mcp-fixture.test.ts tests/unit/package-subpath-exports.test.ts`
    passed: 2 files / 6 tests.
  - `node node_modules/eslint/bin/eslint.js tests/fixtures/phase0-workspace-mcp/server/mcp/runtime.ts tests/fixtures/phase0-workspace-mcp/shared/app-inventory.ts tests/unit/phase0-workspace-mcp-fixture.test.ts vitest.config.ts --ignore-pattern '**/_generated/**'`
    passed.
  - `node node_modules/oxfmt/bin/oxfmt --check --threads=1 tests/fixtures/phase0-workspace-mcp/server/mcp/runtime.ts tests/fixtures/phase0-workspace-mcp/shared/app-inventory.ts tests/unit/phase0-workspace-mcp-fixture.test.ts vitest.config.ts`
    passed.
  - `rg -n "src/runtime|\\.\\./.*src/runtime" tests/fixtures/phase0-workspace-mcp/server/mcp/tools tests/fixtures/phase0-workspace-mcp/shared/app-inventory.ts tests/fixtures/phase0-workspace-mcp/generated/operation-refs.ts --glob '!node_modules/**' --glob '!dist/**'`
    returned no hits.
- Current state:
  - The phase0 workspace-MCP consumer-facing tool, inventory, and generated ref
    files use public Trellis surfaces where they can be loaded in the current
    direct unit harness; the remaining direct MCP runtime import is documented
    as a Node-test boundary, not a generator or starter public path.

### 2026-06-05 Phase0 Project Fixture Public Import Cutover

- Cut the phase0 workspace-MCP project fixture files from relative
  `src/runtime` imports to public Trellis subpaths:
  - project domain and operation implementations now import operation helpers
    from `@lupinum/trellis/backend`;
  - project permission keys and checks now import from
    `@lupinum/trellis/auth`;
  - the shared project feature now imports `defineFeature` from
    `@lupinum/trellis/workspace`.
- Removed a duplicate create-project args/return source in the Convex domain
  fixture by binding `createProject` to `createProjectDescriptor.args` and
  `createProjectDescriptor.returns`.
- Added the create-project operation descriptor/permission implementation to
  the fixture inventory so the public-import path is exercised for both safe
  and destructive operation shapes.
- Widened the phase0 fixture invariant so server tools, shared project files,
  project Convex feature files, app inventory, and generated operation refs
  reject stale `src/runtime` imports. The only documented exception remains
  `server/mcp/runtime.ts` for direct `defineMcpApp` loading in the Node unit
  harness.
- Verification:
  - `node node_modules/vitest/vitest.mjs run --project=unit --pool=threads --maxWorkers=1 --no-file-parallelism tests/unit/phase0-workspace-mcp-fixture.test.ts tests/unit/operation-ref-codegen.test.ts tests/unit/package-subpath-exports.test.ts`
    passed: 3 files / 9 tests.
  - `node node_modules/eslint/bin/eslint.js tests/unit/phase0-workspace-mcp-fixture.test.ts tests/fixtures/phase0-workspace-mcp/convex/features/projects/domain.ts tests/fixtures/phase0-workspace-mcp/convex/features/projects/operations.ts tests/fixtures/phase0-workspace-mcp/convex/features/projects/permissions.ts tests/fixtures/phase0-workspace-mcp/shared/features/projects/feature.ts tests/fixtures/phase0-workspace-mcp/shared/features/projects/operations.ts tests/fixtures/phase0-workspace-mcp/shared/features/projects/permissions.ts tests/fixtures/phase0-workspace-mcp/server/mcp/runtime.ts tests/fixtures/phase0-workspace-mcp/shared/app-inventory.ts tests/fixtures/phase0-workspace-mcp/generated/operation-refs.ts src/module-internals/ref-codegen.ts`
    passed.
  - `node node_modules/oxfmt/bin/oxfmt --check --threads=1 tests/unit/phase0-workspace-mcp-fixture.test.ts tests/fixtures/phase0-workspace-mcp/convex/features/projects/domain.ts tests/fixtures/phase0-workspace-mcp/convex/features/projects/operations.ts tests/fixtures/phase0-workspace-mcp/convex/features/projects/permissions.ts tests/fixtures/phase0-workspace-mcp/shared/features/projects/feature.ts tests/fixtures/phase0-workspace-mcp/shared/features/projects/operations.ts tests/fixtures/phase0-workspace-mcp/shared/features/projects/permissions.ts tests/fixtures/phase0-workspace-mcp/server/mcp/runtime.ts tests/fixtures/phase0-workspace-mcp/shared/app-inventory.ts tests/fixtures/phase0-workspace-mcp/generated/operation-refs.ts src/module-internals/ref-codegen.ts`
    passed.
  - `rg -n "src/runtime|\\.\\./.*src/runtime" tests/fixtures/phase0-workspace-mcp/convex/features/projects tests/fixtures/phase0-workspace-mcp/shared/features/projects tests/fixtures/phase0-workspace-mcp/server/mcp/tools tests/fixtures/phase0-workspace-mcp/shared/app-inventory.ts tests/fixtures/phase0-workspace-mcp/generated/operation-refs.ts --glob '!node_modules/**' --glob '!dist/**'`
    returned no hits.
  - `git diff --check` passed.
- Current state:
  - The phase0 project fixture now uses public Trellis surfaces for project
    descriptors, permissions, feature inventory, and operation implementations,
    with descriptor metadata as the single source for create-project args and
    return validation.

### 2026-06-05 Destructive Confirmation Test Lane Cutover

- Cut the destructive confirmation/replay block in
  `tests/unit/functions-defineTrellis.test.ts` off `mutation.protected(...)`
  plus `guard: allowAll` fixture style.
- Added a shared signed-in test caller and destructive test permission, then
  registered those destructive operation tests through
  `mutation.authenticated(...)` / `query.authenticated(...)` with permission
  metadata.
- Kept the surviving `protected(...)` fixtures in the same file for their
  documented custom protected-lane boundary coverage. This slice only changes
  tests whose assertions are about destructive confirmation, replay, preview
  storage, authorization re-check, stale-preview rejection, and safety
  misconfiguration.
- Verification:
  - `node node_modules/vitest/vitest.mjs run --project=unit --pool=threads --maxWorkers=1 --no-file-parallelism tests/unit/functions-defineTrellis.test.ts`
    passed: 1 file / 69 tests.
  - `node node_modules/eslint/bin/eslint.js tests/unit/functions-defineTrellis.test.ts`
    passed.
  - `node node_modules/oxfmt/bin/oxfmt --check --threads=1 tests/unit/functions-defineTrellis.test.ts`
    passed.
  - `rg -n "runtime\\.(query|mutation)\\.protected|guard:\\s*allowAll|guard:\\s*true|permission: destructiveTestPermission|caller: signedInTestCaller" tests/unit/functions-defineTrellis.test.ts`
    now shows the confirmation/replay block on `destructiveTestPermission` and
    `signedInTestCaller`; remaining protected hits are outside that block.
  - `git diff --check` passed.
- Current state:
  - Destructive operation confirmation/replay unit coverage no longer presents
    `protected`/`guard` as the normal operation registration path.

### 2026-06-05 Transport Operation Test Permission Cutover

- Cut the destructive transport operation tests in
  `tests/unit/functions-defineTrellis.test.ts` off `guard: allowAll` operation
  fixtures.
- The projected function-ref verification and trusted operation-execute
  transport mutation tests now use permission metadata and
  `transportMutation.authenticated(...)` instead of custom protected-lane
  operation registration.
- Added the signed-in test caller to those runtime setups so the tests assert
  the transport-specific failure paths rather than relying on a custom guard to
  bypass caller checks.
- Verification:
  - `node node_modules/vitest/vitest.mjs run --project=unit --pool=threads --maxWorkers=1 --no-file-parallelism tests/unit/functions-defineTrellis.test.ts`
    passed: 1 file / 69 tests.
  - `node node_modules/eslint/bin/eslint.js tests/unit/functions-defineTrellis.test.ts`
    passed.
  - `node node_modules/oxfmt/bin/oxfmt --check --threads=1 tests/unit/functions-defineTrellis.test.ts`
    passed.
  - `rg -n "guard:\\s*allowAll|runtime\\.mutation\\.protected\\(|runtime\\.transportMutation\\(" tests/unit/functions-defineTrellis.test.ts`
    now shows remaining `guard: allowAll` and `mutation.protected(...)` hits
    only in earlier custom protected-lane coverage, with no bare
    `runtime.transportMutation(...)` registrations left.
  - `git diff --check` passed.
- Current state:
  - Destructive transport operation unit coverage no longer depends on
    protected-lane guard metadata for operation projection and operation-execute
    transport assertions.

### 2026-06-05 Public Write Negative Fixture Lane Cutover

- Cut the `publicWrite` negative test in
  `tests/unit/functions-defineTrellis.test.ts` off `mutation.protected(...)`
  and `guard: allowAll`.
- The test still proves `publicWrite` is rejected outside public mutation
  handlers, but now uses `mutation.authenticated(...)` with the shared signed-in
  test caller instead of presenting a protected-lane fixture as the non-public
  example.
- Verification:
  - `node node_modules/vitest/vitest.mjs run --project=unit --pool=threads --maxWorkers=1 --no-file-parallelism tests/unit/functions-defineTrellis.test.ts`
    passed: 1 file / 69 tests.
  - `node node_modules/eslint/bin/eslint.js tests/unit/functions-defineTrellis.test.ts`
    passed.
  - `node node_modules/oxfmt/bin/oxfmt --check --threads=1 tests/unit/functions-defineTrellis.test.ts`
    passed.
  - `rg -n "guard:\\s*allowAll|runtime\\.mutation\\.protected\\(|todos\\.protectedPublicWrite|Invalid protected write capability" tests/unit/functions-defineTrellis.test.ts`
    shows no stale publicWrite protected fixture names or messages; remaining
    hits are lane metadata/rejection/custom-guard tests.
  - `git diff --check` passed.
- Current state:
  - Public-write boundary coverage no longer uses protected/guard as the
    representative non-public lane.

### 2026-06-05 Generated Type Consumer Preview Projection Cutover

- Cut the generated type consumer fixture in
  `tests/unit/generated-type-consumers.test.ts` from
  operation `guard: open` metadata and `query(previewOf(archiveTaskOp))` to
  permission metadata and a mutation preview projection.
- Updated the consumer assertion so generated destructive preview projections
  compile as `_type: 'mutation'`, matching the current generator, docs, and
  runtime requirement that destructive previews issuing confirmation state use
  mutation lanes.
- Verification:
  - `node node_modules/vitest/vitest.mjs run --project=unit --pool=threads --maxWorkers=1 --no-file-parallelism tests/unit/generated-type-consumers.test.ts tests/unit/public-surface-codegen.test.ts`
    passed: 2 files / 5 tests.
  - `node node_modules/eslint/bin/eslint.js tests/unit/generated-type-consumers.test.ts tests/unit/public-surface-codegen.test.ts`
    passed.
  - `node node_modules/oxfmt/bin/oxfmt --check --threads=1 tests/unit/generated-type-consumers.test.ts tests/unit/public-surface-codegen.test.ts`
    passed.
  - `rg -n "query<ReturnType|previewKind:.*query|query\\(previewOf" tests/unit/generated-type-consumers.test.ts tests/unit/public-surface-codegen.test.ts src/cli/lib apps/docs examples --glob '!dist/**' --glob '!node_modules/**'`
    returned no hits.
  - `git diff --check` passed.
- Current state:
  - Generated type consumer coverage no longer preserves a query-based
    destructive preview projection fixture.

### 2026-06-05 Direct MCP Mutation Type Validator Cutover

- Narrowed `ValidateMcpToolOptions` in
  `src/runtime/mcp/define-mcp-app.ts` so direct MCP tool option validation only
  accepts query refs.
- Kept operation-backed writes on their separate `ToolOperationOptions` path;
  this avoids a second accepted type-level path for app-backed MCP mutations.
- Updated `tests/dts/mcp.types.ts` and `tests/dts/type-primitives.types.ts` so
  direct query tool options still validate while direct mutation tool options
  are explicit `@ts-expect-error` cases.
- Verification:
  - `CI=true pnpm run test:types:contracts` passed.
  - `node node_modules/eslint/bin/eslint.js src/runtime/mcp/define-mcp-app.ts tests/dts/mcp.types.ts tests/dts/type-primitives.types.ts`
    passed.
  - `node node_modules/oxfmt/bin/oxfmt --check --threads=1 src/runtime/mcp/define-mcp-app.ts tests/dts/mcp.types.ts tests/dts/type-primitives.types.ts`
    passed.
  - `rg -n "ValidateMcpToolOptions<|direct MCP tool options|tool\\.mutation\\(" src/runtime/mcp/define-mcp-app.ts tests/dts/mcp.types.ts tests/dts/type-primitives.types.ts tests/unit/cli-doctor.test.ts`
    shows the remaining direct mutation references only as negative
    detector/type-error fixtures.
  - `git diff --check` passed.
- Current state:
  - Public type validation no longer accepts direct MCP mutation tool options;
    app-backed MCP writes stay operation-backed.

### 2026-06-05 MCP Direct Tool Alias Removal

- Removed the stale `DefineToolOptions` alias from the top-level
  `@lupinum/trellis/mcp` type surface.
- Kept the concrete `DefineConvexToolOptions` implementation type internal to
  the direct Convex read-tool path; the public validation surface is now the
  more precise `ValidateMcpToolOptions` helper.
- Added a dts negative import assertion in `tests/dts/mcp.types.ts` so the old
  alias is not silently reintroduced while direct MCP app writes remain on the
  operation-backed path.
- Verification:
  - `CI=true pnpm run test:types:contracts` passed.
  - `node node_modules/vitest/vitest.mjs run --project=unit --pool=threads --maxWorkers=1 --no-file-parallelism tests/unit/mcp-index-exports.test.ts tests/unit/package-subpath-exports.test.ts`
    passed: 2 files / 8 tests.
  - `node node_modules/eslint/bin/eslint.js src/runtime/mcp/index.ts tests/dts/mcp.types.ts`
    passed.
  - `node node_modules/oxfmt/bin/oxfmt --check --threads=1 src/runtime/mcp/index.ts tests/dts/mcp.types.ts`
    passed.
  - `rg -n "DefineToolOptions|DefineConvexToolOptions as DefineToolOptions" src tests apps/docs examples --glob '!dist/**' --glob '!node_modules/**'`
    shows only the expected negative dts assertion.
  - `git diff --check` passed.
- Current state:
  - The top-level MCP type surface no longer preserves the generic direct-tool
    alias from the old broader direct tool lane.

### 2026-06-05 MCP Generic Tool Options Export Removal

- Removed the generic `ToolOptions` type from the top-level
  `@lupinum/trellis/mcp` export surface.
- Kept the implementation interface internal to `defineMcpApp(...)`; consumers
  should validate public direct read-tool shapes through
  `ValidateMcpToolOptions` instead of importing the broad generic options
  carrier.
- Added a dts negative import assertion in `tests/dts/mcp.types.ts` next to the
  removed `DefineToolOptions` alias assertion.
- Verification:
  - `CI=true pnpm run test:types:contracts` passed.
  - `node node_modules/vitest/vitest.mjs run --project=unit --pool=threads --maxWorkers=1 --no-file-parallelism tests/unit/mcp-index-exports.test.ts tests/unit/package-subpath-exports.test.ts`
    passed: 2 files / 8 tests.
  - `node node_modules/eslint/bin/eslint.js src/runtime/mcp/index.ts tests/dts/mcp.types.ts`
    passed.
  - `node node_modules/oxfmt/bin/oxfmt --check --threads=1 src/runtime/mcp/index.ts tests/dts/mcp.types.ts`
    passed.
  - `rg -n "ToolOptions|DefineToolOptions|DefineConvexToolOptions as DefineToolOptions" src/runtime/mcp/index.ts tests/dts/mcp.types.ts apps/docs/content/docs/13.api-reference apps/docs/content/docs/14.mcp-tools tests/dts/type-primitives.types.ts --glob '!dist/**' --glob '!node_modules/**'`
    shows only `ValidateMcpToolOptions` references and the expected negative dts
    assertions.
  - `git diff --check` passed.
- Current state:
  - Public MCP type validation exposes the named validator helper, not broad
    direct-tool option carrier types from the old direct app-write lane.

### 2026-06-05 MCP Confirmation Redeem Type Rename

- Replaced the typo-shaped `McpConfirmationConfirmationInput` type with
  `McpConfirmationRedeemInput`.
- Updated `McpConfirmationStore.redeem(...)`, the `defineMcpApp` type
  re-export, and the top-level `@lupinum/trellis/mcp` type surface to use the
  corrected redeem-input name.
- Added dts coverage proving the corrected name imports and the duplicated old
  name is removed.
- Verification:
  - `CI=true pnpm run test:types:contracts` passed.
  - `node node_modules/vitest/vitest.mjs run --project=unit --pool=threads --maxWorkers=1 --no-file-parallelism tests/unit/destructive-confirmation.test.ts tests/unit/define-convex-tool.test.ts tests/unit/mcp-operation-binding.test.ts`
    passed: 3 files / 42 tests.
  - `node node_modules/eslint/bin/eslint.js src/runtime/mcp/destructive-confirmation.ts src/runtime/mcp/define-mcp-app.ts src/runtime/mcp/index.ts tests/dts/mcp.types.ts`
    passed.
  - `node node_modules/oxfmt/bin/oxfmt --check --threads=1 src/runtime/mcp/destructive-confirmation.ts src/runtime/mcp/define-mcp-app.ts src/runtime/mcp/index.ts tests/dts/mcp.types.ts`
    passed.
  - `rg -n "McpConfirmationConfirmationInput|McpConfirmationRedeemInput" src tests apps/docs examples meta --glob '!dist/**' --glob '!node_modules/**'`
    shows the corrected implementation/export references plus the expected
    negative dts assertion for the removed typo.
  - `git diff --check` passed.
- Current state:
  - MCP destructive confirmation store typing no longer exposes the duplicated
    confirmation-input name from the interim public surface.

### 2026-06-05 Public App Type Fixture Version Cleanup

- Removed stale 0.2 wording from `tests/dts/app.types.ts`.
- Updated the app-operation example payload from `Ship 0.2` to `Ship 0.3` and
  made the `workspaceScope(...)` negative assertion version-neutral.
- Verification:
  - `CI=true pnpm run test:types:contracts` passed.
  - `node node_modules/eslint/bin/eslint.js tests/dts/app.types.ts` passed.
  - `node node_modules/oxfmt/bin/oxfmt --check --threads=1 tests/dts/app.types.ts`
    passed.
  - `rg -n "0\\.2|Ship 0\\.2" tests/dts tests/types --glob '!dist/**' --glob '!node_modules/**'`
    returned no hits.
- Current state:
  - Public dts fixtures no longer carry stale 0.2 release wording.

### 2026-06-05 Transport Proof Guidance Cutover

- Removed future-tense "0.3 proof API is available" wording from server-route
  docs and starter fixture AGENTS files.
- Updated the guidance to point at the current `transportProof.*(...)` path for
  verified server-to-server flows and to ban raw caller/acting-for forwarding
  from server routes.
- Verification:
  - `node scripts/check-doc-links.mjs` passed.
  - `node node_modules/vitest/vitest.mjs run --project=unit --pool=threads --maxWorkers=1 --no-file-parallelism tests/unit/phase0-starter-manifest.test.ts tests/unit/cli-add-resource.test.ts`
    passed: 2 files / 14 tests.
  - `node node_modules/eslint/bin/eslint.js tests/unit/phase0-starter-manifest.test.ts tests/unit/cli-add-resource.test.ts`
    passed.
  - `node node_modules/oxfmt/bin/oxfmt --check --threads=1 tests/unit/phase0-starter-manifest.test.ts tests/unit/cli-add-resource.test.ts`
    passed.
  - `rg -n "until the 0\\.3 proof API is available|being replaced in Trellis 0\\.3\\.0|once the 0\\.3 proof path is|0\\.3 proof" apps/docs/content src/cli/starter-fixtures examples meta --glob '!node_modules/**' --glob '!dist/**'`
    returned no hits.
  - `rg -n 'transport proof auth|transportProof\\.\\*|raw caller|Forwarded' apps/docs/content/docs/02.concepts/4.call-patterns.md apps/docs/content/docs/13.api-reference/4.server.md src/cli/starter-fixtures/*/AGENTS.md`
    shows the updated current-path guidance.
  - `git diff --check` passed.
- Current state:
  - Docs and starter guidance no longer describe server-to-server forwarding as
    waiting on a future 0.3 proof API.

### 2026-06-05 Unit Fixture Version Text Cleanup

- Removed the remaining `Ship 0.2` literals from app operation unit fixtures.
- Updated the operation query fixture text in `tests/unit/app-index-exports.test.ts`
  and `tests/unit/functions-defineTrellis.test.ts` to `Ship 0.3`.
- Verification:
  - `node node_modules/vitest/vitest.mjs run --project=unit --pool=threads --maxWorkers=1 --no-file-parallelism tests/unit/app-index-exports.test.ts tests/unit/functions-defineTrellis.test.ts`
    passed: 2 files / 77 tests.
  - `node node_modules/eslint/bin/eslint.js tests/unit/app-index-exports.test.ts tests/unit/functions-defineTrellis.test.ts`
    passed.
  - `node node_modules/oxfmt/bin/oxfmt --check --threads=1 tests/unit/app-index-exports.test.ts tests/unit/functions-defineTrellis.test.ts`
    passed.
  - `rg -n "Ship 0\\.2|0\\.2" tests/unit/app-index-exports.test.ts tests/unit/functions-defineTrellis.test.ts tests/dts tests/types --glob '!dist/**' --glob '!node_modules/**'`
    returned no hits.
- Current state:
  - Unit and dts type fixtures no longer carry stale `Ship 0.2` release text.

### 2026-06-05 Cached Query Audit-Term Cleanup

- Reworded cached-query docs to avoid using `temporary` as ordinary prose in a
  first-reader page that is covered by final hard-cut debt-term audits.
- Kept the behavior guidance the same: `isFromCache: true` is the initial detail
  state and should be treated as pending a live upgrade.
- Verification:
  - `node scripts/check-doc-links.mjs` passed.
  - `rg -n "temporary|old path|migration-only|backcompat|backward|TODO|FIXME" apps/docs/content/docs/03.data-fetching/3.cached-queries.md apps/docs/content/docs/02.concepts/4.call-patterns.md apps/docs/content/docs/13.api-reference/4.server.md src/cli/starter-fixtures/*/AGENTS.md --glob '!dist/**' --glob '!node_modules/**'`
    returned no hits.
  - `git diff --check` passed.
- Current state:
  - The touched first-reader docs and starter AGENTS files no longer add
    incidental final-audit debt-term noise.

### 2026-06-05 MCP Reference README Audit-Term Cleanup

- Reworded the MCP reference example's session shortcut prompt from
  `temporary shortcut` to `session-scoped shortcut`.
- This preserves the intended MCP session behavior while removing incidental
  final-audit `temporary` noise from a maintained example README.
- Verification:
  - `rg -n "temporary|old path|migration-only|backcompat|backward|TODO|FIXME" examples/07-mcp-reference/README.md apps/docs/content/docs/03.data-fetching/3.cached-queries.md apps/docs/content/docs/02.concepts/4.call-patterns.md apps/docs/content/docs/13.api-reference/4.server.md src/cli/starter-fixtures/*/AGENTS.md --glob '!dist/**' --glob '!node_modules/**'`
    returned no hits.
  - `git diff --check` passed.
- Current state:
  - Maintained example README guidance no longer carries this incidental
    final-audit debt-term hit.

### 2026-06-05 Test Support Audit-Term Cleanup

- Renamed the server public-export test from `legacy` helper names to `deleted`
  helper names, matching the assertion's actual purpose.
- Reworded `tests/support/browser` in `tests/TESTING.md` from browser `shims` to
  browser alias helpers.
- Verification:
  - `node node_modules/vitest/vitest.mjs run --project=unit --pool=threads --maxWorkers=1 --no-file-parallelism tests/unit/server-index-exports.test.ts`
    passed: 1 file / 6 tests.
  - `node node_modules/eslint/bin/eslint.js tests/unit/server-index-exports.test.ts`
    passed.
  - `node node_modules/oxfmt/bin/oxfmt --check --threads=1 tests/unit/server-index-exports.test.ts`
    passed.
  - `rg -n "legacy|shims|shim" tests/unit/server-index-exports.test.ts tests/TESTING.md --glob '!dist/**' --glob '!node_modules/**'`
    returned no hits.
- Current state:
  - These test-support files no longer contribute incidental `legacy`/`shim`
    hits to final debt-term audits.

### 2026-06-05 Protected-App Label Cutover

- Replaced remaining first-reader `protected-app` / `protected model` wording
  with explicit workspace app language.
- Touched docs, example navigation, and the workspace-MCP starter README; custom
  protected-lane API docs remain where they describe the intentional custom
  guard lane.
- Verification:
  - `node scripts/check-doc-links.mjs` passed.
  - `node node_modules/vitest/vitest.mjs run --project=unit --pool=threads --maxWorkers=1 --no-file-parallelism tests/unit/phase0-starter-manifest.test.ts`
    passed: 1 file / 5 tests.
  - `rg -n "protected-app|protected app|protected model|protected workspace|protected-app shell|canonical protected" apps/docs/content examples src/cli/starter-fixtures --glob '!node_modules/**' --glob '!dist/**'`
    returned no hits.
  - `git diff --check` passed.
- Current state:
  - Maintained docs and starter navigation no longer name the normal workspace
    app model as the protected-app model.

### 2026-06-05 Identity Forwarding Secret Wording Cleanup

- Reworded the example 03 `CONVEX_IDENTITY_FORWARDING_KEY` description from
  shared secret language to forwarding signing-key language.
- This keeps the maintained example aligned with the signed identity-forwarding
  model documented in the server-side guide.
- Verification:
  - `rg -n "shared secret for identity forwarding|CONVEX_IDENTITY_FORWARDING_KEY.*shared secret|readSharedSecretWebhookBody" examples/03-team-workspace/README.md examples/README.md apps/docs/content tests/unit/example-webhook-security.test.ts --glob '!dist/**' --glob '!node_modules/**'`
    shows only intentional negative `readSharedSecretWebhookBody` assertions.
  - `rg -n "CONVEX_IDENTITY_FORWARDING_KEY" examples/03-team-workspace/README.md examples/README.md examples/07-mcp-reference/README.md apps/docs/content/docs/07.server-side/3.webhooks-and-identity-forwarding.md`
    shows current forwarding-key guidance.
  - `git diff --check` passed.
- Current state:
  - Maintained example 03 no longer describes the identity-forwarding key as a
    generic shared secret.

### 2026-06-05 Runtime/Test Stale Label Cleanup

- Replaced a stale `protected app runtime` comment in `defineCaller(...)` with
  explicit app runtime language.
- Reworded the identity-forwarding weak-key production warning from random
  shared secret language to random signing key language.
- Updated the examples gallery doc test to expect the current workspace-app
  wording already present in `examples/README.md`.
- Verification:
  - `node node_modules/vitest/vitest.mjs run --project=unit --pool=threads --maxWorkers=1 --no-file-parallelism tests/unit/examples-gallery-docs.test.ts tests/unit/identity-forwarding.test.ts tests/unit/server-boundaries.test.ts`
    passed: 3 files / 34 tests.
  - `node node_modules/eslint/bin/eslint.js src/runtime/functions/define-caller.ts src/runtime/identity-forwarding/shared.ts tests/unit/examples-gallery-docs.test.ts`
    passed.
  - `node node_modules/oxfmt/bin/oxfmt --check --threads=1 src/runtime/functions/define-caller.ts src/runtime/identity-forwarding/shared.ts tests/unit/examples-gallery-docs.test.ts`
    passed.
  - `rg -n "protected app runtime|protected-app example|long random shared secret|CONVEX_IDENTITY_FORWARDING_KEY.*shared secret" src/runtime tests/unit apps/docs/content examples --glob '!dist/**' --glob '!node_modules/**'`
    returned no hits.
- Current state:
  - Runtime comments, identity-forwarding diagnostics, and examples gallery
    tests now use current 0.3 terminology.

### 2026-06-05 MCP Internal Direct Tool Options Rename

- Renamed the internal `ToolOptions` carrier in `defineMcpApp(...)` to
  `DirectToolOptions`.
- Changed its default function ref from mutation to query so the internal type
  matches the current direct MCP lane: direct reads only; writes remain
  operation-backed through `ToolOperationOptions`.
- Kept the removed public `ToolOptions` dts negative assertion in place, with
  no compatibility alias.
- Verification:
  - `CI=true pnpm run test:types:contracts` passed.
  - `node node_modules/vitest/vitest.mjs run --project=unit --pool=threads --maxWorkers=1 --no-file-parallelism tests/unit/define-convex-tool.test.ts tests/unit/mcp-operation-binding.test.ts tests/unit/mcp-index-exports.test.ts`
    passed: 3 files / 43 tests.
  - `node node_modules/eslint/bin/eslint.js src/runtime/mcp/define-mcp-app.ts tests/dts/mcp.types.ts tests/dts/type-primitives.types.ts`
    passed.
  - `node node_modules/oxfmt/bin/oxfmt --check --threads=1 src/runtime/mcp/define-mcp-app.ts tests/dts/mcp.types.ts tests/dts/type-primitives.types.ts`
    passed.
  - `rg -n "ToolOptions|DirectToolOptions|ValidateMcpToolOptions|AnyMutationRef" src/runtime/mcp/define-mcp-app.ts tests/dts/mcp.types.ts tests/dts/type-primitives.types.ts src/runtime/mcp/index.ts apps/docs/content/docs/13.api-reference/8.type-primitives.md`
    shows `ToolOptions` only in the expected negative dts assertion and
    `DirectToolOptions` only in the internal MCP implementation.
  - `git diff --check` passed.
- Current state:
  - The MCP runtime no longer keeps an internal broad `ToolOptions` name from
    the deleted direct app-write lane.

### 2026-06-05 Unit Fixture Audit-Term Cleanup

- Reworded the example dev launcher assertion from temporary env-file wording
  to ephemeral env-file wording while keeping the private temp directory and
  restrictive-mode invariant intact.
- Replaced the JWT decoding fixture value `legacy_user_123` with
  `token_user_123`; the test still proves JWT identifiers are not exposed as
  app user ids.
- Verification:
  - `node node_modules/vitest/vitest.mjs run --project=unit --pool=threads --maxWorkers=1 --no-file-parallelism tests/unit/example-dev-launcher.test.ts tests/unit/jwt-user-decoding.test.ts`
    passed: 2 files / 39 tests.
  - `node node_modules/eslint/bin/eslint.js tests/unit/example-dev-launcher.test.ts tests/unit/jwt-user-decoding.test.ts`
    passed.
  - `node node_modules/oxfmt/bin/oxfmt --check --threads=1 tests/unit/example-dev-launcher.test.ts tests/unit/jwt-user-decoding.test.ts`
    passed.
  - `rg -n "temporary Convex env|legacy_user_123" tests/unit/example-dev-launcher.test.ts tests/unit/jwt-user-decoding.test.ts --glob '!dist/**' --glob '!node_modules/**'`
    returned no hits.
- Current state:
  - The focused unit fixtures no longer add false-positive legacy/temporary
    wording to the 0.3 audit surface.

### 2026-06-05 MCP Enabled Predicate Comment Cleanup

- Reworded the `enabled` direct-tool option comment in
  `src/runtime/mcp/types.ts` from guard wording to predicate wording.
- This keeps the current `enabled` API untouched while avoiding a misleading
  operation-guard label in the direct MCP option surface.
- Verification:
  - `node node_modules/eslint/bin/eslint.js src/runtime/mcp/types.ts` passed.
  - `node node_modules/oxfmt/bin/oxfmt --check --threads=1 src/runtime/mcp/types.ts`
    passed.
  - `rg -n "Guard to include|guard to include" src/runtime/mcp/types.ts src/runtime/mcp/define-convex-tool.ts src/runtime/mcp/define-mcp-app.ts`
    returned no hits.
- Current state:
  - MCP direct-tool option comments no longer describe the `enabled` predicate
    as a guard.

### 2026-06-05 Generic Compatibility Wording Cleanup

- Reworded a unit test name from Convex-compatible path wording to Convex local
  env path wording.
- Reworded the server validation helper comments from H3-compatible wording to
  direct H3 validation wording.
- Left real Nuxt `compatibility` metadata untouched because it is framework
  configuration, not an old-path compatibility shim.
- Verification:
  - `node node_modules/vitest/vitest.mjs run --project=unit --pool=threads --maxWorkers=1 --no-file-parallelism tests/unit/example-dev-launcher.test.ts`
    passed: 1 file / 34 tests.
  - `node node_modules/eslint/bin/eslint.js tests/unit/example-dev-launcher.test.ts src/runtime/convex/server/validate.ts`
    passed.
  - `node node_modules/oxfmt/bin/oxfmt --check --threads=1 tests/unit/example-dev-launcher.test.ts src/runtime/convex/server/validate.ts`
    passed.
  - `rg -n "Convex-compatible|H3-compatible|Compatible with H3" tests/unit/example-dev-launcher.test.ts src/runtime/convex/server/validate.ts`
    returned no hits.
- Current state:
  - These maintained source/test files no longer add generic compatibility-term
    noise to the final hard-cut audit surface.

### 2026-06-05 Docs And Skill Compatibility Wording Cleanup

- Reworded the docs Plausible plugin comment from SSR/prerender compatibility
  wording to SSR/prerender-safe loading.
- Reworded the client-composables skill reference from compatible result shapes
  to aligned result shapes.
- These are wording-only changes; they do not alter Nuxt compatibility metadata
  or any app/runtime behavior.
- Verification:
  - `node node_modules/oxfmt/bin/oxfmt --check --threads=1 apps/docs/app/plugins/plausible.client.ts meta/skill/references/client-composables.md`
    passed.
  - `rg -n "SSR/prerender compatibility|result shapes\\s+compatible|compatible\\.|compatibility and automatic" apps/docs/app/plugins/plausible.client.ts meta/skill/references/client-composables.md`
    returned no hits.
  - `node scripts/check-doc-links.mjs` passed.
  - `git diff --check` passed.
  - Scoped ESLint for `apps/docs/app/plugins/plausible.client.ts` could not run
    in this checkout because `apps/docs/eslint.config.mjs` imports generated
    `.nuxt/eslint.config.mjs`; this slice is comment-only in that file.
- Current state:
  - These maintained docs/skill files no longer add generic compatibility-term
    noise to the final hard-cut audit surface.

### 2026-06-05 Operation Descriptor Guard-Hit Classification

- Added a file-level classification comment to
  `tests/unit/operation-descriptor.test.ts` explaining that its remaining
  `guard: true` hit is intentional boundary coverage.
- The file remains permission-backed for normal descriptor implementations; the
  guard fixture exists only to prove descriptor implementations reject
  protected-lane guard metadata.
- Verification:
  - `node node_modules/vitest/vitest.mjs run --project=unit --pool=threads --maxWorkers=1 --no-file-parallelism tests/unit/operation-descriptor.test.ts`
    passed: 1 file / 8 tests.
  - `node node_modules/eslint/bin/eslint.js tests/unit/operation-descriptor.test.ts`
    passed.
  - `node node_modules/oxfmt/bin/oxfmt --check --threads=1 tests/unit/operation-descriptor.test.ts`
    passed.
  - `rg -n "guard:\\s*|protected-lane guard metadata|Intentional 0\\.3\\.0 boundary coverage" tests/unit/operation-descriptor.test.ts`
    shows the file-level classification next to the intentional negative guard
    assertion.
- Current state:
  - The remaining operation-descriptor guard audit hit is classified in source
    as intentional rejection coverage, not old-path fixture guidance.

### 2026-06-05 Public DTS Old-Path Assertion Classification

- Added file-level classification comments to:
  - `tests/dts/app.types.ts`;
  - `tests/dts/functions.types.ts`;
  - `tests/dts/mcp.types.ts`.
- These comments make the remaining `guard: true`, deleted MCP option aliases,
  typo-name import, and `runtime.tool.mutation(...)` hits self-describing as
  negative public type boundary assertions.
- Verification:
  - `CI=true pnpm run test:types:contracts` passed.
  - `node node_modules/eslint/bin/eslint.js tests/dts/app.types.ts tests/dts/functions.types.ts tests/dts/mcp.types.ts`
    passed.
  - `node node_modules/oxfmt/bin/oxfmt --check --threads=1 tests/dts/app.types.ts tests/dts/functions.types.ts tests/dts/mcp.types.ts`
    passed.
  - `rg -n "Intentional 0\\.3\\.0|guard:\\s*true|tool\\.mutation|DefineToolOptions|ToolOptions|McpConfirmationConfirmationInput" tests/dts/app.types.ts tests/dts/functions.types.ts tests/dts/mcp.types.ts`
    shows the file-level classifications next to the intentional negative type
    assertions.
- Current state:
  - The remaining public DTS old-path tokens are classified in source as
    deliberate removed-surface/type-boundary checks.

### 2026-06-05 MCP Reference Direct-Write Assertion Classification

- Added an in-test classification comment to
  `examples/07-mcp-reference/test/mcpReference.test.ts` explaining that the
  remaining `tool.mutation(` and `tool.operation(` strings are negative
  read-only boundary assertions for anonymous MCP tools.
- Verification:
  - `pnpm exec vitest run test/mcpReference.test.ts` from
    `examples/07-mcp-reference` passed: 1 file / 11 tests.
  - `node ../../node_modules/eslint/bin/eslint.js test/mcpReference.test.ts`
    from `examples/07-mcp-reference` passed.
  - `node ../../node_modules/oxfmt/bin/oxfmt --check --threads=1 test/mcpReference.test.ts`
    from `examples/07-mcp-reference` passed.
  - `rg -n "Intentional 0\\.3\\.0 boundary coverage|tool\\.mutation\\(|tool\\.operation\\(" examples/07-mcp-reference/test/mcpReference.test.ts`
    shows the classification next to the intentional negative assertions.
- Current state:
  - The maintained MCP reference example no longer has an unclassified direct
    MCP write-token audit hit.

### 2026-06-05 Unsafe Lane Protected-Shape Wording Cleanup

- Reworded unsafe-lane table descriptions in:
  - `apps/docs/content/docs/08.permissions/0.backend-builders.md`;
  - `apps/docs/content/docs/08.permissions/6.cross-scope-and-raw-access.md`.
- The docs now describe unsafe lanes as leaving normal lane shape / normal lane
  guard phases instead of using `protected` as a generic normal-path label.
- Verification:
  - `node scripts/check-doc-links.mjs` passed.
  - `node node_modules/oxfmt/bin/oxfmt --check --threads=1 apps/docs/content/docs/08.permissions/0.backend-builders.md apps/docs/content/docs/08.permissions/6.cross-scope-and-raw-access.md`
    passed.
  - `rg -n "normal protected shape|Protected handler path|normal lane shape|Normal lane guard phases" apps/docs/content/docs/08.permissions/0.backend-builders.md apps/docs/content/docs/08.permissions/6.cross-scope-and-raw-access.md`
    shows only the new normal-lane wording.
- Current state:
  - First-reader advanced permission docs no longer describe the normal lane
    model as a protected shape.

### 2026-06-05 Nuxt Auth Flow TODO-Token Fixture Cleanup

- Renamed the `TODOS_QUERY` fixture constant in
  `tests/nuxt/useConvexAuthFlow.nuxt.test.ts` to `TASK_LIST_QUERY`.
- This removes incidental `TODO` audit noise from a test fixture name without
  changing the mocked Convex function ref or test behavior.
- Verification:
  - `node node_modules/vitest/vitest.mjs run --project=nuxt --pool=threads --maxWorkers=1 --no-file-parallelism tests/nuxt/useConvexAuthFlow.nuxt.test.ts`
    passed: 1 file / 19 tests.
  - `node node_modules/eslint/bin/eslint.js tests/nuxt/useConvexAuthFlow.nuxt.test.ts`
    passed.
  - `node node_modules/oxfmt/bin/oxfmt --check --threads=1 tests/nuxt/useConvexAuthFlow.nuxt.test.ts`
    passed.
  - `rg -n "TODOS_QUERY|TASK_LIST_QUERY" tests/nuxt/useConvexAuthFlow.nuxt.test.ts`
    shows only the new fixture name.
- Current state:
  - The Nuxt auth-flow test no longer contributes an incidental `TODO` token to
    final debt-term audits.

### 2026-06-05 Upgrade Command 0.3 Label Cutover

- Replaced stale `Trellis 1.0` upgrade command wording with `Trellis 0.3` in
  `src/cli/commands/upgrade.ts`.
- Updated `tests/unit/cli-upgrade.test.ts` to expect the 0.3 upgrade heading.
- Rebuilt the CLI because the focused upgrade tests execute `dist/cli.mjs`.
- Verification:
  - `pnpm run build:cli` passed.
  - `node node_modules/vitest/vitest.mjs run --project=unit --pool=threads --maxWorkers=1 --no-file-parallelism tests/unit/cli-upgrade.test.ts`
    passed: 1 file / 24 tests.
  - `node node_modules/eslint/bin/eslint.js src/cli/commands/upgrade.ts tests/unit/cli-upgrade.test.ts`
    passed.
  - `node node_modules/oxfmt/bin/oxfmt --check --threads=1 src/cli/commands/upgrade.ts tests/unit/cli-upgrade.test.ts`
    passed.
  - `rg -n "Trellis 1\\.0|Trellis 0\\.3 upgrade|Trellis 0\\.3 migration" src/cli/commands/upgrade.ts tests/unit/cli-upgrade.test.ts dist/cli.mjs --glob '!node_modules/**'`
    shows only current 0.3 upgrade/migration wording.
- Current state:
  - The upgrade CLI no longer labels the active hard-cut migration as Trellis
    1.0.

### 2026-06-05 Upgrade Command Detector Classification

- Added a file-level classification comment to
  `src/cli/commands/upgrade.ts` explaining that its remaining legacy-token
  names are intentional pre-0.3 migration detector labels, not retained
  compatibility paths.
- Removed stale `1.0` wording from the functions-import fix hint so the CLI no
  longer describes `@lupinum/trellis/backend` as a canonical 1.0 import.
- Rebuilt the CLI because the focused upgrade tests execute `dist/cli.mjs`.
- Verification:
  - `pnpm run build:cli` passed.
  - `node node_modules/vitest/vitest.mjs run --project=unit --pool=threads --maxWorkers=1 --no-file-parallelism tests/unit/cli-upgrade.test.ts`
    passed: 1 file / 24 tests.
  - `node node_modules/eslint/bin/eslint.js src/cli/commands/upgrade.ts tests/unit/cli-upgrade.test.ts`
    passed.
  - `node node_modules/oxfmt/bin/oxfmt --check --threads=1 src/cli/commands/upgrade.ts tests/unit/cli-upgrade.test.ts`
    passed.
  - `rg -n "Intentional 0\\.3\\.0 migration detector|canonical 1\\.0 backend import|Trellis 1\\.0|Trellis 0\\.3 upgrade|Trellis 0\\.3 migration" src/cli/commands/upgrade.ts tests/unit/cli-upgrade.test.ts dist/cli.mjs --glob '!node_modules/**'`
    shows the detector classification and current 0.3 labels, with no stale
    canonical 1.0 import hint.
- Current state:
  - The upgrade command's remaining old-path terms are classified as migration
    detector coverage in source.

### 2026-06-05 Repo Policy 0.3 Label Cutover

- Replaced the retained examples/apps deleted-surface policy error label in
  `scripts/check-repo-policies.mjs` from `Trellis 1.0` to `Trellis 0.3`.
- This is a wording-only hard-cut alignment; the deleted-surface policy and
  scanned paths are unchanged.
- Verification:
  - `node scripts/check-repo-policies.mjs` passed.
  - `node node_modules/eslint/bin/eslint.js scripts/check-repo-policies.mjs`
    passed.
  - `node node_modules/oxfmt/bin/oxfmt --check --threads=1 scripts/check-repo-policies.mjs`
    passed.
  - `rg -n "Trellis 1\\.0|deleted Trellis 0\\.3 surfaces" scripts/check-repo-policies.mjs`
    shows only the current 0.3 deleted-surface label.
- Current state:
  - The retained examples/apps deleted-surface gate no longer reports the 0.3
    hard-cut policy as a Trellis 1.0 policy.

### 2026-06-05 Runtime Guard Machinery Classification

- Added source-level 0.3.0 classification comments to:
  - `src/runtime/auth/define-guard.ts`;
  - `src/runtime/functions/define-handler.ts`;
  - `src/runtime/functions/define-operation.ts`;
  - `src/runtime/functions/index.ts`.
- These comments classify remaining runtime `guard` / `authRequired` terms as
  internal custom protected-lane, authenticated-lane, workspace-lane, or
  operation-projection machinery, not public first-reader app-author API.
- The audit also confirmed `@lupinum/trellis/mcp/advanced` is currently a
  deliberate advanced subpath: it exports `defineMcpTool`, docs describe it as
  standalone non-app-write tooling, dts coverage proves advanced tool extras do
  not expose app mutation/action helpers, and packed-export/security-contract
  checks ban the removed `defineTool` symbol.
- Verification:
  - `node node_modules/vitest/vitest.mjs run --project=unit --pool=threads --maxWorkers=1 --no-file-parallelism tests/unit/functions-defineTrellis.test.ts tests/unit/functions-defineHandler.test.ts tests/unit/operation-descriptor.test.ts`
    passed: 3 files / 93 tests.
  - `node node_modules/eslint/bin/eslint.js src/runtime/functions/index.ts src/runtime/functions/define-handler.ts src/runtime/functions/define-operation.ts src/runtime/auth/define-guard.ts tests/unit/functions-defineTrellis.test.ts tests/unit/functions-defineHandler.test.ts tests/unit/operation-descriptor.test.ts`
    passed.
  - `node node_modules/oxfmt/bin/oxfmt --check --threads=1 src/runtime/functions/index.ts src/runtime/functions/define-handler.ts src/runtime/functions/define-operation.ts src/runtime/auth/define-guard.ts tests/unit/functions-defineTrellis.test.ts tests/unit/functions-defineHandler.test.ts tests/unit/operation-descriptor.test.ts`
    passed after formatting `src/runtime/functions/index.ts`.
  - `git diff --check` passed.
  - `rg -n "query\\.protected|mutation\\.protected|action\\.protected|guard:\\s*|protected\\(previewOf|protected preview|authRequired" tests/unit src/cli src/module-internals src/runtime scripts examples src/cli/starter-fixtures --glob '!dist/**' --glob '!node_modules/**'`
    shows remaining hits in classified runtime machinery, security scanners,
    legacy-detection fixtures, negative export/type assertions, or custom
    protected-lane tests.
- Current state:
  - The runtime source files now classify their remaining old-looking
    guard/authRequired terms in place for the final hard-cut audit.

### 2026-06-05 Security Scanner Old-Path Classification

- Added source-level 0.3.0 classification comments to:
  - `scripts/lib/security-source-policy.mjs`;
  - `scripts/check-security-packed-exports.mjs`;
  - `scripts/lib/security-contract.mjs`;
  - `scripts/lib/retained-target-old-paths.mjs`;
  - `scripts/lib/public-surface-inventory.mjs`.
- These comments classify remaining deleted API names, stale subpaths, and
  old-tool names in scanner code as policy data or stale-reference detectors,
  not retained implementation paths.
- Verification:
  - `node scripts/check-security-source-policy.mjs` passed.
  - `node scripts/check-security-packed-exports.mjs` passed.
  - `node scripts/check-repo-policies.mjs` passed.
  - `node node_modules/vitest/vitest.mjs run --project=unit --pool=threads --maxWorkers=1 --no-file-parallelism tests/unit/security-contract.test.ts tests/unit/retained-target-old-paths.test.ts tests/unit/package-subpath-exports.test.ts`
    passed: 3 files / 8 tests.
  - `node node_modules/eslint/bin/eslint.js scripts/lib/security-source-policy.mjs scripts/check-security-packed-exports.mjs scripts/lib/security-contract.mjs scripts/lib/retained-target-old-paths.mjs scripts/lib/public-surface-inventory.mjs tests/unit/security-contract.test.ts tests/unit/retained-target-old-paths.test.ts tests/unit/package-subpath-exports.test.ts`
    passed.
  - `node node_modules/oxfmt/bin/oxfmt --check --threads=1 scripts/lib/security-source-policy.mjs scripts/check-security-packed-exports.mjs scripts/lib/security-contract.mjs scripts/lib/retained-target-old-paths.mjs scripts/lib/public-surface-inventory.mjs tests/unit/security-contract.test.ts tests/unit/retained-target-old-paths.test.ts tests/unit/package-subpath-exports.test.ts`
    passed.
- Current state:
  - Old-path terms in security scanner files are now classified at the source as
    enforcement data for the hard-cut cleanup audit.

### 2026-06-05 Authenticated Guard Type Fixture Classification

- Updated the classification comment in
  `tests/types/authenticated-guard.types.ts` to use the same `Intentional
0.3.0` marker as the rest of the old-path audit surface.
- The fixture remains internal protected-lane type coverage for runtime
  sentinels and custom guards, not app-author operation guidance.
- Verification:
  - `CI=true pnpm run test:types:contracts` passed.
  - `node node_modules/eslint/bin/eslint.js tests/types/authenticated-guard.types.ts`
    passed.
  - `node node_modules/oxfmt/bin/oxfmt --check --threads=1 tests/types/authenticated-guard.types.ts`
    passed.
  - `rg -n "Intentional 0\\.3\\.0 internal protected-lane|guard:\\s*|authRequired" tests/types/authenticated-guard.types.ts`
    shows the 0.3.0 classification next to the protected-lane guard fixtures.
- Current state:
  - The remaining `guard` / `authRequired` hits in
    `tests/types/authenticated-guard.types.ts` are classified in source as
    intentional internal type coverage.

### 2026-06-05 Deleted API Negative Assertion Classification

- Added source-level 0.3.0 classification comments to deleted-API negative
  assertion tests:
  - `tests/unit/auth-index.test.ts`;
  - `tests/unit/mcp-index-exports.test.ts`;
  - `tests/unit/server-index-exports.test.ts`;
  - `tests/unit/example-webhook-security.test.ts`;
  - `tests/unit/security-contract.test.ts`;
  - `tests/unit/retained-target-old-paths.test.ts`.
- These comments classify remaining deleted helper names and old subpath/tool
  strings as negative public export, maintained-example, security contract, or
  scanner fixture assertions.
- Verification:
  - `node node_modules/vitest/vitest.mjs run --project=unit --pool=threads --maxWorkers=1 --no-file-parallelism tests/unit/auth-index.test.ts tests/unit/mcp-index-exports.test.ts tests/unit/server-index-exports.test.ts tests/unit/example-webhook-security.test.ts tests/unit/security-contract.test.ts tests/unit/retained-target-old-paths.test.ts`
    passed: 6 files / 16 tests.
  - `node node_modules/eslint/bin/eslint.js tests/unit/auth-index.test.ts tests/unit/mcp-index-exports.test.ts tests/unit/server-index-exports.test.ts tests/unit/example-webhook-security.test.ts tests/unit/security-contract.test.ts tests/unit/retained-target-old-paths.test.ts`
    passed.
  - `node node_modules/oxfmt/bin/oxfmt --check --threads=1 tests/unit/auth-index.test.ts tests/unit/mcp-index-exports.test.ts tests/unit/server-index-exports.test.ts tests/unit/example-webhook-security.test.ts tests/unit/security-contract.test.ts tests/unit/retained-target-old-paths.test.ts`
    passed.
  - `rg -n "Intentional 0\\.3\\.0|delegateToUser|readSharedSecretWebhookBody|stampMcpToolSafety|authRequired|tool\\.fromOperation" tests/unit/auth-index.test.ts tests/unit/mcp-index-exports.test.ts tests/unit/server-index-exports.test.ts tests/unit/example-webhook-security.test.ts tests/unit/security-contract.test.ts tests/unit/retained-target-old-paths.test.ts`
    shows the classification comments next to the deleted API negative
    assertions.
- Current state:
  - Deleted public API names in these negative tests are classified in source
    as intentional boundary assertions.

### 2026-06-05 CLI Inventory Detector Classification

- Added source-level 0.3.0 classification comments to:
  - `src/cli/lib/project.ts`;
  - `src/cli/lib/inventory-findings.ts`.
- These comments classify remaining deleted API names, including
  `ctx.db.escapeIsolation(...)`, as CLI inventory detector targets and report
  labels for consumer projects, not retained runtime paths.
- Verification:
  - `node node_modules/vitest/vitest.mjs run --project=unit --pool=threads --maxWorkers=1 --no-file-parallelism tests/unit/cli-doctor.test.ts -t "cross-scope escape|escapeIsolation|unsafe surface inventory"`
    passed: 1 selected test.
  - `node node_modules/eslint/bin/eslint.js src/cli/lib/project.ts src/cli/lib/inventory-findings.ts tests/unit/cli-doctor.test.ts`
    passed.
  - `node node_modules/oxfmt/bin/oxfmt --check --threads=1 src/cli/lib/project.ts src/cli/lib/inventory-findings.ts tests/unit/cli-doctor.test.ts`
    passed.
  - `rg -n "Intentional 0\\.3\\.0 inventory|escapeIsolation" src/cli/lib/project.ts src/cli/lib/inventory-findings.ts tests/unit/cli-doctor.test.ts`
    shows the classification comments next to the deleted API detector and
    finding text.
- Current state:
  - CLI inventory code now classifies its remaining deleted API strings as
    consumer-project detector data.

### 2026-06-05 Skill Reference Guard Sentinel Classification

- Updated `meta/skill/references/backend-auth-permissions.md` so the remaining
  `authRequired`, `guard: authRequired`, and `guard: open` guidance uses an
  explicit `Intentional 0.3.0` boundary marker.
- The reference already directed new app code to `public(...)`,
  `authenticated(...)`, `workspace(...)`, or real custom `protected(...)`
  guards; this slice makes the audit classification explicit.
- Verification:
  - `node node_modules/oxfmt/bin/oxfmt --check --threads=1 meta/skill/references/backend-auth-permissions.md`
    passed.
  - `node scripts/check-doc-links.mjs` passed.
  - `rg -n "Intentional 0\\.3\\.0 boundary|authRequired|guard: authRequired|guard: open|compatibility shims" meta/skill/references/backend-auth-permissions.md`
    shows the 0.3.0 boundary marker next to the remaining guard-sentinel
    wording.
  - `git diff --check` passed.
- Current state:
  - The skill reference classifies its remaining guard-sentinel terms as 0.3.0
    internal-boundary guidance, not normal app-author API.

### 2026-06-05 Skill Reference Compatibility-Term Cleanup

- Reworded hard-cut guidance in the Trellis skill files so incidental
  `compatibility` terms no longer appear in skill/reference audit output:
  - `meta/skill/SKILL.md`;
  - `meta/skill/references/config-cli.md`;
  - `meta/skill/references/public-surface.md`;
  - `meta/skill/references/backend-auth-permissions.md`.
- The guidance still says not to preserve or reintroduce stale paths; it now
  uses direct `old-path` / `parallel alias` wording instead of generic
  compatibility phrasing.
- Verification:
  - `node node_modules/oxfmt/bin/oxfmt --check --threads=1 meta/skill/SKILL.md meta/skill/references/config-cli.md meta/skill/references/public-surface.md meta/skill/references/backend-auth-permissions.md`
    passed.
  - `node scripts/check-doc-links.mjs` passed.
  - `rg -n "compatibility shims|compatibility paths|compatibility aliases|compatibility layer|old-path shims|old-path aliases|parallel alias layer|Intentional 0\\.3\\.0 boundary" meta/skill/SKILL.md meta/skill/references/config-cli.md meta/skill/references/public-surface.md meta/skill/references/backend-auth-permissions.md`
    shows only the new old-path / parallel-alias wording plus the existing 0.3
    guard boundary marker.
  - `git diff --check` passed.
- Current state:
  - Skill docs no longer contribute generic compatibility-term noise to the
    final cleanup audit.

### 2026-06-05 Public Surface Alignment Audit

- Audited the package export source of truth against public-surface docs and
  subpath/type boundary tests:
  - `package.json` exports/typesVersions;
  - `apps/docs/content/docs/13.api-reference/7.api-surface.md`;
  - `tests/unit/package-subpath-exports.test.ts`;
  - `tests/dts/removed-subpaths.types.ts`;
  - `tests/dts/mcp.types.ts`.
- No public-surface drift was found. The current exported package subpaths are:
  root, `app`, `args`, `auth`, `backend`, `composables`, `mcp`,
  `mcp/advanced`, `server`, `testing`, `type-primitives`, and `workspace`.
- The surviving `@lupinum/trellis/mcp/advanced` subpath remains deliberate and
  bounded to standalone `defineMcpTool`; removed `functions` and `bridge`
  subpaths remain covered by negative export/type assertions.
- Verification:
  - `CI=true pnpm run check:docs:api-surface` passed.
  - `node node_modules/vitest/vitest.mjs run --project=unit --pool=threads --maxWorkers=1 --no-file-parallelism tests/unit/package-subpath-exports.test.ts tests/unit/api-surface-doc.test.ts`
    passed: 2 files / 6 tests.
  - `CI=true pnpm run test:types:contracts` passed.
  - `node node_modules/eslint/bin/eslint.js tests/unit/package-subpath-exports.test.ts tests/unit/api-surface-doc.test.ts tests/dts/removed-subpaths.types.ts tests/dts/mcp.types.ts`
    passed.
- Current state:
  - Package exports, generated API docs, subpath export tests, and public type
    boundary tests agree on the current 0.3 public surface.

### 2026-06-05 Broad Hard-Cut Audit And Security Contract Refresh

- Ran the broad final hard-cut audit commands, excluding historical review/spec
  ledgers, for:
  - protected/guard/authRequired/deleted API terms;
  - compatibility/debt terms;
  - deleted public subpaths and advanced MCP subpath usage.
- The remaining old-path hits are classified as generated security contract
  data, source-policy scanners, CLI migration/inventory detectors, custom
  protected-lane docs/tests, negative public export/type assertions, or real
  Nuxt/package compatibility metadata. No unclassified active implementation
  path was found in this pass.
- `CI=true pnpm run check:security:contract` initially failed with generated
  contract drift. Regenerated `security-contract.generated.json` with
  `pnpm run security:contract`.
- The regenerated contract now reflects current lane inventory from the broader
  0.3 cutover, including harness entries that moved from protected/guard to
  authenticated/workspace lanes plus expected line-number drift.
- Verification:
  - `pnpm run security:contract` passed and rewrote
    `security-contract.generated.json`.
  - `CI=true pnpm run check:security:contract` passed after regeneration.
  - `node node_modules/vitest/vitest.mjs run --project=unit --pool=threads --maxWorkers=1 --no-file-parallelism tests/unit/security-contract.test.ts tests/unit/cli-upgrade.test.ts tests/unit/cli-doctor.test.ts tests/unit/functions-defineTrellis.test.ts`
    passed: 4 files / 157 tests.
  - `node node_modules/eslint/bin/eslint.js scripts/lib/security-contract.mjs tests/unit/security-contract.test.ts`
    passed.
  - `node node_modules/oxfmt/bin/oxfmt --check --threads=1 security-contract.generated.json scripts/lib/security-contract.mjs tests/unit/security-contract.test.ts`
    passed.
  - `CI=true pnpm run test:security` passed:
    - source policy;
    - security contract drift check;
    - module build;
    - packed export policy;
    - 25 unit proof files / 265 tests.
- Current state:
  - The generated security contract is current after the cleanup/classification
    passes.
  - The broad old-path audit surface has no newly discovered unclassified
    active implementation path from this pass.

### 2026-06-05 Broad Check Gate

- Ran the full repository check after the operation permission cutover,
  old-path classification cleanup, public-surface alignment audit, and security
  contract refresh.
- Verification:
  - `pnpm run check` passed.
  - The gate covered formatting, lint, repo policy checks, published surface
    checks, security checks, type checks, contract tests, maintained examples,
    CLI doctor fixtures, and starter fixture validation.
- Current state:
  - The broad check gate is green for the current 0.3 worktree state.
  - The full 0.3.0 objective remains active; this entry records the check gate,
    not the end of the refactor.

### 2026-06-05 Testing Replay And MCP Transport Release Verify

- Completed the handover slice by cutting
  `tests/unit/operation-descriptor.test.ts` from operation `guard` fixtures to
  operation `permission` fixtures.
- The release gate exposed real identity-forwarding gaps rather than fixture
  noise:
  - harness public-read allowlisting needed `notes` and `users`;
  - MCP-exposed harness operations needed explicit MCP forwarding transport
    metadata;
  - operation preview calls needed `operation-preview` purpose and replay
    metadata;
  - backend destructive execute needed `operation-execute` purpose and
    confirmation-token-hash JTI redemption;
  - forwarded test callers needed an explicit transport option for MCP-only
    handlers.
- Added `ctx.asCaller(caller, { replayMode, transport, jti })` support in the
  testing helper. The default remains `server`; tests and docs opt into
  `transport: 'mcp'` only for MCP-only handlers.
- Regenerated `security-contract.generated.json` after the identity-forwarding
  and operation-preview hard cutover changes.
- Fixed the release audit by moving the Hono override to the workspace-level
  override source of truth and bumping it from `4.12.18` to `4.12.21`.
- Verification:
  - focused unit checks passed for operation descriptors, Convex server utils,
    function definition, MCP tool definition, security contract, CLI upgrade,
    and CLI doctor coverage;
  - `CI=true pnpm run test:types:contracts` passed;
  - `node scripts/check-doc-links.mjs` passed;
  - focused e2e harness/MCP smoke tests passed;
  - focused Convex testing-package helper test passed;
  - `pnpm audit --prod --audit-level low` passed after the Hono override bump;
  - `pnpm run release:verify` passed.
- Current state:
  - Operation descriptor tests now use permission fixtures.
  - The replay/transport behavior is covered across runtime, MCP, testing, docs,
    and security contract surfaces.
  - The full 0.3.0 objective remains active.

### 2026-06-05 Service Operation Target Allow-List Proof

- Audited the next open architecture item from the handover: service subjects
  must not become ambient backend authority.
- Current runtime already enforces restricted service tables, derived tenant
  scope, service contract metadata, replay mode, acting-for policy, and target
  allow-lists.
- Added the missing runtime invariant coverage for operation-backed targets:
  - a service principal with `allowedOperations: ['sync.allowed']` is rejected
    before handler execution when invoking operation metadata for
    `sync.denied`;
  - the same service principal is allowed when invoking operation metadata for
    `sync.allowed`, even without a broad function-ref allow-list.
- Simplified the service target denial diagnostic so operation-backed handlers
  report the operation id when operation metadata is present.
- Verification:
  - `node node_modules/vitest/vitest.mjs run --project=unit --pool=threads --maxWorkers=1 --no-file-parallelism tests/unit/functions-defineTrellis.test.ts`
    passed: 1 file / 71 tests.
  - `node node_modules/eslint/bin/eslint.js src/runtime/functions/index.ts tests/unit/functions-defineTrellis.test.ts`
    passed.
  - `node node_modules/oxfmt/bin/oxfmt --check --threads=1 src/runtime/functions/index.ts tests/unit/functions-defineTrellis.test.ts`
    passed.
  - `git diff --check -- src/runtime/functions/index.ts tests/unit/functions-defineTrellis.test.ts`
    passed.
- Current state:
  - Service subjects remain table-scoped and target-scoped.
  - Operation-backed service writes now have explicit allow-list proof in
    runtime tests.
  - The full 0.3.0 objective remains active.

### 2026-06-05 Team Workspace Domain Idempotency Hard Cut

- Audited the replay/idempotency recovery item against the maintained
  team-workspace webhook example.
- Removed the split `ensureNotProcessed(...)` / `markProcessed(...)` helper
  shape. That shape made the example read like route-side pre-consumption even
  though the actual write ran inside a Convex mutation.
- Replaced it with `processDomainIdempotentEvent(...)`, a single backend-domain
  helper that:
  - checks the source/event/workspace replay key;
  - runs the domain write;
  - records the processed event in the same Convex mutation transaction.
- Kept `hasProcessedEvent(...)` as a test/read helper for proving replay-key
  behavior without restoring the split write path.
- Added example tests proving:
  - source plus event id is the replay key;
  - a failed domain write does not create a processed-event record;
  - the webhook-created todo path still writes visible workspace data.
- Verification:
  - `pnpm --dir examples/03-team-workspace test` passed: 2 files / 18 tests.
  - `node node_modules/eslint/bin/eslint.js examples/03-team-workspace/convex/auth/idempotency.ts examples/03-team-workspace/convex/features/todos/webhooks.ts examples/03-team-workspace/convex/todos.test.ts`
    passed.
  - `node node_modules/oxfmt/bin/oxfmt --check --threads=1 examples/03-team-workspace/convex/auth/idempotency.ts examples/03-team-workspace/convex/features/todos/webhooks.ts examples/03-team-workspace/convex/todos.test.ts`
    passed.
- Current state:
  - The maintained team-workspace webhook example no longer exposes a split
    check/mark idempotency path.
  - Delivery idempotency remains backend-owned and domain-atomic for that
    example.
  - The full 0.3.0 objective remains active.

### 2026-06-05 MCP Reference Webhook Delivery Idempotency Hard Cut

- Continued the replay/idempotency cleanup on the maintained MCP reference
  webhook example.
- Extracted the inline delivery duplicate check plus delivery insert into
  `createDomainIdempotentRunbook(...)`, keeping the runbook insert and delivery
  record in one Convex mutation transaction.
- Added a regression test proving a failed domain write does not create
  `runbookWebhookDeliveries` state. The test uses a delegated member attempting
  to create a public runbook, which fails the domain permission check before
  delivery state can be recorded.
- Verification:
  - `pnpm --dir examples/07-mcp-reference test` passed: 3 files / 20 tests.
  - `node node_modules/eslint/bin/eslint.js examples/07-mcp-reference/convex/features/runbooks/webhooks.ts examples/07-mcp-reference/test/mcpReference.test.ts`
    passed.
  - `node node_modules/oxfmt/bin/oxfmt --check --threads=1 examples/07-mcp-reference/convex/features/runbooks/webhooks.ts examples/07-mcp-reference/test/mcpReference.test.ts`
    passed.
  - `git diff --check -- examples/07-mcp-reference/convex/features/runbooks/webhooks.ts examples/07-mcp-reference/test/mcpReference.test.ts`
    passed.
- Current state:
  - Both maintained webhook examples now prove backend-domain delivery
    idempotency and failed-domain-write recovery behavior.
  - The full 0.3.0 objective remains active.

### 2026-06-05 Active Debt-Term Audit Noise Cleanup

- Reran the active-source old-path and debt-term audits across `src`, `tests`,
  `examples`, `apps/docs`, `packages`, `scripts`, and `meta/skill`.
- Confirmed the surviving protected/guard/authRequired hits are classified as
  internal protected-lane machinery, custom-guard docs/tests, deleted-API
  negative assertions, security scanners, or migration detectors.
- Removed one generic `compatibility paths` phrase from
  `src/cli/commands/upgrade.ts`; the upgrade command is a pre-0.3 consumer
  migration detector, not a retained old-path alias.
- The remaining debt-term hits in the focused CLI audit are intentional legacy
  detector labels/fixtures plus real Nuxt/package compatibility metadata.
- Verification:
  - `node node_modules/vitest/vitest.mjs run --project=unit --pool=threads --maxWorkers=1 --no-file-parallelism tests/unit/cli-upgrade.test.ts`
    passed: 1 file / 24 tests.
  - `node node_modules/eslint/bin/eslint.js src/cli/commands/upgrade.ts tests/unit/cli-upgrade.test.ts`
    passed.
  - `node node_modules/oxfmt/bin/oxfmt --check --threads=1 src/cli/commands/upgrade.ts tests/unit/cli-upgrade.test.ts`
    passed.
- Current state:
  - The active CLI migration detector no longer contributes generic
    compatibility-term noise to the final cleanup audit.
  - The full 0.3.0 objective remains active.

### 2026-06-05 Security Contract Refresh After Replay Cleanup

- Checked security contract drift after the service-target and webhook
  idempotency hard-cut slices.
- `CI=true pnpm run check:security:contract` initially failed with generated
  contract drift. Regenerated `security-contract.generated.json` with
  `pnpm run security:contract`.
- The regenerated contract captures expected line-number drift from the
  maintained webhook tests and keeps the newer lane/public-read inventory
  current.
- Verified generated Convex files separately:
  - `node scripts/check-convex-generated-drift.mjs` passed with 25 tracked
    `_generated` files and no drift.
- Verification:
  - `pnpm run security:contract` passed and rewrote
    `security-contract.generated.json`.
  - `CI=true pnpm run check:security:contract` passed after regeneration.
  - `node node_modules/vitest/vitest.mjs run --project=unit --pool=threads --maxWorkers=1 --no-file-parallelism tests/unit/security-contract.test.ts`
    passed: 1 file / 2 tests.
  - `CI=true pnpm run test:security` passed:
    - source policy;
    - security contract drift check;
    - module build;
    - packed export policy;
    - 25 unit proof files / 267 tests.
- Current state:
  - The generated security contract is current after the replay/idempotency
    cleanup.
  - The focused security gate is green for the current 0.3 worktree state.
  - The full 0.3.0 objective remains active.

### 2026-06-05 Final Protected/Guard Inventory Classification

- Reran the handover's remaining protected/guard inventory over active source,
  runtime, scripts, examples, starter fixtures, and focused unit tests:
  - `rg -n "query\\.protected|mutation\\.protected|action\\.protected|guard:\\s*|protected\\(previewOf|protected preview|authRequired" tests/unit src/cli src/module-internals src/runtime scripts examples src/cli/starter-fixtures --glob '!dist/**' --glob '!node_modules/**'`
- Classified the surviving hits:
  - `scripts/lib/security-source-policy.mjs`,
    `scripts/lib/security-contract.mjs`, and
    `scripts/check-security-packed-exports.mjs` are intentional scanners and
    generated-contract inputs for deleted/controlled auth surfaces.
  - `src/runtime/functions/index.ts`,
    `src/runtime/functions/define-handler.ts`,
    `src/runtime/functions/define-operation.ts`, and
    `src/runtime/auth/define-guard.ts` are internal lane machinery for the
    surviving custom protected lane and authenticated/workspace sentinels.
  - `tests/unit/functions-defineHandler.test.ts` and
    `tests/unit/functions-defineTrellis.test.ts` are custom protected-lane and
    internal guard-engine runtime coverage.
  - `tests/unit/cli-doctor.test.ts`, `tests/unit/cli-upgrade.test.ts`,
    `tests/unit/eslint-plugin.test.ts`, and
    `tests/unit/cli-add-resource.test.ts` are legacy detector or negative
    generator fixtures.
  - `tests/unit/auth-index.test.ts`, `tests/unit/security-contract.test.ts`,
    and `tests/unit/operation-descriptor.test.ts` are negative public-export,
    contract, or descriptor guard-rejection coverage.
- Rechecked the earlier operation descriptor hit at
  `tests/unit/operation-descriptor.test.ts:183`; it is the deliberate
  `implementOperation(...)` rejection proof for protected-lane `guard`
  metadata, not a stale operation fixture.
- Verification:
  - `node node_modules/oxfmt/bin/oxfmt --check --threads=1 progress_0.3.0.md security-contract.generated.json`
    passed before this ledger entry.
  - `git diff --check` passed before this ledger entry.
- Current state:
  - The active-source protected/guard/authRequired inventory is captured and
    classified for the final hard-cut cleanup acceptance.
  - No stale normal-path protected/guard fixture was found in the focused
    remaining inventory.
  - The full 0.3.0 objective remains active.

### 2026-06-05 Broad Check And Release Verify Gate

- Ran the broad local check gate after the operation-permission cutover,
  service-target cleanup, replay/idempotency cleanup, security contract refresh,
  and final protected/guard inventory classification.
- Ran the release verification gate end-to-end.
- Verification:
  - `pnpm run check` passed:
    - formatting, lint, publish surface, security, types, contracts, CLI smoke,
      maintained example doctor, and starter fixture doctor were green.
  - `pnpm run release:verify` passed:
    - formatting, lint, publish surface, compatibility matrix, types, contracts,
      security, maintained example doctor, starter fixture doctor, full tests,
      e2e, starter fixture typecheck/build, Convex generated drift,
      packed-tarball workspace-reference check, production audit, and final
      build were green.
    - `test:security` remained green with 25 proof files / 267 tests.
    - full `pnpm run test` included 125 unit files / 1167 tests, 20 Convex
      files / 121 tests, 21 Nuxt files / 166 tests, 2 server files / 21 tests,
      2 browser files / 6 tests, and all maintained example suites.
    - `test:e2e` passed: 3 files / 13 tests.
    - starter fixture typecheck and build passed for `public`, `personal`,
      `workspace`, and `workspace-mcp`.
    - `node scripts/check-convex-generated-drift.mjs` passed with 25 tracked
      `_generated` files and no drift.
    - packed-tarball workspace-reference check passed for
      `lupinum-trellis-0.2.0.tgz` and
      `lupinum-trellis-bridge-0.2.0.tgz`.
    - `pnpm audit --prod --audit-level low` reported no known vulnerabilities.
- Current state:
  - The current 0.3.0 worktree passes the broad local and release verification
    gates.
  - Generated `dist/` and pack-check artifacts were produced by the gate runs
    and remain non-source build output.
  - The next release gate is `pnpm run release:pack`.
  - The full 0.3.0 objective remains active.

### 2026-06-05 Release Pack Gate

- Ran the release pack gate after the broad check and release verification gate
  were green.
- Verification:
  - `pnpm run release:pack` passed.
  - The pack script rebuilt the module, devtools client, and CLI, packed both
    workspace packages, and reran the packed export security policy.
  - Tarballs were written to `.pack/`:
    - `.pack/lupinum-trellis-0.2.0.tgz`
    - `.pack/lupinum-trellis-bridge-0.2.0.tgz`
- Current state:
  - `pnpm run check`, `pnpm run release:verify`, and
    `pnpm run release:pack` are green for the current 0.3.0 worktree.
  - `.pack/` and `dist/` are generated release/build artifacts and remain
    non-source output.
  - The full 0.3.0 objective remains active until the final completion audit is
    explicitly closed.

### 2026-06-05 Handover And Final Audit State Refresh

- Reran the handover's final hard-cut audit probes after the broad check,
  release verify, and release pack gates passed.
- Updated `handover_0.3.0.md` so the next developer no longer sees the already
  completed operation-descriptor fixture cutover or broad release gates as the
  immediate next work.
- Updated the phase/proof summary at the top of this ledger so it no longer
  says broader release gates are pending.
- Audit observations:
  - The old-path audit still reports historical planning/source-review files
    such as `SPEC.md`, `auth-review-rfc.md`, `a_target.md`, `summary.md`,
    `handover_0.3.0.md`, `0.3.0.md`, and this ledger. Active production
    surfaces remain covered by the focused classifications already recorded.
  - The active debt-term audit reports release/framework compatibility metadata,
    intentional CLI migration detector labels/fixtures, and HMAC webhook secret
    names; no new active transitional shim or stale normal-path fixture was
    identified.
  - The deleted-subpath audit reports migration detectors, negative dts tests,
    historical notes, and the deliberate `@lupinum/trellis/mcp/advanced`
    standalone custom-tool surface. No active production import of deleted
    `@lupinum/trellis/functions`, `@lupinum/trellis/bridge`, or
    `@lupinum/trellis/backend/advanced` was found.
  - Package metadata and `compatibility.json` still list `0.2.0`, so
    `release:pack` writes `0.2.0` tarballs. That is now called out in the
    handover as a release-approval/versioning decision rather than hidden
    cleanup debt.
- Verification:
  - `rg -n "query\\.protected|mutation\\.protected|action\\.protected|guard:\\s*|authRequired|delegateToUser|readSharedSecretWebhookBody|stampMcpToolSafety|escapeIsolation|trellisUnsafeDb|tool\\.mutation|tool\\.fromOperation" . --glob '!node_modules/**' --glob '!dist/**' --glob '!.pack/**' --glob '!.pack-check/**'`
    ran and the active hits were classified as above.
  - `rg -n "deprecated|compat|legacy|shim|TODO|FIXME|temporary|migration-only|old path|backcompat|backward" src tests examples apps/docs packages scripts --glob '!dist/**'`
    ran and found no new active cleanup target.
  - `rg -n "@lupinum/trellis/bridge|@lupinum/trellis/functions|@lupinum/trellis/backend/advanced|@lupinum/trellis/mcp/advanced" . --glob '!node_modules/**' --glob '!dist/**' --glob '!.pack/**' --glob '!.pack-check/**'`
    ran and found no active production import of deleted subpaths.
  - `rg -n "0\\.3|service|trusted|replay|idempot|forwarding|publicWrite|crossTenant|unsafe|bridge|mcp|operation" src tests examples src/cli apps/docs packages scripts --glob '!dist/**'`
    ran as a broad architecture-term smoke audit; it is intentionally noisy and
    did not produce a focused deletion list.
  - `node node_modules/oxfmt/bin/oxfmt --check --threads=1 handover_0.3.0.md progress_0.3.0.md`
    passed after formatting.
  - `git diff --check -- handover_0.3.0.md progress_0.3.0.md` passed.
- Current state:
  - The handover now points to the final completion audit as the immediate next
    slice.
  - The full 0.3.0 objective remains active; do not mark it complete until the
    release acceptance bullets in `0.3.0.md` are proven item-by-item and the
    version/release-notes decision is resolved.

### 2026-06-05 Release Acceptance Audit Probe

- Started the item-by-item release acceptance audit from `0.3.0.md`.
- Rechecked the stale docs build caveat directly.
- Current acceptance evidence:
  - F-AUTH coverage and P0/P1 regression coverage are represented by the
    security contract, source-policy gate, packed export gate, focused proof
    files, and the broad `test:security` result already recorded above.
  - `pnpm run test:security` exists and passed inside both `pnpm run check` and
    `pnpm run release:verify`.
  - `pnpm run check` includes `test:security`; this was exercised by the broad
    check gate.
  - Public package export exactness and unsafe export absence are covered by
    `check:publish-surface`, `test:security`, the packed export policy, and
    `release:pack`.
  - Maintained examples and starter fixtures passed the production doctor
    checks inside both `pnpm run check` and `pnpm run release:verify`.
  - Docs no longer teaching unsafe trusted forwarding, unconditional
    delegation, shared-secret trusted webhooks, or tool-local MCP safety is
    covered by the source-policy/doc-link/API-surface checks and old-path
    audits already recorded.
  - Nuxt auth runtime tests, replay/idempotency proofs, service subject
    metadata, and consumer MCP/starter migration fixtures are covered by the
    broad `pnpm run release:verify` gate and the focused proof entries above.
- Still not enough to close the full 0.3.0 goal:
  - Package metadata and `compatibility.json` still list `0.2.0`, so release
    artifacts are not versioned as `0.3.0`.
  - Release notes have not been generated in this session.
  - The standalone docs production build failure found by this probe is resolved
    by the later docs production build gate fix.
- Initial docs build probe:
  - `pnpm --dir apps/docs build` failed before Vite build.
  - `nuxt-og-image` reported missing `@resvg/resvg-js`.
  - Nuxt Content failed to load the `better-sqlite3` native binding.
  - At the time of this failed probe, `apps/docs/package.json` declared
    `better-sqlite3`, but `pnpm-workspace.yaml` blocked
    `allowBuilds.better-sqlite3`, and `@resvg/resvg-js` was not installed.
- Current state:
  - The release acceptance audit has direct positive evidence for the security,
    public-surface, examples/starters, auth, replay, service, and consumer
    migration gates.
  - The full 0.3.0 objective remains active because version metadata,
    release-notes generation, and final release approval are not resolved.

### 2026-06-05 Docs Production Build Gate Fix

- Closed the standalone docs production build caveat from the release acceptance
  audit probe.
- Added the missing docs-app `@resvg/resvg-js` dependency because
  `nuxt-og-image` needs it for Satori/resvg rendering.
- Changed the workspace build policy for `better-sqlite3` from blocked to
  allowed so Nuxt Content can load/build the native SQLite binding declared by
  `apps/docs`.
- Rebuilt `better-sqlite3` locally after changing the build policy.
- Verification:
  - `pnpm --dir apps/docs add @resvg/resvg-js@^2.6.0` completed and updated
    `apps/docs/package.json` plus `pnpm-lock.yaml`.
  - `pnpm rebuild better-sqlite3` completed.
  - `pnpm --dir apps/docs build` passed; Nuxt Content processed 3 collections /
    74 files, Nitro prerendered 226 routes, and the build completed. The run
    still emitted non-fatal sourcemap/chunk-size/icon-load warnings.
  - `pnpm run check:compatibility-matrix` passed.
  - `pnpm run audit:prod` passed with no known vulnerabilities.
  - `pnpm run check` passed after the docs dependency/build-policy fix.
  - `pnpm run release:verify` passed after the docs dependency/build-policy
    fix:
    - formatting, lint, publish surface, compatibility matrix, docs API surface,
      docs links, types, contracts, security, maintained example doctor,
      starter fixture doctor, full tests, e2e, starter fixture typecheck/build,
      Convex generated drift, packed-tarball workspace-reference check,
      production audit, and final build were green;
    - full `pnpm run test` included 125 unit files / 1167 tests, 20 Convex
      files / 121 tests, 21 Nuxt files / 166 tests, 2 server files / 21 tests,
      and 2 browser files / 6 tests;
    - `test:e2e` passed: 3 files / 13 tests;
    - packed-tarball workspace-reference check still passed for
      `lupinum-trellis-0.2.0.tgz` and
      `lupinum-trellis-bridge-0.2.0.tgz`.
- Current state:
  - The docs production build is no longer a 0.3.0 release-audit blocker in
    this checkout.
  - The full 0.3.0 objective remains active because package metadata still
    targets `0.2.0` and release notes have not been generated.

### 2026-06-05 0.3.0 Release Metadata And Final Gate Audit

- Cut release metadata over to `0.3.0`:
  - root `package.json`;
  - `packages/trellis-bridge/package.json`;
  - `compatibility.json` release stack;
  - `MAINTAINING.md` release runbook example.
- Ran `pnpm run release:notes`, then replaced the branch-compare draft with a
  curated `CHANGELOG.md` `v0.3.0` entry covering the hard-cut security
  foundation release.
- Verified packed package metadata:
  - `.pack/lupinum-trellis-0.3.0.tgz` contains
    `@lupinum/trellis@0.3.0`;
  - `.pack/lupinum-trellis-bridge-0.3.0.tgz` contains
    `@lupinum/trellis-bridge@0.3.0`;
  - the bridge package peer dependency on `@lupinum/trellis` is `^0.3.0`.
- Verification:
  - stale metadata audit found no remaining active Trellis `0.2.0` release
    metadata; remaining `0.2.0` hits are historical changelog entries or
    third-party dependency versions.
  - `pnpm run check:compatibility-matrix` passed.
  - `node node_modules/oxfmt/bin/oxfmt --check --threads=1 CHANGELOG.md MAINTAINING.md compatibility.json package.json packages/trellis-bridge/package.json`
    passed.
  - `pnpm run check:publish-surface` passed.
  - `pnpm run release:pack` passed and wrote 0.3.0 tarballs.
  - `node scripts/check-pack-workspace-refs.mjs` passed independently against
    the 0.3.0 tarballs.
  - `pnpm run release:verify` passed after the 0.3.0 metadata cutover:
    - formatting, lint, publish surface, compatibility matrix, docs API
      surface, docs links, types, contracts, security, maintained example
      doctor, starter fixture doctor, full tests, e2e, starter fixture
      typecheck/build, Convex generated drift, packed-tarball
      workspace-reference check, production audit, and final build were green;
    - `test:security` passed with 25 proof files / 267 tests;
    - full `pnpm run test` included 125 unit files / 1167 tests, 20 Convex
      files / 121 tests, 21 Nuxt files / 166 tests, 2 server files / 21 tests,
      2 browser files / 6 tests, and all maintained example suites;
    - `test:e2e` passed: 3 files / 13 tests;
    - starter fixture typecheck and build passed for `public`, `personal`,
      `workspace`, and `workspace-mcp`;
    - packed-tarball workspace-reference check passed for
      `lupinum-trellis-0.3.0.tgz` and
      `lupinum-trellis-bridge-0.3.0.tgz`;
    - `pnpm audit --prod --audit-level low` reported no known vulnerabilities.
- Current state:
  - The 0.3.0 refactor and release-prep acceptance evidence is complete in
    this checkout.
  - Live publish/tag/release approval remains maintainer-owned runbook work and
    was not run from this agent session.
