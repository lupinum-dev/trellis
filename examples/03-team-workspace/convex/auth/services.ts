import { defineServices } from '@lupinum/trellis/auth'

import type { TeamTodoPrincipal } from './caller'

export const services = defineServices<'processedEvents' | 'todos' | 'users', TeamTodoPrincipal>({
  'todo-sync-webhook': {
    metadata: {
      source: 'verifiedWebhook',
      purpose: 'todo-sync-webhook',
      allowedOperations: ['todos.process-sync-webhook'],
      allowedFunctionRefs: ['features/todos/webhooks:processTodoSyncWebhookMutation'],
      replayMode: 'domain-idempotency',
      actingFor: true,
      auditEvent: 'todo.sync.webhook.processed',
      auditTable: 'processedEvents',
      auditCorrelationId: 'args.eventId',
    },
    access: {
      tables: ['processedEvents', 'todos', 'users'],
      tenant: 'derived',
      deriveTenant: ({ args }) => (typeof args.workspaceId === 'string' ? args.workspaceId : null),
    },
  },
})
