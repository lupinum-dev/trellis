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
const sourceExtensions = /\.(?:ts|tsx|vue)$/
const ignoredPathFragments = ['/_generated/', '/node_modules/', '/.nuxt/', '/.output/', '/dist/']

const bannedPublicExports = [
  {
    entry: '@lupinum/trellis/server',
    symbols: [
      'delegateToUser',
      'readSharedSecretWebhookBody',
      'isSharedSecretWebhookSignatureValid',
      'readHmacVerifiedWebhookBody',
    ],
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
    entry: '@lupinum/trellis/auth',
    symbols: ['authRequired', 'isAuthRequiredGuard', 'AuthRequiredGuard'],
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
    .filter((filePath) =>
      sourceRoots.some((root) => filePath === root || filePath.startsWith(`${root}/`)),
    )
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

function sliceBalancedBlock(source, openIndex) {
  let depth = 0
  let quote = null
  let escaped = false
  let lineComment = false
  let blockComment = false

  for (let index = openIndex; index < source.length; index += 1) {
    const char = source[index]
    const next = source[index + 1]

    if (lineComment) {
      if (char === '\n') lineComment = false
      continue
    }

    if (blockComment) {
      if (char === '*' && next === '/') {
        blockComment = false
        index += 1
      }
      continue
    }

    if (quote) {
      if (escaped) {
        escaped = false
      } else if (char === '\\') {
        escaped = true
      } else if (char === quote) {
        quote = null
      }
      continue
    }

    if (char === '/' && next === '/') {
      lineComment = true
      index += 1
      continue
    }

    if (char === '/' && next === '*') {
      blockComment = true
      index += 1
      continue
    }

    if (char === "'" || char === '"' || char === '`') {
      quote = char
      continue
    }

    if (char === '{') {
      depth += 1
      continue
    }

    if (char === '}') {
      depth -= 1
      if (depth === 0) return source.slice(openIndex, index + 1)
    }
  }

  return source.slice(openIndex)
}

function collectPublicReadTables(repoRoot, files) {
  const rows = []
  for (const file of files) {
    if (
      !file.endsWith('/convex/functions.ts') &&
      !file.endsWith('/convex/components/miniCms/functions.ts')
    ) {
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
        operationBacked: /\boperation\.(?:query|mutation|destructive|publicMutation)\s*\(/.test(
          block.source,
        )
          ? 'inline'
          : /\(\s*[A-Za-z_$][\w$]*Op\b/.test(block.source)
            ? 'referenced'
            : 'none',
        guard:
          extractStringProperty(block.source, 'guard') ??
          (block.source.includes('guard:') ? 'declared' : null),
        authorize: block.source.includes('authorize:'),
        publicWrite: block.source.includes('publicWrite:'),
        crossTenant: block.source.includes('crossTenant:'),
      })
    }
  }
  return rows.sort((a, b) =>
    `${a.file}:${a.line}:${a.exportName}`.localeCompare(`${b.file}:${b.line}:${b.exportName}`),
  )
}

function collectOperations(repoRoot, files) {
  const rows = []
  for (const file of files) {
    if (!file.includes('/convex/')) continue
    const source = read(repoRoot, file)
    for (const block of localExportBlocks(source)) {
      const operation = block.source.match(
        /\boperation\.(query|mutation|destructive|publicMutation)\s*\(/,
      )
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
  return rows.sort((a, b) =>
    `${a.file}:${a.line}:${a.exportName}`.localeCompare(`${b.file}:${b.line}:${b.exportName}`),
  )
}

function collectMcpTools(repoRoot, files) {
  const rows = []
  for (const file of files) {
    if (!file.includes('/server/mcp/')) continue
    const source = read(repoRoot, file)
    const toolKinds = [...source.matchAll(/\btool\.(query|mutation|operation)\s*\(/g)].map(
      (match) => ({
        kind: match[1],
        line: lineForIndex(source, match.index ?? 0),
      }),
    )
    if (toolKinds.length === 0) continue
    rows.push({
      file,
      toolKinds,
      usesBackendOperation: source.includes('tool.operation('),
      directWriteTool: /\btool\.mutation\s*\(/.test(source),
      importsServerConvexWrite:
        /\bserverConvex(?:Mutation|Action)\b/.test(source) ||
        /\bctx\.(?:mutation|action)\s*\(/.test(source),
      importsToolLocalSafety: /\bstampMcpToolSafety\b|\btrellisMcpToolSafetyKey\b/.test(source),
    })
  }
  return rows.sort((a, b) => a.file.localeCompare(b.file))
}

function collectServiceSubjects(repoRoot, files) {
  const rows = []
  for (const file of files) {
    const source = read(repoRoot, file)
    if (!source.includes('defineServices')) continue

    for (const block of localExportBlocks(source)) {
      if (!block.source.includes('defineServices')) continue

      for (const match of block.source.matchAll(/(['"])([^'"]+)\1\s*:\s*\{/g)) {
        const matchIndex = match.index ?? 0
        const openIndex = matchIndex + match[0].lastIndexOf('{')
        const serviceBlock = sliceBalancedBlock(block.source, openIndex)
        if (!/\baccess\s*:/.test(serviceBlock)) continue
        const access = /\baccess\s*:\s*['"]unrestricted['"]/.test(serviceBlock)
          ? 'unrestricted'
          : 'restricted'

        rows.push({
          file,
          line: lineForIndex(source, block.start + matchIndex),
          exportName: block.name,
          serviceId: match[2],
          access,
          tables: extractStringList(serviceBlock, 'tables'),
          tenant: extractStringProperty(serviceBlock, 'tenant') ?? null,
          hasDeriveTenant: /\bderiveTenant\s*:/.test(serviceBlock),
          metadata: {
            source: extractStringProperty(serviceBlock, 'source') ?? null,
            purpose: extractStringProperty(serviceBlock, 'purpose') ?? null,
            allowedOperations: extractStringList(serviceBlock, 'allowedOperations'),
            allowedFunctionRefs: extractStringList(serviceBlock, 'allowedFunctionRefs'),
            replayMode: extractStringProperty(serviceBlock, 'replayMode') ?? null,
            actingFor: /\bactingFor\s*:\s*true\b/.test(serviceBlock)
              ? true
              : /\bactingFor\s*:\s*false\b/.test(serviceBlock)
                ? false
                : null,
            auditEvent: extractStringProperty(serviceBlock, 'auditEvent') ?? null,
            auditTable: extractStringProperty(serviceBlock, 'auditTable') ?? null,
            auditCorrelationId: extractStringProperty(serviceBlock, 'auditCorrelationId') ?? null,
          },
        })
      }
    }
  }

  return rows.sort((a, b) =>
    `${a.file}:${a.line}:${a.serviceId}`.localeCompare(`${b.file}:${b.line}:${b.serviceId}`),
  )
}

function routeMethodFromFile(file) {
  return (
    path
      .basename(file)
      .match(/\.([a-z]+)\.(?:ts|tsx)$/)?.[1]
      ?.toUpperCase() ?? null
  )
}

function collectServerRoutes(repoRoot, files) {
  const rows = []
  for (const file of files) {
    if (!file.includes('/server/api/')) continue
    if (/\.(?:test|spec)\.(?:ts|tsx)$/.test(file)) continue

    const source = read(repoRoot, file)
    const transportProofKinds = [
      ...source.matchAll(/\btransportProof\.(server|webhook|mcp)\s*\(/g),
    ].map((match) => match[1])
    const replayModes = [
      ...(source.includes('domainIdempotency(') ? ['domain-idempotency'] : []),
      ...(source.includes('jtiRedemption(') ? ['jti-redemption'] : []),
      ...(source.includes('operationConfirmation(') ? ['operation-confirmation'] : []),
    ]

    rows.push({
      file,
      method: routeMethodFromFile(file),
      usesHmacWebhookVerifier: source.includes('verifyHmacWebhookDelivery('),
      usesTransportProof: transportProofKinds.length > 0,
      transportProofKinds: [...new Set(transportProofKinds)].sort((a, b) => a.localeCompare(b)),
      replayModes,
      usesDelegationBinding: source.includes('requireDelegationBinding('),
      usesRouteSideIdempotency: /\bidempotency\s*:/.test(source),
      forwardsConvexQuery: source.includes('serverConvexQuery('),
      forwardsConvexMutation: source.includes('serverConvexMutation('),
      forwardsConvexAction: source.includes('serverConvexAction('),
      usesRawTrustedAuth: /\bauth\s*:\s*['"]trusted['"]/.test(source),
      usesNoAuth: /\bauth\s*:\s*['"]none['"]/.test(source),
    })
  }

  return rows.sort((a, b) => a.file.localeCompare(b.file))
}

function collectDelegationBindings(repoRoot, files) {
  const rows = []
  for (const file of files) {
    const source = read(repoRoot, file)
    if (!source.includes('requireDelegationBinding')) continue

    for (const match of source.matchAll(/\brequireDelegationBinding\s*\(\s*\{/g)) {
      const openIndex = (match.index ?? 0) + match[0].lastIndexOf('{')
      const bindingBlock = sliceBalancedBlock(source, openIndex)
      rows.push({
        file,
        line: lineForIndex(source, match.index ?? 0),
        serviceId: extractStringProperty(bindingBlock, 'serviceId') ?? null,
        purpose: extractStringProperty(bindingBlock, 'purpose') ?? null,
        grantSource: extractStringProperty(bindingBlock, 'grantSource') ?? null,
        hasGrantId: /\bgrantId\s*:/.test(bindingBlock),
        hasExpiresAt: /\bexpiresAt\s*:/.test(bindingBlock),
        hasReason: /\breason\s*:/.test(bindingBlock),
        hasTargetUserId: /\btargetUserId\s*:/.test(bindingBlock),
        hasWorkspaceId: /\bworkspaceId\s*:/.test(bindingBlock),
      })
    }
  }

  return rows.sort((a, b) => `${a.file}:${a.line}`.localeCompare(`${b.file}:${b.line}`))
}

function webhookDefaultHeader(source, variableName) {
  const pattern = new RegExp(
    `const\\s+${variableName}\\s*=\\s*options\\.${variableName}\\s*\\?\\?\\s*['"]([^'"]+)['"]`,
  )
  return source.match(pattern)?.[1] ?? null
}

function collectWebhookVerifierMetadata(repoRoot) {
  const file = 'src/runtime/server/webhooks.ts'
  const source = read(repoRoot, file)
  const toleranceMatch = source.match(
    /const\s+DEFAULT_WEBHOOK_HMAC_TOLERANCE_MS\s*=\s*(\d+)\s*\*\s*(\d+)\s*\*\s*(\d+)/,
  )
  return {
    file,
    helper: 'verifyHmacWebhookDelivery',
    signatureFactory: 'createWebhookHmacSignature',
    algorithm: source.match(/createHmac\(['"]([^'"]+)['"]/)?.[1] ?? null,
    signaturePrefix: source.includes('return `sha256=${digest}`') ? 'sha256=' : null,
    payloadEncoding: 'utf8',
    payloadSeparator: source.includes("toUtf8Buffer('.')") ? '.' : null,
    binds: {
      timestamp: source.includes('options.timestamp'),
      deliveryId: source.includes('options.deliveryId'),
      rawBody: source.includes('options.rawBody'),
    },
    defaultToleranceMs: toleranceMatch
      ? Number(toleranceMatch[1]) * Number(toleranceMatch[2]) * Number(toleranceMatch[3])
      : null,
    timestampAcceptsSecondsAndMilliseconds: source.includes(
      'value < 10_000_000_000 ? value * 1000 : value',
    ),
    rejectsMultiValueHeaders: source.includes('singleHeader(options.signature)'),
    usesTimingSafeEqual: source.includes('timingSafeEqual'),
    readsRawBodyOnce: source.includes('const rawBody = await readRawBody(event)'),
    routeSideIdempotencyHook: source.includes('options.idempotency') ? 'present' : 'absent',
    defaultHeaders: {
      signature: webhookDefaultHeader(source, 'signatureHeader'),
      timestamp: webhookDefaultHeader(source, 'timestampHeader'),
      deliveryId: webhookDefaultHeader(source, 'deliveryIdHeader'),
    },
  }
}

function collectSecurityRuntimeProofs() {
  return [
    'tests/unit/functions-defineTrellis.test.ts',
    'tests/unit/functions-defineHandler.test.ts',
    'tests/unit/auth-index.test.ts',
    'tests/unit/auth-primitives.test.ts',
    'tests/unit/auth-access-context.test.ts',
    'tests/unit/auth-proxy-handler.server.test.ts',
    'tests/unit/cli-add-resource.test.ts',
    'tests/unit/define-convex-tool.test.ts',
    'tests/unit/mcp-convex-caller.test.ts',
    'tests/unit/server-index-exports.test.ts',
    'tests/unit/backend-index-exports.test.ts',
    'tests/unit/mcp-index-exports.test.ts',
    'tests/unit/example-webhook-security.test.ts',
    'tests/unit/server-boundaries.test.ts',
    'tests/unit/identity-forwarding-envelope.test.ts',
    'tests/unit/identity-forwarding.test.ts',
    'tests/unit/destructive-confirmation.test.ts',
    'tests/unit/mcp-operation-binding.test.ts',
    'tests/unit/mcp-descriptor-boundary.test.ts',
    'tests/unit/mcp-definition-preflight.test.ts',
    'tests/unit/mcp-invalid-bearer-throttle.test.ts',
    'tests/unit/operation-ref-codegen.test.ts',
    'tests/unit/phase0-workspace-mcp-fixture.test.ts',
    'tests/unit/use-mcp-session.test.ts',
    'tests/unit/security-contract.test.ts',
  ]
}

const maintainedExampleProofExpectations = [
  {
    id: 'example03-webhook-route-retry',
    file: 'examples/03-team-workspace/server/api/webhook.post.test.ts',
    testName: 'does not route-consume valid deliveries when backend dispatch fails',
    proves: ['route retry after backend dispatch failure', 'route does not own delivery consume'],
  },
  {
    id: 'example03-webhook-domain-duplicate',
    file: 'examples/03-team-workspace/convex/todos.test.ts',
    testName: 'denies duplicate webhook events',
    proves: ['backend-owned delivery idempotency', 'duplicate event rejection'],
  },
  {
    id: 'example03-webhook-forged-binding',
    file: 'examples/03-team-workspace/convex/todos.test.ts',
    testName: 'rejects signed service forwarding when the delegation workspace is forged',
    proves: ['backend delegation revalidation', 'forged workspace rejection'],
  },
  {
    id: 'example03-webhook-expired-binding',
    file: 'examples/03-team-workspace/convex/todos.test.ts',
    testName: 'rejects signed service forwarding when delegation evidence is expired',
    proves: ['backend delegation revalidation', 'expired delegation rejection'],
  },
  {
    id: 'example07-webhook-route-retry',
    file: 'examples/07-mcp-reference/server/api/runbook-webhook.post.test.ts',
    testName: 'does not route-consume valid deliveries when backend dispatch fails',
    proves: ['route retry after backend dispatch failure', 'route does not own delivery consume'],
  },
  {
    id: 'example07-webhook-domain-duplicate',
    file: 'examples/07-mcp-reference/test/mcpReference.test.ts',
    testName: 'applies the same create permission rules to delegated service principals',
    proves: ['backend-owned delivery idempotency', 'duplicate delivery rejection'],
  },
  {
    id: 'example07-webhook-forged-binding',
    file: 'examples/07-mcp-reference/test/mcpReference.test.ts',
    testName: 'rejects delegated service principals with forged binding fields',
    proves: [
      'backend delegation revalidation',
      'wrong service rejection',
      'wrong purpose rejection',
    ],
  },
]

function findTestLine(source, testName) {
  const pattern = new RegExp(
    `\\b(?:it|test)\\s*\\(\\s*['"]${testName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]`,
  )
  const match = source.match(pattern)
  return match?.index === undefined ? null : lineForIndex(source, match.index)
}

function collectMaintainedExampleProofs(repoRoot) {
  return maintainedExampleProofExpectations.flatMap((proof) => {
    const source = read(repoRoot, proof.file)
    const line = findTestLine(source, proof.testName)
    if (line === null) return []
    return [{ ...proof, line }]
  })
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
      omittedUntilPhaseB: [],
    },
    publicPackageExports: publicSurface.packageExports,
    bannedPublicExports,
    sourcePolicy: {
      roots: securitySourcePolicyRoots,
      policies: listSecuritySourcePolicyContract(),
      violationCount: sourcePolicyViolations.length,
    },
    securityRuntimeProofs: collectSecurityRuntimeProofs(),
    maintainedExampleProofs: collectMaintainedExampleProofs(repoRoot),
    serverRoutes: collectServerRoutes(repoRoot, files),
    delegationBindings: collectDelegationBindings(repoRoot, files),
    webhookVerifier: collectWebhookVerifierMetadata(repoRoot),
    publicReadTables: collectPublicReadTables(repoRoot, files),
    serviceSubjects: collectServiceSubjects(repoRoot, files),
    backendFunctions: collectBackendFunctions(repoRoot, files),
    operations: collectOperations(repoRoot, files),
    mcpTools: collectMcpTools(repoRoot, files),
  }
}

export function stableSecurityContractString(contract) {
  return execFileSync(
    path.resolve(process.cwd(), 'node_modules/.bin/oxfmt'),
    ['--stdin-filepath', 'security-contract.generated.json'],
    {
      input: `${JSON.stringify(contract, null, 2)}\n`,
      encoding: 'utf8',
    },
  )
}

export function contractPath(repoRoot) {
  return path.resolve(repoRoot, 'security-contract.generated.json')
}

export function readCurrentSecurityContract(repoRoot) {
  const filePath = contractPath(repoRoot)
  if (!existsSync(filePath)) return null
  return readFileSync(filePath, 'utf8')
}
