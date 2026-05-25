import { renderRefModule, type RefBindingInput } from './ref-codegen.js'

export type McpToolRefBindingInput = RefBindingInput

export interface McpToolRefsModuleInput {
  projectMcpToolRefImport: string
  apiImport: string
  descriptorImport: string
  descriptors: readonly string[]
  refs: readonly McpToolRefBindingInput[]
}

export function renderMcpToolRefsModule(input: McpToolRefsModuleInput): string {
  return renderRefModule({
    helperImportName: 'projectMcpToolRef',
    helperImportFrom: input.projectMcpToolRefImport,
    apiImport: input.apiImport,
    descriptorImport: input.descriptorImport,
    descriptors: input.descriptors,
    refs: input.refs,
    emptyDescriptorsMessage: 'MCP tool refs module requires at least one descriptor import',
    emptyRefsMessage: 'MCP tool refs module requires at least one ref binding',
    apiPathLabel: 'MCP tool ref',
    renderBinding: (ref, apiPathExpression) => [
      `export const ${ref.exportName} = projectMcpToolRef(`,
      `  ${ref.descriptorName},`,
      `  ${apiPathExpression},`,
      ')',
    ],
  })
}
