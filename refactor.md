# Trellis/Ginko 0.1.1 Refactor Tracker

Date opened: 2026-05-25  
Primary repo: `/Users/matthias/Git/0_libs/WORK/trellis`  
Integration repo: `/Users/matthias/Git/0_libs/WORK/ginko-cms`  
Reference audit: `summary.md`

This is the working checklist for the 0.1.1 cleanup. It turns the audit into
trackable work with acceptance criteria and verification steps.

The goal is not to add more framework. The goal is to make the release smaller,
more honest, and easier to trust:

- direct Trellis apps stay strict,
- integration-owned apps are detected explicitly,
- Ginko CMS owns its CMS-specific checks,
- starters work outside the monorepo,
- public package metadata and docs match what is actually released,
- brittle convention checks are replaced with behavior or release-surface checks.

## How To Use This File

Status values:

- `[ ]` not started
- `[x]` done
- `[~]` in progress
- `[?]` evaluate before implementing
- `[!]` blocked or needs a decision

Completion rule:

- A point is done only when its tasks are complete, its acceptance criteria are
  met, and its verification commands have been run or explicitly deferred with a
  reason.
- Prefer one focused PR per P0 point or small group of related P0 points.
- Use hard cutovers for unreleased/internal behavior. Do not add compatibility
  shims unless this file marks the item as public/released surface.

## Global Acceptance Criteria

- [ ] Trellis root package version is ready for `0.1.1`.
- [ ] `@lupinum/trellis-bridge` version is ready for `0.1.1`.
- [ ] Ginko CMS compatibility metadata points at Trellis/bridge `0.1.1`.
- [ ] `trellis doctor` distinguishes:
  - direct Trellis app,
  - integration-managed Trellis app,
  - no Trellis runtime or integration.
- [ ] Ginko CMS consumer apps can run `pnpm exec trellis doctor` without false
      canonical-layout failures.
- [ ] Direct Trellis apps still fail real canonical-layout issues.
- [ ] Generated Trellis starters contain no `workspace:*` dependencies.
- [ ] Trellis public docs do not hardcode Ginko CMS as part of core Trellis.
- [ ] Ginko CMS declares its Trellis integration ownership in Ginko-owned
      metadata.
- [ ] Relevant Trellis checks pass.
- [ ] Relevant Ginko CMS checks pass.
- [ ] Tarball smoke checks pass outside the monorepo before publish.

## Current Verified Baseline

Already verified while preparing `summary.md`:

- [x] `npm view @lupinum/trellis version --json` returns `0.1.0`.
- [x] `npm view @lupinum/trellis-bridge version --json` returns `0.1.0`.
- [x] `pnpm run audit:prod` passes in Trellis.
- [x] `pnpm run check:packs:no-workspace-refs` passes for packed Trellis
      tarballs.
- [x] Built `trellis init` currently emits `@lupinum/trellis: "workspace:*"` in
      generated app package manifests.
- [x] `pnpm run test:types:harness-server` currently fails because
      `apps/harness/convex/posts.ts` cannot resolve `@lupinum/trellis/workspace`.
- [x] `pnpm run check:repo-policies` became too slow after generated artifacts
      existed and had to be killed.

## P0 - Release Blockers

### P0-01 - Generic Integration-Aware `trellis doctor`

Status: [ ]  
Decision: implement now.

Problem:

`trellis doctor` currently assumes the target is a canonical Trellis starter app.
That is wrong for apps where another package owns the Trellis integration, such
as Ginko CMS. The doctor output is technically true but operationally
misleading.

Design:

- Trellis core should detect integration ownership generically.
- Ginko CMS should be only one package that supplies integration metadata.
- Trellis must not encode CMS domain checks.
- The final CMS verdict remains `ginko-cms doctor`.

Proposed package metadata contract:

```json
{
  "trellis": {
    "integration": {
      "ownsRuntime": true,
      "label": "Ginko CMS",
      "doctorCommand": "pnpm exec ginko-cms doctor"
    }
  }
}
```

Tasks:

- [ ] Add a typed internal representation for Trellis app classification:
      `direct`, `integration-managed`, `none`.
