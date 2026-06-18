/// <reference types="vite/client" />

import { readFileSync } from 'node:fs'

import { requireDelegationBinding } from '@lupinum/trellis/backend'
import { createTestContext } from '@lupinum/trellis/testing'
import { anyApi } from 'convex/server'
import { describe, expect, it } from 'vitest'

import { operations } from '#trellis/operations/testing'

import { mcpManage } from '../convex/features/mcpKeys/permissions'
import {
  runbookBulkDelete,
  runbookCreate,
  runbookRead,
} from '../convex/features/runbooks/permissions'
import schema from '../convex/schema'
import { modules } from '../convex/test.setup'

const api = anyApi as any
type WorkspaceRole = 'owner' | 'admin' | 'member' | 'viewer'
const IDENTITY_FORWARDING_KEY = 'mcp-reference-test-identity-forwarding-key'

function createCtx() {
  return createTestContext<typeof schema, WorkspaceRole>({
    schema,
    modules,
    identityForwardingKey: IDENTITY_FORWARDING_KEY,
  })
}

function forwardedUser(ctx: ReturnType<typeof createCtx>, user: { authKey: string }) {
  return ctx.asUser({ authKey: user.authKey, subject: `auth:${user.authKey}` })
}

function webhookService(
  ctx: ReturnType<typeof createCtx>,
  actingFor: { subject: string } & Record<string, unknown>,
) {
  return ctx.asService('runbook-webhook', {
    actingFor,
    transport: 'webhook',
    purpose: 'mutation',
    replayMode: 'domain-idempotency',
    targetFunctionRef: 'runbooks.create-from-webhook',
  })
}

function mcpAgent(
  ctx: ReturnType<typeof createCtx>,
  keyId: string,
  actingFor: { subject: string } & Record<string, unknown>,
) {
  return ctx.asCaller(
    {
      kind: 'agent',
      agentId: keyId,
      provider: 'mcp',
      subject: `agent:${keyId}`,
    },
    {
      actingFor,
      transport: 'server',
      purpose: 'query',
    },
  )
}

function mcpKeyDelegation(input: { keyId: string; userId: string; workspaceId: string }) {
  return requireDelegationBinding({
    serviceId: input.keyId,
    targetUserId: input.userId,
    workspaceId: input.workspaceId,
    purpose: 'mcp-session',
    grantSource: 'mcp-key-binding',
    grantId: input.keyId,
    expiresAt: Date.now() + 60_000,
  })
}

function runbookWebhookDelegation(input: {
  userId: string
  workspaceId: string
  deliveryId: string
}) {
  return requireDelegationBinding({
    serviceId: 'runbook-webhook',
    targetUserId: input.userId,
    workspaceId: input.workspaceId,
    purpose: 'runbook-webhook:create',
    grantSource: 'workspace-service-policy',
    grantId: `delivery:${input.deliveryId}`,
    expiresAt: Date.now() + 60_000,
  })
}

function expiredRunbookWebhookDelegation(input: {
  userId: string
  workspaceId: string
  deliveryId: string
}) {
  return {
    subject: `user:${input.userId}`,
    grantSource: 'workspace-service-policy',
    issuer: 'trellis://server',
    serviceId: 'runbook-webhook',
    targetUserId: input.userId,
    workspaceId: input.workspaceId,
    purpose: 'runbook-webhook:create',
    grantId: `delivery:${input.deliveryId}`,
    expiresAt: Date.now() - 1,
  }
}

