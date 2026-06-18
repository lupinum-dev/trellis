import { access, mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

import {
  buildOperationRegistry,
  renderOperationRegistryGeneratedFiles,
} from '../../module-internals/operation-registry-codegen.js'
import { extractPublicSurfaceCodegenMetadata } from '../../module-internals/public-surface-codegen.js'
import type { InitTemplateSet, TemplateFile } from './init.js'

type ResourceAppKind = 'personal' | 'workspace' | 'author-owned'

type ResourceGeneratorContext = {
  kind: ResourceAppKind
  hasMcp: boolean
  hasFeatureManifest: boolean
  ownerField: 'ownerId' | 'authorId'
  tenantField: 'workspaceId' | null
  hasUpdatedAt: boolean
  name: string
  fileStem: string
  singularPascal: string
  singularCamel: string
  pluralPascal: string
  pluralCamel: string
  tableName: string
  permissionPrefix: string
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

function kebabCase(value: string): string {
  return value
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
}

function camelCase(value: string): string {
  const parts = kebabCase(value).split('-').filter(Boolean)
  if (parts.length === 0) return 'resource'
  return (
    parts[0] +
    parts
      .slice(1)
      .map((part) => part[0]!.toUpperCase() + part.slice(1))
      .join('')
  )
}

function pascalCase(value: string): string {
  const camel = camelCase(value)
  return camel[0]!.toUpperCase() + camel.slice(1)
}

function pluralize(value: string): string {
  if (value.endsWith('y') && !/[aeiou]y$/i.test(value)) {
    return `${value.slice(0, -1)}ies`
  }
  if (/[sxz]$|ch$|sh$/i.test(value)) {
    return `${value}es`
  }
  return `${value}s`
}

async function inferResourceContext(cwd: string, name: string): Promise<ResourceGeneratorContext> {
  const schemaPath = resolve(cwd, 'convex/schema.ts')
  const schemaSource = await readFile(schemaPath, 'utf8')
  const hasWorkspaceCaller = await exists(resolve(cwd, 'convex/auth/caller.ts'))
  const hasAuthorOwnedPages = await exists(resolve(cwd, 'convex/features/pages/domain.ts'))
  const kind: ResourceAppKind = hasWorkspaceCaller
    ? 'workspace'
    : hasAuthorOwnedPages
      ? 'author-owned'
      : 'personal'
  const hasFeatureManifest = await exists(resolve(cwd, 'convex/features/index.ts'))

  const singularCamel = camelCase(name)
  const singularPascal = pascalCase(name)
  const pluralCamel = pluralize(singularCamel)
  const pluralPascal = pascalCase(pluralCamel)
  const ownerField =
    kind === 'author-owned' || /authorId\s*:/.test(schemaSource) ? 'authorId' : 'ownerId'
  const tenantField = kind === 'workspace' ? 'workspaceId' : null
  const hasUpdatedAt = /updatedAt\s*:/.test(schemaSource)
  const hasMcp =
    (await exists(resolve(cwd, 'server/mcp/runtime.ts'))) ||
    (await exists(resolve(cwd, 'server/mcp/index.ts')))

  return {
    kind,
    hasMcp,
    hasFeatureManifest,
    ownerField,
    tenantField,
    hasUpdatedAt,
    name,
    fileStem: kebabCase(name),
    singularPascal,
    singularCamel,
    pluralPascal,
    pluralCamel,
    tableName: pluralCamel,
    permissionPrefix: singularCamel,
  }
}

function resourceContractTemplate(ctx: ResourceGeneratorContext): string {
  const createName = `create${ctx.singularPascal}`
  const updateName = `update${ctx.singularPascal}`
  const deleteName = `delete${ctx.singularPascal}`
  const getName = `get${ctx.singularPascal}`
  const listName = `list${ctx.pluralPascal}`

  return `
import { defineArgs } from '@lupinum/trellis/args'
import { v } from 'convex/values'

export const ${createName} = defineArgs({
  description: 'Create a ${ctx.singularCamel}',
  args: {
    name: v.string(),
  },
})

export const ${updateName} = defineArgs({
  description: 'Update a ${ctx.singularCamel}',
  args: {
    id: v.id('${ctx.tableName}'),
    name: v.string(),
  },
})

export const ${deleteName} = defineArgs({
  description: 'Delete a ${ctx.singularCamel}',
  args: {
    id: v.id('${ctx.tableName}'),
  },
})

export const ${getName} = defineArgs({
  description: 'Get one ${ctx.singularCamel}',
  args: {
    id: v.id('${ctx.tableName}'),
  },
})

export const ${listName} = defineArgs({
  description: 'List ${ctx.pluralCamel}',
  args: {},
})
`.trimStart()
}

function resourcePermissionsTemplate(ctx: ResourceGeneratorContext): string {
  const keyImports = ctx.hasMcp
    ? `
import {
  ${ctx.singularCamel}CreateKey,
  ${ctx.singularCamel}DeleteKey,
  ${ctx.singularCamel}ReadKey,
} from '../../../shared/features/${ctx.tableName}/permissions'
`
    : ''
  const readKey = ctx.hasMcp ? `${ctx.singularCamel}ReadKey.key` : `'${ctx.permissionPrefix}.read'`
  const createKey = ctx.hasMcp
    ? `${ctx.singularCamel}CreateKey.key`
    : `'${ctx.permissionPrefix}.create'`
  const deleteKey = ctx.hasMcp
    ? `${ctx.singularCamel}DeleteKey.key`
    : `'${ctx.permissionPrefix}.delete'`

  if (ctx.kind !== 'workspace') {
    return `
import { definePermission } from '@lupinum/trellis/auth'
${keyImports}

export const ${ctx.singularCamel}ReadPermission = definePermission({
  key: ${readKey},
  check: (appIdentity) => appIdentity !== null,
})

export const ${ctx.singularCamel}CreatePermission = definePermission({
  key: ${createKey},
  check: (appIdentity) => appIdentity !== null,
})

export const ${ctx.singularCamel}DeletePermission = definePermission({
  key: ${deleteKey},
  check: (appIdentity) => appIdentity !== null,
})

export const ${ctx.singularCamel}Permissions = [
  ${ctx.singularCamel}ReadPermission,
  ${ctx.singularCamel}CreatePermission,
  ${ctx.singularCamel}DeletePermission,
] as const
`.trimStart()
  }

  return `
import { definePermission } from '@lupinum/trellis/auth'
${keyImports}

import type { AccessIdentity } from '../../auth/appIdentity'
import type { Role } from '../../auth/caller'

const roleRank: Record<Role, number> = {
  owner: 4,
  admin: 3,
  member: 2,
  viewer: 1,
}

function hasWorkspace(appIdentity: AccessIdentity | null): boolean {
  return !!appIdentity?.workspaceId
}

function hasMinimumRole(appIdentity: AccessIdentity | null, minimum: Role): boolean {
  if (!appIdentity?.workspaceId) return false
  return roleRank[appIdentity.role] >= roleRank[minimum]
}

export const ${ctx.singularCamel}ReadPermission = definePermission({
  key: ${readKey},
  check: hasWorkspace,
})

export const ${ctx.singularCamel}CreatePermission = definePermission({
  key: ${createKey},
  check: (appIdentity: AccessIdentity | null) => hasMinimumRole(appIdentity, 'member'),
})

export const ${ctx.singularCamel}DeletePermission = definePermission({
  key: ${deleteKey},
  check: (appIdentity: AccessIdentity | null) => hasMinimumRole(appIdentity, 'member'),
})

export const ${ctx.singularCamel}Permissions = [
  ${ctx.singularCamel}ReadPermission,
  ${ctx.singularCamel}CreatePermission,
  ${ctx.singularCamel}DeletePermission,
] as const
`.trimStart()
}

function resourceSharedPermissionsTemplate(ctx: ResourceGeneratorContext): string {
  return `
import { definePermissionKey } from '@lupinum/trellis/auth'

export const ${ctx.singularCamel}ReadKey = definePermissionKey({
  key: '${ctx.permissionPrefix}.read',
  label: 'Read ${ctx.pluralCamel}',
})

export const ${ctx.singularCamel}CreateKey = definePermissionKey({
  key: '${ctx.permissionPrefix}.create',
  label: 'Create ${ctx.pluralCamel}',
})

export const ${ctx.singularCamel}DeleteKey = definePermissionKey({
  key: '${ctx.permissionPrefix}.delete',
  label: 'Delete ${ctx.pluralCamel}',
})
`.trimStart()
}

function resourceCreateFields(
  ctx: ResourceGeneratorContext,
  options: { tenantSource?: 'appIdentity' | 'ctx' } = {},
): string {
  const tenantSource = options.tenantSource ?? 'appIdentity'
  return [
    `${ctx.ownerField}: appIdentity.userId`,
    `name: args.name`,
    ...(ctx.tenantField
      ? [
          `${ctx.tenantField}: ${
            tenantSource === 'ctx' ? `ctx.${ctx.tenantField}` : `appIdentity.${ctx.tenantField}!`
          }`,
        ]
      : []),
    'createdAt: now',
    ...(ctx.hasUpdatedAt ? ['updatedAt: now'] : []),
  ].join(',\n      ')
}

function resourceBackendLane(ctx: ResourceGeneratorContext): 'authenticated' | 'workspace' {
  return ctx.kind === 'workspace' ? 'workspace' : 'authenticated'
}

function resourcePermissionProperty(ctx: ResourceGeneratorContext, permission: string): string {
  return ctx.kind === 'workspace' ? `  permission: ${permission},\n` : ''
}

function resourceOperationTemplate(ctx: ResourceGeneratorContext): string {
  const createFields = resourceCreateFields(ctx, {
    tenantSource: ctx.tenantField ? 'ctx' : 'appIdentity',
  })
  const lane = resourceBackendLane(ctx)
  const identityType = ctx.kind === 'workspace' ? 'AccessIdentity' : 'AppIdentity'
  const operationOwnerCheck = ctx.tenantField
    ? `${ctx.singularCamel}.${ctx.tenantField} === appIdentity.workspaceId`
    : `${ctx.singularCamel}.${ctx.ownerField} === appIdentity.userId`
  const workspaceScopeImport = ctx.tenantField
    ? "import { workspaceScope } from '@lupinum/trellis/app'\n"
    : ''
  const scopeProperty = ctx.tenantField ? `  scope: workspaceScope(),\n` : ''

  return `
import type { Doc } from '../../_generated/dataModel'
import type { ${identityType} } from '../../auth/appIdentity'
import { requireAuth, requireRecord } from '@lupinum/trellis/auth'
${workspaceScopeImport}import {
  implementOperation,
  operationEffect,
  operationIssue,
  operationPreview,
  previewOf,
} from '@lupinum/trellis/backend'

import {
  create${ctx.singularPascal}Descriptor,
  remove${ctx.singularPascal}Descriptor,
} from '../../../shared/features/${ctx.tableName}/operations'
import {
  ${ctx.singularCamel}CreatePermission,
  ${ctx.singularCamel}DeletePermission,
} from './permissions'
import { mutation } from '../../functions'

type ${ctx.singularPascal}OperationIdentity = NonNullable<${identityType}>
type Loaded${ctx.singularPascal} = { ${ctx.singularCamel}: Doc<'${ctx.tableName}'> }

export const create${ctx.singularPascal}Operation = implementOperation(create${ctx.singularPascal}Descriptor, {
  permission: ${ctx.singularCamel}CreatePermission,
${scopeProperty}  handler: async (ctx, args) => {
    const appIdentity = await ctx.appIdentity()
    requireAuth(appIdentity)
    const now = Date.now()
    return await ctx.db.insert('${ctx.tableName}', {
      ${createFields}
    })
  },
})

export const remove${ctx.singularPascal}Operation = implementOperation(remove${ctx.singularPascal}Descriptor, {
  permission: ${ctx.singularCamel}DeletePermission,
${scopeProperty}  load: async (ctx, args) => {
    const ${ctx.singularCamel} = await ctx.db.get(args.id)
    requireRecord(${ctx.singularCamel}, '${ctx.singularPascal}')
    return { ${ctx.singularCamel} }
  },
  authorize: {
    check: async (
      appIdentity: ${ctx.singularPascal}OperationIdentity,
      { ${ctx.singularCamel} }: Loaded${ctx.singularPascal},
    ) => ${operationOwnerCheck},
  },
  preview: async (_ctx, _args, { ${ctx.singularCamel} }) => operationPreview({
    summary: \`Will permanently delete "\${${ctx.singularCamel}.name}"\`,
    warnings: [operationIssue({ code: 'permanent-delete', message: 'This cannot be undone' })],
    effects: [operationEffect({ kind: '${ctx.tableName}', summary: '${ctx.singularPascal} records deleted', count: 1 })],
    confirm: {
      operation: '${ctx.tableName}.remove',
      targetId: ${ctx.singularCamel}._id,
      affectedCounts: { ${ctx.tableName}: 1 },
    },
  }),
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id)
    return null
  },
})

export const previewRemove${ctx.singularPascal} = mutation.${lane}(previewOf(remove${ctx.singularPascal}Operation))
`.trimStart()
}

function resourceOperationDescriptorTemplate(ctx: ResourceGeneratorContext): string {
  return `
import { defineOperationDescriptor, operationPreviewValidator } from '@lupinum/trellis/backend'
import { v } from 'convex/values'

import {
  create${ctx.singularPascal},
  delete${ctx.singularPascal},
} from './contract'
import {
  ${ctx.singularCamel}CreateKey,
  ${ctx.singularCamel}DeleteKey,
} from './permissions'

export const create${ctx.singularPascal}Descriptor = defineOperationDescriptor({
  id: '${ctx.tableName}.create',
  name: 'create${ctx.singularPascal}',
  args: create${ctx.singularPascal}.args,
  permission: ${ctx.singularCamel}CreateKey,
  safety: 'bounded-write',
  returns: v.id('${ctx.tableName}'),
})

export const remove${ctx.singularPascal}Descriptor = defineOperationDescriptor({
  id: '${ctx.tableName}.remove',
  name: 'remove${ctx.singularPascal}',
  kind: 'destructive',
  args: delete${ctx.singularPascal}.args,
  permission: ${ctx.singularCamel}DeleteKey,
  safety: 'destructive-write',
  previewReturns: operationPreviewValidator({
    confirm: v.object({
      operation: v.literal('${ctx.tableName}.remove'),
      targetId: v.id('${ctx.tableName}'),
      affectedCounts: v.object({
        ${ctx.tableName}: v.number(),
      }),
    }),
  }),
  returns: v.null(),
})
`.trimStart()
}

function resourceDomainTemplate(ctx: ResourceGeneratorContext): string {
  const contractImport = `../../../shared/features/${ctx.tableName}/contract`
  const lane = resourceBackendLane(ctx)
  const updateOwnerCheck =
    ctx.kind === 'workspace'
      ? "appIdentity.role === 'owner' || appIdentity.role === 'admin' || appIdentity.userId === loaded.ownerId"
      : `appIdentity.userId === loaded.${ctx.ownerField}`
  const listQuery = ctx.tenantField
    ? `.withIndex('by_workspace', (q) => q.eq('${ctx.tenantField}', ctx.${ctx.tenantField}))`
    : `.withIndex('by_${ctx.ownerField === 'authorId' ? 'author' : 'owner'}', (q) => q.eq('${ctx.ownerField}', appIdentity.userId))`
  const createFields = resourceCreateFields(ctx, {
    tenantSource: ctx.tenantField ? 'ctx' : 'appIdentity',
  })
  const patchFields = [
    `name: args.name`,
    ...(ctx.hasUpdatedAt ? ['updatedAt: Date.now()'] : []),
  ].join(',\n      ')
  const removeExport = ctx.hasMcp
    ? `export const remove = mutation.${lane}(remove${ctx.singularPascal}Operation)\n`
    : `export const remove = mutation.${lane}({
  id: '${ctx.tableName}.remove',
  args: delete${ctx.singularPascal}.args,
${resourcePermissionProperty(ctx, `${ctx.singularCamel}DeletePermission`)}  load: async (ctx, args) => {
    const ${ctx.singularCamel} = await ctx.db.get(args.id)
    requireRecord(${ctx.singularCamel}, '${ctx.singularPascal}')
    return ${ctx.singularCamel}
  },
  authorize: {
    check: async (appIdentity, loaded) => ${updateOwnerCheck},
  },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id)
  },
})
`
  const createExport = ctx.hasMcp
    ? `export const create = mutation.${lane}(create${ctx.singularPascal}Operation)\n`
    : `export const create = mutation.${lane}({
  id: '${ctx.tableName}.create',
  args: create${ctx.singularPascal}.args,
${resourcePermissionProperty(ctx, `${ctx.singularCamel}CreatePermission`)}  handler: async (ctx, args) => {
    const appIdentity = await ctx.appIdentity()
    requireAuth(appIdentity)
    const now = Date.now()
    return await ctx.db.insert('${ctx.tableName}', {
      ${createFields}
    })
  },
})
`

  return `
import { requireAuth, requireRecord } from '@lupinum/trellis/auth'
import {
  create${ctx.singularPascal},
  delete${ctx.singularPascal},
  get${ctx.singularPascal},
  list${ctx.pluralPascal},
  update${ctx.singularPascal},
} from '${contractImport}'
import {
  ${ctx.singularCamel}CreatePermission,
  ${ctx.singularCamel}DeletePermission,
  ${ctx.singularCamel}ReadPermission,
} from './permissions'
import { mutation, query } from '../../functions'
${ctx.hasMcp ? `import { create${ctx.singularPascal}Operation, remove${ctx.singularPascal}Operation } from './operations'\n` : ''}

export const list = query.${lane}({
  id: '${ctx.tableName}.list',
  args: list${ctx.pluralPascal}.args,
${resourcePermissionProperty(ctx, `${ctx.singularCamel}ReadPermission`)}  handler: async (ctx) => {
    const appIdentity = await ctx.appIdentity()
    requireAuth(appIdentity)
    return await ctx.db
      .query('${ctx.tableName}')
      ${listQuery}
      .order('desc')
      .collect()
  },
})

export const get = query.${lane}({
  id: '${ctx.tableName}.get',
  args: get${ctx.singularPascal}.args,
${resourcePermissionProperty(ctx, `${ctx.singularCamel}ReadPermission`)}  load: async (ctx, args) => {
    const loaded = await ctx.db.get(args.id)
    requireRecord(loaded, '${ctx.singularPascal}')
    return loaded
  },
  authorize: {
    check: async (appIdentity, loaded) => ${ctx.tenantField ? `loaded.${ctx.tenantField} === appIdentity.workspaceId` : `loaded.${ctx.ownerField} === appIdentity.userId`},
  },
  handler: async (_ctx, _args, loaded) => loaded,
})

${createExport}

export const update = mutation.${lane}({
  id: '${ctx.tableName}.update',
  args: update${ctx.singularPascal}.args,
${resourcePermissionProperty(ctx, `${ctx.singularCamel}ReadPermission`)}  load: async (ctx, args) => {
    const loaded = await ctx.db.get(args.id)
    requireRecord(loaded, '${ctx.singularPascal}')
    return loaded
  },
  authorize: {
    check: async (appIdentity, loaded) => ${updateOwnerCheck},
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      ${patchFields}
    })
  },
})

${removeExport}`.trimStart()
}

function resourceTestTemplate(ctx: ResourceGeneratorContext): string {
  if (ctx.kind === 'workspace') {
    return `
import { describe, expect, it } from 'vitest'

import { createTestContext } from '@lupinum/trellis/testing'

import { api } from '../../_generated/api'
import schema from '../../schema'
import { modules } from '../../test.setup'

function createCtx() {
  return createTestContext({ schema, modules })
}

describe('${ctx.tableName}', () => {
  it('allows a workspace member to create and update their own ${ctx.singularCamel}', async () => {
    const ctx = createCtx()
    const tenant = await ctx.seedTenant({
      name: 'Alpha',
      users: {
        owner: { role: 'owner' as const },
        member: { role: 'member' as const },
      },
    })

    const id = await tenant.users.member.mutation(api.features.${ctx.tableName}.domain.create, { name: 'Draft' })
    await tenant.users.member.mutation(api.features.${ctx.tableName}.domain.update, { id, name: 'Renamed' })

    const rows = await ctx.readAll('${ctx.tableName}')
    expect(rows.find((row) => row._id === id)?.name).toBe('Renamed')
  })

  it('denies a member updating another member\\'s ${ctx.singularCamel}', async () => {
    const ctx = createCtx()
    const tenant = await ctx.seedTenant({
      name: 'Alpha',
      users: {
        owner: { role: 'owner' as const },
        member: { role: 'member' as const },
        other: { role: 'member' as const },
      },
    })

    const id = await tenant.users.member.mutation(api.features.${ctx.tableName}.domain.create, { name: 'Draft' })

    await expect(
      tenant.users.other.mutation(api.features.${ctx.tableName}.domain.update, { id, name: 'Denied' }),
    ).rejects.toThrow(/Forbidden/)
  })

  it('keeps tenants isolated from each other', async () => {
    const ctx = createCtx()
    const alpha = await ctx.seedTenant({
      name: 'Alpha',
      users: {
        member: { role: 'member' as const },
      },
    })
    const beta = await ctx.seedTenant({
      name: 'Beta',
      users: {
        member: { role: 'member' as const },
      },
    })

    const alphaId = await alpha.users.member.mutation(api.features.${ctx.tableName}.domain.create, { name: 'Alpha only' })
    await beta.users.member.mutation(api.features.${ctx.tableName}.domain.create, { name: 'Beta only' })

    const alphaRows = await alpha.users.member.query(api.features.${ctx.tableName}.domain.list, {})
    const betaRows = await beta.users.member.query(api.features.${ctx.tableName}.domain.list, {})

    expect(alphaRows).toHaveLength(1)
    expect(alphaRows[0]?.name).toBe('Alpha only')
    expect(betaRows).toHaveLength(1)
    expect(betaRows[0]?.name).toBe('Beta only')
    await expect(
      beta.users.member.query(api.features.${ctx.tableName}.domain.get, { id: alphaId }),
    ).rejects.toThrow(/Forbidden/)
  })

  it('denies a viewer creating a ${ctx.singularCamel}', async () => {
    const ctx = createCtx()
    const tenant = await ctx.seedTenant({
      name: 'Alpha',
      users: {
        viewer: { role: 'viewer' as const },
      },
    })

    await expect(
      tenant.users.viewer.mutation(api.features.${ctx.tableName}.domain.create, { name: 'Denied' }),
    ).rejects.toThrow(/Forbidden/)
  })
})
`.trimStart()
  }

  return `
import { describe, expect, it } from 'vitest'

import { createTestContext } from '@lupinum/trellis/testing'

import { api } from '../../_generated/api'
import schema from '../../schema'
import { modules } from '../../test.setup'

function createCtx() {
  return createTestContext({ schema, modules })
}

async function seedUser(ctx: ReturnType<typeof createCtx>, authKey: string) {
  await ctx.seed('users', {
    authKey,
    email: \`\${authKey}@example.test\`,
    displayName: authKey,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  })
}

describe('${ctx.tableName}', () => {
  it('allows the owner to update their own ${ctx.singularCamel}', async () => {
    const ctx = createCtx()
    await seedUser(ctx, 'owner-1')
    const owner = ctx.asUser({ authKey: 'owner-1' })
    const id = await owner.mutation(api.features.${ctx.tableName}.domain.create, { name: 'Draft' })

    await owner.mutation(api.features.${ctx.tableName}.domain.update, { id, name: 'Renamed' })

    const rows = await ctx.readAll('${ctx.tableName}')
    expect(rows.find((row) => row._id === id)?.name).toBe('Renamed')
  })

  it('denies another user from updating the owner\\'s ${ctx.singularCamel}', async () => {
    const ctx = createCtx()
    await seedUser(ctx, 'owner-1')
    await seedUser(ctx, 'other-1')
    const owner = ctx.asUser({ authKey: 'owner-1' })
    const other = ctx.asUser({ authKey: 'other-1' })
    const id = await owner.mutation(api.features.${ctx.tableName}.domain.create, { name: 'Draft' })

    await expect(
      other.mutation(api.features.${ctx.tableName}.domain.update, { id, name: 'Denied' }),
    ).rejects.toThrow(/Forbidden/)
  })
})
`.trimStart()
}

function resourceMcpListTemplate(ctx: ResourceGeneratorContext): string {
  return `
import { api } from '#trellis/api'
import { ${ctx.singularCamel}ReadPermission } from '~~/convex/features/${ctx.tableName}'
import { list${ctx.pluralPascal} } from '~~/shared/features/${ctx.tableName}/contract'

import { tool } from '../runtime'

export default tool.query({
  schema: list${ctx.pluralPascal},
  call: api.features.${ctx.tableName}.domain.list,
  permission: ${ctx.singularCamel}ReadPermission,
  meta: {
    name: 'list-${ctx.fileStem}',
  },
})
`.trimStart()
}

function resourceMcpCreateTemplate(ctx: ResourceGeneratorContext): string {
  return `
import { operations } from '#trellis/operations/mcp'

import { tool } from '../runtime'

export default tool.operation(operations.${ctx.tableName}.create, {
  meta: {
    name: 'create-${ctx.fileStem}',
  },
})
`.trimStart()
}

function resourceMcpDeleteTemplate(ctx: ResourceGeneratorContext): string {
  return `
import { operations } from '#trellis/operations/mcp'

import { tool } from '../runtime'

export default tool.operation(operations.${ctx.tableName}.remove, {
  meta: {
    name: 'delete-${ctx.fileStem}',
  },
})
`.trimStart()
}

function schemaTableBlock(ctx: ResourceGeneratorContext): string {
  const lines = [
    `  ${ctx.tableName}: defineTable({`,
    `    ${ctx.ownerField}: v.string(),`,
    ...(ctx.tenantField ? [`    ${ctx.tenantField}: v.id('workspaces'),`] : []),
    '    name: v.string(),',
    '    createdAt: v.number(),',
    ...(ctx.hasUpdatedAt ? ['    updatedAt: v.number(),'] : []),
    `  })`,
    `    .index('by_${ctx.ownerField === 'authorId' ? 'author' : 'owner'}', ['${ctx.ownerField}'])`,
    ...(ctx.tenantField ? [`    .index('by_workspace', ['${ctx.tenantField}'])`] : []),
  ]

  return `${lines.join('\n')},\n`
}

function resourceSchemaTemplate(ctx: ResourceGeneratorContext): string {
  return `
import { defineTable } from 'convex/server'
import { v } from 'convex/values'

export const ${ctx.tableName}Tables = {
${schemaTableBlock(ctx).trimEnd()}
}
`.trimStart()
}

function resourceFeatureTemplate(ctx: ResourceGeneratorContext): string {
  const permissionsLine = `  permissions: ${ctx.singularCamel}Permissions,\n`
  const operationsImport = ctx.hasMcp
    ? `import { create${ctx.singularPascal}Descriptor, remove${ctx.singularPascal}Descriptor } from '../../../shared/features/${ctx.tableName}/operations'\n`
    : ''
  const operationsLine = ctx.hasMcp
    ? `  operations: [create${ctx.singularPascal}Descriptor, remove${ctx.singularPascal}Descriptor],\n`
    : ''

  return `
import { defineFeature } from '@lupinum/trellis/workspace'

${operationsImport}
import { ${ctx.singularCamel}Permissions } from './permissions'
import { ${ctx.tableName}Tables } from './schema'

export const ${ctx.tableName}Feature = defineFeature({
  name: '${ctx.tableName}',
  schema: ${ctx.tableName}Tables,
${permissionsLine}${operationsLine}})
`.trimStart()
}

function resourceIndexTemplate(ctx: ResourceGeneratorContext): string {
  return `
export { ${ctx.tableName}Feature } from './feature'
export {
  ${ctx.singularCamel}CreatePermission,
  ${ctx.singularCamel}DeletePermission,
  ${ctx.singularCamel}Permissions,
  ${ctx.singularCamel}ReadPermission,
} from './permissions'
export { ${ctx.tableName}Tables } from './schema'
`.trimStart()
}

async function patchSchema(cwd: string, ctx: ResourceGeneratorContext): Promise<void> {
  const path = resolve(cwd, 'convex/schema.ts')
  const source = await readFile(path, 'utf8')
  if (
    source.includes(`${ctx.tableName}: defineTable`) ||
    source.includes(`${ctx.tableName}Tables`) ||
    source.includes(`./features/${ctx.tableName}'`)
  ) {
    throw new Error(`[trellis] Entity "${ctx.tableName}" already exists in convex/schema.ts.`)
  }
  const importBlock = `import { ${ctx.tableName}Tables } from './features/${ctx.tableName}'\n`
  const importAnchor = source.indexOf('export default defineSchema')
  if (importAnchor === -1) {
    throw new Error(
      '[trellis] Could not patch convex/schema.ts. Expected a canonical defineSchema(...) layout.',
    )
  }
  const withImport = `${source.slice(0, importAnchor)}${importBlock}${source.slice(importAnchor)}`
  const next = withImport.replace(/\n\}\)\s*$/, `\n  ...${ctx.tableName}Tables,\n})\n`)
  if (next === source || next === withImport) {
    throw new Error(
      '[trellis] Could not patch convex/schema.ts. Expected a canonical defineSchema(...) layout.',
    )
  }

  await writeFile(path, next)
}

