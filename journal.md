# Trellis RFC 0012 Implementation Journal

Date: 2026-06-17
Branch: `hardening`
Goal: implement RFC 0012 as a clean-cut Trellis app-framework refactor.

## Operating Principles

- Clean cut for unreleased/internal paths: delete old authoring paths after the
  replacement passes tests.
- Do not keep global and local security policy as parallel sources of truth.
- Keep Phase 0 narrow before touching operations, bridge, or broad mutation
  write capabilities.
- Record decisions, blockers, and verification here before each commit.

## Phase 0 Scope

1. Add required stable handler `id` metadata.
2. Add `query.session` for access/session discovery.
3. Add handler-local `reads` for `query.public`.
4. Remove global `public.readTables` as the maintained authoring path.
5. Add app-level test helper path that hides forwarding ceremony for ordinary
   calls.
6. Update starters/examples/docs to the new path.

## Decisions

- D001: `query.session` is intentionally narrow. It calls app identity/access
  helpers but does not expose arbitrary `ctx.db` in Phase 0.
- D002: `reads` is Phase 0 only for public queries. Mutation write capabilities
  stay out of scope until a focused prototype proves ergonomics.
- D003: `id` is the canonical Trellis handler subject. Existing
  `identityForwardingFunctionRef` should be removed from normal app authoring,
  not kept as a second field.
- D004: Static tooling must understand the maintained authoring shape, not just
  runtime internals. Doctor/public-surface inventory now recognizes operation
  projections declared as `query.public({ ...operation, reads })`, and module
  validation recognizes `query.session` as a real query export.
- D005: Session/access context resolves through the Trellis runtime
  `ctx.appIdentity()` instead of calling DB-backed helpers with the handler
  context. This keeps `query.session` handlers DB-less while preserving normal
  app identity resolution.
- D006: Global `public.readTables` is deleted from the runtime authoring
  surface. Public read authority has one source of truth: handler-local
  `query.public({ reads })` metadata.
- D007: `ctx.asUser(...)` and `ctx.asService(...)` are convenience vocabulary
  on top of the existing `ctx.asCaller(...)` trusted test transport. They do
  not introduce a second forwarding implementation.
- D008: Bridge/component tests may use `ctx.asCaller(..., { targetFunctionRef,
signedArgs })` when the internal Convex bridge wrapper differs from the
  trusted public handler id or signs a narrower payload. This is an advanced
  testing override, not a replacement for normal `asUser(...)`/`asService(...)`
  app tests.
- D009: Bridge forwarding issuer, audience, replay mode, TTL, jti, and key
  validation belong to `@lupinum/trellis-bridge`. App/root wrappers may choose
  an explicit `signedArgs` verification payload, but they should not construct
  raw identity-forwarding envelopes.
- D010: Raw identity-forwarding envelope construction is not an app-surface
  escape hatch. Production-copyable examples, starters, and docs should fail
  source policy if they import or call `createIdentityForwardingEnvelopeArgs`.
- D011: Generated MCP workspace resource operations should use
  `workspaceScope()` and `ctx.workspaceId`. `appIdentity.workspaceId` remains an
  authorization fact, not the value copied into generated tenant writes.
- D012: Generated app tests should use Trellis test principals (`asUser`,
  seeded tenant users, or `asService`) instead of raw Convex identity helpers.
- D013: Workspace lanes own trusted tenant context projection. Workspace
  handlers should read `ctx.workspaceId`; `appIdentity.workspaceId` remains the
  identity fact used to authorize and derive that context, not the field copied
  throughout generated resource code.
- D014: Auth-identity tests and trusted-forwarding tests are separate concepts.
  Use `ctx.asAuthUser(...)` for handlers that intentionally read Convex auth
  identity; keep `ctx.asUser(...)` for signed Trellis caller forwarding.
- D015: Maintained example tests should not call `ctx.raw.withIdentity(...)`
  directly. Use `ctx.asAuthUser(...)` for Convex auth identity, `ctx.asUser(...)`
  for trusted user forwarding, and `ctx.asCaller(...)` for custom principals.
- D016: Raw identity-forwarding envelope construction is protocol internals and
  focused test machinery, not a backend barrel API. App-facing code should use
  `createTestContext(...)`, bridge helpers, MCP callers, or server helpers
  instead of importing raw envelope builders from `@lupinum/trellis/backend`.
- D017: MCP tool authoring should import operation ref helpers from
  `@lupinum/trellis/mcp`. The backend entrypoint may still expose backend
  operation primitives, but MCP docs, examples, generators, and fixtures should
  teach the MCP surface. Bridge forwarding signs bridge envelopes inside
  `@lupinum/trellis-bridge` rather than re-opening raw backend envelope
  construction.
- D018: Beginner root runtime setup belongs on `@lupinum/trellis/app`.
  `defineTrellis` remains one implementation from the functions runtime, but
  starter fixtures and getting-started docs should not force day-one users to
  import the backend barrel before they have advanced backend needs.
- D019: Maintained example root runtime setup should follow the same beginner
  entrypoint as starters and docs. Keep caller, acting-for, delegation, unsafe,
  and other advanced primitives on `@lupinum/trellis/backend`, but do not teach
  `defineTrellis` from the backend barrel in production-copyable app setup.

