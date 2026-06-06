# trellis-starter-public

Generated with `trellis init trellis-starter-public`.

## Quick start

```bash
pnpm install
pnpm dev:local
```

Use `pnpm convex:dev` and `pnpm dev` when you want to connect to a hosted Convex dev deployment.

## Canonical shape

- `convex/features/` for backend feature modules
- `shared/features/` for runtime-neutral contracts
- `app/features/` for feature-owned UI and route shells

## Maintained reference

- Start with the maintained reference: [`01-public-todo`](https://github.com/lupinum-dev/trellis/tree/main/examples/01-public-todo).

## Next lane

Add auth with `trellis add auth` only when the app needs signed-in callers.
