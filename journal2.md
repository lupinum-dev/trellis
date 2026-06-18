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

## Slice 23: Harness Execute Ref Coverage Classification

### Proof

- Ran the operation-registry builder against `apps/harness`. It failed on
  `convex/posts.ts` because the harness uses object-spread projection metadata
  for `removeWithConfirmation`.
- The harness is not a normal maintained example. It imports the backend
  Trellis runtime directly and owns repo-level Convex/runtime tests, MCP smoke
  coverage, identity forwarding, and destructive confirmation edge cases.
- Existing harness MCP boundary tests already keep advanced tool files on
  projected refs without importing Convex domain implementation modules.

### Implementation

- Added a boundary assertion that permits harness `executeFunctionRef` strings
  only in `apps/harness/convex/posts.ts` and `apps/harness/convex/notes.ts`.
- Reused the source scanner from the normal-example guard, excluding build and
  generated directories.

### Verification

- MCP boundary, normal-example guard, and harness execute-ref guard passed:
  `pnpm vitest run --project=unit tests/unit/mcp-descriptor-boundary.test.ts`.
- Focused formatting check passed for the boundary test.

### Notes

- This is a classification guard, not a permanent design endorsement. The
  harness refs remain acceptable only because they cover Trellis runtime edges
  that normal examples and Ginko-like consumers must not author.
- If a future slice gives the harness generated runtime handles for these
  low-level cases, deleting the allow-list should be straightforward.

## Slice 24: Nuxt Runtime Operation Handle Aliases

### Proof

- Inspected `installPermissionCodegen(...)` and confirmed it emitted only
  `trellis/operation-handles/mcp.ts` and only aliased
  `#trellis/operations/mcp`.
- Inspected the generated refs path and found it imported
  `projectOperationRef` from `#trellis/mcp`. That would make client, server, or
  testing handle modules pull the MCP surface indirectly if we reused the refs
  module unchanged.
- Inspected runtime entrypoints and confirmed `defineOperationHandle` is
  lightweight in `operation-metadata`, while app/server/testing entrypoints do
  not expose it today. Adding a local generated alias is smaller than adding a
  new package export only for generated internals.

### Implementation

- Added a generated `#trellis/operation-runtime` alias that re-exports only
  `defineOperationHandle` and `projectOperationRef` from the lightweight
  operation metadata runtime.
- Changed generated operation refs to import `projectOperationRef` from
  `#trellis/operation-runtime` instead of `#trellis/mcp`.
- Made permission codegen emit runtime-specific handle modules and aliases:
  `#trellis/operations/client`, `#trellis/operations/server`,
  `#trellis/operations/testing`, and `#trellis/operations/mcp`.
- Kept the existing shared-descriptor safety filter for runtime handle modules;
  Convex-only operation definitions still do not leak into generated
  cross-runtime handles.
- Passed the Nuxt resolver into permission codegen so the local operation
  runtime template can point at the real source module.

### Verification

- Permission-codegen installer tests passed and now assert all four runtime
  handle aliases plus the neutral operation-runtime alias.
- Neighboring codegen and boundary tests passed:
  `pnpm vitest run --project=unit tests/unit/permission-codegen-installer.test.ts tests/unit/module-auto-imports.test.ts tests/unit/operation-registry-codegen.test.ts tests/unit/mcp-descriptor-boundary.test.ts tests/unit/app-index-exports.test.ts tests/unit/server-index-exports.test.ts tests/unit/mcp-index-exports.test.ts`.
- Focused formatting check passed for the installer, module entry, and updated
  installer test.
- Source lint and public surface checks passed:
  `pnpm run lint:src:core`,
  `pnpm run check:publish-surface`,
  `pnpm run check:docs:api-surface`.

### Notes

- This slice creates the missing Nuxt alias surface for RFC runtime handles,
  but it does not yet add client/server/testing convenience APIs such as
  `useTrellisOperation`.
- The generated handle modules remain intentionally filtered to operations with
  shared descriptors. A later slice should decide whether minimal metadata-only
  handles are needed for Convex-local operations without importing backend
  implementation files.

## Slice 25: Client Operation Composable Proof

### Proof

- Added a Nuxt runtime proof for `useTrellisOperation(...)` using a generated
  destructive operation handle shape. After fixing the test syntax, it failed
  before implementation because
  `src/runtime/convex/composables/useTrellisOperation` did not exist.
- Extended the Nuxt auto-import surface test before implementation. It failed
  because `useTrellisOperation` was not registered by `installCoreTrellis(...)`.
- Added a public DTS proof that generated-style operation handles preserve
  execute args/result types and preview result types through
  `useTrellisOperation(...)`.

### Implementation

- Added `useTrellisOperation(...)` as a thin client composable over the existing
  Convex mutation/action command state instead of adding a new state machine.
- The composable exposes separate preview and execute state, preview-derived
  warnings/blockers/effects/confirmation refs, and explicit
  `{ confirmation: preview.confirmation }` execution.
- Explicit confirmation maps to the internal `_confirmationToken` transport
  field; backend confirmation binding remains authoritative.
- Preview projections are intentionally mutation-backed in this first client
  slice, matching the RFC destructive-preview contract.
- Exported the composable from `@lupinum/trellis/composables`, registered it as
  a core Nuxt auto-import, and refreshed the generated API surface docs.
- Expanded the public DTS Nuxt shim enough for the composables barrel to be
  typechecked directly by `test:types:public`.

### Verification

- Proof/runtime tests passed:
  `pnpm vitest run --project=nuxt tests/nuxt/useTrellisOperation.nuxt.test.ts`
  and
  `pnpm vitest run --project=unit tests/unit/module-auto-imports.test.ts`.
- Public type proof passed: `pnpm run test:types:public`.
- Neighboring operation-handle/codegen tests passed:
  `pnpm vitest run --project=unit tests/unit/permission-codegen-installer.test.ts tests/unit/module-auto-imports.test.ts tests/unit/operation-registry-codegen.test.ts tests/unit/mcp-descriptor-boundary.test.ts tests/unit/app-index-exports.test.ts tests/unit/server-index-exports.test.ts tests/unit/mcp-index-exports.test.ts`.
- Focused lint and surface checks passed:
  `pnpm run lint:src:runtime:auth-convex`,
  `pnpm run lint:src:runtime:rest`,
  `pnpm run lint:src:core`,
  `pnpm run lint:tests`,
  `pnpm run check:publish-surface`,
  `pnpm run check:docs:api-surface`.
- Formatting and whitespace checks passed:
  `pnpm run format:check` and `git diff --check`.

### Notes

- This slice gives the generated client handles a real Vue consumer surface, but
  it does not yet add the operation-aware product test client or server-route
  operation adapter from the RFC.
- Query-backed operation handles still belong to the normal query composables or
  a later deliberate `useTrellisOperation` read design; this slice only covers
  mutation/action execute calls plus mutation previews.

## Slice 26: Product-Level Testing Operation Client

### Proof

- Added a public DTS proof for
  `ctx.asUser(...).operation(operationHandle).preview/execute(...)`. It failed
  before implementation because `operation` was not part of `TestClient`.
- Added a focused runtime proof with inline Convex test modules and generated
  operation projection metadata. It failed before implementation because
  `caller.operation` was not a function.
- Source review of Ginko CMS showed the consumer still maintained
  `destructiveTransportExecuteFunctionRefs`, `handlerIdByFunctionRef`, and
  call-site `targetFunctionRef` derivation in tests. This slice targets that
  Trellis protocol leak directly.

### Implementation

- Added `operation(handle)` to Trellis testing clients returned by
  `asCaller`, `asUser`, `asService`, seeded tenant users, and `asAuthUser`.
- Operation preview/execute calls derive projection kind and function refs from
  generated operation handle metadata instead of caller-authored maps.
- Destructive execute calls with confirmation add `_confirmationToken` and
  derive operation-execute forwarding options, including
  `operation-confirmation` replay mode and confirmation-token JTI hashing.
- Normal operation-backed mutation/action calls receive testing replay defaults
  (`jti-redemption` for mutations, `domain-idempotency` for actions) while query
  calls stay read-only.
- Seeded users and `asAuthUser` attach `operation(...)` lazily so existing
  browser-auth style tests do not require an identity-forwarding key unless the
  operation testing helper is used.

### Verification

- Proof/runtime tests passed:
  `pnpm vitest run --project=unit tests/unit/testing.test.ts`.
- Public and contract type checks passed:
  `pnpm run test:types:public` and `pnpm run test:types:contracts`.
- Existing seeded-user harness coverage passed:
  `pnpm vitest run --project=convex apps/harness/convex/testingPackage.test.ts`.
- Focused lint and surface checks passed:
  `pnpm run lint:src:runtime:rest`,
  `pnpm run lint:tests`,
  `pnpm run check:publish-surface`,
  `pnpm run check:docs:api-surface`.
- Formatting and whitespace checks passed:
  `pnpm run format:check` and `git diff --check`.

### Notes

- This gives Ginko-like consumers the product-level testing surface required by
  the RFC. The next consumer proof is to replace Ginko CMS test helper maps with
  generated testing operation handles.
- The helper derives transport metadata from operation handles; it does not add
  a second public transport API or a compatibility shim for old maps.

## Slice 27: Package-Root Operation Handle Generation

### Proof

- Ran the current public-surface scanner against
  `/Users/matthias/Git/workspace/ginko-cms` and confirmed it found zero
  operations because Ginko CMS is a package/component consumer, not a canonical
  app-level `convex/` tree.
- Added a focused package-root fixture that mirrors Ginko's real shape:
  `src/` as the Convex source root, `callerMutation.protected(...)` lanes,
  `callerTransportMutation(...)` transport exports, and
  `Object.assign(previewOf(operation), { id })` preview wrappers.
- The proof failed before implementation because destructive previews wrapped
  with `Object.assign(previewOf(...))` were not traced, and package-local
  source roots could not be converted into generated Convex api paths.
- Re-ran the generator against the real Ginko Convex package with explicit
  package options. It now finds 16 operations and 28 projections with no
  diagnostics, and generated testing handles omit `*TransportExecute` exports.

### Implementation

- Added explicit public-surface scanner options for package roots:
  `operationInclude`, `operationExclude`, custom projection roots, and ignored
  projection roots.
- Kept the default app scanner unchanged: canonical `convex/**`, `shared/**`,
  and `mutation`/`query`/`action` roots still work without configuration.
- Added narrow scanner support for `Object.assign(previewOf(operation), ...)`
  and `Object.assign(operation, ...)` without accepting arbitrary operation
  factories.
- Added configurable Convex source-root mapping to the operation registry so
  package files such as `src/entries/publish.ts` produce api paths such as
  `api.entries.publish.*`.
- Added generated-metadata operation handles. These handles use generated
  runtime-safe descriptor metadata instead of runtime-importing Convex handler
  modules, while preserving execute/preview ref metadata for testing clients.
- Updated `defineOperationHandle(...)` to derive fallback operation metadata
  from descriptor fields when generated descriptors do not carry the internal
  metadata symbol.
- Fixed a DTS proof lint issue by marking intentional promise-returning
  negative calls as ignored with `void`.

### Verification

- Focused and neighboring tests passed:
  `pnpm vitest run --project=unit tests/unit/operation-registry-codegen.test.ts tests/unit/public-surface-codegen.test.ts tests/unit/mcp-descriptor-boundary.test.ts tests/unit/permission-codegen-installer.test.ts tests/unit/operation-ref-codegen.test.ts tests/unit/testing.test.ts`.
- Ginko dry-run proof passed via the Trellis generator against
  `/Users/matthias/Git/workspace/ginko-cms/packages/convex`: 16 registry
  operations, 28 projections, no scanner diagnostics, testing handles generated
  from operation execute/preview projections only.
- Lint passed for touched areas:
  `pnpm run lint:src:core`,
  `pnpm run lint:src:runtime:functions-mcp`, and `pnpm run lint:tests`.
- Type checks passed:
  `pnpm run test:types:public` and `pnpm run test:types:contracts`.
- Surface/build checks passed:
  `pnpm run build:module`,
  `pnpm run check:publish-surface`, and
  `pnpm run check:docs:api-surface`.
- Formatting and whitespace checks passed:
  `pnpm run format:check` and `git diff --check`.

### Notes

- This is not a compatibility path for old transport maps. It creates the
  missing generated-handle foundation needed to delete those maps from Ginko
  tests.
- The next slice should materialize these generated testing handles in Ginko CMS
  and replace at least one confirmed destructive helper path with
  `ctx.asCmsUser(...).operation(operations.byId[...]).preview/execute(...)`.
- A proper `trellis prepare` lifecycle remains open. This slice proves the
  generator contract and package-root options first, before adding a durable
  command/config surface.

## Slice 28: Generated Forwarding Target Metadata

### Proof

- Materialized the generated testing operation handles in Ginko CMS and replaced
  the first publish test path with
  `owner.operation(operations.byId['ginko-cms.publish-entry']).preview/execute(...)`.
- The first consumer run failed with
  `Invalid identity forwarding envelope: function-ref.` The generated refs were
  stamping Convex api source paths such as
  `entries/publish:previewPublishEntryOperation`, while the backend handler
  expected the handler identity target
  `editor:previewPublishEntryOperation`.
- Confirmed the same split exists for normal generated refs: `apiPath` is the
  Convex invocation path, but `functionRef` must be the backend forwarding
  target derived from operation/projection metadata.

### Implementation

- Extended public-surface operation metadata with app-authored
  `executeFunctionRef` and projection metadata with a derived
  `targetFunctionRef`.
- The scanner now derives projection targets from, in order:
  explicit projection `id` overrides, preview defaults
  `${operation.id}:preview`, app-authored operation `executeFunctionRef`, and
  finally the operation id.
- Updated operation registry generation to keep `apiPath` for Convex invocation
  while using the derived target as stamped projection `functionRef`.
- Updated generated projection registries and starter/example fixtures so
  execute maps point at operation ids and preview maps point at
  `<operation-id>:preview` unless source metadata declares a more explicit
  target.
- Kept generated-metadata refs free of backend implementation imports and
  exported `defineOperationHandle` plus operation-handle types from backend
  barrels so generated testing handles can avoid the MCP entrypoint.

### Verification

- Focused Trellis codegen and boundary tests passed:
  `pnpm vitest run --project=unit tests/unit/public-surface-codegen.test.ts tests/unit/operation-registry-codegen.test.ts tests/unit/permission-codegen-installer.test.ts tests/unit/phase0-starter-manifest.test.ts tests/unit/cli-add-resource.test.ts tests/unit/operation-ref-codegen.test.ts tests/unit/mcp-descriptor-boundary.test.ts tests/unit/testing.test.ts tests/unit/backend-index-exports.test.ts`.
- Trellis build passed after the backend type export update:
  `pnpm run build:module`.
- Trellis lint/type/surface gates passed:
  `pnpm run lint:src:core`, `pnpm run lint:tests`,
  `pnpm run lint:src:runtime:functions-mcp`,
  `pnpm run lint:src:runtime:rest`,
  `pnpm run test:types:public`, `pnpm run test:types:contracts`,
  `pnpm run check:publish-surface`, and
  `pnpm run check:docs:api-surface`.
- Formatting and whitespace checks passed:
  `pnpm run format:check` and `git diff --check`.
- Ginko CMS consumer proof passed with generated testing handles imported from
  `@lupinum/trellis/backend`:
  `pnpm vitest run test/component/entries/publish.test.ts` passed 10 tests.

### Notes

- This fixes the Trellis-owned forwarding-target gap exposed by Ginko without
  adding a CMS compatibility shim.
- Ginko still has broader test-helper transport maps because many tests still
  call old transport execute refs. The next consumer slice should migrate more
  destructive publish/unpublish tests to generated operation handles, then
  delete the corresponding map entries.
- The large `cli-doctor` suite was not used as evidence for this slice because
  it failed before assertions on a missing built starter-fixture directory when
  run directly in this worktree. The targeted generator and boundary tests cover
  the changed contract.

## Slice 29: Package-Root Relative Import Extensions

### Proof

- Continued the Ginko CMS consumer migration with generated testing handles for
  publish/unpublish destructive operations.
- After Slice 28 fixed forwarding target metadata, the next consumer proof
  reached TypeScript's Node16/Nodenext resolver. Ginko's generated package-root
  files failed because relative imports were emitted without runtime `.js`
  extensions:
  `src/generated/operation-refs.ts` imported `../_generated/api` and
  `src/generated/operation-handles/testing.ts` imported `../operation-refs`.
- Confirmed this is not a Nuxt virtual-alias problem. It is specific to
  package-root concrete TypeScript output that is typechecked under Node-style
  ESM resolution.

### Implementation

- Added an opt-in `relativeImportExtension?: '' | '.js'` option to operation
  registry generated files.
- Kept the default extensionless so existing Nuxt virtual/starter artifacts do
  not change.
- Wired the option through generated descriptor imports and generated handle
  imports, including the handle-to-refs import.
- Added a package-root generated-metadata test that models Ginko's concrete
  output: `../_generated/api.js` plus `../operation-refs.js`, while still
  proving generated metadata does not runtime-import Convex implementation
  files.

### Verification

- Focused Trellis registry test passed:
  `pnpm vitest run --project=unit tests/unit/operation-registry-codegen.test.ts`.
- Neighboring Trellis generated-operation tests passed:
  `pnpm vitest run --project=unit tests/unit/operation-registry-codegen.test.ts tests/unit/public-surface-codegen.test.ts tests/unit/permission-codegen-installer.test.ts tests/unit/phase0-starter-manifest.test.ts tests/unit/operation-ref-codegen.test.ts tests/unit/mcp-descriptor-boundary.test.ts`.
- Trellis build/lint/type/surface gates passed:
  `pnpm run build:module`, `pnpm run lint:src:core`,
  `pnpm run lint:src:runtime:functions-mcp`,
  `pnpm run lint:src:runtime:rest`, `pnpm run lint:tests`,
  `pnpm run test:types:public`, `pnpm run test:types:contracts`,
  `pnpm run check:publish-surface`, and
  `pnpm run check:docs:api-surface`.
- Formatting and whitespace checks passed:
  `pnpm run format:check` and `git diff --check`.
- Regenerated Ginko CMS operation files from the local Trellis source with
  `relativeImportExtension: '.js'`: 16 operations, 28 projections, no scanner
  diagnostics.
- Ginko CMS consumer proof passed:
  `pnpm vitest run test/component/entries/publish.test.ts` and
  `pnpm run typecheck`.

### Notes

- This is an explicit concrete-output option, not a compatibility shim. The
  caller chooses it only when writing package-root files that TypeScript will
  resolve as Node ESM.
- The generated testing handles now let Ginko's publish test call
  `owner.operation(operations.byId[...]).preview/execute(...)` without raw
  transport execute refs.
- The next slice should move this from manual generation toward the durable
  prepare/codegen lifecycle and continue deleting Ginko's remaining raw
  transport execute usage.

