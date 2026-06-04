import { operation } from '@lupinum/trellis/app'
import { deny } from '@lupinum/trellis/auth'

import {
  createWorkspace,
  listAccessibleWorkspaces as listAccessibleWorkspacesArgs,
  switchWorkspace as switchWorkspaceArgs,
} from '../../../shared/features/workspaces/contract'
import type { Id } from '../../_generated/dataModel'
import type { DatabaseReader, DatabaseWriter } from '../../_generated/server'
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
    access: ({ db }: { db: DatabaseReader }) => ({
      listAccessible: async (userId: Id<'users'>) => {
        const memberships = await getMemberships(db, userId)

        return Promise.all(
          memberships.map(async (membership) => {
            const workspace = await db.get(membership.workspaceId)
            return {
              workspaceId: membership.workspaceId,
              role: membership.role,
              name: workspace?.name ?? String(membership.workspaceId),
            }
          }),
        )
      },
    }),
  },
  handler: async (ctx) => {
    const appIdentity = await getAppIdentity(ctx)
    if (!appIdentity) return []

    // This lookup crosses tenant boundaries only to resolve the caller's own memberships.
    return await ctx.crossTenant.listAccessible(appIdentity.userId)
  },
})

export const listAccessibleWorkspaces = query.public(listAccessibleWorkspacesOp)

export const createWorkspaceOp = operation.mutation({
  id: 'workspaces.create',
  args: createWorkspace.args,
  crossTenant: {
    mode: 'write',
    reason: 'Workspace bootstrap writes before the caller has a current tenant scope.',
    tables: ['workspaces', 'memberships'],
    access: ({ db }: { db: DatabaseWriter }) => ({
      findWorkspaceBySlug: async (slug: string) =>
        await db
          .query('workspaces')
          .withIndex('by_slug', (q) => q.eq('slug', slug))
          .first(),
      createWorkspace: async (args: CreateWorkspaceArgs & { userId: Id<'users'> }) => {
        const now = Date.now()
        const workspaceId = await db.insert('workspaces', {
          name: args.name,
          slug: args.slug,
          ownerId: args.userId,
          createdAt: now,
          updatedAt: now,
        })

        await db.insert('memberships', {
          userId: args.userId,
          workspaceId,
          role: 'owner',
          createdAt: now,
        })

        return { workspaceId, now }
      },
    }),
  },
  handler: async (ctx, args: CreateWorkspaceArgs) => {
    const authKey = await getIdentityAuthKey(ctx)
    if (!authKey) throw deny('Not authenticated.')

    const user = await ctx.db
      .query('users')
      .withIndex('by_auth_key', (q: any) => q.eq('authKey', authKey))
      .first()

    if (!user) throw new Error('Current user row not found.')

    const existing = await ctx.crossTenant.findWorkspaceBySlug(args.slug)

    if (existing) throw new Error('That workspace slug is already taken.')

    const { workspaceId, now } = await ctx.crossTenant.createWorkspace({
      ...args,
      userId: user._id,
    })

    await ctx.db.patch(user._id, {
      workspaceId,
      updatedAt: now,
    })

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
    access: ({ db }: { db: DatabaseReader }) => ({
      requireMembership: async (userId: Id<'users'>, workspaceId: Id<'workspaces'>) =>
        await requireWorkspaceMembership(db, userId, workspaceId),
    }),
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

export const switchWorkspace = mutation.public(switchWorkspaceOp)
