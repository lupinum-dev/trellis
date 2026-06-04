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
18. Require explicit authorization intent for direct MCP mutation tools.
19. Extend doctor/static checks for standalone advanced MCP write helpers.
20. Bind MCP toolkit sessions to the bearer identity.
21. Move direct MCP write safety metadata out of MCP-layer tool files.
22. Redact unexpected backend exception messages in MCP responses.
23. Replace or flag process-local invalid-bearer throttling in MCP examples and
    starters.
24. Durably redeem or record transport operation-execute JTIs at the backend.
25. Write durable audit rows for transport-confirmed destructive executions.
26. Replace starter direct-delete examples with destructive operations or remove
    delete from the tiny starters.
27. Fix example UIs to preview destructive operations before execute.

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

### F18: Direct MCP Mutation Tools Can Omit Explicit Permissions

Current issue:

- `defineMcpApp().tool.mutation(...)` accepts no `permission`.
- `accessAllows(recordAccess, undefined)` returns true.
- Direct mutation safety validation proves bounded-write classification, but it
  does not prove who may call the write.

Risk:

A public or permissive backend mutation can be exposed as an MCP write without a
clear permission decision. Backend guards still run when present, but the MCP
surface no longer proves its own authorization intent.

Decision:

Require explicit authorization intent for direct MCP writes.

Preferred implementation:

- Direct `tool.mutation(...)` requires a permission by default.
- Reviewed public writes use an explicit unsafe/public-write permit with a
  reason.
- Sensitive/destructive/external writes remain operation-backed.

Acceptance criteria:

- A direct MCP mutation without `permission` fails definition-time validation
  unless it carries the reviewed public-write permit.
- The reference and starter MCP examples still compile with explicit
  permissions.
- Static inventory reports direct MCP writes without permission.

### F19: Advanced MCP Write Guardrail Misses Server Write Helpers

Current issue:

- Doctor detects standalone `defineTool(...)` handlers that call
  `ctx.mutation(...)` or `ctx.action(...)`.
- It does not detect imported `serverConvexMutation(...)` or
  `serverConvexAction(...)` calls from advanced MCP tool files.

Risk:

An advanced MCP tool can perform app writes outside the canonical
`defineMcpApp(...).tool.mutation(...)` or `tool.operation(...)` lanes while
passing the current static guardrail.

Decision:

Extend MCP inventory to detect server write helpers in standalone advanced tool
files.

Acceptance criteria:

- Doctor fails on advanced MCP tools that call `serverConvexMutation(...)` or
  `serverConvexAction(...)`.
- Existing allowed standalone advanced tools remain read/session-only unless
  they move writes to canonical MCP lanes.

### F20: MCP Sessions Are Not Bound To Bearer Identity

Current issue:

- Example 07 enables MCP sessions and dynamic per-session tools.
- `useMcpSession()` scopes storage by current caller and `mcp-session-id`.
- The underlying toolkit server session can still resume by session id; Trellis
  does not bind that session id to the bearer key/user/workspace before dynamic
  tools are listed or called.

Risk:

If an attacker obtains a victim `mcp-session-id` and has any valid MCP bearer,
the toolkit can resume the session identity while Trellis authenticates the
attacker's bearer. Dynamic session-local tools can leak previously registered
messages or behavior.

Decision:

Bind MCP session ids to the authenticated bearer identity.

Acceptance criteria:

- The first authenticated request for a session id records
  `keyId`/`userId`/`workspaceId` or a stable caller key.
- Later requests with the same session id and a different bearer identity fail
  before dynamic tools are listed or called.
- Dynamic tool callbacks verify the registering caller key when they expose
  captured session data.

### F21: Direct MCP Mutation Safety Can Be Forged In Tool Files

Current issue:

- `stampMcpToolSafety()` is exported from the main MCP surface.
- Reference/starter examples stamp generated refs directly inside
  `server/mcp/tools`.
- A tool author can classify any backend mutation as `bounded-write` in the MCP
  layer.

Risk:

The intended backend-owned safety invariant becomes review-advisory. A
sensitive write can be down-classified at the transport layer and avoid the
operation-backed preview/confirm path.

Decision:

Move direct write safety metadata to backend/codegen-owned descriptors, or make
all MCP writes operation-backed.

