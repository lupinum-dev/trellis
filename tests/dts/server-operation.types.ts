import { defineOperationDescriptor, defineOperationHandle } from '@lupinum/trellis/backend'
import { serverOperation } from '@lupinum/trellis/server'
import type { FunctionReference } from 'convex/server'
import { v } from 'convex/values'
import type { H3Event } from 'h3'
import { expectTypeOf } from 'vitest'

const listProjectsDescriptor = defineOperationDescriptor({
  id: 'projects.list',
  kind: 'safe',
  args: { workspaceId: v.string() },
})

const listProjectsHandle = defineOperationHandle(listProjectsDescriptor, {
  executeRef: {} as FunctionReference<
    'query',
    'public',
    { workspaceId: string },
    { items: string[] }
  >,
  executeOperation: 'query',
  runtimes: ['server'],
})

const listProjects = serverOperation({} as H3Event, listProjectsHandle)

expectTypeOf(listProjects.query).parameter(0).toEqualTypeOf<{ workspaceId: string }>()
expectTypeOf(listProjects.query({ workspaceId: 'workspace_1' })).toEqualTypeOf<
  Promise<{ items: string[] }>
>()

// @ts-expect-error workspaceId is required by the generated operation handle.
void listProjects.query({})

const deleteProjectDescriptor = defineOperationDescriptor({
  id: 'projects.delete',
  kind: 'destructive',
  args: { projectId: v.string() },
})

const deleteProjectHandle = defineOperationHandle(deleteProjectDescriptor, {
  executeRef: {} as FunctionReference<
    'mutation',
    'public',
    { projectId: string; _confirmationToken?: string },
    { deleted: true }
  >,
  previewRef: {} as FunctionReference<
    'mutation',
    'public',
    { projectId: string },
    { confirmation: { token: string; expiresAt: number } }
  >,
  executeOperation: 'mutation',
  previewOperation: 'mutation',
  runtimes: ['server'],
})

const deleteProject = serverOperation({} as H3Event, deleteProjectHandle)

expectTypeOf(deleteProject.preview({ projectId: 'project_1' })).toEqualTypeOf<
  Promise<{ confirmation: { token: string; expiresAt: number } }>
>()
expectTypeOf(
  deleteProject.execute(
    { projectId: 'project_1' },
    { confirmation: { token: 'confirm-token', expiresAt: 1 } },
  ),
).toEqualTypeOf<Promise<{ deleted: true }>>()

void deleteProject.execute(
  { projectId: 'project_1' },
  // @ts-expect-error confirmation objects require an expiry timestamp.
  { confirmation: { token: 'confirm-token' } },
)
