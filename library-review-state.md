# Trellis Deep Library Review State

Status: Active
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

| ID | Section | Scope | Status | Review Notes |
| --- | --- | --- | --- | --- |
| S1 | Auth session and proxy | Better Auth bridge, auth proxy, SSR cache, route protection, logout/session lifecycle | Initial review done | Findings captured in `auth-review-rfc.md`; follow-up implementation pending |
| S2 | Permissions and protected handler pipeline | guards, permissions, access projection, `guard -> load -> authorize -> handler`, direct Convex calls | Initial detailed review done | Findings F-AUTH-10 through F-AUTH-14 recorded; fix RFC updated |
| S3 | Tenant isolation and escape hatches | `workspaceScope`, RLS wrappers, service scopes, `escapeIsolation`, static lint/doctor coverage | Initial detailed review done | Findings F-AUTH-05, F-AUTH-08, F-AUTH-09, F-AUTH-15 recorded; fix RFC updated |
| S4 | Trusted identity forwarding | signed envelopes, replay, `auth: 'trusted'`, `actingFor`, server/MCP/bridge forwarding | Initial detailed review done | Findings F-AUTH-04, F-AUTH-16, and F-AUTH-17 recorded; fix RFC updated |
| S5 | MCP runtime and tools | bearer auth, tool visibility vs backend denial, operation projection, rate limits, result leaks | Initial detailed review done | Findings F-AUTH-06, F-AUTH-14, and F-AUTH-18 through F-AUTH-23 recorded; fix RFC updated |
| S6 | Destructive operation safety | preview-confirm-execute, token binding, replay, audit, transport/backend modes | Initial detailed review done | Findings F-AUTH-24 through F-AUTH-27 recorded; subagent completed |
| S7 | Server routes and webhooks | H3 routes, webhook helpers, trusted route boundaries, body/signature/idempotency | Not started | Initial auth review found replayable examples |
| S8 | Examples, starters, and docs | generated fixtures, examples, docs, copied production patterns | Not started | High priority because examples become templates |
| S9 | Static guardrails | ESLint plugin, doctor, inventory, codegen/preflight checks | Not started | Must prove unsafe patterns fail before runtime |
| S10 | Package/public API surface | exports, unsafe helpers, bridge/server APIs, public docs alignment | Not started | Review after runtime surfaces |
| S11 | Testing infrastructure | test helpers, auth/identity mocks, example tests, missing negative tests | Not started | Review after key surfaces are mapped |

## Findings Ledger

