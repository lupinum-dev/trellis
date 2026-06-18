export interface OperationHandleBindingInput {
  exportName: string
  operationId: string
  operationName?: string
  operationKind?: 'safe' | 'destructive'
  descriptorName: string
  executeRefName: string
  previewRefName?: string
  executeOperation?: 'query' | 'mutation' | 'action'
  previewOperation?: 'query' | 'mutation' | 'action'
  projection?: 'default-app' | 'internal' | 'service' | 'bridge' | 'component'
  runtimes?: readonly ('client' | 'server' | 'mcp' | 'testing' | 'internal')[]
}

export interface OperationHandleImportInput {
  from: string
  names: readonly string[]
}

export interface OperationHandlesModuleInput {
  defineOperationHandleImport: string
  operationDescriptorTypeImport?: string
  descriptorImport?: string
  descriptorImports?: readonly OperationHandleImportInput[]
  descriptorMode?: 'runtime-import' | 'generated-metadata'
  refsImport: string
  descriptors: readonly string[]
  refs: readonly string[]
  handles: readonly OperationHandleBindingInput[]
}

function renderImport(names: readonly string[], from: string): string {
  const singleLineImport = `import { ${names.join(', ')} } from '${from}'`
  if (singleLineImport.length <= 100) return singleLineImport

  return [`import {`, ...names.map((name) => `  ${name},`), `} from '${from}'`].join('\n')
}

function toCamelCase(segment: string): string {
  return segment
    .split(/[^a-zA-Z0-9]+/u)
    .filter(Boolean)
    .map((part, index) => {
      const lower = part.toLowerCase()
      if (index === 0) return lower
      return `${lower.slice(0, 1).toUpperCase()}${lower.slice(1)}`
    })
    .join('')
}

function toOperationPath(operationId: string): string[] {
  const segments = operationId.split('.').map(toCamelCase).filter(Boolean)
  if (segments.length === 0) {
    throw new Error(`Operation handle id "${operationId}" does not produce a valid object path.`)
  }
  return segments
}

function setNestedPath(
  root: Map<string, unknown>,
  path: readonly string[],
  exportName: string,
  operationId: string,
): void {
  let current = root
  for (const [index, segment] of path.entries()) {
    const isLeaf = index === path.length - 1
    const existing = current.get(segment)
    if (isLeaf) {
      if (existing !== undefined) {
        throw new Error(
          `Operation handle path collision for "${operationId}" at "${path.join('.')}".`,
        )
      }
      current.set(segment, exportName)
      return
    }

    if (existing === undefined) {
      const next = new Map<string, unknown>()
      current.set(segment, next)
      current = next
      continue
    }

    if (!(existing instanceof Map)) {
      throw new TypeError(
        `Operation handle path collision for "${operationId}" at "${path.join('.')}".`,
      )
    }
    current = existing
  }
}

function renderNestedObject(value: Map<string, unknown> | string, indent = 2): string {
  if (typeof value === 'string') return value
  const padding = ' '.repeat(indent)
  const childPadding = ' '.repeat(indent + 2)
  const entries = [...value.entries()].sort(([left], [right]) => left.localeCompare(right))
  return [
    '{',
    ...entries.map(([key, child]) => {
      return `${childPadding}${renderPropertyKey(key)}: ${renderNestedObject(child as Map<string, unknown> | string, indent + 2)},`
    }),
    `${padding}}`,
  ].join('\n')
}

function renderPropertyKey(key: string): string {
  return /^[A-Za-z_$][\w$]*$/u.test(key) ? key : `'${key.replaceAll("'", "\\'")}'`
}

function renderStringLiteral(value: string): string {
  return `'${value.replaceAll("'", "\\'")}'`
}

function metadataDescriptorName(handle: OperationHandleBindingInput): string {
  return `__${handle.exportName}Descriptor`
}

function renderMetadataDescriptor(
  handle: OperationHandleBindingInput,
  operationDescriptorTypeImport: string,
): string[] {
  if (!handle.operationKind) {
    throw new Error(
      `Operation handle "${handle.exportName}" requires operationKind for generated metadata descriptors.`,
    )
  }

  const lines = [
    `const ${metadataDescriptorName(handle)} = {`,
    `  _type: 'operation-descriptor',`,
    `  id: ${renderStringLiteral(handle.operationId)},`,
  ]

  if (handle.operationName) {
    lines.push(`  name: ${renderStringLiteral(handle.operationName)},`)
  }

  lines.push(
    `  kind: '${handle.operationKind}',`,
    `  args: {},`,
    `} as unknown as import('${operationDescriptorTypeImport}').OperationDescriptor<${renderStringLiteral(handle.operationId)}>`,
  )

  return lines
}

