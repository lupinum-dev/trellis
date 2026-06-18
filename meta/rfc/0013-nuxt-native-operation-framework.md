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
Trellis owns projection, transport protocol translation, test helpers, and
agent-facing machinery.
Each runtime surface still owns its boundary semantics.
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

- virtual imports such as `#trellis/operations/client` and
  `#trellis/operations/mcp` for runtime-safe operation handles
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
import { operations } from '#trellis/operations/mcp'

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
import { operations } from '#trellis/operations/testing'

const owner = ctx.asUser({ authKey: 'owner-1' })

const preview = await owner.operation(operations.runbooks.remove).preview({ id })
await owner
  .operation(operations.runbooks.remove)
  .execute({ id }, { confirmation: preview.confirmation })
```

Low-level forwarding tests may still exist inside Trellis, but normal app and
consumer tests should not construct transport options.

## Proposal

### 1. Source Ownership

Every important concept gets one source of truth:

- operation definitions own business metadata: id, args, return validator,
  scope, permission, safety, load, authorization, preview, and handler
- Convex projection exports own executable Convex surface: which operation is
  exported as which query/mutation/action lane
- feature manifests own feature grouping, package ownership, schema,
  permissions, record helpers, and inventory metadata
- the generated operation registry owns projection facts: operation id to
  execute/preview refs, projection kind, source location, and source hash
- the generated surface inventory owns surface usage: MCP tools, server-route
  adapters, UI usage, tests, explain output, and agent context

Feature manifests must not manually duplicate operation projection facts.
Operation lists in manifests are either generated, package metadata, or
high-level grouping only. App authors should not have to update
`operations.ts`, `domain.ts`, `feature.ts`, app inventory, and registry by hand
for one operation.

### 2. Operation Registry, Runtime Handles, And Surface Inventory

Split generated output into separate artifacts so codegen has no cycle:

- core operation registry: analysis artifact with operation id, operation
  export, source file/line, projection kind, execute ref, preview ref, feature
  owner, and source hash
- runtime operation handles: importable TypeScript generated from the core
  registry; no backend implementation imports
- surface inventory: derived after handles exist, recording which MCP tools,
  server-route adapters, UI files, and tests reference each handle
- agent context: optional filtered output generated from registry plus surface
  inventory

The analysis registry may know source files and operation exports. The runtime
handle modules must not import `convex/features/**/operations.ts`,
`convex/features/**/domain.ts`, handler closures, raw DB helpers, permission
implementations, secrets, route verification internals, or unsafe/cross-tenant
reasons unless those are explicitly marked safe for the importing runtime.

Suggested generated artifacts:

```text
.trellis/generated/operation-registry.json
.trellis/generated/operation-handles.ts
.trellis/generated/surface-inventory.json
.trellis/generated/agent-context.json
```

Names can change, but the distinction must not: registry, runtime handles,
surface inventory, and agent context are different artifacts.

Generation order:

```text
1. Convex codegen emits generated `api` refs.
2. Trellis scans canonical Convex projection exports only.
3. Trellis emits the core operation registry and operation handles.
4. Nuxt, MCP, server, Vue, and test files import operation handles.
5. Trellis scans surfaces that reference generated handles.
6. Trellis emits surface inventory, explain output, and optional agent context.
7. Typecheck, tests, doctor, and release verification validate drift.
```

This avoids the bootstrapping cycle where MCP files import
`#trellis/operations` while the registry also needs to scan MCP files to exist.

`trellis prepare` owns or coordinates this lifecycle and is wired into the Nuxt
prepare path. It should handle cold starts and watch mode deterministically:

- no `convex/_generated/api` yet: run or instruct Convex codegen, then retry the
  Trellis scan
- operation exists but projection export is missing: fail with the operation id
  and supported projection forms
- projection export exists but Convex codegen has not seen it: rerun Convex
  codegen or fail with a stale-codegen diagnostic
- Convex codegen succeeds but Trellis scan fails: do not emit partial handles
- generated registry exists but source hash changed: fail drift checks and tell
  the user to run `trellis prepare`
- watch mode sees a new operation/projection pair: regenerate registry, handles,
  then surface inventory in that order

Doctor explains failures and suggests fixes, but doctor is not the first safety
line. `trellis prepare`, typecheck, test setup, and runtime startup should catch
invalid generated state before production requests.

### 3. Registry Contract And Canonical Scanner Grammar

The registry is the backbone for MCP, tests, UI operation composables, server
adapters, doctor, explain, and agent context. It cannot be best-effort. It must
be deterministic, strict, inspectable, and fail-closed.

