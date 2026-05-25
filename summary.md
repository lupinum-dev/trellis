# Trellis Deslop Review Summary

Date verified: 2026-05-25  
Workspace: `/Users/matthias/Git/0_libs/WORK/trellis`

This file consolidates the six external audit/review notes into one maintainer
decision document. It separates:

- advice that is correct and should be acted on,
- advice that is directionally right but needs a safer framing,
- advice that requires a migration path because it touches released public
  surface,
- advice that is stale, overreaching, or should be rejected,
- concrete acceptance criteria for a path to a cleaner release.

The standard applied here is the Trellis agent standard: simplify first,
preserve real contracts, avoid second sources of truth, and do not break
released surfaces casually.

## Verification Performed

Local checks and commands run while preparing this summary:

- `npm view @lupinum/trellis version --json`
- `npm view @lupinum/trellis-bridge version --json`
- `pnpm run test:types:harness-server`
- `pnpm run check:packs:no-workspace-refs`
- `pnpm run audit:prod`
- `node dist/cli.mjs init demo-app --template public --cwd <tmp> --json`
- static inspection of `package.json`, bridge package exports, docs, CI,
  starter generation, doctor/inventory code, feature manifests, observability,
  MCP runtime, bridge runtime, repo policy checks, and public-surface tests

Results:

- npm registry currently has both packages at `0.1.0`.
- Local package manifests are also `0.1.0`; the next publish needs a version
  bump.
- `pnpm run test:types:harness-server` fails:
  - `apps/harness/convex/posts.ts(10,36): Cannot find module '@lupinum/trellis/workspace'`
  - follow-on implicit `any` errors in the same file.
- `pnpm run audit:prod` passes.
- `pnpm run check:packs:no-workspace-refs` passes after building both packages.
  Packed package manifests do not ship `workspace:*`.
- Actual generated starter output still contains
  `"@lupinum/trellis": "workspace:*"`.
- `pnpm run check:repo-policies` became impractically slow after local build
  artifacts existed and had to be killed. The scanner does not consistently use
  `git ls-files` or ignore generated app directories while walking source roots.
- The working tree was clean after verification; generated artifacts are ignored.

## Executive Verdict

Trellis has real product-quality foundations in the protected backend path,
identity forwarding, destructive confirmation, and release-surface discipline.
Those should be preserved.

The repo is not release-polished yet. The largest issues are not missing
features; they are mismatched public claims, scanner-grade diagnostics presented
too confidently, starter output that is wrong for external users, private/CMS
residue in generic Trellis, brittle CI, and several public surfaces that need
either tighter documentation or a deliberate deprecation plan.

The path to 10/10 is mostly:

1. fix the release blockers,
2. make public claims match what the code proves,
3. remove or rename aspirational surfaces,
4. replace phrase/path policing with invariant tests,
5. split large internal files only where that makes behavior easier to reason
   about.

## Preserve

These are not slop and should not be deleted during cleanup.

### Protected Backend Decision Path

`src/runtime/functions/define-handler.ts` has a concrete
`guard -> load -> authorize -> handler` flow. It is understandable, testable,
and aligns with the project architecture. Keep this as the canonical backend
decision path.

Do not move backend authorization into frontend orchestration, MCP visibility,
or bridge code.

### Destructive Confirmation

The destructive flow has real safety checks:

- missing token rejection,
- expiry/replay checks,
- operation and execute path binding,
- args hash checks,
- preview hash/version drift checks,
- audit writes,
- production guardrails for transport-level confirmation stores.

This is worth hardening, not simplifying away. The code in
`src/runtime/functions/index.ts`, `src/runtime/mcp/destructive-confirmation.ts`,
and `src/runtime/mcp/operation-binding.ts` addresses real failure modes.

### Identity Forwarding

Signed identity forwarding, canonical args hashing, purpose/audience checks, and
replay-sensitive paths are real security work. Keep the envelope model. Cleanup
should focus on public naming and tests, not on removing the protocol.

### API Surface Ledger

The generated API surface doc at
`apps/docs/content/docs/13.api-reference/7.api-surface.md` is a useful release
discipline. Keep it generated and keep checking it.

Improve the surrounding contract tests so the generated doc, `package.json`
exports, `typesVersions`, package tarballs, and type smoke tests all agree.

