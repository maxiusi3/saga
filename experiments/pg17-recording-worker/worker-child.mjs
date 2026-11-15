import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const { Client } = require('../t05-durable-worker/node_modules/pg')
const RPC = 'SELECT public.recording_job_lease($1::uuid,$2::text,$3::text,$4::integer,$5::integer) AS receipt'
let client
process.on('message', async message => {
  if (message.type === 'connect') {
    client = new Client(message.config)
    client.on('error', () => {})
    await client.connect()
    process.send({ type: 'ready', pid: process.pid, backendPid: client.processID })
  } else if (message.type === 'go') {
    try {
      const call = async (action, attempt = null) => (await client.query(RPC,
        [message.jobId, action, message.workerId, attempt, action === 'claim' ? message.leaseMs : null])).rows[0].receipt
      let receipt = await call('claim')
      if (message.mode === 'running') receipt = await call('start', receipt.attempt)
      process.send({ type: 'checkpoint', pid: process.pid, backendPid: client.processID, receipt })
      if (message.mode === 'race') { await client.end(); process.disconnect() }
    } catch (error) {
      process.send({ type: 'rejected', pid: process.pid, code: error.code ?? 'ERROR' })
      await client.end()
      process.disconnect()
    }
  }
})