## Progress

- 2026-06-17: Finalized RFC 0012 as a greenfield clean-cut proposal.
- 2026-06-17: Started Phase 0 runtime slice. The first code increment will add
  handler-local `reads` metadata for `query.public` and a narrow `query.session`
  lane, using the existing public DB facade instead of adding a second policy
  engine.
- 2026-06-17: Implemented initial runtime support:
  - `query.session` lane exists and rejects `reads`.
  - session handlers do not receive raw `ctx.db`.
  - `query.public` runtime requires handler-local `reads`.
  - `reads` are passed into the existing public DB facade.
  - focused unit tests migrated for the new public read boundary.
- 2026-06-17: Migrated greenfield starter fixtures:
  - public starter list query now declares `reads: ['todos']`.
  - workspace and workspace-MCP access context now use `query.session`.
  - workspace-MCP key validation now declares `reads: ['mcpKeys', 'users']`.
  - stale CLI patcher for mutating global `public.readTables` was deleted.
- 2026-06-17: Updated scanner/tooling support for the new starter shape:
  - public-surface codegen now extracts operation projections from explicit
    capability objects.
  - Convex function path validation now includes `session`, `authenticated`,
    and `workspace` lanes.
- 2026-06-17: Migrated maintained examples and harness off global public reads:
  - example/harness access context now uses `query.session` or a DB-less
    session handler.
  - public data queries declare local `reads`; bridge/probe wrappers declare
    `reads: []`.
  - starter workspace identities now model signed-in actors separately from
    workspace lane enforcement.
- 2026-06-17: Removed global `public.readTables` from the runtime surface and
  docs. Security contract now records handler-local `publicReads` with
  file/line/export metadata.
- 2026-06-17: Resolved the broad-check dependency blocker by pinning the
  workspace to a single `@nuxt/schema@4.4.8` via pnpm overrides. This removes
  the duplicate Nuxt schema type graph instead of adding local type casts.
- 2026-06-17: Fixed two broad-gate findings from the clean-cut migration:
  - harness access-context debug metadata now uses the resolved app identity
    source of truth instead of a stale `user` local;
  - example 06 agency dashboard declares the `users` table it reads while
    resolving the authenticated agency actor.
- 2026-06-17: Extended the maintained `createTestContext(...).asCaller(...)`
  helper to cover service/webhook acting-for calls with purpose, replay key,
  replay target, key id, and transport options. Example 03 no longer needs a
  local function-ref extractor or direct identity-forwarding envelope signing
  for its webhook delegation tests.
- 2026-06-17: Started stable handler-id migration:
  - direct structured handlers can now use `id` as the signed forwarding target;
  - runtime errors point authors at `id` instead of
    `identityForwardingFunctionRef`;
  - maintained direct handler examples/harness probes were migrated to `id`.
    Operation definitions still retain execute-target metadata for now because
    their existing `id` is the operation id, not the Convex execute function
    target.
- 2026-06-17: Renamed app-authored operation execute target metadata to
  `executeFunctionRef`:
  - maintained examples, harness operations, docs, CLI resource generation, and
    the security contract scanner no longer use
    `identityForwardingFunctionRef` for operation definitions;
  - structured handlers now prefer `executeFunctionRef` before falling back to
    projection metadata or handler `id`, so operation ids and Convex execute
    paths stay separate.
- 2026-06-17: Tightened the operation execute-target cleanup:
  - `@lupinum/trellis/app` operation shapes now expose `executeFunctionRef`
    instead of the old forwarding field;
  - destructive operation runtime tests use `executeFunctionRef` for operation
    execute targets.
- 2026-06-17: Removed the old operation-definition fallback:
  - `defineOperation(...)` omits the direct-handler forwarding field from its
    accepted operation shape;
  - operation preview projection metadata is sourced only from
    `executeFunctionRef`.
- 2026-06-17: Removed the old direct-handler authoring field from structured
  handlers:
  - service/direct-handler tests now use stable `id` as the callable verifier
    target;
  - structured handler definitions no longer expose
    `identityForwardingFunctionRef`;
  - lower runtime wrappers pass a computed internal verifier target into the
    Convex builder without exposing it as normal handler authoring.
- 2026-06-17: Renamed the remaining runtime-internal verifier target from the
  old public-looking forwarding field to `identityForwardingTarget`:
  - app authors now have two explicit sources of truth: handler `id` for normal
    callable targets and operation `executeFunctionRef` for execute targets;
  - destructive preview confirmation no longer accepts a hidden legacy preview
    path override and records preview paths from projection metadata or handler
    `id`;
  - service access checks read the same internal verifier target as identity
    forwarding instead of carrying a parallel old field.
- 2026-06-17: Added runtime-local structured handler id validation:
  - blank provided ids fail immediately;
  - duplicate ids fail across query, mutation, action, internal, and transport
    structured builders within one `defineTrellis(...)` runtime;
  - the stricter "id required everywhere" cut remains a separate migration
    because it intentionally touches low-level unit fixtures and docs snippets.
