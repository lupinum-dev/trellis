# Trellis 0.3.0 Release Handover

Status: release-prep acceptance proven; not published
Last updated: 2026-06-05

This is the compact release handoff for the 0.3.0 hard-cut security refactor.
The long implementation ledgers were intentionally removed before release; the
release-facing record is now `CHANGELOG.md`, `security-contract.generated.json`,
and the verification commands below.

## Current State

- Package metadata and compatibility metadata are aligned on `0.3.0`.
- `CHANGELOG.md` contains the curated `v0.3.0` release entry.
- Maintained examples and starter fixtures use explicit backend lanes instead
  of protected/guard defaults.
- First-reader docs, starter fixtures, CLI generators, API-surface fixtures, and
  explain output no longer teach old protected/guard paths as the normal app
  authoring model.
- `tests/unit/operation-descriptor.test.ts` uses operation `permission`
  fixtures for normal operation descriptors; its remaining `guard` case is
  negative protected-lane rejection coverage.
- The standalone docs production build passes after declaring
  `@resvg/resvg-js` in `apps/docs` and allowing `better-sqlite3` build scripts
  in `pnpm-workspace.yaml`.

## Proven Gates

The current 0.3.0 checkout has passed:

- `pnpm --dir apps/docs build`
- `pnpm run check`
- `pnpm run release:verify`
- `pnpm run release:pack`
- packed manifest inspection for:
  - `@lupinum/trellis@0.3.0`;
  - `@lupinum/trellis-bridge@0.3.0`;
  - bridge peer dependency `@lupinum/trellis: ^0.3.0`.

`release:verify` covered formatting, lint, publish surface, compatibility
matrix, docs API surface, docs links, type checks, contracts, `test:security`,
maintained example doctor, starter fixture doctor, full tests, e2e, starter
fixture typecheck/build, Convex generated drift, packed workspace-reference
check, production audit, and final build.

## Intentional Remaining Old-Looking Terms

Remaining `protected(...)`, `guard:`, and `authRequired` occurrences should be
limited to:

- custom protected-lane runtime support and tests;
- legacy-detection fixtures in CLI/ESLint checks;
- negative export, security-contract, or protected-lane rejection coverage;
- internal lane machinery that is not public first-reader API.

Do not remove custom protected-lane coverage unless the public
`protected(...)` lane itself is deliberately removed.

## Release Boundary

No live publish, tag, or registry command has been run from an agent session.
The next maintainer step is manual release ownership: review the final diff,
rerun release gates if the worktree changes, inspect `.pack/`, tag, and publish
through the `MAINTAINING.md` runbook.

## Useful Commands

```bash
pnpm run check
pnpm run release:verify
pnpm run release:pack
pnpm --dir apps/docs build
CI=true pnpm run test:security
node scripts/check-pack-workspace-refs.mjs
```
