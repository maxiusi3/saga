const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { spawnSync } = require('node:child_process')

test('restore CLI applies every migration in order and stops after the first failed file', () => {
  const root = path.resolve(__dirname, '../..')
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'saga-restore-command-'))
  try {
    const log = path.join(directory, 'calls.jsonl')
    const backup = path.join(directory, 'synthetic.backup')
    fs.writeFileSync(backup, '-- synthetic only')
    // No database connection is made: record the real script's psql invocations.
    fs.writeFileSync(path.join(directory, 'psql'), `#!${process.execPath}\nconst fs=require('node:fs');const args=process.argv.slice(2);fs.appendFileSync(process.env.SAGA_RESTORE_LOG,JSON.stringify(args)+'\\n');if(args.includes(process.env.SAGA_FAIL_FILE))process.exit(7);`, { mode: 0o700 })
    const files = fs.readdirSync(path.join(root, 'supabase/migrations')).filter(f => f.endsWith('.sql')).sort().map(f => 'supabase/migrations/' + f)
    const run = failure => spawnSync('bash', ['scripts/supabase/restore-new-project.sh'], { cwd: root, encoding: 'utf8', timeout: 60000,
      env: { ...process.env, PATH: directory + path.delimiter + process.env.PATH, DATABASE_URL: 'postgresql://synthetic.invalid/no-connection', BACKUP_FILE: backup, SAGA_RESTORE_LOG: log, SAGA_FAIL_FILE: failure } })
    const invokedFiles = () => fs.readFileSync(log, 'utf8').trim().split('\n').map(s => JSON.parse(s)).filter(a => a.includes('-f')).map(a => a[a.indexOf('-f') + 1])
    assert.equal(run('').status, 0)
    assert.deepEqual(invokedFiles(), [backup, 'supabase/bootstrap/20260624000000_app_base_schema.sql', ...files])
    fs.writeFileSync(log, '')
    const index = Math.floor(files.length / 2)
    assert.equal(run(files[index]).status, 7)
    assert.deepEqual(invokedFiles(), [backup, 'supabase/bootstrap/20260624000000_app_base_schema.sql', ...files.slice(0, index + 1)])
  } finally { fs.rmSync(directory, { recursive: true, force: true }) }
})
