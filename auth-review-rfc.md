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
28. Make example 04 webhook task creation idempotent.
29. Move HMAC webhook idempotency consumption after successful parse/validation.
30. Fix trusted server-route docs snippets so they include concrete verification
    gates or use non-trusted auth.
31. Reject blank webhook secrets inside public webhook helpers.
32. Remove or server-gate the example 03 public MCP email resolver.
33. Restrict share-token access to published/available content, or make draft
    sharing an explicit capability.
34. Fix delegated `actingFor` docs so representation is allowlisted.
35. Enforce onboarding-only workspace creation in starters.
36. Move MCP key validation/touch behind server-only or internal boundaries.
37. Extend explicit-auth lint coverage to `serverConvexAction`.
38. Make doctor fail public MCP key validation/touch instead of blessing it as
    canonical bearer auth.
39. Promote unsafe/escape/destructive inventories to blocking findings unless
    explicitly reviewed.
40. Replace docs/starter source tests that preserve unsafe snippets with tests
    that fail those snippets.
41. Remove public MCP tool-local safety stamping.
42. Remove or isolate shared-secret webhook verification from the first-reader
    server surface.
43. Replace public `delegateToUser({ allow: true })` ergonomics with
    binding-backed delegation.
44. Remove raw identity-forwarding transport primitives from the backend barrel.
45. Make testing `asCaller(...)` fail closed instead of retrying raw caller args.
46. Stop Trellis-branded advanced MCP exports from bypassing Trellis-owned tool
    structure.
47. Include every example server-route test in that example's normal test gate.
48. Keep testing identity-forwarding keys instance-local instead of leaking them
    through process-wide env.
49. Make webhook route tests exercise real Trellis helpers instead of weaker
    local mocks.
50. Invert source/type/public-surface tests that currently preserve unsafe auth
    snippets and exports.
51. Make destructive replay tests prove replay redemption, not merely
    post-effect failure.
52. Split MCP trusted identity forwarding from the broader server transport
    lane, or delete the unused `mcp` forwarding transport if it is not a real
    security boundary.
53. Ensure raw Better Auth client session mutations synchronize Trellis auth
    state.
54. Keep session-authoritative refreshes from reusing recent Convex JWT cache.
55. Revalidate or invalidate stale auth before protected-route navigation.
56. Forward or explicitly reject auth proxy request bodies on DELETE-style
    endpoints.
57. Repair Nuxt runtime auth test collection so frontend auth/session fixes can
    be verified.
58. Add a focused auth/security test gate to local `pnpm check` or an
    equivalent blocking command.

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
- ESLint only requires the reason, and doctor currently reports cross-scope
  escapes as pass-status inventory.

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
- Maintained examples 03, 04, and 07 all still import
  `readSharedSecretWebhookBody`, and a source-policy test currently asserts
  that this helper is present in those examples.

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
- A direct runtime attacker test signs one trusted mutation/action envelope with
  a fixed JTI, invokes the handler twice with the exact same args, and proves
  the second call is denied before handler execution or is domain-idempotent.
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
  on `ctx.db`, `Reflect.ownKeys(ctx.db)`, property descriptors, or prototype
  traversal.
- Service-restricted callers cannot recover unrestricted raw DB.
- Direct attacker tests prove a foreign tenant cannot read, patch, replace, or
  delete through hidden DB references.
- Destructive confirmation preview/execute still works without storing raw DB on
  `ctx.db`.
- Foreign `get`, `patch`, and `delete` remain blocked through decorated DB.

### F10: Async Or Non-Boolean Guards Fail Open

Current issue:

- `runCheck()` returns any function result as `boolean`.
- `can()` coerces the result with `!!`.
- A guard like `defineGuard('x', async () => false)` returns a truthy Promise
  and allows access.
- Second-pass probes also showed truthy object returns, composed guards, and
  `enforce()` fail open in the same way.

Risk:

Any JS consumer, `as any`, or accidental async guard can grant access while the
author believes the guard denies.

Decision:

Make guard evaluation fail closed unless the result is exactly `true` or
`false`.

Implementation direction:

- Introduce one strict synchronous check evaluator and route `runCheck()`,
  `can()`, `enforce()`, guard composition, `explainCheck()`, structured handler
  guard checks, `authorize` guard returns, and `defineAccessContext()` through
  it.
- Treat Promise/thenable and non-boolean results as invalid check results. For
  access decisions, invalid means denied; for definition or developer-facing
  helpers, throwing a clear error is acceptable as long as no access is
  granted.
- Keep async resource loading in `load`/`authorize` callbacks, not inside guard
  predicates.

Acceptance criteria:

- Async guard/check results are denied or rejected before access is allowed.
- Non-boolean guard/check results are denied or rejected.
- `can()`, `enforce()`, composed guards, access projection, and handler guard
  checks share the same fail-closed behavior.
- Tests cover `async () => false`, `Promise.resolve(true)`, object returns, and
  normal boolean guards.
- A regression probe equivalent to the review probe must show all of these
  values denied or rejected: async false guard, truthy object guard, composed
  async false guard, `enforce(asyncFalse)`, and async permission projection.

### F11: Protected Lane Accepts `guard: open`

Current issue:

- `createProtectedLaneBuilder()` only checks that a `guard` property exists.
- `define-handler` intentionally skips enforcement for `open`.
- A handler can be stamped as protected while behaving like a public handler.
- Second-pass probes reached a handler as an anonymous caller with
  `appIdentity: null` when the handler used `guard: open`.

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
- The protected builder types no longer advertise `OpenGuard` as a valid guard
  for `.protected(...)` definitions.

### F12: `authRequired` Is Inert Outside The Guard Phase

Current issue:

- `authRequired` intentionally has `check: true`.
- The structured handler runtime only special-cases it when
  `definition.guard === authRequired`.
- Using it as `authorize: authRequired`, permission check input, or projection
  check allows instead of requiring auth/app identity.
- Second-pass probes showed `can(null, authRequired) === true` and
  `guard: open, authorize: authRequired` executed for an anonymous caller.

Risk:

An open handler with `authorize: authRequired`, or a permission built from
`authRequired`, looks authenticated but executes for anonymous/direct callers.

Decision:

Make `authRequired` valid only as a handler `guard`, unless authorize is
explicitly special-cased to run the same `requireAuth` plus appIdentity check.

Acceptance criteria:

- `guard: open, authorize: authRequired` denies or fails definition.
- `definePermission({ check: authRequired })` is rejected or projects false.
- `can(null, authRequired)` does not return true.
- Type/lint/static checks discourage using `authRequired` outside
  `definition.guard`.
- A returned `authRequired` guard from an authorize callback is also denied or
  rejected.

