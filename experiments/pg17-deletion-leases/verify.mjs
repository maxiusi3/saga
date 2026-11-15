import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join, posix } from 'node:path'
import { randomUUID } from 'node:crypto'
import { Harness, root, digest } from '../pg17-routines/runtime.mjs'
import { compileModules } from '../pg17-recording-worker/fixture.mjs'
import { setup, fresh, capture, materialize, lease, USER } from './fixture.mjs'
import { snapshot as captureSnapshot } from '../pg17-deletion-capture/fixture.mjs'
import { scenarios, replay, step } from './scenarios.mjs'
const red = process.argv.includes('--without-migration')
const directory = join(root, 'docs/research/evidence/2026-11-06-g1-deletion-leases', `native-${red ? 'red-' : ''}${Date.now()}-${randomUUID()}`)
const report = { status: 'running', assertions: 0, actorConnections: [], scenarios: [], sources: {}, command: `node experiments/pg17-deletion-leases/verify.mjs ${process.argv.slice(2).join(' ')}`.trim(), g1MilestoneSatisfied: false, canDeleteStorage: false, physicalDeletionComplete: false }
const h = new Harness(report)
await mkdir(directory, { recursive: true })
async function source(path) { const bytes = await readFile(join(root, path)); report.sources[path] = digest(bytes); return bytes.toString() }
async function graph(path, seen = new Set()) {
  if (seen.has(path)) return
  seen.add(path)
  const text = await source(path)
  for (const [, dependency] of text.matchAll(/(?:from\s*|import\s*\()['"]([^'"]+\.mjs)['"]/g)) {
    if (dependency.startsWith('.')) await graph(posix.normalize(posix.join(posix.dirname(path), dependency)), seen)
  }
}
try {
  await graph('experiments/pg17-deletion-leases/verify.mjs')
  await h.start(); await setup(h, source, !red)
  const service = await h.actorClient('service_role', USER), { prepareRecordingSessionSeal: prepare } = await compileModules(h, source)
  await h.scenario('actual capture permits durable claim without granting physical deletion', async () => {
    const f = await fresh(h, service, prepare)
    await materialize(h, f)
    report.beforeFirstCapture = await captureSnapshot(h)
    f.args = { subjectId: f.storyId, requestId: randomUUID() }
    f.capture = await capture(service, f.args); f.requestId = f.capture.id
    report.firstCapture = { receipt: f.capture, rows: await captureSnapshot(h) }
    if (!red) await replay(h, service, f)
    const claimed = red ? await lease(service, f.requestId, 'claim', 'worker-1', null, 120000)
      : await step(h, service, f, 'claim', 'worker-1', null, 120000)
    report.firstClaim = claimed
    h.eq([claimed.state, claimed.attempt, claimed.canDeleteStorage, claimed.physicalDeletionComplete], ['leased', 1, false, false], 'claim is coordination only')
    if (!red) await replay(h, service, f)
  })
  await scenarios(h, service, prepare, source)
  report.status = 'passed'
} catch (error) {
  report.status = 'failed'; report.error = { code: error.code ?? 'ERROR', label: error.label ?? error.message, position: error.position, where: error.where, internalQuery: error.internalQuery }; process.exitCode = 1
} finally {
  await h.cleanup(); if (report.status !== 'passed') process.exitCode = 1
  await writeFile(join(directory, 'results.json'), JSON.stringify(report, null, 2))
  console.log(JSON.stringify({ directory, status: report.status, assertions: report.assertions, error: report.error, cleanup: report.cleanup }, null, 2))
}
