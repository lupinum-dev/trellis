/**
 * Why this file exists:
 * Example 03 is meant to prove the safety model, not just describe it.
 * These tests exercise isolation, ownership rules, and the small webhook boundary.
 */
/// <reference types="vite/client" />

import { requireDelegationBinding } from '@lupinum/trellis/backend'
import { createTestContext } from '@lupinum/trellis/testing'
import { anyApi } from 'convex/server'
import { describe, expect, it } from 'vitest'

import { hasProcessedEvent, processDomainIdempotentEvent } from './auth/idempotency'
import { todoCreate, todoRead } from './features/todos'
import schema from './schema'
import { modules } from './test.setup'

type WorkspaceRole = 'owner' | 'admin' | 'member' | 'viewer'
const api = anyApi as any
const IDENTITY_FORWARDING_KEY = 'team-workspace-test-identity-forwarding-key'

function createCtx() {
  return createTestContext<typeof schema, WorkspaceRole>({
    schema,
    modules,
    identityForwardingKey: IDENTITY_FORWARDING_KEY,
  })
}

function webhookService(
  ctx: ReturnType<typeof createCtx>,
  actingFor: { subject: string } & Record<string, unknown>,
) {
  return ctx.asCaller(
    {
      kind: 'service',
      serviceId: 'todo-sync-webhook',
      subject: 'service:todo-sync-webhook',
    },
    {
      actingFor,
      transport: 'webhook',
      purpose: 'mutation',
      replayMode: 'domain-idempotency',
    },
  )
}

async function createTodoFromWebhook(
  ctx: ReturnType<typeof createCtx>,
  args: Record<string, unknown>,
  actingFor: { subject: string } & Record<string, unknown>,
) {
  return await webhookService(ctx, actingFor).mutation(
    api.features.todos.webhooks.processTodoSyncWebhookMutation,
    args,
  )
}