## Slice 30: Concrete Operation Registry CLI Generation

### Proof

- Added a failing CLI proof for Ginko-shaped concrete operation generation:
  `src/` as Convex source root, custom caller projection roots, ignored
  transport projection roots, generated metadata descriptors, `.js` relative
  imports, and package-root output under `src/generated/**`.
- The proof failed before implementation because `trellis operations generate`
  did not exist; package-root generated testing handles still required a manual
  Node script that imported Trellis internals.
- Ran the new command against the actual Ginko CMS package-root generated
  files. The first `--check` correctly reported drift in
  `src/generated/operation-handles/testing.ts` because the file had been
  manually formatter-touched after generation.

### Implementation

- Added `trellis operations generate`.
- The command reuses the existing public-surface scanner and operation registry
  renderer directly. It does not add a second registry model or a new config
  file format.
- Added explicit CLI flags for the existing scanner/rendering knobs:
  operation include/exclude globs, projection roots, ignored projection roots,
  Convex source root, output paths, runtime imports, descriptor mode, relative
  import extension, and handle runtimes.
- Added `--check` mode. It compares existing generated files with renderer
  output and returns exit code `1` with a JSON `outOfDate` list when generated
  files are stale.
- Registered the command under the existing Trellis CLI without changing Nuxt
  template generation.

### Verification

- Failing proof now passes:
  `pnpm vitest run --project=unit tests/unit/cli-operations.test.ts`.
- Neighboring generated-operation tests passed:
  `pnpm vitest run --project=unit tests/unit/cli-operations.test.ts tests/unit/operation-registry-codegen.test.ts tests/unit/public-surface-codegen.test.ts tests/unit/permission-codegen-installer.test.ts tests/unit/phase0-starter-manifest.test.ts tests/unit/operation-ref-codegen.test.ts tests/unit/mcp-descriptor-boundary.test.ts`.
- Trellis build/lint/type/surface gates passed:
  `pnpm run build:module`, `pnpm run lint:src:core`,
  `pnpm run lint:tests`, `pnpm run test:types:public`,
  `pnpm run test:types:contracts`, `pnpm run check:publish-surface`, and
  `pnpm run check:docs:api-surface`.
- Formatting and whitespace checks passed:
  `pnpm run format:check` and `git diff --check`.
- Ginko CMS consumer proof passed using the new built CLI:
  `node /Users/matthias/Git/workspace/trellis/dist/cli.mjs operations generate ... --check --json`
  reported 16 operations, 28 projections, and no out-of-date generated files
  after one write.
- Ginko CMS behavior still passed after CLI-owned generated output:
  `pnpm vitest run test/component/entries/publish.test.ts` and
  `pnpm run typecheck`.

### Notes

- This is intentionally a direct command over the existing registry renderer,
  not a new configuration layer.
- Ginko can now put this exact command in package scripts once the CMS changes
  are ready to be committed, and CI can use `--check` to fail stale generated
  operation files.
- The next slice can use this durable generator while continuing to remove raw
  transport execute refs from Ginko tests and helpers.

## Slice 31: Ginko Publish Flow Uses Generated Testing Handles

### Proof

- Used the generated operation registry against the real Ginko CMS package-root
  output before changing behavior. The check command reported 16 operations, 28
  projections, and no stale generated files.
- Confirmed the archive entry operation already had a generated testing handle,
  while `test/component/entries/publish.test.ts` still called the raw
  `archiveEntryTransportExecute` transport mutation directly.
- Confirmed `archiveEntryTransportExecute` had no remaining test call sites
  after the cutover, so the archive-specific row in
  `destructiveTransportExecuteFunctionRefs` was dead helper protocol knowledge.

### Implementation

- In Ginko CMS commit `c1f30f2`, committed the Trellis-generated package-root
  operation files:
  `packages/convex/src/generated/operation-refs.ts` and
  `packages/convex/src/generated/operation-handles/testing.ts`.
- Added `operation(...)` support to the Ginko component test caller by delegating
  to Trellis testing's generated operation handle client.
- Migrated the publish component test's publish, unpublish, and archive paths to
  `owner.operation(operations.byId[...]).preview/execute(...)`.
- Removed the now-unused archive transport-execute translation map row from the
  Ginko test helper.

### Verification

- Ginko focused behavior proof passed:
  `pnpm vitest run test/component/entries/publish.test.ts` reported 10 passing
  tests.
- Ginko package type/build proof passed:
  `pnpm run typecheck`.
- Trellis generated-registry drift proof against Ginko passed:
  `node /Users/matthias/Git/workspace/trellis/dist/cli.mjs operations generate ... --check --json`
  reported status `ok`, 16 operations, 28 projections, and no out-of-date
  files.
- Ginko whitespace proof passed:
  `git diff --check`.

### Notes

- This is a hard consumer cutover for one vertical publish-flow test file, not a
  compatibility shim. The old archive transport helper mapping was deleted once
  no test needed it.
- Ginko still has direct transport execute calls in other component tests and
  still has translation-map rows for the operations those tests use. The next
  slices should continue migrating one destructive operation family at a time
  and delete each helper row as soon as its last caller is gone.
- The Trellis package itself has no runtime code change in this slice; the
  framework change was proven by the generated files and consumer test commit.

## Slice 32: Delete Dead Ginko Transport Helper Rows

### Proof

- Searched Ginko tests for the remaining transport execute helper map keys.
- Confirmed `deleteAssetTransportExecute`, `deleteSiteDataBlockTransportExecute`,
  and the already-cut-over `archiveEntryTransportExecute` had no test/helper
  call sites. They remained only as backend exports or generated Convex type
  entries.
- Kept the helper map rows that still have active direct transport callers:
  publish, unpublish, rollback, revert-draft-to-published, and delete-entry.

### Implementation

- In Ginko CMS commit `1c110df`, removed the unused
  `deleteAssetTransportExecute` and `deleteSiteDataBlockTransportExecute`
  translation rows from `test/helpers.ts`.

### Verification

- Ginko focused behavior proof passed:
  `pnpm vitest run test/component/assets.test.ts test/component/site-data.test.ts test/component/entries/publish.test.ts`
  reported 36 passing tests.
- Ginko package type/build proof passed:
  `pnpm run typecheck`.
- Trellis generated-registry drift proof against Ginko passed:
  `node /Users/matthias/Git/workspace/trellis/dist/cli.mjs operations generate ... --check --json`
  reported status `ok`, 16 operations, 28 projections, and no out-of-date
  files.
- Ginko whitespace proof passed:
  `git diff --check`.

### Notes

- This slice only deletes helper protocol knowledge that is already unused; it
  does not hide or shim the remaining transport execute paths.
- The next high-value Ginko migration target is a family with many active direct
  calls, likely publish/versioning or entry tree deletion, so the remaining map
  rows can continue shrinking from real caller removal rather than speculative
  cleanup.

## Slice 33: Ginko Operation Registry Check Gate

### Proof

- Added a first draft Ginko `operations:check` script and wired it into
  `pnpm run check`.
- The first full Ginko check failed before reaching the new operation check:
  `format:check` reported
  `packages/convex/src/generated/operation-handles/testing.ts`.
- Formatting that generated file showed Trellis was emitting long
  `defineOperationHandle(descriptor, { ... })` calls that `oxfmt` split across
  multiple lines. That would make generated files either format-clean or
  drift-clean, but not both.
- Also caught a pnpm argument-forwarding issue: `pnpm run operations:generate --
--check --json` passed a literal `--` to Trellis, so the CLI stayed in write
  mode. The working form is `pnpm run operations:generate --check --json`.

### Implementation

- In Trellis commit `1cdaf2a`, changed operation-handle generation to emit
  formatter-stable handle definitions. Short calls keep the existing single-line
  header; long calls use the same multi-line shape `oxfmt` expects.
- In Ginko CMS commit `c5e3e01`, added:
  - `operations:generate` as the canonical direct `trellis operations generate`
    command for the CMS Convex package-root output;
  - `operations:check` as `pnpm run operations:generate --check --json`;
  - `operations:check` inside root `pnpm run check` after `format:check`.
- Regenerated the Ginko testing handle file with the formatter-stable Trellis
  output.

### Verification

- Trellis focused codegen tests passed:
  `pnpm vitest run --project=unit tests/unit/operation-ref-codegen.test.ts tests/unit/operation-registry-codegen.test.ts tests/unit/cli-operations.test.ts`.
- Trellis build passed:
  `pnpm run build:module`.
- Trellis lint/format/type/surface checks passed:
  `pnpm run lint:src:core`, `pnpm run lint:tests`,
  `pnpm run format:check`, `pnpm run test:types:public`,
  `pnpm run test:types:contracts`, `pnpm run check:publish-surface`,
  `pnpm run check:docs:api-surface`, and `git diff --check`.
- Ginko's new operation check passed in real package-script form:
  `pnpm run operations:check` reported status `ok`, 16 operations, 28
  projections, and no out-of-date generated files.
- Full Ginko gate passed after wiring the check:
  `pnpm run check` reported 90 passing test files, 713 passing tests, and one
  skipped test.

### Notes

- This keeps the operation registry command in package scripts instead of
  adding a new Ginko config file or wrapper layer.
- The next Trellis improvement should make this command easier to install into
  generated/consumer projects, but the real consumer now has a drift gate.

## Slice 34: Shared Ginko Publish Operation Test Helpers

### Proof

- Inspected the remaining direct `TransportExecute` callers and chose
  `test/component/entries/read.test.ts` as the next safe slice: it had two raw
  publish transport calls and no rollback/delete coupling.
- Confirmed `test/component/entries/publish.test.ts` already had local
  generated-operation helpers for publish, unpublish, and archive. Keeping those
  local would duplicate the correct operation path as more entry tests migrate.
- Confirmed `entries/*.test.ts` import through their local `./helpers`, so the
  generated-operation helper had to be re-exported from
  `test/component/entries/helpers.ts` rather than only added to root
  `test/helpers.ts`.

### Implementation

- In Ginko CMS commit `5f1f635`, moved the publish, unpublish, and archive test
  operation wrappers into root `test/helpers.ts`, backed by
  `#component/generated/operation-handles/testing`.
- Re-exported those wrappers from `test/component/entries/helpers.ts`.
- Removed the duplicated local operation-handle constants and wrappers from
  `test/component/entries/publish.test.ts`.
- Migrated `test/component/entries/read.test.ts` from two raw
  `publishEntryTransportExecute` calls to the shared `publishEntry(...)`
  generated-operation helper.

### Verification

- Focused Ginko tests passed:
  `pnpm vitest run test/component/entries/publish.test.ts test/component/entries/read.test.ts`
  reported 16 passing tests.
- Ginko operation registry drift check passed:
  `pnpm run operations:check` reported status `ok`, 16 operations, 28
  projections, and no out-of-date files.
- Ginko package type/build proof passed:
  `pnpm run typecheck`.
- Full Ginko test suite passed:
  `pnpm run test` reported 90 passing test files, 713 passing tests, and one
  skipped test.
- Ginko lint and static guards passed:
  `pnpm run lint`.
- Formatting/whitespace checks passed:
  targeted `oxfmt --check` for the touched files and `git diff --check`.

### Notes

- The raw `TransportExecute` count in Ginko tests dropped from 60 to 58.
- The remaining publish transport helper map row is still required because
  public API, versioning, tree, draft, and integration tests still call
  `publishEntryTransportExecute` directly.
- The next high-leverage consumer slice is to migrate
  `test/component/integration.test.ts` or `test/component/entries/tree.test.ts`
  to the shared publish/unpublish helpers, then continue toward deleting the
  publish and unpublish map rows once their last callers are gone.

## Slice 35: Ginko Integration Lifecycle Uses Operation Helpers

### Proof

- Inspected `test/component/integration.test.ts`; it had three direct transport
  calls:
  two `publishEntryTransportExecute` calls and one
  `unpublishEntryTransportExecute` call.
- Confirmed the new shared helpers from Slice 34 covered the exact behavior:
  publish current draft, publish selected locales, and unpublish with
  preview/confirmation/execute.
- Confirmed no transport execute call remained in the integration test after
  the cutover.

### Implementation

- In Ginko CMS commit `89e25a7`, replaced the integration lifecycle's direct
  publish/unpublish transport mutations with `publishEntry(...)` and
  `unpublishEntry(...)`.
- Removed the now-unused `currentDraftVersion` import from the integration test.

### Verification

- Focused Ginko integration proof passed:
  `pnpm vitest run test/component/integration.test.ts` reported two passing
  tests.
- Ginko operation registry drift check passed:
  `pnpm run operations:check` reported status `ok`, 16 operations, 28
  projections, and no out-of-date files.
- Ginko package type/build proof passed:
  `pnpm run typecheck`.
- Ginko whitespace proof passed:
  `git diff --check`.

### Notes

- The raw `TransportExecute` count in Ginko tests dropped from 58 to 55.
- The publish and unpublish transport helper map rows are still required by
  public API, versioning, tree, and draft tests.
- The next natural consumer slice is `test/component/entries/tree.test.ts`
  because it can reuse the publish/unpublish helpers and start proving the
  delete-entry operation helper path.

## Slice 36: Ginko Tree Deletion Uses Operation Helpers

### Proof

- Inspected `test/component/entries/tree.test.ts`; it had six direct transport
  or preview refs in the tree lifecycle:
  publish, unpublish, four delete-entry transport executes, and direct
  `previewDeleteEntryOperation` calls.
- Confirmed generated testing handles include `ginko-cms.delete-entry` with
  execute and preview refs.
- Confirmed delete-entry operation args are exactly
  `{ entryId, exportArtifactId, assetMode? }`, so a narrow helper could wrap the
  operation without hiding domain behavior.

### Implementation

- In Ginko CMS commit `06257ab`, added shared `previewDeleteEntry(...)` and
  `deleteEntry(...)` helpers backed by
  `operations.byId['ginko-cms.delete-entry']`.
- Re-exported the delete helpers through `test/component/entries/helpers.ts`.
- Migrated tree tests from direct publish/unpublish/delete transport calls to
  shared operation helpers.
- Changed the blocked public-route delete case to assert the blocked preview
  state and then stop. That matches the intended operation workflow: blocked
  preview prevents execution instead of forcing a known-blocked destructive
  execute call.

### Verification

- Focused tree proof passed:
  `pnpm vitest run test/component/entries/tree.test.ts` reported 12 passing
  tests.
- Ginko operation registry drift check passed:
  `pnpm run operations:check` reported status `ok`, 16 operations, 28
  projections, and no out-of-date files.
- Ginko package type/build proof passed:
  `pnpm run typecheck`.
- Full Ginko test suite passed:
  `pnpm run test` reported 90 passing test files, 713 passing tests, and one
  skipped test.
- Ginko lint and static guards passed:
  `pnpm run lint`.
- Ginko whitespace proof passed:
  `git diff --check`.

### Notes

- The raw `TransportExecute` count in Ginko tests dropped from 55 to 49.
- The `entries/tree:deleteEntryTransportExecute` helper map row is still
  required by `test/component/backup.test.ts`.
- The next deletion-focused slice should migrate the two backup test delete
  calls, then delete the `deleteEntryTransportExecute` translation row from
  `test/helpers.ts`.

## Slice 37: Delete Ginko Delete-Entry Transport Mapping

### Proof

- After Slice 36, the only remaining `deleteEntryTransportExecute` test callers
  were in `test/component/backup.test.ts`.
- The first backup assertion was a missing-backup proof. In the operation model,
  that belongs to preview because the operation refuses to produce confirmation
  without a matching backup artifact.
- After migrating backup, `rg -n "deleteEntryTransportExecute" -S test
test/helpers.ts` had no matches except the candidate helper row before
  deletion.

### Implementation

- In Ginko CMS commit `645fe68`, migrated the backup missing-artifact assertion
  to `previewDeleteEntry(owner, { entryId })`.
- Migrated the successful permanent entry delete assertion to
  `deleteEntry(owner, { entryId, exportArtifactId })`.
- Relaxed only `previewDeleteEntry(...)` to allow an omitted
  `exportArtifactId`; `deleteEntry(...)` still requires an artifact for execute.
- Deleted the now-dead `entries/tree:deleteEntryTransportExecute` translation
  row from `test/helpers.ts`.

### Verification

- Focused Ginko backup/tree proof passed:
  `pnpm vitest run test/component/backup.test.ts test/component/entries/tree.test.ts`
  reported 20 passing tests.
- Ginko operation registry drift check passed:
  `pnpm run operations:check` reported status `ok`, 16 operations, 28
  projections, and no out-of-date files.
- Full Ginko test suite passed:
  `pnpm run test` reported 90 passing test files, 713 passing tests, and one
  skipped test.
- Ginko package type/build proof passed on a sequential rerun:
  `pnpm run typecheck`.
- Ginko lint and static guards passed:
  `pnpm run lint`.
- Formatting and whitespace checks passed:
  targeted `oxfmt --check` for touched files and `git diff --check`.

### Notes

- The raw `TransportExecute` count in Ginko tests dropped from 49 to 46.
- The delete-entry transport helper map row is gone. Remaining map rows are now
  publish, unpublish, rollback, and revert-draft-to-published.
- Next high-value slices are versioning rollback and draft revert, because each
  can remove another helper row once the corresponding tests are migrated.

## Slice 38: Preserve Generated Execute Forwarding Targets

### Proof

- Migrating Ginko versioning rollback tests to generated testing operation
  handles failed with
  `Invalid identity forwarding envelope: function-ref.`.
- The generated rollback execute ref stamped
  `functionRef: 'ginko-cms.rollback-version'`, but the operation declared
  `executeFunctionRef: 'entries/publish:rollbackVersionOperationExecute'`.
- Runtime target resolution already treats `executeFunctionRef` as canonical
  for operation execute forwarding, so the scanner/codegen path was the
  inconsistent source of truth.
- Added failing Trellis regression coverage for an execute projection that
  spreads the operation, overrides `id` to the operation id, and declares a real
  `executeFunctionRef`.

### Implementation

- In Trellis commit `c2acccf`, changed public-surface operation projection
  target derivation so execute projections prefer `operation.executeFunctionRef`
  before projection-local `id` overrides.
- Kept preview projection behavior unchanged: explicit preview `id` overrides
  still define the preview function target.
- Added scanner and registry-codegen tests proving generated execute refs and
  preview `executeFunctionRef` metadata use the real execute function target.
- Rebuilt Trellis before regenerating Ginko operation files from the local
  package.
- In Ginko CMS commit `fa4742b`, regenerated operation refs, added a shared
  `rollbackVersion(...)` test helper backed by
  `operations.byId['ginko-cms.rollback-version']`, migrated versioning tests
  away from rollback transport execute calls, and deleted the rollback transport
  helper map row.

### Verification

- The new Trellis regression tests failed before the implementation change with
  generated execute target `ginko-cms.rollback-version`.