### F13: Duplicate Permission Keys Overwrite Projected Access

Current issue:

- `defineAccessContext()` builds `can` with `Object.fromEntries`.
- Duplicate permission keys silently collapse to the last value.
- Codegen renders duplicate keys without failing at the permission collection
  layer.
- Second-pass probes showed a duplicate `invoice.pay` entry project as `true`
  after a prior `false`, and an async false permission project as `true`.

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
- Permission projection uses the same strict guard evaluator as backend access,
  so async/non-boolean permission checks do not project `true`.

### F14: MCP Operation Access Can Drift From Permission Guards

Current issue:

- `defineOperation()` only stamps `permissionKey` from explicit `permission`.
- A permission-valued `guard` without explicit `permission` remains backend
  protected but has no MCP permission metadata.
- `tool.operation()` treats missing permission metadata as allowed.
- Current tests that expect operation permission metadata pass both `guard` and
  `permission`, so they do not cover permission-valued guard derivation.
- Mini CMS `publishPageOp` has `guard: canManagePages` but no explicit
  `permission`, and its MCP `publish-page` tool also passes no `permission`.
  The backend can still deny, but MCP visibility/projection does not carry the
  same permission key.

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
- `implementOperation(...)` keeps descriptor permission, implementation
  permission, and permission-valued guard metadata aligned or fails definition.
- Maintained operation-backed MCP tools, including Mini CMS publish, either
  derive permission metadata from the guard or pass explicit `permission`.

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
- A second-pass runtime probe signed a mutation envelope with
  `purpose: 'query'`; the mutation handler accepted it and executed.

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
- An ordinary query/mutation/action rejects `operation-preview` and
  `operation-execute` unless it is the matching generated operation projection.
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
- The route forwards a service caller plus delegated user with `actingFor`,
  making duplicate delivery a trusted delegated write, not just a public form
  duplicate.

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
- The second route request with the same delivery id does not call
  `serverConvexMutation`.
- Static/inventory checks flag trusted webhook routes that perform writes
  without passing an idempotency key.

### F18: Direct MCP Mutation Tools Can Omit Explicit Permissions

Current issue:

- `defineMcpApp().tool.mutation(...)` accepts no `permission`.
- `accessAllows(recordAccess, undefined)` returns true.
- Direct mutation safety validation proves bounded-write classification, but it
  does not prove who may call the write.
- A second-pass probe showed a no-permission direct mutation tool was enabled
  and executed (`enabledWithoutPermission: true`, `mutationCalls: 1`) with no
  `tool.denied` observation.

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
- Runtime tests assert both `enabled(...)` and `handler(...)` deny or reject
  missing direct-write permissions.

### F19: Advanced MCP Write Guardrail Misses Server Write Helpers

Current issue:

- Doctor detects standalone `defineTool(...)` handlers that call
  `ctx.mutation(...)` or `ctx.action(...)`.
- It does not detect imported `serverConvexMutation(...)` or
  `serverConvexAction(...)` calls from advanced MCP tool files.
- A second-pass inventory probe with `defineTool(...)` plus
  `serverConvexMutation(...)` returned `findings: []`.

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
- Doctor also fails on the same helper calls when they are aliased, namespace
  imported, or wrapped one level inside a local helper in `server/mcp/tools`.
- Existing allowed standalone advanced tools remain read/session-only unless
  they move writes to canonical MCP lanes.

### F20: MCP Sessions Are Not Bound To Bearer Identity

Current issue:

- Example 07 enables MCP sessions and dynamic per-session tools.
- `useMcpSession()` scopes storage by current caller and `mcp-session-id`.
- The underlying toolkit server session can still resume by session id; Trellis
  does not bind that session id to the bearer key/user/workspace before dynamic
  tools are listed or called.
- The current `useMcpSession()` caller hash includes role/workspace/user but
  not the MCP key id, and dynamic shortcut callbacks do not verify the current
  bearer matches the registering key.

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
- Two keys bound to the same user/workspace cannot share session storage or
  dynamic tools unless an explicit delegation policy allows it.

### F21: Direct MCP Mutation Safety Can Be Forged In Tool Files

Current issue:

- `stampMcpToolSafety()` is exported from the main MCP surface.
- Reference/starter examples stamp generated refs directly inside
  `server/mcp/tools`.
- A tool author can classify any backend mutation as `bounded-write` in the MCP
  layer.
- A second-pass probe showed MCP-layer `stampMcpToolSafety(...)` and
  `defineMcpToolRefDescriptor(...)` projection both satisfy direct mutation
  safety validation.

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
- Public type/export tests stop preserving `stampMcpToolSafety` as a normal
  blessed MCP authoring API.

### F22: Unexpected Backend Exception Messages Reach MCP Clients

Current issue:

- `toConvexError()` strips stack framing but preserves raw error messages.
- `wrapError()` returns that message in both MCP text content and structured
  error content.
- A second-pass probe showed `secret=db-password table=private.users` is
  returned verbatim in both channels for a generic server error.

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
- Model-visible text for unknown/server errors contains no table names, ids,
  URLs, stack fragments, or secret-looking key/value pairs from the raw error.

### F23: Invalid MCP Bearer Throttling Is Process-Local

Current issue:

- Reference and starter invalid-bearer throttles use a process-local `Map`.
- The throttle runs before Convex key validation, but each process has its own
  budget.
- The workspace MCP starter copies the same local `Map` pattern.

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
- Doctor fails production-copyable MCP bearer middleware that uses only a
  module-local `Map` for invalid bearer attempts.

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
- A second-pass backend probe replayed the same signed operation-execute args
  twice against `transportMutation(...)`: the handler ran twice
  (`executions: 2`), with no backend confirmation rows and no audit rows.

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
- Tests cover direct backend replay of a transport-confirmed execute request by
  calling the Convex execute handler twice with the same signed args and
  asserting the second call is denied before handler execution.
- The first successful transport execution creates or redeems durable backend
  JTI state before the destructive handler can run.
- The fix does not create separate, conflicting replay stores for the same
  operation.
- Delete `confirmationMode: 'transport'` if this invariant cannot be made
  backend-owned without adding a second source of truth.

### F25: Transport Destructive Executions Skip Durable Audit Rows

Current issue:

- Backend-confirmed destructive mutations insert rows into
  `destructiveAuditLog` after successful execution.
- `transportMutation(...)` executes the handler and emits
  `operation.execute.completed`, but it does not insert the configured audit
  table.
- Action-backed transport executions therefore rely on transient observability
  instead of durable destructive audit state.
- The second-pass replay probe left `auditRows: []` after two successful
  transport executions.