function renderHandle(handle: OperationHandleBindingInput): string[] {
  const lines = [
    `export const ${handle.exportName} = defineOperationHandle(${metadataDescriptorName(handle)}, {`,
    `  executeRef: ${handle.executeRefName},`,
  ]

  if (handle.previewRefName) {
    lines.push(`  previewRef: ${handle.previewRefName},`)
  }

  if (handle.executeOperation) {
    lines.push(`  executeOperation: '${handle.executeOperation}',`)
  }

  if (handle.previewOperation) {
    lines.push(`  previewOperation: '${handle.previewOperation}',`)
  }

  if (handle.projection && handle.projection !== 'default-app') {
    lines.push(`  projection: '${handle.projection}',`)
  }

  if (handle.runtimes && handle.runtimes.length > 0) {
    lines.push(`  runtimes: [${handle.runtimes.map((runtime) => `'${runtime}'`).join(', ')}],`)
  }

  lines.push('})')
  return lines
}

function renderRuntimeImportHandle(handle: OperationHandleBindingInput): string[] {
  const lines = [
    `export const ${handle.exportName} = defineOperationHandle(${handle.descriptorName}, {`,
    `  executeRef: ${handle.executeRefName},`,
  ]

  if (handle.previewRefName) {
    lines.push(`  previewRef: ${handle.previewRefName},`)
  }

  if (handle.executeOperation) {
    lines.push(`  executeOperation: '${handle.executeOperation}',`)
  }

  if (handle.previewOperation) {
    lines.push(`  previewOperation: '${handle.previewOperation}',`)
  }

  if (handle.projection && handle.projection !== 'default-app') {
    lines.push(`  projection: '${handle.projection}',`)
  }

  if (handle.runtimes && handle.runtimes.length > 0) {
    lines.push(`  runtimes: [${handle.runtimes.map((runtime) => `'${runtime}'`).join(', ')}],`)
  }

  lines.push('})')
  return lines
}

export function renderOperationHandlesModule(input: OperationHandlesModuleInput): string {
  const usesGeneratedMetadata = input.descriptorMode === 'generated-metadata'

  if (
    !usesGeneratedMetadata &&
    input.descriptors.length === 0 &&
    (!input.descriptorImports || input.descriptorImports.length === 0)
  ) {
    throw new Error('Operation handles module requires at least one descriptor import')
  }

  if (
    !usesGeneratedMetadata &&
    input.descriptors.length > 0 &&
    input.descriptorImport === undefined &&
    (!input.descriptorImports || input.descriptorImports.length === 0)
  ) {
    throw new Error('Operation handles module requires descriptorImport or descriptorImports')
  }

  if (input.refs.length === 0) {
    throw new Error('Operation handles module requires at least one ref import')
  }

  if (input.handles.length === 0) {
    throw new Error('Operation handles module requires at least one handle')
  }

  const ergonomicRoot = new Map<string, unknown>()
  for (const handle of input.handles) {
    setNestedPath(
      ergonomicRoot,
      toOperationPath(handle.operationId),
      handle.exportName,
      handle.operationId,
    )
  }

  const byIdLines = input.handles
    .slice()
    .sort((left, right) => left.operationId.localeCompare(right.operationId))
    .map((handle) => `    ${renderPropertyKey(handle.operationId)}: ${handle.exportName},`)

  const lines = [
    '// AUTO-GENERATED. Do not edit.',
    renderImport(['defineOperationHandle'], input.defineOperationHandleImport),
    '',
  ]

  if (!usesGeneratedMetadata && input.descriptorImports && input.descriptorImports.length > 0) {
    for (const descriptorImport of input.descriptorImports) {
      lines.push(renderImport(descriptorImport.names, descriptorImport.from))
    }
  } else if (!usesGeneratedMetadata && input.descriptorImport) {
    lines.push(renderImport(input.descriptors, input.descriptorImport))
  }

  lines.push(renderImport(input.refs, input.refsImport), '')

  input.handles.forEach((handle, index) => {
    if (input.descriptorMode === 'generated-metadata') {
      lines.push(
        ...renderMetadataDescriptor(
          handle,
          input.operationDescriptorTypeImport ?? '@lupinum/trellis/backend',
        ),
      )
      lines.push('')
      lines.push(...renderHandle(handle))
    } else {
      lines.push(...renderRuntimeImportHandle(handle))
    }
    if (index < input.handles.length - 1) lines.push('')
  })

  lines.push(
    '',
    'export const operations = {',
    '  byId: {',
    ...byIdLines,
    '  },',
    `  ...${renderNestedObject(ergonomicRoot, 2)},`,
    '} as const',
    '',
  )

  return lines.join('\n')
}