- Focused Trellis codegen proof passed:
  `pnpm vitest run --project=unit tests/unit/public-surface-codegen.test.ts tests/unit/operation-registry-codegen.test.ts`
  reported 16 passing tests.
- Adjacent Trellis CLI/codegen proof passed:
  `pnpm vitest run --project=unit tests/unit/cli-operations.test.ts tests/unit/permission-codegen-installer.test.ts tests/unit/phase0-starter-manifest.test.ts`
  reported 9 passing tests.
- Trellis package build passed: `pnpm run build:module`.
- Trellis lint, type, and API-surface gates passed:
  `pnpm run lint:src:core`, `pnpm run lint:tests`,
  `pnpm run test:types:public`, `pnpm run test:types:contracts`,
  `pnpm run check:publish-surface`, and
  `pnpm run check:docs:api-surface`.
- Ginko operation generation and drift check passed:
  `pnpm run operations:generate && pnpm run operations:check` reported 16
  operations, 28 projections, and no out-of-date files after regeneration.
- Focused Ginko rollback proof passed:
  `pnpm vitest run test/component/entries/versioning.test.ts` reported 5
  passing tests.
- Full Ginko package proof passed: `pnpm run typecheck`.
- Full Ginko test suite passed:
  `pnpm run test` reported 90 passing test files, 713 passing tests, and one
  skipped test.
- Ginko lint and static guards passed: `pnpm run lint`.
- Whitespace checks passed with `git diff --check` in both repos and targeted
  Trellis `oxfmt --check` for the touched source/test files.

### Notes

- A parallel verification attempt briefly failed `cli-operations.test.ts`
  because `pnpm run build:module` cleaned `dist` while the CLI test was running.
  The same CLI/codegen tests passed when rerun sequentially after the build.
- The raw `TransportExecute` count in Ginko tests dropped from 46 to 36.
- The rollback transport helper map row is gone. Remaining test helper map rows
  are publish, unpublish, and revert-draft-to-published.
- The next high-value migration slice is draft revert, because it can delete the
  remaining draft transport helper map row and further prove destructive
  confirmation handling through generated operation handles.

## Slice 39: Delete Ginko Draft-Revert Transport Mapping

### Proof

- After Slice 38, `entries/draft:revertDraftToPublishedTransportExecute` was
  still present only as a test-helper transport translation row and one direct
  caller in `test/component/entries/draft.test.ts`.
- Generated Ginko operation refs already had the correct execute and preview
  metadata for `ginko-cms.revert-draft-to-published`, including
  `executeFunctionRef: 'entries/draft:revertDraftToPublishedOperationExecute'`.
- That meant the draft revert migration should be a consumer test/helper
  cutover, not another Trellis generator change.

### Implementation

- In Ginko CMS commit `d11aa83`, added a shared
  `revertDraftToPublished(...)` test helper backed by
  `operations.byId['ginko-cms.revert-draft-to-published']`.
- Re-exported the helper through `test/component/entries/helpers.ts`.
- Migrated the draft revert test from direct transport execution to the
  generated operation helper.
- Replaced nearby draft-test publish/unpublish transport calls with the existing
  `publishEntry(...)` and `unpublishEntry(...)` helpers so the file no longer
  exercises transport execute paths for those workflows.
- Deleted the now-dead
  `entries/draft:revertDraftToPublishedTransportExecute` translation row from
  `test/helpers.ts`.

### Verification

- Focused Ginko draft proof passed:
  `pnpm vitest run test/component/entries/draft.test.ts` reported 16 passing
  tests.
- Ginko operation registry drift check passed:
  `pnpm run operations:check` reported status `ok`, 16 operations, 28
  projections, and no out-of-date files.
- Ginko package type/build proof passed: `pnpm run typecheck`.
- Ginko lint and static guards passed: `pnpm run lint`.
- Full Ginko test suite passed:
  `pnpm run test` reported 90 passing test files, 713 passing tests, and one
  skipped test.
- Ginko whitespace proof passed: `git diff --check`.

### Notes

- The raw `TransportExecute` count in Ginko tests dropped from 36 to 28.
- The draft-revert transport helper map row is gone. Remaining test helper map
  rows are publish and unpublish.
- The next high-value migration slice is public API publish/unpublish coverage,
  because that file contains most remaining direct publish transport calls.

## Slice 40: Remove Ginko Test Transport Execute Helper Path

### Proof

- After Slice 39, all remaining direct test transport execute callers were in
  `test/component/public-api.test.ts`.
- Those calls were happy-path publish executions using the current draft version
  and either `['en']` or `['en', 'de']` locales. None tested stale-version or
  transport-specific failure behavior.
- The only remaining transport helper map rows were publish and unpublish, so
  migrating the public API callers would make the translation map an empty
  compatibility path.

### Implementation

- In Ginko CMS commit `8f982e1`, migrated public API publish setup from
  `publishEntryTransportExecute` calls to the generated-operation-backed
  `publishEntry(...)` helper.
- Preserved explicit two-locale publishes with `publishEntry(owner, entryId,
['en', 'de'])`.
- Deleted the now-empty `destructiveTransportExecuteFunctionRefs` test helper
  map.
- Removed the caller helper branch that treated `*TransportExecute` mutation
  names as `operation-execute`; destructive operation executes now go through
  generated operation handles instead.

### Verification

- Focused Ginko public API proof passed:
  `pnpm vitest run test/component/public-api.test.ts` reported 29 passing tests.
- Ginko operation registry drift check passed:
  `pnpm run operations:check` reported status `ok`, 16 operations, 28
  projections, and no out-of-date files.
- Ginko package type/build proof passed: `pnpm run typecheck`.
- Ginko lint and static guards passed: `pnpm run lint`.
- Full Ginko test suite passed:
  `pnpm run test` reported 90 passing test files, 713 passing tests, and one
  skipped test.
- Ginko whitespace proof passed: `git diff --check`.
- Transport invariant check passed:
  `rg -n "TransportExecute|publishEntryTransportExecute|unpublishEntryTransportExecute" test test/helpers.ts`
  now reports only negative bridge assertions in `test/shared/mcp-tools.test.ts`.

### Notes

- Direct test calls to transport execute helpers are gone.
- The test caller no longer contains a transport execute translation map or an
  `endsWith('TransportExecute')` replay-mode branch.
- Remaining work has moved from operation-helper migration to removing or
  replacing production transport execute exports if they are no longer needed by
  generated/public bridge surfaces.

## Slice 41: Delete Ginko Production Transport Execute Projections

### Proof

- After Slice 40, `rg` showed no non-test callers for Ginko production
  `*TransportExecute` exports. Bridge code already referenced
  `*OperationExecute` and preview operation refs.
- `packages/convex/src/_generated/component.ts` still advertised transport
  execute functions only because the production exports still existed.
- Generated operation handles originally lived under
  `packages/convex/src/generated/operation-handles`, which Convex codegen
  rejects because hyphenated path components are not valid Convex module paths.
- Moving the generated operation files to `packages/convex/src/generated` with
  Convex-safe names let Convex codegen run, but then `_generated/api.ts`
  imported `operationRefs`, and `operationRefs` imported `api`, creating a
  circular type surface.
- The stable layout is `packages/convex/generated`: tracked generated
  operation metadata outside Convex `src`, imported only by tests, with Convex
  codegen owning `packages/convex/src/_generated`.

### Implementation

- In Ginko CMS commit `2841175`, deleted all production transport execute
  projections:
  `deleteAssetTransportExecute`, `deleteSiteDataBlockTransportExecute`,
  `deleteEntryTransportExecute`, `publishEntryTransportExecute`,
  `unpublishEntryTransportExecute`, `archiveEntryTransportExecute`,
  `rollbackVersionTransportExecute`, and
  `revertDraftToPublishedTransportExecute`.
- Removed `callerTransportMutation` and `callerInternalTransportMutation` from
  the component runtime exports.
- Regenerated Convex component types so the public component API no longer
  exposes transport execute functions.
- Moved generated operation refs and testing handles from
  `packages/convex/src/generated/...` to `packages/convex/generated/...`.
- Updated `pnpm run operations:generate` to write operation metadata outside
  Convex `src` and import Convex API refs through
  `../src/_generated/api.js`.
- Updated test helpers to import generated operation handles from the new
  package-local generated path.

### Verification

- Initial `pnpm --filter @lupinum/ginko-cms-convex prepare:component` failed on
  `src/generated/operation-handles/testing.ts` because Convex disallows
  hyphenated module path components.
- Retrying with `src/generated/operationRefs.ts` and
  `src/generated/operationHandles/testing.ts` made component codegen pass but
  `pnpm run typecheck` failed with circular `_generated/api.ts` references.
- Final layout under `packages/convex/generated` passed:
  `pnpm run operations:generate && pnpm run operations:check`.
- Convex component codegen passed:
  `pnpm --filter @lupinum/ginko-cms-convex prepare:component`.
- Ginko format, type, lint, and static gates passed:
  `pnpm run format:check`, `pnpm run typecheck`, and `pnpm run lint`.
- Full Ginko test suite passed:
  `pnpm run test` reported 90 passing test files, 713 passing tests, and one
  skipped test.
- Whitespace and transport-source invariant checks passed:
  `git diff --check` and
  `rg -n "TransportExecute|callerTransportMutation|callerInternalTransportMutation|transportExecute" packages/convex/src packages/cms/src scripts test --glob '!**/dist/**'`
  now report only MCP bridge negative assertions and one MCP project-tool mock.

### Notes

- Ginko no longer has direct test callers, test helper translation maps, or
  production Convex exports for transport execute paths.
- The remaining `transportExecuteOperationRef` symbol is Trellis API/test
  surface and a Ginko MCP project-tool mock; no Ginko production Convex function
  uses it.
- The next hard-cut cleanup should be in Trellis: decide whether
  `transportExecuteOperationRef` remains useful as a public API now that the
  only consumer moved to operation execute refs.

## Slice 42: Remove Trellis Transport Execute Ref Alias

### Proof

- Ginko CMS no longer has production transport execute projections, test helper
  translation maps, or direct test callers for `*TransportExecute`.
- `transportExecuteOperationRef(...)` was only a public alias for
  `projectOperationRef(operation, 'execute', ref, options)`. It did not encode
  different runtime semantics from `executeOperationRef(...)`.
- Transport confirmation remains modeled by `tool.operation(..., {
confirmationMode: 'transport' })` and the transport mutation lane, so a
  separate public execute-ref helper had become a second name for the same
  projection fact.
- A wide source search after implementation confirmed no exact
  `transportExecuteOperationRef` reference remains in Trellis source, tests,
  examples, docs, scripts, security contract, README, or changelog. Only
  historical journal/review notes still mention the old symbol.

### Implementation

- Removed `transportExecuteOperationRef(...)` from operation metadata and all
  public re-export entrypoints.
- Updated transport-mutation tests to use `executeOperationRef(...)` while
  preserving transport lane runtime coverage.
- Removed the helper from MCP entrypoint export expectations.
- Updated component mini-CMS example MCP binding and source assertions to use
  `executeOperationRef(...)`.
- Updated docs, skill references, security source policy, and regenerated the
  security contract so public surfaces no longer advertise or police the
  removed alias.
- In Ginko CMS companion commit `4b8ba2b`, deleted the stale
  `transportExecuteOperationRef` mock and stale negative string assertion.

### Verification

- Trellis focused unit proof passed:
  `pnpm vitest run --project=unit tests/unit/functions-defineTrellis.test.ts tests/unit/mcp-index-exports.test.ts tests/unit/mcp-operation-binding.test.ts tests/unit/security-contract.test.ts`
  reported 4 passing test files and 86 passing tests.
- Trellis security policy and generated contract checks passed:
  `pnpm run check:security:source-policy` and
  `pnpm run check:security:contract`.
- Trellis docs API surface check passed: `pnpm run check:docs:api-surface`.
- Trellis build and public type surface checks passed:
  `pnpm run build:module`, `pnpm run check:publish-surface`,
  `pnpm run test:types:public`, and `pnpm run test:types:contracts`.
- Trellis lint/format gates passed:
  `pnpm run format:check`, `pnpm run lint:src:runtime:functions-mcp`,
  `pnpm run lint:src:runtime:rest`, `pnpm run lint:tests`, and
  `pnpm run lint:examples`.
- Trellis full security gate passed: `pnpm run test:security` reported 26
  passing test files and 293 passing tests.
- Trellis tarball was refreshed with `pnpm pack --pack-destination .pack`.
- Ginko focused consumer proof passed:
  `pnpm vitest run test/runtime/mcp-project-tool.test.ts test/shared/mcp-tools.test.ts`
  reported 2 passing test files and 18 passing tests.
- Ginko generated operation drift check passed: `pnpm run operations:check`
  reported 16 operations, 28 projections, and no out-of-date files.
- Ginko static gates passed: `pnpm run format:check`, `pnpm run lint`, and
  `pnpm run typecheck`.
- Ginko full test suite passed on a serial rerun:
  `pnpm run test` reported 90 passing test files, 713 passing tests, and one
  skipped test.
- Whitespace checks passed in both repos: `git diff --check`.

### Notes

- An initial Ginko full test run failed while Trellis `test:security` was
  concurrently rebuilding and cleaning the linked local `dist`. Manual Node
  import checks for `@lupinum/trellis/backend` from both Ginko and
  `packages/trellis-bridge` succeeded after the rebuild, and the serial Ginko
  rerun passed.
- Exact `transportExecuteOperationRef` source references are now gone from the
  active Trellis and Ginko code paths. Remaining `TransportExecute` references
  in Trellis are historical RFC 0012 text and registry fixtures that prove
  ignored legacy projection roots stay ignored.
- This removes one duplicated public helper but does not complete RFC 0013.
  The next hard-cut slice should replace manual MCP execute/preview binding in
  normal examples with generated operation handles.

## Slice 43: Canonicalize Public Read Operation Projections

### Proof

- Example 08 still used `query.public({ ...operation, reads: [...] })` for public
  read projections. That keeps projection metadata split between the operation
  object and a wrapper object literal.
- A scratch `trellis operations generate` run against the component mini-CMS
  initially failed on that shape when projection roots were configured for the
  component scan, so the spread form was getting in the way before the real
  bridge/component projection issues could be isolated.
- Public read tables are part of the backend lane definition. For greenfield
  operation-first code, the simpler source of truth is the operation definition
  itself, projected directly with `query.public(operation)`.

### Implementation

- Moved `reads: ['pages']` onto the `pages.list-published` and
  `pages.get-published` operation definitions in example 08.
- Changed their Convex projections from spread object literals to direct
  `query.public(operation)` calls.
- Updated public-surface codegen tests to teach the canonical direct public-read
  projection shape.
- Updated the beginner app operation runtime test to register a public query
  operation directly rather than through a spread wrapper.

### Verification

- Focused Trellis scanner/runtime tests passed:
  `pnpm vitest run --project=unit tests/unit/public-surface-codegen.test.ts tests/unit/functions-defineTrellis.test.ts`
  reported 2 passing test files and 78 passing tests.
- Example 08 test passed:
  `pnpm --dir examples/08-component-mini-cms test` reported one passing test
  file and 10 passing tests.
- Example 08 typecheck passed:
  `pnpm --dir examples/08-component-mini-cms typecheck`.
- Whitespace check passed: `git diff --check`.

### Notes

- This slice intentionally does not broaden the scanner to understand more
  object-spread projections. The RFC wants the supported grammar to stay small.
- The next scratch generation attempt for example 08 now gets past the public
  read spread issue and fails at the next real boundary:
  `convex/components/miniCms/features/pages/index.ts:2` re-exports
  `previewPublish`. Re-exported operation projections are intentionally
  unsupported.
- The same scratch output also proves the larger bridge problem: generated refs
  for component-local projections target component paths, while MCP tools need
  host bridge wrapper refs. That should be handled by an explicit bridge or
  component projection contract rather than by scanner inference.

## Slice 44: Generate Component Bridge MCP Handles From Host Projections

### Proof

- After Slice 43, scanning example 08 component projections directly exposed the
  wrong authority boundary: generated operation refs pointed at
  `api.components...`, while MCP callers need host bridge projections that carry
  the host app forwarding proof.
- Component-local projections are implementation internals. Letting the default
  app scanner infer from `convex/components/**` would create a second candidate
  execute path for the same operation id and make the registry choose by file
  layout instead of authority.
- The component barrel re-export of `previewPublish` also proved that the
  scanner should stay strict. Re-exported projection tracing remains unsupported
  because it hides the projection lane and target from the local source file.
- The safe bridge shape is explicit: host files export scanner-readable wrapper
  projections whose inner lane call is a real Convex query, mutation, or action.
  The generated handle then binds MCP to the host projection, not the component
  implementation.
- Enabling operation aliases in Nuxt exposed two type gaps before runtime:
  `permissions: { codegen: true }` needed to be valid without an access-context
  query, and wrapped projection exports needed to preserve their Convex function
  reference type.

### Implementation

- Added a default operation codegen exclude for `convex/components/**`, keeping
  component internals out of app operation registries unless a caller opts in.
- Extended public-surface codegen to recognize explicit
  `executeOperationRef(...)` and `previewOperationRef(...)` projection wrappers
  around direct lane calls or same-file projection aliases.
- Moved example 08 page operation descriptors into
  `shared/features/pages/operations.ts` so host and component code share a
  runtime-neutral contract instead of importing implementation operations across
  the boundary.
- Rewrote component implementations to use `implementOperation(...)` against the
  shared descriptors, leaving component-local lane exports as internals.
- Rewrote host page bridge exports as typed projection aliases wrapped with
  `executeOperationRef(...)` / `previewOperationRef(...)`, preserving scanner
  metadata and Convex function ref types.
- Deleted the root browser `publish` mutation. The single host execute
  projection for `pages.publish` is now `publishAction`.
- Wired example 08 `defineTrellis(...)` to the generated
  `operationProjectionRegistry` and enabled Nuxt permission/operation codegen.
- Hard-cut example 08 MCP page tools to generated
  `#trellis/operations/mcp` handles. They no longer import component operation
  implementations, component APIs, or handwritten operation refs.
- Updated tests to assert the generated host action/preview refs, absence of
  component API refs in MCP tools, and sync of the tracked operation projection
  registry.

### Verification

- Touched-code format check passed:
  `pnpm exec oxfmt --check src/module-internals/options.ts src/module-internals/public-surface-codegen.ts examples/08-component-mini-cms/convex/functions.ts examples/08-component-mini-cms/convex/features/pages/domain.ts examples/08-component-mini-cms/convex/features/pages/index.ts examples/08-component-mini-cms/convex/components/miniCms/features/pages/domain.ts examples/08-component-mini-cms/convex/components/miniCms/features/pages/index.ts examples/08-component-mini-cms/convex/components/miniCms/features/pages/operations.ts examples/08-component-mini-cms/shared/features/pages/operations.ts examples/08-component-mini-cms/server/mcp/tools/create-page.ts examples/08-component-mini-cms/server/mcp/tools/save-draft.ts examples/08-component-mini-cms/server/mcp/tools/publish-page.ts examples/08-component-mini-cms/test/componentMiniCms.test.ts tests/unit/mcp-descriptor-boundary.test.ts tests/unit/operation-registry-codegen.test.ts tests/unit/public-surface-codegen.test.ts`.
