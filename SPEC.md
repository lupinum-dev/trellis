# Trellis vNext SPEC

Status: draft agreement from architecture brainstorming  
Scope: greenfield Trellis vNext architecture  
Audience: Trellis maintainers and implementers

## 1. Purpose

Trellis vNext should keep the useful outcomes of the current Trellis project while making the public architecture easier to understand, harder to misuse, and less duplicated across browser, server, webhook, and MCP surfaces.

The agreed center of the new architecture is this:

> One product action is defined once as an operation. Everything else is a projection of that operation.

An operation owns the backend truth for a product action: input shape, auth mode, tenant scope, loaded records, authorization, preview, execution, audit metadata, and exposure. Browser components, Nitro routes, MCP tools, tests, permission UI state, and docs should consume generated operation projections instead of rebuilding policy in parallel.

This is a simplifying rewrite direction, not an additive feature layer. The architecture only wins if it deletes more concepts than it adds.

## 2. Problems Trellis must continue to solve

Trellis vNext must continue to solve these problems:

1. Provide a maintainable Nuxt + Convex app shape.
2. Wire Nuxt and Convex together with SSR-safe queries, live subscriptions, mutations, actions, and server helpers.
3. Integrate Better Auth with Convex-backed auth and SSR hydration.
4. Turn transport/session identity into app-owned identity.
5. Protect routes without auth hydration races.
6. Keep backend authorization as the source of truth.
7. Project backend-owned permission state to the browser.
8. Support workspace and tenant isolation patterns.
9. Keep Nitro routes thin and avoid duplicated business authorization in `/server/api`.
10. Support webhooks and server-to-server callers without treating server code as a magic bypass.
11. Provide safe destructive action flows with preview, confirmation, drift checks, and audit.
12. Treat MCP as a first-class surface over the same backend rules.
13. Support uploads.
14. Capture useful observability events.
15. Provide diagnostics, explainability, doctor commands, starter flows, and guardrails.

Trellis vNext does not own the product model. App authors still define tables, domain rules, tenant meaning, roles, and what each action does.

## 3. High-level architecture decision

Trellis vNext uses a hybrid architecture:

1. Core: Backend Operation Kernel.
2. Metadata layer: Resource + Capability Graph, but only as projection metadata.
3. Infrastructure packages: small Convex/Nuxt components for infrastructure state, not business policy.
4. Adapters: generated thin projections for browser, server, MCP, tests, docs, and diagnostics.
5. Debug UX: `doctor`, `explain`, `inspect`, and `graph` as first-class workflows.

Rejected as defaults:

1. Nuxt/Nitro gateway-first policy. Nitro routes may call operations, but Convex/backend operations remain the policy source of truth.
2. Full command/event sourcing for all writes. It is allowed as an advanced pattern, not the default.
3. Packaged components that hide app-specific authorization policy.
4. A separate MCP authorization model.
5. A second browser permission model that can drift from backend authorization.

## 4. Core principles

### 4.1 Define once, project everywhere

Protected product behavior must be authored once as an operation and projected to the places that need it.

Browser, server routes, webhooks, MCP tools, tests, docs, and generated handles must point back to the same operation metadata and backend execution path.

### 4.2 Backend policy owns truth

The browser may display permission state, but it must not be the authority. Server routes and MCP tools must not copy authorization rules. The operation authorizes on the backend.

### 4.3 Projection metadata is not a policy engine

Capabilities, resources, and feature manifests describe backend policy so Trellis can generate UI state, MCP visibility, docs, diagnostics, and handles. They must not become a second authorization system.

### 4.4 Keep plain Convex for simple cases

Not every read or helper needs to be an operation. Public reads, tiny internal helpers, and simple non-product plumbing may remain plain Convex functions. Operations are the default for protected product behavior, cross-surface actions, and destructive flows.

### 4.5 Delete public concepts

The public API should collapse the current mental model into fewer nouns:

