/**
 * Why this file exists:
 * Articles combine the example's hard parts: visibility, redaction, enrollment,
 * prerequisites, share tokens, and inherited access.
 */
import { operation, previewOf, workspaceScope } from '@lupinum/trellis/app'
import {
  deny,
  enforce,
  loadTenantResource as loadResource,
  requireRecord,
} from '@lupinum/trellis/auth'

import {
  createArticle,
  createArticleShareToken,
  listArticles,
  markArticleCompleted,
  publishArticle,
  seedDemoArticles,
  viewArticle,
} from '../../../shared/features/articles/contract'
import type { Doc, Id } from '../../_generated/dataModel'
import type { DatabaseReader, MutationCtx, QueryCtx } from '../../_generated/server'
import type { AppIdentity } from '../../auth/appIdentity'
import { getAppIdentity } from '../../auth/appIdentity'
import { hasRole } from '../../auth/guards'
import { mutation, query } from '../../functions'
import { getInheritedAccessLevel, requireArticleAccess } from './access'
import { revokeShareTokenOp } from './operations'
import { articleCreate, articleRead, shareCreate } from './permissions'
import { projectArticle, redactArticle } from './redaction'
import {
  createShareTokenValue,
  hashShareToken,
  resolveShareToken,
  shareTokenPrefix,
} from './shareTokens'
import { canAccessArticleOwner, getArticleOwnerScope } from './visibility'

function isStaffActor(
  appIdentity: NonNullable<Awaited<ReturnType<typeof getAppIdentity>>>,
): boolean {
  return hasRole('owner', 'admin', 'editor')(appIdentity)
}

type WorkspaceQueryCtx = QueryCtx & {
  workspaceId: Id<'workspaces'>
  appIdentity: () => Promise<AppIdentity>
}
type WorkspaceMutationCtx = MutationCtx & {
  workspaceId: Id<'workspaces'>
  appIdentity: () => Promise<AppIdentity>
}
type ListArticlesArgs = { knowledgeBaseId: Id<'knowledgeBases'> }
type ViewArticleArgs = { id: Id<'articles'>; shareToken?: string }
type CreateArticleArgs = {
  knowledgeBaseId: Id<'knowledgeBases'>
  title: string
  body: string
  visibility: 'private' | 'team' | 'workspace'
  parentArticleId?: Id<'articles'>
  internalNotes?: string
  prerequisiteIds?: Id<'articles'>[]
  availableAfter?: number
}
type PublishArticleArgs = { id: Id<'articles'> }
type MarkArticleCompletedArgs = { articleId: Id<'articles'> }
type CreateShareTokenArgs = {
  articleId: Id<'articles'>
  level: 'view' | 'comment' | 'edit'
  expiresInMs?: number
}
type SeedDemoArticlesArgs = { knowledgeBaseId: Id<'knowledgeBases'> }
type LoadedKnowledgeBase = { knowledgeBase: Doc<'knowledgeBases'> }
type LoadedArticle = { article: Doc<'articles'> }

export const listArticlesOp = operation.query({
  id: 'articles.list',
  guard: articleRead,
  args: listArticles.args,
  scope: workspaceScope(),
  load: async (ctx: WorkspaceQueryCtx, args: ListArticlesArgs): Promise<LoadedKnowledgeBase> => ({
    knowledgeBase: loadResource(
      await ctx.appIdentity(),
      (await ctx.db.get(args.knowledgeBaseId)) as Doc<'knowledgeBases'> | null,
      'Knowledge base',
    ),
  }),
  handler: async (ctx: WorkspaceQueryCtx, _args: ListArticlesArgs, { knowledgeBase }) => {
    const appIdentity = await ctx.appIdentity()

    const allArticles = await ctx.db
      .query('articles')
      .withIndex('by_knowledge_base', (q) => q.eq('knowledgeBaseId', knowledgeBase._id))
      .order('desc')
      .collect()

    const ownerScope = await getArticleOwnerScope(ctx.db, appIdentity)

    return allArticles
      .filter((article) => {
        if (isStaffActor(appIdentity) && canAccessArticleOwner(ownerScope, article.ownerId))
          return true
        if (article.status !== 'published') return false
        if (article.visibility === 'workspace') return true
        if (article.visibility === 'team') return canAccessArticleOwner(ownerScope, article.ownerId)
        if (article.visibility === 'private') return article.ownerId === appIdentity.userId
        return false
      })
      .map((article) => redactArticle(appIdentity, article))
  },
})

