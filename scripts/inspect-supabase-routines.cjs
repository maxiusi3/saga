// Fixed catalog-definition capture. Definition text is private data, never code
// to execute or publish. This entry point accepts no CLI configuration.
const fs = require('node:fs');
const path = require('node:path');
const { createHash, randomUUID } = require('node:crypto');
const { parseCredentials, clientConfig, safeCode, readOnlySnapshot, runCapture } = require('./supabase-capture-runtime.cjs');

const ROOT = path.resolve(__dirname, '..');
const SNAPSHOT_PATH = 'docs/research/evidence/2026-10-17-remote-metadata/snapshot-2026-10-17T06-13-03-052Z.json';
const SNAPSHOT_SHA256 = '8b2a4647b017305183e67b2b932be02080a789dba4fc48b23b2f23a97991e66e';
const EVIDENCE = path.join(ROOT, 'docs/research/evidence/2026-10-17-routine-audit');
const CA_PATH = path.join(ROOT, 'docs/research/evidence/2026-10-17-remote-metadata/supabase-prod-ca-2021.crt');
const PRIVATE_DIRECTORY = 'supabase/.temp/routine-audit';
const digest = (bytes, algorithm = 'sha256') => createHash(algorithm).update(bytes).digest('hex');
const fail = code => { throw new Error(code); };
const identityKey = row => JSON.stringify([row.schema_name, row.function_name, row.identity_arguments]);

function loadPinnedTargets(bytes) {
  if (digest(bytes) !== SNAPSHOT_SHA256) fail('PINNED_SNAPSHOT_MISMATCH');
  const rows = JSON.parse(bytes).sections.functions.rows.filter(row =>
    row.schema_name === 'public' && row.security_definer === true && row.return_type !== 'trigger');
  if (rows.length !== 12 || new Set(rows.map(identityKey)).size !== 12 ||
      rows.some(row => row.kind !== 'f' || !/^[a-f0-9]{32}$/.test(row.definition_hash_md5))) fail('PINNED_TARGETS_INVALID');
  return rows;
}

// Only the exact pinned identities can reach pg_get_functiondef. The left joins
// retain a missing target; no broader definition inventory is performed.
const TARGET_SQL = `WITH targets AS (
    SELECT * FROM pg_catalog.jsonb_to_recordset($1::jsonb)
      AS target(schema_name text, function_name text, identity_arguments text)
  )
  SELECT target.schema_name, target.function_name, target.identity_arguments,
    pg_catalog.pg_get_function_result(p.oid) AS return_type, p.prokind AS kind,
    pg_catalog.pg_get_userbyid(p.proowner) AS owner, l.lanname AS language,
    p.prosecdef AS security_definer, p.provolatile AS volatility,
    p.proisstrict AS is_strict, p.proleakproof AS leakproof,
    CASE WHEN p.oid IS NOT NULL THEN ARRAY(
      SELECT setting FROM pg_catalog.unnest(p.proconfig) AS setting
      WHERE pg_catalog.split_part(setting,'=',1)='search_path') END AS search_path,
    CASE WHEN p.oid IS NOT NULL THEN p.proacl IS NULL END AS acl_is_null,
    CASE WHEN p.oid IS NOT NULL THEN EXISTS(
      SELECT 1 FROM pg_catalog.aclexplode(pg_catalog.acldefault('f',p.proowner)) a
      WHERE a.grantee=0 AND a.privilege_type='EXECUTE') END AS builtin_default_public_execute,
    CASE WHEN p.oid IS NOT NULL THEN EXISTS(
      SELECT 1 FROM pg_catalog.aclexplode(COALESCE(p.proacl,pg_catalog.acldefault('f',p.proowner))) a
      WHERE a.grantee=0 AND a.privilege_type='EXECUTE') END AS public_execute,
    CASE WHEN p.oid IS NOT NULL THEN EXISTS(
      SELECT 1 FROM pg_catalog.aclexplode(COALESCE(p.proacl,pg_catalog.acldefault('f',p.proowner))) a
      WHERE a.grantee=0 AND a.privilege_type='EXECUTE' AND a.is_grantable) END AS public_execute_grantable,
    CASE WHEN p.prokind IN ('f','p','w') THEN pg_catalog.md5(pg_catalog.pg_get_functiondef(p.oid)) END AS definition_hash_md5,
    CASE WHEN p.prokind IN ('f','p','w') THEN pg_catalog.pg_get_functiondef(p.oid) END AS definition
  FROM targets target
  LEFT JOIN pg_catalog.pg_namespace n ON n.nspname=target.schema_name
  LEFT JOIN pg_catalog.pg_proc p ON p.pronamespace=n.oid AND p.proname=target.function_name
    AND pg_catalog.pg_get_function_identity_arguments(p.oid)=target.identity_arguments
  LEFT JOIN pg_catalog.pg_language l ON l.oid=p.prolang
  ORDER BY 1,2,3`;

const STRING_ATTRIBUTES = ['return_type', 'kind', 'owner', 'language', 'volatility'];
const BOOLEAN_ATTRIBUTES = ['security_definer', 'is_strict', 'leakproof', 'acl_is_null',
  'builtin_default_public_execute', 'public_execute', 'public_execute_grantable'];
