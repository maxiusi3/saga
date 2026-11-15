const assert = require('node:assert/strict')
const test = require('node:test')
const path = require('node:path')
const fs = require('node:fs/promises')
const { spawn } = require('node:child_process')
const { readRecordingWorkerConfig } = require('../recording-worker.cjs')
const root = path.resolve(__dirname, '../..')
const base = { SUPABASE_URL: 'https://synthetic.invalid', SUPABASE_SERVICE_ROLE_KEY: 'synthetic-secret',
  RECORDING_WORKER_ID: 'worker_1', RECORDING_FFMPEG_PATH: '/synthetic/ffmpeg' }

test('requires explicit private service configuration and normalizes only the HTTPS origin', () => {
  assert.deepEqual(readRecordingWorkerConfig(base), { storageUrl: 'https://synthetic.invalid', serviceRoleKey: 'synthetic-secret',
    workerId: 'worker_1', ffmpeg: { executable: '/synthetic/ffmpeg', timeoutMs: 120000, maxDurationMs: 7200000 }, pollMs: 2000 })
  assert.equal(readRecordingWorkerConfig({ ...base, SUPABASE_URL: undefined, NEXT_PUBLIC_SUPABASE_URL: 'https://fallback.invalid/' }).storageUrl, 'https://fallback.invalid')
  for (const key of Object.keys(base)) {
    assert.throws(() => readRecordingWorkerConfig({ ...base, [key]: undefined }), /recording_worker_configuration/)
  }
})

test('rejects insecure, ambiguous and malformed values without including secrets in diagnostics', () => {
  const cases = [
    { SUPABASE_URL: 'http://localhost:54321' }, { SUPABASE_URL: 'https://user:SECRET@synthetic.invalid' },
    { SUPABASE_URL: 'https://synthetic.invalid/path' }, { SUPABASE_URL: 'https://synthetic.invalid/?SECRET' },
    { SUPABASE_URL: 'https://synthetic.invalid/#SECRET' }, { SUPABASE_URL: ' https://synthetic.invalid ' },
    { SUPABASE_URL: 'invalid' }, { SUPABASE_SERVICE_ROLE_KEY: 'secret\nvalue' },
    { SUPABASE_SERVICE_ROLE_KEY: '   ' }, { RECORDING_WORKER_ID: 'worker SECRET' }, { RECORDING_WORKER_ID: 'x'.repeat(129) },
    { RECORDING_FFMPEG_PATH: 'ffmpeg' }, { RECORDING_FFMPEG_PATH: '/bad\0SECRET' },
    { RECORDING_WORKER_POLL_MS: '0' }, { RECORDING_WORKER_POLL_MS: '249' }, { RECORDING_WORKER_POLL_MS: '60001' },
    { RECORDING_WORKER_POLL_MS: '2e3' }, { RECORDING_FFMPEG_TIMEOUT_MS: '0' }, { RECORDING_MAX_DURATION_MS: '0' },
  ]
  for (const values of cases) assert.throws(() => readRecordingWorkerConfig({ ...base, ...values }), { message: 'recording_worker_configuration' })
  assert.equal(readRecordingWorkerConfig({ ...base, RECORDING_WORKER_POLL_MS: '250' }).pollMs, 250)
})

function command(args, env, cwd = root) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(root, 'scripts/recording-worker.cjs'), ...args], {
      cwd, env: { PATH: path.dirname(process.execPath), ...env }, stdio: ['ignore', 'pipe', 'pipe'],
    })
    let stdout = '', stderr = ''
    child.stdout.on('data', bytes => { stdout += bytes }); child.stderr.on('data', bytes => { stderr += bytes })
    const timer = setTimeout(() => { child.kill('SIGKILL'); reject(new Error('CLI test timed out')) }, 15000)
    child.on('error', reject); child.on('close', code => { clearTimeout(timer); resolve({ code, stdout, stderr }) })
  })
}

