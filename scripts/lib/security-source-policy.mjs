import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'

// Intentional 0.3.0 security policy data: deleted API names and old-path
// tokens in this file are scanner patterns that fail production-copyable
// surfaces, not retained implementation paths.
export const securitySourcePolicyRoots = [
  'apps/docs/content/docs',
  'apps/harness/convex',
  'apps/harness/server',
  'examples',
  'src/cli/starter-fixtures',
  'src/runtime/convex/server/convex.ts',
  'src/runtime/backend/index.ts',
  'src/runtime/mcp/advanced.ts',
  'src/runtime/mcp/index.ts',
  'src/runtime/server/index.ts',
]

const ignoredPathFragments = ['/_generated/', '/node_modules/', '/.nuxt/', '/.output/', '/dist/']

export const securitySourcePolicies = [
  {
    id: 'no-boolean-delegation',
    kind: 'block',
    policy: 'boolean delegation is banned; use backend-revalidated delegation evidence',
    pattern: /delegateToUser\s*\([\s\S]{0,700}?allow\s*:\s*true/g,
  },
  {
    id: 'no-generic-cross-tenant-escape',
    kind: 'line',
    policy: 'generic cross-tenant escape hatches are banned; use named crossTenant capabilities',
    pattern: /\bescapeIsolation\b/,
  },
  {
    id: 'no-shared-secret-webhook-helper',
    kind: 'line',
    policy:
      'shared-secret and route-side webhook idempotency helpers are banned from production-copyable surfaces',
    pattern:
      /\b(readSharedSecretWebhookBody|isSharedSecretWebhookSignatureValid|readHmacVerifiedWebhookBody)\b/,
  },
  {
    id: 'no-tool-local-mcp-safety',
    kind: 'line',
    policy: 'tool-local MCP safety stamping is banned',
    pattern: /\bstampMcpToolSafety\b|\btrellisMcpToolSafetyKey\b/,
  },
  {
    id: 'no-stringly-trusted-auth',
    kind: 'line',
    policy: 'raw stringly trusted auth is banned; use verifier-produced proof objects',
    pattern: /auth\s*:\s*['"]trusted['"]/,
  },
  {
    id: 'no-legacy-forwarding-function-ref',
    kind: 'line',
    policy:
      '`identityForwardingFunctionRef` is banned; use handler `id` or operation `executeFunctionRef`',
    pattern: /\bidentityForwardingFunctionRef\b/,
  },
  {
    id: 'no-global-public-read-tables',
    kind: 'line',
    policy: 'global public read tables are banned; use handler-local `reads`',
    pattern: /\breadTables\b/,
  },
  {
    id: 'no-example-test-raw-forwarding-envelope',
    kind: 'line',
    filePathPattern: /^examples\/.*(?:\/test\/.*|\/convex\/.*\.test\.ts)$/,
    policy:
      'maintained example tests must use Trellis test principals, not raw forwarding envelopes',
    pattern: /\bcreateIdentityForwardingEnvelopeArgs\b/,
  },
  {
    id: 'no-public-mcp-email-resolver',
    kind: 'line',
    policy: 'public MCP email resolvers are banned',
    pattern: /\bresolveMcpUserByEmailQuery\b/,
  },
  {
    id: 'no-public-demo-seed',
    kind: 'line',
    policy: 'public agency/demo seed mutations are banned',
    pattern: /\bseedAgencyPortfolioMutation\b/,
  },
  {
    id: 'no-open-guard-in-protected-lanes',
    kind: 'block',
    policy: '`guard: open` is banned in protected lanes',
    pattern: /\b(?:query|mutation|action)\.protected\s*\([\s\S]{0,700}?guard\s*:\s*open/g,
  },
]

const fileSpecificPolicies = {
  'src/runtime/server/index.ts': [
    {
      id: 'server-barrel-no-boolean-delegation',
      kind: 'line',
      policy: 'server barrel must not export boolean delegation',
      pattern: /\bdelegateToUser\b/,
    },
    {
      id: 'server-barrel-no-shared-secret-helper',
      kind: 'line',
      policy:
        'server barrel must not export shared-secret or route-side webhook idempotency helpers',
      pattern:
        /\b(readSharedSecretWebhookBody|isSharedSecretWebhookSignatureValid|readHmacVerifiedWebhookBody)\b/,
    },
  ],
  'src/runtime/backend/index.ts': [
    {
      id: 'backend-barrel-no-raw-forwarding-primitives',
      kind: 'line',
      policy: 'backend barrel must not export raw identity-forwarding primitives',
      pattern:
        /\b(createIdentityForwardingEnvelope|verifyIdentityForwardingEnvelope|setIdentityForwardingContext|clearIdentityForwardingContext|withIdentityForwarding)\b/,
    },
  ],
  'src/runtime/mcp/index.ts': [
    {
      id: 'mcp-barrel-no-tool-local-safety',
      kind: 'line',
      policy: 'MCP barrel must not export tool-local safety stamping',
      pattern: /\bstampMcpToolSafety\b|\btrellisMcpToolSafetyKey\b/,
    },
  ],
  'src/runtime/mcp/advanced.ts': [
    {
      id: 'advanced-mcp-no-write-helper',
      kind: 'line',
      policy: 'advanced MCP write helpers must be removed or explicitly unsafe',
      pattern: /\bdefineTool\b/,
    },
  ],
}

function isInRoot(filePath, root) {
  return filePath === root || filePath.startsWith(`${root}/`)
}

export function listTrackedSecuritySourceFiles(repoRoot) {
  const trackedFiles = execFileSync('git', ['ls-files'], { cwd: repoRoot, encoding: 'utf8' })
    .split('\n')
    .filter(Boolean)

  return trackedFiles.filter((filePath) => {
    if (ignoredPathFragments.some((fragment) => filePath.includes(fragment))) return false
    if (!/\.(?:mjs|js|ts|tsx|vue|md)$/.test(filePath)) return false
    return securitySourcePolicyRoots.some((root) => isInRoot(filePath, root))
  })
}

function lineForIndex(source, index) {
  return source.slice(0, index).split('\n').length
}

function addLineMatches(violations, filePath, source, policy) {
  if (policy.filePathPattern && !policy.filePathPattern.test(filePath)) return

  const lines = source.split('\n')
  lines.forEach((line, index) => {
    if (!policy.pattern.test(line)) return
    violations.push({
      filePath,
      line: index + 1,
      policy: policy.policy,
      policyId: policy.id,
      source: line.trim(),
    })
  })
}

function addBlockMatches(violations, filePath, source, policy) {
  if (policy.filePathPattern && !policy.filePathPattern.test(filePath)) return

  for (const match of source.matchAll(policy.pattern)) {
    violations.push({
      filePath,
      line: lineForIndex(source, match.index ?? 0),
      policy: policy.policy,
      policyId: policy.id,
      source: match[0].split('\n')[0].trim(),
    })
  }
}

function addMatches(violations, filePath, source, policy) {
  if (policy.kind === 'block') {
    addBlockMatches(violations, filePath, source, policy)
    return
  }
  addLineMatches(violations, filePath, source, policy)
}

export function findSecuritySourcePolicyViolations(repoRoot) {
  const violations = []

  for (const filePath of listTrackedSecuritySourceFiles(repoRoot)) {
    const absolutePath = path.resolve(repoRoot, filePath)
    if (!existsSync(absolutePath)) continue
    const source = readFileSync(absolutePath, 'utf8')

    for (const policy of securitySourcePolicies) {
      addMatches(violations, filePath, source, policy)
    }
    for (const policy of fileSpecificPolicies[filePath] ?? []) {
      addMatches(violations, filePath, source, policy)
    }
  }

  return violations
}

export function listSecuritySourcePolicyContract() {
  return [
    ...securitySourcePolicies,
    ...Object.entries(fileSpecificPolicies).flatMap(([filePath, policies]) =>
      policies.map((policy) => ({ ...policy, filePath })),
    ),
  ]
    .map((policy) => ({
      id: policy.id,
      filePath: policy.filePath,
      kind: policy.kind,
      policy: policy.policy,
      pattern: String(policy.pattern),
    }))
    .sort((a, b) => a.id.localeCompare(b.id))
}
