# Task 2 independent review

**Spec: PASS. Quality: PASS.** Critical: **0**; Important: **0**; Minor: **0**. No changes requested for this task.

Reviewed specification compliance first, then implementation quality, against the immediate Task 2 patch and accepted application contract. This review covers the four assigned files, not the inherited whole working-tree diff or the already accepted Task 1 SQL review. The implementation report was treated as a claim to verify. Review performed alone; only this report was written. No suites, native cluster, source edits, Git mutations, or remote actions were performed.

## Review base and independent preservation checks

- Read `task-2-review-brief.md`, `task-2-brief.md`, the complete `task-2.patch`, `task-2-report.md`, `task-2-hashes.json`, `CLAUDE.md`, and `docs/superpowers/specs/2026-11-06-g1-deletion-leases-design.md` (application contract at lines 48–56; acceptance/limits at lines 58–64).
- Current HEAD is `c0669e8058343f91deba8e468b03e4bf817b1ca5`; the index is empty. Fresh read-only `git apply --reverse --check task-2.patch` and `git diff --check` both exit 0.
- Independently SHA256-checked all four owned files against the frozen `after` map. All match. Rehashed all **5,133** protected files; every current hash matches `protectedAfter`, and every `protectedBefore` value equals its corresponding `protectedAfter` value. The saved README baseline is an unchanged byte prefix of the current README.
- The patch hash independently matches `d73548e8d30d2994191dcbbd965fe884b0eba6d8397c1ec2b8b94708d27e0bf8`. The reviewed application source hash is `03db82114edcc0aa3cfc903977c482993385862d210c42a6d452cfd42e90e844`.
- Independently checked receipt, compressed-log and decompressed-log hashes for all ten command entries, read all their actual logs, and compared their before/after source maps. No command has source drift. Each final command's **907** recorded source hashes also matches current files.

## Specification review

| Required behavior | Independent assessment and source references |
| --- | --- |
| Public interface and exact SQL arguments | All five exports and both named public types are present. Claim sends null attempt; start/check send null duration; recovery sends null worker, attempt and duration. The only transport call is `rpc('media_deletion_job_lease', ...).abortSignal(...).retry(false)` (`packages/web/src/lib/server/media-deletion-lease.ts:3–23,100–103,136–159`). |
| Strict closed receipt and false capabilities | Exact own-key checking rejects missing, extra and symbol keys; values are copied before validation. Canonical UUID text, SHA256, safe positive count, attempt range, subject kind, active ownership/expiry and null inactive ownership are checked. Returned receipts are frozen; active receipts have 15 keys including deadline, recovery receipts have 14 (`media-deletion-lease.ts:25–75,105–126`). |
| Calendar and microseconds | Whole-second `Date.parse` plus ISO round-trip rejects normalized invalid calendars; the fraction is separately converted to BigInt microseconds. Comparisons preserve one-microsecond distinctions, including year 9999, and reject equality, inverted intervals and TTL above 120 seconds. Claim also enforces the requested TTL (`media-deletion-lease.ts:42–64,117–120`; tests at `packages/web/src/lib/server/__tests__/media-deletion-lease.test.ts:84–122`). |
| Immutable expectations and action states | Input leases are cloned synchronously before awaiting; project/request/subject/type/digest/count/worker/attempt expectations and original options/signal are pinned. Claim requires leased; start/heartbeat require running; heartbeat rejects leased input; check permits leased-to-running but rejects running-to-leased; recover accepts only inactive states (`media-deletion-lease.ts:69–75,86,106–120,140–145`; tests at lines 124–169). |
| Heartbeat and local deadlines | Heartbeat compares exact returned expiry with the pinned old expiry, permitting a shorter requested duration without permitting expiry shortening. The local budget starts before RPC waiting. Active operations are bounded by the original local deadline, including heartbeat; start/check cannot extend it. Only heartbeat can return a renewed deadline. Response and post-validation budget checks exist on active and recovery returns (`media-deletion-lease.ts:80–98,104–125`). |
| Timeout, cancellation and lost responses | A separate rejection promise races transport, so a transport ignoring AbortSignal remains bounded. Timeout, caller abort, SQL/transport failure and malformed responses all become `media_deletion_lease_unavailable`. Cleanup removes listeners/timer and aborts the transport controller. There is no retry, table fallback, runtime Storage import, destructive worker, or deletion completion capability (`media-deletion-lease.ts:90–133`). |
| Actual adapter/native integration | The runner compiles and requires the real adapter, asserts no runtime import substitution, and replaces only RPC transport. The transport invokes the actual five-argument SQL helper and loses selected responses only after SQL resolves (`experiments/pg17-deletion-leases/verify-adapter.mjs:35–70,115–130`; accepted fixture interface at `experiments/pg17-deletion-leases/fixture.mjs:4–23`). |
| Durable recovery and unchanged capture | Native scenarios exercise the actual state sequence, a closed old connection followed by another backend/new worker, and lost-start running-to-outcome_unknown. Before/after snapshots use full `to_jsonb(t)` rows and actual synthetic file bytes; all capture replays include both ledgers (`verify-adapter.mjs:71–112,132–189`; snapshot dependency at `experiments/pg17-deletion-capture/fixture.mjs:30–38`). |

