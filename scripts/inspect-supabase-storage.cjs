// Fixed Storage catalog capture. Raw definitions, arguments and conditions are
// private data; they are never executed or accepted as CLI configuration.
const fs = require('node:fs');
const path = require('node:path');
const { createHash, randomUUID } = require('node:crypto');
const { TARGET_SQL, validateRows, savePrivateCapture } = require('./inspect-supabase-routines.cjs');
const { parseCredentials, clientConfig, safeCode, readOnlySnapshot, runCapture } = require('./supabase-capture-runtime.cjs');

const ROOT = path.resolve(__dirname, '..');
const SNAPSHOT_PATH = 'docs/research/evidence/2026-10-17-remote-metadata/snapshot-2026-10-17T06-13-03-052Z.json';
const SNAPSHOT_SHA256 = '8b2a4647b017305183e67b2b932be02080a789dba4fc48b23b2f23a97991e66e';
const EVIDENCE = path.join(ROOT, 'docs/research/evidence/2026-10-23-storage-definition-capture');
const CA_PATH = path.join(ROOT, 'docs/research/evidence/2026-10-17-remote-metadata/supabase-prod-ca-2021.crt');
const digest = (bytes, algorithm = 'sha256') => createHash(algorithm).update(bytes).digest('hex');
const fail = code => { throw new Error(code); };
const functionKey = row => JSON.stringify([row.schema_name, row.function_name, row.identity_arguments]);
const triggerKey = row => JSON.stringify([row.schema_name, row.table_name, row.trigger_name]);
const FUNCTION_IDENTITIES = [
  ['storage', 'enforce_bucket_lifecycle_service_role', ''],
  ['storage', 'enforce_bucket_name_length', ''],
  ['storage', 'foldername', 'name text'],
  ['storage', 'protect_bucket_control_columns', ''],
  ['storage', 'protect_delete', ''],
  ['storage', 'update_updated_at_column', ''],
].map(row => JSON.stringify(row));
const TRIGGER_IDENTITIES = [
  ['storage', 'buckets', 'enforce_bucket_name_length_trigger'],
  ['storage', 'buckets', 'protect_bucket_control_insert'],
  ['storage', 'buckets', 'protect_bucket_control_update'],
  ['storage', 'buckets', 'protect_bucket_control_update_role'],
  ['storage', 'buckets', 'protect_buckets_delete'],
  ['storage', 'objects', 'protect_objects_delete'],
  ['storage', 'objects', 'update_objects_updated_at'],
].map(row => JSON.stringify(row));

function exactTargets(targets) {
  for (const [rows, identities, key] of [[targets?.functions, FUNCTION_IDENTITIES, functionKey],
    [targets?.triggers, TRIGGER_IDENTITIES, triggerKey]]) {
    if (!Array.isArray(rows) || rows.length !== identities.length || rows.some(row => !row) ||
        new Set(rows.map(key)).size !== identities.length || rows.some(row => !identities.includes(key(row)))) fail('PINNED_TARGETS_INVALID');
  }
}

function loadPinnedTargets(bytes) {
  if (digest(bytes) !== SNAPSHOT_SHA256) fail('PINNED_SNAPSHOT_MISMATCH');
  const snapshot = JSON.parse(bytes);
  const triggers = snapshot.sections.triggers.rows.filter(row => TRIGGER_IDENTITIES.includes(triggerKey(row)));
  const functions = snapshot.sections.functions.rows.filter(row => FUNCTION_IDENTITIES.includes(functionKey(row)));
  const targets = { functions, triggers };
  exactTargets(targets);
  const dependencies = new Set(triggers.map(row => functionKey({ schema_name: row.function_schema,
    function_name: row.function_name, identity_arguments: row.function_identity_arguments })));
  if (dependencies.size !== 5 || functions.some(row => row.kind !== 'f' ||
      (row.function_name === 'foldername' ? row.return_type !== 'text[]' : row.return_type !== 'trigger' || !dependencies.has(functionKey(row))) ||
      !/^[a-f0-9]{32}$/.test(row.definition_hash_md5))) fail('PINNED_TARGETS_INVALID');
  return targets;
}