- [ ] Extend project inspection to detect direct `@lupinum/trellis` Nuxt module
      registration.
- [ ] Extend project inspection to detect dependency package metadata for
      `trellis.integration.ownsRuntime === true`.
- [ ] Allow detection from Nuxt modules and package metadata. Package metadata
      is authoritative when installed.
- [ ] For `direct`, keep strict module and canonical-layout failures.
- [ ] For `integration-managed`, skip or downgrade:
  - direct `@lupinum/trellis` module registration,
  - canonical Trellis starter layout.
- [ ] Emit a clear finding such as:
      `Trellis runtime detected through Ginko CMS (@lupinum/ginko-cms). Run pnpm exec ginko-cms doctor for integration checks.`
- [ ] For `none`, keep output explicit: no direct Trellis module or integration
      owner was detected.
- [ ] Include the classification in JSON output either as a stable top-level
      report field or as explicit findings. Prefer findings if that avoids growing a
      second report model.

Acceptance criteria:

- [ ] Direct Trellis fixture still fails missing direct module registration.
- [ ] Direct Trellis fixture still fails missing canonical layout paths.
- [ ] Integration-managed fixture does not fail because `@lupinum/trellis` is not
      directly registered.
- [ ] Integration-managed fixture does not fail canonical layout checks owned by
      the integration package.
- [ ] Output names the integration package, human label, and doctor command.
- [ ] App with no Trellis dependency, no Trellis module, and no integration
      metadata is not misclassified as Trellis-active.
- [ ] Production mode does not turn skipped integration-owned canonical checks
      into failures.

Verification:

```bash
pnpm run build:cli
pnpm exec vitest run --project=unit tests/unit/cli-doctor.test.ts
node dist/cli.mjs doctor --json --cwd tests/fixtures/doctor-valid
```

Extra evaluation before coding:

- [?] Decide whether Trellis unit tests should use a generic integration fixture
  only, with the concrete Ginko fixture living in the Ginko CMS repo. This best
  preserves CMS neutrality.

### P0-02 - Ginko CMS Declares Trellis Integration Ownership

Status: [ ]  
Decision: implement now in `/Users/matthias/Git/0_libs/WORK/ginko-cms`.

Problem:

Trellis cannot know that Ginko CMS owns runtime checks unless Ginko CMS exposes a
small, package-level contract.

Tasks:

- [ ] Add Trellis integration metadata to `packages/cms/package.json`.
- [ ] Include the metadata in the published package. Verify `files` keeps
      `package.json` and any needed metadata.
- [ ] Confirm the Ginko CMS Nuxt module is what consumer apps register.
- [ ] Add or update a Ginko-owned fixture/e2e case where:
  - consumer registers Ginko CMS,
  - consumer does not directly register `@lupinum/trellis`,
  - `pnpm exec ginko-cms doctor` passes,
  - `pnpm exec trellis doctor` reports integration-managed status.

Acceptance criteria:

- [ ] Ginko CMS package metadata names itself as the Trellis integration owner.
- [ ] `trellis doctor` output points users to `pnpm exec ginko-cms doctor`.
- [ ] Ginko CMS doctor remains the CMS-specific source of truth.
- [ ] No Ginko-specific logic is required in Trellis core.

Verification:

```bash
cd /Users/matthias/Git/0_libs/WORK/ginko-cms
pnpm run check
pnpm exec ginko-cms doctor
pnpm run package:e2e
```

If a temporary consumer app is used:

```bash
pnpm exec trellis doctor --cwd /Users/matthias/Git/_temp/i18n-cms
pnpm exec ginko-cms doctor --cwd /Users/matthias/Git/_temp/i18n-cms
pnpm run smoke:cms
```

### P0-03 - Generated Starters Must Not Emit `workspace:*`

Status: [ ]  
Decision: implement now.

Problem:

Actual `trellis init` output still contains monorepo-only dependency ranges.
Fixture validation rewrites them for tests, but real generated apps are wrong.

Tasks:

