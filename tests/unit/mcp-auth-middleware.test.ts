import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

const middlewareSource = () =>
  readFileSync(
    new URL(
      '../../src/cli/starter-fixtures/workspace-mcp/server/middleware/mcp-auth.ts',
      import.meta.url,
    ),
    'utf8',
  )

describe('generated MCP bearer auth middleware', () => {
  it('rejects missing bearer credentials before Convex validation', () => {
    const source = middlewareSource()

    expect(source).toContain("if (!header?.startsWith('Bearer '))")
    expect(source).toContain("statusMessage: 'MCP bearer token required.'")
    expect(source.indexOf("if (!header?.startsWith('Bearer '))")).toBeLessThan(
      source.indexOf('serverConvexQuery('),
    )
  })

  it('rejects invalid bearer prefixes before Convex validation', () => {
    const source = middlewareSource()

    expect(source).toContain("if (!token.startsWith('mcp_'))")
    expect(source).toContain("statusMessage: 'Invalid MCP bearer token.'")
    expect(source.indexOf("if (!token.startsWith('mcp_'))")).toBeLessThan(
      source.indexOf('serverConvexQuery('),
    )
  })

  it('rejects unknown bearer credentials after Convex validation', () => {
    const source = middlewareSource()

    expect(source).toContain('api.features.mcpKeys.domain.validate')
    expect(source).toContain('if (!key) {')
    expect(source).toContain('recordInvalidBearer(event)')
    expect(source).toContain("statusMessage: 'Invalid MCP bearer token.'")
  })

  it('stores valid bearer context and touches the key without browser auth', () => {
    const source = middlewareSource()

    expect(source).toContain('event.context.mcpAuth = key')
    expect(source).toContain('api.features.mcpKeys.domain.touch')
    expect(source).toContain("{ auth: 'none' }")
    expect(source).not.toContain("{ auth: 'auto' }")
  })
})
