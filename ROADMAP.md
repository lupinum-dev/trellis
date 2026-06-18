# Trellis Roadmap

Status: Active planning
Date: 2026-06-03

This roadmap tracks the current release plan. Durable architecture decisions belong in `meta/adr`.
Detailed proposals belong in `meta/rfc`. This file is only the sequencing guide.

## Product Principle

Trellis should be easy to start, hard to misuse, mostly rigid by default, and flexible through explicit
advanced seams.

The model is Vue and Nuxt:

- one obvious beginner path
- conventions that install boring lifecycle automatically
- generated output that works before the user changes it
- diagnostics that fail near the cause
- advanced APIs that exist but are not presented as parallel first choices

## 0.2: Operation Ladder

Primary RFC: [0011: Hard-Cut Operation Ladder Release](./meta/rfc/0011-hard-cut-operation-ladder-release.md)
Implementation checklist: [0.2 Workpackages](./meta/0.2-workpackages.md)
Finalization sprint: [0.2 Sprint Plan](./meta/0.2-sprint-plan.md)

### Goal

Make Trellis feel like a progressive app framework instead of a collection of expert primitives.

A new user should be able to define and call one useful operation before learning feature manifests,
operation descriptors, MCP wrappers, tenant isolation internals, or bridge mechanics.

### Final Experience

```bash
pnpm dlx @lupinum/trellis init my-app
cd my-app
pnpm install
pnpm dev:local
```

Then add capabilities as needed:

```bash
trellis add auth
trellis add workspace
trellis add mcp
```

The beginner app DSL is:

```ts
import { operation, workspaceScope } from '@lupinum/trellis/app'
```

The package root remains the Nuxt module entry:

```ts
export default defineNuxtConfig({
  modules: ['@lupinum/trellis'],
})
```

### 0.2 Scope

- Add `@lupinum/trellis/app` as the beginner runtime API.
- Make `operation` the primary authoring primitive.
- Add operation projections for Convex handlers and MCP tools.
- Add first-class destructive operation authoring.
- Add `workspaceScope(...)` as explicit metadata plus a validated `ctx.workspaceId`.
- Do not add `ctx.scope.table(...)` or `ctx.scope.insert(...)`.
- Move current backend builder primitives to advanced docs.
- Make auth bootstrap Trellis-owned by default.
- Split auth bootstrap runtime state from devtools state.
- Make MCP async context module-owned and doctor-checked.
- Make `trellis add mcp` generate a complete protected bearer-key MCP slice.
- Add `createMcpConvexCaller(...)` for trusted MCP Convex calls.
- Add runtime permission explanations.
- Add `trellis explain permission <key>`.
- Add `trellis permissions matrix`.
- Make doctor findings composable for integration-owned CLIs.
- Make generated app engine and env baselines explicit.
- Rewrite starters and beginner examples to the operation ladder.

### 0.2 Non-Goals

- No permission override tables.
- No tenant-defined role overlays.
- No record-sharing tables.
- No permission audit-event tables.
- No scoped DB wrappers.
- No generic integration adapters.
- No public unauthenticated MCP default.
- No compatibility aliases that make old and new APIs equally blessed.
- No Viteplus migration unless it becomes a direct prerequisite.

### 0.2 Acceptance Gate

- `trellis init` output typechecks and runs.
- `trellis add auth`, `trellis add workspace`, and `trellis add mcp` output typechecks and runs.
- Presets are mechanically equivalent shortcuts over the ladder.
- MCP readiness includes a real `tools/call`, not only initialization and `tools/list`.
- The shadcn Trellis template can delete app-owned auth bootstrap and MCP forwarding glue.
- Ginko-style integrations can compose Trellis doctor findings without exposing Trellis as the public
  product setup.
- `pnpm run release:verify` passes.

## 0.3: Nuxt-Native DX Compression

Primary RFC: [0013: Nuxt-Native Operation Framework](./meta/rfc/0013-nuxt-native-operation-framework.md)

### Goal

Make the current secure operation model feel like a Nuxt framework path instead of an expert toolkit.

