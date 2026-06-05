import { operation, workspaceScope } from '@lupinum/trellis/app'
import { deny, loadTenantResource as loadResource, requireAuth } from '@lupinum/trellis/auth'

import {
  createKnowledgeBase,
  enrollKnowledgeBaseUser,
  enrollKnowledgeBaseUserByEmail,
  getKnowledgeBase,
  listKnowledgeBases,
  publishKnowledgeBase,
} from '../../../shared/features/knowledgeBases/contract'
import type { Doc, Id } from '../../_generated/dataModel'
import type { MutationCtx, QueryCtx } from '../../_generated/server'
import type { AppIdentity } from '../../auth/appIdentity'
import { mutation, query } from '../../functions'
import { enrollmentManage, kbCreate, kbRead } from './permissions'

type WorkspaceQueryCtx = QueryCtx & {
  workspaceId: Id<'workspaces'>
  appIdentity: () => Promise<AppIdentity>
}
type WorkspaceMutationCtx = MutationCtx & {
  workspaceId: Id<'workspaces'>
  appIdentity: () => Promise<AppIdentity>
}
type KnowledgeBaseIdArgs = { id: Id<'knowledgeBases'> }
type CreateKnowledgeBaseArgs = { title: string }
type EnrollKnowledgeBaseUserArgs = { knowledgeBaseId: Id<'knowledgeBases'>; userId: Id<'users'> }
type EnrollKnowledgeBaseUserByEmailArgs = { knowledgeBaseId: Id<'knowledgeBases'>; email: string }
type LoadedKnowledgeBase = { knowledgeBase: Doc<'knowledgeBases'> }

export const listKnowledgeBasesOp = operation.query({
  id: 'knowledgeBases.list',
  permission: kbRead,
  args: listKnowledgeBases.args,
  scope: workspaceScope(),
  handler: async (ctx: WorkspaceQueryCtx) => {
    return ctx.db
      .query('knowledgeBases')
      .withIndex('by_workspace', (q) => q.eq('workspaceId', ctx.workspaceId))
      .order('desc')
      .collect()
  },
})

export const list = query.workspace(listKnowledgeBasesOp)

export const getKnowledgeBaseOp = operation.query({
  id: 'knowledgeBases.get',
  permission: kbRead,
  args: getKnowledgeBase.args,
  scope: workspaceScope(),
  load: async (
    ctx: WorkspaceQueryCtx,
    args: KnowledgeBaseIdArgs,
  ): Promise<LoadedKnowledgeBase> => ({
    knowledgeBase: loadResource(
      await ctx.appIdentity(),
      (await ctx.db.get(args.id)) as Doc<'knowledgeBases'> | null,
      'Knowledge base',
    ),
  }),
  handler: async (_ctx, _args, { knowledgeBase }) => knowledgeBase,
})

export const get = query.workspace(getKnowledgeBaseOp)

export const createKnowledgeBaseOp = operation.mutation({
  id: 'knowledgeBases.create',
  permission: kbCreate,
  args: createKnowledgeBase.args,
  scope: workspaceScope(),
  handler: async (ctx: WorkspaceMutationCtx, args: CreateKnowledgeBaseArgs) => {
    const appIdentity = await ctx.appIdentity()
    requireAuth(appIdentity)

    const now = Date.now()
    return ctx.db.insert('knowledgeBases', {
      workspaceId: ctx.workspaceId,
      title: args.title,
      status: 'draft',
      ownerId: appIdentity.userId,
      createdAt: now,
      updatedAt: now,
    })
  },
})

export const create = mutation.workspace(createKnowledgeBaseOp)