// Exact table + trigger identity joins keep pg_get_triggerdef confined to the
// seven pinned entries. A LEFT JOIN preserves a missing target as null fields.
const TRIGGER_SQL = `WITH targets AS (
    SELECT * FROM pg_catalog.jsonb_to_recordset($1::jsonb)
      AS target(schema_name text, table_name text, trigger_name text)
  )
  SELECT target.schema_name, target.table_name, target.trigger_name,
    t.tgenabled AS enabled, t.tgtype AS type_bitmask,
    pn.nspname AS function_schema, p.proname AS function_name,
    pg_catalog.pg_get_function_identity_arguments(p.oid) AS function_identity_arguments,
    t.tgconstraint<>0 AS is_constraint, t.tgnargs AS argument_count,
    CASE WHEN t.oid IS NOT NULL THEN t.tgqual IS NOT NULL END AS condition_present,
    pg_catalog.md5(pg_catalog.pg_get_triggerdef(t.oid)) AS definition_hash_md5,
    pg_catalog.pg_get_triggerdef(t.oid) AS definition,
    pg_catalog.encode(t.tgargs,'hex') AS arguments_hex,
    t.tgqual::text AS condition
  FROM targets target
  LEFT JOIN pg_catalog.pg_namespace n ON n.nspname=target.schema_name
  LEFT JOIN pg_catalog.pg_class c ON c.relnamespace=n.oid AND c.relname=target.table_name
  LEFT JOIN pg_catalog.pg_trigger t ON t.tgrelid=c.oid AND t.tgname=target.trigger_name AND NOT t.tgisinternal
  LEFT JOIN pg_catalog.pg_proc p ON p.oid=t.tgfoid
  LEFT JOIN pg_catalog.pg_namespace pn ON pn.oid=p.pronamespace
  ORDER BY 1,2,3`;

// pg_get_expr(tgqual,tgrelid) rejects trigger conditions referring to OLD and
// NEW (SQLSTATE 22023). Keep the pg_node_tree privately; pg_get_triggerdef above
// contains the authoritative WHEN SQL without reparsing or executing it.

const TRIGGER_ATTRIBUTES = ['enabled', 'type_bitmask', 'function_schema', 'function_name',
  'function_identity_arguments', 'is_constraint', 'argument_count', 'condition_present'];
const TRIGGER_PRIVATE_FIELDS = [...TRIGGER_ATTRIBUTES, 'definition_hash_md5', 'definition', 'arguments_hex', 'condition'];

function validateTriggerRows(rows, targets) {
  if (!Array.isArray(rows) || rows.length > targets.length) fail('MALFORMED_TRIGGER_RESULT');
  const expected = new Map(targets.map(target => [triggerKey(target), target]));
  const actual = new Map();
  for (const row of rows) {
    if (!row || ['schema_name', 'table_name', 'trigger_name'].some(key => typeof row[key] !== 'string')) fail('MALFORMED_TRIGGER_RESULT');
    const key = triggerKey(row);
    if (!expected.has(key) || actual.has(key)) fail('UNEXPECTED_TRIGGER_RESULT');
    const missing = TRIGGER_PRIVATE_FIELDS.every(name => row[name] === null);
    if (!missing) {
      if (!['O', 'D', 'R', 'A'].includes(row.enabled) || !Number.isInteger(row.type_bitmask) || row.type_bitmask < 0 || row.type_bitmask > 127 ||
          ['function_schema', 'function_name'].some(name => typeof row[name] !== 'string' || row[name].length === 0) ||
          typeof row.function_identity_arguments !== 'string' || typeof row.is_constraint !== 'boolean' ||
          !Number.isInteger(row.argument_count) || row.argument_count < 0 || row.argument_count > 32767 ||
          typeof row.condition_present !== 'boolean' ||
          (row.condition_present ? typeof row.condition !== 'string' || row.condition.trim().length === 0 : row.condition !== null) ||
          typeof row.arguments_hex !== 'string' || !/^(?:[a-f0-9]{2})*$/.test(row.arguments_hex) ||
          typeof row.definition !== 'string' || row.definition.length === 0 ||
          !/^[a-f0-9]{32}$/.test(row.definition_hash_md5) || digest(row.definition, 'md5') !== row.definition_hash_md5) fail('MALFORMED_TRIGGER_RESULT');
      const bytes = Buffer.from(row.arguments_hex, 'hex');
      // tgnargs counts NUL terminators. An empty argument is one zero byte;
      // zero arguments require zero bytes, and any final argument ends in NUL.
      const count = bytes.reduce((total, byte) => total + (byte === 0 ? 1 : 0), 0);
      if (count !== row.argument_count || (bytes.length > 0 && bytes.at(-1) !== 0)) fail('MALFORMED_TRIGGER_RESULT');
    }
    actual.set(key, missing ? null : row);
  }
  const privateRows = [];
  const publicTargets = targets.map(target => {
    const row = actual.get(triggerKey(target));
    const changedAttributes = row ? TRIGGER_ATTRIBUTES.filter(name => row[name] !== target[name]) : [];
    const status = !row ? 'missing' : changedAttributes.length ? 'attributes_changed' :
      row.definition_hash_md5 !== target.definition_hash_md5 ? 'definition_changed' : 'matched';
    const identity = { schema_name: target.schema_name, table_name: target.table_name, trigger_name: target.trigger_name };
    if (row) privateRows.push({ ...identity, ...Object.fromEntries(TRIGGER_PRIVATE_FIELDS.map(name => [name, row[name]])) });
    return { ...identity, expectedDefinitionMd5: target.definition_hash_md5, actualDefinitionMd5: row?.definition_hash_md5 || null,
      definitionSha256: row ? digest(row.definition) : null, argumentsSha256: row ? digest(Buffer.from(row.arguments_hex, 'hex')) : null,
      conditionSha256: row?.condition === null || !row ? null : digest(row.condition), status, changedAttributes };
  });
  return { status: publicTargets.every(target => target.status === 'matched') ? 'captured' : 'drift',
    targets: publicTargets, privateRows };
}

