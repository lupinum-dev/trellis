# Trellis RFC 0013 Implementation Journal

Date: 2026-06-18
Branch: `hardening`
Goal: implement RFC 0013 completely with proof -> implementation -> review
loops.

## Operating Principles

- Keep one source of truth for operation projection facts.
- Prove import and codegen paths before broad refactors.
- Prefer hard cutovers for unreleased paths; keep released explicit helpers only
  as advanced/package boundaries.
- Do not move domain policy into MCP, bridge, generated handles, or transport
  layers.
- Commit coherent workpackages after focused verification.

## Slice 1: Generated Operation Handles For MCP

### Proof

- Existing `generated/operation-refs.ts` already stamps Convex refs with Trellis
  operation projection metadata through `projectOperationRef(...)`.
- Existing phase0 MCP fixture proves descriptor-driven operation refs can avoid
  Convex implementation imports in tool files.
- Focused proof target: generate an operation handle module on top of operation
  refs, then call `tool.operation(handle, options)` without handwritten
  execute/preview refs in tool files.

### Implementation

- Added runtime `OperationHandle` metadata and `defineOperationHandle(...)`.
- Added `tool.operation(handle, options)` support while preserving
  `tool.operation(operation, { execute, preview })` as the advanced explicit
  boundary.
- Added `renderOperationHandlesModule(...)` for generated `operations.byId[...]`
  and ergonomic paths.
- Extended starter fixture generation with `kind: "operationHandles"`.
- Updated the phase0 workspace-MCP fixture to emit
  `generated/operation-handles/mcp.ts`.
- Updated phase0 MCP tools to import generated handles instead of descriptors
  and operation refs.

### Verification

- `pnpm vitest run --project=unit tests/unit/operation-ref-codegen.test.ts tests/unit/phase0-workspace-mcp-fixture.test.ts tests/unit/mcp-operation-binding.test.ts`
  passed.
- `pnpm run test:types:contracts` passed after tightening the overload and
  handle branding types.
- `pnpm run test:types:public` passed with a positive public type assertion for
  `defineOperationHandle(...)` plus `tool.operation(handle, options)`.
- `pnpm run lint:src:core` and `pnpm run lint:src:runtime:functions-mcp`
  passed.
- `pnpm run check:publish-surface` and `pnpm run check:docs:api-surface`
  passed after adding the MCP handle helpers.
- Focused formatting check for the RFC, journal, codegen, runtime, fixture, and
  tests passed.

### Notes

- The generated handle module currently targets the existing fixture manifest.
  The next slice should derive equivalent handles from the Convex projection
  scan instead of starter-manifest metadata.
- `OperationHandle` intentionally omits the descriptor `_type` brand and
  rebrands as `_type: "operation-handle"` so runtime checks can distinguish
  generated handles from raw descriptors.
- The normal handle path reads `executeRef` and `previewRef`; explicit
  `execute` / `preview` options remain available for noncanonical package and
  bridge boundaries.

## Slice 2: Canonical Projection Scanner Grammar

### Proof

- Added a scanner fixture for the RFC 0013 canonical forms:
  `mutation.workspace(op)` and `mutation.workspace.preview(op)`.
- The first focused run failed because `.preview(op)` was classified as an
  execute projection. That proved the scanner was only reading the first
  argument and ignoring the lane callee.
- Added aliased/dynamic forms in the same fixture. The focused run showed
  aliased calls such as `workspaceMutation(op)` were also silently extracted as
  execute projections, which would pollute the derived registry.

### Implementation

- Added a canonical projection-call classifier for direct
  `mutation|query|action.<lane>(...)` execute projections and direct
  `mutation.<lane>.preview(...)` preview projections.
- `extractProjectionBinding(...)` now ignores unsupported aliased or dynamic
  projection calls instead of treating any exported call with an operation first
  argument as a projection.
- Kept existing `previewOf(op)` support only behind canonical lane calls so
  current released examples/tests continue to scan while the RFC hard-cut path
  is implemented.
- Updated the generated-type consumer fixture away from fake `mutation<T>(op)`
  calls and onto the canonical lane shape.

### Verification

- Initial focused proof run failed as expected:
  `pnpm vitest run --project=unit tests/unit/public-surface-codegen.test.ts -t "canonical lane preview"`.
- After implementation, the focused canonical scanner test passed.
- `pnpm vitest run --project=unit tests/unit/public-surface-codegen.test.ts`
  passed.
- `pnpm vitest run --project=unit tests/unit/public-surface-codegen.test.ts tests/unit/generated-type-consumers.test.ts tests/unit/cli-explain.test.ts`
  passed.
- `pnpm vitest run --project=unit tests/unit/cli-doctor.test.ts` passed.
- `pnpm run lint:src:core`, `pnpm run test:types:public`,
  `pnpm exec oxfmt --check ...`, and `git diff --check` passed.

### Notes

- This slice does not yet produce targeted diagnostics for unsupported
  projection syntax. It prevents false registry facts first; a later registry
  validation slice should turn ignored unsupported exports into actionable
  errors when they are intended operation projections.
- The next structural step is to split scanned operation/projection facts into a
  registry-oriented model that can drive generated runtime handles.

## Slice 3: Scanned Operation Registry Foundation

### Proof

- Added a failing registry test before implementation. The initial run failed
  because `operation-registry-codegen` did not exist.
- The proof fixture starts from real scanner metadata and canonical Convex lane
  exports, then expects a registry shape with operation id, operation source,
  execute/preview source, generated Convex `api` path, and string
  `functionRef`.
- The same test asserts derived operation-ref and operation-handle binding
  inputs so the next generated-file slice can delete manifest-maintained
  projection facts instead of copying them.

### Implementation

- Added `buildOperationRegistry(...)` as an internal analysis step on top of
  `PublicSurfaceCodegenMetadata`.
- Derived Convex API paths and function refs from projection source file plus
  export name.
- Added fail-closed registry invariants for duplicate operation ids, missing
  execute projections, duplicate execute/preview projections, destructive
  operations without preview projections, and safe operations with preview
  projections.
- Added `buildOperationRefBindingsFromRegistry(...)` and
  `buildOperationHandleBindingsFromRegistry(...)` to produce the input shape
  expected by the existing operation-ref and operation-handle renderers.

### Verification

- Initial proof run failed as expected:
  `pnpm vitest run --project=unit tests/unit/operation-registry-codegen.test.ts`.
- After implementation,
  `pnpm vitest run --project=unit tests/unit/operation-registry-codegen.test.ts tests/unit/public-surface-codegen.test.ts tests/unit/operation-ref-codegen.test.ts tests/unit/generated-type-consumers.test.ts`
  passed.
