# Task 1 independent Spec + Quality review

Reviewed 2026-11-07 in the inherited checkout at HEAD `c0669e8058343f91deba8e468b03e4bf817b1ca5`.

**Spec: PASS. Quality: PASS.** No actionable Critical, Important or Minor findings in the exact Task 1 takeover diff. Task 1 is suitable for Task 2 to consume. This is a task-scoped acceptance, not the parent whole-change review, repository gate or a G1 milestone.

## Scope and reproducibility

Read `CLAUDE.md`, the accepted `2026-11-06-g1-deletion-leases-design.md`, `task-1-brief.md`, `task-1-report.md`, all nine files in `task-1.patch`, and essential capture/schema/runtime dependencies. The review used the code-review skill's separate specification and quality axes without further delegation, as instructed.

Independently recomputed and matched:

- All nine current file hashes in `task-1-hashes.json`.
- All seven protected dependency hashes: accepted capture fixture/runner/scenarios, capture SQL, seal fence SQL, capture adapter, and canonical root ESLint configuration.
- Immediate inventory baseline hash and diff: exactly the lease migration line was appended after `20261106000003_recording_seal_deletion_fence.sql`; earlier uncommitted additions remain intact.
- Patch SHA256 `39b046b9190b9f7ae112b24c50e23549d5ee04eebcc82161ef77fd33826b4ff5` and native result SHA256 `5fad8ffd6c1bec279180044957155a01d8a9e04c57816634ac30523a194a37ed`.
- All 32 final native source fingerprints, all 12 archived command-log hashes, and every archived command's unchanged before/after source fingerprints.

Read-only `git apply --reverse --check .superpowers/sdd/2026-11-06-upgrade-g1-deletion-leases/task-1.patch` passed during this review. No suite was rerun; no unresolved defect required a focused native reproduction. Only this review file was written; no source/index/HEAD mutation was performed.

## Spec review

No missing or incorrectly implemented Task 1 requirement was found.

| Contract | Inspected implementation and evidence |
| --- | --- |
| Private ledger and service-only writes | Migration lines 3–51 create separate tables, bounded state/time constraints, RLS and SELECT-only service grants. Lines 53–59 and 289–290 restrict the VOLATILE SECURITY DEFINER routine with fixed `pg_catalog, pg_temp`, UTC and 3s lock timeout. Native actors are actual NOSUPERUSER/NOBYPASSRLS connections; anon/authenticated RPC and table reads fail with 42501; all six service direct INSERT/UPDATE/DELETE cases fail with 42501. |
| Immutable complete capture | Lines 106–147 validate version, typed/canonical identities, request state/times/execution fields, same-subject uniqueness, complete canonical target-row digest/count and closed metadata/storage shape. This uses the same target aggregation and safe-path rules as accepted capture SQL. Lines 269–276 compare the full request and all target rows after writes. Capture source/fixtures remain byte-identical. |
| First locks and fresh clock | Lines 99–105 acquire requests SHARE, targets SHARE, request advisory lock, job row and ordered attempt rows before reading source/clock. Lines 201 and 277 resample actual database time before transitions and receipt. Native evidence records six real ungranted locks/blocking PIDs, including both capture tables and concurrent absent-job claims. |
| All five transitions | Lines 201–237 implement claim/start/heartbeat/check/recover. Claim appends exactly one attempt and requires absent/retry_wait state; start replay is read-only; heartbeat uses greatest(existing expiry, new requested expiry); check writes nothing; recovery only changes expired active work. Three real undispatched expiries reach failed with all attempts retained. |
| Old ownership and unknown outcome | Lines 217–228 reject expired or mismatched owner/attempt and make expired running work outcome_unknown. No path claims failed/outcome_unknown. Native prior-owner/attempt start/heartbeat/check reject after reassignment; discarded start response, independent reconnection, real running expiry and unknown recovery are retained. |
| Full history and trigger failures | Lines 149–198 validate every prior/current attempt, contiguous numbering, bound identities and chronology. Lines 238–276 derive independent expected complete rows, require affected row counts, check the job before dependent attempt insertion, and compare all current/prior attempt rows and capture after all writes. Native failures cover job/attempt INSERT/UPDATE suppression/alteration, capture mutation, prior-attempt rewriting and malformed preexisting history. |
| Closed coordination-only receipts | Lines 283–286 return only the specified 14 fields; both capability flags are literal false. Native lifecycle receipts retain that shape; no Storage delete or metadata purge path is introduced. |
| Reusable fixture and scope | `fixture.mjs` exports the requested setup/lease/snapshot functions, applies/fingerprints actual SQL through the supplied source reader and extends accepted snapshots with both tables. Only snapshot observer timezone changes. The migration inventory change proves ordering only. |