- Whitespace check passed: `git diff --check`.
- Focused scanner/registry/install tests passed:
  `pnpm vitest run --project=unit tests/unit/public-surface-codegen.test.ts tests/unit/operation-registry-codegen.test.ts tests/unit/mcp-descriptor-boundary.test.ts tests/unit/permission-codegen-installer.test.ts`
  reported 4 passing test files and 26 passing tests.
- Module build passed: `pnpm run build:module`.
- Source, test, and example lint passed:
  `pnpm run lint:src:core`, `pnpm run lint:tests`, and
  `pnpm run lint:examples`.
- Example 08 tests passed:
  `pnpm --dir examples/08-component-mini-cms test` reported one passing test
  file and 10 passing tests.
- Example 08 typecheck passed:
  `pnpm --dir examples/08-component-mini-cms typecheck`.
- Nuxt-generated operation files are in sync:
  `node dist/cli.mjs operations generate --cwd examples/08-component-mini-cms --operation-refs .nuxt/trellis/operation-refs.ts --operation-handles .nuxt/trellis/operation-handles/mcp.ts --operation-projections .nuxt/trellis/operation-projections.ts --project-operation-ref-import '#trellis/operation-runtime' --define-operation-handle-import '#trellis/operation-runtime' --api-import '#trellis/api' --runtime mcp --check --json`
  returned `status: "ok"`.
- The tracked host Convex projection registry is in sync:
  `node dist/cli.mjs operations generate --cwd examples/08-component-mini-cms --operation-refs .nuxt/trellis/operation-refs.ts --operation-handles .nuxt/trellis/operation-handles/mcp.ts --operation-projections generated/operation-projections.ts --project-operation-ref-import '#trellis/operation-runtime' --define-operation-handle-import '#trellis/operation-runtime' --api-import '#trellis/api' --runtime mcp --check --json`
  returned `status: "ok"`.

### Notes

- This is still an explicit advanced bridge shape, not arbitrary TypeScript
  inference. The scanner accepts a small wrapper grammar and rejects hidden
  re-export/dynamic forms.
- `executeOperationRef(...)` and `previewOperationRef(...)` remain advanced
  backend metadata helpers. The normal MCP surface now imports generated handles.
- The root publish mutation deletion is intentional: keeping both mutation and
  action execute projections would leave two host execute paths for
  `pages.publish`.
- `dream-spec.md` has unrelated local changes and was left out of this slice.

## Slice 45: Resolve Generated Testing Handles In Convex Vitest Config

### Proof

- The testing runtime already had `caller.operation(operationHandle)` support,
  but real example tests could not import the generated testing handle module.
- Updating example 07 to import `#trellis/operations/testing` initially failed
  in Vitest with `Cannot find module '#trellis/operations/testing'` even after
  `nuxi prepare` generated `.nuxt/trellis/operation-handles/testing.ts`.
- The failure was a resolver boundary: Nuxt knew the virtual alias, but
  `convexTestConfig()` did not pass the generated Trellis aliases into Vitest.
  Asking every app test config to recreate those aliases would be another
  framework protocol map.
- Once the alias resolved, example 07 exposed a separate service-boundary drift:
  the webhook service allowed an old handler function ref while the operation
  registry and forwarded envelope now use the canonical operation id
  `runbooks.create-from-webhook`.

### Implementation

- Added generated Trellis operation aliases to `convexTestConfig()`:
  `#trellis/api`, `#trellis/operation-runtime`,
  `#trellis/operation-projections`, and all
  `#trellis/operations/{client,server,testing,mcp}` paths.
- Preserved caller alias overrides by merging generated object aliases before
  existing object aliases, and by appending generated aliases after existing
  array aliases.
- Added a unit assertion that `convexTestConfig()` resolves the generated
  operation testing alias into `.nuxt/trellis/operation-handles/testing.ts`.
- Hard-cut example 07 runbook-create tests to
  `ctx.asUser(...).operation(operations.runbooks.create).execute(...)` via
  `#trellis/operations/testing`.
- Removed the caller-authored replay/transport options from the forwarded-user
  helper used by that operation path.
- Removed the stale webhook service `allowedFunctionRefs` entry and kept
  `allowedOperations: ['runbooks.create-from-webhook']` as the service target
  authority.
- Kept webhook test forwarding explicit and signed to
  `targetFunctionRef: 'runbooks.create-from-webhook'` because webhook routes are
  still an explicit service/transport boundary, not a normal product operation
  test path.

### Verification

- Format check passed for touched files:
  `pnpm exec oxfmt --check src/runtime/testing/index.ts tests/unit/testing.test.ts examples/07-mcp-reference/test/mcpReference.test.ts examples/07-mcp-reference/convex/auth/services.ts`.
- Whitespace check passed: `git diff --check`.
- Testing runtime unit tests passed:
  `pnpm vitest run --project=unit tests/unit/testing.test.ts` reported one
  passing test file and 3 passing tests.
- Example 07 test suite passed:
  `pnpm --dir examples/07-mcp-reference test` reported 3 passing test files and
  20 passing tests.
- Relevant lint gates passed:
  `pnpm run lint:src:runtime:rest`, `pnpm run lint:tests`, and
  `pnpm run lint:examples`.
- Module build passed: `pnpm run build:module`.
- Public type surface passed: `pnpm run test:types:public`.

### Notes

- `pnpm --dir examples/07-mcp-reference typecheck` still fails on existing
  example handler ctx annotations that type `workspaceId` as branded
  `Id<'workspaces'>` while the Trellis workspace lane exposes `workspaceId` as
  `string`. This is a real follow-up, but it is broader than the generated
  testing-handle resolver slice.
- This slice intentionally does not hide webhook service transport proof behind
  the product operation test helper. Server/webhook adapters stay explicit until
  the RFC server-route adapter slice gives them a generated operation boundary.

## Slice 46: Type Branded Workspace Operation Lanes

### Proof

- Example 07 had become runtime-green but not type-green:
  `pnpm --dir examples/07-mcp-reference typecheck` failed on workspace
  operations whose handlers used the app's branded Convex `Id<'workspaces'>`.
- Rebuilding the module first was necessary because example typecheck consumes
  Trellis through package exports and generated Nuxt declarations, not directly
  from source files.
- After rebuilding, the failure reduced to two framework type leaks:
  workspace lane ctx typed `workspaceId` as plain `string`, and app-authored
  permission/scoped operations inferred a `never` caller/app identity guard
  context even though authenticated/workspace lanes inject the real guard at
  registration time.
- Example 07 also still had an old raw unsafe bootstrap registration:
  `mutation.unsafe(createWorkspaceOp)`. That was a second path for an operation
  that already declares a signed caller and explicit cross-tenant capability.

### Implementation

- Derived workspace lane `ctx.workspaceId` from the configured app identity
  shape instead of hardcoding it to `string`.
- Applied the same actor-derived workspace id typing inside `workspaceScope()`
  operation wrappers.
- Updated operation definition inference so app-authored permission/scoped
  operations use the authenticated guard shape internally for handler/load
  narrowing, without exposing a caller-authored `guard` property to
  authenticated/workspace lanes.
- Changed operation principal fallback from `never` to `unknown` when an
  operation handler does not care about `ctx.caller()`, allowing the lane's real
  caller type to flow in at registration time.
- Carried descriptor-owned permission metadata into descriptor-bound operation
  types.
- Hard-cut example 07 workspace bootstrap from raw unsafe registration to
  `mutation.authenticated(createWorkspaceOp)` and removed the stale unsafe
  permit metadata.
- Added a type regression proving a branded workspace operation can be accepted
  by `defineTrellis(...).query.workspace(...)`.

### Verification

- Module build passed: `pnpm run build:module`.
- Example 07 typecheck passed:
  `pnpm --dir examples/07-mcp-reference typecheck`.
- Type contract checks passed: `pnpm run test:types:contracts`.
- Public type surface passed: `pnpm run test:types:public`.
- Focused operation/runtime unit tests passed:
  `pnpm vitest run --project=unit tests/unit/operation-descriptor.test.ts tests/unit/functions-defineTrellis.test.ts`
  reported 2 passing test files and 78 passing tests.
- Example 07 test suite passed:
  `pnpm --dir examples/07-mcp-reference test` reported 3 passing test files and
  20 passing tests.
- Format check passed for touched files:
  `pnpm exec oxfmt --check src/runtime/functions/index.ts src/runtime/app/index.ts src/runtime/functions/define-operation.ts examples/07-mcp-reference/convex/features/workspaces/domain.ts tests/types/dx-typing.types.ts`.
- Whitespace check passed: `git diff --check`.
- Relevant lint gates passed:
  `pnpm run lint:src:runtime:functions-mcp`,
  `pnpm run lint:src:runtime:rest`, `pnpm run lint:tests`, and
  `pnpm run lint:examples`.

### Notes

- The bootstrap operation still performs an intentional cross-tenant write, but
  the authority is now its declared `crossTenant` capability plus the
  authenticated lane. It is no longer registered through the raw unsafe escape
  hatch.
- The operation inference change does not reintroduce guard authoring on
  explicit lanes. The inferred guard exists only for operation handler type
  narrowing; lane builders still reject `guard` on authenticated/workspace
  definitions.
- `pnpm --dir examples/07-mcp-reference typecheck` is now a usable acceptance
  gate for the MCP reference app again.

## Slice 47: Audit Remaining Raw Unsafe Example Entrypoints

### Proof

- Searched maintained examples, CLI fixtures, runtime source, and tests for raw
  unsafe registrations and unsafe permits:
  `rg -n "\\.unsafe\\(|unsafe\\.(query|mutation|action)|unsafe as unsafePermit|permit:\\s*unsafe|unsafe\\.permit|unsafePermit" examples src/cli/starter-fixtures tests/fixtures src -g'*.ts'`.
- Searched operation registrations in maintained MCP/component fixtures to catch
  stale operation objects routed through raw unsafe lanes:
  `rg -n "mutation\\.authenticated\\(|mutation\\.workspace\\(|query\\.workspace\\(|operation\\.mutation\\(|operation\\.query\\(" src/cli/starter-fixtures examples/07-mcp-reference examples/08-component-mini-cms tests/fixtures -g'*.ts'`.
- The only maintained product/fixture raw unsafe handlers found are upload URL
  generation in example 04 and the `add uploads` fixture.

### Implementation

- No source conversion was needed. The remaining raw unsafe handlers are not
  operation-backed product actions; they generate Convex upload URLs before a
  concrete tenant-scoped record exists.
- Kept their explicit `unsafe.permit(...)` metadata and comments because they
  are intentional escape hatches with reviewable scope.
- Confirmed the stale example 07 bootstrap pattern removed in Slice 46 was the
  only operation object still registered through `mutation.unsafe(...)`.

### Verification

- Search results show no operation-backed example/starter registration remains
  on a raw unsafe lane.
- Existing checks from Slice 46 already covered the touched type/runtime surface
  after deleting the stale example 07 unsafe bootstrap registration.

### Notes

- Keeping upload URL generation as raw unsafe is the simpler correct model for
  now. Turning it into an operation would add a product operation boundary around
  a storage URL primitive without a tenant record to authorize yet.
- If Trellis later introduces a first-class upload lane, this should be revisited
  as a hard cutover rather than a compatibility wrapper.

## Slice 48: Maintained Example Typecheck Sweep

### Proof

- Ran the broader maintained-example typecheck sweep after example 07 became
  type-green again.
- Example 01 initially failed because `publicWrite.access` receives an
  intentionally restricted database capability typed as `unknown`; the public
  todo example was using it as a raw Convex writer.
- Example 06 initially failed while Nuxt generated Trellis operation artifacts:
  the operation registry rejected re-exported operation projections from feature
  barrels such as `convex/features/memberships/index.ts`.
- App and test call sites in example 06 already use direct Convex function
  modules such as `api.features.projects.domain.list`, so the barrel exports
  were only duplicate projection surfaces.

### Implementation

- Narrowed example 01 public-write access locally to `MutationCtx['db']` inside
  each declared `publicWrite.access` block.
- Removed example 06 barrel re-exports for Convex projection functions from the
  dashboard, memberships, projects, and workspaces feature indexes.
- Kept feature, permission, schema, and type exports in those barrels because
  they remain normal composition imports rather than operation projection
  surfaces.

### Verification

- Module build passed: `pnpm run build:module`.
- Maintained example typechecks passed:
  `pnpm --dir examples/01-public-todo typecheck`,
  `pnpm --dir examples/02-auth-todo typecheck`,
  `pnpm --dir examples/03-team-workspace typecheck`,
  `pnpm --dir examples/04-saas-platform typecheck`,
  `pnpm --dir examples/05-visibility-access typecheck`,
  `pnpm --dir examples/06-multi-workspace typecheck`,
  `pnpm --dir examples/07-mcp-reference typecheck`, and
  `pnpm --dir examples/08-component-mini-cms typecheck`.
- Focused example tests passed:
  `pnpm --dir examples/01-public-todo test` reported one passing test file and
  one passing test; `pnpm --dir examples/06-multi-workspace test` reported one
  passing test file and 5 passing tests.
- Format check passed for touched files:
  `pnpm exec oxfmt --check examples/01-public-todo/convex/features/todos/domain.ts examples/06-multi-workspace/convex/features/memberships/index.ts examples/06-multi-workspace/convex/features/projects/index.ts examples/06-multi-workspace/convex/features/workspaces/index.ts examples/06-multi-workspace/convex/features/dashboard/index.ts`.
- Example lint passed: `pnpm run lint:examples`.
- Whitespace check passed: `git diff --check`.
- Source scan found no remaining example 06 barrel projection exports:
  `rg -n "export \\{ .*\\} from './domain'|export \\{ .*\\} from \\\"./domain\\\"" examples/06-multi-workspace/convex/features -g 'index.ts'`.

### Notes

- This keeps the operation registry fail-closed. Supporting projection
  re-export chasing would add a second projection authoring path and weaken the
  direct-module invariant the scanner now enforces.
- The example 01 change preserves the restricted public-write boundary: Trellis
  still exposes only the declared table capability, while the app fixture
  narrows to its local Convex writer type at the access edge.

## Slice 49: Ginko Workflow Handles And Guarded Backend Operation Typing

### Proof

- While cutting the Ginko workflow vertical slice over to generated testing
  operation handles, `pnpm run typecheck` in Ginko CMS exposed a Trellis type
  inference bug: backend operations with a caller/app-identity guard were
  inferred as guardless when spread into protected lane registration.
- The root cause was `defineOperation(...)` guard inference looking for a
  required `guard` property. Generic operation definitions carry `guard` as an
  optional own property, so guarded backend operations collapsed to the
  guardless branch and produced `guard?: never` / `undefined` conflicts.
- The Ginko workflow test also still used local protocol knowledge for ordinary
  product operations: create/save calls were routed through a function-ref map,
  and destructive publish/unpublish/archive/rollback helpers manually paired
  preview/execute Convex refs plus `_confirmationToken`.

### Implementation

- Updated backend operation type inference to derive an optional own structured
  guard through `InferOwnOperationGuard<TDefinition>`.
- Kept permission/scoped fallback inference intact: operations without their own
  guard still infer the authenticated guard shape when they declare permission
  or scope metadata.
- Added a type regression for a guarded backend operation using
  `defineGuard<AppIdentity>(...)` and `defineOperation(...)`.
- Updated Ginko's workflow vertical slice to import generated testing handles
  from `packages/convex/generated/operationHandles/testing`.
- Routed create, save draft, publish, unpublish, archive, and rollback through
  `owner.operation(operations.byId[...])`.
- Removed the workflow test's local public-surface forwarding map and
  `executeConfirmedOperation(...)` helper.

### Verification

- Trellis format check passed:
  `pnpm exec oxfmt --check src/runtime/functions/define-operation.ts tests/types/dx-typing.types.ts`.
- Trellis type contracts passed: `pnpm run test:types:contracts`.
- Trellis public type surface passed: `pnpm run test:types:public`.
- Trellis module build passed: `pnpm run build:module`.
- Ginko workflow format check passed:
  `pnpm exec oxfmt --check test/refactor/workflow-vertical-slice.test.ts`.
- Ginko workflow vertical test passed:
  `pnpm vitest run test/refactor/workflow-vertical-slice.test.ts` reported one
  passing test file and 28 passing tests.
- Ginko generated operation artifacts were current:
  `pnpm run operations:check` reported status `ok`, 16 operations, 28
  projections, and no out-of-date files.
- Ginko typecheck passed: `pnpm run typecheck`.
- Whitespace checks passed in both repos: `git diff --check`.

### Notes

- This preserves the hard-cut lane model. The fix only recognizes a backend
  operation's own structured guard for descriptor typing; explicit lane
  validation still rejects ambiguous guard authoring on lanes where Trellis owns
  the guard.
- Ginko still has remaining protocol leakage outside this workflow test:
  `test/helpers.ts` keeps `handlerIdByFunctionRef` and destructive execute ref
  maps, and the MCP project runtime still hand-binds `executeOperationRef(...)`
  / `previewOperationRef(...)`.
- The next slices should delete those consumer-owned protocol maps instead of
  adding compatibility paths.

## Slice 50: Delete Ginko Root Test Function-Ref Maps

### Proof

- After the workflow vertical slice moved to generated testing handles, Ginko's
  shared `test/helpers.ts` still kept two consumer-owned protocol maps:
  `destructiveExecuteFunctionRefs` and `handlerIdByFunctionRef`.
- Those maps existed only to translate ordinary operation-backed direct mutation
  calls such as `api.editor.createEntry`, `api.editor.saveEntryDraft`, and
  `api.assets.moveAsset` into Trellis operation handler targets.
- Generated testing handles already contained the canonical execute refs for
  those operations, so keeping handwritten maps made Ginko a second source of
  truth for operation transport metadata.

### Implementation

- Removed `destructiveExecuteFunctionRefs`, `handlerIdByFunctionRef`, and
  `toHandlerId(...)` from Ginko's shared test helper.
- Changed generic `query` / `mutation` / `action` forwarding in the helper to
  use the literal function ref it is given.
- Added operation-backed helper methods for safe operations that tests commonly
  call directly: `createEntry`, `saveEntryDraft`, `moveAsset`, and
  `unarchiveEntry`.
- Mechanically moved affected component tests from direct safe-operation
  mutation calls to those operation-backed helper methods.