### Release Publish Brake

`release:publish` intentionally exits. Keep that. Publishing should remain a
manual inspected-tarball flow until trusted publishing is deliberately added.

## Release Blockers

These block a clean next release. Fix before broad refactors.

### 1. `pnpm run check` Is Red

Verified through the focused failing sub-command:

```bash
pnpm run test:types:harness-server
```

Failure:

```text
apps/harness/convex/posts.ts(10,36): error TS2307: Cannot find module '@lupinum/trellis/workspace'
```

Why it matters:

- The release gate includes `test:types`.
- This is not a cosmetic audit item; it makes the package unreleasable.

Likely cause:

- `apps/harness/server/tsconfig.json` does not resolve the root workspace package
  subpaths the same way Vitest and other type gates do.

Acceptance criteria:

- `pnpm run test:types:harness-server` passes.
- `pnpm run test:types` passes far enough to reveal any next failure.
- The fix does not add a second fake package alias source unless that alias is
  the already-established repo pattern.

### 2. Version `0.1.0` Is Already Published

Verified:

```text
@lupinum/trellis        0.1.0
@lupinum/trellis-bridge 0.1.0
```

Local manifests still say `0.1.0`:

- root `package.json`
- `packages/trellis-bridge/package.json`
- `compatibility.json`
- release docs that use `VERSION=0.1.0`

Why it matters:

- A second publish of the same version will fail.
- Release notes and compatibility data must match the next version.

Acceptance criteria:

- Next release PR bumps root package, bridge package, compatibility tuple, docs,
  and changelog consistently.
- `npm view` is checked before final publish.

### 3. `trellis init` Emits `workspace:*`

Verified by running the built CLI:

```bash
node dist/cli.mjs init demo-app --template public --cwd <tmp> --json
```

Generated `package.json` contains:

```json
"@lupinum/trellis": "workspace:*"
```

The starter validation script rewrites generated apps to a local tarball for
tests, but real users running `pnpm dlx @lupinum/trellis init ...` get the raw
fixture value.

Why it matters:

- Generated apps are unusable outside the monorepo without manual dependency
  repair.
- This contradicts the README's public CLI story.

Recommended fix:

- Keep fixture source using `workspace:*` if that is useful for monorepo tests.
- During CLI rendering, replace `@lupinum/trellis: "workspace:*"` with a concrete
  published semver range derived from the running package version.
- Add a CLI init test that shells the built CLI into a temp dir and asserts no
  `workspace:*` in generated package manifests.

Acceptance criteria:

- All `trellis init` templates generate external-safe dependency ranges.
- Starter fixture validation still uses tarball rewrites for package-under-test
  validation.
- `pnpm run check:starter-fixtures:typecheck` and
  `pnpm run check:starter-fixtures:build` still pass.

### 4. Core Trellis Leaks Ginko/CMS-Specific Knowledge

Verified instances:

- `src/cli/lib/inventory.ts` hardcodes `@lupinum/ginko-cms`.
- README and docs mention Ginko directly.
- Tests use Ginko-specific fixture names.

This violates the project rule that Trellis stays CMS-neutral.

Recommended fix:

- Delete the hardcoded `@lupinum/ginko-cms` package name from core inventory.
- Detect bridge packages through generic bridge-manifest/package metadata instead
  of product names.
- Replace public docs with generic "packaged integration" examples.
- Keep Ginko-specific policy in the Ginko package/docs.

Migration impact:

- If existing Ginko users rely on `trellis doctor` detecting
  `@lupinum/ginko-cms` as a bridge dependency, replace that behavior with
  package-agnostic manifest detection in the same PR. Do not simply remove the
  detection and make doctor less useful.

Acceptance criteria:

- `rg -n "Ginko|ginko|@lupinum/ginko" README.md apps/docs src packages tests`
  returns no generic/public Trellis product references, except clearly archived
  maintainer-only material if intentionally kept under `meta/`.
- `trellis doctor` still reports bridge inventory for packages that expose the
  documented bridge manifest contract.

### 5. CI Is Not Release-Grade

Verified `.github/workflows/ci.yml` issues:

- installs `corepack@latest`,
- uses `npx nypm@latest i`,
- uses mutable install behavior instead of the committed package-manager and
  lockfile,
