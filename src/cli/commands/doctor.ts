import { resolve } from 'node:path'

import { spinner } from '@clack/prompts'
import { defineCommand } from 'citty'
import consola from 'consola'

import { buildDoctorReport } from '../lib/doctor-report.js'
import { exitCodeForFindings } from '../lib/findings.js'
import { renderDoctorReport } from '../lib/output.js'

export const doctorCommand = defineCommand({
  meta: {
    name: 'doctor',
    description: 'Run static diagnostics for @lupinum/trellis setup issues',
  },
  args: {
    cwd: {
      type: 'string',
      description: 'Path to the Nuxt app to inspect',
      valueHint: 'path',
    },
    json: {
      type: 'boolean',
      description: 'Print the report as JSON',
      default: false,
    },
    verbose: {
      type: 'boolean',
      alias: 'v',
      description: 'Print debug details while inspecting the app',
      default: false,
    },
    color: {
      type: 'boolean',
      description: 'Enable colored output',
      default: true,
    },
    production: {
      type: 'boolean',
      description: 'Treat deploy-time safety warnings as failures',
      default: false,
    },
  },
  async run({ args }) {
    const cwd = resolve(args.cwd || process.cwd())
    const useJson = Boolean(args.json)
    const color = Boolean(args.color)
    const logger = args.verbose ? consola.withTag('doctor') : null
    const loadingSpinner = !useJson ? spinner() : null

    if (!color) {
      process.env.NO_COLOR = '1'
    }

    logger?.debug(`Inspecting ${cwd}`)
    loadingSpinner?.start(`Running static diagnostics for ${cwd}`)

    const report = await buildDoctorReport(cwd, { production: Boolean(args.production) })

    loadingSpinner?.stop('Static diagnostics complete')
    logger?.debug(`Found ${report.summary.fail} failures and ${report.summary.warn} warnings`)

    renderDoctorReport(report, {
      json: useJson,
      color,
    })

    const exitCode = exitCodeForFindings(report.summary)
    process.exitCode = exitCode
    return exitCode
  },
})