const ATTRIBUTES = [...STRING_ATTRIBUTES, ...BOOLEAN_ATTRIBUTES, 'search_path'];

function validateRows(rows, targets) {
  if (!Array.isArray(rows) || rows.length > targets.length) fail('MALFORMED_ROUTINE_RESULT');
  const expected = new Map(targets.map(target => [identityKey(target), target]));
  const actual = new Map();
  for (const row of rows) {
    if (!row || ['schema_name', 'function_name', 'identity_arguments'].some(key => typeof row[key] !== 'string')) fail('MALFORMED_ROUTINE_RESULT');
    const key = identityKey(row);
    if (!expected.has(key) || actual.has(key)) fail('UNEXPECTED_ROUTINE_RESULT');
    // A missing catalog entry has null attributes from the LEFT JOIN. Partial
    // or malformed entries are errors and cannot be accepted as absent.
    const missing = row.definition === null && row.definition_hash_md5 === null && ATTRIBUTES.every(name => row[name] === null);
    if (!missing && (STRING_ATTRIBUTES.some(name => typeof row[name] !== 'string') ||
        BOOLEAN_ATTRIBUTES.some(name => typeof row[name] !== 'boolean') ||
        !Array.isArray(row.search_path) || row.search_path.some(setting => typeof setting !== 'string') ||
        typeof row.definition !== 'string' || row.definition.length === 0 ||
        !/^[a-f0-9]{32}$/.test(row.definition_hash_md5) || digest(row.definition, 'md5') !== row.definition_hash_md5)) fail('MALFORMED_ROUTINE_RESULT');
    actual.set(key, missing ? null : row);
  }
  const privateRows = [];
  const publicTargets = targets.map(target => {
    const row = actual.get(identityKey(target));
    const changedAttributes = row ? ATTRIBUTES.filter(name => JSON.stringify(row[name]) !== JSON.stringify(target[name])) : [];
    const status = !row ? 'missing' : changedAttributes.length ? 'attributes_changed' :
      row.definition_hash_md5 !== target.definition_hash_md5 ? 'definition_changed' : 'matched';
    if (row) {
      // Whitelist only catalog fields, avoiding arbitrary extra transport data.
      privateRows.push({ schema_name: target.schema_name, function_name: target.function_name,
        identity_arguments: target.identity_arguments, ...Object.fromEntries(ATTRIBUTES.map(name => [name, row[name]])),
        definition_hash_md5: row.definition_hash_md5, definition: row.definition });
    }
    return { schema_name: target.schema_name, function_name: target.function_name, identity_arguments: target.identity_arguments,
      expectedDefinitionMd5: target.definition_hash_md5, actualDefinitionMd5: row?.definition_hash_md5 || null,
      definitionSha256: row ? digest(row.definition) : null, status, changedAttributes };
  });
  return { status: publicTargets.every(target => target.status === 'matched') ? 'captured' : 'drift',
    targets: publicTargets, privateRows };
}

async function collect(client, targets) {
  return readOnlySnapshot(client, async identity => {
    if (identity.current_database !== 'postgres' || identity.isolation !== 'repeatable read') fail('UNEXPECTED_ROUTINE_SESSION');
    const parameters = targets.map(({ schema_name, function_name, identity_arguments }) => ({ schema_name, function_name, identity_arguments }));
    const result = await client.query(TARGET_SQL, [JSON.stringify(parameters)]);
    const validated = validateRows(result?.rows, targets);
    // Never reflect arbitrary server identity/config values into the public file.
    return { ...validated, identity: { current_user: 'metadata_reader', current_database: 'postgres',
      read_only: 'on', isolation: 'repeatable read', statement_timeout: '10s', lock_timeout: '2s', idle_transaction_timeout: '15s',
      serverVersionSha256: digest(String(identity.server_version)), snapshotTimeSha256: digest(String(identity.snapshot_time)) } };
  });
}

function ordinaryDirectory(directory) {
  const stat = fs.lstatSync(directory);
  if (!stat.isDirectory() || stat.isSymbolicLink()) fail('PRIVATE_DIRECTORY_REJECTED');
  return stat;
}

function verifyDirectoryChain(directory) {
  const parsed = path.parse(directory);
  let cursor = parsed.root;
  ordinaryDirectory(cursor);
  for (const component of directory.slice(parsed.root.length).split(path.sep)) {
    if (component) { cursor = path.join(cursor, component); ordinaryDirectory(cursor); }
  }
}