- Left direct destructive execute calls as mutation calls only where tests are
  intentionally checking missing-confirmation behavior; those targets are real
  execute function refs and no longer need a map.

### Verification

- Format check passed for all touched Ginko files:
  `pnpm exec oxfmt --check test/helpers.ts test/component/assets.test.ts test/component/backup.test.ts test/component/entries/draft.test.ts test/component/entries/publish.test.ts test/component/entries/read.test.ts test/component/entries/tree.test.ts test/component/entries/versioning.test.ts test/component/integration.test.ts test/component/public-api.test.ts`.
- Focused affected component tests passed:
  `pnpm vitest run test/component/assets.test.ts test/component/backup.test.ts test/component/entries/draft.test.ts test/component/entries/publish.test.ts test/component/entries/read.test.ts test/component/entries/tree.test.ts test/component/entries/versioning.test.ts test/component/integration.test.ts test/component/public-api.test.ts`
  reported 9 passing test files and 108 passing tests.
- Full Ginko component suite passed:
  `pnpm vitest run test/component` reported 31 passing test files and 231
  passing tests.
- Ginko generated operation artifacts were current:
  `pnpm run operations:check` reported status `ok`, 16 operations, 28
  projections, and no out-of-date files.
- Ginko typecheck passed: `pnpm run typecheck`.
- Ginko whitespace check passed: `git diff --check`.
- Source scan found no remaining root test helper maps or direct safe-operation
  mutation refs:
  `rg -n "handlerIdByFunctionRef|destructiveExecuteFunctionRefs|toHandlerId|targetFunctionRef: toHandlerId|api\\.(editor\\.(createEntry|saveEntryDraft)|assets\\.moveAsset|entries\\.publish\\.unarchiveEntry|entries\\.tree\\.createEntry|entries\\.draft\\.saveEntryDraft)" test --glob '*.ts'`
  returned no matches.

### Notes

- This is still an interim consumer cleanup, not the final Trellis-owned test
  API. Ginko now avoids handwritten protocol maps, but the helper still carries
  CMS-specific convenience methods until Trellis exposes a more ergonomic
  generated test client.
- The remaining major Ginko protocol leak is MCP project tool binding:
  `project-tool-runtime.ts` still hand-binds `executeOperationRef(...)` and
  `previewOperationRef(...)` for ordinary operation-backed tools.

## Slice 51: Ginko MCP Generated Operation Handles

### Proof

- Ginko's MCP project runtime still imported `executeOperationRef(...)` and
  `previewOperationRef(...)` and bound ordinary operation-backed tools by hand.
- Destructive MCP tools duplicated operation metadata across three places:
  operation object import, execute `call`, and preview ref.
- Bounded-write MCP tools such as create entry, save draft, unarchive entry, and
  move asset still passed direct Convex call refs next to operation metadata.
- Generated MCP handle modules needed to import
  `import('@lupinum/trellis/mcp').OperationDescriptor`, but the Trellis MCP
  public surface did not export that type.

### Implementation

- Exported `OperationDescriptor` from `@lupinum/trellis/mcp`.
- Added generated MCP operation refs and MCP operation handles under Ginko's
  Convex source package:
  `packages/convex/src/generated/operationRefs.ts` and
  `packages/convex/src/generated/operationHandles/mcp.ts`.
- Split Ginko operation generation into testing and MCP handle generation, and
  made `operations:check` validate both generated outputs.
- Exported `@lupinum/ginko-cms-convex/operation-handles/mcp` from the Convex
  package and added the local TypeScript path for package tests.
- Changed Ginko's MCP `projectTool(...)` helper to accept generated
  `OperationHandle` values and call `rawMcpRuntime.tool.operation(handle, ...)`
  without app-authored execute or preview binding.
- Hard-cut ordinary destructive and bounded-write MCP tools to
  `operations.ginkoCms.*` handles from the generated MCP module.
- Kept direct query MCP tools on explicit Convex `call` refs because they are
  not operation-backed writes.

### Verification

- Trellis format check passed:
  `pnpm exec oxfmt --check src/runtime/mcp/index.ts`.
- Trellis public type surface passed: `pnpm run test:types:public`.
- Trellis focused MCP/unit tests passed:
  `pnpm vitest run --project=unit tests/unit/mcp-index-exports.test.ts tests/unit/define-convex-tool.test.ts`
  reported 2 passing test files and 34 passing tests.
- Trellis module build passed: `pnpm run build:module`.
- Trellis whitespace check passed: `git diff --check`.
- Ginko format check passed for package metadata, generated MCP files, MCP
  runtime/tool files, and focused tests:
  `pnpm exec oxfmt --check package.json tsconfig.json packages/convex/package.json packages/convex/src/generated/operationRefs.ts packages/convex/src/generated/operationHandles/mcp.ts packages/cms/src/server/mcp/_shared/project-tool-runtime.ts packages/cms/src/server/mcp/direct/assets.ts packages/cms/src/server/mcp/direct/content.ts packages/cms/src/server/mcp/tools/assets/delete-asset.ts packages/cms/src/server/mcp/tools/content/archive-entry.ts packages/cms/src/server/mcp/tools/content/delete-entry.ts packages/cms/src/server/mcp/tools/content/publish-entry.ts packages/cms/src/server/mcp/tools/content/unpublish-entry.ts test/runtime/mcp-project-tool.test.ts test/shared/mcp-tools.test.ts`.
- Ginko generated operation artifacts were current for both testing and MCP
  outputs: `pnpm run operations:check` reported status `ok`, 16 operations, 28
  projections, and no out-of-date files for both generated outputs.
- Ginko focused MCP tests passed:
  `pnpm vitest run test/runtime/mcp-project-tool.test.ts test/shared/mcp-tools.test.ts`
  reported 2 passing test files and 18 passing tests.
- Ginko typecheck passed: `pnpm run typecheck`.
- Ginko publish specifier check passed: `pnpm run check:publish-specifiers`.
- Ginko whitespace check passed: `git diff --check`.
- Source scan found no remaining app-authored execute/preview MCP binding for
  ordinary project tools:
  `rg -n "executeOperationRef|previewOperationRef|operation: \\w+Operation|@lupinum/ginko-cms-convex/operations|call: internal\\.ginkoCmsMcp\\.(deleteAsset|archiveEntry|deleteEntry|publishEntry|unpublishEntry|moveAsset|createEntry|saveEntryDraft|unarchiveEntry)|preview: internal\\.ginkoCmsMcp" packages/cms/src/server/mcp --glob '*.ts'`
  returned no matches.

### Notes

- The clean Ginko verification was rerun after the Trellis module build
  completed. An earlier parallel attempt failed while Trellis was rebuilding
  `dist`, so Vitest temporarily could not resolve the local
  `@lupinum/trellis/testing` export.
- This slice proves the RFC's one-line MCP operation-binding target in Ginko's
  consumer code without adding a compatibility path.
- The generated MCP files currently live inside the Ginko Convex package source
  because that is the package-exportable path Ginko needs today. A future
  Trellis vNext implementation should centralize runtime-filtered generated
  handles as part of the registry/prepare system.

## Slice 52: Remove Manual Projection Helpers From MCP First-Reader Surface

### Proof

- `@lupinum/trellis/mcp` still exported `executeOperationRef(...)` and
  `previewOperationRef(...)` even though the entrypoint is documented as the
  blessed first-reader MCP surface.
- The generated MCP modules only need `defineOperationHandle(...)`,
  `projectOperationRef(...)`, and operation-handle types from the MCP surface.
- Ginko's MCP project tools no longer import or need the manual execute/preview
  helpers after Slice 51.
- Keeping those helpers on `@lupinum/trellis/mcp` made the old hand-bound MCP
  path look as canonical as generated operation handles.

### Implementation

- Removed `executeOperationRef` and `previewOperationRef` from
  `src/runtime/mcp/index.ts`.
- Kept generated-handle primitives on the MCP surface:
  `defineOperationHandle`, `projectOperationRef`, `isOperationHandle`, and the
  operation-handle types.
- Updated MCP entrypoint export tests so the first-reader MCP surface now fails
  if the manual projection helpers return.
- Left the helpers available from backend/functions surfaces for Trellis
  internals, advanced package boundaries, and existing low-level tests.

### Verification

- Trellis format check passed:
  `pnpm exec oxfmt --check src/runtime/mcp/index.ts tests/unit/mcp-index-exports.test.ts`.
- Trellis MCP entrypoint test passed:
  `pnpm vitest run --project=unit tests/unit/mcp-index-exports.test.ts`
  reported 1 passing test file and 4 passing tests.
- Trellis public type surface passed: `pnpm run test:types:public`.
- Trellis module build passed: `pnpm run build:module`.
- Trellis whitespace check passed: `git diff --check`.
- Ginko generated operation artifacts were still current after rebuilding
  Trellis:
  `pnpm run operations:check` reported status `ok`, 16 operations, 28
  projections, and no out-of-date files for both testing and MCP outputs.
- Ginko typecheck passed against the rebuilt local Trellis package:
  `pnpm run typecheck`.
- Trellis source scan confirmed the MCP runtime source only keeps negative
  assertions for the removed helpers:
  `rg -n "executeOperationRef|previewOperationRef" src/runtime/mcp tests/unit/mcp-index-exports.test.ts`.
- Ginko source scan found no generated-handle or MCP runtime imports of the
  removed helpers:
  `rg -n "from '@lupinum/trellis/mcp'.*(executeOperationRef|previewOperationRef)|executeOperationRef|previewOperationRef" packages/cms packages/convex/src/generated test/shared/mcp-tools.test.ts --glob '!dist'`.

### Notes

- This is a public surface hard cut, not a runtime semantic change. Existing
  backend/function tests still cover manual projection refs where Trellis needs
  low-level projection metadata.
- The practical consumer proof is Ginko: its generated MCP refs import only
  `projectOperationRef` from `@lupinum/trellis/mcp`, and its MCP tool runtime
  imports only the MCP app/runtime types it needs.

## Slice 53: Teach Generated MCP Handles In Docs And Skills

### Proof

- After removing manual projection helpers from the first-reader MCP entrypoint,
  user-facing docs and skill references still taught `executeOperationRef(...)`
  / `previewOperationRef(...)` as the canonical destructive MCP binding shape.
- The stale text contradicted RFC 0013's generated-handle target and the Ginko
  consumer proof from Slice 51.
- `pnpm run test:security` also exposed stale generated
  `security-contract.generated.json` output and a stale security-contract unit
  expectation for the runbook webhook service. The current service definition is
  operation-allowlisted and no longer declares an explicit `allowedFunctionRefs`
  fallback.

### Implementation

- Updated the MCP API reference to teach generated operation handles from
  `#trellis/operations/mcp` for ordinary MCP tools.
- Updated the destructive MCP tools guide to show generated operation-handle
  binding for both backend and transport confirmation modes.
- Updated Trellis skill references so future agents do not reintroduce manual
  execute/preview binding in ordinary app MCP files.
- Updated the 0.2 implementation note to distinguish normal MCP tool imports
  from generated operation-ref module imports.
- Regenerated `security-contract.generated.json` from the current source tree.
- Updated the security-contract test expectation for the runbook webhook service
  to expect `allowedOperations` with no duplicate `allowedFunctionRefs`.

### Verification

- Formatter check passed for touched docs, skill references, the security
  contract test, and generated security contract:
  `pnpm exec oxfmt --check tests/unit/security-contract.test.ts apps/docs/content/docs/13.api-reference/5.mcp.md apps/docs/content/docs/14.mcp-tools/4.destructive-tools.md meta/0.2-implementation-note.md meta/skill/references/backend-auth-permissions.md meta/skill/references/server-mcp.md security-contract.generated.json`.
- Docs links passed: `pnpm run check:docs:links`.
- Full security gate passed: `pnpm run test:security` reported security source
  policy pass, security contract up to date, module build pass, packed export
  policy pass, and 26 passing unit test files with 293 passing tests.
- Focused docs/starter/MCP tests passed:
  `pnpm vitest run --project=unit tests/unit/phase0-starter-manifest.test.ts tests/unit/mcp-descriptor-boundary.test.ts tests/unit/api-surface-doc.test.ts`
  reported 3 passing test files and 16 passing tests before the full security
  gate was rerun.
- Stale-guidance scan found no remaining docs or skill references that teach
  manual MCP projection refs as canonical:
  `rg -n 'operation ref helpers from|Import operation ref helpers|executeOperationRef\\(removeRunbook|previewOperationRef\\(removeRunbook|executeOperationRef\\(publishPage|previewOperationRef\\(publishPage|from .@lupinum/trellis/mcp.*executeOperationRef|from .@lupinum/trellis/mcp.*previewOperationRef' meta/skill meta/0.2-implementation-note.md README.md apps examples src/cli --glob '!dist' --glob '!node_modules'`.
  The only matches were the explicitly advanced component mini-CMS source
  projections.

### Notes

- This does not delete low-level projection helpers from backend/functions
  surfaces. Those remain for Trellis internals, generated refs, and explicit
  package bridge boundaries.
- The regenerated security contract also captured existing source inventory
  drift from earlier slices, such as current line numbers and operation-backed
  component mini-CMS projections. The contract generator and full security gate
  now agree on the current tree.

## Slice 54: Check Operation Projection Registry Outside Nuxt Prepare

### Proof

- `trellis operations generate --check` already compared rendered operation
  registry outputs with disk, but the renderer required operation refs and
  handles even when the only real source artifact was the Convex-side projection
  registry.
- The workspace MCP starter writes `generated/operation-projections.ts` as the
  source artifact consumed by `convex/functions.ts`; operation refs/handles are
  Nuxt/test generated outputs and are not present in the starter source file set.
- `scripts/check-starter-fixtures.mjs` also treated manifest generated entries as
  if every entry had a single `path`, so `operationRegistry` entries were not a
  reliable source of expected generated outputs.
- That left the source projection registry dependent on later Nuxt
  prepare/typecheck behavior instead of a direct fail-closed generated-file
  check.

### Implementation

- Made operation registry generated outputs target-specific:
  `operationProjectionsPath` can now be rendered and checked without also
  rendering operation refs or operation handles.
- Kept invalid combinations fail-closed: operation handles still require
  operation refs, refs require the project operation-ref import and API import,
  and at least one output path is required.
- Simplified `trellis add entity ... --mcp` projection refresh so it renders only
  `generated/operation-projections.ts` instead of producing unused refs/handles
  and discarding them.
- Updated the starter fixture checker to derive generated output paths from
  `starter.manifest.json` `operationRegistry` entries and run
  `trellis operations generate --check` against the generated files that the
  starter actually writes, before Nuxt prepare/typecheck.
- Added CLI and renderer tests proving projection-only generation, clean checks,
  and stale projection-registry detection without generated refs or handles.

### Verification

- Formatter check passed for the touched operation registry, CLI, resource,
  starter checker, and focused test files:
  `pnpm exec oxfmt --check src/module-internals/operation-registry-codegen.ts src/cli/commands/operations.ts src/cli/lib/resource.ts tests/unit/cli-operations.test.ts tests/unit/operation-registry-codegen.test.ts scripts/check-starter-fixtures.mjs`.
- CLI build passed: `pnpm run build:cli`.
- Focused operation CLI/codegen tests passed:
  `pnpm vitest run --project=unit tests/unit/cli-operations.test.ts tests/unit/operation-registry-codegen.test.ts`
  reported 2 passing test files and 11 passing tests.
- Starter fixture doctor gate passed and now includes the direct operation
  registry check:
  `pnpm run check:starter-fixtures:doctor` reported public, personal, workspace,
  and workspace-mcp starter doctor passes with 0 warnings and 0 failures.
- Adjacent starter/add-resource tests passed:
  `pnpm vitest run --project=unit tests/unit/phase0-starter-manifest.test.ts tests/unit/cli-add-resource.test.ts tests/unit/phase0-workspace-mcp-fixture.test.ts`
  reported 3 passing test files and 17 passing tests.

### Notes

- This slice deliberately does not add a new command or duplicate generated
  registry state. The existing `operations generate --check` path remains the
  single check mechanism; it can now check the projection registry independently
  when that is the only materialized artifact.
- The next implementation gap is still the full Nuxt prepare lifecycle for
  generating runtime-filtered operation handles and aliases. This slice gives
  source and package consumers a concrete non-Nuxt drift check first.

## Slice 55: Move Operation Handle Generation Into Nuxt Prepare

### Proof

- Trellis already had Nuxt templates for `#trellis/operations/client`,
  `#trellis/operations/server`, `#trellis/operations/testing`, and
  `#trellis/operations/mcp`, but the implementation lived inside
  `installPermissionCodegen(...)`.
- `installPermissionCodegen(...)` only runs when `trellis.permissions.codegen`
  is enabled. That made runtime operation handles accidentally depend on
  optional permission metadata generation.
- This contradicted the RFC model: operation handles are the normal Nuxt runtime
  projection path, while permission codegen is an optional typed permission and
  public-surface metadata layer.

### Implementation

- Extracted operation registry template generation into a dedicated
  `installOperationCodegen(...)` installer.
- Registered the operation installer unconditionally from the main Nuxt module
  setup path, after core/advanced aliases are installed.
- Kept permission codegen opt-in and removed operation refs, operation handles,
  operation projection registry aliases, and operation runtime aliases from the
  permission installer.
- Made the operation installer use target-specific generation:
  operation refs render only refs, operation handle templates render their one
  runtime handle module plus refs, and the Convex projection registry renders
  only the projection artifact.
- Preserved the existing builder watch refresh behavior for operation/public
  surface source changes.

### Verification

- Formatter check passed for the operation installer, permission installer,
  module setup, and focused tests:
  `pnpm exec oxfmt --check src/installers/operation-codegen.ts src/installers/permission-codegen.ts src/module.ts tests/unit/operation-codegen-installer.test.ts tests/unit/permission-codegen-installer.test.ts tests/unit/module-auto-imports.test.ts tests/unit/module-validation.test.ts`.
- Focused installer/module tests passed:
  `pnpm vitest run --project=unit tests/unit/operation-codegen-installer.test.ts tests/unit/permission-codegen-installer.test.ts tests/unit/module-auto-imports.test.ts tests/unit/module-validation.test.ts`
  reported 4 passing test files and 11 passing tests.
- Module build passed: `pnpm run build:module`.
- Core source lint passed: `pnpm run lint:src:core`.
- Adjacent module/starter/MCP tests passed:
  `pnpm vitest run --project=unit tests/unit/module-setup.test.ts tests/unit/api-surface-doc.test.ts tests/unit/mcp-descriptor-boundary.test.ts tests/unit/phase0-starter-manifest.test.ts`
  reported 4 passing test files and 25 passing tests.
- Starter fixture doctor gate passed:
  `pnpm run check:starter-fixtures:doctor` reported public, personal, workspace,
  and workspace-mcp starter doctor passes with 0 warnings and 0 failures.
- Whitespace check passed: `git diff --check`.

