# 0013: Nuxt-Native Operation Framework

Status: Proposed
Date: 2026-06-18
Owner: Trellis maintainers; assign one implementation owner before build starts
Review basis: Trellis 0.3.1 source, maintained examples, Ginko CMS integration, RFC 0012 closure notes, static DX reviews
Review stance: accept the direction, revise the implementation contract before
building

## Summary

Trellis should become the Nuxt-native app framework for Convex where product
features are authored once as typed operations and projected into Convex
functions, Vue composables, tests, MCP tools, and explicit server-route
adapters.

The 0.2/0.3 foundation is directionally correct:

- operation-first backend authoring
- handler-local public reads
- session and workspace lanes
- stable handler ids
- backend-owned permissions and tenant boundaries
- destructive preview/confirmation/execute flows
- MCP tools that project backend operations instead of bypassing them
- static inventory, doctor, explain, lint, examples, and starter policy files

The remaining problem is ceremony. Trellis still exposes protocol details that
Nuxt app authors and downstream integrations should not maintain by hand:

- `executeFunctionRef` string mirrors on operation definitions
- manual preview/execute metadata and ref binding around projection exports
- MCP tools manually binding `executeOperationRef(...)` and
  `previewOperationRef(...)`
- repeated lane ctx types in app examples
- downstream test helpers maintaining function-ref translation maps
- starter scripts and docs drifting from the first local run path

The next release should not add permission grants, deny tables, role overlays,
record sharing, new app config, or generic adapters. Those features may become
real later, but adding them now would add state before the existing secure path
feels native.

The next release should compress the current model:

```text
App authors declare the business operation.
Trellis owns projection, transport, test, and agent machinery.
```

## Problem

The reviews converged on the same conclusion: Trellis has a strong product
thesis, but it still feels more like a secure internal platform than a polished
Nuxt framework once an app leaves the smallest path.

The beginner shape is now credible:

```ts
export const createTodoOp = operation.mutation(...)
export const create = mutation.public(createTodoOp)
```

The workspace shape is also defensible:

```ts
operation.query({
  id: 'projects.list',
  scope: workspaceScope(),
  permission: projectRead,
  handler: ...
})
```

The leak appears around projection and transport:

```ts
executeFunctionRef: 'features/runbooks/domain:remove'
```

```ts
tool.operation(removeRunbookOp, {
  execute: executeOperationRef(removeRunbookOp, api.features.runbooks.domain.remove),
  preview: previewOperationRef(removeRunbookOp, api.features.runbooks.domain.previewRemove),
})
```

Ginko CMS proves the same issue under real consumer pressure. It now uses the
Trellis 0.3 shape correctly, but its test helper still needs maps such as
`destructiveTransportExecuteFunctionRefs`, `handlerIdByFunctionRef`, and
`targetFunctionRef`. That is framework protocol knowledge. A downstream CMS
package should not own it.

The issue is not that Trellis is too secure. The issue is where the security
model is authored.

Good explicitness:

- `permission: projectRead`
- `scope: workspaceScope()`
- `reads: ['posts']`
- `safety: 'destructive-write'`
- `preview` explaining effects and confirmation payload

Bad explicitness:

- `executeFunctionRef: 'entries/publish:publishEntryOperationExecute'`
- `targetFunctionRef: toHandlerId(functionRef)`
- `destructiveTransportExecuteFunctionRefs`
- handwritten MCP preview/execute ref binding in ordinary tools

Those are protocol details. They should be generated, derived, or checked by
Trellis.

## Product Decision

Make `operation` the center of Trellis.

The public mental model should be:

- **Contract**: runtime-neutral args, return shape, labels, descriptions, and
  examples.
- **Operation**: one business action with scope, permission, safety, load,
  authorize, preview, and handler.
- **Feature**: one product slice owning schema, operations, permissions,
  record access, tests, and optional UI/MCP projections.
- **Surface**: generated or checked projection of operations into Nuxt UI,
  tests, MCP, and explicit server-route adapters.

Everything else is advanced:

- identity forwarding
- service subjects
- trusted replay
- raw transport mutations
- unsafe/cross-scope escapes
- bridge package internals
- custom MCP app-write tools

The dream Trellis version should feel like Nuxt:

