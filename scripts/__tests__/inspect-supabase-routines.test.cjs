const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createHash } = require('node:crypto');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '../..');
const snapshotPath = 'docs/research/evidence/2026-10-17-remote-metadata/snapshot-2026-10-17T06-13-03-052Z.json';
const snapshotBytes = fs.readFileSync(path.join(ROOT, snapshotPath));
const expectedSha = '8b2a4647b017305183e67b2b932be02080a789dba4fc48b23b2f23a97991e66e';
const SECRET = 'FAKE_ROUTINE_SECRET_73924';
const digest = (value, algorithm = 'sha256') => createHash(algorithm).update(value).digest('hex');
const modulePath = path.resolve(__dirname, '../inspect-supabase-routines.cjs');
const routine = fs.existsSync(modulePath) ? require(modulePath) : {};
const targetsFromSnapshot = JSON.parse(snapshotBytes).sections.functions.rows.filter(row =>
  row.schema_name === 'public' && row.security_definer === true && row.return_type !== 'trigger');
const syntheticRows = () => targetsFromSnapshot.map((target, index) => {
  const definition = `CREATE OR REPLACE FUNCTION public.synthetic_${index}() RETURNS text LANGUAGE sql SECURITY DEFINER AS $body$ SELECT '${SECRET}'::text $body$;\n`;
  return { ...target, definition, definition_hash_md5: digest(definition, 'md5') };
});
const syntheticTargets = () => syntheticRows().map(({ definition, ...target }) => target);
const assertPrivate = value => assert.equal(JSON.stringify(value).includes(SECRET), false, 'public data contains a synthetic private literal');

test('the entry point binds exactly twelve targets to the immutable snapshot bytes', () => {
  assert.equal(typeof routine.loadPinnedTargets, 'function', 'pinned target loader must exist');
  const targets = routine.loadPinnedTargets(snapshotBytes);
  assert.equal(targets.length, 12);
  assert.deepEqual(targets, targetsFromSnapshot);
  assert.equal(routine.SNAPSHOT_SHA256, expectedSha);
  assert.throws(() => routine.loadPinnedTargets(Buffer.concat([snapshotBytes, Buffer.from('\n')])), /PINNED_SNAPSHOT_MISMATCH/);
  assert.throws(() => routine.loadPinnedTargets(Buffer.from(SECRET)), error => {
    assertPrivate(error.message); return true;
  });
});

