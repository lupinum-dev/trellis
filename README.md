# Trellis

Opinionated app framework for repeated Nuxt + Convex apps.

Trellis gives teams one app shape for browser UI, Nitro routes, Convex
functions, Better Auth, permissions, destructive operations, and MCP tools. Use
it when the app needs shared backend rules across surfaces and you do not want
each project to invent its own auth, access, and feature layout.

[![npm version][npm-version-src]][npm-version-href]
[![npm downloads][npm-downloads-src]][npm-downloads-href]
[![License][license-src]][license-href]
[![Nuxt][nuxt-src]][nuxt-href]

- [Documentation](https://trellis.vercel.app)
- [Examples](./examples/README.md)
- [Architecture](./ARCHITECTURE.md)
- [Security](./SECURITY.md)
- [ADRs](./adr/README.md)
- [Contributing](./CONTRIBUTING.md)
- [Development](./DEVELOPMENT.md)

## Quick Start

Create a starter app:

```bash
pnpm dlx @lupinum/trellis init my-app --template public
cd my-app
pnpm dlx @lupinum/trellis doctor
```

Choose the smallest starter that matches the product:

| Starter         | Use it when                                                           |
| --------------- | --------------------------------------------------------------------- |
| `public`        | The app needs public SSR and live Convex queries without sign-in yet. |
| `personal`      | The app needs signed-in users without workspace-scoped data.          |
| `workspace`     | The app needs roles, tenant data, or trusted server callers.          |
| `workspace-mcp` | The workspace baseline also needs MCP tools from day one.             |

If you are adding Trellis to an existing Nuxt app instead:

```bash
pnpm add convex @lupinum/trellis
```

```ts
export default defineNuxtConfig({
  modules: ['@lupinum/trellis'],
  trellis: {
    url: process.env.CONVEX_URL,
  },
})
```

Then run:

```bash
pnpm dlx @lupinum/trellis doctor
```

## What You Get

- Nuxt module setup and generated Convex aliases.
- Convex client/server helpers for live queries, mutations, and actions.
- Better Auth integration and identity forwarding.
- Permission-aware composables and backend access projection.
- Operation primitives for preview, confirmation, and execute flows.
- MCP helpers for tools, prompts, resources, and runtime checks.
- Starter fixtures, generators, examples, lint rules, and `doctor`.

## Good Fit

Use Trellis when:

- the app is on Nuxt + Convex + Better Auth already
- one backend model needs to serve browser UI, Nitro routes, and MCP
- isolation, roles, permissions, or destructive-work safety are real product requirements
- you want the CLI, examples, and guardrails to push the team toward one consistent shape

Skip it when:

- raw Convex is enough for a small public or one-off internal app
- you want an unopinionated helper layer instead of a framework
- you plan to discard the canonical layout immediately
- the app does not need shared auth, permission, or MCP conventions across surfaces

## Canonical Shape

Generated apps converge on this layout. Public apps omit auth and permission
folders until those capabilities are added.

```text
nuxt.config.ts
convex/
  auth.ts
  auth.config.ts
  convex.config.ts
  functions.ts
  http.ts
  schema.ts
  auth/
  permissions/
  features/
shared/
  features/
app/
  features/
  pages/
server/
  api/
  mcp/
```

Keep routes thin and put product behavior under feature folders. Treat each
top-level feature as a small Trellis boundary: runtime-neutral contracts in
`shared/features`, backend behavior in `convex/features`, and UI-specific code
in `app/features`.

## Runtime Model

Trellis keeps one protected backend decision path:

1. caller
2. appIdentity
3. guard
4. load
5. authorize
6. handler

The same business model is then projected into browser UI, server callers, and
MCP tools. Cross-surface destructive flows, especially MCP, should use
operation-backed preview, confirmation, and execute steps.

## Repository Packages

- `@lupinum/trellis`: Nuxt module, runtime helpers, CLI, starters, and MCP
  primitives for app teams.
- `@lupinum/trellis-bridge`: package-author utilities for Convex
  component-backed integrations that generate host bridge files.
- `@lupinum/trellis-eslint`: repository lint rules for Trellis app and example
  boundaries.

Normal app code should start with `@lupinum/trellis`. The bridge package is for
integration authors, not day-one app setup.

## Examples

Read these in order:

1. [`examples/01-public-todo`](./examples/01-public-todo/README.md)
2. [`examples/02-auth-todo`](./examples/02-auth-todo/README.md)
3. [`examples/03-team-workspace`](./examples/03-team-workspace/README.md)
4. [`examples/04-saas-platform`](./examples/04-saas-platform/README.md)

Then branch into advanced references:

- [`examples/05-visibility-access`](./examples/05-visibility-access/README.md)
- [`examples/06-multi-workspace`](./examples/06-multi-workspace/README.md)
- [`examples/07-mcp-reference`](./examples/07-mcp-reference/README.md)
- [`examples/08-component-mini-cms`](./examples/08-component-mini-cms/README.md)

`labs/` contains exploratory material and is not part of the maintained public
learning path.

## Local Development

```bash
corepack enable
pnpm install
pnpm dev
pnpm run check
```

Use [CONTRIBUTING.md](./CONTRIBUTING.md) for contribution rules and
[DEVELOPMENT.md](./DEVELOPMENT.md) for the full local command map.

[npm-version-src]: https://img.shields.io/npm/v/@lupinum/trellis/latest.svg?style=flat&colorA=18181B&colorB=28CF8D
[npm-version-href]: https://npmjs.com/package/@lupinum/trellis
[npm-downloads-src]: https://img.shields.io/npm/dm/@lupinum/trellis.svg?style=flat&colorA=18181B&colorB=28CF8D
[npm-downloads-href]: https://npm.chart.dev/@lupinum/trellis
[license-src]: https://img.shields.io/npm/l/@lupinum/trellis.svg?style=flat&colorA=18181B&colorB=28CF8D
[license-href]: https://npmjs.com/package/@lupinum/trellis
[nuxt-src]: https://img.shields.io/badge/Nuxt-4.x-00DC82?style=flat&logo=nuxt.js&logoColor=white
[nuxt-href]: https://nuxt.com
