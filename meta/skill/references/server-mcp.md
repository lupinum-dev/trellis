# Server And MCP

Use this for Nitro routes, webhooks, server-to-server Convex calls, MCP runtime
setup, MCP tools, sessions, result envelopes, and destructive operation
projection.

## Contents

- [Source Files](#source-files)
- [Nitro Server Helpers](#nitro-server-helpers)
- [Server Boundaries](#server-boundaries)
- [Webhooks And Identity-Forwarded Traffic](#webhooks-and-identity-forwarded-traffic)
- [MCP Runtime](#mcp-runtime)
- [MCP Tool Options](#mcp-tool-options)
- [Destructive MCP Tools](#destructive-mcp-tools)
- [Result And Session Helpers](#result-and-session-helpers)
- [Pitfalls](#pitfalls)

## Source Files

- Server barrel: `src/runtime/server/index.ts`.
- Server Convex helpers: `src/runtime/convex/server/convex.ts`.
- Server validation: `src/runtime/convex/server/validate.ts`.
- Server auth cache: `src/runtime/auth/server/auth-cache.ts`.
- Webhooks: `src/runtime/server/webhooks.ts`.
- MCP barrel: `src/runtime/mcp/index.ts`.
- MCP app/tool implementation:
  `src/runtime/mcp/define-mcp-app.ts`,
  `src/runtime/mcp/define-convex-tool.ts`,
  `src/runtime/mcp/result-envelope.ts`,
  `src/runtime/mcp/rate-limiter.ts`,
  `src/runtime/mcp/use-mcp-server.ts`,
  `src/runtime/mcp/use-mcp-session.ts`.
- Docs:
  `apps/docs/content/docs/07.server-side/**`,
  `apps/docs/content/docs/13.api-reference/4.server.md`,
  `apps/docs/content/docs/13.api-reference/5.mcp.md`,
  `apps/docs/content/docs/14.mcp-tools/**`.

## Nitro Server Helpers

Use these from Nuxt server routes, middleware, and Nitro handlers:

```ts
import { api } from '#trellis/api'

export default defineEventHandler(async (event) => {
  return await serverConvexQuery(event, api.features.todos.domain.list, {})
})
```

Available per-call helpers:

- `serverConvexQuery(event, fn, args?, options?)`
- `serverConvexMutation(event, fn, args?, options?)`
- `serverConvexAction(event, fn, args?, options?)`

`ServerConvexOptions.auth` supports:

- `auto`: use session cookie when available, otherwise unauthenticated.
- `required`: fail when auth cannot be resolved.
- `none`: never attach auth; public calls only.
- `trusted`: identity-forwarding path with explicit caller identity.

Use `createServerConvexCaller(event, options?)` when a request needs several
Convex calls with the same event/options.

```ts
const convex = createServerConvexCaller(event, {
  auth: 'trusted',
  caller,
  actingFor,
})

const result = await convex.query(api.dashboard.get, { id })
```

Forwarded `caller` or `actingFor` requires `auth: 'trusted'`. The helper
throws when forwarded identity is supplied on any other auth mode.

## Server Boundaries

- Server helpers do not replace handler authorization. They only change the
  transport by which Nitro reaches Convex.
- `serverConvexClearAuthCache` and `validateConvexArgs` are Nuxt server
  auto-imports only.
- `@lupinum/trellis/server` exports `serverConvexQuery`,
  `serverConvexMutation`, `serverConvexAction`, `createServerConvexCaller`,
  `delegateToUser`, and webhook helpers.

## Webhooks And Identity-Forwarded Traffic

Pattern:

1. Verify the external request at the Nitro edge.
2. Call Convex with `auth: 'trusted'`.
3. Forward an explicit server-owned `caller`.
4. Add `actingFor` when the request represents a user.
5. Let the normal Convex guard/load/authorize/handler path decide.

Never treat "it is a webhook" or "it has the trusted key" as permission to do
anything. Identity forwarding verifies identity injection. Business
authorization still belongs in the backend handler.

## MCP Runtime

Use `defineMcpApp(options)` for the Trellis-aware MCP runtime and operation
projection path. It binds tool invocation to your Convex caller, caller
resolution, optional actingFor resolution, access visibility, rate limiting,
sessions, confirmation identity, and observability.

Low-level `defineTool(options)` lives under `@lupinum/trellis/mcp/advanced`.
Use it only for standalone custom tools where the handler body genuinely lives
in MCP code.

Use the factories returned by `defineMcpApp(...)` when a tool projects a Convex
ref or operation:

- `mcp.tool.query(...)` for read tools.
- `mcp.tool.mutation(...)` for bounded write tools.
- `mcp.tool.operation(operation, options)` for sensitive, destructive, audited,
  or external-side-effect work.

That keeps MCP behavior aligned with the same backend authorization model used
by browser and server calls.

## MCP Tool Options

Common `defineMcpApp(...)` runtime options include:

- `resolveCaller`
- `resolveActingFor`
- `resolveAccess`
- `callConvex`
- `runtime`
- `callerKey`
- `rateLimitStore`
- `confirmationStore`
- `scopeKey`
- `observability`

Common `mcp.tool.query(...)` and `mcp.tool.mutation(...)` options include:

- `schema`
- `call`
- `permission`
- `enabled`
- `meta`
- `safety`
- `rateLimit`
- `rateLimitStore`
- `maxItems`
- `middleware`
- `mapResult`
- `summary`
- `respond`
- `outputSchema`
- `group`
- `tags`

`mcp.tool.operation(operation, options)` replaces `call` with operation
projections such as `execute`, optional `preview`, `executeOperation`,
`previewOperation`, `previewResult`, `confirmationMode`, and per-tool
`scopeKey`.

`enabled` controls visibility/availability. It is not backend authorization.

## Destructive MCP Tools

Do not implement destructive generic tools through `defineTool`. Use
`mcp.tool.operation(operation, options)` so preview, confirmation, and execute
stay bound to one operation identity.

Trellis rejects destructive operation bindings without the required preview
projection and confirmation scope. Keep preview and execute refs as real
exported projections of the same operation.

Use `executeOperationRef(operation, ref)` and
`previewOperationRef(operation, ref)` from the functions surface when
projecting operation-backed tools. In app code, import them from
`@lupinum/trellis/backend`. Do not hand-construct operation references. Set
`scopeKey` on the tool or app for destructive operation tools; use `'global'`
only for truly unscoped app-level operations.

Canonical destructive binding shape:

```ts
import { executeOperationRef, previewOperationRef } from '@lupinum/trellis/backend'

import { api } from '#trellis/api'
import { removeRunbookDescriptor } from '~~/shared/features/runbooks/contract'

export default mcpRuntime.tool.operation(removeRunbookDescriptor, {
  execute: executeOperationRef(removeRunbookDescriptor, api.features.runbooks.domain.remove),
  preview: previewOperationRef(
    removeRunbookDescriptor,
    api.features.runbooks.operations.previewRemove,
  ),
  previewOperation: 'mutation',
  scopeKey: ({ args }) => `runbook:${String(args.id)}`,
  meta: {
    name: 'delete-runbook',
  },
})
```

Import the shared operation descriptor and generated Convex refs in MCP files.
Do not import Convex implementation modules into MCP tool files just to
duplicate business behavior.

## Result And Session Helpers

MCP result helpers:

- `wrapSuccess(data)`
- `wrapError(category, message, issues?)`
- `wrapPreview(preview)`
- `withSummary(result, summary)` for successful result summaries
- `withUntrustedText(...)`

Session/server helpers:

- `useMcpServer()`
- `useMcpSession()`
- `createRedisMcpRateLimitStore(...)`

Use result envelopes instead of returning ad hoc payloads when a tool needs
consistent success/error/preview shape.

## Pitfalls

- Do not bypass Convex authorization in Nitro just because the route already did
  auth checks.
- Do not use `auth: 'none'` to silence a protected handler failure.
- Do not duplicate business operations in MCP files. Project operations or root
  handlers whenever possible.
- Do not let MCP capability visibility drift from backend checks. Visibility
  improves discovery; handlers still enforce policy.