- 2026-06-17: Made structured lane handler ids mandatory:
  - public, session, protected, authenticated, workspace, transport, and action
    lane builders now require a non-empty `id` at the type and runtime boundary;
  - operation previews derive `${operation.id}:preview` from the canonical
    operation id, avoiding a second app-authored preview id;
  - maintained harness and canonical examples were migrated to explicit stable
    ids so type tests exercise the intended authoring shape.
- 2026-06-17: Cleaned up the remaining authoring-shape drift:
  - workspace starter permission-context fixtures now register
    `defineAccessContext(...)` through `query.session({ ...definition, id })`;
  - Example 03 access context and Example 08 bridge-facing host wrappers carry
    stable handler ids;
  - docs snippets now show mandatory `id` metadata, public `reads`, and
    `query.session(...)` for access context instead of the removed public access
    context wording;
  - generated API-surface docs now describe handler-local public reads instead
    of the removed global public table list.
- 2026-06-17: Updated agent-facing reference notes:
  - backend/auth skill guidance now names `executeFunctionRef` for operation
    transport projections;
  - review and sprint planning notes now describe stable handler ids and
    handler-local public reads instead of removed legacy fields.
- 2026-06-17: Simplified access-context authoring:
  - `defineAccessContext({ id, ... })` now returns a complete structured handler
    definition with stable id metadata;
  - maintained examples, starter fixtures, docs, and type tests no longer need
    `query.session({ ...defineAccessContext(...), id })` spread wrappers.
- 2026-06-18: Simplified the Example 07 app-test forwarding path:
  - ordinary app tests now use `ctx.asCaller(...).query/mutation(...)` helpers
    for user, delegated service, and delegated MCP access-context calls instead
    of constructing signed identity-forwarding envelopes by hand;
  - direct public runbook handlers now declare stable ids, keeping the example
    aligned with the mandatory structured-handler id rule.
- 2026-06-18: Added test-client vocabulary for common principals:
  - `createTestContext(...)` now exposes typed `asUser(...)` and
    `asService(...)` helpers backed by the existing trusted forwarding path;
  - Example 03 and Example 07 delegated webhook tests now read as service calls
    instead of generic caller construction.
- 2026-06-18: Aligned testing docs and agent guidance with named test
  principals:
  - ordinary trusted user/service tests teach `asUser(...)` and
    `asService(...)`;
  - `asCaller(...)` remains documented for custom principal shapes such as MCP
    agents.
- 2026-06-18: Added source-policy acceptance gates for deleted RFC authoring
  surfaces:
  - production-copyable source now rejects `identityForwardingFunctionRef`;
  - production-copyable source now rejects global `readTables` authoring.
- 2026-06-18: Simplified Example 08 bridge tests:
  - component mini CMS tests no longer import
    `createIdentityForwardingEnvelopeArgs`;
  - `ctx.asCaller(...)` now supports advanced bridge target and signed-args
    overrides so tests can exercise the bridge without constructing envelopes.
- 2026-06-18: Added a source-policy acceptance gate for maintained example
  tests:
  - example tests now fail policy if they import or call
    `createIdentityForwardingEnvelopeArgs`;
  - bridge/component production code remains outside this specific test-policy
    ban until the bridge API can fully own root-wrapper forwarding.
- 2026-06-18: Moved Example 08 production bridge forwarding onto the bridge
  helper:
  - `createBridgeForwardingArgs(...)` now owns default bridge key resolution and
    accepts an explicit `signedArgs` payload for forwarding-only wrapper
    verification;
  - Example 08 no longer imports `createIdentityForwardingEnvelopeArgs` or
    duplicates bridge issuer, audience, replay, and key policy;
  - a focused bridge unit test covers the explicit verification-payload path.
- 2026-06-18: Promoted the raw-envelope cleanup to a production-copyable source
  policy:
  - examples, starter fixtures, and docs now fail policy on
    `createIdentityForwardingEnvelopeArgs`;
  - low-level runtime and focused protocol tests remain the only places where
    raw forwarding primitives should appear.
- 2026-06-18: Cut beginner destructive-operation docs over to the app operation
  builder:
  - destructive guide and call-patterns examples now teach
    `operation.destructive(...)` from `@lupinum/trellis/app`;
  - remaining `defineOperation(...)` mentions are reference/advanced notes, not
    the copied beginner path;
  - docs unit coverage now keeps those beginner pages on the app operation
    builder.
- 2026-06-18: Tightened generated MCP workspace resource operations:
  - generated create/remove operations now import and declare
    `workspaceScope()`;
  - generated tenant inserts use `ctx.workspaceId` instead of
    `appIdentity.workspaceId!`;
  - the 0.2 implementation note no longer lists generic resource generation as
    backend-first drift.
- 2026-06-18: Simplified generated personal resource tests:
  - generated personal resource tests now call `ctx.asUser({ authKey })`;
  - new app test templates no longer copy `ctx.raw.withIdentity(...)` for
    ordinary user calls.
