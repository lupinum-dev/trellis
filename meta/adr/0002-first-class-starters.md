# 0002: Keep Starter Lanes First-Class

Status: Accepted
Date: 2026-04-29
Updated: 2026-06-05

## Context

The repository contains generated starter lanes for public, personal,
workspace, and agent-enabled workspace apps. Older planning material mentioned a
`cms` starter and described MCP only as a capability, which created unnecessary
conflict with the implementation and hid one of Trellis's core product
advantages.

MCP is first-class in Trellis. It must still project the workspace backend model
instead of creating a second agent-only authorization system.

## Decision

Treat the current starter lanes as first-class:

- `public`
- `personal`
- `workspace`
- `workspace-mcp`

`workspace-mcp` is the first-class agent-enabled workspace lane. `trellis add
mcp` remains the progressive path for an existing workspace app.

CMS product setup is not a Trellis starter lane unless a future decision adds a
maintained generator, fixture, example, and verification contract. Component and
bridge examples may reference CMS-shaped integrations without making CMS a
beginner starter.

## Consequences

Docs, examples, CLI behavior, and `doctor` checks should avoid contradicting the
starter lanes that actually exist.

Future positioning can change, but Trellis should not demote an existing
maintained starter without implementation evidence and a replacement decision.
