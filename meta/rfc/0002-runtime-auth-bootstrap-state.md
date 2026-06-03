# 0002: Runtime Auth Bootstrap State

Status: Proposed
Date: 2026-06-03

## Summary

Split auth bootstrap state into a runtime source of truth and a devtools projection. Runtime code such
as `useAccess()` should depend on runtime bootstrap state, not on devtools state.

## Problem

`useAccess()` must avoid querying permissions before the app user row exists. Today it decides whether
to wait by reading `useAuthBootstrapDevtoolsState()`. Devtools state should describe runtime behavior;
it should not be the authority that controls runtime behavior.

This coupling makes failures vague:

- bootstrap not installed can look like access simply staying `null`
- bootstrap failure and permissions-query failure collapse into one warning
- changing devtools state shape can affect app behavior

The result is a second source of truth in the wrong direction.

## Before

Runtime permission flow reads a devtools-shaped object:

```ts
const authBootstrapState = useAuthBootstrapDevtoolsState()

const shouldWaitForBootstrap = computed(() => {
  if (!authState?.isAuthenticated.value) return false
  if (!authBootstrapState.value.mutationName) return false
  if (authBootstrapState.value.ensured) return false
  if (authBootstrapState.value.error) return false
  return true
})
```

## After

Runtime permission flow reads runtime bootstrap state:

```ts
const bootstrap = useAuthBootstrapRuntimeState()

const shouldWaitForBootstrap = computed(() => {
  if (!authState?.isAuthenticated.value) return false
  return bootstrap.value.status === 'pending'
})
```

Devtools reads the same runtime state and displays it.

## Proposal

Create one runtime state composable for auth bootstrap:

```ts
type AuthBootstrapStatus = 'disabled' | 'not-installed' | 'pending' | 'ensured' | 'failed'

interface AuthBootstrapRuntimeState {
  status: AuthBootstrapStatus
  mutationName: string | null
  error: string | null
  lastEnsuredTokenHash: string | null
}
```

The bootstrap plugin is the only writer for installed bootstrap state. The auth installer can initialize
the state as `not-installed` or `disabled` before plugin setup. Devtools should project this state into
the existing devtools store.

`not-installed` is diagnostic state, not a valid steady state for canonical authenticated workspace
apps. With `trellis.auth: true`, Trellis should install bootstrap unless `bootstrap: false` is explicit.
If an app has the Trellis users-table pattern and bootstrap remains `not-installed`, runtime warnings and
doctor should treat that as setup failure.

`useAccess()` should use the runtime state to decide whether to hold the permissions query. Its delayed
warning should branch by exact cause:

- bootstrap is not installed
- bootstrap is pending too long
- bootstrap failed
- permissions query returned `null`
- permissions query errored

## Tradeoffs

This adds one runtime state object, but removes a more expensive implicit dependency on devtools. It also
improves diagnostics without adding app code.

The status list must stay small. Do not add state-machine ceremony beyond the simple lifecycle above.

## Rejected Options

- Keep devtools as the state owner: rejected because runtime depends on observability.
- Duplicate state in runtime and devtools independently: rejected because that creates drift.
- Encode state only in warnings: rejected because `useAccess()` needs a real query-gating signal.

## Acceptance Criteria

- `useAccess()` no longer imports devtools state.
- Devtools still shows auth bootstrap mutation, pending state, ensured state, and errors.
- When access remains `null`, the warning names the most likely cause.
- Bootstrap-disabled apps do not wait for bootstrap.
- Missing-bootstrap apps do not silently look healthy.
- Authenticated workspace apps treat `not-installed` as failure unless bootstrap was explicitly disabled.
- The shadcn Trellis template can delete `app/plugins/trellisAuthBootstrap.client.ts` after RFC 0001 and
  this runtime state are implemented.

## Verification

- Unit test runtime state transitions: disabled, not installed, pending, ensured, failed.
- Nuxt test that `useAccess()` waits while bootstrap is pending.
- Nuxt test that `useAccess()` does not wait when bootstrap is disabled.
- Nuxt test that `useAccess()` warns clearly when authenticated workspace bootstrap is not installed.
- Nuxt test that devtools state reflects runtime state.
