# Task 2 implementation report — strict deletion lease adapter

Status: **DONE** for the assigned implementation. Source frozen at `2026-11-06T16:51:54.317462+00:00`. Parent owns independent task reviews, whole-change review and the final full repository gate; this report does not claim those have finished.

## Scope and preservation

Implemented only the four assigned files: new application adapter, its Jest tests, the separate native adapter runner, and an append-only extension to the existing deletion-leases experiment README. The immediate README baseline was saved before editing at `task-2-before/experiments/pg17-deletion-leases/README.md`; absent new files are recorded as null in `task-2-before/baseline.json`. That baseline is authoritative, rather than Git HEAD, because Task 1 files and other accepted work are uncommitted.

HEAD remains `c0669e8058343f91deba8e468b03e4bf817b1ca5` in the inherited checkout. The frozen hashes prove all **5,133 protected pre-existing dependency/evidence files** remain byte-for-byte identical (`protectedDrift=[]`). The README's saved bytes remain an exact prefix of its final bytes. The protected set includes existing experimental fixtures/runners, migrations, accepted capture/lease adapters and their selected tests/configuration, plus all pre-existing research evidence. No accepted Task 1 SQL or fixture required a change; no interface issue remains.

No staging, commit, push, deployment, remote migration, paid service call, family data access, Storage deletion or metadata purge occurred. Native work used isolated synthetic PostgreSQL/file fixtures with cleanup. No subagents or reviewers were spawned by this implementer.

## Implemented application contract

- Exports `claimMediaDeletionJob(requestId, workerId, leaseMs, options)`, `startMediaDeletionJob(lease, options)`, `heartbeatMediaDeletionJob(lease, leaseMs, options)`, `checkMediaDeletionJobLease(lease, options)`, `recoverMediaDeletionJob(requestId, options)`, and `MediaDeletionLease` / `MediaDeletionLeaseReceipt`. Options use the existing `getSupabaseAdmin` return type, optional AbortSignal and integer 1–60000 ms timeout, default 5000.
- Sends all five SQL arguments exactly once, with null attempt on claim, null duration on start/check, and all three inapplicable fields null on recover. Every transport follows `.rpc(...).abortSignal(...).retry(false)`; there is no table fallback or retry.
- Validates closed 14-key SQL receipts, lowercase canonical UUIDs, the capture SHA256 and positive safe target count, schema version, bounded attempts and workers, valid subject/state combinations, null inactive ownership, exact UTC calendar shape and both capability flags being false. Active outputs are immutable 15-key receipts including `deadline`; inactive recovery outputs are immutable 14-key receipts without a deadline.
- Pins cloned request/project/subject/type/digest/count/worker/attempt identities before awaiting. Caller-owned lease or options mutations cannot replace pending expectations or the original signal. Transport receipts are also copied before return.
- Converts calendar-valid UTC timestamps to exact BigInt microseconds, with no millisecond-truncation comparison. One-microsecond positive, equality, inverted and overlong intervals are covered, including year 9999 beyond safe integer epoch-microseconds and valid historical years.
- Starts local monotonic budgets before transport, enforces timeout and the pinned active deadline both before transport and on return, and races a local rejection against SDK transport so ignored cancellation remains bounded. Start/check cannot extend the previous local deadline; only heartbeat may renew it. Deadlines are process-local values and are not persistence or transferable capabilities.
- Claim must return leased; start/heartbeat must return running. Start permits live running replay. Check permits leased → running after a lost start response and rejects running → leased. Heartbeat permits a TTL greater than a newly shorter requested duration while rejecting any expiry shortening or TTL above 120000 ms. Recovery accepts only retry_wait/failed/outcome_unknown.
- All malformed inputs, SQL/transport errors, aborts, deadlines and result loss fail with `media_deletion_lease_unavailable`. A lost response does not imply SQL rollback. No Storage runtime import, physical deletion worker or deletion completion state was added.

## TDD and verification evidence

All commands were captured through `command.py` with unique labels and retained compressed full logs plus command/source hashes. Every recorded command has `sourceDrift=[]`.

1. `task-2-jest-red-01` failed because the module did not exist, before any production adapter code was written.
2. `task-2-jest-green-01` ran 78 tests: 77 passed; one failed because the fake client's default parameter replaced an explicitly undefined response with a valid receipt. The fake was corrected to distinguish omitted from explicit undefined, without relaxing production parsing. `task-2-jest-green-02` then passed 78/78.
3. The first real adapter/native SQL run passed 281 assertions. The first root type-check exposed TS2366 on the catch/finally return path; an explicit `return unavailable()` fixed that compile-time path.
4. A concrete return-time budget gap for recovery receipt validation was reproduced in `task-2-jest-deadline-red-01` (one failure, 78 passes). The adapter now rechecks the deadline after recovery validation. The final Jest run passed **79/79**.
5. After the last source changes, the actual adapter/native run again passed **3 scenario groups / 281 assertions**, root `npm run type-check` passed for both workspaces, and root `node node_modules/eslint/bin/eslint.js --config eslint.config.cjs` passed on the adapter, Jest test and native runner. There were no further source changes.

