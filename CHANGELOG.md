# Changelog

## v0.3.0

Hard-cut security foundation release.

### Breaking Direction

- Replaces first-reader protected/guard authoring with explicit `public`,
  `authenticated`, `workspace`, `service`, and `unsafe` backend lanes.
- Removes unsafe public exports for shared-secret trusted webhooks, boolean
  delegation, raw identity-forwarding primitives, direct MCP safety stamping,
  raw MCP write helpers, and removed legacy subpaths.
- Makes MCP writes operation-backed. Tool-local write safety metadata is no
  longer a production path.
- Treats trusted route and MCP forwarding as verifier-produced proof, not as an
  author-supplied trust literal.

### Security

- Removes raw DB and cross-tenant escape access from normal handler-visible
  contexts.
- Adds a strict authorization evaluator and duplicate permission-key checks
  across backend, projection, and MCP visibility paths.
- Adds backend replay/idempotency enforcement for trusted transport executes and
  destructive operation executes.
- Adds HMAC webhook verification with raw-body binding, timestamp validation,
  delivery-id recovery semantics, and blank-secret rejection.
- Adds binding-backed delegation evidence that backend handlers revalidate.
- Keeps Trellis auth derived from Better Auth session state, including
  out-of-band session changes, failed sign-out handling, protected navigation
  refresh, and auth proxy body handling.

### Examples And Docs

- Rewrites maintained examples, starter fixtures, generated resources, docs, and
  skill references against the 0.3.0 explicit-lane model.
- Removes production-copyable unsafe snippets for shared-secret trusted
  webhooks, unconditional delegation, public MCP key validation/touch, direct
  MCP mutation helpers, and starter direct deletes.
- Adds migration-oriented coverage for Ginko-style MCP project tools and
  shadcn-style workspace MCP starters.

### Verification

- Adds `test:security` and wires it into both `pnpm run check` and
  `pnpm run release:verify`.
- Adds a generated security contract covering public exports, banned export
  absence, backend lanes, operations, MCP bindings, service metadata, replay and
  audit metadata, maintained examples, routes, delegation, and webhook verifier
  metadata.
- Strengthens packed artifact checks so removed unsafe exports are absent from
  built tarballs, not only source.
- Keeps `release:verify` as the full local release gate and `release:pack` as
  the tarball generation step.

### Release

- Publishes `@lupinum/trellis@0.3.0` and
  `@lupinum/trellis-bridge@0.3.0`.
- Keeps `@lupinum/trellis-eslint` private.

## v0.2.0

Hard-cut Operation Ladder release.

### Breaking Direction

- Makes `@lupinum/trellis/app` the beginner app API and `operation` the primary authoring primitive.
- Keeps `@lupinum/trellis` as the Nuxt module entry instead of turning the package root into an app DSL.
- Moves backend builders and low-level MCP surfaces to advanced paths and docs so they are no longer equal beginner choices.
- Fixes `workspaceScope()` to validated `ctx.workspaceId` only. This release does not add `ctx.scope.table(...)`, `ctx.scope.insert(...)`, or scoped DB wrappers.

### Features

- Adds the operation ladder: `trellis init`, `trellis add auth`, `trellis add workspace`, and `trellis add mcp`.
- Makes presets mechanically equivalent shortcuts over the ladder instead of separate app architectures.
- Adds operation-first query, mutation, and destructive authoring with shared metadata for args, permissions, safety, preview, execute, Convex projection, MCP projection, and explain output.
- Makes auth bootstrap Trellis-owned by default and splits runtime auth bootstrap state away from devtools state.
- Generates a complete protected bearer-key MCP slice for workspace apps, including async-context diagnostics, invalid bearer throttling, readiness checks, and `tools/call` coverage.
- Adds `createMcpConvexCaller(...)` so MCP tools forward to Convex through one trusted envelope instead of repeating per-tool forwarding glue.
- Adds runtime permission explanations, `trellis explain permission <key>`, and `trellis permissions matrix`.
- Updates starters, examples, docs, and consumer conformance around the operation-first path.

### Advanced Escape Hatches

- Existing lower-level backend, MCP, visibility, and bridge primitives remain available through advanced docs and subpaths when an app or integration package needs them.
- `auth.bootstrap: false` remains an explicit advanced opt-out for apps that intentionally own auth bootstrap.
- Product integrations such as Ginko can render or translate Trellis doctor findings without exposing Trellis as their public setup product.

### Deferred

- Does not add permission override tables, explicit grants or denies, tenant role overlays, record sharing, permission audit tables, scoped DB wrappers, generic integration adapters, or public unauthenticated MCP defaults.
- Defers richer authorization state to post-0.2 RFCs after the base permission graph remains explainable.

### Release

- Publishes `@lupinum/trellis@0.2.0` and `@lupinum/trellis-bridge@0.2.0`.
- Keeps `@lupinum/trellis-eslint` private.

## v0.1.1

Maintenance release for the first public line.

### Fixes

- Fixed `trellis.auth: {}` so an explicit auth object now enables auth with defaults instead of inheriting the disabled module default.
- Hardened `trellis doctor` and repository diagnostics for integration-package detection, starter validation, and clean checkout checks.
- Stabilized CI by splitting memory-heavy lint/type paths and preparing generated package artifacts before consumer smoke tests.
- Regenerated and verified component-bridge example outputs so bridge fixtures match the published package contracts.

### Release

- Publishes `@lupinum/trellis@0.1.1` and `@lupinum/trellis-bridge@0.1.1`.
- Keeps `@lupinum/trellis-eslint` private.

## v0.1.0

Initial public release of Trellis.

### Features

- Nuxt module for Trellis app setup, generated aliases, runtime config, and CLI-backed starter workflows.
- Convex runtime primitives for guarded queries, mutations, actions, operation previews, destructive confirmations, and server callers.
- Better Auth identity forwarding helpers for sharing authenticated app identity across browser UI, Nitro routes, Convex functions, and MCP tools.
- Permission-aware composables and generated public-surface types for app access, visibility, operation state, pagination, uploads, and testing helpers.
- MCP runtime helpers for defining tools, binding Convex operations, rate limiting, safety metadata, and confirmation flows.
- Maintained starter templates and examples for public, personal, workspace, workspace MCP, SaaS, visibility, and component-bridge app shapes.
- Separate `@lupinum/trellis-bridge` package for package authors building Trellis-aware Convex component integrations.

### Release

- Publishes `@lupinum/trellis@0.1.0` and `@lupinum/trellis-bridge@0.1.0` as the first clean public compatibility line.
- Keeps `@lupinum/trellis-eslint` private.
