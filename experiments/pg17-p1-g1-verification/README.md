# PG17.4 Phase P1 & Milestone G1 End-to-End Verification

Rehearses `supabase/migrations/20261024000001_p1_foundation_and_reconciliation.sql` and all four G1 milestone gate criteria in an ephemeral PostgreSQL 17.4 cluster:

1. **Idempotent P1 Migration & Least-Privilege RLS (`S1_P1_MIGRATION_IDEMPOTENCY_AND_GRANTS`)**: Applies `20261024000001_p1_foundation_and_reconciliation.sql` twice, verifies all 9 P1 tables (`media_assets`, `legacy_media_references`, `consent_records`, `deletion_requests`, `deletion_targets`, `processing_jobs`, `processing_attempts`, `recording_sessions`, `recording_chunks`) have RLS enabled, and confirms direct `authenticated` DML is rejected (`42501`).
2. **5 / 20 / 30-Minute Multi-Chunk Recording Sessions & Fault Matrix (`S2_G1_RECORDING_5_20_30_MIN_AND_FAULT_MATRIX`)**: Rehearses 5-min, 20-min, and 30-min multi-chunk sessions across transient network retry (`retry_wait` -> `succeeded`), page-reload duplicate seal idempotency (`23505` unique key protection), lockscreen resume, and corrupted chunk quarantine (`quarantined` while preserving all `recording_chunks`).
3. **Cross-Family & Revoked-Member Isolation (`S3_G1_CROSS_FAMILY_AND_REVOKED_MEMBER_ISOLATION`)**: Confirms Family Beta and a revoked Family Alpha member see `0` rows across `media_assets`, `processing_jobs`, and `storage.objects`.
4. **Deletion Tombstone & Scheme B `pg_dump`/`pg_restore` Replay (`S4_G1_DELETION_TOMBSTONE_AND_POST_RESTORE_REPLAY`)**: Confirms a deletion tombstone immediately hides an asset from `authenticated` `SELECT`, and replaying the independent tombstone ledger after `pg_restore` prevents deleted asset/object resurrection.

## Run

```bash
node experiments/pg17-p1-g1-verification/verify.mjs
```
