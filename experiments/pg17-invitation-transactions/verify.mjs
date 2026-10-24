import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { join, dirname, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import { randomUUID } from 'node:crypto'
import { release } from 'node:os'
import { Harness, root, digest, failure } from '../pg17-routines/runtime.mjs'
import { loadReviewed, replay } from '../pg17-routines/replay.mjs'
import { seed, originalRed, applyCandidate, candidates } from './scenarios.mjs'
import { inputFiles } from './input-files.mjs'

export const here = dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)
const args = process.argv.slice(2),
  red = args.includes('--red')
const report = {
  startedAt: new Date().toISOString(),
  status: 'running',
  mode: red ? 'original-red' : 'candidate',
  scope:
    'Synthetic local PostgreSQL 17.4; invitation transactions; no remote/business/auth/payment calls',
  sources: {},
  assertions: 0,
  actorConnections: [],
  scenarios: []
}
const h = new Harness(report)
let pins
const dir = join(root, 'docs/research/evidence/2026-10-18-invitation-transactions')
const output = join(
  dir,
  `invitation-${red ? 'red' : 'run'}-${new Date().toISOString().replaceAll(':', '-')}-${randomUUID()}.json`
)
process.send?.({ type: 'evidence', path: output })
for (const name of ['SIGINT', 'SIGTERM'])
  process.once(name, () => {
    if (!h.finishing && !h.signal) {
      h.signal = name
      process.send?.({ type: 'shutdown-requested', signal: name })
    }
  })
const deadline = setTimeout(() => {
  h.signal = 'deadline'
}, 240000)
async function fingerprints() {
  const files = await inputFiles(here)
  for (const f of files.sort()) report.sources[f] = digest(await readFile(join(root, f)))
  if (red) return
  const bytes = await readFile(join(here, 'input-pins.json'))
  pins = JSON.parse(bytes)
  report.inputPins = {
    path: 'experiments/pg17-invitation-transactions/input-pins.json',
    sha256: digest(bytes)
  }
  h.eq(report.sources, pins.sources, 'complete direct source and support input fingerprints')
  h.eq(
    digest(await readFile(process.execPath)),
    pins.nodeExecutableSha256,
    'pinned Node executable'
  )
  const runtimeFiles = []
  async function walk(path) {
    for (const e of await readdir(join(root, path), { withFileTypes: true })) {
      const f = path + '/' + e.name
      if (e.isDirectory()) await walk(f)
      else runtimeFiles.push(f)
    }
  }
  for (const part of ['bin', 'lib', 'share'])
    await walk('.superpowers/sdd/2026-10-17-upgrade-pg17-routines/runtime/install/' + part)
  h.eq(
    runtimeFiles.sort(),
    Object.keys(pins.runtimeFiles).sort(),
    'full installed runtime bin lib share inventory'
  )
  for (const f of runtimeFiles)
    h.eq(
      digest(await readFile(join(root, f))),
      pins.runtimeFiles[f],
      'runtime support file fingerprint'
    )
  report.runtimeClosure = {
    files: runtimeFiles.length,
    verified: true,
    scope:
      'complete installed bin/lib/share superset, including catalog bootstrap, timezone data and plpgsql module',
    operatingSystem: { platform: process.platform, arch: process.arch, release: release() },
    systemLibraries:
      'macOS libSystem shared cache and kernel are ambient platform dependencies; not byte-pinned'
  }
}
async function dependencies() {
  const files = new Set(Object.keys(require.cache))
  for (const f of [...files]) {
    let d = dirname(f)
    while (d.startsWith(root)) {
      try {
        await readFile(join(d, 'package.json'))
        files.add(join(d, 'package.json'))
        break
      } catch {}
      d = dirname(d)
    }
  }
  report.dependencyClosure = {
    nodeVersions: process.versions,
    builtinModules: 'provided by pinned Node executable',
    commonJS: {}
  }
  for (const f of [...files].sort())
    report.dependencyClosure.commonJS[relative(root, f)] = digest(await readFile(f))
  if (pins) {
    h.eq(
      report.dependencyClosure.commonJS,
      pins.commonJS,
      'exact loaded CommonJS dependency closure and package manifests'
    )
    report.dependencyClosure.verified = true
  }
}
try {
  h.ok(
    args.every((x) =>
      ['--red', '--test-signal-ready', '--test-fail-start', '--test-client-failure'].includes(x)
    ),
    'only local runner flags'
  )
  await fingerprints()
  const reviewed = await loadReviewed(h)
  await h.start(args.includes('--test-fail-start'))
  await replay(h, reviewed)
  await h.db.query(await readFile(join(here, 'fixture.sql'), 'utf8'))
  await seed(h.db)
  if (!red) await applyCandidate(h)
  if (args.includes('--test-signal-ready')) {
    h.ok(process.send, 'signal gate requires IPC observer')
    process.send({ type: 'fixture-ready', path: h.scratch })
    const until = Date.now() + 15000
    while (!h.signal && Date.now() < until) await new Promise((r) => setTimeout(r, 20))
    h.check()
    throw failure('SIGNAL_GATE_TIMEOUT')
  }
  if (args.includes('--test-client-failure')) {
    report.phase = 'client_connection_failure'
    await h.client('synthetic_missing_role')
    throw failure('EXPECTED_CONNECTION_FAILURE')
  }
  if (red) await originalRed(h)
  else {
    await candidates(h)
    const { concurrency } = await import('./concurrency.mjs')
    await concurrency(h)
  }
  report.status = 'passed'
} catch (e) {
  report.status = h.signal ? 'interrupted' : 'failed'
  if (h.signal) report.signal = h.signal
  else
    report.error = {
      code: /^[A-Z0-9_]+$/.test(e.code ?? '')
        ? e.code
        : Number.isInteger(e.status)
          ? 'SUBPROCESS_FAILED'
          : 'ERROR',
      label: e.label,
      subprocessExit: Number.isInteger(e.status) ? e.status : undefined
    }
} finally {
  clearTimeout(deadline)
  // Fingerprint failures must never skip cleanup, including during interruption.
  h.finishing = true
  try {
    await dependencies()
  } catch {
    report.status = 'failed'
    report.dependencyError = 'DEPENDENCY_PIN_FAILED'
  }
  try {
    for (const [f, sha] of Object.entries(report.sources))
      h.eq(digest(await readFile(join(root, f))), sha, 'source remains unchanged through execution')
    report.sourcesUnchangedAtFinish = true
  } catch {
    report.status = 'failed'
    report.sourceError = 'SOURCE_CHANGED_DURING_RUN'
  }
  try {
    await h.cleanup()
  } catch {
    report.status = 'failed'
    report.cleanupError = 'UNEXPECTED_CLEANUP_ERROR'
  }
  report.finishedAt = new Date().toISOString()
  await mkdir(dir, { recursive: true })
  await writeFile(output, JSON.stringify(report, null, 2) + '\n', { flag: 'wx', mode: 0o644 })
  console.log(
    JSON.stringify({
      status: report.status,
      evidence: relative(root, output),
      scenarios: report.scenarios.length,
      assertions: report.assertions,
      error: report.error,
      cleanup: report.cleanup
    })
  )
  process.exitCode =
    h.signal === 'SIGTERM' ? 143 : h.signal === 'SIGINT' ? 130 : report.status === 'passed' ? 0 : 1
}