### Notes

- This is a hard ownership split, not a compatibility layer. Operation aliases
  no longer depend on `trellis.permissions.codegen`.
- Permission codegen still owns `.nuxt/types/trellis-permissions.d.ts`,
  `.nuxt/types/trellis-public-surface.d.ts`, `trellis/permissions.json`, and
  `trellis/public-surface.json`. Splitting always-on public-surface inventory is
  a separate remaining slice.

## Slice 56: Move Public-Surface Inventory Out Of Permission Codegen

### Proof

- After Slice 55, runtime operation handle aliases were no longer gated by
  `trellis.permissions.codegen`, but public-surface generated types and JSON
  still were.
- `installPermissionCodegen(...)` emitted both permission metadata and
  operation/tool inventory:
  `.nuxt/types/trellis-public-surface.d.ts` and
  `.nuxt/trellis/public-surface.json`.
- That kept operation/tool inventory coupled to optional permission-key
  generation, which conflicts with the RFC distinction between operation surface
  inventory and permission metadata.

### Implementation

- Added `installPublicSurfaceCodegen(...)` as a dedicated always-on Nuxt
  installer for public-surface types and JSON.
- Registered the public-surface installer unconditionally from the main module
  setup path.
- Removed public-surface templates and watch conditions from
  `installPermissionCodegen(...)`, leaving that installer responsible only for
  permission declarations, permission metadata, and the `#trellis/permissions`
  runtime alias.
- Updated docs so permission codegen no longer claims ownership of public
  operation/tool inventory.
- Added focused installer tests proving public-surface output is generated
  without permission codegen and permission codegen no longer emits
  public-surface artifacts.

### Verification

- Formatter check passed for the public-surface installer, permission installer,
  module setup, focused tests, and touched docs:
  `pnpm exec oxfmt --check src/installers/public-surface-codegen.ts src/installers/permission-codegen.ts src/module.ts tests/unit/public-surface-codegen-installer.test.ts tests/unit/permission-codegen-installer.test.ts tests/unit/module-auto-imports.test.ts tests/unit/module-validation.test.ts apps/docs/content/docs/10.configuration/4.permissions-options.md apps/docs/content/docs/13.api-reference/8.type-primitives.md`.
- Focused public-surface, permission, module, and generated type tests passed:
  `pnpm vitest run --project=unit tests/unit/public-surface-codegen-installer.test.ts tests/unit/permission-codegen-installer.test.ts tests/unit/module-auto-imports.test.ts tests/unit/module-validation.test.ts tests/unit/generated-type-consumers.test.ts tests/unit/public-surface-codegen.test.ts`
  reported 6 passing test files and 21 passing tests.
- Module build passed: `pnpm run build:module`.
- Core source lint passed: `pnpm run lint:src:core`.
- Docs links passed: `pnpm run check:docs:links`.
- Starter fixture doctor gate passed:
  `pnpm run check:starter-fixtures:doctor` reported public, personal, workspace,
  and workspace-mcp starter doctor passes with 0 warnings and 0 failures.
- Whitespace check passed: `git diff --check`.

### Notes

- This is another ownership split, not a compatibility path. Runtime operation
  handles, public-surface inventory, and permission metadata now have separate
  installers.
- The next proof gap is a prepared Nuxt fixture or typecheck that imports
  generated operation handles while leaving permission codegen disabled.

## Slice 57: Prove Nuxt MCP Operation Alias Without Permission Codegen

### Proof

- Slice 55 proved the operation codegen installer registers
  `#trellis/operations/mcp` without `trellis.permissions.codegen`, but only at
  the module-template level.
- The existing phase0 workspace MCP fixture had permission codegen disabled in
  Nuxt config, but its runtime unit tools imported committed generated handles
  directly from `generated/operation-handles/mcp.ts`.
- That left a real Nuxt prepare/typecheck gap: a source-backed fixture could
  still fail to resolve `#trellis/operations/mcp`, or generated handles could
  typecheck as raw operation definitions instead of operation handles.
- The first `nuxi typecheck` attempt on the fixture exposed the expected nested
  fixture issue: without a local `tsconfig.json`, Nuxt typecheck walked up into
  the repo root TypeScript project and reported unrelated starter fixture
  errors. A fixture-local tsconfig was required before the proof was meaningful.

### Implementation

- Added a phase0 MCP tool that imports operation handles from
  `#trellis/operations/mcp` and binds `operations.projects.create` through
  `tool.operation(...)`.
- Added a focused unit smoke that runs `nuxi prepare` and `nuxi typecheck` for
  the phase0 workspace MCP fixture with permission codegen disabled.
- The smoke asserts that Nuxt emits `.nuxt/trellis/operation-handles/mcp.ts`,
  wires `#trellis/operations/mcp` in `.nuxt/tsconfig.json`, keeps generated refs
  bound to `#trellis/api`, and does not emit permission-codegen artifacts.
- Added a fixture-local `tsconfig.json` extending `.nuxt/tsconfig.json` so the
  typecheck proves the fixture instead of the whole repository.
- Added source aliases for the phase0 fixture's Trellis subpath imports so the
  proof does not depend on a prebuilt package `dist`.
- Fixed the MCP `tool.operation(...)` type contract so generated
  `OperationHandle` values are accepted directly, matching the runtime
  implementation and RFC authoring target.
- Narrowed registered operation projection type helpers so operations without a
  preview or execute registration resolve to `never` instead of indexing
  non-matching declaration-merge maps.

### Verification

- Focused Nuxt alias smoke passed:
  `pnpm vitest run --project=unit tests/unit/operation-alias-no-permission-codegen.test.ts`
  reported 1 passing test after running fixture `nuxi prepare` and
  `nuxi typecheck`.
- Adjacent phase0/codegen/MCP tests passed:
  `pnpm vitest run --project=unit tests/unit/operation-alias-no-permission-codegen.test.ts tests/unit/phase0-workspace-mcp-fixture.test.ts tests/unit/operation-codegen-installer.test.ts tests/unit/mcp-operation-binding.test.ts tests/unit/mcp-index-exports.test.ts`
  reported 5 passing test files and 19 passing tests.
- Formatter check passed for touched runtime, fixture, and test files:
  `pnpm exec oxfmt --check src/runtime/mcp/define-mcp-app.ts src/runtime/functions/index.ts tests/fixtures/phase0-workspace-mcp/nuxt.config.ts tests/fixtures/phase0-workspace-mcp/server/mcp/runtime.ts tests/fixtures/phase0-workspace-mcp/server/mcp/tools/create-project-from-virtual-alias.ts tests/fixtures/phase0-workspace-mcp/convex/features/projects/domain.ts tests/fixtures/phase0-workspace-mcp/tsconfig.json tests/unit/operation-alias-no-permission-codegen.test.ts tests/unit/phase0-workspace-mcp-fixture.test.ts`.
- Module build passed: `pnpm run build:module`.
- Runtime MCP/functions lint passed: `pnpm run lint:src:runtime:functions-mcp`.
- Test lint passed: `pnpm run lint:tests`.
- Public type surface passed: `pnpm run test:types:public`.
- Publish-surface check passed: `pnpm run check:publish-surface`.
- Whitespace check passed: `git diff --check`.

### Notes

- The phase0 Convex projection file now casts implemented operations at the
  projection call site so Nuxt typecheck can prove the generated handle import
  path without turning this fixture into a full Convex backend type proof.
- This keeps the scanner-visible shape as one direct exported lane call per
  projection and avoids adding a second generated handle source.
- The remaining release-level proof is still broader than this slice:
  starter-fixture typecheck/build, Ginko consumer deletion of protocol maps,
  explain/doctor inventory wiring, and the final `release:verify` gate remain
  separate acceptance work.

## Slice 58: Mark RFC 0013 Accepted And In Progress

### Proof

- RFC 0013 was still marked `Status: Proposed` with a review stance saying the
  implementation contract needed revision before building.
- That no longer matched the branch: multiple implementation slices have landed
  and the current work is already proceeding under the accepted proof-first
  implementation loop.
- Leaving the status stale made the RFC look less authoritative than the
  journal and commit history, while changing it to complete would overstate the
  release state.

### Implementation

- Changed RFC 0013 status to `Accepted for implementation; in progress`.
- Simplified the owner/review stance to reflect that the implementation
  contract is accepted and build continues in proof-sized slices.
- Added an implementation status section that separates completed foundation
  slices from open release acceptance work.
- Added a note before the acceptance criteria clarifying that the checklist is
  the release target, not a claim that the current branch has satisfied every
  item.

### Verification

- RFC formatting passed:
  `pnpm exec oxfmt --check meta/rfc/0013-nuxt-native-operation-framework.md`.
- Docs link check passed: `pnpm run check:docs:links`.

### Notes

- This is intentionally a status alignment slice only. It does not relax the
  remaining acceptance gates: explain/doctor inventory wiring, starter
  typecheck/build, Ginko consumer proof, and full `release:verify` remain open.

## Slice 59: Prefer Generated Public-Surface Inventory In CLI

### Proof

- `trellis explain` and doctor JSON both consume `collectTrellisCliInventory`.
  Before this slice, that collector always rescanned app source with
  `extractPublicSurfaceCodegenMetadata(project.cwd)`.
- Slice 56 made `.nuxt/trellis/public-surface.json` the always-on generated
  public-surface inventory, but CLI inventory ignored it. That left two
  possible app-surface views after Nuxt prepare.
- A generated-only explain fixture proved the gap: an app with only
  `.nuxt/trellis/public-surface.json` could not be explained by the CLI source
  scan even though the generated inventory contained the operation, projection,
  and MCP tool.
- The adjacent doctor suite also exposed a stale hard-cut issue: the MCP add
  command did not copy the same descriptor-backed todos files as the
  `workspace-mcp` preset, so the composed ladder path could keep old direct
  operation exports next to the new shared descriptors.

### Implementation

- Updated CLI inventory to prefer `.nuxt/trellis/public-surface.json` when the
  generated file exists, with targeted fail-close validation for malformed
  generated metadata.
- Kept source scanning as the fallback only for pre-prepare apps where the
  generated public-surface inventory does not exist yet.
- Added explain coverage for a generated-only public-surface inventory and for
  malformed generated inventory failing instead of silently falling back.
- Updated `add mcp` starter composition to overwrite the todos domain, feature,
  barrel, operations, permissions, functions, generated operation projections,
  and shared descriptor/permission files from the `workspace-mcp` preset.
- Updated doctor expectations to match the current descriptor-backed
  workspace-MCP starter surface.

### Verification

- Formatter check passed for touched CLI and test files:
  `pnpm exec oxfmt --check src/cli/lib/init.ts src/cli/lib/inventory.ts tests/unit/cli-explain.test.ts tests/unit/cli-doctor.test.ts`.
- CLI build passed: `pnpm run build:cli`.
- Explain suite passed:
  `pnpm vitest run --project=unit tests/unit/cli-explain.test.ts` reported 11
  passing tests.
- Focused preset/ladder equivalence proof passed:
  `pnpm vitest run --project=unit tests/unit/cli-doctor.test.ts -t "keeps presets mechanically equivalent"`
  reported 1 passing test.
- Full doctor suite passed:
  `pnpm vitest run --project=unit tests/unit/cli-doctor.test.ts` reported 62
  passing tests.
- Starter fixture doctor gate passed:
  `pnpm run check:starter-fixtures:doctor` reported public, personal,
  workspace, and workspace-mcp starter doctor passes with 0 warnings and 0
  failures.
- Core source lint passed: `pnpm run lint:src:core`.
- Test lint passed: `pnpm run lint:tests`.
- Whitespace check passed: `git diff --check`.

### Notes

- This does not add a new inventory source. It makes the CLI consume the
  generated inventory after Nuxt prepare and keeps the source scan only as the
  pre-prepare fallback.
- Malformed generated inventory is treated as drift and fails close.
- `trellis explain app --json` still needs its broader versioned app-report
  work; this slice only fixes the current operation/permission inventory path
  used by explain and doctor.

## Slice 60: Make Operation Handle Codegen Build-Safe

### Proof

- The standalone starter typecheck gate passed for all four generated starters:
  public, personal, workspace, and workspace-MCP.
- The starter build gate then failed only for `workspace-mcp` during Nitro
  bundling. Rollup tried to parse
  `.nuxt/trellis/operation-handles/mcp.ts` as JavaScript and failed on the
  generated `operations` aggregate ending in `} as const`.
- That made the generated MCP handle module valid for TypeScript but not safe
  for Nuxt production bundling.

### Implementation

- Removed the TypeScript-only `as const` assertion from generated operation
  handle `operations` aggregate output.
- Removed the same assertion from the empty operation-handle module fallback.
- Added focused installer coverage so generated operation handle modules do not
  reintroduce `} as const`.

### Verification

- Formatter check passed:
  `pnpm exec oxfmt --check src/module-internals/operation-handle-codegen.ts src/module-internals/operation-registry-codegen.ts tests/unit/operation-codegen-installer.test.ts`.
- Operation codegen tests passed:
  `pnpm vitest run --project=unit tests/unit/operation-codegen-installer.test.ts tests/unit/operation-registry-codegen.test.ts`
  reported 2 passing test files and 11 passing tests.
- Nuxt MCP alias smoke passed:
  `pnpm vitest run --project=unit tests/unit/operation-alias-no-permission-codegen.test.ts`.
- Core source lint passed: `pnpm run lint:src:core`.
- Starter fixture build gate passed:
  `pnpm run check:starter-fixtures:build` reported public, personal, workspace,
  and workspace-mcp doctor/install/codegen/prepare/typecheck/build passes.
- Starter fixture typecheck gate passed on the final tree:
  `pnpm run check:starter-fixtures:typecheck` reported public, personal,
  workspace, and workspace-mcp doctor/install/codegen/prepare/typecheck passes.

### Notes

- The individual handle constants still carry their operation-handle types from
  `defineOperationHandle(...)`. The aggregate object does not need a TS-only
  assertion to preserve the authoring API.
- This closes the starter fixture typecheck/build acceptance gap for the
  descriptor-backed workspace-MCP hard cutover.

## Slice 61: Add Versioned App Explain JSON

### Proof

- RFC 0013 requires `trellis explain app --json` to emit safe-to-share,
  versioned JSON from existing inventory and not from a handwritten app
  manifest.
- Before this slice, `trellis explain` only accepted `operation <id>` and
  `permission <key>`, and the `id` positional was always required.
- The CLI already had one inventory collector carrying package, layer, surface,
  feature, permission, operation, projection, and MCP tool facts, so adding a
  second app-report source would have created drift.

### Implementation

- Added `trellis explain app` as a no-identifier topic.
- Added `--privacy public|developer|internal`, defaulting to `public`.
- Public app JSON omits the absolute cwd, file paths, source locations, and
  export names while keeping safe package/layer/surface counts and public
  operation/tool/feature/permission summaries.
- Developer/internal app JSON includes local inventory detail from the existing
  `collectTrellisCliInventory(...)` output, including relative files, source
  locations, app inventory, and findings.
- Added a compact human-readable app summary for `trellis explain app` without
  `--json`.
- Kept operation and permission explain behavior on the existing code path.

### Verification

- Formatter check passed:
  `pnpm exec oxfmt --check src/cli/commands/explain.ts tests/unit/cli-explain.test.ts`.
- CLI build passed: `pnpm run build:cli`.
- Explain suite passed:
  `pnpm vitest run --project=unit tests/unit/cli-explain.test.ts` reported 15
  passing tests.
- Core source lint passed: `pnpm run lint:src:core`.
- Test lint passed: `pnpm run lint:tests`.
- Whitespace check passed: `git diff --check`.

### Notes

- The app report is derived from the existing CLI inventory. It does not add an
  app manifest, generated agent context file, or second source of truth.
- This covers the initial `trellis explain app --json` acceptance target. The
  remaining explain/agent gaps are tool/file/feature explain and deeper
  `doctor --agent` diagnostics.

## Slice 62: Explain Operation-Backed MCP Tools

### Proof

- RFC 0013 requires `trellis explain tool <name>` to work for
  operation-backed tools.
- Before this slice, `trellis explain` only accepted `app`, `operation`, and
  `permission`. Running
  `node dist/cli.mjs explain tool archive-task --cwd src/cli/starter-fixtures/workspace-mcp`
  failed with the invalid-topic message.
- The existing public-surface inventory already records MCP tool names,
  binding source, source locations, and optional operation ids. Adding a second
  tool manifest would have introduced drift.

### Implementation

- Added `trellis explain tool <name>` as an inventory-backed explain topic.
- The tool report includes the MCP tool name, source kind, source location,
  operation binding ids, and the matched operation/projections/feature refs
  when the tool is operation-backed.
- Missing tools now fail clearly with `tool-not-found` or `no-tools` and list
  available MCP tool names.
- Human-readable output shows the bound operation, projections, and feature
  refs without requiring JSON.
- Kept the implementation on the existing `collectTrellisCliInventory(...)`
  path, including generated `.nuxt/trellis/public-surface.json` support from
  Slice 59.

### Verification

- Formatter check passed:
  `pnpm exec oxfmt --check src/cli/commands/explain.ts tests/unit/cli-explain.test.ts`.
- CLI build passed: `pnpm run build:cli`.
- Explain suite passed after the final rebuild:
  `pnpm vitest run --project=unit tests/unit/cli-explain.test.ts` reported 1
  passing test file and 20 passing tests.
- Core source lint passed: `pnpm run lint:src:core`.
- Test lint passed: `pnpm run lint:tests`.
- Whitespace check passed: `git diff --check`.

### Notes

- This closes the RFC acceptance item for `trellis explain tool <name>`.
- The report remains derived from public-surface inventory; there is no new app
  manifest, MCP tool manifest, or generated agent context artifact.
- The remaining agent-facing CLI gap is now concentrated in `doctor --agent`
  diagnostics and the later Ginko consumer proof.

## Slice 63: Start Agent Doctor Operation Metadata

### Proof

- RFC 0013 requires `trellis doctor --agent` to report missing operation
  metadata and missing generated contracts for operation-backed MCP tools.
- Before this slice, the `doctor` command had no `--agent` option.
- A workspace-MCP probe also showed a lower-level inventory gap: the canonical
  generated-handle form `tool.operation(operations.todos.create, ...)` was
  detected as operation-backed, but the tool metadata did not include
  `operationId` or `operationExportName`.
- The direct operation form `tool.operation(archiveTaskOp, ...)` already
  resolved metadata, so the gap was specifically generated handle-path
  resolution rather than MCP tool discovery.

### Implementation

- Exported the operation-handle path derivation helper from operation handle
  codegen and reused it in public-surface scanning.
- Public-surface scanning now resolves both ergonomic generated handles such as
  `operations.projects.create` and indexed handles such as
  `operations.byId['projects.create']` back to known operation metadata when
  the path/id is unambiguous.