async function collect(client, targets) {
  exactTargets(targets);
  return readOnlySnapshot(client, async identity => {
    if (identity.current_database !== 'postgres' || identity.isolation !== 'repeatable read') fail('UNEXPECTED_STORAGE_SESSION');
    const functionParameters = targets.functions.map(({ schema_name, function_name, identity_arguments }) => ({ schema_name, function_name, identity_arguments }));
    const triggerParameters = targets.triggers.map(({ schema_name, table_name, trigger_name }) => ({ schema_name, table_name, trigger_name }));
    const functions = validateRows((await client.query(TARGET_SQL, [JSON.stringify(functionParameters)]))?.rows, targets.functions);
    const triggers = validateTriggerRows((await client.query(TRIGGER_SQL, [JSON.stringify(triggerParameters)]))?.rows, targets.triggers);
    return { status: functions.status === 'captured' && triggers.status === 'captured' ? 'captured' : 'drift',
      functions: functions.targets, triggers: triggers.targets,
      privateRows: { functions: functions.privateRows, triggers: triggers.privateRows },
      identity: { current_user: 'metadata_reader', current_database: 'postgres', read_only: 'on', isolation: 'repeatable read',
        statement_timeout: '10s', lock_timeout: '2s', idle_transaction_timeout: '15s',
        serverVersionSha256: digest(String(identity.server_version)), snapshotTimeSha256: digest(String(identity.snapshot_time)) } };
  });
}

async function main() {
  const capturedAt = new Date().toISOString();
  const filename = `capture-storage-${capturedAt.replace(/[:.]/g, '-')}-${randomUUID()}.json`;
  const report = { schemaVersion: 1, capturedAt, status: 'error',
    scope: 'Exactly six pinned Storage function identities and seven storage.buckets/objects triggers; pg_catalog reads only; definitions, arguments and conditions retained privately',
    snapshotPath: SNAPSHOT_PATH, snapshotSha256: SNAPSHOT_SHA256,
    catalogQuerySha256: { functions: digest(TARGET_SQL), triggers: digest(TRIGGER_SQL) },
    tlsVerificationDisabled: false, captureDeadline: { limitMs: 90000, exceeded: false }, sourceSha256: {} };
  try {
    if (process.argv.length !== 2) fail('NO_CLI_CONFIGURATION');
    for (const source of ['inspect-supabase-storage.cjs', 'inspect-supabase-routines.cjs', 'supabase-capture-runtime.cjs']) {
      report.sourceSha256[`scripts/${source}`] = digest(fs.readFileSync(path.join(__dirname, source)));
    }
    const targets = loadPinnedTargets(fs.readFileSync(path.join(ROOT, SNAPSHOT_PATH)));
    await runCapture(report, () => {
      const credentials = parseCredentials(fs.readFileSync(path.join(ROOT, 'supabase/.temp/metadata-reader-credentials'), 'utf8'));
      const ca = fs.readFileSync(CA_PATH, 'utf8');
      report.caSha256 = digest(ca);
      const { Client } = require('../experiments/t05-durable-worker/node_modules/pg');
      return new Client(clientConfig(credentials, ca));
    }, async client => {
      const { privateRows, ...publicResult } = await collect(client, targets);
      const privateCapture = savePrivateCapture(ROOT, filename, { schemaVersion: 1, capturedAt,
        snapshotSha256: SNAPSHOT_SHA256, status: publicResult.status, conditionFormat: 'pg_node_tree',
        functions: publicResult.functions, triggers: publicResult.triggers, definitions: privateRows });
      return { ...publicResult, privateCapture };
    });
  } catch (error) {
    report.status = 'error';
    report.failure = { stage: 'configuration', code: safeCode(error) };
  }
  fs.mkdirSync(EVIDENCE, { recursive: true });
  fs.writeFileSync(path.join(EVIDENCE, filename), JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify({ status: report.status, evidence: path.relative(ROOT, path.join(EVIDENCE, filename)),
    functionCount: report.functions?.length, triggerCount: report.triggers?.length, failure: report.failure }));
  process.exitCode = report.status === 'captured' ? 0 : report.status === 'drift' ? 2 : 1;
}

module.exports = { SNAPSHOT_SHA256, TARGET_SQL, TRIGGER_SQL, loadPinnedTargets, validateTriggerRows, collect };
if (require.main === module) main().catch(() => { console.error('Storage evidence could not be saved'); process.exitCode = 1; });
