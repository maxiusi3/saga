#!/usr/bin/env node

const fs = require('node:fs')
const path = require('node:path')

const envFile = process.argv[2]

if (!envFile) {
  console.error('Usage: sanitize-env-file.js <env-file>')
  process.exit(1)
}

const resolved = path.resolve(process.cwd(), envFile)

if (!fs.existsSync(resolved)) {
  console.log(`Vercel env file not found: ${envFile}`)
  process.exit(0)
}

const original = fs.readFileSync(resolved, 'utf8')
const lines = original.split(/\r?\n/)
const filtered = lines.filter((line) => !/^\s*PATH\s*=/.test(line))

if (filtered.length !== lines.length) {
  fs.writeFileSync(resolved, filtered.join('\n'), 'utf8')
  console.log('Removed PATH from Vercel env file')
} else {
  console.log('No PATH entry found in Vercel env file')
}
