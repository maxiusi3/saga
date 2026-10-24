const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const { createHash } = require('node:crypto');
const routines = require('../inspect-supabase-routines.cjs');

const ROOT = path.resolve(__dirname, '../..');
const MODULE_PATH = path.join(ROOT, 'scripts/inspect-supabase-storage.cjs');
const SNAPSHOT_PATH = 'docs/research/evidence/2026-10-17-remote-metadata/snapshot-2026-10-17T06-13-03-052Z.json';
const SNAPSHOT_SHA256 = '8b2a4647b017305183e67b2b932be02080a789dba4fc48b23b2f23a97991e66e';
const SNAPSHOT = fs.readFileSync(path.join(ROOT, SNAPSHOT_PATH));
const storage = fs.existsSync(MODULE_PATH) ? require(MODULE_PATH) : {};
const SECRET = 'FAKE_STORAGE_PRIVATE_91374';
const digest = (bytes, algorithm = 'sha256') => createHash(algorithm).update(bytes).digest('hex');
const requireImplementation = () => assert.equal(typeof storage.loadPinnedTargets, 'function', 'fixed Storage collector must exist');
const assertPrivate = value => assert.equal(JSON.stringify(value).includes(SECRET), false, 'public output contains a synthetic private value');

test('the immutable snapshot selects exactly six function identities and seven bucket/object triggers', () => {
  requireImplementation();
  const targets = storage.loadPinnedTargets(SNAPSHOT);
  assert.equal(storage.SNAPSHOT_SHA256, SNAPSHOT_SHA256);
  assert.deepEqual(targets.functions.map(row => [row.schema_name, row.function_name, row.identity_arguments]), [
    ['storage', 'enforce_bucket_lifecycle_service_role', ''],
    ['storage', 'enforce_bucket_name_length', ''],
    ['storage', 'foldername', 'name text'],
    ['storage', 'protect_bucket_control_columns', ''],
    ['storage', 'protect_delete', ''],
    ['storage', 'update_updated_at_column', ''],
  ]);
  assert.deepEqual(targets.triggers.map(row => [row.schema_name, row.table_name, row.trigger_name]), [
    ['storage', 'buckets', 'enforce_bucket_name_length_trigger'],
    ['storage', 'buckets', 'protect_bucket_control_insert'],
    ['storage', 'buckets', 'protect_bucket_control_update'],
    ['storage', 'buckets', 'protect_bucket_control_update_role'],
    ['storage', 'buckets', 'protect_buckets_delete'],
    ['storage', 'objects', 'protect_objects_delete'],
    ['storage', 'objects', 'update_objects_updated_at'],
  ]);
  const snapshot = JSON.parse(SNAPSHOT);
  assert.deepEqual(targets.triggers, snapshot.sections.triggers.rows.filter(row => row.schema_name === 'storage'));
  assert.equal(new Set(targets.triggers.map(row => row.function_name)).size, 5);
  assert.equal(targets.triggers.filter(row => row.argument_count === 1).length, 2);
  for (const bytes of [Buffer.concat([SNAPSHOT, Buffer.from('\n')]), Buffer.from('{}'), Buffer.from(SECRET)]) {
    assert.throws(() => storage.loadPinnedTargets(bytes), /PINNED_SNAPSHOT_MISMATCH/);
  }
});

const pinned = () => storage.loadPinnedTargets(SNAPSHOT);
const syntheticTrigger = (target = pinned().triggers[0], overrides = {}) => {
  const definition = `CREATE TRIGGER ${target.trigger_name} BEFORE INSERT ON storage.${target.table_name} FOR EACH ROW EXECUTE FUNCTION storage.enforce_bucket_name_length('${SECRET}');`;
  return { ...target, definition, definition_hash_md5: digest(definition, 'md5'),
    arguments_hex: target.argument_count ? Buffer.from(`${SECRET}\0`.repeat(target.argument_count)).toString('hex') : '',
    condition: target.condition_present ? `(new.name <> '${SECRET}'::text)` : null, ...overrides };
};
const triggerTarget = row => {
  const { definition, arguments_hex, condition, ...target } = row;
  return target;
};