- `operation`: the product action.
- `projection`: where the action is callable.
- `capability`: projected permission metadata for an action.
- `principal`: the authenticated transport subject.
- `actor`: the resolved app identity used for business policy.
- `feature`: inventory grouping for schema, capabilities, and operations.

Internally, Trellis may still use precise concepts such as forwarding, delegation, transport proof, generated refs, and replay modes. Normal app authors should not need to learn those first.

## 5. Target project shape

A feature-oriented structure is the default:

```txt
shared/features/<feature>/contract.ts
convex/features/<feature>/schema.ts
convex/features/<feature>/policy.ts
convex/features/<feature>/capabilities.ts
convex/features/<feature>/operations.ts
convex/features/<feature>/feature.ts
app/features/<feature>/*.vue
server/api/**/*.ts
server/mcp/tools/**/*.ts
```

Example:

```txt
shared/features/projects/contract.ts
convex/features/projects/schema.ts
convex/features/projects/policy.ts
convex/features/projects/capabilities.ts
convex/features/projects/operations.ts
convex/features/projects/feature.ts
app/features/projects/ProjectActions.vue
server/api/projects/[id].delete.ts
server/mcp/tools/projects.ts
```

`operations.ts` is the source of truth for product actions. `policy.ts` contains reusable domain predicates only. `feature.ts` is inventory, not a giant implementation object.

## 6. Core concepts

### 6.1 Operation

An operation is a product action with a stable id and backend-owned semantics.

It may be a read, a safe write, a public write, or a destructive write.

An operation can contain:

- `id`: stable product action id, for example `projects.delete`.
- `name`: human-readable label.
- `description`: docs and MCP/tool help text.
- `args`: input schema.
- `returns`: output schema.
- `capability`: optional capability metadata.
- `auth`: one of the small public auth modes.
- `isolation`: tenant isolation mode.
- `safety`: read/write/destructive classification.
- `load` or `scope`: backend record loading and tenant scope resolution.
- `authorize`: backend decision.
- `preview`: required for exposed destructive operations.
- `execute`: backend handler.
- `expose`: projection configuration for browser, server, MCP, webhook, and tests.
- `audit`: audit/event metadata.
- `observe`: optional semantic observability metadata.

### 6.2 Projection

A projection is a generated or thin adapter that exposes an operation to a runtime:

- Browser composable.
- Nitro/server caller.
- MCP tool.
- Webhook/service caller.
- Test harness.
- Docs/metadata output.
- Permission UI state.

A projection must not redefine authorization.

### 6.3 Capability

A capability is metadata that identifies a permission-like product ability, such as `projects.delete`.

Capabilities are used for UI access state, MCP visibility, docs, and diagnostics. Backend authorization still happens inside the operation.

### 6.4 Feature

A feature groups schema, tables, capabilities, operations, and optional projection metadata.

The feature manifest is inventory. It should not contain large handler bodies.

### 6.5 Principal and actor

`principal` is the transport subject. It answers: who or what is calling?

Example:

```ts
principal = {
  transport: 'browser' | 'server' | 'mcp' | 'webhook',
  subject: { kind: 'user' | 'service' | 'agent' | 'webhook' | 'system', id: string },
  actingFor?: { kind: 'user', id: string },
}
```

`actor` is the app identity used by business policy. It answers: what app-level user/service/agent is this, with which workspace and role?

Example:

```ts
actor = {
  kind: 'user',
  userId: '...',
  workspaceId: '...',
  role: 'owner',
}
```

Normal app code should mostly authorize against `actor` and loaded resources. Internals may still carry precise forwarding and transport proof data.

## 7. Operation API shape

This is the target shape. Exact names may change, but the semantics are required.

