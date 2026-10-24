// One bounded, read-only evidence capture. Never reads business rows or object keys.
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');

const ROOT = path.resolve(__dirname, '..');
const EVIDENCE = path.join(ROOT, 'docs/research/evidence/2026-10-17-remote-metadata');
const PROJECT_REF = 'encdblxyxztvfxotfuyh';
const CA_PATH = path.join(EVIDENCE, 'supabase-prod-ca-2021.crt');
const CREDENTIAL_PATH = path.join(ROOT, 'supabase/.temp/metadata-reader-credentials');

const { parseCredentials, clientConfig, safeCode, readOnlySnapshot, runCapture } = require('./supabase-capture-runtime.cjs');

// The inventory comes from pg_catalog, whose table visibility does not depend on
// business SELECT grants. information_schema is checked separately, not trusted
// as proof of absence for this deliberately restricted login.
const QUERIES = {
  tables: `SELECT n.nspname AS schema_name, c.relname AS table_name, c.relkind,
      c.relrowsecurity AS rls_enabled, c.relforcerowsecurity AS rls_forced,
      pg_get_userbyid(c.relowner) AS owner
    FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname IN ('public','storage') AND c.relkind IN ('r','p','v','m','f')
    ORDER BY 1,2`,
  columns: `SELECT n.nspname AS schema_name, c.relname AS table_name, a.attname AS column_name,
      a.attnum AS ordinal_position, pg_catalog.format_type(a.atttypid,a.atttypmod) AS data_type,
      a.attnotnull AS not_null, a.attidentity AS identity, a.attgenerated AS generated,
      pg_get_expr(d.adbin,d.adrelid) AS default_expression
    FROM pg_catalog.pg_attribute a JOIN pg_catalog.pg_class c ON c.oid=a.attrelid
    JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
    LEFT JOIN pg_catalog.pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum
    WHERE n.nspname IN ('public','storage') AND c.relkind IN ('r','p','v','m','f')
      AND a.attnum>0 AND NOT a.attisdropped ORDER BY 1,2,4`,
  policies: `SELECT schemaname, tablename, policyname, permissive, roles::text[] AS roles, cmd, qual, with_check
    FROM pg_catalog.pg_policies WHERE schemaname IN ('public','storage') ORDER BY 1,2,3`,
  indexes: `SELECT schemaname, tablename, indexname, indexdef FROM pg_catalog.pg_indexes
    WHERE schemaname IN ('public','storage') ORDER BY 1,2,3`,
  constraints: `SELECT n.nspname AS schema_name, c.relname AS table_name, con.conname AS constraint_name,
      con.contype AS constraint_type, con.convalidated AS validated, pg_get_constraintdef(con.oid) AS definition
    FROM pg_catalog.pg_constraint con JOIN pg_catalog.pg_class c ON c.oid=con.conrelid
    JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname IN ('public','storage') ORDER BY 1,2,3`,
  privileges: `SELECT n.nspname AS schema_name, c.relname AS table_name, r.rolname AS role_name,
      has_schema_privilege(r.oid,n.oid,'USAGE') AS schema_usage,
      has_table_privilege(r.oid,c.oid,'SELECT') AS can_select,
      has_any_column_privilege(r.oid,c.oid,'SELECT') AS can_select_any_column,
      has_table_privilege(r.oid,c.oid,'INSERT') AS can_insert,
      has_table_privilege(r.oid,c.oid,'UPDATE') AS can_update,
      has_table_privilege(r.oid,c.oid,'DELETE') AS can_delete
    FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
    CROSS JOIN pg_catalog.pg_roles r
    WHERE n.nspname IN ('public','storage') AND c.relkind IN ('r','p','v','m','f')
      AND r.rolname IN ('metadata_reader','anon','authenticated','service_role') ORDER BY 1,2,3`,
  functions: `SELECT n.nspname AS schema_name, p.proname AS function_name,
      pg_catalog.pg_get_function_identity_arguments(p.oid) AS identity_arguments,
      pg_catalog.pg_get_function_result(p.oid) AS return_type, p.prokind AS kind,
      pg_catalog.pg_get_userbyid(p.proowner) AS owner, l.lanname AS language,
      p.prosecdef AS security_definer, p.provolatile AS volatility,
      p.proisstrict AS is_strict, p.proleakproof AS leakproof,
      ARRAY(SELECT setting FROM pg_catalog.unnest(p.proconfig) AS setting
        WHERE pg_catalog.split_part(setting,'=',1)='search_path') AS search_path,
      pg_catalog.md5(pg_catalog.pg_get_functiondef(p.oid)) AS definition_hash_md5,
      p.proacl IS NULL AS acl_is_null,
      EXISTS(SELECT 1 FROM pg_catalog.aclexplode(pg_catalog.acldefault('f',p.proowner)) a
        WHERE a.grantee=0 AND a.privilege_type='EXECUTE') AS builtin_default_public_execute,
      EXISTS(SELECT 1 FROM pg_catalog.aclexplode(COALESCE(p.proacl,pg_catalog.acldefault('f',p.proowner))) a
        WHERE a.grantee=0 AND a.privilege_type='EXECUTE') AS public_execute,
      EXISTS(SELECT 1 FROM pg_catalog.aclexplode(COALESCE(p.proacl,pg_catalog.acldefault('f',p.proowner))) a
        WHERE a.grantee=0 AND a.privilege_type='EXECUTE' AND a.is_grantable) AS public_execute_grantable
    FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
    JOIN pg_catalog.pg_language l ON l.oid=p.prolang
    WHERE n.nspname IN ('public','storage') AND p.prokind IN ('f','p','w') ORDER BY 1,2,3`,
  function_privileges: `SELECT n.nspname AS schema_name, p.proname AS function_name,
      pg_catalog.pg_get_function_identity_arguments(p.oid) AS identity_arguments,
      r.rolname AS role_name, pg_catalog.has_function_privilege(r.oid,p.oid,'EXECUTE') AS can_execute
    FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
    CROSS JOIN pg_catalog.pg_roles r
    WHERE n.nspname IN ('public','storage') AND p.prokind IN ('f','p','w')
      AND r.rolname IN ('metadata_reader','anon','authenticated','service_role') ORDER BY 1,2,3,4`,
  triggers: `SELECT n.nspname AS schema_name, c.relname AS table_name, t.tgname AS trigger_name,
      t.tgenabled AS enabled, t.tgtype AS type_bitmask,
      pn.nspname AS function_schema, p.proname AS function_name,
      pg_catalog.pg_get_function_identity_arguments(p.oid) AS function_identity_arguments,
      t.tgconstraint<>0 AS is_constraint, t.tgnargs AS argument_count,
      t.tgqual IS NOT NULL AS condition_present,
      pg_catalog.md5(pg_catalog.pg_get_triggerdef(t.oid)) AS definition_hash_md5
    FROM pg_catalog.pg_trigger t JOIN pg_catalog.pg_class c ON c.oid=t.tgrelid
    JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
    JOIN pg_catalog.pg_proc p ON p.oid=t.tgfoid
    JOIN pg_catalog.pg_namespace pn ON pn.oid=p.pronamespace
    WHERE n.nspname IN ('public','storage') AND NOT t.tgisinternal ORDER BY 1,2,3`,
  schema_privileges: `SELECT n.nspname AS schema_name, r.rolname AS role_name,
      pg_catalog.has_schema_privilege(r.oid,n.oid,'USAGE') AS can_use,
      pg_catalog.has_schema_privilege(r.oid,n.oid,'CREATE') AS can_create
    FROM pg_catalog.pg_namespace n CROSS JOIN pg_catalog.pg_roles r
    WHERE n.nspname IN ('public','storage')
      AND r.rolname IN ('metadata_reader','anon','authenticated','service_role') ORDER BY 1,2`,
  // Global defaults for namespaced objects apply to each target schema; retain
  // empty ACLs too. Defaults for creating schemas/large objects are out of scope,
  // and creation-time defaults do not modify any existing object's privileges.
  default_privileges: `SELECT n.nspname AS schema_name,
      CASE WHEN d.defaclnamespace=0 THEN 'global' ELSE 'schema' END AS default_scope,
      pg_catalog.pg_get_userbyid(d.defaclrole) AS owner, d.defaclobjtype AS object_type,
      d.defaclacl::text[] AS acl
    FROM pg_catalog.pg_namespace n JOIN pg_catalog.pg_default_acl d ON d.defaclnamespace IN (0,n.oid)
    WHERE n.nspname IN ('public','storage') AND d.defaclobjtype IN ('r','S','f','T') ORDER BY 1,2,3,4`,
  roles: `SELECT rolname, rolsuper, rolcreaterole, rolcreatedb, rolcanlogin, rolreplication, rolbypassrls
    FROM pg_catalog.pg_roles WHERE rolname IN ('metadata_reader','anon','authenticated','service_role') ORDER BY 1`,
  audit_views: `SELECT c.relname AS view_name, c.reloptions, pg_get_userbyid(c.relowner) AS owner,
      pg_get_viewdef(c.oid,true) AS definition FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='audit_meta' AND c.relkind='v' ORDER BY 1`,
  audit_visibility: `SELECT 'tables' AS source, count(*)::int AS rows_visible FROM audit_meta.tables
    UNION ALL SELECT 'columns', count(*)::int FROM audit_meta.columns ORDER BY 1`,
  migrations: `SELECT version, name FROM audit_meta.migrations ORDER BY version`,
  buckets: `SELECT id, name, public, file_size_limit, allowed_mime_types
    FROM storage.buckets WHERE id IN ('saga','audio-recordings') ORDER BY id`,
};