- [ ] Keep source fixtures as-is only if they are useful for monorepo tests.
- [ ] During fixture rendering, rewrite `@lupinum/trellis` from `workspace:*` to
      a concrete semver range derived from the running package version.
- [ ] Do the same for any other dependency that is published and should not
      leave the repo as `workspace:*`.
- [ ] Add a built-CLI test that initializes every starter template and asserts
      generated package manifests contain no `workspace:*`.
- [ ] Update `scripts/check-starter-fixtures.mjs` so it asserts external output
      is publishable, not only that internal fixture input is workspace-linked.

Acceptance criteria:

- [ ] `trellis init` generated apps are installable outside the monorepo.
- [ ] Generated app package manifests use `^0.1.1` or the decided published
      range for `@lupinum/trellis`.
- [ ] Package-under-test validation still uses tarballs or file deps where
      appropriate.
- [ ] No generated starter package contains `workspace:*`.

Verification:

```bash
pnpm run build:cli
tmpdir=$(mktemp -d)
node dist/cli.mjs init demo-public --template public --cwd "$tmpdir" --json
rg 'workspace:\*' "$tmpdir" --glob package.json
pnpm run check:starter-fixtures:typecheck
pnpm run check:starter-fixtures:build
```

### P0-04 - Fix Harness Type Resolution

Status: [ ]  
Decision: implement now.

Problem:

`pnpm run test:types:harness-server` cannot resolve
`@lupinum/trellis/workspace` from the harness server typecheck.

Tasks:

- [ ] Inspect `apps/harness/server/tsconfig.json` and repo typecheck configs.
- [ ] Align package subpath resolution with the established repo pattern.
- [ ] Avoid adding an isolated alias source that can drift from package exports.
- [ ] Confirm `@lupinum/trellis/workspace` is either intentionally public or
      replace harness imports with the intended public path.

Acceptance criteria:

- [ ] `pnpm run test:types:harness-server` passes.
- [ ] `pnpm run test:types` passes or reveals the next unrelated failure.
- [ ] The fix agrees with `package.json` exports and API surface docs.

Verification:

```bash
pnpm run test:types:harness-server
pnpm run test:types
```

### P0-05 - Version And Compatibility Bump To `0.1.1`

Status: [ ]  
Decision: implement after code changes are settled.

Tasks:

- [ ] Bump Trellis root `package.json` to `0.1.1`.
- [ ] Bump `packages/trellis-bridge/package.json` to `0.1.1`.
- [ ] Update Trellis `compatibility.json`.
- [ ] Update release docs and changelog references that still point at `0.1.0`
      as the current release target.
- [ ] Update Ginko CMS root dev dependencies to Trellis/bridge `^0.1.1`.
- [ ] Update `packages/cms/package.json` Trellis/bridge dependencies to
      `^0.1.1`.
- [ ] Update `packages/cms/compatibility.json` Trellis/bridge compatibility to
      `0.1.1`.
- [ ] Decide whether Ginko CMS packages themselves are also publishing `0.1.1`.
      If yes, update all Ginko package manifests and compatibility matrix in one
      release PR.

Acceptance criteria:

- [ ] All release metadata agrees on the same Trellis/bridge version.
- [ ] Compatibility matrix checks pass in both repos.
- [ ] No docs instruct publishing or installing stale `0.1.0` for the new
      release path.

Verification:

```bash
pnpm run check:compatibility-matrix
cd /Users/matthias/Git/0_libs/WORK/ginko-cms
pnpm run check:compatibility-matrix
```

### P0-06 - Remove CMS-Specific Knowledge From Core Trellis

Status: [ ]  
Decision: implement with P0-01/P0-02.

Problem:

Trellis should be CMS-neutral. Any Ginko-specific doctor behavior belongs in
Ginko CMS, or in generic metadata that any integration package can implement.

Tasks:

- [ ] Remove hardcoded `@lupinum/ginko-cms` detection from Trellis inventory.
- [ ] Replace named Ginko docs with generic "packaged integration" language in
      public Trellis docs.
- [ ] Keep any necessary historical notes under maintainer-only `meta/` only if
      they are still useful.
- [ ] If tests need a concrete integration package, prefer a generic fixture
      package such as `@example/trellis-integration`.
