import { createBridgeForwardingArgs } from '@lupinum/trellis-bridge/component'
import { operationPreviewValidator } from '@lupinum/trellis/backend'
import { anyApi } from 'convex/server'
import type { FunctionReference } from 'convex/server'
import { v } from 'convex/values'

import type { MiniCmsPrincipal } from '../../../shared/caller'
import {
  createPage as createPageSchema,
  getPublishedPage as getPublishedPageSchema,
  listDraftPages as listDraftPagesSchema,
  listPublishedPages as listPublishedPagesSchema,
  listStudioPages as listStudioPagesSchema,
  publishPage as publishPageSchema,
  publishPreviewValidator,
  publishedPageValidator,
  saveDraft as saveDraftSchema,
  studioPageValidator,
} from '../../../shared/features/pages/contract'
import { action, mutation, query } from '../../functions'

const publishedPageListValidator = v.array(publishedPageValidator)
const studioPageListValidator = v.array(studioPageValidator)
const publishResultValidator = v.object({
  pageId: v.string(),
  published: v.boolean(),
})
const publishPreviewResultValidator = operationPreviewValidator({
  details: publishPreviewValidator,
  confirm: v.object({
    operation: v.literal('pages.publish'),
    targetId: v.string(),
    affectedCounts: v.object({
      pages: v.number(),
    }),
  }),
})

async function bridgeForwardingArgs(
  ctx: { caller: () => Promise<MiniCmsPrincipal> },
  args: Record<string, unknown>,
  operation: 'query' | 'mutation' | 'action' | 'operation-execute',
  component: FunctionReference<'query' | 'mutation' | 'action', 'public' | 'internal'>,
  functionRef: string,
): Promise<Record<string, unknown>> {
  const caller = await ctx.caller()
  return createBridgeForwardingArgs(args, caller, undefined, operation, component, functionRef, {
    signedArgs: {},
  })
}

const bridgeApi = (anyApi as any).features.pages.bridge

export const listPublished = query.public({
  id: 'features/pages/domain:listPublished',
  reads: [],
  args: listPublishedPagesSchema.args,
  returns: publishedPageListValidator,
  handler: async (ctx) =>
    await ctx.runQuery(
      bridgeApi.listPublished,
      await bridgeForwardingArgs(
        ctx,
        {},
        'query',
        bridgeApi.listPublished,
        'features/pages/domain:listPublished',
      ),
    ),
})

export const getPublished = query.public({
  id: 'features/pages/domain:getPublished',
  reads: [],
  args: getPublishedPageSchema.args,
  returns: v.union(publishedPageValidator, v.null()),
  handler: async (ctx, args) =>
    await ctx.runQuery(
      bridgeApi.getPublished,
      await bridgeForwardingArgs(
        ctx,
        args,
        'query',
        bridgeApi.getPublished,
        'features/pages/domain:getPublished',
      ),
    ),
})

export const listStudio = query.public({
  id: 'features/pages/domain:listStudio',
  reads: [],
  args: listStudioPagesSchema.args,
  returns: studioPageListValidator,
  handler: async (ctx) =>
    await ctx.runQuery(
      bridgeApi.listStudio,
      await bridgeForwardingArgs(
        ctx,
        {},
        'query',
        bridgeApi.listStudio,
        'features/pages/domain:listStudio',
      ),
    ),
})

export const listDraft = query.public({
  id: 'features/pages/domain:listDraft',
  reads: [],
  args: listDraftPagesSchema.args,
  returns: studioPageListValidator,
  handler: async (ctx) =>
    await ctx.runQuery(
      bridgeApi.listDraft,
      await bridgeForwardingArgs(
        ctx,
        {},
        'query',
        bridgeApi.listDraft,
        'features/pages/domain:listDraft',
      ),
    ),
})

export const create = mutation.public({
  id: 'features/pages/domain:create',
  args: createPageSchema.args,
  returns: v.string(),
  handler: async (ctx, args) =>
    await ctx.runMutation(
      bridgeApi.create,
      await bridgeForwardingArgs(
        ctx,
        args,
        'mutation',
        bridgeApi.create,
        'features/pages/domain:create',
      ),
    ),
})

export const save = mutation.public({
  id: 'features/pages/domain:save',
  args: saveDraftSchema.args,
  returns: v.null(),
  handler: async (ctx, args) =>
    await ctx.runMutation(
      bridgeApi.save,
      await bridgeForwardingArgs(
        ctx,
        args,
        'mutation',
        bridgeApi.save,
        'features/pages/domain:save',
      ),
    ),
})

export const publish = mutation.public({
  id: 'features/pages/domain:publish',
  args: publishPageSchema.args,
  returns: publishResultValidator,
  handler: async (ctx, args) =>
    await ctx.runMutation(
      bridgeApi.publish,
      await bridgeForwardingArgs(
        ctx,
        args,
        'operation-execute',
        bridgeApi.publish,
        'features/pages/domain:publish',
      ),
    ),
})

if (!action) throw new Error('Component mini CMS bridge requires an action builder.')

export const publishAction = action.public({
  id: 'features/pages/domain:publishAction',
  args: publishPageSchema.args,
  returns: publishResultValidator,
  handler: async (ctx, args) =>
    await ctx.runMutation(
      bridgeApi.publish,
      await bridgeForwardingArgs(
        ctx,
        args,
        'operation-execute',
        bridgeApi.publish,
        'features/pages/domain:publish',
      ),
    ),
})

export const previewPublish = query.public({
  id: 'features/pages/domain:previewPublish',
  reads: [],
  args: publishPageSchema.args,
  returns: publishPreviewResultValidator,
  handler: async (ctx, args) =>
    await ctx.runQuery(
      bridgeApi.previewPublish,
      await bridgeForwardingArgs(
        ctx,
        args,
        'query',
        bridgeApi.previewPublish,
        'features/pages/operations:previewPublish',
      ),
    ),
})
