# 0006: Narrow Trusted MCP Convex Caller

Status: Proposed
Date: 2026-06-03

## Summary

Add one narrow helper for the official MCP-to-Convex trusted caller path. The helper should remove
repeated security boilerplate without becoming a generic adapter layer.

## Problem

MCP tools run on the Nuxt server while protected business logic lives in Convex. To call protected Convex
functions, the server may need to forward a trusted identity envelope with:

- the MCP caller subject
- the represented user, when acting for a user
- the server-only identity forwarding key

Apps currently repeat branching around `createServerConvexCaller(event, { auth: 'trusted', caller,
actingFor })`. Small mistakes can change who Convex thinks is calling.

## Before

Each MCP runtime resolves anonymous versus agent versus acting-for behavior by hand:

```ts
const convex = caller
  ? createServerConvexCaller(event, {
      auth: 'trusted',
      caller,
      ...(actingFor ? { actingFor } : {}),
    })
  : createServerConvexCaller(event, { auth: 'none' })
```

## After

Apps resolve the MCP caller once and pass it to a narrow helper:

```ts
const convex = createMcpConvexCaller(event, {
  caller,
  actingFor,
})
```

The helper handles the standard auth mode selection and forwarding-key source.

The MCP runtime should also avoid duplicated permission fallback maps. If a request has no access
snapshot, Trellis should derive an empty or denied capability snapshot from registered tool permissions,
or require one explicit access projection source. Tool permission keys must not be repeated in ad hoc
runtime fallback objects.

## Proposal

Add a server export with a constrained input type:

```ts
type McpConvexCallerOptions =
  | { caller: null; actingFor?: never }
  | { caller: { subject: Subject } & Record<string, unknown>; actingFor?: ActingFor }

function createMcpConvexCaller(event: H3Event, options: McpConvexCallerOptions)
```

Rules:

- `caller: null` uses `auth: 'none'`
- caller present uses `auth: 'trusted'`
- `actingFor` is included only when present
- forwarded identity requires a caller
- identity forwarding key is read through the existing server-only path
- bridge manifests or integration metadata may declare ordered server-only key aliases that resolve to
  the same canonical forwarding key
- no business permission checks occur in the helper
- no custom forwarding envelope formats are allowed
- fallback capability snapshots are derived from registered tool permissions or one explicit access
  projection, not duplicated by hand

## Tradeoffs

This adds a helper, which is usually expensive. Here it is justified because the repeated code is
security-sensitive and part of the canonical MCP pattern.

The helper must stay narrow. It should not know about app roles, workspace membership, token tables, or
tool definitions. Those belong in app domain code and Convex authorization.

Integration-specific environment aliases are acceptable because they improve product setup without
changing the trust model. The envelope format and verification rules remain Trellis-owned.

## Rejected Options

- Leave all apps to call `createServerConvexCaller` directly: rejected because the repeated branch is easy
  to get wrong.
- Create a generic server-call adapter: rejected because it would hide too much and invite abstraction
  drift.
- Put permission checks in the helper: rejected because backend invariants belong in Convex domain logic.
- Duplicate tool permission fallback maps in app runtimes: rejected because every added tool would create
  a second permission source of truth.
- Allow custom forwarding envelopes for integrations: rejected because it weakens a security boundary.

## Acceptance Criteria

- MCP runtime files become shorter and no longer repeat auth-mode branching.
- Passing `actingFor` without a caller is impossible or throws clearly.
- Anonymous MCP calls use `auth: 'none'`.
- Agent and acting-for MCP calls use trusted forwarding.
- Existing `createServerConvexCaller` remains available for non-MCP server paths.
- The shadcn Trellis template MCP runtime can collapse to one helper call for trusted Convex forwarding.
- MCP runtimes do not maintain separate hard-coded denied permission maps for tool permissions.
- Integration env aliases can resolve to the canonical forwarding key without changing envelope format.

## Verification

- Unit tests for anonymous, caller-only, caller-plus-acting-for, and invalid acting-for-only inputs.
- Type tests for invalid states where possible.
- Server helper tests proving the produced calls use the expected auth options.
- Tests that registered tool permissions can produce a denied snapshot without app-maintained fallback
  maps.
- Tests for ordered server-only forwarding key aliases declared by integration metadata.
