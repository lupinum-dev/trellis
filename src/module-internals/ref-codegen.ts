export interface RefBindingInput {
  exportName: string
  descriptorName: string
  apiPath: readonly string[]
}

export interface RefModuleInput<TRef extends RefBindingInput> {
  helperImportName: string
  helperImportFrom: string
  apiImport: string
  descriptorImport: string
  descriptors: readonly string[]
  refs: readonly TRef[]
  emptyDescriptorsMessage: string
  emptyRefsMessage: string
  apiPathLabel: string
  renderBinding(ref: TRef, apiPathExpression: string): readonly string[]
}

function renderImport(names: readonly string[], from: string): string {
  return `import { ${names.join(', ')} } from '${from}'`
}

export function renderGeneratedApiPath(path: readonly string[], label: string): string {
  if (path.length === 0) {
    throw new Error(`${label} apiPath must contain at least one segment`)
  }

  return ['api', ...path].join('.')
}

export function renderGeneratedConvexFunctionRef(path: readonly string[], label: string): string {
  if (path.length < 2) {
    throw new Error(`${label} apiPath must include a module path and export name`)
  }

  const exportName = path.at(-1)
  const modulePath = path.slice(0, -1).join('/')
  return `${modulePath}:${exportName}`
}

export function renderRefModule<TRef extends RefBindingInput>(input: RefModuleInput<TRef>): string {
  if (input.descriptors.length === 0) {
    throw new Error(input.emptyDescriptorsMessage)
  }

  if (input.refs.length === 0) {
    throw new Error(input.emptyRefsMessage)
  }

  const lines = [
    renderImport([input.helperImportName], input.helperImportFrom),
    renderImport(['api'], input.apiImport),
    renderImport(input.descriptors, input.descriptorImport),
    '',
  ]

  for (const [index, ref] of input.refs.entries()) {
    lines.push(...input.renderBinding(ref, renderGeneratedApiPath(ref.apiPath, input.apiPathLabel)))
    if (index < input.refs.length - 1) lines.push('')
  }

  lines.push('')
  return lines.join('\n')
}
