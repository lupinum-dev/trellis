# Trellis Deep Library Review State

Status: Active; review coverage complete, remediation and fix-verification pending
Started: 2026-06-04
Owner: Matthias
Goal: Review the whole Trellis library section by section, record findings in
markdown, and verify fixes/regression coverage before calling the review done.

## Operating Rules

- Work from current code, not memory.
- Review one section at a time.
- Record findings before moving to the next section.
- Prefer direct backend/runtime evidence over frontend behavior.
- Use subagents for different points of view when a section has multiple attack
  surfaces.
- A section is not complete until findings, evidence, and verification gaps are
  written down.

## Section Map

| ID  | Section                                    | Scope                                                                                                | Status                                                                   | Review Notes                                                                                                                                                                                                                                                          |
| --- | ------------------------------------------ | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S1  | Auth session and proxy                     | Better Auth bridge, auth proxy, SSR cache, route protection, logout/session lifecycle                | Initial review done; P2 auth lifecycle second pass done                  | Findings F-AUTH-03, F-AUTH-07, and F-AUTH-53 through F-AUTH-56 recorded; probe and subagent confirmed stale-session windows                                                                                                                                           |
| S2  | Permissions and protected handler pipeline | guards, permissions, access projection, `guard -> load -> authorize -> handler`, direct Convex calls | Initial detailed review done; P0 permission second pass done             | Findings F-AUTH-10 through F-AUTH-14 recorded; second-pass probes reproduced fail-open guard, lane, sentinel, projection, and MCP metadata drift                                                                                                                      |
| S3  | Tenant isolation and escape hatches        | `workspaceScope`, RLS wrappers, service scopes, `escapeIsolation`, static lint/doctor coverage       | Initial detailed review done; P0 raw DB second pass done                 | Findings F-AUTH-05, F-AUTH-08, F-AUTH-09, F-AUTH-15 recorded; raw DB/service blast radius expanded                                                                                                                                                                    |
| S4  | Trusted identity forwarding                | signed envelopes, replay, `auth: 'trusted'`, `actingFor`, server/MCP/bridge forwarding               | Initial detailed review done; P1 forwarding second pass done             | Findings F-AUTH-04, F-AUTH-16, F-AUTH-17, and F-AUTH-52 recorded; second-pass probe reproduced ordinary trusted write replay and purpose mismatch                                                                                                                     |
| S5  | MCP runtime and tools                      | bearer auth, tool visibility vs backend denial, operation projection, rate limits, result leaks      | Initial detailed review done; P1 MCP boundary second pass done           | Findings F-AUTH-06, F-AUTH-14, and F-AUTH-18 through F-AUTH-23 recorded; second-pass probes reproduced missing direct-write permissions, tool-local safety stamping, advanced write-helper blind spot, and raw MCP error exposure                                     |
| S6  | Destructive operation safety               | preview-confirm-execute, token binding, replay, audit, transport/backend modes                       | Initial detailed review done; P0 replay second pass done                 | Findings F-AUTH-24 through F-AUTH-27 recorded; captured backend replay probe reproduced duplicate execution and missing backend audit/redeem state                                                                                                                    |
| S7  | Server routes and webhooks                 | H3 routes, webhook helpers, trusted route boundaries, body/signature/idempotency                     | Initial detailed review done; P1 webhook second pass done                | Findings F-AUTH-02, F-AUTH-17, F-AUTH-28 through F-AUTH-31, and F-AUTH-49 reinforced; helper probes reproduced blank-secret acceptance and HMAC parse/idempotency poisoning                                                                                           |
| S8  | Examples, starters, and docs               | generated fixtures, examples, docs, copied production patterns                                       | Initial detailed review done; P1 examples/starters second pass done      | Findings F-AUTH-01, F-AUTH-02, F-AUTH-06, F-AUTH-15, F-AUTH-17, F-AUTH-20, F-AUTH-23, F-AUTH-26 through F-AUTH-28, F-AUTH-30, and F-AUTH-32 through F-AUTH-36 reinforced; probes reproduced public email id leak, draft share-token read, and re-onboarding overwrite |
| S9  | Static guardrails                          | ESLint plugin, doctor, inventory, codegen/preflight checks                                           | Initial detailed review done; P2 static guardrail second pass done       | Findings F-AUTH-37 through F-AUTH-40 reinforced; probes reproduced missing protected/open lint, action auth lint gap, duplicate permission-key codegen acceptance, and advanced MCP server-write helper blind spot                                                    |
| S10 | Package/public API surface                 | exports, unsafe helpers, bridge/server APIs, public docs alignment                                   | Initial detailed review done; P2 API surface second pass done            | Findings F-AUTH-41 through F-AUTH-46 recorded; probe and subagent confirmed public unsafe-helper reachability                                                                                                                                                         |
| S11 | Testing infrastructure                     | test helpers, auth/identity mocks, example tests, missing negative tests                             | Initial detailed review done; P2 testing infrastructure second pass done | Findings F-AUTH-45, F-AUTH-47 through F-AUTH-51, F-AUTH-57, and F-AUTH-58 recorded; probes and subagents confirmed gate/harness gaps                                                                                                                                  |

## Findings Ledger

