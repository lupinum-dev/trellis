import { operation } from '@lupinum/trellis/app'

import { createWorkspace } from '../../../shared/features/workspaces/contract'
import type { MutationCtx } from '../../_generated/server'
import type { McpReferencePrincipal } from '../../auth/caller'
import { mutation } from '../../functions'

type WorkspaceBootstrapCtx = MutationCtx & {
  caller: () => Promise<McpReferencePrincipal>
  crossTenant: {
    seedRunbooks: (input: { workspaceId: string; userId: string; now: number }) => Promise<void>
  }
}
type CreateWorkspaceArgs = { name: string; slug: string }

export const createWorkspaceOp = operation.mutation({
  id: 'workspaces.create',
  args: createWorkspace.args,
  crossTenant: {
    mode: 'write',
    reason: 'Seed onboarding runbooks before the new workspace is appIdentity-scoped.',
    tables: ['runbooks'],
    access: ({ db }) => ({
      seedRunbooks: async (input: { workspaceId: string; userId: string; now: number }) => {
        const writer = db as typeof db & {
          insert: (table: string, value: unknown) => Promise<unknown>
        }
        await writer.insert('runbooks', {
          title: 'Public onboarding guide',
          summary: 'A public runbook that demonstrates the unauthenticated MCP surface.',
          content: [
            '# Public onboarding guide',
            '',
            '- Public tools can list and search this runbook without auth.',
            '- Scoped tools operate on workspace runbooks after MCP key auth succeeds.',
            '- Sessions enable stored preferences and dynamic per-session tools.',
          ].join('\n'),
          visibility: 'public',
          tags: ['public', 'onboarding'],
          ownerId: input.userId,
          workspaceId: input.workspaceId,
          createdAt: input.now,
          updatedAt: input.now,
          publishedAt: input.now,
        })

        await writer.insert('runbooks', {
          title: 'Internal incident checklist',
          summary: 'A workspace-only runbook seeded so the authenticated MCP tools have content.',
          content: [
            '# Internal incident checklist',
            '',
            '1. Acknowledge the incident.',
            '2. Assign an owner.',
            '3. Capture current impact and next update time.',
          ].join('\n'),
          visibility: 'workspace',
          tags: ['incident', 'ops'],
          ownerId: input.userId,
          workspaceId: input.workspaceId,
          createdAt: input.now,
          updatedAt: input.now,
        })
      },
    }),
  },
  handler: async (ctx: WorkspaceBootstrapCtx, args: CreateWorkspaceArgs) => {
    const caller = await ctx.caller()
    if (caller.kind !== 'user') {
      throw new Error('Workspace creation requires a signed-in user caller.')
    }

    const existing = await ctx.db
      .query('workspaces')
      .withIndex('by_slug', (q) => q.eq('slug', args.slug))
      .first()

    if (existing) throw new Error('That workspace slug is already taken.')

    const user = await ctx.db
      .query('users')
      .withIndex('by_auth_key', (q) => q.eq('authKey', caller.authKey))
      .first()

    if (!user) throw new Error('Current user row not found.')

    const now = Date.now()
    const workspaceId = await ctx.db.insert('workspaces', {
      name: args.name,
      slug: args.slug,
      ownerId: user._id,
      createdAt: now,
      updatedAt: now,
    })

    // Once the workspace exists, attach the user to it and promote them to owner.
    await ctx.db.patch(user._id, {
      workspaceId: workspaceId,
      role: 'owner',
      updatedAt: now,
    })

    // On first-workspace creation there is no tenant-bound appIdentity yet, so seeding is an
    // operation-backed cross-tenant write capability declared above.
    await ctx.crossTenant.seedRunbooks({
      workspaceId,
      userId: user._id,
      now,
    })

    return workspaceId
  },
})

export const createWorkspaceMutation = mutation.authenticated(createWorkspaceOp)