```ts
// convex/features/projects/operations.ts
import { operation } from '@lupinum/trellis/app'
import { deleteProjectArgs } from '~~/shared/features/projects/contract'
import { projectDelete } from './capabilities'
import { canDeleteProject } from './policy'

export const deleteProject = operation.destructive({
  id: 'projects.delete',
  name: 'Delete project',
  description: 'Deletes a project owned by the current workspace.',
  capability: projectDelete,
  args: deleteProjectArgs,
  auth: 'workspace',
  isolation: 'workspace',
  safety: 'destructive-write',

  async load(ctx, args) {
    const project = await ctx.db.get(args.projectId)
    if (!project) throw new Error('Project not found')
    return { project }
  },

  scope({ project }) {
    return {
      workspaceId: project.workspaceId,
      resource: 'project',
      resourceId: project._id,
    }
  },

  authorize({ actor, loaded }) {
    return canDeleteProject(actor, loaded.project)
  },

  preview({ loaded }) {
    return {
      summary: `Delete project "${loaded.project.name}"`,
      effects: [
        { kind: 'delete', target: 'project', count: 1 },
      ],
      confirm: {
        projectId: loaded.project._id,
        updatedAt: loaded.project.updatedAt,
      },
    }
  },

  async execute(ctx, args, { loaded }) {
    await ctx.db.delete(loaded.project._id)
  },

  expose: {
    browser: true,
    server: true,
    mcp: {
      name: 'delete-project',
      scopeKey: ({ args }) => `project:${args.projectId}`,
    },
  },

  audit: {
    event: 'project.deleted',
    subject: ({ loaded }) => `project:${loaded.project._id}`,
  },
})
```

The important point: the operation owns loading, authorization, preview, and execution. The browser, server route, and MCP tool do not copy that logic.

## 8. Public auth and isolation modes

Trellis should collapse the public handler lane vocabulary.

Target auth modes:

```ts
auth: 'public' | 'user' | 'workspace' | 'service'
```

Target isolation modes:

```ts
isolation: 'none' | 'workspace' | 'derived'
```

Meaning:

- `public`: no authenticated principal required.
- `user`: authenticated user required, no workspace required.
- `workspace`: authenticated actor with workspace required.
- `service`: verified service/webhook/agent principal required.
- `none`: no row-level tenant isolation.
- `workspace`: rows are scoped by the actor workspace.
- `derived`: tenant is derived from arguments or loaded resources.

Specialized internal lanes may remain internally but should not dominate public docs.

## 9. Browser projection

Browser code imports operation handles from a virtual module and calls `useOperation`.

```vue
<script setup lang="ts">
import { operations } from '#trellis/operations'

const deleteProject = useOperation(operations.projects.delete)

async function onDeleteClick(projectId: string) {
  const preview = await deleteProject.preview({ projectId })

  if (!preview.allowed) {
    return
  }

  const confirmed = window.confirm(preview.summary)
  if (!confirmed) {
    return
  }

  await deleteProject.execute({
    projectId,
    confirmationToken: preview.confirmation.token,
  })
}
</script>
```

Browser code may use access projections to hide or disable UI, but backend execution remains authoritative.

```vue
<script setup lang="ts">
import { capabilities } from '#trellis/capabilities'

const access = useAccess()
const canDeleteProject = access.can(capabilities.projects.delete)
</script>

<template>
  <button :disabled="!canDeleteProject">Delete</button>
</template>
```

## 10. Server/Nitro projection

Trellis should expose one request-scoped server caller as the default API.

```ts
// server/api/projects/[id].delete.ts
import { operations } from '#trellis/operations'

export default defineEventHandler(async (event) => {
  const trellis = useTrellisServer(event, { auth: 'required' })
  const projectId = getRouterParam(event, 'id')

  return await trellis.operation(operations.projects.delete).execute({
    projectId,
  })
})
```

The same caller should handle plain Convex functions when appropriate:

```ts
const trellis = useTrellisServer(event, { auth: 'auto' })

await trellis.query(api.projects.list, { workspaceId })
await trellis.mutation(api.projects.create, { name })
await trellis.action(api.billing.sync, {})
await trellis.operation(operations.projects.delete).execute({ projectId })
```

Low-level helpers may remain internally or under an advanced import, but docs should teach the unified caller first.

The unified caller must not become an untyped service locator. It should remain request-scoped, explicit about auth, and narrow in responsibility.

## 11. MCP projection

MCP should be a projection of operations, not a parallel policy surface.

