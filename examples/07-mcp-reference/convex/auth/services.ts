import { defineServices } from '@lupinum/trellis/auth'

import type { McpReferencePrincipal } from './caller'

export const services = defineServices<
  'runbookWebhookDeliveries' | 'runbooks' | 'users',
  McpReferencePrincipal
>({
  'runbook-webhook': {
    access: {
      tables: ['runbookWebhookDeliveries', 'runbooks', 'users'],
      tenant: 'derived',
      deriveTenant: ({ args }) => (typeof args.workspaceId === 'string' ? args.workspaceId : null),
    },
  },
})