- [ ] Put the concrete Ginko consumer test in the Ginko CMS repo.

Acceptance criteria:

- [ ] Trellis core has no Ginko-specific runtime branches.
- [ ] Trellis public docs do not market or require Ginko CMS.
- [ ] Ginko CMS still works through the generic integration metadata contract.

Verification:

```bash
rg -n 'Ginko|ginko|@lupinum/ginko' README.md apps/docs src packages tests
pnpm exec vitest run --project=unit tests/unit/cli-doctor.test.ts
```

Expected result:

- The `rg` command should return nothing in public/core Trellis paths, or only
  intentionally archived maintainer-only references.

### P0-07 - CI Must Match The Release Gate

Status: [ ]  
Decision: implement now unless intentionally postponed.

Tasks:

- [ ] Add minimal GitHub Actions permissions, at least `contents: read`.
- [ ] Use Corepack and the pinned `pnpm@10.33.0`.
- [ ] Replace mutable `npx ...@latest` installs.
- [ ] Use `pnpm install --frozen-lockfile`.
- [ ] Add a job or step that runs the same release verification gate expected
      before handoff.
- [ ] Smoke import every documented public subpath from packed output, not only
      root and auth.

Acceptance criteria:

- [ ] CI does not depend on mutable installer versions.
- [ ] CI and local release verification do not drift.
- [ ] Packed package smoke covers all public subpaths that remain documented.

Verification:

```bash
pnpm run check
pnpm run release:verify
pnpm run release:pack
```

### P0-08 - Public Security And Community Trust Docs

Status: [ ]  
Decision: implement before public release polish.

Problem:

Root `SECURITY.md` currently points to an internal inventory. That is useful
maintainer context but not a public vulnerability reporting policy.

Tasks:

- [ ] Replace root `SECURITY.md` with a public vulnerability disclosure policy.
- [ ] Keep deep internal audit notes under `meta/SECURITY.md`.
- [ ] Add supported versions guidance for `0.1.x`.
- [ ] Add private reporting channel or state the temporary reporting process.
- [ ] Add issue templates and PR template if this is meant to be open-source
      ready.
- [ ] Add `CODE_OF_CONDUCT.md` if OSS community contribution is in scope.

Acceptance criteria:

- [ ] A third-party user can tell how to report a vulnerability.
- [ ] Internal security inventory remains available to maintainers but is not
      the only public security document.

Verification:

```bash
test -f SECURITY.md
test -f .github/PULL_REQUEST_TEMPLATE.md
```

### P0-09 - Remove Hardcoded Absolute Test Roots

Status: [ ]  
Decision: implement now.

Problem:

Several tests hardcode the local checkout path. This breaks portability and is
unnecessary.

Tasks:

- [ ] Replace hardcoded `/Users/matthias/.../trellis` paths with `process.cwd()`
      or a test-local repo root helper.
- [ ] Cover at least:
  - `tests/unit/future-agent-conventions.test.ts`
  - `tests/unit/schema-boundary-policy.test.ts`
  - `tests/unit/examples-gallery-docs.test.ts`
- [ ] Check for any additional absolute local paths.

Acceptance criteria:

- [ ] Tests do not encode the maintainer's local checkout path.
- [ ] Tests pass from any checkout directory.

Verification:

```bash
rg -n '/Users/matthias|Git/0_libs/WORK' tests scripts src apps packages
pnpm exec vitest run --project=unit tests/unit/future-agent-conventions.test.ts tests/unit/schema-boundary-policy.test.ts tests/unit/examples-gallery-docs.test.ts
```

### P0-10 - Make Repo Policy Scans Hermetic

Status: [ ]  
Decision: implement now if the policy checks stay.

Problem:

Repo policy scans became slow/noisy after local generated artifacts existed.
Policy scans should operate on tracked source files or an explicit allowlist.

Tasks:

- [ ] Change source walking to `git ls-files` where possible.
- [ ] Ignore generated directories consistently:
  - `dist`
  - `.nuxt`
  - `.output`
  - `.pack`
  - `.pack-check`
  - `.convex`
  - generated Convex `_generated`
  - package build outputs
