import { serverOperation } from '@lupinum/trellis/server'
import { readBody } from 'h3'

import { operations } from '#trellis/operations/server'

export default defineEventHandler(async (event) => {
  const body = (await readBody(event)) as { title?: unknown }
  if (typeof body.title !== 'string') {
    throw createError({
      statusCode: 400,
      statusMessage: 'Project title is required.',
    })
  }

  return await serverOperation(event, operations.projects.create).execute(
    { title: body.title },
    { auth: 'required' },
  )
})
