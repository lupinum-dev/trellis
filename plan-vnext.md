# Trellis vNext Build Plan

Status: Draft execution plan
Owner: Trellis maintainers
Source of truth: `dream-spec.md`
Build workspace: `/Users/matthias/Git/workspace/trellis2`
Reference workspace: `/Users/matthias/Git/workspace/trellis`
Bridge consumer workspace: `/Users/matthias/Git/workspace/ginko-cms`
Intent: build Trellis vNext from zero in `trellis2`, using current Trellis only as reference material

## Purpose

This document is the working plan for building the vNext version of Trellis.

It is written for humans and LLM coding agents. A future agent should be able to
read this file, understand the goal, pick the next unchecked task, implement it,
run the required verification, and update this document with evidence.

The goal is not to refactor `/Users/matthias/Git/workspace/trellis` into a new
shape. The goal is to build the new architecture cleanly in
`/Users/matthias/Git/workspace/trellis2`, prove it through real examples, and
only then decide what to migrate, replace, or delete.

`/Users/matthias/Git/workspace/ginko-cms` is a consumer validation repo. It is
not the source of Trellis vNext architecture, but it is important for checking
bridge/package-author usage and real consumer friction once the core surfaces
exist.

## North Star

Trellis vNext should have one product-action model:

```text
Define product behavior once as a Trellis action.
Expose it intentionally.
Use generated handles in each runtime.
Debug it with doctor/explain.
```

The same action contract must power:

```text
Nuxt UI
server routes
tests
MCP tools
Trellis AI tools
```

Each runtime can have a different adapter, but no runtime may own separate
policy, tenant checks, destructive confirmation, ID resolution, or audit rules.

## Hard Rules

- [ ] Build vNext as a greenfield implementation.
- [ ] Build vNext in `/Users/matthias/Git/workspace/trellis2`.
- [ ] Use `/Users/matthias/Git/workspace/trellis` only as reference, test material, and API inventory.
- [ ] Use `/Users/matthias/Git/workspace/ginko-cms` only as consumer validation, not as a source of Trellis core rules.
- [ ] Do not import current Trellis runtime modules into vNext core.
- [ ] Do not import Ginko CMS internals into Trellis vNext core.
- [ ] Do not preserve compatibility with unreleased old internals.
- [ ] Do not keep old and new paths side by side inside vNext.
- [ ] Do not create a second policy system for UI, MCP, AI, server, or tests.
- [ ] Do not create Trellis-owned Convex Agent thread/message tables.
- [ ] Do not expose raw database tools as the normal agent write path.
- [ ] Do not add Studio, full eject, generic migrations, or full AI sandboxing before the core gates pass.
- [ ] Every generated artifact must be rebuildable and drift-checked.
- [ ] Every phase must end with `doctor` or `explain` proving what was built.

## What Counts As Done

vNext is considered foundationally complete when all of these are true:

- [ ] One strict feature file defines a workspace resource.
- [ ] Trellis generates a derived product graph.
- [ ] Trellis generates Convex schema and function projections.
- [ ] Trellis generates runtime-filtered handles for client, server, MCP, agent, and testing.
- [ ] Normal UI code imports client handles only.
- [ ] Normal tests import testing handles only.
- [ ] Server routes import server handles only.
- [ ] MCP tools import MCP handles only.
- [ ] Trellis AI definitions import agent handles only.
- [ ] Scoped DB prevents cross-workspace access by default.
- [ ] Role policy, record authorization, availability, and domain invariants have separate owners.
- [ ] Destructive actions require preview and confirmation.
- [ ] Destructive confirmation is stale-safe.
- [ ] ID resolution for MCP and AI does not guess ambiguous records.
- [ ] Generated invariant tests prove tenant and role boundaries.
- [ ] `trellis doctor` catches stale generated files and unsafe paths.
- [ ] `trellis explain action ...` is useful without reading source code.
- [ ] Example apps verify the architecture end to end.

## Non-Goals For This Plan

These are intentionally out of scope for foundational vNext:

- [ ] No Trellis Studio.
- [ ] No full feature eject implementation.
- [ ] No broad compatibility layer with current Trellis.
- [ ] No generic visual app builder.
- [ ] No generic workflow engine.
- [ ] No generic permission grants database.
- [ ] No generic migration framework.
- [ ] No provider abstraction for LLMs; use AI SDK.
- [ ] No Convex Agent replacement.
- [ ] No default sandbox runtime.
- [ ] No automatic MCP exposure.
- [ ] No automatic Trellis AI exposure.
- [ ] No raw Convex DB tools as the normal write path.

## Recommended Greenfield Shape

Fixed path:

- [ ] Create vNext in `/Users/matthias/Git/workspace/trellis2`.
- [ ] Keep `/Users/matthias/Git/workspace/trellis2` separate from `/Users/matthias/Git/workspace/trellis`.
- [ ] Add an import-boundary check that fails if `trellis2` imports from old `trellis/src/runtime`, old `trellis/src/cli`, old examples, old generated compatibility paths, or `ginko-cms` internals.
- [ ] Use old Trellis only through docs, tests copied intentionally, or reference notes.
- [ ] Use Ginko CMS only through consumer-level validation after Trellis vNext surfaces exist.
- [ ] Do not make Ginko-specific behavior part of Trellis vNext core.

Suggested initial package layout:

```text
/Users/matthias/Git/workspace/trellis2/
  package.json
  src/
    cli/
    compiler/
    codegen/
    runtime/
      convex/
      client/
      server/
      mcp/
      ai/
      testing/
    doctor/
    explain/
  fixtures/
    features/
    apps/
  examples/
    01-project-workspace/
    02-agency-clients/
    03-server-route/
    04-mcp-projects/
    05-ai-project-assistant/
  tests/
```

Promotion rule:

- [ ] Keep vNext isolated in `/Users/matthias/Git/workspace/trellis2` until Phase 4 passes.
- [ ] Only move it into production package paths after the core compiler, runtime action path, workspace starter, and diagnostics are proven.

## LLM Execution Protocol

When an LLM works from this file, it must follow this loop:

- [ ] Read `dream-spec.md`.
- [ ] Read this file.
- [ ] Pick the first unchecked task in the current phase unless the user directs otherwise.
- [ ] State the exact task being attempted.
- [ ] Implement the smallest change that satisfies that task.
- [ ] Run the listed verification for the task or explain why it cannot run.
- [ ] Update this file by checking completed boxes and adding evidence.
- [ ] Do not check a box without verification evidence.
- [ ] Do not advance to the next phase until the phase gate passes.
- [ ] Do not add compatibility paths unless the plan is explicitly changed.

Evidence format:

```text
Evidence:
- command: pnpm --dir /Users/matthias/Git/workspace/trellis2 test
- result: passed
- notes: proves strict feature fixture compiles and unsupported fixture fails
```

