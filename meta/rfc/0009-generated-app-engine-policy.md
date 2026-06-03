# 0009: Generated App Engine Policy

Status: Proposed
Date: 2026-06-03

## Summary

Separate Trellis library engine support from generated official app policy. Generated apps should declare
their expected Node and pnpm baseline, and generated env examples should include only variables consumed
by the baseline.

## Problem

The Trellis package can support a broader Node range than official app starters. That is normal for a
library. But generated apps still need a clear baseline so install, CI, type tooling, and runtime behavior
are predictable.

Without app-level `engines` and `packageManager`, consumers guess. Version mismatch failures then look
like app or framework bugs.

The same applies to env files. Unused baseline variables and advanced-only reference variables make
generated apps feel more complex than they are and create false setup requirements.

## Before

The Trellis root package declares its own engine and package manager. Starter `package.json` files can
omit app engine policy.

## After

Trellis defines two policies:

- library support range: broad enough for the package
- generated official app range: stricter, modern, and written into starter package files
- generated baseline env: only variables consumed by that generated app path

## Proposal

Add generated app policy constants used by all starter fixtures:

```json
{
  "engines": {
    "node": ">=22.20 <27",
    "pnpm": ">=11"
  },
  "packageManager": "pnpm@11.x"
}
```

The exact versions should be chosen once based on Nuxt, Convex, TypeScript, and repo tooling. The
important decision is that starters declare the policy explicitly.

CI should assert that every starter package carries the same generated-app policy.

CI should also assert that generated `.env.example` files do not include variables outside the generated
baseline. Advanced reference env, such as webhook examples, belongs in the example or advanced docs that
wire those features.

## Tradeoffs

This can make generated apps stricter than the library. That is acceptable because official apps are
complete project baselines, not package consumers with arbitrary constraints.

The risk is forcing too-new versions for users. Keep the range modern but not bleeding edge, and update
it intentionally with release notes.

The risk of strict env examples is hiding optional advanced settings. That is better handled by advanced
docs because generated app setup should show the shortest correct path.

## Rejected Options

- Use the library engine range for apps: rejected because generated apps include toolchain assumptions.
- Omit app engines: rejected because ambiguity creates noisy failures.
- Allow each starter to choose its own range: rejected because that creates drift without a product reason.
- Put advanced/reference env in baseline `.env.example`: rejected because it makes optional features look
  required.

## Acceptance Criteria

- Every starter `package.json` declares the generated app engine policy.
- Every starter `package.json` declares the same package manager policy.
- CI fails if a starter drifts.
- Trellis package `engines` can remain broader than generated app engines.
- Docs explain the distinction.
- Generated `.env.example` includes only variables consumed by the generated baseline.
- Advanced env variables live in the feature/example docs that wire them.

## Verification

- Add a starter manifest or package policy test.
- Add an env-example policy test for generated starters.
- Run starter fixture checks.
- Run package-manager/install smoke where practical.
