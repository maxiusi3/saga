-- User-run, read-only metadata/configuration evidence. Run each block separately
-- in the existing saga Supabase project's SQL Editor. Do not grant privileges.
-- On any error, ROLLBACK and retain the SQLSTATE; do not retry by changing roles.
-- No business rows, object names, credentials or function bodies are selected.

-- A. Only the two known bucket configurations; no object listing.
BEGIN TRANSACTION READ ONLY;
SET LOCAL statement_timeout = '10s';
SET LOCAL lock_timeout = '2s';
SELECT id, name, public, file_size_limit, allowed_mime_types, type::text,
       versioning_status,
       lifecycle_configuration IS NOT NULL AS lifecycle_configured,
       CASE WHEN jsonb_typeof(lifecycle_configuration->'rules') = 'array'
            THEN jsonb_array_length(lifecycle_configuration->'rules') END AS lifecycle_rule_count
FROM storage.buckets
WHERE id IN ('saga', 'audio-recordings')
ORDER BY id;
ROLLBACK;

-- B. Actual enum labels, no assumption based on defaults in other tables.
BEGIN TRANSACTION READ ONLY;
SET LOCAL statement_timeout = '10s';
SET LOCAL lock_timeout = '2s';
SELECT n.nspname AS schema_name, t.typname, e.enumsortorder, e.enumlabel
FROM pg_catalog.pg_type t
JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace
JOIN pg_catalog.pg_enum e ON e.enumtypid = t.oid
WHERE n.nspname = 'storage' AND t.typname = 'buckettype'
ORDER BY e.enumsortorder;
ROLLBACK;

-- C. Only functions referenced by noninternal buckets/objects triggers,
-- plus foldername(text), which the saved object policies call. Hashes only.
BEGIN TRANSACTION READ ONLY;
SET LOCAL statement_timeout = '10s';
SET LOCAL lock_timeout = '2s';
WITH selected AS (
  SELECT DISTINCT tr.tgfoid AS oid
  FROM pg_catalog.pg_trigger tr
  JOIN pg_catalog.pg_class c ON c.oid = tr.tgrelid
  JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'storage' AND c.relname IN ('buckets', 'objects')
    AND NOT tr.tgisinternal
  UNION
  SELECT p.oid
  FROM pg_catalog.pg_proc p
  JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'storage' AND p.proname = 'foldername'
    AND pg_catalog.oidvectortypes(p.proargtypes) = 'text'
)
SELECT n.nspname AS schema_name, p.proname,
       pg_catalog.pg_get_function_identity_arguments(p.oid) AS identity_arguments,
       pg_catalog.pg_get_function_result(p.oid) AS result_type,
       l.lanname AS language, p.prosecdef AS security_definer,
       pg_catalog.pg_get_userbyid(p.proowner) AS owner,
       pg_catalog.md5(pg_catalog.pg_get_functiondef(p.oid)) AS definition_md5
FROM selected s
JOIN pg_catalog.pg_proc p ON p.oid = s.oid
JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
JOIN pg_catalog.pg_language l ON l.oid = p.prolang
ORDER BY 1, 2, 3;
ROLLBACK;

-- D. Registered migration versions only; never select statements or run repair.
BEGIN TRANSACTION READ ONLY;
SET LOCAL statement_timeout = '10s';
SET LOCAL lock_timeout = '2s';
SELECT version FROM supabase_migrations.schema_migrations ORDER BY version;
ROLLBACK;
