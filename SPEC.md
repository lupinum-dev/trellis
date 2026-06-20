# Trellis vNext Spec

Status: final planning spec
Target: Trellis 1.0 / next major
Date: 2026-06-20

This is the single vNext product and architecture specification for this
Trellis repository. It consolidates the current repo ADRs, the prior next-major
draft, and the Convex cost/security/agent/MCP decisions from review.

Only this repository is normative. Spike repos, examples outside this tree, and
one-off sketches may inform implementation, but they do not define the target.

## Executive Summary

Trellis vNext is an opinionated Nuxt + Convex application framework for teams
that want one reviewable backend model across browser UI, Nitro routes,
workspace features, MCP, agents, webhooks, and packaged integrations.

The core idea is:

```text
operation-first Convex generation
  -> generated validators
  -> indexed actor and workspace resolution
  -> generated scoped DB
  -> bounded indexed reads
  -> explicit operation rate limits
  -> generated agent/MCP metadata
  -> doctor-enforced cost and security rules
```

Trellis should not solve cost and security with a broad runtime cache. It
should make the secure, indexed, bounded Convex shape the easiest shape to
write.

The stable spine remains:

```text
principal -> actor -> guard -> load -> authorize -> handler
```

For workspace apps, the concrete Convex path becomes:

```text
trellis operation call
  -> validate args
  -> resolve auth via ctx.auth
  -> indexed user lookup
  -> indexed workspace membership lookup
  -> apply app-layer rate limit when configured
  -> create workspace-scoped DB capability
  -> run bounded indexed handler
  -> redact and audit result
```

The cost rule is explicit: failed or hostile calls should usually stop after
auth plus one or two indexed reads. They should not touch product tables
broadly.

## Problems Trellis Solves

Trellis exists to solve framework-level application problems, not product
modeling problems.

For Nuxt + Convex applications, Trellis solves:

1. A maintainable app shape: canonical `shared/`, `convex/`, `app/`, and
   `server/` lanes instead of every project inventing structure.
2. Incremental adoption: start public, add auth, add workspace isolation, then
   add MCP and agents only when needed.
3. Nuxt + Convex wiring: module setup, generated aliases, client setup,
   SSR-aware reads, live query state, mutations, actions, uploads, and server
   callers.
4. Better Auth integration: Convex-backed auth, SSR handoff, auth refresh,
   auth state composables, and fail-closed route safety.
5. App identity modeling: transport/session identity becomes app-level
   principal and actor state that backend code can reason about.
6. One backend authorization path: browser UI, Nitro routes, webhooks, MCP,
   agents, and bridge code all reach the same backend policy path.
7. Backend-owned permissions: UI `_can` data is projected from backend policy
   and never becomes an execution authority.
8. Workspace and tenant isolation: membership resolution, tenant-scoped tables,
   scoped DB, workspace-first indexes, and unsafe escape review.
9. Thin server routes: Nitro calls Trellis/Convex operations instead of
   duplicating business authorization in `/server/api`.
10. Server-to-server and webhook forwarding: signed forwarding envelopes prove
    the transport boundary without granting permission by themselves.
11. Destructive action safety: preview, confirmation, execute, stale-state
    checks, replay protection, and audit are one operation shape.
12. MCP and agent exposure: tools are projections of backend operations, not a
    second backend with second policy.
13. File uploads: browser upload helpers and Convex storage IDs without treating
    pre-record upload state as a tenant bypass.
14. Decision observability: structured events for identity resolution, denials,
    trust-boundary crossings, operations, MCP, agents, and correlation.
15. Diagnostics and guardrails: `doctor`, `explain`, starter fixtures, lint
    rules, generated handles, and public-surface checks catch drift before
    production.

Trellis does not solve the product model. The app still owns:

- tables and domain entities.
- what a user, workspace, member, role, plan, or project means.
- which roles may create, update, delete, publish, export, invite, or revoke.
- the domain-specific preview text and effects for destructive work.
- business quotas, pricing, plan enforcement, and support policy.

Trellis supplies the path and guardrails. It does not invent product rules.

## Core Mental Model

The public mental model is intentionally small:

```text
operation = product action
projection = where that action is callable
policy = backend decision inside the operation
```

For example, `projects.delete` answers these questions once:

```text
What args are accepted?
What record is loaded?
Who is allowed?
What will happen if confirmed?
How is it executed?
Where may it be exposed?
```

Browser buttons, Nitro routes, MCP tools, agent tools, tests, and bridge
bindings do not re-answer those questions. They import generated handles that
point back to the operation.

This is the architecture only if it replaces old separate paths. If vNext keeps
the current model and adds an operation kernel beside it, the result is worse.
The success criterion is:

```text
Can Trellis delete more concepts than it adds?
```

The answer must be yes before the architecture is accepted for 1.0.

## Final Decisions

These decisions are accepted for vNext unless a later ADR explicitly reopens
them.

1. Trellis remains a framework, not a stack-neutral utility library.
2. Convex remains the backend execution and data platform.
3. Nuxt remains the frontend/server framework lane.
4. Better Auth remains the first supported auth foundation.
5. Backend permissions and tenant isolation are authoritative.
6. UI `_can` data is a projection and never authorizes execution.
7. Operations are the canonical unit for work crossing UI, server, MCP, agent,
   bridge, or destructive boundaries.
8. MCP is a projection of backend operations, not a second backend.
9. Destructive MCP and agent write flows use preview, confirmation, execute,
   stale-state checks, replay protection, and audit.
10. Trellis does not add a generic data cache.
11. Convex query caching is the default read cache.
12. Action Cache is optional for pure, expensive AI or third-party actions.
13. Auth and membership decisions are not cached across requests.
14. Generated operation handles are the normal cross-surface exposure object.
15. Generated scoped DB is the normal workspace handler database surface.
16. Raw `ctx.db` in workspace handlers is unsafe unless explicitly permitted.
17. Workspace list indexes exposed by scoped DB start with `workspaceId`.
18. By-id scoped reads verify `doc.workspaceId` before returning records.
19. Wrong-workspace records look like `NOT_FOUND` to public callers.
20. App-layer rate limiting becomes operation metadata, especially for writes,
   destructive actions, MCP, and agents.
21. Convex Agent may own agent threads, messages, streaming, tool calls, files,
   approval state, usage hooks, and agent rate-limit integration.
22. Trellis owns only the safe bridge from generated operations to agent tools.
23. Convex MCP Gateway may be evaluated as an adapter, but Trellis still
   exposes generated safe handles, not raw database tools.
24. Component bridge leaves core and moves to `@lupinum/trellis-bridge`.
25. Ginko CMS is the reference bridge consumer, not a Trellis core feature.
26. Signed forwarding envelopes replace raw shared-key and identity args.
27. `trellis doctor` is an adoption, safety, and cost dashboard.
28. `trellis explain` reads structured inventory before source scans.
29. Fixture apps replace broad string-template starter generation.
30. Public surface has a budget enforced in CI.
31. Operation-first is a hard cutover for protected cross-surface product
    behavior, not an additive compatibility layer.
32. Plain Convex handlers remain valid for public reads, small authenticated
    CRUD, and internal helpers that do not cross trust or tool boundaries.
33. Feature manifests are inventory only. They do not become a hidden resource
    DSL or second policy engine.
34. Generated artifacts must be inspectable through `doctor`, `explain`, or
    `inspect` so generated architecture does not become opaque magic.

## Non-Goals

Trellis vNext does not become:

1. Stack-neutral.
2. Backend-neutral.
3. Auth-provider-neutral by default.
4. A generic MCP SDK.
5. A UI component library.
6. A plugin ecosystem.
7. A hidden resource DSL.
8. An ORM.
9. A replacement for Convex Agent.
10. A replacement for network-layer DDoS protection.

Nuxt + Convex + Better Auth + TypeScript + operations + MCP remains the lane.

## Product Layers

Layers are product and documentation boundaries first. They do not automatically
mean separate npm packages.

### Layer 1: Core And Convex Backend

Purpose: make normal Nuxt + Convex app development boring.

Includes:

- Nuxt module.
- Convex client/server helpers.
- SSR and live query composables.
- mutation/action composables.
- upload helpers.
- server Convex callers.
- `defineArgs`.
- public/protected/unsafe backend builders.
- operation definitions and projection metadata.
- minimal testing helpers.
- core `doctor` setup checks.

Does not require:

- Better Auth.
- workspaces.
- tenant isolation.
- MCP.
- agents.
- component bridge.

### Layer 2: Auth

Purpose: make identity explicit and reusable.

Includes:

- Better Auth integration.
- auth proxy and route safety.
- principal resolution.
- actor resolution.
- auth composables and auth state.
- fail-closed auth wiring.

Auth plugs identity into the backend pipeline:

```text
principal -> actor -> guard -> load -> authorize -> handler
```

### Layer 3: Workspace

Purpose: make roles, permissions, and tenancy reviewable.

Includes:

- workspace membership resolution.
- role and permission definitions.
- permission projection.
- `_can` projection helpers.
- scoped DB generation.
- tenant-aware indexes.
- typed unsafe permits.
- feature manifests.
- `composeFeatures`.
- workspace starter.
- tenant and permission doctor checks.

Feature manifests remain inventory. Business behavior stays in handlers and
operations.

### Layer 4: MCP And Agent Projection

Purpose: expose app operations to agents and tools without creating a side
backend.

Includes:

- MCP runtime.
- tool projection.
- generated operation-backed tools.
- capability-aware discovery.
- result envelopes.
- sessions.
- ingress and operation rate limiting.
- signed forwarding envelope integration.
- destructive preview/confirm/execute.
- optional Convex Agent adapter.
- MCP and agent doctor checks.

