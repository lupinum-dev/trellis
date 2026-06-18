import { operation as appOperation, operationPreview } from '@lupinum/trellis/app'
import { defineArgs } from '@lupinum/trellis/args'
import { definePermission } from '@lupinum/trellis/auth'
import {
  defineOperationDescriptor,
  executeOperationRef,
  previewOperationRef,
  type OperationPreviewEnvelope,
} from '@lupinum/trellis/backend'
import {
  createMcpConvexCaller,
  defineMcpApp,
  defineOperationHandle,
  deniedMcpAccessSnapshot,
  type McpConfirmationRedeemInput,
  type ValidateMcpToolOptions,
  type ValidateToolArgs,
  // @ts-expect-error stale direct-tool alias was removed; use ValidateMcpToolOptions
  type DefineToolOptions as _RemovedDefineToolOptions,
  // @ts-expect-error duplicated confirmation input typo was removed; use McpConfirmationRedeemInput
  type McpConfirmationConfirmationInput as _RemovedConfirmationConfirmationInput,
  // @ts-expect-error generic direct-tool options are internal; use ValidateMcpToolOptions
  type ToolOptions as _RemovedToolOptions,
} from '@lupinum/trellis/mcp'
import { defineMcpTool as defineStandaloneTool } from '@lupinum/trellis/mcp/advanced'
import type { FunctionReference } from 'convex/server'
import { v } from 'convex/values'
import type { H3Event } from 'h3'
import { expectTypeOf } from 'vitest'

// Intentional 0.3.0 MCP type boundary coverage: removed aliases and direct
// MCP write helpers appear only as negative public-surface assertions.

type Caller = { kind: 'agent'; id: string; subject: `agent:${string}` }
type RecordAccess = { publishEntry: boolean }
type _confirmationRedeemInput = McpConfirmationRedeemInput

const _schema = defineArgs({
  args: {
    id: v.string(),
  },
})

expectTypeOf<ValidateToolArgs<typeof _schema, { id: string }>>().toEqualTypeOf<{
  id: string
}>()

const publishPermission = definePermission({
  key: 'publishEntry',
  check: true,
})

const runtime = defineMcpApp<Caller, RecordAccess>({
  resolveCaller: async () => ({ kind: 'agent', id: 'run-1', subject: 'agent:run-1' }),
  resolveAccess: async () => ({ publishEntry: true }),
})

type _toolOptions = ValidateMcpToolOptions<
  typeof _schema,
  Caller,
  never,
  RecordAccess,
  Record<string, never>,
  {
    schema: typeof _schema
    call: FunctionReference<'query', 'internal', { id: string }, { archived: true }>
  }
>

// @ts-expect-error direct MCP tool options cannot validate app-backed mutation refs
const _directMutationToolOptions: ValidateMcpToolOptions<
  typeof _schema,
  Caller,
  never,
  RecordAccess,
  Record<string, never>,
  {
    schema: typeof _schema
    call: FunctionReference<'mutation', 'internal', { id: string }, { archived: true }>
  }
> = {
  schema: _schema,
  call: {} as FunctionReference<'mutation', 'internal', { id: string }, { archived: true }>,
}

const operation = appOperation.destructive({
  id: 'entries.archive',
  args: {
    id: v.string(),
  },
  permission: publishPermission,
  safety: 'destructive-write',
  preview: async () => operationPreview({ summary: 'Archive entry', confirm: { id: 'entry_1' } }),
  handler: async () => ({ archived: true as const }),
})

const executeRef = executeOperationRef(
  operation,
  {} as FunctionReference<'mutation', 'internal', { id: string }, { archived: true }>,
)
const previewRef = previewOperationRef(
  operation,
  {} as FunctionReference<
    'query',
    'internal',
    { id: string },
    OperationPreviewEnvelope<{ id: string }>
  >,
)
const operationDescriptor = defineOperationDescriptor({
  id: 'entries.archive',
  kind: 'destructive',
  args: _schema.args,
  permission: publishPermission,
  safety: 'destructive-write',
})
const operationHandle = defineOperationHandle(operationDescriptor, {
  executeRef,
  previewRef,
})

// @ts-expect-error app-backed MCP writes must use operation-backed tools
runtime.tool.mutation({
  schema: _schema,
  call: {} as FunctionReference<'mutation', 'internal', { id: string }, { archived: true }>,
})

runtime.tool.operation(operation, {
  execute: executeRef,
  preview: previewRef,
  permission: publishPermission,
})

runtime.tool.operation(operationHandle, {
  permission: publishPermission,
})

runtime.tool.operation(operation, {
  // @ts-expect-error execute must be an execute projection ref for this operation
  execute: previewRef,
  // @ts-expect-error preview must be a preview projection ref for this operation
  preview: executeRef,
  permission: publishPermission,
})

defineStandaloneTool({
  name: 'diagnostic',
  inputSchema: {},
  handler: async (_args, extra) => {
    // @ts-expect-error standalone advanced tools do not expose app-write helpers
    await extra.mutation('anything', {})
    // @ts-expect-error standalone advanced tools do not expose app-action helpers
    await extra.action('anything', {})
    return { ok: true }
  },
})

void ({} as _toolOptions)
void _directMutationToolOptions
void ({} as _confirmationRedeemInput)
void createMcpConvexCaller({} as H3Event, {
  caller: { kind: 'agent', subject: 'agent:run-1' },
  identityForwardingKeyEnvAliases: ['GINKO_CONVEX_IDENTITY_FORWARDING_KEY'],
})
void deniedMcpAccessSnapshot([publishPermission])
