import { access, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { basename, dirname, resolve } from 'node:path'

import { buildResourceTemplateSet } from './resource.js'
import {
  renderAddFixture,
  renderAppStarterFixture,
  renderAppStarterFixtureSubset,
} from './starter-fixtures.js'

export type AppTemplate = 'public' | 'personal' | 'workspace' | 'workspace-mcp'

export interface TemplateFile {
  path: string
  content: string
  ownership: 'authored' | 'generated'
  mode?: 'skip-existing' | 'overwrite'
  expectedExistingContent?: string
}

export interface InitTemplateSet {
  label: string
  description: string
  files: TemplateFile[]
  removeFiles?: string[]
  protectRemovalsOnSkippedOverwrites?: boolean
  afterWrite?: (cwd: string) => Promise<void>
}

export type CanonicalAppTemplate = 'public' | 'personal' | 'workspace' | 'workspace-mcp'
export type AddFeature = 'auth' | 'workspace' | 'mcp' | 'uploads' | 'operation' | 'entity'

const authAddFixturePaths = [
  'AGENTS.md',
  'README.md',
  'app/pages/index.vue',
  'app/features/personal/components/PersonalStarterPage.vue',
  'convex/auth.config.ts',
  'convex/convex.config.ts',
  'convex/http.ts',
  'convex/auth.ts',
  'convex/auth/appIdentity.ts',
  'convex/auth/guards.ts',
  'convex/features/todos/domain.ts',
  'convex/features/todos/schema.ts',
  'convex/functions.ts',
  'convex/features/users/index.ts',
  'convex/features/users/schema.ts',
  'convex/schema.ts',
  'convex/test.setup.ts',
  'shared/features/todos/contract.ts',
] as const

const authAddOverwritePaths = new Set<string>([
  'AGENTS.md',
  'README.md',
  'app/pages/index.vue',
  'convex/features/todos/domain.ts',
  'convex/features/todos/schema.ts',
  'convex/functions.ts',
  'convex/schema.ts',
  'shared/features/todos/contract.ts',
])

const mcpAddFixturePaths = [
  'AGENTS.md',
  'README.md',
  'app/features/workspace/components/WorkspaceStarterPage.vue',
  'server/middleware/mcp-auth.ts',
  'server/lib/mcp-invalid-bearer-throttle.ts',
  'server/mcp/index.ts',
  'server/mcp/runtime.ts',
  'server/mcp/tools/list-todos.ts',
  'server/mcp/tools/create-todo.ts',
  'convex/features/mcpKeys/domain.ts',
] as const

const mcpAddOverwritePaths = new Set<string>([
  'AGENTS.md',
  'README.md',
  'app/features/workspace/components/WorkspaceStarterPage.vue',
])

const workspaceAddFixturePaths = [
  'AGENTS.md',
  'README.md',
  'app/pages/index.vue',
  'app/features/workspace/components/WorkspaceStarterPage.vue',
  'convex/auth/appIdentity.ts',
  'convex/auth/caller.ts',
  'convex/auth/guards.ts',
  'convex/features/index.ts',
  'convex/features/todos/domain.ts',
  'convex/features/todos/feature.ts',
  'convex/features/todos/index.ts',
  'convex/features/todos/operations.ts',
  'convex/features/todos/permissions.ts',
  'convex/features/todos/schema.ts',
  'convex/features/users/feature.ts',
  'convex/features/users/index.ts',
  'convex/features/users/schema.ts',
  'convex/features/workspaces/domain.ts',
  'convex/features/workspaces/feature.ts',
  'convex/features/workspaces/index.ts',
  'convex/features/workspaces/schema.ts',
  'convex/functions.ts',
  'convex/permissions/context.ts',
  'convex/schema.ts',
  'nuxt.config.ts',
  'shared/features/todos/contract.ts',
  'shared/features/workspaces/contract.ts',
] as const

const workspaceAddOverwritePaths = new Set<string>([
  'AGENTS.md',
  'README.md',
  'app/pages/index.vue',
  'convex/auth/appIdentity.ts',
  'convex/auth/guards.ts',
  'convex/features/todos/domain.ts',
  'convex/features/todos/index.ts',
  'convex/features/todos/operations.ts',
  'convex/features/todos/schema.ts',
  'convex/features/users/index.ts',
  'convex/features/users/schema.ts',
  'convex/functions.ts',
  'convex/schema.ts',
  'nuxt.config.ts',
  'shared/features/todos/contract.ts',
])

function buildAppTemplateSet(template: AppTemplate, appName: string): InitTemplateSet {
  return {
    label: `app:${template}`,
    description: `Bootstrap a ${template} Trellis app inside the current workspace`,
    files: renderAppStarterFixture({ appName, template }),
  }
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

async function writeTemplateFiles(
  cwd: string,
  files: TemplateFile[],
  force: boolean,
): Promise<{ written: string[]; skipped: string[] }> {
  const written: string[] = []
  const skipped: string[] = []

  for (const file of files) {
    const destination = resolve(cwd, file.path)
    const exists = await pathExists(destination)
    if (exists && !force && file.mode === 'overwrite' && file.expectedExistingContent) {
      const current = await readFile(destination, 'utf8')
      if (current !== file.expectedExistingContent) {
        skipped.push(file.path)
        continue
      }
    }

    if (exists && !force && file.mode !== 'overwrite') {
      skipped.push(file.path)
      continue
    }

    await mkdir(dirname(destination), { recursive: true })
    await writeFile(destination, file.content, 'utf8')
    written.push(file.path)
  }

  return { written, skipped }
}

async function findProtectedOverwriteSkips(
  cwd: string,
  files: TemplateFile[],
  force: boolean,
): Promise<string[]> {
  if (force) return []

  const skipped: string[] = []
  for (const file of files) {
    if (file.mode !== 'overwrite' || !file.expectedExistingContent) continue

    const destination = resolve(cwd, file.path)
    if (!(await pathExists(destination))) continue

    const current = await readFile(destination, 'utf8')
    if (current !== file.expectedExistingContent) {
      skipped.push(file.path)
    }
  }

  return skipped
}

export async function applyInitTemplateSet(
  cwd: string,
  templateSet: InitTemplateSet,
  force: boolean,
): Promise<{
  written: string[]
  skipped: string[]
  authored: string[]
  generated: string[]
}> {
  const protectedOverwriteSkips = await findProtectedOverwriteSkips(cwd, templateSet.files, force)
  const existingRemoveFiles = []
  for (const file of templateSet.removeFiles ?? []) {
    if (await pathExists(resolve(cwd, file))) {
      existingRemoveFiles.push(file)
    }
  }

  if (
    templateSet.protectRemovalsOnSkippedOverwrites &&
    existingRemoveFiles.length > 0 &&
    protectedOverwriteSkips.length > 0
  ) {
    throw new Error(
      [
        `Cannot apply ${templateSet.label} without --force because protected files have local edits:`,
        protectedOverwriteSkips.join(', '),
        'Keeping edited files while removing the starter files they may import would leave a mixed app state.',
        'Review the edits, then rerun with --force if replacing them is intentional.',
      ].join(' '),
    )
  }

  const { written, skipped } = await writeTemplateFiles(cwd, templateSet.files, force)
  for (const file of templateSet.removeFiles ?? []) {
    await rm(resolve(cwd, file), { force: true, recursive: true })
  }
  await templateSet.afterWrite?.(cwd)

  return {
    written,
    skipped,
    authored: templateSet.files
      .filter((file) => file.ownership === 'authored')
      .map((file) => file.path),
    generated: templateSet.files
      .filter((file) => file.ownership === 'generated')
      .map((file) => file.path),
  }
}

function appPackageName(name: string): string {
  return (
    name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'trellis-app'
  )
}

function addMcpKeysSchemaBlock() {
  return `

  mcpKeys: defineTable({
    hash: v.string(),
    name: v.string(),
    boundUserId: v.id('users'),
    boundWorkspaceId: v.id('workspaces'),
    status: v.union(v.literal('active'), v.literal('revoked')),
    createdAt: v.number(),
    lastUsedAt: v.optional(v.number()),
  })
    .index('by_hash', ['hash'])
    .index('by_bound_workspace', ['boundWorkspaceId']),
`
}

function applyGeneratedBaselineValidation(
  files: TemplateFile[],
  options: {
    appName: string
    baselineTemplate: AppTemplate
    overwritePaths: Set<string>
  },
): TemplateFile[] {
  const baselineFiles = new Map(
    renderAppStarterFixture({
      appName: options.appName,
      template: options.baselineTemplate,
    }).map((file) => [file.path, file.content]),
  )

  return files.map((file) => {
    if (!options.overwritePaths.has(file.path)) return file
    return {
      ...file,
      mode: 'overwrite' as const,
      expectedExistingContent: baselineFiles.get(file.path),
    }
  })
}

async function enableNuxtMcpConfig(cwd: string): Promise<void> {
  const path = resolve(cwd, 'nuxt.config.ts')
  const source = await readFile(path, 'utf8')
  const appName = appPackageName(basename(cwd))
  const namedConfig = `mcp: { name: '${appName}', sessions: true }`
  const withAsyncContext = (input: string) => {
    if (/experimental\s*:\s*\{[\s\S]*?\basyncContext\s*:\s*true/.test(input)) {
      return input
    }
    if (/experimental\s*:\s*\{[\s\S]*?\basyncContext\s*:\s*false/.test(input)) {
      return input.replace(/\basyncContext\s*:\s*false/, 'asyncContext: true')
    }
    if (/experimental\s*:\s*\{/.test(input)) {
      return input.replace(/experimental\s*:\s*\{/, 'experimental: {\n    asyncContext: true,')
    }
    return input.replace(
      /export default defineNuxtConfig\(\{\n/,
      'export default defineNuxtConfig({\n  experimental: {\n    asyncContext: true,\n  },\n',
    )
  }

  let next = source
  if (/mcp:\s*\{/.test(source)) {
    next = withAsyncContext(source.replace(/mcp:\s*\{[^}]+\}/, namedConfig))
  } else if (
    next.includes("modules: ['@lupinum/trellis']") &&
    !next.includes('@nuxtjs/mcp-toolkit')
  ) {
    next = next.replace(
      "modules: ['@lupinum/trellis']",
      "modules: ['@lupinum/trellis', '@nuxtjs/mcp-toolkit']",
    )
  }

  if (next !== source && /mcp:\s*\{/.test(next)) {
    await writeFile(path, next, 'utf8')
    return
  }

  if (/mcp:\s*\{/.test(next)) {
    return
  }

  if (/modules:\s*\[[\s\S]*?@lupinum\/trellis[\s\S]*?\],/.test(next)) {
    next = withAsyncContext(next.replace(/(modules:\s*\[[\s\S]*?\],\n)/, `$1  ${namedConfig},\n`))
  } else if (next.includes("permissions: '")) {
    next = withAsyncContext(next.replace(/(permissions:\s*'[^']+',\n)/, `$1    ${namedConfig},\n`))
  } else {
    const trellisStart = next.indexOf('trellis: {')
    if (trellisStart !== -1) {
      const trellisClose = next.indexOf('\n  },', trellisStart)
      if (trellisClose !== -1) {
        next = withAsyncContext(
          `${next.slice(0, trellisClose)}\n    ${namedConfig},${next.slice(trellisClose)}`,
        )
      }
    }
  }

  if (next === source) {
    throw new Error('Unable to update nuxt.config.ts for the requested scaffold.')
  }
  await writeFile(path, next, 'utf8')
}

async function addMcpDependency(cwd: string): Promise<void> {
  const path = resolve(cwd, 'package.json')
  const source = await readFile(path, 'utf8')
  const parsed = JSON.parse(source) as {
    dependencies?: Record<string, string>
  }
  parsed.dependencies ??= {}
  parsed.dependencies['@nuxtjs/mcp-toolkit'] = '^0.16.1'
  await writeFile(path, `${JSON.stringify(parsed, null, 2)}\n`, 'utf8')
}

async function addAuthDependencies(cwd: string): Promise<void> {
  const path = resolve(cwd, 'package.json')
  const source = await readFile(path, 'utf8')
  const parsed = JSON.parse(source) as {
    dependencies?: Record<string, string>
  }
  parsed.dependencies ??= {}
  parsed.dependencies['@convex-dev/better-auth'] = '^0.12.2'
  parsed.dependencies['better-auth'] = '1.6.11'
  await writeFile(path, `${JSON.stringify(parsed, null, 2)}\n`, 'utf8')
}

async function enableAuthEnvExample(cwd: string): Promise<void> {
  const path = resolve(cwd, '.env.example')
  const source = await readFile(path, 'utf8')
  const requiredLines = [
    'CONVEX_SITE_URL=https://your-app.convex.site',
    'SITE_URL=http://localhost:3000',
    'BETTER_AUTH_SECRET=replace-me',
  ]
  const missingLines = requiredLines.filter((line) => !source.includes(line.split('=')[0]!))
  if (missingLines.length === 0) return
  const separator = source.endsWith('\n') ? '' : '\n'
  await writeFile(path, `${source}${separator}${missingLines.join('\n')}\n`, 'utf8')
}

async function enableMcpEnvExample(cwd: string): Promise<void> {
  const path = resolve(cwd, '.env.example')
  const source = await readFile(path, 'utf8')
  const requiredLines = [
    'CONVEX_IDENTITY_FORWARDING_KEY=replace-me',
    'TRELLIS_MCP_CONFIRMATION_KEY=replace-me',
  ]
  const missingLines = requiredLines.filter((line) => !source.includes(line.split('=')[0]!))
  if (missingLines.length === 0) return
  const separator = source.endsWith('\n') ? '' : '\n'
  await writeFile(path, `${source}${separator}${missingLines.join('\n')}\n`, 'utf8')
}

async function enableNuxtAuthConfig(cwd: string): Promise<void> {
  const path = resolve(cwd, 'nuxt.config.ts')
  const source = await readFile(path, 'utf8')
  let next = source

  if (!/\bsiteUrl\b/.test(next)) {
    next = next.replace(
      "const localConvexUrl = 'http://127.0.0.1:3210'\n",
      "const localConvexUrl = 'http://127.0.0.1:3210'\nconst siteUrl = process.env.SITE_URL || 'http://localhost:3000'\n",
    )
  }

  next = next.replace(/auth:\s*false\b/, 'auth: true')

  if (!next.includes('BETTER_AUTH_SECRET')) {
    next = next.replace(
      /(\s+convexDir: 'convex',\n\s+reset: resetLocalBackend,)/,
      `$1
            envVars: {
              SITE_URL: siteUrl,
              AUTH_BASE_URL: process.env.AUTH_BASE_URL || siteUrl,
              AUTH_TRUSTED_ORIGINS: process.env.AUTH_TRUSTED_ORIGINS || siteUrl,
              BETTER_AUTH_SECRET:
                process.env.BETTER_AUTH_SECRET || 'local-dev-better-auth-secret-not-for-production',
            },`,
    )
  }

  if (next !== source) {
    await writeFile(path, next, 'utf8')
  }
}

async function enableAuthSchema(cwd: string): Promise<void> {
  const path = resolve(cwd, 'convex/schema.ts')
  const source = await readFile(path, 'utf8')
  if (source.includes('userTables')) return
  const next = source
    .replace(
      "import { todosTables } from './features/todos'\n",
      "import { todosTables } from './features/todos'\nimport { userTables } from './features/users'\n",
    )
    .replace('  ...todosTables,', '  ...userTables,\n  ...todosTables,')
  if (next === source) {
    throw new Error('Unable to update convex/schema.ts for the requested auth scaffold.')
  }
  await writeFile(path, next, 'utf8')
}

async function enableWorkspaceMcpSchema(cwd: string): Promise<void> {
  const path = resolve(cwd, 'convex/schema.ts')
  const source = await readFile(path, 'utf8')
  if (source.includes('mcpKeys: defineTable')) return

  let next = source
  if (!/\bdefineTable\b/.test(next)) {
    next = next.replace(
      "import { defineSchema } from 'convex/server'",
      "import { defineSchema, defineTable } from 'convex/server'",
    )
  }
  if (!/from 'convex\/values'/.test(next)) {
    next = next.replace(
      /import \{ defineSchema, defineTable \} from 'convex\/server'\n/,
      "import { defineSchema, defineTable } from 'convex/server'\nimport { v } from 'convex/values'\n",
    )
  }
  next = next.replace(/\n\}\)\s*$/m, `${addMcpKeysSchemaBlock()}})\n`)

  if (next === source) {
    throw new Error('Unable to update convex/schema.ts for the requested MCP scaffold.')
  }
  await writeFile(path, next, 'utf8')
}

async function enableWorkspaceMcpPublicReads(cwd: string): Promise<void> {
  const path = resolve(cwd, 'convex/functions.ts')
  const source = await readFile(path, 'utf8')
  if (/readTables:\s*\[[^\]]*'mcpKeys'/.test(source)) return

  const next = source.replace(/readTables:\s*\[\s*'users'\s*\]/, "readTables: ['mcpKeys', 'users']")
  if (next === source) {
    throw new Error('Unable to update convex/functions.ts for the requested MCP scaffold.')
  }

  await writeFile(path, next, 'utf8')
}

function pascalCase(value: string): string {
  return value
    .replace(/[^a-z0-9]+/gi, ' ')
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0]!.toUpperCase() + part.slice(1))
    .join('')
}

function kebabCase(value: string): string {
  return value
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
}

function operationTemplate(name: string, kind: 'safe' | 'destructive') {
  const opId = kebabCase(name)
  const exportName = pascalCase(name)

  if (kind === 'destructive') {
    return `
import { operation, operationPreview, previewOf } from '@lupinum/trellis/app'
import { v } from 'convex/values'

import { mutation } from '../functions'

export const ${exportName}Op = operation.destructive({
  id: '${opId}',
  name: '${exportName}',
  args: {
    id: v.string(),
  },
  safety: 'destructive-write',
  preview: async (_ctx, args) =>
    operationPreview({
      summary: \`Confirm ${opId} for \${args.id}\`,
      confirm: {
        id: args.id,
      },
    }),
  handler: async (_ctx, args) => {
    throw new Error(\`Implement ${opId} for \${args.id}.\`)
  },
})

export const preview${exportName} = mutation.authenticated(previewOf(${exportName}Op))
export const execute${exportName} = mutation.authenticated(${exportName}Op)
`.trimStart()
  }

  return `
import { operation } from '@lupinum/trellis/app'
import { v } from 'convex/values'

export const ${exportName}Op = operation.mutation({
  id: '${opId}',
  name: '${exportName}',
  args: {
    id: v.string(),
  },
  handler: async (_ctx, args) => {
    throw new Error(\`Implement ${opId} for \${args.id}.\`)
  },
})
`.trimStart()
}

export function getCanonicalAppTemplateSet(options: {
  appName: string
  template: CanonicalAppTemplate
  mcp?: boolean
}): InitTemplateSet {
  const template =
    options.template === 'workspace' && options.mcp === true ? 'workspace-mcp' : options.template
  const appTemplateSet = buildAppTemplateSet(template, options.appName)

  return {
    label: `init:${template}`,
    description: `Bootstrap a ${template} Trellis app`,
    files: appTemplateSet.files,
  }
}

export async function getAddTemplateSet(options: {
  feature: AddFeature
  cwd: string
  name?: string
  kind?: 'safe' | 'destructive'
  appName?: string
}): Promise<InitTemplateSet> {
  if (options.feature === 'auth') {
    const appName = options.appName ?? basename(options.cwd)
    return {
      label: 'add:auth',
      description: 'Add the canonical Trellis auth lifecycle',
      files: applyGeneratedBaselineValidation(
        renderAppStarterFixtureSubset({
          appName,
          template: 'personal',
          paths: authAddFixturePaths,
        }),
        {
          appName,
          baselineTemplate: 'public',
          overwritePaths: authAddOverwritePaths,
        },
      ),
      removeFiles: ['app/features/public/components/PublicStarterPage.vue'],
      protectRemovalsOnSkippedOverwrites: true,
      afterWrite: async (cwd) => {
        await addAuthDependencies(cwd)
        await enableAuthEnvExample(cwd)
        await enableNuxtAuthConfig(cwd)
        await enableAuthSchema(cwd)
      },
    }
  }

  if (options.feature === 'workspace') {
    const appName = options.appName ?? basename(options.cwd)
    return {
      label: 'add:workspace',
      description: 'Add the canonical Trellis workspace capability',
      files: applyGeneratedBaselineValidation(
        renderAppStarterFixtureSubset({
          appName,
          template: 'workspace',
          paths: workspaceAddFixturePaths,
        }),
        {
          appName,
          baselineTemplate: 'personal',
          overwritePaths: workspaceAddOverwritePaths,
        },
      ),
      removeFiles: ['app/features/personal/components/PersonalStarterPage.vue'],
      protectRemovalsOnSkippedOverwrites: true,
    }
  }

  if (options.feature === 'mcp') {
    const appName = options.appName ?? basename(options.cwd)
    return {
      label: 'add:mcp',
      description: 'Add the canonical MCP runtime to a workspace app',
      files: applyGeneratedBaselineValidation(
        renderAppStarterFixtureSubset({
          appName,
          template: 'workspace-mcp',
          paths: mcpAddFixturePaths,
        }),
        {
          appName,
          baselineTemplate: 'workspace',
          overwritePaths: mcpAddOverwritePaths,
        },
      ),
      removeFiles: ['server/mcp/.gitkeep'],
      afterWrite: async (cwd) => {
        await enableNuxtMcpConfig(cwd)
        await addMcpDependency(cwd)
        await enableWorkspaceMcpSchema(cwd)
        await enableWorkspaceMcpPublicReads(cwd)
        await enableMcpEnvExample(cwd)
      },
    }
  }

  if (options.feature === 'uploads') {
    return {
      label: 'add:uploads',
      description: 'Add a canonical upload URL seam and starter page',
      files: renderAddFixture({ fixture: 'uploads' }),
    }
  }

  if (options.feature === 'entity') {
    if (!options.name) {
      throw new Error('`trellis add entity <name>` requires an entity name.')
    }

    return await buildResourceTemplateSet(options.cwd, options.name)
  }

  if (!options.name) {
    throw new Error('`trellis add operation <name>` requires an operation name.')
  }

  return {
    label: `add:operation:${kebabCase(options.name)}`,
    description: 'Add a canonical operation scaffold',
    files: [
      {
        path: `convex/operations/${kebabCase(options.name)}.ts`,
        content: operationTemplate(options.name, options.kind ?? 'safe'),
        ownership: 'authored',
      },
    ],
  }
}
