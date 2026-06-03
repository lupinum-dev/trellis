# 0001: Trellis-Owned Auth Bootstrap

Status: Proposed
Date: 2026-06-03

## Summary

When Trellis auth is enabled, Trellis should install the browser-side app-user bootstrap lifecycle
itself. A consumer app should export the canonical backend mutation, but it should not write a Nuxt
plugin that calls that mutation manually.

For packaged integrations, Trellis may be internal infrastructure rather than the product users see.
The integration can inject Trellis defaults and expose its own CLI/docs, but Trellis still owns the
runtime bootstrap lifecycle once auth is enabled.

## Problem

Better Auth can authenticate a browser session while the app-owned `users` row is still missing.
Trellis workspace and permission flows depend on that app-owned row because roles, workspace
membership, and app-level identity live there. Today the runtime helper exists, but the auth installer
does not install it as part of the normal auth lifecycle. That leaves each app or template to rediscover
an internal step.

This creates a confusing partial success state:

- sign-in works
- the Better Auth session exists
- Convex auth can be ready
- `appIdentity` cannot resolve the app user
- `useAccess()` stays empty or `null`

That is not a flexible framework boundary. It is a missing lifecycle owner.

## Before

Apps need a custom plugin similar to:

```ts
import { api } from '~~/convex/_generated/api'
import { setupConfiguredAuthBootstrap } from '@lupinum/trellis/auth'

export default defineNuxtPlugin(() => {
  setupConfiguredAuthBootstrap(api.auth.createUserIfNeeded, 'auth:createUserIfNeeded')
})
```

The app owns wiring that Trellis already knows is required for the canonical auth pattern.

## After

Apps only export the backend mutation from `convex/auth.ts`.

```ts
export const { auth, createUserIfNeeded } = defineBetterAuth({
  // app auth configuration
})
```

With `trellis.auth: true`, Trellis installs a generated client plugin that calls the configured
bootstrap mutation after the authenticated Convex token is available.

With an integration-owned runtime, the integration module can provide the same defaults while its public
docs say `ginko-cms init` or another product command. The user-facing label changes; the lifecycle owner
does not.

## Proposal

Add auth bootstrap ownership to the auth installer:

1. Resolve the configured bootstrap mutation name.
2. Default to `auth:createUserIfNeeded`.
3. Generate a client plugin that imports the Convex API reference and calls
   `setupConfiguredAuthBootstrap`.
4. Allow explicit disabling for apps that do not use an app-owned user table.
5. Allow an explicit custom mutation path for apps with a different auth domain.

Suggested config shape:

```ts
export default defineNuxtConfig({
  trellis: {
    auth: {
      bootstrap: true,
      bootstrapMutation: 'auth:createUserIfNeeded',
    },
  },
})
```

`auth: true` should behave as `{ bootstrap: true }`.

For canonical auth apps, bootstrap is required unless `bootstrap: false` is explicitly configured.
Missing bootstrap export is not a healthy runtime mode; it is a setup error or doctor finding.

Integration packages may inject these options through their own module setup. They should not require
host apps to learn or call Trellis bootstrap APIs directly.

## Tradeoffs

This adds module-owned generated code, but it deletes app-owned workaround code from every canonical
auth app. The generated plugin is acceptable because the mutation path is a stable convention and the
runtime helper already exists.

This makes the default more rigid. That is the right bias: app-user bootstrap is not an optional detail
for Trellis workspace auth. Flexibility remains available through `bootstrap: false` and
`bootstrapMutation`.

## Rejected Options

- Keep requiring app plugins: rejected because it preserves a hidden lifecycle requirement.
- Add only docs: rejected because the failure mode is runtime-only and easy to miss.
- Add multiple bootstrap strategies: rejected until a real second strategy exists.
- Auto-detect every possible mutation export: rejected because one default plus one explicit override is
  simpler and easier to diagnose.

## Acceptance Criteria

- A workspace starter with `trellis.auth: true` signs in and creates or refreshes the app-owned user row
  without an app plugin.
- The shadcn Trellis template can delete `app/plugins/trellisAuthBootstrap.client.ts`.
- If the configured mutation is missing, the developer gets a direct error or doctor finding naming the
  missing mutation.
- Apps can explicitly disable bootstrap when they do not have a Trellis users-table pattern.
- Apps can point bootstrap at a custom mutation without writing a custom plugin.
- Integration-owned Trellis runtimes can inject bootstrap defaults while keeping product-facing setup
  commands and docs integration-labeled.
- Ginko CMS-style host apps do not need a user-facing Trellis command or direct Trellis bootstrap
  concept.

## Verification

- Add a Nuxt runtime test proving the generated bootstrap plugin calls the configured mutation after
  auth becomes ready.
- Add a doctor fixture for auth enabled plus users table plus missing bootstrap export.
- Add an integration-managed fixture proving injected Trellis auth defaults still install bootstrap
  without host app plugins.
- Run `pnpm run test:contracts:repo`.
- Run the affected starter fixture checks after implementation.