Default: Trellis generates MCP tools from operation exposure metadata.

```ts
export const deleteProject = operation.destructive({
  id: 'projects.delete',
  expose: {
    mcp: {
      name: 'delete-project',
      scopeKey: ({ args }) => `project:${args.projectId}`,
      description: 'Delete a project after preview and confirmation.',
    },
  },
  // load, authorize, preview, execute...
})
```

Generated or thin manual binding:

```ts
// server/mcp/tools/projects.ts
import { operations } from '#trellis/operations/mcp'
import { tool } from '~/server/mcp/runtime'

export default tool.operation(operations.projects.delete)
```

Manual MCP tools are allowed when they add real custom orchestration. They must not be the default way to expose ordinary product operations.

MCP requirements:

1. MCP tools must call operation projections.
2. MCP tools must not redefine app authorization.
3. Destructive MCP tools must use the same preview/confirm/execute flow as browser/server callers.
4. MCP visibility may use capability metadata but execution still authorizes in the backend operation.
5. ID resolution and tool descriptions may be generated from operation contracts and field metadata.
6. Agent access drift must be observable and explainable.

## 12. Webhook and service projection

Webhooks and server-to-server calls use verified service principals and operation projections.

Example:

```ts
export default defineEventHandler(async (event) => {
  const trellis = useTrellisServer(event, {
    auth: verifiedWebhook(event, 'stripe'),
  })

  await trellis.operation(operations.billing.applyStripeEvent).execute({
    eventId,
  })
})
```

Service calls must provide a verified principal or transport proof. Normal app authors should see a simple `principal` model, while Trellis internals enforce replay protection, purpose binding, and delegation constraints.

## 13. Permission and access projection

Trellis should generate the default permission/access projection automatically from capabilities and operations.

Example capability:

```ts
// convex/features/projects/capabilities.ts
import { capability } from '@lupinum/trellis/app'

export const projectDelete = capability({
  id: 'projects.delete',
  label: 'Delete project',
  description: 'Allows deleting projects in the current workspace.',
  destructive: true,
})
```

Feature inventory references capabilities and operations:

```ts
// convex/features/projects/feature.ts
import { feature } from '@lupinum/trellis/app'
import { projectDelete } from './capabilities'
import { createProject, deleteProject } from './operations'

export default feature({
  id: 'projects',
  tables: {
    isolated: ['projects', 'tasks'],
  },
  capabilities: {
    delete: projectDelete,
  },
  operations: {
    create: createProject,
    delete: deleteProject,
  },
})
```

Generated UI access:

```ts
import { capabilities } from '#trellis/capabilities'

const access = useAccess()
const canDelete = access.can(capabilities.projects.delete)
```

Default access context should be generated. Apps may extend it:

```ts
trellis.access.extend(async (ctx, actor) => ({
  plan: actor.plan,
  usage: await loadUsage(ctx, actor.workspaceId),
}))
```

Rules:

1. Capabilities are metadata, not authoritative policy.
2. `useAccess()` is for UI and agent visibility, not final enforcement.
3. Execution always calls backend `authorize`.
4. If projected access allows something backend denies, Trellis should emit drift diagnostics.
5. The default setup should not require a hand-written `convex/permissions/context.ts` for normal apps.

## 14. Feature manifests

Feature manifests are inventory files. They should make features inspectable without becoming giant config-only DSLs.

Good:

```ts
export default feature({
  id: 'projects',
  schema,
  tables: {
    isolated: ['projects', 'tasks'],
    shared: ['projectTemplates'],
  },
  capabilities: {
    create: projectCreate,
    delete: projectDelete,
  },
  operations: {
    create: createProject,
    delete: deleteProject,
  },
})
```

Bad:

```ts
export default feature({
  id: 'projects',
  operations: {
    delete: {
      // hundreds of lines of domain logic here
    },
  },
})
```

Manifests power codegen, doctor, docs, tests, tenant classification, and generated handles.

## 15. Destructive operation safety

Destructive operations are first-class, not a convention.

