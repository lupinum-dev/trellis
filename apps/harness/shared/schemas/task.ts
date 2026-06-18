import { v } from 'convex/values'

import { defineOperationDescriptor } from '../../../../src/runtime/functions/define-operation'
import { defineArgs } from '../../../../src/runtime/schema'

export const addTask = defineArgs({
  description: 'Add a task to your personal list',
  args: {
    title: v.string(),
  },
  meta: {
    title: {
      label: 'Title',
      description: 'The task title',
      examples: ['Review MCP verification flow', 'Ship internal harness smoke tests'],
    },
  },
})

export const addTaskDescriptor = defineOperationDescriptor({
  id: 'tasks.add',
  name: 'addTask',
  args: addTask.args,
})
