/**
 * Why this file exists:
 * External systems retry, so webhook-side authorization also needs replay protection.
 */
import { deny } from '@lupinum/trellis/auth'
import type { GenericMutationCtx } from 'convex/server'

import type { DataModel, Id } from '../_generated/dataModel'

type Db = GenericMutationCtx<DataModel>['db']

export async function ensureNotProcessed(
  db: Db,
  source: string,
  eventId: string,
  workspaceId?: Id<'workspaces'>,
): Promise<void> {
  const query = workspaceId
    ? db
        .query('processedEvents')
        .withIndex('by_source_event_workspace', (q) =>
          q.eq('source', source).eq('eventId', eventId).eq('workspaceId', workspaceId),
        )
    : db
        .query('processedEvents')
        .withIndex('by_source_event_id', (q) => q.eq('source', source).eq('eventId', eventId))
  const existing = await query.first()

  if (existing) throw deny('Event already processed.')
}

export async function markProcessed(
  db: Db,
  eventId: string,
  source: string,
  workspaceId?: Id<'workspaces'>,
): Promise<void> {
  await db.insert('processedEvents', {
    eventId,
    source,
    ...(workspaceId ? { workspaceId } : {}),
    processedAt: Date.now(),
  })
}
