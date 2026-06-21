import { operation } from '@lupinum/trellis/app'
import { deny } from '@lupinum/trellis/auth'

import {
  createWorkspace,
  listAccessibleWorkspaces as listAccessibleWorkspacesArgs,
  switchWorkspace as switchWorkspaceArgs,
} from '../../../shared/features/workspaces/contract'
import type { Id } from '../../_generated/dataModel'
import type { DatabaseReader, MutationCtx } from '../../_generated/server'
import { getMemberships, requireWorkspaceMembership } from '../../auth/agency'
import { getAppIdentity } from '../../auth/appIdentity'
import { mutation, query } from '../../functions'

async function getIdentityAuthKey(ctx: {
  auth: { getUserIdentity: () => Promise<{ tokenIdentifier?: string } | null> }
}) {
  const identity = await ctx.auth.getUserIdentity()
  return identity?.tokenIdentifier ?? null
}

type CreateWorkspaceArgs = { name: string; slug: string }
type SwitchWorkspaceArgs = { workspaceId: Id<'workspaces'> }

export const listAccessibleWorkspacesOp = operation.query({
  id: 'workspaces.list-accessible',
  args: listAccessibleWorkspacesArgs.args,
  crossTenant: {
    reason: 'Agency membership lookup spans multiple workspaces.',
    tables: ['memberships', 'workspaces'],
    access: ({ db }) => {
      const reader = db as DatabaseReader
      return {
        listAccessible: async (userId: Id<'users'>) => {
          const memberships = await getMemberships(reader, userId)

          return Promise.all(
            memberships.map(async (membership) => {
              const workspace = await reader.get('workspaces', membership.workspaceId)
              return {
                workspaceId: membership.workspaceId,
                role: membership.role,
                name: workspace?.name ?? String(membership.workspaceId),
              }
            }),
          )
        },
      }
    },
  },
  handler: async (ctx) => {
    const appIdentity = await getAppIdentity(ctx)
    if (!appIdentity) return []

    // This lookup crosses tenant boundaries only to resolve the caller's own memberships.
    return await ctx.crossTenant.listAccessible(appIdentity.userId)
  },
})

export const listAccessibleWorkspaces = query.public({
  ...listAccessibleWorkspacesOp,
  reads: ['users', 'memberships', 'workspaces'],
})

export const createWorkspaceOp = operation.publicMutation({
  id: 'workspaces.create',
  args: createWorkspace.args,
  publicWrite: {
    reason: 'Workspace bootstrap writes before the caller has a current tenant scope.',
    tables: ['users', 'workspaces', 'memberships'],
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
        createWorkspace: async (userId: Id<'users'>) => {
          const now = Date.now()
          const workspaceId = await writer.insert('workspaces', {
            name: args.name,
            slug: args.slug,
            ownerId: userId,
            createdAt: now,
            updatedAt: now,
          })

          await writer.insert('memberships', {
            userId,
            workspaceId,
            role: 'owner',
            createdAt: now,
          })

          return { workspaceId, now }
        },
        attachWorkspace: async (userId: Id<'users'>, workspaceId: Id<'workspaces'>, now: number) =>
          await (
            db as {
              patch: (
                table: 'users',
                id: Id<'users'>,
                value: { workspaceId: Id<'workspaces'>; updatedAt: number },
              ) => Promise<void>
            }
          ).patch('users', userId, {
            workspaceId,
            updatedAt: now,
          }),
      }
    },
  },
  handler: async (ctx, args: CreateWorkspaceArgs) => {
    const caller = await ctx.caller()
    if (caller.kind !== 'user' || !caller.authKey) {
      throw deny('Not authenticated.')
    }

    const user = await ctx.publicWrite.findUserByAuthKey(caller.authKey)
    if (!user) throw new Error('Current user row not found.')

    const existing = await ctx.publicWrite.findWorkspaceBySlug()

    if (existing) throw new Error('That workspace slug is already taken.')

    const { workspaceId, now } = await ctx.publicWrite.createWorkspace(user._id)

    await ctx.publicWrite.attachWorkspace(user._id, workspaceId, now)

    return workspaceId
  },
})

export const createWorkspaceMutation = mutation.public(createWorkspaceOp)

export const switchWorkspaceOp = operation.mutation({
  id: 'workspaces.switch',
  args: switchWorkspaceArgs.args,
  crossTenant: {
    reason: 'Workspace switching validates membership in another tenant.',
    tables: ['memberships'],
    access: ({ db }) => {
      const reader = db as DatabaseReader
      return {
        requireMembership: async (userId: Id<'users'>, workspaceId: Id<'workspaces'>) =>
          await requireWorkspaceMembership(reader, userId, workspaceId),
      }
    },
  },
  handler: async (ctx, args: SwitchWorkspaceArgs) => {
    const authKey = await getIdentityAuthKey(ctx)
    if (!authKey) throw deny('Not authenticated.')

    const user = await ctx.db
      .query('users')
      .withIndex('by_auth_key', (q: any) => q.eq('authKey', authKey))
      .first()

    if (!user) throw new Error('Current user row not found.')

    // Switching tenants validates membership in another workspace before patching the user's active
    // workspace pointer.
    await ctx.crossTenant.requireMembership(user._id, args.workspaceId)

    await ctx.db.patch(user._id, {
      workspaceId: args.workspaceId,
      updatedAt: Date.now(),
    })
  },
})

export const switchWorkspace = mutation.authenticated(switchWorkspaceOp)
