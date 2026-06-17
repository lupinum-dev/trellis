import { operation } from '@lupinum/trellis/app'
import { v } from 'convex/values'

import {
  createPage,
  getPublishedPage,
  listDraftPages,
  listPublishedPages,
  listStudioPages,
  publishedPageValidator,
  saveDraft,
  studioPageValidator,
} from '../../../../../shared/features/pages/contract'
import type { Id } from '../../_generated/dataModel'
import type { MutationCtx, QueryCtx } from '../../_generated/server'
import { mutation, query, transportMutation } from '../../functions'
import { publishPageOp } from './operations'

type CreatePageArgs = { slug: string; title: string; draftBody?: string }
type SaveDraftArgs = { id: string; slug: string; title: string; draftBody: string }
type GetPublishedPageArgs = { slug: string }
type ManagePagesMutationCtx = MutationCtx & {
  appIdentity: () => Promise<
    { kind: 'viewer' } | { kind: 'editor'; authKey: string } | { kind: 'agent'; agentId: string }
  >
}

function toPublishedPage(page: {
  _id: Id<'pages'>
  slug: string
  title: string
  publishedBody: string
  status: 'draft' | 'published'
  updatedAt: number
  publishedAt?: number
  authorId: string
}) {
  return {
    _id: page._id,
    slug: page.slug,
    title: page.title,
    body: page.publishedBody,
    status: page.status,
    updatedAt: page.updatedAt,
    publishedAt: page.publishedAt ?? null,
    authorId: page.authorId,
  }
}

function toStudioPage(page: {
  _id: Id<'pages'>
  slug: string
  title: string
  draftBody: string
  publishedBody: string
  status: 'draft' | 'published'
  updatedAt: number
  publishedAt?: number
  authorId: string
}) {
  return {
    _id: page._id,
    slug: page.slug,
    title: page.title,
    draftBody: page.draftBody,
    publishedBody: page.publishedBody,
    status: page.status,
    updatedAt: page.updatedAt,
    publishedAt: page.publishedAt ?? null,
    authorId: page.authorId,
  }
}

export const listPublishedPagesOp = operation.query({
  id: 'pages.list-published',
  args: listPublishedPages.args,
  returns: v.array(publishedPageValidator),
  identityForwardingFunctionRef: 'features/pages/domain:listPublished',
  identityForwardingTransport: 'bridge',
  handler: async (ctx) => {
    const pages = await ctx.db
      .query('pages')
      .withIndex('by_status', (q: any) => q.eq('status', 'published'))
      .order('desc')
      .collect()

    return pages.map(toPublishedPage)
  },
})

export const listPublished = query.public({ ...listPublishedPagesOp, reads: ['pages'] })

export const getPublishedPageOp = operation.query({
  id: 'pages.get-published',
  args: getPublishedPage.args,
  returns: v.union(publishedPageValidator, v.null()),
  identityForwardingFunctionRef: 'features/pages/domain:getPublished',
  identityForwardingTransport: 'bridge',
  handler: async (ctx, args: GetPublishedPageArgs) => {
    const page = await ctx.db
      .query('pages')
      .withIndex('by_slug', (q: any) => q.eq('slug', args.slug))
      .unique()

    if (!page || page.status !== 'published') return null
    return toPublishedPage(page)
  },
})

export const getPublished = query.public({ ...getPublishedPageOp, reads: ['pages'] })

export const listStudioPagesOp = operation.query({
  id: 'pages.list-studio',
  args: listStudioPages.args,
  returns: v.array(studioPageValidator),
  identityForwardingFunctionRef: 'features/pages/domain:listStudio',
  identityForwardingTransport: 'bridge',
  handler: async (ctx: QueryCtx) => {
    const pages = await ctx.db.query('pages').order('desc').collect()
    return pages.map(toStudioPage)
  },
})

export const listStudio = query.authenticated(listStudioPagesOp)

export const listDraftPagesOp = operation.query({
  id: 'pages.list-draft',
  args: listDraftPages.args,
  returns: v.array(studioPageValidator),
  identityForwardingFunctionRef: 'features/pages/domain:listDraft',
  identityForwardingTransport: 'bridge',
  handler: async (ctx: QueryCtx) => {
    const pages = await ctx.db
      .query('pages')
      .withIndex('by_status', (q) => q.eq('status', 'draft'))
      .order('desc')
      .collect()

    return pages.map(toStudioPage)
  },
})

export const listDraft = query.authenticated(listDraftPagesOp)

export const createPageOp = operation.mutation({
  id: 'pages.create',
  args: createPage.args,
  returns: v.string(),
  identityForwardingFunctionRef: 'features/pages/domain:create',
  identityForwardingTransport: 'bridge',
  handler: async (ctx: ManagePagesMutationCtx, args: CreatePageArgs) => {
    const appIdentity = await ctx.appIdentity()
    const authorId =
      appIdentity.kind === 'agent'
        ? `agent:${appIdentity.agentId}`
        : appIdentity.kind === 'editor'
          ? appIdentity.authKey
          : (() => {
              throw new Error('Viewer cannot create pages.')
            })()

    const now = Date.now()
    return await ctx.db.insert('pages', {
      slug: args.slug.trim(),
      title: args.title.trim(),
      draftBody: args.draftBody?.trim() ?? '',
      publishedBody: '',
      status: 'draft',
      updatedAt: now,
      authorId,
    })
  },
})

export const create = mutation.authenticated(createPageOp)

export const saveDraftOp = operation.mutation({
  id: 'pages.save-draft',
  args: saveDraft.args,
  returns: v.null(),
  identityForwardingFunctionRef: 'features/pages/domain:save',
  identityForwardingTransport: 'bridge',
  handler: async (ctx: MutationCtx, args: SaveDraftArgs) => {
    await ctx.db.patch(args.id as Id<'pages'>, {
      slug: args.slug.trim(),
      title: args.title.trim(),
      draftBody: args.draftBody,
      updatedAt: Date.now(),
    })
    return null
  },
})

export const save = mutation.authenticated(saveDraftOp)

export const publish = transportMutation.authenticated(publishPageOp)