- Mini CMS exposes an action-backed destructive publish tool with
  `confirmationMode: 'transport'`; that path needs durable audit/redemption
  semantics too, or it should move to backend confirmation.

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
- E2E replay tests assert an explicit replay/redemption error and unchanged
  audit row count, not `Post not found` or other post-effect failures.

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

### F28: Example 04 Webhook Task Creation Is Non-Idempotent

Current issue:

- `examples/04-saas-platform/server/api/webhook.post.ts` verifies a shared
  route secret and calls an internal task creation mutation.
- The payload has no event id or delivery id.
- `createTaskFromWebhookMutation` inserts a task and audit row unconditionally.

Risk:

Replaying the same verified webhook delivery, or receiving a provider retry,
creates duplicate tasks and audit rows.

Decision:

Use the same durable idempotency discipline as example 03.

Acceptance criteria:

- Example 04 webhook payload requires an event/delivery id.
- Duplicate delivery id is rejected before inserting a task or audit event.
- Calling the internal webhook path twice with the same delivery id creates one
  task.
- Route tests cover duplicate delivery behavior.

### F29: HMAC Webhook Helper Consumes Delivery Id Before Parse

Current issue:

- `readHmacVerifiedWebhookBody()` validates the signature and then calls
  `idempotency.consume(deliveryId)` before `parse(rawBody)`.
- If parsing or validation throws, the delivery id is already consumed.
- A second-pass helper probe confirmed this exact order: a signed malformed
  body threw `statusCode: 400`, while the idempotency consumer had already
  recorded `evt_poisoned`.

Risk:

A validly signed malformed delivery can poison the delivery id and cause the
provider retry to fail as a duplicate even though no work was accepted.

Decision:

Parse and validate before consuming idempotency, then consume immediately before
returning parsed work to the caller.

Acceptance criteria:

- Parse failure does not consume the delivery id.
- Duplicate delivery id is still rejected after successful parse.
- Tests cover parse failure followed by successful retry with the same delivery
  id.

### F30: Trusted Server-Route Docs Lack Concrete Verification Gates

Current issue:

- The server-routes docs include a code block that reads request body and calls
  `serverConvexMutation(..., { auth: 'trusted', actingFor:
delegateToUser({ allow: true }) })`.
- The snippet does not include a concrete route verification step before the
  trusted handoff.
- The API reference also shows a trusted automation route shape without an
  explicit request-boundary verifier in the snippet.

Risk:

A team can copy the snippet into a browser-reachable Nitro route and create an
internal-service route that acts for a configured user on arbitrary request
body input.

Decision:

Trusted route docs must show the verification gate in the code, not only in
surrounding prose.

Acceptance criteria:

- Browser/user-initiated route snippets use `auth: 'required'` or `auth:
'auto'`.
- Any snippet using `auth: 'trusted'` shows a concrete verification call before
  reading/forwarding untrusted body data.
- Server route, webhooks-and-identity-forwarding, API reference, and
  call-pattern docs all use concrete verification or safer auth modes; no
  snippet relies only on `verifyWebhookSignature(event)` placeholder prose.
- Docs/source tests fail if server-route snippets combine `auth: 'trusted'`
  with `delegateToUser({ allow: true })` without a visible verifier.

### F31: Webhook Helpers Accept Blank Secrets

Current issue:

- `readSharedSecretWebhookBody`, `createWebhookHmacSignature`, and
  `isWebhookHmacSignatureValid` accept `secret: string` without non-empty
  validation.
- Example routes validate env secrets before calling the helpers, but library
  consumers can accidentally pass `process.env.SECRET ?? ''`.
- A second-pass helper probe confirmed `isSharedSecretWebhookSignatureValid('',
'') === true`, `readSharedSecretWebhookBody({ signature: '', secret: '' })`
  resolves, and an HMAC signature created with `secret: ''` verifies with the
  same blank secret.

Risk:

A misconfigured route can accept signatures computed with an empty HMAC key, or
a blank shared-secret header.

Decision:

Webhook helpers fail closed on blank secrets.

Acceptance criteria:

- Shared-secret helper rejects empty or whitespace-only `secret`.
- HMAC signature creation and verification reject empty or whitespace-only
  `secret`.
- Tests cover empty and whitespace secrets for both helper families.

### F32: Example 03 Public MCP Email Resolver Leaks User Existence And Ids

Current issue:

- `examples/03-team-workspace/convex/features/users/domain.ts` exposes
  `resolveMcpUserByEmailQuery = query.public(resolveMcpUserByEmailOp)`.
- The handler queries `users.by_email` and returns `{ userId }` when the email
  belongs to a user with a workspace.
- The contract describes this as resolving an MCP demo identity by email, but
  there is no MCP bearer check around the public query.
- A second-pass probe showed an anonymous raw caller resolving
  `alpha-owner@example.test` to the seeded workspace owner's internal user id.

Risk:

Any caller can enumerate whether email addresses exist in the workspace app and
recover internal user ids. If copied into an app with user-targeted operations,
this becomes an identifier oracle for later attacks.

Decision:

Delete the unused demo resolver, or move email resolution behind server-only MCP
bearer validation. Do not publish email-to-user-id lookup as a browser-callable
query.

Acceptance criteria:

- No example exposes `query.public` user lookup by email.
- MCP demo identity resolution, if kept, runs only after bearer validation at
  the server boundary.
- Tests prove anonymous direct calls cannot resolve email to user id.
- Source-policy tests fail any maintained example that exposes
  `query.public(...)` email-to-user-id lookup.

### F33: Share-Token Reads Bypass Article Publish And Readiness Gates

Current issue:

- `examples/05-visibility-access/convex/features/articles/domain.ts` resolves
  `args.shareToken` before app identity exists by calling `escapeIsolation`.
- The share-token branch returns the article after matching token-to-article,
  without checking article status, knowledge-base status, prerequisites, or
  `availableAfter`.
- `createArticleShareTokenOp` can create a token for any loaded article; it
  does not require the article and knowledge base to be published/available.
- A second-pass probe showed an anonymous raw caller reading a draft article in
  an unpublished knowledge base with a share token.

Risk:

A copied share-token pattern can make draft, unpublished, prerequisite-gated, or
future-gated content public as soon as a privileged user creates a token. That
may be intentional for a separate preview/share feature, but it is not encoded
as a distinct capability and the public read path bypasses the normal readiness
invariants.

Decision:

Keep one public-share invariant: either public share tokens only reveal
published/available content, or draft/future sharing is modeled as an explicit
separate capability with dedicated operation names, permissions, tests, and
docs.

Acceptance criteria:

- Default public share-token reads deny unpublished knowledge bases, draft
  articles, unmet prerequisites, and future `availableAfter` content.
