# 0003: MCP Async Context Enforcement

Status: Proposed
Date: 2026-06-03

## Summary

Trellis MCP runtime should not allow an app to reach a half-working state where MCP discovery works but
tool execution fails because Nitro async context is missing.

## Problem

MCP handlers need request-scoped context across nested async calls. Trellis server helpers read the
current event, session, headers, runtime config, and MCP session state. Nitro preserves that context only
when async context is enabled.

Without it, the endpoint may still respond to initialization and tool listing. Failure appears later when
a tool call reaches a helper that needs the active request context. That is the worst kind of setup
failure: the app looks installed until the first real operation.

## Before

The MCP reference example enables:

```ts
nitro: {
  experimental: {
    asyncContext: true,
  },
}
```

The workspace MCP starter can omit it, and Trellis currently relies on runtime errors to mention the
missing setting.

The canonical setting for Trellis MCP execution is `nitro.experimental.asyncContext = true`. Root-level
Nuxt `experimental.asyncContext` is not accepted as equivalent unless Nuxt/Nitro proves it enables the
same request context for MCP `tools/call` execution.

## After

When MCP is present, official starters and `trellis add mcp` include the required Nitro option. The Nuxt
module also enforces or applies the setting during setup. Doctor reports missing async context as a
setup finding.

## Proposal

Use three layers:

1. Starter and add-slice correctness:
   - `workspace-mcp` fixture includes `nitro.experimental.asyncContext = true`.
   - `trellis add mcp` inserts or preserves that setting.

2. Module behavior:
   - If Trellis MCP is configured or `@nuxtjs/mcp-toolkit` is registered, set
     `nuxt.options.nitro.experimental.asyncContext = true`.

3. Doctor behavior:
   - Evaluate the effective Trellis setup, not only the source config text.
   - Report a fail only when MCP is present and async context will not be enabled by generated config or
     module setup.
   - Report a fail when source config uses a root-only async-context setting that does not satisfy Nitro
     MCP execution.

## Tradeoffs

Auto-enabling the option mutates user Nuxt config at runtime. That is acceptable for the default Trellis
MCP path because async context is a runtime prerequisite, not a style preference.

The main risk is deployment targets where async context behaves differently. The safer default is still
to enable it because the MCP runtime already depends on it. Apps with unusual targets can avoid the
Trellis MCP runtime and use an advanced integration path.

## Rejected Options

- Runtime error only: rejected because discovery can pass and execution can fail later.
- Docs only: rejected because the setting is easy to miss and hard to diagnose.
- Require every app to set it manually: rejected because official MCP setup should be complete.
- Add a parallel MCP runtime that avoids async context: rejected because it would duplicate request
  context plumbing.

## Acceptance Criteria

- `workspace-mcp` starter includes async context.
- `trellis add mcp` produces a config with async context enabled.
- A Nuxt app with MCP and no explicit setting gets async context enabled by the Trellis module.
- Doctor fails when effective setup will not enable Nitro async context.
- Tool call smoke tests include `tools/call`, not only endpoint initialization or `tools/list`.
- `trellis add mcp` conformance covers both async context and generated import resolution as one MCP
  readiness gate.

## Verification

- Add/adjust starter fixture tests.
- Add a doctor fixture for MCP without async context.
- Add a module setup test proving Trellis sets the Nitro option when MCP is detected.
- Add an MCP smoke test that performs a real `tools/call`.
- Run `pnpm run test:contracts:repo` and starter fixture checks.