test('catalog SQL binds exact identities and never invokes public functions or reads business relations', () => {
  assert.equal(typeof routine.TARGET_SQL, 'string', 'restricted catalog SQL must exist');
  const sql = routine.TARGET_SQL;
  assert.match(sql, /pg_catalog\.jsonb_to_recordset\(\$1::jsonb\)/);
  for (const name of ['schema_name', 'function_name', 'identity_arguments']) assert.ok(sql.includes(`target.${name}`));
  assert.match(sql, /pg_catalog\.pg_get_function_identity_arguments\(p\.oid\)\s*=\s*target\.identity_arguments/);
  assert.match(sql, /pg_catalog\.pg_get_functiondef\(p\.oid\)/);
  assert.doesNotMatch(sql, /;|\b(?:public|storage)\.\w+\s*\(|\b(?:INSERT|UPDATE|DELETE|GRANT|REVOKE|ALTER|CALL)\b/i);
  assert.ok([...sql.matchAll(/\b(?:FROM|JOIN)\s+([a-z_]+)\./gi)].every(match => match[1] === 'pg_catalog'));
  assert.doesNotMatch(sql, /prosrc|probin|proargdefaults|pg_get_function_arguments\(/);
});

test('matched definitions stay exact privately while the public result contains only pinned identities and hashes', () => {
  assert.equal(typeof routine.validateRows, 'function', 'definition validator must exist');
  const rows = syntheticRows();
  const result = routine.validateRows(rows, syntheticTargets());
  assert.equal(result.status, 'captured');
  assert.equal(result.privateRows.length, 12);
  assert.equal(result.privateRows[0].definition, rows[0].definition);
  assertPrivate(result.targets);
  assert.ok(result.targets.every(target => target.status === 'matched'));
});

test('definition drift is explicit and a changed body can only be retained privately', () => {
  assert.equal(typeof routine.validateRows, 'function');
  const rows = syntheticRows();
  rows[0].definition += `-- ${SECRET} changed\n`;
  rows[0].definition_hash_md5 = digest(rows[0].definition, 'md5');
  const result = routine.validateRows(rows, syntheticTargets());
  assert.equal(result.status, 'drift');
  assert.equal(result.targets[0].status, 'definition_changed');
  assert.equal(result.privateRows[0].definition, rows[0].definition);
  assertPrivate(result.targets);
});

test('security and identity attribute changes prevent a pinned success without reflecting new values', () => {
  assert.equal(typeof routine.validateRows, 'function');
  for (const [key, value] of Object.entries({ security_definer: false, owner: SECRET, return_type: SECRET,
    language: SECRET, kind: 'p', volatility: 's', is_strict: true, leakproof: true,
    search_path: [`search_path=${SECRET}`], public_execute: false, public_execute_grantable: true, acl_is_null: true })) {
    const rows = syntheticRows();
    rows[0][key] = value;
    const result = routine.validateRows(rows, syntheticTargets());
    assert.equal(result.status, 'drift', key);
    assert.equal(result.targets[0].status, 'attributes_changed', key);
    assertPrivate(result.targets);
  }
});

test('missing, duplicate, unexpected, malformed and falsely hashed rows never become successful evidence', () => {
  assert.equal(typeof routine.validateRows, 'function');
  const missing = routine.validateRows(syntheticRows().slice(1), syntheticTargets());
  assert.equal(missing.status, 'drift');
  assert.equal(missing.targets[0].status, 'missing');
  const leftJoinMissing = syntheticRows();
  for (const key of Object.keys(leftJoinMissing[0])) {
    if (!['schema_name', 'function_name', 'identity_arguments'].includes(key)) leftJoinMissing[0][key] = null;
  }
  const missingRow = routine.validateRows(leftJoinMissing, syntheticTargets());
  assert.equal(missingRow.status, 'drift');
  assert.equal(missingRow.targets[0].status, 'missing');
  const mutations = [
    rows => [...rows, rows[0]],
    rows => [{ ...rows[0], function_name: SECRET }, ...rows.slice(1)],
    rows => [{ ...rows[0], definition: null }, ...rows.slice(1)],
    rows => [{ ...rows[0], definition_hash_md5: '0'.repeat(32) }, ...rows.slice(1)],
    rows => [{ ...rows[0], definition_hash_md5: SECRET }, ...rows.slice(1)],
    rows => [{ ...rows[0], security_definer: SECRET }, ...rows.slice(1)],
    () => null,
  ];
  for (const mutate of mutations) assert.throws(() => routine.validateRows(mutate(syntheticRows()), syntheticTargets()), error => {
    assertPrivate(error.message); return true;
  });
});

const identity = { current_user: 'metadata_reader', current_database: 'postgres', read_only: 'on', isolation: 'repeatable read',
  server_version: '17.4', statement_timeout: '10s', lock_timeout: '2s', idle_transaction_timeout: '15s',
  snapshot_time: new Date('2026-10-17T00:00:00Z') };

test('routine collection verifies a read-only snapshot and sends only the pinned signatures as parameters', async () => {
  assert.equal(typeof routine.collect, 'function');
  const calls = [];
  const client = { query: async (sql, values) => {
    calls.push({ sql, values });
    if (sql.includes('SELECT current_user')) return { rows: [{ ...identity, diagnostic: SECRET }] };
    return { rows: sql === routine.TARGET_SQL ? syntheticRows() : [] };
  } };
  const result = await routine.collect(client, syntheticTargets());
  assert.equal(result.status, 'captured');
  assert.match(calls[0].sql, /REPEATABLE READ READ ONLY/);
  assert.equal(calls.at(-1).sql, 'ROLLBACK');
  const query = calls.find(call => call.sql === routine.TARGET_SQL);
  assert.deepEqual(JSON.parse(query.values[0]), syntheticTargets().map(({ schema_name, function_name, identity_arguments }) =>
    ({ schema_name, function_name, identity_arguments })));
  assertPrivate(result.identity);
});

test('unsafe session identity and denied reads roll back without exposing server diagnostics', async () => {
  assert.equal(typeof routine.collect, 'function');
  for (const override of [{ current_user: 'postgres' }, { read_only: 'off' }, { isolation: 'read committed' },
    { current_database: SECRET }, { statement_timeout: '1min' }, { lock_timeout: '0' }, { idle_transaction_timeout: '0' }]) {
    const calls = [];
    await assert.rejects(routine.collect({ query: async sql => {
      calls.push(sql); return { rows: [{ ...identity, ...override }] };
    } }, syntheticTargets()));
    assert.equal(calls.some(sql => sql === routine.TARGET_SQL), false);
    assert.equal(calls.at(-1), 'ROLLBACK');
  }
  const calls = [];
  await assert.rejects(routine.collect({ query: async sql => {
    calls.push(sql);
    if (sql === routine.TARGET_SQL) throw Object.assign(new Error(SECRET), { code: '42501' });
    return { rows: [identity] };
  } }, syntheticTargets()));
  assert.equal(calls.at(-1), 'ROLLBACK');
});

function localRoot(t) {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'saga-routine-capture-test-')));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}

