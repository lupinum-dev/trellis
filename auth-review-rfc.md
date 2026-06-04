# RFC: Auth Review Hardening Plan

Status: Draft
Date: 2026-06-04
Owner: Matthias
Review source: Trellis auth review using Pilcrow auth guidance

## Purpose

This RFC turns the auth review findings into a concrete hardening plan.

The goal is not to add more auth machinery. The goal is to remove unsafe demo
paths, make trusted transports replay-resistant, keep one source of truth for
auth state, and add invariant tests that prove the system fails closed.

## Decision Summary

Fix all reviewed issues with hard cutovers:

1. Delete or gate the public agency seed mutation.
2. Gate `ctx.db.escapeIsolation(...)` so normal public/protected handlers cannot
   silently become cross-tenant writers.
3. Replace replayable shared-secret webhook examples with timestamped HMAC
   verification and idempotency.
4. Add replay protection for trusted identity-forwarded mutation/action calls.
5. Subscribe Trellis auth state to Better Auth session changes.
6. Make sign-out only look complete after upstream session invalidation
   succeeds.
7. Replace Mini CMS static MCP token auth with the canonical hashed MCP key
   model or make it read-only/demo-only.
8. Add missing negative tests around tenant isolation, trusted forwarding,
   logout, webhooks, and MCP bearer auth.
9. Remove raw DB reachability from handler-visible `ctx.db`.
10. Make guard evaluation fail closed for async/non-boolean results.
11. Reject `guard: open` in protected lanes.
12. Restrict `authRequired` to the structured guard phase.
13. Fail hard on duplicate permission keys in projection/codegen/doctor.
14. Keep MCP operation permission metadata aligned with backend guards.
15. Block cross-workspace shared-user enrollment by email.
16. Enforce identity-forwarding envelope purpose at the runtime boundary.
17. Make the example 07 trusted webhook create idempotent.

## Non-Goals

- Do not add a second auth state store.
- Do not add generic auth provider adapters.
- Do not add compatibility paths for unsafe examples.
- Do not keep both shared-secret and HMAC webhook examples side by side.
- Do not make backend authorization depend on frontend route protection.
- Do not introduce database tables unless they are required for replay or
  idempotency and have clear cleanup/rebuild semantics.

## Findings To Fix

### F1: Public Agency Seed Mutation Grants Cross-Tenant Access

Current issue:

- `examples/06-multi-workspace/convex/features/workspaces/domain.ts`
  exports `seedAgencyPortfolioMutation` as `mutation.public`.
- The handler only requires an authenticated app identity.
- It calls `escapeIsolation`, creates multiple workspaces/projects, and grants
  the caller `agency_manager` memberships.

Risk:

Any authenticated user can call the backend function directly and grant
themselves cross-tenant agency access.

Decision:

Delete the public mutation from the maintained example unless the UI truly needs
runtime demo seeding. If seeding remains necessary, make it an explicit unsafe
admin-only path that requires an existing agency/admin role before any
cross-tenant write.

Acceptance criteria:

- A normal authenticated user cannot call the seed path.
- The example still has deterministic demo data through tests/fixtures or an
  explicitly privileged setup path.
- No public/protected function can grant a role across tenants without a backend
  authorization check.

### F2: `escapeIsolation` Is An Ungated Runtime Escape Hatch

Current issue:

- `ctx.db.escapeIsolation({ reason })` is available on decorated DB contexts.
- The only runtime requirement is a non-empty reason.
- The reason is observability, not authorization.

Risk:

Any future public/protected handler can bypass tenant isolation with a string
reason. F1 is the concrete failure mode.

Decision:

Do the smallest hardening cut:

- Keep `escapeIsolation` for legitimate cross-tenant reads/writes.
- Require explicit unsafe/reviewed intent for handlers that call it.
- Add static validation that fails public/protected handlers containing
  `escapeIsolation` unless they carry an explicit reviewed escape marker.

Preferred implementation:

- Use existing Trellis unsafe permit concepts instead of adding a new table or
  role system.
- Add or tighten ESLint/inventory checks so `escapeIsolation` use is reported as
  a release-blocking finding in normal handlers.

Acceptance criteria:

- F1 cannot compile/pass checks if implemented as a public mutation with
  `escapeIsolation`.
- Existing legitimate cross-tenant examples must either move to explicit unsafe
  lanes or have a reviewed marker and negative tests.
- `escapeIsolation` remains observable with reason strings.

### F3: Shared-Secret Webhooks Are Replayable

Current issue:

- `readSharedSecretWebhookBody` compares one request header to a static secret.
- Examples using `auth: 'trusted'` rely on that static header before forwarding
  service identity and sometimes `actingFor`.

Risk:

Anyone who captures the header once can replay old deliveries or send arbitrary
new bodies indefinitely.

Decision:

Use `readHmacVerifiedWebhookBody` for trusted webhook examples and docs.
Remove production-facing examples that use `readSharedSecretWebhookBody` before
identity forwarding.

Required HMAC shape:

- Signature binds raw body, timestamp, and delivery id.
- Timestamp tolerance defaults to five minutes.
- Delivery id idempotency is required for trusted mutation/action handoff.
- Signature comparison remains constant-time.

Acceptance criteria:

- Body changes invalidate the signature.
- Stale timestamps fail.
- Duplicate delivery ids fail.
- Trusted webhook examples no longer import `readSharedSecretWebhookBody`.

### F4: Trusted Identity-Forwarding Mutation/Action Replay

Current issue:

- Identity forwarding envelopes are signed and short-lived.
- JTI replay redemption only happens when a verifier passes `redeemJti`.
- Destructive `operation-execute` has extra checks, but ordinary trusted
  mutation/action calls are TTL-only.

Risk:

A captured trusted Convex request body can be replayed within the TTL to repeat
the same mutation/action as the forwarded service/user.

Decision:

Make replay-sensitive trusted writes provably idempotent or replay-resistant.

Simplest acceptable model:

- Queries remain signature + TTL only.
- Destructive/sensitive writes use `operation-execute` confirmation when that
  contract fits.
- Webhook/integration writes carry a provider delivery id or app event id and
  reject duplicates at the domain boundary.
- Only add a generic JTI redemption store if Trellis decides replay resistance
  is a framework-wide invariant for all trusted mutation/action forwarding.

Open design choice:

- Prefer app-owned idempotency for provider/webhook flows because it binds to
  the business event being retried.
- If a generic replay store is required, it must be narrow: `jti`, `expiresAt`,
  `purpose`, `functionRef`, and optional audit metadata. It must have cleanup
  behavior.

Acceptance criteria:

- Replaying the same trusted mutation/action envelope either fails or is
  idempotent for replay-sensitive write paths.
- Replaying the same trusted query envelope is still allowed only until expiry.
- Expired envelopes fail.
- Wrong function ref, purpose, transport, args hash, issuer, or audience fails.

### F5: Other-Tab Session Changes Do Not Invalidate Trellis Auth

Current issue:

- Trellis creates a Better Auth client and uses it for token exchange/sign-out.
- Trellis does not subscribe to Better Auth session broadcast/session-signal
  changes.
- A second tab can keep Trellis `convexToken`, `sessionUser`, and
  `isAuthenticated` until refresh or JWT expiry.

Risk:

After sign-out or remote revocation, an already-open tab can keep using a still
valid Convex JWT.

Decision:

Bridge Better Auth session notifications into the existing Trellis auth engine.
Do not create another auth store.

Behavior:

- On Better Auth session changed: force Trellis `refreshAuth`.
- If Better Auth reports no session or token exchange misses: call
  `invalidateAuth({ clearWasAuthenticated: true })`.
- On refresh failure: fail closed for auth state and expose the existing auth
  error.

Acceptance criteria:

- Sign-out in tab A invalidates Trellis auth in tab B.
- Remote/session revocation invalidates Trellis auth on notification.
- A session refresh keeps the same canonical Trellis state path.

### F6: Sign-Out Clears Local Auth Before Server Logout Succeeds

Current issue:

- `signOut()` commits local unauthenticated state before `client.signOut()`.
- If upstream logout fails, the HttpOnly Better Auth session may still be valid.
- SSR can rehydrate the user on the next request.

Risk:

The UI can present a completed logout while the server session still exists.

Decision:

Make completed sign-out mean upstream session invalidation succeeded.

Behavior:

- Start pending sign-out state.
- Call Better Auth sign-out.
- Invalidate Convex/Trellis local auth after upstream success.
- On upstream failure, keep or refresh the authenticated state and surface the
  error.

Acceptance criteria:

- Simulated Better Auth sign-out failure does not leave the UI in a completed
  logged-out state.
- Successful sign-out invalidates local Trellis auth and Convex auth.
- SSR after failed sign-out remains consistent with the real server session.

### F7: Mini CMS Static MCP Token

Current issue:

- `DEMO_MCP_TOKEN` is compared directly to the bearer token.
- The token is static, not hashed/revocable, not throttled, and not
  constant-time compared.

Risk:

A leaked token grants all Mini CMS agent permissions until env rotation.

Decision:

Prefer deleting the bespoke token path and reusing the canonical MCP key model
from the workspace MCP starter/example.

Fallback only if the example must stay tiny:

- Require strong token format/prefix/length.
- Compare fixed-length hashes with `timingSafeEqual`.
- Add invalid bearer throttling.
- Clearly keep write/publish MCP permissions disabled unless configured.

Acceptance criteria:

- Plain env token comparison is gone.
- Invalid bearer attempts are throttled.
- Stored bearer material is hashed or the example is read-only.

### F8: Missing Tenant Isolation Negative Tests

Current issue:

The multi-workspace tests prove a happy isolation read, but do not cover
write-side and escape regressions.

Decision:

Add invariant tests before/with fixes.

Required tests:

- Normal user cannot call agency seed.
- Foreign project `toggleStatus` is denied or not found.
- Foreign members list is denied or empty.
- Non-member workspace switch is denied.
- Unauthenticated mutation calls are denied.
- Any remaining cross-tenant escape path has a negative authorization test.

Acceptance criteria:

- Tests fail against the current seed issue.
- Tests pass after the fix.
- Removing `workspaceScope` or adding unauthorized `escapeIsolation` causes a
  test or static check failure.

### F9: Raw DB Is Discoverable From Handler-Visible `ctx.db`

Current issue:

- `decorateDb()` stores the raw unwrapped DB on `ctx.db` using
  `Symbol('trellisUnsafeDb')`.
- Non-exported symbols are still discoverable with
  `Object.getOwnPropertySymbols(ctx.db)`.
- App code can recover the raw DB without `escapeIsolation({ reason })`, without
  service restrictions, and without escape observability.

Risk:

A public/protected handler can bypass tenant RLS, service table restrictions,
and escape telemetry by enumerating symbols. A hostile direct Convex caller then
only needs an exported handler that accepts an ID.

Decision:

Do not attach raw DB to handler-visible DB objects.

Preferred implementation:

- Replace the symbol property with a module-private `WeakMap<object, rawDb>` or
  closure-owned raw DB access for destructive-confirmation internals.
- Remove `[trellisUnsafeDbKey]` from public runtime DB types.
- Keep `escapeIsolation({ reason })` observable and explicit for reviewed
  cross-tenant access.

Acceptance criteria:

- A handler cannot discover raw DB by enumerating `Object.getOwnPropertySymbols`
  on `ctx.db`.
- Service-restricted callers cannot recover unrestricted raw DB.
- Destructive confirmation preview/execute still works without storing raw DB on
  `ctx.db`.
- Foreign `get`, `patch`, and `delete` remain blocked through decorated DB.

### F10: Async Or Non-Boolean Guards Fail Open

Current issue:

- `runCheck()` returns any function result as `boolean`.
- `can()` coerces the result with `!!`.
- A guard like `defineGuard('x', async () => false)` returns a truthy Promise
  and allows access.

Risk:

Any JS consumer, `as any`, or accidental async guard can grant access while the
author believes the guard denies.

Decision:

Make guard evaluation fail closed unless the result is exactly `true` or
`false`.

Acceptance criteria:

- Async guard/check results are denied or rejected before access is allowed.
- Non-boolean guard/check results are denied or rejected.
- `can()`, `enforce()`, composed guards, access projection, and handler guard
  checks share the same fail-closed behavior.
