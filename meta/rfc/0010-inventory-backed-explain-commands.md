# 0010: Inventory-Backed Explain Commands

Status: Proposed
Date: 2026-06-03

## Summary

Expand `trellis explain` beyond operations so developers and agents can ask where a feature, permission,
or MCP tool comes from. The command should reuse the existing inventory and not create a second metadata
source.

## Problem

The confusing questions during template setup were broader than operations:

- where is this permission defined?
- which feature owns this table?
- which MCP tool projects this backend function?
- where does this public surface come from?
- why does this access context have this permission?

Trellis inventory already collects much of this, but `explain` exposes only a narrow part. Without a
command, developers and agents fall back to grepping and inference.

## Before

`trellis explain operation <id>` reports operation source, projections, MCP tools, and feature refs.
Other concepts are not directly explainable.

## After

The CLI supports:

```bash
trellis explain feature tasks
trellis explain permission tasks.create
trellis explain tool create-todo
trellis explain operation tasks.archive
```

Each command returns human-readable output and versioned JSON.

`trellis explain ...` is the single command family for "where does this come from?" questions. Matrix
output belongs to `trellis permissions matrix`; do not add a parallel `trellis permissions explain`
command.

## Proposal

Add explain topics from existing inventory:

### Feature

Report:

- feature export name
- display/name key
- source file and line
- declared tables
- operations
- permissions
- public surfaces
- related MCP tools

### Permission

Report:

- permission key
- source file and line
- owning feature if known
- projected access context references
- related guards or operation refs if inventory can identify them

### Tool

Report:

- tool name
- source file and line
- raw tool versus operation-backed tool
- backend function or operation if known
- permission or destructive-operation safety status if known

Keep output factual. Do not evaluate policy beyond existing doctor findings.

## Tradeoffs

This increases CLI surface area. The value is high because it turns framework structure into a queryable
map for humans and agents.

The risk is inventing new metadata. Avoid that by only reporting what inventory already knows or by
improving inventory as the single source of truth.

## Rejected Options

- Add docs pages for each concept instead: rejected because apps need project-specific answers.
- Add a separate explain metadata file: rejected because it creates another source of truth.
- Make explain perform deep semantic analysis first: rejected because the initial version should expose
  existing inventory directly.
- Add `trellis permissions explain`: rejected because it creates a second explain surface. Use
  `trellis explain permission <key>`.

## Acceptance Criteria

- `trellis explain feature <name>` works for inventory features.
- `trellis explain permission <key>` works for known projected permissions.
- `trellis explain tool <name>` works for MCP tools.
- Missing ids fail clearly and list available ids.
- JSON output is versioned and stable enough for agents.
- Existing operation explain behavior remains intact.
- No separate `trellis permissions explain` command is added.

## Verification

- Extend `tests/unit/cli-explain.test.ts`.
- Add fixtures with feature, permission, operation-backed tool, and raw tool.
- Assert human and JSON output.
- Run `pnpm run build:cli` and `pnpm run test:contracts:repo`.