MCP and agent support are enabled only when requested.

### Layer 5: Packaged Integrations

Purpose: support reusable Trellis-aware packages such as Ginko CMS.

Includes:

- component bridge runtime.
- bridge manifests.
- bridge drift checks.
- managed host edits.
- package integration test helpers.

This layer belongs in `@lupinum/trellis-bridge`, not in the normal core app
runtime.

## Package Shape

The first package split is conservative.

```text
@lupinum/trellis                 core, backend, auth, workspace, MCP subpaths
@lupinum/trellis-bridge          packaged component integrations
@lupinum/trellis-eslint          optional lint rules
@lupinum/trellis-cli             CLI binary and codemods, if split
@lupinum/trellis-observability   optional delivery sinks, if extracted
```

Primary public imports:

```text
@lupinum/trellis              Nuxt module and core app helpers
@lupinum/trellis/backend      Convex backend builders and operations
@lupinum/trellis/auth         principal, actor, guards, permissions
@lupinum/trellis/workspace    tenant isolation and feature manifests
@lupinum/trellis/mcp          MCP runtime and operation projection
@lupinum/trellis/agent        optional generated operation tools for agents
@lupinum/trellis/server       Nitro/server helpers
@lupinum/trellis/testing      test harness helpers
```

Advanced packages:

```text
@lupinum/trellis-bridge       packaged component integrations
@lupinum/trellis-eslint       framework lint rules
@lupinum/trellis-observability delivery sinks for Trellis events
```

Rules:

- Core/backend must not import bridge.
- Core/backend must not import ESLint.
- Core/backend must not require observability delivery at runtime.
- MCP may depend on backend, auth, workspace, operations, and forwarding.
- MCP server tools must not import Convex implementation modules.
- Bridge may depend on backend operation metadata and forwarding.
- Bridge must not be imported by normal app starters.
- CLI may orchestrate every package, but runtime packages must not depend on
  CLI code.
- Doctor and explain may do heavier analysis; app runtime must not.

## Desired Repo Structure

The source tree should move toward responsibility boundaries:

```text
src/
  core/
    module/
    config/
    diagnostics/
    public-surface/

  convex/
    client/
    server/
    query/
    mutation/
    pagination/
    upload/
    testing/

  auth/
    better-auth/
    principal/
    actor/
    guards/
    permissions/
    projection/

  workspace/
    tenant/
    scoped-db/
    feature-manifest/
    visibility/
    unsafe-permits/

  operations/
    define-operation.ts
    descriptors.ts
    projection.ts
    preview.ts
    confirmation.ts
    audit.ts

  mcp/
    runtime/
    tools/
    operation-tools/
    confirmation/
    capabilities/
    sessions/
    rate-limit/
    result-envelope/

  agent/
    convex-agent/
    tools/
    approvals/
    usage/
    rate-limit/

  trusted-forwarding/
    envelope.ts
    signing.ts
    validation.ts
    convex-validators.ts

  observability/
    events/
    envelope/
    capture/
    summaries/

  cli/
    init/
    add/
    prepare/
    doctor/
    upgrade/
    explain/
    bridge-adapter/
```

Component bridge code moves to `packages/trellis-bridge/src`.

## The Convex Generation Model

Trellis vNext is operation-first Convex generation.

```text
feature contract
  -> operation descriptors
  -> feature manifest
  -> app inventory
  -> generated Convex functions
  -> generated scoped DB
  -> generated MCP/agent handles
  -> doctor/explain/upgrade inventory
```

Request-time code must not generate files, rebuild graph metadata, or call
`prepare`. Runtime imports generated artifacts and Convex bindings.

Generation happens through:

```bash
trellis prepare
trellis prepare --check
trellis check
```

Generated files are explicit, reviewable, and drift-checked.

## Shared Contract And Implementation Boundary

Operation-first MCP and agents must not require server files to import Convex
implementation modules.

The boundary is:

```text
shared/features/*     args, result schemas, permission keys, descriptors
convex/features/*     handler and operation implementations
generated/operation-refs.ts
                       generated low-level descriptor-to-Convex-ref bindings
generated/operation-handles/*
                       generated cross-surface operation handles
server/mcp/*          generated MCP operation handles
agent/*               generated agent operation handles
app/features/*        generated client/server operation handles
bridge manifests      generated bridge/component operation handles
```

Descriptor example:

```ts
// shared/features/projects/operations.ts
import { defineOperationDescriptor } from '@lupinum/trellis/backend'
import { v } from 'convex/values'

import { projectArchiveKey } from './permissions'

export const archiveProjectArgs = {
  id: v.id('projects'),
}

export const archiveProjectDescriptor = defineOperationDescriptor({
  id: 'projects.archive',
  kind: 'destructive',
  args: archiveProjectArgs,
  permission: projectArchiveKey,
  safety: 'destructive-write',
  exposure: {
    ui: true,
    mcp: true,
    agent: true,
  },
})
```

Implementation example:

```ts
// convex/features/projects/operations.ts
import {
  operation,
  operationEffect,
  operationIssue,
  operationPreview,
  operationPreviewValidator,
  workspaceScope,
} from '@lupinum/trellis/backend'
import { requireRecord } from '@lupinum/trellis/auth'
import { v } from 'convex/values'

import { archiveProjectDescriptor } from '../../../shared/features/projects/operations'
import type { Doc, Id } from '../../_generated/dataModel'
import type { MutationCtx } from '../../_generated/server'
import type { AppIdentity } from '../../auth/appIdentity'
import { canArchiveProject } from './checks'
import { projectArchive } from './permissions'

type WorkspaceMutationCtx = MutationCtx & {
  workspaceId: Id<'workspaces'>
  appIdentity: () => Promise<NonNullable<AppIdentity>>
}

export const archiveProjectOp = operation.destructive({
  ...archiveProjectDescriptor,
  returns: v.null(),
  scope: workspaceScope(),
  permission: projectArchive,
  previewReturns: operationPreviewValidator({
    confirm: v.object({
      operation: v.literal('projects.archive'),
      targetId: v.id('projects'),
      updatedAt: v.number(),
    }),
  }),
  load: async (
    ctx: WorkspaceMutationCtx,
    args: { id: Id<'projects'> },
  ): Promise<{ project: Doc<'projects'> }> => {
    const project = await ctx.db.get(args.id)
    requireRecord(project, 'Project')
    return { project: project as Doc<'projects'> }
  },
  authorize: {
    label: 'projects.archive',
    check: (
      _actor: AppIdentity,
      loaded: { project: Doc<'projects'> },
    ) => canArchiveProject(loaded.project),
  },
  preview: async (_ctx, _args, loaded) =>
    operationPreview({
      summary: `Will archive "${loaded.project.name}"`,
      warnings: [
        operationIssue({
          code: 'project-archive',
          message: 'Archived projects are hidden from active planning views.',
        }),
      ],
      effects: [
        operationEffect({
          kind: 'projects',
          summary: 'Projects archived',
          count: 1,
        }),
      ],
      confirm: {
        operation: 'projects.archive',
        targetId: loaded.project._id,
        updatedAt: loaded.project.updatedAt,
      },
    }),
  handler: async (ctx, args, loaded, confirmation) => {
    if (loaded.project.updatedAt !== confirmation.confirm.updatedAt) {
      throw new Error('Project changed after preview.')
    }

    await ctx.db.patch(args.id, {
      status: 'archived',
      updatedAt: Date.now(),
    })

    return null
  },
})
```

Projection example:

```ts
// convex/features/projects/index.ts
import { mutation, query } from '../../_generated/server'
import { projectOperation } from '@lupinum/trellis/backend'

import { archiveProjectOp } from './operations'

export const previewArchiveProject = query(projectOperation.preview(archiveProjectOp))
export const executeArchiveProject = mutation(projectOperation.execute(archiveProjectOp))
```

The descriptor plus checked projections are the generated source material.
The implementation owns backend behavior.

Generated handles are the normal cross-surface API. They package the descriptor,
execute ref, preview ref, runtime, safety, permission, and projection metadata
into one checked value.

Generated ref module:

```ts
// generated/operation-refs.ts
// AUTO-GENERATED. Do not edit.
import { projectOperationRef } from '@lupinum/trellis/mcp'

import { api } from '../convex/_generated/api'
import { archiveProjectDescriptor } from '../shared/features/projects/operations'

export const projectsArchiveExecuteRef = projectOperationRef(
  archiveProjectDescriptor,
  'execute',
  api.features.projects.executeArchiveProject,
  { functionRef: 'features/projects:executeArchiveProject' },
)

export const projectsArchivePreviewRef = projectOperationRef(
  archiveProjectDescriptor,
  'preview',
  api.features.projects.previewArchiveProject,
  { functionRef: 'features/projects:previewArchiveProject' },
)
```

Generated handle module:

```ts
// generated/operation-handles/mcp.ts
// AUTO-GENERATED. Do not edit.
import { defineOperationHandle } from '@lupinum/trellis/mcp'

import { archiveProjectDescriptor } from '../../shared/features/projects/operations'
import {
  projectsArchiveExecuteRef,
  projectsArchivePreviewRef,
} from '../operation-refs'

export const archiveProjectHandle = defineOperationHandle(
  archiveProjectDescriptor,
  {
    executeRef: projectsArchiveExecuteRef,
    previewRef: projectsArchivePreviewRef,
    executeOperation: 'mutation',
    previewOperation: 'query',
    runtimes: ['mcp', 'testing'],
  },
)

export const operations = {
  byId: {
    'projects.archive': archiveProjectHandle,
  },
  projects: {
    archive: archiveProjectHandle,
  },
}
```

