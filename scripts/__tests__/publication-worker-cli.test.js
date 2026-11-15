const test = require('node:test')
const assert = require('node:assert/strict')
const { spawnSync } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')
const os = require('node:os')
const cli = path.resolve(__dirname, '../publication-worker.cjs')
const base = { SUPABASE_URL: 'https://synthetic.invalid', SUPABASE_SERVICE_ROLE_KEY: 'synthetic-secret' }

test('publication CLI validates the real compiler, font and private spool offline from unrelated CWD', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'saga-publication-cli-'))
  try {
    const spool = path.join(dir, 'spool'), noNetwork = path.join(dir, 'no-network.cjs')
    fs.mkdirSync(spool, { mode: 0o700 })
    fs.writeFileSync(noNetwork, "require('node:net').Socket.prototype.connect=()=>{throw Error('NETWORK_FORBIDDEN')};global.fetch=()=>{throw Error('NETWORK_FORBIDDEN')}")
    fs.writeFileSync(path.join(dir, '.env'), 'SUPABASE_URL=https://wrong.invalid\nSUPABASE_SERVICE_ROLE_KEY=DO_NOT_LOAD\n')
    const run = (env, args = ['--check']) => spawnSync(process.execPath, [cli, ...args], { cwd: dir, env: { PATH: path.dirname(process.execPath), NODE_OPTIONS: '--require=' + noNetwork, ...env }, encoding: 'utf8', timeout: 15000 })
    const missing = run({ ARCHIVE_SPOOL_DIR: spool })
    assert.equal(missing.status, 1); assert.match(missing.stderr, /publication_worker_configuration/)
    const ready = run({ ...base, ARCHIVE_SPOOL_DIR: spool })
    assert.equal(ready.status, 0, ready.stderr); assert.match(ready.stdout, /publication_worker_ready/)
    assert.doesNotMatch(ready.stdout + ready.stderr, /synthetic-secret|NETWORK_FORBIDDEN|DO_NOT_LOAD/)
    for (const extra of [{ SUPABASE_URL: 'http://localhost' }, { PUBLICATION_WORKER_POLL_MS: '1e3' }, { ARCHIVE_FONT_PATH: '/missing/SECRET' }, { ARCHIVE_SPOOL_DIR: 'relative' }]) {
      const failed = run({ ...base, ARCHIVE_SPOOL_DIR: spool, ...extra })
      assert.equal(failed.status, 1); assert.doesNotMatch(failed.stderr, /SECRET|synthetic-secret/)
    }
    fs.chmodSync(spool, 0o755)
    assert.equal(run({ ...base, ARCHIVE_SPOOL_DIR: spool }).status, 1)
    fs.chmodSync(spool, 0o700)
    const link = path.join(dir, 'link'); fs.symlinkSync(spool, link)
    assert.equal(run({ ...base, ARCHIVE_SPOOL_DIR: link }).status, 1)
    assert.equal(run(base, ['--once', '--check']).status, 1)
  } finally { fs.rmSync(dir, { recursive: true, force: true }) }
})

test('publication CLI runs one actual queue pass, handles provider failure safely, and SIGTERM drains idle polling', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'saga-publication-cli-loop-'))
  try {
    const spool = path.join(dir, 'spool'), preload = path.join(dir, 'transport.cjs'), calls = path.join(dir, 'calls.jsonl')
    fs.mkdirSync(spool, { mode: 0o700 })
    fs.writeFileSync(preload, `
      const fs=require('node:fs');require('node:net').Socket.prototype.connect=()=>{throw Error('NETWORK_FORBIDDEN')};
      global.fetch=async(input)=>{const url=new URL(String(input));fs.appendFileSync(process.env.CLI_CALLS,JSON.stringify({path:url.pathname,query:url.search})+'\\n');
        if(process.env.CLI_SCENARIO==='failure')return Response.json({message:'SECRET'}, {status:400});
        if(process.env.CLI_SCENARIO==='stop' && url.pathname.endsWith('/publication_delivery_jobs'))setTimeout(()=>process.kill(process.pid,'SIGTERM'),10);
        return Response.json([]);
      };
    `)
    const run = (args, scenario) => spawnSync(process.execPath, [cli, ...args], { cwd: dir, env: { PATH: path.dirname(process.execPath), ...base, ARCHIVE_SPOOL_DIR: spool, NODE_OPTIONS: '--require=' + preload, CLI_CALLS: calls, CLI_SCENARIO: scenario, PUBLICATION_WORKER_POLL_MS: '60000' }, encoding: 'utf8', timeout: 15000 })
    const readCalls = () => fs.readFileSync(calls, 'utf8').trim().split('\n').map(JSON.parse)
    const once = run(['--once'], 'idle')
    assert.equal(once.status, 0, once.stderr); assert.equal(readCalls().length, 2)
    assert.ok(readCalls()[1].path.endsWith('/publication_delivery_jobs'))
    fs.writeFileSync(calls, '')
    const failed = run(['--once'], 'failure')
    assert.equal(failed.status, 1); assert.match(failed.stderr, /publication_worker_unavailable/)
    assert.doesNotMatch(failed.stdout + failed.stderr, /SECRET|synthetic-secret/)
    fs.writeFileSync(calls, '')
    const stopped = run([], 'stop')
    assert.equal(stopped.status, 0, stopped.stderr); assert.equal(readCalls().length, 2)
  } finally { fs.rmSync(dir, { recursive: true, force: true }) }
})
