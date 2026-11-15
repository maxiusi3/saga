const test = require('node:test'), assert = require('node:assert/strict')
const { spawnSync } = require('node:child_process'), fs = require('node:fs'), path = require('node:path'), os = require('node:os')
const cli = path.resolve(__dirname, '../hosting-reminder-worker.cjs')
const base = { SUPABASE_URL: 'https://synthetic.invalid', SUPABASE_SERVICE_ROLE_KEY: 'synthetic-secret' }

test('reminder CLI is offline in check mode, rejects malformed config and never loads dotenv', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'saga-reminder-check-'))
  try {
    const preload = path.join(dir, 'no-network.cjs')
    fs.writeFileSync(preload, "require('node:net').Socket.prototype.connect=()=>{throw Error('NETWORK_FORBIDDEN')};global.fetch=()=>{throw Error('NETWORK_FORBIDDEN')}")
    fs.writeFileSync(path.join(dir, '.env'), 'SUPABASE_URL=https://wrong.invalid\nSUPABASE_SERVICE_ROLE_KEY=DO_NOT_LOAD\n')
    const run = (env, args = ['--check']) => spawnSync(process.execPath, [cli, ...args], { cwd: dir, env: { PATH: path.dirname(process.execPath), NODE_OPTIONS: '--require=' + preload, ...env }, encoding: 'utf8', timeout: 15000 })
    assert.equal(run({}).status, 1)
    const ready = run(base); assert.equal(ready.status, 0, ready.stderr); assert.match(ready.stdout, /hosting_reminder_ready/)
    assert.doesNotMatch(ready.stdout + ready.stderr, /synthetic-secret|NETWORK_FORBIDDEN|DO_NOT_LOAD/)
    for (const extra of [{ SUPABASE_URL: 'http://localhost' }, { HOSTING_REMINDER_POLL_MS: '1e3' }, { HOSTING_REMINDER_EMAIL_ENABLED: 'yes' }, { HOSTING_REMINDER_EMAIL_ENABLED: 'true' }, { HOSTING_REMINDER_BATCH_SIZE: '0' }]) {
      const failed = run({ ...base, ...extra }); assert.equal(failed.status, 1); assert.match(failed.stderr, /hosting_reminder_configuration/)
    }
    assert.equal(run(base, ['--once', '--check']).status, 1)
  } finally { fs.rmSync(dir, { recursive: true, force: true }) }
})

test('reminder CLI runs actual SDK RPC, rejects errors, and SIGTERM stops idle loop', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'saga-reminder-loop-'))
  try {
    const preload = path.join(dir, 'transport.cjs'), calls = path.join(dir, 'calls.jsonl')
    fs.writeFileSync(preload, `const fs=require('node:fs');require('node:net').Socket.prototype.connect=()=>{throw Error('NETWORK_FORBIDDEN')};
      global.fetch=async(input,init)=>{const url=new URL(String(input));fs.appendFileSync(process.env.CLI_CALLS,JSON.stringify({path:url.pathname,body:JSON.parse(init.body)})+'\\n');
        if(process.env.CLI_SCENARIO==='failure')return Response.json({message:'SECRET'}, {status:400});
        if(process.env.CLI_SCENARIO==='stop')setTimeout(()=>process.kill(process.pid,'SIGTERM'),10);
        return Response.json({inAppSent:1});};`)
    const run = (args, scenario) => spawnSync(process.execPath, [cli, ...args], { cwd: dir, env: { PATH: path.dirname(process.execPath), ...base, NODE_OPTIONS: '--require=' + preload, CLI_CALLS: calls, CLI_SCENARIO: scenario }, encoding: 'utf8', timeout: 15000 })
    const once = run(['--once'], 'ok'); assert.equal(once.status, 0, once.stderr); assert.match(once.stdout, /"inAppSent":1/)
    const [call] = fs.readFileSync(calls, 'utf8').trim().split('\n').map(JSON.parse)
    assert.equal(call.path, '/rest/v1/rpc/tick_hosting_reminders'); assert.deepEqual(call.body, { p_limit: 50, p_email_enabled: false })
    const failed = run(['--once'], 'failure'); assert.equal(failed.status, 1); assert.match(failed.stderr, /hosting_reminder_unavailable/)
    assert.doesNotMatch(failed.stdout + failed.stderr, /SECRET|synthetic-secret/)
    const stopped = run([], 'stop'); assert.equal(stopped.status, 0, stopped.stderr)
  } finally { fs.rmSync(dir, { recursive: true, force: true }) }
})
