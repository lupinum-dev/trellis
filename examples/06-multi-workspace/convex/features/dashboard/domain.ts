import { deny } from '@lupinum/trellis/auth'

import { listAgencyPortfolio } from '../../../shared/features/dashboard/contract'
import type { Doc } from '../../_generated/dataModel'
import type { DatabaseReader } from '../../_generated/server'
import { getAgencyActor, getMemberships, requireAnyAgencyRole } from '../../auth/agency'
import { query } from '../../functions'

export const portfolio = query.public({
  id: 'dashboard:portfolio',
  reads: ['users', 'memberships', 'workspaces', 'projects'],
  args: listAgencyPortfolio.args,
  crossTenant: {
    reason: 'Show the agency portfolio across assigned workspaces.',
    tables: ['memberships', 'workspaces', 'projects'],
    access: ({ db }) => {
      const reader = db as DatabaseReader
      return {
        listPortfolio: async (userId: string) => {
          await requireAnyAgencyRole(reader, userId as never, 'agency_admin', 'agency_manager')

          const memberships = await getMemberships(reader, userId as never)
          const agencyMemberships = memberships.filter((membership) =>
            ['agency_admin', 'agency_manager'].includes(membership.role),
          )

          return Promise.all(
            agencyMemberships.map(async (membership) => {
              const workspace = await reader.get('workspaces', membership.workspaceId)
              const projects = await reader
                .query('projects')
                .withIndex('by_workspace', (q: any) => q.eq('workspaceId', membership.workspaceId))
                .collect()

              return {
                workspace: {
                  id: membership.workspaceId,
                  name: workspace?.name ?? String(membership.workspaceId),
                },
                role: membership.role,
                activeProjects: projects.filter(
                  (project: Doc<'projects'>) => project.status === 'active',
                ).length,
                totalProjects: projects.length,
              }
            }),
          )
        },
      }
    },
  },
  handler: async (ctx) => {
    const appIdentity = await getAgencyActor(ctx)
    if (!appIdentity) throw deny('Not authenticated.')

    // Cross-scope by design, but still membership-bounded: the portfolio only spans workspaces
    // where this appIdentity already has an agency role.
    return await ctx.crossTenant.listPortfolio(appIdentity.userId)
  },
})
