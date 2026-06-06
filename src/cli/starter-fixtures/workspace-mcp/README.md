# trellis-starter-workspace-mcp

Generated with `trellis init trellis-starter-workspace-mcp --preset workspace-mcp`.

This is the first-class agent-enabled workspace lane. Use it when MCP agents are
already part of the product and must share the same backend authorization model
as browser and server callers.

## Quick start

```bash
pnpm install
pnpm dev:local
```

Use `pnpm convex:dev` and `pnpm dev` when you want to connect to a hosted Convex dev deployment.

## Canonical shape

- `convex/features/` for backend feature modules
- `shared/features/` for runtime-neutral contracts
- `convex/auth/` for appIdentity and guard logic
- `convex/permissions/` for permission projection when the starter uses access context
- `app/features/` for feature-owned UI and route shells
- `server/mcp/` for MCP runtime and tools
- `server/middleware/mcp-auth.ts` for MCP bearer validation
- `convex/features/mcpKeys/` for hashed, workspace-bound MCP keys

## Maintained reference

- Review the explicit workspace app baseline: [`03-team-workspace`](https://github.com/lupinum-dev/trellis/tree/main/examples/03-team-workspace).
- Then study the first-class MCP branch: [`07-mcp-reference`](https://github.com/lupinum-dev/trellis/tree/main/examples/07-mcp-reference).

## Verification

Run `trellis doctor --production` before treating an MCP-enabled app as ready.
Destructive agent writes should be operation-backed by default.
