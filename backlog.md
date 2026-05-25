# Trellis Refactor Backlog

Date opened: 2026-05-25  
Primary repo: `/Users/matthias/Git/0_libs/WORK/trellis`  
Integration repo: `/Users/matthias/Git/0_libs/WORK/ginko-cms`  
Reference audit: `summary.md`

This is the living backlog for Trellis cleanup and hardening work. The original
0.1.1 release-blocker plan is kept below as completed context; new findings
should be added to the backlog sections with a clear acceptance criterion and
verification plan before implementation.

The goal is not to add more framework. The goal is to keep the system smaller,
more honest, and easier to trust:

- direct Trellis apps stay strict,
- integration-owned apps are detected explicitly,
- Ginko CMS owns its CMS-specific checks,
- starters work outside the monorepo,
- public package metadata and docs match what is actually released,
- brittle convention checks are replaced with behavior or release-surface checks.

## Current State

- `0.1.1` release blockers are complete and verified.
- Ginko CMS consumes the local Trellis/bridge `0.1.1` tarballs successfully.
- Remaining open items are backlog/evaluation work, not release blockers for
  the `0.1.1` bump.
- Prefer one focused PR per backlog item. Do not batch public API decisions with
  mechanical cleanup.

## How To Use This File

Status values:

- `[ ]` backlog item, not started
- `[x]` done
- `[~]` actively in progress
- `[?]` evaluate before implementing
- `[!]` blocked or needs a decision

Completion rule:

- A backlog item is done only when its tasks are complete, its acceptance
  criteria are met, and its verification commands have been run or explicitly
  deferred with a reason.
- Add new findings under the smallest relevant backlog section. If no section
  fits, add a new item under "Backlog - Evaluate Before Acting".
- Every item needs a concrete "acceptance criterion before implementing" unless
  it is already approved for implementation.
- Use hard cutovers for unreleased/internal behavior. Do not add compatibility
  shims unless this file marks the item as public/released surface.
- Keep completed release history in this file until the release branch lands;
  after that, completed P0 sections may move to a changelog or archive doc.

## Backlog Item Template

Copy this template when adding newly discovered work:

```md
### P?-NN - Short Title

Status: [?]
Decision: evaluate before implementing.

Why it matters:

- One or two concrete failure modes, not vague cleanup.

Recommended path:

- Prefer delete > simplify > replace > add.

Tasks:

- [ ] Small task with an observable end.

Acceptance criteria:

- [ ] User-visible or maintainer-visible outcome.

Verification:

\`\`\`bash
pnpm run relevant:command
\`\`\`
```

## 0.1.1 Release Acceptance Criteria - Complete

- [x] Trellis root package version is ready for `0.1.1`.
- [x] `@lupinum/trellis-bridge` version is ready for `0.1.1`.
- [x] Ginko CMS compatibility metadata points at Trellis/bridge `0.1.1`.
- [x] `trellis doctor` distinguishes:
  - direct Trellis app,
  - integration-managed Trellis app,
  - no Trellis runtime or integration.
- [x] Ginko CMS consumer apps can run `pnpm exec trellis doctor` without false
      canonical-layout failures.
- [x] Direct Trellis apps still fail real canonical-layout issues.
- [x] Generated Trellis starters contain no `workspace:*` dependencies.
- [x] Trellis public docs do not hardcode Ginko CMS as part of core Trellis.
- [x] Ginko CMS declares its Trellis integration ownership in Ginko-owned
      metadata.
- [x] Relevant Trellis checks pass.
- [x] Relevant Ginko CMS checks pass.
- [x] Tarball smoke checks pass outside the monorepo before publish.

## Current Verified Baseline

Already verified while preparing `summary.md`:

- [x] `npm view @lupinum/trellis version --json` returns `0.1.0`.
- [x] `npm view @lupinum/trellis-bridge version --json` returns `0.1.0`.
- [x] `pnpm run audit:prod` passes in Trellis.
- [x] `pnpm run check:packs:no-workspace-refs` passes for packed Trellis
      tarballs.