test('private persistence uses directory 0700 and exclusive file 0600 with exact content and verified hash', t => {
  assert.equal(typeof routine.savePrivateCapture, 'function');
  const root = localRoot(t);
  const data = { definitions: syntheticRows() };
  const saved = routine.savePrivateCapture(root, 'capture-test.json', data);
  assert.match(saved.relativePath, /^supabase\/\.temp\/routine-audit\/capture-test\.json$/);
  const filename = path.join(root, saved.relativePath);
  assert.equal(fs.statSync(path.dirname(filename)).mode & 0o777, 0o700);
  assert.equal(fs.statSync(filename).mode & 0o777, 0o600);
  assert.equal(saved.sha256, digest(fs.readFileSync(filename)));
  assert.equal(saved.permissionsVerified, true);
  assert.deepEqual(JSON.parse(fs.readFileSync(filename)), data);
  assertPrivate(saved);
  assert.throws(() => routine.savePrivateCapture(root, 'capture-test.json', {}));
  assert.deepEqual(JSON.parse(fs.readFileSync(filename)), data);
});

test('private persistence rejects traversal, insecure existing directories and symlinks at every directory depth', t => {
  assert.equal(typeof routine.savePrivateCapture, 'function');
  for (const filename of ['../outside.json', '/tmp/outside.json', `capture-${SECRET}/bad.json`]) {
    assert.throws(() => routine.savePrivateCapture(localRoot(t), filename, {}), error => { assertPrivate(error.message); return true; });
  }
  const root = localRoot(t);
  const directory = path.join(root, 'supabase/.temp/routine-audit');
  fs.mkdirSync(directory, { recursive: true, mode: 0o755 });
  fs.chmodSync(directory, 0o755);
  assert.throws(() => routine.savePrivateCapture(root, 'capture-test.json', {}));
  assert.equal(fs.statSync(directory).mode & 0o777, 0o755);
  for (const relative of ['supabase', 'supabase/.temp', 'supabase/.temp/routine-audit']) {
    const candidate = localRoot(t);
    const elsewhere = localRoot(t);
    const link = path.join(candidate, relative);
    fs.mkdirSync(path.dirname(link), { recursive: true });
    fs.symlinkSync(elsewhere, link, 'dir');
    assert.throws(() => routine.savePrivateCapture(candidate, 'capture-test.json', {}));
    assert.deepEqual(fs.readdirSync(elsewhere), []);
  }
});

test('an existing private file symlink is never followed or overwritten', t => {
  assert.equal(typeof routine.savePrivateCapture, 'function');
  const root = localRoot(t);
  const directory = path.join(root, 'supabase/.temp/routine-audit');
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  const outside = path.join(root, 'outside.json');
  fs.writeFileSync(outside, 'untouched');
  fs.symlinkSync(outside, path.join(directory, 'capture-test.json'));
  assert.throws(() => routine.savePrivateCapture(root, 'capture-test.json', { secret: SECRET }));
  assert.equal(fs.readFileSync(outside, 'utf8'), 'untouched');
});

