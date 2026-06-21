import { previewOf } from '@lupinum/trellis/app'
import {
  can,
  enforce,
  loadTenantResource as loadResource,
} from '@lupinum/trellis/auth'

import {
  getRunbook,
  listRunbooks,
  searchRunbooks,
} from '../../../shared/features/runbooks/contract'
import type { Doc, Id } from '../../_generated/dataModel'
import type { QueryCtx } from '../../_generated/server'
import { mutation, query } from '../../functions'
import {
  bulkRemoveRunbooksOp,
  createRunbookOp,
  getWorkspaceRunbookOp,
  listWorkspaceRunbooksOp,
  removeRunbookOp,
  updateRunbookOp,
  workspaceOverviewOp,
} from './operations'
import { runbookRead } from './permissions'
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

type ReadDb = Pick<QueryCtx['db'], 'get' | 'query'>

export const listPublic = query.public({
  id: 'runbooks.list-public',
  reads: ['runbooks'],
  args: listRunbooks.args,
  crossTenant: {
    reason: 'Expose the public runbook catalog without a workspace appIdentity.',
    tables: ['runbooks'],
    access: ({ db }) => {
      const reader = db as ReadDb
      return {
        listPublicRunbooks: async () =>
          await reader
            .query('runbooks')
            .withIndex('by_visibility', (q: any) => q.eq('visibility', 'public'))
            .order('desc')
            .take(50),
      }
    },
  },
  handler: async (ctx) => {
    // Public by design, but still bounded to already-public records and a capped catalog read.
    const runbooks = await ctx.crossTenant.listPublicRunbooks()
    return runbooks.map(toPublicRunbook)
  },
})

export const searchPublic = query.public({
  id: 'runbooks.search-public',
  reads: ['runbooks'],
  args: searchRunbooks.args,
  crossTenant: {
    reason: 'Search the public runbook catalog across workspaces.',
    tables: ['runbooks'],
    access: ({ db }) => {
      const reader = db as ReadDb
      return {
        listPublicRunbooks: async () =>
          await reader
            .query('runbooks')
            .withIndex('by_visibility', (q: any) => q.eq('visibility', 'public'))
            .order('desc')
            .take(50),
      }
    },
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

export const listWorkspace = query.workspace(listWorkspaceRunbooksOp)

export const get = query.public({
  id: 'runbooks.get-public',
  reads: ['runbooks'],
  args: getRunbook.args,
  crossTenant: {
    reason: 'Read public runbooks before the caller resolves to a workspace appIdentity.',
    tables: ['runbooks'],
    access: ({ db }) => {
      const reader = db as ReadDb
      return {
        getRunbook: async (id: Id<'runbooks'>) => await reader.get(id),
      }
    },
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

    enforce(
      appIdentity,
      'Read runbooks',
      (identity) =>
        !!identity &&
        identity.workspaceId === runbook.workspaceId &&
        can(identity, runbookRead.check),
    )

    return workspaceRunbookCapabilities.attach(
      appIdentity,
      loadResource(appIdentity, runbook, 'Runbook'),
    )
  },
})

export const getWorkspace = query.workspace(getWorkspaceRunbookOp)

export const create = mutation.workspace(createRunbookOp)

export const update = mutation.workspace(updateRunbookOp)

export const previewRemove = mutation.workspace(previewOf(removeRunbookOp))
export const remove = mutation.workspace(removeRunbookOp)
export const previewBulkRemove = mutation.workspace(previewOf(bulkRemoveRunbooksOp))
export const bulkRemove = mutation.workspace(bulkRemoveRunbooksOp)

export const workspaceOverview = query.workspace(workspaceOverviewOp)
