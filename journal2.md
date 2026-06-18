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

## Next Slice Candidates

1. Hard-cut remaining starter resources and examples to generated handles where
   the registry can own projection refs and MCP operation kinds.