- does not run the exact full `release:verify` gate,
- lacks explicit top-level `permissions: contents: read`.

Recommended fix:

- Use `actions/setup-node` plus Corepack pinned from `packageManager`.
- Run `pnpm install --frozen-lockfile`.
- Add a release-verification job or a CI job that runs the exact release gate
  where practical.
- Keep a smaller PR gate if needed, but make it explicit that release readiness
  is gated by the release job.
- Avoid mutable `npx ...@latest` in CI.

Acceptance criteria:

- CI and local release instructions use the same package-manager version.
- A clean clone path exists:

```bash
corepack pnpm install --frozen-lockfile
pnpm run check
pnpm run release:verify
pnpm run release:pack
```

### 6. OSS Security And Community Docs Are Thin

Verified:

- root `SECURITY.md` only points at `meta/SECURITY.md`;
- `meta/SECURITY.md` is a maintainer security inventory, not a vulnerability
  reporting process;
- `.github` only contains workflows;
- no issue templates, PR template, or code of conduct were present.

Recommended fix:

- Replace root `SECURITY.md` with a public vulnerability disclosure policy.
- Keep the deeper maintainer inventory under `meta/SECURITY.md`.
- Add `CODE_OF_CONDUCT.md`, issue templates, and PR template before marketing
  the repo as a polished OSS package.

Acceptance criteria:

- A security reporter can find where and how to report a vulnerability without
  reading internal architecture inventory.
- The root security doc lists supported versions and expected response path.

### 7. Hardcoded Absolute Test Roots

Verified:

- `tests/unit/future-agent-conventions.test.ts`
- `tests/unit/schema-boundary-policy.test.ts`
- `tests/unit/examples-gallery-docs.test.ts`

all contain:

```ts
const root = '/Users/matthias/Git/0_libs/WORK/trellis'
```

Recommended fix:

- Replace with `process.cwd()` or a shared repo-root helper.

Acceptance criteria:

- These tests pass from any checkout location.
- A simple `rg "/Users/matthias/Git/0_libs/WORK/trellis" tests src apps examples`
  returns nothing outside intentionally archived notes.

### 8. Stale `TRELLIS_MCP_CONFIRMATION_KEY`

Verified:

- `src/cli/starter-fixtures/workspace-mcp/.env.example` includes
  `TRELLIS_MCP_CONFIRMATION_KEY`.
- Example `.env.example` files also mention it.
- Runtime code uses explicit `confirmationStore` / `confirmationMode`, not this
  env var.

Recommended fix:

- Remove the env var from starter and example public env files unless a real
  runtime reads it.
- If the intent is to support an env-backed confirmation store, implement that
  store explicitly and document it. Do not leave an unused secret-looking env
  variable.

Acceptance criteria:

- `rg "TRELLIS_MCP_CONFIRMATION_KEY" src apps examples README.md apps/docs`
  returns nothing, or every remaining hit maps to implemented behavior.

## High-Confidence Deslop Items

These make sense and should be planned after release blockers.

### Rename/Frame Doctor Inventory As Static Scan

Current code in `src/analysis/project.ts`, `src/cli/lib/project.ts`, and
`src/cli/lib/inventory.ts` infers architecture from filenames, regexes,
ts-morph over source text, string matches, and conventions.

That is useful, but it is not proof of runtime correctness.

Recommended direction:

- Rename docs and user-facing language from "inventory engine" or semantic
  inventory proof to "static inventory scan".
- Keep doctor findings as diagnostics.
- Avoid implying a pass means the app is architecturally safe.

Acceptance criteria:

- Doctor output and docs say "static scan" or equivalent.
- Findings use language like "detected", "not detected", "could not verify",
  not "proved".
- Tests cover false positive and false negative scanner cases:
  comments, strings, aliases, re-exports, dynamic imports, non-canonical but valid
  TypeScript syntax.

### Make Feature Manifest Either Canonical Or More Honest

Current state:

- `composeFeatures()` builds schema, permissions, tenant tables, shared tables,
  and operations.
- `convex/schema.ts` in examples still manually imports and spreads table
  objects.
- `toAppInventoryJson()` returns `layers: []` and `findings: []`.
- `deriveTenantTablesFromSchema()` infers tenant tables from field/index shape.

