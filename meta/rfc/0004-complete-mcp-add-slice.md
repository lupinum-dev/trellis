# 0004: Complete MCP Add Slice

Status: Proposed
Date: 2026-06-03

## Summary

`trellis add mcp` must generate a complete, typecheckable MCP slice. Generated code should be trusted
until the user changes it.

## Problem

The current add-slice file list can omit helper files imported by generated middleware. That means
`trellis add mcp` can create code with a missing import before the user has changed anything.

This is not a design tradeoff. It is scaffold incompleteness.

## Before

The generated middleware imports:

```ts
import { assertInvalidBearerBudget, recordInvalidBearer } from '../lib/mcp-invalid-bearer-throttle'
```

But the add-slice path list does not include `server/lib/mcp-invalid-bearer-throttle.ts`.

## After

`trellis add mcp` writes every file required by the generated imports, updates config and schema, and
produces an app that typechecks without manual copying.

## Proposal

1. Add `server/lib/mcp-invalid-bearer-throttle.ts` to the MCP add fixture path list.
2. Add an import-resolution test for the generated MCP add slice.
3. Add a typecheck-oriented test that runs `trellis add mcp` against a workspace starter and verifies the
   resulting file graph.
4. Keep the add slice hard-cut and canonical. Do not generate fallback imports or optional no-op
   throttle files.

## Tradeoffs

This adds a small test cost but prevents broken generated apps. The test should verify the generated
result, not only snapshot the path list, because a snapshot can repeat the same omission.

## Rejected Options

- Remove the throttle import: rejected because invalid bearer throttling is part of the canonical MCP
  security baseline.
- Inline throttling into middleware: rejected because the helper is already a coherent small unit and has
  independent tests.
- Generate a no-op fallback: rejected because it weakens the default security story.

## Acceptance Criteria

- `trellis add mcp` writes `server/lib/mcp-invalid-bearer-throttle.ts`.
- The generated MCP add slice has no missing relative imports.
- A workspace app after `trellis add mcp` typechecks.
- The result includes endpoint, middleware, runtime, example tools, MCP key domain code, schema updates,
  dependency updates, and required Nuxt config updates.

## Verification

- Add a unit test around `getAddTemplateSet({ feature: 'mcp' })`.
- Add a CLI test that initializes a workspace app, runs `add mcp`, and checks generated imports.
- Run `pnpm run build:cli`.
- Run the starter fixture typecheck/build scripts after implementation.
