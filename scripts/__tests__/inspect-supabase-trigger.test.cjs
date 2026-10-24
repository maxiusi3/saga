const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const { createHash } = require('node:crypto');
const routines = require('../inspect-supabase-routines.cjs');

const ROOT = path.resolve(__dirname, '../..');
const MODULE_PATH = path.join(ROOT, 'scripts/inspect-supabase-trigger.cjs');
const SNAPSHOT_PATH = 'docs/research/evidence/2026-10-17-remote-metadata/snapshot-2026-10-17T06-13-03-052Z.json';
const SNAPSHOT_SHA256 = '8b2a4647b017305183e67b2b932be02080a789dba4fc48b23b2f23a97991e66e';
const TRIGGER_MD5 = '3bfa5e64985d89e65932564c89520d5b';
const SECRET = 'FAKE_TRIGGER_PRIVATE_17935';
const SNAPSHOT = fs.readFileSync(path.join(ROOT, SNAPSHOT_PATH));
const PINNED = JSON.parse(SNAPSHOT).sections.functions.rows.find(row =>
  row.schema_name === 'public' && row.function_name === 'update_updated_at_column' && row.identity_arguments === '');
const trigger = fs.existsSync(MODULE_PATH) ? require(MODULE_PATH) : {};
const digest = (bytes, algorithm = 'sha256') => createHash(algorithm).update(bytes).digest('hex');
const assertPrivate = value => assert.equal(JSON.stringify(value).includes(SECRET), false, 'public output contains a synthetic private value');
const requireImplementation = () => assert.equal(typeof trigger.loadPinnedTargets, 'function', 'fixed trigger capture entry must exist');
const syntheticRow = () => {
  const definition = `CREATE FUNCTION public.synthetic_trigger() RETURNS trigger LANGUAGE plpgsql AS $body$ BEGIN /* ${SECRET} */ RETURN NEW; END $body$;\n`;
  return { ...PINNED, definition, definition_hash_md5: digest(definition, 'md5') };
};
const identity = { current_user: 'metadata_reader', current_database: 'postgres', read_only: 'on', isolation: 'repeatable read',
  server_version: '17.4', statement_timeout: '10s', lock_timeout: '2s', idle_transaction_timeout: '15s',
  snapshot_time: new Date('2026-10-17T00:00:00Z') };

test('the trigger entry pins only the zero-argument public trigger in the immutable snapshot', () => {
  requireImplementation();
  const targets = trigger.loadPinnedTargets(SNAPSHOT);
  assert.equal(targets.length, 1);
  assert.deepEqual(targets, [PINNED]);
  assert.equal(targets[0].definition_hash_md5, TRIGGER_MD5);
  assert.equal(targets[0].return_type, 'trigger');
  assert.equal(targets[0].kind, 'f');
  assert.equal(trigger.SNAPSHOT_SHA256, SNAPSHOT_SHA256);
  assert.throws(() => trigger.loadPinnedTargets(Buffer.concat([SNAPSHOT, Buffer.from('\n')])), /PINNED_SNAPSHOT_MISMATCH/);
  for (const mutation of [{ schema_name: 'other' }, { function_name: 'other' }, { identity_arguments: 'value text' },
    { return_type: 'text' }, { kind: 'p' }, { definition_hash_md5: '0'.repeat(32) }]) {
    const snapshot = JSON.parse(SNAPSHOT);
    Object.assign(snapshot.sections.functions.rows.find(row => row.function_name === 'update_updated_at_column'), mutation);
    assert.throws(() => trigger.loadPinnedTargets(Buffer.from(JSON.stringify(snapshot))), /PINNED_SNAPSHOT_MISMATCH/);
  }
});

