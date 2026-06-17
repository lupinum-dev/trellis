import { defineAccessContext } from '@lupinum/trellis/auth'

import { getAccessIdentity } from '../auth/appIdentity'
import { permissions } from '../features'
import { query } from '../functions'

export const getAccessContext = query.session(
  defineAccessContext({
    resolve: async (ctx) => await getAccessIdentity(ctx as Parameters<typeof getAccessIdentity>[0]),
    permissions,
  }),
)
