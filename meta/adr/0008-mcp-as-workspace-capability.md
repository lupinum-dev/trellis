# 0008: Treat MCP As A First-Class Workspace Capability

Status: Accepted
Date: 2026-04-29
Updated: 2026-06-05

## Context

MCP needs auth, permissions, tenant boundaries, sessions, prompts, resources,
tools, and destructive-operation safety. It is a first-class Trellis product
surface, but it should not create a second backend model.

## Decision

MCP is a first-class capability layered onto the workspace model.

MCP tools project the same app-owned backend model used by browser and server surfaces.

## Consequences

`workspace-mcp` is the canonical starter template for agent-enabled workspace
apps. The old `workspace --mcp` flag alias is deleted for 1.0 so the starter
surface has one source of truth.

MCP examples should emphasize principal forwarding, actor resolution,
permission-aware discovery, scoped tools, sessions, resources, prompts, bearer
key validation, rate limiting, and operation-backed destructive work.