- `pnpm run lint:src:core`, `pnpm run test:types:public`,
  `pnpm exec oxfmt --check ...`, and `git diff --check` passed.

### Notes

- This slice intentionally stops at internal registry and binding inputs. It
  does not yet emit runtime-filtered generated modules or solve the safe
  descriptor import boundary for operations whose implementation file contains
  handler closures.
- The next slice should use the registry as the only projection source for a
  generated artifact, then remove duplicated projection data from the fixture
  manifest.

## Slice 4: Unsupported Projection Diagnostics

### Proof

- Added a failing scanner test for unsupported projection syntax:
  aliased lane calls, dynamic operation identifiers, and conditional projection
  expressions.
- The initial focused run failed because `PublicSurfaceCodegenMetadata` had no
  diagnostics lane, so unsupported forms were only ignored.

### Implementation

- Added `diagnostics` to public-surface metadata with targeted codes for
  unsupported projection calls, dynamic operation references, and conditional
  projections.
- The scanner keeps canonical registry facts clean while reporting unsupported
  exported forms with file, line, export name, and a targeted correction.
- `buildOperationRegistry(...)` now refuses to run when scanner diagnostics are
  present, preventing later generated registry/handle output from silently
  ignoring invalid projection authoring.

### Verification

- Initial proof run failed as expected:
  `pnpm vitest run --project=unit tests/unit/public-surface-codegen.test.ts -t "unsupported operation projection syntax"`.
- After implementation,
  `pnpm vitest run --project=unit tests/unit/public-surface-codegen.test.ts tests/unit/operation-registry-codegen.test.ts`
  passed.
- `pnpm vitest run --project=unit tests/unit/public-surface-codegen.test.ts tests/unit/operation-registry-codegen.test.ts tests/unit/generated-type-consumers.test.ts tests/unit/cli-explain.test.ts tests/unit/operation-ref-codegen.test.ts`
  passed.
- `pnpm vitest run --project=unit tests/unit/cli-doctor.test.ts` passed.
- `pnpm run lint:src:core`, `pnpm run test:types:public`,
  `pnpm exec oxfmt --check ...`, and `git diff --check` passed.

### Notes

- Re-exported projection diagnostics remain for a later scanner pass. The
  current slice covers the unsupported forms that were already causing false or
  missing projection facts in variable declarations.
- The next generated-artifact slice can now rely on the registry builder to
  stop when unsupported projection syntax is present.

## Slice 5: Registry-Rendered Refs And Handles

### Proof

- Added a failing proof for a runtime-safe authoring shape:
  `shared/features/**/operations.ts` exports `defineOperationDescriptor(...)`
  descriptors, while `convex/features/**/domain.ts` exports canonical
  `query|mutation.<lane>(descriptor)` projections.
- The first focused run failed because shared descriptors were not scanned, so
  Convex projections imported from shared files looked like dynamic operation
  references.
- After adding shared descriptor scanning, the next focused run failed because
  no registry-generated files renderer existed.

### Implementation

- Extended public-surface operation scanning to include `shared/**/*.ts` and
  recognize `defineOperationDescriptor(...)` as operation metadata.
- Updated public-surface watch refresh detection so shared descriptor edits
  refresh generated public-surface artifacts.
- Added registry rendering for `.trellis`-style generated operation refs and
  operation handles.
- Generated refs import descriptors from runtime-safe shared files, stamp
  Convex refs with `projectOperationRef(...)`, and derive string `functionRef`
  values from scanned projection source.
- Generated handles import descriptors from shared files and refs from the
  generated ref module; they do not import Convex handler/projection files.
- Broadened the handle module renderer to support descriptor imports grouped by
  source file while keeping the existing single-import manifest path working.

### Verification

- Initial proof run failed at the shared descriptor scanner boundary:
  `pnpm vitest run --project=unit tests/unit/operation-registry-codegen.test.ts -t "renders operation refs and handles"`.
- After scanner support, the same proof failed at the missing renderer
  boundary, then passed after implementing
  `renderOperationRegistryGeneratedFiles(...)`.
- `pnpm vitest run --project=unit tests/unit/operation-registry-codegen.test.ts tests/unit/public-surface-codegen.test.ts tests/unit/operation-ref-codegen.test.ts tests/unit/generated-type-consumers.test.ts tests/unit/phase0-workspace-mcp-fixture.test.ts`
  passed.
- `pnpm vitest run --project=unit tests/unit/cli-doctor.test.ts` passed.
- `pnpm run lint:src:core`, `pnpm run test:types:public`,
  `pnpm exec oxfmt --check ...`, and `git diff --check` passed.

### Notes

- This slice proves the safe descriptor import boundary and scan-derived
  generated artifacts. It does not yet wire these generated files into the Nuxt
  installer or remove fixture-manifest projection duplication.
- The next slice should make a maintained fixture or starter consume the
  registry-rendered files rather than manifest-authored refs/handles.

## Slice 6: Implemented Operation Projection Aliases

### Proof

- Added a failing registry test for the realistic split where shared
  `defineOperationDescriptor(...)` exports are implemented in Convex via
  `implementOperation(descriptor, ...)`, then projected from the implemented
  operation export.
- The initial run failed because the projection scanner treated
  `mutation.workspace(archiveTaskOperation)` as an unsupported dynamic
  operation reference.
- After adding alias lookup, the next run exposed a second bug: exported
  `implementOperation(...)` declarations were themselves being diagnosed as
  unsupported projection calls.

### Implementation

- Added a projection-only alias map for exported
  `implementOperation(descriptor, ...)` bindings. Projection scanning can now
  resolve implementation exports back to their shared descriptor metadata
  without adding duplicate operation ids to the operation inventory.
- Excluded `implementOperation(...)` declarations from projection diagnostics;
  they are implementation bindings, not surface projections.

### Verification

- Initial proof run failed as expected:
  `pnpm vitest run --project=unit tests/unit/operation-registry-codegen.test.ts -t "implemented operation projections"`.
- After implementation,
  `pnpm vitest run --project=unit tests/unit/operation-registry-codegen.test.ts tests/unit/public-surface-codegen.test.ts tests/unit/generated-type-consumers.test.ts tests/unit/cli-explain.test.ts`
  passed.
- `pnpm run lint:src:core`, `pnpm run test:types:public`,
  `pnpm exec oxfmt --check ...`, and `git diff --check` passed.

### Notes

- This completes the scanner prerequisite for moving the phase0 workspace-MCP
  fixture toward canonical projections while keeping generated handles pointed
  at shared descriptors instead of Convex implementation files.

## Slice 7: Runtime Canonical Mutation Preview Lanes

