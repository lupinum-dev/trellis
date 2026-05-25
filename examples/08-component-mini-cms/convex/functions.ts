import { defineTrellis } from '@lupinum/trellis/backend'
import {
  actionGeneric as generatedAction,
  internalActionGeneric as generatedInternalAction,
  internalMutationGeneric as generatedInternalMutation,
  internalQueryGeneric as generatedInternalQuery,
  mutationGeneric as generatedMutation,
  queryGeneric as generatedQuery,
} from 'convex/server'

import { getAppIdentityFromCaller, caller } from './auth/caller'

export const { action, internalAction, internalMutation, internalQuery, mutation, query, unsafe } =
  defineTrellis(
    {
      action: generatedAction,
      internalAction: generatedInternalAction,
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