test('private persistence rejects unexpectedly restrictive file modes without claiming verified evidence', t => {
  assert.equal(typeof routine.savePrivateCapture, 'function');
  const root = localRoot(t);
  fs.mkdirSync(path.join(root, 'supabase/.temp/routine-audit'), { recursive: true, mode: 0o700 });
  const oldMask = process.umask(0o777);
  try { assert.throws(() => routine.savePrivateCapture(root, 'capture-test.json', { secret: SECRET })); }
  finally { process.umask(oldMask); }
  assert.equal(fs.statSync(path.join(root, 'supabase/.temp/routine-audit/capture-test.json')).size, 0);
});

// Execute the CLI and shared lifecycle in one VM, replacing only pg, I/O paths,
// credentials and timers. No actual credential/CA reads or network connections.
async function runMain(t, { hangAt, authorized = true, closeError, destroyError, queryError, rows = syntheticRows() } = {}) {
  const root = localRoot(t);
  const output = [];
  const timers = new Map();
  const calls = [];
  const writes = [];
  const processStub = { argv: ['node', modulePath] };
  const translate = file => typeof file === 'string' && (file === ROOT || file.startsWith(ROOT + path.sep)) ? root + file.slice(ROOT.length) : file;
  const pending = () => new Promise(() => {});
  const stream = { authorized, destroyed: false, getProtocol: () => 'TLSv1.3', destroy() {
    calls.push('destroy'); if (destroyError) throw new Error(SECRET); this.destroyed = true;
  } };
  class Client {
    constructor() { this.connection = { stream }; }
    on() {}
    async connect() { calls.push('connect'); if (hangAt === 'connect') return pending(); }
    async query(sql, values) {
      calls.push(sql);
      if (hangAt === 'collect' && sql.startsWith('BEGIN')) return pending();
      if (hangAt === 'rollback' && sql === 'ROLLBACK') return pending();
      if (sql.includes('SELECT current_user')) return { rows: [identity] };
      if (sql === routine.TARGET_SQL) {
        if (queryError) throw Object.assign(new Error(SECRET), { code: queryError });
        assert.equal(JSON.parse(values[0]).length, 12);
        return { rows };
      }
      return { rows: [] };
    }
    async end() { calls.push('end'); if (hangAt === 'close') return pending(); if (closeError) throw Object.assign(new Error(SECRET), { code: closeError }); }
  }
  const fakeFs = { ...fs };
  for (const name of ['lstatSync', 'statSync', 'mkdirSync', 'openSync', 'realpathSync']) fakeFs[name] = (file, ...args) => fs[name](translate(file), ...args);
  fakeFs.readFileSync = (file, ...args) => {
    if (file === modulePath || file === path.join(ROOT, snapshotPath) || (typeof file === 'string' && file.startsWith(path.join(ROOT, 'scripts/')))) return fs.readFileSync(file, ...args);
    if (typeof file === 'string' && file.endsWith('/metadata-reader-credentials')) return 'host=aws-0-us-east-2.pooler.supabase.com\nport=5432\ndatabase=postgres\nuser=metadata_reader.encdblxyxztvfxotfuyh\npassword=' + SECRET;
    if (typeof file === 'string' && file.endsWith('/supabase-prod-ca-2021.crt')) return 'synthetic-ca';
    return fs.readFileSync(translate(file), ...args);
  };
  fakeFs.writeFileSync = (file, data, ...args) => { writes.push({ file, data }); return fs.writeFileSync(translate(file), data, ...args); };
  const context = vm.createContext({ process: processStub, Buffer, Date,
    console: { log: value => output.push(value), error: value => output.push(value) },
    setTimeout: (callback, ms) => { const id = {}; timers.set(id, { callback, ms }); return id; }, clearTimeout: id => timers.delete(id) });
  const cache = new Map();
  function load(filename, entry = false) {
    if (cache.has(filename)) return cache.get(filename).exports;
    const moduleStub = { exports: {} }; cache.set(filename, moduleStub);
    const requireStub = name => {
      if (name === 'node:fs') return fakeFs;
      if (name === '../experiments/t05-durable-worker/node_modules/pg') return { Client };
      if (['node:path', 'node:crypto'].includes(name)) return require(name);
      if (name.startsWith('./')) return load(path.resolve(path.dirname(filename), name));
      throw new Error('Unexpected module');
    };
    if (entry) requireStub.main = moduleStub;
    const source = fs.readFileSync(filename, 'utf8');
    vm.runInContext('(function(require,module,__filename,__dirname){\n' + source + '\n})', context, { filename })(requireStub, moduleStub, filename, path.dirname(filename));
    return moduleStub.exports;
  }
  load(modulePath, true);
  await new Promise(resolve => setImmediate(resolve));
  const deadlines = [...timers.values()].map(timer => timer.ms);
  if (hangAt) { for (const { callback } of [...timers.values()]) callback(); await new Promise(resolve => setImmediate(resolve)); }
  const publicWrites = writes.filter(write => typeof write.file === 'string' && write.file.includes('/docs/research/'));
  const reports = publicWrites.map(write => JSON.parse(write.data));
  assertPrivate(output);
  assertPrivate(reports);
  return { root, output, reports, writes, calls, processStub, timers, deadlines, stream };
}