test('trigger collection reuses the validated query and emits only pinned identity parameters', async () => {
  requireImplementation();
  assert.equal(trigger.TARGET_SQL, routines.TARGET_SQL);
  const row = syntheticRow();
  const { definition, ...target } = row;
  const calls = [];
  const result = await trigger.collect({ query: async (sql, values) => {
    calls.push({ sql, values });
    if (sql.includes('SELECT current_user')) return { rows: [{ ...identity, server_version: SECRET, snapshot_time: SECRET }] };
    return { rows: sql === routines.TARGET_SQL ? [row] : [] };
  } }, [target]);
  assert.equal(result.status, 'captured');
  assert.equal(result.privateRows[0].definition, definition);
  assert.equal(result.targets[0].status, 'matched');
  assert.deepEqual(JSON.parse(calls.find(call => call.sql === routines.TARGET_SQL).values[0]),
    [{ schema_name: 'public', function_name: 'update_updated_at_column', identity_arguments: '' }]);
  assert.match(calls[0].sql, /REPEATABLE READ READ ONLY/);
  assert.equal(calls.at(-1).sql, 'ROLLBACK');
  const { privateRows, ...publicResult } = result;
  assertPrivate(publicResult);
});

// Execute the entry and all shared production modules. Only external pg,
// credential/CA reads, paths and the timer boundary are replaced. Filesystem
// permissions, exclusive creation and the actual persistence logic stay real.
async function runMain(t, { argv = [], snapshot = SNAPSHOT, credentials, rows = [syntheticRow()], session = {},
  authorized = true, hangAt, queryError, closeError, privateMode } = {}) {
  requireImplementation();
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'saga-trigger-test-')));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  if (privateMode !== undefined) {
    const directory = path.join(root, 'supabase/.temp/routine-audit');
    fs.mkdirSync(directory, { recursive: true, mode: privateMode });
    fs.chmodSync(directory, privateMode);
  }
  const output = [], writes = [], calls = [], reads = [], configurations = [], deadlineLimits = [];
  const timers = new Map();
  const processStub = { argv: ['node', MODULE_PATH, ...argv] };
  const translate = file => typeof file === 'string' && (file === ROOT || file.startsWith(ROOT + path.sep)) ? root + file.slice(ROOT.length) : file;
  const pending = () => new Promise(() => {});
  const stream = { authorized, destroyed: false, getProtocol: () => 'TLSv1.3', destroy() { this.destroyed = true; } };
  class Client {
    constructor(config) { configurations.push(config); this.connection = { stream }; }
    on() {}
    async connect() { calls.push({ sql: 'connect' }); if (hangAt === 'connect') return pending(); }
    async query(sql, values) {
      calls.push({ sql, values });
      if (hangAt === 'collect' && sql.startsWith('BEGIN')) return pending();
      if (hangAt === 'rollback' && sql === 'ROLLBACK') return pending();
      if (sql.includes('SELECT current_user')) return { rows: [{ ...identity, ...session }] };
      if (sql === routines.TARGET_SQL) {
        if (queryError) throw Object.assign(new Error(SECRET), { code: queryError });
        return { rows };
      }
      return { rows: [] };
    }
    async end() {
      calls.push({ sql: 'end' });
      if (hangAt === 'close') return pending();
      if (closeError) throw Object.assign(new Error(SECRET), { code: closeError });
    }
  }
  const fakeFs = { ...fs };
  for (const name of ['lstatSync', 'statSync', 'mkdirSync', 'openSync', 'realpathSync']) fakeFs[name] = (file, ...args) => fs[name](translate(file), ...args);
  fakeFs.readFileSync = (file, ...args) => {
    reads.push(file);
    if (file === path.join(ROOT, SNAPSHOT_PATH)) return snapshot;
    if (typeof file === 'string' && file.startsWith(path.join(ROOT, 'scripts/'))) return fs.readFileSync(file, ...args);
    if (typeof file === 'string' && file.endsWith('/metadata-reader-credentials')) return credentials ??
      `host=aws-0-us-east-2.pooler.supabase.com\nport=5432\ndatabase=postgres\nuser=metadata_reader.encdblxyxztvfxotfuyh\npassword=${SECRET}`;
    if (typeof file === 'string' && file.endsWith('/supabase-prod-ca-2021.crt')) return 'synthetic-ca';
    return fs.readFileSync(translate(file), ...args);
  };
  fakeFs.writeFileSync = (file, data, ...args) => { writes.push({ file, data }); return fs.writeFileSync(translate(file), data, ...args); };
  const context = vm.createContext({ process: processStub, Buffer, Date,
    console: { log: value => output.push(value), error: value => output.push(value) },
    setTimeout: (callback, ms) => { const id = {}; timers.set(id, callback); deadlineLimits.push(ms); return id; },
    clearTimeout: id => timers.delete(id) });
  const cache = new Map();
  function load(filename, entry = false) {
    if (cache.has(filename)) return cache.get(filename).exports;
    const moduleStub = { exports: {} };
    cache.set(filename, moduleStub);
    const requireStub = name => {
      if (name === 'node:fs') return fakeFs;
      if (name === '../experiments/t05-durable-worker/node_modules/pg') return { Client };
      if (['node:path', 'node:crypto'].includes(name)) return require(name);
      if (name.startsWith('./')) return load(path.resolve(path.dirname(filename), name));
      throw new Error('Unexpected module');
    };
    if (entry) requireStub.main = moduleStub;
    vm.runInContext('(function(require,module,__filename,__dirname){\n' + fs.readFileSync(filename, 'utf8') + '\n})', context,
      { filename })(requireStub, moduleStub, filename, path.dirname(filename));
    return moduleStub.exports;
  }
  load(MODULE_PATH, true);
  await new Promise(resolve => setImmediate(resolve));
  if (hangAt) {
    for (const callback of [...timers.values()]) callback();
    await new Promise(resolve => setImmediate(resolve));
  }
  const reports = writes.filter(write => typeof write.file === 'string' && write.file.includes('/docs/research/')).map(write => JSON.parse(write.data));
  assert.equal(reports.length, 1, 'the CLI must save one safe report');
  assertPrivate(reports);
  assertPrivate(output);
  return { root, report: reports[0], output, calls, reads, configurations, deadlineLimits, timers, processStub, stream };
}

