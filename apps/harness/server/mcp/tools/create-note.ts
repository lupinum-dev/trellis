import { executeOperationRef } from '@lupinum/trellis/backend'

import { api } from '../../../convex/_generated/api'
import { addNoteOp } from '../../../convex/notes'
import { createNote } from '../../../shared/schemas/note'
import { tool } from '../runtime'

const harnessApi = api as any

export default tool.operation(addNoteOp, {
  schema: createNote,
  execute: executeOperationRef(addNoteOp, harnessApi.notes.add),
  meta: {
    name: 'create-note',
  },
  respond: ({ args, result, ok }) => {
    const request = args as { title: string }
    return ok({ id: result }, `Created note "${request.title}"`)
  },
})