export const list = query.protected(listArticlesOp)

export const viewArticleOp = operation.query({
  id: 'articles.view',
  args: viewArticle.args,
  crossTenant: {
    reason: 'Resolve share-token reads across-scope boundaries.',
    tables: ['shareTokens', 'articles'],
    access: ({ db }: { db: DatabaseReader }) => ({
      resolveSharedArticle: async (args: Required<Pick<ViewArticleArgs, 'shareToken' | 'id'>>) => {
        const grant = await resolveShareToken(db, args.shareToken)
        if (grant.articleId !== args.id) throw deny('Token does not match this article.')
        const article = await db.get(args.id)
        requireRecord(article, 'Article')
        return { article, grant }
      },
    }),
  },
  handler: async (ctx, args: ViewArticleArgs) => {
    if (args.shareToken) {
      const { article, grant } = await ctx.crossTenant.resolveSharedArticle({
        shareToken: args.shareToken,
        id: args.id,
      })
      return projectArticle(null, article, (safeArticle) => ({
        ...safeArticle,
        _access: grant.level,
      }))
    }

    const appIdentity = await getAppIdentity(ctx)
    enforce(appIdentity, 'Read articles', articleRead.check)

    const article = loadResource(appIdentity, await ctx.db.get(args.id), 'Article')
    await requireArticleAccess(ctx.db, appIdentity, article)

    const accessLevel = await getInheritedAccessLevel(ctx.db, appIdentity, article._id)
    return projectArticle(appIdentity, article, (safeArticle) => ({
      ...safeArticle,
      _access: accessLevel,
    }))
  },
})

export const view = query.public(viewArticleOp)

export const createArticleOp = operation.mutation({
  id: 'articles.create',
  guard: articleCreate,
  args: createArticle.args,
  scope: workspaceScope(),
  load: async (
    ctx: WorkspaceMutationCtx,
    args: CreateArticleArgs,
  ): Promise<LoadedKnowledgeBase> => ({
    knowledgeBase: loadResource(
      await ctx.appIdentity(),
      (await ctx.db.get(args.knowledgeBaseId)) as Doc<'knowledgeBases'> | null,
      'Knowledge base',
    ),
  }),
  handler: async (ctx: WorkspaceMutationCtx, args: CreateArticleArgs) => {
    const appIdentity = await ctx.appIdentity()

    const now = Date.now()
    return ctx.db.insert('articles', {
      workspaceId: ctx.workspaceId,
      knowledgeBaseId: args.knowledgeBaseId,
      title: args.title,
      body: args.body,
      status: 'draft',
      visibility: args.visibility,
      parentArticleId: args.parentArticleId,
      ownerId: appIdentity.userId,
      internalNotes: args.internalNotes,
      prerequisiteIds: args.prerequisiteIds,
      availableAfter: args.availableAfter,
      createdAt: now,
      updatedAt: now,
    })
  },
})

export const create = mutation.protected(createArticleOp)

export const publishArticleOp = operation.mutation({
  id: 'articles.publish',
  guard: articleCreate,
  args: publishArticle.args,
  scope: workspaceScope(),
  load: async (ctx: WorkspaceMutationCtx, args: PublishArticleArgs): Promise<LoadedArticle> => ({
    article: loadResource(
      await ctx.appIdentity(),
      (await ctx.db.get(args.id)) as Doc<'articles'> | null,
      'Article',
    ),
  }),
  handler: async (ctx: WorkspaceMutationCtx, args: PublishArticleArgs, { article }) => {
    if (article.status === 'published') throw deny('Already published.')
    await ctx.db.patch(args.id, { status: 'published', updatedAt: Date.now() })
  },
})

export const publish = mutation.protected(publishArticleOp)

