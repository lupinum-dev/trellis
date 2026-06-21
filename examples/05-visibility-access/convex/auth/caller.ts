import { getAuth } from '@lupinum/trellis/auth'
import { defineCaller } from '@lupinum/trellis/backend'
import type { GenericActionCtx, GenericMutationCtx, GenericQueryCtx } from 'convex/server'
import { v } from 'convex/values'

import type { DataModel } from '../_generated/dataModel'

type PrincipalCtx =
  | GenericQueryCtx<DataModel>
  | GenericMutationCtx<DataModel>
  | GenericActionCtx<DataModel>

export type VisibilityPrincipal = { kind: 'anonymous' } | { kind: 'user'; authKey: string }

export const visibilityPrincipalValidator = v.union(
  v.object({
    kind: v.literal('anonymous'),
  }),
  v.object({
    kind: v.literal('user'),
    authKey: v.string(),
  }),
)

export const caller = defineCaller<PrincipalCtx, VisibilityPrincipal>({
  validator: visibilityPrincipalValidator,
  resolve: async (ctx): Promise<VisibilityPrincipal> => {
    const auth = await getAuth(ctx)
    if (!auth) return { kind: 'anonymous' }

    return {
      kind: 'user',
      authKey: auth.authKey,
    }
  },
})
