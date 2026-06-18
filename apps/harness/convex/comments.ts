import { deny } from '@lupinum/trellis/auth'
import { implementOperation } from '@lupinum/trellis/backend'

import { createCommentDescriptor } from '../shared/schemas/comment'
import { canCreateComment } from './auth/checks'
import { commentCreatePermission } from './auth/permissions'
import { loadResource } from './auth/scope'
import { mutation } from './functions'

export const createCommentOp = implementOperation(createCommentDescriptor, {
  identityForwardingTransport: 'mcp',
  permission: commentCreatePermission,
  handler: async (ctx, args) => {
    const appIdentity = await ctx.appIdentity()
    if (!appIdentity.workspaceId || !canCreateComment(appIdentity)) {
      throw deny('Cannot create comments in this workspace.')
    }
    const post = loadResource(appIdentity, await ctx.db.get(args.postId), 'Post')

    return await ctx.db.insert('comments', {
      postId: args.postId,
      content: args.content,
      ownerId: appIdentity.userId,
      organizationId: post.organizationId,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })
  },
})

export const create = mutation.workspace(createCommentOp)
