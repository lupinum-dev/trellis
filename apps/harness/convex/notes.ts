import { operation } from '@lupinum/trellis/app'
import { defineArgs } from '@lupinum/trellis/args'

import { createNote, searchNotes } from '../shared/schemas/note'
import type { DatabaseWriter } from './_generated/server'
import { mutation, query } from './functions'

const listNotesArgs = defineArgs({
  args: {},
})

function withTitle<T extends { title?: string | null }>(note: T) {
  return {
    ...note,
    title: note.title ?? 'Untitled',
  }
}

export const list = query.public({
  reads: ['notes'],
  args: listNotesArgs.args,
  handler: async (ctx) => {
    const notes = await ctx.db.query('notes').order('desc').take(50)
    return notes.map(withTitle)
  },
})

export const search = query.public({
  reads: ['notes'],
  args: searchNotes.args,
  handler: async (ctx, args) => {
    if (!args.query.trim()) return []

    const notes = await ctx.db.query('notes').order('desc').take(200)
    const lowerQuery = args.query.toLowerCase()

    return notes
      .filter(
        (note) =>
          (note.title ?? '').toLowerCase().includes(lowerQuery) ||
          note.content.toLowerCase().includes(lowerQuery),
      )
      .map(withTitle)
  },
})

export const addNoteOp = operation.publicMutation({
  id: 'notes.add',
  args: createNote.args,
  identityForwardingFunctionRef: 'notes:add',
  identityForwardingTransport: 'mcp',
  publicWrite: {
    reason: 'Harness note demo allows anonymous note creation.',
    tables: ['notes'],
    access: ({ db, args }) => {
      const writeDb = db as DatabaseWriter
      const noteArgs = args as { title: string; content: string }

      return {
        createNote: async () =>
          await writeDb.insert('notes', {
            title: noteArgs.title,
            content: noteArgs.content,
            createdAt: Date.now(),
          }),
      }
    },
  },
  handler: async (ctx) => {
    return await ctx.publicWrite.createNote()
  },
})

export const add = mutation.public(addNoteOp)
