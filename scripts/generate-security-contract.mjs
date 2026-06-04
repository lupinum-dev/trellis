import { writeFileSync } from 'node:fs'

import {
  collectSecurityContract,
  contractPath,
  readCurrentSecurityContract,
  stableSecurityContractString,
} from './lib/security-contract.mjs'

const repoRoot = process.cwd()
const check = process.argv.includes('--check')
const next = stableSecurityContractString(collectSecurityContract(repoRoot))
const filePath = contractPath(repoRoot)

if (check) {
  const current = readCurrentSecurityContract(repoRoot)
  if (current !== next) {
    throw new Error(
      `[trellis] security contract drift detected. Run pnpm run security:contract and review security-contract.generated.json.`,
    )
  }
  console.log('[trellis] security contract is up to date')
} else {
  writeFileSync(filePath, next)
  console.log('[trellis] wrote security-contract.generated.json')
}