This is a source-of-truth smell. It may be acceptable as a manifest helper, but
not as a canonical app model unless the schema and runtime derive from it.

Recommended direction:

- Short term: remove empty `layers` and `findings` from `AppInventoryJson`, or
  mark them experimental/internal if they are not consumed.
- Short term: rename docs around `defineFeature`/`composeFeatures` to "feature
  manifest metadata" if behavior is not being composed.
- Medium term: decide whether feature manifests drive root Convex schema and
  isolation. If yes, add invariant tests. If no, stop calling them canonical
  inventory.

Migration impact:

- `@lupinum/trellis/workspace` is a published subpath and is used by examples
  and starters. Renaming exports needs a deprecation path.
- Removing `layers`/`findings` from JSON may break any consumer reading that
  shape. Because this is published `0.1.0`, either:
  - keep fields for one minor release but mark deprecated and always empty, or
  - make a deliberate breaking release with changelog migration.

Acceptance criteria:

- One invariant test catches drift between feature schema, root schema, tenant
  classification, and `defineTrellis({ isolation })`.
- No public JSON fields advertise a future system without a consumer.

### Replace Phrase/Path Tests With Behavior Contracts

Valid targets:

- `tests/unit/future-agent-conventions.test.ts`
- parts of `tests/unit/runtime-facade-boundaries.test.ts`
- phrase-heavy examples/docs tests
- broad repo-policy regex checks that do not protect released behavior

Current issues:

- Some tests assert exact wording like "stable automation seam".
- Some enforce folder politics rather than behavior.
- Three tests hardcode a local absolute repo path.

Recommended direction:

- Keep tests that protect public exports, generated API-surface consistency,
  release safety, starter output, and package boundaries.
- Delete or shrink tests that only freeze narrative wording.
- Move temporary refactor guards into an explicit temporary checklist with an
  expiry condition, not permanent test policy.

Acceptance criteria:

- Removing a docs sentence does not fail a product test unless that sentence is
  part of a public contract.
- Package export tests and behavior tests still catch real regressions.

### Make Repo Policy Scans Hermetic

Verified issue:

- `scripts/check-repo-policies.mjs` walks roots like `apps` and `examples` and
  does not ignore all generated directories while collecting files.
- Local generated directories include `.nuxt`, `.output`, `.convex`, `dist`, and
  many `node_modules`.
- The check became slow enough after local artifacts existed that it had to be
  killed.

Recommended direction:

- Prefer `git ls-files` for repo policy checks.
- Or explicitly ignore `.convex`, `.nuxt`, `.output`, `dist`, `.pack`,
  `.pack-check`, and `node_modules` everywhere source walking occurs.

Acceptance criteria:

- `pnpm run check:repo-policies` completes quickly after a local build, test,
  and example run.
- The check scans tracked source, not generated local state.

### Split Giant Runtime Files Internally

Valid concern:

- `src/runtime/functions/index.ts` is 3,146 lines.
- `src/runtime/mcp/define-mcp-app.ts` is 1,506 lines.

Do not split just to satisfy aesthetics. Split only where it clarifies real
responsibility and preserves the public facade.

Recommended direction:

- Keep public exports stable.
- Extract focused internals around destructive confirmation, forwarding,
  isolation/service DB wrapping, operation metadata, and builder lanes.
- Avoid new generic service layers or compatibility shims.

Acceptance criteria:

- No public API change.
- Existing behavior tests pass.
- Each extracted file has a single reason to exist and is not another facade
  barrel.

### Deduplicate MCP Execution Plumbing

Valid concern:

- `defineMcpApp` and `defineTool` both own similar rate-limit validation,
  handler wrapping, and result-envelope paths.
- `defineMcpApp` already delegates to `defineToolInternal`, so this is not two
  completely independent systems, but there is still duplicated validation and
  wrapping logic.

Recommended direction:

- Keep one recommended authoring path: `defineMcpApp(...).tool.*`.
- Keep standalone `defineTool` advanced and non-app-write, as docs already say.
- Deduplicate shared rate-limit/result/middleware mechanics internally.

Migration impact:

- `@lupinum/trellis/mcp/advanced` is published and documented.
- Removing or renaming `defineTool` requires deprecation, changelog, and a
  replacement path.
- A docs-only demotion does not require migration; the docs already mostly do
  this.

Acceptance criteria:

- Public docs show one app-backed happy path.
- Standalone tools cannot call app mutations/actions.
- Direct mutations cannot down-classify unsafe backend work.
- Shared wrapper behavior is tested once and used by both lanes.

### Bridge Registrar Deduplication

Valid concern:

- `packages/trellis-bridge/src/create-component-bridge.ts` repeats similar logic
  for query, mutation, action, internalQuery, internalMutation, and internalAction.

Recommended direction:

- Deduplicate the implementation with a small direct helper/table.
- Do not create a broad generic adapter framework.
- Preserve the public API for now.

Migration impact:

- `@lupinum/trellis-bridge/component` is published.
- `bridge.from(...)` is used in `examples/08-component-mini-cms` and type tests.
- Deleting `from(...)` requires migration. Internal dedupe does not.

Acceptance criteria:

- Existing bridge tests and example 08 still pass.
- There is one forwarding implementation path for operation kind plus visibility.

### Collapse Duplicate Ref Codegen Helpers

Valid concern:

- `src/module-internals/operation-ref-codegen.ts` and
  `src/module-internals/mcp-tool-ref-codegen.ts` duplicate import/path rendering.

Recommended direction:

- Collapse shared import/path rendering into one internal helper.
- Keep generated output unchanged.

Migration impact:

- None if output stays unchanged.

Acceptance criteria:

- `tests/unit/operation-ref-codegen.test.ts` remains green.
- Generated fixture files do not change unless deliberately updated.

### CLI Patching Needs Either Structure Or Honest Limits

Valid concern:

- `trellis add entity` patches TypeScript via string replacement in
  `src/cli/lib/resource.ts`.
- `trellis add mcp` patches `nuxt.config.ts` and schema via regex/string search
  in `src/cli/lib/init.ts`.

The code does fail with explicit "Expected a canonical layout" messages. That is
better than silent mutation, but still brittle for a public CLI.

Recommended direction:

- Keep the CLI narrow: only patch generated/canonical layouts.
- Add tests for rejection on non-canonical layouts.
- If supporting arbitrary user projects becomes a requirement, use structured
  parsing/editing. Do not keep adding regex cases.

Migration impact:

- `trellis add entity` is in the README public product surface. Removing or
  renaming it needs a migration/deprecation note.
- Narrowing it to generated layouts can be a patch/minor fix if error messages
  are clear.

Acceptance criteria:

- Non-canonical projects fail before writing partial files.
- Generated starters patch cleanly.
- Tests assert no half-mutated state on failure.

## Advice That Needs Migration Or Deprecation

These may be good ideas but touch released public surface.

### Removing `@lupinum/trellis/workspace`

Do not hard-delete immediately.

Current state:

- It is exported in root `package.json`.
- It appears in generated API docs.
- It is used by examples and starters.
- The harness type failure is about resolving this subpath, not about it being
  unused.

Recommendation:

- Keep for the next release while deciding whether it is really public.
- If it is mostly a facade over feature/visibility/type primitives, document it
  as the "workspace manifest helpers" surface.
- If removing, deprecate first and provide replacements.

Migration path:

1. Add docs note: "workspace subpath is feature-manifest metadata helpers."
2. Add replacement imports if moving functions elsewhere.
3. Warn in changelog.
4. Remove only in a breaking release.

### Removing `@lupinum/trellis/type-primitives`

Do not hard-delete immediately.

Current state:

- It is exported and documented as an advanced TypeScript entrypoint.

Recommendation:

- Audit whether external type tests or examples need it.
- If it is only internal convenience, deprecate and move types to their owning
  public subpaths.

Migration path:

- Keep type aliases re-exported for one release.
- Mark as advanced/deprecated in docs if removal is planned.

### Renaming `defineMcpApp`

Reject immediate rename.

Reason:

- It is the documented app-backed MCP runtime factory.
- The docs already explain the returned `tool.query`, `tool.mutation`, and
  `tool.operation` lanes.

Better path:

- Keep the name.
- Improve docs if needed.
- Split internals and improve tests before considering public renames.

Migration path if renamed later:

- Add new name as alias.
- Deprecate old name in docs/changelog.
- Remove in a breaking release.

### Renaming `defineTool`

Do not hard-rename immediately.

Current state:

- It is under `@lupinum/trellis/mcp/advanced`.
- Docs already state it is not an app-write lane.
- Type tests enforce standalone tools cannot call Convex mutations/actions.

Recommendation:

- Keep the export for now.
- Rename docs language to "standalone advanced tool" where still ambiguous.
- Consider an alias like `defineStandaloneTool` later, but do not force churn
  before the surface is otherwise stable.

### Removing Bridge `from(...)`

Do not delete immediately.

Current state:

- Maintained example 08 uses `bridge.from(...)`.
- Type tests cover `bridge.from(...)`.

Recommendation:

- Keep public API.
- Deduplicate internals.
- If product usage shows `from(...)` is unnecessary, deprecate with a
  one-to-one migration to explicit `bridge.query`, `bridge.internalMutation`,
  etc.

### Removing `trellis add entity`

Do not delete casually.

Current state:

- README advertises it as official product surface.
- It generates many files and patches existing files.

Recommendation:

- Decide if it is truly required for `0.1.x`.
- If yes, make it canonical-layout-only and harden failure behavior.
- If no, remove from README first, then deprecate the command before deletion.

Migration path:

- Add changelog note and replacement guidance.
- Keep command as a warning/no-op or advanced command for one release if users
  may already have tried it from `0.1.0`.

### Changing `AppInventoryJson`

Be careful.

Even if `layers: []` and `findings: []` are empty, deleting fields changes a
published JSON shape.

Recommendation:

- If no consumer exists, remove in the next breaking release or before any next
  public promise.
- If keeping `0.1.x` compatibility matters, mark fields deprecated and keep them
  empty until a breaking cleanup.

## Advice To Reject Or Defer

### "Delete Observability"

Reject.

There is a real event emitter, redaction, correlation, capture, and bounded sink
delivery. The docs already say log delivery is outside the default runtime.

Keep:

- event vocabulary,
- redaction,
- correlation,
- test capture,
- sink boundary.

Improve:

- public wording where it implies a complete observability product,
- no-op `debug/info/warn/error` naming if it confuses users,
- docs option names that drift from actual config (`sample`, `correlation.header`,
  `service`, `explainability`).

### "Doctor Is Useless"

Reject.

Doctor/static inventory is useful as diagnostics. The problem is overclaiming,
not existence.

Keep doctor, but label it honestly and test scanner edge cases.

### "Delete All Architecture Tests"

Reject.

Some architecture tests protect real public contracts:

- package subpath exports,
- removed public subpaths,
- generated API surface,
- bridge/core package boundary,
- starter names,
- public examples not regressing to deleted surfaces.

Delete phrase locks and local-path tests. Keep release and package contracts.

### "Collapse Everything Into One Path Immediately"

Reject as a blanket move.

There should be one recommended path per user job, but public API removal needs
release discipline. Internal hard cutovers are fine; released subpaths and CLI
commands need compatibility notes.

### "`#trellis/permissions` Needs Coverage"

Reject as stated.

Current module tests explicitly assert that `trellis/permissions.ts` is not
generated and docs list permission composables as auto-imports, not a generated
alias. Do not add `#trellis/permissions` just because an audit mentioned it.

If a permissions alias becomes a real requirement, define the acceptance
criterion first.

## Public Surface Coverage Notes

### Core Package

Current exported subpaths:

- `.`
- `./auth`
- `./args`
- `./backend`
- `./workspace`
- `./composables`
- `./mcp`
- `./mcp/advanced`
- `./type-primitives`
- `./server`
- `./testing`

Coverage is mixed:

- API surface docs include the subpaths.
- `tests/unit/package-subpath-exports.test.ts` checks many but currently omits
  `./mcp/advanced` in its package export expectations.
- `tests/unit/mcp-index-exports.test.ts` checks the advanced runtime module
  directly.
- type config for public tests does not map every documented subpath.

Recommendation:

- Add one authoritative package-surface test that compares `package.json`
  exports, `typesVersions`, generated API surface docs, and type smoke entries.
- Avoid many tiny export-shape tests when one generated contract can cover the
  real public surface.

### Bridge Package

Current exported subpaths:

- `.`
- `./component`
- `./convex`
- `./manifest`

Coverage exists:

- `tests/unit/bridge-package-exports.test.ts`
- bridge runtime tests,
- bridge type tests for `./component`,
- manifest tests for `./manifest`.

