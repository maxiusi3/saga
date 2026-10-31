# Deployment collection coverage: isolated PostgreSQL 17 verification

Run from the repository root:

```sh
node experiments/pg17-deployment-collection-coverage/verify.mjs
node experiments/pg17-deployment-collection-coverage/verify.mjs --without-migration
PGHOST=127.0.0.1 PGPORT=1 PGDATABASE=synthetic_do_not_use \
PGUSER=synthetic PGPASSWORD=synthetic PGSSLMODE=require \
PGOPTIONS='-c search_path=synthetic_do_not_use' \
PGSERVICE=synthetic_do_not_use PGSERVICEFILE=/tmp/synthetic-no-pg-service \
DATABASE_URL=postgresql://synthetic:synthetic@127.0.0.1:1/synthetic_do_not_use \
node experiments/pg17-deployment-collection-coverage/verify.mjs
```

Normal and contaminated runs must pass. `--without-migration` skips only the
new deployment collection coverage migration (`20261030000002`), so it must
fail with SQLSTATE `42883` for the missing `read_operational_snapshot_v4()`
RPC.

## Scope and boundaries

- Verifies `public.deployment_collection_coverage`,
  `public.archive_attempt_builds`, `public.upload_attempt_builds`,
  `public.seal_deployment_collection_coverage(text,text)`,
  `public.begin_archive_assembly_attempt_v2(uuid,text)`,
  `public.begin_browser_upload_attempt_v2(uuid,text,text)` and
  `public.read_operational_snapshot_v4()` on an isolated PostgreSQL 17.4
  cluster over a private `/tmp` Unix socket.
- Preserves `v1`, `v2` and `v3` tables, columns, function definitions and ACLs
  byte-for-byte.
- Strictly separates database migration ledger age (`windowComplete`) from
  post-deployment release cutover age (`cutoverWindowComplete`) and build
  attribution completeness (`buildCoverageComplete`).
- Running the database migration does not insert a synthetic cutover seal.
- Does not prove live production fleet rollout, non-project-hub upload
  channels, pre-`begin` browser failures, alert delivery or provider terms.
