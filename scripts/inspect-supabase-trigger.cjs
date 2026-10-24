// Capture only the pinned trigger dependency. Definition text remains private
// data; this entry point never invokes it and accepts no CLI configuration.
const fs = require('node:fs');
const path = require('node:path');
const { createHash, randomUUID } = require('node:crypto');
const { TARGET_SQL, collect, savePrivateCapture } = require('./inspect-supabase-routines.cjs');
const { parseCredentials, clientConfig, safeCode, runCapture } = require('./supabase-capture-runtime.cjs');

const ROOT = path.resolve(__dirname, '..');
const SNAPSHOT_PATH = 'docs/research/evidence/2026-10-17-remote-metadata/snapshot-2026-10-17T06-13-03-052Z.json';
const SNAPSHOT_SHA256 = '8b2a4647b017305183e67b2b932be02080a789dba4fc48b23b2f23a97991e66e';
const TRIGGER_MD5 = '3bfa5e64985d89e65932564c89520d5b';
const EVIDENCE = path.join(ROOT, 'docs/research/evidence/2026-10-17-pg17-routines');
const CA_PATH = path.join(ROOT, 'docs/research/evidence/2026-10-17-remote-metadata/supabase-prod-ca-2021.crt');
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const fail = code => { throw new Error(code); };

function loadPinnedTargets(bytes) {
  if (digest(bytes) !== SNAPSHOT_SHA256) fail('PINNED_SNAPSHOT_MISMATCH');
  const targets = JSON.parse(bytes).sections.functions.rows.filter(row =>
    row.schema_name === 'public' && row.function_name === 'update_updated_at_column' && row.identity_arguments === '');
  if (targets.length !== 1 || targets[0].kind !== 'f' || targets[0].return_type !== 'trigger' ||
      targets[0].definition_hash_md5 !== TRIGGER_MD5) fail('PINNED_TARGETS_INVALID');
  return targets;
}

async function main() {
  const capturedAt = new Date().toISOString();
  const filename = `capture-trigger-${capturedAt.replace(/[:.]/g, '-')}-${randomUUID()}.json`;
  const report = { schemaVersion: 1, capturedAt, status: 'error',
    scope: 'Exactly one pinned public.update_updated_at_column() trigger function; pg_catalog reads only; definition retained privately',
    snapshotPath: SNAPSHOT_PATH, snapshotSha256: SNAPSHOT_SHA256, catalogQuerySha256: digest(TARGET_SQL),
    tlsVerificationDisabled: false, captureDeadline: { limitMs: 90000, exceeded: false }, sourceSha256: {} };
  try {
    if (process.argv.length !== 2) fail('NO_CLI_CONFIGURATION');
    for (const source of ['inspect-supabase-trigger.cjs', 'inspect-supabase-routines.cjs', 'supabase-capture-runtime.cjs']) {
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
      // The shared collector retains its exact TARGET_SQL, validateRows and
      // readOnlySnapshot behavior, including rollback and backend limit checks.
      const { privateRows, ...publicResult } = await collect(client, targets);
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

module.exports = { SNAPSHOT_SHA256, TARGET_SQL, loadPinnedTargets, collect };
if (require.main === module) main().catch(() => { console.error('Trigger evidence could not be saved'); process.exitCode = 1; });