The feedback after the 0.2/0.3 operation work is consistent: Trellis has the right foundation, but
ordinary app code and Ginko-style integrations still see protocol details that the framework should own.
The next release should compress the authoring surface before adding new authorization state.

### Scope

- Remove handwritten `executeFunctionRef` strings from normal app operations.
- Derive operation execute/preview refs from projected Convex function exports.
- Make one-line `tool.operation(operation, options)` the normal MCP binding path.
- Add operation-aware test clients so app and consumer tests stop maintaining forwarding maps.
- Promote `trellis add entity` into a product-grade feature slice generator with tests and strong
  contract metadata.
- Add `useTrellisOperation` for preview/confirm/execute UI flows.
- Expand `trellis explain` and `doctor --agent` from existing inventory rather than adding a new
  app manifest.
- Keep Ginko CMS as the real consumer gate: Ginko should delete its Trellis protocol helper maps.
- Fix first-run and identity documentation drift before larger runtime changes.

### Non-Goals

- No permission grant/deny tables.
- No tenant role overlays.
- No record-sharing tables.
- No permission audit-event tables.
- No generic `trellis.config.ts`.
- No new handwritten app manifest parallel to `defineFeature(...)`, `composeFeatures(...)`, and
  `defineAppInventory(...)`.
- No compatibility shims for unreleased internal authoring paths.

### Acceptance Gate

- Maintained examples no longer require stringly operation execute refs in normal app code.
- MCP reference tools use one-line operation binding for the common case.
- Generated workspace-MCP entity slices include tests and operation-backed MCP tools without manual
  ref binding.
- `trellis explain operation <id>` can show execute projection, preview projection, feature owner, and
  MCP tool exposure.
- `trellis doctor --agent` reports missing operation projections and missing MCP contract metadata.
- Ginko CMS check passes after removing downstream function-ref translation maps.
- `pnpm run release:verify` passes.

## Later: Explicit Grants And Denies

Primary future issue: [#7](https://github.com/lupinum-dev/trellis/issues/7)

Add the smallest useful extra authorization state only after 0.3 proves the base operation graph is
native-feeling, explainable, and projected from one source of truth.

Required before implementation:

- a dedicated RFC
- deny-wins decision order
- scoped grant shape
- expiration behavior
- `explainPermission(...)` integration
- generated invariant tests

## Later: Permission Audit Events

Primary future issue: [#11](https://github.com/lupinum-dev/trellis/issues/11)

Add audit events for authorization changes after explicit grants and denies exist.

This should log changes, not every permission check.

Required before implementation:

- a dedicated RFC
- event vocabulary
- actor/target/workspace fields
- retention guidance
- admin-query helper
- tests proving grant, deny, and revoke events are recorded

## Later: Record Sharing

Primary future issue: [#9](https://github.com/lupinum-dev/trellis/issues/9)

Add direct record shares only after grants and audit are stable.

Start with direct user-to-record sharing. Do not start with graph traversal, recursive groups, or a full
ReBAC engine.

## Later: Tenant Role Overlays

Primary future issue: [#8](https://github.com/lupinum-dev/trellis/issues/8)

Add tenant-defined roles only after Trellis can safely explain base permissions, overrides, audits, and
record shares.

Tenant admins must never invent permission keys. App code remains the permission vocabulary source.

## Later: Scoped DB Helpers

Scoped DB helpers such as `ctx.scope.table(...)` are intentionally deferred.

They should be considered only if explicit `ctx.workspaceId` still leaves repeated, test-proven mistakes
that cannot be solved by operation metadata, inventory validation, generated examples, or doctor
findings.

## Integration Policy

Packaged integrations such as Ginko CMS are first-class consumers, but they own their product-facing
setup.

Trellis owns:

- runtime invariants
- bridge mechanics
- forwarding envelope rules
- composable doctor findings
- generated host-file validation primitives

The integration owns:

- public CLI labels
- product docs
- product setup commands
- domain-specific MCP tools and token tables when they satisfy Trellis security invariants

`@lupinum/trellis-bridge` remains the public bridge contract for packaged integrations.