- Tests cover `async () => false`, `Promise.resolve(true)`, object returns, and
  normal boolean guards.

### F11: Protected Lane Accepts `guard: open`

Current issue:

- `createProtectedLaneBuilder()` only checks that a `guard` property exists.
- `define-handler` intentionally skips enforcement for `open`.
- A handler can be stamped as protected while behaving like a public handler.

Risk:

Inventory, MCP exposure, and human review can treat the function as protected
while direct Convex calls are open.

Decision:

Reject `open` in `.protected` lanes. Open handlers must use `.public`.

Acceptance criteria:

- `query.protected({ guard: open, ... })`,
  `mutation.protected({ guard: open, ... })`, and protected action lanes throw
  during definition/build.
- `.public(...)` still injects `open`.
- Inventory/static checks flag any protected lane plus open guard drift.

### F12: `authRequired` Is Inert Outside The Guard Phase

Current issue:

- `authRequired` intentionally has `check: true`.
- The structured handler runtime only special-cases it when
  `definition.guard === authRequired`.
- Using it as `authorize: authRequired`, permission check input, or projection
  check allows instead of requiring auth/app identity.

Risk:

An open handler with `authorize: authRequired`, or a permission built from
`authRequired`, looks authenticated but executes for anonymous/direct callers.

Decision:

Make `authRequired` valid only as a handler `guard`, unless authorize is
explicitly special-cased to run the same `requireAuth` plus appIdentity check.

Acceptance criteria:

- `guard: open, authorize: authRequired` denies or fails definition.
- `definePermission({ check: authRequired })` is rejected or projects false.
- Type/lint/static checks discourage using `authRequired` outside
  `definition.guard`.

### F13: Duplicate Permission Keys Overwrite Projected Access

Current issue:

- `defineAccessContext()` builds `can` with `Object.fromEntries`.
- Duplicate permission keys silently collapse to the last value.
- Codegen renders duplicate keys without failing at the permission collection
  layer.

Risk:

A weaker later permission with the same key can make frontend/MCP projection say
`can["billing.manage"] === true` while backend handlers import/use a different
definition.

Decision:

Validate permission key uniqueness wherever permission sets are assembled.

Acceptance criteria:

- `defineAccessContext({ permissions })` throws on duplicate projected keys.
- Codegen/doctor fails on duplicate permission keys across included files.
- Existing `composeFeatures(...)` duplicate detection remains in place.
- Tests cover duplicate full permission definitions and duplicate
  projected/non-projected combinations.

### F14: MCP Operation Access Can Drift From Permission Guards

Current issue:

- `defineOperation()` only stamps `permissionKey` from explicit `permission`.
- A permission-valued `guard` without explicit `permission` remains backend
  protected but has no MCP permission metadata.
- `tool.operation()` treats missing permission metadata as allowed.

Risk:

MCP can expose or enable a tool that the backend later denies. This is not a
backend authorization bypass, but it creates permission projection drift and
weakens least-privilege UX for agents.

Decision:

Keep operation permission metadata aligned with backend guard semantics.

Preferred implementation:

- If `guard` is a permission definition and `permission` is omitted, derive
  `permissionKey` from `guard`.
- For ambiguous guards, require explicit `permission` when exposed through
  `tool.operation(...)`.

Acceptance criteria:

- `defineOperation({ guard: somePermission })` stamps `permissionKey`.
- MCP `tool.operation(...)` denies/does not enable when recordAccess lacks that
  key.
- Static checks flag operation permission/guard mismatches.

### F15: Shared Users Table Allows Cross-Tenant Enrollment By Email

Current issue:

- `examples/05-visibility-access` marks `users` as shared.
- `enrollKnowledgeBaseUserByEmailOp` globally looks up `users.by_email`.
- The handler inserts an `enrollments` row in the current workspace without
  checking that the matched user belongs to the same workspace.

Risk:

Alpha staff can enroll a Beta user into Alpha content by email. The lookup also
leaks whether a cross-tenant email exists.

Decision:

Do not create tenant-scoped rows that reference shared users unless membership
or workspace ownership is proven.

Acceptance criteria:

- Alpha owner cannot enroll Beta user by email.
- Same-workspace enrollment by email still works.
- Failed cross-workspace enrollment leaves no `enrollments` row.
- Error behavior avoids leaking cross-tenant email existence where practical.

### F16: Runtime Identity Forwarding Does Not Enforce Envelope Purpose

Current issue:

- `verifyIdentityForwardingEnvelope()` supports `expectedPurpose`.
- `createContextWithRuntime()` passes expected function ref and transport, but
  not expected purpose.
- `serverConvexMutation`/`serverConvexAction` allow
  `identityForwardingEnvelope.purpose` overrides.

Risk:

A mutation/action target can accept a signed envelope whose purpose is `query`
or another purpose, as long as function ref and args match. This weakens the
meaning of purpose-scoped TTLs and makes replay policy harder to reason about.

Decision:

Bind envelope purpose to the actual runtime operation/projection.

Preferred implementation:

- Plain query/mutation/action handlers pass expected purpose from the Convex
  operation type.
- Operation preview and operation execute pass expected purpose from projection
  metadata.
- Server helper callers cannot set a purpose that conflicts with the helper
  operation, except for internal operation preview/execute paths.

Acceptance criteria:

- A mutation rejects an otherwise valid envelope with `purpose: 'query'`.
- An action rejects `purpose: 'query'` and `purpose: 'mutation'`.
- Operation preview accepts only `operation-preview`.
- Operation execute accepts only `operation-execute`.
- Tests prove the current purpose-mismatch probe fails after the fix.

### F17: Example 07 Trusted Webhook Create Is Non-Idempotent

Current issue:

- `examples/07-mcp-reference/server/api/runbook-webhook.post.ts` verifies the
  route boundary and then calls the runbook create mutation with
  `auth: 'trusted'`.
- The webhook body has no required event id or delivery id.
- `createRunbookOp` inserts a new runbook unconditionally.
- Example 07 has destructive confirmation tables but no processed-event
  idempotency table like example 03.

Risk:

Replaying a previously valid delivery, or receiving a legitimate provider retry,
creates duplicate runbooks as the delegated user. This remains true even if the
transport signature is strengthened to HMAC, because the trusted write itself is
not idempotent.

Decision:

Use the existing example 03 pattern: require an event/delivery id and reject
duplicates before insert.

Acceptance criteria:

- The route rejects webhook bodies without an event/delivery id.
- The Convex mutation rejects a duplicate event id before inserting.
- Calling the trusted create path twice with the same event id creates one
  runbook.
- Static/inventory checks flag trusted webhook routes that perform writes
  without passing an idempotency key.

## Implementation Plan

### Phase 1: Remove Concrete Bypasses

1. Delete or gate `seedAgencyPortfolioMutation`.
2. Remove raw DB reachability from handler-visible `ctx.db`.
3. Add failing-then-passing negative tests for normal users and hostile handler
   behavior.
4. Replace trusted webhook examples with HMAC verification.
5. Replace Mini CMS MCP auth with canonical hashed MCP key auth, or make the
   example read-only.
6. Fix cross-workspace enrollment by email.
7. Add idempotency to the example 07 trusted webhook create path.

Verification:

```bash
pnpm --dir examples/06-multi-workspace test
pnpm --dir examples/05-visibility-access test
pnpm --dir examples/07-mcp-reference test
pnpm --dir examples/08-component-mini-cms test
pnpm exec vitest run --project=unit tests/unit/functions-isolation.test.ts tests/unit/functions-defineTrellis.test.ts tests/unit/server-boundaries.test.ts tests/unit/example-webhook-security.test.ts tests/unit/mcp-auth-middleware.test.ts
```

### Phase 2: Harden Runtime Boundaries

1. Add replay redemption for trusted mutation/action identity forwarding.
2. Make guard evaluation fail closed for async/non-boolean results.
3. Reject protected lanes that use `open`.
4. Restrict `authRequired` to the guard phase.
5. Add static/runtime guardrails for `escapeIsolation`.
6. Add duplicate permission key validation and MCP operation permission
   alignment.
7. Enforce identity-forwarding expected purpose at the runtime boundary.
8. Add or update doctor/inventory findings for unsafe escape sites.

Verification:

```bash
pnpm exec vitest run --project=unit tests/unit/auth-primitives.test.ts tests/unit/auth-access-context.test.ts tests/unit/functions-defineHandler.test.ts tests/unit/identity-forwarding.test.ts tests/unit/server-convex-utils.test.ts tests/unit/functions-defineTrellis.test.ts tests/unit/define-convex-tool.test.ts tests/unit/cli-doctor.test.ts
pnpm run lint:src:runtime:functions-mcp
pnpm run lint:src:runtime:rest
```

### Phase 3: Fix Browser Session Semantics

1. Subscribe to Better Auth session changes.
2. Make sign-out commit local unauthenticated state only after upstream session
   invalidation succeeds.
3. Add multi-tab/session-signal tests around invalidation.

Verification:

```bash
pnpm exec vitest run --project=unit tests/unit/auth-engine-state.test.ts tests/unit/plugin-client-refresh.test.ts tests/unit/plugin-client-token-cache.test.ts
pnpm exec vitest run --project=nuxt tests/nuxt/auth-engine.nuxt.test.ts tests/nuxt/useConvexAuthFlow.nuxt.test.ts
```

### Phase 4: Full Gate

Run the maintained release gate subset first, then the full gate before merge.

```bash
pnpm run format:check
pnpm run lint
pnpm run test:types
pnpm run test:contracts
pnpm run test
pnpm run release:verify
```

## Regression Strategy

Every fix needs at least one test that fails against the vulnerable behavior:

- Seed mutation: direct backend call by normal authenticated user is denied.
- Webhook: replayed or body-mutated delivery is denied.
- Identity forwarding: replayed trusted mutation/action JTI is denied.
- Trusted writes: replay-sensitive trusted mutation/action calls are idempotent
  or replay-denied.
- Auth session: Better Auth session notification invalidates Trellis state.
- Sign-out: upstream sign-out failure does not show completed logout.
- MCP bearer: invalid attempts throttle and plaintext compare is absent.
- Escape isolation: unauthorized public/protected escape use fails static checks.
- Raw DB symbol: no raw DB can be discovered from `ctx.db` symbols.
- Async guard: `async () => false` cannot allow access.
- Protected open: `guard: open` is rejected in protected lanes.
- `authRequired`: using it outside handler guard denies or fails definition.
- Duplicate permission keys: access projection/codegen/doctor fail hard.
- MCP operation drift: permission-valued guards project permission metadata.
- Shared users: cross-workspace email enrollment is denied without row writes.
- Identity forwarding purpose: mutation/action runtimes reject envelopes signed
  with the wrong purpose.
- Example 07 webhook: duplicate delivery id does not create a second runbook.

Do not rely on frontend route protection as proof. All acceptance tests must
exercise backend/runtime boundaries directly.

## Security Checklist Before Merge

- No second source of truth for auth state was added.
- No old unsafe seed or shared-secret trusted webhook path remains.
- No public/protected cross-tenant write exists without backend authorization.
- Trusted forwarded mutation/action calls are replay-resistant.
- Logout invalidates the server session before local auth is committed as
  logged out.
- MCP bearer auth uses the canonical key model or is intentionally read-only.
- Static checks catch new `escapeIsolation` sites.
- Runtime DB wrappers do not expose raw DB through symbols or public properties.
- Guard results are strictly boolean and fail closed otherwise.
- Protected lanes cannot carry `open` guards.
- Permission projection has no duplicate-key ambiguity.
- MCP operation visibility matches backend permission metadata.
- Shared-table references are tenant-validated before tenant-scoped writes.
- Identity-forwarding purpose is enforced by runtime operation/projection.
- Trusted webhook writes carry and enforce a delivery/event id.
- Tests prove denial paths, not only happy paths.

## Rollout Notes

Trellis is still treated as greenfield for these surfaces. Prefer hard cutovers:

- Delete unsafe examples instead of adding compatibility.
- Replace shared-secret webhook examples instead of documenting both.
- Reuse existing MCP key auth instead of maintaining a Mini CMS token variant.
- Reuse existing auth engine state instead of adding a Better Auth state mirror.

If a new replay/idempotency table is required, it must be justified by the
trusted forwarding replay requirement and must include cleanup semantics.
