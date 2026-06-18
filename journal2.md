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

## Next Slice Candidates

1. Sweep maintained examples and starter fixtures for remaining raw unsafe
   operation registrations or stale operation/bootstrap patterns.
2. Push generated testing handles into Ginko CMS tests and delete
   `handlerIdByFunctionRef` / destructive transport maps from the consumer.
3. Add a first fail-closed stale-registry check outside Nuxt prepare so generated
   operation files can be validated by package/consumer tests without virtual
   aliases.