### Proof

- The phase0 fixture cutover exposed a runtime gap: the scanner understood
  `mutation.workspace.preview(op)`, but the backend runtime only supported the
  older `mutation.workspace(previewOf(op))` spelling.
- Added a focused runtime test proving that `mutation.workspace.preview(op)`
  preserves args, operation metadata, and projection metadata.

### Implementation

- Added a mutation-lane-only `.preview(op)` helper that delegates to the
  existing `previewOf(op)` implementation before passing through the same lane
  builder.
- Kept query/action lanes unchanged so stored destructive confirmation semantics
  remain mutation-owned.
- Updated mutation lane types so public/authenticated/workspace/protected
  mutation lanes expose the canonical preview helper.

### Verification

- `pnpm vitest run --project=unit tests/unit/functions-defineTrellis.test.ts -t "canonical app destructive previews"`
  passed.
- `pnpm vitest run --project=unit tests/unit/functions-defineTrellis.test.ts tests/unit/public-surface-codegen.test.ts tests/unit/operation-registry-codegen.test.ts`
  passed.
- `pnpm run lint:src:runtime:functions-mcp`, `pnpm run test:types:public`,
  `pnpm run test:types:contracts`, `pnpm exec oxfmt --check ...`, and
  `git diff --check` passed.

### Notes

- This closes the mismatch between the RFC/scanner syntax and runtime support.
  The phase0 fixture can now be hard-cut to canonical projection exports.

## Slice 8: Phase0 Fixture Registry-Generated Artifacts

### Proof

- Replaced the phase0 fixture manifest test target first. The initial run showed
  registry-rendered output drift: generated refs now include the generated
  banner and derive `deleteProjectRef` from the execute projection export
  instead of the old hand-authored `executeDeleteProjectRef`.
- After switching the fixture preview projection to the canonical mutation lane,
  the MCP behavior test failed because mutation preview calls carry replay
  metadata. That proved the fixture was now exercising the stronger mutation
  preview path instead of the old query-preview path.

### Implementation

- Added `operationRegistry` fixture-manifest generation. The manifest now names
  generated artifact paths/imports/runtimes only; it no longer duplicates
  operation ids, Convex api paths, ref names, or handle bindings.
- Hard-cut `phase0-workspace-mcp` domain exports to canonical projections:
  `mutation.workspace(operation)` and
  `mutation.workspace.preview(operation)`.
- Added local fixture Trellis lane setup in `convex/functions.ts`.
- Updated checked-in generated refs/handles to match registry-rendered output.
- Updated the delete-project MCP tool to call its destructive preview via
  mutation and updated the fixture runtime mock/expectations for replay-bearing
  mutation preview calls.

### Verification

- Initial proof run:
  `pnpm vitest run --project=unit tests/unit/operation-ref-codegen.test.ts -t "registry-derived"`
  failed with expected generated-output drift.
- After implementation,
  `pnpm vitest run --project=unit tests/unit/operation-ref-codegen.test.ts tests/unit/phase0-workspace-mcp-fixture.test.ts`
  passed.
- Broader focused suite passed:
  `pnpm vitest run --project=unit tests/unit/functions-defineTrellis.test.ts tests/unit/public-surface-codegen.test.ts tests/unit/operation-registry-codegen.test.ts tests/unit/operation-ref-codegen.test.ts tests/unit/phase0-workspace-mcp-fixture.test.ts tests/unit/generated-type-consumers.test.ts tests/unit/cli-explain.test.ts`.
- `pnpm vitest run --project=unit tests/unit/cli-doctor.test.ts` passed.
- `pnpm run lint:src:core`, `pnpm run lint:src:runtime:functions-mcp`,
  `pnpm run test:types:public`, `pnpm run test:types:contracts`,
  `pnpm exec oxfmt --check ...`, and `git diff --check` passed.

### Notes

- The fixture still sets `previewOperation: 'mutation'` manually on the MCP
  tool. A later generated-handle/runtime slice should carry projection function
  kind so the common one-line MCP binding can infer this.

## Slice 9: Generated Handle Function Kinds

### Proof

- The phase0 fixture still needed `previewOperation: 'mutation'` in the MCP
  tool even though the registry already knew the preview projection was
  `mutation.workspace.preview(...)`. That was a second source of truth between
  Convex projections and MCP transport calls.
- The initial focused run failed because scanner and registry snapshots did not
  include a Convex function kind on projection facts.
- After adding function kind to canonical preview calls, the next focused run
  exposed a real omission: legacy `mutation.workspace(previewOf(op))` projection
  scanning did not carry the outer function kind into preview metadata.

### Implementation

- Added `functionKind: 'query' | 'mutation' | 'action'` to scanned projection
  metadata and registry projections.
- Carried execute/preview function kind from the registry into generated
  operation-handle bindings.
- Added `executeOperation` and `previewOperation` metadata to
  `OperationHandle`, re-exported the public type, and made `tool.operation(...)`
  use generated handle metadata as the default call kind.
- Removed the manual `previewOperation: 'mutation'` override from the phase0 MCP
  delete tool; the one-line generated-handle binding now drives the mutation
  preview call.
- Made operation-handle import rendering formatter-stable for named imports that
  fit on one line.

### Verification

- `pnpm vitest run --project=unit tests/unit/public-surface-codegen.test.ts tests/unit/operation-registry-codegen.test.ts`
  passed after fixing the legacy `previewOf(...)` function-kind path.
- `pnpm vitest run --project=unit tests/unit/operation-ref-codegen.test.ts tests/unit/phase0-workspace-mcp-fixture.test.ts`
  passed after removing the manual MCP preview override.
- Broader focused suite passed:
  `pnpm vitest run --project=unit tests/unit/public-surface-codegen.test.ts tests/unit/operation-registry-codegen.test.ts tests/unit/operation-ref-codegen.test.ts tests/unit/phase0-workspace-mcp-fixture.test.ts tests/unit/mcp-operation-binding.test.ts tests/unit/mcp-index-exports.test.ts tests/unit/functions-defineTrellis.test.ts`.
- `pnpm run test:types:public`, `pnpm run test:types:contracts`,
  `pnpm run lint:src:core`, and `pnpm run lint:src:runtime:functions-mcp`
  passed.
- `pnpm run check:publish-surface` and `pnpm run check:docs:api-surface`
  passed.
- `pnpm exec oxfmt --check ...` and `git diff --check` passed for the touched
  files.

### Notes

- The phase0 fixture now proves the common MCP path is generated-handle driven:
  the tool file imports no Convex implementation, no operation refs, no
  descriptors, and no tool-local execute/preview operation-kind override.