Supported v1 projection forms:

```ts
export const create = mutation.workspace(createProjectOp)
export const previewArchive = mutation.workspace.preview(archiveProjectOp)
export const list = query.workspace(listProjectsOp)
export const create = mutation.public(createTodoOp)
```

Unsupported v1 forms:

```ts
const lane = mutation.workspace
export const create = lane(createProjectOp)

const op = makeProjectOp()
export const create = mutation.workspace(op)

export { create } from './generated-domain'

export const create = condition
  ? mutation.workspace(createProjectOp)
  : mutation.workspace(otherProjectOp)
```

Unsupported forms fail with targeted diagnostics:

```text
Could not trace projection for projects.archive.
Use one of the supported forms:
export const archive = mutation.workspace(archiveProjectOp)
export const previewArchive = mutation.workspace.preview(archiveProjectOp)
```

Required invariants:

- operation ids are globally unique within an app
- app-owned operation ids use short feature namespaces such as
  `projects.archive` or `tasks.remove`
- package-owned operation ids use package namespaces such as
  `ginko.entries.publish` and may not use short app ids
- Trellis-owned operation ids use the reserved `trellis.*` namespace
- app code may not define `ginko.*`, `trellis.*`, or other package namespaces
  without an explicit package namespace declaration
- one default app execute projection is recorded per operation id
- additional execute projections require an explicit projection kind and cannot
  be selected implicitly
- destructive operations require exactly one default preview projection unless
  explicitly marked backend-only
- preview projections without a matching execute projection fail
- execute projections that cannot be traced to generated Convex refs fail
- stale registry output fails `trellis prepare`, type/test startup, doctor, or
  release verification
- MCP, test, UI, or server-route adapter references to missing operations fail
  before runtime

Advanced package, component, bridge, internal, or service projections must be
explicitly named by projection kind. They do not weaken the default app rule:
normal app code still sees one canonical execute projection per operation id.

### 4. Generated Operation Handle Contract

The generated handle is the normal cross-runtime object. It is not the backend
operation implementation.

Conceptual shape:

```ts
type OperationHandle<TArgs, TResult> = {
  readonly id: string
  readonly key: string
  readonly feature: string | null
  readonly kind: 'query' | 'mutation' | 'destructive'
  readonly scope: 'public' | 'session' | 'authenticated' | 'workspace'
  readonly safety: 'read' | 'bounded-write' | 'destructive-write' | 'external-side-effect'
  readonly projection: 'default-app' | 'internal' | 'service' | 'bridge' | 'component'
  readonly executeRef: unknown
  readonly previewRef?: unknown
  readonly contract?: ClientSafeContractMetadata
  readonly idResolution?: Record<string, IdResolutionHint>
}
```

The exact Convex ref types can be refined during implementation, but the fields
must stay runtime-safe. Handles must not contain handler closures, raw DB access,
permission implementations, service subject policy, internal function refs,
confirmation hashing internals, secrets, HMAC material, or route verification
metadata.

Generated modules must be filtered by runtime:

```ts
import { operations } from '#trellis/operations/client'
import { operations } from '#trellis/operations/server'
import { operations } from '#trellis/operations/mcp'
import { operations } from '#trellis/operations/testing'
```

The root `#trellis/operations` may exist only if the Nuxt module can resolve it
to the correct runtime-safe target. Documentation should prefer explicit
subpaths outside trivial examples.

Client-facing handles exclude backend-only, MCP-only, server-route-only,
internal, service, bridge, and unsafe operation handles unless they are
explicitly marked client-safe. Server/MCP/testing handles may expose more
projection metadata, but still never expose backend implementation code or
secrets.

Generated handles expose both a canonical id map and ergonomic paths:

```ts
operations.byId['projects.archive']
operations.projects.archive
```

`byId` is the canonical access path and must always exist. Ergonomic object
paths are generated only when operation ids normalize without collision. If
`tasks.bulk-update-status` and another id normalize to the same property, the
colliding ergonomic path is omitted or generation fails with a targeted doctor
message; `operations.byId[...]` remains the stable path.

The generated handles must resolve in Nuxt, Nitro, MCP runtime, Vitest, package
tests, and Ginko-like consumers. If a runtime does not support Nuxt virtual
aliases, Trellis must emit a concrete generated module or resolver path instead
of forcing downstream projects to recreate function-ref maps.

### 5. Runtime Boundaries

Normal Nuxt server, MCP, Vue, and app-level test code must not import Convex
handler implementation files to bind operations.

