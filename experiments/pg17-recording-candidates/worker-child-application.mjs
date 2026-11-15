import { createRequire } from 'node:module'
import { applicationClient, ORIGIN, SECRET } from './application-client.mjs'

const require = createRequire(import.meta.url)
const cp = require('node:child_process')
const fs = require('node:fs')
const originalSpawn = cp.spawn
const originalRead = fs.createReadStream
cp.spawn = function (...args) {
  const child = originalSpawn.apply(this, args)
  process.send?.({ type: 'native-spawn', pid: process.pid, decoderPid: child.pid })
  child.once('close', (code, signal) => process.send?.({ type: 'native-close', pid: process.pid, decoderPid: child.pid, code, signal }))
  return child
}
fs.createReadStream = function (...args) {
  const stream = originalRead.apply(this, args)
  process.send?.({ type: 'file-open', pid: process.pid })
  stream.once('close', () => process.send?.({ type: 'file-close', pid: process.pid }))
  return stream
}
process.once('message', async message => {
  const { admin, transport } = applicationClient(message.loopback)
  const { prepareLeasedRecordingJobCandidate } = require(message.workerModule)
  try {
    const result = await prepareLeasedRecordingJobCandidate(message.jobId, {
      ...message.options, admin, storageUrl: ORIGIN, serviceRoleKey: SECRET, fetch: transport,
    })
    process.send?.({ type: 'unexpected-result', pid: process.pid, status: result.status })
  } catch (error) {
    process.send?.({ type: 'unexpected-error', pid: process.pid, code: error.code ?? null, message: error.message })
  } finally { process.disconnect() }
})
process.send?.({ type: 'ready', pid: process.pid })