describe('team todo example', () => {
  it('lets a member update their own todo', async () => {
    const ctx = createCtx()
    const team = await ctx.seedTenant({
      name: 'Alpha',
      users: {
        alice: { role: 'member' },
      },
    })

    const todoId = await team.users.alice.mutation(api.features.todos.domain.create, {
      title: 'Alice todo',
    })

    await team.users.alice.mutation(api.features.todos.domain.setCompleted, {
      id: todoId,
      completed: true,
    })

    const todos = await team.users.alice.query(api.features.todos.domain.list, {})
    expect(todos).toHaveLength(1)
    expect(todos[0]?.completed).toBe(true)
  })

  it('blocks a member from updating another member`s todo', async () => {
    const ctx = createCtx()
    const team = await ctx.seedTenant({
      name: 'Alpha',
      users: {
        alice: { role: 'member' },
        bob: { role: 'member' },
      },
    })

    const todoId = await team.users.alice.mutation(api.features.todos.domain.create, {
      title: 'Alice private team todo',
    })

    await expect(
      team.users.bob.mutation(api.features.todos.domain.setCompleted, {
        id: todoId,
        completed: true,
      }),
    ).rejects.toThrow('Forbidden: Update todo')
  })

  it('keeps tenants isolated from each other', async () => {
    const ctx = createCtx()
    const alpha = await ctx.seedTenant({
      name: 'Alpha',
      users: {
        alice: { role: 'member' },
      },
    })
    const beta = await ctx.seedTenant({
      name: 'Beta',
      users: {
        bruno: { role: 'member' },
      },
    })

    await alpha.users.alice.mutation(api.features.todos.domain.create, {
      title: 'Alpha only',
    })
    await beta.users.bruno.mutation(api.features.todos.domain.create, {
      title: 'Beta only',
    })

    const alphaTodos = await alpha.users.alice.query(api.features.todos.domain.list, {})
    const betaTodos = await beta.users.bruno.query(api.features.todos.domain.list, {})

    expect(alphaTodos).toHaveLength(1)
    expect(alphaTodos[0]?.title).toBe('Alpha only')
    expect(betaTodos).toHaveLength(1)
    expect(betaTodos[0]?.title).toBe('Beta only')
  })

  it('returns access context booleans for contrasting roles', async () => {
    const ctx = createCtx()
    const team = await ctx.seedTenant({
      name: 'Alpha',
      users: {
        owner: { role: 'owner' },
        viewer: { role: 'viewer' },
      },
    })

    const ownerCtx = await team.users.owner.query(api.permissions.context.getAccessContext, {})
    const viewerCtx = await team.users.viewer.query(api.permissions.context.getAccessContext, {})

    expect(ownerCtx?.can[todoCreate.key]).toBe(true)
    expect(viewerCtx?.can[todoCreate.key]).toBe(false)
    expect(viewerCtx?.can[todoRead.key]).toBe(true)
  })

  it('returns null context and denies workspace todo queries for anonymous callers', async () => {
    const ctx = createCtx()

    await expect(ctx.raw.query(api.permissions.context.getAccessContext, {})).resolves.toBeNull()
    await expect(ctx.raw.query(api.features.todos.domain.list, {})).rejects.toThrow(
      'Forbidden: Read todos',
    )
  })

  it('returns onboarding access context for signed-in users without a workspace', async () => {
    const ctx = createCtx()
    const now = Date.now()
    const authKey = 'onboarding-user'

    const userId = await ctx.raw.run(async (innerCtx) => {
      return await innerCtx.db.insert('users', {
        authKey,
        role: 'member',
        email: 'onboarding@example.test',
        displayName: 'Onboarding User',
        createdAt: now,
        updatedAt: now,
      })
    })

    const onboardingUser = ctx.raw.withIdentity({ subject: authKey, tokenIdentifier: authKey })
    const permissionCtx = await onboardingUser.query(api.permissions.context.getAccessContext, {})

    expect(permissionCtx).toMatchObject({
      userId,
      role: 'member',
      workspaceId: null,
      email: 'onboarding@example.test',
      displayName: 'Onboarding User',
    })
    expect(permissionCtx?.can[todoCreate.key]).toBe(false)
    expect(permissionCtx?.can[todoRead.key]).toBe(false)
  })
})

