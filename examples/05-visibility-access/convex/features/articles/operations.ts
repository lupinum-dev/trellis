import {
  operation,
  operationEffect,
  operationIssue,
  operationPreview,
  operationPreviewValidator,
  workspaceScope,
} from '@lupinum/trellis/app'
import { deny, loadTenantResource as loadResource } from '@lupinum/trellis/auth'
import { v } from 'convex/values'

import { revokeArticleShareToken } from '../../../shared/features/articles/contract'
import type { Doc, Id } from '../../_generated/dataModel'
import type { MutationCtx } from '../../_generated/server'
import type { AppIdentity } from '../../auth/appIdentity'
import { shareCreate } from './permissions'

type WorkspaceMutationCtx = MutationCtx & {
  workspaceId: Id<'workspaces'>
  appIdentity: () => Promise<AppIdentity>
}
type RevokeShareTokenArgs = { tokenId: Id<'shareTokens'> }
type RevokeShareTokenLoaded = { token: Doc<'shareTokens'> }

export const revokeShareTokenOp = operation.destructive({
  id: 'shareTokens.revoke',
  args: revokeArticleShareToken.args,
  returns: v.null(),
  scope: workspaceScope(),
  permission: shareCreate,
  safety: 'destructive-write',
  previewReturns: operationPreviewValidator({
    confirm: v.object({
      operation: v.literal('shareTokens.revoke'),
      targetId: v.id('shareTokens'),
      affectedCounts: v.object({
        shareTokens: v.number(),
      }),
    }),
  }),
  load: async (
    ctx: WorkspaceMutationCtx,
    args: RevokeShareTokenArgs,
  ): Promise<RevokeShareTokenLoaded> => {
    const appIdentity = await ctx.appIdentity()
    const token = loadResource(
      appIdentity,
      (await ctx.db.get(args.tokenId)) as Doc<'shareTokens'> | null,
      'Share token',
    )
    return { token }
  },
  preview: async (
    _ctx: WorkspaceMutationCtx,
    _args: RevokeShareTokenArgs,
    { token }: RevokeShareTokenLoaded,
  ) =>
    operationPreview({
      summary: `Will revoke ${token.prefix}.`,
      warnings: [
        operationIssue({
          code: 'shared-links-stop-working',
          message: 'Existing shared links using this token will stop working immediately.',
        }),
      ],
      effects: [
        operationEffect({ kind: 'shareTokens', summary: 'Share tokens revoked', count: 1 }),
      ],
      confirm: {
        operation: 'shareTokens.revoke',
        targetId: token._id,
        affectedCounts: { shareTokens: 1 },
      },
    }),
  handler: async (
    ctx: WorkspaceMutationCtx,
    args: RevokeShareTokenArgs,
    { token }: RevokeShareTokenLoaded,
  ) => {
    if (token.revokedAt) throw deny('Already revoked.')
    await ctx.db.patch(args.tokenId, { revokedAt: Date.now() })
    return null
  },
})
