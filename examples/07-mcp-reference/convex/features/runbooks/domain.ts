import { operation, previewOf, workspaceScope } from '@lupinum/trellis/app'
import { can, deny, loadTenantResource as loadResource, requireRecord } from '@lupinum/trellis/auth'

import {
  createRunbook,
  getRunbook,
  listRunbooks,
  searchRunbooks,
  updateRunbook,
} from '../../../shared/features/runbooks/contract'
import type { Doc, Id } from '../../_generated/dataModel'
import type { MutationCtx, QueryCtx } from '../../_generated/server'
import type { AppIdentity } from '../../auth/appIdentity'
import { getAppIdentity } from '../../auth/appIdentity'
import { mutation, query } from '../../functions'
import { canUpdateRunbook } from './checks'
import { bulkRemoveRunbooksOp, removeRunbookOp } from './operations'
import { runbookCreate, runbookPublish, runbookRead } from './permissions'
import { publicRunbookCapabilities, workspaceRunbookCapabilities } from './recordAccess'

function toPublicRunbook(runbook: {
  _id: string
  title: string
  summary: string
  content: string
  tags: string[]
  visibility: 'public' | 'workspace' | 'draft'
  publishedAt?: number
}) {
  return {
    _id: runbook._id,
    title: runbook.title,
    summary: runbook.summary,
    content: runbook.content,
    tags: runbook.tags,
    visibility: runbook.visibility,
    publishedAt: runbook.publishedAt ?? null,
  }
}

function normalizeTerm(value: string): string {
  return value.trim().toLowerCase()
}

function matchesTerm(
  runbook: {
    title: string
    summary: string
    content: string
    tags: string[]
  },
  term: string,
): boolean {
  if (!term) return true

  const haystack =
    `${runbook.title}\n${runbook.summary}\n${runbook.content}\n${runbook.tags.join(' ')}`.toLowerCase()
  return haystack.includes(term)
}

type WorkspaceQueryCtx = QueryCtx & {
  workspaceId: Id<'workspaces'>
  appIdentity: () => Promise<AppIdentity>
}
type WorkspaceMutationCtx = MutationCtx & {
  workspaceId: Id<'workspaces'>
  appIdentity: () => Promise<AppIdentity>
}
type RunbookIdArgs = { id: Id<'runbooks'> }
type CreateRunbookArgs = {
  title: string
  summary: string
  content: string
  visibility?: 'public' | 'workspace' | 'draft'
  tags?: string[]
}
type UpdateRunbookArgs = {
  id: Id<'runbooks'>
  title?: string
  summary?: string
  content?: string
  visibility?: 'public' | 'workspace' | 'draft'
  tags?: string[]
}
type LoadedRunbook = { runbook: Doc<'runbooks'> }

export const listPublic = query.public({
  args: listRunbooks.args,
  crossTenant: {
    reason: 'Expose the public runbook catalog without a workspace appIdentity.',
    tables: ['runbooks'],
    access: ({ db }) => ({
      listPublicRunbooks: async () =>
        await db
          .query('runbooks')
          .withIndex('by_visibility', (q: any) => q.eq('visibility', 'public'))
          .order('desc')
          .take(50),
    }),
  },
  handler: async (ctx) => {
    // Public by design, but still bounded to already-public records and a capped catalog read.
    const runbooks = await ctx.crossTenant.listPublicRunbooks()
    return runbooks.map(toPublicRunbook)
  },
})

export const searchPublic = query.public({
  args: searchRunbooks.args,
  crossTenant: {
    reason: 'Search the public runbook catalog across workspaces.',
    tables: ['runbooks'],
    access: ({ db }) => ({
      listPublicRunbooks: async () =>
        await db
          .query('runbooks')
          .withIndex('by_visibility', (q: any) => q.eq('visibility', 'public'))
          .order('desc')
          .take(50),
    }),
  },
  handler: async (ctx, args) => {
    const term = normalizeTerm(args.term)
    // Search the same public catalog, but keep the candidate set bounded before local filtering.
    const candidates = await ctx.crossTenant.listPublicRunbooks()

    return candidates
      .filter((runbook: Doc<'runbooks'>) => matchesTerm(runbook, term))
      .map(toPublicRunbook)
  },
})

export const listWorkspaceRunbooksOp = operation.query({
  id: 'runbooks.list-workspace',
  args: listRunbooks.args,
  scope: workspaceScope(),
  guard: runbookRead,
  handler: async (ctx: WorkspaceQueryCtx) => {
    const appIdentity = await ctx.appIdentity()
    const runbooks = await ctx.db
      .query('runbooks')
      .withIndex('by_workspace', (q) => q.eq('workspaceId', ctx.workspaceId))
      .order('desc')
      .collect()

    return workspaceRunbookCapabilities.attach(appIdentity, runbooks)
  },
})

export const listWorkspace = query.protected(listWorkspaceRunbooksOp)

