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

Auth:

- use Better Auth-specific helpers for sign-in and sign-up;
- use `useConvexAuth()` only for provider-neutral auth state;
- use `useBetterAuthClient()` for direct Better Auth client calls;
- do not use session profile ids as app user ids.

Convex:

- keep business rules in Convex handlers;
- use `authenticated(...)` for personal signed-in work and `workspace(...)` for
  tenant-scoped app work;
- use local `users._id` for domain user references;
- keep tenant checks in Convex, not in frontend orchestration.

Server:

- use `serverConvexQuery`, `serverConvexMutation`, and `serverConvexAction`;
- do not forward raw caller or acting-for data from server routes; use
  transport proof auth only for verified server-to-server flows.

MCP:

- use `tool.query(...)` for reads;
- use `tool.operation(...)` for writes, destructive actions, and sensitive actions.
