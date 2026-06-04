import { describe, expect, it } from 'vitest'

import {
  collectSecurityContract,
  stableSecurityContractString,
} from '../../scripts/lib/security-contract.mjs'

describe('security contract generator', () => {
  it('collects the Phase A security contract from source-controlled facts', () => {
    const contract = collectSecurityContract(process.cwd())

    expect(contract.version).toBe(1)
    expect(contract.phase).toBe('0.3.0-phase-a')
    expect(contract.publicPackageExports).toContain('./server')
    expect(contract.bannedPublicExports).toContainEqual({
      entry: '@lupinum/trellis/server',
      symbols: ['delegateToUser', 'readSharedSecretWebhookBody'],
    })
    expect(contract.sourcePolicy.violationCount).toBe(0)
    expect(contract.sourcePolicy.policies.map((policy) => policy.id)).toContain(
      'no-stringly-trusted-auth',
    )
    expect(contract.securityRuntimeProofs).toContain(
      'tests/unit/functions-defineTrellis.test.ts',
    )
    expect(contract.publicReadTables).toEqual(
      expect.arrayContaining([
        {
          file: 'examples/01-public-todo/convex/functions.ts',
          readTables: ['todos'],
        },
      ]),
    )
    expect(contract.backendFunctions.length).toBeGreaterThan(0)
    expect(contract.operations.length).toBeGreaterThan(0)
    expect(contract.mcpTools.length).toBeGreaterThan(0)
  })

  it('serializes deterministically as JSON', () => {
    const first = stableSecurityContractString(collectSecurityContract(process.cwd()))
    const second = stableSecurityContractString(collectSecurityContract(process.cwd()))

    expect(first).toBe(second)
    expect(() => JSON.parse(first)).not.toThrow()
  })
})