## Phase 0: Foundation Decisions

Goal: lock the architecture before code grows.

### 0.1 Greenfield Boundary

- [ ] Create `/Users/matthias/Git/workspace/trellis2`.
- [ ] Create an explicit `README.md` in `trellis2` explaining that `/Users/matthias/Git/workspace/trellis` is reference-only.
- [ ] Document `/Users/matthias/Git/workspace/ginko-cms` as bridge/consumer validation only.
- [ ] Add a boundary rule: vNext may not import old Trellis runtime code.
- [ ] Add a boundary rule: vNext may not import Ginko CMS internals.
- [ ] Add a boundary verification script.
- [ ] Verify the script fails on a deliberate forbidden import.
- [ ] Verify the script passes when the forbidden import is removed.

Acceptance:

- [ ] A new contributor can tell where vNext lives.
- [ ] The repo can automatically detect old Trellis runtime imports.
- [ ] The repo can automatically detect Ginko CMS internal imports.
- [ ] No old runtime path is required for vNext to compile.

### 0.2 Source Grammar Contract

- [ ] Define the supported `feature(...)` authoring grammar.
- [ ] Define the supported table grammar.
- [ ] Define the supported policy grammar.
- [ ] Define the supported action grammar.
- [ ] Define the supported exposure grammar.
- [ ] Define what helper functions are allowed.
- [ ] Define what dynamic TypeScript shapes are rejected.
- [ ] Write examples of valid and invalid feature files.

Minimum allowed feature shape:

```ts
export default feature('projects', {
  table: table.workspace({ ... }),
  dependsOn: ['tasks'],
  policy: policy.roles({ ... }),
  actions: {
    list: op.query({ ... }),
    create: op.mutation({ ... }),
    archive: op.destructive({ ... }),
  },
  expose: {
    client: ['list', 'create', 'archive'],
    testing: 'all',
  },
})
```

Rejected normal-path shapes:

- [ ] Dynamic feature names.
- [ ] Conditional action definitions.
- [ ] Environment-dependent exposure lists.
- [ ] Computed table names.
- [ ] Actions assembled through loops.
- [ ] Hidden re-exports of feature definitions.
- [ ] Helper wrappers that hide table, policy, or exposure declarations.
- [ ] Runtime imports inside feature metadata.

Acceptance:

- [ ] The compiler can print a clear error for every rejected fixture.
- [ ] The accepted grammar is documented before implementation goes broad.

### 0.3 Package And Import Shape

- [ ] Decide package names for vNext internals.
- [ ] Decide generated alias names.
- [ ] Decide which generated artifacts are importable modules.
- [ ] Decide which generated artifacts are JSON inspection files.
- [ ] Decide generated-file ownership headers.

Required generated aliases:

```text
#trellis/actions/client
#trellis/actions/server
#trellis/actions/mcp
#trellis/actions/agent
#trellis/actions/testing
#trellis/permissions
```

Acceptance:

- [ ] Runtime imports have stable resolution in dev, tests, CI, and examples.
- [ ] `.trellis/generated` is not used casually for importable TypeScript unless module resolution is proven.

### 0.4 Phase 0 Verification

- [ ] Run vNext boundary check.
- [ ] Run grammar fixture tests.
- [ ] Run formatting check.
- [ ] Run typecheck if code exists.
- [ ] Update this plan with command evidence.

Phase gate:

- [ ] Phase 0 passes only when a strict source grammar and import boundary are documented and tested.

## Phase 1: Compiler Spine

Goal: compile one feature file into a derived product graph.

### 1.1 Feature Reader

- [ ] Implement a feature file loader for static fixtures.
- [ ] Parse `feature('projects', ...)`.
- [ ] Parse table declarations.
- [ ] Parse role policy declarations.
- [ ] Parse action declarations.
- [ ] Parse exposure declarations.
- [ ] Parse `dependsOn`.
- [ ] Preserve source locations for diagnostics.
- [ ] Reject unsupported grammar with targeted errors.

Acceptance:

- [ ] `projects.feature.ts` compiles.
- [ ] Invalid dynamic fixtures fail with useful errors.
- [ ] Errors include file, line, concept, reason, and fix suggestion.

### 1.2 Product Graph

- [ ] Define the product graph schema.
- [ ] Include app metadata.
- [ ] Include features.
- [ ] Include resources.
- [ ] Include actions.
- [ ] Include policies.
- [ ] Include exposures.
- [ ] Include dependencies.
- [ ] Include unsafe escapes.
- [ ] Include generated file ownership metadata.
- [ ] Include agents and agent tools as optional empty sections.

Minimum graph shape:

```json
{
  "app": {
    "lane": "workspace",
    "auth": "better-auth",
    "workspaceModel": "memberships"
  },
  "features": {},
  "resources": {},
  "actions": {},
  "agents": {},
  "agentTools": {},
  "policies": {},
  "exposures": {},
  "unsafeEscapes": {},
  "generatedFiles": {}
}
```

Acceptance:

- [ ] Product graph is derived, deterministic, and not hand-edited.
- [ ] Product graph output is stable across repeated runs.
- [ ] Product graph includes enough data for codegen, doctor, explain, and generated tests.

### 1.3 `trellis prepare`

- [ ] Add a `trellis prepare` command for vNext.
- [ ] Read feature files.
- [ ] Build product graph.
- [ ] Write `.trellis/generated/graph.json`.
- [ ] Write generated file headers.
- [ ] Detect stale graph in check mode.
- [ ] Print a concise success summary.
- [ ] Print targeted failure output.

Acceptance:

- [ ] `trellis prepare` produces deterministic output.
- [ ] `trellis prepare --check` fails when the graph is stale.
- [ ] `trellis prepare --check` passes after regeneration.

### 1.4 `trellis explain`

- [ ] Add `trellis explain app`.
- [ ] Add `trellis explain feature projects`.
- [ ] Add `trellis explain action projects.archive`.
- [ ] Explain source file.
- [ ] Explain action kind.
- [ ] Explain reads and writes.
- [ ] Explain policy.
- [ ] Explain exposure.
- [ ] Explain destructive confirmation.
- [ ] Explain generated files.

Acceptance:

- [ ] `trellis explain action projects.archive` is useful without reading generated code.
- [ ] Explain output is stable enough for tests.

### 1.5 Phase 1 Verification

- [ ] Add unit tests for valid compiler fixtures.
- [ ] Add unit tests for invalid compiler fixtures.
- [ ] Add snapshot or structured tests for graph output.
- [ ] Add tests for `prepare --check`.
- [ ] Add tests for `explain`.
- [ ] Run vNext unit tests.
- [ ] Run vNext typecheck.
- [ ] Update this plan with command evidence.

Phase gate:

- [ ] Phase 1 passes only when one feature compiles into a deterministic graph and explain can describe it.

