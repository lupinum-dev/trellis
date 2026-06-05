# Trellis 0.3.0 Refactor Handover

Status: refactor and release-prep acceptance proven; not published
Last updated: 2026-06-05

This handover is the short entry point for the next developer. The detailed
history lives in `progress_0.3.0.md`; the target architecture lives in
`0.3.0.md`.

## Read First

- `0.3.0.md` is the source of truth for the intended architecture.
- `progress_0.3.0.md` is the implementation ledger. It records each slice,
  verification commands, known caveats, and current state.
- `AGENTS.md` is the repo working agreement. Important local rule: prefer
  delete/simplify/hard cutover over shims and dual paths.
- `auth-review-rfc.md` and `library-review-state.md` are original review inputs.
- `security-contract.generated.json` is generated security inventory. Regenerate
  it with `CI=true pnpm run security:contract` when changing inventoried auth
  surfaces.

## Current Working State

The worktree is intentionally very dirty because the 0.3.0 refactor is being
landed as a broad hard cutover. Do not revert unrelated changes. Many files were
already touched before the most recent slices.

The latest proven state:

- Maintained examples and starter fixtures no longer contain normal-path
  `query.protected(...)`, `mutation.protected(...)`, `action.protected(...)`,
  operation `guard:`, or `canManagePages` usage.
- CLI resource generation no longer creates protected/guard paths.
- First-reader docs no longer teach protected/guard as the normal signed-in,
  workspace, destructive-operation, or access-context path.
- Upgrade guidance no longer suggests `.protected(...)` as a normal migration
  target.
- Public-surface codegen and CLI explain fixtures no longer normalize
  protected/guard as the default operation projection model.
- `tests/unit/operation-descriptor.test.ts` has been cut over from normal
  operation `guard` fixtures to operation `permission` fixtures; its remaining
  `guard` case is negative protected-lane rejection coverage.
- The current worktree has passed `pnpm run check`,
  `pnpm run release:verify`, and `pnpm run release:pack`.
- The standalone docs production build now passes after making its build
  dependencies explicit:
  - `apps/docs` depends on `@resvg/resvg-js`;
  - `pnpm-workspace.yaml` allows `better-sqlite3` install scripts so Nuxt
    Content can load its native binding.
- Package metadata and compatibility metadata are cut over to `0.3.0`.
- `CHANGELOG.md` contains the curated `v0.3.0` release entry.
- `release:pack` writes `0.3.0` tarballs, and packed manifest inspection
  confirms:
  - `@lupinum/trellis@0.3.0`;
  - `@lupinum/trellis-bridge@0.3.0`;
  - the bridge package peer dependency on `@lupinum/trellis` is `^0.3.0`.

## Completed Slices

See `progress_0.3.0.md` for full commands and details. Major completed areas:

- Phase 0 security gates and public export restrictions.
- Public-safe DB facade and public write operation path.
- Backend explicit lanes:
  - `public`;
  - `authenticated`;
  - `workspace`;
  - `unsafe`;
  - internal/transport variants where applicable.
- Protected lane now rejects `guard: open`.
- `authRequired` is treated as internal compatibility machinery, not normal app
  guidance.
- Maintained examples and starter fixtures have been migrated from
  protected/guard defaults to explicit lanes.
- Webhook and component transport mutation paths were moved to authenticated
  lane semantics.
- `transportMutation.authenticated(...)` exists and is covered.
- Security contract extractor inventories authenticated/workspace lanes and
  `transportMutation.<lane>(...)`.
- CLI `trellis add entity` generator emits explicit lanes.
- First-reader docs, upgrade hints, public-surface fixtures, and explain
  fixtures have been cut over.

## Important Verification Already Run

Recent successful checks recorded in `progress_0.3.0.md` include:

- `CI=true pnpm run test:security`
  - source policy;
  - security contract drift check;
  - module build;
  - packed export policy;
  - focused runtime/security unit files.
- `pnpm run build:cli` after security tests that rebuild/clean `dist`.
- Focused example typechecks for changed examples.
- Focused unit tests for:
  - `functions-defineTrellis`;
  - `functions-defineHandler`;
  - `security-contract`;
  - `cli-add-resource`;
  - `cli-doctor`;
  - `cli-upgrade`;
  - `public-surface-codegen`;
  - `cli-explain`.