| Finding | Severity | Section | Status | Evidence | Required Fix |
| --- | --- | --- | --- | --- | --- |
| F-AUTH-01: Public agency seed mutation grants cross-tenant access | High | S3/S8 | Open | `examples/06-multi-workspace/convex/features/workspaces/domain.ts` exports `seedAgencyPortfolioMutation` as `mutation.public`; handler grants `agency_manager` memberships after `escapeIsolation` | Delete public seed path or gate behind existing admin/agency authorization; add direct backend denial test |
| F-AUTH-02: Trusted webhook examples use replayable static shared secrets | High | S7/S8 | Open | `readSharedSecretWebhookBody` compares one header to secret; examples call trusted Convex mutations after that check | Replace trusted webhook examples with HMAC raw-body timestamp delivery-id verification and idempotency |
| F-AUTH-03: Other-tab Better Auth session changes do not invalidate Trellis auth | Medium | S1 | Open | Better Auth client is created but Trellis auth engine only registers manual refresh/invalidate hooks | Bridge Better Auth session signal into existing Trellis auth engine |
| F-AUTH-04: Trusted non-query identity-forwarding envelopes are replayable within TTL | Medium | S4 | Open | `verifyIdentityForwardingEnvelope` redeems JTI only when `redeemJti` is supplied; ordinary trusted mutation/action forwarding is TTL-only | Require trusted writes to be idempotent, JTI-redeemed, or routed through operation-execute confirmation |
| F-AUTH-05: `escapeIsolation` is available to normal handlers with only a reason string | Medium | S3/S9 | Open | `ctx.db.escapeIsolation({ reason })` returns cross-tenant DB; ESLint currently requires only non-empty reason | Permit/static-gate cross-tenant escapes in public/protected handlers |
| F-AUTH-06: Mini CMS MCP bearer token is static and directly compared | Medium | S5/S8 | Open | `examples/08-component-mini-cms/server/lib/mcp-auth.ts` compares `token !== configuredToken` | Reuse canonical hashed MCP key model or make example read-only |
| F-AUTH-07: Sign-out clears local auth before upstream logout succeeds | Low | S1 | Open | `signOut()` commits unauthenticated state before `client.signOut()` | Commit completed logout only after upstream session invalidation succeeds |
| F-AUTH-08: Tenant isolation tests miss write-side and escape regressions | Low | S3/S11 | Open | Existing multi-workspace tests cover list isolation but not foreign write/switch/seed denial | Add direct negative tests for foreign reads/writes, non-member switch, unauthenticated mutation, seed denial |
| F-AUTH-09: Raw unwrapped DB is discoverable from handler-visible `ctx.db` | Critical | S3 | Open | `decorateDb()` defines `Symbol(trellisUnsafeDb)` directly on `ctx.db`; app code can discover it with `Object.getOwnPropertySymbols(ctx.db)` | Remove raw DB from `ctx.db`; use module-private `WeakMap` or closure-owned raw DB access for internals |
| F-AUTH-10: Async or non-boolean guards fail open | High | S2 | Open | `runCheck()` returns any function result as `boolean`; probe showed `can(actor, defineGuard('x', async () => false)) === true` | Make guard evaluation fail closed unless result is exactly boolean; reject Promise-like guard/check results |
| F-AUTH-11: Protected lane accepts `guard: open` | High | S2 | Open | `createProtectedLaneBuilder()` only requires a `guard` property; `define-handler` skips enforcement for `open` | Reject `open` in `.protected` lanes; require `.public` for open handlers |
| F-AUTH-12: `authRequired` is accepted outside the guard phase and becomes inert | Medium | S2 | Open | `authRequired` has `check: true`; `normalizeAuthorize()` treats guards as check values and only special-cases `authRequired` in `definition.guard` | Reject `authRequired` outside handler `guard`, or special-case it in authorize/projection to require auth/appIdentity |
| F-AUTH-13: Duplicate permission keys overwrite projected access | Medium | S2/S9 | Open | `defineAccessContext()` builds `can` with `Object.fromEntries`; probe showed later duplicate `billing.manage` value wins | Validate duplicate permission keys in access context, feature composition/codegen, and doctor |
| F-AUTH-14: MCP operation access can drift from permission-valued guards | Medium | S5/S9 | Open | `defineOperation()` only stamps `permissionKey` from explicit `permission`, while `tool.operation()` allows when no permission metadata exists | Derive `permissionKey` from permission-valued guards or require explicit `permission` for MCP operation exposure |
| F-AUTH-15: Shared users table enables cross-tenant enrollment by email | Medium | S3/S8 | Open | `examples/05-visibility-access` marks `users` shared and `enrollKnowledgeBaseUserByEmailOp` inserts enrollment for globally looked-up email without `user.workspaceId` check | Deny cross-workspace users after lookup or query through workspace-bounded membership; add Alpha/Beta negative test |
| F-AUTH-16: Runtime identity forwarding does not enforce envelope purpose | Medium | S4 | Open | `verifyIdentityForwardingEnvelope()` supports `expectedPurpose`, but `createContextWithRuntime()` does not pass it; probe accepted a `purpose: 'query'` envelope for a mutation function ref | Pass expected purpose from the actual Convex operation/projection and reject per-call purpose overrides that do not match the helper operation |
| F-AUTH-17: Example 07 trusted webhook create is non-idempotent | Medium | S4/S8 | Open | `server/api/runbook-webhook.post.ts` forwards a trusted create without event/delivery id; `createRunbookOp` inserts unconditionally; no `processedEvents` table exists in example 07 | Require delivery/event id and reject duplicates before inserting, following the example 03 processed-events pattern |
| F-AUTH-18: Direct MCP mutation tools can omit explicit permissions | Medium | S5/S9 | Open | `accessAllows()` returns true when `permission` is undefined; `createDirectTool()` sets low-level `defineTool({ auth: 'none' })`; direct mutation safety validation checks bounded-write metadata but not authorization intent | Require `permission` for direct `tool.mutation(...)` unless an explicit reviewed public-write permit is supplied; add doctor/static checks and tests |
| F-AUTH-19: Doctor misses imported server write helpers inside advanced MCP tools | Medium | S5/S9 | Open | `findCustomMcpToolsWithAppWrites()` only matches `ctx.mutation(...)`/`ctx.action(...)` in `defineTool(...)` files, not `serverConvexMutation(...)` or `serverConvexAction(...)` imports | Extend inventory to detect server write helper imports/calls in standalone advanced MCP tools; keep app writes on `defineMcpApp(...).tool.*` lanes |
| F-AUTH-20: MCP toolkit sessions are not bound to bearer identity | Medium | S5/S8 | Open | `useMcpSession()` scopes storage by caller and `mcp-session-id`, but the toolkit server session itself can resume by session id before Trellis verifies that the bearer matches the original session owner; dynamic session tools only check current `mcpAuth` | Bind MCP session ids to `keyId`/`userId`/`workspaceId` before resume; dynamic tool callbacks should verify the registering caller key |
| F-AUTH-21: Direct MCP mutation safety can be forged in MCP-layer files | Medium | S5/S9 | Open | `stampMcpToolSafety()` is exported from `@lupinum/trellis/mcp`; examples and starter stamp generated refs inside `server/mcp/tools`, so tool-local code can classify any mutation as `bounded-write` | Move write safety metadata to backend/codegen-owned descriptors or make all writes operation-backed; fail if `stampMcpToolSafety()` appears under MCP tool files |
| F-AUTH-22: Unexpected backend exception messages are returned to MCP clients | Low/Medium | S5/S11 | Open | `toConvexError()` cleans stack framing but preserves raw error message; `wrapError()` puts the message in both model-visible text and structured content | Redact unexpected server/unknown errors to a generic message plus correlation id; preserve explicit auth/validation/denial messages |
| F-AUTH-23: Invalid MCP bearer throttling is process-local in examples/starters | Low/Medium | S5/S8/S9 | Open | `mcp-invalid-bearer-throttle.ts` stores attempts in a process-local `Map`; reference/starter middleware runs this before each Convex key validation query | Use a distributed invalid-bearer budget for production MCP bearer auth or make doctor warn/fail when only process-local throttling is present |
| F-AUTH-24: Transport-confirmed operation-execute replay is not durably redeemed at the backend | High | S6/S5 | Open | `defineMcpApp` redeems transport confirmation tokens in the MCP confirmation store before execute; backend `transportMutation` only requires an `operation-execute` envelope with a non-empty JTI; `assertNoOperationExecuteEnvelopeReplay()` only checks backend confirmation rows, but transport-mode JTIs are not recorded there | Make backend execution redeem or record transport operation-execute JTIs durably before handler execution, or use backend confirmation for all destructive writes |
| F-AUTH-25: Transport-confirmed destructive executions skip durable audit rows | Medium | S6/S11 | Open | Backend-confirmed destructive mutations insert `destructiveAuditLog`; `transportMutation(...)` only emits `operation.execute.completed` observation after handler success and never inserts the configured audit table | Record durable destructive audit rows for transport executions, including action-backed executions, or make transport mode require an explicit durable audit callback/store |
| F-AUTH-26: Starter delete examples bypass destructive operation primitives | Medium | S6/S8 | Open | `examples/01-public-todo`, `examples/02-auth-todo`, and `src/cli/starter-fixtures/public` define todo delete as plain `operation.mutation` and export direct mutation deletes | Convert copied starter delete patterns to `operation.destructive` with preview/confirmation, or remove deletes from tiny starters |
| F-AUTH-27: Some UI examples call destructive execute without preview tokens | Low | S6/S8 | Open | Team workspace and MCP reference UIs call `removeTodo({ id })` / `deleteRunbookMutation({ id })` directly even though backend exposes `previewRemove` and destructive `remove` | Update example UI flows to preview first, display effects/summary, then execute with returned confirmation token |