async function patchFeatureManifest(cwd: string, ctx: ResourceGeneratorContext): Promise<void> {
  if (!ctx.hasFeatureManifest) return

  const path = resolve(cwd, 'convex/features/index.ts')
  const source = await readFile(path, 'utf8')
  const featureName = `${ctx.tableName}Feature`
  const featureImport = `import { ${featureName} } from './${ctx.tableName}/feature'`

  if (source.includes(featureImport)) {
    return
  }

  const importMatches = [...source.matchAll(/^import .*$/gm)]
  const lastImport = importMatches.at(-1)
  if (!lastImport || lastImport.index === undefined) {
    throw new Error(
      '[trellis] Could not patch convex/features/index.ts. Expected a canonical import block.',
    )
  }

  const importInsertionIndex = lastImport.index + lastImport[0].length
  const withImport = `${source.slice(0, importInsertionIndex)}\n${featureImport}${source.slice(importInsertionIndex)}`
  const next = withImport.replace(
    /composeFeatures\(\[([^\]]+)\]\)/,
    (_match, items) => `composeFeatures([${items.trimEnd()}, ${featureName}])`,
  )

  if (next === source || next === withImport) {
    throw new Error(
      '[trellis] Could not patch convex/features/index.ts. Expected a canonical composed manifest.',
    )
  }

  await writeFile(path, next)
}