- If draft preview sharing is retained, it uses a separate capability and
  contract that makes the weaker invariant explicit.
- Tests cover draft article, unpublished knowledge base, unmet prerequisite,
  future availability, revoked token, expired token, and wrong-article token.
- The specific probe that currently resolves draft/unpublished content must
  fail after the fix unless it is moved into a separately named draft-preview
  capability.

### F34: Delegated `actingFor` Docs And Starters Teach Unconditional Impersonation

Current issue:

- The caller/app-identity docs show `getAppIdentityFromCaller(...)` loading the
  represented user whenever `actingFor.subject` contains a user id.
- The workspace and workspace-MCP starters contain the same delegated-user load
  in `convex/auth/appIdentity.ts`.
- The MCP docs wire `resolveActingFor` directly into forwarding.
- Trusted server-route/webhook snippets use `delegateToUser({ allow: true })`.

Risk:

A team can copy the pattern and let an agent/service/server route select any
user subject, turning a valid transport credential into user impersonation
without proving that the caller is allowed to represent that user.

Decision:

Docs and starters must teach delegation as a pre-authorized binding, not as
identity selection. `actingFor` should be accepted only after checking
caller/service/agent, workspace, target user, and permitted operation class.

Acceptance criteria:

- Docs snippets compute `allow` from a concrete caller-to-user/workspace
  allowlist or binding record.
- `getAppIdentityFromCaller` examples and starters verify the caller before
  loading the delegated user.
- Docs/source tests fail snippets that load `actingFor` user ids without an
  authorization check.

### F35: Workspace Starters Allow Existing Users To Re-Run Onboarding As Owner

Current issue:

- The workspace and workspace-MCP starters use `authRequired` for
  `createWorkspaceOp`.
- The handler creates a workspace and patches the current user to `{ role:
'owner', workspaceId }`.
- It does not reject users who already have a role or workspace. The UI hides
  onboarding after setup, but the backend mutation remains callable.
- A second-pass probe in example 07 created a first and second workspace for
  the same signed-in user, then observed access context rewritten to the second
  workspace with owner role.

Risk:

In a copied starter, an already-onboarded user can directly call the mutation,
create arbitrary new tenants, and rewrite their active role/workspace binding.
That can bypass invitation, tenant lifecycle, or billing rules added later.

Decision:

Backend onboarding must be one-time unless multi-workspace membership is
explicitly modeled.

Acceptance criteria:

- Starter workspace creation rejects users with existing `workspaceId` or
  `role`.
- Tests cover direct backend re-onboarding denial.
- Example 03, example 04, example 07, and workspace starter fixtures all cover
  direct repeated backend calls.
- If multi-workspace is desired, the starter must switch to explicit membership
  records rather than rewriting one user row as the source of truth.

### F36: Public MCP Key Validation And Touch Bypass Middleware Boundaries

Current issue:

- The MCP reference and workspace-MCP starter expose token-hash validation as
  `query.public`.
- They expose `touch` as `mutation.public` and update `lastUsedAt` by hash.
- The invalid-bearer budget lives in `/mcp` middleware, so direct Convex calls
  to validation bypass that budget.
- Current MCP reference tests directly call public `validate` and `touch` from
  `ctx.raw` and assert user/workspace/role disclosure plus `lastUsedAt` writes.

Risk:

An attacker can use public Convex validation as a hash oracle outside the MCP
middleware's invalid-token controls. Anyone with a leaked stored hash can also
update `lastUsedAt` without presenting the bearer token, poisoning audit and
rotation signals.

Decision:

Keep bearer validation and audit update behind one server-controlled boundary.

Acceptance criteria:

- MCP key validation/touch are internal or otherwise callable only by trusted
  server middleware.
- Direct public Convex calls cannot validate hash candidates or update
  `lastUsedAt`.
- Invalid-token budgets apply to all validation attempts, not only `/mcp`
  requests.
- `touch` updates by validated key id or validation result, not raw
  unauthenticated hash input.
- Existing tests that assert public raw validate/touch behavior are inverted so
  the public oracle cannot regress back in.

### F37: `serverConvexAction` Can Omit Explicit Auth Without Lint Coverage

Current issue:

- `server-convex-auth-explicit` checks `serverConvexQuery` and
  `serverConvexMutation`, but not `serverConvexAction`.
- A second-pass ESLint probe with `serverConvexAction(event, api.jobs.run, args)`
  produced no messages.
- The recommended ESLint config treats the explicit-auth rule as warning-level,
  so it is not a blocking production guardrail even where it applies.

Risk:

Server actions can be copied without an explicit `{ auth: ... }` decision,
leaving action auth semantics less reviewable than query/mutation calls.

Decision:

All server-side Convex helper calls require explicit auth options in linted
server code.

Acceptance criteria:

- `serverConvexAction(...)` without `{ auth: ... }` fails the same lint rule as
  query/mutation helpers.
- Tests cover action/query/mutation positive and negative cases.
- Recommended production lint config treats this guardrail as an error, or
  doctor/source-policy supplies an equivalent blocking check.

### F38: Doctor Blesses Public MCP Key Validation As Canonical Bearer Auth

Current issue:

- Doctor's canonical MCP bearer check looks for middleware text containing
  `api.features.mcpKeys.domain.validate` and `{ auth: 'none' }`.
- Starter tests currently assert public `mcpKeys.validate` and `mcpKeys.touch`.

Risk:

Doctor can report a canonical MCP bearer setup even when key validation and
audit touch are public Convex functions that bypass middleware throttling and
audit boundaries.

Decision:

Canonical MCP bearer validation must have one server-controlled/internal
boundary.

Acceptance criteria:

- Doctor fails public `mcpKeys.validate` or `mcpKeys.touch`.
- Starter/source tests assert internal/server-only validation and touch.
- The doctor pass condition checks the safe shape, not the old string pattern.

### F39: Static Guardrails Inventory Unsafe Surfaces Without Failing Deploy

Current issue:

- Doctor reports unsafe entrypoints, cross-scope escapes, and destructive
  operations as `pass` inventory findings even when they exist.
- Permission codegen and doctor also accept duplicate permission keys, and
  doctor's advanced MCP custom-write detector misses imported server write
  helpers such as `serverConvexMutation(...)`.

Risk:

Known auth-sensitive surfaces can ship cleanly through doctor and CI as long as
they have metadata strings.

Decision:

Inventory is not enough for security-sensitive escapes. Production checks should
fail unless each site has explicit reviewed permit metadata.

Acceptance criteria:

- Production doctor fails unreviewed unsafe entrypoints, `escapeIsolation`, and
  destructive operation inventory.
