import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { Harness, root, digest } from '../pg17-routines/runtime.mjs'
import { compileModules } from '../pg17-recording-worker/fixture.mjs'
import { setup, USER } from './fixture.mjs'
import { sealFenceRegressions } from './seal-fence-regressions.mjs'
const legacy = process.argv.includes('--without-seal-fence')
const directory = join(root, 'docs/research/evidence/2026-11-06-g1-deletion-capture', `native-seal-fence-${legacy ? 'red-' : ''}${Date.now()}-${randomUUID()}`)
const report = { status: 'running', assertions: 0, actorConnections: [], scenarios: [], sources: {},
  command: `node experiments/pg17-deletion-capture/verify-seal-fence.mjs ${process.argv.slice(2).join(' ')}`.trim(),
  g1MilestoneSatisfied: false, physicalDeletionComplete: false }
const h = new Harness(report)
await mkdir(directory, { recursive: true })
async function source(path) { const bytes = await readFile(join(root, path)); report.sources[path] = digest(bytes); return bytes.toString() }
try {
  for (const path of ['experiments/pg17-routines/runtime.mjs', 'experiments/pg17-deletion-capture/fixture.mjs',
    'experiments/pg17-deletion-capture/verify-seal-fence.mjs', 'experiments/pg17-deletion-capture/seal-fence-regressions.mjs',
    'experiments/pg17-recording-flow/fixture.mjs', 'experiments/pg17-recording-worker/fixture.mjs']) await source(path)
  await h.start(); await setup(h, source, true, !legacy)
  const service = await h.actorClient('service_role', USER), { prepareRecordingSessionSeal } = await compileModules(h, source)
  await sealFenceRegressions(h, service, prepareRecordingSessionSeal, legacy)
  report.status = 'passed'
} catch (error) {
  report.status = 'failed'; report.error = { code: error.code ?? 'ERROR', label: error.label ?? error.message, where: error.where }
  process.exitCode = 1
} finally {
  await h.cleanup()
  report.sourceDrift = []
  for (const [path, hash] of Object.entries(report.sources)) if (digest(await readFile(join(root, path))) !== hash) report.sourceDrift.push(path)
  if (report.status !== 'passed' || report.sourceDrift.length) process.exitCode = 1
  await writeFile(join(directory, 'results.json'), JSON.stringify(report, null, 2))
  console.log(JSON.stringify({ directory, status: report.status, assertions: report.assertions, error: report.error, sourceDrift: report.sourceDrift, cleanup: report.cleanup }, null, 2))
}
