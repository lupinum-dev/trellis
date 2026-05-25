# Bridge Package

Use this for `@lupinum/trellis-bridge`, component package authoring, bridge
manifests, generated host files, bridge forwarding, and drift checks.

## Source Files

- Bridge package exports: `packages/trellis-bridge/package.json`.
- Drift/install helpers: `packages/trellis-bridge/src/index.ts`.
- Manifest renderer: `packages/trellis-bridge/src/component-bridge-manifest.ts`.
- Component runtime: `packages/trellis-bridge/src/create-component-bridge.ts`.
- Convex/component subpaths:
  `packages/trellis-bridge/src/component.ts`,
  `packages/trellis-bridge/src/convex.ts`,
  `packages/trellis-bridge/src/manifest.ts`.
- Docs: `apps/docs/content/docs/07.server-side/5.component-bridge.md`.
- Example: `examples/08-component-mini-cms`.
- Tests:
  `tests/unit/bridge-package.test.ts`,
  `tests/unit/component-bridge-manifest.test.ts`,
  `tests/unit/create-component-bridge.test.ts`,
  `tests/types/component-bridge.types.ts`.

## Package Boundary

`@lupinum/trellis-bridge` is a separate package for packaged integration
authors. Do not re-export bridge APIs from core Trellis and do not import bridge
helpers from `@lupinum/trellis`.

Published bridge subpaths:

- `@lupinum/trellis-bridge`: manifest loading and drift/install helpers.
- `@lupinum/trellis-bridge/component`: host-side component bridge runtime.
- `@lupinum/trellis-bridge/convex`: Convex-side bridge helpers.
- `@lupinum/trellis-bridge/manifest`: manifest authoring and rendering helpers.

## When To Use Bridge

Use the bridge only for a reusable package that another Trellis app installs,
such as a CMS or billing integration with its own Convex component internals.

Do not use bridge files for normal app features. If the code belongs to the app,
use root handlers, server helpers, operations, and MCP projection instead.

## Manifest And Generated Files

A package-owned integration should export a default bridge manifest at
`./convex/manifest` from that integration package. The manifest declares the
host files and managed edits the package needs.

Generated bridge files are explicit host app files. The host can review them,
commit them, and run normal Convex codegen. End users should not hand-edit
generated files.

Product packages should expose product-owned setup or doctor commands. Trellis
bridge provides `loadManifestFromPackage(...)`, `checkBridgeDrift(...)`, and
`assertBridgeInstalled(...)`; it is not a generic CLI or product installer.

## Forwarding And Authorization

Bridge helpers sign `_trellisForwarding` envelopes for non-anonymous component
calls. The envelope authenticates the bridge transport and binds the purpose,
function ref, args hash, subject, expiry, and key id.

The envelope does not grant business permission. Component-side handlers still
resolve caller/appIdentity, run guards, load records, bind tenants, authorize,
and execute through the same backend policy model.

Do not expose identity-shaped public args such as `caller`, `actingFor`, or raw
forwarding keys. Identity travels in the signed forwarding envelope.

## Pitfalls

- Do not make bridge a beginner app architecture or starter default.
- Do not call internal component refs directly after generating root bridge
  files.
- Do not build package-specific authorization in the bridge layer.
- Do not treat generated package `convex/manifest.js` as source; keep an
  authored TypeScript manifest and emit package build output from it.