- Duplicate permission keys fail codegen/doctor with all source locations.
- Standalone advanced MCP tools fail doctor/source-policy when they call
  `ctx.mutation`, `ctx.action`, `serverConvexMutation`, `serverConvexAction`, or
  `createServerConvexCaller(...).mutation/action`.
- Tests cover reviewed and unreviewed variants.
- Findings include file/line evidence without leaking secrets or long snippets.

### F40: Docs And Starter Source Tests Preserve Unsafe Auth Snippets

Current issue:

- Some source tests assert current risky snippets, such as public MCP key
  validation/touch and `{ auth: 'none' }`.
- Docs tests do not reject trusted snippets without concrete verification gates,
  unconditional `actingFor`, public email resolvers, or starter re-onboarding.
- The S8 second-pass subagent found no dedicated `tests/source-policy` suite in
  this checkout; current golden/source tests are scattered and preserve some
  unsafe examples instead of blocking them.

Risk:

Fixes can regress through generated starters or docs because tests preserve the
old unsafe shape.

Decision:

Source-policy tests should assert absence of known unsafe snippets after the
hard cutover.

Acceptance criteria:

- Docs/starters/examples fail when they reintroduce trusted forwarding without
  verification, `delegateToUser({ allow: true })`, public email resolution,
  public MCP key validation/touch, or backend re-onboarding.
- Tests also fail when examples reintroduce public direct-delete starters,
  static bearer token defaults, or share-token readiness bypasses without an
  explicit separate preview capability.
- Existing tests that currently assert unsafe presence are inverted or deleted.

### F41: Public MCP Entry Point Lets Tool Files Self-Certify Bounded-Write Safety

Current issue:

- `@lupinum/trellis/mcp` and `#trellis/mcp` export `stampMcpToolSafety` and
  `trellisMcpToolSafetyKey`.
- `stampMcpToolSafety()` writes forgeable metadata using `Symbol.for(...)`.
- Docs and generated MCP tools stamp generated refs in `server/mcp/tools/*`.
- A scratch public API probe confirmed an app-local object can be stamped as
  `bounded-write` through the top-level MCP barrel and then read back by
  `getMcpToolSafety()`.

Risk:

A tool file can label a sensitive or destructive mutation as `bounded-write`
and use `tool.mutation(...)` instead of operation-backed preview/confirmation.

Decision:

Write-safety metadata belongs to backend/codegen-owned descriptors, not MCP tool
files.

Acceptance criteria:

- Top-level MCP entrypoint no longer exports tool-local safety stamping.
- Public export/type tests assert both `@lupinum/trellis/mcp` and `#trellis/mcp`
  do not expose `stampMcpToolSafety` or `trellisMcpToolSafetyKey`.
- Maintained examples and starters do not import `stampMcpToolSafety` from
  `@lupinum/trellis/mcp`.
- Direct mutation tools can only use backend/codegen-owned safety descriptors,
  or all write tools use operation projections.

### F42: Shared-Secret Webhook Helper Is A First-Reader Server Export

Current issue:

- `@lupinum/trellis/server` and `#trellis/server` export
  `readSharedSecretWebhookBody`.
- The helper does not bind body, timestamp, or delivery id.
- Maintained examples still copy it.
- A scratch public API probe confirmed the helper is reachable from the server
  barrel alongside the HMAC helper.

Risk:

Developers copying the first-reader server surface can build replayable webhook
routes even though a stronger HMAC helper exists.

Decision:

The default public server webhook helper should be timestamped HMAC with
delivery-id idempotency.

Acceptance criteria:

- Maintained examples use the HMAC helper.
- Shared-secret-only verification is deleted or moved to an explicitly unsafe
  demo surface.
- Public server export tests either reject `readSharedSecretWebhookBody` on the
  first-reader barrel or prove it is isolated behind an unsafe/demo-only path.
- Source tests fail imports of `readSharedSecretWebhookBody` in maintained
  examples/docs.

### F43: Public `delegateToUser` Accepts Literal `allow: true`

Current issue:

- `delegateToUser` is exported from the server barrel and `#trellis/server`.
- `DelegateToUserOptions.allow` accepts a boolean.
- Docs and tests show `allow: true` as the copied shape.
- A scratch public API probe confirmed `delegateToUser({ userId, allow: true })`
  returns a represented-user `actingFor` value with no caller or binding input.

Risk:

Server routes can create represented-user identities without proving that the
service/agent/caller may represent that user.

Decision:

Delegation should be binding-backed and make unconditional impersonation hard to
represent.

Acceptance criteria:

- First-reader docs do not show `delegateToUser({ allow: true })`.
- Runtime/type tests make literal boolean delegation unavailable on the safe
  helper.
- The safe helper requires caller/service, target user, workspace, and binding
  evidence in one call.
- Raw delegation, if retained, is renamed or moved to an unsafe/advanced surface.

### F44: Raw Identity-Forwarding Transport Primitives Are Re-Exported From Backend

Current issue:

- There is no published `@lupinum/trellis/identity-forwarding` subpath.
- `@lupinum/trellis/backend` still re-exports envelope creation/verification
  and context setters.
- A scratch public API probe confirmed the backend barrel exposes raw
  envelope/context helpers such as `createIdentityForwardingEnvelope`,
  `verifyIdentityForwardingEnvelope`, `setIdentityForwardingContext`, and
  `withIdentityForwarding`.

Risk:

App backend code can hand-roll trusted transport edges outside the canonical
server/MCP/bridge paths, making replay, purpose, and observability fixes easy
to bypass.

Decision:

Keep raw transport primitives internal or explicitly unsafe; keep normal app
code on `serverConvex*`, `createMcpConvexCaller`, and `defineTrellis` lanes.

Acceptance criteria:

- Backend barrel no longer exports raw envelope creation/verification or context
  setters.
- Package/type tests prove deleted raw exports are unavailable from public
  app-facing subpaths.
- Invariant tests prove forwarded caller fields are only available through the
  canonical generated/server/MCP handler path.
- Bridge/package-author use, if required, lives in the bridge package or a
  clearly advanced surface.

### F45: Testing `asCaller` Falls Back To Raw Caller Args

Current issue:

- `createTestContext().asCaller(...)` signs `_trellisForwarding`, but retries as
  plain `{ caller }` when the function rejects `_trellisForwarding`.
- Testing docs say the helper signs the real envelope shape and is not raw
  forwarding.

Risk:

Tests can pass against handlers that accept raw identity-shaped public args,
masking production auth bypasses.

Decision:

Testing helpers should fail closed when the signed transport is rejected.

Acceptance criteria:

- `asCaller(...)` does not retry with raw `caller`.
- Tests prove a handler without forwarding validators fails instead of silently
  accepting raw caller args.
