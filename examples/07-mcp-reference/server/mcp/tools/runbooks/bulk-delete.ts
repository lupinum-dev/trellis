import { operations } from '#trellis/operations/mcp'

import { tool } from '../../runtime'

export default tool.operation(operations.byId['runbooks.bulkRemove'], {
  group: 'workspace',
  tags: ['bulk', 'dangerous'],
  meta: {
    name: 'bulk-delete-runbooks',
  },
  rateLimit: { max: 5, window: '1m' },
  maxItems: { field: 'ids', limit: 10 },
})