| Finding                                                                                         | Severity    | Section    | Status | Evidence                                                                                                                                                                                                                                                                                                                                                                                                    | Required Fix                                                                                                                                                                                                                    |
| ----------------------------------------------------------------------------------------------- | ----------- | ---------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F-AUTH-01: Public agency seed mutation grants cross-tenant access                               | High        | S3/S8      | Open   | `examples/06-multi-workspace/convex/features/workspaces/domain.ts` exports `seedAgencyPortfolioMutation` as `mutation.public`; handler grants `agency_manager` memberships after `escapeIsolation`                                                                                                                                                                                                          | Delete public seed path or gate behind existing admin/agency authorization; add direct backend denial test                                                                                                                      |
| F-AUTH-02: Trusted webhook examples use replayable static shared secrets                        | High        | S7/S8      | Open   | `readSharedSecretWebhookBody` compares one header to secret; examples 03 and 07 call trusted Convex mutations after that check; source-policy tests currently assert the shared-secret helper remains in maintained examples                                                                                                                                                                                | Replace trusted webhook examples with HMAC raw-body timestamp delivery-id verification and idempotency                                                                                                                          |
| F-AUTH-03: Other-tab Better Auth session changes do not invalidate Trellis auth                 | Medium      | S1         | Open   | Better Auth client is created but Trellis auth engine only registers manual refresh/invalidate hooks                                                                                                                                                                                                                                                                                                        | Bridge Better Auth session signal into existing Trellis auth engine                                                                                                                                                             |
| F-AUTH-04: Trusted non-query identity-forwarding envelopes are replayable within TTL            | Medium      | S4         | Open   | `verifyIdentityForwardingEnvelope` redeems JTI only when `redeemJti` is supplied; ordinary trusted mutation/action forwarding is TTL-only; second-pass probe invoked the same signed trusted mutation args twice and got handler executions 1 then 2                                                                                                                                                        | Require trusted writes to be idempotent, JTI-redeemed, or routed through operation-execute confirmation                                                                                                                         |
| F-AUTH-05: `escapeIsolation` is available to normal handlers with only a reason string          | Medium      | S3/S9      | Open   | `ctx.db.escapeIsolation({ reason })` returns cross-tenant DB; normal public/protected handlers receive it directly; ESLint currently requires only non-empty reason and doctor reports escapes as pass-status inventory                                                                                                                                                                                     | Permit/static-gate cross-tenant escapes in public/protected handlers                                                                                                                                                            |
| F-AUTH-06: Mini CMS MCP bearer token is static and directly compared                            | Medium      | S5/S8      | Open   | `examples/08-component-mini-cms/server/lib/mcp-auth.ts` compares `token !== configuredToken`                                                                                                                                                                                                                                                                                                                | Reuse canonical hashed MCP key model or make example read-only                                                                                                                                                                  |
| F-AUTH-07: Sign-out clears local auth before upstream logout succeeds                           | Low         | S1         | Open   | `signOut()` commits unauthenticated state before `client.signOut()`                                                                                                                                                                                                                                                                                                                                         | Commit completed logout only after upstream session invalidation succeeds                                                                                                                                                       |
| F-AUTH-08: Tenant isolation tests miss write-side and escape regressions                        | Low         | S3/S11     | Open   | Existing multi-workspace tests cover list isolation but not foreign write/switch/seed denial                                                                                                                                                                                                                                                                                                                | Add direct negative tests for foreign reads/writes, non-member switch, unauthenticated mutation, seed denial                                                                                                                    |
| F-AUTH-09: Raw unwrapped DB is discoverable from handler-visible `ctx.db`                       | Critical    | S3         | Open   | `decorateDb()` defines `Symbol(trellisUnsafeDb)` directly on `ctx.db`; one-off probes recovered it with `Object.getOwnPropertySymbols(ctx.db)`, read/patched a foreign tenant post, and bypassed service table restrictions                                                                                                                                                                                 | Remove raw DB from `ctx.db`; use module-private `WeakMap` or closure-owned raw DB access for internals; add invariant tests for symbol/own-key/prototype traversal                                                              |
| F-AUTH-10: Async or non-boolean guards fail open                                                | High        | S2         | Open   | `runCheck()` returns any function result as `boolean`; second-pass probe showed `canAsyncFalse`, `canObjectTruthy`, `canComposedAsyncFalse`, and `enforceAsyncFalsePassed` all `true`                                                                                                                                                                                                                       | Make guard evaluation fail closed unless result is exactly boolean; reject Promise-like guard/check results through one shared evaluator                                                                                        |
| F-AUTH-11: Protected lane accepts `guard: open`                                                 | High        | S2         | Open   | `createProtectedLaneBuilder()` only requires a `guard` property; `define-handler` skips enforcement for `open`; probe reached handler as anonymous with `appIdentity: null`                                                                                                                                                                                                                                 | Reject `open` in `.protected` lanes; require `.public` for open handlers                                                                                                                                                        |
| F-AUTH-12: `authRequired` is accepted outside the guard phase and becomes inert                 | Medium      | S2         | Open   | `authRequired` has `check: true`; `normalizeAuthorize()` treats guards as check values and only special-cases `authRequired` in `definition.guard`; probe showed `can(null, authRequired) === true` and `authorize: authRequired` ran for anonymous                                                                                                                                                         | Reject `authRequired` outside handler `guard`, or special-case it in authorize/projection to require auth/appIdentity                                                                                                           |
| F-AUTH-13: Duplicate permission keys overwrite projected access                                 | Medium      | S2/S9      | Open   | `defineAccessContext()` builds `can` with `Object.fromEntries`; second-pass probe projected duplicate `invoice.pay` as `true` after a prior `false`, and async permission `invoice.refund` as `true`                                                                                                                                                                                                        | Validate duplicate permission keys in access context, feature composition/codegen, and doctor                                                                                                                                   |
| F-AUTH-14: MCP operation access can drift from permission-valued guards                         | Medium      | S5/S9      | Open   | `defineOperation()` only stamps `permissionKey` from explicit `permission`; MCP uses `options.permission ?? metadata.permissionKey`, and subagent found tests only cover operations that pass both guard and permission                                                                                                                                                                                     | Derive `permissionKey` from permission-valued guards or require explicit `permission` for MCP operation exposure                                                                                                                |
| F-AUTH-15: Shared users table enables cross-tenant enrollment by email                          | Medium      | S3/S8      | Open   | `examples/05-visibility-access` marks `users` shared and `enrollKnowledgeBaseUserByEmailOp` inserts enrollment for globally looked-up email without `user.workspaceId` check; S8 subagent confirmed Alpha can target a Beta email in the copied pattern                                                                                                                                                     | Deny cross-workspace users after lookup or query through workspace-bounded membership; add Alpha/Beta negative test                                                                                                             |
| F-AUTH-16: Runtime identity forwarding does not enforce envelope purpose                        | Medium      | S4         | Open   | `verifyIdentityForwardingEnvelope()` supports `expectedPurpose`, but `createContextWithRuntime()` does not pass it; second-pass probe accepted a `purpose: 'query'` envelope for a mutation function ref and executed the handler                                                                                                                                                                           | Pass expected purpose from the actual Convex operation/projection and reject per-call purpose overrides that do not match the helper operation                                                                                  |
| F-AUTH-17: Example 07 trusted webhook create is non-idempotent                                  | Medium      | S4/S8      | Open   | `server/api/runbook-webhook.post.ts` forwards a trusted create without event/delivery id and with delegated `actingFor`; `createRunbookOp` inserts unconditionally; no `processedEvents` table exists in example 07                                                                                                                                                                                         | Require delivery/event id and reject duplicates before inserting, following the example 03 processed-events pattern                                                                                                             |
| F-AUTH-18: Direct MCP mutation tools can omit explicit permissions                              | Medium      | S5/S9      | Open   | `accessAllows()` returns true when `permission` is undefined; second-pass probe showed `enabledWithoutPermission: true`, handler success, `mutationCalls: 1`, and `deniedEvents: 0`                                                                                                                                                                                                                         | Require `permission` for direct `tool.mutation(...)` unless an explicit reviewed public-write permit is supplied; add doctor/static checks and tests                                                                            |
| F-AUTH-19: Doctor misses imported server write helpers inside advanced MCP tools                | Medium      | S5/S9      | Open   | `findCustomMcpToolsWithAppWrites()` only matches `ctx.mutation(...)`/`ctx.action(...)`; second-pass inventory probe with `defineTool` plus `serverConvexMutation(...)` returned `findings: []`                                                                                                                                                                                                              | Extend inventory to detect server write helper imports/calls in standalone advanced MCP tools; keep app writes on `defineMcpApp(...).tool.*` lanes                                                                              |
| F-AUTH-20: MCP toolkit sessions are not bound to bearer identity                                | Medium      | S5/S8      | Open   | `useMcpSession()` hashes role/workspace/user but not `keyId`; dynamic shortcut callbacks in example 07 do not verify the current bearer matches the registering key                                                                                                                                                                                                                                         | Bind MCP session ids to `keyId`/`userId`/`workspaceId` before resume; dynamic tool callbacks should verify the registering caller key                                                                                           |
| F-AUTH-21: Direct MCP mutation safety can be forged in MCP-layer files                          | Medium/High | S5/S9      | Open   | `stampMcpToolSafety()` is exported from `@lupinum/trellis/mcp`; second-pass probe accepted tool-local `stampMcpToolSafety(...)` and descriptor projection for direct mutation safety                                                                                                                                                                                                                        | Move write safety metadata to backend/codegen-owned descriptors or make all writes operation-backed; fail if `stampMcpToolSafety()` appears under MCP tool files                                                                |
| F-AUTH-22: Unexpected backend exception messages are returned to MCP clients                    | Low/Medium  | S5/S11     | Open   | `toConvexError()` cleans stack framing but preserves raw message; second-pass probe showed `secret=db-password table=private.users` in both MCP text and structured error message                                                                                                                                                                                                                           | Redact unexpected server/unknown errors to a generic message plus correlation id; preserve explicit auth/validation/denial messages                                                                                             |
| F-AUTH-23: Invalid MCP bearer throttling is process-local in examples/starters                  | Low/Medium  | S5/S8/S9   | Open   | `mcp-invalid-bearer-throttle.ts` stores attempts in a process-local `Map`; reference/starter middleware runs this before each Convex key validation query; subagent confirmed starter copies the pattern                                                                                                                                                                                                    | Use a distributed invalid-bearer budget for production MCP bearer auth or make doctor warn/fail when only process-local throttling is present                                                                                   |
| F-AUTH-24: Transport-confirmed operation-execute replay is not durably redeemed at the backend  | High        | S6/S5      | Open   | `defineMcpApp` redeems transport confirmation tokens in the MCP confirmation store before execute; backend `transportMutation` only requires an `operation-execute` envelope with a non-empty JTI; second-pass probe replayed the exact same signed backend args twice and got `executions: 2` with no confirmation rows                                                                                    | Make backend execution redeem or record transport operation-execute JTIs durably before handler execution, or use backend confirmation for all destructive writes                                                               |
| F-AUTH-25: Transport-confirmed destructive executions skip durable audit rows                   | Medium      | S6/S11     | Open   | Backend-confirmed destructive mutations insert `destructiveAuditLog`; `transportMutation(...)` only emits `operation.execute.completed`; second-pass probe showed replayed transport execution left `auditRows: []`                                                                                                                                                                                         | Record durable destructive audit rows for transport executions, including action-backed executions, or make transport mode require an explicit durable audit callback/store                                                     |
| F-AUTH-26: Starter delete examples bypass destructive operation primitives                      | Medium      | S6/S8      | Open   | `examples/01-public-todo`, `examples/02-auth-todo`, and `src/cli/starter-fixtures/public` define todo delete as plain `operation.mutation` and export direct mutation deletes                                                                                                                                                                                                                               | Convert copied starter delete patterns to `operation.destructive` with preview/confirmation, or remove deletes from tiny starters                                                                                               |
| F-AUTH-27: Some UI examples call destructive execute without preview tokens                     | Low         | S6/S8      | Open   | Team workspace, MCP reference, and Mini CMS UIs call `removeTodo({ id })`, `deleteRunbookMutation({ id })`, or `publishPageMutation({ id })` directly even though backend exposes preview functions and destructive execute paths                                                                                                                                                                           | Update example UI flows to preview first, display effects/summary, then execute with returned confirmation token                                                                                                                |
| F-AUTH-28: Example 04 webhook creates non-idempotent tasks                                      | Medium      | S7/S8      | Open   | `examples/04-saas-platform/server/api/webhook.post.ts` forwards a shared-secret verified body to `internal.features.tasks.webhooks.createTaskFromWebhookMutation`; the internal mutation inserts a task and audit row unconditionally; payload has no event/delivery id                                                                                                                                     | Require delivery/event id and reject duplicates before insert, or route through the shared HMAC helper with durable idempotency                                                                                                 |
| F-AUTH-29: HMAC webhook helper consumes delivery ids before parsing succeeds                    | Low/Medium  | S7/S11     | Open   | `readHmacVerifiedWebhookBody()` calls `idempotency.consume(deliveryId)` before `parse(rawBody)`; second-pass probe showed a validly signed malformed body threw parse error after recording `evt_poisoned`                                                                                                                                                                                                  | Parse and validate first, then atomically consume the delivery id immediately before returning/dispatching work                                                                                                                 |
| F-AUTH-30: Docs show trusted server routes without concrete verification gates                  | Medium      | S7/S8      | Open   | `apps/docs/content/docs/07.server-side/2.server-routes.md` reads body and calls `serverConvexMutation(..., { auth: 'trusted', actingFor: delegateToUser({ allow: true }) })` without a concrete verifier; server-side, API reference, and call-pattern snippets rely on placeholder prose such as `verifyWebhookSignature(event)`                                                                           | Make trusted docs snippets include a concrete verification step or use `auth: 'required'` for browser/user-initiated routes; add docs tests for trusted snippets                                                                |
| F-AUTH-31: Public webhook helpers accept blank secrets                                          | Medium      | S7/S11     | Open   | `readSharedSecretWebhookBody`, `createWebhookHmacSignature`, and `isWebhookHmacSignatureValid` accept `secret: string` without trim/non-empty validation; second-pass probe showed blank shared-secret and blank HMAC secrets validate                                                                                                                                                                      | Reject blank secrets inside shared-secret and HMAC helpers; add tests for empty and whitespace secrets                                                                                                                          |
| F-AUTH-32: Example 03 public MCP email resolver leaks user existence and ids                    | Low/Medium  | S8         | Open   | `examples/03-team-workspace/convex/features/users/domain.ts` exposes `resolveMcpUserByEmailQuery = query.public(...)`; second-pass probe showed an anonymous raw caller resolving `alpha-owner@example.test` to the internal user id                                                                                                                                                                        | Delete the unused demo resolver or move it behind real MCP bearer validation/server-only trusted code; public queries should not resolve users by email                                                                         |
| F-AUTH-33: Share-token reads bypass article publish and readiness gates                         | Medium      | S8         | Open   | `viewArticleOp` resolves `args.shareToken` through `escapeIsolation` and returns the article without checking article status, knowledge-base status, prerequisites, or `availableAfter`; second-pass probe showed anonymous token read of a draft article in an unpublished knowledge base                                                                                                                  | Either restrict share-token creation/view to published, available content, or make draft/future sharing an explicit separate capability with tests and docs                                                                     |
| F-AUTH-34: Delegated `actingFor` docs/starters teach unconditional impersonation                | High        | S8         | Open   | `apps/docs/content/docs/08.permissions/2.caller-and-app-identity.md` and `src/cli/starter-fixtures/workspace*/convex/auth/appIdentity.ts` load `actingFor` user ids without checking whether the caller can represent that user; S8 subagent also found `delegateToUser({ allow: true })` in example 03/07 routes and MCP runtime                                                                           | Docs/starters/examples must compute delegation from a caller/service/agent-to-user allowlist; source tests should fail unconditional `actingFor` loading snippets                                                               |
| F-AUTH-35: Workspace starters allow existing users to re-run onboarding as owner                | Medium      | S8         | Open   | `src/cli/starter-fixtures/workspace*/convex/features/workspaces/domain.ts` and examples 03/04/07 create a workspace and patch the current user to owner/current workspace; second-pass probe in example 07 created two workspaces and rewrote access context to the second workspace                                                                                                                        | Enforce onboarding-only in the mutation by rejecting existing `user.workspaceId`/`role`, or model multi-workspace membership explicitly                                                                                         |
| F-AUTH-36: Public MCP key validation and touch bypass middleware throttling/audit boundaries    | Medium      | S8/S9      | Open   | `examples/07-mcp-reference` and `src/cli/starter-fixtures/workspace-mcp` expose `mcpKeys.validate` as `query.public` and `touch` as `mutation.public`; existing example tests directly call raw public validate/touch and assert user/workspace/role disclosure and `lastUsedAt` mutation                                                                                                                   | Make key validation/touch internal or server-only and enforce bearer-bound validation/rate limits in Convex; `touch` should update by validated key id, not unauthenticated hash input                                          |
| F-AUTH-37: `serverConvexAction` can omit explicit auth without lint coverage                    | Medium      | S9         | Open   | ESLint rule `server-convex-auth-explicit` only matches `serverConvexQuery` and `serverConvexMutation`; second-pass probe returned no messages for `serverConvexAction(event, api.jobs.run, args)` without `{ auth: ... }`; subagent also noted recommended config makes the rule warning-level                                                                                                              | Include `serverConvexAction` in the explicit-auth rule and add positive/negative lint tests; make blocking security guardrails fail in recommended production config                                                            |
| F-AUTH-38: Doctor blesses public MCP key validation as canonical bearer auth                    | Medium      | S9         | Open   | `hasCanonicalMcpBearerAuth()` passes when middleware source contains `api.features.mcpKeys.domain.validate` and `{ auth: 'none' }`; starter tests assert `query.public(validateMcpKeyOp)` and `mutation.public(touchMcpKeyOp)` while doctor reports `mcp-bearer-auth-configured` as pass                                                                                                                    | Change canonical MCP bearer auth to validate/touch through one server-controlled/internal boundary; make doctor fail public Convex key validation/touch                                                                         |
| F-AUTH-39: Static guardrails inventory unsafe surfaces without failing deploy                   | Medium      | S9         | Open   | `unsafe-surface-inventory`, `cross-scope-escape-inventory`, and `destructive-operation-inventory` are hard-coded `status: 'pass'`; tests assert unsafe entrypoints and `escapeIsolation` do not make doctor fail; second-pass probe also showed duplicate permission keys and imported advanced MCP server writes pass static inventory                                                                     | Promote dangerous inventory entries to fail/warn by production profile unless they carry an explicit reviewed permit and negative tests                                                                                         |
| F-AUTH-40: Docs and starter source tests preserve unsafe auth snippets instead of blocking them | Medium      | S9         | Open   | Docs tests mainly check gallery shape; source tests currently assert risky starter patterns such as public MCP validate/touch and `auth: 'none'`; second-pass subagent found no centralized source-policy suite and confirmed tests still accept `delegateToUser({ allow: true })`                                                                                                                          | Add source tests that deny known risky snippets after fixes; generated/starters/docs must assert absence of unsafe patterns, not presence                                                                                       |
| F-AUTH-41: Public MCP entrypoint lets tool files self-certify bounded-write safety              | High        | S10        | Open   | `@lupinum/trellis/mcp` and `#trellis/mcp` export `stampMcpToolSafety` and `trellisMcpToolSafetyKey`; `stampMcpToolSafety()` writes forgeable metadata using `Symbol.for`; docs and generated tools stamp refs inside `server/mcp/tools/*`                                                                                                                                                                   | Remove safety stamping from the top-level MCP surface; make write safety backend/codegen-owned and reject tool-local safety stamps                                                                                              |
| F-AUTH-42: Shared-secret webhook helper is a first-reader server export                         | Medium      | S10/S7     | Open   | `@lupinum/trellis/server` and `#trellis/server` export `readSharedSecretWebhookBody`; the helper doc states it does not bind body, timestamp, or delivery id; maintained examples and tests use it                                                                                                                                                                                                          | Delete the helper or move it to an explicitly unsafe/demo-only surface; make HMAC delivery-id helper the documented/default route API                                                                                           |
| F-AUTH-43: `delegateToUser` accepts literal `allow: true` on the public server surface          | High        | S10/S8     | Open   | `#trellis/server` re-exports `delegateToUser`; `DelegateToUserOptions.allow` accepts a boolean, and docs/tests use `allow: true` without proving caller-to-user delegation                                                                                                                                                                                                                                  | Replace literal boolean delegation with a helper that requires caller/service binding evidence, or move the raw helper to an unsafe/advanced surface and make source tests reject `allow: true`                                 |
| F-AUTH-44: Raw identity-forwarding transport primitives are re-exported from `backend`          | Medium      | S10/S4     | Open   | Package tests intentionally reject `@lupinum/trellis/identity-forwarding`, but `@lupinum/trellis/backend` re-exports `createIdentityForwardingEnvelope`, `verifyIdentityForwardingEnvelope`, `setIdentityForwardingContext`, `clearIdentityForwardingContext`, and `withIdentityForwarding`                                                                                                                 | Keep forwarding behind `serverConvex*`, `createMcpConvexCaller`, and `defineTrellis` transport lanes; move raw primitives to internal/test-only or explicitly unsafe advanced surface                                           |
| F-AUTH-45: Testing `asCaller` falls back to raw `caller` args                                   | Medium      | S10/S11    | Open   | `createPrincipalClient()` signs `_trellisForwarding`, but retries as plain `{ caller }` when Convex rejects the forwarding field; docs say `asCaller` signs the same envelope and is not raw forwarding                                                                                                                                                                                                     | Delete the fallback so tests fail closed; if legacy raw-caller testing is needed, expose a deliberately named unsafe test helper                                                                                                |
| F-AUTH-46: Trellis-branded `mcp/advanced` re-exports raw toolkit `defineMcpTool`                | Medium      | S10/S5     | Open   | `@lupinum/trellis/mcp/advanced` exports toolkit `defineMcpTool`; the file notes it skips blessed structural guarantees, and the MCP reference example uses it with hand-rolled auth checks                                                                                                                                                                                                                  | Stop re-exporting raw toolkit tools from Trellis, or rename/move them to an explicitly unsafe surface and keep maintained examples on Trellis-owned wrappers                                                                    |
| F-AUTH-47: Example route tests can be invisible to normal example gates                         | Medium      | S11/S7     | Open   | `examples/03-team-workspace/vitest.config.ts` includes only `convex/**/*.test.ts`; `pnpm --dir examples/03-team-workspace exec vitest run server/api/webhook.post.test.ts` finds no files, while `package.json` runs each example's own `pnpm test`                                                                                                                                                         | Include `server/**/*.test.ts` or `server/api/**/*.test.ts` in every example with server routes; add a repo source test that every `server/**/*.test.ts` is matched by its package config                                        |
| F-AUTH-48: `createTestContext` leaks identity-forwarding keys through process-wide env          | Medium      | S11        | Open   | `createTestContext({ identityForwardingKey })` writes `process.env.CONVEX_IDENTITY_FORWARDING_KEY`; `apps/harness/convex/testingPackage.test.ts` has a later `asCaller` test without a key that passes only after the previous test sets env; running only that test fails                                                                                                                                  | Keep identity-forwarding keys instance-local; do not mutate process env from the helper; add isolated-order tests that run `asCaller` with and without explicit keys                                                            |
| F-AUTH-49: Webhook route tests replace Trellis server helpers with weaker mocks                 | Medium      | S11/S7     | Open   | Example 03 and 07 route tests mock `#trellis/server.readSharedSecretWebhookBody` as `signature === secret`; the source-policy test asserts examples contain `readSharedSecretWebhookBody`; those tests do not exercise blank-secret rejection, HMAC body binding, timestamp, or delivery-id behavior                                                                                                        | Route tests should import the real webhook helper or test through a shared route harness; source tests should reject shared-secret helpers after migration and require HMAC/delivery-id verification                            |
| F-AUTH-50: Public-surface and type tests preserve unsafe APIs as compile contracts              | Medium      | S11/S10/S9 | Open   | `tests/types/mcp-runtime.types.ts` imports and uses `stampMcpToolSafety`; `tests/unit/mcp-index-exports.test.ts` uses `arrayContaining` for the blessed MCP surface and expects advanced `defineMcpTool`/`defineTool`; `tests/unit/mcp-auth-middleware.test.ts` expects public MCP validate/touch with `{ auth: 'none' }`; `tests/unit/server-boundaries.test.ts` blesses `delegateToUser({ allow: true })` | Flip these tests during fixes so unsafe APIs fail public type/export/source-policy checks instead of being asserted as expected behavior; make public-surface tests exact or add explicit negative assertions for unsafe extras |
| F-AUTH-51: Replay tests can pass on post-effect failures instead of proving replay redemption   | Medium      | S11/S6     | Open   | `tests/e2e/mcp-smoke.e2e.test.ts` accepts replay errors matching `already been redeemed` or `Post not found`; `apps/harness/convex/expAtomicExecute.test.ts` comments show direct replay is hard to isolate and manually pre-inserts JTI state                                                                                                                                                              | Add captured-request attacker harnesses that replay the same signed execute request before relying on resource state; assert backend redemption/audit state and no duplicate effects                                            |
| F-AUTH-52: MCP trusted forwarding uses the server transport lane                                | Medium      | S4/S5/S10  | Open   | `IdentityForwardingTransport` includes `mcp`, but `createMcpConvexCaller()` delegates to `createServerConvexCaller()` and `serverConvex*` signs `transport: 'server'`; an MCP-only handler would reject current MCP helper calls                                                                                                                                                                            | Either make MCP callers sign `transport: 'mcp'` and test server/MCP separation, or delete the unused transport lane/handler option                                                                                              |
| F-AUTH-53: Raw Better Auth client calls can mutate the server session without Trellis sync      | Medium      | S1         | Open   | `useBetterAuthClient()` exposes the raw Better Auth client and `plugin.client.ts` provides it as `$auth`; S1 source probe and subagent found no Better Auth session-event, storage, BroadcastChannel, or `getSession` subscription wiring back into the Trellis auth engine                                                                                                                                 | Wrap or subscribe raw Better Auth session mutations so sign-out/sign-in/session switches force Trellis refresh/invalidation through the existing auth engine                                                                    |
| F-AUTH-54: Convex token-provider forced refresh can reuse a recently validated JWT              | Medium      | S1         | Open   | `initAuthClient().fetchAuthState()` returns `recent-token-cache` for `forceRefreshToken: true` when `timeSinceValidation < TOKEN_CACHE_MS`; `TOKEN_CACHE_MS` is 10s and `tests/unit/plugin-client-token-cache.test.ts` asserts this behavior                                                                                                                                                                | Separate Convex-internal token pulls from session-authoritative refreshes; explicit session-change and protected-route validation must bypass the recent-token cache                                                            |
| F-AUTH-55: Route protection allows protected navigation from stale local auth                   | Medium      | S1         | Open   | `route-protection.global.ts` waits only while pending, then returns when `isAuthenticated.value` is true; without session-change subscription or navigation revalidation, a stale tab can enter protected routes after server session revocation                                                                                                                                                            | Revalidate or consume session-change invalidation before protected navigation; add navigation tests for revoked/session-switched Better Auth state                                                                              |
| F-AUTH-56: Auth proxy drops request bodies for DELETE-style auth endpoints                      | Low         | S1         | Open   | Auth proxy reads request bodies only for `POST`, `PUT`, and `PATCH`, while generic CORS allows `DELETE` and the proxy forwards non-critical endpoints with the original method                                                                                                                                                                                                                              | Either forward bodies for every method that can legally carry one or reject unsupported method/body combinations explicitly; add DELETE-with-body proxy tests                                                                   |
| F-AUTH-57: Nuxt runtime auth tests fail before collection in the current workspace              | Medium      | S11/S1     | Open   | `pnpm exec vitest run --project=nuxt tests/nuxt/auth-engine.nuxt.test.ts --reporter=verbose` failed before collecting tests because `@nuxt/test-utils` resolved `/@fs/Users/matthias/Git/workspace/ginko-cms/.../@nuxt/test-utils/dist/runtime/entry.mjs`; no Nuxt auth tests executed                                                                                                                      | Fix the Nuxt test project/dependency resolution so frontend auth/session tests collect and run from the Trellis workspace; add a smoke gate for at least one Nuxt auth runtime test                                             |
| F-AUTH-58: Local `pnpm check` is not a focused auth/security gate                               | Medium      | S11        | Open   | `package.json` runs `check` as lint, publish-surface, type, `test:contracts`, CLI, and example doctor checks; `test:contracts:repo` runs only `cli-doctor`, `module-auto-imports`, `api-surface-doc`, Nuxt, and server tests; CI separately runs full `pnpm run test`                                                                                                                                       | Add a focused `test:security` gate or expand `check`/contracts to include auth/MCP/public-surface/permission/destructive replay suites that protect the RFC findings                                                            |