async function patchMcpRuntime(cwd: string, ctx: ResourceGeneratorContext): Promise<void> {
  if (!ctx.hasMcp) return

  const path = resolve(cwd, 'server/mcp/runtime.ts')
  const source = await readFile(path, 'utf8')
  if (source.includes('api.permissions.context.getAccessContext')) {
    return
  }
  if (source.includes(`'${ctx.permissionPrefix}.read'`)) {
    return
  }

  const canWriteExpr =
    ctx.kind === 'workspace'
      ? `caller.kind === 'agent' && !!caller.workspaceId && canWrite(caller.role)`
      : "caller.kind !== 'anonymous'"
  const readExpr =
    ctx.kind === 'workspace'
      ? `caller.kind === 'agent' && !!caller.workspaceId`
      : "caller.kind !== 'anonymous'"

  const insertion = [
    `    '${ctx.permissionPrefix}.read': ${readExpr},`,
    `    '${ctx.permissionPrefix}.create': ${canWriteExpr},`,
    `    '${ctx.permissionPrefix}.delete': ${canWriteExpr},`,
  ].join('\n')

  const blockStart = source.indexOf('resolveAccess: async ({')
  if (blockStart === -1) {
    throw new Error(
      '[trellis] Could not patch server/mcp/runtime.ts. Expected a canonical resolveAccess block.',
    )
  }
  const returnStart = source.indexOf('=> ({', blockStart)
  const blockEnd = source.indexOf('\n  }),', returnStart)
  if (returnStart === -1 || blockEnd === -1) {
    throw new Error(
      '[trellis] Could not patch server/mcp/runtime.ts. Expected a canonical resolveAccess block.',
    )
  }
  const next = `${source.slice(0, blockEnd)}\n${insertion}${source.slice(blockEnd)}`

  if (next === source) {
    throw new Error(
      '[trellis] Could not patch server/mcp/runtime.ts. Expected a canonical resolveAccess block.',
    )
  }

  await writeFile(path, next)
}

