import { operation } from '@lupinum/trellis/app'

import { createWorkspace } from '../../../shared/features/workspaces/contract'
import type { Id } from '../../_generated/dataModel'
import type { MutationCtx } from '../../_generated/server'
import { mutation } from '../../functions'

type CreateWorkspaceArgs = { name: string; slug: string }

export const createWorkspaceOp = operation.publicMutation({
  id: 'workspaces.create',
  args: createWorkspace.args,
  publicWrite: {
    reason: 'Workspace bootstrap creates the first tenant for a signed-in user before app identity exists.',
    tables: ['users', 'workspaces'],
    access: ({ db, args }) => {
      const writer = db as MutationCtx['db']
      return {
        findWorkspaceBySlug: async () =>
          await writer
            .query('workspaces')
            .withIndex('by_slug', (q) => q.eq('slug', args.slug))
            .first(),
        findUserByAuthKey: async (authKey: string) =>
          await writer
            .query('users')
            .withIndex('by_auth_key', (q) => q.eq('authKey', authKey))
            .first(),
        createWorkspace: async (ownerId: Id<'users'>, now: number) =>
          await writer.insert('workspaces', {
            name: args.name,
            slug: args.slug,
            ownerId,
            createdAt: now,
            updatedAt: now,
          }),
        attachWorkspace: async (
          userId: Id<'users'>,
          workspaceId: Id<'workspaces'>,
          now: number,
        ) =>
          await (
            db as {
              patch: (
                table: 'users',
                id: Id<'users'>,
                value: { workspaceId: Id<'workspaces'>; role: 'owner'; updatedAt: number },
              ) => Promise<void>
            }
          ).patch('users', userId, {
            workspaceId,
            role: 'owner',
            updatedAt: now,
          }),
      }
    },
  },
  handler: async (ctx, _args: CreateWorkspaceArgs) => {
    const caller = await ctx.caller()
    if (caller.kind !== 'user' || !caller.authKey) {
      throw new Error('Workspace creation requires a signed-in user.')
    }
    const authKey = caller.authKey

    const existing = await ctx.publicWrite.findWorkspaceBySlug()
    if (existing) throw new Error('That workspace slug is already taken.')

    const user = await ctx.publicWrite.findUserByAuthKey(authKey)
    if (!user) throw new Error('Current user row not found.')

    const now = Date.now()
    const workspaceId = await ctx.publicWrite.createWorkspace(user._id, now)

    await ctx.publicWrite.attachWorkspace(user._id, workspaceId, now)

    return workspaceId
  },
})

export const createWorkspaceMutation = mutation.public(createWorkspaceOp)
