import { defineOperationDescriptor, operationPreviewValidator } from '@lupinum/trellis/backend'
import { v } from 'convex/values'

import {
  createPage,
  getPublishedPage,
  listDraftPages,
  listPublishedPages,
  listStudioPages,
  publishPage,
  publishPreviewValidator,
  publishedPageValidator,
  saveDraft,
  studioPageValidator,
} from './contract'

export const listPublishedPagesDescriptor = defineOperationDescriptor({
  id: 'pages.list-published',
  args: listPublishedPages.args,
  returns: v.array(publishedPageValidator),
})

export const getPublishedPageDescriptor = defineOperationDescriptor({
  id: 'pages.get-published',
  args: getPublishedPage.args,
  returns: v.union(publishedPageValidator, v.null()),
})

export const listStudioPagesDescriptor = defineOperationDescriptor({
  id: 'pages.list-studio',
  args: listStudioPages.args,
  returns: v.array(studioPageValidator),
})

export const listDraftPagesDescriptor = defineOperationDescriptor({
  id: 'pages.list-draft',
  args: listDraftPages.args,
  returns: v.array(studioPageValidator),
})

export const createPageDescriptor = defineOperationDescriptor({
  id: 'pages.create',
  args: createPage.args,
  returns: v.string(),
  safety: 'bounded-write',
})

export const saveDraftDescriptor = defineOperationDescriptor({
  id: 'pages.save-draft',
  args: saveDraft.args,
  returns: v.null(),
  safety: 'bounded-write',
})

export const publishPageDescriptor = defineOperationDescriptor({
  id: 'pages.publish',
  kind: 'destructive',
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
})
