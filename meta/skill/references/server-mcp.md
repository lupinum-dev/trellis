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
- `transportProof.server(...)`, `transportProof.webhook(...)`, or
  `transportProof.mcp(...)`: identity-forwarding paths with verifier-produced
  caller, optional acting-for evidence, and replay intent.

Use `createServerConvexCaller(event, options?)` when a request needs several
Convex calls with the same event/options.

```ts
const convex = createServerConvexCaller(event, { auth: 'required' })

const result = await convex.query(api.dashboard.get, { id })
```

Forwarded `caller` or `actingFor` belongs inside a `transportProof.*(...)`
object. Do not pass forwarded identity as normal public args or route-local
options.

## Server Boundaries

- Server helpers do not replace handler authorization. They only change the
  transport by which Nitro reaches Convex.
- `serverConvexClearAuthCache` and `validateConvexArgs` are Nuxt server
  auto-imports only.
- `@lupinum/trellis/server` exports `serverConvexQuery`,
  `serverConvexMutation`, `serverConvexAction`, `createServerConvexCaller`,
  `transportProof`, `domainIdempotency`, `jtiRedemption`,
  `operationConfirmation`, `requireDelegationBinding`, and webhook helpers.

## Webhooks And Identity-Forwarded Traffic

Pattern:

1. Verify the external request at the Nitro edge.
2. Parse before idempotency or business dispatch.
3. Call Convex with `auth: transportProof.*(...)`.
4. Forward an explicit server-owned `caller`.
5. Add `actingFor: requireDelegationBinding(...)` when the request represents a
   user.
6. Declare replay intent with `domainIdempotency(...)`,
   `jtiRedemption(...)`, or `operationConfirmation(...)`.
7. Let the normal Convex lane/load/authorize/handler path decide.

Never treat "it is a webhook" or "it has the trusted key" as permission to do
anything. Identity forwarding verifies identity injection. Business
authorization still belongs in the backend handler.

## MCP Runtime

Use `defineMcpApp(options)` for the Trellis-aware MCP runtime and operation
projection path. It binds tool invocation to your Convex caller, caller
resolution, optional actingFor resolution, access visibility, rate limiting,
sessions, confirmation identity, and observability.

Low-level `defineMcpTool(options)` lives under
`@lupinum/trellis/mcp/advanced`. Use it only for standalone custom tools where
the handler body genuinely lives in MCP code.

Use the factories returned by `defineMcpApp(...)` when a tool projects a Convex
ref or operation:

- `mcp.tool.query(...)` for read tools.
- `mcp.tool.operation(operation, options)` for writes, sensitive work,
  destructive flows, audited work, or external-side-effect work.

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

Common `mcp.tool.query(...)` and `mcp.tool.operation(...)` options include:

- `schema`
- `call`
- `permission`
- `enabled`
- `meta`
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

`mcp.tool.operation(operationHandle, options)` is the normal operation-backed
write path. Pass a generated handle from `#trellis/operations/mcp`; do not pass
`call`, `execute`, or `preview` in ordinary app MCP tools. The generated handle
owns the execute and preview projection refs.

Low-level operation objects with explicit `execute`, optional `preview`,
`executeOperation`, `previewOperation`, `previewResult`, `confirmationMode`, and
per-tool `scopeKey` are advanced package/runtime-boundary tools only. Keep that
shape out of beginner docs, starters, and ordinary app MCP files.

`enabled` controls visibility/availability. It is not backend authorization.

## Destructive MCP Tools

Do not implement destructive generic tools through `defineMcpTool`. Use
`mcp.tool.operation(operation, options)` so preview, confirmation, and execute
stay bound to one operation identity.

Trellis rejects destructive operation bindings without the required preview
projection and confirmation scope. In the normal path, generated operation
handles carry those refs and Trellis validates them before tool execution.

Do not hand-construct operation references in MCP files. Set `scopeKey` on the
tool or app for destructive operation tools when a generated scope is not
available; use `'global'` only for truly unscoped app-level operations.

Canonical destructive binding shape:

```ts
import { operations } from '#trellis/operations/mcp'

export default mcpRuntime.tool.operation(operations.runbooks.remove, {
  scopeKey: ({ args }) => `runbook:${String(args.id)}`,
  meta: {
    name: 'delete-runbook',
  },
})
```

Import generated operation handles in MCP files. Do not import Convex
implementation modules into MCP tool files just to duplicate business behavior.
Manual `executeOperationRef(...)` and `previewOperationRef(...)` imports belong
to backend/functions internals or explicitly reviewed package bridge code, not
to the first-reader MCP path.

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
- Do not use `auth: 'none'` to silence a backend authorization failure.
- Do not duplicate business operations in MCP files. Project operations or root
  handlers whenever possible.
- Do not let MCP capability visibility drift from backend checks. Visibility
  improves discovery; handlers still enforce policy.
