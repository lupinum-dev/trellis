import { beforeAll, describe, expect, it, vi } from 'vitest'

// Intentional 0.3.0 public export boundary coverage: deleted MCP helper names
// appear here only as negative entrypoint assertions.

vi.mock('../../src/runtime/convex/server/convex', () => ({
  serverConvexQuery: vi.fn(),
  serverConvexMutation: vi.fn(),
  serverConvexAction: vi.fn(),
}))

vi.mock('@nuxtjs/mcp-toolkit/server', () => ({
  completable: vi.fn(),
  defineMcpHandler: vi.fn(),
  defineMcpPrompt: vi.fn(),
  defineMcpResource: vi.fn(),
  defineMcpTool: vi.fn(),
  extractToolNames: vi.fn(),
  imageResult: vi.fn(),
}))

vi.mock('../../src/runtime/mcp/use-mcp-session', () => ({
  useMcpSession: vi.fn(),
}))

vi.mock('../../src/runtime/mcp/use-mcp-server', () => ({
  useMcpServer: vi.fn(),
}))

describe('mcp entrypoint exports', () => {
  let mcpApi: typeof import('../../src/runtime/mcp/index')
  let advancedApi: typeof import('../../src/runtime/mcp/advanced')

  beforeAll(async () => {
    mcpApi = await import('../../src/runtime/mcp/index')
    advancedApi = await import('../../src/runtime/mcp/advanced')
  })

  it('exports the blessed MCP API surface', () => {
    expect(Object.keys(mcpApi).sort()).toEqual([
      'RateLimitInfrastructureError',
      'completable',
      'createMcpConvexCaller',
      'createRedisMcpRateLimitStore',
      'defineMcpApp',
      'defineMcpHandler',
      'defineMcpPrompt',
      'defineMcpResource',
      'defineOperationHandle',
      'deniedMcpAccessSnapshot',
      'executeOperationRef',
      'extractToolNames',
      'imageResult',
      'isOperationHandle',
      'previewOperationRef',
      'projectOperationRef',
      'unsafe',
      'useMcpServer',
      'useMcpSession',
      'withSummary',
      'withUntrustedText',
      'wrapError',
      'wrapPreview',
      'wrapSuccess',
    ])
  })

  it('does not surface low-level helpers from the top-level entrypoint', () => {
    expect(mcpApi).not.toHaveProperty('defineMcpTool')
    expect(mcpApi).not.toHaveProperty('defineTool')
    expect(mcpApi).not.toHaveProperty('stampMcpToolSafety')
    expect(mcpApi).not.toHaveProperty('trellisMcpToolSafetyKey')
  })

  it('exposes toolkit-level helpers under the advanced subpath', () => {
    expect(Object.keys(advancedApi).sort()).toEqual(['defineMcpTool'])
  })

  it('exports toolkit primitives and envelope helpers', () => {
    expect(mcpApi).toHaveProperty('defineMcpResource')
    expect(mcpApi).toHaveProperty('defineMcpPrompt')
    expect(mcpApi).toHaveProperty('defineMcpHandler')
    expect(mcpApi).toHaveProperty('useMcpSession')
    expect(mcpApi).toHaveProperty('useMcpServer')
    expect(mcpApi).toHaveProperty('wrapError')
    expect(mcpApi).toHaveProperty('wrapSuccess')
    expect(mcpApi).toHaveProperty('wrapPreview')
    expect(mcpApi).toHaveProperty('withSummary')
    expect(mcpApi).toHaveProperty('executeOperationRef')
    expect(mcpApi).toHaveProperty('previewOperationRef')
    expect(mcpApi).toHaveProperty('projectOperationRef')
  })
})
