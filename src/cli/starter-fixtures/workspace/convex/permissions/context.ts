import { defineAccessContext } from '@lupinum/trellis/auth'

import { permissions } from '../features'
import { query } from '../functions'

export const getAccessContext = query.session(
  defineAccessContext({
    id: 'permissions/context:getAccessContext',
    resolve: async (ctx) => await ctx.appIdentity(),
    permissions,
  }),
)
