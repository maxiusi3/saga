#!/usr/bin/env node
// Deliberately no dotenv: operator configuration must be explicit.
const path = require('node:path')
const fs = require('node:fs/promises')
const { tmpdir } = require('node:os')
const { execFile } = require('node:child_process')
const { promisify } = require('node:util')
const { createRequire, isBuiltin } = require('node:module')

const configurationError = () => new Error('recording_worker_configuration')
function readRecordingWorkerConfig(env = process.env) {
  const raw = env.SUPABASE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL
  let url
  try { url = new URL(raw) } catch { throw configurationError() }
  if (typeof raw !== 'string' || /[\s\x00-\x1f\x7f]/.test(raw) || url.protocol !== 'https:' || url.username || url.password ||
    url.search || url.hash || url.pathname !== '/') throw configurationError()
  const key = env.SUPABASE_SERVICE_ROLE_KEY
  const workerId = env.RECORDING_WORKER_ID
  const executable = env.RECORDING_FFMPEG_PATH
  if (typeof key !== 'string' || !key || /[\s\x00-\x1f\x7f]/.test(key) || typeof workerId !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(workerId) ||
    typeof executable !== 'string' || !path.isAbsolute(executable) || /[\0\r\n]/.test(executable)) throw configurationError()
  function integer(name, fallback, min, max) {
    const text = env[name]
    if (text === undefined) return fallback
    const value = Number(text)
    if (!/^[0-9]+$/.test(text) || !Number.isSafeInteger(value) || value < min || value > max) throw configurationError()
    return value
  }
  return { storageUrl: url.origin, serviceRoleKey: key, workerId, ffmpeg: { executable,
    timeoutMs: integer('RECORDING_FFMPEG_TIMEOUT_MS', 120000, 1, 2147483647),
    maxDurationMs: integer('RECORDING_MAX_DURATION_MS', 7200000, 1, 86400000) },
  pollMs: integer('RECORDING_WORKER_POLL_MS', 2000, 250, 60000) }
}

/** Compile the reachable production TS graph in a private temporary directory.
 * Runtime imports (including @/) are resolved from source locations; no global
 * require hook, Next server, environment loader or experiment helper is used.
 * This transpiles only. The repository type-check/build gate remains required.
 */
