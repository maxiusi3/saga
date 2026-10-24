// Run with: node --test docs/research/evidence/2026-10-16-dependency-review/runtime-smoke-startup.test.cjs
// RUNTIME_SMOKE_SOURCE may point to a saved script for a before/after replay.
const assert = require('node:assert/strict')
const { spawnSync } = require('node:child_process')
const fs = require('node:fs')
const { createRequire } = require('node:module')
const os = require('node:os')
const path = require('node:path')

if (process.argv[2] === '--fault-child') {
  const [scriptPath, scenario, resultPath, tracePath, webPackage, useOutputArgument] = process.argv.slice(3)
  const Module = require('node:module')
  const originalLoad = Module._load
  const webRequire = createRequire(webPackage)
  const loads = []

  // Stop before starting Next; the real synthetic-image checks still execute.
  if (scenario === 'next-metadata') {
    require('node:net').createServer = () => {
      throw new Error('simulated runtime failure before server start')
    }
  }

  // Injection is confined to this subprocess. Installed packages are untouched.
  Module._load = function (request, parent, isMain) {
    if (['sharp', 'playwright', 'next/package.json'].includes(request)) {
      loads.push({ request, status: JSON.parse(fs.readFileSync(resultPath, 'utf8')).status })
      fs.writeFileSync(tracePath, JSON.stringify(loads))
      if (request === scenario || (scenario === 'next-metadata' && request === 'next/package.json')) {
        throw new Error(`simulated failure loading ${request}`)
      }
      return originalLoad.call(this, webRequire.resolve(request), parent, isMain)
    }
    return originalLoad.call(this, request, parent, isMain)
  }
  process.argv = [process.execPath, scriptPath, ...(useOutputArgument === 'true' ? [resultPath] : [])]
  require(scriptPath)
} else {
  const { test } = require('node:test')
  const root = path.resolve(__dirname, '../../../..')
  const sourcePath = process.env.RUNTIME_SMOKE_SOURCE
    ? path.resolve(process.env.RUNTIME_SMOKE_SOURCE)
    : path.join(root, 'docs/research/evidence/2026-10-15-dependency-audit/runtime-smoke.cjs')

  function runFault(scenario, useOutputArgument = false) {
    const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'saga-runtime-startup-'))
    try {
      const scriptDirectory = path.join(temporaryRoot, 'docs/research/evidence/audit')
      fs.mkdirSync(scriptDirectory, { recursive: true })
      const scriptPath = path.join(scriptDirectory, 'runtime-smoke.cjs')
      fs.copyFileSync(sourcePath, scriptPath)
      const defaultResult = path.join(scriptDirectory, 'runtime-smoke.json')
      const resultPath = useOutputArgument ? path.join(temporaryRoot, 'new-runtime-result.json') : defaultResult
      const tracePath = path.join(temporaryRoot, 'loads.json')
      const historical = JSON.stringify({ status: 'passed', checkedAt: 'historical-result' }) + '\n'
      fs.writeFileSync(defaultResult, historical)
      fs.writeFileSync(resultPath, historical)
      const child = spawnSync(process.execPath, [__filename, '--fault-child', scriptPath, scenario,
        resultPath, tracePath, path.join(root, 'packages/web/package.json'), String(useOutputArgument)], {
        encoding: 'utf8', timeout: 15_000,
      })
      assert.ifError(child.error)
      return {
        exitCode: child.status,
        stdout: child.stdout,
        stderr: child.stderr,
        result: JSON.parse(fs.readFileSync(resultPath, 'utf8')),
        loads: JSON.parse(fs.readFileSync(tracePath, 'utf8')),
        defaultUnchanged: fs.readFileSync(defaultResult, 'utf8') === historical,
      }
    } finally {
      fs.rmSync(temporaryRoot, { recursive: true, force: true })
    }
  }

  // These assertions detect stale success files, skipped invalidation, and failures
  // lost during final metadata collection; they do not inspect implementation text.
  for (const dependency of ['sharp', 'playwright']) {
    test(`${dependency} load failure invalidates previous success and records a failed run`, () => {
      const run = runFault(dependency)
      assert.equal(run.exitCode, 1)
      assert.equal(run.result.status, 'failed', JSON.stringify(run))
      assert.equal(run.result.error, `simulated failure loading ${dependency}`)
      assert.deepEqual(run.result.checks, [])
      assert.ok(run.loads.length > 0)
      assert.ok(run.loads.every((load) => load.status === 'running'), JSON.stringify(run.loads))
      assert.doesNotMatch(run.stdout, /checks passed/)
      assert.match(run.stderr, new RegExp(`simulated failure loading ${dependency}`))
    })
  }

  test('Next metadata failure cannot mask the original runtime failure or prevent a failed report', () => {
    const run = runFault('next-metadata')
    assert.equal(run.exitCode, 1)
    assert.equal(run.result.status, 'failed', JSON.stringify(run))
    assert.equal(run.result.error, 'simulated runtime failure before server start')
    assert.equal(run.result.metadataErrors.next, 'simulated failure loading next/package.json')
    assert.equal(run.result.next, undefined)
    assert.equal(run.result.checks.length, 6)
    assert.ok(run.loads.every((load) => load.status === 'running'), JSON.stringify(run.loads))
    assert.doesNotMatch(run.stdout, /checks passed/)
    assert.match(run.stderr, /simulated runtime failure before server start/)
  })

  test('explicit output path records the new failure while preserving the historical default file', () => {
    const run = runFault('sharp', true)
    assert.equal(run.exitCode, 1)
    assert.equal(run.result.status, 'failed', JSON.stringify(run))
    assert.equal(run.result.error, 'simulated failure loading sharp')
    assert.equal(run.defaultUnchanged, true)
    assert.ok(run.loads.every((load) => load.status === 'running'), JSON.stringify(run.loads))
    assert.doesNotMatch(run.stdout, /checks passed/)
  })
}