## Review Coverage Audit

Audit date: 2026-06-04

Objective requirements checked:

| Requirement                                | Current evidence                                                                                                                                                                                                                                                                                          | Status                                                        |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| Review the library section by section      | Section map covers S1 through S11 across auth session/proxy, permissions, tenant isolation, trusted forwarding, MCP, destructive operations, routes/webhooks, examples/docs, static guardrails, public API, and test infrastructure                                                                       | Covered for auth/security review scope                        |
| Record findings in markdown                | Findings ledger contains F-AUTH-01 through F-AUTH-58; `auth-review-rfc.md` contains matching fix decisions and acceptance criteria                                                                                                                                                                        | Covered                                                       |
| Use subagents/different POVs when useful   | Subagent entries are logged for S4 through S11, P0/P1/P2 follow-up passes, and S1/S11 second passes                                                                                                                                                                                                       | Covered                                                       |
| Try to poke/probe assumptions              | Verification log records direct scratch probes for guard fail-open, raw DB symbol recovery, trusted forwarding replay/purpose mismatch, MCP safety/write bypasses, destructive replay, webhook helper weaknesses, examples/starters/docs, static guardrails, public API, and auth session source behavior | Covered                                                       |
| Verify current test/regression coverage    | Verification log records focused baselines, missing test gates, tests that preserve unsafe behavior, and the current Nuxt test collection failure                                                                                                                                                         | Covered as review evidence; fixes not verified                |
| Make sure everything is fully secure built | 58 open findings remain, including critical/high issues. Review proves the current implementation is not fully secure yet                                                                                                                                                                                 | Not achieved until remediation lands and invariant tests pass |

Conclusion:

- The deep review phase is covered for the defined S1-S11 auth/security scope.
- The implementation is not ready to call fully secure: all findings remain
  `Open`.
- The next phase should be remediation in priority order, starting with P0 raw
  DB exposure, permission fail-open cases, and destructive replay redemption.

## Second-Pass Review Status

Priority order is based on exploitability and blast radius, not current section
order.

| Priority | Area                                                | Review status             | Evidence                                                                                                                                                               |
| -------- | --------------------------------------------------- | ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P0       | Tenant isolation raw DB boundary                    | Done; remediation pending | P0 raw DB and service raw DB probes confirmed symbol recovery and cross-tenant/service-scope bypass                                                                    |
| P0       | Permission and protected handler pipeline           | Done; remediation pending | P0 permission probe confirmed async/truthy guard fail-open, `protected`+`open`, inert `authRequired`, and duplicate/async projection drift                             |
| P0       | Destructive operation execution and replay          | Done; remediation pending | P0 destructive replay probe confirmed duplicate transport execution and missing backend audit/redemption state                                                         |
| P1       | Trusted identity forwarding                         | Done; remediation pending | P1 forwarding probe confirmed trusted write replay and purpose mismatch; subagent confirmed MCP/server transport lane issue                                            |
| P1       | MCP authorization boundary                          | Done; remediation pending | P1 MCP probes confirmed no-permission direct mutation, tool-local safety forging, advanced write-helper blind spot, and raw error exposure                             |
| P1       | Webhook trust boundary                              | Done; remediation pending | P1 webhook probe confirmed blank-secret acceptance and idempotency consumption before parse                                                                            |
| P1       | Examples, starters, and docs copied into production | Done; remediation pending | P1 example probes confirmed public email lookup, draft share-token read, and workspace re-onboarding overwrite                                                         |
| P2       | Static guardrails and doctor coverage               | Done; remediation pending | P2 static probe confirmed missing protected/open lint, action explicit-auth gap, duplicate permission-key codegen acceptance, and advanced MCP write-helper blind spot |
| P2       | Package/public API surface                          | Done; remediation pending | P2 public API probe confirmed unsafe helpers reachable from public/runtime barrels                                                                                     |
| P2       | Auth session lifecycle and proxy edge cases         | Done; remediation pending | P2 S1 probe confirmed local-first sign-out and no Better Auth session subscription wiring                                                                              |
| P2       | Error handling and information disclosure           | Done; remediation pending | Covered in S5/S11 via MCP error leakage probe and tests that need redaction invariants                                                                                 |
| P2       | Test infrastructure and attacker harnesses          | Done; remediation pending | P2 S11 probes confirmed excluded example route tests, selected-test env leak, Nuxt collection failure, and weak local security gate                                    |

## Current Section Notes

### S1: Auth Session and Proxy

Files inspected locally:

- `src/runtime/auth/client/auth-engine.ts`
- `src/runtime/auth/client/auth-client.ts`
- `src/runtime/auth/composables/useConvexAuth.ts`
- `src/runtime/auth/composables/useBetterAuthActions.ts`
- `src/runtime/auth/composables/useBetterAuthClient.ts`
- `src/runtime/auth/internal/useConvexAuthController.ts`
- `src/runtime/auth/middleware/route-protection.global.ts`
- `src/runtime/auth/server/api/auth/[...].ts`
- `src/runtime/auth/server/api/auth/headers.ts`
- `src/runtime/auth/server/api/auth/security.ts`
- `src/runtime/auth/server/auth-cache.ts`
- `src/runtime/auth/server/auth-resolver.ts`
- `src/runtime/plugin.client.ts`
- `src/runtime/plugin.server.ts`
- `tests/unit/auth-client.test.ts`
- `tests/unit/plugin-client-refresh.test.ts`
- `tests/unit/plugin-client-token-cache.test.ts`
- `tests/unit/auth-proxy-handler.server.test.ts`
- `tests/unit/auth-proxy-security.test.ts`
- `tests/server/ssr-cache.server.test.ts`
- `tests/nuxt/auth-engine.nuxt.test.ts`
- `tests/nuxt/identity-continuity.nuxt.test.ts`

Confirmed evidence:

- Pilcrow auth guidance says sign-out should invalidate the server-side auth
  session, not only delete local client state. The current Trellis engine does
  the reverse for UI state: `signOut()` calls
  `commitUnauthenticated(null, { clearWasAuthenticated: true })` before
  `transport.invalidate()` and before `client.signOut()`.
- A scratch S1 source probe confirmed that local unauthenticated commit appears
  before upstream Better Auth `client.signOut()` in
  `src/runtime/auth/client/auth-engine.ts`.
- Existing Nuxt tests intentionally assert the current behavior: sign-out
  failure leaves `isAuthenticated` false and clears `token`/`user`, while
  surfacing the upstream error. Those tests will need to invert when F-AUTH-07
  is fixed.
- `initAuthClient()` creates a Better Auth client and the plugin provides it
  through `useBetterAuthClient()`/`$auth`, but neither the client transport nor
  the client plugin wires a Better Auth session-change subscription,
  `BroadcastChannel`, storage listener, or `getSession` polling path back into
  Trellis auth.
- The same source probe confirmed the absence of those subscription primitives
  in `src/runtime/auth/client/auth-client.ts` and `src/runtime/plugin.client.ts`.
- Direct raw Better Auth client calls can therefore change the authoritative
  HttpOnly Better Auth session without causing Trellis `convexToken`,
  `sessionUser`, `isAuthenticated`, or route protection to update until another
  refresh/token-expiry path happens.
- `fetchToken({ forceRefreshToken: true })` can still return
  `recent-token-cache` for ten seconds after validation; the unit test
  `plugin-client-token-cache.test.ts` asserts that no `/convex/token` call is
  made in this case. `auth.refreshAuth()` resets this cache first today, but
  Convex-internal forced pulls and any future session-signal bridge must not use
  the cached path for authoritative session validation.
- Route protection waits only when auth is pending; if stale local
  `isAuthenticated` is already true, protected navigation is allowed without a
  session revalidation.
- Positive proxy controls remain strong: the auth proxy validates CORS origins,
  restricts critical `/convex/token` and `/get-session` to `GET`/`OPTIONS`,
  rejects malformed traversal-like paths, strips hop-by-hop headers, constrains
  canonical redirects, enforces request/response body limits, and clears SSR
  auth cache when upstream logout clears the Better Auth session cookie.
- The proxy only reads request bodies for `POST`, `PUT`, and `PATCH`; a future
  Better Auth `DELETE` endpoint with a body would be forwarded without that
  body.
- The S1 subagent independently confirmed raw Better Auth client drift, route
  protection stale-auth trust, sign-out order, token-provider cache semantics,
  and DELETE body forwarding divergence.

Open review questions:

- Can `useBetterAuthClient()` remain raw, or should session-mutating methods be
  wrapped so Trellis auth refresh/invalidation is always attached?
- Should protected navigation always perform age-based/session-signal
  revalidation, or is a Better Auth subscription enough to make stale local
  `isAuthenticated` unrepresentable?
- Should recent-token cache be limited to Convex internal token pulls only, with
  a separate session-authoritative refresh path that always contacts Better
  Auth?
- Should unsupported auth proxy method/body combinations be rejected early
  rather than silently dropping request bodies?

### S2: Permissions and Protected Handler Pipeline

Files inspected locally:

- `src/runtime/auth/define-permission.ts`
- `src/runtime/functions/define-handler.ts`
- `src/runtime/functions/index.ts`

Confirmed evidence:

- Structured handlers centralize guard enforcement before `load`, `authorize`,
  and `handler`.
- Non-open guards require a resolved `appIdentity` before access is allowed.
- `authRequired` rejects anonymous callers and also requires an app identity.
- `authorize` runs after `load` and before `handler`.
- `runCheck()` does not validate that a guard result is boolean. A direct probe
  with `defineGuard('async false', async () => false)` returned `true` from
  `can(...)` because the Promise was truthy.
- `.protected` lane builders only require a `guard` property and do not reject
  `open`, so a protected-stamped function can skip guard enforcement.
- `authRequired` is a sentinel only in the handler guard phase; elsewhere its
  inert `true` check is treated as normal access.
- Projected access uses `Object.fromEntries`, so duplicate permission keys
  collapse silently to the last permission's value.
- Operation metadata only derives `permissionKey` from explicit `permission`,
  not from permission-valued `guard`, which can make MCP tool visibility drift
  from backend authorization.
- Second-pass permission probe reproduced the exploit set in the unit test
  runner with a scratch test file that was removed after capture:
  `canAsyncFalse: true`, `canObjectTruthy: true`,
  `canComposedAsyncFalse: true`, `enforceAsyncFalsePassed: true`,
  `canAuthRequiredNull: true`, `openProtectedAnonResult.ok: true`,
  `authorizeAuthRequiredAnonResult.ok: true`,
  `authorizeAsyncGuardAnonResult.ok: true`, and projected `can` values
  `{ "invoice.pay": true, "invoice.refund": true }`.
- The second-pass subagent independently traced the same fail-open paths through
  `runCheck`, `can`, `enforce`, `define-handler`, protected lane builders,
  `defineAccessContext`, permission codegen/doctor, and MCP operation metadata.

Open review questions for the fix plan:

- The fix should prefer a single strict sync boolean evaluator used by
  `runCheck`, `can`, `enforce`, composed guards, handler guard evaluation,
  authorization guard returns, permission projection, and explanations. Patching
  only `can()` would leave other fail-open paths alive.
- Async checks should be blocked at runtime and then backed by type/lint/static
  tests so JS consumers and `as any` casts cannot bypass the invariant.
- `authRequired` should probably be a non-evaluable sentinel outside the
  structured top-level guard path; keeping it as an ordinary `true` guard is too
  easy to misuse.
- Operation `permissionKey` derivation can happen in `defineOperation()` for
  permission-valued guards; MCP binding should still reject missing permission
  metadata for write-capable operation tools.

### S3: Tenant Isolation and Escape Hatches

Files inspected locally:

- `src/runtime/functions/index.ts`
- `src/runtime/app/index.ts`
- `src/runtime/auth/define-services.ts`
- `src/cli/lib/inventory-findings.ts`
- `src/eslint/rules/isolation.ts`
- `apps/harness/convex/crossTenant.ts`
- `apps/harness/convex/crossTenant.test.ts`
- `apps/harness/convex/posts.ts`
- `apps/harness/convex/posts.test.ts`
- `apps/harness/convex/functions.ts`
- `tests/unit/functions-defineTrellis.test.ts`
- `examples/06-multi-workspace/convex/features/workspaces/domain.ts`

Confirmed evidence:

- Isolation rules compare `appIdentity.workspaceId` with document tenant field.
- In production, isolation denial returns false and emits observations; in
  non-production, it throws detailed errors.
- Service DB wrappers restrict table access for scoped service callers.
- `escapeIsolation` is attached to decorated DB contexts and returns the
  cross-tenant DB after only requiring a non-empty reason.
- ESLint has `escape-isolation-requires-reason`, but no local evidence yet of a
  rule that forbids `escapeIsolation` in public/protected handlers.
- `decorateDb()` stores the raw DB directly on handler-visible `ctx.db` behind
  `Symbol('trellisUnsafeDb')`. Non-exported symbols are still discoverable with
  `Object.getOwnPropertySymbols`, so app code can recover raw DB access without
  the `escapeIsolation` API or observability.
- `examples/05-visibility-access` declares `users` as a shared table and the
  email enrollment mutation globally looks up `users.by_email` before inserting
  a current-workspace enrollment row. There is no `user.workspaceId ===
ctx.workspaceId` check.
- Second-pass raw DB probe: a dynamically injected protected query enumerated
  `Object.getOwnPropertySymbols(ctx.db)`, found `Symbol(trellisUnsafeDb)`, and
  read an Org 1 post as an Org 2 user after normal `posts.get` was denied.
  A companion protected mutation used the same raw DB to patch that foreign
  post; the Org 1 owner then read the patched title.
- Second-pass service probe: a service caller configured for `tables: ['tasks']`
  normally received `Service "sync" has no access to table "comments"`, but the
  same handler recovered `Symbol(trellisUnsafeDb)` and read `comments` through
  the raw DB. The hidden raw DB therefore bypasses both tenant isolation and
  service table/tenant scoping.
- `decorateDb()` attaches `escapeIsolation` directly to every decorated DB.
  For normal non-service callers, `crossTenantRules` is empty, so
  `escapeIsolation({ reason })` exposes the service-wrapped raw DB with no
  tenant rules. Existing examples use this from public/protected lanes for
  workspace bootstrap, workspace switching, agency seeding, public catalogs,
  and share-token reads.
- Current tests prove default wrapped DB behavior for cross-tenant get/list and
  patch/update denial, but do not assert that raw DB is unrecoverable, that
  service restrictions survive hostile handler code, that foreign delete is
  denied in the current runtime, or that normal public/protected
  `escapeIsolation` sites are statically gated.
- The S3 second-pass subagent independently confirmed the handler-visible raw
  DB symbol, normal-handler `escapeIsolation` exposure, and missing raw
  DB/escape-gating tests.

Open review questions for the fix plan:

- Which examples/starters call `escapeIsolation`, and are any write paths
  public/protected?
- Do static checks identify `escapeIsolation` as an explicit trust-boundary
  review item?
- Which internals still need raw DB access once the symbol property is removed?
- Can destructive-confirmation storage use a closure/WeakMap without adding a
  second DB abstraction?
- Do tests cover write-side isolation, cross-tenant role grants, and shared
  table reference writes?
- Should the default handler context expose any cross-tenant API at all, or
  should cross-tenant DB access only appear on unsafe/permit-backed lanes?
- Should service callers get a hardened DB wrapper that also hides all internal
  raw DB references from app code?

### S4: Trusted Identity Forwarding

Files inspected locally:

- `src/runtime/identity-forwarding/envelope.ts`
- `src/runtime/identity-forwarding/shared.ts`
- `src/runtime/identity-forwarding/index.ts`
- `src/runtime/convex/server/convex.ts`
- `src/runtime/functions/index.ts`
- `src/runtime/mcp/create-mcp-convex-caller.ts`
- `src/runtime/mcp/define-convex-tool.ts`
- `src/runtime/mcp/define-mcp-app.ts`

Confirmed evidence:

- The envelope format signs issuer, audience, JTI, subject, caller,
  `actingFor`, transport, purpose, function ref, args hash, and TTL.
- Verification supports issuer/audience/purpose/transport/functionRef/args/TTL
  checks and constant-time HMAC signature comparison.
- Runtime handlers require exact `identityForwardingFunctionRef` metadata before
  accepting signed forwarding args.
- Forwarded public `caller`/`actingFor` fields are stripped from non-trusted
  server calls and only read after verified forwarding context exists.
- Operation-execute forwarding has extra destructive confirmation coupling,
  including confirmation-token JTI checks.
- Ordinary trusted mutation/action forwarding is still TTL-only unless a JTI
  redemption callback is wired. This remains F-AUTH-04.
- `createContextWithRuntime()` verifies function ref and transport but does not
  pass `expectedPurpose`. A direct probe signed an envelope for
  `functionRef: 'tasks:delete'` with `purpose: 'query'`; runtime
  `setIdentityForwardingContext(..., { expectedFunctionRef: 'tasks:delete' })`
  accepted it.
- Second-pass runtime probe added a temporary unit test and removed it after
  capture. The same signed ordinary trusted mutation args with JTI
  `ordinary-trusted-write` executed twice, returning `{ executions: 1 }` and
  `{ executions: 2 }`.
- The same probe signed a mutation envelope with `purpose: 'query'` for
  `functionRef: 'tasks:update'`; the mutation handler accepted it and returned
  `{ executions: 1 }`.
- The second-pass subagent independently confirmed the missing
  `expectedPurpose` handoff, the missing JTI redemption for ordinary trusted
  mutation/action forwarding, and the example 07 duplicate-delivery risk.
- The subagent also identified that `IdentityForwardingTransport` includes
  `mcp`, but `createMcpConvexCaller()` goes through `createServerConvexCaller()`
  and the server helper signs `transport: 'server'`. This is now F-AUTH-52.
- `examples/07-mcp-reference/server/api/runbook-webhook.post.ts` verifies a
  route secret, mints a fresh trusted forwarding envelope, and calls the runbook
  create mutation without an event/delivery id.
- `examples/07-mcp-reference/convex/features/runbooks/domain.ts` inserts a
  runbook unconditionally in the trusted create path; unlike example 03, example
  07 has no `processedEvents` idempotency table.

Open review questions:

- Should expected purpose be derived directly from the Convex operation type in
  the runtime wrapper, or from operation projection metadata for preview/execute
  refs?
- Should server helper callers be allowed to override
  `identityForwardingEnvelope.purpose`, or should helper operation type own the
  purpose except for operation preview/execute internals?
- Does MCP need a true `transport: 'mcp'` envelope path, or is `server`
  intentionally the transport for all Nuxt-server-originated Convex calls?
- Should trusted write replay protection be a generic framework invariant, or
  should runtime/static checks require app-level idempotency for replay-sensitive
  routes? The simplest current pattern is example 03's `processedEvents`.
- What durable store should any mandatory mutation/action JTI redemption use
  without creating an unnecessary second source of truth?

### S5: MCP Runtime and Tools

Files inspected locally:

- `src/runtime/mcp/define-mcp-app.ts`
- `src/runtime/mcp/define-convex-tool.ts`
- `src/runtime/mcp/operation-binding.ts`
- `src/runtime/mcp/create-mcp-convex-caller.ts`
- `src/runtime/mcp/result-envelope.ts`
- `src/runtime/mcp/error-normalization.ts`
- `src/runtime/mcp/rate-limiter.ts`
- `src/runtime/mcp/use-mcp-session.ts`
- `src/cli/lib/project.ts`
- `src/cli/lib/inventory-findings.ts`
- `examples/07-mcp-reference/server/middleware/mcp-auth.ts`
- `examples/07-mcp-reference/server/mcp/runtime.ts`
- `examples/07-mcp-reference/server/mcp/tools/**`
- `examples/08-component-mini-cms/server/lib/mcp-auth.ts`
- `examples/08-component-mini-cms/server/mcp/tools/**`
- `src/cli/starter-fixtures/workspace-mcp/server/**`

Confirmed evidence:

- Canonical `defineMcpApp` tools check recordAccess in both `enabled` and
  `handler`, then still call backend Convex refs through the same trusted or
  anonymous caller path. Backend denial is observed as access/backend drift.
- Operation-backed MCP tools bind execute/preview refs to operation metadata,
  require preview refs for destructive operations, bind confirmation to caller,
  scope, operation, execute path, preview path, args hash, and redeem
  confirmation tokens.
- Direct mutation tools require bounded-write safety metadata, and backend
  safety must match the declared safety kind. However, `permission` is optional
  and `accessAllows(recordAccess, undefined)` returns true, so a direct MCP
  write can be exposed without an explicit permission unless the backend guard
  later denies it.
- Second-pass direct-write probe confirmed the runtime behavior: a
  no-permission `tool.mutation(...)` reported `enabledWithoutPermission: true`,
  executed the mutation handler with `mutationCalls: 1`, and emitted
  `deniedEvents: 0`.
- The current public MCP surface exports `stampMcpToolSafety()`, and examples
  stamp refs directly from MCP tool files. That makes the safety declaration
  author-owned at the transport layer, not backend-owned.
- The same second-pass probe confirmed both tool-local
  `stampMcpToolSafety(...)` and `defineMcpToolRefDescriptor(...)` projection
  can satisfy direct mutation safety at definition time from MCP-layer code.
- Low-level `defineTool` is intentionally under `mcp/advanced` and exposes only
  `ctx.query`; doctor has a guardrail for `ctx.mutation(...)`/`ctx.action(...)`
  in standalone advanced tools. The guardrail does not detect imported
  `serverConvexMutation(...)` or `serverConvexAction(...)` helpers.
- Second-pass doctor probe created a standalone `server/mcp/tools` file using
  `defineTool(...)` and `serverConvexMutation(...)`. Inventory returned
  `findings: []`, proving the current static guard only catches direct
  `ctx.mutation`/`ctx.action` use.
- Example 07's canonical bearer path hashes `mcp_...` tokens before Convex
  validation, checks revocation/bound user/workspace, delegates permission
  checks to the bound user, and uses a Redis-backed tool rate-limit store.
- Example 08 Mini CMS still uses one configured bearer token and grants all
  write permissions to that agent, which remains F-AUTH-06.
- `useMcpSession()` scopes session storage by caller hash plus session id, but
  the underlying toolkit session id is not bound to the bearer identity before
  dynamic tools can be listed or called.
- The session namespace hash includes role/workspace/user, but not the MCP
  `keyId`; two valid keys for the same user/workspace can therefore share
  `useMcpSession()` storage if a session id is reused, and example 07 dynamic
  shortcut callbacks do not check the current bearer against the registering
  key.
- MCP error wrapping avoids mirroring successful object results into the
  model-visible text channel by default. Unexpected backend errors still return
  the cleaned raw message to MCP clients.
- Second-pass error probe showed a raw server message
  `secret=db-password table=private.users` is returned in both MCP
  model-visible text and structured error content.
- Reference/starter invalid-bearer throttles use a process-local `Map`, while
  per-tool rate limits have a first-party Redis store and production checks.
- Mini CMS `publishPageOp` has `guard: canManagePages` but no explicit
  `permission`; the MCP `publish-page` tool also passes no `permission`. This
  is a concrete operation/access drift instance on top of F-AUTH-14.

Open review questions:

- Should direct `tool.mutation(...)` require a permission always, or allow
  reviewed public writes behind an explicit unsafe permit?
- Should `stampMcpToolSafety()` remain public for non-generated refs, or should
  direct MCP writes only accept backend/codegen-projected descriptors?
- Can MCP session binding happen before toolkit session resume, or does Trellis
  need a wrapper middleware around session-bearing MCP requests?
- Which error categories/codes are safe to expose verbatim to MCP clients, and
  should unexpected errors include only correlation/request ids?
- Should invalid-bearer throttling become a Trellis MCP runtime primitive
  rather than example-owned middleware?

### S6: Destructive Operation Safety

Files inspected locally:

- `src/runtime/mcp/destructive-confirmation.ts`
- `src/runtime/mcp/define-mcp-app.ts`
- `src/runtime/functions/confirmation-token.ts`
- `src/runtime/functions/define-operation.ts`
- `src/runtime/functions/index.ts`
- `tests/unit/destructive-confirmation.test.ts`
- `tests/unit/define-convex-tool.test.ts`
- `tests/unit/functions-defineTrellis.test.ts`
- `examples/04-saas-platform/convex/functions.ts`
- `examples/07-mcp-reference/convex/functions.ts`
- `examples/08-component-mini-cms/convex/components/miniCms/functions.ts`
- `examples/08-component-mini-cms/server/mcp/tools/publish-page.ts`

Confirmed evidence:

- Destructive MCP operation tools require preview refs and scope binding.
- Transport confirmation tokens bind operation id, execute path, preview path,
  caller key, scope key, full args hash, preview hash, and optional version
  hash.
- Transport confirmation validates the stored token, re-runs preview, compares
  confirm payload and version hashes, then redeems the token before calling the
  execute ref.
- Backend-confirmed destructive mutations require a stored confirmation token,
  strip `_confirmationToken` from business args, re-run load and authorize after
  confirmation, re-run preview, compare args/preview/version state, patch
  `redeemedAt`, execute the handler, and insert `destructiveAuditLog`.
- Backend confirmation rejects operation-execute envelopes whose JTI does not
  match the stored confirmation JTI.
- `assertNoOperationExecuteEnvelopeReplay()` rejects operation-execute envelopes
  only when the backend confirmation table already has a redeemed row with the
  envelope JTI.
- Transport-confirmed MCP execution uses the transport confirmation store. The
  operation-execute JTI sent to the backend is not inserted into the backend
  confirmation table, so backend replay checks have no durable row to find.
- Backend `transportMutation(...)` requires an operation-execute envelope with a
  non-empty JTI, but it does not independently redeem that JTI, re-run preview,
  or write the configured audit table. Those checks are performed in the MCP
  transport layer before the backend call.
- Second-pass captured-backend replay probe used the same
  `_trellisForwarding` operation-execute args twice against one
  `transportMutation(...)` definition. Both calls resolved:
  `first.executions: 1`, `second.executions: 2`, `executions: 2`,
  `confirmationRows: []`, and `auditRows: []`. This proves the backend accepts
  the captured execute request when no pre-existing redeemed JTI row exists.
- Tests cover replaying a transport confirmation token through MCP, and cover
  backend rejection when a JTI is already marked redeemed in the backend table.
  They do not cover replaying the captured backend operation-execute request
  for a transport-confirmed operation.
- The second-pass subagent independently confirmed the same replay story and
  noted that the MCP e2e replay assertion can pass on `Post not found`, which
  proves post-effect state rather than replay redemption.
- Mini CMS uses `tool.operation(..., { executeOperation: 'action',
confirmationMode: 'transport' })` with
  `transportExecuteOperationRef(...)`. Its public bridge action then calls the
  component publish mutation with a fresh bridge forwarding envelope rather
  than proving a backend durable operation-execute JTI/audit row, so
  action-backed transport execution needs separate verification or removal.
- Early examples and the public starter still teach direct delete mutations
  rather than the destructive operation primitive.
- Some later UIs expose destructive backends but call execute without preview
  tokens, which backend rejects but still teaches the wrong workflow.

Open review questions:

- Should transport confirmation mode be deleted in favor of backend
  confirmation for destructive writes, or should it get its own backend durable
  JTI/audit store?
- For action-backed destructive operations, should the framework record an
  audit attempt before execute and a completion after execute, since action
  side effects cannot be transactionally rolled back?
- Should `transportMutation(...)` re-run preview at the backend, or is a
  durable operation-execute JTI redemption record enough to make replay safe?
- Can operation-execute replay protection share the existing destructive
  confirmation table without adding another source of truth?
- Should the first two examples avoid delete entirely until destructive
  operations are introduced, or introduce a tiny preview/confirm UX earlier?

### S7: Server Routes and Webhooks

Files inspected locally:

- `src/runtime/server/webhooks.ts`
- `src/runtime/auth/server/api/auth/[...].ts`
- `src/runtime/auth/server/api/auth/security.ts`
- `src/runtime/auth/server/api/auth/body-size.ts`
- `src/runtime/auth/server/api/auth/headers.ts`
- `examples/03-team-workspace/server/api/webhook.post.ts`
- `examples/03-team-workspace/convex/features/todos/webhooks.ts`
- `examples/03-team-workspace/convex/auth/idempotency.ts`
- `examples/04-saas-platform/server/api/webhook.post.ts`
- `examples/04-saas-platform/convex/features/tasks/webhooks.ts`
- `examples/04-saas-platform/server/api/export.get.ts`
- `examples/07-mcp-reference/server/api/runbook-webhook.post.ts`
- `examples/07-mcp-reference/convex/features/runbooks/domain.ts`
- `examples/07-mcp-reference/server/middleware/mcp-auth.ts`
- `src/cli/starter-fixtures/workspace-mcp/server/middleware/mcp-auth.ts`

Confirmed evidence:

- The auth proxy route validates CORS origins, restricts critical auth
  endpoints to `GET`/`OPTIONS`, rejects malformed traversal-like paths, limits
  request/response bodies, strips hop-by-hop headers, constrains canonical
  redirects, and avoids leaking generic upstream failures. Existing unit tests
  cover these hardening paths.
- `src/runtime/server/webhooks.ts` includes a stronger HMAC helper that binds
  signature to raw body, timestamp, and delivery id with a default five-minute
  tolerance.
- The maintained webhook examples still use `readSharedSecretWebhookBody`, not
  the HMAC helper. This remains F-AUTH-02.
- The S7 subagent independently confirmed examples 03, 04, and 07 use the
  shared-secret helper as the maintained/default path, and that
  `tests/unit/example-webhook-security.test.ts` currently asserts that helper
  remains present.
- Example 03 requires `workspaceId`, `eventId`, and `title`, then the protected
  Convex mutation calls `ensureNotProcessed()` before insert and
  `markProcessed()` after insert. It has domain-level replay protection.
- Example 04 accepts `projectId`, `title`, and optional priority, then calls an
  internal mutation with `auth: 'none'`. The internal mutation inserts a task
  and audit event unconditionally. There is no event id, delivery id, or
  processed-event table for this webhook path.
- Example 07 accepts title/content/visibility/tags, delegates to a configured
  user with `auth: 'trusted'`, and calls the protected runbook create mutation.
  It still has no event/delivery id and creates unconditionally, which remains
  F-AUTH-17.
- `readHmacVerifiedWebhookBody()` consumes the delivery id before parsing the
  raw body. If parse/validation then throws, a retry with the same provider
  delivery id will be rejected as duplicate.
- Second-pass helper probe confirmed a validly signed malformed HMAC body with
  delivery id `evt_poisoned` threw during parse after the idempotency consumer
  had already recorded the delivery id.
- Docs include trusted server-route snippets without a concrete verification
  call before `auth: 'trusted'` and `delegateToUser({ allow: true })`.
- The subagent also found API reference and call-pattern docs with trusted
  snippets that rely on placeholder verification text instead of a concrete
  HMAC/timestamp/delivery-id gate.
- Webhook helper APIs do not reject blank secrets; examples fail closed before
  calling them, but consumers can pass empty env fallbacks.
- Second-pass helper probe confirmed blank shared-secret and blank HMAC secrets
  validate at the library helper level.
- The example 03 route test lives under `server/api`, but that example's Vitest
  config only includes `convex/**/*.test.ts`, so normal example test runs miss
  the route test.

Open review questions:

- Should `readSharedSecretWebhookBody()` remain exported, or move to an
  explicitly unsafe/demo subpath so first-reader examples cannot import it?
- Should the HMAC helper own raw-body reading with a size limit instead of
  requiring routes to supply `rawBody`?
- Should idempotency consumption happen in the route helper, the Convex domain
  mutation, or both? The safer default is domain-level idempotency because it is
  transactionally adjacent to the write.
- Should route tests outside `convex/**/*.test.ts` be included in example test
  configs or moved into the root unit suite?
- Should docs enforce an invariant that every `auth: 'trusted'` server-route
  snippet contains an explicit verification call before forwarding?

### S8: Examples, Starters, and Docs

Files inspected locally:

- `examples/01-public-todo/convex/features/todos/domain.ts`
- `examples/02-auth-todo/convex/features/todos/domain.ts`
- `examples/03-team-workspace/convex/features/users/domain.ts`
- `examples/03-team-workspace/convex/auth/appIdentity.ts`
- `examples/03-team-workspace/app/features/team-workspace/components/TeamWorkspacePage.vue`
- `examples/04-saas-platform/server/api/webhook.post.ts`
- `examples/04-saas-platform/convex/features/tasks/webhooks.ts`
- `examples/05-visibility-access/convex/features/articles/domain.ts`
- `examples/05-visibility-access/convex/features/articles/shareTokens.ts`
- `examples/05-visibility-access/convex/features/articles/access.ts`
- `examples/05-visibility-access/convex/features/knowledgeBases/domain.ts`
- `examples/06-multi-workspace/convex/features/workspaces/domain.ts`
- `examples/07-mcp-reference/convex/features/mcpKeys/domain.ts`
- `examples/07-mcp-reference/server/middleware/mcp-auth.ts`
- `examples/07-mcp-reference/server/api/runbook-webhook.post.ts`
- `examples/07-mcp-reference/app/features/mcp-reference/components/McpReferencePage.vue`
- `examples/08-component-mini-cms/convex/features/pages/domain.ts`
- `examples/08-component-mini-cms/convex/components/miniCms/features/pages/domain.ts`
- `examples/08-component-mini-cms/app/features/pages/components/MiniCmsStudioPage.vue`
- `examples/08-component-mini-cms/server/lib/mcp-auth.ts`
- `src/cli/starter-fixtures/public/convex/features/todos/domain.ts`
- `src/cli/starter-fixtures/workspace/convex/features/workspaces/domain.ts`
- `src/cli/starter-fixtures/workspace/convex/auth/appIdentity.ts`
- `src/cli/starter-fixtures/workspace-mcp/convex/features/workspaces/domain.ts`
- `src/cli/starter-fixtures/workspace-mcp/convex/features/mcpKeys/domain.ts`
- `src/cli/starter-fixtures/workspace-mcp/convex/auth/appIdentity.ts`
- `src/cli/starter-fixtures/workspace-mcp/server/middleware/mcp-auth.ts`
- `apps/docs/content/docs/07.server-side/2.server-routes.md`
- `apps/docs/content/docs/07.server-side/3.webhooks-and-identity-forwarding.md`
- `apps/docs/content/docs/08.permissions/2.caller-and-app-identity.md`
- `apps/docs/content/docs/13.api-reference/4.server.md`
- `apps/docs/content/docs/14.mcp-tools/1.getting-started.md`

Confirmed evidence:

- Examples and starters contain several already-recorded copied patterns:
  direct tiny-starter deletes, shared-secret trusted webhooks, non-idempotent
  webhook creates, public agency seed, static Mini CMS MCP token, and UI paths
  that call destructive execute without preview tokens.
- Example 03 exposes a public `resolveMcpUserByEmailQuery`. It returns an
  internal user id for any email that resolves to a user with a workspace, with
  no MCP bearer or server-only boundary.
- Second-pass public email probe confirmed an anonymous `ctx.raw.query` against
  `resolveMcpUserByEmailQuery` resolved `alpha-owner@example.test` to the seeded
  workspace owner's internal user id.
- Example 05 public share tokens are hashed at rest and support expiry and
  revocation, but token reads happen before app identity and readiness checks.
  The share-token branch bypasses knowledge-base published status, article
  published status, prerequisites, and future `availableAfter` checks.
- Second-pass share-token probe confirmed an anonymous raw caller could read a
  draft article in an unpublished knowledge base after an editor created a
  share token for it.
- The S8 subagent independently confirmed cross-workspace email enrollment in
  example 05: `enrollKnowledgeBaseUserByEmailOp` globally looks up
  `users.by_email` and inserts an enrollment without checking
  `user.workspaceId === ctx.workspaceId`.
- Docs and workspace starters show `actingFor` user ids being loaded directly
  into app identity. The docs wire `resolveActingFor` into MCP forwarding and
  show `delegateToUser({ allow: true })`, but do not show caller-to-user
  authorization as the invariant.
- Workspace and workspace-MCP starters let any authenticated user call
  `createWorkspaceMutation`; the backend creates a new workspace and overwrites
  the same user row with owner role/current workspace even when the user is
  already onboarded.
- Second-pass re-onboarding probe in example 07 confirmed a direct caller can
  create a first and second workspace, and the final access context points at
  the second workspace with owner role.
- MCP reference and workspace-MCP starter expose key validation and last-used
  touch as public Convex functions. The `/mcp` middleware's invalid bearer
  budget does not protect callers who go directly to the public Convex
  validation oracle, and `touch` updates last-used state by unauthenticated hash
  input.
- Existing MCP reference tests intentionally call `ctx.raw.query(validate)` and
  `ctx.raw.mutation(touch)` and assert key binding disclosure and last-used
  mutation, so public validation/touch is preserved as a test contract.
- The S8 subagent also confirmed the static Mini CMS demo bearer token, public
  direct-delete tiny starter pattern, public agency seed mutation, and missing
  systematic source-policy suite for production-copyable auth snippets.
- Existing tests pass but do not assert the new denial cases: anonymous email
  resolver denial, draft/future share-token denial, starter re-onboarding
  denial, or direct public MCP hash validation denial.

Open review questions:

- Should example 03's public email resolver be deleted entirely? There is no
  local server middleware using it now, so deletion is simpler than a new
  server-only path.
- Should public share tokens always require published/available content, or
  should the example add a separate explicit draft-preview token with a
  different operation id and permission?
- Should `actingFor` docs define one canonical helper for caller-to-user
  delegation, so examples do not each invent allowlist checks?
- Should workspace starters reject existing `workspaceId`/`role`, or should the
  workspace starter graduate to membership rows like the multi-workspace
  example?
- Can MCP key validation/touch become internal Convex functions without adding
  a second key-validation source of truth?

### S9: Static Guardrails

Files inspected locally:

- `src/eslint/rules/auth.ts`
- `src/eslint/rules/boundaries.ts`
- `src/eslint/rules/isolation.ts`
- `src/eslint/rules/mcp.ts`
- `tests/unit/eslint-plugin.test.ts`
- `src/cli/lib/doctor-report.ts`
- `src/cli/lib/inventory-findings.ts`
- `src/cli/lib/project.ts`
- `src/cli/lib/permission-metadata.ts`
- `src/module-internals/permissions-codegen.ts`
- `tests/unit/cli-doctor.test.ts`
- `tests/unit/permissions-codegen.test.ts`
- `tests/unit/example-webhook-security.test.ts`
- `tests/unit/mcp-auth-middleware.test.ts`
- `tests/unit/examples-gallery-docs.test.ts`
- `src/cli/starter-fixtures/workspace-mcp/server/middleware/mcp-auth.ts`
- `src/cli/starter-fixtures/workspace-mcp/convex/features/mcpKeys/domain.ts`
- `apps/docs/content/docs/07.server-side/2.server-routes.md`

Confirmed evidence:

- ESLint catches some useful local shapes: direct unsafe collection queries
  without indexes, missing `enforce()` in protected handlers, inline guards that
  do async/DB work, `ctx.db.escapeIsolation()` calls without a reason, MCP scoped
  tools without auth, destructive MCP tools without preview, and MCP middleware
  that does not await `next`.
- The same ESLint coverage is syntax-narrow. `server-convex-auth-explicit` only
  matches `serverConvexQuery` and `serverConvexMutation`, not
  `serverConvexAction`. A local ESLint probe against `serverConvexAction(...)`
  without options returned no messages.
- `guard-no-db` only checks inline handler guard functions. It does not reject
  imported async/non-boolean `defineGuard(...)` definitions, `protected` lanes
  that use `guard: open`, or `authRequired` outside the handler `guard` phase.
  Existing lint tests explicitly assert that `query.protected({ guard: open })`
  is not flagged.
- Second-pass ESLint probe confirmed strict lint produced no messages for
  `query.protected({ guard: open })`.
- The same probe confirmed strict lint produced no messages for
  `serverConvexAction(event, api.jobs.run, {})` without explicit `{ auth: ... }`.
  The S9 subagent also noted `server-convex-auth-explicit` is warning-level in
  the recommended config, which weakens it as a production-blocking guardrail.
- `escapeIsolation` has two static treatments today: ESLint requires a reason
  string, and doctor inventories the call. Neither proves caller authority or
  scope, and doctor reports the inventory finding as `pass`.
- Doctor inventories unsafe entrypoints, cross-scope escapes, and destructive
  operations as `pass`, even when the entries exist. The tests assert this
  non-failing behavior.
- Doctor's custom MCP app-write bypass detector only searches advanced tool
  files for `defineTool(...)` plus `ctx.mutation(...)` or `ctx.action(...)`.
  Imported `serverConvexMutation(...)` and `serverConvexAction(...)` calls can
  bypass this detector.
- Second-pass doctor/inventory probe confirmed an advanced `defineTool(...)`
  importing `serverConvexMutation(...)` produced
  `inventory.mcp.customAppWriteMisuses: []` and a passing
  `mcp-custom-app-write-bypass` finding.
- Doctor's canonical MCP bearer check is a string-presence check for middleware
  containing `MCP bearer token required.`,
  `api.features.mcpKeys.domain.validate`, and `{ auth: 'none' }`. That means the
  current public Convex key validation path can be reported as canonical.
- Starter/source tests currently preserve several unsafe patterns. The
  workspace-MCP starter test asserts public `mcpKeys.validate`/`touch`, and the
  MCP auth middleware source test asserts `{ auth: 'none' }` for key validation.
  These tests will need to invert after the fix.
- Permission codegen extracts exported `definePermission({ key })` metadata but
  does not reject duplicate keys. Doctor permission findings currently cover
  orphan definitions, unknown inventory entries, and unused projections, but not
  duplicate keys across included permission files.
- Second-pass permission-codegen probe confirmed two exported permissions with
  `key: 'invoice.pay'` are both accepted in metadata as duplicate key entries.
- Docs/source checks do not enforce trusted-route invariants. The webhook source
  test only verifies that examples use the shared helper and
  `timingSafeEqual`; gallery docs tests do not reject trusted snippets that lack
  a concrete verification gate.
- The S9 subagent independently confirmed public MCP validate/touch is blessed
  by the doctor source checks, direct MCP mutation permission is still optional
  without static failure, public/generated `stampMcpToolSafety` remains accepted
  under the first-reader MCP surface, and docs/starters still lack centralized
  source-policy denial for unconditional delegation and trusted route snippets.
- The S9 subagent independently confirmed the same classes: escape inventory is
  non-failing, protected/open and misplaced `authRequired` are not statically
  rejected, duplicate permission keys lack codegen/doctor rejection, direct MCP
  mutation/safety stamping is not modeled, advanced MCP write helper imports are
  missed, and docs/starters preserve risky snippets.

Open review questions:

- Should production doctor fail every unsafe entrypoint, cross-scope escape, and
  destructive operation unless there is an explicit reviewed permit with
  expiration/reviewer metadata?
- Should `query.protected({ guard: open })` be a hard ESLint error, a runtime
  definition error, or both? The safer answer is both.
- Should duplicate permission-key validation live in `defineAccessContext`,
  feature composition, permission codegen, and doctor, or can one canonical
  validation helper serve all four callers?
- Should static source tests be centralized into one auth-policy test suite so
  docs, examples, starters, and generated output cannot drift independently?
- Should `stampMcpToolSafety()` remain public after S10, or move behind
  backend/codegen-owned operation descriptors?

### S10: Package and Public API Surface

Files inspected locally:

- `package.json`
- `src/installers/core.ts`
- `src/installers/advanced.ts`
- `src/runtime/auth/index.ts`
- `src/runtime/backend/index.ts`
- `src/runtime/server/index.ts`
- `src/runtime/server/acting-for.ts`
- `src/runtime/server/webhooks.ts`
- `src/runtime/mcp/index.ts`
- `src/runtime/mcp/advanced.ts`
- `src/runtime/mcp/operation-binding.ts`
- `src/runtime/testing/index.ts`
- `tests/unit/package-subpath-exports.test.ts`
- `tests/unit/backend-index-exports.test.ts`
- `tests/unit/server-index-exports.test.ts`
- `tests/unit/mcp-index-exports.test.ts`
- `tests/unit/module-auto-imports.test.ts`
- `tests/dts/mcp.types.ts`
- `tests/types/mcp-runtime.types.ts`
- `apps/docs/content/docs/13.api-reference/4.server.md`
- `apps/docs/content/docs/13.api-reference/5.mcp.md`
- `apps/docs/content/docs/13.api-reference/7.api-surface.md`
- `apps/docs/content/docs/14.mcp-tools/2.define-tools.md`
- `apps/docs/content/docs/12.testing/2.testing-protected-handlers.md`

Confirmed evidence:

- The published package subpaths are intentionally small: root, `auth`, `args`,
  `app`, `backend`, `workspace`, `composables`, `mcp`, `mcp/advanced`,
  `server`, `testing`, and `type-primitives`. Tests explicitly reject deleted
  subpaths such as `functions`, `bridge`, `identity-forwarding`, and
  `visibility`.
- The Nuxt advanced installer aliases `#trellis/server` and `#trellis/mcp` by
  re-exporting the full `runtime/server/index` and `runtime/mcp/index`
  entrypoints. Anything on those barrels is therefore a convenient app import,
  not only a bare npm subpath.
- The MCP top-level entrypoint describes itself as the blessed first-reader MCP
  surface, but exports `stampMcpToolSafety` and `trellisMcpToolSafetyKey`.
  `stampMcpToolSafety()` writes metadata with `Symbol.for(...)` plus a local
  WeakMap, and docs/type tests show tool files stamping generated refs before
  calling `tool.mutation(...)`.
- A scratch public API probe imported `src/runtime/mcp/index` and confirmed
  top-level `stampMcpToolSafety()` can tag an arbitrary local ref as
  `bounded-write`, after which `getMcpToolSafety()` reads that tool-local claim.
- The server top-level entrypoint exports both the stronger HMAC webhook helper
  and the replayable shared-secret helper. The shared-secret helper's own doc
  says it does not bind body, timestamp, or delivery id, and maintained examples
  still import it through `#trellis/server`.
- The server top-level entrypoint exports `delegateToUser`. The helper accepts
  `allow: boolean | (() => boolean)`, and docs/tests use literal `allow: true`.
  That public shape lets copied routes create an `actingFor` payload without a
  caller-to-user binding proof.
- The same probe imported `src/runtime/server/index` and confirmed
  `delegateToUser({ userId, allow: true })` returns `{ subject: 'user:...' }`
  with no caller or binding input, and that `readSharedSecretWebhookBody`
  remains on the server barrel.
- The package intentionally has no `@lupinum/trellis/identity-forwarding`
  export, but `@lupinum/trellis/backend` re-exports the low-level forwarding
  envelope and context APIs. A source export snapshot showed
  `createIdentityForwardingEnvelope`, `verifyIdentityForwardingEnvelope`,
  `setIdentityForwardingContext`, `clearIdentityForwardingContext`, and
  `withIdentityForwarding` on the backend barrel.
- The probe also confirmed `src/runtime/backend/index` exposes raw forwarding
  envelope/context helpers and `src/runtime/mcp/advanced` exposes
  `defineMcpTool`/`defineTool`.
- The testing subpath exposes `createTestContext().asCaller(...)`, which signs a
  forwarding envelope first but silently retries with plain `{ caller }` args
  when the called function rejects `_trellisForwarding`. This contradicts the
  testing docs, which state the helper signs the same envelope shape and is not
  raw forwarding.
- `@lupinum/trellis/mcp/advanced` re-exports raw toolkit `defineMcpTool` under
  the Trellis package. Its own file comment says the helper skips the blessed
  structural guarantees. The MCP reference example uses it for session tools
  with hand-rolled auth checks.
- The S10 subagent independently confirmed the MCP safety-stamp exposure,
  testing fallback, raw identity-forwarding backend exports, public
  shared-secret helper, and raw `mcp/advanced` toolkit export.

Open review questions:

- Should there be any public API that creates or stamps trust metadata, or
  should trust metadata always be backend/codegen/runtime owned?
- Should `@lupinum/trellis/server` keep only HMAC webhook helpers and delete
  shared-secret verification entirely?
- Should `delegateToUser` be replaced with a helper that requires the caller,
  target user, workspace, and binding record in one call, so `allow: true` is
  not representable?
- Should identity-forwarding envelope creation/verification remain public for
  bridge/package authors, or move to the bridge package and internal Trellis
  runtime only?
- Should `@lupinum/trellis/mcp/advanced` exist as a public subpath, or should
  advanced tools import raw toolkit APIs directly so Trellis does not brand them
  as auth-safe?
- Should testing helpers ever emulate raw forwarding? The safer default is no;
  tests should fail when production would reject raw identity args.

### S11: Testing Infrastructure

Files inspected locally:

- `src/runtime/testing/index.ts`
- `vitest.config.ts`
- `package.json`
- `examples/01-public-todo/vitest.config.ts`
- `examples/02-auth-todo/vitest.config.ts`
- `examples/03-team-workspace/vitest.config.ts`
- `examples/04-saas-platform/vitest.config.ts`
- `examples/05-visibility-access/vitest.config.ts`
- `examples/06-multi-workspace/vitest.config.ts`
- `examples/07-mcp-reference/vitest.config.ts`
- `examples/08-component-mini-cms/vitest.config.ts`
- `apps/harness/convex/testingPackage.test.ts`
- `examples/03-team-workspace/server/api/webhook.post.test.ts`
- `examples/04-saas-platform/server/api/webhook.post.test.ts`
- `examples/07-mcp-reference/server/api/runbook-webhook.post.test.ts`
- `tests/unit/testing.test.ts`
- `tests/unit/example-webhook-security.test.ts`
- `tests/unit/examples-gallery-docs.test.ts`
- `tests/unit/phase0-starter-manifest.test.ts`
- `tests/unit/phase0-workspace-mcp-fixture.test.ts`
- `tests/unit/public-surface-inventory-script.test.ts`
- `tests/unit/mcp-auth-middleware.test.ts`
- `tests/unit/mcp-index-exports.test.ts`
- `tests/types/mcp-runtime.types.ts`
- `tests/e2e/mcp-smoke.e2e.test.ts`
- `apps/harness/convex/expAtomicExecute.test.ts`
- `tests/nuxt/auth-engine.nuxt.test.ts`
- `tests/nuxt/identity-continuity.nuxt.test.ts`
- `tests/nuxt/useConvexAuthInternal.nuxt.test.ts`
- `tests/nuxt/useConvexAuthFlow.nuxt.test.ts`
- `tests/nuxt/token-lifecycle.nuxt.test.ts`

Confirmed evidence:

- `createTestContext().asCaller(...)` signs `_trellisForwarding` first, but
  catches `Unexpected field _trellisForwarding` and retries with plain
  `{ caller }`. That means tests can pass against handlers whose schemas or
  helpers reject the production signed transport shape.
- `createTestContext({ identityForwardingKey })` writes the key into
  `process.env.CONVEX_IDENTITY_FORWARDING_KEY`. The harness test
  `forwards principals with the same permission rules as browser callers`
  omits an explicit key but passes after the previous test mutates process env.
  Running only that test fails with the expected missing-key error.
- Example Vitest configs are inconsistent for server routes. Example 03 has
  `server/api/webhook.post.test.ts`, but its config only includes
  `convex/**/*.test.ts`; the normal package `test:examples:prepared` script
  calls each example's own `pnpm test`, so this route test is not part of the
  example gate.
- Example 03 and 07 route tests mock `#trellis/server` and replace
  `readSharedSecretWebhookBody` with a simple `signature === secret`
  implementation. These tests verify route wiring, but not the actual Trellis
  helper semantics, blank-secret behavior, HMAC body binding, timestamp
  checks, or delivery-id idempotency.
- Several source/type tests currently preserve known unsafe auth surfaces:
  `example-webhook-security.test.ts` asserts maintained examples import
  `readSharedSecretWebhookBody`; `mcp-auth-middleware.test.ts` asserts MCP key
  validation/touch use `{ auth: 'none' }`; `server-boundaries.test.ts`
  exercises `delegateToUser({ allow: true })`; `mcp-index-exports.test.ts`
  uses partial `arrayContaining` assertions for the blessed top-level surface
  and asserts raw toolkit helpers exist under `mcp/advanced`; and
  `mcp-runtime.types.ts` compiles `stampMcpToolSafety(...)` as a first-class
  direct mutation path.
- Some replay tests do not isolate replay redemption as the cause of failure.
  The MCP e2e replay assertion accepts either `already been redeemed` or
  `Post not found`, and an older atomic-execute harness manually pre-inserts
  JTI state rather than replaying a captured production request end to end.
- A repository-wide search did not show skipped or todo security tests that
  hide failing cases, but the larger gap is that many known attacker cases do
  not exist yet.
- The S11 subagent independently confirmed the raw `asCaller` fallback,
  process-env key leak, excluded example 03 route test, unsafe source-policy
  tests, weak destructive replay assertions, and partial public-surface export
  assertions.
- The second-pass S11 subagent additionally confirmed stale-session route
  protection test gaps, forced-refresh token-cache tests that lock in current
  behavior, a DELETE-body auth proxy harness gap, and that local `pnpm check`
  is narrower than the full auth/security test surface.
- A second-pass source probe enumerated example server-route tests and config
  includes. It confirmed example 03 has
  `server/api/webhook.post.test.ts` but `includesServer=false`, while examples
  04 and 07 include their server-route tests.
- A second-pass Nuxt runner probe confirmed the root Nuxt project currently
  fails before collecting even one auth runtime test because `@nuxt/test-utils`
  resolves to a stale external `ginko-cms` workspace path. This means frontend
  auth/session regressions cannot be verified through the Nuxt project in the
  current environment.
- A search for `it.skip`, `test.skip`, `describe.skip`, `it.todo`,
  `test.todo`, and `.only(` under tests, examples, harness, and starter
  fixtures found no hidden skipped/todo/only security tests. The gap remains
  absent attacker tests and broken collection, not intentionally skipped tests.

Open review questions:

- Should `createTestContext()` ever read or mutate process env after
  construction, or should every trust key be explicit and instance-local?
- Should example packages be forbidden from containing test files that their
  local Vitest config does not include?
- Should source-policy tests be expressed primarily as deny-lists for unsafe
  production-copyable snippets after fixes, instead of positive checks that
  preserve current patterns?
- Should there be a shared attacker harness for captured signed requests,
  tenant-crossing handler code, MCP session theft, and webhook replay so each
  fix gets a direct negative test?
- Should Nuxt auth runtime tests be split so a small session-lifecycle smoke
  suite is always runnable even if full Nuxt environment setup regresses?
- Should `pnpm check` include a focused auth/security suite so contributors do
  not need to know the exact list of high-risk tests manually?

## Verification Log