- [x] Built `trellis init` no longer emits `@lupinum/trellis: "workspace:*"` in
      generated app package manifests.
- [x] `pnpm run test:types:harness-server` passes after aligning harness server
      subpath resolution.
- [x] `pnpm run check:repo-policies` completes from a build tree after switching
      policy scans to tracked files.

## Final Verification Snapshot

Verified on 2026-05-25 before handoff:

- [x] Trellis: `pnpm run check`.
- [x] Trellis: `pnpm run release:verify`.
- [x] Trellis: `pnpm run release:pack`.
- [x] Ginko CMS package smoke against local Trellis/bridge:
      `TRELLIS_PACKAGE_ROOT=/Users/matthias/Git/0_libs/WORK/trellis TRELLIS_BRIDGE_PACKAGE_ROOT=/Users/matthias/Git/0_libs/WORK/trellis/packages/trellis-bridge pnpm run package:e2e`.
- [x] Ginko CMS: `pnpm run check`.

## Open Backlog Index

| Item                                         | Status | Next action                                                             |
| -------------------------------------------- | ------ | ----------------------------------------------------------------------- |
| P1-01 - Static doctor scan hardening         | `[ ]`  | Add adversarial false-positive/false-negative tests.                    |
| P1-02 - Feature manifest source of truth     | `[ ]`  | Add schema/isolation drift invariant tests before renaming anything.    |
| P1-03 - Observability honesty                | `[ ]`  | Audit docs and remove/rename inert helper surfaces.                     |
| P1-04 - MCP authoring path cleanup           | `[?]`  | Confirm docs and test standalone write restrictions before refactoring. |
| P1-05 - Split giant runtime files            | `[?]`  | Split only in a dedicated no-behavior-change PR.                        |
| P1-06 - Bridge registrar dedupe              | `[?]`  | Check maintained examples and Ginko usage before touching `from(...)`.  |
| P1-07 - CLI patching honesty                 | `[?]`  | Inventory string patches and add non-canonical failure tests.           |
| P2-01..P2-06 - Public API/deletion decisions | `[?]`  | Evaluate individually; do not bundle into patch releases.               |

## Completed 0.1.1 Release Work

### P0-01 - Generic Integration-Aware `trellis doctor`

Status: [x]
Decision: implement now.

Completion note:

- Implemented generic integration-owner metadata detection.
- Added generic integration-managed and direct-app doctor tests.
- Verified with Trellis checks and Ginko package e2e against local Trellis
  `0.1.1` tarballs.

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

- [x] Add a typed internal representation for Trellis app classification:
      `direct`, `integration-managed`, `none`.
- [x] Extend project inspection to detect direct `@lupinum/trellis` Nuxt module
      registration.
- [x] Extend project inspection to detect dependency package metadata for
      `trellis.integration.ownsRuntime === true`.
- [x] Allow detection from Nuxt modules and package metadata. Package metadata
      is authoritative when installed.
- [x] For `direct`, keep strict module and canonical-layout failures.
- [x] For `integration-managed`, skip or downgrade:
  - direct `@lupinum/trellis` module registration,
  - canonical Trellis starter layout.
- [x] Emit a clear finding such as:
      `Trellis runtime detected through Ginko CMS (@lupinum/ginko-cms). Run pnpm exec ginko-cms doctor for integration checks.`
- [x] For `none`, keep output explicit: no direct Trellis module or integration
      owner was detected.
- [x] Include the classification in JSON output either as a stable top-level
      report field or as explicit findings. Prefer findings if that avoids growing a
      second report model.

Acceptance criteria:

- [x] Direct Trellis fixture still fails missing direct module registration.
- [x] Direct Trellis fixture still fails missing canonical layout paths.
- [x] Integration-managed fixture does not fail because `@lupinum/trellis` is not
      directly registered.
- [x] Integration-managed fixture does not fail canonical layout checks owned by
      the integration package.
