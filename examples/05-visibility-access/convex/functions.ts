import { defineTrellis } from '@lupinum/trellis/app'

import { operationProjectionRegistry } from '../generated/operation-projections'
import type { TableNames } from './_generated/dataModel'
import { mutation as generatedMutation, query as generatedQuery } from './_generated/server'
import { getAppIdentity, type AppIdentity } from './auth/appIdentity'
import { caller } from './auth/caller'
import { sharedTables, tenantTables } from './features'

const isolatedTables = [...tenantTables] as TableNames[]
const explicitlySharedTables = [...sharedTables] as TableNames[]

async function requirePreviewIdentity(ctx: {
  appIdentity: () => Promise<AppIdentity | null>
}): Promise<AppIdentity> {
  const appIdentity = await ctx.appIdentity()
  if (!appIdentity) throw new Error('Destructive preview confirmation requires identity.')
  return appIdentity
}

export const { mutation, query, unsafe } = defineTrellis(
  { query: generatedQuery, mutation: generatedMutation },
  {
    caller,
    appIdentity: getAppIdentity,
    isolation: {
      tables: isolatedTables,
      sharedTables: explicitlySharedTables,
    },
    operationProjections: operationProjectionRegistry,
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