- 2026-06-18: Promoted workspace lanes to a typed tenant context:
  - workspace lane handlers now receive trusted `ctx.workspaceId` after
    `appIdentity.workspaceId` is resolved and authorized;
  - generated workspace resource list/create handlers use `ctx.workspaceId`
    instead of repeating `appIdentity.workspaceId!`;
  - runtime and CLI generator tests cover the lane projection and generated
    tenant field usage.
- 2026-06-18: Added explicit auth-identity test vocabulary:
  - `createTestContext(...)` now exposes `asAuthUser(...)` for handlers that
    read Convex auth identity through `getAuth(ctx)`;
  - Example 02, the Example 03 onboarding test, Example 06, Example 07
    onboarding flows, and Example 08 browser-auth flows no longer copy
    `ctx.raw.withIdentity(...)`;
  - testing docs and agent guidance distinguish Convex auth identity from
    trusted Trellis caller forwarding.
- 2026-06-18: Added source-policy coverage for raw Convex identity drift in
  maintained example tests:
  - example tests now fail policy on `ctx.raw.withIdentity(...)`;
  - raw identity remains available inside Trellis testing helpers and low-level
    protocol tests, not production-copyable examples.
- 2026-06-18: Removed the last runtime-code reference to the deleted
  `identityForwardingFunctionRef` operation field. The operation type now omits
  only the current `guard` field because structured handlers no longer expose
  the old forwarding field.
- 2026-06-18: Removed raw forwarding envelope construction from the backend
  barrel:
  - `@lupinum/trellis/backend` no longer exports
    `createIdentityForwardingEnvelopeArgs`;
  - the harness test helper now imports the raw protocol helper from internal
    source instead of teaching the backend barrel path;
  - source policy and backend export tests keep raw envelope construction out
    of the backend entrypoint.

## Blockers

- No active blocker for the current Phase 0 slice.

## Verification Log

- RFC-only changes: no tests run yet.
- 2026-06-17: `pnpm exec vitest run --project=unit tests/unit/functions-defineTrellis.test.ts tests/unit/functions-defineTrellis-service-access.test.ts tests/unit/auth-access-context.test.ts` passed.
- 2026-06-17: `pnpm exec tsc -p tsconfig.types.json --noEmit` passed.
- 2026-06-17: `pnpm run build:cli` passed.
- 2026-06-17: `pnpm exec vitest run --project=unit tests/unit/module-validation.test.ts tests/unit/public-surface-codegen.test.ts tests/unit/functions-defineTrellis.test.ts tests/unit/functions-defineTrellis-service-access.test.ts tests/unit/auth-access-context.test.ts tests/unit/cli-doctor.test.ts tests/unit/cli-add-resource.test.ts` passed.
- 2026-06-17: `pnpm run build:module` passed.
- 2026-06-17: `pnpm --dir examples/04-saas-platform typecheck:tests`, `pnpm --dir examples/05-visibility-access typecheck:tests`, and `pnpm --dir examples/06-multi-workspace typecheck:tests` passed.
- 2026-06-17: `pnpm --dir examples/03-team-workspace test`, `pnpm --dir examples/07-mcp-reference test`, and `pnpm --dir examples/08-component-mini-cms test` passed.
- 2026-06-17: `pnpm exec vitest run --project=unit tests/unit/cli-doctor.test.ts tests/unit/cli-add-resource.test.ts tests/unit/phase0-starter-manifest.test.ts` passed.
- 2026-06-17: `pnpm exec vitest run --project=unit tests/unit/functions-defineTrellis.test.ts tests/unit/functions-defineTrellis-service-access.test.ts tests/unit/security-contract.test.ts` passed.
- 2026-06-17: `pnpm run check:docs:api-surface` and `pnpm run check:security:contract` passed.
- 2026-06-17: `pnpm run check` passed format, docs links, repo policy,
  compatibility, source lint, test lint, and example lint, then failed at
  `check:publish-surface` on the `@nuxt/schema` 4.4.7/4.4.8 type split.
- 2026-06-17: `pnpm why @nuxt/schema` now reports one version,
  `@nuxt/schema@4.4.8`, after the workspace override.
- 2026-06-17: `pnpm run check:publish-surface` passed after the Nuxt schema
  alignment.
- 2026-06-17: `pnpm --dir examples/06-multi-workspace test` passed after
  adding `users` to the agency dashboard public read inventory.
- 2026-06-17: `pnpm run check` passed end to end after the Nuxt schema
  alignment, harness debug fix, example 06 read inventory fix, and regenerated
  security contract.
- 2026-06-17: `pnpm exec tsc -p tsconfig.types.json --noEmit`,
  `pnpm --dir examples/03-team-workspace test`, and
  `pnpm exec vitest run --project=unit tests/unit/package-subpath-exports.test.ts`
  passed for the expanded testing helper.
- 2026-06-17: `pnpm exec vitest run --project=unit tests/unit/functions-defineTrellis.test.ts tests/unit/functions-defineTrellis-service-access.test.ts`,
  `pnpm exec tsc -p tsconfig.types.json --noEmit`, and
  `pnpm --dir examples/07-mcp-reference test` passed for the direct-handler
  stable `id` forwarding slice.