- Docs link/API-surface scripts passed directly:
  - `node scripts/check-doc-links.mjs`;
  - `node scripts/generate-api-surface.mjs --check`.
- Broad gates:
  - `pnpm run check`;
  - `pnpm run release:verify`;
  - `pnpm run release:pack`.
- Docs production build:
  - `pnpm --dir apps/docs build`.

Known caveat: at times the local shell hit OS process limits
(`Resource temporarily unavailable`, `EAGAIN`, lifecycle code `-35`). When that
happens, rerun commands sequentially and prefer single-worker test invocations:

```bash
node node_modules/vitest/vitest.mjs run --project=unit --pool=threads --maxWorkers=1 --no-file-parallelism <test-file>
node node_modules/oxfmt/bin/oxfmt --check --threads=1 <files>
```

## What Is Left

No implementation slice remains for the 0.3.0 hard-cut refactor in this
checkout. The remaining work is human release ownership: review the diff,
create/tag the release as appropriate, and publish through the maintainer
runbook. Do not run live publish commands from an agent session.

### Completed Hard-Cut Audit

This applies to the whole 0.3.0 refactor, not only the protected/guard lane
cutover. The final cleanup pass has been run with deletion, not compatibility,
as the goal.

The final state should not keep old code "just in case." The audit checked for:

- any intermediate 0.3.0 scaffolding, compatibility paths, transitional helpers,
  temporary tests, or duplicated implementation paths from any slice;
- stale protected/guard normal-path examples;
- old fixture patterns that no longer represent intentional legacy detection;
- compatibility shims added only for intermediate migration during this branch;
- duplicate APIs, bridge exports, adapters, or wrappers made obsolete by the
  explicit-lane model;
- unused permissions, guards, imports, helper functions, generated aliases, and
  docs sections;
- derived state that lacks a rebuild command and invariant test;
- public exports that are not part of the deliberate 0.3 surface.

Acceptance criteria used for this cleanup pass:

- Every 0.3.0 architecture area in `0.3.0.md` has one final implementation path
  and no abandoned interim path:
  - handler lanes and DB facades;
  - public writes;
  - service subjects;
  - trusted transport and identity forwarding;
  - replay/idempotency;
  - MCP operations/tools;
  - bridge package surfaces;
  - observability/audit surfaces;
  - CLI generators, starters, examples, docs, and tests.
- Every remaining `protected(...)`, `guard:`, and `authRequired` occurrence is
  classified in source or tests as one of:
  - intentional custom-guard/protected-lane runtime coverage;
  - intentional legacy-detection fixture;
  - internal lane machinery that is not public first-reader API.
- No maintained example, starter fixture, generator, first-reader doc, or CLI
  hint teaches an old path.
- `rg` audits for old paths, compatibility/debt terms, deleted public APIs, and
  obsolete package exports are captured in `progress_0.3.0.md`.
- Public API surfaces, `package.json` exports, generated API docs, and
  `tests/unit/package-subpath-exports.test.ts` agree on the final exported
  surface.
- The security contract is regenerated and checked after cleanup.
- Full local/release gates pass, or any remaining external-environment failure
  is documented with the direct underlying check that did pass.

Recommended final hard-cut audit commands:

```bash
rg -n "query\\.protected|mutation\\.protected|action\\.protected|guard:\\s*|authRequired|delegateToUser|readSharedSecretWebhookBody|stampMcpToolSafety|escapeIsolation|trellisUnsafeDb|tool\\.mutation|tool\\.fromOperation" . --glob '!node_modules/**' --glob '!dist/**'
rg -n "deprecated|compat|legacy|shim|TODO|FIXME|temporary|migration-only|old path|backcompat|backward" src tests examples apps/docs packages scripts --glob '!dist/**'
rg -n "@lupinum/trellis/bridge|@lupinum/trellis/functions|@lupinum/trellis/backend/advanced|@lupinum/trellis/mcp/advanced" . --glob '!node_modules/**' --glob '!dist/**'
rg -n "0\\.3|service|trusted|replay|idempot|forwarding|publicWrite|crossTenant|unsafe|bridge|mcp|operation" src tests examples src/cli apps/docs packages scripts --glob '!dist/**'
```

