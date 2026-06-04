import { operation } from '@lupinum/trellis/app'
import { can, deny } from '@lupinum/trellis/auth'
import { v } from 'convex/values'

import { runbookVisibilityValidator } from '../../../shared/features/runbooks/contract'
import type { Id } from '../../_generated/dataModel'
import type { MutationCtx } from '../../_generated/server'
import type { AppIdentity } from '../../auth/appIdentity'
import { mutation } from '../../functions'
import { runbookCreate, runbookPublish } from './permissions'

type CreateRunbookFromWebhookArgs = {
  deliveryId: string
  workspaceId: Id<'workspaces'>
  title: string
  summary: string
  content: string
  visibility?: 'public' | 'workspace' | 'draft'
  tags?: string[]
}

type WorkspaceMutationCtx = MutationCtx & {
  appIdentity: () => Promise<AppIdentity>
}
type WebhookDeliveryDb = {
  query: (table: 'runbookWebhookDeliveries') => {
    withIndex: (
      index: 'by_delivery_id',
      filter: (q: { eq: (field: 'deliveryId', value: string) => unknown }) => unknown,
    ) => { unique: () => Promise<unknown> }
  }
  insert: (
    table: 'runbookWebhookDeliveries',
    value: {
      deliveryId: string
      workspaceId: Id<'workspaces'>
      runbookId: Id<'runbooks'>
      createdAt: number
    },
  ) => Promise<unknown>
}

export const createRunbookFromWebhookOp = operation.mutation({
  id: 'runbooks.create-from-webhook',
  args: {
    deliveryId: v.string(),
    workspaceId: v.id('workspaces'),
    title: v.string(),
    summary: v.string(),
    content: v.string(),
    visibility: v.optional(runbookVisibilityValidator),
    tags: v.optional(v.array(v.string())),
  },
  identityForwardingFunctionRef: 'features/runbooks/webhooks:createRunbookFromWebhookMutation',
  identityForwardingTransport: 'webhook',
  guard: runbookCreate,
  handler: async (ctx: WorkspaceMutationCtx, args: CreateRunbookFromWebhookArgs) => {
    const appIdentity = await ctx.appIdentity()
    if (!appIdentity || appIdentity.workspaceId !== args.workspaceId) {
      throw deny('Webhook delegation is not valid for this workspace.')
    }

    const deliveryDb = ctx.db as WebhookDeliveryDb
    const existing = await deliveryDb
      .query('runbookWebhookDeliveries')
      .withIndex('by_delivery_id', (q) => q.eq('deliveryId', args.deliveryId))
      .unique()

    if (existing) {
      throw deny('Duplicate webhook delivery.')
    }

    const visibility = args.visibility ?? 'draft'
    if (visibility === 'public' && !can(appIdentity, runbookPublish.check)) {
      throw deny('Only owners and admins can create public runbooks.')
    }

    const now = Date.now()
    const runbookId = await ctx.db.insert('runbooks', {
      title: args.title,
      summary: args.summary,
      content: args.content,
      visibility,
      tags: args.tags ?? [],
      ownerId: appIdentity.userId as Id<'users'>,
      workspaceId: args.workspaceId,
      createdAt: now,
      updatedAt: now,
      ...(visibility === 'public' ? { publishedAt: now } : {}),
    })

    await deliveryDb.insert('runbookWebhookDeliveries', {
      deliveryId: args.deliveryId,
      workspaceId: args.workspaceId,
      runbookId,
      createdAt: now,
    })

    return runbookId
  },
})

export const createRunbookFromWebhookMutation = mutation.protected(createRunbookFromWebhookOp)
