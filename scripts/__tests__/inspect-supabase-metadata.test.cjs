const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { parseCredentials, clientConfig, safeCode, readSection, collect, QUERIES } = require('../inspect-supabase-metadata.cjs');

const credentials = 'host=aws-0-us-east-2.pooler.supabase.com\nport=5432\ndatabase=postgres\nuser=metadata_reader.encdblxyxztvfxotfuyh\npassword=synthetic=password\n';

test('reads the whole password after the first equals sign and accepts CRLF', () => {
  const parsed = parseCredentials(credentials.replaceAll('\n', '\r\n'));
  assert.equal(parsed.password, 'synthetic=password');
  assert.equal(parsed.port, 5432);
});

test('rejects duplicate, missing and unexpected keys without reflecting input', () => {
  for (const input of [credentials + 'password=secret', credentials.replace('password=synthetic=password\n', ''), credentials + 'options=secret']) {
    assert.throws(() => parseCredentials(input), error => error.message === 'Invalid metadata-reader configuration');
  }
});

test('rejects privileged roles, another project and untrusted host names', () => {
  for (const input of [credentials.replace('metadata_reader.', 'postgres.'), credentials.replace('encdblxyxztvfxotfuyh', 'different'), credentials.replace('pooler.supabase.com', 'example.org')]) {
    assert.throws(() => parseCredentials(input));
  }
});

test('connection always verifies TLS and defaults to bounded read-only operations', () => {
  const config = clientConfig(parseCredentials(credentials), 'test-ca');
  assert.equal(config.ssl.rejectUnauthorized, true);
  assert.equal(config.ssl.ca, 'test-ca');
  assert.match(config.options, /default_transaction_read_only=on/);
  assert.ok(config.connectionTimeoutMillis > 0);
  assert.match(config.options, /statement_timeout=10000/);
});

test('error serialization preserves only approved machine codes', () => {
  assert.equal(safeCode({ code: '42501', message: 'secret', detail: 'secret' }), '42501');
  assert.equal(safeCode({ code: 'ECONNREFUSED', message: 'secret' }), 'ECONNREFUSED');
  for (const code of ['secret', 'PASSWORD', 'postgres://secret', undefined]) assert.equal(safeCode({ code }), 'UNCLASSIFIED');
});

test('a denied category is distinct from a successful empty category', async () => {
  const calls = [];
  const client = { query: async sql => {
    calls.push(sql);
    if (sql === 'SELECT denied') throw Object.assign(new Error('secret'), { code: '42501' });
    return { rows: [] };
  } };
  const denied = await readSection(client, 'SELECT denied');
  assert.deepEqual(denied, { status: 'denied', code: '42501' });
  assert.ok(calls.includes('ROLLBACK TO SAVEPOINT metadata_section'));
  const empty = await readSection(client, 'SELECT empty');
  assert.deepEqual(empty, { status: 'ok', rowCount: 0, rows: [] });
});

test('failed rollback stops collection instead of pretending later queries are valid', async () => {
  const client = { query: async sql => {
    if (sql.startsWith('SAVEPOINT')) return {};
    throw Object.assign(new Error('private diagnostic'), { code: '08006' });
  } };
  await assert.rejects(readSection(client, 'SELECT example'));
});

test('refuses the wrong server role or a writable transaction before metadata reads', async () => {
  for (const identity of [{ current_user: 'postgres', read_only: 'on' }, { current_user: 'metadata_reader', read_only: 'off' }]) {
    const calls = [];
    const client = { query: async sql => {
      calls.push(sql);
      return { rows: [identity] };
    } };
    await assert.rejects(collect(client), /Unexpected metadata-reader session/);
    assert.equal(calls.length, 4);
    assert.equal(calls.at(-1), 'ROLLBACK');
  }
});

test('rejects backend timeout settings that differ from the required transaction limits', async () => {
  const identity = { current_user: 'metadata_reader', read_only: 'on', statement_timeout: '2min', lock_timeout: '0', idle_transaction_timeout: '0' };
  const calls = [];
  const client = { query: async sql => { calls.push(sql); return { rows: [identity] }; } };
  await assert.rejects(collect(client), /Unexpected metadata-reader session/);
  assert.equal(calls.length, 4);
  assert.equal(calls.at(-1), 'ROLLBACK');
});