test('CLI --check loads actual worker aliases/compiler and FFmpeg offline from unrelated CWD, never auto-loads .env', async () => {
  const scratch = await fs.mkdtemp(path.join(root, '.superpowers/sdd/2026-11-05-upgrade-g1-recording-flow/cli-readiness-'))
  try {
    const ffmpeg = path.join(scratch, 'ffmpeg')
    await fs.writeFile(ffmpeg, '#!/bin/sh\nprintf "ffmpeg version synthetic-readiness\\n"\n', { mode: 0o700 })
    const noNetwork = path.join(scratch, 'no-network.cjs')
    await fs.writeFile(noNetwork, `const net = require('node:net'); net.Socket.prototype.connect = () => { throw new Error('NETWORK_FORBIDDEN') }; global.fetch = () => { throw new Error('NETWORK_FORBIDDEN') };`)
    await fs.writeFile(path.join(scratch, '.env'), 'SUPABASE_URL=https://real-looking.invalid\nSUPABASE_SERVICE_ROLE_KEY=SHOULD_NOT_LOAD\n')
    const result = await command(['--check'], { ...base, RECORDING_FFMPEG_PATH: ffmpeg, NODE_OPTIONS: `--require=${noNetwork}` }, scratch)
    assert.equal(result.code, 0, result.stderr)
    assert.match(result.stdout, /recording_worker_ready/); assert.equal(result.stderr, '')
    assert.doesNotMatch(result.stdout, /synthetic-secret|SHOULD_NOT_LOAD|synthetic.invalid|NETWORK_FORBIDDEN/)
    const missing = await command(['--check'], { RECORDING_FFMPEG_PATH: ffmpeg, RECORDING_WORKER_ID: 'worker_1' }, scratch)
    assert.equal(missing.code, 1); assert.match(missing.stderr, /recording_worker_configuration/)
  } finally { await fs.rm(scratch, { recursive: true, force: true }) }
})

test('CLI fails safely for unavailable FFmpeg and unknown/conflicting flags without starting network work', async () => {
  for (const args of [['--check'], ['--unknown'], ['--once', '--check']]) {
    const result = await command(args, base)
    assert.equal(result.code, 1); assert.match(result.stderr, /recording_worker_(runtime_unavailable|arguments)/)
    assert.doesNotMatch(result.stdout + result.stderr, /synthetic-secret|\/synthetic\/ffmpeg/)
  }
})

test('rejects embedded control characters in service URL and key before any dispatch', () => {
  for (const values of [{ SUPABASE_URL: 'https://synthetic.\tinvalid' }, { SUPABASE_SERVICE_ROLE_KEY: 'synthetic\0secret' }]) {
    assert.throws(() => readRecordingWorkerConfig({ ...base, ...values }), { message: 'recording_worker_configuration' })
  }
})

test('CLI --once executes one actual selection, reports unknown claim safely and SIGTERM stops idle polling', async () => {
  const scratch = await fs.mkdtemp(path.join(root, '.superpowers/sdd/2026-11-05-upgrade-g1-recording-flow/cli-once-'))
  try {
    const ffmpeg = path.join(scratch, 'ffmpeg'), preload = path.join(scratch, 'transport.cjs'), calls = path.join(scratch, 'calls.jsonl')
    await fs.writeFile(ffmpeg, '#!/bin/sh\nprintf "ffmpeg version synthetic-readiness\\n"\n', { mode: 0o700 })
    await fs.writeFile(preload, `
      const fs = require('node:fs');
      require('node:net').Socket.prototype.connect = () => { throw new Error('NETWORK_FORBIDDEN') };
      global.fetch = async (input, init) => {
        const url = new URL(String(input));
        fs.appendFileSync(process.env.CLI_CALLS, JSON.stringify({path:url.pathname, query:url.search})+'\\n');
        if (url.pathname.endsWith('/rpc/recording_job_lease')) throw new Error('SECRET lost claim response');
        if (process.env.CLI_SCENARIO === 'unknown') return Response.json([{id:'11111111-1111-4111-8111-111111111111',state:'queued',not_before:null,lease_expires_at:null}]);
        if (process.env.CLI_SCENARIO === 'stop') setTimeout(() => process.kill(process.pid, 'SIGTERM'), 10);
        return Response.json([]);
      };
    `)
    const env = { ...base, RECORDING_FFMPEG_PATH: ffmpeg, NODE_OPTIONS: `--require=${preload}`, CLI_CALLS: calls }
    const readCalls = async () => (await fs.readFile(calls, 'utf8')).trim().split('\n').map(line => JSON.parse(line))
    const once = await command(['--once'], env)
    assert.equal(once.code, 0, once.stderr); assert.equal((await readCalls()).length, 1)
    assert.match((await readCalls())[0].query, /job_type=eq.recording_merge/)
    await fs.writeFile(calls, '')
    const unknown = await command(['--once'], { ...env, CLI_SCENARIO: 'unknown' })
    assert.equal(unknown.code, 1); assert.equal((await readCalls()).length, 2)
    assert.match(unknown.stdout, /recording_worker_unavailable/)
    assert.doesNotMatch(unknown.stdout + unknown.stderr, /SECRET|synthetic-secret|11111111/)
    await fs.writeFile(calls, '')
    const stopped = await command([], { ...env, CLI_SCENARIO: 'stop', RECORDING_WORKER_POLL_MS: '60000' })
    assert.equal(stopped.code, 0, stopped.stderr); assert.equal((await readCalls()).length, 1)
  } finally { await fs.rm(scratch, { recursive: true, force: true }) }
})