- one obvious app lane
- predictable folders
- generated code that works before the user changes it
- local aliases and composables where they reduce app import noise
- conventions that install boring lifecycle automatically
- doctor/explain close to the developer loop
- advanced APIs visible only when the app needs them

Nuxt-native means concrete developer affordances, not only backend codegen:

- virtual imports such as `#trellis/operations` for runtime-safe operation
  handles
- auto-imported composables such as `useTrellisOperation`
- Nitro helpers for explicit server-route adapters
- `trellis prepare` wired into the Nuxt/Convex prepare loop
- generated optional pages/components that follow the canonical feature capsule
- doctor/explain output close enough to local development that stale generated
  artifacts fail before runtime

## Before

App authors define an operation, then manually wire projections:

```ts
export const removeRunbookOp = operation.destructive({
  id: 'runbooks.remove',
  executeFunctionRef: 'features/runbooks/domain:remove',
  args: deleteRunbook.args,
  scope: workspaceScope(),
  permission: runbookDelete,
  preview: ...,
  handler: ...,
})

export const previewRemove = mutation.workspace(previewOf(removeRunbookOp))
export const remove = mutation.workspace(removeRunbookOp)
```

MCP tools repeat the projection refs:

```ts
export default tool.operation(removeRunbookOp, {
  execute: executeOperationRef(removeRunbookOp, api.features.runbooks.domain.remove),
  preview: previewOperationRef(removeRunbookOp, api.features.runbooks.domain.previewRemove),
})
```

Tests sometimes rebuild transport knowledge:

```ts
ctx.asCaller(caller, {
  purpose: 'operation-execute',
  targetFunctionRef: toHandlerId(functionRef),
  replayMode: 'operation-confirmation',
})
```

## After

App authors define the operation and export the Convex function projection.
Trellis records the projection metadata.

```ts
export const removeRunbookOp = operation.destructive({
  id: 'runbooks.remove',
  args: deleteRunbook.args,
  scope: workspaceScope(),
  permission: runbookDelete,
  safety: 'destructive-write',
  load: ...,
  preview: ...,
  handler: ...,
})

export const remove = mutation.workspace(removeRunbookOp)
export const previewRemove = mutation.workspace.preview(removeRunbookOp)
```

MCP common case becomes operation-only:

```ts
import { operations } from '#trellis/operations'

export default tool.operation(operations.runbooks.remove, {
  group: 'workspace',
  meta: { name: 'delete-runbook' },
})
```

The generated operation registry binds the operation id to its execute and
preview refs. `tool.operation(...)` fails during startup, doctor, or tests if a
destructive operation is missing a projection.

Tests call product-level operations:

```ts
import { operations } from '#trellis/operations'

const owner = ctx.asUser({ authKey: 'owner-1' })

await owner.operation(operations.runbooks.remove).preview({ id })
await owner.operation(operations.runbooks.remove).execute({ id }, { confirm })
```

Low-level forwarding tests may still exist inside Trellis, but normal app and
consumer tests should not construct transport options.

## Proposal

### 1. Operation Projection Registry

Extend the existing public-surface/inventory codegen so each projected
operation is recorded once:

- operation id
- operation export
- feature owner when known
- execute function ref
- preview function ref when destructive
- projection kind
- source file and line
- MCP tools that project it

This must be derived from existing operation metadata, function projections,
feature manifests, and public-surface extraction. Do not add a handwritten
`trellis.config.ts` or a second app manifest.

The registry can be emitted as generated code, JSON, or both, but it is derived
output. The canonical source remains operation definitions plus projected
Convex exports.

Generated registry artifacts are do-not-edit output. They may explain and
project operations, but backend handlers remain the only authority.

### 2. Registry Contract And Codegen Lifecycle

The registry is the backbone for MCP, tests, UI operation composables, doctor,
explain, and agent context. It cannot be best-effort. It must be deterministic,
strict, inspectable, and fail-closed.

Trellis recognizes the canonical projection form first:

```ts
export const archive = mutation.workspace(archiveProjectOp)
export const previewArchive = mutation.workspace.preview(archiveProjectOp)
```

For the initial implementation, Trellis should not infer arbitrary TypeScript.
Generated registry derivation supports top-level exported canonical lane calls
in canonical feature files. Dynamic projections, conditional registration,
untraceable aliases, re-export chains the scanner cannot prove, and duplicate
projections require an advanced explicit helper or fail during preparation.