async function patchOperationProjectionRegistryImport(cwd: string): Promise<void> {
  const path = resolve(cwd, 'convex/functions.ts')
  const source = await readFile(path, 'utf8')
  const registryImport =
    "import { operationProjectionRegistry } from '../generated/operation-projections'"

  const withImport = source.includes(registryImport)
    ? source
    : source.replace(
        /^(import \{ defineTrellis \} from '@lupinum\/trellis\/app'\n)/m,
        `$1\n${registryImport}\n`,
      )

  if (!withImport.includes(registryImport)) {
    throw new Error(
      '[trellis] Could not patch convex/functions.ts. Expected a canonical defineTrellis import.',
    )
  }

  if (withImport.includes('operationProjections: operationProjectionRegistry')) {
    if (withImport !== source) {
      await writeFile(path, withImport)
    }
    return
  }

  const optionsObjectStart = withImport.indexOf(',\n  {\n')
  if (optionsObjectStart === -1) {
    throw new Error(
      '[trellis] Could not patch convex/functions.ts. Expected a canonical defineTrellis options object.',
    )
  }

  const insertAt = optionsObjectStart + ',\n  {\n'.length
  const next = `${withImport.slice(0, insertAt)}    operationProjections: operationProjectionRegistry,\n${withImport.slice(insertAt)}`
  await writeFile(path, next)
}