- [ ] Delete policy scans that only enforce stale wording or old refactor scars.
- [ ] Keep checks that protect public exports, release safety, or package
      boundaries.

Acceptance criteria:

- [ ] `pnpm run check:repo-policies` completes quickly from a dirty build tree.
- [ ] Policy failures map to real release or architecture contracts.

Verification:

```bash
pnpm run build
pnpm run check:repo-policies
```

### P0-11 - Remove Stale Environment Claims

Status: [ ]  
Decision: implement now.

Problem:

Starter/example environment files mention `TRELLIS_MCP_CONFIRMATION_KEY`, but
current runtime configuration uses explicit confirmation store/mode wiring.

Tasks:

- [ ] Confirm there is no runtime read of `TRELLIS_MCP_CONFIRMATION_KEY`.
- [ ] Remove stale env entries from starter fixtures and examples.
- [ ] Update docs to explain the actual destructive confirmation configuration.

Acceptance criteria:

- [ ] No generated starter asks users to set an unused confirmation key.
- [ ] Docs match runtime code.

Verification:

```bash
rg -n 'TRELLIS_MCP_CONFIRMATION_KEY|confirmation key' .
pnpm run check:examples:doctor
```

### P0-12 - Public Surface Coverage Must Match Exports

Status: [ ]  
Decision: implement now.

Problem:

The public surface ledger is useful, but coverage is uneven across package
exports, generated docs, type tests, tarball smoke, and CI smoke.

Tasks:

- [ ] Reconcile root package exports with
      `apps/docs/content/docs/13.api-reference/7.api-surface.md`.
- [ ] Ensure `@lupinum/trellis/mcp/advanced` is either fully documented and
      type-smoked or removed from the documented public surface.
- [ ] Ensure bridge subpaths are documented and type-smoked if they remain
      public.
- [ ] Ensure `workspace` and `type-primitives` are covered if kept.
- [ ] Do not add `#trellis/permissions`; current tests intentionally assert that
      alias is not generated.

Acceptance criteria:

- [ ] Package exports, API surface docs, type tests, and tarball import smoke all
      agree.
- [ ] No public subpath exists only by accident.
- [ ] No documented subpath is missing from packed smoke.

Verification:

```bash
pnpm run check:publish-surface
pnpm run test:types:public
pnpm run release:pack
```

## P1 - High-Confidence Cleanup After Release Blockers

### P1-01 - Rename/Frame Inventory As Static Scan

Status: [?]  
Decision: likely implement, but check CLI JSON compatibility first.

Problem:

Doctor/inventory uses static scanning, regexes, filenames, and TypeScript AST
heuristics. That is useful, but it should not be framed as proof of architecture
correctness.

Tasks:

- [ ] Audit CLI output and docs for "inventory engine" or proof-like wording.
- [ ] Rename user-facing wording to "static scan" or "static diagnostics".
- [ ] Keep machine-readable JSON field names unless we intentionally accept a
      breaking CLI JSON change.
- [ ] Add false-positive and false-negative tests around comments, strings,
      aliases, re-exports, dynamic imports, and non-canonical schema syntax.

Acceptance criteria:

- [ ] Doctor output is honest about static-scan confidence.
- [ ] No docs imply static scans prove runtime safety.
- [ ] Existing useful findings remain available.

Verification:

```bash
pnpm exec vitest run --project=unit tests/unit/cli-doctor.test.ts tests/unit/cli-upgrade.test.ts
pnpm run check:examples:doctor
```

### P1-02 - Decide Feature Manifest Source Of Truth

Status: [?]  
Decision: evaluate before implementing.

Problem:

Feature manifests derive useful metadata, but examples still manually spread
schema tables elsewhere. That can become a second source of truth.

Options:

- Option A: make feature manifests drive schema composition.
- Option B: rename them to feature metadata/inventory and stop implying they are
  canonical runtime manifests.

Recommended path:

- Start with tests that expose drift. Then choose A only if the implementation
  stays small.

Tasks:

