import type { FunctionReference } from 'convex/server'
import { v } from 'convex/values'
import type { H3Event } from 'h3'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { defineOperationDescriptor, defineOperationHandle } from '../../src/runtime/backend'
import { serverOperation } from '../../src/runtime/server'

const { useRuntimeConfigMock } = vi.hoisted(() => ({
  useRuntimeConfigMock: vi.fn(() => ({
    public: {
      convex: {
        url: 'http://127.0.0.1:3210',
        siteUrl: 'http://127.0.0.1:3220',
      },
    },
  })),
}))

const { useEventMock } = vi.hoisted(() => ({
  useEventMock: vi.fn(() => {
    throw new Error('Nitro request context is not available')
  }),
}))

vi.mock('nitropack/runtime', () => ({
  useRuntimeConfig: useRuntimeConfigMock,
  useEvent: useEventMock,
}))

vi.mock('#imports', () => ({
  useRuntimeConfig: useRuntimeConfigMock,
}))

function createEvent(): H3Event {
  return {
    __is_event__: true,
    node: {
      req: {
        headers: {},
      },
      res: {},
    },
  } as unknown as H3Event
}

function jsonResponse(value: unknown): Response {
  return new Response(JSON.stringify({ value }), {
    headers: { 'content-type': 'application/json' },
  })
}

function ref<TKind extends 'query' | 'mutation' | 'action', TArgs, TResult>(
  path: string,
): FunctionReference<TKind, 'public', TArgs, TResult> {
  return { _path: path } as unknown as FunctionReference<TKind, 'public', TArgs, TResult>
}

describe('serverOperation', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    useRuntimeConfigMock.mockReturnValue({
      public: {
        convex: {
          url: 'http://127.0.0.1:3210',
          siteUrl: 'http://127.0.0.1:3220',
        },
      },
    })
    useEventMock.mockImplementation(() => {
      throw new Error('Nitro request context is not available')
    })
  })

  it('queries through a generated server operation handle', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ items: ['p1'] }))
    vi.stubGlobal('fetch', fetchMock)
    const descriptor = defineOperationDescriptor({
      id: 'projects.list',
      kind: 'safe',
      args: { workspaceId: v.string() },
    })
    const operation = defineOperationHandle(descriptor, {
      executeRef: ref<'query', { workspaceId: string }, { items: string[] }>(
        'features/projects/domain:listProjects',
      ),
      executeOperation: 'query',
      runtimes: ['server'],
    })

    await expect(
      serverOperation(createEvent(), operation).query(
        { workspaceId: 'workspace_1' },
        {
          auth: 'none',
        },
      ),
    ).resolves.toEqual({ items: ['p1'] })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('http://127.0.0.1:3210/api/query')
    const body = JSON.parse(String(init.body))
    expect(body).toEqual({
      path: 'features/projects/domain:listProjects',
      args: { workspaceId: 'workspace_1' },
    })
  })

  it('previews and executes destructive operations with explicit confirmation', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          summary: 'Delete project',
          confirmation: { token: 'confirm-token', expiresAt: 123 },
        }),
      )
      .mockResolvedValueOnce(jsonResponse({ deleted: true }))
    vi.stubGlobal('fetch', fetchMock)
    const descriptor = defineOperationDescriptor({
      id: 'projects.delete',
      kind: 'destructive',
      args: { projectId: v.string() },
    })
    const operation = defineOperationHandle(descriptor, {
      executeRef: ref<
        'mutation',
        { projectId: string; _confirmationToken?: string },
        { deleted: true }
      >('features/projects/domain:deleteProject'),
      previewRef: ref<
        'mutation',
        { projectId: string },
        { summary: string; confirmation: { token: string; expiresAt: number } }
      >('features/projects/domain:previewDeleteProject'),
      executeOperation: 'mutation',
      previewOperation: 'mutation',
      runtimes: ['server'],
    })
    const adapter = serverOperation(createEvent(), operation)

    const preview = await adapter.preview({ projectId: 'project_1' }, { auth: 'none' })
    await expect(
      adapter.execute(
        { projectId: 'project_1' },
        {
          auth: 'none',
          confirmation: preview.confirmation,
        },
      ),
    ).resolves.toEqual({ deleted: true })

    const previewBody = JSON.parse(String((fetchMock.mock.calls[0]?.[1] as RequestInit).body))
    const executeBody = JSON.parse(String((fetchMock.mock.calls[1]?.[1] as RequestInit).body))
    expect(previewBody).toEqual({
      path: 'features/projects/domain:previewDeleteProject',
      args: { projectId: 'project_1' },
    })
    expect(executeBody).toEqual({
      path: 'features/projects/domain:deleteProject',
      args: { projectId: 'project_1', _confirmationToken: 'confirm-token' },
    })
  })

  it('executes action-backed operation handles through the action endpoint', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ queued: true }))
    vi.stubGlobal('fetch', fetchMock)
    const descriptor = defineOperationDescriptor({
      id: 'exports.start',
      kind: 'safe',
      args: { workspaceId: v.string() },
    })
    const operation = defineOperationHandle(descriptor, {
      executeRef: ref<'action', { workspaceId: string }, { queued: true }>(
        'features/exports/domain:startExport',
      ),
      executeOperation: 'action',
      runtimes: ['server'],
    })

    await expect(
      serverOperation(createEvent(), operation).execute(
        { workspaceId: 'workspace_1' },
        {
          auth: 'none',
        },
      ),
    ).resolves.toEqual({ queued: true })

    const [url] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('http://127.0.0.1:3210/api/action')
  })

  it('rejects handles that were not generated for the server runtime', () => {
    const descriptor = defineOperationDescriptor({
      id: 'projects.list',
      kind: 'safe',
      args: {},
    })
    const operation = defineOperationHandle(descriptor, {
      executeRef: ref<'query', Record<string, never>, null>(
        'features/projects/domain:listProjects',
      ),
      executeOperation: 'query',
      runtimes: ['mcp'],
    })

    expect(() => serverOperation(createEvent(), operation)).toThrow(
      'serverOperation(projects.list) requires a handle generated for the server runtime.',
    )
  })

  it('keeps query and execute lanes explicit', async () => {
    const descriptor = defineOperationDescriptor({
      id: 'projects.list',
      kind: 'safe',
      args: {},
    })
    const operation = defineOperationHandle(descriptor, {
      executeRef: ref<'query', Record<string, never>, null>(
        'features/projects/domain:listProjects',
      ),
      executeOperation: 'query',
      runtimes: ['server'],
    })

    await expect(
      serverOperation(createEvent(), operation).execute({}, { auth: 'none' }),
    ).rejects.toThrow(
      'serverOperation(projects.list).execute requires a mutation or action projection. Use .query(...) for query operations.',
    )
  })
})
