import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'

import { collectRepoPublicSurfaceInventory } from './public-surface-inventory.mjs'
import {
  findSecuritySourcePolicyViolations,
  listSecuritySourcePolicyContract,
  securitySourcePolicyRoots,
} from './security-source-policy.mjs'

const sourceRoots = ['apps/harness', 'examples', 'src/cli/starter-fixtures']
const sourceExtensions = /\.(ts|tsx|vue)$/
const ignoredPathFragments = ['/_generated/', '/node_modules/', '/.nuxt/', '/.output/', '/dist/']

const bannedPublicExports = [
  {
    entry: '@lupinum/trellis/server',
    symbols: ['delegateToUser', 'readSharedSecretWebhookBody'],
  },
  {
    entry: '@lupinum/trellis/backend',
    symbols: [
      'createIdentityForwardingEnvelope',
      'verifyIdentityForwardingEnvelope',
      'setIdentityForwardingContext',
      'clearIdentityForwardingContext',
      'withIdentityForwarding',
    ],
  },
  {
    entry: '@lupinum/trellis/mcp',
    symbols: ['stampMcpToolSafety', 'trellisMcpToolSafetyKey'],
  },
  {
    entry: '@lupinum/trellis/mcp/advanced',
    symbols: ['defineTool'],
  },
]

function trackedSourceFiles(repoRoot) {
  return execFileSync('git', ['ls-files'], { cwd: repoRoot, encoding: 'utf8' })
    .split('\n')
    .filter(Boolean)
    .filter((filePath) => sourceRoots.some((root) => filePath === root || filePath.startsWith(`${root}/`)))
    .filter((filePath) => sourceExtensions.test(filePath))
    .filter((filePath) => !ignoredPathFragments.some((fragment) => filePath.includes(fragment)))
    .sort((a, b) => a.localeCompare(b))
}

function read(repoRoot, filePath) {
  return readFileSync(path.resolve(repoRoot, filePath), 'utf8')
}

function lineForIndex(source, index) {
  return source.slice(0, index).split('\n').length
}

function localExportBlocks(source) {
  const blocks = []
  for (const match of source.matchAll(/export\s+const\s+([A-Za-z_$][\w$]*)\s*=\s*/g)) {
    const start = match.index ?? 0
    const next = source.slice(start + match[0].length).search(/\nexport\s+const\s+/)
    const end = next === -1 ? source.length : start + match[0].length + next
    blocks.push({
      name: match[1],
      start,
      line: lineForIndex(source, start),
      source: source.slice(start, end),
    })
  }
  return blocks
}

function extractStringList(block, propertyName) {
  const pattern = new RegExp(`${propertyName}\\s*:\\s*\\[([\\s\\S]*?)\\]`, 'm')
  const match = block.match(pattern)
  if (!match) return []
  return [...match[1].matchAll(/['"]([^'"]+)['"]/g)]
    .map((item) => item[1])
    .sort((a, b) => a.localeCompare(b))
}

function extractStringProperty(block, propertyName) {
  const pattern = new RegExp(`${propertyName}\\s*:\\s*['"]([^'"]+)['"]`, 'm')
  return block.match(pattern)?.[1]
}

function collectPublicReadTables(repoRoot, files) {
  const rows = []
  for (const file of files) {
    if (!file.endsWith('/convex/functions.ts') && !file.endsWith('/convex/components/miniCms/functions.ts')) {
      continue
    }
    const source = read(repoRoot, file)
    const readTables = extractStringList(source, 'readTables')
    if (readTables.length === 0) continue
    rows.push({ file, readTables })
  }
  return rows
}

