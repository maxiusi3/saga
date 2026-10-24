# PG17.4 Phase P3 & G3 End-to-End Verification

Verifies Phase P3 (`T09 → T10 → T11`, plus `T12` closure) and Quality Gate **G3** against an isolated PostgreSQL 17.4 instance:
1. `20261024000003_p3_archive_search_and_entitlements.sql` idempotency, RLS, privilege revocation, and `trg_prevent_publication_snapshot_mutation` (`23514`).
2. T09 frozen publication snapshots, 12-month hosting retention schedule, and multi-device offline archive & PDF 1.4 verification.
3. T10 permission-filtered provenance search (`tsvector` + entity arrays), audio timestamp citations, zero-fabrication on missing records, cross-family/revoked-member denial, and deletion tombstone masking.
4. T11 US$59 package (`digital_project_59`) grant, duplicate webhook deduplication, out-of-order `refund` before `grant` suppression (`grant_suppressed`), and Scheme B `pg_dump -Fc` + `pg_restore` + deletion tombstone replay.

## Run

```bash
node experiments/pg17-p3-g3-verification/verify.mjs
```