## Phase 2: Generated Backend Artifacts

Goal: generate Convex schema and action projections from the graph.

### 2.1 Convex Schema Generation

- [ ] Generate workspace resource table schema.
- [ ] Generate required workspace fields.
- [ ] Generate indexes.
- [ ] Generate uniqueness metadata.
- [ ] Generate created/updated timestamp fields.
- [ ] Mark generated schema files as generated.
- [ ] Add schema diff reporting during `prepare`.

Acceptance:

- [ ] A simple `projects` table is generated from the feature file.
- [ ] Schema generation is deterministic.
- [ ] Dangerous diffs require explicit acknowledgement.

Dangerous diffs:

- [ ] Deleting a field.
- [ ] Renaming a field.
- [ ] Making an optional field required.
- [ ] Changing a field type.
- [ ] Moving a field between resources.
- [ ] Changing workspace scope.
- [ ] Changing uniqueness.

### 2.2 Function Projection Generation

- [ ] Generate Convex query projection for `projects.list`.
- [ ] Generate Convex mutation projection for `projects.create`.
- [ ] Generate destructive preview projection for `projects.archive`.
- [ ] Generate destructive execute projection for `projects.archive`.
- [ ] Keep implementation closures out of runtime handle modules.
- [ ] Generate source maps or source metadata for diagnostics.

Acceptance:

- [ ] Generated Convex functions can be codegen'd by Convex.
- [ ] UI, tests, MCP, and AI do not import handler implementation files.

### 2.3 Runtime Handle Generation

- [ ] Generate `#trellis/actions/client`.
- [ ] Generate `#trellis/actions/server`.
- [ ] Generate `#trellis/actions/testing`.
- [ ] Generate empty or unavailable `#trellis/actions/mcp` until MCP is enabled.
- [ ] Generate empty or unavailable `#trellis/actions/agent` until AI is enabled.
- [ ] Filter handles by exposure.
- [ ] Include action metadata required by each runtime.
- [ ] Exclude backend closures and secrets from all handle modules.

Acceptance:

- [ ] Client handles contain only client-exposed actions.
- [ ] Server handles contain only server-exposed actions.
- [ ] Testing handles contain test-exposed actions.
- [ ] Non-exposed actions are absent, not present-but-failing.

### 2.4 Drift Checks

- [ ] Detect manual edits to generated files.
- [ ] Detect stale generated schema.
- [ ] Detect stale generated projection files.
- [ ] Detect stale runtime handles.
- [ ] Print the source file and command to regenerate.

Acceptance:

- [ ] Manual edit to generated file fails `trellis check`.
- [ ] Regeneration fixes the failure.

### 2.5 Phase 2 Verification

- [ ] Run Convex codegen for the generated backend.
- [ ] Run vNext unit tests.
- [ ] Run typecheck.
- [ ] Run generated-file drift checks.
- [ ] Update this plan with command evidence.

Phase gate:

- [ ] Phase 2 passes only when backend artifacts and runtime handles are generated, deterministic, and drift-checked.

## Phase 3: Runtime Action Path

Goal: make generated actions execute safely.

### 3.1 Action Runtime

- [ ] Implement `op.query`.
- [ ] Implement `op.mutation`.
- [ ] Implement `op.destructive`.
- [ ] Normalize args validation.
- [ ] Normalize return shape.
- [ ] Normalize structured errors.
- [ ] Add action fingerprinting for confirmation.
- [ ] Add action audit metadata.

Acceptance:

- [ ] Query actions can read through scoped DB.
- [ ] Mutation actions can write through scoped DB.
- [ ] Destructive actions cannot execute without preview.

### 3.2 Actor, Workspace, Membership Context

- [ ] Define `actor`.
- [ ] Define `workspace`.
- [ ] Define `membership`.
- [ ] Resolve authenticated user.
- [ ] Resolve current workspace.
- [ ] Resolve membership role.
- [ ] Fail closed when workspace or membership is missing.
- [ ] Support service caller placeholder for later server routes.
- [ ] Support agent principal placeholder for later AI.

Acceptance:

- [ ] Workspace action cannot run anonymously unless explicitly public.
- [ ] Workspace action cannot run without membership.
- [ ] Role is available to policy code.

### 3.3 Scoped DB

- [ ] Implement `db.projects.get`.
- [ ] Implement `db.projects.require`.
- [ ] Implement `db.projects.insert`.
- [ ] Implement `db.projects.patch`.
- [ ] Implement `db.projects.delete`.
- [ ] Implement `db.projects.query.byWorkspace`.
- [ ] Implement `db.projects.query.byIndex`.
- [ ] Automatically apply workspace scope.
- [ ] Make cross-workspace records look missing by default.
- [ ] Make raw `ctx.db` unavailable or flagged inside normal workspace actions.

Acceptance:

- [ ] Cross-workspace by-ID read fails.
- [ ] Cross-workspace write fails.
- [ ] Normal handler code does not need to remember `workspaceId`.

### 3.4 Policy, Authorization, Availability, Invariants

- [ ] Enforce coarse role policy.
- [ ] Add per-record `authorize`.
- [ ] Add availability blockers.
- [ ] Keep domain invariants in handler code.
- [ ] Generate `_can` as derived hint only.
- [ ] Ensure `_can` is not a security source.

Acceptance:

- [ ] Viewer can list but cannot create.
- [ ] Member can be denied by record authorization.
- [ ] Already archived project returns an availability blocker.
- [ ] Handler still enforces archived-state invariant.

### 3.5 Destructive Preview And Confirmation

- [ ] Implement preview.
- [ ] Implement confirmation receipt.
- [ ] Bind receipt to action id.
- [ ] Bind receipt to action fingerprint.
- [ ] Bind receipt to actor.
- [ ] Bind receipt to workspace.
- [ ] Bind receipt to args.
- [ ] Bind receipt to preview payload.
- [ ] Bind receipt to state fingerprint.
- [ ] Add receipt expiry.
- [ ] Reject reused receipt.
- [ ] Reject stale state.
- [ ] Reject wrong actor.
- [ ] Reject wrong workspace.
- [ ] Reject changed args.

Acceptance:

- [ ] Destructive execute without receipt fails.
- [ ] Reused receipt fails.
- [ ] Wrong workspace receipt fails.
- [ ] Stale preview fails.
- [ ] Valid preview/execute succeeds.

### 3.6 Phase 3 Verification

- [ ] Add unit tests for policy denial.
- [ ] Add unit tests for scoped DB tenant isolation.
- [ ] Add unit tests for destructive preview/execute.
- [ ] Add unit tests for stale confirmation.
- [ ] Add unit tests for structured errors.
- [ ] Run vNext unit tests.
- [ ] Run typecheck.
- [ ] Update this plan with command evidence.

Phase gate:

- [ ] Phase 3 passes only when one action path safely executes through scoped DB and destructive confirmation.