## Current Section Notes

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

Open review questions for the fix plan:

- Should `runCheck()` throw on invalid guard results or return false and
  observe a denial?
- Should async checks be banned by runtime only, lint/type checks, or both?
- Should operation `permissionKey` derivation happen in `defineOperation()` or
  MCP `tool.operation()` validation?
- Which generated/codegen surfaces need duplicate permission key validation
  beyond feature composition?

### S3: Tenant Isolation and Escape Hatches

Files inspected locally:

- `src/runtime/functions/index.ts`
- `src/eslint/rules/isolation.ts`
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
- The current public MCP surface exports `stampMcpToolSafety()`, and examples
  stamp refs directly from MCP tool files. That makes the safety declaration
  author-owned at the transport layer, not backend-owned.
- Low-level `defineTool` is intentionally under `mcp/advanced` and exposes only
  `ctx.query`; doctor has a guardrail for `ctx.mutation(...)`/`ctx.action(...)`
  in standalone advanced tools. The guardrail does not detect imported
  `serverConvexMutation(...)` or `serverConvexAction(...)` helpers.
- Example 07's canonical bearer path hashes `mcp_...` tokens before Convex
  validation, checks revocation/bound user/workspace, delegates permission
  checks to the bound user, and uses a Redis-backed tool rate-limit store.