- 2026-06-17: `pnpm exec tsc -p tsconfig.types.json --noEmit`,
  `pnpm exec vitest run --project=unit tests/unit/functions-defineTrellis.test.ts tests/unit/functions-defineTrellis-service-access.test.ts tests/unit/security-contract.test.ts`,
  `pnpm run check:docs:api-surface`, `pnpm run check:security:contract`,
  `pnpm run build:module`, `pnpm --dir examples/03-team-workspace test`,
  `pnpm --dir examples/04-saas-platform typecheck:tests`,
  `pnpm --dir examples/05-visibility-access typecheck:tests`,
  `pnpm --dir examples/07-mcp-reference test`, and
  `pnpm --dir examples/08-component-mini-cms test` passed for the operation
  `executeFunctionRef` slice.
- 2026-06-17: `pnpm run check` passed end to end after the operation
  `executeFunctionRef` migration and structured-handler forwarding fallback
  fix.
- 2026-06-17: `pnpm exec tsc -p tsconfig.types.json --noEmit` and
  `pnpm exec vitest run --project=unit tests/unit/functions-defineTrellis.test.ts`
  passed after migrating app operation shape/tests to `executeFunctionRef`.
- 2026-06-17: `pnpm exec tsc -p tsconfig.types.json --noEmit` and
  `pnpm exec vitest run --project=unit tests/unit/functions-defineTrellis.test.ts tests/unit/security-contract.test.ts`
  passed after removing the legacy operation-definition fallback.
- 2026-06-17: `pnpm exec tsc -p tsconfig.types.json --noEmit`,
  `pnpm exec vitest run --project=unit tests/unit/functions-defineTrellis.test.ts tests/unit/functions-defineTrellis-service-access.test.ts tests/unit/security-contract.test.ts`,
  `pnpm run check:security:contract`, `pnpm run check:docs:api-surface`,
  `pnpm run check:publish-surface`, and `pnpm run test:types` passed after
  removing the old direct-handler authoring field.
- 2026-06-17: `pnpm exec tsc -p tsconfig.types.json --noEmit`,
  `pnpm exec vitest run --project=unit tests/unit/functions-defineTrellis.test.ts tests/unit/functions-defineTrellis-service-access.test.ts tests/unit/security-contract.test.ts`,
  `pnpm run check:security:contract`, `pnpm run check:docs:api-surface`,
  `pnpm run check:publish-surface`, and `pnpm run test:types` passed after
  renaming the runtime-internal verifier target to `identityForwardingTarget`.
- 2026-06-17: `pnpm exec tsc -p tsconfig.types.json --noEmit`,
  `pnpm exec vitest run --project=unit tests/unit/functions-defineTrellis.test.ts tests/unit/functions-defineTrellis-service-access.test.ts tests/unit/security-contract.test.ts`,
  `pnpm run check:security:contract`, `pnpm run check:publish-surface`, and
  `pnpm run test:types` passed after adding runtime-local duplicate handler id
  validation.
- 2026-06-17: `pnpm exec tsc -p tsconfig.types.json --noEmit`,
  `pnpm exec vitest run --project=unit tests/unit/functions-defineTrellis.test.ts tests/unit/functions-defineTrellis-service-access.test.ts`,
  `pnpm exec vitest run --project=unit tests/unit/functions-defineTrellis.test.ts tests/unit/functions-defineTrellis-service-access.test.ts tests/unit/security-contract.test.ts`,
  `pnpm run check:publish-surface`, `pnpm run test:types`,
  `pnpm run security:contract`, `pnpm run check:security:contract`,
  `pnpm run format:check`, and `git diff --check` passed after making
  structured lane handler ids mandatory.
- 2026-06-17: Initial
  `pnpm exec vitest run --project=unit tests/unit/phase0-starter-manifest.test.ts tests/unit/cli-doctor.test.ts tests/unit/cli-add-resource.test.ts`
  failed because the built CLI fixture directory was missing. After
  `pnpm run build:cli`, the same unit command passed.
- 2026-06-17: `pnpm --dir examples/03-team-workspace test`,
  `pnpm --dir examples/08-component-mini-cms test`,
  `pnpm exec tsc -p tsconfig.types.json --noEmit`, `pnpm run test:types`,
  `pnpm run check:docs:api-surface`, `pnpm run check:docs:links`,
  `pnpm run format:check`, `pnpm run security:contract`,
  `pnpm run check:security:contract`, and `git diff --check` passed after
  cleaning up remaining starter/example/docs authoring-shape drift.
- 2026-06-17: `rg -n "identityForwardingFunctionRef|public table reads|configured public read table list|public\\.readTables|readTables" meta/skill library-review-state.md sprint-plan.md apps/docs/content scripts src/cli/starter-fixtures examples --glob '!dist/**' --glob '!node_modules/**'`
  returned no matches after the agent-facing reference cleanup.
- 2026-06-17: `pnpm exec vitest run --project=unit tests/unit/auth-access-context.test.ts tests/unit/module-validation.test.ts tests/unit/functions-defineTrellis.test.ts`,
  `pnpm exec tsc -p tsconfig.types.json --noEmit`,
  `pnpm run test:types:examples:canonical`, `pnpm run test:types`,
  `pnpm run check:docs:links`, `pnpm run check:security:contract`,
  `pnpm run format:check`, and `git diff --check` passed after moving stable
  access-context ids into `defineAccessContext(...)`.