Concern:

- `./convex` appears to duplicate `./component` for runtime APIs.

Recommendation:

- Decide whether `./convex` is a real semantic subpath or an accidental alias.
- If accidental, deprecate before removal.
- If real, document its intended audience and add type smoke coverage for it.

## Test Hardening Matrix

Add tests for invariants rather than wording.

### Tenant Isolation

Already covered:

- cross-scope `get` rejection,
- cross-scope mutation rejection through update/delete paths,
- tenant-scoped list results,
- explicit `escapeIsolation`,
- unsafe query still respecting plain `ctx.db`.

Still worth adding:

- table-method matrix for `get`, `query`, `insert`, `patch`, `replace`, and
  `delete` where possible,
- explicit insert mismatch test if runtime permits constructing mismatched
  tenant fields,
- explicit `replace` coverage.

### Doctor/Static Scan

Add adversarial fixtures:

- comments containing forbidden patterns,
- string literals containing fake definitions,
- aliases/re-exports,
- dynamic imports,
- multiline/indirect `defineFeature` and `defineSchema` patterns,
- valid non-canonical files that should fail honestly rather than be misread.

### MCP

Keep/add tests that prove:

- standalone advanced tools cannot call app writes,
- app writes go through `tool.mutation` or `tool.operation`,
- destructive tools cannot bypass preview confirmation,
- stale recordAccess returns backend denial rather than authorizing a write,
- production transport confirmation requires distributed store,
- rate-limit behavior is consistent across app-backed and standalone lanes.

### Destructive Confirmation

Already good:

- token missing,
- replay,
- args mismatch,
- preview version drift,
- token stripping for transport-confirmed bridge mutations,
- production store guard.

Still worth adding:

- concurrent confirm/execute race against the same token with a store that models
  atomic redeem behavior,
- cross-instance store behavior for any first-party store implementation.

### Starter Output

Add generated-output tests:

- no `workspace:*` in actual CLI output,
- no unused secret env vars,
- generated package installs outside monorepo,
- generated app can run `trellis doctor`.

## Recommended PR Sequence

### PR 1: Release Gate Green

Scope:

- fix `test:types:harness-server`,
- replace hardcoded absolute test roots,
- remove stale `TRELLIS_MCP_CONFIRMATION_KEY` from public examples/starters if
  unused.

Exit criteria:

- `pnpm run test:types:harness-server` passes.
- `rg "/Users/matthias/Git/0_libs/WORK/trellis" tests src apps examples` has no
  active test/source hits.
- `rg "TRELLIS_MCP_CONFIRMATION_KEY" src apps examples README.md apps/docs`
  has no stale public hits.

### PR 2: External-Safe Starters

Scope:

- make `trellis init` rewrite starter package dependency ranges to the running
  package version,
- add generated CLI output tests,
- keep tarball validation path.

Exit criteria:

- Built CLI output contains no `workspace:*`.
- `pnpm run check:starter-fixtures:typecheck` passes.
- `pnpm run check:starter-fixtures:build` passes.
- `pnpm run check:packs:no-workspace-refs` passes.

### PR 3: CMS-Neutral Core

Scope:

- remove `@lupinum/ginko-cms` from core inventory,
- replace public Ginko wording with generic packaged-integration wording,
- keep bridge detection through generic manifest/package metadata.

Exit criteria:

- No generic/public Trellis surface names Ginko.
- Doctor still detects installed bridge packages generically.
- Existing bridge tests pass.

### PR 4: CI And OSS Trust

Scope:

- pin install behavior to Corepack/pnpm from `packageManager`,
- use `pnpm install --frozen-lockfile`,
- add top-level workflow permissions,
- add release-verification job or exact release-gate job,
- add root security reporting doc, PR template, issue templates, code of conduct.

Exit criteria:

- Clean clone install/build instructions match CI.
- No `@latest` install tools in CI.
- Root `SECURITY.md` is actionable for external reporters.

### PR 5: Static Scan Honesty

Scope:

- rename/framing from inventory engine to static scan where user-facing,
- update doctor wording,
- make repo policy scans hermetic,
- add scanner adversarial fixtures.

Exit criteria:

- Generated artifacts do not slow or poison repo-policy scans.
- Doctor docs do not imply proof beyond static detection.
- False positive/negative tests exist.

