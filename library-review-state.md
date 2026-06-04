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
| S5 | MCP runtime and tools | bearer auth, tool visibility vs backend denial, operation projection, rate limits, result leaks | Not started | Needs independent MCP-focused review |
| S6 | Destructive operation safety | preview-confirm-execute, token binding, replay, audit, transport/backend modes | Not started | Needs concurrency/replay review |
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

## Next Actions

1. Review S5 MCP runtime/tool execution, because S2 found operation
   permission projection drift.
2. Review S6 destructive operation safety after S5, because S4 depends on
   operation-execute replay/confirmation semantics.
3. Add attacker tests during the fix phase for raw DB symbol discovery, async
   guard denial, protected+open rejection, duplicate permission keys, and
   cross-workspace email enrollment denial.