Normal MCP tool code imports only the generated handle:

```ts
// server/mcp/tools/archive-project.ts
import { operations } from '#trellis/operations/mcp'

import { mcp } from '../runtime'

export default mcp.tool.operation(operations.projects.archive, {
  meta: {
    name: 'archive-project',
  },
})
```

Normal agent tool code imports only the generated handle:

```ts
// agent/project-assistant.ts
import { operations } from '#trellis/operations/agent'

export const tools = {
  archiveProject: actionTool(operations.projects.archive),
}
```

Manual descriptor/ref binding is not the normal app-authoring path. It is
reserved for generated files, reviewed bridge code, and explicit advanced
escapes.

Doctor fails when:

- descriptor kind and projection kind disagree.
- descriptor args and implementation args diverge.
- descriptor permission key and implementation permission diverge.
- destructive metadata lacks preview or execute projection.
- MCP, agent, server, UI, or bridge bindings bypass generated handles without
  an explicit advanced permit.
- generated handles point at refs whose metadata does not match the descriptor
  id.
- server or agent files import Convex implementation modules directly.

## Protected Handler Pipeline

Protected backend work keeps the structured pipeline:

```text
principal -> actor -> guard -> load -> authorize -> handler
```

Candidate explicit authoring shape:

```ts
export const updateProject = mutation.protected({
  id: 'projects.update',
  args: {
    id: v.id('projects'),
    name: v.string(),
  },
  guard: projectWrite,
  load: async (ctx, args) => ({
    project: await ctx.db.projects.require(args.id),
  }),
  authorize: {
    label: 'projects.update',
    check: (actor, { project }) => actor.workspaceId === project.workspaceId,
  },
  handler: async (ctx, args, { project }) => {
    await ctx.db.projects.patch(project._id, {
      name: args.name,
      updatedAt: Date.now(),
    })
  },
})
```

The exact builder spelling may change. The invariants do not:

- public handlers are explicitly public.
- protected handlers declare guard and authorization behavior.
- unsafe handlers use typed unsafe permits.
- missing guard or missing runtime identity never accidentally means public.
- record-specific authorization happens after `load`.

Allowed public shape:

```ts
export const listPublicArticles = query.public({
  id: 'articles.listPublic',
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) =>
    await ctx.db
      .query('articles')
      .withIndex('by_visibility', (q) => q.eq('visibility', 'public'))
      .paginate(args.paginationOpts),
})
```

Unsafe shape:

```ts
export const supportLookup = query.unsafe({
  permit: unsafe.permit({
    kind: 'operatorSupportView',
    reason: 'Support operators can inspect tenant records after ticket verification.',
    scope: ['support', 'projects'],
    reviewBy: '2026-09-01',
  }),
  args: {
    workspaceId: v.id('workspaces'),
    projectId: v.id('projects'),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.projectId)
  },
})
```

## Workspace Access Resolution

Workspace operations derive the caller server-side. They never accept `userId`,
`identityKey`, `role`, or membership identifiers as authorization args.

The desired resolver flow:

```ts
export async function resolveWorkspaceAccess(ctx, input) {
  const identity = await ctx.auth.getUserIdentity()

  if (identity === null) {
    throw permissionDenied(input, 'Authentication is required.')
  }

  const user = await ctx.db
    .query('users')
    .withIndex('by_identity_key', (q) =>
      q.eq('identityKey', identity.tokenIdentifier),
    )
    .unique()

  if (user === null) {
    throw permissionDenied(input, 'Authenticated user is not registered.')
  }

  const membership = await ctx.db
    .query('memberships')
    .withIndex('by_user_workspace', (q) =>
      q.eq('userId', user._id).eq('workspaceId', input.workspaceId),
    )
    .unique()

  if (membership === null) {
    throw permissionDenied(input, 'Workspace membership is required.')
  }

  return {
    actor: {
      kind: 'user',
      userId: user._id,
      subject: identity.subject ?? identity.tokenIdentifier,
    },
    workspace: {
      id: input.workspaceId,
    },
    membership: {
      id: membership._id,
      role: membership.role,
    },
  }
}
```

Index requirements:

```ts
users: defineTable({
  identityKey: v.string(),
  name: v.optional(v.string()),
}).index('by_identity_key', ['identityKey'])

memberships: defineTable({
  userId: v.id('users'),
  workspaceId: v.id('workspaces'),
  role: v.union(
    v.literal('owner'),
    v.literal('admin'),
    v.literal('member'),
    v.literal('viewer'),
  ),
}).index('by_user_workspace', ['userId', 'workspaceId'])
```

`identity.tokenIdentifier` is the canonical stable Convex auth identity key for
auth-linked lookups. `subject` can be preserved for audit and display, but it
is not the global lookup key by itself.

## Scoped DB

Normal workspace handlers receive a generated scoped DB capability, not raw
`ctx.db`.

The vNext scoped DB surface:

```ts
ctx.db.projects.get(id)
ctx.db.projects.require(id)
ctx.db.projects.insert(data)
ctx.db.projects.patch(id, patch)
ctx.db.projects.delete(id)
ctx.db.projects.list.byStatus(args).paginate(paginationOpts)
ctx.db.projects.list.byCreatedAt(args).take(limit)
```

By-id reads may use `ctx.db.get`, but scoped DB verifies the loaded document:

```ts
async function getProject(id: Id<'projects'>) {
  const doc = await rawDb.get(id)

  if (doc === null) {
    return null
  }

  if (doc.workspaceId !== scope.workspaceId) {
    return null
  }

  return doc
}

async function requireProject(id: Id<'projects'>) {
  const doc = await rawDb.get(id)

  if (doc === null || doc.workspaceId !== scope.workspaceId) {
    throw new TrellisActionError({
      code: 'NOT_FOUND',
      feature: 'projects',
      action: 'load',
      message: 'Project was not found.',
    })
  }

  return doc
}
```

Wrong-workspace records are public `NOT_FOUND`. Developer diagnostics may retain
`CrossWorkspaceDenied`, but normal public responses must not leak it.

Inserts stamp the workspace:

```ts
async function insertProject(data: {
  name: string
  status: 'active' | 'paused'
}) {
  return await rawDb.insert('projects', {
    ...data,
    workspaceId: scope.workspaceId,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  })
}
```

Patch and delete reload through scoped DB first:

```ts
async function patchProject(id: Id<'projects'>, patch: Partial<ProjectPatch>) {
  await requireProject(id)
  await rawDb.patch(id, patch)
}

async function deleteProject(id: Id<'projects'>) {
  await requireProject(id)
  await rawDb.delete(id)
}
```

Generated list methods use workspace-first indexes:

```ts
projects: defineTable({
  workspaceId: v.id('workspaces'),
  name: v.string(),
  status: v.union(v.literal('active'), v.literal('paused'), v.literal('archived')),
  assignedUserId: v.optional(v.id('users')),
  createdAt: v.number(),
  updatedAt: v.number(),
})
  .index('by_workspace_status', ['workspaceId', 'status'])
  .index('by_workspace_assignee', ['workspaceId', 'assignedUserId'])
  .index('by_workspace_created_at', ['workspaceId', 'createdAt'])
```

Generated scoped query:

```ts
async function byStatus(args: {
  status: 'active' | 'paused' | 'archived'
}) {
  return rawDb
    .query('projects')
    .withIndex('by_workspace_status', (q) =>
      q.eq('workspaceId', scope.workspaceId).eq('status', args.status),
    )
}
```

Generic string-index access is allowed only as a temporary lower-level escape.
Named generated list methods are preferred.

Unsafe non-workspace-first indexes require:

```ts
unsafe.scopedIndex({
  table: 'projects',
  index: 'by_slug',
  reason: 'Public project slugs are globally unique and checked before exposure.',
  affectedTables: ['projects'],
  tests: [
    'cross-workspace project slug lookup returns public not found',
    'public slug lookup exposes only public projects',
  ],
})
```

Doctor fails when an unsafe scoped index declaration is missing `reason`,
`affectedTables`, or `tests`.

## Query And Index Policy

Trellis generates Convex queries that follow Convex's efficient path:

- use `withIndex` or `withSearchIndex` for large tables.
- avoid `.filter()` on database queries.
- avoid unbounded `.collect()` on exposed operations.
- use `.take(n)` for small bounded reads.
- use `.paginate(...)` for lists.
- use `maximumRowsRead` and `maximumBytesRead` for expensive pages.
- avoid `Date.now()` in queries.
- use denormalized counters or components for counts and sums.

Good:

```ts
export const listProjects = query({
  args: {
    workspaceId: v.id('workspaces'),
    status: projectStatusValidator,
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const access = await resolveWorkspaceAccess(ctx, {
      workspaceId: args.workspaceId,
      feature: 'projects',
      action: 'list',
    })

    const paginationOpts = clampPagination(args.paginationOpts, {
      maximumRowsRead: 200,
      maximumBytesRead: 256_000,
    })

    return await ctx.db
      .query('projects')
      .withIndex('by_workspace_status', (q) =>
        q.eq('workspaceId', access.workspace.id).eq('status', args.status),
      )
      .order('desc')
      .paginate(paginationOpts)
  },
})
```

Server-side clamping:

```ts
import type { PaginationOptions } from 'convex/server'

export function clampPagination(
  opts: PaginationOptions,
  limits: {
    maximumRowsRead: number
    maximumBytesRead: number
  },
): PaginationOptions {
  return {
    ...opts,
    maximumRowsRead: Math.min(
      opts.maximumRowsRead ?? limits.maximumRowsRead,
      limits.maximumRowsRead,
    ),
    maximumBytesRead: Math.min(
      opts.maximumBytesRead ?? limits.maximumBytesRead,
      limits.maximumBytesRead,
    ),
  }
}
```

Bad:

```ts
// Bad: scans then filters.
await ctx.db
  .query('projects')
  .filter((q) => q.eq(q.field('workspaceId'), workspaceId))
  .collect()
```

Also bad for exposed routes/tools:

```ts
// Bad: unbounded result set.
await ctx.db
  .query('projects')
  .withIndex('by_workspace', (q) => q.eq('workspaceId', workspaceId))
  .collect()
```

Acceptable only with proof:

```ts
// Acceptable for a tiny fixed domain table, with doctor metadata.
await ctx.db.query('projectStatuses').collect()
```

Doctor metadata:

```ts
boundedCollect({
  table: 'projectStatuses',
  reason: 'Static seed table with at most five rows.',
  maxRows: 5,
  tests: ['project status seed count is bounded'],
})
```

Queries should not use `Date.now()` directly:

```ts
// Bad: changing implicit time reduces cache reuse.
const now = Date.now()
return await ctx.db
  .query('events')
  .withIndex('by_workspace_starts_at', (q) =>
    q.eq('workspaceId', workspaceId).gte('startsAt', now),
  )
  .take(20)
```

Prefer explicit coarse args or scheduled state:

```ts
export const upcomingEvents = query({
  args: {
    workspaceId: v.id('workspaces'),
    nowBucket: v.number(),
  },
  handler: async (ctx, args) =>
    await ctx.db
      .query('events')
      .withIndex('by_workspace_starts_at', (q) =>
        q.eq('workspaceId', args.workspaceId).gte('startsAt', args.nowBucket),
      )
      .take(20),
})
```

Counts:

```ts
// Bad at scale.
const count = (
  await ctx.db
    .query('projects')
    .withIndex('by_workspace_status', (q) =>
      q.eq('workspaceId', workspaceId).eq('status', 'active'),
    )
    .collect()
).length
```

Use a maintained counter:

```ts
await ctx.db.patch(workspaceStats._id, {
  activeProjectCount: workspaceStats.activeProjectCount + 1,
})
```

Or an optional Convex component adapter:

```ts
// Optional adapter, not core runtime.
const activeProjectCount = await aggregate.count(ctx, {
  namespace: `workspace:${workspaceId}:projects:active`,
})
```

Hot counters use Sharded Counter or equivalent app-owned design.

## Caching Policy

Trellis cache policy:

| Need | Use |
| --- | --- |
| Reactive UI reads | Convex query cache |
| Repeated expensive external or AI calls | optional Action Cache adapter |
| Auth and membership decisions | no cross-request cache |
| Counts and sums | Aggregate component or denormalized counters |
| Hot counters | Sharded Counter or app-owned sharding |
| Generated Trellis metadata | `trellis prepare` artifacts |
| Agent/MCP tool results | redact and cap; cache only explicitly pure expensive calls |

Rules:

```ts
export const trellisCachingPolicy = {
  authorizationCache: 'never-across-requests',
  queryCache: 'convex-native',
  actionCache: 'pure-expensive-external-only',
  generatedMetadataCache: 'prepare-time-artifacts',
}
```

Do not cache these across requests:

- user membership.
- roles.
- active acting-for grants.
- workspace relation access.
- destructive confirmation authorization.
- MCP capability decisions.

It is acceptable to resolve once per function invocation and pass the resolved
actor/workspace context down.

Action Cache example:

```ts
export const summarizeDocument = action({
  args: {
    workspaceId: v.id('workspaces'),
    documentId: v.id('documents'),
    contentHash: v.string(),
  },
  handler: async (ctx, args) => {
    await assertWorkspaceRead(ctx, args.workspaceId)

    return await actionCache.fetch(ctx, {
      name: 'documents.summarize',
      args: {
        documentId: args.documentId,
        contentHash: args.contentHash,
      },
      ttlMs: 24 * 60 * 60 * 1000,
      run: async () => await callLlmForSummary(args.documentId),
    })
  },
})
```

Not allowed:

```ts
// Bad: authorization-sensitive result cached by user/workspace state.
await actionCache.fetch(ctx, {
  name: 'workspace.membership.allowed',
  args: { userId, workspaceId, action: 'projects.archive' },
  run: async () => await computeMembershipAuthorization(ctx, userId, workspaceId),
})
```

## Function Shape And Runtime Boundaries

Use Convex queries for deterministic reads.

Use Convex mutations for database writes and scheduled internal work.

Use Convex actions for external systems, LLM calls, cross-runtime work, and
other non-deterministic side effects.

Prefer plain TypeScript helpers over splitting a transaction into several
`ctx.runQuery` or `ctx.runMutation` calls.

Good:

```ts
async function loadProjectForUpdate(ctx: MutationCtx, id: Id<'projects'>) {
  const project = await ctx.db.get(id)
  requireRecord(project, 'Project')
  return project
}

export const updateProject = mutation({
  args: updateProjectArgs,
  handler: async (ctx, args) => {
    const project = await loadProjectForUpdate(ctx, args.id)
    await ctx.db.patch(project._id, { name: args.name })
  },
})
```

Avoid:

```ts
// Avoid when this could be one helper inside the same mutation.
const project = await ctx.runQuery(internal.projects.loadForUpdate, { id: args.id })
await ctx.runMutation(internal.projects.patchName, { id: project._id, name: args.name })
```

Long-running or high-volume work uses Scheduler, Cron, Workpool, or Workflow
adapters:

```ts
export const processArchiveBatch = internalMutation({
  args: {
    workspaceId: v.id('workspaces'),
    cursor: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const page = await ctx.db
      .query('projects')
      .withIndex('by_workspace_status', (q) =>
        q.eq('workspaceId', args.workspaceId).eq('status', 'archiving'),
      )
      .paginate({
        cursor: args.cursor ?? null,
        numItems: 50,
        maximumRowsRead: 200,
        maximumBytesRead: 256_000,
      })

    for (const project of page.page) {
      await ctx.db.patch(project._id, { status: 'archived' })
    }

    if (!page.isDone) {
      await ctx.scheduler.runAfter(0, internal.projects.processArchiveBatch, {
        workspaceId: args.workspaceId,
        cursor: page.continueCursor,
      })
    }
  },
})
```

## Rate Limiting

Rate limiting is a first-class operation concern.

Trellis owns:

- MCP ingress rate limiting.
- generated rate-limit metadata.
- doctor checks for missing rate limits on exposed writes/tools.
- adapters for Convex Rate Limiter.
- documentation that rate limiting is app-layer abuse control, not DDoS
  protection.

Applications still own business quota policy.

Operation metadata:

```ts
export const createProjectDescriptor = defineOperationDescriptor({
  id: 'projects.create',
  kind: 'mutation',
  args: createProjectArgs,
  permission: projectCreateKey,
  safety: 'bounded-write',
  rateLimit: 'productMutation',
})

export const archiveProjectDescriptor = defineOperationDescriptor({
  id: 'projects.archive',
  kind: 'destructive',
  args: archiveProjectArgs,
  permission: projectArchiveKey,
  safety: 'destructive-write',
  rateLimit: 'destructiveExecute',
})
```

Starter profile:

```ts
export const rateLimits = defineTrellisRateLimits({
  productMutation: {
    kind: 'tokenBucket',
    rate: 120,
    periodMs: 60_000,
    capacity: 240,
  },
  destructiveExecute: {
    kind: 'fixedWindow',
    rate: 5,
    periodMs: 60_000,
    capacity: 5,
  },
  mcpToolCall: {
    kind: 'tokenBucket',
    rate: 60,
    periodMs: 60_000,
    capacity: 120,
  },
  agentMessage: {
    kind: 'fixedWindow',
    rate: 1,
    periodMs: 5_000,
    capacity: 2,
  },
  agentTokensPerWorkspace: {
    kind: 'tokenBucket',
    rate: 100_000,
    periodMs: 60_000,
    capacity: 150_000,
  },
})
```

Generated usage:

```ts
await ctx.rateLimit.check('productMutation', {
  key: `workspace:${workspaceId}:user:${actor.userId}`,
  throws: true,
})
```

Destructive usage:

```ts
await ctx.rateLimit.check('destructiveExecute', {
  key: `workspace:${workspaceId}:actor:${actor.userId}:operation:${operationId}`,
  throws: true,
})
```

MCP key:

```ts
const rateLimitKey = [
  `workspace:${actor.workspaceId}`,
  `principal:${principal.subject}`,
  `mcpKey:${principal.mcpKeyId}`,
  `tool:${tool.name}`,
].join(':')
```

Agent key:

```ts
const rateLimitKey = [
  `workspace:${principal.workspaceId}`,
  `agent:${principal.agentId}`,
  `run:${principal.runId}`,
].join(':')
```

Production policy:

- app-layer limits fail closed when the limiter is unavailable for protected
  writes, destructive work, MCP tools, and agent tool execution.
- process-local stores are development conveniences only.
- public network-facing endpoints still require real network protection in
  front of the app.

## Agent Projection

Trellis does not replace Convex Agent.

Convex Agent owns:

- threads.
- messages.
- streaming.
- tool calls.
- human approval state.
- files.
- usage hooks.
- agent usage tracking.
- agent rate-limit integration points.

