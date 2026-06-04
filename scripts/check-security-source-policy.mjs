import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'

const repoRoot = process.cwd()

const trackedFiles = execFileSync('git', ['ls-files'], { cwd: repoRoot, encoding: 'utf8' })
  .split('\n')
  .filter(Boolean)

const roots = [
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

const ignoredPathFragments = [
  '/_generated/',
  '/node_modules/',
  '/.nuxt/',
  '/.output/',
  '/dist/',
]

function isInRoot(filePath, root) {
  return filePath === root || filePath.startsWith(`${root}/`)
}

function filesToScan() {
  return trackedFiles.filter((filePath) => {
    if (ignoredPathFragments.some((fragment) => filePath.includes(fragment))) return false
    if (!/\.(mjs|js|ts|tsx|vue|md)$/.test(filePath)) return false
    return roots.some((root) => isInRoot(filePath, root))
  })
}

function lineForIndex(source, index) {
  return source.slice(0, index).split('\n').length
}

function addLineMatches(violations, filePath, source, policy, pattern) {
  const lines = source.split('\n')
  lines.forEach((line, index) => {
    if (!pattern.test(line)) return
    violations.push({
      filePath,
      line: index + 1,
      policy,
      source: line.trim(),
    })
  })
}

function addBlockMatches(violations, filePath, source, policy, pattern) {
  for (const match of source.matchAll(pattern)) {
    violations.push({
      filePath,
      line: lineForIndex(source, match.index ?? 0),
      policy,
      source: match[0].split('\n')[0].trim(),
    })
  }
}

function findViolations() {
  const violations = []

  for (const filePath of filesToScan()) {
    const absolutePath = path.resolve(repoRoot, filePath)
    if (!existsSync(absolutePath)) continue
    const source = readFileSync(absolutePath, 'utf8')

    addBlockMatches(
      violations,
      filePath,
      source,
      'boolean delegation is banned; use backend-revalidated delegation evidence',
      /delegateToUser\s*\([\s\S]{0,700}?allow\s*:\s*true/g,
    )
    addLineMatches(
      violations,
      filePath,
      source,
      'generic cross-tenant escape hatches are banned; use named crossTenant capabilities',
      /\bescapeIsolation\b/,
    )
    addLineMatches(
      violations,
      filePath,
      source,
      'shared-secret webhook helpers are banned from production-copyable surfaces',
      /\breadSharedSecretWebhookBody\b/,
    )
    addLineMatches(
      violations,
      filePath,
      source,
      'tool-local MCP safety stamping is banned',
      /\bstampMcpToolSafety\b|\btrellisMcpToolSafetyKey\b/,
    )
    addLineMatches(
      violations,
      filePath,
      source,
      "raw stringly trusted auth is banned; use verifier-produced proof objects",
      /auth\s*:\s*['"]trusted['"]/,
    )
    addLineMatches(
      violations,
      filePath,
      source,
      'public MCP email resolvers are banned',
      /\bresolveMcpUserByEmailQuery\b/,
    )
    addLineMatches(
      violations,
      filePath,
      source,
      'public agency/demo seed mutations are banned',
      /\bseedAgencyPortfolioMutation\b/,
    )
    addBlockMatches(
      violations,
      filePath,
      source,
      '`guard: open` is banned in protected lanes',
      /\b(?:query|mutation|action)\.protected\s*\([\s\S]{0,700}?guard\s*:\s*open/g,
    )

    if (filePath === 'src/runtime/server/index.ts') {
      addLineMatches(
        violations,
        filePath,
        source,
        'server barrel must not export boolean delegation',
        /\bdelegateToUser\b/,
      )
      addLineMatches(
        violations,
        filePath,
        source,
        'server barrel must not export shared-secret webhook helpers',
        /\breadSharedSecretWebhookBody\b/,
      )
    }

    if (filePath === 'src/runtime/backend/index.ts') {
      addLineMatches(
        violations,
        filePath,
        source,
        'backend barrel must not export raw identity-forwarding primitives',
        /\b(createIdentityForwardingEnvelope|verifyIdentityForwardingEnvelope|setIdentityForwardingContext|clearIdentityForwardingContext|withIdentityForwarding)\b/,
      )
    }

    if (filePath === 'src/runtime/mcp/index.ts') {
      addLineMatches(
        violations,
        filePath,
        source,
        'MCP barrel must not export tool-local safety stamping',
        /\bstampMcpToolSafety\b|\btrellisMcpToolSafetyKey\b/,
      )
    }

    if (filePath === 'src/runtime/mcp/advanced.ts') {
      addLineMatches(
        violations,
        filePath,
        source,
        'advanced MCP write helpers must be removed or explicitly unsafe',
        /\bdefineTool\b/,
      )
    }
  }

  return violations
}

const violations = findViolations()

if (violations.length > 0) {
  const preview = violations
    .slice(0, 80)
    .map(
      (violation) =>
        `${violation.filePath}:${violation.line}: ${violation.policy}: ${violation.source}`,
    )
    .join('\n')
  const suffix =
    violations.length > 80 ? `\n...and ${violations.length - 80} more violation(s)` : ''
  throw new Error(
    `[trellis] security source policy failed with ${violations.length} violation(s)\n${preview}${suffix}`,
  )
}

console.log('[trellis] security source policy passed')