test('the trigger CLI persists definition drift privately and records exact scope, hashes and verified configuration', async t => {
  const result = await runMain(t);
  const { report } = result;
  assert.equal(report.status, 'drift');
  assert.equal(result.processStub.exitCode, 2);
  assert.equal(report.targets.length, 1);
  assert.equal(report.targets[0].status, 'definition_changed');
  assert.equal(report.targets[0].expectedDefinitionMd5, TRIGGER_MD5);
  assert.equal(report.snapshotSha256, SNAPSHOT_SHA256);
  assert.equal(report.snapshotPath, SNAPSHOT_PATH);
  assert.equal(report.tlsVerificationDisabled, false);
  assert.equal(report.connectionClosed, true);
  assert.deepEqual(report.connectionCleanup, { status: 'closed' });
  assert.equal(report.caSha256, digest('synthetic-ca'));
  const query = result.calls.find(call => call.sql === routines.TARGET_SQL);
  assert.deepEqual(JSON.parse(query.values[0]), [{ schema_name: 'public', function_name: 'update_updated_at_column', identity_arguments: '' }]);
  assert.deepEqual(result.calls.map(call => call.sql).filter(sql => sql === routines.TARGET_SQL), [routines.TARGET_SQL]);
  assert.match(result.calls[1].sql, /^BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY$/);
  assert.match(result.calls[2].sql, /statement_timeout='10s'.*lock_timeout='2s'.*idle_in_transaction_session_timeout='15s'/);
  assert.deepEqual(result.calls.slice(-2).map(call => call.sql), ['ROLLBACK', 'end']);
  const config = result.configurations[0];
  assert.equal(config.user, 'metadata_reader.encdblxyxztvfxotfuyh');
  assert.equal(config.ssl.rejectUnauthorized, true);
  assert.equal(config.ssl.ca, 'synthetic-ca');
  assert.equal(config.connectionTimeoutMillis, 10000);
  assert.match(config.options, /default_transaction_read_only=on/);
  assert.deepEqual(result.deadlineLimits, [90000]);
  assert.equal(result.timers.size, 0);
  const saved = report.privateCapture;
  assert.match(saved.relativePath, /^supabase\/\.temp\/routine-audit\/capture-/);
  const filename = path.join(result.root, saved.relativePath);
  const bytes = fs.readFileSync(filename);
  assert.equal(saved.sha256, digest(bytes));
  assert.equal(saved.permissionsVerified, true);
  assert.equal(fs.statSync(filename).mode & 0o777, 0o600);
  assert.equal(fs.statSync(path.dirname(filename)).mode & 0o777, 0o700);
  assert.equal(JSON.parse(bytes).definitions[0].definition, syntheticRow().definition);
  for (const source of ['inspect-supabase-trigger.cjs', 'inspect-supabase-routines.cjs', 'supabase-capture-runtime.cjs']) {
    assert.equal(report.sourceSha256[`scripts/${source}`], digest(fs.readFileSync(path.join(ROOT, 'scripts', source))));
  }
});