export const publishKnowledgeBaseOp = operation.mutation({
  id: 'knowledgeBases.publish',
  permission: kbCreate,
  args: publishKnowledgeBase.args,
  scope: workspaceScope(),
  load: async (
    ctx: WorkspaceMutationCtx,
    args: KnowledgeBaseIdArgs,
  ): Promise<LoadedKnowledgeBase> => ({
    knowledgeBase: loadResource(
      await ctx.appIdentity(),
      (await ctx.db.get(args.id)) as Doc<'knowledgeBases'> | null,
      'Knowledge base',
    ),
  }),
  handler: async (ctx, args, { knowledgeBase }) => {
    if (knowledgeBase.status === 'published') throw deny('Already published.')
    await ctx.db.patch(args.id, { status: 'published', updatedAt: Date.now() })
  },
})

export const publish = mutation.workspace(publishKnowledgeBaseOp)

export const enrollKnowledgeBaseUserOp = operation.mutation({
  id: 'knowledgeBases.enroll',
  permission: enrollmentManage,
  args: enrollKnowledgeBaseUser.args,
  scope: workspaceScope(),
  load: async (
    ctx: WorkspaceMutationCtx,
    args: EnrollKnowledgeBaseUserArgs,
  ): Promise<LoadedKnowledgeBase> => ({
    knowledgeBase: loadResource(
      await ctx.appIdentity(),
      (await ctx.db.get(args.knowledgeBaseId)) as Doc<'knowledgeBases'> | null,
      'Knowledge base',
    ),
  }),
  handler: async (
    ctx: WorkspaceMutationCtx,
    args: EnrollKnowledgeBaseUserArgs,
    { knowledgeBase }: LoadedKnowledgeBase,
  ) => {
    const existing = await ctx.db
      .query('enrollments')
      .withIndex('by_user_kb', (q) =>
        q.eq('userId', args.userId).eq('knowledgeBaseId', knowledgeBase._id),
      )
      .first()

    if (existing?.status === 'active') return existing._id

    if (existing) {
      await ctx.db.patch(existing._id, { status: 'active' })
      return existing._id
    }

    return ctx.db.insert('enrollments', {
      workspaceId: ctx.workspaceId,
      userId: args.userId,
      knowledgeBaseId: knowledgeBase._id,
      status: 'active',
      createdAt: Date.now(),
    })
  },
})

export const enroll = mutation.workspace(enrollKnowledgeBaseUserOp)

export const enrollKnowledgeBaseUserByEmailOp = operation.mutation({
  id: 'knowledgeBases.enroll-by-email',
  permission: enrollmentManage,
  args: enrollKnowledgeBaseUserByEmail.args,
  scope: workspaceScope(),
  load: async (
    ctx: WorkspaceMutationCtx,
    args: EnrollKnowledgeBaseUserByEmailArgs,
  ): Promise<LoadedKnowledgeBase> => ({
    knowledgeBase: loadResource(
      await ctx.appIdentity(),
      (await ctx.db.get(args.knowledgeBaseId)) as Doc<'knowledgeBases'> | null,
      'Knowledge base',
    ),
  }),
  handler: async (
    ctx: WorkspaceMutationCtx,
    args: EnrollKnowledgeBaseUserByEmailArgs,
    { knowledgeBase }: LoadedKnowledgeBase,
  ) => {
    const user = await ctx.db
      .query('users')
      .withIndex('by_email', (q) => q.eq('email', args.email))
      .first()
    if (!user) throw new Error(`No user found with email "${args.email}".`)

    const existing = await ctx.db
      .query('enrollments')
      .withIndex('by_user_kb', (q) =>
        q.eq('userId', user._id).eq('knowledgeBaseId', knowledgeBase._id),
      )
      .first()

    if (existing?.status === 'active') return existing._id

    if (existing) {
      await ctx.db.patch(existing._id, { status: 'active' })
      return existing._id
    }

    return ctx.db.insert('enrollments', {
      workspaceId: ctx.workspaceId,
      userId: user._id,
      knowledgeBaseId: knowledgeBase._id,
      status: 'active',
      createdAt: Date.now(),
    })
  },
})

export const enrollByEmail = mutation.workspace(enrollKnowledgeBaseUserByEmailOp)
