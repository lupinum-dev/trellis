import { defineAccessContext } from '@lupinum/trellis/auth'

import { permissions } from '../features'
import { query } from '../functions'

export const getAccessContext = query.session({
  ...defineAccessContext({
    resolve: async (ctx) => await ctx.appIdentity(),
    permissions,
    extend: async (_ctx, appIdentity) => ({
      email: appIdentity.email ?? null,
      displayName: appIdentity.displayName ?? null,
    }),
  }),
  identityForwardingFunctionRef: 'permissions/context:getAccessContext',
})