- [ ] Identify all consumers of `defineFeature`, `composeFeatures`,
      `defineAppInventory`, and `toAppInventoryJson`.
- [ ] Add an invariant test that catches mismatch between feature schema,
      root Convex schema, and tenant isolation metadata.
- [ ] Remove empty `layers: []` and `findings: []` from exported JSON unless
      real consumers need them.
- [ ] Rename only if the API is still pre-release enough for a hard cutover.

Acceptance criteria:

- [ ] There is one clear source of truth for feature schema/isolation metadata.
- [ ] Any derived data is rebuildable and covered by invariant tests.
- [ ] Empty future-looking JSON fields are gone or populated meaningfully.

Verification:

```bash
pnpm exec vitest run --project=unit tests/unit/feature-compose.test.ts
pnpm run test:contracts
```

### P1-03 - Observability Honesty

Status: [?]  
Decision: evaluate public API impact before removing methods.

Problem:

Some observability names imply more behavior than exists. Event capture and
redaction are real; no-op summary methods are not.

Tasks:

- [ ] Audit public docs for "semantic observability" claims.
- [ ] Either implement meaningful `info/warn/error` delivery or remove/rename
      no-op methods.
- [ ] Inline or rename `createDenialExplanation` if it remains plain object
      construction.
- [ ] Keep the real event emitter/capture mechanisms.

Acceptance criteria:

- [ ] No public method pretends to do work it does not do.
- [ ] Docs explain what is emitted, what is captured, and what the user must
      wire for delivery.

Verification:

```bash
pnpm exec vitest run --project=unit tests/unit/observability.test.ts
pnpm run check:publish-surface
```

### P1-04 - MCP Authoring Path Cleanup

Status: [?]  
Decision: evaluate public API impact before renames/removal.

Problem:

`defineMcpApp` is the recommended app-backed path. Standalone `defineTool` is
advanced. The docs are partly honest already, but implementation and naming can
still confuse users.

Tasks:

- [ ] Confirm current docs clearly recommend `defineMcpApp`.
- [ ] Deduplicate rate-limit/result wrapping between app-backed and standalone
      tool paths where this reduces code without adding a new abstraction family.
- [ ] Keep standalone tools advanced, read-only/custom, or explicitly dangerous
      depending on behavior.
- [ ] Add tests proving standalone tools cannot accidentally become app-write
      paths while app writes go through `tool.mutation` or `tool.operation`.

Acceptance criteria:

- [ ] There is one obvious recommended MCP authoring path.
- [ ] Advanced standalone tooling is clearly labeled.
- [ ] Shared execution mechanics do not drift.

Verification:

```bash
pnpm exec vitest run --project=unit tests/unit/mcp*.test.ts
pnpm run test:contracts
```

### P1-05 - Split Giant Runtime Files Internally

Status: [?]  
Decision: do only after P0 work is green.

Problem:

`src/runtime/functions/index.ts` and `src/runtime/mcp/define-mcp-app.ts` are too
large to review safely.

Rule:

- Split internals by real concern only.
- Keep public imports stable.
- Do not add new public wrappers.

Candidate internal boundaries:

- confirmation token storage/checking,
- identity forwarding,
- builder lanes,
- operation metadata,
- result mapping,
- access checks.

Acceptance criteria:

- [ ] Public package exports are unchanged.
- [ ] Tests pass before and after each split.
- [ ] The split removes review burden without changing semantics.

Verification:

```bash
pnpm run test:contracts
pnpm run test:types
pnpm run check:publish-surface
```

### P1-06 - Deduplicate Bridge Registrars

Status: [?]  
Decision: evaluate with examples before changing.

Problem:

`create-component-bridge.ts` repeats similar query/mutation/action/internal
registration code.

Tasks:

- [ ] Identify real consumers, especially `bridge.from(...)`.
- [ ] Keep package-author ergonomics that examples actually use.
- [ ] Collapse repeated implementation with one small internal helper table if
      it stays readable.
- [ ] Do not delete `from(...)` unless Ginko CMS and maintained examples no
      longer use it.

Acceptance criteria:

- [ ] Same public bridge behavior with less duplicated implementation.
- [ ] Maintained examples still build and typecheck.
- [ ] Ginko CMS package e2e still passes.

