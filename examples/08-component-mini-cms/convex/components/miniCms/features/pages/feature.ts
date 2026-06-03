import { defineFeature } from '@lupinum/trellis/workspace'

import { publishPageOp } from './operations'
import { pagesTables } from './schema'

export const pagesFeature = defineFeature({
  name: 'pages',
  schema: pagesTables,
  operations: [publishPageOp],
})