- 2026-06-18: Initial `pnpm --dir examples/07-mcp-reference test` failed while
  migrating the test helpers because direct public runbook handlers lacked ids
  and the delegated MCP access-context helper used an unsupported transport.
  After fixing both, `pnpm --dir examples/07-mcp-reference test` passed.
- 2026-06-18: Initial `pnpm run check:security:contract` failed because the new
  Example 07 handler ids changed generated metadata. After
  `pnpm run security:contract`, `pnpm run check:security:contract`,
  `pnpm run format:check`, and `git diff --check` passed.
- 2026-06-18: `pnpm exec tsc -p tsconfig.types.json --noEmit` passed after
  adding `asUser(...)`/`asService(...)` type coverage.
- 2026-06-18: Initial `pnpm --dir examples/03-team-workspace test` failed
  because the example imports `@lupinum/trellis/testing` from the built package
  surface and `dist` had not been rebuilt. `pnpm run test:types` rebuilt the
  module and passed; rerunning `pnpm --dir examples/03-team-workspace test` and
  `pnpm --dir examples/07-mcp-reference test` then passed.
- 2026-06-18: `pnpm run check:docs:api-surface` and
  `pnpm run check:publish-surface` passed for the testing helper surface.
- 2026-06-18: `pnpm run check:docs:links`,
  `pnpm run check:docs:api-surface`, `pnpm run format:check`, and
  `git diff --check` passed after updating the testing docs for named
  principal helpers.
- 2026-06-18: `pnpm run check:security:source-policy` passed after adding the
  deleted-authoring source policies. Initial `pnpm run check:security:contract`
  failed due expected generated policy-contract drift; after
  `pnpm run security:contract`, `pnpm run check:security:contract`,
  `pnpm exec vitest run --project=unit tests/unit/security-contract.test.ts`,
  `pnpm run format:check`, and `git diff --check` passed.
- 2026-06-18: Initial `pnpm --dir examples/08-component-mini-cms test` failed
  while moving bridge tests to `ctx.asCaller(...)`: first because the built
  package surface was stale, then because bridge wrappers validate a public
  target id and sign an empty bridge payload. After adding `targetFunctionRef`
  and `signedArgs`, `pnpm run build:module`,
  `pnpm --dir examples/08-component-mini-cms test`,
  `pnpm exec tsc -p tsconfig.types.json --noEmit`, `pnpm run test:types`,
  `pnpm run check:docs:api-surface`, `pnpm run check:security:contract`,
  `pnpm run format:check`, and `git diff --check` passed.
- 2026-06-18: `pnpm run check:security:source-policy` passed after adding the
  maintained-example-test raw-envelope policy. Initial
  `pnpm run check:security:contract` failed due expected generated
  policy-contract drift; after `pnpm run security:contract`,
  `pnpm run check:security:contract`, and
  `pnpm exec vitest run --project=unit tests/unit/security-contract.test.ts`
  passed.
- 2026-06-18: Initial `pnpm --dir examples/08-component-mini-cms test` failed
  after moving Example 08 onto `createBridgeForwardingArgs(...)` because the
  app passed the bridge key resolver as a key-input callback. The helper now
  resolves default bridge keys internally; after that,
  `pnpm --dir examples/08-component-mini-cms test`, `pnpm run test:types`,
  `pnpm run build:module`, `pnpm run check:publish-surface`,
  `pnpm run check:docs:api-surface`, `pnpm run check:security:source-policy`,
  and `pnpm exec vitest run --project=unit tests/unit/create-component-bridge.test.ts`
  passed. `pnpm run check:security:contract` drifted from Example 08 line
  changes and was regenerated with `pnpm run security:contract`.
- 2026-06-18: `pnpm run check:security:source-policy` and
  `pnpm exec vitest run --project=unit tests/unit/security-contract.test.ts`
  passed after adding the production-copyable raw-envelope policy. The security
  contract was regenerated with `pnpm run security:contract`.
- 2026-06-18: `rg -n "defineOperation\\(" apps/docs/content/docs` only returns
  reference/advanced mentions after updating beginner destructive-operation
  examples to `operation.destructive(...)`.
- 2026-06-18: `pnpm exec vitest run --project=unit tests/unit/cli-add-resource.test.ts`,
  `pnpm exec tsc -p tsconfig.types.json --noEmit`, and
  `pnpm run check:security:source-policy` passed after moving generated MCP
  workspace resource operations onto `workspaceScope()`.
- 2026-06-18: `pnpm exec vitest run --project=unit tests/unit/cli-add-resource.test.ts`
  and `pnpm exec tsc -p tsconfig.types.json --noEmit` passed after moving
  generated personal resource tests onto `ctx.asUser(...)`.
- 2026-06-18: `pnpm exec vitest run --project=unit tests/unit/functions-defineTrellis.test.ts tests/unit/cli-add-resource.test.ts`
  and `pnpm exec tsc -p tsconfig.types.json --noEmit` passed after promoting
  workspace lanes to a typed `ctx.workspaceId` context.