## Phase 4: Workspace Starter

Goal: prove the foundation in a working workspace app.

### 4.1 Membership-Native Workspace Model

- [ ] Create `users`.
- [ ] Create `workspaces`.
- [ ] Create `memberships`.
- [ ] Create `workspaceInvites` placeholder.
- [ ] Create `workspaceRelations` placeholder.
- [ ] Use one membership model for business, team, agency, and client workspaces.
- [ ] Do not add separate `businessMembers`, `teamMembers`, `agencyMembers`, or `clientMembers`.

Acceptance:

- [ ] One user can belong to multiple workspaces.
- [ ] One user can have different roles per workspace.
- [ ] A workspace has a kind but not a separate membership system.

### 4.2 Better Auth Integration

- [ ] Add Better Auth setup.
- [ ] Add signup flow.
- [ ] Add login flow.
- [ ] Create first workspace after signup.
- [ ] Create owner membership.
- [ ] Resolve auth into actor/workspace/membership context.

Acceptance:

- [ ] New user can sign up.
- [ ] New user can create first workspace.
- [ ] Owner membership exists.
- [ ] Generated actions run for owner.

### 4.3 Project Feature In Starter

- [ ] Include `projects.feature.ts`.
- [ ] Include list/create/archive actions.
- [ ] Include project list page.
- [ ] Include create project form.
- [ ] Include archive preview and confirm UI.
- [ ] Include permission-denied UI state.

Acceptance:

- [ ] Fresh starter can create a project.
- [ ] Fresh starter can archive a project.
- [ ] UI does not import backend handler files.

### 4.4 Single-Workspace First UX

- [ ] Hide workspace switching when user has one workspace.
- [ ] Show current workspace in developer/debug area.
- [ ] Keep model ready for multiple workspaces.
- [ ] Avoid teaching `users.workspaceId` as foundation.

Acceptance:

- [ ] First-run UX is simple.
- [ ] Data model is still membership-native.

### 4.5 Phase 4 Verification

- [ ] Run starter typecheck.
- [ ] Run starter unit tests.
- [ ] Run starter build.
- [ ] Run minimal browser test for signup/workspace/project.
- [ ] Run `trellis doctor`.
- [ ] Run `trellis explain action projects.archive`.
- [ ] Update this plan with command evidence.

Phase gate:

- [ ] Phase 4 passes only when a fresh workspace app runs, creates data, enforces tenant scope, and explains itself.

## Phase 5: Nuxt Client Runtime

Goal: make the browser path ergonomic and hard to misuse.

### 5.1 Client Handles

- [ ] Generate client handles for exposed client actions.
- [ ] Ensure client handles contain no backend closures.
- [ ] Ensure client handles contain no service secrets.
- [ ] Ensure client handles preserve enough metadata for UI labels and errors.

Acceptance:

- [ ] Client handle module can be imported from Nuxt UI.
- [ ] Backend implementation import from UI fails lint/doctor.

### 5.2 Composables

- [ ] Implement `useQuery`.
- [ ] Implement `usePaginatedQuery`.
- [ ] Implement `useMutation`.
- [ ] Implement `useDestructiveAction`.
- [ ] Preserve Convex live query behavior.
- [ ] Preserve pagination behavior.
- [ ] Preserve optimistic update path where supported.
- [ ] Preserve SSR/hydration safety.
- [ ] Normalize structured errors.

Acceptance:

- [ ] Project list updates after create.
- [ ] Archive flow previews before executing.
- [ ] Permission denial renders without crashing.

### 5.3 Generated UI Starter

- [ ] Generate or scaffold Project list UI.
- [ ] Generate or scaffold create form.
- [ ] Generate or scaffold archive confirmation UI.
- [ ] Keep scaffolded UI user-owned after creation.
- [ ] Do not regenerate user-edited UI without explicit command.

Acceptance:

- [ ] UI can be edited by app developer.
- [ ] Regeneration does not overwrite user-owned edits silently.

### 5.4 Phase 5 Verification

- [ ] Run Nuxt typecheck.
- [ ] Run client runtime unit tests.
- [ ] Run browser/component tests.
- [ ] Run doctor check for UI import boundaries.
- [ ] Update this plan with command evidence.

Phase gate:

- [ ] Phase 5 passes only when UI uses generated handles and the destructive flow works end to end.

## Phase 6: Tests, Doctor, Explain

Goal: make the system debuggable before adding more surfaces.

### 6.1 Generated Invariant Tests

- [ ] Generate tenant isolation tests.
- [ ] Generate role denial tests.
- [ ] Generate destructive confirmation tests.
- [ ] Generate confirmation reuse denial tests.
- [ ] Generate wrong workspace confirmation denial tests.
- [ ] Generate stale confirmation tests.
- [ ] Keep generated tests separate from scaffolded product tests.

Acceptance:

- [ ] Generated tests prove framework invariants.
- [ ] Product tests remain app-owned.
- [ ] Generated tests do not pretend to understand arbitrary domain logic.

### 6.2 Scaffolded Product Tests

- [ ] Scaffold project happy-path test.
- [ ] Scaffold project permission-denial test.
- [ ] Mark scaffolded tests as user-owned after creation.
- [ ] Document how app authors add fixtures.

Acceptance:

- [ ] App author can edit product tests.
- [ ] Trellis does not overwrite product tests silently.

### 6.3 Doctor

- [ ] Detect stale graph.
- [ ] Detect stale schema.
- [ ] Detect stale handles.
- [ ] Detect generated file edits.
- [ ] Detect UI importing backend implementation.
- [ ] Detect server importing client handles.
- [ ] Detect missing destructive preview.
- [ ] Detect missing resolver for MCP/AI exposure.
- [ ] Detect raw DB usage inside workspace action without unsafe escape.
- [ ] Detect unsafe escape and print reason.

Acceptance:

- [ ] Doctor output includes category, source, reason, and fix.
- [ ] Doctor distinguishes compile, drift, safety, exposure, policy, runtime denial, stale confirmation, and unsafe escape.

### 6.4 Explain

- [ ] Explain app.
- [ ] Explain feature.
- [ ] Explain action.
- [ ] Explain file.
- [ ] Explain generated handle.
- [ ] Explain why action is exposed to a runtime.
- [ ] Explain why action is not exposed to a runtime.
- [ ] Explain policy and confirmation requirements.

Acceptance:

- [ ] A developer can debug missing runtime access with explain.
- [ ] A coding agent can identify user-owned vs generated files.

### 6.5 Phase 6 Verification

- [ ] Run all generated invariant tests.
- [ ] Run scaffolded product tests.
- [ ] Run doctor tests.
- [ ] Run explain tests.
- [ ] Run typecheck.
- [ ] Update this plan with command evidence.

Phase gate:

- [ ] Phase 6 passes only when doctor/explain make the generated architecture inspectable.