test('CLI configuration is rejected before reading credentials or creating a client', async t => {
  for (const argv of [['--target=public.other()'], ['--snapshot', SECRET], ['--help'], [SECRET]]) {
    const result = await runMain(t, { argv });
    assert.equal(result.report.status, 'error');
    assert.equal(result.report.failure.stage, 'configuration');
    assert.equal(result.processStub.exitCode, 1);
    assert.equal(result.configurations.length, 0);
    assert.equal(result.reads.some(file => typeof file === 'string' && file.endsWith('/metadata-reader-credentials')), false);
  }
});

test('snapshot drift blocks credential access and connection creation', async t => {
  for (const snapshot of [Buffer.from(SECRET), Buffer.concat([SNAPSHOT, Buffer.from('\n')])]) {
    const result = await runMain(t, { snapshot });
    assert.equal(result.report.status, 'error');
    assert.equal(result.report.failure.stage, 'configuration');
    assert.equal(result.processStub.exitCode, 1);
    assert.equal(result.configurations.length, 0);
    assert.equal(result.reads.some(file => typeof file === 'string' && file.endsWith('/metadata-reader-credentials')), false);
  }
});

test('invalid credentials cannot construct a client and raw configuration stays out of reports', async t => {
  const result = await runMain(t, { credentials: `host=${SECRET}\npassword=${SECRET}` });
  assert.equal(result.report.status, 'error');
  assert.equal(result.report.failure.stage, 'configuration');
  assert.equal(result.processStub.exitCode, 1);
  assert.equal(result.configurations.length, 0);
});

test('missing and attribute-drift trigger rows cannot report a matched capture', async t => {
  const absent = { ...PINNED, definition: null };
  for (const key of Object.keys(absent)) if (!['schema_name', 'function_name', 'identity_arguments'].includes(key)) absent[key] = null;
  for (const [rows, status] of [[[], 'missing'], [[absent], 'missing'], [[{ ...syntheticRow(), return_type: 'text' }], 'attributes_changed'],
    [[{ ...syntheticRow(), security_definer: true }], 'attributes_changed']]) {
    const result = await runMain(t, { rows });
    assert.equal(result.report.status, 'drift');
    assert.equal(result.report.targets[0].status, status);
    assert.equal(result.processStub.exitCode, 2);
  }
});