A destructive operation exposed to browser, server, webhook, or MCP must have:

1. Stable `id`.
2. Input schema.
3. Load/scope phase.
4. Backend `authorize` phase.
5. `preview` phase.
6. Confirmation token binding preview to execute.
7. Drift check between preview and execute.
8. Audit metadata.
9. Replay/idempotency protection where needed.
10. Observability events for preview, confirmation, execute, denial, drift, and audit write.

Example flow:

```ts
const preview = await deleteProject.preview({ projectId })

await deleteProject.execute({
  projectId,
  confirmationToken: preview.confirmation.token,
})
```

Execution must fail if:

- The caller is no longer authorized.
- The loaded resource no longer matches the preview binding.
- The confirmation token is expired, reused, wrong, or scoped to different args/caller/resource.
- The operation id or preview hash differs.

Backend-only destructive operations are allowed, but must explicitly say why they have no external preview.

```ts
operation.destructive({
  id: 'billing.applyStripeEvent',
  exposure: 'backend-only',
  backendOnlyReason: 'Executed only from verified Stripe webhook replay-protected path.',
  // ...
})
```

## 16. Tenant isolation

Workspace isolation remains a core Trellis feature, but the public model should be simpler.

Operation-level isolation:

```ts
operation.mutation({
  id: 'tasks.create',
  auth: 'workspace',
  isolation: 'workspace',
  // ...
})
```

Feature-level table classification:

```ts
feature({
  id: 'tasks',
  tables: {
    isolated: ['tasks', 'taskComments'],
    shared: ['taskTemplates'],
  },
})
```

Trellis should validate:

1. Isolated tables exist.
2. Isolated tables have the tenant field.
3. Isolated tables have the tenant index.
4. Shared tables are not also isolated.
5. Tenant-shaped tables are classified.
6. Operations using workspace isolation resolve a workspace id.

Trellis may derive isolated tables from schema shape but must allow explicit override.

## 17. Auth and app identity

Better Auth integration remains, but the public auth story should be simplified.

Requirements:

1. Better Auth remains the session/auth provider integration.
2. Convex token exchange remains SSR-aware.
3. The browser gets hydrated auth state without unauthenticated flashes.
4. Trellis app-owned users remain optional but supported.
5. Apps that need app-owned users get a default bootstrap path.
6. Apps that do not need app-owned users can explicitly disable bootstrap.
7. The public app identity model should be `actor`, not a pile of provider/session fields.

Example app identity definition:

```ts
export const appIdentity = defineAppIdentity.fromAuth().extend({
  async fields(ctx, user) {
    const membership = await loadCurrentMembership(ctx, user._id)
    return {
      workspaceId: membership.workspaceId,
      role: membership.role,
      plan: membership.plan,
    }
  },
})
```

Operations receive resolved identity:

```ts
authorize({ actor, loaded }) {
  return actor.workspaceId === loaded.project.workspaceId && actor.role === 'owner'
}
```

## 18. Uploads

Uploads remain an infrastructure feature, not an operation requirement.

Browser upload composables should continue to support:

1. Requesting upload URLs.
2. Progress state.
3. Cancellation.
4. Queueing/concurrency controls.
5. Advisory file type and size checks.
6. Returning Convex storage IDs.

Operations may consume uploaded storage IDs when the uploaded file has product meaning.

```ts
await trellis.operation(operations.assets.attachUpload).execute({
  projectId,
  storageId,
})
```

## 19. Observability

Trellis owns the semantic event model. Delivery remains configurable.

Events should cover:

1. Auth resolution.
2. App identity resolution.
3. Operation preview.
4. Operation execute.
5. Authorization allow/deny.
6. Tenant isolation failure.
7. Destructive confirmation issued/redeemed/failed.
8. MCP tool visibility and execution.
9. Access projection/backend drift.
10. Server/webhook transport proof validation.
11. Upload lifecycle.
12. Convex connection state.

Each event should include enough correlation metadata for `trellis explain` to connect browser, server, Convex, and MCP behavior.

## 20. Diagnostics and explain UX