## Phase 7: Server Route Adapter

Goal: prove server routes can call product actions without hiding HTTP.

### 7.1 Server Handles

- [ ] Generate server handles for server-exposed actions.
- [ ] Exclude client-only actions unless explicitly server-exposed.
- [ ] Exclude MCP-only and agent-only handles.
- [ ] Include metadata needed for service caller identity.

Acceptance:

- [ ] Server route imports `#trellis/actions/server`.
- [ ] Server route cannot import client handles without doctor failure.

### 7.2 Route-Owned HTTP Verification

- [ ] Implement `serverAction(event, actionHandle)`.
- [ ] Implement service caller helper.
- [ ] Keep body parsing in route.
- [ ] Keep headers/status codes in route.
- [ ] Keep HMAC verification in route.
- [ ] Keep idempotency key extraction in route.
- [ ] Run Trellis action after route verifies caller.

Acceptance:

- [ ] Stripe-like webhook route verifies signature before action execution.
- [ ] Export route owns HTTP response formatting.
- [ ] Trellis does not pretend HTTP semantics disappear.

### 7.3 Server Example

- [ ] Add example `projects/export.get.ts`.
- [ ] Add example `webhooks/stripe.post.ts` or fake provider webhook.
- [ ] Add tests for verified and rejected webhook.
- [ ] Add doctor check for route importing backend implementation.

Acceptance:

- [ ] Server route can execute an exposed action.
- [ ] Invalid webhook cannot execute action.

### 7.4 Phase 7 Verification

- [ ] Run server adapter unit tests.
- [ ] Run server example tests.
- [ ] Run doctor import-boundary tests.
- [ ] Run typecheck.
- [ ] Update this plan with command evidence.

Phase gate:

- [ ] Phase 7 passes only when server routes call Trellis actions after route-owned verification.

## Phase 8: Optional MCP Lane

Goal: expose selected product actions to external AI clients without creating a second action model.

### 8.1 MCP Installation

- [ ] Add `trellis add mcp`.
- [ ] Configure MCP server surface.
- [ ] Generate `#trellis/actions/mcp`.
- [ ] Keep MCP disabled by default.
- [ ] Require explicit exposure per action.

Acceptance:

- [ ] No action is MCP-exposed by default.
- [ ] `trellis expose projects.list --mcp` adds exposure.
- [ ] MCP handles include only MCP-exposed actions.

### 8.2 MCP Tool Generation

- [ ] Generate MCP tools from MCP handles.
- [ ] Include tool descriptions.
- [ ] Include input schemas.
- [ ] Include resolver hints.
- [ ] Include destructive confirmation requirements.
- [ ] Exclude backend closures and secrets.

Acceptance:

- [ ] MCP client can list tools.
- [ ] MCP client cannot see unexposed actions.
- [ ] MCP tool calls run through Trellis action path.

### 8.3 ID Resolution And Disambiguation

- [ ] Support `resolveByUnique`.
- [ ] Support `searchBy`.
- [ ] Reject record references without resolver.
- [ ] Return disambiguation response for non-unique matches.
- [ ] Never guess among multiple matches.
- [ ] Scope resolution to current workspace.
- [ ] Allow explicit unsafe waiver with reason.

Acceptance:

- [ ] MCP can resolve project by unique slug.
- [ ] MCP search by name disambiguates duplicates.
- [ ] MCP cannot resolve cross-workspace record.
- [ ] Missing resolver fails doctor.

### 8.4 Destructive MCP

- [ ] Add preview tool flow.
- [ ] Add execute tool flow.
- [ ] Require confirmation receipt.
- [ ] Bind receipt to MCP principal.
- [ ] Bind receipt to workspace.
- [ ] Bind receipt to args and state fingerprint.
- [ ] Reject stale confirmation.

Acceptance:

- [ ] Destructive MCP execute without preview fails.
- [ ] Destructive MCP execute with stale preview fails.
- [ ] Valid preview/execute succeeds.

### 8.5 MCP Capabilities Resource

- [ ] Generate caller-scoped capabilities resource.
- [ ] Filter by MCP key.
- [ ] Filter by principal.
- [ ] Filter by current workspace.
- [ ] Filter by role and relation policy.
- [ ] Do not reveal unauthorized features or actions.

Acceptance:

- [ ] Viewer sees only actions they may know about.
- [ ] Unauthorized features are not leaked.

### 8.6 Phase 8 Verification

- [ ] Run MCP unit tests.
- [ ] Run MCP integration test with project resource.
- [ ] Run destructive MCP tests.
- [ ] Run resolver tests.
- [ ] Run doctor MCP checks.
- [ ] Update this plan with command evidence.

Phase gate:

- [ ] Phase 8 passes only when MCP is opt-in, scoped, resolver-safe, and destructive-safe.

## Phase 9: Optional Trellis AI Lane

Goal: support in-app assistants through Convex Agent while Trellis owns action safety.

### 9.1 Convex Agent Integration

- [ ] Add `trellis add ai`.
- [ ] Install and configure `@convex-dev/agent`.
- [ ] Configure through `convex/convex.config.ts`.
- [ ] Do not create Trellis-owned thread tables.
- [ ] Do not create Trellis-owned message tables.
- [ ] Document which Convex Agent primitives Trellis relies on.

Acceptance:

- [ ] Convex Agent owns threads, messages, streaming, tool calls, approvals, files, and usage hooks.
- [ ] Trellis owns action-backed tools and app safety.

### 9.2 Agent Handles

- [ ] Generate `#trellis/actions/agent`.
- [ ] Include only agent-exposed actions.
- [ ] Include descriptions.
- [ ] Include input schemas.
- [ ] Include ID resolution hints.
- [ ] Include result redaction hints.
- [ ] Include approval defaults.
- [ ] Include safety category.
- [ ] Exclude backend closures and secrets.

Acceptance:

- [ ] Agent definition can import `#trellis/actions/agent`.
- [ ] Agent cannot import unexposed action handle.

### 9.3 `defineTrellisAgent`

- [ ] Implement wrapper around Convex Agent.
- [ ] Accept agent id.
- [ ] Accept name.
- [ ] Accept scope.
- [ ] Accept AI SDK language model.
- [ ] Accept instructions.
- [ ] Accept tool list.
- [ ] Preserve access to underlying Convex Agent for advanced users.

Acceptance:

- [ ] App can define `project.assistant`.
- [ ] Wrapper does not hide Convex Agent primitives.

### 9.4 `actionTool`

- [ ] Convert action handle into Convex Agent / AI SDK tool.
- [ ] Derive tool name.
- [ ] Derive description.
- [ ] Derive input schema.
- [ ] Apply ID resolution.
- [ ] Apply approval policy.
- [ ] Apply result redaction.
- [ ] Enforce max result size.
- [ ] Call Trellis action path.
- [ ] Audit tool call.

