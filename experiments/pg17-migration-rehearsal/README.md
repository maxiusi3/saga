# PG17 Migration Reconciliation & Scheme B Backup/Restore Rehearsal

Rehearses the 7 unregistered root migrations' forward idempotent reconciliation SQL, application rollback safety, and **Scheme B** (`pg_dump` custom archive + frozen Storage object SHA-256 manifest + post-freeze deletion tombstone replay + `pg_restore`) on the local PostgreSQL 17.4 runtime (`experiments/pg17-routines/runtime.mjs`).

## Run

```bash
node experiments/pg17-migration-rehearsal/verify.mjs
```

Evidence is written to `docs/research/evidence/2026-10-24-migration-rehearsal/`.