- Example 08 Mini CMS still uses one configured bearer token and grants all
  write permissions to that agent, which remains F-AUTH-06.
- `useMcpSession()` scopes session storage by caller hash plus session id, but
  the underlying toolkit session id is not bound to the bearer identity before
  dynamic tools can be listed or called.
- MCP error wrapping avoids mirroring successful object results into the
  model-visible text channel by default. Unexpected backend errors still return
  the cleaned raw message to MCP clients.
- Reference/starter invalid-bearer throttles use a process-local `Map`, while
  per-tool rate limits have a first-party Redis store and production checks.

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
- Tests cover replaying a transport confirmation token through MCP, and cover
  backend rejection when a JTI is already marked redeemed in the backend table.
  They do not cover replaying the captured backend operation-execute request
  for a transport-confirmed operation.
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

## Verification Log

| Date | Command | Result | Notes |
| --- | --- | --- | --- |
| 2026-06-04 | `pnpm exec vitest run --project=unit tests/unit/auth-proxy-handler.server.test.ts tests/unit/auth-proxy-security.test.ts tests/unit/auth-proxy-redirects.test.ts tests/unit/owasp.test.ts tests/unit/identity-forwarding.test.ts tests/unit/server-boundaries.test.ts tests/unit/mcp-confirmation-token.test.ts tests/unit/destructive-confirmation.test.ts tests/unit/mcp-auth-middleware.test.ts` | Passed: 9 files, 100 tests | Auth/security-focused baseline from first review |
| 2026-06-04 | `pnpm --dir examples/06-multi-workspace exec vitest run convex/agency.test.ts` | Passed: 1 file, 5 tests | Does not cover seed denial; current evidence is insufficient |
| 2026-06-04 | `pnpm --dir examples/07-mcp-reference exec vitest run test/mcpReference.test.ts server/api/runbook-webhook.post.test.ts` | Passed: 2 files, 16 tests | Existing tests accept shared-secret webhook model |
| 2026-06-04 | `pnpm --dir examples/08-component-mini-cms exec vitest run test/componentMiniCms.test.ts` | Passed: 1 file, 10 tests | Existing tests do not reject static bearer model |
| 2026-06-04 | `pnpm exec vitest run --project=unit tests/unit/server-convex-utils.test.ts tests/unit/functions-defineTrellis.test.ts tests/unit/define-convex-tool.test.ts` | Passed: 3 files, 85 tests | Useful baseline for forwarding/functions/MCP |
| 2026-06-04 | `pnpm exec vitest run --project=unit tests/unit/example-webhook-security.test.ts tests/unit/mcp-invalid-bearer-throttle.test.ts tests/unit/server-index-exports.test.ts` | Passed: 3 files, 14 tests | Current webhook test asserts shared-secret helper, so it must change |
| 2026-06-04 | `pnpm exec vitest run --project=unit tests/unit/auth-primitives.test.ts tests/unit/auth-access-context.test.ts tests/unit/functions-defineHandler.test.ts tests/unit/functions-defineTrellis.test.ts tests/unit/functions-isolation.test.ts tests/unit/eslint-plugin.test.ts tests/unit/tenant-analysis-validation.test.ts` | Passed: 7 files, 92 tests | Baseline does not cover async guard fail-open, protected+open drift, raw DB symbol discovery, or duplicate permission keys |
| 2026-06-04 | `pnpm --dir examples/03-team-workspace exec vitest run convex/todos.test.ts` | Passed: 1 file, 9 tests | Team workspace baseline |
| 2026-06-04 | `pnpm --dir examples/04-saas-platform exec vitest run convex/projectBoard.test.ts` | Passed: 1 file, 11 tests | SaaS platform baseline |
| 2026-06-04 | `pnpm --dir examples/05-visibility-access exec vitest run convex/knowledgeBase.test.ts` | Passed: 1 file, 20 tests | Does not cover cross-workspace enrollment by email |
| 2026-06-04 | `pnpm --dir examples/06-multi-workspace exec vitest run convex/agency.test.ts` | Passed: 1 file, 5 tests | Still does not cover seed denial |
| 2026-06-04 | `node -e "const jiti = require('jiti')(process.cwd() + '/review-probe.js'); ..."` | Probe confirmed | `async guard can= true`; `duplicate projected can= true` |
| 2026-06-04 | `node -e "const jiti = require('jiti')(process.cwd() + '/review-probe.js'); ..."` | Probe confirmed | Runtime accepted `purpose: 'query'` envelope for mutation function ref when only `expectedFunctionRef` was supplied |
| 2026-06-04 | `pnpm exec vitest run --project=unit tests/unit/identity-forwarding-envelope.test.ts tests/unit/identity-forwarding.test.ts tests/unit/server-convex-utils.test.ts tests/unit/server-index-exports.test.ts tests/unit/mcp-convex-caller.test.ts tests/unit/functions-defineTrellis.test.ts` | Passed: 6 files, 104 tests | Baseline covers many envelope checks but not runtime purpose enforcement |
| 2026-06-04 | `pnpm --dir examples/07-mcp-reference exec vitest run test/mcpReference.test.ts server/api/runbook-webhook.post.test.ts` | Passed: 2 files, 16 tests | Does not cover duplicate webhook delivery/idempotency |
| 2026-06-04 | S4 forwarding subagent | Completed | Reported targeted forwarding/MCP tests passed: 5 files, 96 tests; component Mini CMS test passed: 1 file, 10 tests |
| 2026-06-04 | S5 MCP subagent | Completed | Reported MCP session/bearer binding, tool-local safety stamping, backend error leakage, and process-local invalid-bearer throttle findings |
| 2026-06-04 | `pnpm exec vitest run --project=unit tests/unit/define-convex-tool.test.ts tests/unit/mcp-convex-caller.test.ts tests/unit/mcp-operation-binding.test.ts tests/unit/mcp-confirmation-token.test.ts tests/unit/destructive-confirmation.test.ts tests/unit/mcp-invalid-bearer-throttle.test.ts tests/unit/use-mcp-session.test.ts tests/unit/mcp-index-exports.test.ts tests/unit/cli-doctor.test.ts` | Passed: 9 files, 127 tests | MCP runtime/doctor baseline; current tests do not cover F-AUTH-18 through F-AUTH-23 |
| 2026-06-04 | `pnpm --dir examples/07-mcp-reference exec vitest run test/mcpReference.test.ts server/api/runbook-webhook.post.test.ts` | Passed: 2 files, 16 tests | MCP reference baseline; does not cover session hijack or duplicate webhook delivery |
| 2026-06-04 | `pnpm --dir examples/08-component-mini-cms exec vitest run test/componentMiniCms.test.ts` | Passed: 1 file, 10 tests | Mini CMS baseline; still accepts static bearer model |
| 2026-06-04 | `git diff --check` | Passed | Markdown edits have no whitespace errors |

## Next Actions

1. Review S6 destructive operation safety, because S4 and S5 depend on
   operation-execute replay/confirmation semantics.
2. Review S7 server routes and webhooks, because F-AUTH-02 and F-AUTH-17 are
   trusted route/template issues.
3. Add attacker tests during the fix phase for raw DB symbol discovery, async
   guard denial, protected+open rejection, duplicate permission keys, and
   cross-workspace email enrollment denial.
4. Add MCP attacker tests for session/bearer mismatch, direct mutation without
   permission, tool-local safety stamping, advanced server write helper bypass,
   unexpected backend error redaction, and distributed invalid-bearer budgets.