test('successful capture closes its read-only snapshot and retains denied bucket status', async () => {
  const calls = [];
  const identity = { current_user: 'metadata_reader', read_only: 'on', statement_timeout: '10s', lock_timeout: '2s', idle_transaction_timeout: '15s' };
  const client = { query: async sql => {
    calls.push(sql);
    if (sql.includes('SELECT current_user')) return { rows: [identity] };
    if (sql.includes('FROM storage.buckets')) throw Object.assign(new Error('private diagnostic'), { code: '42501' });
    return { rows: [] };
  } };
  const report = await collect(client);
  assert.equal(report.identity, identity);
  assert.deepEqual(report.sections.buckets, { status: 'denied', code: '42501' });
  assert.equal(report.sections.tables.status, 'ok');
  assert.match(calls[0], /REPEATABLE READ READ ONLY/);
  assert.equal(calls.at(-1), 'ROLLBACK');
});

// Run the real CLI entry point with only network, disk I/O, and its timer replaced.
// None of these tests open the actual credential/CA files or create a pg client.
async function runSyntheticMain({ hangAt, closeError, destroyError, authorized = true } = {}) {
  const filename = path.resolve(__dirname, '../inspect-supabase-metadata.cjs');
  const source = fs.readFileSync(filename, 'utf8');
  const runtimeFilename = path.resolve(__dirname, '../supabase-capture-runtime.cjs');
  const runtimeSource = fs.readFileSync(runtimeFilename, 'utf8');
  const timers = new Map();
  const writes = [];
  const output = [];
  const calls = [];
  const processStub = {};
  const pending = () => new Promise(() => {});
  const stream = { authorized, destroyed: false, getProtocol: () => 'TLSv1.3', destroy() {
    calls.push('destroy');
    if (destroyError) throw new Error('private destroy diagnostic');
    this.destroyed = true;
  } };
  class Client {
    constructor() { this.connection = { stream }; }
    on() {}
    async connect() { calls.push('connect'); if (hangAt === 'connect') return pending(); }
    async query(sql) {
      calls.push(sql);
      if (hangAt === 'collect' && sql.startsWith('BEGIN')) return pending();
      if (hangAt === 'rollback' && sql === 'ROLLBACK') return pending();
      if (sql.includes('SELECT current_user')) return { rows: [{ current_user: 'metadata_reader', read_only: 'on',
        statement_timeout: '10s', lock_timeout: '2s', idle_transaction_timeout: '15s' }] };
      return { rows: [] };
    }
    async end() {
      calls.push('end');
      if (hangAt === 'close') return pending();
      if (closeError) throw Object.assign(new Error('private close diagnostic'), { code: closeError });
    }
  }
  const fakeFs = {
    readFileSync(file) {
      if (file === filename) return source;
      if (file === runtimeFilename) return runtimeSource;
      if (file.endsWith('/supabase/.temp/metadata-reader-credentials')) return credentials;
      if (file.endsWith('/supabase-prod-ca-2021.crt')) return 'synthetic-ca';
      throw new Error('Unexpected file read');
    },
    mkdirSync() {},
    writeFileSync(file, data, options) { writes.push({ file, report: JSON.parse(data), options }); },
  };
  const moduleStub = { exports: {} };
  const requireStub = name => {
    if (name === 'node:fs') return fakeFs;
    if (name === '../experiments/t05-durable-worker/node_modules/pg') return { Client };
    if (['node:path', 'node:crypto'].includes(name)) return require(name);
    if (name === './supabase-capture-runtime.cjs') {
      const runtimeModule = { exports: {} };
      vm.runInNewContext(runtimeSource, { module: runtimeModule,
        setTimeout: (callback, ms) => { const id = {}; timers.set(id, { callback, ms }); return id; },
        clearTimeout: id => timers.delete(id) }, { filename: runtimeFilename });
      return runtimeModule.exports;
    }
    throw new Error('Unexpected module');
  };
  requireStub.main = moduleStub;
  vm.runInNewContext(source, { require: requireStub, module: moduleStub, __filename: filename,
    __dirname: path.dirname(filename), process: processStub,
    console: { log: value => output.push(value), error: value => output.push(value) },
    setTimeout: (callback, ms) => { const id = {}; timers.set(id, { callback, ms }); return id; },
    clearTimeout: id => timers.delete(id) }, { filename });
  await new Promise(resolve => setImmediate(resolve));
  const deadlines = [...timers.values()].map(timer => timer.ms);
  if (hangAt) {
    for (const { callback } of [...timers.values()]) callback();
    await new Promise(resolve => setImmediate(resolve));
  }
  return { writes, output, calls, deadlines, timers, processStub, stream };
}