Diagnostics are a primary product surface.

Required commands:

```bash
trellis doctor
trellis explain operation projects.delete
trellis explain access --actor user:123 --operation projects.delete
trellis explain mcp delete-project
trellis inspect operations
trellis inspect capabilities
trellis graph
```

`trellis explain operation projects.delete` should show:

1. Operation id, kind, safety, auth mode, isolation mode.
2. Feature owner.
3. Args and contract fields.
4. Capability metadata.
5. Exposures: browser, server, MCP, webhook, tests.
6. Convex execute and preview refs.
7. Destructive preview/confirmation status.
8. Tenant table requirements.
9. Audit metadata.
10. Known generated handles.
11. Recent denials or drift events in dev.

`trellis doctor` should catch:

1. Missing Convex URL/site URL.
2. Auth enabled but broken Better Auth route setup.
3. Missing generated Convex API.
4. Invalid operation ids.
5. Duplicate operation ids.
6. Destructive operations without preview.
7. Exposed operations without execute projection.
8. MCP tools that bypass operation projections.
9. Tenant-shaped tables not classified.
10. Capabilities not referenced by operations.
11. Operations exposed to MCP without descriptions where descriptions are required.
12. Generated virtual module failures.

## 21. Codegen and virtual modules

Normal app code should import virtual modules:

```ts
import { api } from '#trellis/api'
import { operations } from '#trellis/operations'
import { capabilities } from '#trellis/capabilities'
import { features } from '#trellis/features'
```

Default behavior:

1. Prefer virtual modules over generated files written into app trees.
2. Generated output must be inspectable with CLI commands.
3. Generated handles must be boring, deterministic, and easy to print.
4. Virtual module errors must include actionable diagnostics.
5. Advanced/package authors may opt into written generated artifacts if needed.

Example generated operation shape:

```ts
export const operations = {
  projects: {
    delete: {
      id: 'projects.delete',
      kind: 'destructive',
      safety: 'destructive-write',
      execute: api.features.projects.operations.deleteProject,
      preview: api.features.projects.operations.previewDeleteProject,
      capability: capabilities.projects.delete,
      expose: {
        browser: true,
        server: true,
        mcp: true,
      },
    },
  },
} as const
```

## 22. Package and bridge boundaries

Bridge/package-author primitives should not leak into normal app docs.

Normal app docs should teach:

```ts
import { operations } from '#trellis/operations'
```

Package author docs may teach:

```ts
export default trellisPackage({
  features,
  operations,
  schema,
  components,
})
```

Rules:

1. Normal apps should not need to understand bridge internals.
2. Package authors still get explicit advanced APIs.
3. Infrastructure packages may own state such as confirmation tokens, MCP bearer keys, audit logs, and observability sinks.
4. Infrastructure packages must not own app-specific authorization policy.

## 23. Starter and CLI ladder

Trellis should prefer one growth ladder over many competing starters.

Target CLI path:

```bash
trellis init my-app
trellis add auth
trellis add workspace
trellis add mcp
trellis add destructive-operations
trellis add uploads
trellis add observability
```

Complete example apps remain useful, but the product path should be incremental.

## 24. Kept features and vNext replacements

| Current concern | vNext answer |
| --- | --- |
| Nuxt + Convex wiring | Core module + virtual modules + composables |
| Auth | Better Auth integration + simplified actor/principal model |
| App identity | `actor` resolved from `principal` |
| Route protection | Auth-aware middleware + generated access projection |
| Backend permissions | Operation `authorize` remains authoritative |
| Browser permission state | Generated `useAccess()` from capabilities/operations |
| Workspace isolation | Operation isolation + feature table classification |
| Nitro routes | `useTrellisServer(event)` calling operation projections |
| Webhooks/services | Verified service principals calling operation projections |
| MCP | Auto-projected operation tools |
| Destructive safety | Structural preview/confirm/execute/audit flow |
| Uploads | Infrastructure composables + operations consuming storage ids |
| Observability | Semantic events across operations/auth/MCP/server/upload |
| Diagnostics | `doctor`, `explain`, `inspect`, `graph` |
| Generated refs/handles | Virtual modules by default, inspectable output |
| Starters | Incremental ladder |

