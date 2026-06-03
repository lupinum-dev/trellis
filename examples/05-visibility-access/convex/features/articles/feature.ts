import { defineFeature } from '@lupinum/trellis/workspace'

import { revokeShareTokenOp } from './operations'
import { articlePermissions } from './permissions'
import { articleTables } from './schema'

export const articlesFeature = defineFeature({
  name: 'articles',
  schema: articleTables,
  permissions: articlePermissions,
  operations: [revokeShareTokenOp],
})
