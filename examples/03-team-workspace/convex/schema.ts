/**
 * Why this file exists:
 * The full example needs four tables:
 * - workspaces: the tenant boundary
 * - users: the source of appIdentity role + tenant membership
 * - todos: the tenant-scoped resource protected by permissions
 * - processedEvents: replay protection for webhook idempotency
 */
import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'

import { todosTables } from './features/todos/schema'
import { userTables } from './features/users/schema'
import { workspaceTables } from './features/workspaces/schema'

export default defineSchema({
  ...workspaceTables,
  ...userTables,
  ...todosTables,

  destructiveConfirmations: defineTable({
    tokenHash: v.string(),
    jti: v.string(),
    operationId: v.string(),
    executePath: v.string(),
    previewPath: v.string(),
    callerKey: v.string(),
    scopeKey: v.string(),
    argsHash: v.string(),
    argsFieldHashes: v.optional(v.record(v.string(), v.string())),
    previewHash: v.string(),
    versionHash: v.optional(v.string()),
    createdAt: v.number(),
    expiresAt: v.number(),
    redeemedAt: v.optional(v.number()),
  })
    .index('by_token_hash', ['tokenHash'])
    .index('by_jti', ['jti'])
    .index('by_expires_at', ['expiresAt']),

  destructiveAuditLog: defineTable({
    operationId: v.string(),
    jti: v.string(),
    callerKey: v.string(),
    scopeKey: v.string(),
    argsHash: v.string(),
    previewHash: v.string(),
    executedAt: v.number(),
    executePath: v.string(),
  }),

  trustedReplay: defineTable({
    jti: v.string(),
    functionRef: v.string(),
    purpose: v.string(),
    transport: v.string(),
    replayMode: v.string(),
    argsHash: v.string(),
    subject: v.string(),
    issuer: v.string(),
    audience: v.string(),
    state: v.union(v.literal('claimed'), v.literal('completed'), v.literal('failed')),
    createdAt: v.number(),
    updatedAt: v.number(),
    expiresAt: v.number(),
    completedAt: v.optional(v.number()),
    failedAt: v.optional(v.number()),
    failure: v.optional(v.object({ message: v.string() })),
  })
    .index('by_jti', ['jti'])
    .index('by_expires_at', ['expiresAt']),
})