- Any raw-caller test helper is deliberately named unsafe and not used by normal
  docs/examples.

### F46: Trellis-Branded Advanced MCP Exports Raw Toolkit Tools

Current issue:

- `@lupinum/trellis/mcp/advanced` exports raw toolkit `defineMcpTool`.
- The file comment says the helper skips the blessed structural guarantees.
- Maintained examples use it with hand-rolled auth checks.
- A scratch public API probe confirmed `defineMcpTool` and `defineTool` are
  reachable from the Trellis-branded advanced MCP barrel.

Risk:

Trellis-branded imports can bypass `defineMcpApp` recordAccess, result
normalization, write-safety, and destructive confirmation.

Decision:

Do not brand raw toolkit app-write-capable APIs as Trellis-safe.

Acceptance criteria:

- Maintained examples stay on Trellis-owned wrappers or explicitly non-writing
  helpers.
- `defineMcpTool` is no longer re-exported from Trellis, or the subpath/name is
  explicitly unsafe and doctor/source tests flag app writes from it.
- Package/alias tests assert no `#trellis/mcp/advanced` alias unless explicitly
  configured, or assert the path is unsafe-only and cannot appear in maintained
  app-write examples.

### F47: Example Route Tests Can Be Invisible To Normal Example Gates

Current issue:

- Example 03 has `server/api/webhook.post.test.ts`.
- Its Vitest config includes only `convex/**/*.test.ts`.
- The root prepared-example gate runs each example's own test command, so the
  route test is not part of normal example verification.

Risk:

Trusted route coverage can exist in the tree but not run in CI/release gates.

Decision:

Every example test file must be matched by that example's local test config.

Acceptance criteria:

- Example 03 route tests run under `pnpm --dir examples/03-team-workspace test`.
- A repo source test fails if any `examples/*/server/**/*.test.ts` file is not
  included by the example's Vitest config.

### F48: Testing Context Leaks Identity-Forwarding Keys Through Global Env

Current issue:

- `createTestContext({ identityForwardingKey })` writes
  `process.env.CONVEX_IDENTITY_FORWARDING_KEY`.
- A later harness test can call `createTestContext()` without a key and still
  use `asCaller(...)` because a previous test polluted process env.

Risk:

Missing test setup and auth/key requirements become order-dependent. Running a
single test can fail while the full file passes.

Decision:

Testing trust keys must be explicit and instance-local.

Acceptance criteria:

- `createTestContext()` does not mutate process env.
- `asCaller(...)` requires an explicit key on the context unless the test
  deliberately opts into reading process env.
- Tests prove clean-env behavior and selected-test behavior.

### F49: Webhook Route Tests Replace Trellis Helpers With Weaker Mocks

Current issue:

- Example 03 and 07 route tests mock `#trellis/server` and implement
  `readSharedSecretWebhookBody` as `signature === secret`.
- The route tests verify dispatch wiring, but not actual helper behavior.
- The source-policy test currently expects maintained examples to contain
  `readSharedSecretWebhookBody`, preserving the unsafe default instead of
  rejecting it after migration.

Risk:

Blank-secret, raw-body binding, timestamp, idempotency, and parser-order
regressions can survive while route tests stay green.

Decision:

Route tests should exercise real shared route/helper behavior, or use a shared
test harness that preserves Trellis helper semantics.

Acceptance criteria:

- Webhook route tests fail on blank secrets, body mutation, stale timestamps,
  duplicate delivery ids, and malformed signed payloads.
- Source-policy tests reject `readSharedSecretWebhookBody` in maintained
  production-copyable examples once they migrate to HMAC/delivery-id routes.
- Maintained examples no longer mock away the auth helper under review.

### F50: Source And Public-Surface Tests Preserve Unsafe Auth APIs

Current issue:

- Some tests assert unsafe patterns as desired output:
  `readSharedSecretWebhookBody`, public MCP validate/touch with
  `{ auth: 'none' }`, literal `delegateToUser({ allow: true })`, public
  `stampMcpToolSafety(...)`, and raw advanced MCP toolkit exports.
- Some public-surface tests use partial assertions, so extra unsafe exports can
  remain unnoticed.

Risk:

Fixes will look like test regressions, and new unsafe exports can slip through
existing API tests.

Decision:

Public-surface and source-policy tests should be exact where possible and
negative for known unsafe auth patterns.

Acceptance criteria:

- Tests fail if docs/starters/examples reintroduce shared-secret trusted
  routes, public MCP key validate/touch, unconditional delegation, tool-local
  safety stamping, or raw identity-forwarding primitives.
- Export tests either compare exact surfaces or include explicit negative
  assertions for unsafe extras.

### F51: Destructive Replay Tests Can Pass On Post-Effect Failures

Current issue:

- An MCP e2e replay test accepts either `already been redeemed` or
  `Post not found`.
- Another replay harness manually pre-inserts JTI state instead of replaying a
  captured production request end to end.
- A second-pass backend probe showed why this matters: a fresh transport JTI
  with no backend row can execute twice, while current seeded-row tests still
  pass.

Risk:

Replay redemption can regress while tests pass because the first execution
already deleted the target resource.

Decision:

Replay tests must prove the replay-specific invariant directly.

Acceptance criteria:

- Captured execute requests cannot run twice.
- A concurrent double-execute test proves exactly one redemption/effect wins.
- Replay tests assert durable redemption/audit state and no duplicate effects.
- Tests fail if the only replay failure is a domain-level missing resource after
  the first execution.

### F52: MCP Trusted Forwarding Uses The Server Transport Lane

Current issue:

- `IdentityForwardingTransport` includes `mcp`.
- `createMcpConvexCaller()` delegates to `createServerConvexCaller()`.
- `serverConvex*` hardcodes trusted forwarding envelopes with
  `transport: 'server'`.

Risk:

Convex handlers cannot distinguish MCP-origin trusted calls from ordinary
server trusted calls. A handler configured with
`identityForwardingTransport: 'mcp'` will not work with the current MCP helper,
so application authors are pushed toward the broader `server` trusted lane.

Decision:

Make transport lanes honest.

Preferred implementation:

- Have `createMcpConvexCaller()` sign `transport: 'mcp'` envelopes, and make
  MCP-only handlers accept only that transport.
- Keep ordinary server routes on `transport: 'server'`.
- If Trellis does not need a separate MCP forwarding lane, delete the `mcp`
  transport value and the handler option rather than leaving a dead security
  boundary.

Acceptance criteria:

- MCP trusted calls are accepted by handlers declaring
  `identityForwardingTransport: 'mcp'`.
