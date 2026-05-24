# Maintaining Trellis

Trellis owns the generic Nuxt, Convex, Better Auth, MCP, identity-forwarding,
operation, and component-bridge primitives. It must stay CMS-neutral.

## Package Surface

Publishable packages:

1. `@lupinum/trellis` from the repository root.
2. `@lupinum/trellis-bridge` from `packages/trellis-bridge`.

Do not publish `@lupinum/trellis-eslint` until it is deliberately made public.
The generated API surface in
`apps/docs/content/docs/13.api-reference/7.api-surface.md` is the source of
truth for public Trellis entrypoints.

## Daily Maintenance

Use these commands before changing public APIs, release scripts, auth, MCP,
bridge, or package metadata:

```bash
pnpm run check
pnpm run release:verify
```

`release:verify` is the full local gate. It runs formatting, lint, public
surface checks, compatibility checks, type checks, tests, e2e, starter fixture
checks, generated Convex drift checks, workspace-range pack checks, production
audit, and build.

## Release Runbook

Publishing is intentionally manual. The `release:publish` script exits with a
failure message so nobody, human or agent, can accidentally push packages to
npm.

Set the version once and use it throughout the release:

```bash
VERSION=0.1.0
```

1. Start from a clean working tree on the release branch:

```bash
git status --short
```

2. Update package versions and compatibility data intentionally:

- Root `package.json` version.
- `compatibility.json` release stack.
- Package compatibility docs such as `README.md` and
  `packages/trellis-bridge/README.md`.
- `MAINTAINING.md` examples if this runbook includes versioned commands.

3. Generate release notes:

```bash
pnpm run release:notes
```

4. Review `CHANGELOG.md`. Changelogen is a draft generator, not an authority.
   Remove stale public-surface claims before continuing.
5. Run the release gate:

```bash
pnpm run release:verify
```

6. Build tarballs:

```bash
pnpm run release:pack
```

7. Inspect `.pack/*.tgz` before publishing:

```bash
tar -tzf .pack/lupinum-trellis-*.tgz | less
tar -tzf .pack/lupinum-trellis-bridge-*.tgz | less
node scripts/check-pack-workspace-refs.mjs
for file in .pack/*.tgz; do
  echo "$file $(shasum -a 256 "$file" | cut -d' ' -f1)"
done
```

8. Confirm the packed manifests are the intended public packages:

```bash
for file in .pack/*.tgz; do
  echo "$file"
  tar -xOf "$file" package/package.json | node -e "let s=''; process.stdin.on('data', d => s += d).on('end', () => { const p = JSON.parse(s); console.log(JSON.stringify({ name: p.name, version: p.version, private: p.private, peerDependencies: p.peerDependencies, publishConfig: p.publishConfig }, null, 2)) })"
done
```

9. Commit the release prep. Do not commit `.pack/`, `.pack-check/`, `dist/`,
   `.nuxt/`, or `.output/` artifacts:

```bash
git add CHANGELOG.md MAINTAINING.md README.md compatibility.json package.json packages/trellis-bridge/README.md
git commit -m "chore: prepare v${VERSION} release"
```

10. Create and push an annotated tag. Use an annotated tag because
    `git push --follow-tags` does not push lightweight tags:

```bash
git tag -a "v${VERSION}" -m "v${VERSION}"
git push origin main --follow-tags
```

If a lightweight tag was already created locally, push it explicitly:

```bash
git push origin "v${VERSION}"
```

11. Log in to npm and confirm the publishing identity:

```bash
npm login
npm whoami
```

The npm CLI may ask for browser authentication instead of an OTP. If npm prompts
for an OTP during publish, use the account's two-factor code. The pnpm config
warnings about `shamefully-hoist` and `strict-peer-dependencies` are harmless
npm warnings.

12. Publish only the inspected tarballs. Publish `@lupinum/trellis` first
    because `@lupinum/trellis-bridge` peers on it:

```bash
npm publish ".pack/lupinum-trellis-${VERSION}.tgz" --access public
npm publish ".pack/lupinum-trellis-bridge-${VERSION}.tgz" --access public
```