- Added `trellis doctor --agent` as an opt-in profile that appends
  agent-facing findings without changing default doctor output.
- Added `agent-mcp-operation-metadata` to fail when operation-backed MCP tools
  cannot be resolved to operation id/export metadata.
- Added `agent-mcp-operation-projections` to fail when a resolvable
  operation-backed MCP tool lacks an execute projection, or when a destructive
  MCP-exposed operation lacks a preview projection.

### Verification

- The generated-handle scanner proof first failed because
  `operations.projects.create` produced no operation metadata, then passed
  after scanner changes.
- Formatter check passed:
  `pnpm exec oxfmt --check src/cli/commands/doctor.ts src/cli/lib/doctor-report.ts src/cli/lib/inventory-findings.ts src/module-internals/public-surface-codegen.ts src/module-internals/operation-handle-codegen.ts tests/unit/public-surface-codegen.test.ts tests/unit/cli-doctor.test.ts`.
- CLI build passed: `pnpm run build:cli`.
- Public-surface/codegen tests passed:
  `pnpm vitest run --project=unit tests/unit/public-surface-codegen.test.ts tests/unit/public-surface-codegen-installer.test.ts tests/unit/operation-codegen-installer.test.ts tests/unit/operation-registry-codegen.test.ts`
  reported 4 passing test files and 22 passing tests.
- Full doctor suite passed:
  `pnpm vitest run --project=unit tests/unit/cli-doctor.test.ts` reported 1
  passing test file and 65 passing tests.
- Core source lint passed: `pnpm run lint:src:core`.
- Test lint passed: `pnpm run lint:tests`.
- Whitespace check passed: `git diff --check`.

### Notes

- This is still derived from public-surface inventory. It does not add an
  agent manifest, MCP manifest, feature flag, or compatibility path.
- A manual `doctor --agent --json` probe against the workspace-MCP starter
  reports both new agent findings as pass, and the `create-todo` generated
  handle now resolves to `todos.create`.
- The remaining `doctor --agent` acceptance work is MCP argument contract
  description diagnostics, record-id resolution/search/waiver diagnostics, and
  stale generated agent-context handling if such an artifact is introduced.

## Slice 64: Agent Doctor Contract Descriptions

### Proof

- RFC 0013 requires `trellis doctor --agent` to report missing contract
  descriptions for MCP-exposed args.
- The runtime already uses `defineArgs({ description, args, meta })` as the
  shared argument contract source, and the workspace-MCP starter already keeps
  its operation descriptors on `args: createTodo.args`.
- Before this slice, public-surface operation metadata did not retain the
  `defineArgs(...)` contract description. A scanner proof for
  `args: createProject.args` failed because the extracted operation had no
  contract metadata.
- A doctor proof with generated public-surface metadata also failed because no
  `agent-mcp-contract-descriptions` finding existed.

### Implementation

- Extended public-surface operation metadata with an optional `contract` block
  derived from static `defineArgs(...)` declarations.
- The scanner now links operation definitions/descriptors whose `args` property
  is a direct `contract.args` reference back to the matching `defineArgs`
  export when the export name is unambiguous.
- Generated `.nuxt/trellis/public-surface.json` validation now accepts and
  validates the optional operation contract block.
- CLI inventory maps operation contract metadata into relative source
  locations for doctor/explain consumers.
- Added `agent-mcp-contract-descriptions`, which fails `doctor --agent` when a
  resolvable operation-backed MCP tool points at an operation whose shared
  contract has no top-level description.

### Verification

- The scanner proof first failed because `createProjectDescriptor` had no
  contract metadata, then passed after deriving metadata from `defineArgs`.
- The agent doctor proof first failed because
  `agent-mcp-contract-descriptions` was missing, then passed after adding the
  finding.
- Formatter check passed:
  `pnpm exec oxfmt --check src/module-internals/public-surface-codegen.ts src/cli/lib/inventory.ts src/cli/lib/inventory-findings.ts tests/unit/public-surface-codegen.test.ts tests/unit/cli-doctor.test.ts`.
- CLI build passed: `pnpm run build:cli`.
- Public-surface/codegen tests passed:
  `pnpm vitest run --project=unit tests/unit/public-surface-codegen.test.ts tests/unit/public-surface-codegen-installer.test.ts tests/unit/operation-codegen-installer.test.ts tests/unit/operation-registry-codegen.test.ts`
  reported 4 passing test files and 22 passing tests.
- Full doctor suite passed:
  `pnpm vitest run --project=unit tests/unit/cli-doctor.test.ts` reported 1
  passing test file and 66 passing tests.
- Core source lint passed: `pnpm run lint:src:core`.
- Test lint passed: `pnpm run lint:tests`.
- Whitespace check passed: `git diff --check`.

### Notes

- This keeps contract metadata derived from existing shared contracts. It does
  not introduce a new agent manifest, tool manifest, or duplicate contract
  system.
- A manual `doctor --agent --json` probe against the workspace-MCP starter now
  shows `agent-mcp-contract-descriptions` passing and `todos.create` carrying
  the `createTodo` contract description from
  `shared/features/todos/contract.ts`.
- This slice covers top-level operation contract descriptions. Field labels,
  field descriptions, examples, and id-resolution metadata are picked up in the
  following record-id diagnostics slice.

## Slice 65: Agent Doctor Record ID Resolution

### Proof

- RFC 0013 requires `trellis doctor --agent` to fail or warn when an
  MCP-exposed write accepts a record id without id-resolution metadata, a
  paired search/list/resolve tool, or an explicit waiver reason.
- Before this slice, `defineArgs` field metadata could describe labels,
  descriptions, examples, enum hints, and default hints, but it had no
  `resolveWith` or `displayField` fields.
- Public-surface operation contract metadata only retained the top-level
  `defineArgs` description. A scanner proof for `v.id('projects')` field
  metadata failed because generated operation metadata had no contract fields.
- A doctor proof with generated public-surface metadata failed because no
  `agent-mcp-record-id-resolution` finding existed.

### Implementation

- Extended `defineArgs` field metadata with `resolveWith` and `displayField`.
- Extended public-surface scanning to derive static contract fields from
  `defineArgs(...)`:
  - record-id fields from `v.id(...)` and `v.optional(v.id(...))`
  - static labels, descriptions, examples, `resolveWith`, and `displayField`
    from field metadata
- Extended `tool.operation(...)` options with tool-level `resolveIds` and a
  reasoned `agent.idResolution: false` waiver shape.
- Generated public-surface JSON validation and CLI inventory now preserve
  contract fields, projection `functionKind`, tool `resolveIdFields`, and
  tool `idResolutionWaiver`.
- Added `agent-mcp-record-id-resolution`, which evaluates operation-backed MCP
  mutation/action tools and fails unresolved record-id fields unless they have
  field-level `resolveWith`, tool-level `resolveIds`, a paired
  search/list/resolve MCP tool, or an explicit waiver reason.

### Verification

- The scanner proof first failed because `createProject` contract fields were
  missing, then passed after deriving field metadata from `defineArgs`.
- The agent doctor proof first failed because
  `agent-mcp-record-id-resolution` was missing, then passed after adding the
  finding and rebuilding the CLI.
- Formatter check passed:
  `pnpm exec oxfmt --check src/runtime/convex/shared/define-convex-schema.ts src/runtime/mcp/define-mcp-app.ts src/runtime/mcp/index.ts src/module-internals/public-surface-codegen.ts src/cli/lib/inventory.ts src/cli/lib/inventory-findings.ts tests/unit/public-surface-codegen.test.ts tests/unit/cli-doctor.test.ts`.
- CLI build and smoke passed: `pnpm run check:cli`.
- Public-surface/codegen tests passed:
  `pnpm vitest run --project=unit tests/unit/public-surface-codegen.test.ts tests/unit/public-surface-codegen-installer.test.ts tests/unit/operation-codegen-installer.test.ts tests/unit/operation-registry-codegen.test.ts`
  reported 4 passing test files and 22 passing tests.
- Full doctor suite passed:
  `pnpm vitest run --project=unit tests/unit/cli-doctor.test.ts` reported 1
  passing test file and 68 passing tests.
- Core source lint passed: `pnpm run lint:src:core`.
- Runtime Convex/auth lint passed: `pnpm run lint:src:runtime:auth-convex`.
- Runtime functions/MCP lint passed:
  `pnpm run lint:src:runtime:functions-mcp`.
- Test lint passed: `pnpm run lint:tests`.
- Publish-surface check passed: `pnpm run check:publish-surface`.
- Contract type tests passed: `pnpm run test:types:contracts`.
- Public type tests passed: `pnpm run test:types:public`.
- Whitespace check passed: `git diff --check`.

### Notes

- The finding remains derived from public-surface inventory. This does not add
  an agent manifest, MCP manifest, compatibility path, or second contract
  system.
- `resolveIds` is accepted as tool-local metadata, but runtime execution does
  not branch on it; the value is for agent-facing diagnostics and generated
  context.
- The paired resolver-tool check is intentionally simple and static: a sibling
  MCP tool whose name or operation id contains a search/list/resolve verb plus
  the target table token satisfies the doctor finding.

## Slice 66: Default Test Forwarding Replay Metadata

### Proof

- RFC 0013 requires product-level tests to stop maintaining forwarding
  purpose, target handler ids, replay modes, and preview/execute refs when they
  can be derived by Trellis.
- Trellis already had `ctx.asCaller(...).operation(handle).preview/execute`
  for generated operation handles, and Ginko CMS was already using it for
  destructive operation flows.
- The remaining Ginko helper still carried direct Convex wrapper metadata for
  normal `query`, `mutation`, and `action` calls:
  - custom function-ref extraction from Convex refs
  - `targetFunctionRef`
  - replay-mode selection for writes
- A Trellis proof test showed that `ctx.asUser(...).mutation(fn, args)` could
  derive the target function ref but emitted a trusted forwarding envelope
  without replay metadata. The proof failed with
  `payload.replayMode === undefined` before this slice.
- A Ginko experiment deleting the helper-level `targetFunctionRef` and
  replay-mode plumbing failed until the Trellis testing runtime was rebuilt
  with this slice.

### Implementation

- `createTestContext(...).asCaller/asUser/asService` now defaults replay
  metadata for direct trusted test forwarding:
  - mutation calls use `jti-redemption`
  - action calls use `domain-idempotency`
  - query calls remain replay-free
- Explicit `TestCallerOptions.replayMode`, `replayKey`, and `replayTarget`
  still override or extend the default for advanced tests.
- Added a unit proof that verifies the signed forwarding envelope for a direct
  mutation carries `replayMode: 'jti-redemption'` without caller-authored
  replay options.

### Verification

- The new Trellis proof first failed because direct forwarded mutations had no
  replay metadata, then passed after defaulting replay mode by call kind.
- Trellis testing suite passed:
  `pnpm vitest run --project=unit tests/unit/testing.test.ts` reported 1
  passing test file and 4 passing tests.
- Runtime rest lint passed: `pnpm run lint:src:runtime:rest`.
- Test lint passed: `pnpm run lint:tests`.
- Contract type tests passed: `pnpm run test:types:contracts`.
- Formatter/whitespace check passed:
  `pnpm exec oxfmt --check src/runtime/testing/index.ts tests/unit/testing.test.ts && git diff --check`.
- Trellis module build passed: `pnpm run build:module`.
- Ginko CMS consumer proof passed after removing direct helper-level
  `targetFunctionRef`/replay plumbing:
  `pnpm vitest run test/refactor/workflow-vertical-slice.test.ts test/component/entries/publish.test.ts`
  reported 2 passing test files and 38 passing tests.

### Notes

- This does not add another testing transport path. It makes the existing
  trusted test caller default the same replay policy that Ginko was
  hand-maintaining.
- Operation-level test helpers still own destructive preview/confirm/execute
  behavior through generated operation handles.
- The Ginko cleanup was committed separately in `ginko-cms` as
  `4f3f901 test: rely on trellis test forwarding defaults`.

## Slice 67: Broader Ginko Check Against Local Trellis

### Proof

- RFC 0013 requires Ginko CMS to consume the generated Trellis operation path
  without copying Trellis protocol internals.
- A broad Ginko CMS check against the local Trellis workspace initially failed
  in `operations:check`: `packages/convex/generated/operationHandles/testing.ts`
  was out of date.
- Regenerating the testing and MCP operation handles changed only the trailing
  `operations` object assertion from `} as const` to `}`. That matches the
  Trellis build-safe operation handle generator behavior from
  `75b024e fix: make operation handles build safe`, and Trellis already has a
  unit expectation that generated Nuxt operation-handle modules do not contain
  the trailing `} as const`.
- The next broad check reached the full Vitest suite and failed one
  package-boundary allowlist: `@lupinum/ginko-cms-convex` exports
  `./operation-handles/mcp`, and Ginko MCP tools already import that canonical
  generated handle module.

### Implementation

- Committed the Ginko consumer sync separately in `ginko-cms`:
  `787a650 test: sync operation handle boundaries`.
- Regenerated the two derived Ginko operation-handle files:
  - `packages/convex/generated/operationHandles/testing.ts`
  - `packages/convex/src/generated/operationHandles/mcp.ts`
- Updated Ginko's package-boundary contract test to include the intentional
  `./operation-handles/mcp` Convex package export.

### Verification

- The initial Ginko broad gate failed as expected:
  `pnpm run check` stopped at `operations:check` with
  `generated/operationHandles/testing.ts` out of date.
- Generated drift check passed after regeneration:
  `pnpm run operations:check`.
- Focused package-boundary test passed:
  `pnpm vitest run test/module/package-boundaries.test.ts` reported 1 passing
  test file and 19 passing tests.
- Formatter/whitespace check passed:
  `pnpm exec oxfmt --check test/module/package-boundaries.test.ts packages/convex/generated/operationHandles/testing.ts packages/convex/src/generated/operationHandles/mcp.ts && git diff --check`.
- Full Ginko check passed:
  `pnpm run check` reported 90 passing test files, 1 skipped test file, 713
  passing tests, and 1 skipped test.
- The full check also exercised package typecheck/build and playground Nuxt
  prepare. The playground generated Trellis virtual operation modules for
  client, server, testing, MCP, operation refs, operation runtime, and operation
  projections without import-resolution failures.

### Notes

- This does not add a compatibility path or a second source of truth. It keeps
  Ginko's committed derived handles aligned with Trellis' current generator and
  acknowledges the already-used public MCP operation-handle export.
- The broad local-workspace Ginko consumer gate is now green. Remaining
  consumer proof still needs package/tarball verification and the `i18n-cms`
  app smoke/E2E pass when that slice starts.

## Slice 68: Trellis Release Gate And Operation Handle Cleanup

### Proof

- The full Trellis release gate exposed one remaining type-level leak before it
  passed: direct lane registration of `implementOperation(...)` still required
  consumer-side casts in the harness and workspace MCP fixture.
- Removing those casts proved the gap. `pnpm run release:verify` initially
  reached the harness server typecheck and failed on direct
  `mutation.authenticated(...)` / `mutation.workspace(...)` operation
  registrations.
- A later release attempt caught an explicit-`any` lint regression in the new
  lane overload types before the broader test phases ran.
- After fixing both issues, the full release gate completed cleanly.

### Implementation

- Added a metadata-branded `DefinedOperation` return type for
  `defineOperation(...)`, `defineOperation.withContext(...)`,
  `implementOperation(...)`, and `previewOf(...)`.
- Added lane overloads that accept metadata-branded defined operations directly
  while keeping inline lane object definitions strict.
- Removed positive-path `as never` casts from the harness and workspace MCP
  fixture operation registrations.
- Kept generated operation handles as the canonical import path for MCP tools
  and starter fixtures.
- Switched operation registry function refs to the generated Convex API path
  instead of the source target ref.
- Preserved identity-forwarding transport metadata through operation previews
  so transport-backed destructive operations stay bound to their verified lane.
- Kept the e2e harness on owned dynamic Convex/Nuxt ports so concurrent local
  runs do not depend on stale fixed ports.

### Verification

- Harness server typecheck passed:
  `pnpm exec tsc -p apps/harness/server/tsconfig.json --noEmit`.
- Focused runtime lint passed:
  `NODE_OPTIONS=--max-old-space-size=6144 pnpm exec eslint src/runtime/functions src/runtime/mcp --ignore-pattern '**/_generated/**'`.
- Formatter check passed for the touched function runtime file:
  `pnpm exec oxfmt --check src/runtime/functions/index.ts`.
- Type contract tests passed: `pnpm run test:types:contracts`.
- Focused operation/MCP tests passed:
  `pnpm vitest run --project=unit tests/unit/operation-descriptor.test.ts tests/unit/functions-defineTrellis.test.ts tests/unit/phase0-workspace-mcp-fixture.test.ts tests/unit/mcp-descriptor-boundary.test.ts`
  reported 4 passing test files and 90 passing tests.
- Module build passed: `pnpm run build:module`.
- Full release gate passed: `pnpm run release:verify` completed with exit code 0. The gate included format, lint, publish surface, compatibility matrix,
  type contracts, security tests, example doctor checks, starter fixture
  doctor/typecheck/build checks, full repo tests, e2e, generated Convex drift,
  pack workspace-ref checks, production audit, and final build.
- During the passing release gate, the broad repo test phase reported:
  - 132 unit test files and 1248 tests passed
  - 20 Convex test files and 121 tests passed
  - 22 Nuxt test files and 168 tests passed
  - 2 server test files and 21 tests passed
  - 2 browser test files and 6 tests passed
- The e2e phase reported 4 passing test files and 13 passing tests.
- Starter fixture validation passed for `public`, `personal`, `workspace`, and
  `workspace-mcp` across doctor, install, codegen, prepare, typecheck, and
  build.
- Convex generated drift check passed with 25 tracked generated files checked
  and no drift.

### Notes

- This is a hard cut, not a compatibility layer. Defined operations are accepted
  by lanes because they carry Trellis operation metadata, not because the lane
  types became loose for arbitrary objects.
- The generated operation handle and ref files remain derived artifacts. They
  are committed only where the repo already treats starter/harness generated
  files as release fixtures.
- `dream-spec.md` and `plan-vnext.md` still have unrelated formatter-only local
  edits and should stay out of this workpackage unless a separate docs cleanup
  is desired.

## Slice 69: Ginko CMS Tarball Proof Against Trellis f9add1a

### Proof

- The Trellis release gate proves the library in isolation, but Ginko CMS must
  also consume the packed package shape instead of sibling workspace source.
- The existing CMS package e2e script is the right proof because it rebuilds and
  packs CMS, Ginko Content, Trellis, and Trellis Bridge, then installs a temp
  Nuxt consumer using `file:` tarball dependencies.
- Existing `.pack` tarballs were stale after the Trellis workpackage commit
  `f9add1a`, so the tarball proof had to regenerate them.

### Verification