Acceptance criteria:

- `stampMcpToolSafety()` is not used in `server/mcp/**` examples/starters.
- Tool-local stamping cannot satisfy direct mutation safety validation.
- Doctor fails if MCP tool files stamp write safety locally.

### F22: Unexpected Backend Exception Messages Reach MCP Clients

Current issue:

- `toConvexError()` strips stack framing but preserves raw error messages.
- `wrapError()` returns that message in both MCP text content and structured
  error content.

Risk:

Unexpected backend errors can disclose internal details, identifiers, or secret
fragments to the MCP client/model.

Decision:

Expose raw messages only for safe, explicit categories/codes. Unexpected
`server`/`unknown` errors should return a generic message plus correlation or
request id while preserving raw details in observability/logs.

Acceptance criteria:

- A backend `Error("secret=...")` becomes a generic MCP error response.
- Explicit auth denial, validation, rate-limit, confirmation, and not-found
  messages remain useful.
- Observability still contains enough correlation data for debugging.

### F23: Invalid MCP Bearer Throttling Is Process-Local

Current issue:

- Reference and starter invalid-bearer throttles use a process-local `Map`.
- The throttle runs before Convex key validation, but each process has its own
  budget.

Risk:

Distributed invalid bearer attempts can still force Convex validation work up
to the per-process budget on every instance.

Decision:

For production MCP bearer auth, use a distributed invalid-bearer budget or make
doctor fail/warn when only process-local throttling is present.

Acceptance criteria:

- Two app instances sharing a store enforce one invalid-bearer budget.
- Production starter/reference configuration warns or fails without a
  distributed invalid-bearer store.
- High-entropy token generation remains the primary defense against guessing.

### F24: Transport Operation-Execute JTI Is Not Backend-Redeemed

Current issue:

- Transport-confirmed MCP destructive operations redeem the confirmation token
  in the MCP confirmation store before calling the backend execute ref.
- The backend receives a trusted `operation-execute` forwarding envelope with a
  JTI.
- Backend replay protection only checks the destructive confirmation table for
  a redeemed row with that JTI.
- Transport-mode JTIs are not inserted into that backend table, so the backend
  has no durable replay state for a captured execute request.

Risk:

If the trusted Convex operation-execute request body is captured, it can be
replayed within the identity-forwarding TTL without going back through the MCP
confirmation store. That bypasses the transport-layer redeemed-token check,
the preview re-run, and preview/version drift checks.

Decision:

Make destructive execute replay protection backend-owned.

Preferred implementation:

- Simplest hard cut: route destructive writes through backend confirmation
  whenever the backend can own the confirmation row.
- If transport confirmation remains, `transportMutation(...)` must durably
  redeem or insert the operation-execute JTI before handler execution, using
  the same destructive confirmation table or a clearly equivalent single source
  of truth.

Acceptance criteria:

- Replaying the same trusted `operation-execute` Convex request is denied even
  when it bypasses MCP transport code.
- The backend denies operation-execute envelopes whose JTI was already
  executed.
- Tests cover direct backend replay of a transport-confirmed execute request.
- The fix does not create separate, conflicting replay stores for the same
  operation.

### F25: Transport Destructive Executions Skip Durable Audit Rows

Current issue:

- Backend-confirmed destructive mutations insert rows into
  `destructiveAuditLog` after successful execution.
- `transportMutation(...)` executes the handler and emits
  `operation.execute.completed`, but it does not insert the configured audit
  table.
- Action-backed transport executions therefore rely on transient observability
  instead of durable destructive audit state.

Risk:

The most sensitive transport-confirmed destructive paths can execute without
the durable audit trail that backend-confirmed destructive mutations provide.

Decision:

Make durable audit a destructive-operation invariant, not a backend-mode-only
feature.

Acceptance criteria:

- Successful transport-confirmed destructive execution writes an audit row with
  operation id, JTI, caller key, scope key, args hash, preview hash, executedAt,
  and execute path.
- Action-backed transport executions either record a durable attempt and
  completion or require an explicit durable audit callback/store.
- Tests prove transport execution creates audit state and replay does not create
  a second audit row.

### F26: Starter Delete Examples Bypass Destructive Operation Primitives

Current issue:

- The public todo, auth todo, and public starter delete paths are plain
  `operation.mutation` handlers.
