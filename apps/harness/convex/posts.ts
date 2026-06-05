import { operation } from '@lupinum/trellis/app'
import { defineArgs } from '@lupinum/trellis/args'
import { can } from '@lupinum/trellis/auth'
import {
  operationEffect,
  operationIssue,
  operationPreview,
  previewOf,
} from '@lupinum/trellis/backend'
import { defineRecordAccess } from '@lupinum/trellis/workspace'
import { v } from 'convex/values'

import { createPost, deletePost, removePostDescriptor, updatePost } from '../shared/schemas/post'
import type { Doc, Id } from './_generated/dataModel'
import type { AppIdentity } from './auth/appIdentity'
import type { InternalHarnessCaller } from './auth/caller'
import { canCreatePost, canDeletePost, canPublishPost, canUpdatePost } from './auth/checks'
import {
  postDeletePermission,
  postPublishPermission,
  postUpdatePermission,
} from './auth/permissions'
import { mutation, query } from './functions'

const listPostsArgs = defineArgs({
  args: {},
})

const getPostArgs = defineArgs({
  args: {
    id: v.id('posts'),
  },
})

type PostOperationCtx = {
  appIdentity: () => Promise<AppIdentity>
  caller: () => Promise<InternalHarnessCaller>
  db: {
    get(id: Id<'posts'>): Promise<Doc<'posts'> | null>
    delete?(id: Id<'posts'>): Promise<void>
  }
}
const postCapabilities = defineRecordAccess<{ ownerId: string; [key: string]: unknown }>()<
  AppIdentity,
  {
    'post.update': (
      appIdentity: AppIdentity,
      post: { ownerId: string; [key: string]: unknown },
    ) => boolean
    'post.delete': (
      appIdentity: AppIdentity,
      post: { ownerId: string; [key: string]: unknown },
    ) => boolean
    'post.publish': (
      appIdentity: AppIdentity,
      post: { ownerId: string; [key: string]: unknown },
    ) => boolean
  }
>({
  'post.update': (appIdentity, post) => can(appIdentity, canUpdatePost(post)),
  'post.delete': (appIdentity, post) => can(appIdentity, canDeletePost(post)),
  'post.publish': (appIdentity) => can(appIdentity, canPublishPost),
})

function formatAppIdentity(appIdentity: AppIdentity): string {
  if (!appIdentity) return 'null'
  return JSON.stringify({
    userId: appIdentity.userId,
    role: appIdentity.role,
    workspaceId: appIdentity.workspaceId ?? null,
    kind: appIdentity.kind,
  })
}

function denyPostPermission(
  action: 'create' | 'update' | 'delete' | 'publish',
  appIdentity: AppIdentity,
  reason: string,
): never {
  if (process.env.NODE_ENV === 'production') {
    throw new Error(`Forbidden: post.${action}`)
  }

  throw new Error(
    `Forbidden: post.${action}\nAppIdentity: ${formatAppIdentity(appIdentity)}\nReason: ${reason}`,
  )
}

function denyTenantMismatch(appIdentity: AppIdentity, post: { organizationId: string }): never {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Document belongs to a different isolation scope.')
  }

  throw new Error(
    `Document belongs to a different isolation scope.\nAppIdentity: ${formatAppIdentity(appIdentity)}\nReason: organizationId ${post.organizationId}`,
  )
}

export const list = query.authenticated({
  args: listPostsArgs.args,
  handler: async (ctx, _args) => {
    const appIdentity = await ctx.appIdentity()
    if (!appIdentity?.workspaceId) return []

    const posts = await ctx.db
      .query('posts')
      .withIndex('by_organization', (q) =>
        q.eq('organizationId', appIdentity.workspaceId as Id<'organizations'>),
      )
      .order('desc')
      .collect()

    return postCapabilities.attach(appIdentity, posts)
  },
})

export const get = query.authenticated({
  args: getPostArgs.args,
  handler: async (ctx, args) => {
    const appIdentity = await ctx.appIdentity()
    if (!appIdentity) return null

    const post = await ctx.db.get(args.id)
    if (!post) return null
    if (!appIdentity.workspaceId || appIdentity.workspaceId !== post.organizationId) return null

    return postCapabilities.attach(appIdentity, post)
  },
})

export const createPostOp = operation.mutation({
  id: 'posts.create',
  args: createPost.args,
  identityForwardingFunctionRef: 'posts:create',
  identityForwardingTransport: 'mcp',
  handler: async (ctx, args) => {
    const appIdentity = await ctx.appIdentity()
    if (!can(appIdentity, canCreatePost)) {
      denyPostPermission('create', appIdentity, `Role "${appIdentity.role}" cannot create posts.`)
    }
    if (!appIdentity.workspaceId) throw new Error('No organization selected')

    return await ctx.db.insert('posts', {
      title: args.title,
      content: args.content,
      status: 'draft',
      ownerId: appIdentity.userId,
      organizationId: appIdentity.workspaceId as Id<'organizations'>,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })
  },
})

export const create = mutation.authenticated(createPostOp)

