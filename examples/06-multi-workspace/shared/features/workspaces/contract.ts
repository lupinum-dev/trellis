import { defineArgs } from '@lupinum/trellis/args'
import { v } from 'convex/values'

export const listAccessibleWorkspaces = defineArgs({
  description: 'List workspaces the signed-in user can access through memberships.',
  args: {},
})

export const createWorkspace = defineArgs({
  description: 'Create a client workspace for the signed-in user.',
  args: {
    name: v.string(),
    slug: v.string(),
  },
})

export const switchWorkspace = defineArgs({
  description: 'Switch the active workspace for the signed-in user.',
  args: {
    workspaceId: v.id('workspaces'),
  },
})
