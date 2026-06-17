import { defineTrellis } from '@lupinum/trellis/app'
import {
  actionGeneric as generatedAction,
  internalMutationGeneric as generatedInternalMutation,
  internalQueryGeneric as generatedInternalQuery,
  mutationGeneric as generatedMutation,
  queryGeneric as generatedQuery,
} from 'convex/server'

import { getAppIdentityFromCaller, caller } from './auth/caller'

export const { action, internalMutation, internalQuery, mutation, query, unsafe } = defineTrellis(
  {
    action: generatedAction,
    query: generatedQuery,
    mutation: generatedMutation,
    internalQuery: generatedInternalQuery,
    internalMutation: generatedInternalMutation,
  },
  {
    caller,
    appIdentity: getAppIdentityFromCaller,
  },
)
