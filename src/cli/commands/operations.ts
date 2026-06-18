import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'

import { defineCommand } from 'citty'

import type { OperationHandleBindingInput } from '../../module-internals/operation-handle-codegen.js'
import {
  buildOperationRegistry,
  renderOperationRegistryGeneratedFiles,
  type OperationRegistryGeneratedFile,
} from '../../module-internals/operation-registry-codegen.js'
import {
  extractPublicSurfaceCodegenMetadata,
  type PublicSurfaceCodegenOptions,
  type PublicSurfaceProjectionRoot,
} from '../../module-internals/public-surface-codegen.js'

type CommandArgs = Record<string, unknown>
type FunctionKind = PublicSurfaceProjectionRoot['functionKind']

interface OperationGenerateReport {
  status: 'ok' | 'out-of-date'
  command: 'operations generate'
  mode: 'write' | 'check'
  cwd: string
  written: string[]
  outOfDate: string[]
  operations: number
  projections: number
  files: string[]
}

const functionKinds = new Set<FunctionKind>(['query', 'mutation', 'action'])
const operationRuntimes = new Set<NonNullable<OperationHandleBindingInput['runtimes']>[number]>([
  'client',
  'server',
  'mcp',
  'testing',
  'internal',
])

function readStringArg(args: CommandArgs, name: string): string | undefined {
  const value = args[name]
  if (Array.isArray(value)) return value.map(String).join(',')
  if (value === undefined || value === null || value === false) return undefined
  return String(value)
}

function requireStringArg(args: CommandArgs, name: string): string {
  const value = readStringArg(args, name)?.trim()
  if (!value) {
    throw new Error(`Missing required --${name}.`)
  }
  return value
}

function readStringListArg(
  args: CommandArgs,
  name: string,
  fallback: readonly string[] = [],
): string[] {
  const value = readStringArg(args, name)
  if (!value) return [...fallback]
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
}

function parseProjectionRoot(input: string): PublicSurfaceProjectionRoot {
  const [name, rawFunctionKind, previewMarker] = input.split(':')
  if (!name || !rawFunctionKind || !functionKinds.has(rawFunctionKind as FunctionKind)) {
    throw new Error(
      `Invalid --projection-root "${input}". Use name:query|mutation|action or name:query|mutation|action:preview.`,
    )
  }
  if (previewMarker !== undefined && previewMarker !== 'preview') {
    throw new Error(
      `Invalid --projection-root "${input}". The optional third segment must be "preview".`,
    )
  }

  return {
    name,
    functionKind: rawFunctionKind as FunctionKind,
    ...(previewMarker === 'preview' ? { supportsPreview: true } : {}),
  }
}

function readRuntimes(args: CommandArgs): OperationHandleBindingInput['runtimes'] {
  const runtimes = readStringListArg(args, 'runtime')
  for (const runtime of runtimes) {
    if (
      !operationRuntimes.has(
        runtime as NonNullable<OperationHandleBindingInput['runtimes']>[number],
      )
    ) {
      throw new Error(
        `Invalid --runtime "${runtime}". Use one of: client, server, mcp, testing, internal.`,
      )
    }
  }
  return runtimes as OperationHandleBindingInput['runtimes']
}

function readRelativeImportExtension(args: CommandArgs): '' | '.js' {
  const value = readStringArg(args, 'relative-import-extension') ?? ''
  if (value !== '' && value !== '.js') {
    throw new Error('Invalid --relative-import-extension. Use "" or ".js".')
  }
  return value
}

function readDescriptorMode(args: CommandArgs): 'runtime-import' | 'generated-metadata' {
  const value = readStringArg(args, 'descriptor-mode') ?? 'runtime-import'
  if (value !== 'runtime-import' && value !== 'generated-metadata') {
    throw new Error('Invalid --descriptor-mode. Use runtime-import or generated-metadata.')
  }
  return value
}

async function readExisting(path: string): Promise<string | null> {
  try {
    return await readFile(path, 'utf8')
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      return null
    }
    throw error
  }
}

async function writeGeneratedFiles(
  cwd: string,
  files: readonly OperationRegistryGeneratedFile[],
  check: boolean,
): Promise<{ written: string[]; outOfDate: string[] }> {
  const written: string[] = []
  const outOfDate: string[] = []

  for (const file of files) {
    const absolutePath = resolve(cwd, file.path)
    const existing = await readExisting(absolutePath)
    if (existing === file.content) continue

    outOfDate.push(file.path)
    if (check) continue

    await mkdir(dirname(absolutePath), { recursive: true })
    await writeFile(absolutePath, file.content, 'utf8')
    written.push(file.path)
  }

  return { written, outOfDate: check ? outOfDate : [] }
}

function renderHumanReport(report: OperationGenerateReport): void {
  const changed =
    report.mode === 'check'
      ? report.outOfDate.length === 0
        ? 'all generated operation files are current'
        : `out-of-date: ${report.outOfDate.join(', ')}`
      : report.written.length === 0
        ? 'no generated operation files changed'
        : `written: ${report.written.join(', ')}`

  process.stdout.write(
    [
      `Trellis operation registry ${report.mode}: ${report.status}`,
      `Operations: ${report.operations}`,
      `Projections: ${report.projections}`,
      changed,
    ].join('\n') + '\n',
  )
}

