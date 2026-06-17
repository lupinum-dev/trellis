import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'

import { bannedPublicExports } from './lib/security-contract.mjs'

const repoRoot = process.cwd()

const packedEntryFiles = {
  '@lupinum/trellis/server': {
    requiredFiles: ['dist/runtime/server/index.mjs', 'dist/runtime/server/index.d.ts'],
    optionalFiles: ['dist/runtime/server/index.js'],
  },
  '@lupinum/trellis/backend': {
    requiredFiles: ['dist/runtime/backend/index.js', 'dist/runtime/backend/index.d.ts'],
    optionalFiles: [],
  },
  '@lupinum/trellis/auth': {
    requiredFiles: ['dist/runtime/auth/index.mjs', 'dist/runtime/auth/index.d.ts'],
    optionalFiles: [],
  },
  '@lupinum/trellis/mcp': {
    requiredFiles: ['dist/runtime/mcp/index.mjs', 'dist/runtime/mcp/index.d.ts'],
    optionalFiles: ['dist/runtime/mcp/index.js'],
  },
  '@lupinum/trellis/mcp/advanced': {
    requiredFiles: ['dist/runtime/mcp/advanced.js', 'dist/runtime/mcp/advanced.d.ts'],
    optionalFiles: ['dist/runtime/mcp/advanced.mjs'],
  },
}

const publicEntryGroups = bannedPublicExports.map((entry) => ({
  name: entry.entry,
  ...packedEntryFiles[entry.entry],
  banned: entry.symbols.map((symbol) => ({
    symbol,
    policy: `${entry.entry} packed entry must not export banned public symbol "${symbol}"`,
  })),
}))

function lineForIndex(source, index) {
  return source.slice(0, index).split('\n').length
}

function scanFile(filePath, group) {
  const absolutePath = path.resolve(repoRoot, filePath)
  if (!existsSync(absolutePath)) {
    return [
      {
        filePath,
        line: 1,
        policy: `${group.name} packed entry is missing; run pnpm run build:module`,
        source: '',
      },
    ]
  }

  const source = readFileSync(absolutePath, 'utf8')
  const violations = []

  for (const check of group.banned) {
    const pattern = new RegExp(`\\b${check.symbol}\\b`, 'g')
    for (const match of source.matchAll(pattern)) {
      violations.push({
        filePath,
        line: lineForIndex(source, match.index ?? 0),
        policy: check.policy,
        source: source.split('\n')[lineForIndex(source, match.index ?? 0) - 1]?.trim() ?? '',
      })
    }
  }

  return violations
}

const violations = []

for (const group of publicEntryGroups) {
  for (const filePath of group.requiredFiles) {
    violations.push(...scanFile(filePath, group))
  }
  for (const filePath of group.optionalFiles) {
    if (existsSync(path.resolve(repoRoot, filePath))) {
      violations.push(...scanFile(filePath, group))
    }
  }
}

if (violations.length > 0) {
  const preview = violations
    .slice(0, 80)
    .map((violation) =>
      [
        `${violation.filePath}:${violation.line}: ${violation.policy}`,
        violation.source ? `: ${violation.source}` : '',
      ].join(''),
    )
    .join('\n')
  const suffix =
    violations.length > 80 ? `\n...and ${violations.length - 80} more violation(s)` : ''
  throw new Error(
    `[trellis] security packed export policy failed with ${violations.length} violation(s)\n${preview}${suffix}`,
  )
}

console.log('[trellis] security packed export policy passed')