async function loadWorker(kind = 'recordings') {
  if (!['recordings', 'deletions', 'publications', 'hosting-reminders'].includes(kind)) throw new Error('recording_worker_runtime_unavailable')
  const ts = require('typescript')
  const sourceRoot = path.resolve(__dirname, '../packages/web/src')
  const scratch = await fs.mkdtemp(path.join(tmpdir(), 'saga-recording-worker-'))
  const visited = new Map()
  async function compile(sourceFile) {
    if (visited.has(sourceFile)) return visited.get(sourceFile)
    if (!sourceFile.startsWith(`${sourceRoot}${path.sep}`)) throw new Error('recording_worker_runtime_unavailable')
    const destination = path.join(scratch, `${path.relative(sourceRoot, sourceFile).replace(/\.ts$/, '')}.cjs`)
    visited.set(sourceFile, destination)
    const source = await fs.readFile(sourceFile, 'utf8')
    const compiled = ts.transpileModule(source, { fileName: sourceFile, reportDiagnostics: true,
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } })
    if (compiled.diagnostics.some(item => item.category === ts.DiagnosticCategory.Error)) throw new Error('recording_worker_runtime_unavailable')
    let output = compiled.outputText
    const replacements = new Map()
    // transpileModule emits static runtime imports as require("specifier").
    for (const match of output.matchAll(/require\((["'])([^"']+)\1\)/g)) {
      const name = match[2]
      if (isBuiltin(name) || replacements.has(name)) continue
      const local = name.startsWith('@/') ? path.resolve(sourceRoot, name.slice(2)) :
        name.startsWith('.') ? path.resolve(path.dirname(sourceFile), name) : null
      replacements.set(name, local ? await compile(`${local}.ts`) : createRequire(sourceFile).resolve(name))
    }
    output = output.replace(/require\((["'])([^"']+)\1\)/g, (whole, _quote, name) =>
      replacements.has(name) ? `require(${JSON.stringify(replacements.get(name))})` : whole)
    await fs.mkdir(path.dirname(destination), { recursive: true })
    await fs.writeFile(destination, output, { mode: 0o600 })
    return destination
  }
  const close = () => fs.rm(scratch, { recursive: true, force: true })
  try {
    const entry = { recordings: 'recording-worker-host', deletions: 'media-deletion-worker', publications: 'publication-delivery-worker', 'hosting-reminders': 'hosting-reminders' }[kind]
    const worker = require(await compile(path.join(sourceRoot, `lib/server/${entry}.ts`)))
    const exports = { recordings: ['runRecordingWorkerOnce', 'runRecordingWorker'], deletions: ['runMediaDeletionWorkerOnce', 'runMediaDeletion'], publications: ['runPublicationDeliveryWorker', 'reconcilePublicationArtifacts', 'requireArchiveSpool'], 'hosting-reminders': ['readHostingReminderConfig', 'runHostingReminderWorkerOnce'] }[kind]
    if (exports.some(name => typeof worker[name] !== 'function')) throw new Error('recording_worker_runtime_unavailable')
    return { worker, close }
  } catch { await close(); throw new Error('recording_worker_runtime_unavailable') }
}

async function main(args = process.argv.slice(2)) {
  if (args.length > 1 || args.some(arg => !['--check', '--once', '--help'].includes(arg))) throw new Error('recording_worker_arguments')
  if (args[0] === '--help') {
    console.log('Usage: npm run worker:recordings -- [--check | --once]\nRequires SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RECORDING_WORKER_ID, RECORDING_FFMPEG_PATH. See docs/recording-worker.md.')
    return
  }
  const config = readRecordingWorkerConfig()
  const controller = new AbortController()
  const stop = () => controller.abort()
  process.on('SIGINT', stop); process.on('SIGTERM', stop)
  let runtime
  try {
    // Loading the SDK and worker graph is local. --check never creates a client.
    const { createClient } = require('@supabase/supabase-js')
    runtime = await loadWorker()
    if (controller.signal.aborted) return
    const version = await promisify(execFile)(config.ffmpeg.executable, ['-version'], {
      timeout: 5000, killSignal: 'SIGKILL', maxBuffer: 8192, signal: controller.signal,
    })
    if (!/^ffmpeg version\s/i.test(version.stdout)) throw new Error('recording_worker_runtime_unavailable')
    if (controller.signal.aborted) return
    if (args[0] === '--check') { console.log('recording_worker_ready'); return }
    const admin = createClient(config.storageUrl, config.serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    })
    // Only fixed enum values are logged: no IDs, tokens, keys, paths or content.
    const report = result => {
      if (result.status !== 'idle' && result.status !== 'stopped') console.log(`recording_worker_${result.status}`)
    }
    const options = { ...config, admin, signal: controller.signal }
    if (args[0] === '--once') {
      const result = await runtime.worker.runRecordingWorkerOnce(options)
      report(result)
      if (result.status === 'unavailable') process.exitCode = 1
    } else await runtime.worker.runRecordingWorker({ ...options, onIteration: report })
  } catch (error) {
    if (!controller.signal.aborted) throw error
  } finally {
    // No forced exit: owned work drains before the compiled graph is removed.
    await runtime?.close()
    process.removeListener('SIGINT', stop); process.removeListener('SIGTERM', stop)
  }
}
module.exports = { readRecordingWorkerConfig, loadWorker, main }
if (require.main === module) void main().catch(error => {
  const safe = ['recording_worker_configuration', 'recording_worker_arguments', 'recording_worker_host_unavailable']
  console.error(safe.includes(error?.message) ? error.message : 'recording_worker_runtime_unavailable')
  process.exitCode = 1
})
