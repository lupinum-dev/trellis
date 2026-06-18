import { operations } from '#trellis/operations/mcp'

import { tool } from '../runtime'

export default tool.operation(operations.todos.create, {
  meta: {
    name: 'create-todo',
  },
})