| Date       | Command                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Result                                  | Notes                                                                                                                                                                                                                                                                                                                                                                                         |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ----------- | --------------- | ----------------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------ |
| 2026-06-04 | `pnpm exec vitest run --project=unit tests/unit/auth-proxy-handler.server.test.ts tests/unit/auth-proxy-security.test.ts tests/unit/auth-proxy-redirects.test.ts tests/unit/owasp.test.ts tests/unit/identity-forwarding.test.ts tests/unit/server-boundaries.test.ts tests/unit/mcp-confirmation-token.test.ts tests/unit/destructive-confirmation.test.ts tests/unit/mcp-auth-middleware.test.ts`                                                             | Passed: 9 files, 100 tests              | Auth/security-focused baseline from first review                                                                                                                                                                                                                                                                                                                                              |
| 2026-06-04 | `pnpm --dir examples/06-multi-workspace exec vitest run convex/agency.test.ts`                                                                                                                                                                                                                                                                                                                                                                                  | Passed: 1 file, 5 tests                 | Does not cover seed denial; current evidence is insufficient                                                                                                                                                                                                                                                                                                                                  |
| 2026-06-04 | `pnpm --dir examples/07-mcp-reference exec vitest run test/mcpReference.test.ts server/api/runbook-webhook.post.test.ts`                                                                                                                                                                                                                                                                                                                                        | Passed: 2 files, 16 tests               | Existing tests accept shared-secret webhook model                                                                                                                                                                                                                                                                                                                                             |
| 2026-06-04 | `pnpm --dir examples/08-component-mini-cms exec vitest run test/componentMiniCms.test.ts`                                                                                                                                                                                                                                                                                                                                                                       | Passed: 1 file, 10 tests                | Existing tests do not reject static bearer model                                                                                                                                                                                                                                                                                                                                              |
| 2026-06-04 | `pnpm exec vitest run --project=unit tests/unit/server-convex-utils.test.ts tests/unit/functions-defineTrellis.test.ts tests/unit/define-convex-tool.test.ts`                                                                                                                                                                                                                                                                                                   | Passed: 3 files, 85 tests               | Useful baseline for forwarding/functions/MCP                                                                                                                                                                                                                                                                                                                                                  |
| 2026-06-04 | `pnpm exec vitest run --project=unit tests/unit/example-webhook-security.test.ts tests/unit/mcp-invalid-bearer-throttle.test.ts tests/unit/server-index-exports.test.ts`                                                                                                                                                                                                                                                                                        | Passed: 3 files, 14 tests               | Current webhook test asserts shared-secret helper, so it must change                                                                                                                                                                                                                                                                                                                          |
| 2026-06-04 | `pnpm exec vitest run --project=unit tests/unit/auth-primitives.test.ts tests/unit/auth-access-context.test.ts tests/unit/functions-defineHandler.test.ts tests/unit/functions-defineTrellis.test.ts tests/unit/functions-isolation.test.ts tests/unit/eslint-plugin.test.ts tests/unit/tenant-analysis-validation.test.ts`                                                                                                                                     | Passed: 7 files, 92 tests               | Baseline does not cover async guard fail-open, protected+open drift, raw DB symbol discovery, or duplicate permission keys                                                                                                                                                                                                                                                                    |
| 2026-06-04 | `pnpm --dir examples/03-team-workspace exec vitest run convex/todos.test.ts`                                                                                                                                                                                                                                                                                                                                                                                    | Passed: 1 file, 9 tests                 | Team workspace baseline                                                                                                                                                                                                                                                                                                                                                                       |
| 2026-06-04 | `pnpm --dir examples/04-saas-platform exec vitest run convex/projectBoard.test.ts`                                                                                                                                                                                                                                                                                                                                                                              | Passed: 1 file, 11 tests                | SaaS platform baseline                                                                                                                                                                                                                                                                                                                                                                        |
| 2026-06-04 | `pnpm --dir examples/05-visibility-access exec vitest run convex/knowledgeBase.test.ts`                                                                                                                                                                                                                                                                                                                                                                         | Passed: 1 file, 20 tests                | Does not cover cross-workspace enrollment by email                                                                                                                                                                                                                                                                                                                                            |
| 2026-06-04 | `pnpm --dir examples/06-multi-workspace exec vitest run convex/agency.test.ts`                                                                                                                                                                                                                                                                                                                                                                                  | Passed: 1 file, 5 tests                 | Still does not cover seed denial                                                                                                                                                                                                                                                                                                                                                              |
| 2026-06-04 | `node -e "const jiti = require('jiti')(process.cwd() + '/review-probe.js'); ..."`                                                                                                                                                                                                                                                                                                                                                                               | Probe confirmed                         | `async guard can= true`; `duplicate projected can= true`                                                                                                                                                                                                                                                                                                                                      |
| 2026-06-04 | `node -e "const jiti = require('jiti')(process.cwd() + '/review-probe.js'); ..."`                                                                                                                                                                                                                                                                                                                                                                               | Probe confirmed                         | Runtime accepted `purpose: 'query'` envelope for mutation function ref when only `expectedFunctionRef` was supplied                                                                                                                                                                                                                                                                           |
| 2026-06-04 | `pnpm exec vitest run --project=unit tests/unit/identity-forwarding-envelope.test.ts tests/unit/identity-forwarding.test.ts tests/unit/server-convex-utils.test.ts tests/unit/server-index-exports.test.ts tests/unit/mcp-convex-caller.test.ts tests/unit/functions-defineTrellis.test.ts`                                                                                                                                                                     | Passed: 6 files, 104 tests              | Baseline covers many envelope checks but not runtime purpose enforcement                                                                                                                                                                                                                                                                                                                      |
| 2026-06-04 | `pnpm --dir examples/07-mcp-reference exec vitest run test/mcpReference.test.ts server/api/runbook-webhook.post.test.ts`                                                                                                                                                                                                                                                                                                                                        | Passed: 2 files, 16 tests               | Does not cover duplicate webhook delivery/idempotency                                                                                                                                                                                                                                                                                                                                         |
| 2026-06-04 | S4 forwarding subagent                                                                                                                                                                                                                                                                                                                                                                                                                                          | Completed                               | Reported targeted forwarding/MCP tests passed: 5 files, 96 tests; component Mini CMS test passed: 1 file, 10 tests                                                                                                                                                                                                                                                                            |
| 2026-06-04 | S5 MCP subagent                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Completed                               | Reported MCP session/bearer binding, tool-local safety stamping, backend error leakage, and process-local invalid-bearer throttle findings                                                                                                                                                                                                                                                    |
| 2026-06-04 | `pnpm exec vitest run --project=unit tests/unit/define-convex-tool.test.ts tests/unit/mcp-convex-caller.test.ts tests/unit/mcp-operation-binding.test.ts tests/unit/mcp-confirmation-token.test.ts tests/unit/destructive-confirmation.test.ts tests/unit/mcp-invalid-bearer-throttle.test.ts tests/unit/use-mcp-session.test.ts tests/unit/mcp-index-exports.test.ts tests/unit/cli-doctor.test.ts`                                                            | Passed: 9 files, 127 tests              | MCP runtime/doctor baseline; current tests do not cover F-AUTH-18 through F-AUTH-23                                                                                                                                                                                                                                                                                                           |
| 2026-06-04 | `pnpm --dir examples/07-mcp-reference exec vitest run test/mcpReference.test.ts server/api/runbook-webhook.post.test.ts`                                                                                                                                                                                                                                                                                                                                        | Passed: 2 files, 16 tests               | MCP reference baseline; does not cover session hijack or duplicate webhook delivery                                                                                                                                                                                                                                                                                                           |
| 2026-06-04 | `pnpm --dir examples/08-component-mini-cms exec vitest run test/componentMiniCms.test.ts`                                                                                                                                                                                                                                                                                                                                                                       | Passed: 1 file, 10 tests                | Mini CMS baseline; still accepts static bearer model                                                                                                                                                                                                                                                                                                                                          |
| 2026-06-04 | `git diff --check`                                                                                                                                                                                                                                                                                                                                                                                                                                              | Passed                                  | Markdown edits have no whitespace errors                                                                                                                                                                                                                                                                                                                                                      |
| 2026-06-04 | S6 destructive-operation subagent                                                                                                                                                                                                                                                                                                                                                                                                                               | Completed                               | Confirmed F-AUTH-24 and F-AUTH-25; added starter direct-delete and broken UI execute-flow findings                                                                                                                                                                                                                                                                                            |
| 2026-06-04 | `pnpm exec vitest run --project=unit tests/unit/destructive-confirmation.test.ts tests/unit/define-convex-tool.test.ts tests/unit/functions-defineTrellis.test.ts tests/unit/server-convex-utils.test.ts tests/unit/mcp-confirmation-token.test.ts tests/unit/mcp-operation-binding.test.ts`                                                                                                                                                                    | Passed: 6 files, 101 tests              | Destructive-operation baseline; current tests do not cover backend replay of a captured transport operation-execute request or transport durable audit                                                                                                                                                                                                                                        |
| 2026-06-04 | `pnpm --dir examples/04-saas-platform exec vitest run convex/projectBoard.test.ts`                                                                                                                                                                                                                                                                                                                                                                              | Passed: 1 file, 11 tests                | Backend-confirmed destructive examples baseline                                                                                                                                                                                                                                                                                                                                               |
| 2026-06-04 | `pnpm --dir examples/07-mcp-reference exec vitest run test/mcpReference.test.ts`                                                                                                                                                                                                                                                                                                                                                                                | Passed: 1 file, 10 tests                | MCP destructive operation baseline; does not cover captured backend execute replay                                                                                                                                                                                                                                                                                                            |
| 2026-06-04 | `pnpm --dir examples/08-component-mini-cms exec vitest run test/componentMiniCms.test.ts`                                                                                                                                                                                                                                                                                                                                                                       | Passed: 1 file, 10 tests                | Transport/action-backed destructive baseline; does not assert durable transport audit                                                                                                                                                                                                                                                                                                         |
| 2026-06-04 | `pnpm --dir examples/01-public-todo exec vitest run convex/todos.test.ts`                                                                                                                                                                                                                                                                                                                                                                                       | Passed: 1 file, 1 test                  | Current tiny example still uses direct delete mutation                                                                                                                                                                                                                                                                                                                                        |
| 2026-06-04 | `pnpm --dir examples/02-auth-todo exec vitest run convex/todos.test.ts`                                                                                                                                                                                                                                                                                                                                                                                         | Passed: 1 file, 1 test                  | Current tiny auth example still uses direct delete mutation                                                                                                                                                                                                                                                                                                                                   |
| 2026-06-04 | `pnpm --dir examples/03-team-workspace exec vitest run convex/todos.test.ts server/api/webhook.post.test.ts`                                                                                                                                                                                                                                                                                                                                                    | Passed: 1 file, 9 tests                 | Vitest config only includes `convex/**/*.test.ts`; route test was not included                                                                                                                                                                                                                                                                                                                |
| 2026-06-04 | `pnpm --dir examples/03-team-workspace exec vitest run server/api/webhook.post.test.ts`                                                                                                                                                                                                                                                                                                                                                                         | Not run: no files matched               | Example config includes only `convex/**/*.test.ts`                                                                                                                                                                                                                                                                                                                                            |
| 2026-06-04 | S7 route-boundary subagent                                                                                                                                                                                                                                                                                                                                                                                                                                      | Completed                               | Confirmed shared-secret webhook route issue; added trusted docs snippet and blank webhook secret findings                                                                                                                                                                                                                                                                                     |
| 2026-06-04 | `pnpm exec vitest run --project=unit tests/unit/server-boundaries.test.ts tests/unit/example-webhook-security.test.ts tests/unit/auth-proxy-security.test.ts tests/unit/auth-proxy-handler.server.test.ts tests/unit/auth-proxy-redirects.test.ts`                                                                                                                                                                                                              | Passed: 5 files, 46 tests               | Route/helper/auth-proxy baseline; current tests still assert shared-secret webhook examples                                                                                                                                                                                                                                                                                                   |
| 2026-06-04 | `pnpm --dir examples/04-saas-platform exec vitest run server/api/webhook.post.test.ts`                                                                                                                                                                                                                                                                                                                                                                          | Passed: 1 file, 4 tests                 | Does not cover duplicate delivery/idempotency                                                                                                                                                                                                                                                                                                                                                 |
| 2026-06-04 | `pnpm --dir examples/07-mcp-reference exec vitest run server/api/runbook-webhook.post.test.ts`                                                                                                                                                                                                                                                                                                                                                                  | Passed: 1 file, 6 tests                 | Does not cover duplicate delivery/idempotency                                                                                                                                                                                                                                                                                                                                                 |
| 2026-06-04 | `pnpm --dir examples/03-team-workspace exec vitest run --config ../../vitest.config.ts server/api/webhook.post.test.ts`                                                                                                                                                                                                                                                                                                                                         | Not run: no files matched               | Root config include patterns also exclude this server/api test                                                                                                                                                                                                                                                                                                                                |
| 2026-06-04 | `pnpm --dir examples/03-team-workspace exec vitest run convex/todos.test.ts`                                                                                                                                                                                                                                                                                                                                                                                    | Passed: 1 file, 9 tests                 | Domain idempotency baseline for example 03 webhook                                                                                                                                                                                                                                                                                                                                            |
| 2026-06-04 | S8 docs/starters subagent                                                                                                                                                                                                                                                                                                                                                                                                                                       | Completed                               | Reported unconditional `actingFor` docs/starters, workspace starter re-onboarding, and public MCP key validation/touch findings                                                                                                                                                                                                                                                               |
| 2026-06-04 | `pnpm --dir examples/05-visibility-access exec vitest run convex/knowledgeBase.test.ts`                                                                                                                                                                                                                                                                                                                                                                         | Passed: 1 file, 20 tests                | Existing share-token tests cover happy path/revoke/wrong article, not draft/unpublished/prerequisite/future denial                                                                                                                                                                                                                                                                            |
| 2026-06-04 | `pnpm --dir examples/03-team-workspace exec vitest run convex/todos.test.ts`                                                                                                                                                                                                                                                                                                                                                                                    | Passed: 1 file, 9 tests                 | Existing tests do not cover public email resolver denial                                                                                                                                                                                                                                                                                                                                      |
| 2026-06-04 | `pnpm --dir examples/08-component-mini-cms exec vitest run test/componentMiniCms.test.ts`                                                                                                                                                                                                                                                                                                                                                                       | Passed: 1 file, 10 tests                | Existing tests do not cover UI preview-before-publish flow or static bearer replacement                                                                                                                                                                                                                                                                                                       |
| 2026-06-04 | `pnpm exec vitest run --project=unit tests/unit/phase0-starter-manifest.test.ts tests/unit/cli-doctor.test.ts`                                                                                                                                                                                                                                                                                                                                                  | Passed: 2 files, 65 tests               | Static baseline does not flag starter re-onboarding, unconditional actingFor, or public MCP validation/touch                                                                                                                                                                                                                                                                                  |
| 2026-06-04 | `node -e "const { ESLint } = require('eslint'); ... serverConvexAction(...)"`                                                                                                                                                                                                                                                                                                                                                                                   | Probe confirmed                         | `serverConvexAction:NO_MESSAGES`; explicit-auth lint ignores server actions                                                                                                                                                                                                                                                                                                                   |
| 2026-06-04 | S9 static-guardrail subagent                                                                                                                                                                                                                                                                                                                                                                                                                                    | Completed                               | Independently confirmed non-failing escape inventory, protected/open static gap, duplicate permission key codegen/doctor gap, MCP write-helper detection gaps, and docs/starter source-test gaps                                                                                                                                                                                              |
| 2026-06-04 | `pnpm exec vitest run --project=unit tests/unit/eslint-plugin.test.ts tests/unit/cli-doctor.test.ts tests/unit/tenant-analysis-validation.test.ts tests/unit/permissions-codegen.test.ts tests/unit/permission-metadata.test.ts tests/unit/examples-gallery-docs.test.ts tests/unit/example-webhook-security.test.ts tests/unit/mcp-auth-middleware.test.ts`                                                                                                    | Passed: 8 files, 93 tests               | Static/doctor/docs baseline; current tests still preserve or miss several S9 unsafe patterns                                                                                                                                                                                                                                                                                                  |
| 2026-06-04 | S10 package/API-surface subagent                                                                                                                                                                                                                                                                                                                                                                                                                                | Completed                               | Independently confirmed public MCP safety stamping, testing raw-caller fallback, backend forwarding primitive exports, shared-secret server helper exposure, and raw advanced MCP toolkit exports                                                                                                                                                                                             |
| 2026-06-04 | Scratch unit probe `tests/unit/s10-public-api-probe.test.ts`                                                                                                                                                                                                                                                                                                                                                                                                    | Probe confirmed, then removed           | Imported public runtime barrels and reproduced top-level MCP safety self-certification, `delegateToUser({ allow: true })`, server shared-secret helper exposure, backend raw forwarding exports, and advanced raw MCP helper exports                                                                                                                                                          |
| 2026-06-04 | `pnpm exec vitest run --project=unit tests/unit/package-subpath-exports.test.ts tests/unit/backend-index-exports.test.ts tests/unit/server-index-exports.test.ts tests/unit/mcp-index-exports.test.ts tests/unit/app-index-exports.test.ts tests/unit/functions-index-exports.test.ts tests/unit/api-surface-doc.test.ts tests/unit/module-auto-imports.test.ts tests/unit/server-boundaries.test.ts tests/unit/public-surface-inventory-script.test.ts`        | Passed: 10 files, 40 tests              | Public package/barrel/API-doc baseline; current tests still allow several risky public helpers                                                                                                                                                                                                                                                                                                |
| 2026-06-04 | `pnpm run test:types:public`                                                                                                                                                                                                                                                                                                                                                                                                                                    | Passed                                  | Public type-surface baseline; current type tests still accept MCP safety stamping and advanced raw MCP surfaces                                                                                                                                                                                                                                                                               |
| 2026-06-04 | S11 testing-infrastructure subagent                                                                                                                                                                                                                                                                                                                                                                                                                             | Completed                               | Independently confirmed raw `asCaller` fallback, process-env key leak, excluded example 03 route test, unsafe source-policy tests, weak destructive replay assertions, and partial public-surface assertions                                                                                                                                                                                  |
| 2026-06-04 | S1 auth lifecycle/proxy subagent                                                                                                                                                                                                                                                                                                                                                                                                                                | Completed                               | Independently confirmed raw Better Auth client drift, route protection stale-auth trust, sign-out order, token-provider cache semantics, DELETE body forwarding divergence, and positive auth-proxy/SSR-cache controls                                                                                                                                                                        |
| 2026-06-04 | Scratch unit probe `tests/unit/s1-auth-session-source-probe.test.ts`                                                                                                                                                                                                                                                                                                                                                                                            | Probe confirmed, then removed           | Source probe confirmed local unauthenticated commit occurs before upstream `client.signOut()` and no Better Auth session subscription primitives are wired through client transport/plugin                                                                                                                                                                                                    |
| 2026-06-04 | `pnpm exec vitest run --project=unit tests/unit/auth-client.test.ts tests/unit/plugin-client-refresh.test.ts tests/unit/auth-proxy-handler.server.test.ts tests/unit/auth-proxy-security.test.ts tests/unit/convex-cache-auth-token.test.ts`                                                                                                                                                                                                                    | Passed: 5 files, 43 tests               | S1 unit auth/proxy baseline; current tests still preserve local-first sign-out and token-provider cache behavior                                                                                                                                                                                                                                                                              |
| 2026-06-04 | `pnpm exec vitest run --project=nuxt tests/nuxt/auth-engine.nuxt.test.ts tests/nuxt/identity-continuity.nuxt.test.ts tests/nuxt/useConvexAuthInternal.nuxt.test.ts tests/nuxt/useConvexAuthFlow.nuxt.test.ts tests/nuxt/token-lifecycle.nuxt.test.ts`                                                                                                                                                                                                           | Failed before tests collected           | `@nuxt/test-utils` runtime entry resolved to stale `/Users/matthias/Git/workspace/ginko-cms/.../@nuxt/test-utils/dist/runtime/entry.mjs`; no Nuxt auth tests executed                                                                                                                                                                                                                         |
| 2026-06-04 | `pnpm exec vitest run --project=server tests/server/ssr-cache.server.test.ts tests/server/server-helpers-auth.server.test.ts`                                                                                                                                                                                                                                                                                                                                   | Passed: 2 files, 21 tests               | Server auth cache/helper baseline; cache-hit JWTs revalidate and rejected sessions clear cache                                                                                                                                                                                                                                                                                                |
| 2026-06-04 | S11 source probe for example server-route test inclusion                                                                                                                                                                                                                                                                                                                                                                                                        | Probe confirmed                         | Example 03 has `server/api/webhook.post.test.ts` with `includesServer=false`; examples 04 and 07 have server route tests with `includesServer=true`                                                                                                                                                                                                                                           |
| 2026-06-04 | `pnpm exec vitest run --project=nuxt tests/nuxt/auth-engine.nuxt.test.ts --reporter=verbose`                                                                                                                                                                                                                                                                                                                                                                    | Failed before tests collected           | `@nuxt/test-utils` resolved stale `/Users/matthias/Git/workspace/ginko-cms/.../dist/runtime/entry.mjs`; no Nuxt auth assertions executed                                                                                                                                                                                                                                                      |
| 2026-06-04 | `rg -n "it\\.skip                                                                                                                                                                                                                                                                                                                                                                                                                                               | describe\\.skip                         | test\\.skip                                                                                                                                                                                                                                                                                                                                                                                   | it\\.todo | test\\.todo | describe\\.todo | \\.only\\(" tests apps/harness examples src/cli/starter-fixtures` | No matches | No hidden skipped/todo/only tests found in searched test/example/starter trees |
| 2026-06-04 | `pnpm exec vitest run --project=unit tests/unit/testing.test.ts tests/unit/example-webhook-security.test.ts tests/unit/examples-gallery-docs.test.ts tests/unit/phase0-starter-manifest.test.ts tests/unit/phase0-workspace-mcp-fixture.test.ts tests/unit/public-surface-inventory-script.test.ts tests/unit/mcp-auth-middleware.test.ts tests/unit/mcp-index-exports.test.ts tests/unit/server-boundaries.test.ts tests/unit/package-subpath-exports.test.ts` | Passed: 10 files, 36 tests              | Testing/source-policy/public-surface baseline; current tests still preserve several unsafe auth patterns                                                                                                                                                                                                                                                                                      |
| 2026-06-04 | `pnpm --dir examples/03-team-workspace exec vitest run`                                                                                                                                                                                                                                                                                                                                                                                                         | Passed: 1 file, 9 tests                 | Normal example 03 gate runs only convex tests                                                                                                                                                                                                                                                                                                                                                 |
| 2026-06-04 | `pnpm --dir examples/03-team-workspace exec vitest run server/api/webhook.post.test.ts --reporter=verbose`                                                                                                                                                                                                                                                                                                                                                      | Failed: no files matched                | Confirms example 03 server route test is outside local include `convex/**/*.test.ts`                                                                                                                                                                                                                                                                                                          |
| 2026-06-04 | `pnpm exec vitest run --project=convex apps/harness/convex/testingPackage.test.ts -t "forwards principals" --reporter=verbose`                                                                                                                                                                                                                                                                                                                                  | Failed as expected: 1 failed, 1 skipped | Selected `asCaller` test requires explicit key/env and fails without previous test mutation                                                                                                                                                                                                                                                                                                   |
| 2026-06-04 | `pnpm exec vitest run --project=convex apps/harness/convex/testingPackage.test.ts`                                                                                                                                                                                                                                                                                                                                                                              | Passed: 1 file, 2 tests                 | Full file passes because earlier test provides process-env state for later selected test                                                                                                                                                                                                                                                                                                      |
| 2026-06-04 | `pnpm --dir examples/07-mcp-reference exec vitest run`                                                                                                                                                                                                                                                                                                                                                                                                          | Passed: 3 files, 19 tests               | Example 07 local gate includes server/api route test                                                                                                                                                                                                                                                                                                                                          |
| 2026-06-04 | `pnpm --dir examples/04-saas-platform exec vitest run`                                                                                                                                                                                                                                                                                                                                                                                                          | Passed: 2 files, 15 tests               | Example 04 local gate includes server route test                                                                                                                                                                                                                                                                                                                                              |
| 2026-06-04 | `pnpm exec vitest run --project=convex apps/harness/convex/testingPackage.test.ts -t "forwards principals"`                                                                                                                                                                                                                                                                                                                                                     | Failed as expected: 1 failed, 1 skipped | Proves `asCaller` test depends on previous test mutating `CONVEX_IDENTITY_FORWARDING_KEY`                                                                                                                                                                                                                                                                                                     |
| 2026-06-04 | `pnpm exec vitest run --project=convex apps/harness/convex/testingPackage.test.ts`                                                                                                                                                                                                                                                                                                                                                                              | Passed: 1 file, 2 tests                 | Full file passes because earlier test sets process env for later `asCaller` test                                                                                                                                                                                                                                                                                                              |
| 2026-06-04 | `pnpm --dir examples/03-team-workspace exec vitest run server/api/webhook.post.test.ts --reporter=verbose`                                                                                                                                                                                                                                                                                                                                                      | Not run: no files matched               | Example 03 config includes only `convex/**/*.test.ts`, so server route test is outside the normal example gate                                                                                                                                                                                                                                                                                |
| 2026-06-04 | P0 raw DB symbol probe                                                                                                                                                                                                                                                                                                                                                                                                                                          | Probe confirmed                         | Normal cross-tenant `posts.get` was denied, but a dynamic protected handler recovered `Symbol(trellisUnsafeDb)`, read the foreign post, and patched it through raw DB                                                                                                                                                                                                                         |
| 2026-06-04 | P0 service raw DB symbol probe                                                                                                                                                                                                                                                                                                                                                                                                                                  | Probe confirmed                         | Service caller table allow-list denied `comments` through normal DB, but raw symbol recovery read `comments` anyway                                                                                                                                                                                                                                                                           |
| 2026-06-04 | P0 tenant-boundary subagent                                                                                                                                                                                                                                                                                                                                                                                                                                     | Completed                               | Independently confirmed handler-visible raw DB symbol, normal-handler `escapeIsolation` exposure, and missing raw DB/escape-gating tests                                                                                                                                                                                                                                                      |
| 2026-06-04 | `pnpm exec vitest run --project=convex apps/harness/convex/crossTenant.test.ts apps/harness/convex/posts.test.ts`                                                                                                                                                                                                                                                                                                                                               | Passed: 2 files, 28 tests               | Existing wrapped DB baseline; does not cover raw symbol recovery                                                                                                                                                                                                                                                                                                                              |
| 2026-06-04 | `pnpm exec vitest run --project=unit tests/unit/functions-defineTrellis.test.ts tests/unit/functions-isolation.test.ts tests/unit/eslint-plugin.test.ts tests/unit/cli-doctor.test.ts`                                                                                                                                                                                                                                                                          | Passed: 4 files, 110 tests              | Runtime/static/doctor baseline; current static checks only inventory or reason-check escape sites                                                                                                                                                                                                                                                                                             |
| 2026-06-04 | `pnpm --dir examples/06-multi-workspace exec vitest run convex/agency.test.ts`                                                                                                                                                                                                                                                                                                                                                                                  | Passed: 1 file, 5 tests                 | Existing example baseline; still does not cover public seed denial or non-member switch denial                                                                                                                                                                                                                                                                                                |
| 2026-06-04 | Scratch unit probe `tests/unit/auth-review-permission-probe.test.ts`                                                                                                                                                                                                                                                                                                                                                                                            | Probe confirmed, then removed           | Reproduced `canAsyncFalse: true`, `canObjectTruthy: true`, `canComposedAsyncFalse: true`, `enforceAsyncFalsePassed: true`, `can(null, authRequired): true`, anonymous `guard: open` handler execution, anonymous `authorize: authRequired` execution, anonymous returned-async-guard authorize execution, duplicate projected `invoice.pay: true`, and async projected `invoice.refund: true` |
| 2026-06-04 | P0 permission-boundary subagent                                                                                                                                                                                                                                                                                                                                                                                                                                 | Completed                               | Independently confirmed async/truthy non-boolean guard fail-open, protected lanes accepting `open`, inert misplaced `authRequired`, duplicate permission key projection/codegen gaps, and permission-valued operation guard MCP metadata drift                                                                                                                                                |
| 2026-06-04 | `pnpm exec vitest run --project=unit tests/unit/functions-defineHandler.test.ts tests/unit/functions-defineTrellis.test.ts tests/unit/auth-primitives.test.ts tests/unit/auth-access-context.test.ts tests/unit/permissions-codegen.test.ts tests/unit/permission-metadata.test.ts tests/unit/operation-descriptor.test.ts tests/unit/define-convex-tool.test.ts tests/unit/eslint-plugin.test.ts`                                                              | Passed: 9 files, 124 tests              | Permission/MCP/static baseline; current tests do not cover second-pass attacker shapes                                                                                                                                                                                                                                                                                                        |
| 2026-06-04 | Scratch unit probe `tests/unit/destructive-transport-replay-probe.test.ts`                                                                                                                                                                                                                                                                                                                                                                                      | Probe confirmed, then removed           | Same signed operation-execute args called `transportMutation(...)` twice; output showed `executions: 2`, `confirmationRows: []`, and `auditRows: []`                                                                                                                                                                                                                                          |
| 2026-06-04 | P0 destructive-replay subagent                                                                                                                                                                                                                                                                                                                                                                                                                                  | Completed                               | Independently confirmed transport-confirmed destructive execute backend replay, missing backend audit/redemption state, and weak replay tests that prove MCP token replay or post-effect failure rather than captured backend replay                                                                                                                                                          |
| 2026-06-04 | `pnpm exec vitest run --project=unit tests/unit/destructive-confirmation.test.ts tests/unit/define-convex-tool.test.ts tests/unit/functions-defineTrellis.test.ts tests/unit/server-convex-utils.test.ts tests/unit/mcp-confirmation-token.test.ts tests/unit/mcp-operation-binding.test.ts`                                                                                                                                                                    | Passed: 6 files, 101 tests              | Destructive-operation baseline; still does not cover captured backend replay or transport durable audit rows                                                                                                                                                                                                                                                                                  |
| 2026-06-04 | `pnpm --dir examples/08-component-mini-cms exec vitest run test/componentMiniCms.test.ts`                                                                                                                                                                                                                                                                                                                                                                       | Passed: 1 file, 10 tests                | Mini CMS baseline; still does not assert action-backed transport execution durable audit/redemption                                                                                                                                                                                                                                                                                           |
| 2026-06-04 | Scratch unit probe `tests/unit/mcp-boundary-probe.test.ts`                                                                                                                                                                                                                                                                                                                                                                                                      | Probe confirmed, then removed           | No-permission direct mutation returned `enabledWithoutPermission: true`, executed with `mutationCalls: 1`, emitted `deniedEvents: 0`, accepted MCP-layer safety stamps, and exposed `secret=db-password table=private.users` in MCP error text and structured content                                                                                                                         |
| 2026-06-04 | Scratch unit probe `tests/unit/mcp-doctor-advanced-write-probe.test.ts`                                                                                                                                                                                                                                                                                                                                                                                         | Probe confirmed, then removed           | Advanced `defineTool(...)` file using imported `serverConvexMutation(...)` produced `findings: []` from `collectTrellisCliInventoryFacts(...)`                                                                                                                                                                                                                                                |
| 2026-06-04 | P1 MCP-boundary subagent                                                                                                                                                                                                                                                                                                                                                                                                                                        | Completed                               | Independently confirmed tool-local safety forging, direct mutation missing permissions, advanced server write helper bypass, session keyId binding gap, raw backend error exposure, process-local invalid bearer throttle, and Mini CMS operation permission drift                                                                                                                            |
| 2026-06-04 | `pnpm exec vitest run --project=unit tests/unit/define-convex-tool.test.ts tests/unit/mcp-convex-caller.test.ts tests/unit/mcp-operation-binding.test.ts tests/unit/mcp-confirmation-token.test.ts tests/unit/destructive-confirmation.test.ts tests/unit/mcp-invalid-bearer-throttle.test.ts tests/unit/use-mcp-session.test.ts tests/unit/mcp-index-exports.test.ts tests/unit/cli-doctor.test.ts`                                                            | Passed: 9 files, 127 tests              | MCP runtime/doctor baseline; current tests still preserve or miss the second-pass MCP attacker shapes                                                                                                                                                                                                                                                                                         |
| 2026-06-04 | Scratch unit probe `tests/unit/identity-forwarding-boundary-probe.test.ts`                                                                                                                                                                                                                                                                                                                                                                                      | Probe confirmed, then removed           | Same ordinary trusted mutation envelope executed twice (`executions: 1` then `executions: 2`); mutation handler also accepted a `purpose: 'query'` forwarding envelope                                                                                                                                                                                                                        |
| 2026-06-04 | P1 trusted-forwarding subagent                                                                                                                                                                                                                                                                                                                                                                                                                                  | Completed                               | Independently confirmed missing purpose enforcement, ordinary trusted write replay gap, MCP trusted calls using the server transport lane, and example 07 delegated webhook idempotency gap                                                                                                                                                                                                   |
| 2026-06-04 | `pnpm exec vitest run --project=unit tests/unit/identity-forwarding-envelope.test.ts tests/unit/identity-forwarding.test.ts tests/unit/server-convex-utils.test.ts tests/unit/server-index-exports.test.ts tests/unit/mcp-convex-caller.test.ts tests/unit/functions-defineTrellis.test.ts`                                                                                                                                                                     | Passed: 6 files, 104 tests              | Forwarding/server/MCP baseline; current tests still do not cover ordinary trusted write replay, purpose mismatch at handler ingress, or MCP/server transport separation                                                                                                                                                                                                                       |
| 2026-06-04 | `git diff --check`                                                                                                                                                                                                                                                                                                                                                                                                                                              | Passed                                  | Review artifact edits have no whitespace errors after S4 second pass                                                                                                                                                                                                                                                                                                                          |
| 2026-06-04 | Scratch unit probe `tests/unit/webhook-boundary-probe.test.ts`                                                                                                                                                                                                                                                                                                                                                                                                  | Probe confirmed, then removed           | Blank shared-secret and blank HMAC secrets validate; HMAC delivery id `evt_poisoned` was consumed before parse failure                                                                                                                                                                                                                                                                        |
| 2026-06-04 | P1 route/webhook-boundary subagent                                                                                                                                                                                                                                                                                                                                                                                                                              | Completed                               | Independently confirmed maintained shared-secret examples, duplicate delivery gaps in examples 04/07, HMAC parse-before-idempotency bug, blank-secret helpers, docs placeholder verifier gaps, and weaker route-helper mocks                                                                                                                                                                  |
| 2026-06-04 | `pnpm exec vitest run --project=unit tests/unit/server-boundaries.test.ts tests/unit/example-webhook-security.test.ts tests/unit/auth-proxy-security.test.ts tests/unit/auth-proxy-handler.server.test.ts tests/unit/auth-proxy-redirects.test.ts`                                                                                                                                                                                                              | Passed: 5 files, 46 tests               | Route/helper/auth-proxy baseline; current tests still accept shared-secret examples and do not cover S7 second-pass attacker shapes                                                                                                                                                                                                                                                           |
| 2026-06-04 | `pnpm --dir examples/04-saas-platform exec vitest run server/api/webhook.post.test.ts`                                                                                                                                                                                                                                                                                                                                                                          | Passed: 1 file, 4 tests                 | Example 04 route baseline; does not cover duplicate delivery or HMAC body/timestamp/delivery-id binding                                                                                                                                                                                                                                                                                       |
| 2026-06-04 | `pnpm --dir examples/07-mcp-reference exec vitest run server/api/runbook-webhook.post.test.ts`                                                                                                                                                                                                                                                                                                                                                                  | Passed: 1 file, 6 tests                 | Example 07 route baseline; mock helper still does not cover duplicate delivery, real helper semantics, or delegated replay                                                                                                                                                                                                                                                                    |
| 2026-06-04 | `git diff --check`                                                                                                                                                                                                                                                                                                                                                                                                                                              | Passed                                  | Review artifact edits have no whitespace errors after S7 second pass                                                                                                                                                                                                                                                                                                                          |
| 2026-06-04 | Scratch example probe `examples/03-team-workspace/convex/s8-public-email-probe.test.ts`                                                                                                                                                                                                                                                                                                                                                                         | Probe confirmed, then removed           | Anonymous raw query resolved `alpha-owner@example.test` through public `resolveMcpUserByEmailQuery` and returned the seeded internal user id                                                                                                                                                                                                                                                  |
| 2026-06-04 | Scratch example probe `examples/05-visibility-access/convex/s8-share-token-probe.test.ts`                                                                                                                                                                                                                                                                                                                                                                       | Probe confirmed, then removed           | Anonymous share-token query returned a draft article from an unpublished knowledge base                                                                                                                                                                                                                                                                                                       |
| 2026-06-04 | Scratch example probe `examples/07-mcp-reference/test/s8-reonboarding-probe.test.ts`                                                                                                                                                                                                                                                                                                                                                                            | Probe confirmed, then removed           | Same signed-in user created two workspaces; access context was rewritten to the second workspace with owner role                                                                                                                                                                                                                                                                              |
| 2026-06-04 | P1 examples/starters/docs subagent                                                                                                                                                                                                                                                                                                                                                                                                                              | Completed                               | Independently confirmed public email resolver, cross-workspace email enrollment, share-token readiness bypass, public agency seed, re-onboarding across examples/starters, public MCP validate/touch, unconditional `actingFor`, static Mini CMS bearer token, public direct-delete starter, docs trusted-route gap, and missing systematic source-policy suite                               |
| 2026-06-04 | `pnpm --dir examples/03-team-workspace exec vitest run convex/todos.test.ts`                                                                                                                                                                                                                                                                                                                                                                                    | Passed: 1 file, 9 tests                 | Example 03 baseline; current tests do not cover anonymous public email resolver denial                                                                                                                                                                                                                                                                                                        |
| 2026-06-04 | `pnpm --dir examples/05-visibility-access exec vitest run convex/knowledgeBase.test.ts`                                                                                                                                                                                                                                                                                                                                                                         | Passed: 1 file, 20 tests                | Example 05 baseline; current tests do not cover cross-workspace email enrollment denial or share-token draft/unpublished/prerequisite/future denial                                                                                                                                                                                                                                           |
| 2026-06-04 | `pnpm --dir examples/07-mcp-reference exec vitest run test/mcpReference.test.ts`                                                                                                                                                                                                                                                                                                                                                                                | Passed: 1 file, 10 tests                | Example 07 baseline; current tests still assert public MCP validate/touch and do not cover repeated workspace onboarding denial                                                                                                                                                                                                                                                               |
| 2026-06-04 | `pnpm --dir examples/08-component-mini-cms exec vitest run test/componentMiniCms.test.ts`                                                                                                                                                                                                                                                                                                                                                                       | Passed: 1 file, 10 tests                | Mini CMS baseline; current tests do not reject static bearer defaults or require canonical MCP key auth                                                                                                                                                                                                                                                                                       |
| 2026-06-04 | `pnpm --dir examples/06-multi-workspace exec vitest run convex/agency.test.ts`                                                                                                                                                                                                                                                                                                                                                                                  | Passed: 1 file, 5 tests                 | Multi-workspace baseline; current tests do not cover public seed denial for normal users                                                                                                                                                                                                                                                                                                      |
| 2026-06-04 | `pnpm --dir examples/01-public-todo exec vitest run convex/todos.test.ts`                                                                                                                                                                                                                                                                                                                                                                                       | Passed: 1 file, 1 test                  | Public todo baseline; current example still exposes public direct delete                                                                                                                                                                                                                                                                                                                      |
| 2026-06-04 | `pnpm --dir examples/02-auth-todo exec vitest run convex/todos.test.ts`                                                                                                                                                                                                                                                                                                                                                                                         | Passed: 1 file, 1 test                  | Auth todo baseline; current example still uses direct delete rather than destructive preview/confirm                                                                                                                                                                                                                                                                                          |
| 2026-06-04 | `pnpm exec vitest run --project=unit tests/unit/phase0-starter-manifest.test.ts tests/unit/cli-doctor.test.ts tests/unit/examples-gallery-docs.test.ts tests/unit/example-webhook-security.test.ts tests/unit/mcp-auth-middleware.test.ts`                                                                                                                                                                                                                      | Passed: 5 files, 75 tests               | Static/starter/docs baseline; current tests preserve or miss several S8 production-copyable unsafe patterns                                                                                                                                                                                                                                                                                   |
| 2026-06-04 | `git diff --check`                                                                                                                                                                                                                                                                                                                                                                                                                                              | Passed                                  | Review artifact edits have no whitespace errors after S8 second pass                                                                                                                                                                                                                                                                                                                          |
| 2026-06-04 | Scratch unit probe `tests/unit/s9-static-guardrail-probe.test.ts`                                                                                                                                                                                                                                                                                                                                                                                               | Probe confirmed, then removed           | Strict ESLint returned no messages for `query.protected({ guard: open })` and `serverConvexAction(...)` without auth; duplicate permission keys were accepted by codegen metadata; imported `serverConvexMutation(...)` inside advanced `defineTool(...)` produced no custom app-write misuse                                                                                                 |
| 2026-06-04 | P2 static-guardrail subagent                                                                                                                                                                                                                                                                                                                                                                                                                                    | Completed                               | Independently confirmed action explicit-auth lint gap, pass-status unsafe/escape inventory, public MCP validate/touch blessing, advanced MCP write-helper detection gaps, direct MCP mutation missing permission static gap, public tool-local safety stamping, duplicate permission key gap, and missing centralized trusted docs/source-policy denials                                      |
| 2026-06-04 | `pnpm exec vitest run --project=unit tests/unit/eslint-plugin.test.ts tests/unit/cli-doctor.test.ts tests/unit/permissions-codegen.test.ts tests/unit/permission-metadata.test.ts tests/unit/examples-gallery-docs.test.ts tests/unit/example-webhook-security.test.ts tests/unit/mcp-auth-middleware.test.ts tests/unit/public-surface-inventory-script.test.ts`                                                                                               | Passed: 8 files, 91 tests               | Static guardrail baseline; current tests still miss or preserve the S9 second-pass attacker shapes                                                                                                                                                                                                                                                                                            |
| 2026-06-04 | `git diff --check`                                                                                                                                                                                                                                                                                                                                                                                                                                              | Passed                                  | Review artifact edits have no whitespace errors after S9 second pass                                                                                                                                                                                                                                                                                                                          |