function savePrivateCapture(root, filename, data) {
  if (!path.isAbsolute(root) || path.normalize(root) !== root || !/^capture-[a-zA-Z0-9-]+\.json$/.test(filename)) fail('PRIVATE_PATH_REJECTED');
  verifyDirectoryChain(root);
  let directory = root;
  for (const component of PRIVATE_DIRECTORY.split('/')) {
    directory = path.join(directory, component);
    try { ordinaryDirectory(directory); }
    catch (error) {
      if (error.code !== 'ENOENT') throw error;
      fs.mkdirSync(directory, { mode: 0o700 });
      ordinaryDirectory(directory);
    }
  }
  const directoryStat = ordinaryDirectory(directory);
  if ((directoryStat.mode & 0o7777) !== 0o700) fail('PRIVATE_DIRECTORY_PERMISSIONS');
  verifyDirectoryChain(directory);
  const relativePath = `${PRIVATE_DIRECTORY}/${filename}`;
  const file = path.join(root, relativePath);
  const bytes = Buffer.from(JSON.stringify(data, null, 2) + '\n');
  const flags = fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_NOFOLLOW;
  const fd = fs.openSync(file, flags, 0o600);
  let fileStat;
  try {
    fileStat = fs.fstatSync(fd);
    if (!fileStat.isFile() || fileStat.nlink !== 1 || (fileStat.mode & 0o7777) !== 0o600) fail('PRIVATE_FILE_PERMISSIONS');
    verifyDirectoryChain(directory);
    const currentDirectory = ordinaryDirectory(directory);
    if (currentDirectory.ino !== directoryStat.ino || currentDirectory.dev !== directoryStat.dev ||
        (currentDirectory.mode & 0o7777) !== 0o700) fail('PRIVATE_DIRECTORY_CHANGED');
    const currentFile = fs.lstatSync(file);
    if (currentFile.isSymbolicLink() || currentFile.ino !== fileStat.ino || currentFile.dev !== fileStat.dev) fail('PRIVATE_FILE_CHANGED');
    fs.writeFileSync(fd, bytes);
    fs.fsyncSync(fd);
  } finally { fs.closeSync(fd); }
  verifyDirectoryChain(directory);
  const saved = fs.lstatSync(file);
  if (!saved.isFile() || saved.isSymbolicLink() || saved.ino !== fileStat.ino || saved.dev !== fileStat.dev ||
      saved.nlink !== 1 || (saved.mode & 0o7777) !== 0o600 || (ordinaryDirectory(directory).mode & 0o7777) !== 0o700) fail('PRIVATE_CAPTURE_VERIFICATION');
  return { relativePath, sha256: digest(bytes), permissionsVerified: true, directoryMode: '0700', fileMode: '0600', exclusiveCreation: true };
}

async function main() {
  const capturedAt = new Date().toISOString();
  const filename = `capture-${capturedAt.replace(/[:.]/g, '-')}-${randomUUID()}.json`;
  const report = { schemaVersion: 1, capturedAt, status: 'error',
    scope: 'Exactly 12 pinned public non-trigger SECURITY DEFINER routine identities; pg_catalog reads only; raw definitions retained privately',
    snapshotPath: SNAPSHOT_PATH, snapshotSha256: SNAPSHOT_SHA256,
    tlsVerificationDisabled: false, queries: { targets: TARGET_SQL },
    captureDeadline: { limitMs: 90000, exceeded: false }, sourceSha256: {} };
  let targets;
  try {
    if (process.argv.length !== 2) fail('NO_CLI_CONFIGURATION');
    for (const source of ['inspect-supabase-routines.cjs', 'supabase-capture-runtime.cjs', 'inspect-supabase-metadata.cjs']) {
      report.sourceSha256[`scripts/${source}`] = digest(fs.readFileSync(path.join(__dirname, source)));
    }
    targets = loadPinnedTargets(fs.readFileSync(path.join(ROOT, SNAPSHOT_PATH)));
    await runCapture(report, () => {
      const credentials = parseCredentials(fs.readFileSync(path.join(ROOT, 'supabase/.temp/metadata-reader-credentials'), 'utf8'));
      const ca = fs.readFileSync(CA_PATH, 'utf8');
      report.caSha256 = digest(ca);
      const { Client } = require('../experiments/t05-durable-worker/node_modules/pg');
      return new Client(clientConfig(credentials, ca));
    }, async client => {
      const { privateRows, ...publicResult } = await collect(client, targets);
      // Save prior to close, so a later close failure cannot lose an otherwise
      // completed private result. Only the safe pointer reaches runCapture.
      const privateCapture = savePrivateCapture(ROOT, filename, { schemaVersion: 1, capturedAt,
        snapshotSha256: SNAPSHOT_SHA256, status: publicResult.status, targets: publicResult.targets, definitions: privateRows });
      return { ...publicResult, privateCapture };
    });
  } catch (error) {
    report.status = 'error';
    report.failure = { stage: 'configuration', code: safeCode(error) };
  }
  fs.mkdirSync(EVIDENCE, { recursive: true });
  fs.writeFileSync(path.join(EVIDENCE, filename), JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify({ status: report.status, evidence: path.relative(ROOT, path.join(EVIDENCE, filename)),
    targetCount: report.targets?.length, failure: report.failure }));
  process.exitCode = report.status === 'captured' ? 0 : report.status === 'drift' ? 2 : 1;
}

module.exports = { SNAPSHOT_SHA256, TARGET_SQL, loadPinnedTargets, validateRows, collect, savePrivateCapture };
if (require.main === module) main().catch(() => { console.error('Routine evidence could not be saved'); process.exitCode = 1; });
