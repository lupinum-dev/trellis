/**
 * Why this file exists:
 * External systems retry, so webhook-side authorization also needs replay
 * protection. The domain write and replay record must live in one Convex
 * mutation transaction; route-side delivery consumption is intentionally absent.
 */
import { deny } from '@lupinum/trellis/auth'
import type { GenericMutationCtx } from 'convex/server'

import type { DataModel, Id } from '../_generated/dataModel'

type Db = GenericMutationCtx<DataModel>['db']

type DomainIdempotentEvent = {
  source: string
  eventId: string
  workspaceId?: Id<'workspaces'>
}

async function findProcessedEvent(
  db: Db,
  source: string,
  eventId: string,
  workspaceId?: Id<'workspaces'>,
): Promise<unknown> {
  const query = workspaceId
    ? db
        .query('processedEvents')
        .withIndex('by_source_event_workspace', (q) =>
          q.eq('source', source).eq('eventId', eventId).eq('workspaceId', workspaceId),
        )
    : db
        .query('processedEvents')
        .withIndex('by_source_event_id', (q) => q.eq('source', source).eq('eventId', eventId))

  return await query.first()
}

export async function hasProcessedEvent(
  db: Db,
  source: string,
  eventId: string,
  workspaceId?: Id<'workspaces'>,
): Promise<boolean> {
  return (await findProcessedEvent(db, source, eventId, workspaceId)) !== null
}

export async function processDomainIdempotentEvent<TResult>(
  db: Db,
  event: DomainIdempotentEvent,
  write: () => Promise<TResult>,
): Promise<TResult> {
  if (await hasProcessedEvent(db, event.source, event.eventId, event.workspaceId)) {
    throw deny('Event already processed.')
  }

  const result = await write()

  await db.insert('processedEvents', {
    eventId: event.eventId,
    source: event.source,
    ...(event.workspaceId ? { workspaceId: event.workspaceId } : {}),
    processedAt: Date.now(),
  })

  return result
}
