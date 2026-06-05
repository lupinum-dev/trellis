/**
 * Tenant-isolation integration surface.
 *
 * These handlers exist to exercise three distinct trust levels that
 * `defineTrellis` exposes:
 *
 * - `ctx.db`              — default; RLS + isolation enforced. Writes
 *                           and reads for other tenants are blocked.
 * - `crossTenant`         — definition-visible named capability. The handler
 *                           receives narrow methods, not a generic DB escape.
 * - `query.unsafe(...)`   — bypasses the protected handler pipeline, but plain
 *                           `ctx.db` still keeps isolation unless the
 *                           handler uses a reviewed capability.
 *
 * The `posts` table in this harness is configured to participate in
 * isolation via `organizationId` (see ./functions.ts). Tests in
 * `crossTenant.test.ts` exercise these handlers to prove runtime
 * enforcement and observability emission.
 */
import { defineArgs } from '@lupinum/trellis/args'
import { unsafe as unsafePermit } from '@lupinum/trellis/backend'
import { v } from 'convex/values'

import type { DatabaseReader } from './_generated/server'
import { query } from './functions'

const getPostArgs = defineArgs({
  args: {
    id: v.id('posts'),
  },
})

/**
 * Read a post across scopes using an explicit named cross-tenant capability.
 *
 * In contrast to `posts.get`, this handler does not manually check
 * `appIdentity.workspaceId === post.organizationId`. The runtime's cross-scope
 * capability exposes the post regardless of the appIdentity's tenant.
 */
export const getAnyPost = query.authenticated({
  args: getPostArgs.args,
  crossTenant: {
    reason: 'Harness cross-scope post lookup.',
    tables: ['posts'],
    access: ({ db }) => {
      const readDb = db as DatabaseReader

      return {
        getPost: async (id: string) => await readDb.get(id as never),
      }
    },
  },
  handler: async (ctx, args) => {
    return await ctx.crossTenant.getPost(args.id)
  },
})

/**
 * List all posts across all tenants using an explicit named capability.
 */
export const listAllPosts = query.authenticated({
  args: {},
  crossTenant: {
    reason: 'Harness cross-scope post listing.',
    tables: ['posts'],
    access: ({ db }) => {
      const readDb = db as DatabaseReader

      return {
        listPosts: async () => await readDb.query('posts' as never).collect(),
      }
    },
  },
  handler: async (ctx) => {
    return await ctx.crossTenant.listPosts()
  },
})

/**
 * Read a post through `query.unsafe(...)` while still using the default
 * tenant-aware `ctx.db` inside the handler.
 *
 * This exists to prove that `unsafe.*` does not silently become a
 * cross-scope DB seam on its own.
 */
export const getAnyPostRaw = query.unsafe({
  permit: unsafePermit.permit({
    kind: 'harnessProbe',
    reason: 'Harness full-bypass post lookup.',
    scope: ['harness'],
  }),
  args: getPostArgs.args,
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id)
  },
})
