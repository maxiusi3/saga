const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { EventEmitter } = require('node:events');

// Exercise the real harness callback with only subprocess outcomes, pg creation
// and process events replaced. The scratch tree uses the real filesystem.
async function runStartupFailure(t, { statusResults = [3], stopResult = 0, signal = false, initFailure = false } = {}) {
  const filename = path.resolve(__dirname, 'inspect-supabase-routines-local.test.cjs');
  const source = fs.readFileSync(filename, 'utf8');
  const events = new EventEmitter();
  events.env = { SAGA_ROUTINE_LOCAL_PG: '1', PGSSLMODE: 'require', PGPASSWORD: 'synthetic-ignored-password' };
  const initialEnvironment = events.env;
  const calls = [];
  let scratch;
  let callback;
  const fakeFs = { ...fs, mkdtempSync(prefix) {
    scratch = fs.mkdtempSync(prefix);
    t.after(() => fs.rmSync(scratch, { recursive: true, force: true }));
    return scratch;
  } };
  const stubTest = (name, options, body) => { if (name.startsWith('real catalog SQL')) callback = body; };
  const stubSpawn = (executable, args, options) => {
    assert.equal(options.timeout, 20000);
    assert.equal(Object.keys(options.env).some(key => /^PG/i.test(key) || key === 'DATABASE_URL'), false);
    const command = path.basename(executable);
    const operation = command === 'initdb' ? 'initdb' : args.at(-1);
    calls.push(operation);
    if (operation === 'initdb') {
      fs.mkdirSync(args[args.indexOf('-D') + 1], { recursive: true });
      return { status: initFailure ? 1 : 0 };
    }
    if (operation === 'start') {
      if (signal) events.emit('SIGTERM');
      return { status: 1 };
    }
    if (operation === 'status') return { status: statusResults.shift() ?? 4 };
    if (operation === 'stop') {
      assert.ok(args.includes('immediate'));
      assert.equal(args[args.indexOf('-t') + 1], '10');
      return { status: stopResult };
    }
    throw new Error('UNEXPECTED_LOCAL_COMMAND');
  };
  const requireStub = name => {
    if (name === 'node:test') return { test: stubTest };
    if (name === 'node:fs') return fakeFs;
    if (name === 'node:child_process') return { spawnSync: stubSpawn };
    if (name === '../../experiments/t05-durable-worker/node_modules/pg') return {
      Client: class { constructor() { throw new Error('CLIENT_MUST_NOT_OPEN_AFTER_FAILED_START'); } },
    };
    if (name.startsWith('../inspect-')) return {};
    return require(name);
  };
  vm.runInNewContext(source, { require: requireStub, process: events, setTimeout, clearTimeout, setImmediate }, { filename });
  assert.equal(typeof callback, 'function');
  await assert.rejects(callback(), /LOCAL_(PG_CTL|INITDB)_FAILED/);
  assert.equal(events.env, initialEnvironment, 'worker environment must restore after startup failure');
  return { calls, scratch, events, retained: fs.existsSync(scratch) };
}

test('a failed local start with no live server removes owned scratch without issuing stop', async t => {
  const result = await runStartupFailure(t, { stopResult: 1 });
  assert.deepEqual(result.calls, ['initdb', 'start', 'status']);
  assert.equal(result.retained, false);
  assert.equal(result.events.listenerCount('SIGINT'), 0);
  assert.equal(result.events.listenerCount('SIGTERM'), 0);
});

test('a failed or timed-out start that left a live server stops it and confirms stopped before removal', async t => {
  const result = await runStartupFailure(t, { statusResults: [0, 3] });
  assert.deepEqual(result.calls, ['initdb', 'start', 'status', 'stop', 'status']);
  assert.equal(result.retained, false);
  assert.equal(result.events.listenerCount('SIGINT'), 0);
  assert.equal(result.events.listenerCount('SIGTERM'), 0);
});

for (const [label, options] of [
  ['unknown pre-stop status', { statusResults: [4] }],
  ['failed stop', { statusResults: [0], stopResult: 1 }],
  ['still-running post-stop status', { statusResults: [0, 0] }],
]) {
  test(`local cleanup preserves scratch and removes both listeners on ${label}`, async t => {
    const result = await runStartupFailure(t, options);
    assert.equal(result.retained, true);
    assert.equal(result.events.listenerCount('SIGINT'), 0);
    assert.equal(result.events.listenerCount('SIGTERM'), 0);
  });
}

test('a signal during a failed startup still removes both listeners when cleanup cannot prove a stop', async t => {
  const result = await runStartupFailure(t, { statusResults: [4, 4], signal: true });
  assert.equal(result.retained, true);
  assert.equal(result.events.listenerCount('SIGINT'), 0);
  assert.equal(result.events.listenerCount('SIGTERM'), 0);
  assert.equal(result.events.exitCode, 1);
});

test('initdb failure removes owned scratch without attempting server lifecycle commands', async t => {
  const result = await runStartupFailure(t, { initFailure: true });
  assert.deepEqual(result.calls, ['initdb']);
  assert.equal(result.retained, false);
  assert.equal(result.events.listenerCount('SIGINT'), 0);
  assert.equal(result.events.listenerCount('SIGTERM'), 0);
});
