# Recovery independent review receipt

Reviewed on 2026-11-13. Scope is Task1 Q1/Q2 and the two recovery findings from the first independent review, plus regressions adjacent to their fixes. The original comparison used `/tmp/saga-audit-repair-baseline.tar.gz`; the pre-existing uncommitted G1–G4 work was not treated as newly introduced recovery code.

**Verdict: both findings are closed. No remaining actionable P1/P2 was found in this focused rereview.** This receipt does not replace the parent's full-chain integration and repository verification gates.

| Prior finding | Current fix and independent result |
| --- | --- |
| P1: a stale publication status snapshot could delete a concurrently claimed and committed ZIP | `publication-delivery-worker.ts:50–65` now captures concrete attempt names before reading the database, then examines only those names. New lease tokens are persisted before their directories are created and are never reused by the claim operation. A missing job uses nonrecursive `rmdir` and tolerates a newly nonempty root. The original production-graph/filesystem probe changed from `referencedZipExists: false` to `true`. Both ordinary spool scanning and cleanup-queue handling use this helper. |
| P2: changed/cleared story audio pointer still advertised an impossible transcription retry | `20261113000001_processing_recovery.sql:107–113` now requires the story's audio pointer to match the reservation asset before assigning `retryableRequestId`. The original native PG17 probe now returns `status: pending`, `retryableRequestId: null`; forcing a new preparation reservation still cannot bypass the outbound pointer guard (`23505`). The UI therefore keeps this case pending instead of offering an unusable retry. |

Independent executions against the reviewed source:

| Check | Result |
| --- | --- |
| `node /tmp/saga-recovery-review-race.mjs` | Passed observed invariant: current job `ready` under the newly created token; its ZIP still exists. Production TypeScript graph and real filesystem, controlled delayed database response. Scratch `/tmp/saga-review-recovery-54I5xB`. |
| `node /tmp/saga-recovery-review-pointer.mjs` | Native PostgreSQL17 probe: 6 harness assertions; actual status has `retryableRequestId: null`, and outbound attempt is rejected with `23505`. Temporary cluster cleanup completed. Report `/tmp/saga-recovery-pointer-review-1794568977086/report.json`. |
| `npm test --workspace=packages/web -- --runInBand --watchman=false src/lib/server/__tests__/publication-delivery-worker.test.ts` | 1 suite, 14 tests passed. Covers committed acknowledgement loss, unknown reconciliation, temporary cleanup failure, stale/revoked attempts, new-attempt races against queued/running/failed/missing snapshots, and cleanup-queue races. |

The new cleanup ordering preserves the known lease directory and does not recursively remove newly created children. Confirmed unreferenced captured attempts remain eligible for removal. Query errors still fail closed rather than becoming proof of absence. The transcription change only narrows retry advertisement and retains the existing preparation budget, source/consent/version checks, and outbound fence. No adjacent regression was found in these changes.

The implementation owner's [native/Chrome report](../recovery/native-1794567914438-c615bd09-4207-475e-86d8-d70b69392350/report.json) was inspected, not rerun in this review. It reports 730 assertions, including an actual native SQL stale-response interleaving with a second production ZIP worker, ZIP digest/CRC retention, changed and null audio-pointer checks, and Chrome consent/retry coverage. Its recorded source hashes match the two production files reviewed below. The independently rerun probes and 14-test suite above are separate reviewer evidence; the owner's reported 97-test focused run is not claimed as an independent execution.

| Reviewed source | SHA-256 |
| --- | --- |
| `packages/web/src/lib/server/publication-delivery-worker.ts` | `03d2b89db4ecb6d45cc9aa6e01089abce8b38cf1bd611985fcef9ec306dbe8db` |
| `supabase/migrations/20261113000001_processing_recovery.sql` | `c3e97220d7ffb13b5b24234391fef2a9265fd7adf0f22baadeeee6fbef5b3d94` |

No production source was edited, no full suite was run, and no remote migration, deployment, provider request, or user notification was performed by this reviewer. Only this requested receipt was added to the repository. The native pointer probe applies the migration chain through recovery `00001`; later repair migrations remain within the parent's integration scope.