## 25. What should be deleted or hidden from normal app authors

The following should be removed from first-reader docs or collapsed behind simpler concepts:

1. Many overlapping handler lane names.
2. Manual MCP binding for ordinary operation-backed tools.
3. Manual permission context wiring for normal apps.
4. Generated files scattered through app-visible trees.
5. Bridge/package-author concepts in normal app flows.
6. Separate browser/server/MCP authorization examples for the same product action.
7. Low-level server Convex helper sprawl as the default API.
8. Public vocabulary that forces users to learn forwarding/delegation/transport proof before they can build ordinary app features.

These internals may continue to exist where necessary, but they should not be the primary user model.

## 26. End-to-end example

### 26.1 Shared contract

```ts
// shared/features/projects/contract.ts
import { defineArgs } from '@lupinum/trellis/args'
import { v } from 'convex/values'

export const deleteProjectArgs = defineArgs({
  args: {
    projectId: v.id('projects'),
  },
  description: 'Delete a project by id.',
  meta: {
    projectId: {
      label: 'Project',
      description: 'The project to delete.',
      resolveWith: 'projects.lookup',
      displayField: 'name',
    },
  },
})
```

### 26.2 Policy

```ts
// convex/features/projects/policy.ts
export function canDeleteProject(actor, project) {
  return actor.workspaceId === project.workspaceId && actor.role === 'owner'
}
```

### 26.3 Feature metadata

```ts
// convex/features/projects/capabilities.ts
import { capability } from '@lupinum/trellis/app'
export const projectDelete = capability({
  id: 'projects.delete',
  label: 'Delete project',
  destructive: true,
})

// convex/features/projects/feature.ts
import { feature } from '@lupinum/trellis/app'
import { schema } from './schema'
import { projectDelete } from './capabilities'
import { deleteProject } from './operations'

export default feature({
  id: 'projects',
  schema,
  tables: {
    isolated: ['projects'],
  },
  capabilities: {
    delete: projectDelete,
  },
  operations: {
    delete: deleteProject,
  },
})
```

### 26.4 Operation

```ts
// convex/features/projects/operations.ts
import { operation } from '@lupinum/trellis/app'
import { deleteProjectArgs } from '~~/shared/features/projects/contract'
import { projectDelete } from './capabilities'
import { canDeleteProject } from './policy'

export const deleteProject = operation.destructive({
  id: 'projects.delete',
  capability: projectDelete,
  args: deleteProjectArgs,
  auth: 'workspace',
  isolation: 'workspace',
  safety: 'destructive-write',

  async load(ctx, args) {
    const project = await ctx.db.get(args.projectId)
    if (!project) throw new Error('Project not found')
    return { project }
  },

  authorize({ actor, loaded }) {
    return canDeleteProject(actor, loaded.project)
  },

  preview({ loaded }) {
    return {
      summary: `Delete project "${loaded.project.name}"`,
      effects: [{ kind: 'delete', target: 'project', count: 1 }],
      confirm: {
        projectId: loaded.project._id,
        updatedAt: loaded.project.updatedAt,
      },
    }
  },

  async execute(ctx, args, { loaded }) {
    await ctx.db.delete(loaded.project._id)
  },

  expose: {
    browser: true,
    server: true,
    mcp: {
      name: 'delete-project',
      scopeKey: ({ args }) => `project:${args.projectId}`,
    },
  },

  audit: {
    event: 'project.deleted',
    subject: ({ loaded }) => `project:${loaded.project._id}`,
  },
})
```

### 26.5 Browser

```vue
<script setup lang="ts">
import { operations } from '#trellis/operations'
import { capabilities } from '#trellis/capabilities'

const access = useAccess()
const canDelete = access.can(capabilities.projects.delete)
const deleteProject = useOperation(operations.projects.delete)

async function remove(projectId: string) {
  const preview = await deleteProject.preview({ projectId })
  if (!preview.allowed) return

  const confirmed = window.confirm(preview.summary)
  if (!confirmed) return

  await deleteProject.execute({
    projectId,
    confirmationToken: preview.confirmation.token,
  })
}
</script>

<template>
  <button :disabled="!canDelete" @click="remove(project._id)">
    Delete
  </button>
</template>
```

