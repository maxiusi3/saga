// Optional real SQL validation against an isolated Unix-socket PostgreSQL.
// No network listener, credentials or business routine invocation is used.
const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const { TARGET_SQL, collect, validateRows } = require('../inspect-supabase-routines.cjs');
const { QUERIES } = require('../inspect-supabase-metadata.cjs');

function localEnvironment(source = process.env) {
  // Filter keys before reading values; discarded host credentials are never read.
  return Object.fromEntries(Object.keys(source)
    .filter(name => !/^PG/i.test(name) && name.toUpperCase() !== 'DATABASE_URL')
    .map(name => [name, source[name]]));
}

async function withLocalEnvironment(work) {
  // Keep the original object reference without inspecting its discarded values.
  // node --test isolates this file in its own worker process.
  const originalEnvironment = process.env;
  process.env = localEnvironment(originalEnvironment);
  try { return await work(); }
  finally { process.env = originalEnvironment; }
}

test('local environment removes every PG variable and DATABASE_URL without reading their values', () => {
  assert.equal(typeof localEnvironment, 'function', 'local environment filtering must exist');
  const synthetic = { PATH: '/synthetic-bin', KEEP_SYNTHETIC: 'retained' };
  for (const name of ['PGSSLMODE', 'PGPASSWORD', 'PGOPTIONS', 'PGHOST', 'PGCLIENT_ENCODING', 'PGREPLICATION',
    'PGBINARY', 'PGAPPNAME', 'PGSERVICEFILE', 'pgfuture', 'DATABASE_URL']) {
    Object.defineProperty(synthetic, name, { enumerable: true, get() { throw new Error('FORBIDDEN_ENV_VALUE_READ'); } });
  }
  assert.deepEqual(localEnvironment(synthetic), { PATH: '/synthetic-bin', KEEP_SYNTHETIC: 'retained' });
});

test('the local worker environment is scrubbed throughout asynchronous work and restored after failure', async () => {
  assert.equal(typeof withLocalEnvironment, 'function', 'local worker isolation must exist');
  const originalEnvironment = process.env;
  const syntheticEnvironment = { KEEP_SYNTHETIC: 'retained', PGSSLMODE: 'require', PGPASSWORD: 'synthetic-password',
    PGOPTIONS: '-c default_transaction_read_only=on', PGHOST: '/synthetic-socket', PGCLIENT_ENCODING: 'LATIN1',
    PGREPLICATION: 'database', PGBINARY: '1', PGAPPNAME: 'synthetic-app', DATABASE_URL: 'postgresql://synthetic.invalid/unused' };
  process.env = syntheticEnvironment;
  try {
    await assert.rejects(withLocalEnvironment(async () => {
      await new Promise(resolve => setImmediate(resolve));
      assert.equal(Object.keys(process.env).some(name => /^PG/i.test(name) || name.toUpperCase() === 'DATABASE_URL'), false);
      assert.equal(process.env.KEEP_SYNTHETIC, 'retained');
      throw new Error('EXPECTED_LOCAL_FAILURE');
    }), /EXPECTED_LOCAL_FAILURE/);
    assert.equal(process.env, syntheticEnvironment);
  } finally { process.env = originalEnvironment; }
});