### PR 6: Feature Manifest Decision

Scope:

- decide whether feature manifests drive schema/isolation or are metadata helpers,
- remove/deprecate empty JSON fields or document them honestly,
- add invariant tests for schema/manifest/isolation drift.

Exit criteria:

- One source of truth is named.
- Drift test fails if root schema and feature manifest disagree.
- Public JSON shape decision is captured in changelog if changed.

### PR 7: MCP And Runtime Internal Cleanup

Scope:

- deduplicate shared MCP rate-limit/result/middleware mechanics,
- split `define-mcp-app.ts` and `functions/index.ts` by real responsibility,
- keep public exports stable.

Exit criteria:

- No public API change.
- Existing MCP/destructive tests pass.
- Extracted files correspond to real runtime responsibilities.

### PR 8: Bridge Runtime Simplification

Scope:

- deduplicate create-component-bridge registrar internals,
- decide and document `./convex` subpath,
- keep or deprecate `from(...)` deliberately.

Exit criteria:

- Example 08 and bridge type tests pass.
- One internal forwarding path handles all operation kinds.
- Any public deprecation is documented.

### PR 9: Version And Release Prep

Scope:

- bump package versions after fixes,
- update `compatibility.json`,
- update changelog,
- run release verification and pack.

Exit criteria:

```bash
pnpm run check
pnpm run release:verify
pnpm run release:pack
```

Then inspect tarballs outside the repo and smoke install both packages.

## Decision Table

| Advice | Decision | Why |
| --- | --- | --- |
| Preserve protected handler flow | Accept | Real backend invariant path |
| Preserve identity forwarding | Accept | Real cross-transport trust protocol |
| Preserve destructive confirmation | Accept | Real safety controls and tests |
| Keep generated API surface docs | Accept | Useful release ledger |
| Fix `pnpm run check` red | Accept/blocker | Verified type failure |
| Bump version before next publish | Accept/blocker | `0.1.0` already published |
| Fix starter `workspace:*` | Accept/blocker | Verified actual CLI output |
| Remove Ginko leakage | Accept/blocker | Violates CMS-neutral rule |
| Harden CI | Accept/blocker | Mutable installs and partial gate |
| Add OSS security docs/templates | Accept | Required for public trust |
| Rename inventory to static scan | Accept | Current implementation is heuristic |
| Delete all doctor/inventory | Reject | Diagnostics are useful |
| Delete all convention tests | Partially accept | Delete phrase locks, keep public contracts |
| Remove hardcoded test roots | Accept | Verified portability bug |
| Remove stale env var | Accept | No runtime use found |
| Rename `defineMcpApp` now | Reject/defer | Released documented API |
| Rename `defineTool` now | Defer | Advanced subpath already clarifies |
| Collapse MCP public paths | Defer with migration | Public API and docs exist |
| Remove `workspace` subpath | Defer with migration | Published and used |
| Remove `type-primitives` subpath | Defer with migration | Published/documented advanced type API |
| Remove bridge `from(...)` | Defer with migration | Used by maintained example/types |
| Deduplicate bridge registrars | Accept | Internal simplification, no API break |
| Split giant runtime files | Accept carefully | Internal clarity only, no facade churn |
| Replace CLI regex patching with parser | Partially accept | Either structured edits or strict canonical failure |
| Add `#trellis/permissions` coverage | Reject | Not a current generated alias |
| Make observability honest | Accept | Keep event system; fix overclaim/mismatch |

## Definition Of 10/10 For This Repo

A 10/10 Trellis release is not bigger. It is smaller, more literal, and easier
to verify.

The target state:

- one protected backend decision path,
- one recommended MCP app-backed authoring path,
- one explicit source of truth for feature/schema/isolation metadata,
- static diagnostics labeled as static diagnostics,
- public names that describe what the code proves today,
- no private product names in generic Trellis,
- generated starters that work outside the monorepo,
- CI that matches the release runbook,
- tests aimed at isolation, forwarding, destructive confirmation, public imports,
  starter output, and package tarballs rather than docs wording.

The next best action is not a broad refactor. It is PR 1 and PR 2: make the gate
green and make generated starters external-safe. After that, remove private
residue and make the diagnostic/public claims honest.
