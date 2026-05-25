# Backend, Auth, Permissions

Use this for Convex backend code: `defineTrellis`, protected handlers, shared
args schemas, guards, appIdentity, access context, operations, tenant isolation,
services, and identity-forwarding validators.

## Contents

- [Source Files](#source-files)
- [Protected Backend Runtime](#protected-backend-runtime)
- [Handler Shape](#handler-shape)
- [Shared Args](#shared-args)
- [Auth And Permissions](#auth-and-permissions)
- [Tenant Isolation](#tenant-isolation)
- [Operations](#operations)
- [Features And Visibility](#features-and-visibility)
- [Identity Forwarding](#identity-forwarding)
- [Pitfalls](#pitfalls)

## Source Files

- Public backend package barrel: `src/runtime/backend/index.ts`.
- Protected handler implementation/export source: `src/runtime/functions/index.ts`.
- Auth barrel: `src/runtime/auth/index.ts`.
- Args barrel: `src/runtime/args/index.ts`.
- Identity forwarding: `src/runtime/identity-forwarding/index.ts`,
  `src/runtime/identity-forwarding/envelope.ts`.
- Visibility: `src/runtime/visibility/index.ts`.
- Feature manifests: `src/runtime/feature/index.ts`.
- Observability: `src/runtime/observability/index.ts`,
  `apps/docs/content/docs/09.observability/**`.
- Docs:
  `apps/docs/content/docs/08.permissions/**`,
  `apps/docs/content/docs/13.api-reference/3.functions.md`,
  `apps/docs/content/docs/13.api-reference/8.type-primitives.md`.
- Architecture: `meta/ARCHITECTURE.md`, `meta/ABSTRACTIONS.md`,
  `meta/SECURITY.md`, `meta/adr/0004-protected-handler-pipeline.md`,
  `meta/adr/0005-backend-owned-permissions-and-tenant-isolation.md`,
  `meta/adr/0006-trusted-forwarding-for-server-identity.md`.

## Protected Backend Runtime

`defineTrellis(builders, options?)` is the canonical backend seam. It returns
public, protected, internal, transport, and unsafe lanes; keep unsafe lanes as
explicit escape hatches.

Important options include:

- `caller`: resolve transport identity.
- `actingFor`: resolve represented identity when applicable.
- `appIdentity`: map the resolved caller to the app-owned appIdentity.
- `isolation`: tenant-scoped tables and global tables.
- `services`: explicit high-trust service callers.
- `observability`: semantic event emission.
- `destructiveOperations`: required before destructive operations.
- `triggers`: Convex triggers installed on the Trellis runtime path.
- `onSuccess`: post-success hooks.

Handler context adds:

- `await ctx.caller()`
- `await ctx.appIdentity()`
- `ctx.observe(...)`
- tenant-scoped `ctx.db`
- `ctx.db.escapeIsolation({ reason })`

Use `unsafe.query`, `unsafe.mutation`, and `unsafe.action` only for deliberate
escape hatches with a justification. Do not normalize unsafe access into app
patterns.

## Handler Shape

Keep authorization reviewable in the handler:

```ts
export const setCompleted = mutation.protected({
  args: setTodoCompleted.args,
  guard: todoRead,
  load: async (ctx, args) => {
    const todo = await ctx.db.get(args.id)
    requireRecord(todo, 'Todo')
    return { todo }
  },
  authorize: {
    check: (_appIdentity, { todo }) => canUpdateTodo(todo),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { completed: args.completed })
  },
})
```

- `guard`: cheap, coarse entry gate.
- `load`: fetch records needed for the decision.
- `authorize`: record-specific business decision.
- `handler`: perform the work.

If the rule needs loaded data or `ctx.db`, it belongs in `load` plus
`authorize`, not in a giant guard.

## Shared Args

Use `defineArgs()` from `@lupinum/trellis/args` for shared schemas across
Convex handlers, Nitro validation, and MCP tools.

Shared args are schema-only. Do not hide identity-forwarding transport fields
in `defineArgs()` definitions. Trellis server helpers add the signed
`_trellisForwarding` envelope for `auth: 'trusted'` calls.

## Auth And Permissions

Important auth exports include:

- `defineBetterAuth`
- `defineGuard`, `authRequired`, `open`
- `defineAppIdentity`
- `definePermission`
- `defineAccessContext`
- `defineServices`
- `can`, `deny`, `and`, `or`
- `enforce`
- `requireAuth`
- `requireRecord`
- `getAuth`
- `ensureTenant`
- `loadTenantResource`
- subject helpers such as `subject(...)`

The app owns business identity and permission semantics. Trellis provides the
runtime shape.

Permission context is a backend-owned projection for stable UI decisions:

```ts
export const getAccessContext = query.protected(
  defineAccessContext({
    resolve: getAppIdentity,
    permissions: teamWorkspacePermissions,
  }),
)
```

Then point Nuxt at it:

```ts
export default defineNuxtConfig({
  trellis: {
    permissions: {
      query: 'permissions/context.getAccessContext',
    },
  },
})
```

Use `useAccess().can(...)` only as a browser projection of backend decisions.
Use backend `can(appIdentity, check)` inside Convex code.

## Tenant Isolation

Trellis tenant isolation is a runtime guardrail around `ctx.db`; it is not the
business authorization model. Business policy still lives in `guard`, `load`,
`authorize`, and `handler`.

Use `ctx.db.escapeIsolation({ reason })` for explicit cross-tenant reads.
The reason should explain the product case. Do not add convenience wrappers that
make cross-tenant access feel routine.

## Operations

Use `defineOperation(...)` for reusable business actions that project across UI,
server, and MCP, especially destructive preview/confirm/execute flows.

For destructive operations, require all of:

- `kind: 'destructive'`
- stable `id`
- `preview(...)`
- `destructiveOperations` configured in `defineTrellis(...)`
- confirmation and audit tables with the required token/scope/hash indexes
- `identityForwardingFunctionRef` on execute projections that are exposed to
  signed server/MCP transport paths

Do not model destructive MCP tools as plain generic tools. Project operations
through the operation-backed MCP path.

Projection helpers include:

- `executeOperationRef(operation, ref)`
- `transportExecuteOperationRef(operation, ref)`
- `previewOperationRef(operation, ref)`
- `projectOperationRef(operation, projection, ref)`
- `previewOf(operation)`

MCP operation bindings must use real execute/preview projections of the same
operation. Tests reject mismatched refs.

## Features And Visibility

Use `defineFeature(...)` and `composeFeatures(...)` when a feature needs a
declared schema, permissions, tenant/global tables, capabilities, and operations
as app inventory. Keep feature manifests as composition metadata; do not use them
to hide handler behavior.

Use `defineRecordAccess(...)` to attach stable record access decisions to data.
Use `defineRedaction(...)` to remove fields without mutating the input. Prefer
these backend-owned visibility helpers over browser-side recalculation.

## Identity Forwarding

Use `auth: 'trusted'` from Nitro server helpers to create a signed
`_trellisForwarding` envelope for server-to-server identity forwarding. App
business args should not include raw forwarded identity fields.

Use identity-forwarding readers only after verification:

- `getIdentityForwarding(ctx, args?)`
- `getForwardedCaller(ctx, args?)`
- `getForwardedActingFor(ctx, args?)`

Forwarded caller and actingFor payloads are verified signed-envelope metadata,
not public request arguments. A valid envelope verifies the transport path; it
does not grant business authorization by itself.

## Pitfalls

- Do not build DB-policy substitutes for app authorization.
- Do not duplicate backend permission checks in the browser.
- Do not treat webhooks, MCP sessions, or service keys as authorization bypasses.
- Do not preserve old actor-wrapper APIs or compatibility shims when the current
  foundation uses caller/actingFor/appIdentity accessors.
- Do not describe custom public `rls` authoring as current Trellis API. Current
  public policy is handler phases plus `isolation`/`services` runtime
  guardrails.
