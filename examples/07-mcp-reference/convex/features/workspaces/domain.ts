import { operation } from '@lupinum/trellis/app'
import { requireAuth } from '@lupinum/trellis/auth'

import { createWorkspace } from '../../../shared/features/workspaces/contract'
import type { MutationCtx } from '../../_generated/server'
import type { McpReferencePrincipal } from '../../auth/caller'
import { mutation } from '../../functions'

type WorkspaceBootstrapCtx = MutationCtx & {
  caller: () => Promise<McpReferencePrincipal>
}
type CreateWorkspaceArgs = { name: string; slug: string }

function escapeIsolation<TDb extends object>(db: TDb, reason: string): TDb {
  return (db as TDb & { escapeIsolation: (options: { reason: string }) => TDb }).escapeIsolation({
    reason,
  })
}

export const createWorkspaceOp = operation.mutation({
  id: 'workspaces.create',
  args: createWorkspace.args,
  handler: async (ctx: WorkspaceBootstrapCtx, args: CreateWorkspaceArgs) => {
    const caller = await ctx.caller()
    // This onboarding path is intentionally caller-gated instead of appIdentity-gated:
    // a signed-in user may exist before they have any workspace-bound appIdentity row.
    requireAuth(caller, 'Forbidden: authRequired')
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
    const crossTenantDb = escapeIsolation(
      ctx.db,
      'Seed onboarding runbooks before the new workspace is appIdentity-scoped.',
    )
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

    // On first-workspace creation there is no tenant-bound appIdentity yet, so seed
    // content must bypass isolation explicitly.
    await crossTenantDb.insert('runbooks', {
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
      ownerId: user._id,
      workspaceId: workspaceId,
      createdAt: now,
      updatedAt: now,
      publishedAt: now,
    })

    await crossTenantDb.insert('runbooks', {
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
      ownerId: user._id,
      workspaceId: workspaceId,
      createdAt: now,
      updatedAt: now,
    })

    return workspaceId
  },
})

export const createWorkspaceMutation = mutation.public(createWorkspaceOp)