- `pnpm run package:e2e` passed in `/Users/matthias/Git/workspace/ginko-cms`.
- The run rebuilt CMS, Ginko Content, Trellis, and Trellis Bridge from the local
  sibling checkouts.
- `pnpm run release:pack` passed in `/Users/matthias/Git/workspace/trellis`
  after the CMS tarball proof and wrote fresh Trellis tarballs to
  `/Users/matthias/Git/workspace/trellis/.pack`.
- The run packed and installed these local tarballs into the temp consumer:
  - `lupinum-ginko-cms-0.1.3.tgz`
  - `lupinum-ginko-cms-contract-0.1.1.tgz`
  - `lupinum-ginko-cms-convex-0.1.2.tgz`
  - `lupinum-ginko-content-0.1.6.tgz`
  - `lupinum-trellis-0.3.1.tgz`
  - `lupinum-trellis-bridge-0.3.1.tgz`
- Packed tarball workspace-reference scan passed for all six tarballs.
- The temp consumer install resolved `@lupinum/trellis@0.3.1`,
  `@lupinum/trellis-bridge@0.3.1`, and `@lupinum/ginko-content@0.1.6` from
  local tarballs.
- `ginko-cms init`, `ginko-cms bridge check`, `trellis doctor`, Convex codegen,
  Nuxt prepare, Nuxt typecheck, and representative package import checks all
  passed.
- `trellis doctor` in the temp consumer reported 32 passed checks, 1 expected
  missing Convex URL warning, and 0 failures.

### Notes

- No Trellis code changes were needed after the tarball proof. The only Trellis
  worktree changes left are the unrelated local formatter edits in
  `dream-spec.md` and `plan-vnext.md`.
- `ginko-cms` and `ginko-content` worktrees were clean after the package e2e
  run; the refreshed `.pack` tarballs are ignored local artifacts.

## Slice 70: i18n-cms Consumer Proof Against Local Tarball Stack

### Proof

- The real consumer app is `/Users/matthias/Git/workspace/i18n-cms`, not only
  the temporary CMS package-e2e fixture.
- The consumer is wired to local tarballs for CMS, CMS Convex, CMS Contract,
  Ginko Content, Trellis, and Trellis Bridge via `file:../ginko-cms/.pack/...`
  dependencies and workspace overrides.
- `pnpm install --force` refreshed local tarball integrities in
  `i18n-cms/pnpm-lock.yaml`; no registry Trellis/Ginko package was used.

### Verification

- `pnpm run typecheck` passed in
  `/Users/matthias/Git/workspace/i18n-cms`.
- `pnpm run build` passed and prerendered 211 routes, including localized
  content routes, sitemap output, and content payload/API routes.
- `TMPDIR=/tmp GINKO_CMS_TEST_EMAIL=... GINKO_CMS_TEST_PASSWORD=...
pnpm run smoke:cms` passed. The short temp path avoids the local Node 26/Nuxt
  dev-server Vite IPC socket path issue observed under the default macOS temp
  directory.
- Built-server smoke passed against
  `CMS_SMOKE_BASE_URL=http://127.0.0.1:9999` after starting
  `node .output/server/index.mjs` with `.env.local` loaded.
- In-app browser verification passed for:
  - public docs/blog/pricing/changelog content in English and German
  - visible search from the docs search button returning `Markdown Syntax` and
    `Security Enhancements`
  - header locale switching from `/docs/code-blocks` to
    `/de/dokumentation/codebloecke`
  - Studio sign-out/sign-in with the configured smoke account
  - `/studio/settings` with settings, member, storage hygiene, and MCP key
    sections
  - representative Studio content routes:
    `/studio/content/docs`, `/studio/content/posts`,
    `/studio/content/index`, `/studio/assets`, and `/studio/activity`
- Direct XML sitemap navigation in the in-app browser is blocked by browser
  client policy with `net::ERR_BLOCKED_BY_CLIENT`, so sitemap output was
  verified with HTTP probes against the running app:
  - `/sitemap.xml` redirects to `/sitemap_index.xml`
  - `/sitemap_index.xml` references `/__sitemap__/en-US.xml` and
    `/__sitemap__/de-DE.xml`
  - locale sitemap files include `/docs/code-blocks`,
    `/de/dokumentation/codebloecke`, `/blog`, and `/de/blog`

### Notes

- No Trellis source change was needed from this consumer proof.
- A clean built-server browser tab had no new timestamp-filtered browser
  warnings/errors for the checked flows.
- There is a remaining non-blocking Vue Router warning for unprefixed translated
  German docs paths such as `/dokumentation/codebloecke`. Rendered links are
  correctly prefixed with `/de/...`, and direct navigation works. Treat this as
  a Ginko Content or consumer navigation cleanup candidate, not a Trellis
  release blocker.
- The built-server/browser proof is now stronger than the dev-server proof; the
  dev-server-specific IPC issue should not drive library design.

## Slice 71: Inventory-Backed Explain Feature And File Views

### Proof

- RFC 0013 names `trellis explain feature tasks` and
  `trellis explain file convex/features/tasks/domain.ts` as agent/developer
  affordances that must be projections from existing inventory, not a new
  handwritten manifest.
- Added failing CLI proof tests for:
  - JSON and human-readable `trellis explain feature tasks`
  - unknown feature diagnostics with available feature names
  - JSON `trellis explain file ...` for relative and absolute paths
  - human-readable file-level operation/projection output
- The initial focused run failed because the CLI rejected `feature` and `file`
  as invalid explain topics. That proved the tests exercised the missing RFC
  surface instead of only changing output snapshots.

### Implementation

- Extended `trellis explain` topic validation to accept `feature` and `file`.
- Built feature reports by joining `inventory.features` to existing permission,
  operation, projection, and MCP tool inventory by export name and operation id.
- Built file reports by normalizing absolute or relative paths and filtering
  existing feature, permission, permission-inventory, operation, projection, and
  MCP tool facts by source path.
- Kept missing feature refs visible as `missingPermissionRefs` and
  `missingOperationRefs` so explain can expose drift without becoming another
  source of truth.
- Did not add a new manifest, cache, registry, or scanner. Both new views are
  derived from the same inventory paths already used by app, operation, tool,
  and permission explain output.

### Verification

- Initial proof run failed as expected:
  `pnpm vitest run --project=unit tests/unit/cli-explain.test.ts -t "explains a feature|human-readable feature|unknown feature|file-level inventory|human-readable file"`.
- CLI build passed: `pnpm run build:cli`.
- Focused proof rerun passed with 6 tests passing:
  `pnpm vitest run --project=unit tests/unit/cli-explain.test.ts -t "explains a feature|human-readable feature|unknown feature|file-level inventory|human-readable file"`.
- Full explain suite passed with 26 tests passing:
  `pnpm vitest run --project=unit tests/unit/cli-explain.test.ts`.
- Source lint passed: `pnpm run lint:src:core`.
- Focused test lint passed: `pnpm exec eslint tests/unit/cli-explain.test.ts`.
- Formatter check passed for the touched source and test files:
  `pnpm exec oxfmt --check src/cli/commands/explain.ts tests/unit/cli-explain.test.ts`.
- Final CLI rebuild passed after formatting: `pnpm run build:cli`.
- Final focused rerun against rebuilt `dist/cli.mjs` passed with 4 selected
  tests passing:
  `pnpm vitest run --project=unit tests/unit/cli-explain.test.ts -t "explains a feature|file-level inventory|human-readable file"`.

### Notes

- `trellis explain file` intentionally returns a successful empty report with
  `matched: false` for files that have no Trellis inventory facts. That keeps
  the command useful for agent inspection without requiring a separate file
  existence scanner.
- `dream-spec.md` and `plan-vnext.md` still have unrelated local edits and are
  not part of this workpackage.

## Slice 72: Explicit Server Operation Adapter

### Proof

- RFC 0013 calls for explicit server-route adapters instead of automatic route
  projections. Server routes should keep ownership of HTTP concerns while
  Trellis chooses generated operation refs and forwards through the normal
  server Convex auth path.
- Existing operation codegen already emits `#trellis/operations/server` aliases
  and runtime-filtered handles with `runtimes: ['server']`.
- Added failing runtime proof tests for:
  - query-backed server operation handles using the Convex query endpoint
  - destructive preview plus execute with `{ confirmation: preview.confirmation }`
  - action-backed execute calls using the Convex action endpoint
  - rejection of handles not generated for the server runtime
  - explicit `.query(...)` versus `.execute(...)` lane errors
- Added a failing public DTS proof for `@lupinum/trellis/server` exporting
  `serverOperation` with args/result/confirmation typing.
- The initial proof failed because `serverOperation` was not exported at
  runtime or in the public server type surface.

### Implementation

- Added `src/runtime/server/operation.ts` with `serverOperation(event, handle)`.
- Reused `serverConvexQuery`, `serverConvexMutation`, and
  `serverConvexAction`; no new transport, fetch path, manifest, or operation
  registry was added.
- Required generated operation handles and failed closed unless the handle
  includes the `server` runtime.
- Kept route semantics explicit:
  - `.query(...)` only accepts query execute projections
  - `.execute(...)` accepts mutation/action projections
  - `.preview(...)` uses the generated preview projection kind
- Added execute options that accept `confirmation` as either a preview
  confirmation object or raw token and map it to the backend
  `_confirmationToken` arg field.
- Exported the adapter and public option/result types from
  `@lupinum/trellis/server`.

### Verification

- Initial proof run failed as expected:
  `pnpm vitest run --project=unit tests/unit/server-operation.test.ts` and
  `pnpm run test:types:public`.
- Focused runtime proof passed with 11 tests:
  `pnpm vitest run --project=unit tests/unit/server-operation.test.ts tests/unit/server-index-exports.test.ts`.
- Public type proof passed: `pnpm run test:types:public`.
- Runtime/server lint passed: `pnpm run lint:src:runtime:rest`.
- Focused test lint passed:
  `pnpm exec eslint tests/unit/server-operation.test.ts tests/unit/server-index-exports.test.ts`.
- Formatter check passed for the touched source, unit, and DTS files:
  `pnpm exec oxfmt --check src/runtime/server/operation.ts src/runtime/server/index.ts tests/unit/server-operation.test.ts tests/unit/server-index-exports.test.ts tests/dts/server-operation.types.ts`.
- Module build passed and emitted `dist/runtime/server/operation.{mjs,d.ts}`:
  `pnpm run build:module`.
- Public package surface check passed: `pnpm run check:publish-surface`.
- API surface docs check passed: `pnpm run check:docs:api-surface`.

### Notes

- This is intentionally only an operation adapter. Webhook HMAC verification,
  body parsing, idempotency decisions, response status codes, downloads,
  streams, and provider-specific validation stay in the Nitro route.
- The existing installer test already proves `#trellis/operations/server` alias
  generation. A later fixture can still add a real Nitro server-route import
  proof if consumer work shows Nuxt resolution differs from the current template
  and type tests.
- `dream-spec.md` and `plan-vnext.md` still have unrelated local edits and are
  not part of this workpackage.

## Slice 73: Nuxt Server Route Operation Alias Proof

### Proof

- The server operation adapter slice proved runtime and public typing, but not
  a real Nitro file importing generated server handles from
  `#trellis/operations/server`.
- Extended the maintained `phase0-workspace-mcp` Nuxt fixture proof to require:
  - generated `.nuxt/trellis/operation-handles/server.ts` handles with
    `runtimes: ['server']`
  - `.nuxt/tsconfig.json` path aliases for `#trellis/operations/server`
  - a real `server/api/projects.post.ts` route importing
    `serverOperation` from `@lupinum/trellis/server`
  - the same route importing `operations` from `#trellis/operations/server`
  - no route import of generated file paths or operation-ref internals
- The initial focused run failed with `ENOENT` for
  `server/api/projects.post.ts`, proving the maintained fixture did not yet
  cover the RFC server-route import path.

### Implementation

- Added a source alias for `@lupinum/trellis/server` in the fixture
  `nuxt.config.ts`, matching the existing app/auth/backend/MCP/workspace source
  aliases. This avoids relying on a previously built `dist` directory during
  fixture typecheck.
- Added `server/api/projects.post.ts` to the fixture. The route:
  - owns HTTP body parsing and request validation
  - imports `serverOperation` from `@lupinum/trellis/server`
  - imports generated server handles from `#trellis/operations/server`
  - calls `serverOperation(event, operations.projects.create).execute(...)`
  - does not import generated handle files, operation refs, or Convex
    implementation modules directly
- Updated the fixture proof name to cover both MCP and server operation handles.

### Verification

- Initial proof run failed as expected:
  `pnpm vitest run --project=unit tests/unit/operation-alias-no-permission-codegen.test.ts`.
- Focused fixture proof passed after implementation. The test runs real
  `nuxi prepare` and `nuxi typecheck` against
  `/Users/matthias/Git/workspace/trellis/tests/fixtures/phase0-workspace-mcp`.
- Formatter check passed:
  `pnpm exec oxfmt --check tests/unit/operation-alias-no-permission-codegen.test.ts tests/fixtures/phase0-workspace-mcp/nuxt.config.ts tests/fixtures/phase0-workspace-mcp/server/api/projects.post.ts`.
- Focused lint passed:
  `pnpm exec eslint tests/unit/operation-alias-no-permission-codegen.test.ts tests/fixtures/phase0-workspace-mcp/nuxt.config.ts tests/fixtures/phase0-workspace-mcp/server/api/projects.post.ts`.

### Notes

- This is a stronger import-resolution proof than the earlier installer unit
  test because Nuxt generates `.nuxt/tsconfig.json`, then the server route is
  typechecked through `nuxi typecheck`.
- The route remains intentionally small. Product authorization stays in the
  operation lane; the route owns only HTTP boundary details.
- `dream-spec.md` and `plan-vnext.md` still have unrelated local edits and are
  not part of this workpackage.

## Slice 74: Workspace Entity Generator Invariant Tests

### Proof

- RFC 0013 says `trellis add entity project --workspace --mcp` should produce a
  complete operation slice with tests for tenant isolation and role denial.
- The current workspace resource generator already emitted same-tenant owner
  update and same-tenant ownership-denial tests, but it did not explicitly emit:
  - a cross-tenant isolation test
  - a role-denial test for a lower-privilege workspace role
- Added failing generator assertions that the generated
  `convex/features/projects/tests.ts` contains:
  - `keeps tenants isolated from each other`
  - a cross-tenant `get` denial through
    `beta.users.member.query(api.features.projects.domain.get, ...)`
  - `denies a viewer creating a project`
- The initial focused run failed because those tests were absent from the
  generated workspace resource slice.

### Implementation

- Extended the workspace resource test template in `src/cli/lib/resource.ts`.
- The generated test file now includes:
  - cross-tenant list isolation for two seeded workspaces
  - cross-tenant by-id `get` denial
  - viewer-role create denial
- No generator state, new manifest, compatibility path, or runtime abstraction
  was added. This is a direct strengthening of the generated invariant tests.

### Verification

- Initial proof run failed as expected:
  `pnpm vitest run --project=unit tests/unit/cli-add-resource.test.ts -t "workspace resource slice"`.
- Focused proof passed after implementation:
  `pnpm vitest run --project=unit tests/unit/cli-add-resource.test.ts -t "workspace resource slice"`.
- Full add-resource suite passed with 9 tests:
  `pnpm vitest run --project=unit tests/unit/cli-add-resource.test.ts`.
- Focused lint passed:
  `pnpm exec eslint src/cli/lib/resource.ts tests/unit/cli-add-resource.test.ts`.
- Formatter check passed:
  `pnpm exec oxfmt --check src/cli/lib/resource.ts tests/unit/cli-add-resource.test.ts`.

### Notes

- This closes the narrow RFC generator gap around tenant-isolation and
  role-denial test generation. It does not claim the whole resource generator is
  product-grade yet.
- The next generator audit should look at generated-file classification and
  first-run starter validation for `trellis add entity project --workspace --mcp`.
- `dream-spec.md` and `plan-vnext.md` still have unrelated local edits and are
  not part of this workpackage.

## Slice 75: Generated Operation Descriptor Return Contracts

### Proof

- RFC 0013 pushes MCP-facing writes through shared operation descriptors, so the
  generated descriptor is the public contract boundary for tools and server
  callers.
- The `trellis add entity project` workspace-MCP generator emitted descriptors
  with `args`, `permission`, and `safety`, but it did not emit explicit result
  validators:
  - create returned a Convex document id without `returns`
  - destructive remove returned `null` without `returns`
  - destructive remove preview returned a confirmation payload without
    `previewReturns`
- Added failing assertions to the existing workspace-MCP add-resource proof for
  the generated `shared/features/projects/operations.ts` contract:
  - import `operationPreviewValidator`
  - import Convex `v`
  - create descriptor has `returns: v.id('projects')`
  - remove descriptor has `previewReturns: operationPreviewValidator(...)`
  - remove descriptor has `returns: v.null()`
- The initial focused proof failed because the generated descriptor only
  imported `defineOperationDescriptor`.

### Implementation

- Updated `resourceOperationDescriptorTemplate` in `src/cli/lib/resource.ts`.
- Generated MCP-facing resource descriptors now include:
  - `returns: v.id('<table>')` for create operations
  - `previewReturns: operationPreviewValidator({ confirm: ... })` for
    destructive remove previews
  - `returns: v.null()` for remove execution
- No duplicate implementation metadata was added. The descriptor remains the
  source of truth, and `implementOperation(...)` already validates drift and
  carries descriptor-owned return metadata into the concrete operation.

### Verification

- Initial proof run failed as expected:
  `pnpm vitest run --project=unit tests/unit/cli-add-resource.test.ts -t "MCP-facing resource"`.
- Focused proof passed after implementation:
  `pnpm vitest run --project=unit tests/unit/cli-add-resource.test.ts -t "MCP-facing resource"`.
- Full add-resource suite passed with 9 tests:
  `pnpm vitest run --project=unit tests/unit/cli-add-resource.test.ts`.
- Focused lint passed:
  `pnpm exec eslint src/cli/lib/resource.ts tests/unit/cli-add-resource.test.ts`.
- Formatter check passed:
  `pnpm exec oxfmt --check src/cli/lib/resource.ts tests/unit/cli-add-resource.test.ts journal2.md`.

### Notes

- This closes the generator contract gap for operation return metadata. It does
  not close generated-file classification, first-run starter validation, or the
  backend-only destructive exposure audit.
- `dream-spec.md` and `plan-vnext.md` still have unrelated local edits and are
  not part of this workpackage.

## Next Slice Candidates

1. Continue the `trellis add entity project --workspace --mcp` audit for
   generated-file classification and first-run starter validation.
2. Close the backend-only destructive exposure requirement with explicit
   metadata, doctor/explain visibility, and filtered handle generation, if the
   current operation registry cannot already prove it.
3. After the remaining RFC slices are implemented, rerun full
   `pnpm run release:verify`, regenerate local tarballs, and rerun the CMS and
   i18n consumer proofs.
