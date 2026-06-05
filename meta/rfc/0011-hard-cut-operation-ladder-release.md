# 0011: Hard-Cut Operation Ladder Release

Status: Proposed
Date: 2026-06-03

Related GitHub issues:

- [#12: API Review](https://github.com/lupinum-dev/trellis/issues/12)
- [#13: Review Constraintness](https://github.com/lupinum-dev/trellis/issues/13)
- [#6: Permission decision explanations](https://github.com/lupinum-dev/trellis/issues/6)
- [#10: Permission CLI doctor, matrix, and explain](https://github.com/lupinum-dev/trellis/issues/10)
- [#7: Explicit permission grants and denies](https://github.com/lupinum-dev/trellis/issues/7)
- [#8: Tenant-defined role overlays](https://github.com/lupinum-dev/trellis/issues/8)
- [#9: Record-level sharing permissions](https://github.com/lupinum-dev/trellis/issues/9)
- [#11: Permission audit events](https://github.com/lupinum-dev/trellis/issues/11)
- [#1: Doctor should recognize Trellis-through-CMS consumer apps](https://github.com/lupinum-dev/trellis/issues/1)
- [#5: Viteplus migration](https://github.com/lupinum-dev/trellis/issues/5)

## Summary

The next hard-cut version should be `v0.2 Operation Ladder`: an intentional public-surface reset before
Trellis commits to a stable 1.0 contract.

The release should make operations the primary public app primitive, make permissions explainable and
inventory-backed, and turn auth, workspace, and MCP into additive ladder steps. It should not add
permission override tables, tenant-defined role overlays, record-sharing tables, or audit tables yet.
Those are real features, but they should wait until the permission vocabulary is constrained,
explainable, and inspectable.

The final `v0.2` experience should feel like Nuxt: one obvious beginner path, conventions that install
the boring lifecycle, and explicit advanced seams when the app needs to leave the default path.

## Problem

The current Trellis core is strong, but the first user experience exposes too many concepts at once:

- `defineArgs`
- `defineTrellis`
- `query.public`, `query.authenticated`, `query.workspace`, `mutation.public`,
  `mutation.authenticated`, `mutation.workspace`, `unsafe`
- `defineGuard`
- `definePermission`
- `defineFeature`
- `defineOperation`
- `defineOperationDescriptor`
- `implementOperation`
- `previewOf`
- `operationPreview`
- MCP tool wrappers
- safety stamping
- identity forwarding
- tenant classification

Most of these concepts are useful. The problem is sequencing and constraint. A beginner or coding agent
can write plausible code that compiles while missing a lifecycle step, duplicating a permission source,
or re-declaring operation metadata in a second surface.

The open GitHub issues point in two directions:

1. Make the public API smaller and more constrained.
2. Add richer authorization features.

The second direction should not happen first. Grants, role overlays, record sharing, and audit events add
tables and new sources of authorization state. Adding them before permissions are explainable and
inventory-backed would make Trellis harder to reason about.

## Before

The current teaching path is mostly template-first:

```bash
trellis init my-app --template public
trellis init my-app --template personal
trellis init my-app --template workspace
trellis init my-app --template workspace-mcp
```

The current backend shape asks users to learn the builder runtime early:

```ts
export const { mutation, query, unsafe } = defineTrellis(
  { query: generatedQuery, mutation: generatedMutation },
  {
    caller,
    appIdentity: getAppIdentityFromCaller,
    isolation: {
      tables: isolatedTables,
      sharedTables: explicitlySharedTables,
    },
  },
)
```

Feature implementation often splits args, permissions, operations, and MCP projection across separate
files:

```ts
export const createTodo = defineArgs({
  description: 'Create a todo',
  args: {
    title: v.string(),
  },
})

export const todoCreate = definePermission({
  key: 'todo.create',
  check: hasWorkspace.and(hasMinimumRole('member')),
})

export const create = mutation.workspace({
  args: createTodo.args,
  permission: todoCreate,
  handler: async (ctx, args) => {
    return await ctx.db.insert('todos', {
      workspaceId: ctx.workspaceId,
      title: args.title,
      completed: false,
      createdAt: Date.now(),
    })
  },
})
```

MCP projection can require re-declaring schema, function refs, permissions, and safety in a server tool
file.

## After

The default teaching path is additive:

```bash
trellis init my-app
trellis add auth
trellis add workspace
trellis add mcp
trellis add operation createTodo
trellis add operation removeProject --destructive
```

Preset shortcuts can remain, but they should be shortcuts over the additive ladder:

```bash
trellis init my-app --preset workspace-mcp
```

The primary public primitive is an operation:

```ts
import { operation } from '@lupinum/trellis/app'
import { v } from 'convex/values'

export const createTodo = operation.mutation({
  description: 'Create a todo in the current workspace',
  scope: workspace,
  permission: todoCreate,
  args: {
    title: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert('todos', {
      workspaceId: ctx.workspaceId,
      title: args.title,
      completed: false,
      createdAt: Date.now(),
    })
  },
})
```

The expanded expert form still exists, but it moves behind advanced exports and advanced docs.

## Final v0.2 Experience

### New App

A user starts with one command:

```bash
pnpm dlx @lupinum/trellis init my-app
cd my-app
pnpm install
pnpm dev
```

The generated app is public, runnable, and small. It has Convex wiring, a visible feature folder, one
example operation, a checked `.env.example`, and no auth, workspace, MCP, bridge, or advanced permission
tables.

The first successful task is not "understand Trellis." It is "define and call one operation."

### Add Capabilities

Capabilities are additive:

```bash
trellis add auth
trellis add workspace
trellis add mcp
```

Each command performs a complete hard cut for that capability:

- `add auth` installs Better Auth wiring, route protection, auth pages or components, and Trellis-owned
  app-user bootstrap.
- `add workspace` installs the workspace identity, role, permission, access-context, and tenant
  classification baseline.
- `add mcp` installs the MCP endpoint, Nitro async context, bearer-key auth, invalid bearer throttling,
  trusted forwarding, example tool projection, and tests.

The user should not need to remember hidden lifecycle settings. If a required setting is not installed,
doctor fails with a local fix.

### Operation Authoring

The normal backend authoring surface is:

```ts
import { operation } from '@lupinum/trellis/app'
import { v } from 'convex/values'

export const createTodo = operation.mutation({
  description: 'Create a todo',
  args: {
    title: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert('todos', {
      title: args.title,
      completed: false,
      createdAt: Date.now(),
    })
  },
})
```

The user learns one concept first: an operation. Args, auth, permissions, workspace scope, destructive
safety, and MCP projection are fields that can be added to that operation as the app grows.

### Workspace Operation

Workspace scope is visible at the operation boundary:

```ts
import { operation, workspaceScope } from '@lupinum/trellis/app'
import { todoCreate } from './permissions'

const workspace = workspaceScope({
  field: 'workspaceId',
  index: 'by_workspace',
})

export const createTodo = operation.mutation({
  description: 'Create a todo in the current workspace',
  scope: workspace,
  permission: todoCreate,
  args: {
    title: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert('todos', {
      workspaceId: ctx.workspaceId,
      title: args.title,
      completed: false,
      createdAt: Date.now(),
    })
  },
})
```

`ctx.workspaceId` is a validated value supplied by the operation scope. The first release should not add
`ctx.scope.table(...)` or `ctx.scope.insert(...)`; Convex reads and writes stay explicit.

### Destructive Operation

Destructive work has one obvious first-class shape:

```ts
export const removeTodo = operation.destructive({
  id: 'todos.remove',
  description: 'Delete a todo',
  scope: workspace,
  permission: todoDelete,
  args: {
    id: v.id('todos'),
  },
  load: async (ctx, args) => {
    return {
      todo: await ctx.db.require('todos', args.id),
    }
  },
  preview: ({ todo }) => ({
    summary: `Delete "${todo.title}"`,
    confirm: {
      todoId: todo._id,
    },
  }),
  execute: async (ctx, args) => {
    await ctx.db.delete(args.id)
    return null
  },
})
```

Preview, confirmation, and execution are required in the blessed destructive path. Manual
descriptor/preview plumbing is advanced.

### MCP Projection

MCP projects operations:

```ts
export default createTodo.asMcpTool({
  name: 'create-todo',
  safety: {
    kind: 'bounded-write',
    reason: 'Creates one todo in the delegated workspace.',
  },
})
```

The default MCP setup is protected bearer-key MCP for workspace apps. Public unauthenticated MCP and raw
manual tools are advanced paths.

### Permission Understanding

Permissions remain code-first, but become explainable:

```ts
const explanation = await explainPermission(ctx, todoCreate)
```

Static inspection uses one command family:

```bash
trellis explain permission todo.create
trellis permissions matrix
```

`trellis doctor` remains the setup and invariant gate. There is one doctor path; permission-specific
diagnostics feed into it unless a separate subcommand proves necessary.

### Presets

Presets are shortcuts, not separate architectures:

```bash
trellis init my-app --preset workspace-mcp
```

This must be mechanically equivalent to:

```bash
trellis init my-app
cd my-app
trellis add auth
trellis add workspace
trellis add mcp
```

### Advanced Escape Hatches

Escape hatches are explicit and visibly advanced:

- `@lupinum/trellis/backend` for low-level builders and descriptors
- `@lupinum/trellis/mcp/advanced` for standalone read, diagnostic, or external-service MCP tools
- `@lupinum/trellis-bridge` for packaged integrations
- `auth.bootstrap: false` for apps that deliberately do not use Trellis app-user bootstrap
- integration-owned CLI/docs/doctor for products such as Ginko CMS

Advanced APIs are not generated in beginner starters and are not presented as parallel first choices.

### What v0.2 Does Not Add

`v0.2` does not add:

- permission override tables
- tenant-defined role overlays
- record-sharing tables
- permission audit-event tables
- scoped DB wrappers
- generic adapters for every integration
- compatibility aliases that make old and new APIs equally blessed

Those features can follow only after the operation-first and permission-explainability model is stable.

## Proposal

### 1. Cut To An Operation-First Public API

Add a primary `operation` builder exported from `@lupinum/trellis/app`:

```ts
operation.query(...)
operation.mutation(...)
operation.destructive(...)
operation.unsafe.mutation(...)
```

The root package remains the Nuxt module entry. The beginner app DSL lives on the `app` subpath so users
do not choose between root, backend, and app subpaths for the same concept.

The builder should produce the Convex registration shape and operation metadata from one definition.
The current lower-level primitives can remain temporarily as advanced internals, but starters and docs
must stop teaching them as the first path.

The blessed operation object should expose projections:

```ts
createTodo.asMutation()
createTodo.asMcpTool({ name: 'create-todo', safety })
removeProject.previewMutation()
removeProject.executeMutation()
```

The implementation can adapt existing `defineOperation`, `previewOf`, `defineTrellis`, and MCP binding
internals. Do not duplicate operation metadata.

### 2. Add Workspace Scope As A First-Class Operation Option

Add a constrained workspace scope declaration as operation metadata:

```ts
const workspace = workspaceScope({
  field: 'workspaceId',
  index: 'by_workspace',
})
```

The first implementation should expose a validated scope value, not a new scoped DB abstraction:

```ts
ctx.workspaceId
```

This removes repeated app-identity resolution while keeping Convex reads and writes explicit. Do not add
`ctx.scope.table(...)` or `ctx.scope.insert(...)` until the operation API proves the tenant invariant
cannot stay simple with explicit scope metadata and a validated scope value.

`workspaceScope(...)` must not become a second tenant source of truth. It should be derived from, or
validated against, the existing feature inventory and tenant classification model.

### 3. Make Destructive Operations First-Class

`operation.destructive(...)` should require:

- stable operation id
- permission or guard
- preview
- execute
- confirmation shape
- safety metadata for MCP projection

The safe path should be shorter than manually wiring descriptors, previews, and confirmation tokens.

### 4. Make MCP A Projection Of Operations

For common tools, MCP should project operations instead of re-declaring contracts:

```ts
export default createTodo.asMcpTool({
  name: 'create-todo',
  safety: {
    kind: 'bounded-write',
    reason: 'Creates one todo in the delegated workspace.',
  },
})
```

Standalone MCP tool definitions stay available in `@lupinum/trellis/mcp/advanced` or equivalent
advanced docs for read, diagnostic, and external-service tools. App writes stay operation-backed:
once `operation.asMcpTool()` exists, direct write helpers move out of the first-reader path and
`tool.operation(...)` remains the bridge until the operation object projection fully covers it.

### 5. Add Permission Explanation Before Permission Data Models

Implement runtime permission explanations from issue #6:

- object-style `defineGuard({ key, check, explain })`
- composed guard explanation trees
- `explainPermission(ctx, permission)`
- safe error explanations without stack traces

This should not change the normal permission decision result. It only makes decisions explainable.

### 6. Add Static Permission Inventory Commands

Implement the useful subset of issue #10:

```bash
trellis permissions matrix
trellis explain permission <key>
```

Use `trellis explain ...` as the only explain command family. Fold `trellis permissions doctor` into the
existing `trellis doctor` unless a separate subcommand proves necessary. One doctor is easier to run and
harder to forget.

The matrix should report:

- permission key
- label
- source file
- projected to frontend
- used by custom-guard handlers
- used by operations
- grantable or override-enabled metadata, once those features exist

### 7. Defer New Authorization Tables

Defer these issues until after `v0.2`:

- explicit grants and denies (#7)
- tenant-defined role overlays (#8)
- record-level sharing (#9)
- permission audit events (#11)

They should become separate opt-in generated slices only after Trellis can explain and inspect the
base permission graph. Each should have its own acceptance criterion proving the extra table is needed.

### 8. Keep Integration Ownership Separate

Issue #1 is valid but should not drive this release. Trellis-through-CMS consumer recognition belongs to
integration ownership and doctor delegation. Keep it compatible with the hard-cut public API, but do not
make CMS integration the reason to add generic adapters to core.

Integration-owned setup is a first-class escape hatch. A package can inject Trellis defaults, publish its
own CLI and doctor command, preserve host-owned files through validate-and-instruct flows, and keep
product-facing docs free of Trellis concepts. It must still satisfy Trellis runtime invariants through
integration metadata and composable doctor findings.

`@lupinum/trellis-bridge` remains the public bridge contract for packaged integrations. Do not collapse
bridge APIs back into core Trellis exports.

### 9. Defer Viteplus Migration

Issue #5 has too little detail and looks infrastructural. It should not be part of the same hard cut
unless it is required by the operation ladder implementation. Mixing API hard-cut and build-system
migration increases risk without improving the product story.

## Export Surface

The hard cut should separate beginner and advanced surfaces.

Nuxt module package root:

```ts
export default defineNuxtConfig({
  modules: ['@lupinum/trellis'],
})
```

Beginner app runtime:

```ts
import { operation, workspaceScope } from '@lupinum/trellis/app'
```

Auth package:

```ts
import { defineGuard, definePermission, explainPermission } from '@lupinum/trellis/auth'
```

Advanced backend package:

```ts
import {
  defineTrellis,
  defineOperation,
  defineOperationDescriptor,
  implementOperation,
  previewOf,
  unsafe,
} from '@lupinum/trellis/backend'
```

This is intentionally a hard cut for docs and starters. Existing subpaths can remain during `v0.2` only
if they are marked advanced and doctor/upgrade can point users toward the new path. Do not add a long
compatibility layer that keeps both public stories equally blessed.

Generated code, starters, beginner docs, and maintained beginner examples must import only the new
operation-first public API. Advanced exports may remain documented only under advanced docs, with upgrade
findings pointing away from old first-path APIs. No compatibility aliases or bridge exports are added to
make old and new stories equally valid.

## CLI Shape

Preferred public CLI:

```bash
trellis init <name>
trellis add auth
trellis add workspace
trellis add mcp
trellis add operation <name>
trellis add operation <name> --destructive
trellis doctor
trellis permissions matrix
trellis explain permission <key>
trellis explain operation <id>
```

Compatibility during the hard cut:

```bash
trellis init <name> --preset public|personal|workspace|workspace-mcp
```

Replace `--template` in docs with `--preset`. Templates imply different architectures. Presets imply
pre-applied ladder steps.

During `v0.2`, `--template` may remain as a compatibility alias with upgrade/doctor nudges. It should not
remain the documented primary path.

## Tradeoffs

This is a disruptive release. That is acceptable before 1.0. The current API has too many valid-looking
paths and too much expert sequencing. A hard cut now is cheaper than supporting a split public story
later.

The operation-first API risks hiding important framework concepts. The answer is not to expose every
primitive early; it is to make each operation definition show the important decisions locally:

- args
- auth or permission
- workspace scope
- destructive safety
- MCP projection

The workspace-scope API risks hiding tenant behavior. That is why this RFC limits the first release to
explicit scope metadata plus a validated scope value, and defers scoped DB helpers.

The permission data-model issues are attractive, but adding them now would create more state before the
base state is explainable. Deferring them is not a rejection. It is sequencing.

## Rejected Options

- Add grants, role overlays, sharing, and audit tables immediately: rejected because it adds multiple
  authorization sources before the current source is inspectable.
- Keep four starters as the primary public story: rejected because it teaches architecture selection
  before capability growth.
- Keep manual MCP tools as the common path: rejected because MCP should usually project operations.
- Add scoped DB helpers in the same hard cut: rejected until tests prove they prevent real mistakes
  without becoming another tenant source of truth. This requires a follow-up RFC after `v0.2`; it is not
  part of the `v0.2` implementation.
- Preserve every current public primitive as equally blessed: rejected because it fails the constraintness
  goal from issue #13.
- Do the Viteplus migration in the same release: rejected unless it becomes a direct implementation
  prerequisite.

## Acceptance Criteria

The hard-cut release is successful when:

- A new user can define and call one useful operation before learning feature manifests, descriptors, MCP
  wrappers, or tenant isolation internals.
- A workspace operation can be written without manually repeating `appIdentity.workspaceId` and
  `by_workspace` logic, without introducing a second tenant source of truth.
- A destructive operation has one obvious first-class API with preview and execute semantics.
- An MCP tool can be projected from an operation without re-declaring schema, permission, and Convex refs.
- Runtime permission decisions can be explained with guard-level reasons.
- Static permission matrix and explain commands work without a running deployment.
- Starters and examples teach the operation ladder.
- Advanced APIs remain available but are no longer the default docs path.
- Integration-owned setup can keep product-facing CLIs and docs while satisfying Trellis runtime
  invariants.
- No new authorization tables are added in this release.

## Verification

- Add type tests for `operation.query`, `operation.mutation`, `operation.destructive`, and invalid
  destructive definitions.
- Add runtime tests proving operation projections register Convex handlers correctly.
- Add MCP tests proving `operation.asMcpTool(...)` preserves args, permission, safety, and operation id.
- Add permission explanation tests for allowed, denied, composed guard, and thrown guard cases.
- Add CLI tests for `permissions matrix` and `explain permission`.
- Regenerate starters and examples to use the operation-first path.
- Add integration-managed doctor/bridge conformance tests.
- Run `pnpm run release:verify` before publishing.

## Rollout Plan

1. Implement operation builder over existing internals.
2. Add `@lupinum/trellis/app` as the beginner runtime API and move old first-path backend APIs to
   advanced docs.
3. Implement workspace scope metadata and validated scope value for generated workspace apps.
4. Implement operation-to-MCP projection.
5. Implement permission explanations.
6. Implement permission matrix and explain CLI.
7. Rewrite starters to the additive ladder.
8. Rewrite the beginner examples.
9. Move old public docs into advanced docs.
10. Add upgrade findings for old first-path APIs.
11. Publish as `v0.2` with explicit hard-cut release notes.

## Post-v0.2 Authorization Roadmap

After `v0.2`, revisit the deferred permission data-model issues in this order:

1. Explicit grants and denies, because temporary exceptional access is the smallest useful extra state.
2. Permission audit events for grants and denies.
3. Record-level direct sharing.
4. Tenant-defined role overlays.

Each should be opt-in, generated, tested, and explainable before becoming part of an official starter.

Scoped DB helpers are also post-`v0.2`. They should be considered only if explicit `ctx.workspaceId`
still leaves repeated, test-proven mistakes that cannot be solved by operation metadata, inventory
validation, or doctor findings.
