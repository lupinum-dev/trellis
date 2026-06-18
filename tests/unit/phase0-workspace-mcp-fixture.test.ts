import { readFileSync, readdirSync, statSync } from 'node:fs'
import { resolve } from 'node:path'

import type { H3Event } from 'h3'
import { describe, expect, it, vi } from 'vitest'

import { toAppInventoryJson } from '../../src/runtime/feature'
import { getOperationMetadata } from '../../src/runtime/functions'
import {
  createProjectOperation,
  deleteProjectOperation,
} from '../fixtures/phase0-workspace-mcp/convex/features/projects/operations'
import { appInventory } from '../fixtures/phase0-workspace-mcp/shared/app-inventory'

const { useEventMock } = vi.hoisted(() => ({
  useEventMock: vi.fn(),
}))

vi.mock('nitropack/runtime', () => ({
  useEvent: useEventMock,
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

vi.mock('../../src/runtime/convex/server/convex', () => ({
  serverConvexQuery: vi.fn(),
  serverConvexMutation: vi.fn(),
  serverConvexAction: vi.fn(),
  transportProof: {
    mcp: (input: Record<string, unknown>) => ({ transport: 'mcp', ...input }),
  },
  operationConfirmation: (input: { jti: string }) => ({
    mode: 'operation-confirmation',
    jti: input.jti,
  }),
  jtiRedemption: (input: { jti: string }) => ({ mode: 'jti-redemption', jti: input.jti }),
}))

function createEvent(): H3Event {
  return {
    __is_event__: true,
    method: 'POST',
    path: '/mcp',
    headers: new Headers(),
    context: {},
    node: {
      req: {},
      res: {},
    },
  } as unknown as H3Event
}

function listSourceFiles(root: string): string[] {
  const files: string[] = []
  for (const entry of readdirSync(root)) {
    const path = resolve(root, entry)
    if (statSync(path).isDirectory()) {
      files.push(...listSourceFiles(path))
      continue
    }
    if (/\.(?:ts|tsx)$/.test(path)) files.push(path)
  }
  return files
}

describe('phase0 workspace-mcp fixture', () => {
  it('builds inventory from shared descriptors and binds MCP tools without Convex implementation imports', async () => {
    const { default: deleteProjectTool } =
      await import('../fixtures/phase0-workspace-mcp/server/mcp/tools/delete-project')
    const { default: createProjectTool } =
      await import('../fixtures/phase0-workspace-mcp/server/mcp/tools/create-project')

    expect(toAppInventoryJson(appInventory)).toEqual({
      schemaVersion: 1,
      features: ['projects'],
      operations: [
        {
          id: 'projects.create',
          name: 'createProject',
          kind: 'safe',
          feature: 'projects',
          permissionKey: 'projects.create',
          safety: 'bounded-write',
        },
        {
          id: 'projects.delete',
          name: 'deleteProject',
          kind: 'destructive',
          feature: 'projects',
          permissionKey: 'projects.delete',
          safety: 'destructive-write',
        },
      ],
    })

    expect(getOperationMetadata(createProjectOperation)).toMatchObject({
      id: 'projects.create',
      kind: 'safe',
      permissionKey: 'projects.create',
      safety: 'bounded-write',
    })
    expect(getOperationMetadata(deleteProjectOperation)).toMatchObject({
      id: 'projects.delete',
      kind: 'destructive',
      permissionKey: 'projects.delete',
      safety: 'destructive-write',
    })
    expect(deleteProjectTool.name).toBe('delete-project')
    expect(createProjectTool.name).toBe('create-project')

    for (const toolPath of [
      'tests/fixtures/phase0-workspace-mcp/server/mcp/tools/delete-project.ts',
      'tests/fixtures/phase0-workspace-mcp/server/mcp/tools/create-project.ts',
    ]) {
      const toolSource = readFileSync(resolve(process.cwd(), toolPath), 'utf8')
      expect(toolSource).not.toContain('/convex/')
      expect(toolSource).not.toContain('convex/features')
      expect(toolSource).toContain("from '../../../generated/operation-handles/mcp'")
      expect(toolSource).not.toContain('operation-refs')
      expect(toolSource).not.toContain('Descriptor')
    }

    const publicSurfaceFiles = [
      ...listSourceFiles(resolve(process.cwd(), 'tests/fixtures/phase0-workspace-mcp/server/mcp')),
      ...listSourceFiles(resolve(process.cwd(), 'tests/fixtures/phase0-workspace-mcp/shared')),
      ...listSourceFiles(
        resolve(process.cwd(), 'tests/fixtures/phase0-workspace-mcp/convex/features/projects'),
      ),
      resolve(process.cwd(), 'tests/fixtures/phase0-workspace-mcp/generated/operation-refs.ts'),
      resolve(
        process.cwd(),
        'tests/fixtures/phase0-workspace-mcp/generated/operation-handles/mcp.ts',
      ),
    ]

    const mcpRuntimePath = resolve(
      process.cwd(),
      'tests/fixtures/phase0-workspace-mcp/server/mcp/runtime.ts',
    )

    for (const path of publicSurfaceFiles) {
      if (path === mcpRuntimePath) continue
      const source = readFileSync(path, 'utf8')
      expect(source).not.toContain('src/runtime')
    }

    const runtimeSource = readFileSync(mcpRuntimePath, 'utf8')
    expect(runtimeSource).toContain("from '@lupinum/trellis/backend'")
    expect(runtimeSource).toContain('src/runtime/mcp/define-mcp-app')

    const operationRefsSource = readFileSync(
      resolve(process.cwd(), 'tests/fixtures/phase0-workspace-mcp/generated/operation-refs.ts'),
      'utf8',
    )
    expect(operationRefsSource).toContain('// AUTO-GENERATED. Do not edit.')
    expect(operationRefsSource).toContain("from '@lupinum/trellis/mcp'")
    expect(operationRefsSource).toContain("from '../convex/_generated/api'")
    expect(operationRefsSource).toContain('createProjectRef')
    expect(operationRefsSource).toContain('deleteProjectRef')
    expect(operationRefsSource).not.toContain('executeDeleteProjectRef')
    expect(operationRefsSource).not.toContain('{} as never')
    expect(operationRefsSource).not.toContain('src/runtime')

    const operationHandlesSource = readFileSync(
      resolve(
        process.cwd(),
        'tests/fixtures/phase0-workspace-mcp/generated/operation-handles/mcp.ts',
      ),
      'utf8',
    )
    expect(operationHandlesSource).toContain("from '@lupinum/trellis/mcp'")
    expect(operationHandlesSource).toContain("from '../operation-refs'")
    expect(operationHandlesSource).toContain('operations = {')
    expect(operationHandlesSource).toContain("'projects.create': createProjectHandle")
    expect(operationHandlesSource).toContain('executeRef: deleteProjectRef')
    expect(operationHandlesSource).not.toContain('/convex/')
    expect(operationHandlesSource).not.toContain('convex/features')
    expect(operationHandlesSource).not.toContain('src/runtime')

    const domainSource = readFileSync(
      resolve(
        process.cwd(),
        'tests/fixtures/phase0-workspace-mcp/convex/features/projects/domain.ts',
      ),
      'utf8',
    )
    expect(domainSource).toContain('mutation.workspace(createProjectOperation)')
    expect(domainSource).toContain('mutation.workspace.preview(deleteProjectOperation)')

    const generatedApiTypes = readFileSync(
      resolve(process.cwd(), 'tests/fixtures/phase0-workspace-mcp/convex/_generated/api.d.ts'),
      'utf8',
    )
    expect(generatedApiTypes).toContain('"features/projects/domain"')
  })

  it('routes destructive execute through operation-execute forwarding options', async () => {
    const { default: deleteProjectTool } =
      await import('../fixtures/phase0-workspace-mcp/server/mcp/tools/delete-project')
    const { convexCalls } = await import('../fixtures/phase0-workspace-mcp/server/mcp/runtime')
    convexCalls.length = 0
    const event = createEvent()
    useEventMock.mockReturnValue(event)

    const previewResult = (await deleteProjectTool.handler(
      { id: 'project-1' } as never,
      event as never,
    )) as {
      structuredContent?: {
        preview?: {
          confirmation?: { token?: string }
        }
      }
    }
    const confirmationToken = previewResult.structuredContent?.preview?.confirmation?.token
    expect(confirmationToken).toEqual(expect.any(String))

    await deleteProjectTool.handler(
      {
        id: 'project-1',
        _confirmationToken: confirmationToken,
      } as never,
      event as never,
    )

    expect(convexCalls).toEqual([
      {
        operation: 'mutation',
        args: { id: 'project-1' },
        options: {
          purpose: 'operation-preview',
          replay: {
            mode: 'jti-redemption',
            jti: expect.any(String),
          },
        },
      },
      {
        operation: 'mutation',
        args: { id: 'project-1' },
        options: {
          purpose: 'operation-preview',
          replay: {
            mode: 'jti-redemption',
            jti: expect.any(String),
          },
        },
      },
      {
        operation: 'mutation',
        args: {
          id: 'project-1',
        },
        options: {
          purpose: 'operation-execute',
          replay: {
            mode: 'operation-confirmation',
            jti: expect.any(String),
          },
        },
      },
    ])
  })
})