Acceptance:

- [ ] Read tool can run automatically if permitted.
- [ ] Bounded write can run only when explicitly allowed.
- [ ] Destructive tool requires preview and confirmation.
- [ ] Unsafe custom tool fails doctor unless waived.

### 9.5 Agent Principal And Acting-For

- [ ] Define agent principal.
- [ ] Bind agent run to workspace.
- [ ] Add allowed action list.
- [ ] Add trigger metadata.
- [ ] Add optional acting-for user grant.
- [ ] Add expiry for acting-for grant.
- [ ] Add audit metadata.
- [ ] Fail closed when workspace or grant is missing.

Acceptance:

- [ ] Scheduled agent run has explicit principal.
- [ ] User-started agent run can act for the user within scope.
- [ ] Agent cannot write outside workspace.

### 9.6 Nuxt AI UI

- [ ] Add `useTrellisAgentThread`.
- [ ] Add `useTrellisAgentMessages`.
- [ ] Add `useTrellisAgentApprovals`.
- [ ] Add minimal `<TrellisAgentChat />`.
- [ ] Render Convex Agent UIMessage model.
- [ ] Do not invent a second message format.
- [ ] Render approval cards for tool calls.

Acceptance:

- [ ] User can send message to project assistant.
- [ ] UI streams or subscribes to assistant response.
- [ ] Approval UI can approve a pending tool.

### 9.7 Scheduled And Workflow Agents

- [ ] Use Convex Scheduler/Cron for recurring triggers.
- [ ] Use Convex Workflow for durable multi-step jobs.
- [ ] Use Workpool where concurrency/backpressure matters.
- [ ] Add idempotency keys for scheduled runs.
- [ ] Avoid long-running Nitro requests as source of truth.

Acceptance:

- [ ] Scheduled assistant job has idempotency key.
- [ ] Workflow-triggered assistant has trigger metadata.
- [ ] Nitro can start a job but does not own durable loop.

### 9.8 AI Doctor And Explain

- [ ] Add `trellis doctor --ai`.
- [ ] Detect raw Convex or AI SDK tools without unsafe reason.
- [ ] Detect missing workspace principal resolution.
- [ ] Detect missing approval policy for write tools.
- [ ] Detect destructive tools without preview/confirmation.
- [ ] Detect missing ID resolution.
- [ ] Detect missing result redaction hints.
- [ ] Detect missing usage or rate limit integration.
- [ ] Detect long-running agent work started only from Nitro.
- [ ] Add `trellis explain agent project.assistant`.
- [ ] Add `trellis explain tool project.assistant.projects.archive`.

Acceptance:

- [ ] Explain lists agent actions.
- [ ] Explain lists approval requirements.
- [ ] Explain lists workspace scope.
- [ ] Doctor fails unsafe tools.

### 9.9 Phase 9 Verification

- [ ] Run AI unit tests.
- [ ] Run project assistant integration test.
- [ ] Run destructive AI tool approval test.
- [ ] Run workspace isolation test for AI tool.
- [ ] Run doctor AI checks.
- [ ] Run explain agent tests.
- [ ] Update this plan with command evidence.

Phase gate:

- [ ] Phase 9 passes only when Trellis AI uses Convex Agent runtime and Trellis action safety.

## Phase 10: Example E2E Applications

Goal: verify real use cases, not only isolated units.

Each example is an acceptance test. If an example fails, the architecture is not done.

### 10.1 Example: Project Workspace

Purpose:

```text
Proves the core compiler, workspace scope, UI handles, destructive action, tests,
doctor, and explain.
```

Tasks:

- [ ] Create `examples/01-project-workspace`.
- [ ] Add signup/login.
- [ ] Add workspace creation.
- [ ] Add projects feature.
- [ ] Add create project UI.
- [ ] Add archive preview/confirm UI.
- [ ] Add generated invariant tests.
- [ ] Add product tests.
- [ ] Add doctor check.
- [ ] Add explain snapshot or structured test.

Verification:

- [ ] Fresh app runs.
- [ ] User can create workspace.
- [ ] User can create project.
- [ ] User can archive project.
- [ ] Viewer cannot create project.
- [ ] Cross-workspace access fails.
- [ ] `trellis doctor` passes.
- [ ] `trellis explain action projects.archive` is useful.

### 10.2 Example: Agency With Client Workspaces

Purpose:

```text
Proves one workspace/membership/relation model supports agency/client topology.
```

Tasks:

- [ ] Create `examples/02-agency-clients`.
- [ ] Add agency workspace.
- [ ] Add client workspace.
- [ ] Add `workspaceRelations`.
- [ ] Add relation-aware read policy.
- [ ] Add direct client membership.
- [ ] Add relation-based agency access.
- [ ] Add tests for revoked agency relation.

Verification:

- [ ] Agency admin can read managed client data when relation is active.
- [ ] Agency admin cannot read client data when relation is suspended.
- [ ] Client owner can access own client workspace.
- [ ] Unrelated workspace cannot access client data.
- [ ] No separate agency/client membership tables exist.

### 10.3 Example: Server Route

Purpose:

```text
Proves server routes own HTTP verification and then call Trellis actions.
```

Tasks:

- [ ] Create `examples/03-server-route`.
- [ ] Add export route.
- [ ] Add fake webhook route.
- [ ] Add HMAC verification.
- [ ] Add service caller.
- [ ] Add idempotency check.
- [ ] Add tests for valid and invalid webhook.

Verification:

- [ ] Valid webhook calls Trellis action.
- [ ] Invalid webhook does not call Trellis action.
- [ ] Route owns HTTP response.
- [ ] Doctor catches backend handler import from route.

### 10.4 Example: MCP Projects

Purpose:

```text
Proves external AI clients can use opt-in Trellis actions safely.
```

Tasks:

- [ ] Create `examples/04-mcp-projects`.
- [ ] Add MCP lane.
- [ ] Expose list/create/archive to MCP.
- [ ] Add resolver by slug.
- [ ] Add search/disambiguation by name.
- [ ] Add destructive preview/execute.
- [ ] Add capabilities resource.
- [ ] Add tests for unauthorized capability hiding.

Verification:

- [ ] MCP lists only exposed tools.
- [ ] MCP cannot see unexposed action.
- [ ] MCP resolves unique slug.
- [ ] MCP disambiguates duplicate names.
- [ ] MCP cannot resolve cross-workspace record.
- [ ] Destructive MCP requires confirmation.

### 10.5 Example: Trellis AI Project Assistant

Purpose:

```text
Proves in-app AI assistants use Convex Agent runtime and Trellis action safety.
```

Tasks:

- [ ] Create `examples/05-ai-project-assistant`.
- [ ] Add Convex Agent component.
- [ ] Add `project.assistant`.
- [ ] Add `actionTool(actions.projects.list)`.
- [ ] Add `actionTool(actions.projects.create)`.
- [ ] Add `actionTool(actions.projects.archive)`.
- [ ] Add Nuxt chat UI.
- [ ] Add approval UI.
- [ ] Add usage attribution placeholder.
- [ ] Add rate-limit placeholder.

Verification:

- [ ] User can send assistant message.
- [ ] Assistant can list projects.
- [ ] Assistant can create project only through Trellis action.
- [ ] Assistant cannot call unexposed action.
- [ ] Assistant archive requires preview/approval.
- [ ] Assistant cannot write outside workspace.
- [ ] Convex Agent owns messages and streaming state.

### 10.6 Example Gate

- [ ] Run all example tests.
- [ ] Run all example typechecks.
- [ ] Run all example builds.
- [ ] Run all example doctor checks.
- [ ] Run e2e tests for core user flows.
- [ ] Update this plan with command evidence.

Phase gate:

- [ ] Phase 10 passes only when all examples verify the architecture end to end.

## Phase 11: Bridge Consumer Validation

Goal: validate package-author and bridge usage in a real consumer without making
consumer-specific behavior part of Trellis core.

Consumer workspace:

```text
/Users/matthias/Git/workspace/ginko-cms
```

Rules:

- [ ] Ginko CMS is a consumer validation repo, not a Trellis core dependency.
- [ ] Do not import Ginko CMS internals into `/Users/matthias/Git/workspace/trellis2`.
- [ ] Do not add Ginko-specific code paths to Trellis vNext.
- [ ] If Ginko exposes a real generic need, write it as a Trellis acceptance criterion before implementing.
- [ ] Any bridge API used by Ginko must be documented as public or explicitly marked experimental.

### 11.1 Consumer Setup

- [ ] Decide how `ginko-cms` consumes local `trellis2` during validation.
- [ ] Prefer workspace/link/pack flow over copying files.
- [ ] Document the local linking command.
- [ ] Document how to undo the local link.
- [ ] Ensure Ginko can still use the old Trellis reference independently if needed.

Acceptance:

- [ ] Ginko can point at local Trellis vNext without vendoring code.
- [ ] Ginko changes remain consumer changes, not hidden Trellis implementation.

### 11.2 Bridge Usage Inventory

- [ ] Inspect current Ginko bridge usage.
- [ ] List package subpaths Ginko consumes.
- [ ] List bridge primitives Ginko needs.
- [ ] List generated handles Ginko would expect.
- [ ] List any old Trellis compatibility assumptions.
- [ ] Classify each need as generic Trellis, Ginko-specific, or obsolete.

Acceptance:

- [ ] Every requested bridge primitive has a category.
- [ ] Ginko-specific needs are not added to Trellis core.

### 11.3 Consumer Validation Scenario

- [ ] Define one Ginko page/content feature as validation target.
- [ ] Define expected Trellis feature/action shape.
- [ ] Define expected generated handles.
- [ ] Define expected bridge/package-author surface.
- [ ] Define expected tests.
- [ ] Define expected doctor/explain output.

Acceptance:

- [ ] The scenario tests a real consumer use case.
- [ ] The scenario does not require private Ginko knowledge inside Trellis.

### 11.4 Consumer Verification

- [ ] Run Ginko typecheck against local Trellis vNext.
- [ ] Run Ginko unit tests relevant to bridge usage.
- [ ] Run Ginko build if feasible.
- [ ] Run any Ginko doctor/check command if available.
- [ ] Record all commands and results in this plan.

Acceptance:

- [ ] Ginko can consume the public/experimental Trellis vNext surface.
- [ ] Any failure is classified as Trellis bug, Ginko migration work, or unsupported old assumption.

### 11.5 Phase 11 Verification

- [ ] Consumer setup documented.
- [ ] Bridge inventory completed.
- [ ] Consumer scenario completed.
- [ ] Ginko verification commands recorded.
- [ ] No Ginko-specific code added to Trellis vNext core.
- [ ] Update this plan with command evidence.

Phase gate:

- [ ] Phase 11 passes only when Ginko validates bridge/package-author usage without becoming a Trellis core dependency.

## Phase 12: Packaging And Release Readiness

Goal: make the foundational vNext usable without exposing unstable internals.

### 12.1 Public Surface

- [ ] Define public package exports.
- [ ] Define internal package boundaries.
- [ ] Add tests for package subpath exports.
- [ ] Add docs for public APIs.
- [ ] Hide internal generated helpers from beginner docs.

Candidate exports:

```text
@lupinum/trellis/convex
@lupinum/trellis/server
@lupinum/trellis/testing
@lupinum/trellis/mcp
@lupinum/trellis/ai
@lupinum/trellis/cli
```

Acceptance:

- [ ] Public exports are intentional.
- [ ] Internal paths are not documented as user APIs.
- [ ] Package export tests pass.

### 12.2 CLI

- [ ] `trellis prepare`.
- [ ] `trellis check`.
- [ ] `trellis doctor`.
- [ ] `trellis doctor --agent`.
- [ ] `trellis doctor --ai`.
- [ ] `trellis explain app`.
- [ ] `trellis explain feature`.
- [ ] `trellis explain action`.
- [ ] `trellis explain agent`.
- [ ] `trellis add resource`.
- [ ] `trellis add mcp`.
- [ ] `trellis add ai`.

Acceptance:

- [ ] CLI help is useful.
- [ ] CLI errors include fixes.
- [ ] CLI works from examples.

### 12.3 Documentation

- [ ] Write quickstart.
- [ ] Write feature authoring guide.
- [ ] Write workspace model guide.
- [ ] Write destructive action guide.
- [ ] Write server route guide.
- [ ] Write MCP guide.
- [ ] Write Trellis AI guide.
- [ ] Write testing guide.
- [ ] Write doctor/explain guide.
- [ ] Write unsafe escape guide.

Acceptance:

- [ ] A junior/mid developer can follow the Project Workspace guide.
- [ ] Docs explain where Trellis follows Convex.
- [ ] Docs explain where Trellis draws its border.

### 12.4 Performance Targets

- [ ] `trellis prepare` after one feature edit under 2 seconds for small app.
- [ ] `trellis doctor` from existing graph under 1 second for small app.
- [ ] `trellis explain action ...` under 1 second for small app.
- [ ] `trellis check` acceptable as CI-grade gate.
- [ ] Avoid generating files on every request.
- [ ] Cache safely where rebuild story is clear.

Acceptance:

- [ ] Performance targets measured and recorded.
- [ ] Slow path has explanation and follow-up issue.

### 12.5 Release Gate

- [ ] Run formatting.
- [ ] Run lint.
- [ ] Run typecheck.
- [ ] Run unit tests.
- [ ] Run generated invariant tests.
- [ ] Run example tests.
- [ ] Run example typechecks.
- [ ] Run example builds.
- [ ] Run e2e tests.
- [ ] Run package export tests.
- [ ] Run drift checks.
- [ ] Run docs link checks if docs exist.