export const markArticleCompletedOp = operation.mutation({
  id: 'articles.mark-completed',
  guard: articleRead,
  args: markArticleCompleted.args,
  scope: workspaceScope(),
  load: async (
    ctx: WorkspaceMutationCtx,
    args: MarkArticleCompletedArgs,
  ): Promise<LoadedArticle> => ({
    article: loadResource(
      await ctx.appIdentity(),
      (await ctx.db.get(args.articleId)) as Doc<'articles'> | null,
      'Article',
    ),
  }),
  handler: async (ctx: WorkspaceMutationCtx, args: MarkArticleCompletedArgs) => {
    const appIdentity = await ctx.appIdentity()

    const existing = await ctx.db
      .query('articleProgress')
      .withIndex('by_user_article', (q) =>
        q.eq('userId', appIdentity.userId).eq('articleId', args.articleId),
      )
      .first()

    if (existing) {
      if (!existing.completedAt) {
        await ctx.db.patch(existing._id, { completedAt: Date.now() })
      }
      return existing._id
    }

    return ctx.db.insert('articleProgress', {
      workspaceId: ctx.workspaceId,
      userId: appIdentity.userId,
      articleId: args.articleId,
      completedAt: Date.now(),
      createdAt: Date.now(),
    })
  },
})

export const markCompleted = mutation.protected(markArticleCompletedOp)

export const createArticleShareTokenOp = operation.mutation({
  id: 'shareTokens.create',
  guard: shareCreate,
  args: createArticleShareToken.args,
  scope: workspaceScope(),
  load: async (ctx: WorkspaceMutationCtx, args: CreateShareTokenArgs): Promise<LoadedArticle> => ({
    article: loadResource(
      await ctx.appIdentity(),
      (await ctx.db.get(args.articleId)) as Doc<'articles'> | null,
      'Article',
    ),
  }),
  handler: async (ctx: WorkspaceMutationCtx, args: CreateShareTokenArgs) => {
    const token = createShareTokenValue()
    const hash = await hashShareToken(token)

    await ctx.db.insert('shareTokens', {
      workspaceId: ctx.workspaceId,
      articleId: args.articleId,
      prefix: shareTokenPrefix(token),
      hash,
      level: args.level,
      expiresAt: args.expiresInMs ? Date.now() + args.expiresInMs : undefined,
      createdAt: Date.now(),
    })

    return token
  },
})

export const createShareToken = mutation.protected(createArticleShareTokenOp)

export const previewRevokeShareToken = mutation.protected(previewOf(revokeShareTokenOp))
export const revokeShareToken = mutation.protected(revokeShareTokenOp)

export const seedDemoArticlesOp = operation.mutation({
  id: 'articles.seed-demo',
  guard: articleCreate,
  args: seedDemoArticles.args,
  scope: workspaceScope(),
  load: async (
    ctx: WorkspaceMutationCtx,
    args: SeedDemoArticlesArgs,
  ): Promise<LoadedKnowledgeBase> => ({
    knowledgeBase: loadResource(
      await ctx.appIdentity(),
      (await ctx.db.get(args.knowledgeBaseId)) as Doc<'knowledgeBases'> | null,
      'Knowledge base',
    ),
  }),
  handler: async (ctx: WorkspaceMutationCtx, args: SeedDemoArticlesArgs) => {
    const appIdentity = await ctx.appIdentity()

    const now = Date.now()
    const introId = await ctx.db.insert('articles', {
      workspaceId: ctx.workspaceId,
      knowledgeBaseId: args.knowledgeBaseId,
      title: 'Getting Started',
      body: 'Welcome to the knowledge base. This is the intro article.',
      status: 'published',
      visibility: 'workspace',
      ownerId: appIdentity.userId,
      createdAt: now,
      updatedAt: now,
    })

    await ctx.db.insert('articles', {
      workspaceId: ctx.workspaceId,
      knowledgeBaseId: args.knowledgeBaseId,
      title: 'Advanced Topics',
      body: 'Deep dive into advanced patterns. Requires completing the intro first.',
      status: 'published',
      visibility: 'workspace',
      ownerId: appIdentity.userId,
      prerequisiteIds: [introId],
      createdAt: now,
      updatedAt: now,
    })

    await ctx.db.insert('articles', {
      workspaceId: ctx.workspaceId,
      knowledgeBaseId: args.knowledgeBaseId,
      title: 'Internal Review Notes',
      body: 'Sensitive review content for editors only.',
      status: 'published',
      visibility: 'team',
      ownerId: appIdentity.userId,
      internalNotes: 'Needs legal review before Q3.',
      draftFeedback: 'Consider restructuring section 2.',
      createdAt: now,
      updatedAt: now,
    })

    return introId
  },
})

export const seed = mutation.protected(seedDemoArticlesOp)