Required invariants:

- operation ids are globally unique within an app
- package-owned operation ids are namespaced, for example
  `ginko.entries.publish`
- one normal execute projection is recorded per operation id
- destructive operations require exactly one preview projection unless
  explicitly marked backend-only
- preview projections without a matching execute projection fail
- execute projections that cannot be traced to generated Convex refs fail
- stale registry output fails `trellis prepare`, type/test startup, doctor, or
  release verification
- MCP, test, UI, or server-route adapter references to missing operations fail
  before runtime

Generation order:

```text
1. App exports Convex function projections.
2. Convex codegen emits generated `api` refs.
3. Trellis public-surface scan derives operation/projection/tool metadata.
4. Trellis emits runtime-safe operation handles and optional JSON inventory.
5. Typecheck, tests, doctor, and release verification validate drift.
```

`trellis prepare` should own or coordinate this lifecycle and be wired into the
Nuxt prepare path. Doctor explains failures, but doctor is not the first safety
line.

### 3. Runtime Boundaries

Normal Nuxt server, MCP, Vue, and app-level test code must not import Convex
handler implementation files to bind operations.

Preferred runtime boundary:

```ts
import { operations } from '#trellis/operations'
```

The generated operation handle is runtime-safe metadata plus generated refs. It
does not carry Convex handler closures, raw DB access, or server-only policy
internals. Convex owns handlers. Nuxt, MCP, tests, and server routes own
transport. The registry is the bridge.

Raw backend operation objects remain available inside Convex implementation
files and Trellis unit tests. They are not the normal cross-runtime public path.

### 4. Remove Stringly Execute Refs From Normal App Code

`executeFunctionRef` may remain as internal metadata for runtime confirmation
validation, but ordinary app authors should not type it.

Preferred authoring:

```ts
export const archive = mutation.workspace(archiveProjectOp)
export const previewArchive = mutation.workspace.preview(archiveProjectOp)
```

The framework derives the execute ref from the exported function projection.
If derivation is impossible in a custom shape, preparation/type/test startup and
doctor must fail with a targeted message that names the missing projection.

Do not keep the old and new projection paths side by side in examples after the
new path passes.

### 5. One-Line MCP Operation Binding

`tool.operation(operationHandle, options)` should use the generated registry for
execute and preview refs in the common case.

Manual `executeOperationRef(...)` and `previewOperationRef(...)` stay as
advanced helpers for non-standard package/runtime boundaries only. Beginner
docs, starters, examples, and Ginko-like consumers should not need them.

Acceptance target:

```ts
import { operations } from '#trellis/operations'

export default tool.operation(operations.runbooks.remove, {
  group: 'workspace',
  meta: { name: 'delete-runbook' },
})
```

For destructive operations, missing preview projection is a startup/test/doctor
failure, not a runtime surprise.

MCP exposure remains explicit. Trellis must not auto-expose every operation as a
tool. MCP-exposed writes that accept record ids must either declare an
id-resolution source or be paired with a generated/search/list/resolve tool so
agents are not forced to guess raw ids.

### 6. Product-Level Test Client

Add operation-aware test helpers on top of the existing testing runtime:

```ts
import { operations } from '#trellis/operations'

const owner = ctx.asUser({ authKey: 'owner-1' })
await owner.operation(operations.entries.publish).preview(args)
await owner.operation(operations.entries.publish).execute(args, { confirm })
```

The helper resolves forwarding purpose, target handler id, replay mode, and
preview/execute refs from the same derived registry used by MCP.

This is the Ginko acceptance gate: Ginko CMS tests should delete their
function-ref translation maps. If Ginko still has to maintain
`handlerIdByFunctionRef` or destructive transport maps, Trellis has not
absorbed enough.

### 7. Server Route Operation Adapters

Server routes are not automatic operation projections. Routes have HTTP-specific
responsibilities: headers, status codes, body parsing, downloads, streaming,
webhook signatures, idempotency keys, cache semantics, and provider payload
validation.

Trellis should provide explicit helpers for route-owned adapters to call
operation-backed Convex functions through the generated registry:

```ts
import { operations } from '#trellis/operations'

await serverOperation(event, operations.webhooks.ingest).execute(args, {
  transport: transportProof.webhook(...),
})
```

Route verification remains route-owned unless it is explicitly modeled in an
operation contract. This avoids hiding HMAC, replay, body parsing, and response
format decisions behind generic projection magic.

### 8. Generated Resource Slices Become Product-Grade

`trellis add entity` / resource generation should become the main feature
authoring loop, not a side scaffold.

For a workspace resource, generation should produce:

- shared contract with labels, descriptions, examples, and id-resolution hints
- schema with tenant indexes
- permissions
- operations
- Convex domain projections
- feature manifest
- tests for tenant isolation and role denial
- optional UI shell
- optional MCP tools using one-line operation binding
- app inventory update

Generated files must be classified:

- scaffolded and user-owned: contracts, permissions, handlers, tests, UI shells
- generated and do-not-edit: operation handles, operation registry, public
  surface inventory, agent context, and derived explain metadata

Do not generate generic agent-hostile metadata like "Create a thing" when the
resource name is known. A generated operation exposed to MCP should have enough
contract metadata for a human form and an LLM tool schema.

The first generator slice should stay narrow: canonical workspace CRUD plus one
destructive delete/archive operation, optional MCP, tenant indexes, tests for
tenant isolation and role denial, and operation handles. Do not generate
sharing, uploads, webhooks, cross-workspace visibility, or nested custom
resources in the first pass.

`defineArgs` should grow enough metadata for generated forms and MCP schemas:
labels, descriptions, examples, enum hints, id-resolution hints, and return
metadata where needed. This does not require a second contract framework.

### 9. `useTrellisOperation`

Destructive UI flows should not manually preview, extract tokens, cast args,
and execute.

Add a composable that owns the boring Vue lifecycle:

```ts
import { operations } from '#trellis/operations'

const removeTask = useTrellisOperation(operations.tasks.remove)

const preview = await removeTask.preview({ id })
await removeTask.execute({ id }, preview.confirmation)
```

It should expose preview state, warnings, blockers, confirmation token, execute
state, drift errors, and typed result. The backend remains authoritative.

A `confirmAndRun` convenience helper may exist later, but the primary API should
keep the destructive confirmation boundary visible.

### 10. Explain And Agent Context From Existing Inventory

Keep `defineFeature(...)`, `composeFeatures(...)`, `defineAppInventory(...)`,
public-surface metadata, and doctor inventory as the source of truth.

Add projections from that truth:

```bash
trellis explain app
trellis explain feature tasks
trellis explain tool delete-runbook
trellis explain file convex/features/tasks/domain.ts
trellis explain operation runbooks.remove --json
trellis doctor --agent
```

If a committed `.trellis/agent-context.json` is useful, it must be generated,
rebuildable, and checked for drift. It must not become a handwritten app
manifest.

### 11. Documentation And Starter Trust Cleanup

Fix high-impact drift before larger work:

- root quick start uses `pnpm dev:local` for fresh starters
- starter packages either ship passing tests or do not advertise a `test`
  script before tests exist
- examples/docs consistently state that domain `ownerId` stores local
  `users._id`, not provider subjects or auth keys
- skill references match current defaults and MCP import paths
- beginner docs hide `defineTrellis`, identity forwarding, services, raw
  transport mutation, and unsafe until the app needs them

### 12. First Implementation Slice

This RFC is intentionally larger than the first build. The first implementation
should prove one vertical slice before expanding:

1. canonical workspace projection API
2. generated operation registry and `#trellis/operations`
3. fail-closed registry drift and duplicate-id checks
4. one-line MCP binding through generated handles
5. product-level test helper through the same handles
6. one maintained workspace example hard-cut to the new path
7. Ginko CMS deleting protocol maps as the consumer proof

Only after that slice is green should Trellis add `useTrellisOperation`, richer
resource generation, server-route adapters, and full agent-context output.

## Non-Goals

Do not add these in this release:

- permission grant/deny tables
- tenant role overlays
- record sharing tables
- permission audit tables
- generic migration framework
- generic contract framework beyond extending existing `defineArgs` metadata
- generic provider adapter registry
- business-level `trellis.config.ts`
- new app manifest that duplicates feature inventory
- second MCP write path
- compatibility shims for unreleased internal authoring APIs

