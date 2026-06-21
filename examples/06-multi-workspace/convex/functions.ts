import { defineTrellis } from '@lupinum/trellis/app'

import type { TableNames } from './_generated/dataModel'
import { mutation as generatedMutation, query as generatedQuery } from './_generated/server'
import { getAppIdentity } from './auth/appIdentity'
import { caller } from './auth/caller'
import { sharedTables, tenantTables } from './features'

const isolatedTables = [...tenantTables] as TableNames[]
const explicitlySharedTables = [...sharedTables] as TableNames[]

export const { mutation, query, unsafe } = defineTrellis(
  { query: generatedQuery, mutation: generatedMutation },
  {
    caller,
    appIdentity: getAppIdentity,
    isolation: {
      tables: isolatedTables,
      sharedTables: explicitlySharedTables,
    },
  },
)