test('trigger definition capture retains private data and publishes only fixed identities and fingerprints', () => {
  const row = syntheticTrigger(undefined, { transport_secret: SECRET });
  const result = storage.validateTriggerRows([row], [triggerTarget(row)]);
  assert.equal(result.status, 'captured');
  assert.equal(result.targets[0].status, 'matched');
  assert.equal(result.targets[0].definitionSha256, digest(row.definition));
  assert.equal(result.targets[0].argumentsSha256, digest(Buffer.from(row.arguments_hex, 'hex')));
  assert.equal(result.targets[0].conditionSha256, null);
  assert.equal(result.privateRows[0].definition, row.definition);
  assert.equal(result.privateRows[0].arguments_hex, '');
  assert.equal(result.privateRows[0].condition, null);
  assert.equal(result.privateRows[0].transport_secret, undefined);
  const { privateRows, ...publicResult } = result;
  assertPrivate(publicResult);
});

test('trigger arguments distinguish none, an empty argument, text and multiple NUL-terminated arguments', () => {
  for (const [argument_count, arguments_hex] of [[0, ''], [1, '00'], [1, '616200'], [2, '00616200'], [2, '0000']]) {
    const row = syntheticTrigger(undefined, { argument_count, arguments_hex });
    const result = storage.validateTriggerRows([row], [triggerTarget(row)]);
    assert.equal(result.status, 'captured');
    assert.equal(result.privateRows[0].arguments_hex, arguments_hex);
  }
});

test('condition presence must agree with a nonempty expression or null', () => {
  const row = syntheticTrigger(undefined, { condition_present: true, condition: `(new.name <> '${SECRET}'::text)` });
  const result = storage.validateTriggerRows([row], [triggerTarget(row)]);
  assert.equal(result.status, 'captured');
  assert.equal(result.targets[0].conditionSha256, digest(row.condition));
  assert.equal(result.privateRows[0].condition, row.condition);
  assertPrivate(result.targets);
  for (const change of [{ condition: null }, { condition: '' }, { condition: '   ' }, { condition: 42 },
    { condition_present: false }, { condition_present: 'true' }]) {
    assert.throws(() => storage.validateTriggerRows([{ ...row, ...change }], [triggerTarget(row)]), /MALFORMED_TRIGGER_RESULT/);
  }
});

test('malformed argument bytes and counts never pass validation', () => {
  const row = syntheticTrigger();
  for (const change of [{ arguments_hex: null }, { arguments_hex: 'x0' }, { arguments_hex: '0' },
    { arguments_hex: 'AA00', argument_count: 1 }, { arguments_hex: '61', argument_count: 1 },
    { arguments_hex: '0061', argument_count: 1 }, { arguments_hex: '6100', argument_count: 0 },
    { arguments_hex: '610000', argument_count: 1 }, { arguments_hex: '', argument_count: 1 },
    { argument_count: -1 }, { argument_count: 0.1 }, { argument_count: 32768 }, { argument_count: '0' }]) {
    assert.throws(() => storage.validateTriggerRows([{ ...row, ...change }], [triggerTarget(row)]), /MALFORMED_TRIGGER_RESULT/);
  }
});

test('missing rows and every pinned attribute change are drift, with raw values kept private', () => {
  const row = syntheticTrigger();
  const target = triggerTarget(row);
  const absent = Object.fromEntries(Object.keys(row).map(key => [key,
    ['schema_name', 'table_name', 'trigger_name'].includes(key) ? row[key] : null]));
  for (const rows of [[], [absent]]) {
    const result = storage.validateTriggerRows(rows, [target]);
    assert.equal(result.status, 'drift');
    assert.equal(result.targets[0].status, 'missing');
    assert.equal(result.privateRows.length, 0);
  }
  for (const [field, value] of [['enabled', 'D'], ['type_bitmask', 19], ['function_schema', SECRET],
    ['function_name', SECRET], ['function_identity_arguments', SECRET], ['is_constraint', true],
    ['argument_count', 1], ['condition_present', true]]) {
    const changed = { ...row, [field]: value };
    if (field === 'argument_count') changed.arguments_hex = '00';
    if (field === 'condition_present') changed.condition = SECRET;
    const result = storage.validateTriggerRows([changed], [target]);
    assert.equal(result.status, 'drift');
    assert.equal(result.targets[0].status, 'attributes_changed');
    assert.deepEqual(result.targets[0].changedAttributes, [field]);
    assertPrivate(result.targets);
  }
  const definition = row.definition + '\n';
  const result = storage.validateTriggerRows([{ ...row, definition, definition_hash_md5: digest(definition, 'md5') }], [target]);
  assert.equal(result.status, 'drift');
  assert.equal(result.targets[0].status, 'definition_changed');
});