- They delete records directly without preview, confirmation, token binding,
  replay protection, or audit.

Risk:

These are small examples, but they are the first patterns users copy. They teach
that delete is a normal mutation even though later Trellis primitives treat
destructive work as preview-confirm-execute.

Decision:

Do not teach direct destructive deletes in maintained starter paths.

Acceptance criteria:

- Starter/example delete either uses `operation.destructive` plus `previewOf`
  and confirmation, or delete is removed from the tiny starter.
- Direct delete execution without `_confirmationToken` is rejected wherever the
  delete remains.
- Preview plus returned confirmation token succeeds.

### F27: Example UIs Execute Destructive Operations Without Preview Tokens

Current issue:

- Some example UIs call destructive execute mutations directly.
- The backend exposes preview functions and requires confirmation tokens, so the
  click path is broken and teaches the wrong workflow.

Risk:

This is not a backend bypass because missing tokens are rejected. The risk is
example drift: users copy a UI flow that cannot safely execute destructive
operations.

Decision:

Make example UIs follow the same preview-confirm-execute contract as the
backend.

Acceptance criteria:

- UI delete/publish/archive flows call preview first.
- The UI displays or otherwise handles preview summary/effects/blockers.
- Execute calls include the returned confirmation token.
- Component or integration tests cover the click path.

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
8. Replace direct-delete starter/example mutations with destructive
   preview-confirm-execute flows, or remove delete from the tiny starters.
9. Fix example UI delete/archive/publish flows to preview before execute.

Verification:

```bash
pnpm --dir examples/06-multi-workspace test
pnpm --dir examples/05-visibility-access test
pnpm --dir examples/07-mcp-reference test
pnpm --dir examples/08-component-mini-cms test
pnpm --dir examples/01-public-todo test
pnpm --dir examples/02-auth-todo test
pnpm --dir examples/03-team-workspace test
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
8. Require explicit permission or reviewed public-write intent for direct MCP
   mutations.
9. Move direct MCP write safety metadata to backend/codegen-owned refs or make
   the affected writes operation-backed.
10. Bind MCP sessions to bearer identity before dynamic tools are listed or
    called.
11. Durably redeem or record transport operation-execute JTIs at the backend
    before destructive handler execution.
12. Write durable audit rows for transport-confirmed destructive executions.
13. Redact unexpected backend exception messages in MCP responses.
14. Add or update doctor/inventory findings for unsafe escape sites, advanced
    MCP write helpers, tool-local safety stamping, direct MCP writes without
    permission, and process-local invalid-bearer throttling.

Verification:

```bash
pnpm exec vitest run --project=unit tests/unit/auth-primitives.test.ts tests/unit/auth-access-context.test.ts tests/unit/functions-defineHandler.test.ts tests/unit/identity-forwarding.test.ts tests/unit/server-convex-utils.test.ts tests/unit/functions-defineTrellis.test.ts tests/unit/define-convex-tool.test.ts tests/unit/destructive-confirmation.test.ts tests/unit/mcp-operation-binding.test.ts tests/unit/use-mcp-session.test.ts tests/unit/mcp-invalid-bearer-throttle.test.ts tests/unit/cli-doctor.test.ts
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
- Direct MCP mutation permission: write tools without permission or explicit
  public-write permit fail.
- Advanced MCP write guardrail: standalone advanced tools importing server
  mutation/action helpers fail doctor.
- MCP session binding: a second bearer cannot use the first bearer/session id
  pair to list/call dynamic session tools.
- MCP write safety: tool-local `stampMcpToolSafety()` cannot satisfy direct
  mutation safety.
- MCP backend errors: unexpected `Error("secret=...")` text is not returned to
  the MCP client.
- Invalid MCP bearer throttling: two runtime instances sharing a store enforce
  one invalid-attempt budget, and process-local-only production setup is
  flagged.
- Transport operation-execute replay: a captured backend execute request cannot
  run twice even when it bypasses the MCP confirmation store.
- Transport destructive audit: successful transport-confirmed execution writes
  durable audit state, and replay does not create a second audit row.
- Starter destructive deletes: direct delete without confirmation is rejected or
  no direct delete route exists.
- Example UI destructive flows: click path obtains preview confirmation before
  calling execute.
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
