#!/usr/bin/env node

import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { runOfflineAiEvalSuite, formatAiEvalReportMarkdown } = require('../packages/shared/dist/index.js')

const jsonMode = process.argv.includes('--json')
const report = runOfflineAiEvalSuite()

if (jsonMode) {
  process.stdout.write(JSON.stringify(report, null, 2) + '\n')
} else {
  process.stdout.write(formatAiEvalReportMarkdown(report) + '\n')
}

process.exit(report.passed ? 0 : 1)