- Server trusted calls are rejected by MCP-only handlers.
- MCP trusted calls are rejected by server-only handlers unless the handler
  intentionally allows both lanes through an explicit reviewed path.
- Tests prove `createMcpConvexCaller()` emits the expected transport.

### F53: Raw Better Auth Client Calls Can Mutate Server Session Without Trellis Sync

Current issue:

- `useBetterAuthClient()` exposes the raw Better Auth client.
- `plugin.client.ts` also provides that client as `$auth`.
- Trellis auth engine refresh/invalidation hooks exist locally, but the client
  transport/plugin does not subscribe to Better Auth session changes through a
  session signal, storage event, BroadcastChannel, or `getSession` watcher.

Risk:

App code can call raw Better Auth methods such as direct `client.signOut()` or
provider/session-switch flows. The authoritative HttpOnly Better Auth session
can change while Trellis keeps the previous Convex JWT and `sessionUser` until
a later manual refresh, token pull, or JWT expiry.

Decision:

Keep one Trellis auth state source, but make raw Better Auth session mutations
feed that source.

Acceptance criteria:

- Direct `useBetterAuthClient().signOut()` invalidates Trellis auth state.
- Direct provider sign-in/session switch refreshes Trellis auth state.
- Cross-tab Better Auth session changes also trigger the same engine path.
- No second auth state store is introduced.

### F54: Convex Token-Provider Forced Refresh Can Reuse A Recently Validated JWT

Current issue:

- `initAuthClient().fetchAuthState()` returns `recent-token-cache` for
  `forceRefreshToken: true` when the token was validated inside
  `TOKEN_CACHE_MS`.
- `TOKEN_CACHE_MS` is 10 seconds.
- `tests/unit/plugin-client-token-cache.test.ts` asserts this no-exchange
  forced-token behavior.

Risk:

A forced Convex token pull is not necessarily a server-session revalidation. If
the Better Auth session was revoked or switched elsewhere, a forced token pull
inside the recent-cache window can keep using the old Convex JWT.

Decision:

Separate Convex-internal token freshness from session-authoritative refresh.

Acceptance criteria:

- Explicit session-change handling always contacts Better Auth or otherwise
  consumes a trusted Better Auth session signal.
- Protected-route revalidation, if added, bypasses recent-token cache.
- Convex internal token pulls can keep a short cache only when they are not
  being used as proof of current Better Auth session state.

### F55: Route Protection Allows Protected Navigation From Stale Local Auth

Current issue:

- The global route middleware waits only when auth is pending.
- If local `isAuthenticated` is already true, protected navigation is allowed.
- Without Better Auth session-change subscription, that local state can be
  stale after remote revocation or direct raw client session mutation.

Risk:

A stale tab can navigate to protected pages after the server session has been
revoked or switched. Backend calls may eventually fail, but route protection has
already trusted the stale frontend state.

Decision:

Do not make frontend route protection the backend security boundary, but keep
it aligned with authoritative session state before showing protected screens.

Acceptance criteria:

- Navigation to a protected route after remote sign-out/session revocation
  refreshes or invalidates Trellis auth before allowing the route.
- Stale authenticated local state alone is not sufficient to enter protected
  pages.
- Tests cover authenticated local state plus missing/revoked Better Auth
  session.

### F56: Auth Proxy Drops Request Bodies For DELETE-Style Auth Endpoints

Current issue:

- The auth proxy reads request bodies only for `POST`, `PUT`, and `PATCH`.
- Generic CORS allows `DELETE`.
- Non-critical auth endpoints are forwarded with their original method.

Risk:

If Better Auth uses or adds a `DELETE` endpoint with a request body, Trellis can
silently strip that body and diverge from Better Auth semantics. For session
management, that could turn a targeted session operation into a malformed or
default operation.

Decision:

Proxy method/body behavior should be explicit.

Acceptance criteria:

- DELETE requests with bodies are either forwarded intact or rejected before
  proxying with a clear error.
- Tests cover DELETE-with-body and no-body DELETE behavior.
- Critical endpoints remain restricted to `GET`/`OPTIONS`.

### F57: Nuxt Runtime Auth Tests Fail Before Collection In Current Workspace

Current issue:

- Running the Nuxt auth test project fails before collecting tests.
- The observed failure resolves `@nuxt/test-utils` to a stale external
  `/Users/matthias/Git/workspace/ginko-cms/...` path instead of a valid Trellis
  workspace runtime path.
- No Nuxt auth runtime assertions execute under that command.

Risk:

S1 fixes depend on Nuxt runtime behavior: auth engine state, route protection,
Better Auth action wrappers, token lifecycle, and session continuity. If the
Nuxt project cannot collect, these regressions can survive while unit/server
tests stay green.

Decision:

Make at least the auth Nuxt runtime suite reliably runnable from the Trellis
workspace before accepting session-lifecycle fixes.

Acceptance criteria:

- `pnpm exec vitest run --project=nuxt tests/nuxt/auth-engine.nuxt.test.ts`
  collects and runs from the Trellis workspace.
- The focused auth Nuxt suite runs in CI/release gates or an equivalent
  blocking local gate.
- The test environment does not resolve runtime entrypoints from unrelated
  sibling workspaces.

### F58: Local `pnpm check` Is Not A Focused Auth/Security Gate

Current issue:

- `pnpm check` runs formatting, lint, publish-surface checks, type checks,
  `test:contracts`, CLI help, and maintained-example doctor checks.
- `test:contracts:repo` runs only a narrow unit subset
  (`cli-doctor`, `module-auto-imports`, `api-surface-doc`), plus Nuxt and
  server tests.
- CI separately runs the broader `pnpm run test`, but local `check` does not
  directly include many auth/MCP/public-surface/permission/destructive replay
  suites that protect this RFC.

Risk:

Developers can get a local green `pnpm check` while missing regressions in the
high-risk security suites. That weakens the “does not regress” part of this
hardening plan.

Decision:

Add one explicit security gate instead of expecting contributors to remember a
long manual test list.

Acceptance criteria:

- A `test:security` or equivalent command runs the focused auth/MCP/public
  surface/permission/destructive replay suites tied to this RFC.
- `pnpm check` or another documented blocking pre-merge command invokes that
  focused security gate.
- The command includes exact negative tests after fixes, not only happy-path
  examples.

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
10. Add idempotency to the example 04 webhook task creation path.
11. Make HMAC webhook helper parse/validate before consuming delivery ids.
12. Fix trusted server-route docs snippets and add source tests.
13. Reject blank webhook secrets in public webhook helpers.
14. Delete or server-gate the example 03 public MCP email resolver.
15. Tighten example 05 share-token creation/readiness invariants.
16. Fix `actingFor` docs to show allowlisted delegation only.
17. Deny starter workspace re-onboarding in backend mutations.
18. Make MCP key validation/touch server-only or internal.
19. Replace maintained shared-secret webhook imports with HMAC delivery-id
    helpers.