- Remaining explicit `previewOperation` / `executeOperation` uses in examples and
  starter resources should be revisited when registry-generated artifacts are
  wired into the Nuxt/module prepare output. Until then, keep them as advanced
  explicit package/example boundaries, not the canonical greenfield path.

## Slice 10: Projection Re-Export Diagnostics

### Proof

- Added a failing scanner test for re-exported operation projections:
  `const archiveTask = mutation.workspace(op); export { archiveTask }` and
  `export { removeTask } from './domain'`.
- The initial focused run failed with empty diagnostics, proving the scanner only
  inspected variable declarations and silently ignored `ExportDeclaration`
  projection forms.

### Implementation

- Added `unsupported-projection-re-export` diagnostics for named export
  declarations that point at operation projection variables.
- Reused the existing projection binding reader with `requireExport: false` so
  re-export detection follows the same canonical projection rules as normal
  extraction.
- Kept generation fail-closed through the existing registry diagnostic gate; the
  registry still refuses to build when scanner diagnostics are present.

### Verification

- Initial proof run failed as expected:
  `pnpm vitest run --project=unit tests/unit/public-surface-codegen.test.ts -t "re-exported operation projections"`.
- After implementation, the same focused test passed.
- `pnpm vitest run --project=unit tests/unit/public-surface-codegen.test.ts tests/unit/operation-registry-codegen.test.ts`
  passed.
- `pnpm run lint:src:core`, `pnpm run test:types:public`,
  `pnpm exec oxfmt --check src/module-internals/public-surface-codegen.ts tests/unit/public-surface-codegen.test.ts`,
  and `git diff --check` passed.

### Notes

- This intentionally rejects re-exported operation projections instead of
  supporting alternate public paths. Convex function API paths remain derived
  from the direct function module that owns the lane export.

## Slice 11: Module Registry Generated Artifacts

### Proof

- Added a failing installer-level proof that `installPermissionCodegen(...)`
  should emit registry-derived operation refs and MCP handles into Nuxt templates
  and expose a consumer alias.
- The initial focused run failed because the installer only registered
  permission/public-surface artifacts and `#trellis/permissions`; operation
  refs/handles existed only in starter-fixture generation.

### Implementation

- Wired the existing operation registry renderer into
  `installPermissionCodegen(...)`, reusing the same public-surface scan as the
  type/json metadata output.
- Added Nuxt templates:
  `trellis/operation-refs.ts` and `trellis/operation-handles/mcp.ts`.
- Added `#trellis/operations/mcp` as the generated MCP handle alias.
- Used physical `.nuxt/...` template paths for relative import calculation so
  generated handles import runtime-neutral shared descriptors correctly.
- Kept empty apps working by emitting empty generated operation modules when no
  operations are defined.
- Hard-cut the phase0 fixture away from projection re-exports in
  `convex/features/projects/index.ts`; the stricter re-export diagnostic exposed
  that the fixture was no longer canonical.
- Tightened the registry diagnostic gate for strict type checking.

### Verification

- Initial proof run failed as expected:
  `pnpm vitest run --project=unit tests/unit/permission-codegen-installer.test.ts`.
- After implementation,
  `pnpm vitest run --project=unit tests/unit/permission-codegen-installer.test.ts`
  passed.
- The first broader generated-output run exposed the phase0 projection re-export
  violation; after deleting the projection re-export,
  `pnpm vitest run --project=unit tests/unit/operation-ref-codegen.test.ts tests/unit/phase0-workspace-mcp-fixture.test.ts`
  passed.
- Focused suite passed:
  `pnpm vitest run --project=unit tests/unit/permission-codegen-installer.test.ts tests/unit/public-surface-codegen.test.ts tests/unit/operation-registry-codegen.test.ts tests/unit/operation-ref-codegen.test.ts tests/unit/phase0-workspace-mcp-fixture.test.ts tests/unit/generated-type-consumers.test.ts tests/unit/module-validation.test.ts tests/unit/module-setup.test.ts`.
- `pnpm run lint:src:core`, `pnpm run test:types:public`,
  `pnpm run test:types:contracts`, `pnpm exec oxfmt --check ...`, and
  `git diff --check` passed.

### Notes

- This intentionally uses the existing `permissions.codegen` switch because it
  already owns public-surface scanning and generated registry metadata. A
  separate operation-codegen flag would add another source of truth before a
  concrete product requirement exists.
- The generated MCP handle alias is the canonical greenfield import target for
  operation-backed MCP tools once starters/examples are hard-cut.

## Slice 12: Workspace-MCP Starter Generated Handles

### Proof

- Added a failing starter-manifest proof for the maintained `workspace-mcp`
  preset: operation descriptors should live in shared files, Convex should
  implement them, and MCP tools should import `operations` from
  `#trellis/operations/mcp`.
- The initial focused run failed because `shared/features/todos/operations.ts`
  did not exist and the MCP create tool still imported `executeOperationRef`,
  `#trellis/api`, and Convex operation objects directly.

### Implementation

- Added shared todo permission keys and shared todo operation descriptors.
- Changed Convex todo operations to `implementOperation(...)` the shared
  descriptors while keeping handlers, workspace scope, and concrete permission
  checks in Convex.
- Updated workspace-MCP todo projections to use implemented operation exports.
- Updated the feature manifest to list shared descriptors instead of Convex
  implementation objects.
- Removed todo operation re-exports from the Convex feature barrel.
- Changed the generated starter MCP create tool to import
  `operations` from `#trellis/operations/mcp` and call
  `tool.operation(operations.todos.create, ...)`.
- Added a direct registry-render proof against the real workspace-MCP starter
  root to verify generated handles import shared descriptors and not Convex
  implementation files.

### Verification

- Initial proof run failed as expected:
  `pnpm vitest run --project=unit tests/unit/phase0-starter-manifest.test.ts -t "workspace MCP starter"`.
- After implementation,
  `pnpm vitest run --project=unit tests/unit/phase0-starter-manifest.test.ts`
  passed.
- Focused suite passed:
  `pnpm vitest run --project=unit tests/unit/phase0-starter-manifest.test.ts tests/unit/cli-add-resource.test.ts tests/unit/permission-codegen-installer.test.ts tests/unit/generated-type-consumers.test.ts tests/unit/public-surface-codegen.test.ts tests/unit/operation-registry-codegen.test.ts`.
- Focused doctor MCP run passed:
  `pnpm vitest run --project=unit tests/unit/cli-doctor.test.ts -t "workspace-mcp|workspace MCP|MCP"`.
- `pnpm run lint:src:core`, `pnpm run test:types:public`,
  `pnpm run test:types:contracts`, `pnpm exec oxfmt --check ...`, and
  `git diff --check` passed.