describe('mcp reference example', () => {
  it('keeps anonymous MCP tools read-only and gates session writes', () => {
    const readServerFile = (relativePath: string) =>
      readFileSync(new URL(`../server/${relativePath}`, import.meta.url), 'utf8')

    // Intentional 0.3.0 boundary coverage: anonymous MCP server tools must not
    // use the deleted direct write lane or operation-backed writes.
    const publicReadTools = [
      'mcp/tools/runbooks/list-public.ts',
      'mcp/tools/runbooks/search-public.ts',
      'mcp/tools/session/get-session-focus.ts',
    ]
    const gatedWriteTools = [
      'mcp/tools/session/set-session-focus.ts',
      'mcp/tools/session/register-session-shortcut.ts',
      'mcp/tools/session/unregister-session-shortcut.ts',
    ]

    for (const relativePath of publicReadTools) {
      const source = readServerFile(relativePath)
      expect(source).not.toContain('session.set(')
      expect(source).not.toContain('tool.mutation(')
      expect(source).not.toContain('tool.operation(')
    }

    for (const relativePath of gatedWriteTools) {
      const source = readServerFile(relativePath)
      expect(source).toContain('enabled: (event) => !!event.context.mcpAuth')
      expect(source).toContain('Authentication required.')
    }

    const middleware = readServerFile('middleware/mcp-auth.ts')
    expect(middleware).toContain("event.path?.startsWith('/mcp')")
    expect(middleware).toContain("event.path.startsWith('/mcp/runbook-agent')")
  })

  it('lets a signed-in user without a workspace create their first workspace', async () => {
    const ctx = createCtx()
    const authKey = 'first_workspace_owner'

    await ctx.seed('users', {
      authKey,
      email: 'owner@example.com',
      displayName: 'First Owner',
      role: 'member',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })

    const firstOwner = ctx.asAuthUser({
      authKey,
      email: 'owner@example.com',
      displayName: 'First Owner',
    })

    const workspaceId = await firstOwner.mutation(
      api.features.workspaces.domain.createWorkspaceMutation,
      {
        name: 'First Workspace',
        slug: 'first-workspace',
      },
    )

    expect(workspaceId).toBeTruthy()

    const accessContext = await firstOwner.query(api.permissions.context.getAccessContext, {})

    expect(accessContext).toMatchObject({
      role: 'owner',
      userId: expect.any(String),
      workspaceId: workspaceId,
      can: {
        [runbookRead.key]: true,
        [runbookCreate.key]: true,
        [runbookBulkDelete.key]: true,
        [mcpManage.key]: true,
      },
    })
  })

  it('returns an onboarding-safe access context for authenticated users without a workspace', async () => {
    const ctx = createCtx()
    const authKey = 'user_without_workspace'
    const userId = await ctx.seed('users', {
      authKey,
      email: 'onboarding@example.com',
      displayName: 'Onboarding User',
      role: 'member',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })

    const accessContext = await ctx
      .asAuthUser({
        authKey,
        email: 'onboarding@example.com',
        displayName: 'Onboarding User',
      })
      .query(api.permissions.context.getAccessContext, {})

    expect(accessContext).toMatchObject({
      role: 'member',
      userId,
      workspaceId: null,
      email: 'onboarding@example.com',
      displayName: 'Onboarding User',
      can: {
        [runbookRead.key]: false,
        [runbookCreate.key]: false,
        [mcpManage.key]: false,
        [runbookBulkDelete.key]: false,
      },
    })
    expect(userId).toBeTruthy()
  })

  it('projects workspace recordAccess for delegated MCP principals', async () => {
    const ctx = createCtx()
    const team = await ctx.seedTenant({
      name: 'Alpha',
      users: {
        owner: { role: 'owner' },
        member: { role: 'member' },
      },
    })
    const keyId = await team.users.owner.mutation(api.features.mcpKeys.domain.create, {
      name: 'Record access key',
      boundUserId: team.users.member.id,
      prefix: 'mcp_record...',
      hash: 'hash_record_access',
    })

    const accessContext = await mcpAgent(
      ctx,
      keyId,
      mcpKeyDelegation({
        keyId,
        userId: team.users.member.id,
        workspaceId: team.id,
      }),
    ).query(api.permissions.context.getAccessContext, {})

    expect(accessContext).toMatchObject({
      role: 'member',
      userId: team.users.member.id,
      can: {
        [runbookRead.key]: true,
        [runbookCreate.key]: true,
        [runbookBulkDelete.key]: false,
        [mcpManage.key]: false,
      },
    })
    expect(accessContext?.workspaceId).toEqual(expect.any(String))
  })

  it('keeps public runbooks visible without auth while workspace queries stay protected', async () => {
    const ctx = createCtx()
    const team = await ctx.seedTenant({
      name: 'Alpha',
      users: {
        owner: { role: 'owner' },
      },
    })

    await team.users.owner.operation(operations.runbooks.create).execute({
      title: 'Public handoff',
      summary: 'Shared with anyone.',
      content: '# Public handoff\n\n1. Share status',
      visibility: 'public',
      tags: ['public'],
    })

    const publicRunbooks = await ctx.raw.query(api.features.runbooks.domain.listPublic, {})
    expect(
      publicRunbooks.some((runbook: { title: string }) => runbook.title === 'Public handoff'),
    ).toBe(true)
    const publicRunbook = publicRunbooks.find(
      (runbook: { title: string }) => runbook.title === 'Public handoff',
    )
    expect(publicRunbook).toBeTruthy()
    expect('workspaceId' in (publicRunbook ?? {})).toBe(false)
    expect('ownerId' in (publicRunbook ?? {})).toBe(false)

    await expect(ctx.raw.query(api.features.runbooks.domain.listWorkspace, {})).rejects.toThrow(
      'Forbidden: Read runbooks',
    )
  })

  it('applies the same create permission rules to forwarded principals', async () => {
    const ctx = createCtx()
    const team = await ctx.seedTenant({
      name: 'Alpha',
      users: {
        viewer: { role: 'viewer' },
        member: { role: 'member' },
      },
    })

    await expect(
      forwardedUser(ctx, team.users.viewer).operation(operations.runbooks.create).execute({
        title: 'Viewer should fail',
        summary: 'No permission',
        content: '# Nope',
        visibility: 'draft',
        tags: [],
      }),
    ).rejects.toThrow(/Forbidden: Create runbook/)

    await expect(
      forwardedUser(ctx, team.users.member)
        .operation(operations.runbooks.create)
        .execute({
          title: 'Member may create',
          summary: 'Allowed',
          content: '# Allowed',
          visibility: 'draft',
          tags: ['ops'],
        }),
    ).resolves.toBeTruthy()
  })

  it('applies the same create permission rules to delegated service principals', async () => {
    const ctx = createCtx()
    const team = await ctx.seedTenant({
      name: 'Alpha',
      users: {
        viewer: { role: 'viewer' },
        member: { role: 'member' },
      },
    })

    await expect(
      webhookService(
        ctx,
        runbookWebhookDelegation({
          userId: team.users.viewer.id,
          workspaceId: team.id,
          deliveryId: 'delivery_viewer',
        }),
      ).mutation(api.features.runbooks.webhooks.createRunbookFromWebhookMutation, {
        deliveryId: 'delivery_viewer',
        workspaceId: team.id,
        title: 'Webhook viewer should fail',
        summary: 'No permission',
        content: '# Nope',
        visibility: 'workspace',
        tags: ['webhook'],
      }),
    ).rejects.toThrow(/Forbidden: Create runbook/)

    await expect(
      webhookService(
        ctx,
        runbookWebhookDelegation({
          userId: team.users.member.id,
          workspaceId: team.id,
          deliveryId: 'delivery_member',
        }),
      ).mutation(api.features.runbooks.webhooks.createRunbookFromWebhookMutation, {
        deliveryId: 'delivery_member',
        workspaceId: team.id,
        title: 'Webhook member may create',
        summary: 'Allowed',
        content: '# Allowed',
        visibility: 'workspace',
        tags: ['webhook'],
      }),
    ).resolves.toBeTruthy()

    await expect(
      webhookService(
        ctx,
        runbookWebhookDelegation({
          userId: team.users.member.id,
          workspaceId: team.id,
          deliveryId: 'delivery_member',
        }),
      ).mutation(api.features.runbooks.webhooks.createRunbookFromWebhookMutation, {
        deliveryId: 'delivery_member',
        workspaceId: team.id,
        title: 'Webhook duplicate',
        summary: 'Duplicate',
        content: '# Duplicate',
        visibility: 'workspace',
        tags: ['webhook'],
      }),
    ).rejects.toThrow(/Duplicate webhook delivery/)
  })

  it('does not record webhook delivery state when the domain write fails', async () => {
    const ctx = createCtx()
    const team = await ctx.seedTenant({
      name: 'Alpha',
      users: {
        member: { role: 'member' },
      },
    })

    await expect(
      webhookService(
        ctx,
        runbookWebhookDelegation({
          userId: team.users.member.id,
          workspaceId: team.id,
          deliveryId: 'delivery_public_denied',
        }),
      ).mutation(api.features.runbooks.webhooks.createRunbookFromWebhookMutation, {
        deliveryId: 'delivery_public_denied',
        workspaceId: team.id,
        title: 'Public webhook should fail',
        summary: 'Denied',
        content: '# Denied',
        visibility: 'public',
        tags: ['webhook'],
      }),
    ).rejects.toThrow(/Only owners and admins can create public runbooks/)

    await ctx.raw.run(async (innerCtx) => {
      const delivery = await innerCtx.db
        .query('runbookWebhookDeliveries')
        .withIndex('by_delivery_id', (q) => q.eq('deliveryId', 'delivery_public_denied'))
        .unique()
      expect(delivery).toBeNull()
    })
  })

  it('rejects delegated service principals with forged binding fields', async () => {
    const ctx = createCtx()
    const team = await ctx.seedTenant({
      name: 'Alpha',
      users: {
        member: { role: 'member' },
      },
    })
    const baseArgs = {
      workspaceId: team.id,
      title: 'Forged binding',
      summary: 'Should fail',
      content: '# Forged',
      visibility: 'workspace',
      tags: ['webhook'],
    }
    const validDelegation = runbookWebhookDelegation({
      userId: team.users.member.id,
      workspaceId: team.id,
      deliveryId: 'delivery_valid_shape',
    })

    await expect(
      webhookService(ctx, {
        ...validDelegation,
        serviceId: 'other-service',
        grantId: 'delivery:delivery_wrong_service',
      }).mutation(api.features.runbooks.webhooks.createRunbookFromWebhookMutation, {
        ...baseArgs,
        deliveryId: 'delivery_wrong_service',
      }),
    ).rejects.toThrow(/serviceId does not match/i)

    await expect(
      webhookService(ctx, {
        ...validDelegation,
        purpose: 'runbook-webhook:delete',
        grantId: 'delivery:delivery_wrong_purpose',
      }).mutation(api.features.runbooks.webhooks.createRunbookFromWebhookMutation, {
        ...baseArgs,
        deliveryId: 'delivery_wrong_purpose',
      }),
    ).rejects.toThrow(/purpose does not match/i)

    await expect(
      webhookService(
        ctx,
        expiredRunbookWebhookDelegation({
          userId: team.users.member.id,
          workspaceId: team.id,
          deliveryId: 'delivery_expired',
        }),
      ).mutation(api.features.runbooks.webhooks.createRunbookFromWebhookMutation, {
        ...baseArgs,
        deliveryId: 'delivery_expired',
      }),
    ).rejects.toThrow(/expiresAt must be in the future/i)
  })

  it('stores only hashes for MCP keys and debounces last-used writes', async () => {
    const ctx = createCtx()
    const team = await ctx.seedTenant({
      name: 'Alpha',
      users: {
        owner: { role: 'owner' },
        member: { role: 'member' },
      },
    })

    const keyId = await team.users.owner.mutation(api.features.mcpKeys.domain.create, {
      name: 'Primary key',
      boundUserId: team.users.member.id,
      prefix: 'mcp_deadbeef...',
      hash: 'hash_123',
    })

    const validated = await ctx.raw.query(api.features.mcpKeys.domain.validate, {
      hash: 'hash_123',
    })
    expect(validated?.id).toBe(keyId)
    expect(validated?.userId).toBe(team.users.member.id)
    expect(validated?.role).toBe('member')

    await ctx.raw.mutation(api.features.mcpKeys.domain.touch, { hash: 'hash_123' })
    await ctx.raw.mutation(api.features.mcpKeys.domain.touch, { hash: 'hash_123' })

    const keysAfterFastTouch = await team.users.owner.query(api.features.mcpKeys.domain.list, {})
    const firstLastUsedAt = keysAfterFastTouch[0]?.lastUsedAt
    expect(firstLastUsedAt).toEqual(expect.any(Number))

    await ctx.raw.run(async (innerCtx) => {
      await innerCtx.db.patch(keyId as never, {
        lastUsedAt: 0,
      })
    })
    await ctx.raw.mutation(api.features.mcpKeys.domain.touch, { hash: 'hash_123' })

    const keysAfterDebouncedTouch = await team.users.owner.query(
      api.features.mcpKeys.domain.list,
      {},
    )
    expect(keysAfterDebouncedTouch[0]?.lastUsedAt).toEqual(expect.any(Number))
    expect(keysAfterDebouncedTouch[0]?.lastUsedAt).not.toBe(0)
    expect('hash' in (keysAfterDebouncedTouch[0] ?? {})).toBe(false)
    expect(keysAfterDebouncedTouch[0]?.boundUser?.authKey).toBe(team.users.member.authKey)
    expect(keysAfterDebouncedTouch[0]?.effectiveRole).toBe('member')
    expect(keysAfterDebouncedTouch[0]?.usability).toBe('usable')
  })

  it('resolves bound users with live role changes', async () => {
    const ctx = createCtx()
    const team = await ctx.seedTenant({
      name: 'Alpha',
      users: {
        owner: { role: 'owner' },
        member: { role: 'member' },
      },
    })

    await team.users.owner.mutation(api.features.mcpKeys.domain.create, {
      name: 'Member key',
      boundUserId: team.users.member.id,
      prefix: 'mcp_member...',
      hash: 'hash_member',
    })

    expect(
      await ctx.raw.query(api.features.mcpKeys.domain.validate, { hash: 'hash_member' }),
    ).toMatchObject({
      role: 'member',
      userId: team.users.member.id,
    })

    await ctx.raw.run(async (innerCtx) => {
      await innerCtx.db.patch(team.users.member.id as never, {
        role: 'viewer',
        updatedAt: Date.now(),
      })
    })

    expect(
      await ctx.raw.query(api.features.mcpKeys.domain.validate, { hash: 'hash_member' }),
    ).toMatchObject({
      role: 'viewer',
      userId: team.users.member.id,
    })
  })

  it('marks dead bindings in listings and invalidates affected keys', async () => {
    const ctx = createCtx()
    const team = await ctx.seedTenant({
      name: 'Alpha',
      users: {
        owner: { role: 'owner' },
        member: { role: 'member' },
      },
    })

    const keyId = await team.users.owner.mutation(api.features.mcpKeys.domain.create, {
      name: 'Member key',
      boundUserId: team.users.member.id,
      prefix: 'mcp_member...',
      hash: 'hash_member_dead',
    })

    await ctx.raw.run(async (innerCtx) => {
      await innerCtx.db.patch(team.users.member.id as never, {
        workspaceId: undefined,
        updatedAt: Date.now(),
      })
    })

    expect(
      await ctx.raw.query(api.features.mcpKeys.domain.validate, { hash: 'hash_member_dead' }),
    ).toBeNull()

    const keys = await team.users.owner.query(api.features.mcpKeys.domain.list, {})
    expect(keys.find((key: { _id: string }) => key._id === keyId)?.usability).toBe(
      'bound_user_missing',
    )
  })
})