describe('webhook idempotency', () => {
  it('denies duplicate webhook events', async () => {
    const ctx = createCtx()
    const team = await ctx.seedTenant({
      name: 'Alpha',
      users: { owner: { role: 'owner' } },
    })

    await team.users.owner.mutation(api.features.todos.webhooks.processTodoSyncWebhookMutation, {
      workspaceId: team.id,
      eventId: 'evt-duplicate',
      title: 'First sync',
    })

    await expect(
      team.users.owner.mutation(api.features.todos.webhooks.processTodoSyncWebhookMutation, {
        workspaceId: team.id,
        eventId: 'evt-duplicate',
        title: 'Duplicate sync',
      }),
    ).rejects.toThrow('Event already processed.')
  })

  it('treats source plus event id as the replay key', async () => {
    const ctx = createCtx()

    await ctx.raw.run(async (innerCtx) => {
      await processDomainIdempotentEvent(
        innerCtx.db,
        {
          source: 'webhook',
          eventId: 'evt-shared',
        },
        async () => null,
      )

      await expect(hasProcessedEvent(innerCtx.db, 'erp-sync', 'evt-shared')).resolves.toBe(false)
      await expect(hasProcessedEvent(innerCtx.db, 'webhook', 'evt-shared')).resolves.toBe(true)
    })
  })

  it('does not record a processed event when the domain write fails', async () => {
    const ctx = createCtx()

    await ctx.raw.run(async (innerCtx) => {
      await expect(
        processDomainIdempotentEvent(
          innerCtx.db,
          {
            source: 'webhook',
            eventId: 'evt-failed-domain-write',
          },
          async () => {
            throw new Error('domain write failed')
          },
        ),
      ).rejects.toThrow('domain write failed')

      await expect(
        hasProcessedEvent(innerCtx.db, 'webhook', 'evt-failed-domain-write'),
      ).resolves.toBe(false)
    })
  })

  it('webhook-created todos are visible in the workspace list', async () => {
    const ctx = createCtx()
    const team = await ctx.seedTenant({
      name: 'Alpha',
      users: { member: { role: 'member' } },
    })

    await team.users.member.mutation(api.features.todos.webhooks.processTodoSyncWebhookMutation, {
      workspaceId: team.id,
      eventId: 'evt-visible',
      title: 'Webhook todo',
    })

    const todos = await team.users.member.query(api.features.todos.domain.list, {})
    expect(todos).toHaveLength(1)
    expect(todos[0]?.title).toBe('Webhook todo')
    expect(todos[0]?.source).toBe('webhook')
  })

  it('accepts signed service forwarding only with backend-valid delegation binding', async () => {
    const ctx = createCtx()
    const team = await ctx.seedTenant({
      name: 'Alpha',
      users: { member: { role: 'member' } },
    })
    const args = {
      workspaceId: team.id,
      eventId: 'evt-forwarded',
      title: 'Forwarded webhook todo',
    }
    const actingFor = requireDelegationBinding({
      serviceId: 'todo-sync-webhook',
      targetUserId: team.users.member.id,
      workspaceId: team.id,
      purpose: 'todo-sync-webhook',
      grantSource: 'workspace-service-policy',
      grantId: 'delivery:evt-forwarded',
      expiresAt: Date.now() + 60_000,
    })

    await createTodoFromWebhook(ctx, args, actingFor)

    const todos = await team.users.member.query(api.features.todos.domain.list, {})
    expect(todos).toHaveLength(1)
    expect(todos[0]?.title).toBe('Forwarded webhook todo')
    expect(todos[0]?.ownerId).toBe(team.users.member.id)
  })

  it('rejects signed service forwarding when the delegation workspace is forged', async () => {
    const ctx = createCtx()
    const alpha = await ctx.seedTenant({
      name: 'Alpha',
      users: { member: { role: 'member' } },
    })
    const beta = await ctx.seedTenant({
      name: 'Beta',
      users: { member: { role: 'member' } },
    })
    const args = {
      workspaceId: alpha.id,
      eventId: 'evt-forged-workspace',
      title: 'Forged webhook todo',
    }
    const actingFor = requireDelegationBinding({
      serviceId: 'todo-sync-webhook',
      targetUserId: alpha.users.member.id,
      workspaceId: beta.id,
      purpose: 'todo-sync-webhook',
      grantSource: 'workspace-service-policy',
      grantId: 'delivery:evt-forged-workspace',
      expiresAt: Date.now() + 60_000,
    })

    await expect(createTodoFromWebhook(ctx, args, actingFor)).rejects.toThrow(
      /workspaceId does not match|workspace user/i,
    )
  })

  it('rejects signed service forwarding when delegation evidence is expired', async () => {
    const ctx = createCtx()
    const team = await ctx.seedTenant({
      name: 'Alpha',
      users: { member: { role: 'member' } },
    })
    const args = {
      workspaceId: team.id,
      eventId: 'evt-expired-binding',
      title: 'Expired webhook todo',
    }
    const actingFor = {
      subject: `user:${team.users.member.id}`,
      grantSource: 'workspace-service-policy',
      issuer: 'trellis://server',
      serviceId: 'todo-sync-webhook',
      targetUserId: team.users.member.id,
      workspaceId: team.id,
      purpose: 'todo-sync-webhook',
      expiresAt: Date.now() - 1,
    }

    await expect(createTodoFromWebhook(ctx, args, actingFor)).rejects.toThrow(
      /expiresAt must be in the future/i,
    )
  })
})
