import { createServer } from 'node:http'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { mkdir, writeFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { root } from '../pg17-routines/runtime.mjs'
import { compileModule } from '../g1-local/compile-module.mjs'
import { databaseHttp } from '../recording-flow-browser/database-http.mjs'
const require = createRequire(import.meta.url), { chromium, expect } = require('@playwright/test'), { NextRequest } = require('next/server')

export async function pilotChrome({ h, source, evidence }) {
  const proof = join(evidence, 'chrome-pilot'); await mkdir(proof, { recursive: true })
  const db = await databaseHttp(h, { allowedFunctions: ['record_pilot_observation', 'read_pilot_cohort', 'read_pilot_history'] })
  const prior = { MEDIA_ASSETS_ENABLED: process.env.MEDIA_ASSETS_ENABLED, ADMIN_CRON_SECRET: process.env.ADMIN_CRON_SECRET }
  const secret = 'synthetic-g4-local-admin'; process.env.MEDIA_ASSETS_ENABLED = 'true'; process.env.ADMIN_CRON_SECRET = secret
  globalThis.__g4Admin = db.admin
  const seam = join(h.scratch, 'g4-seam.cjs'); await writeFile(seam, 'exports.getSupabaseAdmin=()=>globalThis.__g4Admin')
  const compiled = join(h.scratch, 'g4-compiled'), seams = { '@/lib/supabase': seam }
  const ledger = await compileModule('app/api/admin/pilot-ledger/route.ts', compiled, source, seams)
  const analytics = await compileModule('app/api/admin/pilot-analytics/route.ts', compiled, source, seams)
  const report = { status: 'running', browser: null, requests: [], errors: [], checks: [], boundary: 'Installed Chrome opens actual static report route; actual admin POST/GET routes and Supabase SDK to native PG17.4. Synthetic authentication transport and synthetic observations with January dates; no elapsed real household study or settled payment.' }
  h.report.pilotChrome = report
  const server = createServer(async (req, res) => {
    try {
      if (req.url === '/favicon.ico') { res.writeHead(204); res.end(); return }
      const chunks = []; for await (const chunk of req) chunks.push(chunk)
      const request = new NextRequest('http://localhost' + req.url, { method: req.method, headers: req.headers, ...(req.method === 'POST' ? { body: Buffer.concat(chunks) } : {}) })
      const handler = req.url.startsWith('/api/admin/pilot-ledger') ? ledger : analytics
      const response = await handler[req.method](request)
      report.requests.push({ path: req.url, method: req.method, status: response.status })
      response.headers.forEach((v, k) => res.setHeader(k, v)); res.writeHead(response.status); res.end(Buffer.from(await response.arrayBuffer()))
    } catch (error) { report.errors.push(error.message); res.writeHead(500); res.end('Local route error') }
  })
  let browser
  try {
    await new Promise(done => server.listen(0, '127.0.0.1', done)); const origin = `http://127.0.0.1:${server.address().port}`
    browser = await chromium.launch({ channel: 'chrome', headless: true }); report.browser = browser.version()
    const context = await browser.newContext({ viewport: { width: 1280, height: 960 }, extraHTTPHeaders: { 'x-cron-secret': secret } }), page = await context.newPage()
    page.on('pageerror', error => report.errors.push(error.message))
    const url = '/api/admin/pilot-analytics?cohort=chrome-g4&kind=synthetic'
    await page.goto(origin + url + '&format=html'); await expect(page.getByText('合成演练数据', { exact: false })).toBeVisible(); await expect(page.getByText('暂无样本').first()).toBeVisible()
    await page.screenshot({ path: join(proof, 'empty-cohort.png'), fullPage: true })
    const owner = randomUUID(); await h.db.query('INSERT INTO auth.users(id,email) VALUES($1,$2)', [owner, 'g4-chrome@example.invalid'])
    const samples = []
    for (let i = 0; i < 20; i++) {
      const project = randomUUID(); await h.db.query('INSERT INTO projects(id,name,facilitator_id) VALUES($1,$2,$3)', [project, 'Synthetic G4 household ' + i, owner])
      const values = { materialEntryMode: i % 2 ? 'existing_audio' : 'new_recording', pricingTier: 'paid_59', supportMode: i % 2 ? 'self_serve' : 'family_assisted', acquisitionChannel: 'direct_invite', country: 'US', productVersion: 'g4', enrolledAt: '2026-01-01T00:00:00Z', inviteSentAt: '2026-01-01T00:00:00Z', inviteAcceptedAt: '2026-01-02T00:00:00Z', consentedAt: '2026-01-02T00:00:00Z', firstRecordingSavedAt: '2026-01-03T00:00:00Z', firstApprovedDownloadAt: '2026-01-05T00:00:00Z', projectCompletedAt: '2026-01-20T00:00:00Z', deliveredAt: '2026-01-20T00:00:00Z', replayedWithin14dAt: '2026-01-21T00:00:00Z', familyRevisionMinutes: 8, familyRevisionStoryMinutes: [8], opsSupportMinutes: 20, opsHourlyRateCents: 3000, paidAmountCents: 5900, refundedAmountCents: 0, paymentFeeCents: 200, aiAndStorageCostCents: 250, acquisitionCostCents: 200, fulfillmentCostCents: 100, hostingReserveCents: 150, fixedCostAllocationCents: 500, qualityReviewed: true, quality: { reviewedClaims: 100, incorrectClaims: 0, invalidSourceClaims: 0, seededErrors: 10, detectedSeededErrors: 10, negativeClaims: 10, falsePositiveClaims: 0, unresolvedSevereErrors: 0 }, npsScore: 9, wouldRecommend: true, referralsCount: 1, severeDataIncidents: 0 }
      const metadata = new Set(['materialEntryMode', 'pricingTier', 'supportMode', 'acquisitionChannel', 'country', 'productVersion', 'enrolledAt'])
      const evidence = Object.fromEntries(['enrollment', ...Object.keys(values).filter(k => !metadata.has(k))].map(k => [k, { source: 'synthetic_fixture', reference: `fixture:${i}/${k}` }]))
      const cmd = { action: 'record', requestId: randomUUID(), expectedRevision: 0, householdId: randomUUID(), householdKey: randomUUID(), projectId: project, cohortKey: 'chrome-g4', cohortType: 'longitudinal_pilot', observationKind: 'synthetic', recordedBy: 'ops-fixture', reason: 'initial_observation', values, evidence }
      const response = await context.request.post(origin + '/api/admin/pilot-ledger', { data: cmd }); h.eq(response.status(), 200, 'actual POST persists a fully evidenced synthetic household'); samples.push(cmd)
    }
    h.eq((await context.request.post(origin + '/api/admin/pilot-ledger', { data: samples[0] })).status(), 200, 'route retry idempotent')
    h.eq((await context.request.post(origin + '/api/admin/pilot-ledger', { data: { ...samples[0], reason: 'conflicting_retry' } })).status(), 409, 'route conflicting retry rejected')
    h.eq((await context.request.post(origin + '/api/admin/pilot-ledger', { data: { ...samples[0], requestId: randomUUID(), observationKind: 'observed' } })).status(), 400, 'synthetic provenance cannot be relabelled observed')
    const close = { action: 'close_cohort', requestId: randomUUID(), cohortKey: 'chrome-g4', observationKind: 'synthetic', recordedBy: 'ops-fixture', reason: 'recruitment_complete' }
    h.eq((await context.request.post(origin + '/api/admin/pilot-ledger', { data: close })).status(), 200, 'actual route closes roster')
    const result = await (await context.request.get(origin + url)).json(); await writeFile(join(proof, 'synthetic-report.json'), JSON.stringify(result, null, 2))
    h.eq(result.g4GateReady, false, 'synthetic study never passes real G4'); h.eq(result.simulationReady, true, 'fully evidenced synthetic scenario is evaluable'); h.eq(result.firstOutcomeWithin7d.denominator, 20, 'full enrolled denominator'); h.eq(result.recommendation.code, 'expand_channel', 'synthetic high-quality example exercises qualified recommendation only')
    await source('scripts/pilot-cohort.mjs')
    const cli = await promisify(execFile)(process.execPath, ['scripts/pilot-cohort.mjs', 'report', 'chrome-g4', join(proof, 'cli-report.html')], { cwd: root, env: { ...process.env, ADMIN_CRON_SECRET: secret, PILOT_ADMIN_ORIGIN: origin, PILOT_OBSERVATION_KIND: 'synthetic' }, timeout: 30000 })
    h.ok(cli.stdout.includes('Saved pilot report') && !cli.stdout.includes(secret), 'actual operator CLI saves report without emitting credential')
    await page.goto(origin + url + '&format=html'); await expect(page.getByText('分析条件满足', { exact: true })).toBeVisible(); await expect(page.getByRole('table')).toBeVisible(); await page.screenshot({ path: join(proof, 'synthetic-mature-report.png'), fullPage: true })
    await writeFile(join(proof, 'synthetic-report.html'), await page.content())
    await page.setViewportSize({ width: 390, height: 844 }); h.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'report fits narrow viewport with scrollable data table'); await page.screenshot({ path: join(proof, 'narrow-report.png'), fullPage: true })
    const ordinary = await browser.newContext(); h.eq((await ordinary.request.get(origin + url)).status(), 401, 'ordinary browser cannot read cross-household reports'); h.eq((await ordinary.request.post(origin + '/api/admin/pilot-ledger', { data: close })).status(), 401, 'ordinary browser cannot alter cohort'); await ordinary.close()
    const real = await (await context.request.get(origin + '/api/admin/pilot-analytics?cohort=chrome-g4&kind=observed')).json(); h.eq(real.uniqueLongitudinalHouseholds, 0, 'observed report excludes all synthetic entries'); h.eq(real.g4GateReady, false, 'empty observed batch not approved')
    // The fixture uses native inserts for volume only; reporting still traverses the real route/SDK/RPC.
    await h.db.query("INSERT INTO pilot_cohort_batches(cohort_key,observation_kind) VALUES('large-g4','synthetic')")
    const many = (await h.db.query("INSERT INTO projects(id,name,facilitator_id) SELECT gen_random_uuid(),'Synthetic volume row',$1 FROM generate_series(1,1001) RETURNING id", [owner])).rows
    for (const { id: project } of many) {
      const entry = randomUUID()
      await h.db.query("INSERT INTO pilot_cohort_entries VALUES($1,$2,$3,'large-g4','synthetic','longitudinal_pilot',1)", [entry, project, randomUUID()])
      await h.db.query("INSERT INTO pilot_observation_revisions(household_id,revision,recorded_by,reason,values,evidence) VALUES($1,1,'ops-fixture','volume_fixture',$2,$3)", [entry, JSON.stringify({ pricingTier: 'free', supportMode: 'self_serve', acquisitionChannel: 'test', country: 'US', productVersion: 'g4', enrolledAt: '2026-01-01T00:00:00Z' }), JSON.stringify({ enrollment: { source: 'synthetic_fixture', reference: 'fixture:' + entry } })])
    }
    const largeResponse = await context.request.get(origin + '/api/admin/pilot-analytics?cohort=large-g4&kind=synthetic'); h.eq(largeResponse.status(), 200, 'large full ledger is readable')
    const large = await largeResponse.json(); h.eq(large.uniqueLongitudinalHouseholds, 1001, 'single snapshot RPC includes every row beyond usual 1000-row table cap'); h.eq(large.firstOutcomeWithin7d.denominator, 1001, 'large cohort denominator is complete')
    const before = await (await context.request.get(origin + '/api/admin/pilot-ledger?householdId=' + samples[0].householdId)).json(); h.eq(before.revisions.length, 1, 'operator can audit persisted revision')
    await h.db.query('DELETE FROM projects WHERE id=$1', [samples[0].projectId])
    const after = await (await context.request.get(origin + url)).json(); h.eq(after.erasedHouseholds, 1, 'actual API discloses erased sample loss'); h.eq(after.simulationReady, false, 'erasure prevents survivor-only pass')
    h.eq(report.errors, [], 'no Chrome or route exceptions'); report.checks = ['actual admin write/read', '20 complete synthetic observations', 'idempotency/conflicts', 'separate observed report', 'static HTML desktop/narrow', 'access control', 'erasure gating']; report.status = 'passed'
  } finally {
    await writeFile(join(proof, 'browser-results.json'), JSON.stringify(report, null, 2)); await writeFile(join(proof, 'transport.json'), JSON.stringify(db.requests, null, 2))
    await browser?.close(); server.closeAllConnections(); await new Promise(done => server.close(done)); await db.close(); delete globalThis.__g4Admin
    for (const [name, value] of Object.entries(prior)) { if (value === undefined) delete process.env[name]; else process.env[name] = value }
  }
}