### Notes

- This slice intentionally covers only the maintained workspace-MCP starter.
  The add-resource generator and larger examples still have explicit
  `executeOperationRef` / `previewOperationRef` authoring and should be cut over
  in follow-up slices after their descriptors move to shared/runtime-neutral
  files.

## Slice 13: Add-Resource MCP Generated Handles

### Proof

- Added a failing add-resource proof for MCP-facing resources: generated Convex
  operations should use `implementOperation(...)` with shared descriptors, MCP
  create/delete tools should import `operations` from
  `#trellis/operations/mcp`, and generated tools should not bind
  `executeOperationRef(...)`, `previewOperationRef(...)`, `#trellis/api`, or
  Convex implementation files directly.
- The initial focused run failed because `src/cli/lib/resource.ts` still emitted
  `operation.mutation(...)`, `operation.destructive(...)`, manual MCP execute
  and preview ref binding, and Convex operation imports in MCP tools.
- Added a failing permission-codegen proof for generated shared permission key
  handles: Convex permissions using `key: taskReadKey.key` were not discovered,
  so permission inventory generation would lose the generated add-resource
  permissions.
- Added a registry-render proof against the exact generated temp app so the
  operation registry must derive `projects.create` and `projects.remove`
  projections and render MCP handles from shared descriptors.

### Implementation

- Added shared add-resource permission-key output under
  `shared/features/<resource>/permissions.ts`.
- Added shared add-resource operation descriptors under
  `shared/features/<resource>/operations.ts`.
- Changed generated Convex MCP operations to implement the shared descriptors
  with `implementOperation(...)` while keeping workspace scope, permission
  checks, handlers, destructive preview, and confirmation behavior in Convex.
- Changed generated Convex domain projections to project implemented operation
  exports and changed feature manifests to list shared descriptors.
- Removed generated Convex operation/projection re-exports from feature barrels
  so scanner diagnostics do not see projection facts through barrels.
- Changed generated MCP create/delete tools to use
  `tool.operation(operations.<resource>.<action>, ...)`.
- Extended permission codegen to scan shared `definePermissionKey(...)` exports
  and resolve Convex `definePermission({ key: sharedKey.key })` definitions
  without treating shared files themselves as permission definition sources.

### Verification

- Initial focused resource proof failed as expected:
  `pnpm vitest run --project=unit tests/unit/cli-add-resource.test.ts -t "MCP-facing resource"`.
- Initial focused permission proof failed as expected:
  `pnpm vitest run --project=unit tests/unit/permissions-codegen.test.ts -t "shared definePermissionKey"`.
- After implementation, both focused proofs passed.
- Focused adjacent suite passed:
  `pnpm vitest run --project=unit tests/unit/cli-add-resource.test.ts tests/unit/permissions-codegen.test.ts tests/unit/permission-codegen-installer.test.ts tests/unit/public-surface-codegen.test.ts tests/unit/operation-registry-codegen.test.ts`.
- `pnpm run lint:src:core`, `pnpm run test:types:public`,
  `pnpm run test:types:contracts`, `pnpm exec oxfmt --check ...`, and
  `git diff --check` passed.

### Notes

- Generated MCP tools now use generated operation handles and no longer import
  Convex operation implementation files, shared contracts, explicit MCP ref
  helpers, or `#trellis/api`.
- The generated destructive Convex operation still contains
  `executeFunctionRef` because backend preview confirmation currently reads the
  execute target from operation/projection metadata when issuing confirmation
  tokens. Removing that app-authored string needs a focused runtime/codegen
  slice that lets canonical preview projections receive the execute ref from the
  registry without weakening confirmation binding.

## Slice 14: Generated Projection Registry For Confirmation Binding

### Proof

- Added a failing runtime proof for destructive preview confirmation without an
  app-authored `executeFunctionRef`: a destructive operation with only
  `operationProjections.executeById` in `defineTrellis(...)` should issue a
  backend confirmation token bound to the generated execute target and redeem
  through the execute projection.
- The initial focused run failed at preview confirmation with the old
  `executeFunctionRef` requirement, proving backend confirmation still depended
  on app-authored string metadata.
- Added registry-render and installer proofs for a generated
  `operationProjectionRegistry` artifact containing operation id to execute and
  preview function refs plus a deterministic fingerprint.
- Added fixture proof that the phase0 workspace-MCP manifest can generate the
  projection registry beside operation refs and handles.

### Implementation

- Added `OperationProjectionRegistry` and `defineTrellis({ operationProjections
})`.
- Changed destructive preview confirmation to resolve its execute path from
  preview projection metadata first, then generated `operationProjections`.
- Changed destructive execute redemption and identity-forwarding target
  selection to use the same generated execute path when explicit metadata is
  absent.
- Extended `projectOperationRef(...)`, `executeOperationRef(...)`,
  `transportExecuteOperationRef(...)`, and `previewOperationRef(...)` options so
  generated preview refs can carry the registry-derived execute target.
- Added registry rendering for `operation-projections.ts` with derived
  `executeById`, `previewById`, and fingerprint data.
- Wired the Nuxt installer to emit `trellis/operation-projections.ts` and alias
  it as `#trellis/operation-projections`.
- Updated phase0 generated fixture output to include
  `generated/operation-projections.ts` and preview refs stamped with
  registry-derived execute metadata.

### Verification

- Initial focused runtime proof failed as expected:
  `pnpm vitest run --project=unit tests/unit/functions-defineTrellis.test.ts -t "operation projection registry"`.
- After implementation, focused runtime proof passed.
- Focused codegen and fixture suite passed:
  `pnpm vitest run --project=unit tests/unit/operation-registry-codegen.test.ts tests/unit/permission-codegen-installer.test.ts tests/unit/phase0-starter-manifest.test.ts tests/unit/mcp-operation-binding.test.ts`.
- `pnpm run test:types:public`, `pnpm run test:types:contracts`,
  `pnpm run lint:src:core`, `pnpm run lint:src:runtime:functions-mcp`,
  `pnpm run check:publish-surface`, `pnpm run check:docs:api-surface`,
  `pnpm exec oxfmt --check ...`, and `git diff --check` passed.

### Notes

- This slice creates the generated source of truth that can replace normal
  app-authored `executeFunctionRef` strings without weakening backend
  confirmation binding.
- It does not yet hard-cut starter/add-resource Convex code away from
  `executeFunctionRef`, because the Convex-side import path for generated
  projection registries still needs a dedicated prepare/import wiring slice.

## Slice 15: Workspace-MCP Starter Projection Registry Import

### Proof

