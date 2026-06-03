import { v } from 'convex/values'
import { beforeAll, describe, expect, it } from 'vitest'

import {
  operation,
  operationPreview,
  previewOf,
  trellisWorkspaceScopeKey,
  workspaceScope,
} from '../../src/runtime/app'
import { open } from '../../src/runtime/auth'
import {
  getOperationMetadata,
  trellisOperationProjectionMetadataKey,
} from '../../src/runtime/functions'

describe('app entrypoint exports', () => {
  let appApi: typeof import('../../src/runtime/app/index')

  beforeAll(async () => {
    appApi = await import('../../src/runtime/app/index')
  })

  it('exports the beginner operation ladder API', () => {
    expect(appApi).toHaveProperty('operation')
    expect(appApi.operation).toHaveProperty('query')
    expect(appApi.operation).toHaveProperty('mutation')
    expect(appApi.operation).toHaveProperty('destructive')
    expect(appApi).toHaveProperty('workspaceScope')
    expect(appApi).toHaveProperty('operationPreview')
    expect(appApi).toHaveProperty('operationEffect')
    expect(appApi).toHaveProperty('operationIssue')
    expect(appApi).toHaveProperty('operationPreviewValidator')
    expect(appApi).toHaveProperty('blockedOperationPreview')
    expect(appApi).toHaveProperty('previewOf')
  })

  it('defines safe query and mutation operations through one metadata source', () => {
    const listTodos = operation.query({
      id: 'todos.list',
      args: {},
      guard: open,
      handler: async () => [{ title: 'Ship 0.2' }],
    })

    const createTodo = operation.mutation({
      id: 'todos.create',
      args: { title: v.string() },
      guard: open,
      handler: async () => ({ ok: true }),
    })

    expect(getOperationMetadata(listTodos)).toMatchObject({
      id: 'todos.list',
      kind: 'safe',
    })
    expect(getOperationMetadata(createTodo)).toMatchObject({
      id: 'todos.create',
      kind: 'safe',
    })
  })

  it('defines destructive operations with preview and safety metadata', () => {
    const args = { id: v.string() }
    const removeTodo = operation.destructive({
      id: 'todos.remove',
      args,
      guard: open,
      safety: 'destructive-write',
      preview: async () =>
        operationPreview({
          summary: 'Remove todo',
          confirm: { id: 'todo_1' },
        }),
      handler: async () => ({ removed: true }),
    })

    expect(getOperationMetadata(removeTodo)).toMatchObject({
      id: 'todos.remove',
      kind: 'destructive',
      safety: 'destructive-write',
    })

    const previewRemoveTodo = previewOf(removeTodo as never)

    expect(removeTodo.args).toBe(args)
    expect(previewRemoveTodo.args).toBe(args)
    expect(getOperationMetadata(previewRemoveTodo)).toEqual(getOperationMetadata(removeTodo))
    expect(previewRemoveTodo[trellisOperationProjectionMetadataKey]).toMatchObject({
      operationId: 'todos.remove',
      projection: 'preview',
    })
  })

  it('defines explicit workspace scope metadata without scoped database helpers', () => {
    const scope = workspaceScope()

    expect(scope).toEqual({
      _type: 'workspace-scope',
      field: 'workspaceId',
      required: true,
      [trellisWorkspaceScopeKey]: true,
    })
    expect(scope).not.toHaveProperty('table')
    expect(scope).not.toHaveProperty('insert')
  })

  it('injects validated ctx.workspaceId into scoped operation handlers', async () => {
    const listTodos = operation.query({
      id: 'todos.listScoped',
      args: {},
      scope: workspaceScope(),
      guard: open,
      load: async (ctx: { workspaceId: string }) => ({ loadedWorkspaceId: ctx.workspaceId }),
      handler: async (
        ctx: { workspaceId: string },
        _args: Record<string, never>,
        loaded: { loadedWorkspaceId: string },
      ) => ({
        workspaceId: ctx.workspaceId,
        loadedWorkspaceId: loaded.loadedWorkspaceId,
      }),
    })

    const rawCtx = { appIdentity: async () => ({ workspaceId: 'workspace_1' }) }
    const loaded = await listTodos.load?.(rawCtx as never, {})
    const result = await listTodos.handler(rawCtx as never, {}, loaded)

    expect(loaded).toEqual({ loadedWorkspaceId: 'workspace_1' })
    expect(result).toEqual({
      workspaceId: 'workspace_1',
      loadedWorkspaceId: 'workspace_1',
    })
  })

  it('injects validated ctx.workspaceId into scoped destructive previews', async () => {
    const removeTodo = operation.destructive({
      id: 'todos.removeScoped',
      args: { id: v.string() },
      scope: workspaceScope(),
      guard: open,
      safety: 'destructive-write',
      preview: async (ctx: { workspaceId: string }) =>
        operationPreview({
          summary: `Remove todo in ${ctx.workspaceId}`,
          confirm: { workspaceId: ctx.workspaceId },
        }),
      handler: async (ctx: { workspaceId: string }) => ({ workspaceId: ctx.workspaceId }),
    })

    const ctx = { appIdentity: async () => ({ workspaceId: 'workspace_1' }) } as never
    const args = {
      id: 'todo_1',
    }

    await expect(removeTodo.preview(ctx, args)).resolves.toMatchObject({
      summary: 'Remove todo in workspace_1',
      confirm: { workspaceId: 'workspace_1' },
    })
    await expect(removeTodo.handler(ctx, args, undefined)).resolves.toEqual({
      workspaceId: 'workspace_1',
    })
  })

  it('fails near the operation when scoped context has no workspaceId', async () => {
    const listTodos = operation.query({
      id: 'todos.listMissingScope',
      args: {},
      scope: workspaceScope(),
      guard: open,
      handler: async (ctx: { workspaceId: string }) => ctx.workspaceId,
    })

    await expect(
      listTodos.handler({ appIdentity: async () => null } as never, {}, undefined),
    ).rejects.toThrow('workspaceScope(...) requires ctx.appIdentity() to resolve workspaceId.')
  })

  it('rejects conflicting ctx.workspaceId values instead of adding a second tenant source', async () => {
    const listTodos = operation.query({
      id: 'todos.listConflictingScope',
      args: {},
      scope: workspaceScope(),
      guard: open,
      handler: async (ctx: { workspaceId: string }) => ctx.workspaceId,
    })

    await expect(
      listTodos.handler(
        {
          workspaceId: 'workspace_1',
          appIdentity: async () => ({ workspaceId: 'workspace_2' }),
        } as never,
        {},
        undefined,
      ),
    ).rejects.toThrow('workspaceScope(...) received conflicting ctx.workspaceId values.')
  })
})
