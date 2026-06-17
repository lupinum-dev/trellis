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
    paths stay separate;
  - internal verifier plumbing still maps the app-facing field into the
    existing `identityForwardingFunctionRef` runtime slot. This is intentionally
    scoped as transport internals for this slice; the remaining cleanup is to
    collapse that internal name once the broader forwarding tests are migrated.
- 2026-06-17: Tightened the operation execute-target cleanup:
  - `@lupinum/trellis/app` operation shapes now expose `executeFunctionRef`
    instead of the old forwarding field;
  - destructive operation runtime tests use `executeFunctionRef` for operation
    execute targets;
  - remaining `identityForwardingFunctionRef` references in the touched test
    file are direct handler or preview handler verifier targets, not operation
    definitions.
- 2026-06-17: Removed the old operation-definition fallback:
  - `defineOperation(...)` omits the direct-handler forwarding field from its
    accepted operation shape;
  - operation preview projection metadata is sourced only from
    `executeFunctionRef`;
  - the remaining operation-code reference to `identityForwardingFunctionRef`
    is the type-level `Omit` that blocks the old field from operations.

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