test('unexpected identities, duplicates and partially missing trigger rows are errors', () => {
  const row = syntheticTrigger();
  const target = triggerTarget(row);
  for (const rows of [null, {}, [null], [row, row], [{ ...row, schema_name: SECRET }],
    [{ ...row, table_name: SECRET }], [{ ...row, trigger_name: SECRET }], [{ ...row, enabled: null }],
    [{ ...row, enabled: 'invalid' }], [{ ...row, type_bitmask: -1 }], [{ ...row, type_bitmask: 128 }],
    [{ ...row, is_constraint: 'false' }], [{ ...row, definition: '' }], [{ ...row, definition_hash_md5: '0'.repeat(32) }],
    [{ ...row, definition: null, definition_hash_md5: null }], [{ ...row, function_name: '' }]]) {
    assert.throws(() => storage.validateTriggerRows(rows, [target]), /(?:MALFORMED|UNEXPECTED)_TRIGGER_RESULT/);
  }
});

const identity = { current_user: 'metadata_reader', current_database: 'postgres', read_only: 'on', isolation: 'repeatable read',
  server_version: '17.4', statement_timeout: '10s', lock_timeout: '2s', idle_transaction_timeout: '15s',
  snapshot_time: new Date('2026-10-23T00:00:00Z') };
function fixture() {
  const targets = pinned();
  const functions = targets.functions.map(target => {
    const definition = `CREATE FUNCTION storage.${target.function_name}(${target.identity_arguments}) RETURNS ${target.return_type} LANGUAGE plpgsql AS $body$ BEGIN /* ${SECRET} */ RETURN NULL; END $body$;\n`;
    return { ...target, definition, definition_hash_md5: digest(definition, 'md5'), transport_secret: SECRET };
  });
  const triggers = targets.triggers.map(target => syntheticTrigger(target, { transport_secret: SECRET }));
  return { functions, triggers, targets: {
    functions: functions.map(({ definition, transport_secret, ...row }) => row), triggers: triggers.map(triggerTarget) } };
}
function fakeClient(rows, session = {}) {
  const calls = [];
  return { calls, query: async (sql, values) => {
    calls.push({ sql, values });
    if (sql.includes('SELECT current_user')) return { rows: [{ ...identity, ...session }] };
    if (sql === storage.TARGET_SQL) return { rows: rows.functions };
    if (sql === storage.TRIGGER_SQL) return { rows: rows.triggers };
    return { rows: [] };
  } };
}

