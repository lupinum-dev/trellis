# 0007: Doctor Checks For Trellis Runtime Failures

Status: Proposed
Date: 2026-06-03

## Summary

Expand `trellis doctor` so the failures found during template setup become explicit findings instead of
browser or MCP smoke-test discoveries.

Doctor findings should also be composable by integration-owned CLIs. A package such as Ginko CMS can
present product-labeled setup and diagnostics while reusing Trellis checks.

## Problem

Doctor is useful, but green static checks can still leave these runtime failures:

- auth works but app-user bootstrap never runs
- `useAccess()` stays `null` because bootstrap or app identity failed
- MCP tool calls fail because async context is missing
- MCP identity forwarding is expected but the server-only key is missing
- generated MCP add-slice imports are incomplete

For official starters and templates, doctor should mean "the Trellis integration is ready enough to run
the main flow."

## Before

Doctor checks many static sources, but some lifecycle assumptions are outside its coverage. A developer
or agent must discover problems through source spelunking or runtime smoke tests.

## After

Doctor reports direct findings for the known Trellis setup failure modes. Optional smoke mode can come
later, but static findings should cover the concrete failures first.

Integration CLIs can consume stable JSON/library findings, re-label messages, and combine them with
package-specific bridge or setup checks.

## Proposal

Add static findings:

- `auth-bootstrap-installed-or-disabled`
  - auth enabled plus users-table pattern should have bootstrap export and module-owned bootstrap enabled
- `mcp-async-context-enabled`
  - MCP surfaces or toolkit dependency should require `nitro.experimental.asyncContext`
- `mcp-add-slice-imports-resolve`
  - generated MCP add slice should be covered by fixture/import validation
- `identity-forwarding-key-configured`
  - already exists conceptually; ensure MCP bearer auth and trusted caller surfaces trigger it
- `permissions-query-null-diagnostics`
  - warn when permissions are used but configured query or auth bootstrap state cannot support readiness

Expose findings through stable JSON and a library-level report builder so product CLIs can compose them.
Fix hints should honor integration metadata such as display label and `doctorCommand`; they should not
hardcode `trellis doctor` when an integration owns the consumer setup.

Add optional future command:

```bash
trellis doctor --smoke
```

Smoke mode should require a running local app or explicit target URL. Do not add hidden dev-server startup
as the first version.

## Tradeoffs

More doctor checks can produce false positives if they over-infer. Keep each check tied to concrete
source evidence: module registration, config keys, fixture file graph, known imports, and Trellis users
table shape.

Smoke mode would be powerful but expensive. It should wait until static coverage is improved.

## Rejected Options

- Rely on e2e tests only: rejected because app developers need local setup feedback.
- Make doctor mutate files: rejected because doctor should diagnose, not repair.
- Add broad heuristic warnings: rejected because vague warnings reduce trust.
- Force integrations to shell out to `trellis doctor`: rejected because packaged products need
  product-labeled setup and diagnostics while still reusing Trellis checks.

## Acceptance Criteria

- Doctor catches missing auth bootstrap in a users-table app.
- Doctor catches MCP without async context.
- Doctor catches missing identity forwarding key when MCP trusted forwarding is expected.
- The exact template integration failures are represented as doctor findings.
- Existing JSON output remains stable and useful for agents.
- Integration CLIs can consume Trellis findings without parsing terminal output.
- Integration-managed findings use integration labels and doctor commands in fix hints.
- Existing host-owned files can be validated with snippets or instructions instead of rewritten.

## Verification

- Add fixtures for each new finding.
- Add JSON-output assertions for finding ids, status, messages, and fix hints.
- Add an integration-managed fixture that composes Trellis findings with an integration doctor command.
- Run `pnpm run test:contracts:repo`.
- Run `pnpm run check:examples:doctor`.