export const get = query.public({
  args: getRunbook.args,
  crossTenant: {
    reason: 'Read public runbooks before the caller resolves to a workspace appIdentity.',
    tables: ['runbooks'],
    access: ({ db }) => ({
      getRunbook: async (id: Id<'runbooks'>) => await db.get(id),
    }),
  },
  handler: async (ctx, args) => {
    // This query may cross-scopes, but only to read one public runbook before a workspace appIdentity is
    // available. Workspace-only records still fall back to the normal appIdentity checks below.
    const runbook = await ctx.crossTenant.getRunbook(args.id as Id<'runbooks'>)
    if (!runbook) return null

    const appIdentity = await ctx.appIdentity()

    if (runbook.visibility === 'public') {
      const withCapabilities = publicRunbookCapabilities.attach(appIdentity, {
        ...toPublicRunbook(runbook),
        ownerId: runbook.ownerId,
      })

      const { ownerId: _ownerId, ...publicRunbook } = withCapabilities
      return publicRunbook
    }

    if (
      !appIdentity ||
      appIdentity.workspaceId !== runbook.workspaceId ||
      !can(appIdentity, runbookRead.check)
    ) {
      deny('Forbidden: Read runbooks')
    }

    return workspaceRunbookCapabilities.attach(
      appIdentity,
      loadResource(appIdentity, runbook, 'Runbook'),
    )
  },
})

export const getWorkspaceRunbookOp = operation.query({
  id: 'runbooks.get-workspace',
  args: getRunbook.args,
  scope: workspaceScope(),
  guard: runbookRead,
  handler: async (ctx: WorkspaceQueryCtx, args: RunbookIdArgs) => {
    const appIdentity = await ctx.appIdentity()
    const runbook = await ctx.db.get(args.id)
    if (!runbook) return null

    return workspaceRunbookCapabilities.attach(
      appIdentity,
      loadResource(appIdentity, runbook, 'Runbook'),
    )
  },
})

export const getWorkspace = query.protected(getWorkspaceRunbookOp)

export const createRunbookOp = operation.mutation({
  id: 'runbooks.create',
  args: createRunbook.args,
  identityForwardingFunctionRef: 'features/runbooks/domain:create',
  scope: workspaceScope(),
  guard: runbookCreate,
  handler: async (ctx: WorkspaceMutationCtx, args: CreateRunbookArgs) => {
    const appIdentity = await ctx.appIdentity()

    const visibility = args.visibility ?? 'draft'
    if (visibility === 'public' && !can(appIdentity, runbookPublish.check)) {
      throw deny('Only owners and admins can create public runbooks.')
    }

    const now = Date.now()
    return await ctx.db.insert('runbooks', {
      title: args.title,
      summary: args.summary,
      content: args.content,
      visibility,
      tags: args.tags ?? [],
      ownerId: appIdentity.userId as Id<'users'>,
      workspaceId: ctx.workspaceId,
      createdAt: now,
      updatedAt: now,
      ...(visibility === 'public' ? { publishedAt: now } : {}),
    })
  },
})

export const create = mutation.protected(createRunbookOp)

export const updateRunbookOp = operation.mutation({
  id: 'runbooks.update',
  args: updateRunbook.args,
  scope: workspaceScope(),
  guard: runbookRead,
  load: async (ctx: WorkspaceMutationCtx, args: RunbookIdArgs): Promise<LoadedRunbook> => {
    const runbook = await ctx.db.get(args.id)
    requireRecord(runbook, 'Runbook')
    return { runbook }
  },
  authorize: {
    check: (_actor: AppIdentity, { runbook }: LoadedRunbook) => canUpdateRunbook(runbook),
  },
  handler: async (
    ctx: WorkspaceMutationCtx,
    args: UpdateRunbookArgs,
    { runbook }: LoadedRunbook,
  ) => {
    const appIdentity = await ctx.appIdentity()
    const nextVisibility = args.visibility ?? runbook.visibility
    if (nextVisibility === 'public' && !can(appIdentity, runbookPublish.check)) {
      throw deny('Only owners and admins can publish runbooks.')
    }

    await ctx.db.patch(args.id, {
      ...(args.title !== undefined ? { title: args.title } : {}),
      ...(args.summary !== undefined ? { summary: args.summary } : {}),
      ...(args.content !== undefined ? { content: args.content } : {}),
      ...(args.tags !== undefined ? { tags: args.tags } : {}),
      ...(args.visibility !== undefined ? { visibility: args.visibility } : {}),
      updatedAt: Date.now(),
      ...(nextVisibility === 'public' && runbook.visibility !== 'public'
        ? { publishedAt: Date.now() }
        : {}),
    })
  },
})

export const update = mutation.protected(updateRunbookOp)

export const previewRemove = mutation.protected(previewOf(removeRunbookOp))
export const remove = mutation.protected(removeRunbookOp)
export const previewBulkRemove = mutation.protected(previewOf(bulkRemoveRunbooksOp))
export const bulkRemove = mutation.protected(bulkRemoveRunbooksOp)

export const workspaceOverviewOp = operation.query({
  id: 'runbooks.workspace-overview',
  args: listRunbooks.args,
  scope: workspaceScope(),
  guard: runbookRead,
  handler: async (ctx: WorkspaceQueryCtx) => {
    const runbooks = await ctx.db
      .query('runbooks')
      .withIndex('by_workspace', (q) => q.eq('workspaceId', ctx.workspaceId))
      .order('desc')
      .collect()

    return {
      total: runbooks.length,
      public: runbooks.filter((runbook) => runbook.visibility === 'public').length,
      workspaceOnly: runbooks.filter((runbook) => runbook.visibility === 'workspace').length,
      drafts: runbooks.filter((runbook) => runbook.visibility === 'draft').length,
      recentTitles: runbooks.slice(0, 5).map((runbook) => runbook.title),
    }
  },
})

export const workspaceOverview = query.protected(workspaceOverviewOp)
