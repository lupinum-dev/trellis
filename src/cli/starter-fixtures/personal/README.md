# trellis-starter-personal

Generated with `trellis init trellis-starter-personal` and `trellis add auth`.

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
- `app/features/` for feature-owned UI and route shells

## Maintained reference

- Start with the maintained reference: [`02-auth-todo`](https://github.com/lupinum-dev/trellis/tree/main/examples/02-auth-todo).

## Next lane

Add workspace with `trellis add workspace` only when the app needs tenant
boundaries, roles, or backend-owned permission projection.