function collectBackendFunctions(repoRoot, files) {
  const rows = []
  for (const file of files) {
    if (!file.includes('/convex/')) continue
    const source = read(repoRoot, file)
    for (const block of localExportBlocks(source)) {
      const lane = block.source.match(/\b(query|mutation|action)\.(public|protected|unsafe)\s*\(/)
      if (!lane) continue
      rows.push({
        file,
        line: block.line,
        exportName: block.name,
        functionType: lane[1],
        lane: lane[2],
        operationBacked: /\boperation\.(query|mutation|destructive|publicMutation)\s*\(/.test(block.source)
          ? 'inline'
          : /\(\s*[A-Za-z_$][\w$]*Op\b/.test(block.source)
            ? 'referenced'
            : 'none',
        guard: extractStringProperty(block.source, 'guard') ?? (block.source.includes('guard:') ? 'declared' : null),
        authorize: block.source.includes('authorize:'),
        publicWrite: block.source.includes('publicWrite:'),
        crossTenant: block.source.includes('crossTenant:'),
      })
    }
  }
  return rows.sort((a, b) => `${a.file}:${a.line}:${a.exportName}`.localeCompare(`${b.file}:${b.line}:${b.exportName}`))
}

function collectOperations(repoRoot, files) {
  const rows = []
  for (const file of files) {
    if (!file.includes('/convex/')) continue
    const source = read(repoRoot, file)
    for (const block of localExportBlocks(source)) {
      const operation = block.source.match(/\boperation\.(query|mutation|destructive|publicMutation)\s*\(/)
      if (!operation) continue
      rows.push({
        file,
        line: block.line,
        exportName: block.name,
        type: operation[1],
        id: extractStringProperty(block.source, 'id') ?? null,
        hasGuard: block.source.includes('guard:'),
        hasAuthorize: block.source.includes('authorize:'),
        hasPublicWrite: block.source.includes('publicWrite:'),
        hasPreview: block.source.includes('preview:'),
        hasExecute: block.source.includes('execute:'),
        identityForwardingFunctionRef:
          extractStringProperty(block.source, 'identityForwardingFunctionRef') ?? null,
        identityForwardingTransport:
          extractStringProperty(block.source, 'identityForwardingTransport') ?? null,
      })
    }
  }
  return rows.sort((a, b) => `${a.file}:${a.line}:${a.exportName}`.localeCompare(`${b.file}:${b.line}:${b.exportName}`))
}

function collectMcpTools(repoRoot, files) {
  const rows = []
  for (const file of files) {
    if (!file.includes('/server/mcp/')) continue
    const source = read(repoRoot, file)
    const toolKinds = [...source.matchAll(/\btool\.(query|mutation|operation)\s*\(/g)].map((match) => ({
      kind: match[1],
      line: lineForIndex(source, match.index ?? 0),
    }))
    if (toolKinds.length === 0) continue
    rows.push({
      file,
      toolKinds,
      usesBackendOperation: source.includes('tool.operation('),
      directWriteTool: /\btool\.mutation\s*\(/.test(source),
      importsServerConvexWrite:
        /\bserverConvex(Mutation|Action)\b/.test(source) || /\bctx\.(mutation|action)\s*\(/.test(source),
      importsToolLocalSafety:
        /\bstampMcpToolSafety\b|\btrellisMcpToolSafetyKey\b/.test(source),
    })
  }
  return rows.sort((a, b) => a.file.localeCompare(b.file))
}

function collectSecurityRuntimeProofs() {
  return [
    'tests/unit/functions-defineTrellis.test.ts',
    'tests/unit/functions-defineHandler.test.ts',
    'tests/unit/auth-access-context.test.ts',
    'tests/unit/define-convex-tool.test.ts',
    'tests/unit/mcp-convex-caller.test.ts',
    'tests/unit/server-index-exports.test.ts',
    'tests/unit/backend-index-exports.test.ts',
    'tests/unit/mcp-index-exports.test.ts',
    'tests/unit/example-webhook-security.test.ts',
    'tests/unit/identity-forwarding-envelope.test.ts',
    'tests/unit/identity-forwarding.test.ts',
    'tests/unit/destructive-confirmation.test.ts',
    'tests/unit/mcp-operation-binding.test.ts',
    'tests/unit/mcp-descriptor-boundary.test.ts',
    'tests/unit/mcp-definition-preflight.test.ts',
    'tests/unit/mcp-invalid-bearer-throttle.test.ts',
    'tests/unit/use-mcp-session.test.ts',
    'tests/unit/security-contract.test.ts',
  ]
}

export function collectSecurityContract(repoRoot) {
  const files = trackedSourceFiles(repoRoot)
  const publicSurface = collectRepoPublicSurfaceInventory(repoRoot)
  const sourcePolicyViolations = findSecuritySourcePolicyViolations(repoRoot)

  return {
    version: 1,
    phase: '0.3.0-phase-a',
    generatedBy: 'scripts/generate-security-contract.mjs',
    scope: {
      includedRoots: sourceRoots,
      omittedUntilPhaseB: [
        'verified route proof kind',
        'trusted route idempotency source',
        'delegation binding source',
        'webhook verifier canonicalization metadata',
        'service-subject contract metadata',
      ],
    },
    publicPackageExports: publicSurface.packageExports,
    bannedPublicExports,
    sourcePolicy: {
      roots: securitySourcePolicyRoots,
      policies: listSecuritySourcePolicyContract(),
      violationCount: sourcePolicyViolations.length,
    },
    securityRuntimeProofs: collectSecurityRuntimeProofs(),
    publicReadTables: collectPublicReadTables(repoRoot, files),
    backendFunctions: collectBackendFunctions(repoRoot, files),
    operations: collectOperations(repoRoot, files),
    mcpTools: collectMcpTools(repoRoot, files),
  }
}

export function stableSecurityContractString(contract) {
  return `${JSON.stringify(contract, null, 2)}\n`
}

export function contractPath(repoRoot) {
  return path.resolve(repoRoot, 'security-contract.generated.json')
}

export function readCurrentSecurityContract(repoRoot) {
  const filePath = contractPath(repoRoot)
  if (!existsSync(filePath)) return null
  return readFileSync(filePath, 'utf8')
}
