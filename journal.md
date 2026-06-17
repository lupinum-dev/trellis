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

## Blockers

- Maintained examples/starters/docs still use global `public.readTables` and
  public access context. These must migrate before the full repo gate can pass.

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
