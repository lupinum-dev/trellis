# Project Policy

Use pnpm.

After changing Convex files, run:

```bash
pnpm convex:codegen
pnpm typecheck
```

Local Convex dev:

- use `pnpm dev:local` for local Convex-backed Nuxt dev;
- use `pnpm dev:local:reset` only when local backend data can be deleted.

Convex:

- keep business rules in Convex handlers;
- keep public handlers read-only unless the write is intentionally anonymous;
- do not put auth provider ids into domain rows.

Server:

- use `serverConvexQuery`, `serverConvexMutation`, and `serverConvexAction` for server-to-Convex calls;
- do not forward raw caller or acting-for data from server routes; use transport proof auth only for verified server-to-server flows.

MCP:

- use `tool.query(...)` for reads;
- use `tool.operation(...)` for writes, destructive actions, and sensitive actions.
