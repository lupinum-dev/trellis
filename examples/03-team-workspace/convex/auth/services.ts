import { defineServices } from '@lupinum/trellis/auth'

import type { TeamTodoPrincipal } from './caller'

export const services = defineServices<'processedEvents' | 'todos' | 'users', TeamTodoPrincipal>({
  'todo-sync-webhook': {
    access: {
      tables: ['processedEvents', 'todos', 'users'],
      tenant: 'derived',
      deriveTenant: ({ args }) => (typeof args.workspaceId === 'string' ? args.workspaceId : null),
    },
  },
})