const operationsGenerateCommand = defineCommand({
  meta: {
    name: 'generate',
    description: 'Generate operation refs, handles, and projection registry files',
  },
  args: {
    cwd: {
      type: 'string',
      description: 'Project root to scan and write generated files into',
      valueHint: 'path',
    },
    'operation-include': {
      type: 'string',
      description: 'Comma-separated operation source globs',
    },
    'operation-exclude': {
      type: 'string',
      description: 'Comma-separated operation source exclude globs',
    },
    'projection-root': {
      type: 'string',
      description:
        'Comma-separated projection roots as name:query|mutation|action or name:query|mutation|action:preview',
    },
    'ignored-projection-root': {
      type: 'string',
      description: 'Comma-separated projection root names ignored by operation scanning',
    },
    'convex-source-root': {
      type: 'string',
      description: 'Source root used to convert projection files into Convex api paths',
      default: 'convex',
    },
    'operation-refs': {
      type: 'string',
      description: 'Output path for generated operation refs',
    },
    'operation-handles': {
      type: 'string',
      description: 'Output path for generated operation handles',
    },
    'operation-projections': {
      type: 'string',
      description: 'Optional output path for generated operation projection registry',
    },
    'project-operation-ref-import': {
      type: 'string',
      description: 'Import specifier for projectOperationRef',
    },
    'define-operation-handle-import': {
      type: 'string',
      description: 'Import specifier for defineOperationHandle',
    },
    'operation-descriptor-type-import': {
      type: 'string',
      description: 'Import specifier used for generated OperationDescriptor type references',
    },
    'operation-projection-registry-import': {
      type: 'string',
      description: 'Import specifier for OperationProjectionRegistry',
    },
    'api-import': {
      type: 'string',
      description: 'Import specifier for the generated Convex api object',
    },
    'relative-import-extension': {
      type: 'string',
      description: 'Relative import extension for concrete Node ESM output. Use .js when needed.',
      default: '',
    },
    'descriptor-mode': {
      type: 'string',
      description: 'Descriptor rendering mode: runtime-import or generated-metadata',
      default: 'runtime-import',
    },
    runtime: {
      type: 'string',
      description: 'Comma-separated operation handle runtimes',
    },
    check: {
      type: 'boolean',
      description: 'Check generated files without writing',
      default: false,
    },
    json: {
      type: 'boolean',
      description: 'Print a machine-readable JSON report',
      default: false,
    },
  },
  async run({ args }) {
    const cwd = resolve(readStringArg(args, 'cwd') || process.cwd())
    const projectionRoots = readStringListArg(args, 'projection-root').map(parseProjectionRoot)
    const publicSurfaceOptions: PublicSurfaceCodegenOptions = {
      ...(readStringArg(args, 'operation-include')
        ? { operationInclude: readStringListArg(args, 'operation-include') }
        : {}),
      ...(readStringArg(args, 'operation-exclude')
        ? { operationExclude: readStringListArg(args, 'operation-exclude') }
        : {}),
      ...(projectionRoots.length > 0 ? { projectionRoots } : {}),
      ...(readStringArg(args, 'ignored-projection-root')
        ? { ignoredProjectionRoots: readStringListArg(args, 'ignored-projection-root') }
        : {}),
    }
    const metadata = extractPublicSurfaceCodegenMetadata(cwd, publicSurfaceOptions)
    const registry = buildOperationRegistry(metadata, {
      convexSourceRoot: readStringArg(args, 'convex-source-root') ?? 'convex',
    })
    const rendered = renderOperationRegistryGeneratedFiles(registry, {
      operationRefsPath: requireStringArg(args, 'operation-refs'),
      operationHandlesPath: requireStringArg(args, 'operation-handles'),
      ...(readStringArg(args, 'operation-projections')
        ? { operationProjectionsPath: readStringArg(args, 'operation-projections') }
        : {}),
      projectOperationRefImport: requireStringArg(args, 'project-operation-ref-import'),
      defineOperationHandleImport: requireStringArg(args, 'define-operation-handle-import'),
      ...(readStringArg(args, 'operation-descriptor-type-import')
        ? { operationDescriptorTypeImport: readStringArg(args, 'operation-descriptor-type-import') }
        : {}),
      ...(readStringArg(args, 'operation-projection-registry-import')
        ? {
            operationProjectionRegistryImport: readStringArg(
              args,
              'operation-projection-registry-import',
            ),
          }
        : {}),
      apiImport: requireStringArg(args, 'api-import'),
      relativeImportExtension: readRelativeImportExtension(args),
      descriptorMode: readDescriptorMode(args),
      runtimes: readRuntimes(args),
    })
    const mode = args.check ? 'check' : 'write'
    const result = await writeGeneratedFiles(cwd, rendered, Boolean(args.check))
    const report: OperationGenerateReport = {
      status: result.outOfDate.length > 0 ? 'out-of-date' : 'ok',
      command: 'operations generate',
      mode,
      cwd,
      written: result.written,
      outOfDate: result.outOfDate,
      operations: registry.operations.length,
      projections: registry.operations.reduce(
        (count, operation) => count + 1 + (operation.preview ? 1 : 0),
        0,
      ),
      files: rendered.map((file) => file.path),
    }

    if (args.json) {
      process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)
    } else {
      renderHumanReport(report)
    }

    if (report.status === 'out-of-date') {
      process.exitCode = 1
      return 1
    }

    return 0
  },
})

export const operationsCommand = defineCommand({
  meta: {
    name: 'operations',
    description: 'Generate and check Trellis operation registry files',
  },
  subCommands: {
    generate: operationsGenerateCommand,
  },
})
