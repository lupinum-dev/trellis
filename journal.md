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
    `executeFunctionRef`;
  - the remaining operation-code reference to `identityForwardingFunctionRef`
    is the type-level `Omit` that blocks the old field from operations.
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