- [x] Output names the integration package, human label, and doctor command.
- [x] App with no Trellis dependency, no Trellis module, and no integration
      metadata is not misclassified as Trellis-active.
- [x] Production mode does not turn skipped integration-owned canonical checks
      into failures.

Verification:

```bash
pnpm run build:cli
pnpm exec vitest run --project=unit tests/unit/cli-doctor.test.ts
node dist/cli.mjs doctor --json --cwd tests/fixtures/doctor-valid
```

Extra evaluation before coding:

- [x] Decided that Trellis unit tests should use a generic integration fixture
      only, with the concrete Ginko fixture living in the Ginko CMS repo. This best
      preserves CMS neutrality.

### P0-02 - Ginko CMS Declares Trellis Integration Ownership

Status: [x]
Decision: implement now in `/Users/matthias/Git/0_libs/WORK/ginko-cms`.

Completion note:

- Ginko CMS declares `trellis.integration.ownsRuntime`.
- Ginko package e2e verifies `pnpm exec trellis doctor` in a generated consumer.

Problem:

Trellis cannot know that Ginko CMS owns runtime checks unless Ginko CMS exposes a
small, package-level contract.

Tasks:

- [x] Add Trellis integration metadata to `packages/cms/package.json`.
- [x] Include the metadata in the published package. Verify `files` keeps
      `package.json` and any needed metadata.
- [x] Confirm the Ginko CMS Nuxt module is what consumer apps register.
- [x] Add or update a Ginko-owned fixture/e2e case where:
  - consumer registers Ginko CMS,
  - consumer does not directly register `@lupinum/trellis`,
  - `pnpm exec ginko-cms doctor` passes,
  - `pnpm exec trellis doctor` reports integration-managed status.

Acceptance criteria:

- [x] Ginko CMS package metadata names itself as the Trellis integration owner.
- [x] `trellis doctor` output points users to `pnpm exec ginko-cms doctor`.
- [x] Ginko CMS doctor remains the CMS-specific source of truth.
- [x] No Ginko-specific logic is required in Trellis core.

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

Status: [x]
Decision: implement now.

Completion note:

- Generated starters now render published semver ranges instead of
  `workspace:*`.
- Starter fixture typecheck/build validations assert no generated
  `workspace:*` leaks.

Problem:

Actual `trellis init` output still contains monorepo-only dependency ranges.
Fixture validation rewrites them for tests, but real generated apps are wrong.

Tasks:

- [x] Keep source fixtures as-is only if they are useful for monorepo tests.
- [x] During fixture rendering, rewrite `@lupinum/trellis` from `workspace:*` to
      a concrete semver range derived from the running package version.
- [x] Do the same for any other dependency that is published and should not
      leave the repo as `workspace:*`.
- [x] Add a built-CLI test that initializes every starter template and asserts
      generated package manifests contain no `workspace:*`.
- [x] Update `scripts/check-starter-fixtures.mjs` so it asserts external output
      is publishable, not only that internal fixture input is workspace-linked.

Acceptance criteria:

- [x] `trellis init` generated apps are installable outside the monorepo.
- [x] Generated app package manifests use `^0.1.1` or the decided published
      range for `@lupinum/trellis`.
- [x] Package-under-test validation still uses tarballs or file deps where
      appropriate.
- [x] No generated starter package contains `workspace:*`.

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

Status: [x]
Decision: implement now.

Completion note:

- Harness server type resolution passes through the prepared typecheck path.

Problem:

`pnpm run test:types:harness-server` cannot resolve
`@lupinum/trellis/workspace` from the harness server typecheck.

Tasks:

- [x] Inspect `apps/harness/server/tsconfig.json` and repo typecheck configs.
- [x] Align package subpath resolution with the established repo pattern.
- [x] Avoid adding an isolated alias source that can drift from package exports.
- [x] Confirm `@lupinum/trellis/workspace` is either intentionally public or
      replace harness imports with the intended public path.

Acceptance criteria:

