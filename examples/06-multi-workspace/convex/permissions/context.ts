import { defineAccessContext } from '@lupinum/trellis/auth'

import type { DatabaseReader } from '../_generated/server'
import { getMemberships } from '../auth/agency'
import { getAppIdentity } from '../auth/appIdentity'
import { permissions } from '../features'
import { query } from '../functions'

export const getAccessContext = query.protected(
  defineAccessContext({
    resolve: getAppIdentity,
    permissions,
    crossTenant: {
      reason: 'Agency dashboard context aggregates memberships across workspaces.',
      tables: ['memberships'],
      access: ({ db }: { db: DatabaseReader }) => ({
        getMemberships: async (userId: string) => await getMemberships(db, userId as never),
      }),
    },
    extend: async (ctx, appIdentity) => {
      const user = await ctx.db.get(appIdentity.userId)

      const memberships = await ctx.crossTenant.getMemberships(appIdentity.userId)

      return {
        email: user?.email ?? null,
        displayName: user?.displayName ?? null,
        agencyDashboard: memberships.some((membership: { role: string }) =>
          ['agency_admin', 'agency_manager'].includes(membership.role),
        ),
      }
    },
  }),
)