test('combined collection sends only exact identity parameters and uses one bounded read-only snapshot', async () => {
  const rows = fixture();
  const client = fakeClient(rows, { server_version: SECRET, snapshot_time: SECRET });
  const result = await storage.collect(client, rows.targets);
  assert.equal(result.status, 'captured');
  assert.equal(result.functions.length, 6);
  assert.equal(result.triggers.length, 7);
  assert.equal(result.privateRows.functions.length, 6);
  assert.equal(result.privateRows.triggers.length, 7);
  assert.equal(storage.TARGET_SQL, routines.TARGET_SQL);
  assert.deepEqual(JSON.parse(client.calls.find(call => call.sql === storage.TARGET_SQL).values[0]),
    rows.targets.functions.map(({ schema_name, function_name, identity_arguments }) => ({ schema_name, function_name, identity_arguments })));
  assert.deepEqual(JSON.parse(client.calls.find(call => call.sql === storage.TRIGGER_SQL).values[0]),
    rows.targets.triggers.map(({ schema_name, table_name, trigger_name }) => ({ schema_name, table_name, trigger_name })));
  assert.equal(client.calls.filter(call => call.sql.startsWith('BEGIN')).length, 1);
  assert.equal(client.calls[0].sql, 'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  assert.match(client.calls[1].sql, /statement_timeout='10s'.*lock_timeout='2s'.*idle_in_transaction_session_timeout='15s'/);
  assert.equal(client.calls.at(-1).sql, 'ROLLBACK');
  const { privateRows, ...publicResult } = result;
  assertPrivate(publicResult);
  assert.equal(JSON.stringify(privateRows).includes('transport_secret'), false);
});

test('overbroad, duplicate, changed or incomplete target sets are rejected before any SQL', async () => {
  for (const group of ['functions', 'triggers']) {
    for (const mutate of [rows => rows.slice(1), rows => [...rows, rows[0]],
      rows => [rows[0], ...rows.slice(0, -1)], rows => [{ ...rows[0], schema_name: 'public' }, ...rows.slice(1)]]) {
      const rows = fixture();
      rows.targets[group] = mutate(rows.targets[group]);
      const client = fakeClient(rows);
      await assert.rejects(storage.collect(client, rows.targets), /PINNED_TARGETS_INVALID/);
      assert.equal(client.calls.length, 0);
    }
  }
});

test('a missing or changed member of either group prevents combined capture success', async () => {
  for (const group of ['functions', 'triggers']) {
    const rows = fixture();
    rows[group] = rows[group].slice(1);
    const client = fakeClient(rows);
    const result = await storage.collect(client, rows.targets);
    assert.equal(result.status, 'drift');
    assert.equal(result[group][0].status, 'missing');
    assert.equal(client.calls.at(-1).sql, 'ROLLBACK');
  }
  const rows = fixture();
  rows.functions[0].security_definer = true;
  rows.triggers[0].enabled = 'D';
  const result = await storage.collect(fakeClient(rows), rows.targets);
  assert.equal(result.status, 'drift');
  assert.equal(result.functions[0].status, 'attributes_changed');
  assert.equal(result.triggers[0].status, 'attributes_changed');
});

test('unsafe sessions and malformed results roll back the combined transaction', async () => {
  for (const session of [{ current_user: 'postgres' }, { current_database: SECRET }, { read_only: 'off' },
    { isolation: 'read committed' }, { statement_timeout: '0' }, { lock_timeout: '0' }, { idle_transaction_timeout: '0' }]) {
    const rows = fixture(), client = fakeClient(rows, session);
    await assert.rejects(storage.collect(client, rows.targets));
    assert.equal(client.calls.some(call => call.sql === storage.TARGET_SQL || call.sql === storage.TRIGGER_SQL), false);
    assert.equal(client.calls.at(-1).sql, 'ROLLBACK');
  }
  for (const group of ['functions', 'triggers']) {
    const rows = fixture();
    rows[group][0].definition_hash_md5 = '0'.repeat(32);
    const client = fakeClient(rows);
    await assert.rejects(storage.collect(client, rows.targets));
    assert.equal(client.calls.at(-1).sql, 'ROLLBACK');
  }
});

// Execute the entry and all shared production modules. Only external pg,
// credential/CA reads, paths and the timer boundary are replaced. Filesystem
// permissions, exclusive creation and the actual persistence logic stay real.
async function runMain(t, { argv = [], snapshot = SNAPSHOT, credentials, rows = fixture(), session = {},
  authorized = true, hangAt, queryError, closeError, privateMode } = {}) {
  requireImplementation();
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'saga-storage-test-')));
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
      if (sql === storage.TARGET_SQL || sql === storage.TRIGGER_SQL) {
        if (queryError) throw Object.assign(new Error(SECRET), { code: queryError });
        return { rows: sql === storage.TARGET_SQL ? rows.functions : rows.triggers };
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

test('the fixed Storage CLI records drift privately with verified TLS, source hashes and connection cleanup', async t => {
  const result = await runMain(t);
  const { report } = result;
  assert.equal(report.status, 'drift');
  assert.equal(result.processStub.exitCode, 2);
  assert.equal(report.functions.length, 6);
  assert.equal(report.triggers.length, 7);
  assert.ok(report.functions.every(row => row.status === 'definition_changed'));
  assert.ok(report.triggers.every(row => row.status === 'definition_changed'));
  assert.equal(report.snapshotSha256, SNAPSHOT_SHA256);
  assert.equal(report.snapshotPath, SNAPSHOT_PATH);
  assert.equal(report.tlsVerificationDisabled, false);
  assert.equal(report.connectionClosed, true);
  assert.deepEqual(report.connectionCleanup, { status: 'closed' });
  assert.equal(report.caSha256, digest('synthetic-ca'));
  assert.deepEqual(result.calls.slice(-2).map(call => call.sql), ['ROLLBACK', 'end']);
  assert.equal(result.calls.filter(call => call.sql === storage.TARGET_SQL).length, 1);
  assert.equal(result.calls.filter(call => call.sql === storage.TRIGGER_SQL).length, 1);
  const config = result.configurations[0];
  assert.equal(config.user, 'metadata_reader.encdblxyxztvfxotfuyh');
  assert.equal(config.ssl.rejectUnauthorized, true);
  assert.equal(config.ssl.ca, 'synthetic-ca');
  assert.equal(config.connectionTimeoutMillis, 10000);
  assert.match(config.options, /default_transaction_read_only=on/);
  assert.deepEqual(result.deadlineLimits, [90000]);
  assert.equal(result.timers.size, 0);
  const saved = report.privateCapture;
  assert.match(saved.relativePath, /^supabase\/\.temp\/routine-audit\/capture-storage-/);
  const file = path.join(result.root, saved.relativePath);
  const bytes = fs.readFileSync(file), data = JSON.parse(bytes);
  assert.equal(saved.sha256, digest(bytes));
  assert.equal(saved.permissionsVerified, true);
  assert.equal(fs.statSync(file).mode & 0o777, 0o600);
  assert.equal(fs.statSync(path.dirname(file)).mode & 0o777, 0o700);
  assert.equal(data.definitions.functions[0].definition, fixture().functions[0].definition);
  assert.equal(data.conditionFormat, 'pg_node_tree');
  assert.equal(data.definitions.triggers[1].arguments_hex, fixture().triggers[1].arguments_hex);
  assert.equal(JSON.stringify(data).includes('transport_secret'), false);
  for (const source of ['inspect-supabase-storage.cjs', 'inspect-supabase-routines.cjs', 'supabase-capture-runtime.cjs']) {
    assert.equal(report.sourceSha256[`scripts/${source}`], digest(fs.readFileSync(path.join(ROOT, 'scripts', source))));
  }
  assert.equal(report.catalogQuerySha256.functions, digest(storage.TARGET_SQL));
  assert.equal(report.catalogQuerySha256.triggers, digest(storage.TRIGGER_SQL));
});

test('CLI overrides and snapshot drift are rejected before credentials or clients are accessed', async t => {
  for (const options of [{ argv: ['--target=public.other()'] }, { argv: ['--help'] }, { argv: ['--snapshot', SECRET] },
    { snapshot: Buffer.concat([SNAPSHOT, Buffer.from('\n')]) }, { snapshot: Buffer.from(SECRET) }]) {
    const result = await runMain(t, options);
    assert.equal(result.report.status, 'error');
    assert.equal(result.report.failure.stage, 'configuration');
    assert.equal(result.processStub.exitCode, 1);
    assert.equal(result.configurations.length, 0);
    assert.equal(result.reads.some(file => typeof file === 'string' && file.endsWith('/metadata-reader-credentials')), false);
  }
});

test('catalog refusal and malformed transport data report safe errors and roll back without private persistence', async t => {
  const malformed = fixture();
  malformed.triggers[0].arguments_hex = SECRET;
  for (const options of [{ queryError: '42501' }, { queryError: SECRET }, { rows: malformed }]) {
    const result = await runMain(t, options);
    assert.equal(result.report.status, 'error');
    assert.equal(result.report.failure.stage, 'collect');
    assert.equal(result.report.failure.code, options.queryError === '42501' ? '42501' : 'UNCLASSIFIED');
    assert.equal(result.report.privateCapture, undefined);
    assert.equal(result.calls.at(-2).sql, 'ROLLBACK');
    assert.equal(result.processStub.exitCode, 1);
  }
});

test('unverified TLS and invalid credentials cannot read Storage definitions', async t => {
  const tls = await runMain(t, { authorized: false });
  assert.equal(tls.report.failure.stage, 'connect');
  assert.deepEqual(tls.calls.map(call => call.sql), ['connect', 'end']);
  const credentials = await runMain(t, { credentials: `host=${SECRET}\npassword=${SECRET}` });
  assert.equal(credentials.report.failure.stage, 'configuration');
  assert.equal(credentials.configurations.length, 0);
});

test('deadline expiry closes the transport across connect, collect, rollback and close boundaries', async t => {
  for (const [hangAt, stage] of [['connect', 'connect'], ['collect', 'collect'], ['rollback', 'collect'], ['close', 'close']]) {
    const result = await runMain(t, { hangAt });
    assert.equal(result.report.status, 'error');
    assert.deepEqual(result.report.failure, { stage, code: 'CAPTURE_DEADLINE' });
    assert.equal(result.report.captureDeadline.exceeded, true);
    assert.deepEqual(result.report.connectionCleanup, { status: 'forced', streamDestroyed: true });
    assert.equal(result.timers.size, 0);
    assert.equal(result.processStub.exitCode, 1);
  }
});

test('private directory rejection prevents persistence; later close failure retains evidence with error status', async t => {
  const denied = await runMain(t, { privateMode: 0o755 });
  assert.equal(denied.report.status, 'error');
  assert.equal(denied.report.privateCapture, undefined);
  assert.equal(denied.report.connectionClosed, true);
  assert.deepEqual(fs.readdirSync(path.join(denied.root, 'supabase/.temp/routine-audit')), []);
  const close = await runMain(t, { closeError: 'ECONNRESET' });
  assert.equal(close.report.status, 'error');
  assert.deepEqual(close.report.failure, { stage: 'close', code: 'ECONNRESET' });
  assert.equal(close.report.privateCapture.permissionsVerified, true);
  assert.equal(close.processStub.exitCode, 1);
});

