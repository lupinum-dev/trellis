# 0012: Type-Safe App Framework For Secure Nuxt And Convex Apps

Status: Proposed
Date: 2026-06-17
Owner: Unassigned
Review basis: Trellis 0.3 runtime, Ginko CMS integration, Trellis examples, external framework survey

## Summary

Trellis should evolve from a collection of secure Convex/Nuxt primitives into a
small opinionated app framework for building secure, reliable, type-safe Nuxt
apps on Convex.

The current Trellis security model has real strengths:

- caller-first backend functions
- explicit public/authenticated/protected lanes
- app identity resolution
- guard and access-context helpers
- public DB default-deny behavior
- destructive operation preview/execute primitives
- signed identity forwarding
- replay protection for trusted transports
- bridge and MCP support
- testing helpers

The current authoring surface also exposes too much framework machinery:

- public access context is modeled as ordinary `public`
- public data policy is declared as global `public.readTables`
- operation transport details leak into app code
- tests construct forwarding envelopes directly
- app handlers repeat `identityForwardingFunctionRef`
- bridge metadata and handler metadata are parallel sources of truth
- replay modes and TTLs appear outside the runtime

This RFC proposes a new product shape:

```ts
export const listPosts = query.public({
  id: 'posts:listPublished',
  reads: ['posts'],
  args: { limit: v.optional(v.number()) },
  returns: v.array(postCardValidator),
  handler: async (ctx, args) => {
    return await ctx.db
      .query('posts')
      .withIndex('by_status', (q) => q.eq('status', 'published'))
      .take(args.limit ?? 20)
  },
})

export const getAccessContext = query.session(
  defineAccessContext({
    id: 'access:get',
    resolve: (ctx) => ctx.appIdentity(),
    permissions,
  }),
)

export const deletePost = operation.destructive({
  id: 'posts:delete',
  guard: canDeletePost,
  reads: ['posts'],
  writes: ['posts'],
  args: { postId: v.id('posts') },
  preview: async (ctx, args) => {
    const post = await ctx.db.get(args.postId)
    if (!post) throw notFound('post')
    return {
      title: `Delete ${post.title}`,
      effects: [{ kind: 'delete', table: 'posts', id: args.postId }],
    }
  },
  execute: async (ctx, args) => {
    await ctx.db.delete(args.postId)
  },
})
```

The rule is:

> App authors declare intent locally. Trellis owns transport machinery.

This keeps security explicit without forcing application code, tests, or agents
to understand forwarding envelope internals.

This RFC is a greenfield target for the next Trellis app-framework shape. The
implementation may land in slices, but the accepted design is a clean cut: once
the new path passes tests in examples and starters, the old authoring path is
deleted instead of kept as a parallel compatibility layer.

Reviewers should read it as one direction with ordered subdecisions:

1. Separate public content from session/access discovery.
2. Move handler capability declarations next to handlers.
3. Treat stable handler ids as the canonical security/audit subject.
4. Keep operation and bridge transport projections framework-owned.
5. Make normal app tests use product-level callers, while keeping low-level
   transport tests available.

The first implementation slice should prove only the first three points:
`query.session`, handler-local `reads` for `query.public`, stable handler ids,
and a small test-client wrapper. Operation and bridge changes should follow
after that slice validates the model.

Clean-cut rules:

- Do not keep global `public.readTables` as the primary authoring path.
- Do not keep `identityForwardingFunctionRef` as a normal handler field.
- Do not expose replay modes, TTLs, or transport purpose in ordinary app tests.
- Do not teach old and new APIs side by side in starters.
- Do not add shims for unreleased internals.
- If a compatibility bridge is needed for a released public API, document its
  removal condition and do not use it in examples.

## External Inspirations

This proposal intentionally borrows from adjacent systems while keeping Convex
as the foundation.

### Convex

Convex functions already provide a strong app-backend unit: queries, mutations,
actions, typed validators, generated API references, and `ctx.auth` inside
functions. Convex documentation places auth access inside functions and expects
authorization decisions to happen in backend code.

References:

- [Convex authentication overview](https://docs.convex.dev/auth/overview)
- [Convex auth in functions](https://docs.convex.dev/auth/functions-auth)

Trellis should not fight this. It should wrap Convex functions with a small
security grammar rather than replacing them with a disconnected service layer.

### tRPC

tRPC's most useful idea is not RPC itself. It is the builder grammar:

- `publicProcedure`
- `protectedProcedure`
- middleware composition
- context refinement
- end-to-end type inference

References:

- [tRPC procedures](https://trpc.io/docs/server/procedures)
- [tRPC middlewares](https://trpc.io/docs/server/middlewares)
- [tRPC authorization](https://trpc.io/docs/server/authorization)

Trellis should borrow the named-lane ergonomics, but keep Convex validators and
Convex generated function refs as the type backbone.

### Nuxt

Nuxt gives a clear app shape: server routes, route middleware, plugins,
auto-imported composables, SSR, and app-level conventions.

References:

- [Nuxt server directory](https://nuxt.com/docs/4.x/directory-structure/server)
- [Nuxt middleware directory](https://nuxt.com/docs/4.x/directory-structure/app/middleware)

Trellis should feel native inside Nuxt: backend policies should map into
route/access composables, query composables, mutation composables, operation
workflows, and SSR-safe helpers.

### Supabase RLS

Supabase's RLS model is valuable as a comparison: it pushes policy down into the
database and makes exposed browser data access safe through row policies.

References:

- [Supabase row level security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase securing your data](https://supabase.com/docs/guides/database/secure-data)

Convex is not Postgres RLS, and Trellis should not invent a second database
policy language. The useful lesson is defense in depth: declared capabilities
should be enforced by the runtime and tested as invariants.

### Hono RPC

Hono's RPC client demonstrates a useful type-safety pattern: share server
contract types with the client without hand-written client DTOs.

Reference:

- [Hono RPC](https://hono.dev/docs/guides/rpc)

Trellis already has Convex generated API refs. The framework should preserve
that type flow rather than adding a second client contract format.

### Vue Composables And VueUse

Vue's composable model encourages small functions that encapsulate state,
lifecycle, and cleanup. VueUse guidelines emphasize predictable naming, options
objects, SSR awareness, and type-friendly APIs.

References:

- [Vue composables](https://vuejs.org/guide/reusability/composables.html)
- [VueUse guidelines](https://vueuse.org/guidelines)

Trellis client APIs should look like composables:

```ts
const access = useTrellisAccess()
const posts = useTrellisQuery(api.posts.listPublished, { limit: 20 })
const savePost = useTrellisMutation(api.posts.save)
const deletePost = useTrellisOperation(api.posts.deletePost)
```

### TanStack Query

TanStack Query keeps async UI state explicit: pending, success, error,
mutation, invalidation, optimistic update, rollback.

References:

- [TanStack Vue Query mutations](https://tanstack.com/query/v4/docs/framework/vue/guides/mutations)
- [TanStack Query updates from mutation responses](https://tanstack.com/query/v4/docs/framework/vue/guides/updates-from-mutation-responses)

Convex has live queries, so Trellis should not clone TanStack Query. It should
borrow the clear mutation state and optimistic-update ergonomics.

### Zod

Zod's lesson is schema-as-contract: define runtime validation once and infer
static types from that schema.

Reference:

- [Zod introduction](https://zod.dev/)

Convex validators already do this for Convex functions. Trellis should use that
instead of inventing another schema layer.

### Blitz.js

Blitz popularized resolver pipelines for full-stack apps: validation,
middleware, session/context, and authorization are composed around queries and
mutations.

References:

- [Blitz middleware](https://blitzjs.com/docs/middleware)
- [Blitz authorization](https://blitzjs.com/docs/authorization)

Trellis should borrow the lesson that backend functions can be app-level units
with structured admission, but avoid making every handler manually assemble a
middleware pipeline.

### RedwoodJS

Redwood's RBAC story combines web-side auth state with API-side service checks
like `requireAuth()` and roles. Its useful lesson is the explicit split between
UI access affordances and backend enforcement.

Reference:

- [RedwoodJS role-based access control](https://docs.redwoodjs.com/docs/how-to/role-based-access-control-rbac/)

Trellis should keep Nuxt route protection as UX, not authority. Backend lanes
and guards remain the security boundary.

### ZenStack

ZenStack adds policy declarations to Prisma's model layer, including access
rules that can reference the current user.

References:

- [ZenStack access policy](https://zenstack.dev/docs/2.x/the-complete-guide/part1/access-policy)
- [ZenStack Prisma authorization overview](https://zenstack.dev/blog/prisma-auth)

This is the strongest alternative to Trellis's handler-local capability model.
Trellis should not add a model-policy language in this RFC. The Convex function
is the unit of authorization. Handler-local `reads` and `writes` are
capability declarations, not row-level policy rules.

### CASL

CASL models user abilities in a way that can be shared across UI and backend
checks.

Reference:

- [CASL authorization](https://casl.js.org/)

Trellis should learn from CASL's ability vocabulary and UI/API consistency, but
avoid requiring an ability engine as the core authorization model. Trellis
permissions and guards should remain plain TypeScript functions.

### Convex Helpers Custom Functions

Convex Helpers demonstrates the exact family of technique Trellis should build
on: custom function builders can run auth before handlers, add data to `ctx`,
replace `ctx.db`, and consume client-provided auth/session args before the
handler sees them.

References:

- [Convex custom functions](https://stack.convex.dev/custom-functions)
- [Convex Helpers README](https://github.com/get-convex/convex-helpers)
- [Convex wrappers as middleware](https://stack.convex.dev/wrappers-as-middleware-authentication)

Trellis should treat this as implementation validation. The proposed lanes are
not alien to Convex; they are an opinionated product layer over custom function
patterns.

### NestJS Guards

NestJS separates middleware from guards. Guards decide whether a specific route
handler should run and have access to handler execution context.

References:

- [NestJS guards](https://docs.nestjs.com/guards)
- [NestJS authorization](https://docs.nestjs.com/security/authorization)

Trellis should borrow the handler-aware guard boundary. It should not borrow
decorator-heavy class/controller ceremony.

### Next.js Server Actions And Data Security

Next.js documentation emphasizes that page-level checks do not protect server
actions; server-side mutations must re-verify authorization at the mutation
boundary.

References:

- [Next.js authentication guide](https://nextjs.org/docs/app/guides/authentication)
- [Next.js data security guide](https://nextjs.org/docs/app/guides/data-security)
- [Next.js server actions and mutations](https://nextjs.org/docs/13/app/building-your-application/data-fetching/server-actions-and-mutations)

Trellis should use this as support for backend lane enforcement and against
route-middleware-only auth.

### Effect

Effect models typed requirements through services, context, and layers. That is
useful inspiration for "this handler has these requirements" as a type-level
idea.

References:

- [Effect services](https://effect.website/docs/requirements-management/services/)
- [Effect platform](https://github.com/Effect-TS/effect/tree/main/packages/platform)

Trellis should borrow the clarity of typed requirements, but reject a full
Effect-style runtime requirement system. Convex handlers should stay ordinary
async TypeScript functions.

### Evaluation Matrix

| System         | Steal                                                                   | Reject                                        | Why                                              |
| -------------- | ----------------------------------------------------------------------- | --------------------------------------------- | ------------------------------------------------ |
| Convex         | generated function refs, validators, function-first auth, realtime data | replacing Convex execution model              | Trellis should be Convex-native                  |
| Convex Helpers | custom builders, ctx enrichment, db wrapping                            | generic helper soup in app code               | Trellis should productize the pattern            |
| tRPC           | named procedures, middleware, context refinement                        | router/RPC contract replacing Convex API refs | lanes should feel familiar and typed             |
| Blitz          | resolver pipeline, validation+auth composition                          | framework-specific zero-API routing model     | Trellis already has Convex as transport          |
| Redwood        | backend `requireAuth`, clear API-side enforcement                       | GraphQL directive/service split               | backend enforcement must remain primary          |
| Supabase       | defense in depth, explicit data policy                                  | Postgres RLS clone                            | Convex handlers are the policy unit              |
| ZenStack       | policy near data model as an alternative to study                       | model-level policy DSL                        | would create a second source of truth            |
| CASL           | ability vocabulary, UI/API consistency                                  | required ability engine                       | app guards should stay plain functions           |
| Hono RPC       | server contract drives client types                                     | second RPC layer                              | Convex generated refs already solve this         |
| VueUse         | composable naming, SSR awareness, options objects                       | generic composable sprawl                     | Trellis composables should be few and app-shaped |
| TanStack Query | mutation state vocabulary                                               | query cache clone                             | Convex owns live query semantics                 |
| NestJS         | handler-aware guards                                                    | decorators/controllers                        | Trellis should stay function-builder based       |
| Next.js        | server mutation authorization guidance                                  | page-level auth as sufficient                 | every backend handler must enforce auth          |
| Effect         | typed requirements idea                                                 | full effect/layer runtime                     | too much abstraction for Convex apps             |

Design conclusion:

Trellis should be closest to Convex custom functions plus tRPC-style named
procedure builders, with Nuxt/Vue composables on the client. It should reject
model-policy DSLs, decorator frameworks, and generic service layers.

## Problem

Trellis is powerful, but current app code can feel like framework internals are
leaking.

From Ginko CMS, representative pain points are:

```ts
export const getAccessContext = callerQuery.public({
  ...getAccessContextDefinition,
  identityForwardingFunctionRef: 'members:getAccessContext',
})
```

This is semantically confusing. The function is not public content. It is a
session/access probe that may return `null`, bootstrap state, or member
permissions. Marking it `public` makes humans and agents ask whether members
are publicly readable.

```ts
public: {
  readTables: [
    'assets',
    'cmsSettings',
    'collections',
    'contentAssetRefs',
    'entries',
    'publicEntries',
    'publicRoutes',
    'siteData',
  ],
}
```

This is secure in the sense that it is explicit, but it is not local. The real
policy is handler-specific: public page reads should use published projection
surfaces. A global table allowlist makes canonical tables look generally safe
for all public handlers.

```ts
const purpose =
  kind === 'mutation' && functionRef.endsWith('TransportExecute') ? 'operation-execute' : kind
const replayMode =
  purpose === 'operation-execute'
    ? 'operation-confirmation'
    : kind === 'mutation'
      ? 'jti-redemption'
      : kind === 'action'
        ? 'domain-idempotency'
        : undefined
return createIdentityForwardingEnvelopeArgs({
  args: appArgs,
  caller,
  transport: 'server',
  operation: kind,
  purpose,
  functionRef,
  key,
  keyId: 'default',
  ...(replayMode ? { replayMode } : {}),
  ttlMs: purpose === 'operation-execute' ? 10_000 : kind === 'query' ? 60_000 : 30_000,
})
```

This belongs inside Trellis. App tests should express product behavior, not
transport signing and replay policy.

## Design Goals

1. Keep Convex as the execution model.
2. Keep Nuxt as the app integration model.
3. Make security intent local to handlers.
4. Hide transport ceremony behind framework helpers.
5. Preserve end-to-end type inference.
6. Make invalid states hard to represent.
7. Keep one source of truth for each public contract.
8. Keep domain rules in app code.
9. Keep framework enforcement in Trellis runtime code.
10. Make the safe path the obvious path for humans and agents.

## Non-Goals

- Do not build a CMS-specific framework.
- Do not add a second database policy language.
- Do not replace Convex generated API refs.
- Do not make authorization depend on frontend route middleware.
- Do not remove low-level escape hatches, but make them explicit.
- Do not require component bridge or MCP concepts for ordinary SaaS apps.
- Do not keep old and new handler contracts side by side.
- Do not add generic repository/service adapters.
- Do not add a model-level policy DSL.
- Do not wrap every Convex feature.
- Do not implement full typed DB narrowing in Phase 0.
- Do not make handler capability declarations a second source of row-level
  authorization truth.

## Core Mental Model

Trellis should teach five generic concepts.

### Caller

The raw source of a request.

Examples:

- anonymous browser user
- authenticated user
- service account
- MCP key
- deploy key
- trusted server route

### App Identity

The app-specific identity resolved from the caller.

Examples:

- workspace member
- organization admin
- CMS member
- billing customer
- bot identity
- `null`

### Lane

The callable shape and minimum identity guarantee.

Recommended lanes:

- `public`
- `session`
- `authenticated`
- `protected`
- `service`
- `internal`
- `unsafe`

### Capability

The data or side-effect authority granted to a handler.

Examples:

- `reads`
- `writes`
- `publicWrite`
- `crossTenant`
- `storage`
- `schedule`
- `serviceAccess`

### Operation

A workflow with preview, confirmation, audit, replay, and execute semantics.

Examples:

- delete project
- publish entry
- revoke API key
- purge asset
- retry job

## Proposed API

### Runtime Setup

Runtime setup should define app-wide hooks and durable infrastructure only.

```ts
export const trellis = defineTrellis(
  { query, mutation, action, internalQuery, internalMutation },
  {
    caller,
    appIdentity: async (ctx, args, caller) => getAppIdentity(ctx, caller),
    replay: {
      table: 'trustedReplay',
    },
    destructiveOperations: {
      confirmationTable: 'destructiveConfirmations',
      auditTable: 'destructiveAuditLog',
    },
    public: {
      default: 'deny',
      maxRows: 1000,
    },
  },
)

export const { query, mutation, action, operation, unsafe } = trellis
```

Runtime setup should not be where most per-handler policy is maintained.

### Public Query

Public means anonymous public data.

```ts
export const listPublishedPosts = query.public({
  id: 'posts:listPublished',
  reads: ['posts'],
  args: {
    limit: v.optional(v.number()),
  },
  returns: v.array(postCardValidator),
  handler: async (ctx, args) => {
    return await ctx.db
      .query('posts')
      .withIndex('by_status', (q) => q.eq('status', 'published'))
      .take(args.limit ?? 20)
  },
})
```

Rules:

- `ctx.db.query(table)` is allowed only for declared `reads`.
- `ctx.db.get(id)` is allowed only when the table is in `reads`.
- `ctx.db.insert/patch/replace/delete` are unavailable unless a public write
  capability is declared.
- `ctx.identity` is not guaranteed.
- handler must validate all externally visible filtering rules.

### Session Query

Session means access discovery. It is callable before the app knows whether the
caller is a member of anything.

```ts
export const getAccessContext = query.session(
  defineAccessContext({
    id: 'access:get',
    resolve: (ctx) => ctx.appIdentity(),
    permissions,
  }),
)
```

Rules:

- callable by anonymous users
- may return `null`
- may resolve auth and app identity
- may read app identity tables through the app identity resolver
- is not public content
- `ctx.db` is unavailable in Phase 0
- app identity resolver access is not a general private-data bypass
- must not expose arbitrary private rows
- should return access/session-shaped data, not domain list/detail data

This is the missing lane that removes the `members.getAccessContext` public
confusion.

Hard boundary:

```ts
query.session({
  id: 'access:get',
  handler: async (ctx) => {
    await ctx.db.query('members').collect()
    // Rejected: session handlers use ctx.appIdentity(), not arbitrary ctx.db reads.
  },
})
```

Session exists so apps can answer "who is calling and what bootstrap/access
state applies?" It is not a softer protected lane.

Future RFCs may consider session-local `reads`, but this RFC rejects them for
the clean-cut first implementation. The lane should be narrow before it becomes
flexible.

### Authenticated Query

Authenticated means a valid caller exists.

```ts
export const listProjects = query.authenticated({
  id: 'projects:list',
  reads: ['projects'],
  args: {},
  returns: v.array(projectValidator),
  handler: async (ctx) => {
    return await ctx.db
      .query('projects')
      .withIndex('by_owner', (q) => q.eq('ownerId', ctx.identity.userId))
      .collect()
  },
})
```

Rules:

- `ctx.identity` is non-null.
- no app-specific permission is implied.
- use for "signed in user can read their own data" style handlers.

### Protected Query Or Mutation

Protected means app identity plus guard.

```ts
export const inviteMember = mutation.protected({
  id: 'members:invite',
  guard: canManageMembers,
  reads: ['members'],
  writes: ['members'],
  args: inviteMemberArgs.args,
  returns: memberValidator,
  handler: async (ctx, args) => {
    const memberId = await ctx.db.insert('members', {
      workspaceId: ctx.identity.workspaceId,
      email: args.email,
      role: args.role,
      invitedBy: ctx.identity.userId,
      createdAt: Date.now(),
    })

    const member = await ctx.db.get(memberId)
    if (!member) throw new Error('Member insert did not return a readable row.')
    return member
  },
})
```

Rules:

- guard executes before handler.
- guard can refine context when appropriate.
- declared reads/writes constrain `ctx.db`.
- guard failure returns a structured authorization error.

### Service Lane

Service means non-user trusted callers.

```ts
export const syncBillingCustomer = mutation.service({
  id: 'billing:syncCustomer',
  service: 'billing-webhook',
  writes: ['customers'],
  args: syncCustomerArgs,
  returns: v.null(),
  handler: async (ctx, args) => {
    await upsertCustomer(ctx, args)
    return null
  },
})
```

Rules:

- service identity is validated by Trellis.
- replay/idempotency is handled by Trellis when the declaration requires it.
- app code should not parse forwarding envelopes.
- service declarations must specify whether duplicate delivery is rejected,
  idempotent, or allowed.

### Destructive Operation

Operations should be one app export.

```ts
export const deleteProject = operation.destructive({
  id: 'projects:delete',
  guard: canDeleteProject,
  reads: ['projects', 'tasks'],
  writes: ['projects', 'tasks'],
  args: {
    projectId: v.id('projects'),
  },
  preview: async (ctx, args) => {
    const project = await ctx.db.get(args.projectId)
    if (!project) throw notFound('project')

    const taskCount = await ctx.db
      .query('tasks')
      .withIndex('by_project', (q) => q.eq('projectId', args.projectId))
      .collect()

    return {
      title: `Delete ${project.name}`,
      severity: taskCount.length > 0 ? 'danger' : 'warning',
      effects: [
        { kind: 'delete', table: 'projects', id: args.projectId },
        { kind: 'deleteMany', table: 'tasks', count: taskCount.length },
      ],
    }
  },
  execute: async (ctx, args) => {
    await deleteProjectAndTasks(ctx, args.projectId)
  },
})
```

Generated or returned callable surface:

```ts
api.projects.deleteProject.preview
api.projects.deleteProject.execute
```

or, if Convex export constraints require flat exports:

```ts
api.projects.previewDeleteProject
api.projects.executeDeleteProject
```

But app authors should define one operation.

Relationship to the current operation API:

| Current Trellis                                   | Proposed shape                                               | Same runtime invariant                                         | Changed authoring surface                          |
| ------------------------------------------------- | ------------------------------------------------------------ | -------------------------------------------------------------- | -------------------------------------------------- |
| `defineOperation(...)`                            | `operation.destructive(...)`                                 | one operation owns preview and execute semantics               | operation builder is attached to the runtime       |
| `mutation.workspace(op)` or equivalent projection | generated/returned execute projection                        | execute reruns lane, guard, token, drift, and audit checks     | app code no longer manually exports execute        |
| `previewOf(op)`                                   | generated/returned preview projection                        | preview is side-effect-free and produces confirmation material | app code no longer manually exports preview        |
| `_confirmationToken` in execute args              | confirmation passed through operation composable/test client | token is still bound and redeemed by runtime                   | normal UI/test code does not hand-shape token args |

The proposal is a syntax and source-of-truth change first. It must preserve the
existing destructive operation security invariants.

## Type Safety Specification

### Table Names

`reads` and `writes` must be typed from `TableNamesInDataModel<DataModel>`.

```ts
reads: ['projects', 'members']
```

Typos must fail:

```ts
reads: ['project']
// Type error when DataModel has only "projects".
```

### Args

Args use Convex validators.

```ts
args: {
  projectId: v.id('projects'),
}
```

Handler args infer from validators:

```ts
handler: async (ctx, args) => {
  args.projectId
  // Id<'projects'>
}
```

### Returns

Returns use Convex validators.

```ts
returns: projectValidator
```

The handler return type must satisfy the validator's inferred type.

### Context Refinement

Lane builders refine context.

```ts
query.public({
  handler: async (ctx) => {
    ctx.identity
    // absent or nullable
  },
})

query.authenticated({
  handler: async (ctx) => {
    ctx.identity.userId
    // non-null
  },
})

query.session({
  handler: async (ctx) => {
    const identity = await ctx.appIdentity()
    // AppIdentity | null
  },
})
```

### DB Capability Typing

At runtime Trellis must enforce capabilities.

Initial type safety is intentionally narrower than runtime enforcement:

- `reads` and `writes` autocomplete and typecheck table names.
- handler args and returns infer from Convex validators.
- lane builders refine identity context.
- runtime wrappers enforce DB access.

The first implementation does not require fully narrowing `ctx.db` methods by declared tables.
That is a desirable follow-up only if a prototype proves it works without
hurting Convex index/query ergonomics, trigger wrappers, `ctx.db.get(id)`,
storage helpers, and generated `Id<Table>` types.

Future type-level DB narrowing should make common mistakes visible:

```ts
query.public({
  reads: ['posts'],
  handler: async (ctx) => {
    await ctx.db.query('users').collect()
    // Type error if typed DB capability can be narrowed.
    // Runtime error regardless.
  },
})
```

Runtime enforcement is mandatory. Type-level narrowing is desirable but cannot
be the only boundary.

### Stable IDs

`id` is a stable security and audit identifier.

It is the canonical Trellis subject for:

- trusted forwarding validation
- bridge metadata
- operation audit
- inventory and doctor output
- security-contract generation
- test-client transport inference

Rules:

- every Trellis handler must provide `id`
- ids are unique within a Trellis runtime
- ids are stable across refactors unless the public/security contract changes
- ids are not derived from a display label
- ids are not the primary source of args/returns types
- duplicate ids fail at boot, test setup, or static inventory validation

Clean cut:

- `id` replaces `identityForwardingFunctionRef` as the normal handler field.
- examples and starters must use `id`.
- low-level forwarding code consumes `id`.
- `identityForwardingFunctionRef` is deleted from unreleased/internal paths once
  the new validation passes.

Open implementation detail:

- Convex's actual generated function path may differ from `id`
- forwarded envelopes should validate against the Trellis `id`, not whatever
  string a caller derives from generated API object internals

Binding invariant:

- Trellis computes or records `id -> exact registered handler` during handler
  registration, test setup, or static inventory.
- a forwarded call is accepted only when the invoked Convex function is bound to
  the expected Trellis `id`
- moving an `id` to a different handler without updating the inventory/test
  expectation fails closed
- duplicate ids fail before serving requests

### Operation Types

Preview and execute share args.

```ts
operation.destructive({
  args: { id: v.id('posts') },
  preview: async (_ctx, args) => {
    args.id
    // Id<'posts'>
  },
  execute: async (_ctx, args) => {
    args.id
    // same type
  },
})
```

Confirmation token args are framework-added, not part of domain args.

## Client Composables

Trellis composables should be thin where Convex is already strong and
opinionated only where Trellis adds app semantics.

They should not replace Convex's generated API references. They should wrap
them to add:

- access-context defaults
- SSR-safe Nuxt integration
- consistent pending/error/data state
- auth recovery behavior
- operation preview/execute workflow
- confirmation handling
- optional optimistic mutation helpers

### Access

```ts
const access = useTrellisAccess()

access.pending
access.ctx
access.can('posts:create')
```

The default access query is configured by the Nuxt module.

### Query

```ts
const posts = useTrellisQuery(api.posts.listPublished, {
  limit: 20,
})

posts.data
posts.pending
posts.error
```

The return type is inferred from the Convex function reference.

### Mutation

```ts
const invite = useTrellisMutation(api.members.invite)

await invite.mutate({
  email: 'a@example.com',
  role: 'admin',
})
```

Mutation state:

- `pending`
- `error`
- `data`
- `mutate`
- `reset`

### Operation

```ts
const deleteProject = useTrellisOperation(api.projects.deleteProject)

const preview = await deleteProject.preview({ projectId })
await deleteProject.execute({
  projectId,
  confirmation: preview.confirmation,
})
```

Operation state:

- `previewPending`
- `executePending`
- `previewError`
- `executeError`
- `lastPreview`

The composable should make confirmation flow explicit without exposing replay
tokens or transport details.

Non-goal:

- Do not clone TanStack Query.
- Do not introduce a second client contract format.
- Do not hide the Convex function reference.

## Before And After: Traditional SaaS

### Access Context

Before:

```ts
const accessContext = defineAccessContext({
  resolve: async (ctx) => await ctx.appIdentity(),
  permissions,
})

export const getAccessContext = query.public({
  ...accessContext,
  identityForwardingFunctionRef: 'members:getAccessContext',
})
```

After:

```ts
export const getAccessContext = query.session(
  defineAccessContext({
    id: 'members:getAccessContext',
    resolve: (ctx) => ctx.appIdentity(),
    permissions,
  }),
)
```

Why better:

- the lane name matches the purpose
- no implication that member data is public
- access context remains callable before membership exists
- app identity resolution stays central

### Public Blog

Before:

```ts
const runtime = defineTrellis(
  { query, mutation },
  {
    public: {
      readTables: ['posts', 'authors', 'settings'],
    },
  },
)

export const listPublishedPosts = query.public({
  args: { limit: v.number() },
  returns: v.array(postCardValidator),
  handler: async (ctx, args) => {
    return await ctx.db
      .query('posts')
      .withIndex('by_status', (q) => q.eq('status', 'published'))
      .take(args.limit)
  },
})
```

After:

```ts
export const listPublishedPosts = query.public({
  id: 'posts:listPublished',
  reads: ['posts'],
  args: { limit: v.number() },
  returns: v.array(postCardValidator),
  handler: async (ctx, args) => {
    return await ctx.db
      .query('posts')
      .withIndex('by_status', (q) => q.eq('status', 'published'))
      .take(args.limit)
  },
})
```

Why better:

- read policy is local
- runtime still enforces it
- reviewers can reason about the handler in one file
- agents do not need to chase global config

### Dashboard Query

Before:

```ts
export const listProjects = query.protected({
  identityForwardingFunctionRef: 'projects:listProjects',
  args: {},
  guard: isAuthenticated,
  returns: v.array(projectValidator),
  handler: async (ctx) => {
    const identity = await ctx.appIdentity()
    return await ctx.db
      .query('projects')
      .withIndex('by_owner', (q) => q.eq('ownerId', identity.userId))
      .collect()
  },
})
```

After:

```ts
export const listProjects = query.authenticated({
  id: 'projects:listProjects',
  args: {},
  returns: v.array(projectValidator),
  handler: async (ctx) => {
    const identity = await ctx.appIdentity()
    return await ctx.db
      .query('projects')
      .withIndex('by_owner', (q) => q.eq('ownerId', identity.userId))
      .collect()
  },
})
```

Why better:

- `authenticated` communicates the guarantee directly
- no redundant `isAuthenticated` guard
- identity is non-null in the handler
- reads are local

### Admin Mutation

Before:

```ts
export const inviteMember = mutation.protected({
  identityForwardingFunctionRef: 'members:inviteMember',
  args: inviteMemberArgs,
  guard: canManageMembers,
  returns: memberValidator,
  handler: async (ctx, args) => {
    const identity = await ctx.appIdentity()
    const id = await ctx.db.insert('members', {
      workspaceId: identity.workspaceId,
      email: args.email,
      role: args.role,
      invitedBy: identity.userId,
      createdAt: Date.now(),
    })
    return await ctx.db.get(id)
  },
})
```

After:

```ts
export const inviteMember = mutation.protected({
  id: 'members:inviteMember',
  guard: canManageMembers,
  writes: ['members'],
  args: inviteMemberArgs,
  returns: memberValidator,
  handler: async (ctx, args) => {
    const id = await ctx.db.insert('members', {
      workspaceId: ctx.identity.workspaceId,
      email: args.email,
      role: args.role,
      invitedBy: ctx.identity.userId,
      createdAt: Date.now(),
    })
    return await ctx.db.get(id)
  },
})
```

Why better:

- the mutation declares write authority
- identity is lane-refined
- stable id replaces forwarding-specific metadata

### Test

Before:

```ts
const functionRef = getFunctionRef(fn)
const purpose =
  kind === 'mutation' && functionRef.endsWith('TransportExecute') ? 'operation-execute' : kind
const replayMode =
  purpose === 'operation-execute'
    ? 'operation-confirmation'
    : kind === 'mutation'
      ? 'jti-redemption'
      : kind === 'action'
        ? 'domain-idempotency'
        : undefined

return createIdentityForwardingEnvelopeArgs({
  args,
  caller,
  transport: 'server',
  operation: kind,
  purpose,
  functionRef,
  key,
  keyId: 'default',
  replayMode,
  ttlMs,
})
```

After:

```ts
const ctx = createTrellisTestContext({ schema, modules })

await ctx.asUser('user-1').query(api.projects.listProjects, {})
await ctx.asUser('admin-1').mutation(api.members.inviteMember, args)

const op = ctx.asUser('owner-1').operation(api.projects.deleteProject)
const preview = await op.preview({ projectId })
await op.execute({ projectId, confirmation: preview.confirmation })
```

Why better:

- tests express product behavior
- framework tests cover forwarding/replay details
- application tests stop copying security protocol internals

Advanced transport tests still need lower-level controls. The proposed split is:

```ts
// Normal app behavior test.
await ctx.asUser('admin-1').mutation(api.members.inviteMember, args)

// Explicit transport/replay boundary test.
await ctx
  .transport({
    caller,
    transport: 'mcp',
    replay: 'domain-idempotency',
  })
  .mutation(api.posts.comment, args)
```

`asUser`, `asService`, and `operation` should be the default app-test API.
`transport(...)` or equivalent remains available for tests that intentionally
exercise forwarding, replay, or MCP/server boundaries.

## Before And After: Ginko CMS

### Access Context

Before:

```ts
export const getAccessContext = callerQuery.public({
  ...getAccessContextDefinition,
  identityForwardingFunctionRef: 'members:getAccessContext',
})
```

After:

```ts
export const getAccessContext = callerQuery.session(
  defineAccessContext({
    id: 'members:getAccessContext',
    resolve: (ctx) => ctx.appIdentity(),
    permissions,
  }),
)
```

### Public Content

Before:

```ts
public: {
  readTables: [
    'assets',
    'cmsSettings',
    'collections',
    'contentAssetRefs',
    'entries',
    'publicEntries',
    'publicRoutes',
    'siteData',
  ],
}
```

After:

```ts
export const page = callerQuery.public({
  id: 'public:page',
  reads: ['publicEntries', 'publicRoutes', 'siteData'],
  args: pageArgs.args,
  returns: ginkoPageResultValidator,
  handler: async (ctx, args) => {
    return await readPublicPage(ctx, args)
  },
})

export const getAssetUrl = callerQuery.public({
  id: 'assets:getAssetUrl',
  reads: ['assets'],
  args: getAssetUrlArgs.args,
  returns: v.union(v.string(), v.null()),
  handler: async (ctx, args) => {
    return await readPublicAssetUrl(ctx, args)
  },
})
```

This does not mean `assets` is broadly public. It means this handler has a
declared read capability for `assets`, and its handler logic must prove only
public-safe asset URLs are returned.

### Bridge

Before:

```ts
export const entries = [
  {
    exportName: 'page',
    operation: 'query',
    component: 'page',
    args: pageArgs.args,
    returns: ginkoPageResultValidator,
  },
] as const

export const page = callerQuery.public({
  identityForwardingFunctionRef: 'public:page',
  args: pageArgs.args,
  returns: ginkoPageResultValidator,
  handler,
})
```

After:

```ts
export const page = callerQuery.public({
  id: 'public:page',
  bridge: {
    exportName: 'page',
  },
  reads: ['publicEntries', 'publicRoutes'],
  args: pageArgs.args,
  returns: ginkoPageResultValidator,
  handler,
})
```

or:

```ts
export const entries = defineBridgeEntries({
  page,
  list,
  nav,
})
```

One source of truth must win. The RFC does not require exactly one syntax, but
it rejects separate hand-maintained function refs and bridge refs.

## Security Model

### Defaults

- public reads default deny
- public writes default deny
- authenticated lanes require identity
- protected lanes require guard
- destructive operations require preview and confirmation
- trusted writes require replay protection
- raw DB access is an explicit unsafe escape hatch

### Local Capabilities

Every handler capability is local:

```ts
reads: ['projects']
writes: ['members']
crossTenant: { reads: ['auditLog'] }
publicWrite: { tables: ['contactMessages'], reason: 'Contact form submission.' }
```

The runtime enforces these declarations.

Clean-cut Phase 0 scope:

- `reads` is enforced for `query.public`.
- `query.session` does not expose `ctx.db`.
- `writes`, `publicWrite`, `crossTenant`, `storage`, and scheduler
  capabilities remain target-state concepts until each has a focused prototype.

This prevents the first implementation from turning every normal protected
mutation into a noisy capability manifest before the ergonomics are proven.

### Defense In Depth

Trellis should provide:

- runtime DB wrappers
- static inventory extraction
- doctor checks
- tests for capability violations
- security contract generation
- optional CI gate for unsafe/escape usage

### Public Data Rules

Public data handlers must be explicit.

Good:

```ts
query.public({
  reads: ['publishedPosts'],
  handler,
})
```

Risky:

```ts
query.public({
  reads: ['posts'],
  handler,
})
```

Allowed only when the handler proves row-level public filtering.

Best for complex domains:

- publish into public projection tables
- public handlers read projections
- protected handlers read canonical/draft tables

### Session Rules

Session handlers may read identity tables as part of identity resolution, but
must not become arbitrary private data endpoints.

Examples:

- access context
- current user profile summary
- onboarding state

Non-examples:

- list members
- read billing invoices
- read workspace settings

### Replay Rules

Replay mode names are framework internals.

App code should declare:

```ts
mutation.service({ replay: 'idempotent' })
operation.destructive({ ... })
```

Trellis maps those declarations to concrete envelope claims, storage rows, and
redemption behavior.

## Agentic Experience

LLM agents work best when intent is local, names are literal, and invariants are
expressed in code close to the behavior.

### Current Agent Pain

An agent editing a Ginko CMS handler may need to inspect:

- `functions.ts` for global read tables
- handler file for lane and guard
- bridge file for exported function metadata
- tests for forwarding envelope semantics
- Trellis runtime for replay behavior
- generated component API for actual function refs

That is too much for routine edits.

### Proposed Agent Flow

An agent opens one handler:

```ts
export const saveDraft = mutation.protected({
  id: 'editor:saveDraft',
  guard: canEditEntries,
  reads: ['entries'],
  writes: ['entries'],
  args: saveDraftArgs.args,
  returns: entryValidator,
  handler,
})
```

The agent can answer:

- who can call this?
- what data can it read?
- what data can it write?
- what validates args?
- what validates returns?
- what permission applies?
- where is the side effect?

This is the right unit of reasoning.

### Why Agents Prefer This

- fewer cross-file source-of-truth jumps
- literal lane names
- local capability declarations
- stable ids
- typed args and returns
- generated client refs
- test helpers that express product actions
- fewer hidden conventions like `TransportExecute`

### Why Humans Still Understand This

The proposal is not magic. It is explicit:

```ts
lane + id + args + returns + reads / writes + guard + handler
```

That is more understandable than:

```ts
global config + handler metadata + bridge metadata + forwarding metadata
```

## Implementation Plan

### Phase 0: Prototype The Keystone Slice

Prototype in Trellis and one consumer fixture before broad implementation:

- `query.session`
- `query.public({ reads })`
- required `id`
- app-test helper that hides forwarding for ordinary user calls

Acceptance:

- current access-context behavior can move from `public` to `session`
- one public query can move from global `public.readTables` to local `reads`
- tests prove undeclared public reads fail
- tests prove app tests no longer need replay/TTL/function-ref details
- no operation or bridge API redesign is required for this phase

### Phase 1: Add New Lanes

Add:

- `query.session`
- `query.authenticated`
- `mutation.authenticated`
- `mutation.service`

Keep existing lanes initially.

Acceptance:

- session lane can implement current access context behavior
- authenticated lane refines `ctx.identity`
- tests cover anonymous, authenticated, and protected behavior
- session `ctx.db` is unavailable or constrained unless `reads` are declared

### Phase 2: Add Handler Capabilities

Add:

- `reads`

Start with public read runtime enforcement.

Acceptance:

- public handler cannot read undeclared table
- duplicate/blank table names fail validation
- table names autocomplete and typecheck from `DataModel`
- session handlers do not expose raw `ctx.db`
- writes/publicWrite/crossTenant are not implemented until separate focused
  prototypes prove ergonomics
- full DB method narrowing is explicitly out of scope unless prototyped

### Phase 3: Delete Global Public Read Authoring

Once handler-local `reads` passes in examples and starters:

- delete global `public.readTables` as the normal authoring path
- keep only generated inventory/diagnostics output
- make doctor fail public handlers that rely on undeclared table access

Target:

- examples and starters use handler `reads`
- docs stop teaching global `readTables` as the primary authoring path
- no new code path supports both global and local policy as equivalent sources

### Phase 4: Operation Builder

Add:

```ts
operation.destructive({ preview, execute })
```

Generate or return preview/execute exports using existing internals.

Acceptance:

- one source operation definition
- confirmation and audit behavior preserved
- current destructive operation tests port cleanly
- existing operation docs map clearly to the new builder

### Phase 5: Test Client

Add:

```ts
createTrellisTestContext(...)
ctx.asUser(...)
ctx.asService(...)
ctx.asCaller(...)
ctx.asUser('u').operation(...)
```

The test client owns forwarding envelopes and replay choices.

Acceptance:

- application tests do not import `createIdentityForwardingEnvelopeArgs`
- replay-specific tests still can use lower-level APIs
- instance-local forwarding keys avoid process env leakage
- transport tests use an explicit advanced helper rather than the default app
  caller helper

### Phase 6: Stable Handler IDs

Add `id` to handler metadata.

Use it for:

- identity forwarding expected function ref
- bridge metadata
- operation audit
- inventory
- doctor output

Acceptance:

- duplicate ids fail
- forwarded calls validate against id
- apps no longer hand-write `identityForwardingFunctionRef`
- generated inventory can list every handler by id, lane, reads, writes, guard,
  and operation metadata

### Phase 7: Bridge Integration

Bridge should consume handler metadata or define bridge entries from handler
objects.

Acceptance:

- one source of truth for export name, args, returns, and function id
- Ginko-style bridge no longer duplicates refs

### Phase 8: Docs And Starters

Update:

- getting started
- signed-in todo
- workspace starter
- MCP reference
- destructive operations docs
- testing docs
- API reference

Acceptance:

- examples teach lanes and capabilities
- low-level forwarding docs move to advanced/server transport

## Migration Strategy

### Existing Apps

Greenfield target and pre-1.0/internal apps should hard-cut to the new lanes.
Released public APIs may need a short deprecation release, but the maintained
examples and starters should not keep old and new paths side by side.

Recommended order:

1. migrate access context to `query.session`
2. add handler `id`
3. add `reads` to public handlers
4. delete global `public.readTables` authoring and replace it with generated
   inventory/validation
5. migrate tests to new test client
6. migrate destructive operations to `operation.destructive`

### Ginko CMS

Recommended first changes:

1. `members.getAccessContext`: `public` -> `session`
2. public content queries: add handler-local `reads`
3. test helpers: use Trellis test client
4. operation exports: use `operation.destructive`
5. bridge entries: consume handler metadata

### Semver

This is a major or clean pre-1.0 cutover.

For unreleased internals, delete the old path as soon as the new one passes
tests. For released public APIs, allow only a short deprecation window with a
specific removal version. Starters and examples must show only the new path.

## Rejected Options

### Keep Everything As-Is

Rejected because the current design is secure but too expensive to author and
review. It forces framework internals into app code.

### Remove Security Hardening

Rejected. The hardening exists for real reasons. Public reads, trusted
forwarding, replay, destructive operations, and app identity boundaries are
valuable.

The fix is better encapsulation, not weaker security.

### Add Full RLS Language

Rejected. Convex is not Postgres. A second policy language would create another
source of truth.

Use local capabilities plus runtime enforcement instead.

### Make Frontend Route Middleware The Source Of Truth

Rejected. Frontend route middleware improves UX but cannot be the backend
authorization boundary.

### Rely Only On TypeScript

Rejected. TypeScript helps authoring, but runtime enforcement is mandatory.

### Hide Everything Behind Magic

Rejected. Trellis should be explicit. The proposed API removes transport
ceremony, not domain policy.

### Keep Compatibility Shims For Greenfield Internals

Rejected. This RFC targets a clean app-framework shape. For unreleased/internal
Trellis paths, keeping old and new APIs side by side would preserve the exact
source-of-truth drift the RFC is trying to remove.

### Add Generic Repository Or Service Layers

Rejected. Convex functions and app domain helpers remain the unit of behavior.
Generic repositories would add indirection without solving the observed pain.

### Make Handler Capabilities Row-Level Authorization

Rejected. `reads` and `writes` declare coarse runtime authority. They do not
replace guards, tenant filters, published filters, or domain authorization.

## Pros

- security intent is local
- app code is easier to read
- agents can reason from one handler
- type inference remains Convex-native
- Nuxt composables become cleaner
- tests become product-focused
- bridge metadata can stop duplicating handler metadata
- public/session distinction reduces confusion
- operation workflow becomes one domain export
- runtime enforcement remains strong

## Cons

- requires builder API changes
- requires docs rewrite
- migration touches many examples
- type-level DB capability narrowing may be difficult
- bridge integration needs careful design
- operation export shape may fight Convex's flat export model
- handler-local capabilities add lines to each handler

The added lines are acceptable because they express real security intent.

## Open Questions

1. Should `reads`/`writes` be mandatory for all lanes or only public/service in
   strict mode?
2. Can DB capability narrowing be made ergonomic without type explosion?
3. Should operation exports be nested or flat?
4. What generated inventory should replace manual `public.readTables` for
   review and doctor output?
5. How should Nuxt module configure default access context query?
6. Should bridge metadata live on handlers or in bridge modules that import handlers?
7. What should be the stable audit schema for handler ids?
8. How strict should doctor be during the migration window?
9. Should service replay intent use app-facing words like `rejectDuplicate`,
   `idempotent`, and `allowDuplicate` instead of protocol words?
10. How should handler ids survive package/component embedding without global
    collisions?

## Acceptance Criteria

### Phase 0 Acceptance

The first implementation slice is successful when:

- `query.session` exists and can implement current access-context behavior
  without exposing arbitrary `ctx.db`.
- `query.public({ reads })` exists and enforces declared public reads at
  runtime.
- `reads` autocompletes and typechecks table names from `DataModel`.
- handler `id` exists and is captured in runtime/inventory metadata.
- one starter public query migrates from global `public.readTables` to local
  `reads`.
- one access-context handler migrates from `query.public` to `query.session`.
- ordinary app tests can call as a user without constructing forwarding
  envelopes, replay modes, TTLs, or function-ref strings.
- `rg "public: {[^}]*readTables" examples src/cli/starter-fixtures` returns no
  starter/example authoring path after migration.
- `rg "identityForwardingFunctionRef" examples src/cli/starter-fixtures` returns
  no normal app handler usages after migration.
- `rg "createIdentityForwardingEnvelopeArgs" examples src/cli/starter-fixtures`
  returns no ordinary app test usage.

### Direction Acceptance

The full framework direction is successful when:

- A starter SaaS app can be built without identity-forwarding ceremony.
- Ginko CMS access context no longer uses `query.public`.
- Public content handlers declare local reads.
- Tests no longer construct forwarding envelopes for ordinary app calls.
- Destructive operations are defined once.
- Bridge exports do not duplicate handler refs.
- `reads` and `writes` autocomplete table names.
- handler args and returns infer from Convex validators.
- Nuxt composables infer function arg and return types.
- runtime still fails closed on undeclared public reads.
- replay protection remains durable for trusted writes.
- doctor can explain each handler's id, lane, declared reads/writes, guard, and
  operation metadata.
- adding a protected mutation in a starter requires editing one handler file and
  one focused test file, not runtime config, bridge metadata, and transport
  helpers.
- the RFC's Phase 0 slice is implemented before operation or bridge redesigns.

## Verification Plan

Add or update tests:

- unit tests for session lane
- unit tests for authenticated lane context refinement
- unit tests for public handler local reads
- unit tests for mutation writes
- unit tests for duplicate handler ids
- unit tests for operation destructive builder
- test-client tests for query/mutation/action/operation
- bridge metadata tests for one source of truth
- type tests for reads/writes table names
- type tests for handler args/returns
- docs/source tests to prevent old patterns in starters

Run:

```bash
pnpm run check
pnpm run release:verify
```

For Ginko CMS migration, run that repo's typecheck and focused component tests.

## Documentation Plan

New docs should teach:

1. Build a public query.
2. Build a session access query.
3. Build an authenticated dashboard query.
4. Build a protected mutation.
5. Build a destructive operation.
6. Use Nuxt composables.
7. Test as a user.
8. Add a service/webhook.
9. Bridge advanced components.
10. Inspect security inventory.

Docs should not introduce forwarding envelopes until advanced trusted transport.

## Appendix A: Handler Contract Checklist

Every handler should answer:

- What is the lane?
- What is the stable id?
- What args are accepted?
- What return is promised?
- What identity is guaranteed?
- What guard applies?
- What tables can be read?
- What tables can be written?
- What side effects happen?
- What operation/audit semantics apply?

## Appendix B: Framework Responsibility Split

Trellis owns:

- lanes
- app identity plumbing
- DB capability enforcement
- trusted forwarding
- replay protection
- operation confirmation primitives
- test transport helpers
- Nuxt composables
- bridge helper contracts
- inventories and doctor checks

Apps own:

- domain permissions
- domain entities
- tenant/workspace concepts
- published/draft distinctions
- billing/business rules
- public API shape
- app-specific migrations
- app-specific UI flows

## Appendix C: Security Posture Statement

The proposal does not reduce security.

It changes where security detail lives:

- intent stays in app handlers
- protocol stays in Trellis
- enforcement stays in runtime wrappers
- evidence stays in tests and inventory

This is the difference between explicit policy and exposed machinery.

## Appendix D: Minimal Example App

```ts
import { defineCaller, defineTrellis } from '@lupinum/trellis/backend'
import { v } from 'convex/values'

import { query, mutation } from './_generated/server'
import type { DataModel } from './_generated/dataModel'

const caller = defineCaller({
  resolve: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    return identity ? { kind: 'user', userId: identity.subject } : { kind: 'anonymous' }
  },
})

const trellis = defineTrellis<DataModel>(
  { query, mutation },
  {
    caller,
    appIdentity: async (_ctx, _args, caller) =>
      caller.kind === 'user' ? { userId: caller.userId } : null,
    public: { default: 'deny' },
  },
)

export const { query: q, mutation: m } = trellis

export const getAccess = q.session({
  id: 'access:get',
  args: {},
  returns: v.union(v.null(), v.object({ userId: v.string() })),
  handler: async (ctx) => await ctx.appIdentity(),
})

export const listTodos = q.authenticated({
  id: 'todos:list',
  reads: ['todos'],
  args: {},
  returns: v.array(v.object({ title: v.string(), done: v.boolean() })),
  handler: async (ctx) => {
    return await ctx.db
      .query('todos')
      .withIndex('by_user', (q) => q.eq('userId', ctx.identity.userId))
      .collect()
  },
})

export const createTodo = m.authenticated({
  id: 'todos:create',
  writes: ['todos'],
  args: { title: v.string() },
  returns: v.id('todos'),
  handler: async (ctx, args) => {
    return await ctx.db.insert('todos', {
      userId: ctx.identity.userId,
      title: args.title,
      done: false,
      createdAt: Date.now(),
    })
  },
})
```

## Appendix E: Minimal Nuxt Usage

```vue
<script setup lang="ts">
const access = useTrellisAccess()
const todos = useTrellisQuery(api.todos.listTodos, {})
const createTodo = useTrellisMutation(api.todos.createTodo)

const title = ref('')

async function submit() {
  await createTodo.mutate({ title: title.value })
  title.value = ''
}
</script>

<template>
  <main>
    <form @submit.prevent="submit">
      <input v-model="title" />
      <button :disabled="createTodo.pending">Create</button>
    </form>

    <ul>
      <li v-for="todo in todos.data ?? []" :key="todo._id">
        {{ todo.title }}
      </li>
    </ul>
  </main>
</template>
```

## Appendix F: Terminology Changes

Preferred:

- lane
- capability
- session
- authenticated
- protected
- operation
- handler id
- app identity

Avoid in app-level docs:

- transport execute
- replay mode
- identity forwarding envelope
- JTI redemption
- domain idempotency
- function ref metadata

Those terms remain valid in runtime internals and advanced transport docs.

## Appendix G: Decision Record Candidate

If accepted, the durable ADR should say:

Trellis handlers declare local security intent through lanes and capabilities.
Transport signing, replay, and bridge forwarding are Trellis runtime concerns.
Public content and session access are separate lanes. Destructive operations are
single domain definitions projected into preview and execute call surfaces.

## Appendix H: API Reference Sketch

This appendix is not final API documentation. It describes the shape needed for
implementation discussion.

### `defineTrellis`

```ts
const trellis = defineTrellis(builders, options)
```

Inputs:

- Convex builders
- caller resolver
- app identity resolver
- durable replay config
- destructive operation config
- default public policy
- optional isolation/service policy

Outputs:

- `query`
- `mutation`
- `action`
- `operation`
- `unsafe`
- optional internal builders

### `query.public`

```ts
query.public({
  id,
  reads,
  args,
  returns,
  handler,
})
```

Use when anonymous callers may access the returned data.

Required:

- `id`
- `args`
- `returns`
- `handler`

Required when `ctx.db` is used:

- `reads`

Forbidden by default:

- writes
- private identity assumptions
- cross-tenant access

### `query.session`

```ts
query.session({
  id,
  args,
  returns,
  handler,
})
```

Use when the client needs to discover the current identity/access state.

Allowed:

- anonymous caller returning `null`
- authenticated caller returning access context
- bootstrap/onboarding state

Forbidden:

- listing private resources
- broad admin data
- public content filtering

### `query.authenticated`

```ts
query.authenticated({
  id,
  reads,
  args,
  returns,
  handler,
})
```

Use when any authenticated app identity may call the function.

Guarantee:

- `ctx.identity` is non-null

### `query.protected`

```ts
query.protected({
  id,
  guard,
  reads,
  args,
  returns,
  handler,
})
```

Use when a domain guard is required.

Guarantees:

- `ctx.identity` is non-null
- `guard` passed

### `mutation.authenticated`

```ts
mutation.authenticated({
  id,
  reads,
  writes,
  args,
  returns,
  handler,
})
```

Use for user-owned writes that require no extra role.

### `mutation.protected`

```ts
mutation.protected({
  id,
  guard,
  reads,
  writes,
  args,
  returns,
  handler,
})
```

Use for permissioned writes.

### `operation.destructive`

```ts
operation.destructive({
  id,
  guard,
  reads,
  writes,
  args,
  preview,
  execute,
})
```

Use for writes that need preview, confirmation, audit, or replay protection.

### `mutation.service`

```ts
mutation.service({
  id,
  service,
  replay,
  reads,
  writes,
  args,
  returns,
  handler,
})
```

Use for trusted non-user writes.

### `unsafe`

Unsafe remains explicit.

```ts
query.unsafe({
  permit: unsafe.permit('reason'),
  args,
  handler,
})
```

Unsafe must never be the easiest path in examples.

## Appendix I: SaaS Recipe Catalog

### Personal Todo App

```ts
export const listTodos = query.authenticated({
  id: 'todos:list',
  reads: ['todos'],
  args: {},
  returns: v.array(todoValidator),
  handler: async (ctx) => {
    return await ctx.db
      .query('todos')
      .withIndex('by_user', (q) => q.eq('userId', ctx.identity.userId))
      .collect()
  },
})
```

Pattern:

- authenticated lane
- owner filter in handler
- local `reads`

### Workspace App

```ts
export const listWorkspaceProjects = query.protected({
  id: 'projects:listWorkspace',
  guard: canReadWorkspace,
  reads: ['projects'],
  args: { workspaceId: v.id('workspaces') },
  returns: v.array(projectValidator),
  handler: async (ctx, args) => {
    return await ctx.db
      .query('projects')
      .withIndex('by_workspace', (q) => q.eq('workspaceId', args.workspaceId))
      .collect()
  },
})
```

Pattern:

- protected lane
- workspace guard
- explicit workspace arg
- table read capability

### Admin Settings

```ts
export const updateWorkspaceSettings = mutation.protected({
  id: 'settings:updateWorkspace',
  guard: canManageSettings,
  reads: ['workspaceSettings'],
  writes: ['workspaceSettings'],
  args: updateSettingsArgs,
  returns: settingsValidator,
  handler: async (ctx, args) => {
    return await saveWorkspaceSettings(ctx, args)
  },
})
```

Pattern:

- protected mutation
- reads and writes both declared
- domain logic remains in app helper

### Contact Form

```ts
export const submitContactForm = mutation.public({
  id: 'contact:submit',
  publicWrite: {
    tables: ['contactMessages'],
    reason: 'Anonymous visitors can submit contact messages.',
  },
  args: contactFormArgs,
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.publicWrite.insert('contactMessages', {
      email: args.email,
      message: args.message,
      createdAt: Date.now(),
    })
    return null
  },
})
```

Pattern:

- public write is special and narrow
- reason is mandatory
- no raw public `ctx.db.insert`

### Webhook

```ts
export const stripeWebhook = mutation.service({
  id: 'billing:stripeWebhook',
  service: 'stripe',
  replay: 'idempotent',
  writes: ['billingEvents', 'subscriptions'],
  args: stripeWebhookArgs,
  returns: v.null(),
  handler: async (ctx, args) => {
    await applyStripeEvent(ctx, args)
    return null
  },
})
```

Pattern:

- service lane
- replay intent
- local write capabilities
- no app-level envelope parsing

### Background Job

```ts
export const expireInvites = mutation.service({
  id: 'members:expireInvites',
  service: 'scheduler',
  writes: ['memberInvites'],
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    await expireOldInvites(ctx)
    return null
  },
})
```

Pattern:

- non-user caller
- explicit service source
- writes only the relevant table

## Appendix J: Threat Model

### Accidental Public Data Leak

Risk:

- developer adds `query.public`
- handler reads private table

Mitigation:

- public DB default deny
- local `reads`
- runtime wrapper
- type-level table names
- doctor inventory

### Confused Access Context

Risk:

- access/session endpoint modeled as public content
- reviewers misunderstand data exposure

Mitigation:

- `query.session`
- docs distinguish public content from session discovery
- examples migrate access context first

### Replay Of Trusted Mutation

Risk:

- signed trusted write is replayed

Mitigation:

- durable replay table
- framework-owned replay mapping
- tests for duplicate redemption
- app code never picks replay mode strings

### Operation Preview/Execute Mismatch

Risk:

- preview checks one thing
- execute deletes another thing

Mitigation:

- single `operation.destructive` definition
- shared args
- generated preview/execute projections
- confirmation token binds operation id and args hash

### Bridge Metadata Drift

Risk:

- bridge exports one function
- handler expects another function ref

Mitigation:

- handler id is canonical
- bridge consumes handler metadata
- duplicate ids fail
- bridge tests verify parity

### Agentic Mis-edit

Risk:

- LLM adds code to wrong lane or misses global config

Mitigation:

- local handler contract
- literal lane names
- local capabilities
- docs include agent checklists
- static checks block missing capabilities

## Appendix K: Agent Playbook

When an agent adds a query:

1. Choose lane.
2. Add stable id.
3. Add args validator.
4. Add returns validator.
5. Add reads if `ctx.db` reads.
6. Add guard if domain permission is needed.
7. Keep filtering in handler/domain helper.
8. Add focused test.

When an agent adds a mutation:

1. Choose authenticated/protected/service/publicWrite.
2. Add stable id.
3. Add args and returns.
4. Add writes.
5. Add reads if the mutation checks current state.
6. Use operation if destructive.
7. Add invariant test for unauthorized caller.

When an agent sees `unsafe`:

1. Ask whether it can be deleted.
2. Ask whether a capability declaration would replace it.
3. Keep `unsafe` only with a specific reason.
4. Add test coverage around the reason.

When an agent sees global public read config:

1. Find public handlers.
2. Move table names to local `reads`.
3. Remove tables not proven by handlers.
4. Add tests for blocked undeclared reads.

## Appendix L: Docs Anti-Patterns

Do not teach:

```ts
query.public({
  handler: async (ctx) => await ctx.db.query('users').collect(),
})
```

Do not teach:

```ts
createIdentityForwardingEnvelopeArgs({
  replayMode: 'jti-redemption',
})
```

outside advanced transport docs.

Do not teach:

```ts
guard: allowAll
```

inside protected lanes.

Do not teach:

```ts
public: {
  readTables: ['users', 'projects', 'settings'],
}
```

as the normal public data pattern.

Prefer:

```ts
query.public({
  reads: ['publishedPosts'],
  handler,
})
```

Prefer:

```ts
query.session({
  handler: getAccessContext,
})
```

Prefer:

```ts
mutation.protected({
  guard: canManageProject,
  writes: ['projects'],
  handler,
})
```

## Appendix M: Clean-Cut Removal Notes

The target state deletes the old authoring paths.

Remove from maintained examples, starters, and unreleased internals:

- `identityForwardingFunctionRef` as normal handler metadata
- global `public.readTables` authoring
- app-level forwarding envelope construction
- app-level replay mode choice
- public access context examples
- bridge entries that duplicate handler ids
- test helpers that retry raw caller args after forwarding failure
- docs that expose transport execute as normal app code

Keep only as advanced/internal runtime implementation details:

- low-level forwarding envelope construction
- replay mode names
- transport purpose names
- generated security inventory
- bridge projection internals

If a released public API requires a deprecation bridge, it must have:

- a named removal version
- no usage in starters or examples
- a doctor warning
- a test proving the new path is equivalent before the old path is deleted

## Appendix N: Metrics For Success

Qualitative:

- a new developer can explain a handler from one file
- an agent can add a protected mutation without reading transport docs
- security review focuses on guards and capabilities, not protocol wiring

Quantitative:

- fewer `identityForwardingFunctionRef` strings in app code
- fewer direct imports of forwarding helpers in app tests
- fewer global `readTables` entries
- more handlers with local `reads`/`writes`
- fewer bridge parity tests needed for duplicated metadata
- no increase in unsafe usage

## Appendix O: Proposed RFC Follow-Ups

Follow-up RFCs may be needed for:

1. exact type-level DB capability design
2. operation export projection design
3. bridge metadata unification
4. Nuxt composable return state shape
5. test client API
6. doctor/inventory migration warnings
7. service lane and webhook verification
8. public write capability ergonomics

This RFC should decide the product direction before those implementation RFCs
lock in details.