These are not rejected forever. They are sequenced behind the DX compression
work because each one adds state or another source of truth.

## Rejected Options

### Add A New DSL

Rejected for now.

Syntax such as `trellis resource tasks { ... }` could be nice eventually, but
it would add a second authoring language. TypeScript operation/feature builders
already exist and are close. Compress them first.

### Add `trellis.config.ts`

Rejected as a business manifest.

Nuxt config, Convex config, feature manifests, app inventory, package exports,
and doctor inventory already exist. A new config file would likely become
another source of truth.

A future path/discovery-only config for monorepos or package authors may be
revisited if Nuxt config and package exports cannot express the project shape.
It must not contain operations, permissions, tables, MCP policy, or feature
inventory.

### Keep Manual And Generated Projection Paths In Examples

Rejected for unreleased internals.

Once the generated registry path works, examples and starters should hard-cut to
it. Advanced manual helpers can stay documented only for real package/runtime
boundaries.

### Move Ginko CMS Policy Into Trellis

Rejected.

Ginko CMS owns CMS concepts: collections, entries, assets, draft/publish
semantics, migrations, public projections, and product MCP capability mapping.
Trellis should extract only repeated framework mechanics.

## 1.0 Final Shape

This RFC is 1.0-worthy only if it produces a smaller app-authoring surface, not
just a stronger internal runtime.

The 1.0 first-run loop should be:

```bash
pnpm dlx @lupinum/trellis init acme --preset workspace
cd acme
pnpm install
pnpm dev:local

trellis add entity project --workspace --mcp
trellis doctor
```

The four stable app lanes are:

```text
public        small public app
personal      signed-in user app
workspace     default serious app
workspace-mcp workspace app with agent surface
```

The canonical feature capsule is:

```text
shared/features/projects/contract.ts
convex/features/projects/schema.ts
convex/features/projects/permissions.ts
convex/features/projects/operations.ts
convex/features/projects/domain.ts
convex/features/projects/feature.ts
convex/features/projects/tests.ts
app/features/projects/
server/mcp/tools/projects/
shared/app-inventory.ts
```

Normal operation authoring should look like:

```ts
export const archiveProject = operation.destructive({
  id: 'projects.archive',
  args: archiveProjectArgs.args,
  scope: workspaceScope(),
  permission: projectArchive,
  safety: 'destructive-write',
  load: async (ctx, args) => {
    const project = await ctx.db.get(args.id)
    requireRecord(project, 'Project')
    if (project.workspaceId !== ctx.workspaceId) {
      throw new Error('Project not found')
    }
    return { project }
  },
  authorize: {
    check: (actor, { project }) => project.ownerId === actor.userId || actor.role === 'admin',
  },
  preview: async (_ctx, _args, { project }) =>
    operationPreview({
      summary: `Archive ${project.name}`,
      effects: [operationEffect({ kind: 'projects', summary: 'Project archived', count: 1 })],
      confirm: { projectId: project._id },
    }),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { status: 'archived', updatedAt: Date.now() })
  },
})
```

Convex projection should be boring:

```ts
export const archive = mutation.workspace(archiveProject)
export const previewArchive = mutation.workspace.preview(archiveProject)
```

MCP projection should be boring:

```ts
import { operations } from '#trellis/operations'

export default tool.operation(operations.projects.archive, {
  group: 'workspace',
  meta: { name: 'archive-project' },
})
```

Vue usage should be boring:

```ts
import { operations } from '#trellis/operations'

const archiveProject = useTrellisOperation(operations.projects.archive)

const preview = await archiveProject.preview({ id })
await archiveProject.execute({ id }, preview.confirmation)
```

Tests should be boring:

```ts
import { operations } from '#trellis/operations'

const owner = ctx.asUser({ authKey: 'owner-1' })

await owner.operation(operations.projects.archive).preview({ id })
await owner.operation(operations.projects.archive).execute({ id }, { confirm })
```

What stays explicit in 1.0 app code:

- operation id
- args and return validators
- scope
- permission
- tenant boundary
- destructive safety
- preview effects
- confirmation payload
- backend authorization
- route-owned transport verification for server-route adapters

What disappears from normal 1.0 app code:

- string function refs
- replay modes
- target handler maps
- MCP execute/preview ref wiring
- transport envelope construction
- duplicate app manifests
- raw Convex handler implementation imports in Nuxt server, MCP, Vue, or
  app-level test code

The 1.0 trust loop is:

```bash
trellis explain app
trellis explain operation projects.archive
trellis explain tool archive-project
trellis doctor --agent
pnpm run check
```

Trellis should not be called 1.0 until:

- examples, starters, docs, and skill references teach the same path
- advertised starter commands pass
- `@lupinum/trellis` exports are intentionally semver-stable
- `@lupinum/trellis-bridge` remains separate and stable for package authors
- Ginko CMS passes after deleting Trellis protocol helper maps
- release verification passes without special handling

The short 1.0 rule:

```text
The secure path is also the shortest path.
```

## Acceptance Criteria

### Trellis Examples

- `examples/03-team-workspace` remains the canonical workspace app.
- `examples/07-mcp-reference` uses one-line MCP operation binding for normal
  operation-backed tools through generated operation handles.
- Maintained examples do not require handwritten `executeFunctionRef` strings in
  normal operation definitions.
- Destructive preview/execute projections are still enforced and tested.
- Root README, starter READMEs, and getting-started docs agree on the fresh
  local run command.
- `ownerId` docs match the local `users._id` model.
- Normal Nuxt server, MCP, Vue, and app-level test files do not import Convex
  handler implementation files to bind operation projections.

### Starters

- `trellis init --preset workspace` produces a locally runnable app with
  `pnpm dev:local`.
- Fresh starter advertised commands pass.
- `trellis add entity project --workspace --mcp` produces a complete operation
  slice with tests and one-line MCP operation tools.
- Generated app inventory stays static and doctor-readable.
- Generated files are visibly separated into scaffolded user-owned files and
  do-not-edit derived artifacts.

### Registry And Runtime Boundary

- Operation ids are globally unique and package-owned ids are namespaced.
- Canonical exported lane calls generate operation handles in
  `#trellis/operations`.
- Duplicate operation ids, untraceable projection exports, missing destructive
  previews, preview-without-execute pairs, and stale generated registry output
  fail before runtime.
- `trellis prepare` coordinates Convex codegen, public-surface scanning,
  operation handle emission, and drift checks.
- Generated operation handles are safe to import from Nuxt server, MCP, Vue, and
  tests without pulling Convex handler closures or raw DB access into those
  runtimes.
- Server routes use explicit operation adapters; webhook/HMAC/body parsing,
  idempotency, headers, and response shape remain route-owned unless modeled by
  a specific operation contract.

### Ginko CMS

- Ginko can delete custom test maps for destructive transport execute refs and
  handler ids.
- Ginko MCP project tools do not hand-bind operation execute/preview refs for
  ordinary operations.
- Ginko still owns CMS product policy and public CLI labels.
- Ginko check remains green after consuming the new Trellis path.

### Doctor, Explain, And Agent Output

- `trellis explain operation <id>` shows execute projection, preview
  projection, feature owner, and MCP tools.
- `trellis explain tool <name>` works for operation-backed tools.
- `trellis explain app --json` emits safe-to-share versioned JSON from existing
  inventory.
- `trellis doctor --agent` reports missing operation metadata, missing contract
  descriptions for MCP-exposed args, missing destructive projections, and stale
  generated agent context if that artifact is used.

### Verification

Run focused checks during implementation:

```bash
pnpm run format:check
pnpm run lint
pnpm run test:contracts:repo
pnpm run test:types
pnpm run test:examples
```

Run consumer gates before calling this done:

```bash
pnpm run release:verify
CI=true pnpm --dir "${GINKO_CMS_DIR:-../ginko-cms}" run check
```

## Dream Version Test

Trellis is close to the dream version when a real Nuxt developer can say:

1. I add a workspace feature with one command.
2. I edit the generated contract, permissions, and handler.
3. I do not hand-maintain transport refs, preview refs, replay modes, or
   function-ref maps.
4. UI, tests, explicit server-route adapters, and MCP all project the same
   operation.
5. Doctor explains what is exposed and why.
6. Ginko CMS can consume Trellis without copying Trellis protocol internals.

If the secure path is still more verbose than the unsafe path, Trellis is not
done.
