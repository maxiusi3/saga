import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { compileModules } from '../experiments/pg17-recording-worker/fixture.mjs'

// Exercise the old compiler without running its evidence-writing harness.
const root = dirname(dirname(fileURLToPath(import.meta.url)))
const scratch = await mkdtemp(join(tmpdir(), 'saga-worker-compatibility-'))
try {
  const modules = await compileModules({ scratch, eq: assert.equal }, path => readFile(join(root, path), 'utf8'), true)
  assert.equal(typeof modules.verifyLeasedRecordingJobInput, 'function')
  console.log('Historical verifier compiler dependency graph remains executable.')
} finally {
  await rm(scratch, { recursive: true, force: true })
}