The requester-removal scenario genuinely changes the project facilitator away from the captured request's `requested_by`; the waiting claim succeeds without reauthorizing that original requester. The claim preserves the post-removal full source snapshot. This matches the persistent-work-order requirement.

## Quality review

No actionable correctness, privacy, transactionality, maintainability or repository-convention issue was found in the reviewed slice. Production behavior is kept in one bounded SQL routine with explicit closed states and action arguments. The native helpers are split by lifecycle, faults and locks and reuse the accepted capture fixture. Historical SQL and accepted application/capture code are not edited.

The postwrite design specifically avoids trusting RETURNING or just current-attempt values: both complete scoped ledger rows/history and immutable capture are re-read. Read-only start/recover replays and check still validate that full state. The early job check also prevents a suppressed job INSERT from turning into a misleading dependent FK error.

### Actionable findings

- Critical: none.
- Important: none.
- Minor: none.

## Evidence audit

Final native result inspected: `docs/research/evidence/2026-11-06-g1-deletion-leases/native-1793981704070-21b57f37-c7a4-496a-9ed9-2e2c45fcb5fc/results.json`.

Its retained actual rows and event details support **578 assertions, 14 scenarios, 134 expected rejections, six real server expiries and six observed lock waits**. Independently recomputed comparisons, rather than trusting aggregate status:

- All 134 rejection outcomes equal their expected SQLSTATE and retain exact complete before/after row and synthetic-byte snapshots.
- All 34 accepted capture replays retain identical complete snapshots.
- All 30 recorded lifecycle steps retain every non-ledger row and synthetic byte; each check is entirely read-only.
- Queued request/target tampering rejects after the actual lock wait with no additional row changes.
- The capture-wait result equals the lock holder's complete newly committed capture snapshot except the intentionally added ledger.
- Same-request competition yields one owner and attempt while an independent request proceeds; other data/bytes remain exact.
- The observed lock timeout is SQLSTATE 55P03 after **3004.071678 ms**, with identical before/after snapshots.
- Complete attempt rows preserve PostgreSQL microseconds. All expected inactive replays and exhaustion/unknown transitions are present. The expiry-observation helper's JavaScript Date rendering is millisecond precision, but transition decisions are SQL-side and the complete ledger snapshots retain microsecond evidence.

Read all 12 command archives and receipts. RED preserves the expected 42883 after actual capture, with 28 prerequisite assertions and no lease migration in its pre-command source inventory. Final native GREEN, inventory **7/7**, all six Node syntax checks, canonical root ESLint, and patch check have exit code 0 and empty source drift. The prior five native failures remain archived. Examined their actual diagnostics: the suppressed job FK 23503 and fault-trigger 42P01 match the reported corrections; the retained native05 timestamp frames represent the same instant in +08:00 and +00:00, consistent with the observer-timezone fix. The final unchanged full comparison passes.

Native records identify PostgreSQL **17.4**, actual service/anon/authenticated sessions, the expected function ACL/settings, Unix-socket transport and the actual applied capture/seal/lease SQL. Cleanup records show the cluster stopped, temporary directory removed and zero clients remaining.

## Remaining acceptance boundary

Task 2 adapter/integration is not reviewed here. The parent still owns integration, independent whole-change review, broader preservation audit, final docs and `npm run verify && npm test --workspace=packages/shared -- --runInBand && npm run test:infra`.

These local synthetic-prerequisite PG results do not qualify the full migration chain, live PostgREST, cloud/provider/device behavior, backup/restore, reference-safe GC, late writes or physical deletion. Lost-start coverage deliberately discards a completed SQL response and reconnects; it is not a live network-partition qualification. Both `canDeleteStorage:false` and `physicalDeletionComplete:false` remain binding. G1 remains 0/9.