async function refreshOperationProjectionRegistry(cwd: string): Promise<string> {
  const registry = buildOperationRegistry(extractPublicSurfaceCodegenMetadata(cwd))
  const rendered = renderOperationRegistryGeneratedFiles(registry, {
    operationProjectionsPath: 'generated/operation-projections.ts',
  })
  const projections = rendered.find((file) => file.path === 'generated/operation-projections.ts')
  if (!projections) {
    throw new Error('[trellis] Operation projection registry generation did not emit a root file.')
  }

  await mkdir(resolve(cwd, 'generated'), { recursive: true })
  await writeFile(resolve(cwd, projections.path), projections.content, 'utf8')
  return projections.path
}

export async function buildResourceTemplateSet(
  cwd: string,
  resourceName: string,
): Promise<InitTemplateSet> {
  const ctx = await inferResourceContext(cwd, resourceName)
  const files: TemplateFile[] = [
    {
      path: `shared/features/${ctx.tableName}/contract.ts`,
      content: resourceContractTemplate(ctx),
      ownership: 'authored',
    },
    {
      path: `convex/features/${ctx.tableName}/schema.ts`,
      content: resourceSchemaTemplate(ctx),
      ownership: 'authored',
    },
    {
      path: `convex/features/${ctx.tableName}/permissions.ts`,
      content: resourcePermissionsTemplate(ctx),
      ownership: 'authored',
    },
    {
      path: `convex/features/${ctx.tableName}/domain.ts`,
      content: resourceDomainTemplate(ctx),
      ownership: 'authored',
    },
    {
      path: `convex/features/${ctx.tableName}/feature.ts`,
      content: resourceFeatureTemplate(ctx),
      ownership: 'authored',
    },
    {
      path: `convex/features/${ctx.tableName}/index.ts`,
      content: resourceIndexTemplate(ctx),
      ownership: 'authored',
    },
    {
      path: `convex/features/${ctx.tableName}/tests.test.ts`,
      content: resourceTestTemplate(ctx),
      ownership: 'authored',
    },
  ]

  if (ctx.hasMcp) {
    files.push(
      {
        path: `shared/features/${ctx.tableName}/permissions.ts`,
        content: resourceSharedPermissionsTemplate(ctx),
        ownership: 'authored',
      },
      {
        path: `shared/features/${ctx.tableName}/operations.ts`,
        content: resourceOperationDescriptorTemplate(ctx),
        ownership: 'authored',
      },
      {
        path: `convex/features/${ctx.tableName}/operations.ts`,
        content: resourceOperationTemplate(ctx),
        ownership: 'authored',
      },
      {
        path: `server/mcp/tools/list-${ctx.fileStem}.ts`,
        content: resourceMcpListTemplate(ctx),
        ownership: 'authored',
      },
      {
        path: `server/mcp/tools/create-${ctx.fileStem}.ts`,
        content: resourceMcpCreateTemplate(ctx),
        ownership: 'authored',
      },
      {
        path: `server/mcp/tools/delete-${ctx.fileStem}.ts`,
        content: resourceMcpDeleteTemplate(ctx),
        ownership: 'authored',
      },
    )
  }

  return {
    label: `add:entity:${ctx.fileStem}`,
    description: `Add a canonical ${ctx.singularCamel} entity slice`,
    files,
    afterWrite: async (targetCwd) => {
      await patchSchema(targetCwd, ctx)
      await patchFeatureManifest(targetCwd, ctx)
      await patchMcpRuntime(targetCwd, ctx)
      if (ctx.hasMcp) {
        await patchOperationProjectionRegistryImport(targetCwd)
        return {
          generated: [await refreshOperationProjectionRegistry(targetCwd)],
        }
      }
      return {}
    },
  }
}
