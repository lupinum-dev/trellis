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

## Next Slice Candidates

1. Generate runtime-filtered handle modules from scanned projection facts.
2. Add scanner diagnostics for re-exported projection forms.
3. Replace one maintained MCP example with generated handles after scan-backed
   handles exist.
