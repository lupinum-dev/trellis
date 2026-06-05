import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const repoRoot = resolve(__dirname, '../..')

describe('example webhook security posture', () => {
  it('routes examples through HMAC verification and proof objects where forwarding is used', () => {
    const teamWorkspace = readFileSync(
      resolve(repoRoot, 'examples/03-team-workspace/server/api/webhook.post.ts'),
      'utf8',
    )
    const saasPlatform = readFileSync(
      resolve(repoRoot, 'examples/04-saas-platform/server/api/webhook.post.ts'),
      'utf8',
    )
    const mcpReference = readFileSync(
      resolve(repoRoot, 'examples/07-mcp-reference/server/api/runbook-webhook.post.ts'),
      'utf8',
    )
    const sources = [teamWorkspace, saasPlatform, mcpReference]
    const helper = readFileSync(resolve(repoRoot, 'src/runtime/server/webhooks.ts'), 'utf8')

    for (const source of sources) {
      expect(source).toContain('verifyHmacWebhookDelivery')
      expect(source).not.toContain('signature !== getWebhookSecret()')
      expect(source).not.toContain('readSharedSecretWebhookBody')
      expect(source).not.toContain("auth: 'trusted'")
    }

    for (const forwardedSource of [teamWorkspace, mcpReference]) {
      expect(forwardedSource).toContain('transportProof.webhook')
      expect(forwardedSource).toContain('domainIdempotency')
      expect(forwardedSource).toContain('requireDelegationBinding')
    }

    expect(saasPlatform).toContain("{ auth: 'none' }")
    expect(helper).toContain('timingSafeEqual')
    expect(helper).not.toContain('readSharedSecretWebhookBody')
    expect(helper).not.toContain('readHmacVerifiedWebhookBody')
    expect(helper).not.toContain('idempotency?:')
  })
})
