import { describe, expect, it } from 'vitest'

import {
  collectSecurityContract,
  stableSecurityContractString,
} from '../../scripts/lib/security-contract.mjs'

// Intentional 0.3.0 security contract coverage: deleted public symbols appear
// here only as banned-export assertions.

describe('security contract generator', () => {
  it('collects the Phase A security contract from source-controlled facts', () => {
    const contract = collectSecurityContract(process.cwd())

    expect(contract.version).toBe(2)
    expect(contract.phase).toBe('0.3.1-hardening')
    expect(contract.publicPackageExports).toContain('./server')
    expect(contract.bannedPublicExports).toContainEqual({
      entry: '@lupinum/trellis/server',
      symbols: [
        'delegateToUser',
        'readSharedSecretWebhookBody',
        'isSharedSecretWebhookSignatureValid',
        'readHmacVerifiedWebhookBody',
      ],
    })
    expect(contract.bannedPublicExports).toContainEqual({
      entry: '@lupinum/trellis/auth',
      symbols: ['authRequired', 'isAuthRequiredGuard', 'AuthRequiredGuard'],
    })
    expect(contract.sourcePolicy.violationCount).toBe(0)
    expect(contract.sourcePolicy.policies.map((policy) => policy.id)).toContain(
      'no-stringly-trusted-auth',
    )
    expect(contract.sourcePolicy.policies.map((policy) => policy.id)).toContain(
      'no-app-surface-raw-forwarding-envelope',
    )
    expect(contract.securityRuntimeProofs).toContain('tests/unit/functions-defineTrellis.test.ts')
    expect(contract.securityRuntimeProofs).toContain('tests/unit/auth-index.test.ts')
    expect(contract.securityRuntimeProofs).toContain('tests/unit/auth-proxy-handler.server.test.ts')
    expect(contract.securityRuntimeProofs).toContain('tests/unit/cli-add-resource.test.ts')
    expect(contract.securityRuntimeProofs).toContain('tests/unit/server-convex-utils.test.ts')
    expect(contract.securityRuntimeProofs).toContain('tests/unit/server-boundaries.test.ts')
    expect(contract.securityRuntimeProofs).toContain('tests/unit/operation-ref-codegen.test.ts')
    expect(contract.securityRuntimeProofs).toContain(
      'tests/unit/phase0-workspace-mcp-fixture.test.ts',
    )
    expect(contract.maintainedExampleProofs.map((proof) => proof.id)).toEqual(
      expect.arrayContaining([
        'example03-webhook-route-retry',
        'example03-webhook-domain-duplicate',
        'example07-webhook-route-retry',
        'example07-webhook-domain-duplicate',
        'example07-webhook-forged-binding',
      ]),
    )
    expect(contract.maintainedExampleProofs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'example03-webhook-route-retry',
          file: 'examples/03-team-workspace/server/api/webhook.post.test.ts',
          evidenceFor: expect.arrayContaining(['route retry after backend dispatch failure']),
        }),
        expect.objectContaining({
          id: 'example07-webhook-domain-duplicate',
          file: 'examples/07-mcp-reference/test/mcpReference.test.ts',
          evidenceFor: expect.arrayContaining(['backend-owned delivery idempotency']),
        }),
        expect.objectContaining({
          id: 'example07-webhook-forged-binding',
          file: 'examples/07-mcp-reference/test/mcpReference.test.ts',
          evidenceFor: expect.arrayContaining(['wrong purpose rejection']),
        }),
      ]),
    )
    expect(contract.scope.omittedUntilPhaseB).not.toContain('verified route proof kind')
    expect(contract.scope.omittedUntilPhaseB).not.toContain('trusted route idempotency source')
    expect(contract.scope.omittedUntilPhaseB).not.toContain('delegation binding source')
    expect(contract.scope.omittedUntilPhaseB).not.toContain(
      'webhook verifier canonicalization metadata',
    )
    expect(contract.webhookVerifier).toEqual({
      file: 'src/runtime/server/webhooks.ts',
      helper: 'verifyHmacWebhookDelivery',
      signatureFactory: 'createWebhookHmacSignature',
      algorithm: 'sha256',
      signaturePrefix: 'sha256=',
      payloadEncoding: 'utf8',
      payloadSeparator: '.',
      binds: {
        timestamp: true,
        deliveryId: true,
        rawBody: true,
      },
      defaultToleranceMs: 300_000,
      timestampAcceptsSecondsAndMilliseconds: true,
      rejectsMultiValueHeaders: true,
      usesTimingSafeEqual: true,
      readsRawBodyOnce: true,
      routeSideIdempotencyHook: 'absent',
      defaultHeaders: {
        signature: 'x-signature',
        timestamp: 'x-timestamp',
        deliveryId: 'x-delivery-id',
      },
    })
    expect(contract.serverRoutes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          file: 'examples/03-team-workspace/server/api/webhook.post.ts',
          method: 'POST',
          usesHmacWebhookVerifier: true,
          usesTransportProof: true,
          transportProofKinds: ['webhook'],
          replayModes: ['domain-idempotency'],
          usesDelegationBinding: true,
          usesRouteSideIdempotency: false,
          forwardsConvexMutation: true,
          usesRawTrustedAuth: false,
        }),
        expect.objectContaining({
          file: 'examples/04-saas-platform/server/api/webhook.post.ts',
          method: 'POST',
          usesHmacWebhookVerifier: true,
          usesTransportProof: false,
          replayModes: [],
          usesDelegationBinding: false,
          forwardsConvexMutation: true,
          usesNoAuth: true,
        }),
        expect.objectContaining({
          file: 'examples/07-mcp-reference/server/api/runbook-webhook.post.ts',
          method: 'POST',
          usesHmacWebhookVerifier: true,
          usesTransportProof: true,
          transportProofKinds: ['webhook'],
          replayModes: ['domain-idempotency'],
          usesDelegationBinding: true,
          usesRawTrustedAuth: false,
        }),
      ]),
    )
    expect(contract.serverRoutes.filter((route) => route.usesRawTrustedAuth)).toEqual([])
    expect(contract.delegationBindings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          file: 'examples/03-team-workspace/server/api/webhook.post.ts',
          serviceId: 'todo-sync-webhook',
          purpose: 'todo-sync-webhook',
          grantSource: 'workspace-service-policy',
          hasGrantId: true,
          hasExpiresAt: true,
          hasReason: true,
          hasTargetUserId: true,
          hasWorkspaceId: true,
        }),
        expect.objectContaining({
          file: 'examples/07-mcp-reference/server/api/runbook-webhook.post.ts',
          serviceId: 'runbook-webhook',
          purpose: 'runbook-webhook:create',
          grantSource: 'workspace-service-policy',
          hasGrantId: true,
          hasExpiresAt: true,
          hasReason: true,
          hasTargetUserId: true,
          hasWorkspaceId: true,
        }),
      ]),
    )
    expect(contract.publicReads).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          exportName: 'list',
          file: 'examples/01-public-todo/convex/features/todos/domain.ts',
          reads: ['todos'],
        }),
      ]),
    )
    expect(contract.scope.omittedUntilPhaseB).not.toContain('service-subject contract metadata')
    expect(contract.scope.omittedUntilPhaseB).not.toContain(
      'service-subject doctor/replay/audit metadata',
    )
    expect(contract.serviceSubjects).toEqual(
      expect.arrayContaining([
        {
          file: 'examples/03-team-workspace/convex/auth/services.ts',
          line: 6,
          exportName: 'services',
          serviceId: 'todo-sync-webhook',
          access: 'restricted',
          tables: ['processedEvents', 'todos', 'users'],
          tenant: 'derived',
          hasDeriveTenant: true,
          metadata: {
            source: 'verifiedWebhook',
            purpose: 'todo-sync-webhook',
            allowedOperations: ['todos.process-sync-webhook'],
            allowedFunctionRefs: ['features/todos/webhooks:processTodoSyncWebhookMutation'],
            replayMode: 'domain-idempotency',
            actingFor: true,
            auditEvent: 'todo.sync.webhook.processed',
            auditTable: 'processedEvents',
            auditCorrelationId: 'args.eventId',
          },
        },
        {
          file: 'examples/07-mcp-reference/convex/auth/services.ts',
          line: 9,
          exportName: 'services',
          serviceId: 'runbook-webhook',
          access: 'restricted',
          tables: ['runbooks', 'runbookWebhookDeliveries', 'users'],
          tenant: 'derived',
          hasDeriveTenant: true,
          metadata: {
            source: 'verifiedWebhook',
            purpose: 'runbook-webhook:create',
            allowedOperations: ['runbooks.create-from-webhook'],
            allowedFunctionRefs: [],
            replayMode: 'domain-idempotency',
            actingFor: true,
            auditEvent: 'runbook.webhook.created',
            auditTable: 'runbookWebhookDeliveries',
            auditCorrelationId: 'args.deliveryId',
          },
        },
      ]),
    )
    expect(contract.serviceSubjects.filter((service) => service.access === 'unrestricted')).toEqual(
      [],
    )
    expect(contract.backendFunctions.length).toBeGreaterThan(0)
    expect(contract.backendFunctions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          file: 'examples/02-auth-todo/convex/features/todos/domain.ts',
          exportName: 'list',
          functionType: 'query',
          lane: 'authenticated',
        }),
        expect.objectContaining({
          file: 'examples/03-team-workspace/convex/features/todos/domain.ts',
          exportName: 'list',
          functionType: 'query',
          lane: 'workspace',
        }),
        expect.objectContaining({
          file: 'examples/03-team-workspace/convex/features/todos/webhooks.ts',
          exportName: 'processTodoSyncWebhookMutation',
          functionType: 'mutation',
          lane: 'authenticated',
        }),
        expect.objectContaining({
          file: 'examples/08-component-mini-cms/convex/components/miniCms/features/pages/domain.ts',
          exportName: 'listStudio',
          functionType: 'query',
          lane: 'authenticated',
        }),
        expect.objectContaining({
          file: 'examples/08-component-mini-cms/convex/components/miniCms/features/pages/domain.ts',
          exportName: 'publish',
          functionType: 'transportMutation',
          lane: 'authenticated',
        }),
      ]),
    )
    expect(contract.operations.length).toBeGreaterThan(0)
    expect(contract.operations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          file: 'apps/harness/convex/comments.ts',
          exportName: 'createCommentOp',
          id: 'comments.create',
          type: 'mutation',
          identityForwardingTransport: 'mcp',
        }),
        expect.objectContaining({
          file: 'apps/harness/convex/notes.ts',
          exportName: 'addNoteOp',
          id: 'notes.add',
          type: 'publicMutation',
          identityForwardingTransport: 'mcp',
        }),
        expect.objectContaining({
          file: 'apps/harness/convex/posts.ts',
          exportName: 'removePostOp',
          id: 'posts.remove',
          type: 'destructive',
          executeFunctionRef: 'posts:removeWithConfirmation',
          identityForwardingTransport: 'mcp',
        }),
        expect.objectContaining({
          file: 'examples/03-team-workspace/convex/features/todos/webhooks.ts',
          exportName: 'processTodoSyncWebhookOp',
          id: 'todos.process-sync-webhook',
          executeFunctionRef: 'features/todos/webhooks:processTodoSyncWebhookMutation',
          identityForwardingTransport: 'webhook',
        }),
      ]),
    )
    expect(contract.mcpTools.length).toBeGreaterThan(0)
  })

  it('serializes deterministically as JSON', () => {
    const first = stableSecurityContractString(collectSecurityContract(process.cwd()))
    const second = stableSecurityContractString(collectSecurityContract(process.cwd()))

    expect(first).toBe(second)
    expect(() => JSON.parse(first)).not.toThrow()
  })
})