for (const [hangAt, stage] of [['connect', 'connect'], ['collect', 'collect'], ['rollback', 'collect'], ['close', 'close']]) {
  test(`CLI saves safe deadline evidence when ${hangAt} never settles, even after stream destruction`, async () => {
    const result = await runSyntheticMain({ hangAt });
    assert.equal(result.writes.length, 1, 'deadline must reach evidence persistence without waiting for the stuck promise');
    const { report, options } = result.writes[0];
    assert.equal(report.status, 'error');
    assert.deepEqual(report.failure, { stage, code: 'CAPTURE_DEADLINE' });
    assert.equal(report.connectionClosed, false);
    assert.deepEqual(report.connectionCleanup, { status: 'forced', streamDestroyed: true });
    assert.equal(result.stream.destroyed, true);
    assert.equal(result.processStub.exitCode, 1);
    assert.equal(options.flag, 'wx');
    assert.deepEqual(result.deadlines, [90000]);
    assert.equal(result.timers.size, 0);
    assert.doesNotMatch(JSON.stringify(result.writes) + result.output.join(''), /synthetic=password|private .* diagnostic/);
  });
}

test('CLI records close rejection and attempts forced cleanup before saving evidence', async () => {
  const result = await runSyntheticMain({ closeError: 'ECONNRESET' });
  const report = result.writes[0].report;
  assert.equal(report.status, 'error');
  assert.equal(report.connectionClosed, false);
  assert.deepEqual(report.failure, { stage: 'close', code: 'ECONNRESET' });
  assert.deepEqual(report.connectionCleanup, { status: 'forced', streamDestroyed: true });
  assert.equal(result.timers.size, 0);
});

test('CLI still saves deadline evidence if forced cleanup throws', async () => {
  const result = await runSyntheticMain({ hangAt: 'close', destroyError: true });
  assert.equal(result.writes.length, 1);
  assert.deepEqual(result.writes[0].report.connectionCleanup, { status: 'forced', streamDestroyed: false });
  assert.equal(result.processStub.exitCode, 1);
});

test('CLI verifies TLS, completes normal cleanup, and saves exclusive success evidence', async () => {
  const result = await runSyntheticMain();
  const { report, options } = result.writes[0];
  assert.equal(report.status, 'captured');
  assert.equal(report.connectionClosed, true);
  assert.equal(report.tls.authorized, true);
  assert.equal(options.flag, 'wx');
  assert.equal(result.processStub.exitCode, 0);
  assert.equal(result.timers.size, 0);
});

test('CLI never begins a metadata transaction when TLS is unauthorized', async () => {
  const result = await runSyntheticMain({ authorized: false });
  assert.equal(result.writes[0].report.status, 'error');
  assert.equal(result.writes[0].report.failure.stage, 'connect');
  assert.equal(result.calls.some(sql => sql.startsWith('BEGIN')), false);
  assert.equal(result.writes[0].report.connectionClosed, true);
});

test('CLI preserves the original failure while explicitly recording a later close deadline', async () => {
  const result = await runSyntheticMain({ authorized: false, hangAt: 'close' });
  const report = result.writes[0].report;
  assert.deepEqual(report.failure, { stage: 'connect', code: 'UNCLASSIFIED' });
  assert.deepEqual(report.captureDeadline, { limitMs: 90000, exceeded: true });
  assert.equal(report.connectionClosed, false);
  assert.equal(result.processStub.exitCode, 1);
});