test('wrong identities, duplicates, invalid digests and malformed rows produce only safe errors', async t => {
  const row = syntheticRow();
  for (const rows of [[{ ...row, schema_name: SECRET }], [{ ...row, function_name: SECRET }],
    [{ ...row, identity_arguments: SECRET }], [row, row], [{ ...row, definition_hash_md5: TRIGGER_MD5 }],
    [{ ...row, owner: null }], [{ definition: SECRET }], null]) {
    const result = await runMain(t, { rows });
    assert.equal(result.report.status, 'error');
    assert.equal(result.report.failure.stage, 'collect');
    assert.equal(result.processStub.exitCode, 1);
    assert.equal(result.report.privateCapture, undefined);
    assert.equal(result.calls.at(-2).sql, 'ROLLBACK');
  }
});

test('unsafe backend session properties prevent definition reads and still roll back', async t => {
  for (const session of [{ current_user: 'postgres' }, { current_database: SECRET }, { read_only: 'off' },
    { isolation: 'read committed' }, { statement_timeout: '0' }, { lock_timeout: '0' }, { idle_transaction_timeout: '0' }]) {
    const result = await runMain(t, { session });
    assert.equal(result.report.status, 'error');
    assert.equal(result.calls.some(call => call.sql === routines.TARGET_SQL), false);
    assert.equal(result.calls.at(-2).sql, 'ROLLBACK');
    assert.equal(result.processStub.exitCode, 1);
  }
});

test('unverified TLS prevents any transaction or definition read', async t => {
  const result = await runMain(t, { authorized: false });
  assert.equal(result.report.status, 'error');
  assert.equal(result.report.failure.stage, 'connect');
  assert.deepEqual(result.calls.map(call => call.sql), ['connect', 'end']);
  assert.equal(result.processStub.exitCode, 1);
});

test('a denied catalog read is rolled back and reports the allowlisted code only', async t => {
  const result = await runMain(t, { queryError: '42501' });
  assert.equal(result.report.status, 'error');
  assert.deepEqual(result.report.failure, { stage: 'collect', code: '42501' });
  assert.equal(result.calls.at(-2).sql, 'ROLLBACK');
  assert.equal(result.processStub.exitCode, 1);
});

for (const [hangAt, stage] of [['connect', 'connect'], ['collect', 'collect'], ['rollback', 'collect'], ['close', 'close']]) {
  test(`the trigger CLI enforces its asynchronous deadline when ${hangAt} hangs`, async t => {
    const result = await runMain(t, { hangAt });
    assert.equal(result.report.status, 'error');
    assert.deepEqual(result.report.failure, { stage, code: 'CAPTURE_DEADLINE' });
    assert.equal(result.report.captureDeadline.exceeded, true);
    assert.equal(result.report.connectionClosed, false);
    assert.deepEqual(result.report.connectionCleanup, { status: 'forced', streamDestroyed: true });
    assert.deepEqual(result.deadlineLimits, [90000]);
    assert.equal(result.timers.size, 0);
    assert.equal(result.processStub.exitCode, 1);
  });
}

test('a later close error retains completed private evidence without reporting capture success', async t => {
  const result = await runMain(t, { closeError: 'ECONNRESET' });
  assert.equal(result.report.status, 'error');
  assert.deepEqual(result.report.failure, { stage: 'close', code: 'ECONNRESET' });
  assert.equal(result.report.connectionClosed, false);
  assert.equal(result.report.privateCapture.permissionsVerified, true);
  assert.ok(fs.existsSync(path.join(result.root, result.report.privateCapture.relativePath)));
  assert.equal(result.processStub.exitCode, 1);
});

test('an insecure existing private directory prevents persistence and successful reporting', async t => {
  const result = await runMain(t, { privateMode: 0o755 });
  assert.equal(result.report.status, 'error');
  assert.equal(result.report.privateCapture, undefined);
  assert.equal(result.report.connectionClosed, true);
  assert.equal(result.processStub.exitCode, 1);
  assert.deepEqual(fs.readdirSync(path.join(result.root, 'supabase/.temp/routine-audit')), []);
});