Preferred runtime boundaries:

```ts
import { operations } from '#trellis/operations/client'
import { operations } from '#trellis/operations/mcp'
import { operations } from '#trellis/operations/testing'
```

Convex owns handlers. Trellis owns generated projection metadata, transport
protocol translation, and safety metadata. Nuxt, MCP, tests, and server routes
own boundary-specific verification and delivery semantics. The registry and
runtime handles are the bridge.

Raw backend operation objects remain available inside Convex implementation
files and Trellis unit tests. They are not the normal cross-runtime public path.

### 6. Destructive Confirmation Binding

Removing app-authored `executeFunctionRef` must not weaken destructive
confirmation. The generated path replaces handwritten refs with generated
binding, not with implicit trust.

Destructive previews are mutation projections because they may create
confirmation state, bind preview/execute paths, hash args, issue tokens, and
record replay/idempotency metadata. They are business-read previews, not
database-read-only queries.

The Convex runtime must use a Convex-safe generated binding artifact, not the
Nuxt virtual module, to pair preview and execute projections. A preview token is
bound to:

- operation id
- preview function ref
- execute function ref
- projection kind
- registry version or projection fingerprint
- caller / acting-for subject
- workspace or tenant scope when present
- args hash
- confirmation payload hash
- expiry, JTI, and replay/idempotency key

Execute validates the token against the current generated binding before
running the handler. If an execute export is renamed, removed, or remapped after
a preview token is issued, execute fails with a drift or stale-confirmation
error. It must never silently fall back to operation id only.

Public examples use one confirmation vocabulary:

```ts
const preview = await op.preview(args)
await op.execute(args, { confirmation: preview.confirmation })
```

Avoid mixing `confirm`, `confirmation`, `_confirmationToken`, and transport
token names in public API examples. Low-level names can stay internal.

### 7. Backend-Only Destructive Operations

`backend-only` is a narrow exception, not a bypass.

Backend-only destructive operations require:

- explicit exposure metadata such as `exposure: 'backend-only'`
- a human-readable `backendOnlyReason`
- an internal or service projection kind
- doctor and explain visibility

Backend-only destructive operations:

- are excluded from client, MCP, server-route adapter, and normal product test
  handles
- cannot be used by `useTrellisOperation`
- cannot be exposed through normal MCP operation binding
- cannot be called through normal product-level test helpers unless explicitly
  requested through an internal testing surface
- fail `doctor --agent` if any public/server/MCP projection exposes them

Legitimate examples include migrations, retention cleanup, component internals,
and verified service jobs. They should be visible and uncomfortable, not a
casual flag.

### 8. Remove Stringly Execute Refs From Normal App Code

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

### 9. Advanced Explicit Projection Helper

Canonical app code should not need an escape hatch. Non-canonical package,
bridge, component, internal, or service projections still need one explicit
path so Trellis does not grow arbitrary TypeScript inference.

The exact API can change, but the helper contract must require:

- operation id or operation object
- explicit projection kind
- lane
- execute projection
- preview projection for destructive operations unless backend-only
- runtime exposure
- reason when the projection is not the default app projection

Sketch:

```ts
export const archive = defineOperationProjection({
  operation: archiveProjectOp,
  kind: 'bridge',
  lane: 'workspace',
  exposure: 'server',
  reason: 'Package bridge projection for CMS host apps.',
  execute: mutation.workspace(archiveProjectOp),
  preview: mutation.workspace.preview(archiveProjectOp),
})
```

Advanced projections must not silently replace the default app projection. They
are addressable only by explicit projection kind and appear in doctor/explain.

### 10. One-Line MCP Operation Binding

`tool.operation(operationHandle, options)` should use the generated registry for
execute and preview refs in the common case.

Manual `executeOperationRef(...)` and `previewOperationRef(...)` stay as
advanced helpers for non-standard package/runtime boundaries only. Beginner
docs, starters, examples, and Ginko-like consumers should not need them.

Acceptance target:

```ts
import { operations } from '#trellis/operations/mcp'

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

Preferred contract-level id-resolution metadata:

```ts
export const archiveProjectArgs = defineArgs({
  description: 'Archive a project.',
  args: {
    id: v.id('projects'),
  },
  meta: {
    id: {
      label: 'Project',
      description: 'The project to archive.',
      resolveWith: 'projects.search',
      displayField: 'name',
    },
  },
})
```

MCP tools may override this when the tool provides a better surface-specific
resolver:

```ts
tool.operation(operations.projects.archive, {
  resolveIds: {
    id: operations.projects.search,
  },
})
```

If an MCP-exposed write accepts a record id and no resolver is appropriate, the
tool must carry an explicit waiver:

```ts
agent: {
  idResolution: false,
  reason: 'IDs are selected from a UI-generated menu, not free-form LLM input.',
}
```

### 11. Product-Level Test Client

Add operation-aware test helpers on top of the existing testing runtime:

```ts
import { operations } from '#trellis/operations/testing'