- 2026-06-18: `pnpm --dir examples/02-auth-todo test`,
  `pnpm exec tsc -p tsconfig.types.json --noEmit`, `pnpm run build:module`,
  `pnpm run check:docs:api-surface`, `pnpm run check:security:source-policy`,
  and `pnpm run test:types` passed after adding `asAuthUser(...)`.
- 2026-06-18: `pnpm --dir examples/03-team-workspace test` and
  `pnpm exec tsc -p tsconfig.types.json --noEmit` passed after moving the
  Example 03 onboarding test onto `ctx.asAuthUser(...)`.
- 2026-06-18: `pnpm --dir examples/06-multi-workspace test` and
  `pnpm exec tsc -p tsconfig.types.json --noEmit` passed after moving Example
  06 auth-identity callers onto `ctx.asAuthUser(...)`.
- 2026-06-18: `pnpm --dir examples/07-mcp-reference test`,
  `pnpm --dir examples/08-component-mini-cms test`,
  `pnpm exec tsc -p tsconfig.types.json --noEmit`, and
  `pnpm run check:security:source-policy` passed after banning raw Convex
  identity helpers in maintained example tests.
- 2026-06-18: `pnpm exec vitest run --project=unit tests/unit/backend-index-exports.test.ts`,
  `pnpm exec vitest run apps/harness/convex/functions.test.ts apps/harness/convex/organizations.test.ts`,
  `pnpm exec tsc -p tsconfig.types.json --noEmit`,
  `pnpm run check:security:source-policy`, `pnpm run check:publish-surface`,
  and `pnpm run check:docs:api-surface` passed after removing raw forwarding
  envelope construction from the backend barrel.
- 2026-06-18: Initial
  `pnpm exec vitest run --project=unit tests/unit/mcp-index-exports.test.ts tests/unit/phase0-workspace-mcp-fixture.test.ts tests/unit/operation-ref-codegen.test.ts tests/unit/cli-add-resource.test.ts`
  failed because the MCP export assertion order was stale and the generated
  workspace-MCP fixture imported the full MCP barrel without the plain-unit MCP
  runtime mocks. After adding the MCP subpath alias/mocks and updating the
  export assertion, that focused unit command passed.
- 2026-06-18: Initial `pnpm --dir examples/08-component-mini-cms test` failed
  because `@lupinum/trellis-bridge` still imported removed raw envelope
  construction from `@lupinum/trellis/backend`. Bridge forwarding now signs its
  bridge-specific envelope directly and keeps backend raw envelope construction
  closed. `pnpm --dir examples/08-component-mini-cms test` and
  `pnpm exec vitest run --project=unit tests/unit/create-component-bridge.test.ts tests/unit/bridge-package-exports.test.ts`
  passed after the bridge change.
- 2026-06-18: `pnpm --dir examples/07-mcp-reference test`,
  `pnpm exec tsc -p tsconfig.types.json --noEmit`,
  `pnpm --dir packages/trellis-bridge run build`,
  `pnpm run check:docs:api-surface`, `pnpm run check:publish-surface`,
  `pnpm run check:security:source-policy`, `pnpm run check:docs:links`,
  `pnpm run format:check`, and `git diff --check` passed after exposing
  operation ref helpers from `@lupinum/trellis/mcp` and moving MCP
  tools/docs/generators/fixtures to that surface.
- 2026-06-18: `pnpm run security:contract`,
  `pnpm run check:security:contract`, and
  `pnpm exec vitest run --project=unit tests/unit/security-contract.test.ts`
  passed after adding the source policy that blocks MCP operation-ref imports
  from `@lupinum/trellis/backend` in production-copyable MCP authoring
  surfaces.
- 2026-06-18: Initial
  `pnpm exec vitest run --project=unit tests/unit/app-index-exports.test.ts tests/unit/phase0-starter-manifest.test.ts tests/unit/cli-doctor.test.ts`
  failed because the CLI fixture dist had not been copied; after
  `pnpm run build:cli`, it failed only on assertions expecting starter
  `convex/functions.ts` to import `@lupinum/trellis/backend`. Updating those
  assertions to the app surface made the same focused unit command pass.
- 2026-06-18: `pnpm exec tsc -p tsconfig.types.json --noEmit`,
  `pnpm run test:types`, `pnpm run check:docs:api-surface`,
  `pnpm run check:docs:links`, `pnpm run check:publish-surface`,
  `pnpm run check:security:source-policy`, `pnpm run format:check`, and
  `git diff --check` passed after exposing `defineTrellis` from
  `@lupinum/trellis/app` and moving starter/getting-started/permissions setup
  imports to that beginner entrypoint.
- 2026-06-18: `pnpm --dir examples/01-public-todo test`,
  `pnpm --dir examples/02-auth-todo test`,
  `pnpm --dir examples/03-team-workspace test`,
  `pnpm --dir examples/04-saas-platform test`,
  `pnpm --dir examples/05-visibility-access test`,
  `pnpm --dir examples/06-multi-workspace test`,
  `pnpm --dir examples/07-mcp-reference test`,
  `pnpm --dir examples/08-component-mini-cms test`,
  `pnpm exec tsc -p tsconfig.types.json --noEmit`,
  `pnpm run check:docs:api-surface`, `pnpm run check:docs:links`,
  `pnpm run check:publish-surface`, `pnpm run check:security:source-policy`,
  `pnpm run check:security:contract`, `pnpm run format:check`, and
  `git diff --check` passed after moving maintained example root
  `defineTrellis` imports to `@lupinum/trellis/app` and adding a source policy
  to prevent app setup from drifting back to the backend barrel.
