import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { compileCandidateModules } from '../../../../experiments/pg17-recording-candidates/application-compiler.mjs'

const scratch = await mkdtemp(join(tmpdir(), 'saga-status-candidate-compatibility-'))
try {
  const modules = await compileCandidateModules({ scratch, eq: assert.equal }, path => readFile(path, 'utf8'))
  assert.equal(typeof modules.prepareLeasedRecordingJobCandidate, 'function')
  console.log('Historical candidate compiler dependency graph remains executable.')
} finally {
  await rm(scratch, { recursive: true, force: true })
}
