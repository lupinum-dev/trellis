import { operations } from '#trellis/operations/mcp'

import { createNote } from '../../../shared/schemas/note'
import { tool } from '../runtime'

type CreateNoteRespondCtx = {
  args: unknown
  result: unknown
  ok: (data: unknown, summary?: string) => unknown
}

export default tool.operation(operations.byId['notes.add'], {
  schema: createNote,
  meta: {
    name: 'create-note',
  },
  respond: ({ args, result, ok }: CreateNoteRespondCtx) => {
    const request = args as { title: string }
    return ok({ id: result }, `Created note "${request.title}"`)
  },
})