Trellis owns:

- generated action-backed tools.
- workspace binding for agent calls.
- Trellis action policy.
- ID resolution and ambiguity handling.
- destructive preview and confirmation requirements.
- result redaction hints.
- result size limits.
- audit metadata.
- Nuxt developer experience around agent threads and approvals.

Agent definition:

```ts
import { operations } from '#trellis/operations/agent'

export const projectAssistant = defineTrellisAgent({
  id: 'project.assistant',
  name: 'Project Assistant',
  scope: { kind: 'workspace' },
  component: components.agent,
  languageModel,
  instructions: 'Help workspace members summarize and maintain project data.',
  runtime: {
    durableOwner: 'convex-agent',
    rateLimit: {
      key: 'workspace-agent',
      maxPerMinute: 30,
    },
    usageTracking: 'convex-agent',
    workspacePrincipal: 'required',
  },
  tools: {
    listProjects: actionTool(operations.projects.list),
    createProject: actionTool(operations.projects.create),
    archiveProject: actionTool(operations.projects.archive),
  },
})
```

Agent tool metadata:

```ts
agent: {
  description: 'Archive a project in the current workspace.',
  safety: 'destructive',
  approval: 'destructive-confirmation',
  redaction: 'project-summary',
  rateLimit: 'destructiveExecute',
}
```

Tool context:

```ts
type TrellisAgentToolContext = {
  trellis: {
    workspaceId: Id<'workspaces'>
    agentId: string
    runId: string
    actingFor?: {
      userId: Id<'users'>
      grantedBy: Id<'users'>
      allowedActions: readonly string[]
      expiresAt: number
    }
  }
}
```

Tool execution gates:

```ts
function assertAgentToolPermitted(input: {
  ctx: TrellisAgentToolContext
  handle: AgentActionHandle
  permissions: AgentToolPermissions
}) {
  if (input.ctx.trellis.workspaceId !== input.permissions.workspaceId) {
    throw new TrellisAgentToolError('AGENT_WORKSPACE_MISMATCH')
  }

  if (!input.permissions.allowedActions.includes(input.handle.id)) {
    throw new TrellisAgentToolError('AGENT_ACTION_NOT_ALLOWED')
  }

  if (input.handle.writes.length > 0 && !input.permissions.allowWrites) {
    throw new TrellisAgentToolError('AGENT_WRITE_NOT_ALLOWED')
  }

  if (
    input.handle.kind === 'destructive' &&
    !input.permissions.allowDestructiveExecute
  ) {
    throw new TrellisAgentToolError('AGENT_DESTRUCTIVE_CONFIRMATION_REQUIRED')
  }
}
```

Result handling:

```ts
const raw = await executor.mutation(ctx, handle.ref, args)
const redacted = redactResult(raw, {
  mode: handle.tool.redaction.mode,
  handle,
})

assertResultSize(redacted, 16_384)

await audit({
  feature: handle.feature,
  action: handle.action,
  tool: handle.tool.name,
  safety: handle.tool.safety,
  phase: 'execute',
})

return redacted
```

Agent approval is UX. Trellis destructive confirmation remains the security
boundary. Execute reruns policy, record authorization, availability, stale-state
checks, and confirmation redemption.

## MCP Projection

MCP's normal app-business lane is generated operation handles:

```ts
import { operations } from '#trellis/operations/mcp'

export default mcp.tool.operation(operations.projects.archive)
```

This works for safe reads, bounded writes, and destructive operations because
the generated handle carries the operation kind, Convex ref, permission, safety,
preview ref, and runtime metadata.

Safe read operation tool:

```ts
import { operations } from '#trellis/operations/mcp'

export default mcp.tool.operation(operations.projects.list, {
  name: 'list-projects',
  description: 'List projects in the current workspace.',
  rateLimit: 'mcpToolCall',
})
```

Bounded write operation tool:

```ts
import { operations } from '#trellis/operations/mcp'

export default mcp.tool.operation(operations.projects.create, {
  name: 'create-project',
  description: 'Create one project in the current workspace.',
  rateLimit: 'productMutation',
  redaction: 'project-summary',
})
```

Destructive operation tool:

```ts
import { operations } from '#trellis/operations/mcp'

export default mcp.tool.operation(operations.projects.archive, {
  name: 'archive-project',
  rateLimit: 'destructiveExecute',
})
```

Direct ref lanes remain available only for narrow non-operation cases and
advanced migration work:

```ts
mcp.tool.query(...)
mcp.tool.mutation(...)
```

Those direct lanes must point at Trellis public/protected backend functions with
generated Trellis metadata. They are not the normal feature-operation API.

Generic custom tool:

```ts
export default mcp.tool.custom({
  permit: unsafe.permit({
    kind: 'externalService',
    reason: 'Reads Linear issue metadata after backend policy is checked.',
    scope: ['linear'],
    reviewBy: '2026-09-01',
  }),
  name: 'check-linear-issue',
  schema: checkLinearIssueArgs,
  handler: async (ctx, args) => {
    await ctx.authorize(integrationReadKey)
    return await linear.issue(args.issueId)
  },
})
```

Safety vocabulary:

- `read`: no write or external side effect.
- `bounded-write`: bounded write to records named in args.
- `sensitive-write`: invites, tokens, billing, public state, or security impact.
- `destructive-write`: delete, archive, revoke, publish, bulk, irreversible, or
  hard-to-reverse mutation.
- `external-side-effect`: email, webhook, third-party API, indexing, billing, or
  other non-Convex side effect.

Rules:

- `mcp.tool.operation(handle)` is the normal MCP API for app business work.
- `mcp.tool.query(...)` is an advanced direct-ref lane for read-only
  non-operation cases.
- `mcp.tool.mutation(...)` is an advanced direct-ref lane and accepts only
  `bounded-write`.
- sensitive, destructive, bulk, publish-like, revoke-like, audited, and
  external-side-effect work uses `mcp.tool.operation(...)`.
- tool-side classification cannot down-classify backend metadata.
- raw Convex refs without Trellis metadata are rejected unless explicitly
  public and read-only.
- MCP tool files must not import `operation-refs` directly.
- MCP tool files must not import Convex implementation modules.
- MCP discovery is advisory; backend execution is authoritative.

MCP runtime setup:

```ts
export const mcp = defineMcpRuntime({
  resolvePrincipal: async (event) => await resolveMcpPrincipal(event),
  resolveActor: async ({ principal, convex }) =>
    await convex.query(internal.auth.resolveActor, {
      subject: principal.subject,
    }),
  resolveCapabilities: async ({ actor, convex }) =>
    await convex.query(internal.permissions.context, {
      workspaceId: actor.workspaceId,
    }),
  principalKey: ({ principal }) => principal.subject,
  tenantKey: ({ actor }) => actor.workspaceId,
  callConvex: trustedConvexCaller(),
})
```

Workspace MCP starter must prove:

```text
MCP bearer token
  -> token lookup
  -> principal
  -> signed forwarding envelope
  -> Convex actor resolution
  -> backend permission context
  -> capability-aware tool discovery
  -> protected handler execution
```

`convex-mcp-gateway` may become an adapter if it fits Trellis's generated
handle model. OAuth/OIDC, scope filtering, per-tool authorization, audit
logging, and sanitized errors are gateway concerns. Product policy and tenant
authorization remain Trellis/Convex operation concerns.

## Destructive Operations

Destructive preview and execute are separate phases. Execute must not trust
preview-time decisions.

Both phases rerun:

- argument validation.
- caller resolution.
- workspace resolution.
- role policy.
- record loading.
- record authorization.
- availability checks.

Preview produces:

- human-readable effect summary.
- warnings.
- affected counts.
- opaque confirmation material.

Execute:

- redeems the confirmation.
- reruns the runtime safety checks.
- reruns stale-state checks.
- runs the business mutation.
- commits redemption and mutation atomically for DB-only destructive operations.

Confirmation receipt shape:

```ts
type TrellisConfirmationReceipt = {
  v: 1
  receiptId: string
  operationId: string
  previewRef: string
  executeRef: string
  principalKey: string
  tenantKey: string
  argsHash: string
  previewConfirmHash: string
  actionFingerprint: string
  stateVersionHash?: string
  issuedAt: number
  expiresAt: number
  nonce: string
}
```

Preview:

```ts
export const previewDeleteProject = query({
  args: deleteProjectArgs,
  returns: deleteProjectPreviewReturns,
  handler: async (ctx, args) => {
    const loaded = await deleteProject.load(ctx, args)
    await deleteProject.authorize(ctx, args, loaded)

    const preview = await deleteProject.preview(ctx, args, loaded)

    const receipt = await createConfirmationReceipt(ctx, {
      operationId: 'projects.delete',
      previewRef: 'features.projects.previewDeleteProject',
      executeRef: 'features.projects.executeDeleteProject',
      principalKey: ctx.actor.userId,
      tenantKey: loaded.project.workspaceId,
      args,
      confirm: preview.confirm,
      actionFingerprint: deleteProject.fingerprint,
      expiresInMs: 5 * 60_000,
    })

    return {
      ...preview,
      receiptId: receipt.receiptId,
      nonce: receipt.nonce,
    }
  },
})
```

Execute:

```ts
export const executeDeleteProject = mutation({
  args: {
    ...deleteProjectArgs,
    receiptId: v.string(),
    nonce: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const loaded = await deleteProject.load(ctx, args)
    await deleteProject.authorize(ctx, args, loaded)

    await redeemConfirmationReceipt(ctx, {
      receiptId: args.receiptId,
      nonce: args.nonce,
      operationId: 'projects.delete',
      executeRef: 'features.projects.executeDeleteProject',
      principalKey: ctx.actor.userId,
      tenantKey: loaded.project.workspaceId,
      args,
      staleState: {
        projectUpdatedAt: loaded.project.updatedAt,
      },
    })

    await deleteProject.handler(ctx, args, loaded)
    return null
  },
})
```

For DB-only destructive actions, receipt redemption and business mutation occur
inside the same Convex mutation. If the mutation throws, Convex rollback
semantics apply and the receipt is not consumed.

Later side-effectful destructive modes may use different redeem-before-run
semantics, but must require explicit idempotency and retry documentation.

## Signed Forwarding Envelope

Forwarded identity travels in a signed, short-lived envelope.

Normal public args must not contain `principal`, `delegation`, or raw forwarding
keys.

Reserved generated arg:

```ts
_trellisForwarding: v.optional(v.string())
```

Envelope shape:

```ts
type TrustedForwardingEnvelope = {
  v: 1
  kid: string
  iss: string
  aud: string
  jti: string
  sub: string
  principal: unknown
  delegation?: unknown
  transport: 'server' | 'webhook' | 'mcp' | 'bridge'
  purpose:
    | 'query'
    | 'mutation'
    | 'action'
    | 'operation-preview'
    | 'operation-execute'
  functionRef: string
  argsHash: string
  issuedAt: number
  expiresAt: number
  signature: string
}
```

Convex verifies:

- key id is accepted.
- signature is valid.
- envelope is not expired.
- issuer/audience match this deployment.
- function ref matches.
- args hash matches.
- subject matches principal.
- delegation subject matches delegation.
- replay policy matches the purpose and operation class.

Verification sketch:

```ts
export async function verifyForwardingEnvelope(input: {
  envelope: string
  functionRef: string
  args: Record<string, unknown>
  keys: ForwardingKeySet
}) {
  const parsed = parseEnvelope(input.envelope)
  const key = input.keys.get(parsed.kid)

  if (!key) throw forwardingDenied('unknown-key')
  if (parsed.expiresAt <= Date.now()) throw forwardingDenied('expired')
  if (parsed.functionRef !== input.functionRef) throw forwardingDenied('function-mismatch')

  const argsHash = createArgsHash(stripTrellisTransportArgs(input.args))
  if (parsed.argsHash !== argsHash) throw forwardingDenied('args-mismatch')

  await verifySignature(parsed, key)
  await assertReplayPolicy(parsed)

  return parsed
}
```

The envelope is an integrity mechanism, not a confidentiality mechanism, unless
implementation later chooses encryption. Principal and delegation payloads must
be minimal and non-secret.

A valid envelope authenticates the forwarding boundary. It does not grant
permission.

Forwarding RFC must define:

- signing algorithm and key storage.
- HMAC vs asymmetric vs JWS-like format.
- `kid` rotation and overlap windows.
- canonical Convex args serialization for `argsHash`.
- excluded metadata fields.
- function ref identity format.
- maximum TTLs by purpose.
- clock-skew tolerance.
- replay policy by purpose.
- production nonce/redemption store requirements.
- test vectors for nested args, arrays, Convex ids, optional fields, and
  excluded metadata.
- principal and delegation validators.
- maximum serialized envelope size.
- error taxonomy.

## Unsafe Permits

One typed permit mechanism covers:

- backend unsafe handlers.
- tenant escapes.
- non-workspace-first scoped indexes.
- generic MCP custom tools.
- agent custom tools.
- public writes.

Permit example:

```ts
unsafe.permit({
  kind: 'preTenantUpload',
  reason: 'Generate upload URL before an asset record exists.',
  scope: ['assets'],
  reviewBy: '2026-09-01',
})
```

Allowed kinds:

```ts
export const unsafePermitKinds = defineUnsafePermitKinds({
  preTenantUpload: {
    defaultScope: ['assets'],
  },
  operatorSupportView: {
    requiresReviewBy: true,
  },
  externalService: {
    requiresScope: true,
  },
  globalPublicLookup: {
    requiresTests: true,
  },
})
```

Default mode:

- `kind`, `reason`, and `scope` are required.
- `reviewBy` is optional but recommended.

Strict/security mode:

- `reviewBy` is required.
- expired `reviewBy` fails.
- uncategorized permits fail.
- missing tests for tenant escapes fail.

Doctor groups permits:

```text
Unsafe permits
  preTenantUpload       1
  operatorSupportView   2
  externalService       1
  uncategorized         0
```

## Doctor

`trellis doctor` becomes an adoption, safety, and cost dashboard.

Commands:

```bash
trellis doctor
trellis doctor --security
trellis doctor --convex
trellis doctor --workspace
trellis doctor --mcp
trellis doctor --agent
trellis doctor --adoption
trellis doctor --json
trellis doctor --fix
```

Normal output:

```text
Detected app
  layers: Core, Auth, Workspace, MCP
  starter lineage: workspace-mcp
  features: projects, members, documents
  tenant key: workspaceId
  operations: 18 total, 4 destructive
  MCP tools: 7 total, 2 destructive
  agent tools: 5 total, 1 destructive
  unsafe permits: 2

Findings
  error   projects.list uses collect() in an exposed workspace operation
  error   destructive MCP tool archive-project is missing operation binding
  warn    documents table has workspaceId but no by_workspace index
  warn    agent tool summarize-document has no result size cap
```

Doctor fails or warns on:

- public Convex function without validators.
- public function without access control.
- workspace handler using raw `ctx.db`.
- workspace list index not starting with `workspaceId`.
- `.filter()` on Convex DB query.
- unbounded `.collect()` in exposed query/action/tool.
- query using `Date.now()` directly.
- exposed mutation/action/tool without rate limit metadata.
- agent/MCP write tool without approval, redaction, or result size cap.
- destructive tool without operation binding.
- action cache used for authorization-sensitive data.
- repeated `ctx.runQuery` or `ctx.runMutation` where one helper would keep work
  in a transaction.
- non-workspace-first scoped index without unsafe declaration.
- typed unsafe permit missing reason, scope, review date, or tests in strict
  mode.
- process-local production confirmation or rate-limit store.
- forwarding identity in public args.
- missing forwarding signing keys in production.
- Convex Agent lane duplicating thread/message tables.

`doctor --fix` may only perform safe mechanical changes. It must not silently
change authorization, tenant classification, forwarding identity behavior,
destructive operation binding, MCP safety classification, or rate-limit policy.

Machine output:

```json
{
  "schemaVersion": 1,
  "layers": ["core", "auth", "workspace", "mcp"],
  "features": [],
  "operations": [],
  "tools": [],
  "rateLimits": [],
  "unsafePermits": [],
  "findings": []
}
```

Doctor JSON must be safe for bug reports. It must not contain secrets, raw
forwarding envelopes, bearer tokens, raw principal/delegation payloads, request
headers, or unredacted user-authored data.

## Explain

`trellis explain` reads structured inventory first.

Commands:

```bash
trellis explain operation projects.archive
trellis explain tool mcp.archive-project
trellis explain feature projects
trellis explain workspace
```

`explain operation` output:

```text
Operation projects.archive
  kind: destructive
  safety: destructive-write
  permission: projects.archive
  rate limit: destructiveExecute
  scope: workspace
  tenant: workspaceId from loaded project
  load: project
  authorize: projects.archive
  preview: convex/features/projects.previewArchiveProject
  execute: convex/features/projects.executeArchiveProject
  MCP tool: archive-project
  agent tool: projects_archive
  confirmation: required
  result redaction: project-summary
```

AST/source analysis is supplemental diagnostics only, not the source of truth
for security claims.

## Upgrade

Generated code and public APIs need an upgrade path.

Commands:

```bash
trellis upgrade
trellis upgrade --from 0.4 --to 1.0
trellis upgrade --check
trellis upgrade --write
```

Codemods must be:

- idempotent.
- test-backed on fixtures.
- conservative.
- explicit about files they cannot update safely.

Initial migration table:

| Old path or pattern | New path or pattern | Migration |
| --- | --- | --- |
| `@lupinum/trellis/bridge` | `@lupinum/trellis-bridge` | codemod |
| `@lupinum/trellis/functions` | `@lupinum/trellis/backend` | codemod |
| `tool.fromOperation(...)` | `mcp.tool.operation(generatedHandle)` | codemod |
| raw trusted forwarding args | `_trellisForwarding` signed envelope | codemod plus audit |
| `unsafe.*({ bypass })` | `unsafe.*({ permit: unsafe.permit(...) })` | codemod when obvious |
| arity-inferred `authorize` | explicit authorize object/helper | audit unless provably safe |
| `workspace --mcp` | `workspace-mcp` | CLI migration |

## Starters And Fixtures

Official starters:

```text
public
personal
workspace
workspace-mcp
```

Starter generation comes from tested fixture apps.

```text
fixtures/
  public/
  personal/
  workspace/
  workspace-mcp/
  bridge-consumer/
```

Each fixture:

- installs.
- builds.
- typechecks.
- runs minimal tests.
- passes `trellis doctor`.
- has starter snapshots.
- has a starter manifest controlling copied/excluded/transformed files.

Public starter includes:

- one public feature.
- live query.
- mutation.
- no auth.
- no tenant.
- no MCP.
- no bridge.

Personal starter includes:

- auth.
- user principal.
- personal actor.
- owner-scoped records.
- one authorization test.

Workspace starter includes:

- auth.
- workspace membership.
- roles.
- permissions.
- tenant-scoped table.
- scoped DB.
- `_can` projection.
- one server route.
- tenant tests.

Workspace MCP starter includes Workspace plus:

- MCP token/key flow.
- principal resolution.
- actor/capability resolution.
- signed forwarding.
- one read tool.
- one bounded write tool.
- one destructive operation tool.
- confirmation store.
- rate limiting.
- e2e or integration test proving tool execution.

`cms` is not a default Trellis starter. Ginko-owned setup remains Ginko-owned.
A bridge-consumer fixture may exist for packaged integration testing.

## Component Bridge

Bridge exists for packaged integrations, not app-local architecture.

Use bridge when a package needs to:

- install host-owned Convex files.
- expose stable root refs.
- hide internal component refs.
- forward a verified principal into component functions.
- drift-check generated host files.
- manage host setup edits.

Do not use bridge when app-local code can call root handlers directly.

Bridge imports:

```ts
import { createComponentBridge } from '@lupinum/trellis-bridge/convex'
import { defineBridgeManifest } from '@lupinum/trellis-bridge/manifest'
```

Bridge invariants:

- bridge files are generated, thin, and host-owned.
- bridge manifests do not contain business logic.
- bridge functions forward identity through signed forwarding envelopes.
- component guards, actor resolution, and authorization still run.
- direct internal component refs remain private.
- drift is checkable.
- package authors own product-specific setup commands.

Ginko CMS alignment:

- Ginko depends on `@lupinum/trellis-bridge` for bridge internals.
- Ginko continues to expose Ginko-owned setup and bridge commands.
- Ginko docs do not require users to learn Trellis bridge concepts.
- Ginko bridge manifests remain the source of generated host files.
- destructive Studio and MCP workflows use real operations.

Rule:

```text
Trellis bridge powers package integration.
Ginko CMS owns product setup and product terminology.
```

## Observability

Core owns event vocabulary and emission points. Delivery may move to
`@lupinum/trellis-observability`.

Core API:

```ts
observe(event)
```

Sink contract:

```ts
type ObservationSink = {
  emit(event: RedactedTrellisObservationEvent): void | Promise<void>
}
```

Sink rules:

- receives already-normalized, already-redacted events.
- cannot change schema, redaction, correlation, identity, sampling, or request
  behavior.
- failure is fail-open.
- slow delivery must not delay user requests beyond a small configured timeout.

Test capture remains in `@lupinum/trellis/testing`.

## ESLint

Rules move to `@lupinum/trellis-eslint`.

Default severities:

- security boundary rules: error.
- boundary/style rules: warn.
- experimental rules: off.

Usage:

```js
import trellis from '@lupinum/trellis-eslint'

export default [
  trellis.configs.recommended,
  trellis.configs.strictWorkspace,
  trellis.configs.strictMcp,
]
```

## Security Model

Trellis vNext defends against:

- forged forwarded principals.
- raw public args smuggling identity.
- exposed forwarding shared secrets.
- stale or replayed destructive confirmations.
- stale preview execution after args, version, tenant, or permission drift.
- cross-tenant by-id reads.
- cross-tenant MCP tool invocation.
- unbounded hostile list operations.
- MCP tool duplication bypassing backend authorization.
- visible MCP tools whose backend authorization denies execution.
- generated bridge drift.
- process-local production confirmation or rate-limit state loss.
- user-authored text treated as trusted model-facing output.
- agent tools returning excessive or unredacted data.

Trellis does not fully solve:

- compromised server runtime.
- malicious package authors.
- app-defined permission logic bugs.
- weak app actor resolvers.
- network-layer DDoS.
- MCP clients ignoring annotations.
- secrets included by apps inside custom principal payloads.

Production fails closed for:

- missing forwarding signing keys.
- weak forwarding keys.
- expired forwarding envelope.
- invalid replay state.
- missing principal accessor on protected handlers.
- destructive MCP tool without operation binding.
- agent destructive execute without explicit permission.
- process-local confirmation store for production destructive MCP.
- unavailable limiter for protected/destructive MCP or agent execution.
- public runtime config exposing secrets.

Runtime failure policy:

| Surface | Failure | Policy |
| --- | --- | --- |
| Protected handler | missing principal accessor | deny in production; actionable throw in dev/test |
| Protected handler | missing actor when guard requires actor | deny in production; actionable throw in dev/test |
| Public handler | no identity wiring | allowed only with explicit public access |
| Trusted forwarding | invalid, expired, replayed, or mismatched envelope | hard deny |
| Scoped DB | wrong-workspace by-id record | public `NOT_FOUND` |
| MCP discovery | capability resolution fails | hide protected tools and emit observation |
| MCP execution | backend denies visible tool | backend denial wins; emit drift observation |
| Agent execution | workspace mismatch | hard deny |
| Destructive confirmation | store unavailable | hard deny |
| Rate limiting | limiter unavailable for protected/destructive tool | hard deny |
| Observability delivery | sink throws or times out | fail open |
| Doctor | finding fails strict policy | non-zero exit |

## Public Surface Budget

Every public export needs one label:

- core.
- auth.
- workspace.
- backend.
- mcp.
- agent.
- server.
- testing.
- package-author.
- internal.

Budget covers:

- npm package exports.
- Nuxt aliases.
- Nuxt auto-imports.
- generated aliases.
- global components.
- CLI commands.
- generated file contracts.
- bridge manifest contracts.
- public docs snippets.

Acceptance questions:

1. Is this needed by consumer app code?
2. Is this needed by package authors such as Ginko CMS?
3. Can it be generated instead?
4. Can it be private and surfaced through doctor or explain?
5. Does it create a second source of truth?

CI:

```bash
pnpm run check:public-api
trellis check-public-api
```

Public surface diffs require at least one of:

- accepted ADR/spec update.
- migration note.
- test update.
- docs update.

## Runtime And Build Budget

Rules:

- public/core apps must not load MCP, bridge, ESLint, agent, or observability
  delivery code at runtime.
- app startup must not run doctor/explain analysis.
- request-time code must not run `trellis prepare`.
- runtime code imports generated artifacts.
- MCP runtime may cache per-request principal, actor, capability, and tool
  context.
- auth/membership decisions are not cached across requests.
- signed forwarding uses local key material and avoids per-call remote key
  lookups.
- doctor, explain, upgrade, and fixture generation may do heavier static
  analysis.

Initial benchmark targets:

```text
forwarding envelope verification: under 1ms p99 local benchmark before network/Convex time
trellis prepare after one feature edit: under 2s in reference fixture
trellis doctor from existing graph: under 1s in reference fixture
trellis explain operation: under 1s in reference fixture
```

If security or correctness requires a slower path, the RFC or ADR must document
the measured tradeoff.

## Testing Spec

The pipeline is the product. Tests must exercise the pipeline, not only leaf
helpers.

Core tests:

- live query state.
- server caller auth modes.
- uploads.
- config validation.
- request-time code does not generate files.

Auth tests:

- missing runtime identity fails closed.
- signed-in principal does not imply actor.
- actor resolution is app-owned.
- forged forwarded identity fails.
- `tokenIdentifier` is used for auth-linked user lookup.

Workspace tests:

- viewer/member/admin role checks.
- cross-workspace by-id reads return public not found.
- scoped DB index use requires `workspaceId` first.
- by-id scoped DB reads verify `workspaceId`.
- tenant escape requires typed permit.
- `_can` projection is only a hint.

Convex cost tests:

- exposed list operations are paginated or bounded.
- `.filter()` on DB query is reported.
- exposed `.collect()` without bounded proof is reported.
- pagination caps are generated for expensive pages.
- counts do not use `.collect().length` in exposed handlers.

Destructive tests:

- preview reruns full safety pipeline.
- execute reruns full safety pipeline.
- confirmation receipts are redeemed atomically with DB-only execute.
- failed execute follows Convex rollback semantics.
- replay fails.
- stale state fails.
- wrong tenant key fails.

MCP tests:

- token -> principal -> actor -> permission -> tool execution.
- capability hidden means tool unavailable.
- backend denial still blocks visible tool.
- destructive operation requires preview.
- generic destructive custom tool is rejected.
- direct mutation requires bounded-write metadata.
- missing distributed production rate-limit store fails production checks.

Agent tests:

- agent tool requires workspace-bound context.
- agent tool fails on workspace mismatch.
- writes require explicit write permission.
- destructive execute requires explicit destructive permission and receipt.
- result redaction runs before result size check.
- excessive result size fails.
- acting-for grant expiry fails.
- Convex Agent thread/message tables are not duplicated by Trellis.

Bridge tests:

- generated bridge forwards signed envelope.
- query, mutation, action, internal variants work.
- generated files drift-check.
- Ginko-shaped fixture passes bridge check.

Starter tests:

- every starter installs, builds, typechecks, tests, and passes doctor.
- generated starters avoid advanced layers they did not enable.

## Release Plan

This is a major release. Prefer deletion over compatibility when the migration
path is clear.

### Phase 0: Spikes And Fixtures

- Create public, personal, workspace, and workspace-mcp fixtures.
- Create a minimal Ginko-shaped bridge consumer fixture.
- Spike operation-first MCP without Convex implementation imports in server
  tool files.
- Spike signed forwarding hashing, TTL, key rotation, and replay.
- Spike scoped DB generation with workspace-first indexes.
- Spike rate-limit metadata and doctor checks.
- Add target API type tests.

Exit:

- fixtures build, typecheck, test, and pass doctor.
- risky experiments have go/no-go notes.
- CMS/Ginko ownership is decided.