for (const [hangAt, stage] of [['connect', 'connect'], ['collect', 'collect'], ['rollback', 'collect'], ['close', 'close']]) {
  test(`routine CLI records safe deadline evidence when ${hangAt} hangs`, async t => {
    assert.equal(typeof routine.collect, 'function');
    const result = await runMain(t, { hangAt });
    assert.equal(result.reports.length, 1);
    const report = result.reports[0];
    assert.equal(report.status, 'error');
    assert.deepEqual(report.failure, { stage, code: 'CAPTURE_DEADLINE' });
    assert.deepEqual(report.connectionCleanup, { status: 'forced', streamDestroyed: true });
    assert.equal(report.connectionClosed, false);
    assert.deepEqual(result.deadlines, [90000]);
    assert.equal(result.timers.size, 0);
    assert.equal(result.processStub.exitCode, 1);
  });
}

test('routine CLI privately retains drift, hashes its artifacts and reports bounded cleanup', async t => {
  assert.equal(typeof routine.collect, 'function');
  const result = await runMain(t);
  assert.equal(result.reports.length, 1);
  const report = result.reports[0];
  assert.equal(report.status, 'drift');
  assert.equal(report.connectionClosed, true);
  assert.equal(result.processStub.exitCode, 2);
  assert.equal(report.snapshotSha256, expectedSha);
  const saved = report.privateCapture;
  assert.equal(saved.permissionsVerified, true);
  const bytes = fs.readFileSync(path.join(result.root, saved.relativePath));
  assert.equal(saved.sha256, digest(bytes));
  assert.ok(bytes.includes(Buffer.from(SECRET)));
  assert.equal(Object.keys(report.sourceSha256).length, 3);
  assert.equal(result.timers.size, 0);
});

test('routine CLI never reflects raw diagnostics, malformed results, or cleanup exceptions', async t => {
  assert.equal(typeof routine.collect, 'function');
  for (const options of [{ queryError: '42501' }, { queryError: SECRET }, { rows: [{ definition: SECRET }] },
    { closeError: 'ECONNRESET' }, { hangAt: 'close', destroyError: true }, { authorized: false }]) {
    const result = await runMain(t, options);
    assert.equal(result.reports.length, 1);
    assert.equal(result.reports[0].status, 'error');
    assert.equal(result.processStub.exitCode, 1);
    if (options.authorized === false) assert.equal(result.calls.some(sql => sql.startsWith('BEGIN')), false);
  }
});

test('routine CLI preserves an earlier failure when closing subsequently reaches the deadline', async t => {
  assert.equal(typeof routine.collect, 'function');
  const result = await runMain(t, { queryError: '42501', hangAt: 'close' });
  const report = result.reports[0];
  assert.deepEqual(report.failure, { stage: 'collect', code: '42501' });
  assert.equal(report.captureDeadline.exceeded, true);
  assert.equal(report.connectionClosed, false);
});