Use those results as a deletion list. Keep an old-looking surface only when the
0.3 architecture explicitly requires it and there is a focused test proving the
boundary.

### Immediate Next Slice

There is no next code slice for the 0.3.0 refactor. If another developer picks
this up before release, start by reviewing `progress_0.3.0.md`, then rerun the
same release gates from this handover if the worktree has changed.

### Remaining Protected/Guard Inventory

Run:

```bash
rg -n "query\\.protected|mutation\\.protected|action\\.protected|guard:\\s*|protected\\(previewOf|protected preview|authRequired" tests/unit src/cli src/module-internals src/runtime scripts examples src/cli/starter-fixtures --glob '!dist/**' --glob '!node_modules/**'
```

As of the last audit, remaining hits were in these categories:

- Runtime support for custom protected lane and internal caller gates:
  - `src/runtime/functions/index.ts`;
  - `src/runtime/functions/define-handler.ts`;
  - `src/runtime/functions/define-operation.ts`;
  - `src/runtime/auth/define-guard.ts`.
- Security inventory/source-policy scripts that intentionally detect or classify
  `authRequired`, protected lanes, or operation guards:
  - `scripts/lib/security-source-policy.mjs`;
  - `scripts/lib/security-contract.mjs`;
  - `scripts/check-security-packed-exports.mjs`.
- Legacy-detection fixtures that should probably remain old-path examples:
  - `tests/unit/cli-doctor.test.ts`;
  - `tests/unit/cli-upgrade.test.ts`;
  - `tests/unit/eslint-plugin.test.ts`.
- Runtime/custom-guard behavior tests:
  - `tests/unit/functions-defineTrellis.test.ts`;
  - `tests/unit/functions-defineHandler.test.ts`.
- Negative public-export, contract, and descriptor guard-rejection coverage:
  - `tests/unit/auth-index.test.ts`;
  - `tests/unit/security-contract.test.ts`;
  - `tests/unit/operation-descriptor.test.ts`.

Do not remove custom protected-lane coverage unless 0.3.0 scope explicitly
deletes `protected(...)`.

### Larger 0.3.0 Work Still Open

The bigger architecture items now have passing focused and broad-gate evidence
in `progress_0.3.0.md`, and the release-prep audit is closed for the current
checkout.

Resolved release-audit caveat:

- `pnpm --dir apps/docs build` now passes in this checkout.
- The prior failure was a missing docs-app `@resvg/resvg-js` dependency plus a
  workspace build-policy block on `better-sqlite3` native bindings.
- Package metadata, compatibility metadata, release notes, packed tarballs, and
  packed manifest checks are all aligned on `0.3.0`.

## Useful Commands

Prefer focused tests while editing:

```bash
node node_modules/vitest/vitest.mjs run --project=unit --pool=threads --maxWorkers=1 --no-file-parallelism <test-file>
node node_modules/eslint/bin/eslint.js <files>
node node_modules/oxfmt/bin/oxfmt --check --threads=1 <files>
git diff --check
```

Security and generated contract:

```bash
CI=true pnpm run security:contract
CI=true pnpm run check:security:contract
CI=true pnpm run test:security
pnpm run build:cli
```

Docs:

```bash
node scripts/check-doc-links.mjs
node scripts/generate-api-surface.mjs --check
```

Broader gates before release handoff:

```bash
pnpm run check
pnpm run release:verify
pnpm run release:pack
```

Never run live publish commands from an agent session.

## Practical Notes

- Use hard cutovers for unreleased internals; do not keep old and new paths side
  by side.
- Keep `@lupinum/trellis-bridge` separate from core Trellis exports.
- Treat examples and starter fixtures as production templates.
- After running `test:security`, run `pnpm run build:cli` because module builds
  can clean/rebuild `dist`.
- If process limits reappear, stop parallel command fanout and rerun with
  single-worker commands.