const owner = ctx.asUser({ authKey: 'owner-1' })
const preview = await owner.operation(operations.entries.publish).preview(args)
await owner
  .operation(operations.entries.publish)
  .execute(args, { confirmation: preview.confirmation })
```

The helper resolves forwarding purpose, target handler id, replay mode, and
preview/execute refs from the same derived registry used by MCP.

This is the Ginko acceptance gate: Ginko CMS tests should delete their
function-ref translation maps. If Ginko still has to maintain
`handlerIdByFunctionRef` or destructive transport maps, Trellis has not
absorbed enough.

### 12. Server Route Operation Adapters

Server routes are not automatic operation projections. Routes have HTTP-specific
responsibilities: headers, status codes, body parsing, downloads, streaming,
webhook signatures, idempotency keys, cache semantics, and provider payload
validation.

Trellis should provide explicit helpers for route-owned adapters to call
operation-backed Convex functions through the generated registry:

```ts
import { operations } from '#trellis/operations/server'

await serverOperation(event, operations.webhooks.ingest).execute(args, {
  transport: transportProof.webhook(...),
})
```

The adapter should support operation kind explicitly:

```ts
await serverOperation(event, operations.projects.export).query(args, options)
await serverOperation(event, operations.webhooks.ingest).execute(args, options)

const preview = await serverOperation(event, operations.projects.archive).preview(args, options)
await serverOperation(event, operations.projects.archive).execute(args, {
  ...options,
  confirmation: preview.confirmation,
})
```

Route verification remains route-owned unless it is explicitly modeled in an
operation contract. This avoids hiding HMAC, replay, body parsing, and response
format decisions behind generic projection magic.

`serverOperation(...)` is the preferred adapter when a route wants the normal
operation authorization model. It is not the only valid route-to-Convex pattern:

- browser/session routes may call normal operations with user auth
- verified external webhook routes may call operations with service or acting-for
  proof
- narrow internal mutation routes may remain intentionally route-owned when they
  do not use the public operation path

### 13. Generated Resource Slices Become Product-Grade

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
Rich metadata is required for MCP-exposed operations, a warning for generated
UI, and optional for private/internal operations that are not surfaced to
agents or generated forms.

### 14. `useTrellisOperation`

Destructive UI flows should not manually preview, extract tokens, cast args,
and execute.

Add a composable that owns the boring Vue lifecycle:

```ts
import { operations } from '#trellis/operations/client'

const removeTask = useTrellisOperation(operations.tasks.remove)

const preview = await removeTask.preview({ id })
await removeTask.execute({ id }, { confirmation: preview.confirmation })
```

It should expose preview state, warnings, blockers, confirmation token, execute
state, drift errors, and typed result. The backend remains authoritative.

A `confirmAndRun` convenience helper may exist later, but the primary API should
keep the destructive confirmation boundary visible.

### 15. Explain And Agent Context From Existing Inventory

Keep `defineFeature(...)`, `composeFeatures(...)`, `defineAppInventory(...)`,
operation registry, surface inventory, and doctor inventory in their own source
ownership lanes. Do not turn explain or agent context into a new handwritten app
manifest.

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

Generated agent context should support privacy modes:

- `public`: safe for OSS examples and docs
- `developer`: useful for local coding agents; may include operation inventory
  and non-secret implementation hints
- `internal`: full local project context, still without secrets

Secrets are never included. Internal-only operations may be redacted from public
or developer output unless explicitly marked safe to share.

### 16. Documentation And Starter Trust Cleanup

Fix high-impact drift before larger work:

- root quick start uses `pnpm dev:local` for fresh starters
- starter packages either ship passing tests or do not advertise a `test`
  script before tests exist
- examples/docs consistently state that domain `ownerId` stores local
  `users._id`, not provider subjects or auth keys
- skill references match current defaults and MCP import paths
- beginner docs hide `defineTrellis`, identity forwarding, services, raw
  transport mutation, and unsafe until the app needs them

### 17. First Implementation Slice

This RFC is intentionally larger than the first build. The first implementation
is the registry foundation slice, not the full Nuxt-native release. It should
prove one vertical slice before expanding:

1. canonical workspace projection API
2. generated operation registry and runtime-filtered operation handles
3. fail-closed registry drift and duplicate-id checks
4. one-line MCP binding through generated handles
5. product-level test helper through the same handles
6. minimal Nuxt/Vue smoke proving client-safe handles import in app code
7. one maintained workspace example hard-cut to the new path
8. Ginko CMS deleting protocol maps as the consumer proof

Only after that slice is green should Trellis add `useTrellisOperation`, richer
resource generation, server-route adapters, and full agent-context output. The
Vue composable slice is required before marketing the release as Nuxt-native.

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
    const project = await ctx.workspace.get('projects', args.id)
    return { project }
  },
  authorize: {
    check: (actor, { project }) => project.ownerId === actor.userId || actor.role === 'admin',
  },
  preview: async (_ctx, _args, { project }) =>
    operationPreview({
      summary: `Archive ${project.name}`,
      effects: [operationEffect({ kind: 'projects', summary: 'Project archived', count: 1 })],
      confirmation: { projectId: project._id },
    }),
  handler: async (ctx, _args, { project }) => {
    await ctx.db.patch(project._id, { status: 'archived', updatedAt: Date.now() })
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
import { operations } from '#trellis/operations/mcp'

export default tool.operation(operations.projects.archive, {
  group: 'workspace',
  meta: { name: 'archive-project' },
})
```