## Next Actions

1. Add attacker tests during the fix phase for raw DB symbol discovery, async
   guard denial, protected+open rejection, duplicate permission keys, and
   cross-workspace email enrollment denial.
2. Add MCP attacker tests for session/bearer mismatch, direct mutation without
   permission, tool-local safety stamping, advanced server write helper bypass,
   unexpected backend error redaction, distributed invalid-bearer budgets, and
   direct public key-validation/touch denial.
3. Add identity-forwarding attacker tests for ordinary trusted write replay,
   operation purpose mismatch, MCP/server transport separation, and delegated
   webhook duplicate delivery.
4. Add route/webhook attacker tests for HMAC body tampering, stale timestamps,
   duplicate delivery ids, blank secrets, parse-failure idempotency poisoning,
   trusted docs snippets without concrete verification gates, and route tests
   that mock away helper behavior.
5. Add destructive-operation attacker tests for captured transport
   operation-execute replay, transport audit rows, starter direct-delete denial,
   and UI preview-before-execute flows.
6. Add example/starter attacker tests for public email resolver denial,
   cross-workspace email enrollment denial, share-token readiness denial,
   starter re-onboarding denial, direct public MCP key validation/touch denial,
   public direct-delete removal, static bearer default rejection, and
   allowlisted `actingFor` delegation.