test('function inventory excludes bodies/default values and scopes effective execution to the four audit roles', () => {
  assert.equal(typeof QUERIES.functions, 'string', 'function inventory is required');
  const sql = QUERIES.functions;
  assert.match(sql, /n\.nspname IN \('public','storage'\)/);
  assert.match(sql, /p\.prokind IN \('f','p','w'\)/);
  assert.match(sql, /pg_catalog\.pg_get_function_identity_arguments\(p\.oid\)/);
  assert.match(sql, /pg_catalog\.pg_get_function_result\(p\.oid\)/);
  assert.match(sql, /pg_catalog\.md5\(pg_catalog\.pg_get_functiondef\(p\.oid\)\) AS definition_hash_md5/);
  assert.doesNotMatch(sql, /\bp\.(prosrc|probin|proargdefaults)\b|pg_get_function_arguments\(/);
  assert.match(sql, /p\.prosecdef/);
  assert.match(sql, /p\.provolatile/);
  assert.match(sql, /p\.proisstrict/);
  assert.match(sql, /p\.proleakproof/);
  assert.match(sql, /pg_catalog\.unnest\(p\.proconfig\)/);
  assert.match(sql, /pg_catalog\.split_part\(setting,'=',1\)='search_path'/);
  assert.match(sql, /p\.proacl IS NULL AS acl_is_null/);
  assert.match(sql, /pg_catalog\.acldefault\('f',p\.proowner\)/);
  assert.match(sql, /COALESCE\(p\.proacl,pg_catalog\.acldefault\('f',p\.proowner\)\)/);
  assert.match(sql, /grantee=0 AND .*privilege_type='EXECUTE'/);
  const privileges = QUERIES.function_privileges;
  assert.match(privileges, /n\.nspname IN \('public','storage'\)/);
  assert.match(privileges, /r\.rolname IN \('metadata_reader','anon','authenticated','service_role'\)/);
  assert.match(privileges, /pg_catalog\.has_function_privilege\(r\.oid,p\.oid,'EXECUTE'\)/);
});

test('trigger inventory hashes definitions and reveals neither argument values nor WHEN expressions', () => {
  assert.equal(typeof QUERIES.triggers, 'string', 'trigger inventory is required');
  const sql = QUERIES.triggers;
  assert.match(sql, /n\.nspname IN \('public','storage'\)/);
  assert.match(sql, /NOT t\.tgisinternal/);
  assert.match(sql, /t\.tgtype AS type_bitmask/);
  assert.match(sql, /t\.tgenabled AS enabled/);
  assert.match(sql, /t\.tgconstraint<>0 AS is_constraint/);
  assert.match(sql, /t\.tgnargs AS argument_count/);
  assert.match(sql, /t\.tgqual IS NOT NULL AS condition_present/);
  assert.match(sql, /pg_catalog\.pg_get_function_identity_arguments\(p\.oid\)/);
  assert.match(sql, /pg_catalog\.md5\(pg_catalog\.pg_get_triggerdef\(t\.oid\)\) AS definition_hash_md5/);
  assert.doesNotMatch(sql, /\btgargs\b|pg_get_expr\(|\bt\.tgqual\s+AS\b/);
});

test('schema access and default ACL queries cover only public/storage plus global defaults applying to them', () => {
  assert.equal(typeof QUERIES.schema_privileges, 'string', 'schema privilege inventory is required');
  assert.match(QUERIES.schema_privileges, /n\.nspname IN \('public','storage'\)/);
  assert.match(QUERIES.schema_privileges, /r\.rolname IN \('metadata_reader','anon','authenticated','service_role'\)/);
  for (const permission of ['USAGE', 'CREATE']) {
    assert.ok(QUERIES.schema_privileges.includes(`pg_catalog.has_schema_privilege(r.oid,n.oid,'${permission}')`));
  }
  assert.match(QUERIES.default_privileges, /n\.nspname IN \('public','storage'\)/);
  assert.match(QUERIES.default_privileges, /d\.defaclnamespace IN \(0,n\.oid\)/);
  assert.match(QUERIES.default_privileges, /d\.defaclobjtype IN \('r','S','f','T'\)/);
  assert.match(QUERIES.default_privileges, /CASE WHEN d\.defaclnamespace=0 THEN 'global' ELSE 'schema' END AS default_scope/);
  assert.match(QUERIES.default_privileges, /d\.defaclacl::text\[\] AS acl/);
  for (const name of ['functions', 'function_privileges', 'triggers', 'schema_privileges', 'default_privileges']) {
    const sql = QUERIES[name];
    assert.match(sql, /^SELECT /);
    assert.doesNotMatch(sql, /;|\b(?:public|storage)\.\w+\s*\(|\b(?:INSERT|UPDATE|DELETE|GRANT|REVOKE|ALTER|CALL)\b/i);
    assert.ok([...sql.matchAll(/\b(?:FROM|JOIN)\s+([a-z_]+)\./gi)].every(match => match[1] === 'pg_catalog'));
  }
});

test('supplement category errors stay distinct and roll back their savepoints without losing later categories', async () => {
  const calls = [];
  const client = { query: async sql => {
    calls.push(sql);
    if (sql.includes('SELECT current_user')) return { rows: [{ current_user: 'metadata_reader', read_only: 'on',
      statement_timeout: '10s', lock_timeout: '2s', idle_transaction_timeout: '15s' }] };
    if (sql === QUERIES.functions) throw Object.assign(new Error('private function diagnostic'), { code: '42501' });
    if (sql === QUERIES.triggers) throw Object.assign(new Error('private trigger diagnostic'), { code: '57014' });
    return { rows: [] };
  } };
  const report = await collect(client);
  assert.deepEqual(report.sections.functions, { status: 'denied', code: '42501' });
  assert.deepEqual(report.sections.triggers, { status: 'error', code: '57014' });
  assert.deepEqual(report.sections.function_privileges, { status: 'ok', rowCount: 0, rows: [] });
  assert.deepEqual(report.sections.default_privileges, { status: 'ok', rowCount: 0, rows: [] });
  assert.deepEqual(report.sections.schema_privileges, { status: 'ok', rowCount: 0, rows: [] });
  assert.equal(calls.filter(sql => sql === 'ROLLBACK TO SAVEPOINT metadata_section').length, 2);
  assert.equal(calls.at(-1), 'ROLLBACK');
  assert.doesNotMatch(JSON.stringify(report), /private .* diagnostic/);
});