test('real catalog SQL selects exact overloaded identities and reports missing/drift using synthetic definitions',
  { skip: process.env.SAGA_ROUTINE_LOCAL_PG !== '1', timeout: 60000 }, () => withLocalEnvironment(async () => {
    const { Client } = require('../../experiments/t05-durable-worker/node_modules/pg');
    const scratch = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'saga-routine-pg-')));
    const data = path.join(scratch, 'data');
    const socket = path.join(scratch, 'socket');
    fs.mkdirSync(socket, { mode: 0o700 });
    const binary = '/usr/local/opt/postgresql@16/bin';
    let startupAttempted = false;
    let client;
    const closeClient = async () => {
      if (!client) return;
      const closing = client;
      client = undefined;
      let timer;
      try {
        await Promise.race([closing.end(), new Promise((resolve, reject) => {
          timer = setTimeout(() => {
            closing.connection?.stream?.destroy();
            reject(new Error('LOCAL_CLOSE_DEADLINE'));
          }, 3000);
        })]);
      } finally { clearTimeout(timer); }
    };
    const command = (name, args, allowed = [0]) => {
      const result = spawnSync(path.join(binary, name), args, { encoding: 'utf8', timeout: 20000, env: localEnvironment() });
      if (!allowed.includes(result.status)) throw new Error(`LOCAL_${name.toUpperCase()}_FAILED`);
      return result;
    };
    const cleanup = () => {
      if (startupAttempted) {
        // A failed/timed-out start may still leave a server. Unknown state or
        // failed cleanup must retain the tree for diagnosis, never delete it.
        const before = command('pg_ctl', ['-D', data, 'status'], [0, 3]);
        if (before.status === 0) {
          command('pg_ctl', ['-D', data, '-m', 'immediate', '-w', '-t', '10', 'stop']);
          command('pg_ctl', ['-D', data, 'status'], [3]);
        }
        startupAttempted = false;
      }
      fs.rmSync(scratch, { recursive: true, force: true });
    };
    const removeSignalListeners = () => {
      process.removeListener('SIGINT', interrupt);
      process.removeListener('SIGTERM', interrupt);
    };
    const interrupt = () => {
      try { cleanup(); }
      finally { removeSignalListeners(); process.exitCode = 1; }
    };
    process.once('SIGINT', interrupt);
    process.once('SIGTERM', interrupt);
    try {
      command('initdb', ['-D', data, '-U', 'saga_routine_admin', '-A', 'trust', '--no-locale', '-E', 'UTF8']);
      startupAttempted = true;
      command('pg_ctl', ['-D', data, '-l', path.join(scratch, 'postgres.log'), '-w', '-t', '15', '-o',
        `-F -c listen_addresses='' -k ${socket} -p 56473`, 'start']);
      client = new Client({ host: socket, port: 56473, user: 'saga_routine_admin', database: 'postgres', connectionTimeoutMillis: 3000,
        ssl: false, password: 'local-inert-password',
        options: '-c statement_timeout=10000 -c lock_timeout=2000 -c idle_in_transaction_session_timeout=15000' });
      assert.equal(client.ssl, false, 'local socket transport must ignore ambient SSL settings');
      assert.equal(client.password === 'local-inert-password', true, 'local authentication must ignore ambient passwords');
      await client.connect();
      const version = (await client.query('SHOW server_version')).rows[0].server_version;
      assert.match(version, /^16\./);
      await client.query(`CREATE ROLE metadata_reader LOGIN;
        CREATE FUNCTION public.capture_fixture(input_value integer DEFAULT 42) RETURNS text LANGUAGE sql SECURITY DEFINER
          SET search_path=pg_catalog AS $body$ SELECT 'FAKE_LOCAL_ROUTINE_SECRET_6134'::text $body$;
        CREATE FUNCTION public.capture_fixture(input_value text) RETURNS text LANGUAGE sql SECURITY DEFINER
          AS $body$ SELECT 'FAKE_UNSELECTED_OVERLOAD_9812'::text $body$;
        CREATE FUNCTION public.unselected_fixture() RETURNS text LANGUAGE sql SECURITY DEFINER
          AS $body$ SELECT 'FAKE_UNSELECTED_ROUTINE_7645'::text $body$;
        CREATE FUNCTION public.trigger_fixture() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
          AS $body$ BEGIN RETURN NEW; END $body$`);
      const inventory = (await client.query(QUERIES.functions)).rows;
      const targets = inventory.filter(row => row.function_name === 'capture_fixture' && row.identity_arguments === 'input_value integer');
      assert.equal(targets.length, 1);
      await client.query('SET ROLE metadata_reader');
      const report = await collect(client, targets);
      assert.equal(report.status, 'captured');
      assert.equal(report.privateRows.length, 1);
      assert.ok(report.privateRows[0].definition.includes('FAKE_LOCAL_ROUTINE_SECRET_6134'));
      assert.ok(report.privateRows[0].definition.includes('DEFAULT 42'));
      assert.equal(report.targets[0].actualDefinitionMd5,
        createHash('md5').update(report.privateRows[0].definition).digest('hex'));
      assert.equal(JSON.stringify(report.targets).includes('FAKE_'), false);
      assert.equal(JSON.stringify(report.privateRows).includes('FAKE_UNSELECTED_'), false);
      const missingTarget = { ...targets[0], identity_arguments: 'input_value uuid' };
      const missing = await collect(client, [missingTarget]);
      assert.equal(missing.status, 'drift');
      assert.equal(missing.targets[0].status, 'missing');
      assert.equal(missing.privateRows.length, 0);
      const rows = (await client.query(TARGET_SQL, [JSON.stringify(targets)])).rows;
      assert.equal(validateRows(rows, [{ ...targets[0], security_definer: false }]).targets[0].status, 'attributes_changed');
      assert.equal(validateRows(rows, [{ ...targets[0], definition_hash_md5: '0'.repeat(32) }]).targets[0].status, 'definition_changed');
      await closeClient();
    } finally {
      try { await closeClient(); }
      finally {
        try { cleanup(); }
        finally { removeSignalListeners(); }
      }
    }
  }));
