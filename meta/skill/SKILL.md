---
name: trellis
description: >
  Use this skill when working on Trellis itself or on a Nuxt app that uses
  @lupinum/trellis or @lupinum/trellis-bridge. Trigger for Trellis package
  exports, bridge package authoring, Nuxt auto-imports, generated aliases,
  Convex SSR/live queries, mutations, uploads, Better Auth, appIdentity,
  useAccess/useAuthGuard permissions, tenant isolation, identity forwarding,
  Nitro server helpers, MCP tools, module options, CLI starters, feature
  manifests, component bridges, testing helpers, docs, examples, or APIs such
  as defineTrellis, defineArgs, useConvexQuery, useConvexMutation,
  useCachedQuery, useConvexUpload, serverConvexQuery,
  createServerConvexCaller, defineMcpApp, defineAccessContext, enforce,
  requireRecord, defineFeature, defineRecordAccess, createTestContext, and
  #trellis/api.
---

# Trellis

Trellis is an opinionated Nuxt + Convex framework with SSR queries, live
subscriptions, Better Auth integration, backend-owned permissions, tenant
guardrails, Nitro server helpers, uploads, MCP tooling, testing helpers, and
code-generated Nuxt aliases.

## Start Here

1. Identify the task surface before editing: client composable, Convex backend,
   Nitro server route, MCP tool, module config, CLI/template, test, docs, or
   example app.
2. Read the matching reference file below before changing code or answering with
   API guidance.
3. Verify anything user-facing against implementation when it could drift. Use
   `package.json` for package exports, `src/installers/*` for Nuxt aliases and
   auto-imports, the relevant `src/runtime/**/index.ts` barrel for exported
   symbols, and tests when older patterns may have been intentionally rejected.
4. Prefer hard cutovers in this repo. Delete or replace stale Trellis patterns
   instead of adding compatibility shims, wrapper aliases, or parallel policy
   paths.
5. Keep app authorization in Trellis handler phases (`guard`, `load`,
   `authorize`, `handler`). Do not create browser-side policy engines, DB-policy
   substitutes, or webhook/MCP bypasses.
6. For app users, prefer the paved route first: `trellis init`, the canonical
   feature-folder shape, and maintained examples. Hand-built setup docs are a
   learning path, not a second app architecture.

## Reference Map

- For package exports, Nuxt auto-imports, generated aliases, and what not to
  import: read [references/public-surface.md](references/public-surface.md).
- For Vue/Nuxt data fetching, mutations, actions, pagination, cache seeding,
  uploads, storage URLs, and auth composables: read
  [references/client-composables.md](references/client-composables.md).
- For Convex backend builders, `defineTrellis`, args schemas, auth, permissions,
  operations, tenant isolation, and identity-forwarding validators: read
  [references/backend-auth-permissions.md](references/backend-auth-permissions.md).
- For Nitro server helpers, trusted server-to-server calls, webhooks, MCP apps,
  MCP tools, result envelopes, sessions, and destructive operations: read
  [references/server-mcp.md](references/server-mcp.md).
- For `@lupinum/trellis-bridge`, packaged integration boundaries, generated
  host files, bridge manifests, and drift checks: read
  [references/bridge-package.md](references/bridge-package.md).
- For `trellis` module options, environment-sensitive setup, CLI starters,
  `trellis add`, and canonical app shape: read
  [references/config-cli.md](references/config-cli.md).
- For tests, examples, docs maintenance, and repo validation:
  read [references/testing-examples-docs.md](references/testing-examples-docs.md).

## Source Priority

Use this priority order when documentation and code disagree:

1. Current implementation and generated/public surface tests.
2. Maintained docs in `apps/docs/content/docs/**`.
3. Maintained examples in `examples/01-*` through `examples/08-*`.
4. Architecture docs and ADRs under `meta/`.
5. Labs, old notes, generated `dist`, and stale build artifacts only as
   historical context.

## Fast Checks

Use [references/testing-examples-docs.md](references/testing-examples-docs.md)
to choose focused validation. Default to `pnpm run check` before handoff. Use
`pnpm run release:verify` for public surfaces, docs/API reference, package
metadata, starters, MCP, auth, bridge, or release scripts.

Run the narrowest check that proves the change, then step back and inspect for
policy drift, duplicate abstractions, stale docs, and mismatched import surfaces.