- [x] `pnpm run test:types:harness-server` passes.
- [x] `pnpm run test:types` passes or reveals the next unrelated failure.
- [x] The fix agrees with `package.json` exports and API surface docs.

Verification:

```bash
pnpm run test:types:harness-server
pnpm run test:types
```

### P0-05 - Version And Compatibility Bump To `0.1.1`

Status: [x]
Decision: implement after code changes are settled.

Completion note:

- Trellis and bridge package versions are `0.1.1`.
- Trellis and Ginko compatibility metadata point at Trellis/bridge `0.1.1`.
- Ginko package manifests intentionally keep Trellis ranges at `^0.1.0` until
  Trellis `0.1.1` is published; that range accepts `0.1.1` and keeps fresh
  installs resolvable before publish. Bump those ranges to `^0.1.1` as the
  publish-time follow-up if the release process requires exact-minor ranges.

Tasks:

- [x] Bump Trellis root `package.json` to `0.1.1`.
- [x] Bump `packages/trellis-bridge/package.json` to `0.1.1`.
- [x] Update Trellis `compatibility.json`.
- [x] Update release docs and changelog references that still point at `0.1.0`
      as the current release target.
- [x] Update Ginko CMS root dev dependencies to Trellis/bridge `^0.1.1`.
- [x] Update `packages/cms/package.json` Trellis/bridge dependencies to
      `^0.1.1`.
- [x] Update `packages/cms/compatibility.json` Trellis/bridge compatibility to
      `0.1.1`.
- [x] Decide whether Ginko CMS packages themselves are also publishing `0.1.1`.
      If yes, update all Ginko package manifests and compatibility matrix in one
      release PR.

Acceptance criteria:

- [x] All release metadata agrees on the same Trellis/bridge version.
- [x] Compatibility matrix checks pass in both repos.
- [x] No docs instruct publishing or installing stale `0.1.0` for the new
      release path.

Verification:

```bash
pnpm run check:compatibility-matrix
cd /Users/matthias/Git/0_libs/WORK/ginko-cms
pnpm run check:compatibility-matrix
```

### P0-06 - Remove CMS-Specific Knowledge From Core Trellis

Status: [x]
Decision: implement with P0-01/P0-02.

Completion note:

- Trellis core has no Ginko-specific runtime branches.
- Remaining `@lupinum/ginko` matches in public/core paths are anti-leak tests.

Problem:

Trellis should be CMS-neutral. Any Ginko-specific doctor behavior belongs in
Ginko CMS, or in generic metadata that any integration package can implement.

Tasks:

- [x] Remove hardcoded `@lupinum/ginko-cms` detection from Trellis inventory.
- [x] Replace named Ginko docs with generic "packaged integration" language in
      public Trellis docs.
- [x] Keep any necessary historical notes under maintainer-only `meta/` only if
      they are still useful.
- [x] If tests need a concrete integration package, prefer a generic fixture
      package such as `@example/trellis-integration`.
- [x] Put the concrete Ginko consumer test in the Ginko CMS repo.

Acceptance criteria:

- [x] Trellis core has no Ginko-specific runtime branches.
- [x] Trellis public docs do not market or require Ginko CMS.
- [x] Ginko CMS still works through the generic integration metadata contract.

Verification:

```bash
rg -n 'Ginko|ginko|@lupinum/ginko' README.md apps/docs src packages tests
pnpm exec vitest run --project=unit tests/unit/cli-doctor.test.ts
```

Expected result:

- The `rg` command should return nothing in public/core Trellis paths, or only
  intentionally archived maintainer-only references.

### P0-07 - CI Must Match The Release Gate

Status: [x]
Decision: implement now unless intentionally postponed.

Completion note:

- CI now uses pinned Corepack/pnpm, frozen installs, explicit permissions, and a
  release-verification job.

Tasks:

- [x] Add minimal GitHub Actions permissions, at least `contents: read`.
- [x] Use Corepack and the pinned `pnpm@10.33.0`.
- [x] Replace mutable `npx ...@latest` installs.
- [x] Use `pnpm install --frozen-lockfile`.
- [x] Add a job or step that runs the same release verification gate expected
      before handoff.
- [x] Smoke import every documented public subpath from packed output, not only
      root and auth.

Acceptance criteria:

- [x] CI does not depend on mutable installer versions.
- [x] CI and local release verification do not drift.
- [x] Packed package smoke covers all public subpaths that remain documented.

Verification:

```bash
pnpm run check
pnpm run release:verify
pnpm run release:pack
```

### P0-08 - Public Security And Community Trust Docs

Status: [x]
Decision: implement before public release polish.

Completion note:

- Added public vulnerability-reporting policy, issue templates, PR template,
  and code of conduct.

Problem:

Root `SECURITY.md` currently points to an internal inventory. That is useful
maintainer context but not a public vulnerability reporting policy.

Tasks:

- [x] Replace root `SECURITY.md` with a public vulnerability disclosure policy.
- [x] Keep deep internal audit notes under `meta/SECURITY.md`.
- [x] Add supported versions guidance for `0.1.x`.
- [x] Add private reporting channel or state the temporary reporting process.
- [x] Add issue templates and PR template if this is meant to be open-source
      ready.
- [x] Add `CODE_OF_CONDUCT.md` if OSS community contribution is in scope.

Acceptance criteria:

- [x] A third-party user can tell how to report a vulnerability.
- [x] Internal security inventory remains available to maintainers but is not
      the only public security document.

Verification:

```bash
test -f SECURITY.md
test -f .github/PULL_REQUEST_TEMPLATE.md
```

### P0-09 - Remove Hardcoded Absolute Test Roots

Status: [x]
Decision: implement now.

Completion note:

- Replaced local absolute test roots with portable repo-root resolution.

Problem:

Several tests hardcode the local checkout path. This breaks portability and is
unnecessary.

Tasks:

- [x] Replace hardcoded `/Users/matthias/.../trellis` paths with `process.cwd()`
      or a test-local repo root helper.
- [x] Cover at least:
  - `tests/unit/future-agent-conventions.test.ts`
  - `tests/unit/schema-boundary-policy.test.ts`
  - `tests/unit/examples-gallery-docs.test.ts`
- [x] Check for any additional absolute local paths.

Acceptance criteria:

- [x] Tests do not encode the maintainer's local checkout path.
- [x] Tests pass from any checkout directory.

Verification:

```bash
rg -n '/Users/matthias|Git/0_libs/WORK' tests scripts src apps packages
pnpm exec vitest run --project=unit tests/unit/future-agent-conventions.test.ts tests/unit/schema-boundary-policy.test.ts tests/unit/examples-gallery-docs.test.ts
```

### P0-10 - Make Repo Policy Scans Hermetic

Status: [x]
Decision: implement now if the policy checks stay.

Completion note:

- Repo policy scans now operate on tracked files and ignore generated artifacts.

Problem:

Repo policy scans became slow/noisy after local generated artifacts existed.
Policy scans should operate on tracked source files or an explicit allowlist.

Tasks:

- [x] Change source walking to `git ls-files` where possible.
- [x] Ignore generated directories consistently:
  - `dist`
  - `.nuxt`
  - `.output`
  - `.pack`
  - `.pack-check`
  - `.convex`
  - generated Convex `_generated`
  - package build outputs
- [x] Delete policy scans that only enforce stale wording or old refactor scars.
- [x] Keep checks that protect public exports, release safety, or package
      boundaries.

Acceptance criteria:

- [x] `pnpm run check:repo-policies` completes quickly from a dirty build tree.
- [x] Policy failures map to real release or architecture contracts.

Verification:

```bash
pnpm run build
pnpm run check:repo-policies
```

### P0-11 - Remove Stale Environment Claims

Status: [x]
Decision: implement now.

Completion note:

