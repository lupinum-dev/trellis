# Changelog

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