20. Replace `delegateToUser({ allow: true })` docs/examples with binding-backed
    delegation.
21. Include example server-route tests in local example Vitest configs.

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
15. Extend explicit-auth lint coverage to `serverConvexAction`.
16. Make duplicate permission keys fail in the canonical permission metadata
    path used by codegen, doctor, access context, and feature composition.
17. Replace source tests that assert unsafe starter/docs patterns with tests
    that fail public MCP key validation/touch, unconditional `actingFor`,
    trusted snippets without verification gates, public email resolvers, and
    starter re-onboarding.
18. Promote unsafe entrypoint, cross-scope escape, and destructive-operation
    inventories to production-blocking findings unless each site carries an
    explicit reviewed permit.
19. Remove public MCP tool-local safety stamping and move safety metadata to
    backend/codegen-owned descriptors.
20. Remove raw identity-forwarding transport primitives from the backend barrel.
21. Make `createTestContext().asCaller(...)` fail closed when signed forwarding
    is rejected.
22. Remove or explicitly unsafe-name the Trellis `mcp/advanced` raw toolkit
    exports.
23. Keep testing identity-forwarding keys instance-local and add clean-env
    selected-test coverage.
24. Replace webhook route mocks with real-helper or shared-harness tests.
25. Invert source/type/public-surface tests that currently assert unsafe auth
    snippets or exports.
26. Add captured-request and concurrent destructive replay attacker tests.

Verification:

```bash
pnpm exec vitest run --project=unit tests/unit/auth-primitives.test.ts tests/unit/auth-access-context.test.ts tests/unit/functions-defineHandler.test.ts tests/unit/identity-forwarding.test.ts tests/unit/server-convex-utils.test.ts tests/unit/functions-defineTrellis.test.ts tests/unit/define-convex-tool.test.ts tests/unit/destructive-confirmation.test.ts tests/unit/mcp-operation-binding.test.ts tests/unit/use-mcp-session.test.ts tests/unit/mcp-invalid-bearer-throttle.test.ts tests/unit/cli-doctor.test.ts
pnpm exec vitest run --project=unit tests/unit/eslint-plugin.test.ts tests/unit/permissions-codegen.test.ts tests/unit/permission-metadata.test.ts tests/unit/example-webhook-security.test.ts tests/unit/mcp-auth-middleware.test.ts tests/unit/examples-gallery-docs.test.ts tests/unit/package-subpath-exports.test.ts tests/unit/backend-index-exports.test.ts tests/unit/server-index-exports.test.ts tests/unit/mcp-index-exports.test.ts tests/unit/module-auto-imports.test.ts
pnpm run test:types:public
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
- Example 04 webhook: duplicate delivery id does not create a second task or
  audit row.
- HMAC webhook helper: parse failure does not consume the delivery id.
- Trusted route docs: snippets with `auth: 'trusted'` include a concrete
  verification gate before forwarding.
- Webhook helper secrets: empty and whitespace secrets are rejected.
- Public email resolver: anonymous direct calls cannot resolve email to user id.
- Share tokens: public token reads cannot bypass publish/readiness gates unless
  a separate explicit draft-preview capability is used.
- Delegated actingFor: snippets prove caller-to-user delegation before loading
  the represented user.
- Workspace starter onboarding: an existing user cannot call the backend
  workspace-create mutation again.
- MCP key validation: direct public Convex calls cannot validate key hashes or
  update last-used state.
- Server action auth lint: `serverConvexAction(...)` without `{ auth: ... }`
  fails the same lint rule as query/mutation helpers.
- Static guardrails: production doctor fails unreviewed `escapeIsolation`,
  unsafe entrypoints, direct MCP write helper imports, tool-local safety stamps,
  and public MCP key validation/touch.
- Source policy tests: docs/starters/examples fail if they reintroduce trusted
  forwarding without verification, unconditional `actingFor`, public email
  resolution, public MCP key validation/touch, or backend re-onboarding.
- Public MCP surface: `@lupinum/trellis/mcp` does not export
  `stampMcpToolSafety` or the safety symbol, and maintained tool files cannot
  self-certify write safety.
- Shared-secret server surface: maintained docs/examples cannot import
  `readSharedSecretWebhookBody`.
- Delegation API: first-reader server docs/examples cannot use
  `delegateToUser({ allow: true })`.
- Backend barrel: raw identity-forwarding envelope/context primitives are not
  exported from app-facing package subpaths.
- Testing transport: `asCaller(...)` does not retry with plain `{ caller }`.
- Testing key isolation: selected `asCaller(...)` tests fail without an
  explicit key and do not inherit keys from previous tests.
- Example route tests: every `examples/*/server/**/*.test.ts` file is included
  by the example's normal test command.
- Webhook route harness: route tests exercise real helper semantics for HMAC,
  idempotency, parser order, and blank-secret denial.
- Public-surface tests: unsafe extra exports fail exact or explicit negative
  assertions.
- Advanced MCP: Trellis-branded advanced exports cannot be used as an app-write
  bypass without doctor/source-test failures.
- Destructive replay tests: a captured execute request and a concurrent
  double-submit can create at most one effect and one audit/redemption record.

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
- Webhook helper idempotency only consumes accepted deliveries.
- Trusted route docs do not teach browser-reachable trusted forwarding without
  verification.
- Webhook helpers fail closed on blank secrets.
- Public examples do not expose user lookup by email.
- Share-token examples encode one explicit readiness invariant.
- Delegated identity docs do not allow unconditional impersonation.
- Starter onboarding is backend-enforced, not only UI-hidden.
- MCP key validation and touch have one server-controlled boundary.
- Static guardrails fail the known bad snippets before runtime tests are needed.
- Source tests assert absence of unsafe generated/docs patterns instead of
  preserving vulnerable snippets.
- Public package barrels do not export helpers that manufacture trust or safety
  metadata from app-layer files.
- Testing helpers exercise the real signed forwarding path and do not mask raw
  caller acceptance.
- Tests prove denial paths, not only happy paths.

## Rollout Notes

Trellis is still treated as greenfield for these surfaces. Prefer hard cutovers:

- Delete unsafe examples instead of adding compatibility.
- Replace shared-secret webhook examples instead of documenting both.
- Reuse existing MCP key auth instead of maintaining a Mini CMS token variant.
- Reuse existing auth engine state instead of adding a Better Auth state mirror.

If a new replay/idempotency table is required, it must be justified by the
trusted forwarding replay requirement and must include cleanup semantics.