- No runtime, starter, example, README, or public-doc occurrence remains. The
  only remaining matches are in this tracker and `summary.md`.

Problem:

Starter/example environment files mention `TRELLIS_MCP_CONFIRMATION_KEY`, but
current runtime configuration uses explicit confirmation store/mode wiring.

Tasks:

- [x] Confirm there is no runtime read of `TRELLIS_MCP_CONFIRMATION_KEY`.
- [x] Remove stale env entries from starter fixtures and examples.
- [x] Update docs to explain the actual destructive confirmation configuration.

Acceptance criteria:

- [x] No generated starter asks users to set an unused confirmation key.
- [x] Docs match runtime code.

Verification:

```bash
rg -n 'TRELLIS_MCP_CONFIRMATION_KEY|confirmation key' .
pnpm run check:examples:doctor
```

### P0-12 - Public Surface Coverage Must Match Exports

Status: [x]
Decision: implement now.

Completion note:

- Public subpath exports, type tests, and packed smoke coverage were reconciled
  for the 0.1.1 surface.

Problem:

The public surface ledger is useful, but coverage is uneven across package
exports, generated docs, type tests, tarball smoke, and CI smoke.

Tasks:

- [x] Reconcile root package exports with
      `apps/docs/content/docs/13.api-reference/7.api-surface.md`.
- [x] Ensure `@lupinum/trellis/mcp/advanced` is either fully documented and
      type-smoked or removed from the documented public surface.
- [x] Ensure bridge subpaths are documented and type-smoked if they remain
      public.
- [x] Ensure `workspace` and `type-primitives` are covered if kept.
- [x] Do not add `#trellis/permissions`; current tests intentionally assert that
      alias is not generated.

Acceptance criteria:

- [x] Package exports, API surface docs, type tests, and tarball import smoke all
      agree.
- [x] No public subpath exists only by accident.
- [x] No documented subpath is missing from packed smoke.

Verification:

```bash
pnpm run check:publish-surface
pnpm run test:types:public
pnpm run release:pack
```

## Backlog - Next High-Confidence Items

### P1-01 - Rename/Frame Inventory As Static Scan

Status: [ ]
Decision: likely implement next; keep CLI JSON compatibility unless there is a
deliberate breaking-change decision.

Progress:

- Kept CLI JSON field names stable.
- Changed user-facing doctor wording from generic "checks/verify" language to
  "static diagnostics" / "statically recognize" where doctor relies on source
  scanning.

Problem:

Doctor/inventory uses static scanning, regexes, filenames, and TypeScript AST
heuristics. That is useful, but it should not be framed as proof of architecture
correctness.

Tasks:

- [x] Audit CLI output and docs for "inventory engine" or proof-like wording.
- [x] Rename user-facing wording to "static scan" or "static diagnostics".
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

Status: [ ]
Decision: evaluate before implementing.

Progress:

- Identified consumers in `src/runtime/feature`, `src/runtime/workspace`, unit
  tests, and the phase0 fixture.
- Removed empty `layers` and `findings` fields from `AppInventoryJson`; the
  separate CLI doctor inventory keeps its real `layers/findings` report shape.

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

- [x] Identify all consumers of `defineFeature`, `composeFeatures`,
      `defineAppInventory`, and `toAppInventoryJson`.
- [ ] Add an invariant test that catches mismatch between feature schema,
      root Convex schema, and tenant isolation metadata.
- [x] Remove empty `layers: []` and `findings: []` from exported JSON unless
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

Status: [ ]
Decision: evaluate public API impact before removing methods.

Progress:

- Removed unused no-op `ObservationSummary.info/warn/error` methods from the
  internal summary accumulator.

Problem:

Some observability names imply more behavior than exists. Event capture and
redaction are real; no-op summary methods are not.

Tasks:

- [ ] Audit public docs for "semantic observability" claims.
- [x] Either implement meaningful `info/warn/error` delivery or remove/rename
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
Decision: evaluate in a dedicated PR; do not mix with release work.

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

