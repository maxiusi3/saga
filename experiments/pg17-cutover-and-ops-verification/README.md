# PG17.4 Cutover, Shadow-Read Backfill & Operational Alerting Verification

Rehearses the complete 4-migration upgrade chain (`20261024000001` through `20261024000004`) on PostgreSQL 17.4 along with:
1. **§5.4 Legacy Audio Backfill & 100% Shadow-Read Equivalence**: Backfills legacy `stories.audio_url` into `public.media_assets` and `public.legacy_media_references` (`mapping_state = 'bound'`) and verifies `0` unmapped or mismatched references.
2. **§5.4 Safe Rollback & Read-Preservation**: Cancels active `processing_jobs` without dropping data or weakening RLS isolation.
3. **§11 Operational Monitoring SQL Queries & Zero-PII Alerting**: Detects stalled `processing_jobs` leases, overdue (`> 7d`) `deletion_requests`, and `ai_usage_ledger` spend against budget caps while guaranteeing zero private family text or raw storage keys in alert metrics.

## Run

```bash
node experiments/pg17-cutover-and-ops-verification/verify.mjs
```