Verification:

```bash
pnpm exec vitest run --project=unit tests/unit/bridge-package-exports.test.ts
pnpm run test:types
cd /Users/matthias/Git/0_libs/WORK/ginko-cms
pnpm run package:e2e
```

### P1-07 - CLI Patching Must Fail Honestly

Status: [?]  
Decision: evaluate per command.

Problem:

CLI generators patch TypeScript files with string replacement. That is
acceptable for strict starter files, but risky for product-shaped commands.

Tasks:

- [ ] Inventory every string patch in `src/cli/lib/init.ts` and
      `src/cli/lib/resource.ts`.
- [ ] For starter-owned canonical files, keep direct string replacement if tests
      prove the exact fixture shape.
- [ ] For user-edited files, use structured parsing or reject non-canonical
      source with a clear message.
- [ ] Decide whether `trellis add entity` is a public 0.1.1 requirement. If not,
      demote or remove before users rely on it.

Acceptance criteria:

- [ ] CLI either patches safely or fails before half-mutating the app.
- [ ] Tests cover non-canonical files and failure cleanup.

Verification:

```bash
pnpm exec vitest run --project=unit tests/unit/cli-add-resource.test.ts tests/unit/cli-doctor.test.ts
pnpm run check:cli
```

### P1-08 - Replace Convention Tests With Behavior/Invariants

Status: [?]  
Decision: delete low-signal checks after replacement coverage is identified.

Problem:

Phrase-locking and old-path convention tests are useful during refactors but
become permanent scar tissue.

Tasks:

- [ ] Classify each convention/policy test as:
  - public contract,
  - release safety,
  - temporary refactor guard,
  - wording preference.
- [ ] Delete wording preference tests.
- [ ] Expire retained old-path bans when the migration window is no longer
      needed.
- [ ] Replace with invariant tests for auth, tenant isolation, destructive
      confirmation, public imports, and package tarballs.

Acceptance criteria:

- [ ] Fewer policy tests, higher signal.
- [ ] No loss of public API or release safety coverage.

Verification:

```bash
pnpm run test:contracts:repo
pnpm run test:contracts
```

### P1-09 - Deduplicate Codegen Rendering

Status: [ ]  
Decision: implement when nearby code is touched.

Problem:

Operation-ref and MCP-tool-ref codegen share import/path rendering patterns.

Tasks:

- [ ] Extract one small internal renderer only if it removes meaningful
      duplication.
- [ ] Keep generated output byte-stable where possible.
- [ ] Add snapshot or exact-output tests if not already present.

Acceptance criteria:

- [ ] One implementation path for shared codegen formatting.
- [ ] Generated API docs/types do not drift unexpectedly.

Verification:

```bash
pnpm exec vitest run --project=unit tests/unit/*codegen*.test.ts
pnpm run check:publish-surface
```

## P2 - Evaluate Before Acting

These are not release blockers. Do not do them during the P0 cleanup unless the
evaluation produces a clear acceptance criterion.

### P2-01 - Remove `workspace` Or `type-primitives` Public Subpaths

Status: [?]

Concern:

They may be facade-heavy, but they are already published in `0.1.0`. Removing
them in `0.1.1` is a public API break.

Acceptance criterion before removal:

- [ ] No maintained starter, docs page, type test, Ginko CMS path, or example
      imports the subpath.
- [ ] Changelog calls it out if removed.

### P2-02 - Rename `defineMcpApp` Or `defineTool`

Status: [?]

Concern:

Names may be imperfect, but renaming after publish needs a deliberate public API
decision. Since docs already demote standalone tools, prefer doc clarity and
internal dedupe first.

Acceptance criterion before rename:

- [ ] There is a clear replacement name and no user-facing migration cost, or
      the release intentionally accepts the break.

### P2-03 - Delete Bridge `from(...)`

Status: [?]

Concern:

`bridge.from(...)` is used by maintained examples and likely by Ginko CMS
patterns. Delete only after confirming no real consumer needs it.

Acceptance criterion before deletion:

