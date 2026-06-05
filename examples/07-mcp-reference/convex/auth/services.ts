import { defineServices } from '@lupinum/trellis/auth'

import type { McpReferencePrincipal } from './caller'

export const services = defineServices<
  'runbookWebhookDeliveries' | 'runbooks' | 'users',
  McpReferencePrincipal
>({
  'runbook-webhook': {
    metadata: {
      source: 'verifiedWebhook',
      purpose: 'runbook-webhook:create',
      allowedOperations: ['runbooks.create-from-webhook'],
      allowedFunctionRefs: ['features/runbooks/webhooks:createRunbookFromWebhookMutation'],
      replayMode: 'domain-idempotency',
      actingFor: true,
      auditEvent: 'runbook.webhook.created',
      auditTable: 'runbookWebhookDeliveries',
      auditCorrelationId: 'args.deliveryId',
    },
    access: {
      tables: ['runbookWebhookDeliveries', 'runbooks', 'users'],
      tenant: 'derived',
      deriveTenant: ({ args }) => (typeof args.workspaceId === 'string' ? args.workspaceId : null),
    },
  },
})
