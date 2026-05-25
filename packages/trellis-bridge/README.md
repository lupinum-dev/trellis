# @lupinum/trellis-bridge

Package-author utilities for Trellis-aware Convex component integrations.

Use this package when you are building an integration package that installs
generated host bridge files into another Nuxt + Convex app. Regular Trellis app
code should use `@lupinum/trellis` instead.

## Install

```bash
pnpm add @lupinum/trellis-bridge @lupinum/trellis convex convex-helpers
```

## What It Owns

- Bridge manifests that describe generated host files.
- Rendering helpers for host-owned Convex bridge files.
- Managed edit helpers for app-owned files such as `convex/convex.config.ts`.
- Drift checks that tell the host app when generated files are stale.
- Component bridge primitives for package authors.

## Public Subpaths

- `@lupinum/trellis-bridge`
- `@lupinum/trellis-bridge/component`
- `@lupinum/trellis-bridge/convex`
- `@lupinum/trellis-bridge/manifest`

## Scope

Keep product-facing install commands in the product package that owns the
integration. This package provides the generic bridge machinery; it should not
become a second application framework or a beginner-facing app API.

## License

[MIT](../../LICENSE)