- 2026-06-18: `pnpm run check:docs:api-surface`,
  `pnpm run check:docs:links`, `pnpm run format:check`, and
  `git diff --check` passed after updating workspace-lane docs to show
  `ctx.workspaceId` as the handler-local tenant source instead of copying
  `appIdentity.workspaceId` into writes.
- 2026-06-18: `pnpm run security:contract`,
  `pnpm run check:docs:api-surface`, `pnpm run check:docs:links`,
  `pnpm run check:security:source-policy`, and
  `pnpm run check:security:contract`, `pnpm run format:check`, and
  `git diff --check` passed after moving the functions API reference to the
  app-first `operation.*` wording and adding a source policy that prevents the
  beginner function reference from drifting back to `defineOperation(...)`.
- 2026-06-18: `pnpm --dir examples/03-team-workspace test`,
  `pnpm run check:docs:api-surface`, `pnpm run check:docs:links`,
  `pnpm run format:check`, and `git diff --check` passed after updating
  remaining workspace-lane docs to use `ctx.workspaceId` and deleting an
  unused tenant helper from the team-workspace todo example. Search for stale
  `appIdentity.workspaceId` copy patterns in docs/examples/starters is clean.
- 2026-06-18: `pnpm run security:contract` and
  `pnpm run check:security:source-policy` passed after adding a source policy
  that prevents production-copyable access context handlers from being
  registered on `query.public(...)`; the supported lane is `query.session(...)`.
- 2026-06-18: Updated `meta/0.2-implementation-note.md` to split resolved
  drift from remaining work so future RFC slices do not chase completed
  beginner docs, access-context, workspace-id, test-helper, or MCP operation-ref
  cleanup.
- 2026-06-18: Moved the beginner personal auth identity path onto
  `defineAppIdentity.fromAuth()` in the personal starter, Example 02, and the
  signed-in getting-started guide. Added a source policy so those beginner
  surfaces do not reintroduce hand-rolled `getAuth` plus `users.by_auth_key`
  lookup.
- 2026-06-18: `pnpm exec vitest run --project=unit tests/unit/api-surface-doc.test.ts tests/unit/cli-explain.test.ts`,
  `pnpm run check:docs:links`, `pnpm run check:docs:api-surface`,
  `pnpm run format:check`, and `git diff --check` passed after promoting
  `trellis explain permission <key>` and `trellis permissions matrix` as the
  canonical static permission debugging path in authorization and observability
  docs, with unit docs coverage to keep those commands visible.
- 2026-06-18: `pnpm exec vitest run --project=unit tests/unit/cli-doctor.test.ts -t "keeps presets mechanically equivalent"`,
  `pnpm run format:check`, and `git diff --check` passed after moving
  preset/ladder equivalence out of remaining drift in
  `meta/0.2-implementation-note.md`; the CLI unit suite proves this by
  comparing generated preset trees against composed `trellis add` ladder output.
- 2026-06-18: `pnpm exec vitest run --project=unit tests/unit/cli-doctor.test.ts -t "initializes a first-class workspace MCP app via the preset|fails doctor when MCP surfaces lack effective Nitro async context"`,
  `pnpm exec vitest run --project=unit tests/unit/mcp-convex-caller.test.ts tests/unit/use-mcp-session.test.ts`,
  and `pnpm exec vitest run --project=e2e tests/e2e/mcp-smoke.e2e.test.ts`
  passed while reviewing the Phase 6 MCP generated-slice drift. Moved that
  drift to resolved evidence instead of adding new MCP framework code because
  the generated preset already gates async context and bearer auth, while the
  e2e smoke proves real `tools/list` and `tools/call` behavior.
- 2026-06-18: Made `defineMcpApp(...)` own the default MCP Convex caller by
  delegating to `createMcpConvexCaller(...)` when `callConvex` is omitted.
  Removed generated/example `callConvex` and `isForwardedCaller` boilerplate
  from the workspace-MCP starter, MCP reference example, harness MCP runtime,
  and mini-CMS MCP runtime. `callConvex` remains an advanced override for
  non-canonical caller shapes. `pnpm exec tsc -p tsconfig.types.json --noEmit`,
  `pnpm run test:types`, `pnpm --dir examples/07-mcp-reference test`,
  `pnpm --dir examples/08-component-mini-cms test`, and
  `pnpm exec vitest run --project=unit tests/unit/mcp-convex-caller.test.ts tests/unit/define-convex-tool.test.ts tests/unit/cli-doctor.test.ts -t "initializes a first-class workspace MCP app via the preset|defineMcpApp|createMcpConvexCaller|canonical MCP Convex caller"`
  passed after rebuilding the CLI fixture copy with `pnpm run build:cli`.
