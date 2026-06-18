import { operations } from '#trellis/operations/mcp'

import { tool } from '../../runtime'

export default tool.operation(operations.runbooks.remove, {
  group: 'workspace',
  meta: {
    name: 'delete-runbook',
  },
})
