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

## Next Slice Candidates

1. Split public-surface extraction into core operation registry and surface
   inventory.
2. Teach the scanner the RFC 0013 canonical projection grammar:
   `mutation.workspace(op)` and `mutation.workspace.preview(op)`.
3. Generate runtime-filtered handle modules from scanned projection facts.
4. Add scanner golden tests for rejected dynamic/aliased/re-exported forms.
5. Replace one maintained MCP example with generated handles after scan-backed
   handles exist.