- [ ] Maintained examples and Ginko CMS package e2e pass without it.

### P2-04 - Delete `trellis upgrade`

Status: [?]

Concern:

The command may be overbuilt for no users, but it also helps with already
published path cleanup. Evaluate whether it protects the 0.1.0 to 0.1.1 path.

Acceptance criterion before deletion:

- [ ] No release note or migration flow needs it.

### P2-05 - Delete Or Demote `trellis add entity`

Status: [?]

Concern:

It generates a lot of structure. If no real 0.1.1 user story requires it, the
simplest correct answer may be to remove or mark experimental before release.

Acceptance criterion before keeping:

- [ ] It has a real maintained example and tests for non-canonical failure modes.

### P2-06 - Archive Root Planning Docs/Labs

Status: [?]

Concern:

Docs that only forward to `meta/*` or contain planning material can confuse
public users, but deleting documentation can also remove useful maintainer
context.

Acceptance criterion before moving:

- [ ] Public entry points remain clear.
- [ ] Maintainer-only material is under `meta/` and not part of the product
      story.

### P2-07 - Add `engines`

Status: [?]

Concern:

Docs, CI, and package manager versions should agree. Adding strict engines can
be useful, but choose the supported Node range deliberately.

Acceptance criterion before adding:

- [ ] Decide Node support target.
- [ ] CI, docs, package manifests, and release notes agree.

## Verification Matrix

### Trellis Focused Verification

Run while working:

```bash
pnpm run build:cli
pnpm exec vitest run --project=unit tests/unit/cli-doctor.test.ts
pnpm run test:types:harness-server
pnpm run check:publish-surface
```

Run before handoff:

```bash
pnpm run format:check
pnpm run lint
pnpm run test:types
pnpm run test:contracts
pnpm run check:cli
pnpm run check:examples:doctor
pnpm run check
pnpm run release:verify
pnpm run release:pack
```

Pack/init smoke:

```bash
pnpm run build:cli
tmpdir=$(mktemp -d)
node dist/cli.mjs init demo-public --template public --cwd "$tmpdir" --json
node dist/cli.mjs doctor --cwd "$tmpdir/demo-public"
rg 'workspace:\*' "$tmpdir" --glob package.json
```

### Ginko CMS Focused Verification

Run while aligning the integration metadata:

```bash
cd /Users/matthias/Git/0_libs/WORK/ginko-cms
pnpm run typecheck
pnpm run test
pnpm exec ginko-cms doctor
```

Run before handoff:

```bash
pnpm run check
pnpm run package:e2e
pnpm run audit:prod
pnpm run release:verify
```

Optional live/local consumer verification:

```bash
pnpm exec trellis doctor --cwd /Users/matthias/Git/_temp/i18n-cms
pnpm exec ginko-cms doctor --cwd /Users/matthias/Git/_temp/i18n-cms
pnpm run smoke:cms
```

## Recommended PR Order

1. [ ] P0-09 hardcoded test roots and P0-10 hermetic policy scans.
2. [ ] P0-04 harness type resolution.
3. [ ] P0-01/P0-02/P0-06 integration-aware doctor and Ginko metadata.
4. [ ] P0-03 starter dependency rewrite.
5. [ ] P0-12 public surface coverage.
6. [ ] P0-07 CI release-gate alignment.
7. [ ] P0-08 security/community docs.
8. [ ] P0-11 stale env cleanup.
9. [ ] P0-05 version and compatibility bump to `0.1.1`.
10. [ ] P1 cleanup items in small follow-up PRs only after P0 is green.

## Do Not Do Without A Fresh Decision

- [ ] Do not hardcode Ginko CMS behavior in Trellis core.
- [ ] Do not add `#trellis/permissions`; current behavior intentionally avoids
      that alias.
- [ ] Do not remove published subpaths casually just because they look facade
      heavy.
- [ ] Do not split giant files while tests are red unless the split is needed to
      make the red test fix safe.
- [ ] Do not add new doctor concepts without a fixture proving why they exist.
- [ ] Do not add compatibility shims for unreleased internals.
- [ ] Do not run live publish commands from an agent session.