async function readSection(client, sql) {
  await client.query('SAVEPOINT metadata_section');
  let result;
  try {
    const response = await client.query(sql);
    result = { status: 'ok', rowCount: response.rows.length, rows: response.rows };
  } catch (error) {
    await client.query('ROLLBACK TO SAVEPOINT metadata_section');
    result = { status: error.code === '42501' ? 'denied' : 'error', code: safeCode(error) };
  }
  await client.query('RELEASE SAVEPOINT metadata_section');
  return result;
}

async function collect(client) {
  return readOnlySnapshot(client, async identity => {
    const sections = {};
    for (const [name, sql] of Object.entries(QUERIES)) sections[name] = await readSection(client, sql);
    return { identity, sections };
  });
}

const digest = bytes => createHash('sha256').update(bytes).digest('hex');

async function main() {
  const report = { schemaVersion: 1, projectRef: PROJECT_REF, capturedAt: new Date().toISOString(),
    scope: 'public/storage schema, routine and trigger structure/hashes, effective role privileges and applicable default ACLs; audit_meta definitions and migration version/name; two bucket configurations; no business rows, storage objects, routine bodies or trigger argument/condition values',
    tlsVerificationDisabled: false, queries: QUERIES,
    captureDeadline: { limitMs: 90000, exceeded: false },
    sourceSha256: { 'scripts/inspect-supabase-metadata.cjs': digest(fs.readFileSync(__filename)),
      'scripts/supabase-capture-runtime.cjs': digest(fs.readFileSync(path.join(__dirname, 'supabase-capture-runtime.cjs'))) } };
  await runCapture(report, () => {
    const credentials = parseCredentials(fs.readFileSync(CREDENTIAL_PATH, 'utf8'));
    const ca = fs.readFileSync(CA_PATH, 'utf8');
    report.caSha256 = digest(ca);
    const { Client } = require('../experiments/t05-durable-worker/node_modules/pg');
    return new Client(clientConfig(credentials, ca));
  }, async client => {
    const result = await collect(client);
    return { ...result, status: Object.values(result.sections).every(s => s.status === 'ok') ? 'captured' : 'partial' };
  });
  fs.mkdirSync(EVIDENCE, { recursive: true });
  // Exclusive creation retains earlier successful or failed evidence on reruns.
  const filename = `snapshot-${report.capturedAt.replace(/[:.]/g, '-')}.json`;
  fs.writeFileSync(path.join(EVIDENCE, filename), JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify({ status: report.status, evidence: path.relative(ROOT, path.join(EVIDENCE, filename)),
    sections: Object.fromEntries(Object.entries(report.sections || {}).map(([name, value]) => [name, { status: value.status, rowCount: value.rowCount, code: value.code }])), failure: report.failure }));
  process.exitCode = report.status === 'captured' ? 0 : report.status === 'partial' ? 2 : 1;
}

module.exports = { parseCredentials, clientConfig, safeCode, readSection, collect, QUERIES };
if (require.main === module) main().catch(() => { console.error('Metadata evidence could not be saved'); process.exitCode = 1; });