- Added a failing source-fixture proof for the maintained `workspace-mcp`
  starter: the starter should include a generated root
  `generated/operation-projections.ts` file, `convex/functions.ts` should import
  it with a relative Convex-safe path, and `defineTrellis(...)` should receive
  `operationProjections: operationProjectionRegistry`.
- Added a failing CLI-init proof against the built starter output. The initial
  focused run failed because `trellis init --preset workspace-mcp` did not write
  `generated/operation-projections.ts`.
- The next CLI proof run exposed stale assertions expecting
  `operation.query(...)` / `operation.mutation(...)` in the workspace-MCP todo
  operation file, even though the starter had already moved to shared
  descriptors plus `implementOperation(...)`.

### Implementation

- Added an operation-registry generated artifact declaration to the
  `workspace-mcp` starter manifest, scoped so starter output includes only the
  Convex-needed root `generated/operation-projections.ts` file instead of
  duplicating root MCP refs/handles.
- Marked `generated/operation-projections.ts` as generated starter output.
- Added the generated projection registry file for the maintained
  `workspace-mcp` source fixture.
- Wired `src/cli/starter-fixtures/workspace-mcp/convex/functions.ts` to import
  `operationProjectionRegistry` from `../generated/operation-projections` and
  pass it into `defineTrellis(...)`.
- Updated CLI-init assertions to match the current descriptor/implementation
  operation shape.

### Verification

- Initial focused source-fixture proof failed as expected:
  `pnpm vitest run --project=unit tests/unit/phase0-starter-manifest.test.ts -t "workspace MCP starter fixture"`.
- Initial focused CLI-init proof failed as expected:
  `pnpm vitest run --project=unit tests/unit/cli-doctor.test.ts -t "first-class workspace MCP app"`.
- After implementation and `pnpm run build:cli`, both focused proofs passed.
- Adjacent suite passed:
  `pnpm vitest run --project=unit tests/unit/phase0-starter-manifest.test.ts tests/unit/cli-add-resource.test.ts tests/unit/permission-codegen-installer.test.ts tests/unit/operation-registry-codegen.test.ts`.
- `pnpm run build:cli`, `pnpm run lint:src:core`,
  `pnpm run test:types:public`, `pnpm run test:types:contracts`,
  `pnpm exec oxfmt --check ...`, and `git diff --check` passed.

### Notes

- This proves the Convex-safe relative import path for maintained starter
  output without relying on Nuxt aliases or `.nuxt` files inside Convex code.
- The add-resource generator still cannot safely drop its generated
  `executeFunctionRef` string until there is a refresh path for the root
  projection registry after adding new operations to an existing app.

## Slice 16: Add-Resource Projection Registry Refresh

### Proof

- Added failing add-resource assertions for the maintained workspace-MCP path:
  generated resource operation implementations should not contain
  `executeFunctionRef`, `convex/functions.ts` should be wired to the root
  projection registry, and `generated/operation-projections.ts` should include
  the newly added resource execute and preview projections.
- The initial focused run failed on the generated
  `executeFunctionRef: 'features/projects/domain:remove'` line, proving the
  add-resource path still relied on an app-authored execute target string after
  the runtime had learned to read generated projection registries.

### Implementation

- Removed generated `executeFunctionRef` output from add-resource destructive
  operation implementations.
- Added an add-resource MCP after-write step that patches
  `convex/functions.ts` with a Convex-safe relative
  `operationProjectionRegistry` import and `defineTrellis(...)` option when
  needed.
- Rebuilt the root `generated/operation-projections.ts` file from the scanner
  after new resource files are written, using the operation registry as the
  single source of truth for confirmation execute and preview targets.
- Kept this refresh scoped to the Convex-needed projection registry; Nuxt MCP
  operation refs and handles remain module-generated from the same registry
  during normal Nuxt prepare instead of becoming CLI-written duplicates.

### Verification

- Initial focused proof failed as expected:
  `pnpm vitest run --project=unit tests/unit/cli-add-resource.test.ts -t "MCP-facing resource"`.
- After implementation, the same focused proof passed.
- Adjacent generated-artifact suite passed:
  `pnpm vitest run --project=unit tests/unit/cli-add-resource.test.ts tests/unit/phase0-starter-manifest.test.ts tests/unit/permission-codegen-installer.test.ts tests/unit/operation-registry-codegen.test.ts`.
- Workspace-MCP CLI-init smoke passed:
  `pnpm vitest run --project=unit tests/unit/cli-doctor.test.ts -t "first-class workspace MCP app"`.
- `pnpm run build:cli`, `pnpm run lint:src:core`,
  `pnpm run test:types:public`, and `pnpm run test:types:contracts` passed.
- `pnpm exec oxfmt --check src/cli/lib/resource.ts tests/unit/cli-add-resource.test.ts journal2.md`
  and `git diff --check` passed.
- Source scan confirmed the removed add-resource `executeFunctionRef` template
  is gone.

### Notes

- This closes the normal generated-resource path that was still duplicating
  execute-target facts in app-authored operation code.
- Remaining explicit `executeFunctionRef` and manual MCP ref bindings are now
  concentrated in examples, tests for advanced/public APIs, harness code, and
  component examples that still need a separate review or hard cut.

## Next Slice Candidates

## Slice 17: MCP Reference Generated Handles And Registry Forwarding

### Proof

- Added a failing MCP boundary proof for the maintained
  `examples/07-mcp-reference` runbook write tools. The initial run showed the
  tools still imported Convex runbook operation implementations and handwritten
  `executeOperationRef(...)` / `previewOperationRef(...)` bindings.
- The same proof rendered MCP operation handles from the scanned registry and
  exposed a runtime-boundary problem: generated MCP handles imported Convex-only
  descriptors when runtime filtering was not applied.
- The example test then exposed a forwarding gap after removing handwritten
  execute refs from safe operations: forwarded create calls failed envelope
  validation before reaching `Forbidden: Create runbook` because normal
  non-destructive operations did not use the root projection registry as their
  identity-forwarding target source.
- A second example run exposed stale test resolution: the reference example
  aliased most Trellis subpaths to source but not `@lupinum/trellis/app`, so
  tests mixed current source with stale `dist` runtime behavior.

### Implementation

- Moved runbook permission keys and operation descriptors into
  `examples/07-mcp-reference/shared/features/runbooks`, leaving Convex files to
  implement the shared descriptors with `implementOperation(...)`.
- Updated the reference runbook feature manifest to list shared descriptors as
  the canonical operation inventory.
- Replaced the reference runbook MCP write tools with generated operation
  handles from `#trellis/operations/mcp`.
