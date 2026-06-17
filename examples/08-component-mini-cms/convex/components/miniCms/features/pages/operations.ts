import {
  operation,
  operationEffect,
  operationIssue,
  operationPreview,
  operationPreviewValidator,
  previewOf,
} from '@lupinum/trellis/app'
import { requireRecord } from '@lupinum/trellis/auth'
import { v } from 'convex/values'

import { publishPage, publishPreviewValidator } from '../../../../../shared/features/pages/contract'
import type { Doc, Id } from '../../_generated/dataModel'
import { query } from '../../functions'

type PublishPageArgs = { id: string }
type LoadedPage = { page: Doc<'pages'> }
type PageOperationCtx = {
  db: {
    get: (id: Id<'pages'>) => Promise<Doc<'pages'> | null>
    patch?: (id: Id<'pages'>, value: Partial<Doc<'pages'>>) => Promise<void>
  }
}

export const publishPageOp = operation.destructive({
  id: 'pages.publish',
  executeFunctionRef: 'features/pages/domain:publish',
  identityForwardingTransport: 'bridge',
  args: publishPage.args,
  returns: v.object({
    pageId: v.string(),
    published: v.boolean(),
  }),
  safety: 'external-side-effect',
  previewReturns: operationPreviewValidator({
    details: publishPreviewValidator,
    confirm: v.object({
      operation: v.literal('pages.publish'),
      targetId: v.string(),
      affectedCounts: v.object({
        pages: v.number(),
      }),
    }),
  }),
  load: async (ctx: PageOperationCtx, args: PublishPageArgs): Promise<LoadedPage> => {
    const page = await ctx.db.get(args.id as Id<'pages'>)
    requireRecord(page, 'Page')
    return { page }
  },
  preview: async (_ctx: PageOperationCtx, _args: PublishPageArgs, { page }: LoadedPage) =>
    operationPreview({
      summary: `Publish "${page.title}" at /${page.slug}`,
      warnings: [
        operationIssue({
          code: page.status === 'published' ? 'republish-page' : 'publish-page',
          message:
            page.status === 'published'
              ? 'This republishes the current page body with the latest draft.'
              : 'This will make the draft visible on the public site.',
        }),
      ],
      effects: [operationEffect({ kind: 'pages', summary: 'Pages published', count: 1 })],
      details: {
        summary: `Publish "${page.title}" at /${page.slug}`,
        warn:
          page.status === 'published'
            ? 'This republishes the current page body with the latest draft.'
            : 'This will make the draft visible on the public site.',
        affects: { pages: 1 },
      },
      confirm: {
        operation: 'pages.publish',
        targetId: page._id,
        affectedCounts: { pages: 1 },
      },
    }),
  handler: async (ctx: PageOperationCtx, _args: PublishPageArgs, { page }: LoadedPage) => {
    const now = Date.now()
    if (!ctx.db.patch) throw new Error('Publish requires a mutation context.')
    await ctx.db.patch(page._id, {
      publishedBody: page.draftBody,
      status: 'published',
      updatedAt: now,
      publishedAt: now,
    })

    return {
      pageId: page._id,
      published: true,
    }
  },
})

export const previewPublish = query.authenticated({
  ...previewOf(publishPageOp),
  executeFunctionRef: 'features/pages/operations:previewPublish',
  identityForwardingTransport: 'bridge',
})