### Phase 1: Fixture-Based Starters

- Convert starter generation to fixture sources.
- Add starter manifests and snapshots.
- Keep generated apps simple and inspectable.

Exit:

- fresh public and workspace apps build without MCP/bridge concepts.
- workspace-mcp proves read, bounded write, destructive preview, confirmation,
  replay failure, and drift failure.

### Phase 2: Scoped DB And Convex Cost Rules

- Generate scoped DB for workspace handlers.
- Enforce workspace-first list indexes.
- Add bounded pagination generation.
- Add doctor rules for `.filter()`, `.collect()`, Date.now in queries, and
  unbounded counts.
- Add optional adapters for Aggregate, Sharded Counter, and Action Cache.

Exit:

- secure path is the cheap path in workspace fixtures.
- hostile calls stop after indexed auth/membership checks.

### Phase 3: Trusted Forwarding

- Implement signed forwarding envelope.
- Update server callers.
- Update MCP runtime.
- Update bridge runtime fixture.
- Delete raw shared-key forwarding args.

Exit:

- forged principal args fail.
- stale envelope fails.
- wrong function ref fails.
- wrong args hash fails.
- unknown `kid`, wrong audience, and replay fail.

### Phase 4: Operation-First MCP And Agent Projection

- Add `mcp.tool.query`, `mcp.tool.mutation`, `mcp.tool.operation`.
- Add generated agent action handles and `actionTool`.
- Make generated operation handles the normal UI/server/MCP/agent/bridge
  exposure object.
- Mark generic custom tools advanced.
- Fix destructive annotations.
- Add explicit tenant binding.
- Add rate-limit metadata to tools.
- Update examples and bridge fixture.

Exit:

- no destructive MCP tool uses generic custom tool.
- server tool files do not import Convex implementations.
- server tool files import generated operation handles, not operation refs.
- agent tools enforce workspace, allowed actions, write gates, destructive
  gates, redaction, size limits, and audit.

### Phase 5: Bridge Extraction

- Create `@lupinum/trellis-bridge`.
- Move bridge runtime, manifest, drift checks, and bridge-author helpers.
- Update Ginko-shaped fixture.
- Delete bridge exports from core.

Exit:

- core has no bridge public export.
- Ginko-shaped fixture passes.
- coordinated Ginko CMS package E2E passes against packed Trellis packages.

### Phase 6: Public Surface Cleanup

- Simplify exports.
- Move ESLint and observability delivery out of core.
- Reduce declaration-merging registries where explicit inventory works.
- Add public-surface CI budget.
- Update docs to job-based imports.

Exit:

- public export count decreases.
- missing codegen errors are actionable.
- common imports fit on one docs page.

### Phase 7: CLI And Docs

- Add `trellis upgrade`.
- Add `trellis explain`.
- Expand doctor dashboard.
- Rewrite docs with progressive disclosure.

Exit:

- fresh user can build public, workspace, and workspace MCP apps from docs
  without reading ADRs.
- doctor explains app shape.
- upgrade codemods run on old fixtures.

## Questions And Resolutions

Resolved:

1. Should Trellis add a broad runtime cache?
   - No. Use Convex query caching, indexed reads, bounded queries, and optional
     action caching for expensive pure external work.
2. Should auth/membership be cached across requests?
   - No. Resolve through indexed lookups per operation invocation.
3. Should rate limiting be optional documentation only?
   - No. It becomes operation/tool metadata and doctor policy for writes,
     destructive work, MCP, and agents.
4. Should agent support duplicate Convex Agent storage?
   - No. Convex Agent owns threads/messages/streaming/tool-call state/files and
     usage hooks. Trellis owns generated safe operation tools.
5. Should MCP expose raw DB tools?
   - No. MCP exposes generated queries, bounded mutations, and operations.
6. Should destructive MCP use generic custom tools?
   - No. Destructive MCP uses operation-backed preview/confirm/execute.
7. Should bridge stay in core?
   - No. It moves to `@lupinum/trellis-bridge`.
8. Should Ginko users learn Trellis bridge internals?
   - No. Ginko owns product setup and terminology.
9. Should workspace indexes exposed through scoped DB start with `workspaceId`?
   - Yes, except explicit unsafe/global declarations with tests.
10. Should wrong-workspace by-id records leak diagnostics publicly?
    - No. They return public `NOT_FOUND`.
11. Should old public paths stay as aliases?
    - No, unless this spec explicitly says otherwise.
12. Should `workspace-mcp` replace `workspace --mcp`?
    - Yes for the next major.
13. Should the public backend import be `@lupinum/trellis/backend`?
    - Yes.
14. How much operation projection can be derived without Convex codegen ordering
    problems?
    - Derive it during `trellis prepare` into generated operation refs and
      handles. App-facing MCP, agent, server, UI, and bridge code should import
      generated handles, not manually bind descriptors to refs.

Still open:

1. Should public-access handlers use `query.public(...)`, `guard: open`, or
   `publicAccess`?
2. Is the CMS path only Ginko-owned setup, an advanced bridge-author fixture,
   or both in separate places?
3. Does `convex-mcp-gateway` become the default MCP adapter, an optional
   adapter, or only a reference implementation?
4. Which first-party rate-limit store adapters ship in 1.0 besides Convex Rate
   Limiter integration?

## Acceptance Criteria For 1.0

The release is ready when:

- bridge is removed from core public exports.
- production-safe forwarding replaces raw shared-key and identity args.
- scoped DB is the normal workspace handler DB surface.
- workspace-first indexes are enforced for scoped list reads.
- exposed list operations are bounded or paginated.
- Convex cost doctor rules cover `.filter()`, exposed `.collect()`,
  `Date.now()` in queries, unbounded counts, and missing pagination caps.
- app-layer rate-limit metadata exists for protected writes, destructive
  operations, MCP tools, and agent tools.
- generated operation handles are the normal cross-surface API for UI, server,
  MCP, agents, bridge, and tests.
- destructive MCP uses operation-backed preview/confirm/execute only.
- agent tools enforce workspace, allowed action, write, destructive,
  redaction, result size, rate-limit, and audit rules.
- workspace-mcp proves token -> principal -> actor -> permission -> tool
  execution, plus destructive preview, confirmation, replay failure, and drift
  failure.
- public, personal, workspace, and workspace-mcp starters are generated from
  tested fixtures.
- typed unsafe permits cover unsafe handlers, tenant escapes, generic MCP
  custom tools, and custom agent tools.
- direct MCP mutations require explicit `bounded-write` classification backed
  by generated Trellis metadata.
- first-party production-safe confirmation/replay and rate-limit store paths
  exist and pass doctor self-tests.
- doctor checks forwarding, tenant boundaries, scoped DB, Convex query cost,
  MCP safety, agent safety, destructive operations, confirmation stores, and
  rate-limit stores.
- inventory engine emits versioned JSON used by doctor, explain, and upgrade.
- public-surface budget runs in CI.
- old bridge imports, old MCP tool patterns, old forwarding helpers, and old
  unsafe permits have codemods or `upgrade --check` diagnostics.
- forwarding envelope RFC has named ownership and security-aware review.

## Final Target Shape

The best version of Trellis is calmer, not weaker.

It starts small:

```text
Nuxt + Convex, clean data calls, one feature folder.
```

It becomes strict at trust boundaries:

```text
auth, actor resolution, permissions, tenant isolation, scoped DB.
```

It becomes cost-aware at scale boundaries:

```text
indexed auth, bounded reads, rate limits, native Convex query caching.
```

It becomes unforgiving at agent and tool write boundaries:

```text
operation preview, confirmation, drift check, replay protection, redaction.
```

It keeps packaged integrations behind a clear door:

```text
Use bridge only when shipping something like Ginko CMS.
```

The final product promise:

```text
Create app.
Add feature.
Protect handler.
Expose operation to UI, server, MCP, or agent.
Run doctor.
Ship with the secure path as the cheap path.
```

## References

Local accepted ADRs:

- `meta/adr/0004-protected-handler-pipeline.md`
- `meta/adr/0005-backend-owned-permissions-and-tenant-isolation.md`
- `meta/adr/0010-rate-limiting-boundaries.md`
- `meta/adr/0012-agent-friendly-framework-structure.md`
- `meta/adr/0014-component-bridges-for-packaged-integrations.md`
- `meta/adr/0016-standardize-observability-on-evlog.md`

Convex references used by the vNext Convex rules:

- Convex query caching, reactivity, and consistency:
  https://docs.convex.dev/functions/query-functions
- Convex best practices for indexes, filters, validators, actions, and helper
  organization: https://docs.convex.dev/understanding/best-practices/
- Convex pagination read caps:
  https://docs.convex.dev/database/pagination
- Convex Rate Limiter component:
  https://www.convex.dev/components/rate-limiter
- Convex Action Cache component:
  https://www.convex.dev/components/action-cache
- Convex Agent docs:
  https://docs.convex.dev/agents/overview
- Convex Agent tools:
  https://docs.convex.dev/agents/tools
- Convex Agent tool approval:
  https://docs.convex.dev/agents/tool-approval
- Convex Agent rate limiting:
  https://docs.convex.dev/agents/rate-limiting
- Convex Agent usage tracking:
  https://docs.convex.dev/agents/usage-tracking
- Convex Workpool component:
  https://www.convex.dev/components/workpool
- Convex Aggregate component:
  https://www.convex.dev/components/aggregate
- Convex Sharded Counter component:
  https://www.convex.dev/components/sharded-counter
- Convex MCP Gateway component:
  https://www.convex.dev/components/convex-mcp-gateway