The named Task 1 dependencies were read only to check transport, snapshot completeness and SQL receipt/state semantics. No change to the accepted SQL/fixture interface is needed.

## Verification evidence and native snapshot audit

Evidence directory: `docs/research/evidence/2026-11-06-g1-deletion-leases/`. The following are retained command evidence, independently read and fingerprint-checked here; they are not reruns during this review.

| Evidence | Verified result |
| --- | --- |
| `task-2-jest-red-01.json` and `.log.gz` | Missing adapter module; before-source map has no application adapter. This is the intended initial RED. |
| `task-2-jest-green-01/02.json` and logs | First failure is the explicitly undefined fake-response case; subsequent run passes 78/78. |
| `task-2-type-check-01.json` and log | TS2366 on the request return path, matching the report's explained correction. |
| `task-2-jest-deadline-red-01.json` and log | One failure for accepting a recovery result after its validation consumed the timeout, with 78 other tests passing. |
| `task-2-jest-final-01.json` and log | **79/79** tests pass against the frozen application source. Tests call real exports rather than only parser helpers. |
| `task-2-type-check-final-01.json` and log | Root `npm run type-check` passes both workspaces. |
| `task-2-eslint-final-01.json` and log | Canonical root ESLint config checks adapter, tests and native runner; exit 0. |
| `task-2-native-adapter-final-01.json` and log | PostgreSQL 17.4, **3 scenario groups / 281 assertions**, exit 0, clean cluster/file/client cleanup. |

Final native artifact base: `docs/research/evidence/2026-11-06-g1-deletion-leases/adapter-1793983734238-ec199cb7-0fcd-4216-86d3-09f8b17213f4/`.

- `results.json` independently hashes to `d7680194c7d5b25472af648b2a8aacf853698741287aad6b5df707f320c1606c`. All **29** native source fingerprints match current files and the frozen native entry (`results.json:29`). The first native run's result/compiled hashes also match its recorded entry; final acceptance uses the later artifact.
- Recompiled the current adapter in memory with TypeScript 5.9.3 and identical compiler options; output is byte-for-byte equal to the retained `adapter.compiled.cjs`, SHA256 `97536b05713b591612f93f0668aeb1ef8e6eb2ac86292fbfab946ac55cf3d5bb` (`results.json:31032`). No source or compiled file was written for this comparison.
- Independently traversed all **20** operation observations. Every complete non-ledger before/after object is equal; other requests' ledger rows are also unchanged. All **10** operations declared read-only preserve their entire snapshots. All **5** capture replays return the original capture receipt and preserve complete before/after snapshots. Across these **50** snapshots, decoded synthetic file bytes match each storage row's recorded byte count and SHA256 (`results.json:376–24185,24782–30937`). This checks rows and bytes, not just runner booleans.
- Independently checked all **19** actual transport entries: exact five argument names, action-specific nulls, one subscription, one AbortSignal call and one `retry(false)`. Signals start live and are eventually aborted. Every successful application receipt, excluding its local deadline, equals the retained raw SQL receipt. The expired local receipt produces **zero** RPC calls (`results.json:18801,24187`).
- Lost claim commits attempt 1 as leased with null start/finish; the old connection closes and backend PID changes **65159 → 65176**. After genuine expiry, recovery preserves attempt 1 as expired and a new worker creates leased attempt 2 (`results.json:7676,8856,10074,31037`).
- Lost start has a generic application failure but complete committed running job/attempt rows. The old leased receipt observes running; genuine expiry yields outcome_unknown in both ledgers, and reclaim is denied (`results.json:15205,16996,20592,22396`). All three retained expiry intervals independently satisfy `before < lease_expires_at <= after` (`results.json:30939`).
- Final retained state is 3 requests, 11 targets, 3 jobs and 4 attempts; all 6 synthetic storage objects retain their bytes. Cleanup reports stopped cluster, removed scratch directory, zero clients and no errors (`results.json:31042,31933`).

## Quality review and limitations

No actionable Critical, Important or Minor finding was identified. The small shared request path centralizes parsing, identity checks, deadline/cancellation and generic error behavior without introducing a second state machine in the pg transport. Tests address mutations during pending operations, ignored cancellation, precise timestamps and response loss. The README accurately describes the local transport substitution and preservation limits.

This task verdict does not independently accept the parent's full repository gate or whole-change review. Native pg transport does not qualify hosted PostgREST cancellation/network behavior; the restart scenario demonstrates a new database connection/worker rather than terminating and relaunching an OS process. The local deadline remains process-local and must not be persisted or transferred. Physical deletion, reference-safe GC, late Storage writes, full migration-chain rehearsal, backup/restore, hosted and device qualification remain outside this task. **G1 remains 0/9.**