| Command label | Exit | Receipt |
| --- | ---: | --- |
| `task-2-eslint-final-01` | 0 | `docs/research/evidence/2026-11-06-g1-deletion-leases/task-2-eslint-final-01.json` |
| `task-2-jest-deadline-red-01` | 1 | `docs/research/evidence/2026-11-06-g1-deletion-leases/task-2-jest-deadline-red-01.json` |
| `task-2-jest-final-01` | 0 | `docs/research/evidence/2026-11-06-g1-deletion-leases/task-2-jest-final-01.json` |
| `task-2-jest-green-01` | 1 | `docs/research/evidence/2026-11-06-g1-deletion-leases/task-2-jest-green-01.json` |
| `task-2-jest-green-02` | 0 | `docs/research/evidence/2026-11-06-g1-deletion-leases/task-2-jest-green-02.json` |
| `task-2-jest-red-01` | 1 | `docs/research/evidence/2026-11-06-g1-deletion-leases/task-2-jest-red-01.json` |
| `task-2-native-adapter-01` | 0 | `docs/research/evidence/2026-11-06-g1-deletion-leases/task-2-native-adapter-01.json` |
| `task-2-native-adapter-final-01` | 0 | `docs/research/evidence/2026-11-06-g1-deletion-leases/task-2-native-adapter-final-01.json` |
| `task-2-type-check-01` | 2 | `docs/research/evidence/2026-11-06-g1-deletion-leases/task-2-type-check-01.json` |
| `task-2-type-check-final-01` | 0 | `docs/research/evidence/2026-11-06-g1-deletion-leases/task-2-type-check-final-01.json` |

The Jest suite uses fake RPC transport only; it calls the actual exported adapter throughout. Its cases include exact arguments, every missing receipt key, bad extra/capability/identity fields, state regressions, exact time intervals, historical dates, mutation while pending, local expiry, SDK hang, caller abort, timeout, SQL failures and lost responses. It is not a helper-only suite.

## Native integration evidence

Final results: `docs/research/evidence/2026-11-06-g1-deletion-leases/adapter-1793983734238-ec199cb7-0fcd-4216-86d3-09f8b17213f4/results.json`

- Results SHA256: `d7680194c7d5b25472af648b2a8aacf853698741287aad6b5df707f320c1606c`.
- Compiled actual adapter artifact: `docs/research/evidence/2026-11-06-g1-deletion-leases/adapter-1793983734238-ec199cb7-0fcd-4216-86d3-09f8b17213f4/adapter.compiled.cjs`.
- Compiled artifact SHA256: `97536b05713b591612f93f0668aeb1ef8e6eb2ac86292fbfab946ac55cf3d5bb`.
- Final cleanup: cluster stopped, temporary directory removed, zero clients remaining, no errors.

The runner compiles the actual adapter unchanged to CommonJS and asserts that its compiled code has no runtime dependency imports. It substitutes **only pg-backed RPC transport**, using the accepted `setup`, `lease` and `snapshot` fixture exports. It explicitly observes one abortSignal call, one retry(false) call and one SQL subscription per operation. It fingerprints the transitive local fixture graph, actual SQL, actual application source and TypeScript compiled artifact.

Three real SQL lifecycle groups cover:

1. Claim → leased check → start → unchanged running start replay → shorter heartbeat without shortening expiry → running check → premature recovery denial → actual server-clock expiry → outcome_unknown → stable recover replay → reclaim denial.
2. A claim commits but its response is discarded; the original worker connection closes. After a real undispatched expiry, a different service-role backend connection recovers retry_wait and a new worker obtains attempt 2. Full history retains attempt 1 as expired and attempt 2 as leased.
3. Start commits but its response is discarded. The old leased receipt checks as running, then expires on the actual server clock. An expired local receipt starts no new RPC. Recovery returns outcome_unknown, and another worker cannot claim it.

Every observation retains complete before/after rows, transport arguments, raw SQL receipts, immutable application receipts or generic failure, and synthetic bytes. Every operation compares all non-ledger rows/bytes unchanged. Read-only operations compare the entire snapshot unchanged. Each lifecycle replays the accepted actual capture RPC and requires the original receipt plus identical entire snapshots including both new ledger tables. These assertions validate runtime durable ownership/recovery against actual PostgreSQL 17.4; they do **not** qualify hosted PostgREST cancellation or production networks.

## Frozen source and patch

| Owned file | Immediate before SHA256 | Final SHA256 |
| --- | --- | --- |
| `packages/web/src/lib/server/media-deletion-lease.ts` | `absent` | `03db82114edcc0aa3cfc903977c482993385862d210c42a6d452cfd42e90e844` |
| `packages/web/src/lib/server/__tests__/media-deletion-lease.test.ts` | `absent` | `347cc570f87bf365e9990263f40bd98910c964136ea9b88d928eb5e82d461614` |
| `experiments/pg17-deletion-leases/verify-adapter.mjs` | `absent` | `0c56b4d96bb272f34e00fe56120e0d6fe99783945ba65ba242e174e8bfe06017` |
| `experiments/pg17-deletion-leases/README.md` | `1dc446a4f2a16815cc7af0b07cfbf296bb5cc90a4a84fe47c9049c20ce26f1c6` | `b979e3b9e02dd8b002a919f7bb3e14871a87c38f0c4cbd3fb6a0d936baf9a857` |

Full hashes and preservation evidence: `task-2-hashes.json`. It contains immediate before/final source hashes, before/after hashes for every protected file, command receipt/archive/raw hashes, native source/compiled/result hashes and cleanup, patch hash, and reverse-check/diff-check results.

Patch: `task-2.patch`; SHA256 `d73548e8d30d2994191dcbbd965fe884b0eba6d8397c1ec2b8b94708d27e0bf8`. It contains only the three new assigned files and the README extension relative to the immediate saved baseline. `git apply --reverse --check task-2.patch` passed (exit 0). Repository `git diff --check` passed (exit 0). All changes remain unstaged and uncommitted.

## Concerns and remaining boundaries

No unresolved implementation or SQL interface concern. A timeout or lost response remains deliberately ambiguous until explicit observation/recovery. Process-local deadlines must not be serialized or transferred. Hosted PostgREST, actual destructive execution, reference-safe GC, late-write reconciliation, full migration-chain, backup/restore and device qualification remain outside this slice. G1 remains 0/9. Independent reviews and the final full gate are the parent's next steps.
