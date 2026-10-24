// Shared fixed-role configuration, read-only transaction and bounded pg lifecycle.
const PROJECT_REF = 'encdblxyxztvfxotfuyh';

function parseCredentials(text) {
  const result = {};
  const invalid = () => { throw new Error('Invalid metadata-reader configuration'); };
  for (const line of text.trim().split(/\r?\n/)) {
    const index = line.indexOf('=');
    const key = line.slice(0, index);
    if (index < 1 || !['host', 'port', 'database', 'user', 'password'].includes(key) || Object.hasOwn(result, key)) invalid();
    result[key] = line.slice(index + 1);
  }
  if (Object.keys(result).length !== 5 || !result.password ||
      result.user !== `metadata_reader.${PROJECT_REF}` || result.database !== 'postgres' ||
      !/^aws-[0-9]+-us-east-2\.pooler\.supabase\.com$/.test(result.host) ||
      !['5432', '6543'].includes(result.port)) invalid();
  result.port = Number(result.port);
  return result;
}

function clientConfig(credentials, ca) {
  return {
    ...credentials,
    ssl: { rejectUnauthorized: true, ca },
    application_name: 'saga_metadata_readonly_audit',
    connectionTimeoutMillis: 10000,
    options: '-c default_transaction_read_only=on -c statement_timeout=10000 -c lock_timeout=2000 -c idle_in_transaction_session_timeout=15000',
  };
}

function safeCode(error) {
  const allowed = ['42501', '42P01', '42703', '57014', '55P03', '08006', '28P01', '28000',
    'ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'SELF_SIGNED_CERT_IN_CHAIN',
    'CERT_HAS_EXPIRED', 'UNABLE_TO_VERIFY_LEAF_SIGNATURE', 'ERR_TLS_CERT_ALTNAME_INVALID'];
  return allowed.includes(error?.code) ? error.code : 'UNCLASSIFIED';
}

async function readOnlySnapshot(client, read) {
  await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  try {
    // Supavisor may not forward startup options to the backend. Enforce the
    // limits inside this transaction, then verify the actual backend values.
    await client.query("SET LOCAL statement_timeout='10s'; SET LOCAL lock_timeout='2s'; SET LOCAL idle_in_transaction_session_timeout='15s'");
    const identity = (await client.query(`SELECT current_user, current_database(),
      current_setting('transaction_read_only') AS read_only,
      current_setting('transaction_isolation') AS isolation,
      current_setting('server_version') AS server_version,
      current_setting('statement_timeout') AS statement_timeout,
      current_setting('lock_timeout') AS lock_timeout,
      current_setting('idle_in_transaction_session_timeout') AS idle_transaction_timeout,
      transaction_timestamp() AS snapshot_time`)).rows[0];
    if (identity?.current_user !== 'metadata_reader' || identity?.read_only !== 'on' ||
        identity?.statement_timeout !== '10s' || identity?.lock_timeout !== '2s' ||
        identity?.idle_transaction_timeout !== '15s') {
      throw new Error('Unexpected metadata-reader session');
    }
    return await read(identity);
  } finally {
    await client.query('ROLLBACK');
  }
}

async function runCapture(report, createClient, collect) {
  let client;
  let timer;
  let deadline;
  let expired = false;
  let stage = 'configuration';
  const deadlineError = Object.assign(new Error('Metadata capture deadline exceeded'), { code: 'CAPTURE_DEADLINE' });
  const forceDisconnect = () => {
    report.connectionClosed = false;
    report.connectionCleanup = { status: 'forced', streamDestroyed: false };
    try {
      client?.connection?.stream?.destroy();
      report.connectionCleanup.streamDestroyed = client?.connection?.stream?.destroyed === true;
    } catch { /* A transport cleanup error must not prevent safe evidence persistence. */ }
  };
  // Destroying a socket does not guarantee that a pending driver promise settles.
  // Race every async driver boundary, and refuse new queries after expiry.
  const bounded = operation => Promise.race([
    Promise.resolve().then(() => { if (expired) throw deadlineError; return operation(); }),
    deadline,
  ]);
  try {
    client = createClient();
    deadline = new Promise((resolve, reject) => {
      timer = setTimeout(() => {
        expired = true;
        report.captureDeadline.exceeded = true;
        forceDisconnect();
        reject(deadlineError);
      }, report.captureDeadline.limitMs);
    });
    // pg can emit asynchronous connection errors; never log the raw event.
    client.on('error', () => {});
    stage = 'connect';
    await bounded(() => client.connect());
    report.tls = { authorized: client.connection.stream.authorized === true,
      protocol: client.connection.stream.getProtocol() };
    if (!report.tls.authorized) throw new Error('TLS verification required');
    stage = 'collect';
    Object.assign(report, await collect({ query: (...args) => bounded(() => client.query(...args)) }));
  } catch (error) {
    report.status = 'error';
    report.failure = { stage, code: expired ? 'CAPTURE_DEADLINE' : safeCode(error) };
  } finally {
    if (client) {
      try {
        await bounded(() => client.end());
        report.connectionClosed = true;
        report.connectionCleanup = { status: 'closed' };
      } catch (error) {
        report.status = 'error';
        report.failure ||= { stage: 'close', code: expired ? 'CAPTURE_DEADLINE' : safeCode(error) };
        if (!report.connectionCleanup) forceDisconnect();
      }
    }
    clearTimeout(timer);
  }
}

module.exports = { parseCredentials, clientConfig, safeCode, readOnlySnapshot, runCapture };
