import {
  renderGeneratedConvexFunctionRef,
  renderRefModule,
  type RefBindingInput,
} from './ref-codegen.js'

export type OperationRefProjection = 'execute' | 'preview'

export interface OperationRefBindingInput extends RefBindingInput {
  projection: OperationRefProjection
}

export interface OperationRefsModuleInput {
  projectOperationRefImport: string
  apiImport: string
  descriptorImport: string
  descriptors: readonly string[]
  refs: readonly OperationRefBindingInput[]
}

export function renderConvexFunctionRef(path: readonly string[]): string {
  return renderGeneratedConvexFunctionRef(path, 'Operation ref')
}

export function renderOperationRefsModule(input: OperationRefsModuleInput): string {
  return renderRefModule({
    helperImportName: 'projectOperationRef',
    helperImportFrom: input.projectOperationRefImport,
    apiImport: input.apiImport,
    descriptorImport: input.descriptorImport,
    descriptors: input.descriptors,
    refs: input.refs,
    emptyDescriptorsMessage: 'Operation refs module requires at least one descriptor import',
    emptyRefsMessage: 'Operation refs module requires at least one ref binding',
    apiPathLabel: 'Operation ref',
    renderBinding: (ref, apiPathExpression) => [
      `export const ${ref.exportName} = projectOperationRef(`,
      `  ${ref.descriptorName},`,
      `  '${ref.projection}',`,
      `  ${apiPathExpression},`,
      `  { functionRef: '${renderConvexFunctionRef(ref.apiPath)}' },`,
      ')',
    ],
  })
}
