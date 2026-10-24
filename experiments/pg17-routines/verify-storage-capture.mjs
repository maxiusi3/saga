// Local synthetic catalog SQL validation only. Never connects to a remote DB.
import { readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { Harness, root, digest } from './runtime.mjs';

const require = createRequire(import.meta.url);
const storage = require('../../scripts/inspect-supabase-storage.cjs');
const { QUERIES } = require('../../scripts/inspect-supabase-metadata.cjs');
const report = { schemaVersion: 1, startedAt: new Date().toISOString(), status: 'running',
  scope: 'Isolated PostgreSQL 17.4 synthetic Storage catalog fixtures; no remote connection or captured routine execution',
  assertions: 0, scenarios: [], sourceSha256: {} };
const h = new Harness(report);
const secret = 'FAKE_STORAGE_LOCAL_PRIVATE_40831';
const pinned = storage.loadPinnedTargets(await readFile(join(root,
  'docs/research/evidence/2026-10-17-remote-metadata/snapshot-2026-10-17T06-13-03-052Z.json')));
const functionKey = row => JSON.stringify([row.schema_name, row.function_name, row.identity_arguments]);
const triggerKey = row => JSON.stringify([row.schema_name, row.table_name, row.trigger_name]);
const output = join(root, 'docs/research/evidence/2026-10-23-storage-definition-capture',
  `task-1-local-pg17-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
const signal = name => { h.signal = name; report.signal = name; };
const onInt = () => signal('SIGINT'), onTerm = () => signal('SIGTERM');
process.on('SIGINT', onInt);
process.on('SIGTERM', onTerm);

try {
  for (const source of ['scripts/inspect-supabase-storage.cjs', 'scripts/inspect-supabase-routines.cjs',
    'scripts/supabase-capture-runtime.cjs', 'scripts/inspect-supabase-metadata.cjs',
    'experiments/pg17-routines/runtime.mjs', 'experiments/pg17-routines/runtime-pins.json',
    'experiments/pg17-routines/verify-storage-capture.mjs']) {
    report.sourceSha256[source] = digest(await readFile(join(root, source)));
  }
  await h.start();
  const admin = await h.client('rehearsal_admin', 'postgres');
  await admin.query(`CREATE ROLE metadata_reader LOGIN;
    CREATE SCHEMA storage;
    CREATE TABLE storage.buckets (name text);
    CREATE TABLE storage.objects (name text);
    GRANT USAGE ON SCHEMA storage TO metadata_reader;`);
  for (const target of pinned.functions) {
    const body = target.return_type === 'trigger' ? 'RETURN NEW;' : `RETURN ARRAY['${secret}'];`;
    await admin.query(`CREATE FUNCTION storage.${target.function_name}(${target.identity_arguments})
      RETURNS ${target.return_type} LANGUAGE plpgsql AS $body$ BEGIN ${body} END $body$`);
  }
  await admin.query(`CREATE FUNCTION storage.foldername(other integer) RETURNS text LANGUAGE sql AS $$ SELECT '${secret}' $$;
    CREATE TRIGGER enforce_bucket_name_length_trigger BEFORE INSERT OR UPDATE ON storage.buckets
      FOR EACH ROW EXECUTE FUNCTION storage.enforce_bucket_name_length();
    CREATE TRIGGER protect_bucket_control_insert BEFORE INSERT ON storage.buckets
      FOR EACH ROW EXECUTE FUNCTION storage.protect_bucket_control_columns('${secret}');
    CREATE TRIGGER protect_bucket_control_update BEFORE UPDATE ON storage.buckets
      FOR EACH ROW EXECUTE FUNCTION storage.protect_bucket_control_columns();
    CREATE TRIGGER protect_bucket_control_update_role AFTER UPDATE ON storage.buckets
      FOR EACH ROW EXECUTE FUNCTION storage.enforce_bucket_lifecycle_service_role('');
    CREATE TRIGGER protect_buckets_delete BEFORE DELETE ON storage.buckets
      FOR EACH STATEMENT EXECUTE FUNCTION storage.protect_delete();
    CREATE TRIGGER protect_objects_delete BEFORE DELETE ON storage.objects
      FOR EACH STATEMENT EXECUTE FUNCTION storage.protect_delete();
    CREATE TRIGGER update_objects_updated_at BEFORE UPDATE ON storage.objects
      FOR EACH ROW WHEN (OLD.name IS DISTINCT FROM NEW.name)
      EXECUTE FUNCTION storage.update_updated_at_column();
    CREATE TRIGGER unselected_trigger BEFORE INSERT ON storage.objects
      FOR EACH ROW EXECUTE FUNCTION storage.protect_delete('${secret}');`);
  const functionKeys = new Set(pinned.functions.map(functionKey)), triggerKeys = new Set(pinned.triggers.map(triggerKey));
  const targets = {
    functions: (await admin.query(QUERIES.functions)).rows.filter(row => functionKeys.has(functionKey(row))),
    triggers: (await admin.query(QUERIES.triggers)).rows.filter(row => triggerKeys.has(triggerKey(row))),
  };
  h.eq(targets.functions.length, 6, 'six fixture function identities');
  h.eq(targets.triggers.length, 7, 'seven fixture trigger identities');
  const client = await h.client('metadata_reader', 'postgres');
  await h.scenario('pg_get_expr compatibility for OLD and NEW trigger condition', async () => {
    try {
      await client.query(`SELECT pg_catalog.pg_get_expr(t.tgqual,t.tgrelid)
        FROM pg_catalog.pg_trigger t WHERE t.tgname='update_objects_updated_at'`);
      report.conditionExpressionProbe = { status: 'supported' };
    } catch (error) {
      h.eq(error.code, '22023', 'known multi-relation expression rejection');
      report.conditionExpressionProbe = { status: 'rejected', sqlstate: '22023',
        note: 'Trigger OLD/NEW Vars cannot be represented by pg_get_expr(tgqual,tgrelid); trigger definition retains authoritative WHEN SQL' };
    }
  });
  await h.scenario('real exact-target SQL, empty argument and OLD/NEW condition', async () => {
    const calls = [];
    const result = await storage.collect({ query: (sql, values) => { calls.push(sql); return client.query(sql, values); } }, targets);
    h.eq(result.status, 'captured', 'fixture capture matches independent metadata baseline');
    h.eq(result.functions.length, 6, 'six public function fingerprints');
    h.eq(result.triggers.length, 7, 'seven public trigger fingerprints');
    h.eq(result.privateRows.functions.length, 6, 'six private definitions');
    h.eq(result.privateRows.triggers.length, 7, 'seven private trigger definitions');
    const empty = result.privateRows.triggers.find(row => row.trigger_name === 'protect_bucket_control_update_role');
    h.eq(empty.arguments_hex, '00', 'one empty argument is NUL');
    const none = result.privateRows.triggers.find(row => row.trigger_name === 'protect_bucket_control_update');
    h.eq(none.arguments_hex, '', 'no arguments is zero bytes');
    const one = result.privateRows.triggers.find(row => row.trigger_name === 'protect_bucket_control_insert');
    h.eq(one.arguments_hex, Buffer.from(`${secret}\0`).toString('hex'), 'one private argument survives exactly');
    const conditional = result.privateRows.triggers.find(row => row.trigger_name === 'update_objects_updated_at');
    h.eq(conditional.condition_present, true, 'condition exists');
    h.ok(conditional.condition.startsWith('{'), 'private pg_node_tree condition representation retained');
    h.ok(conditional.definition.includes('old.name') && conditional.definition.includes('new.name'), 'authoritative trigger definition includes both OLD and NEW');
    h.eq(calls.filter(sql => sql.startsWith('BEGIN')).length, 1, 'one combined transaction');
    h.eq(calls.at(-1), 'ROLLBACK', 'rollback completed');
    const { privateRows, ...publicResult } = result;
    h.eq(JSON.stringify(publicResult).includes(secret), false, 'synthetic private data absent from public report');
    h.eq(JSON.stringify(privateRows).includes('unselected_trigger'), false, 'unselected trigger excluded');
    h.eq(privateRows.functions.some(row => row.identity_arguments === 'other integer'), false, 'unselected overload excluded');
    report.capture = publicResult;
  });
  await h.scenario('missing function and trigger identities are drift', async () => {
    await admin.query('DROP FUNCTION storage.foldername(name text); DROP TRIGGER protect_bucket_control_update ON storage.buckets');
    const result = await storage.collect(client, targets);
    h.eq(result.status, 'drift', 'missing identities refuse success');
    h.eq(result.functions.find(row => row.function_name === 'foldername').status, 'missing', 'missing exact function');
    h.eq(result.triggers.find(row => row.trigger_name === 'protect_bucket_control_update').status, 'missing', 'missing exact trigger');
  });
  await h.scenario('changed attributes and definitions are drift', async () => {
    await admin.query(`ALTER TABLE storage.buckets DISABLE TRIGGER protect_bucket_control_insert;
      CREATE OR REPLACE FUNCTION storage.update_updated_at_column() RETURNS trigger LANGUAGE plpgsql
        AS $body$ BEGIN /* ${secret} changed */ RETURN NEW; END $body$;
      DROP TRIGGER protect_bucket_control_update_role ON storage.buckets;
      CREATE TRIGGER protect_bucket_control_update_role AFTER UPDATE ON storage.buckets
        FOR EACH ROW EXECUTE FUNCTION storage.enforce_bucket_lifecycle_service_role('${secret} changed')`);
    const result = await storage.collect(client, targets);
    h.eq(result.status, 'drift', 'changed identities refuse success');
    h.eq(result.functions.find(row => row.function_name === 'update_updated_at_column').status, 'definition_changed', 'function definition drift');
    h.eq(result.triggers.find(row => row.trigger_name === 'protect_bucket_control_insert').status, 'attributes_changed', 'trigger enablement drift');
    h.eq(result.triggers.find(row => row.trigger_name === 'protect_bucket_control_insert').changedAttributes, ['enabled'], 'exact changed attribute');
    h.eq(result.triggers.find(row => row.trigger_name === 'protect_bucket_control_update_role').status, 'definition_changed', 'argument-content trigger definition drift with unchanged argument count');
  });
  await h.close(client);
  await h.close(admin);
  report.status = 'passed';
} catch (error) {
  report.status = h.signal ? 'interrupted' : 'failed';
  report.error = { code: /^[A-Z0-9_]+$/.test(error.code ?? '') ? error.code : 'LOCAL_VALIDATION_FAILED',
    ...(error.label ? { label: error.label } : {}) };
} finally {
  await h.cleanup();
  process.removeListener('SIGINT', onInt);
  process.removeListener('SIGTERM', onTerm);
  report.finishedAt = new Date().toISOString();
  await writeFile(output, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify({ status: report.status, evidence: output.slice(root.length + 1),
    assertions: report.assertions, error: report.error, cleanup: report.cleanup }));
  process.exitCode = report.status === 'passed' ? 0 : 1;
}