- Added the root `examples/07-mcp-reference/generated/operation-projections.ts`
  registry and wired `convex/functions.ts` to pass it into `defineTrellis(...)`.
- Removed projection re-exports from reference feature barrels so the scanner
  sees direct Convex projection exports instead of ambiguous barrel exports.
- Made registry-rendered operation ref names collision-safe by deriving them
  from operation ids plus projection kind.
- Runtime-filtered generated operation refs/handles to shared descriptors when
  a generated handle module targets external runtimes such as MCP, while still
  rendering the full root operation projection registry for Convex.
- Added a shared runtime resolver for operation identity-forwarding targets:
  explicit target, explicit `executeFunctionRef`, projection metadata,
  generated projection registry, then the legacy `id` fallback.
- Applied that resolver to safe queries, safe mutations, destructive previews,
  destructive executions, and transport mutations.
- Removed the remaining normal-path handwritten `executeFunctionRef` from the
  reference webhook operation after the runtime registry fallback was proven.
- Added the missing `@lupinum/trellis/app` alias to the reference example
  Vitest config so the example tests run against source consistently.
- Regenerated `security-contract.generated.json` after the reference example
  operation inventory moved from Convex-local definitions to shared
  descriptors.

### Verification

- Focused runtime proof passed:
  `pnpm vitest run --project=unit tests/unit/functions-defineTrellis.test.ts -t "operation projection registry"`.
- Reference example tests passed:
  `pnpm vitest run --config vitest.config.ts test/mcpReference.test.ts server/api/runbook-webhook.post.test.ts`
  from `examples/07-mcp-reference`.
- Full reference example script passed:
  `pnpm --dir examples/07-mcp-reference test`.
- Boundary/codegen unit block passed:
  `pnpm vitest run --project=unit tests/unit/operation-registry-codegen.test.ts tests/unit/permission-codegen-installer.test.ts tests/unit/mcp-descriptor-boundary.test.ts tests/unit/operation-ref-codegen.test.ts tests/unit/phase0-workspace-mcp-fixture.test.ts tests/unit/phase0-starter-manifest.test.ts tests/unit/cli-add-resource.test.ts tests/unit/functions-defineTrellis.test.ts`.
- Source gates passed:
  `pnpm run lint:src:core`, `pnpm run lint:src:runtime:functions-mcp`,
  `pnpm run test:types:public`, `pnpm run test:types:contracts`, and
  `pnpm run build:cli`.
- Security contract check passed after regeneration:
  `pnpm run check:security:contract`.
- Security gate passed:
  `pnpm run test:security`.
- Formatting and diff hygiene passed:
  `pnpm exec oxfmt --check ...` for touched files and `git diff --check`.

### Notes

- The maintained MCP reference write tools now use generated operation handles
  instead of importing Convex runbook operation implementations or recreating
  execute/preview refs in tool files.
- The checked-in reference `generated/operation-projections.ts` is now covered
  by a boundary test that compares it exactly with scanner-rendered output.
- Explicit `executeFunctionRef` remains in advanced examples/tests and the
  component mini-CMS example. Those are separate boundaries to review; the
  reference app no longer needs normal-path handwritten refs for runbook writes
  or the webhook operation.

## Next Slice Candidates

## Slice 18: Component Bridge Operation Boundary Classification

### Proof

- Reviewed the remaining component mini-CMS `executeFunctionRef` and MCP
  operation bindings after the reference-app hard cut.
- The key difference is topology, not syntax: mini-CMS operation
  implementations live inside the local Convex component, but MCP tools must
  call host bridge refs such as `api.features.pages.domain.create` and
  `api.features.pages.domain.publishAction` so bridge forwarding and component
  access stay enforced.
- A generated handle from the current operation registry would target component
  projections directly, which would be the wrong authority lane for the host
  MCP server.
- The mini-CMS Vitest config had the same stale-runtime risk found in the MCP
  reference app: it imported `convexTestConfig` from the package and only
  aliased a subset of Trellis subpaths to source.

### Implementation

- Added an MCP boundary test for mini-CMS write tools that requires explicit
  checked operation refs to host bridge APIs, rejects generated MCP handles for
  this bridge topology, and prevents accidental direct `api.components.*`
  binding.
- Kept the generic advanced MCP tool assertion scoped to harness code.
- Switched the mini-CMS Vitest config to import `convexTestConfig` directly from
  source and added source aliases for the Trellis runtime subpaths used by the
  example.

### Verification

- Component mini-CMS full example test passed:
  `pnpm --dir examples/08-component-mini-cms test`.
- MCP boundary proof passed:
  `pnpm vitest run --project=unit tests/unit/mcp-descriptor-boundary.test.ts`.

### Notes

- This is an explicit keep, not a missed hard cut: generated operation handles
  are correct for normal app/MCP operation projections, but the component bridge
  still needs host bridge refs until Trellis has bridge-generated operation
  handles that can represent host ref plus component implementation binding as
  one checked artifact.
- The remaining mini-CMS `executeFunctionRef` strings belong to the bridge
  layer review, not to the normal app operation path removed from the
  maintained MCP reference example.

## Slice 19: Team Workspace Projection Registry

### Proof

- Ran the operation-registry scanner against `examples/03-team-workspace`
  before editing. It failed on the re-exported
  `processTodoSyncWebhookMutation`, proving the registry path still rejected
  noncanonical projection exports instead of guessing through feature barrels.
- After removing that re-export, the scanner exposed an unused
  `users.resolve-mcp-user-by-email` operation without an execute projection.
  That operation had no callers and would have kept a second source of truth in
  the maintained workspace example.
- The webhook operation still carried a handwritten `executeFunctionRef`, so
  the example had not fully moved to generated operation projection facts.

### Implementation

- Removed the noncanonical webhook projection re-export from the todos feature
  barrel.
- Deleted the unused `resolveMcpUserByEmailOp` operation wrapper instead of
  adding projection metadata for an unused path.
- Generated `examples/03-team-workspace/generated/operation-projections.ts`
  from the scanner and wired `convex/functions.ts` to
  `operationProjections: operationProjectionRegistry`.
- Removed the webhook operation's app-authored `executeFunctionRef`; the
  generated registry now owns the execute binding.
- Switched the example Vitest config to import Trellis testing helpers from the
  source tree and alias the runtime subpaths used by the example, matching the
  local source verification pattern used by the MCP reference and mini-CMS
  examples.
- Added an exact drift test for maintained checked-in projection registries,
  currently covering `examples/03-team-workspace` and
  `examples/07-mcp-reference`.
- Regenerated the security contract so the inventory reflects the removed
  operation and the registry-owned webhook execute projection.

### Verification

