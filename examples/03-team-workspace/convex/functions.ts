import { defineTrellis } from '@lupinum/trellis/app'

import { operationProjectionRegistry } from '../generated/operation-projections'
import type { TableNames } from './_generated/dataModel'
import { mutation as generatedMutation, query as generatedQuery } from './_generated/server'
import { actingFor } from './auth/actingFor'
import { getAppIdentityFromCaller, type AppIdentity } from './auth/appIdentity'
import { caller } from './auth/caller'
import { services } from './auth/services'
import { sharedTables, tenantTables } from './features'

const isolatedTables = [...tenantTables] as TableNames[]
const explicitlySharedTables = [...sharedTables] as TableNames[]

async function requirePreviewIdentity(ctx: {
  appIdentity: () => Promise<AppIdentity | null>
}): Promise<AppIdentity> {
  const appIdentity = await ctx.appIdentity()
  if (!appIdentity) throw new Error('Destructive preview confirmation requires identity.')
  if (!appIdentity.workspaceId) {
    throw new Error('Destructive preview confirmation requires workspace scope.')
  }
  return appIdentity
}

export const { mutation, query, unsafe } = defineTrellis(
  { query: generatedQuery, mutation: generatedMutation },
  {
    caller,
    actingFor,
    appIdentity: getAppIdentityFromCaller,
    services,
    operationProjections: operationProjectionRegistry,
    isolation: {
      tables: isolatedTables,
      sharedTables: explicitlySharedTables,
    },
    destructiveOperations: {
      confirmationTable: 'destructiveConfirmations',
      auditTable: 'destructiveAuditLog',
      previewConfirmation: {
        callerKey: async (ctx) => (await requirePreviewIdentity(ctx)).userId,
        scopeKey: async (ctx) => String((await requirePreviewIdentity(ctx)).workspaceId),
      },
    },
    trustedReplay: {
      table: 'trustedReplay',
    },
  },
)