13. Verify npm package access and public status:

```bash
npm access list packages lupinum --registry=https://registry.npmjs.org/
npm access get status @lupinum/trellis --registry=https://registry.npmjs.org/
npm access get status @lupinum/trellis-bridge --registry=https://registry.npmjs.org/
```

If either package is unexpectedly private:

```bash
npm access set status=public @lupinum/trellis --registry=https://registry.npmjs.org/
npm access set status=public @lupinum/trellis-bridge --registry=https://registry.npmjs.org/
```

14. Verify the public npm metadata. Brand-new scoped packages can return `404`
    for a few minutes after a successful `npm publish`; wait before republishing
    the same version.

```bash
npm view "@lupinum/trellis@${VERSION}" version --registry=https://registry.npmjs.org/
npm view "@lupinum/trellis-bridge@${VERSION}" version --registry=https://registry.npmjs.org/
```

15. Create the GitHub release from the pushed tag and attach the exact tarballs:

```bash
gh release create "v${VERSION}" ".pack/lupinum-trellis-${VERSION}.tgz" ".pack/lupinum-trellis-bridge-${VERSION}.tgz" --title "v${VERSION}" --notes "$(awk -v version="v${VERSION}" '$0 == "## " version { flag=1 } flag' CHANGELOG.md)"
```

16. Run an install smoke test outside the repo after npm metadata resolves:

```bash
tmpdir=$(mktemp -d)
cd "$tmpdir"
npm init -y
npm install "@lupinum/trellis@${VERSION}" "@lupinum/trellis-bridge@${VERSION}"
node -e "Promise.all([import('@lupinum/trellis'), import('@lupinum/trellis/auth'), import('@lupinum/trellis-bridge')]).then(() => console.log('ok'))"
```

17. Verify the GitHub release:

```bash
gh release view "v${VERSION}"
```

For the first public release of a package, npm staged publishing cannot be used
because staged publishing requires the package to already exist on the registry.
Use an owner-controlled manual publish. Configure two-factor authentication for
future publishes once the package exists publicly.

For later releases, prefer npm trusted publishing plus staged publishing:

- GitHub Actions must use a protected environment with human approval.
- The release job must use Node 24 or newer and npm 11.15 or newer.
- Do not use package-manager caches in release jobs.
- Use OIDC trusted publishing instead of long-lived npm publish tokens.
- Configure npm package settings to require 2FA and disallow traditional tokens.
- Stage the tarballs with `npm stage publish .pack/<name>.tgz`, download and
  inspect each staged package with `npm stage download <stage-id>`, then approve
  with `npm stage approve <stage-id>` and 2FA.

## Supply-Chain Policy

- `pnpm-workspace.yaml` sets `minimumReleaseAge: 1440` so new dependency
  versions must sit on the registry for 24 hours before fresh resolution.
- Release jobs must use the committed lockfile. Do not delete and regenerate the
  lockfile as a casual fix.
- Dependency install scripts stay explicit through pnpm's approved/ignored build
  dependency lists.
- Temporary `overrides` are local workspace policy only. Packed packages must
  not ship override policy.
- Remove an override when `pnpm why <name>` shows upstream owners resolve the
  patched version without help and `pnpm audit --prod --audit-level low` remains
  green.

## Compatibility Tuple

The supported dependency tuple is tracked in `compatibility.json`. Release
checks use that file to reject stale pins in examples, fixtures, and starter
templates.

Intentional holds:

- `h3@1.15.11` until h3 2 is stable and Nuxt ecosystem peers accept it.
- Vite 7 until Vite 8 peer support is clean across Nuxt and Vitest.
- Nuxt DevTools 3.2.4 while DevTools 4 is alpha.
- `devalue@5.8.1` is temporarily forced by workspace override until Nuxt
  carries the patched transitive version itself.

## Ownership Boundary

Trellis owns generic runtime primitives. It must not depend on Ginko CMS,
Ginko Content, private consumer apps, CMS schema concepts, or host-specific
release canaries.

When in doubt, delete or simplify. Do not add compatibility shims for unreleased
paths unless the owner explicitly asks for them.
