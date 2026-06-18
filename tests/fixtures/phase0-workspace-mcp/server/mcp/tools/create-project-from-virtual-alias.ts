import { operations } from '#trellis/operations/mcp'

import { tool } from '../runtime'

export default tool.operation(operations.projects.create, {
  meta: {
    name: 'create-project-from-virtual-alias',
  },
})