Status: [x]
Decision: delete low-signal checks after replacement coverage is identified.

Completion note:

- Deleted `future-agent-conventions.test.ts` and
  `runtime-facade-boundaries.test.ts`.
- Kept release/API contract coverage in `test:contracts:repo`.

Problem:

Phrase-locking and old-path convention tests are useful during refactors but
become permanent scar tissue.

Tasks:

- [x] Classify each convention/policy test as:
  - public contract,
  - release safety,
  - temporary refactor guard,
  - wording preference.
- [x] Delete wording preference tests.
- [x] Expire retained old-path bans when the migration window is no longer
      needed.
- [x] Replace with invariant tests for auth, tenant isolation, destructive
      confirmation, public imports, and package tarballs.

Acceptance criteria:

- [x] Fewer policy tests, higher signal.
- [x] No loss of public API or release safety coverage.

Verification:

```bash
pnpm run test:contracts:repo
pnpm run test:contracts
```

### P1-09 - Deduplicate Codegen Rendering

Status: [x]
Decision: implement when nearby code is touched.

Completion note:

- Extracted shared ref-module import/API-path rendering while keeping
  operation and MCP binding bodies explicit.
- Existing exact fixture-output tests stay byte-stable.

Problem:

Operation-ref and MCP-tool-ref codegen share import/path rendering patterns.

Tasks:

- [x] Extract one small internal renderer only if it removes meaningful
      duplication.
- [x] Keep generated output byte-stable where possible.
- [x] Add snapshot or exact-output tests if not already present.

Acceptance criteria:

- [x] One implementation path for shared codegen formatting.
- [x] Generated API docs/types do not drift unexpectedly.

Verification:

```bash
pnpm exec vitest run --project=unit tests/unit/*codegen*.test.ts
pnpm run check:publish-surface
```

## Backlog - Evaluate Before Acting

These are not release blockers. Do not implement them until the evaluation
produces a clear acceptance criterion.

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

Status: [x]

Decision: implemented.

Completion note:

- Root Trellis and bridge package manifests now declare Node and pnpm engines.
- Installation docs match the package manifests.

Concern:

Docs, CI, and package manager versions should agree. Adding strict engines can
be useful, but choose the supported Node range deliberately.

Acceptance criterion before adding:

- [x] Decide Node support target.
- [x] CI, docs, package manifests, and release notes agree.

## Verification Playbook

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

## Completed 0.1.1 PR Order

1. [x] P0-09 hardcoded test roots and P0-10 hermetic policy scans.
2. [x] P0-04 harness type resolution.
3. [x] P0-01/P0-02/P0-06 integration-aware doctor and Ginko metadata.
4. [x] P0-03 starter dependency rewrite.
5. [x] P0-12 public surface coverage.
6. [x] P0-07 CI release-gate alignment.
7. [x] P0-08 security/community docs.
8. [x] P0-11 stale env cleanup.
9. [x] P0-05 version and compatibility bump to `0.1.1`.
10. [x] Follow-up P1 cleanup evaluated and split into the backlog above.

## Recommended Next Backlog Order

1. [ ] P1-01 doctor static-scan adversarial tests.
2. [ ] P1-03 observability docs and `createDenialExplanation` cleanup.
3. [ ] P1-02 feature manifest invariant test before any naming/API decision.
4. [?] P1-04 MCP authoring cleanup only after confirming docs already point at
   one recommended path.
5. [?] P1-07 CLI patching audit before keeping or demoting `trellis add entity`.

## Do Not Do Without A Fresh Decision

- Do not hardcode Ginko CMS behavior in Trellis core.
- Do not add `#trellis/permissions`; current behavior intentionally avoids that
  alias.
- Do not remove published subpaths casually just because they look facade heavy.
- Do not split giant files while tests are red unless the split is needed to make
  the red test fix safe.
- Do not add new doctor concepts without a fixture proving why they exist.
- Do not add compatibility shims for unreleased internals.
- Do not run live publish commands from an agent session.
