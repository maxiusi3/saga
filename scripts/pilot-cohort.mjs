#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises'

// Credentials are environment-only and are never printed, written to reports or sent to redirects.
const [action, selector, destination] = process.argv.slice(2)
try {
  if (!['record', 'report', 'history'].includes(action) || !selector) throw new Error('Usage: node scripts/pilot-cohort.mjs record input.json | report COHORT [report.json|report.html] | history HOUSEHOLD [history.json]')
  const secret = process.env.ADMIN_CRON_SECRET, origin = new URL(process.env.PILOT_ADMIN_ORIGIN || 'http://127.0.0.1:3000')
  if (!secret) throw new Error('ADMIN_CRON_SECRET is required')
  if (origin.username || origin.password || (origin.protocol !== 'https:' && !(origin.protocol === 'http:' && ['127.0.0.1', 'localhost', '[::1]'].includes(origin.hostname)))) throw new Error('Use HTTPS or a loopback development origin')
  let path, body
  if (action === 'record') { path = '/api/admin/pilot-ledger'; body = await readFile(selector, 'utf8'); JSON.parse(body) }
  else if (action === 'history') path = '/api/admin/pilot-ledger?' + new URLSearchParams({ householdId: selector })
  else path = '/api/admin/pilot-analytics?' + new URLSearchParams({ cohort: selector, kind: process.env.PILOT_OBSERVATION_KIND || 'observed', format: destination?.endsWith('.html') ? 'html' : 'json' })
  const response = await fetch(new URL(path, origin), { method: action === 'record' ? 'POST' : 'GET', headers: { 'x-cron-secret': secret, ...(body ? { 'Content-Type': 'application/json' } : {}) }, body, redirect: 'error', signal: AbortSignal.timeout(30000) })
  if (!response.ok) throw new Error(`Pilot request failed (${response.status}); inspect the input and server status`)
  const text = await response.text()
  if (destination) { await writeFile(destination, text, { mode: 0o600, flag: 'wx' }); console.log('Saved pilot report') }
  else console.log(text)
} catch (error) { console.error(error.message); process.exitCode = 1 }