- Team workspace example tests passed:
  `pnpm --dir examples/03-team-workspace test`.
- MCP boundary and projection-registry drift test passed:
  `pnpm vitest run --project=unit tests/unit/mcp-descriptor-boundary.test.ts`.
- Focused formatting check passed for the changed example, generated registry,
  boundary test, and journal files.
- Security contract drift check passed:
  `pnpm run check:security:contract`.

### Notes

- `examples/03-team-workspace` no longer has normal-path app-authored
  `executeFunctionRef` metadata.
- Remaining normal maintained-example `executeFunctionRef` strings are in
  `examples/04-saas-platform` and `examples/05-visibility-access`.
- The component mini-CMS refs remain classified as bridge-boundary refs until a
  bridge-generated handle can represent host bridge authority and component
  implementation binding as one checked artifact.

## Slice 20: SaaS Platform Projection Registry

### Proof

- Ran the operation-registry builder against `examples/04-saas-platform` before
  editing. It failed on `convex/features/members/index.ts` because the feature
  barrel re-exported the `list` projection from `domain.ts`.
- Reviewed the other feature barrels and found additional duplicate function
  surfaces: file upload, destructive previews, destructive operation objects,
  and the internal webhook mutation were re-exported even though app code,
  tests, and routes call the canonical `domain.ts` or `webhooks.ts` modules
  directly.
- After deleting those duplicate re-exports, the scanner derived the full
  registry, including `projects.archive` and `tasks.remove` preview/execute
  pairs, without handwritten operation refs.

### Implementation

- Removed duplicate Convex function and operation re-exports from the files,
  members, projects, and tasks feature barrels.
- Removed app-authored `executeFunctionRef` strings from
  `archiveProjectOp` and `removeTaskOp`.
- Generated `examples/04-saas-platform/generated/operation-projections.ts`
  and wired `convex/functions.ts` to
  `operationProjections: operationProjectionRegistry`.
- Added `examples/04-saas-platform` to the maintained projection-registry drift
  test.
- Switched the example Vitest config to import Trellis testing helpers from the
  source tree and alias the runtime subpaths used by the example.
- Regenerated the security contract so `projects.archive` and `tasks.remove`
  no longer carry app-authored execute refs in the operation inventory.

### Verification

- SaaS platform example tests passed after Nuxt prepare:
  `pnpm --dir examples/04-saas-platform test`.
- MCP boundary and projection-registry drift test passed:
  `pnpm vitest run --project=unit tests/unit/mcp-descriptor-boundary.test.ts`.
- Focused formatting check passed for the changed example, generated registry,
  and boundary test files.
- Source scan confirmed no remaining `executeFunctionRef` strings under
  `examples/04-saas-platform`.

### Notes

- The strict scanner rejected duplicate feature-barrel function surfaces as
  intended; the fix was deletion, not broader inference.
- `examples/04-saas-platform` no longer has normal-path app-authored
  `executeFunctionRef` metadata.
- The remaining normal maintained-example `executeFunctionRef` string is in
  `examples/05-visibility-access`.

## Slice 21: Visibility Access Projection Registry

### Proof

- Ran the operation-registry builder against `examples/05-visibility-access`
  before editing. It failed on `convex/features/articles/index.ts` because the
  feature barrel re-exported the `create` projection from `domain.ts`.
- Reviewed feature-barrel usage and confirmed app code and tests call canonical
  `api.features.*.domain.*` refs directly. The article, knowledge-base, and
  workspace barrel projection exports were duplicate function surfaces rather
  than required public paths.
- After deleting those duplicate re-exports, the scanner derived the full
  registry, including the `shareTokens.revoke` preview/execute pair, without a
  handwritten operation ref.

### Implementation

- Removed duplicate Convex projection re-exports from the articles,
  knowledge-bases, and workspaces feature barrels.
- Removed the app-authored `executeFunctionRef` from `revokeShareTokenOp`.
- Generated `examples/05-visibility-access/generated/operation-projections.ts`
  and wired `convex/functions.ts` to
  `operationProjections: operationProjectionRegistry`.
- Added `examples/05-visibility-access` to the maintained projection-registry
  drift test.
- Switched the example Vitest config to import Trellis testing helpers from the
  source tree and alias the runtime subpaths used by the example.
- Regenerated the security contract so `shareTokens.revoke` no longer carries
  an app-authored execute ref in the operation inventory.

### Verification

- Visibility access example tests passed after Nuxt prepare:
  `pnpm --dir examples/05-visibility-access test`.
- MCP boundary and projection-registry drift test passed:
  `pnpm vitest run --project=unit tests/unit/mcp-descriptor-boundary.test.ts`.
- Source scan confirmed no remaining `executeFunctionRef` strings under
  `examples/05-visibility-access`.

### Notes

- Maintained normal examples now use generated projection registries instead of
  app-authored `executeFunctionRef` strings for ordinary operation bindings.
- Remaining source `executeFunctionRef` strings are expected in runtime
  internals, tests/fixtures, harness coverage, and the component mini-CMS bridge
  boundary classified in Slice 18.

## Slice 22: Normal Example Execute Ref Guard

### Proof

- A source scan after Slices 19-21 showed normal maintained examples no longer
  contain `executeFunctionRef`; only the intentionally classified component
  mini-CMS bridge example still does.
- Manual scans are not enough for the RFC hard-cut path. The invariant needs to
  run in the existing security-focused boundary test so future example edits
  cannot reintroduce app-authored execute refs unnoticed.

### Implementation

- Added a unit assertion that recursively scans normal maintained example source
  roots and fails if any app-authored `executeFunctionRef` string appears.
- Excluded build/generated directories and excluded the component mini-CMS
  bridge example, which remains covered by the explicit bridge-boundary
  classification test.

### Verification

- MCP boundary and normal-example execute-ref guard passed:
  `pnpm vitest run --project=unit tests/unit/mcp-descriptor-boundary.test.ts`.
- Focused formatting check passed for the boundary test and journal files.

### Notes

- This does not ban `executeFunctionRef` from Trellis internals, generated
  projection metadata, focused runtime tests, harness coverage, or the
  mini-CMS bridge boundary.
- The guard is intentionally scoped to normal maintained examples, matching the
  RFC acceptance criterion instead of overreaching into advanced package and
  bridge surfaces before their replacement design exists.

## Next Slice Candidates

1. Review harness explicit operation refs and decide which are advanced test
   coverage versus deletion targets.
2. Define the bridge-generated operation handle shape needed to replace
   component mini-CMS explicit refs without bypassing host bridge authority.
3. Start the broader registry-runtime work: filtered generated handles for
   client/server/testing and `trellis prepare` lifecycle hardening.
