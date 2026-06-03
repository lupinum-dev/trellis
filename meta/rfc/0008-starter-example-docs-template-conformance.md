# 0008: Starter, Example, Docs, And Template Conformance

Status: Proposed
Date: 2026-06-03

## Summary

Make the generated ladder output the authoritative runnable baseline and test presets, examples, docs,
and official templates against that baseline.

## Problem

Trellis has several official sources:

- CLI starter fixtures
- examples
- docs
- generated virtual imports
- agent-facing reference metadata
- external official templates

When these drift, users cannot tell which source is authoritative. Agents waste time comparing sources
instead of following one maintained path.

Concrete drift found during template setup included MCP async context in the reference example but not
clearly in the starter, inconsistent engine policy, mixed package-manager guidance, and stale reference
paths.

## Before

Each source can be correct in isolation while still disagreeing with the others. CI catches some example
and starter issues, but not all conformance gaps.

## After

The composed output of `trellis init` plus relevant `trellis add` steps defines the runnable baseline.
Preset starters are mechanically equivalent shortcuts over that ladder. Docs explain it. Examples
demonstrate variants. Templates prove the baseline works with real UI. CI checks those roles instead of
letting them diverge silently.

## Proposal

Define source roles:

- ladder output: canonical generated app shape
- preset fixtures: tested aliases for ladder output, not separate sources of truth
- examples: maintained demonstrations of specific concepts
- docs: prose generated or checked against command metadata where practical
- templates: product-grade downstream consumers with a conformance checklist
- ADRs: accepted durable decisions
- RFCs: temporary proposals

Add checks:

- starter fixtures typecheck and build
- `trellis add mcp` output typechecks
- docs command examples use `pnpm` consistently where Trellis standardizes on pnpm
- stale-path checks include agent-facing reference files
- official templates have a checklist against the maintained starter
- MCP baseline changes fail CI if starter and reference example diverge on required config
- docs snippets for required config blocks are generated from or checked against runnable fixtures
- generated app env examples include only consumed baseline variables

## Tradeoffs

Conformance checks add maintenance cost. The cost is justified because Trellis is a framework: generated
code and official guidance must be trustworthy.

Do not force examples to be identical to starters. Examples can vary, but they should not omit required
settings for the feature they demonstrate.

Packaged integrations are a separate conformance role. They may own setup commands, docs, bridge
generation, and product labels, but must still satisfy Trellis runtime invariants through integration
metadata and composable doctor checks.

## Rejected Options

- Make docs the source of truth: rejected because runnable code should be authoritative for setup.
- Make examples the source of truth: rejected because examples intentionally teach variants.
- Ignore external templates: rejected for official templates because they validate the framework in real
  app shape.
- Add compatibility shims for every drift: rejected because drift should be fixed at the source.
- Treat presets as independent architectures: rejected because the ladder output should be the source of
  truth.

## Acceptance Criteria

- CI fails when `workspace-mcp` starter lacks a required MCP setting present in the reference baseline.
- Presets are tested as mechanically equivalent shortcuts over `init` plus `add` steps.
- CLI add-slice output is tested independently from starter snapshots.
- Docs command references stay aligned with command metadata where possible.
- Required Nuxt config snippets are checked or generated from runnable fixtures.
- Generated `.env.example` files contain only variables consumed by the generated baseline.
- Agent-facing references are included in stale path checks.
- Official templates can state which starter version or Trellis baseline they conform to.
- Packaged integrations can state which Trellis runtime invariants they satisfy without exposing Trellis
  as the user-facing setup product.

## Verification

- Add or extend repo policy scripts.
- Add tests for starter/add-slice conformance.
- Run `pnpm run lint`.
- Run starter fixture typecheck/build in release verification.