### 26.6 Server route

```ts
// server/api/projects/[id].delete.ts
import { operations } from '#trellis/operations'

export default defineEventHandler(async (event) => {
  const trellis = useTrellisServer(event, { auth: 'required' })
  const projectId = getRouterParam(event, 'id')

  return await trellis.operation(operations.projects.delete).execute({
    projectId,
  })
})
```

### 26.7 MCP

```ts
// server/mcp/tools/projects.ts
import { operations } from '#trellis/operations/mcp'
import { tool } from '~/server/mcp/runtime'

export default tool.operation(operations.projects.delete)
```

No separate UI rule. No separate server route rule. No separate MCP rule. One backend operation answers whether deletion is allowed, what will happen, and how execution works.

## 27. Acceptance criteria

Trellis vNext architecture is successful if all of the following are true:

1. A junior developer can explain Trellis with: “define an operation, project it to UI/server/MCP.”
2. A protected product action has one backend authorization path.
3. A destructive action cannot be externally executed without preview/confirmation unless explicitly backend-only.
4. MCP tools for normal product actions are generated or thin projections of operations.
5. Browser `useAccess()` is generated from backend metadata and never becomes the final policy authority.
6. Nitro routes do not copy business authorization.
7. Feature manifests make the app inspectable without forcing all implementation into config objects.
8. Normal app docs do not require bridge/package-author concepts.
9. Generated output is available through virtual modules and inspectable through CLI.
10. `doctor` and `explain` can trace one operation end to end.
11. The new model deletes or hides more public concepts than it adds.
12. Plain Convex functions remain acceptable for simple public reads and internal helpers.

## 28. Risks

### 28.1 Operation ceremony

Risk: tiny apps may feel forced into too much structure.

Mitigation: keep plain Convex functions for simple public reads and helpers. Operations are for protected product behavior and cross-surface actions.

### 28.2 Operation abstraction pressure

Risk: if `operation(...)` is awkward, the whole framework feels awkward.

Mitigation: make operation definitions read like normal backend code. Avoid over-DSL design.

### 28.3 Hidden generation

Risk: virtual modules can feel magical.

Mitigation: generated output must be inspectable and deterministic.

### 28.4 Capability graph becoming policy

Risk: capabilities drift into a second authorization engine.

Mitigation: capabilities remain metadata. Backend `authorize` remains final.

### 28.5 Migration cost

Risk: this is a large architectural cutover.

Mitigation: treat as vNext, not incremental polish. Provide migration guides and compatibility adapters only where they do not preserve duplicated concepts forever.

## 29. Implementation sequencing

Suggested build order:

1. Define the operation kernel API and execution semantics.
2. Define operation metadata extraction and virtual `#trellis/operations` module.
3. Implement browser `useOperation()` over operation handles.
4. Implement request-scoped `useTrellisServer(event)`.
5. Implement destructive preview/confirm/execute infrastructure.
6. Implement capability metadata and generated `useAccess()` projection.
7. Implement feature manifests and inventory composition.
8. Implement MCP auto-projection from operations.
9. Implement doctor/explain/inspect for operations.
10. Move bridge/package-author APIs behind advanced docs.
11. Build starter ladder commands.
12. Add migration docs and examples.

## 30. Final summary

The new Trellis architecture is operation-first.

The public mental model is:

```txt
operation = product action
projection = where that action is callable
policy = backend decision inside the operation
capability = metadata used to project access/docs/tools
feature = inventory grouping for schema/capabilities/operations
```

The central promise is:

```txt
Define the product action once.
Use it from browser, server, webhook, MCP, tests, and docs.
Do not rewrite authorization in each place.
```

That is the architecture Trellis vNext should optimize around.