Vue usage should be boring:

```ts
import { operations } from '#trellis/operations/client'

const archiveProject = useTrellisOperation(operations.projects.archive)

const preview = await archiveProject.preview({ id })
await archiveProject.execute({ id }, { confirmation: preview.confirmation })
```

Tests should be boring:

```ts
import { operations } from '#trellis/operations/testing'

const owner = ctx.asUser({ authKey: 'owner-1' })

const preview = await owner.operation(operations.projects.archive).preview({ id })
await owner
  .operation(operations.projects.archive)
  .execute({ id }, { confirmation: preview.confirmation })
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
- `useTrellisOperation` exists before the release is marketed as Nuxt-native
- release verification passes without special handling

The short 1.0 rules:

```text
The secure path is also the shortest path.
The generated path is deterministic, inspectable, runtime-filtered, and
impossible to partially drift.
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
- Canonical exported lane calls generate operation handles in filtered modules
  such as `#trellis/operations/client`, `#trellis/operations/mcp`, and
  `#trellis/operations/testing`.
- Generated handles expose canonical `operations.byId[...]`; ergonomic object
  paths are generated only when normalization has no collisions.
- Duplicate operation ids, untraceable projection exports, missing destructive
  previews, preview-without-execute pairs, and stale generated registry output
  fail before runtime.
- Noncanonical package/bridge/component/internal/service projections use an
  explicit advanced projection helper, declare projection kind, and appear in
  doctor/explain.
- `trellis prepare` coordinates Convex codegen, Convex projection scanning,
  operation registry and handle emission, surface inventory scanning, and drift
  checks in separate phases.
- Generated operation handles are safe to import from Nuxt server, MCP, Vue, and
  tests without pulling Convex handler closures or raw DB access into those
  runtimes.
- Client-facing operation handle exports exclude backend-only, MCP-only,
  server-route-only, internal, service, bridge, and unsafe handles unless
  explicitly marked client-safe.
- Generated handles resolve in Nuxt, Nitro, MCP runtime, Vitest, package tests,
  and Ginko-like consumers without downstream function-ref maps.
- Destructive confirmation tokens bind operation id, preview ref, execute ref,
  projection kind, registry fingerprint, caller/scope, args hash, confirmation
  payload hash, expiry, JTI, and replay/idempotency key.
- Public preview/execute examples consistently use
  `{ confirmation: preview.confirmation }` and do not mix confirmation
  vocabulary.
- Backend-only destructive operations require explicit reason metadata, appear
  in doctor/explain, and are blocked from normal client/MCP/server-route/test
  handles.
- Server routes use explicit operation adapters; webhook/HMAC/body parsing,
  idempotency, headers, and response shape remain route-owned unless modeled by
  a specific operation contract.
- Scanner golden tests cover supported canonical forms and rejected dynamic,
  aliased, conditional, and re-exported projection forms.

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
- `trellis doctor --agent` fails or warns when an MCP-exposed write accepts a
  record id without id-resolution metadata, a paired search/list/resolve tool,
  or an explicit waiver reason.
- `trellis explain app --json` supports public, developer, and internal privacy
  modes and never includes secrets.

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