Phase gate:

- [ ] Phase 12 passes only when vNext can be consumed intentionally and verified from examples plus the bridge consumer.

## Cross-Phase Invariants

These must stay true during every phase:

- [ ] One source of truth for table fields.
- [ ] One source of truth for workspace scope.
- [ ] One source of truth for roles.
- [ ] One source of truth for coarse action policy.
- [ ] One source of truth for record authorization.
- [ ] One source of truth for destructive preview.
- [ ] One source of truth for MCP exposure.
- [ ] One source of truth for agent exposure.
- [ ] Generated files are rebuildable.
- [ ] Generated files are drift-checked.
- [ ] UI does not own backend invariants.
- [ ] Server routes own HTTP verification.
- [ ] MCP does not bypass backend policy.
- [ ] Trellis AI does not bypass backend policy.
- [ ] Tests use product language where possible.
- [ ] Unsafe escapes are explicit, reasoned, and visible.

## Verification Command Matrix

The exact commands may change once vNext is scaffolded. Until then, keep this
matrix updated with real commands.

### Local vNext Commands

- [ ] `pnpm --dir /Users/matthias/Git/workspace/trellis2 format:check`
- [ ] `pnpm --dir /Users/matthias/Git/workspace/trellis2 lint`
- [ ] `pnpm --dir /Users/matthias/Git/workspace/trellis2 typecheck`
- [ ] `pnpm --dir /Users/matthias/Git/workspace/trellis2 test`
- [ ] `pnpm --dir /Users/matthias/Git/workspace/trellis2 test:e2e`
- [ ] `pnpm --dir /Users/matthias/Git/workspace/trellis2 trellis prepare --check`
- [ ] `pnpm --dir /Users/matthias/Git/workspace/trellis2 trellis doctor`

### Current Repo Reference Commands

These commands belong to current Trellis and are useful as reference gates, not
as vNext compatibility promises:

- [ ] `pnpm --dir /Users/matthias/Git/workspace/trellis run check`
- [ ] `pnpm --dir /Users/matthias/Git/workspace/trellis run release:verify`

### Bridge Consumer Commands

These commands belong to Ginko CMS and are useful for consumer validation after
the relevant public or experimental Trellis vNext surface exists:

- [ ] `pnpm --dir /Users/matthias/Git/workspace/ginko-cms typecheck`
- [ ] `pnpm --dir /Users/matthias/Git/workspace/ginko-cms test`
- [ ] `pnpm --dir /Users/matthias/Git/workspace/ginko-cms build`

## Risk Register

### Risk: The One-Way Model Splits Again

Description:

```text
UI, server, MCP, AI, and tests accidentally grow separate wrappers with separate
policy or confirmation behavior.
```

Mitigation:

- [ ] Runtime handles must be generated from the same action graph.
- [ ] Policy must live in feature/action definitions only.
- [ ] Doctor must detect backend implementation imports from runtime surfaces.
- [ ] Tests must prove the same action contract across runtimes.

### Risk: Compiler Grammar Too Strict Or Too Loose

Mitigation:

- [ ] Start with one serious Project feature.
- [ ] Add Agency/Client example before broadening grammar.
- [ ] Reject unsupported shapes loudly.
- [ ] Add escape hatches only after a real example proves need.

### Risk: Generated Dev Loop Is Slow Or Confusing

Mitigation:

- [ ] Keep `prepare` fast.
- [ ] Make stale output errors precise.
- [ ] Make `explain file` and `explain action` useful early.
- [ ] Avoid generating more files than necessary.

### Risk: Workspace Relations Become A Permission Product

Mitigation:

- [ ] Keep one membership table.
- [ ] Keep one relation table.
- [ ] Add only the relation checks proven by Agency/Client example.
- [ ] Do not add generic grants/deny tables before a real need.

### Risk: Trellis AI Becomes A Second Agent Framework

Mitigation:

- [ ] Use Convex Agent for threads/messages/streaming/tool approval/files/usage.
- [ ] Use AI SDK for provider abstraction.
- [ ] Use Convex Workflow/Workpool/Rate Limiter/RAG components.
- [ ] Keep Trellis AI focused on action tools, policy, approval, redaction, audit, and Nuxt DX.

### Risk: Generated Tests Create False Confidence

Mitigation:

- [ ] Generated tests prove framework invariants only.
- [ ] Scaffolded product tests become user-owned.
- [ ] Complex domain tests require app fixtures.
- [ ] Doctor reports missing coverage instead of faking assertions.

## Decision Log

Record major changes here.

- [ ] Decision: vNext will be built in `/Users/matthias/Git/workspace/trellis2`, not as a refactor of current Trellis.
  Evidence: user direction and `dream-spec.md`.
- [ ] Decision: `/Users/matthias/Git/workspace/trellis` is reference-only.
  Evidence: import-boundary check to be added in Phase 0.
- [ ] Decision: `/Users/matthias/Git/workspace/ginko-cms` is bridge/consumer validation only.
  Evidence: import-boundary check and Phase 11 consumer validation.
- [ ] Decision: Trellis actions are the single product behavior model.
  Evidence: all runtime handles generated from graph.
- [ ] Decision: Trellis AI follows Convex Agent instead of replacing it.
  Evidence: Phase 9 requires Convex Agent owns threads/messages/streaming.

## Progress Log

Use this section for short dated entries.

Template:

```text
YYYY-MM-DD
- Completed:
- Verification:
- Notes:
- Next:
```

- [ ] Add first progress entry when Phase 0 starts.

## Final Launch Checklist

vNext foundational release can be called complete when:

- [ ] Phase 0 gate passed.
- [ ] Phase 1 gate passed.
- [ ] Phase 2 gate passed.
- [ ] Phase 3 gate passed.
- [ ] Phase 4 gate passed.
- [ ] Phase 5 gate passed.
- [ ] Phase 6 gate passed.
- [ ] Phase 7 gate passed.
- [ ] Phase 8 gate passed.
- [ ] Phase 9 gate passed.
- [ ] Phase 10 gate passed.
- [ ] Phase 11 gate passed.
- [ ] Phase 12 gate passed.
- [ ] All examples pass.
- [ ] Ginko CMS consumer validation passes or documented unsupported assumptions are accepted.
- [ ] All docs for included surfaces exist.
- [ ] Old Trellis reference usage is documented.
- [ ] Ginko CMS validation usage is documented.
- [ ] No old Trellis runtime imports exist in vNext.
- [ ] No Ginko CMS internal imports exist in vNext.
- [ ] No generated file drift exists.
- [ ] No unchecked unsafe escape exists.
- [ ] `doctor` can explain app safety.
- [ ] `explain` can explain app/action/agent/file.