export const updatePostOp = operation.mutation({
  id: 'posts.update',
  args: updatePost.args,
  permission: postUpdatePermission,
  handler: async (ctx, args) => {
    const appIdentity = await ctx.appIdentity()
    const post = await ctx.db.get(args.id)
    if (!post) throw new Error('Post not found.')
    if (!appIdentity?.workspaceId || appIdentity.workspaceId !== post.organizationId) {
      denyTenantMismatch(appIdentity, post)
    }
    if (!can(appIdentity, canUpdatePost(post))) {
      const reason =
        appIdentity?.role === 'member'
          ? 'Role "member" has own-only access.'
          : 'AppIdentity cannot update this post.'
      denyPostPermission('update', appIdentity, reason)
    }

    await ctx.db.patch(args.id, {
      ...(args.title !== undefined ? { title: args.title } : {}),
      ...(args.content !== undefined ? { content: args.content } : {}),
      updatedAt: Date.now(),
    })
  },
})

export const update = mutation.workspace(updatePostOp)

export const removePostDirectOp = operation.mutation({
  id: 'posts.remove.direct',
  args: deletePost.args,
  permission: postDeletePermission,
  handler: async (ctx, args) => {
    const appIdentity = await ctx.appIdentity()
    const post = await ctx.db.get(args.id)
    if (!post) throw new Error('Post not found.')
    if (!appIdentity?.workspaceId || appIdentity.workspaceId !== post.organizationId) {
      denyTenantMismatch(appIdentity, post)
    }
    if (!can(appIdentity, canDeletePost(post))) {
      const reason =
        appIdentity?.role === 'member'
          ? 'Role "member" has own-only access.'
          : 'AppIdentity cannot delete this post.'
      denyPostPermission('delete', appIdentity, reason)
    }
    await ctx.db.delete(args.id)
  },
})

export const remove = mutation.workspace(removePostDirectOp)

export const removePostOp = operation.destructive({
  id: removePostDescriptor.id,
  name: removePostDescriptor.name,
  args: removePostDescriptor.args,
  returns: removePostDescriptor.returns,
  previewReturns: removePostDescriptor.previewReturns,
  identityForwardingFunctionRef: 'posts:removeWithConfirmation',
  permission: postDeletePermission,
  safety: 'destructive-write',
  load: async (ctx: PostOperationCtx, args: { id: Id<'posts'> }) => {
    const appIdentity = await ctx.appIdentity()
    const post = await ctx.db.get(args.id)
    if (!post) throw new Error('Post not found.')
    if (!appIdentity?.workspaceId || appIdentity.workspaceId !== post.organizationId) {
      denyTenantMismatch(appIdentity, post)
    }
    if (!can(appIdentity, canDeletePost(post))) {
      const reason =
        appIdentity?.role === 'member'
          ? 'Role "member" has own-only access.'
          : 'AppIdentity cannot delete this post.'
      denyPostPermission('delete', appIdentity, reason)
    }

    return { post }
  },
  preview: async (
    _ctx: PostOperationCtx,
    _args: { id: Id<'posts'> },
    { post }: { post: Doc<'posts'> },
  ) =>
    operationPreview({
      summary: `Will permanently delete "${post.title}"`,
      warnings: [operationIssue({ code: 'irreversible', message: 'This cannot be undone' })],
      effects: [operationEffect({ kind: 'delete', summary: 'Delete one post', count: 1 })],
      confirm: {
        operation: 'posts.remove',
        targetId: post._id,
        affectedCounts: { posts: 1 },
      },
    }),
  handler: async (ctx: PostOperationCtx, args: { id: Id<'posts'> }) => {
    if (!ctx.db.delete) {
      throw new Error('Post removal requires a mutation context.')
    }
    await ctx.db.delete(args.id)
    return null
  },
})

export const removeWithConfirmation = mutation.workspace({
  ...removePostOp,
  identityForwardingFunctionRef: 'posts:removeWithConfirmation',
  identityForwardingTransport: 'mcp',
})
export const previewRemove = mutation.workspace({
  ...previewOf(removePostOp),
  identityForwardingFunctionRef: 'posts:previewRemove',
  identityForwardingTransport: 'mcp',
})

export const publishPostOp = operation.mutation({
  id: 'posts.publish',
  args: { id: v.id('posts') },
  permission: postPublishPermission,
  handler: async (ctx, args) => {
    const appIdentity = await ctx.appIdentity()
    const post = await ctx.db.get(args.id)
    if (!post) throw new Error('Post not found.')
    if (!appIdentity?.workspaceId || appIdentity.workspaceId !== post.organizationId) {
      denyTenantMismatch(appIdentity, post)
    }
    if (!can(appIdentity, canPublishPost)) {
      denyPostPermission(
        'publish',
        appIdentity,
        `Role "${appIdentity?.role ?? 'anonymous'}" cannot publish posts.`,
      )
    }

    await ctx.db.patch(args.id, {
      status: 'published',
      publishedAt: Date.now(),
      updatedAt: Date.now(),
    })
  },
})

export const publish = mutation.workspace(publishPostOp)
