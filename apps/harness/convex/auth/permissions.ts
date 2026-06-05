import { definePermission } from '@lupinum/trellis/auth'

import { canCreateComment, canInviteMembers, hasRole } from './checks'

export const commentCreatePermission = definePermission({
  key: 'comment.create',
  label: 'Create comment',
  roles: ['owner', 'admin', 'member', 'viewer'],
  check: canCreateComment,
})

export const mcpKeyManagePermission = definePermission({
  key: 'mcp-key.manage',
  label: 'Manage MCP keys',
  roles: ['owner', 'admin'],
  check: canInviteMembers,
})

export const postDeletePermission = definePermission({
  key: 'post.delete',
  label: 'Delete post',
  roles: ['owner', 'admin', 'member'],
  check: hasRole('owner', 'admin', 'member'),
})

export const postPublishPermission = definePermission({
  key: 'post.publish',
  label: 'Publish post',
  roles: ['owner', 'admin'],
  check: hasRole('owner', 'admin'),
})

export const postUpdatePermission = definePermission({
  key: 'post.update',
  label: 'Update post',
  roles: ['owner', 'admin', 'member'],
  check: hasRole('owner', 'admin', 'member'),
})

export const internalHarnessPermissions = [
  commentCreatePermission,
  mcpKeyManagePermission,
  postDeletePermission,
  postPublishPermission,
  postUpdatePermission,
] as const

export type InternalHarnessPermissionKey = (typeof internalHarnessPermissions)[number]['key']
