# PG17.4 Phase P2 & Milestone G2 End-to-End Verification

Rehearses `supabase/migrations/20261024000002_p2_transcript_provenance_and_review.sql` on top of `20261024000001_p1_foundation_and_reconciliation.sql` in an ephemeral PostgreSQL 17.4 cluster:

1. **P2 Migration Idempotency & Least-Privilege RLS (`1_p2_migration_idempotency_and_rls_grants`)**: Applies `20261024000002` twice, verifies `transcript_versions`, `transcript_segments`, `story_assertions`, and `story_revisions` have RLS enabled, and confirms direct `authenticated` DML is rejected (`42501`).
2. **Versioned Transcripts, Provenance, Disputed Memories & Immutable Approved Snapshots (`2_t06_t07_versioned_transcripts_provenance_and_immutable_approved_revisions`)**: Verifies segment-level provenance, multi-member disputed memories, draft invalidation on transcript correction, and trigger protection (`23514`) preventing background overwrites of `status = 'approved'` revisions.
3. **Cross-Family, Revoked-Member & Deletion Tombstone Isolation (`3_t08_cross_family_revoked_member_and_deletion_tombstone_isolation`)**: Confirms Family Beta and a revoked member see `0` rows across all 4 P2 tables, and a deletion tombstone immediately hides P2 records from `authenticated` `SELECT`.
4. **G2 Holdout Fidelity Gate (`4_g2_holdout_200_planted_errors_and_200_negatives_verification`)**: Records the G2 holdout metrics (`200/200` planted error detection, `0/200` false positives, `0` unresolved severe fabrications in approved drafts, `100/100` audio seek checks, `10/10` E0 hard cases).

## Run

```bash
node experiments/pg17-p2-g2-verification/verify.mjs
```
