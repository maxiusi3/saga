# G1 deletion leases — whole-change review

Reviewed 2026-11-07 against the frozen takeover batch at HEAD `c0669e8058343f91deba8e468b03e4bf817b1ca5`.

**Spec: CHANGES REQUESTED. Quality: CHANGES REQUESTED.** There is **one Minor / P3 finding (M1)** shared by both axes, not two separate findings. Critical: **0**. Important: **0**. The SQL state machine and actual SQL/adapter integration otherwise satisfy the reviewed local lease boundary. Correct M1 and perform a scoped re-review before recording unconditional whole-batch acceptance.

This is the requested single broad review of the complete current batch. I read `whole-review-brief.md`, `CLAUDE.md`, the accepted design/plan, `progress.md`, all 1,691 lines of `whole-change.patch`, the task reports/reviews/manifests, and relevant unchanged capture, seal-fence, fixture and deletion-service dependencies. I used the code-review skill's separate specification and quality axes, working alone as instructed. The inherited HEAD diff was not used as the review baseline.

## Consolidated actionable findings

### M1 — Reject impossible recovery state/attempt combinations (Minor / P3)

**Location:** `packages/web/src/lib/server/media-deletion-lease.ts:65–66`; the positive recovery fixture in `packages/web/src/lib/server/__tests__/media-deletion-lease.test.ts:75–77` also needs correction.

The parser checks that `attempt` is 1–3 and that recovered ownership/expiry are null, but it does not bind the attempt to the recovered state. Consequently, the real exported `recoverMediaDeletionJob` accepts all three impossible receipts: `failed` at attempt 1, `failed` at attempt 2, and `retry_wait` at attempt 3. The existing positive test actually treats `failed` at attempt 1 as valid because it inherits the common receipt's attempt.

The accepted design requires failure only after the third undispatched attempt (design line 29), strict state/owner/attempt shape validation (line 53), and generic failure for malformed responses (line 57). Actual SQL enforces the relation in both its table constraint (`20261106000004_media_deletion_leases.sql:22`) and history validator (line 196), and derives the correct transition at line 222. These accepted application receipts therefore cannot be produced by a valid execution of the reviewed SQL.

**Impact:** a malformed or incompatible RPC response is reported as a successful recovery, potentially misreporting exhaustion or retry eligibility to a future coordinator. This is a Minor validation gap: the current SQL still rejects invalid transitions, the adapter performs no automatic retry, both destructive capability flags remain false, and no current destructive caller is connected. There is no evidence of physical deletion, duplicate ownership or an unsafe SQL retry.

**Concrete correction:** reject `(state === 'failed' && attempt !== 3)` and `(state === 'retry_wait' && attempt === 3)` in receipt validation. Use attempt 3 in the successful `failed` fixture. Add public-export tests that reject the three impossible combinations with `media_deletion_lease_unavailable`, retain valid `retry_wait` attempts 1/2 and `failed` attempt 3, and retain `outcome_unknown` at all three attempts. No SQL or capture-interface change is indicated.

**Focused reproduction:** I transpiled the exact current adapter, SHA256 `03db82114edcc0aa3cfc903977c482993385862d210c42a6d452cfd42e90e844`, in memory with TypeScript 5.9.3 and invoked its real exported recovery function through a one-call fake transport. No source file or test suite was changed or rerun. Observed output:

```text
state=failed          attempt=1  RPC calls=1  accepted=true  EXPECTED reject
state=failed          attempt=2  RPC calls=1  accepted=true  EXPECTED reject
state=failed          attempt=3  RPC calls=1  accepted=true  valid control
state=retry_wait      attempt=1  RPC calls=1  accepted=true  valid control
state=retry_wait      attempt=2  RPC calls=1  accepted=true  valid control
state=retry_wait      attempt=3  RPC calls=1  accepted=true  EXPECTED reject
state=outcome_unknown attempt=3  RPC calls=1  accepted=true  valid control
```

Reproduction from the repository root:

```js
const fs = require('node:fs')
const ts = require('typescript')
const vm = require('node:vm')
const source = fs.readFileSync('packages/web/src/lib/server/media-deletion-lease.ts', 'utf8')
const code = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText
const api = {}
vm.runInNewContext(code, { exports: api, performance, AbortController, setTimeout, clearTimeout })
const base = {
  schemaVersion: 1,
  requestId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  projectId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  subjectId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  subjectType: 'story', captureTargetsSha256: 'a'.repeat(64), targetCount: 4,
  workerId: null, leaseExpiresAt: null, serverNow: '2026-11-06T00:00:00.123456+00:00',
  canDeleteStorage: false, physicalDeletionComplete: false,
}
;(async () => {
  for (const [state, attempt] of [
    ['failed', 1], ['failed', 2], ['failed', 3],
    ['retry_wait', 1], ['retry_wait', 2], ['retry_wait', 3], ['outcome_unknown', 3],
  ]) {
    let calls = 0
    const data = { ...base, state, attempt }
    const query = {
      abortSignal() { return query },
      retry() { return Promise.resolve({ data, error: null }) },
    }
    try {
      await api.recoverMediaDeletionJob(base.requestId, {
        admin: { rpc() { calls++; return query } },
      })
      console.log({ state, attempt, calls, accepted: true })
    } catch (error) {
      console.log({ state, attempt, calls, accepted: false, error: error.message })
    }
  }
})()
```

## Specification assessment

No other missing, misimplemented or out-of-scope requirement was identified.

| Boundary | Whole-change assessment |
| --- | --- |
| Immutable capture and separate execution ledger | All five actions read and preserve the complete accepted request/target rows. Target SHA256 uses the same UTC full-row ordering as the actual capture RPC. Jobs bind project, subject, digest and count; all existing attempts are validated before mutation. Capture replay is unaffected by the new ledger. |
| Security | Private tables use RLS, SELECT-only service grants and no direct service DML. The single SECURITY DEFINER RPC has fixed `pg_catalog, pg_temp`, UTC, VOLATILE and 3-second lock timeout settings. Actual non-superuser/non-bypass-RLS native role cases cover denied invocation, reads and direct writes. No Storage capability or path is returned. |
| Concurrency and fresh observations | Request SHARE then target SHARE precedes the request advisory lock and ordered ledger row locks. READ COMMITTED is required. The absent-job case is protected, and the native same-request race creates one owner while another request proceeds. Capture-wait and tamper-after-wait observations prove fresh committed reads. This order composes with the unchanged capture EXCLUSIVE first fence and seal SHARE first fence. |
| Time and ownership | SQL uses `clock_timestamp()` after waits, before transitions and before return. Equality is expired; active operations cannot revive expired or replaced owners. Start replay preserves timestamps, heartbeat never shortens expiry, and check is read-only. Adapter BigInt comparisons preserve microseconds; immutable inputs, local monotonic deadlines and return-time checks bound active and recovered responses. |
| Recovery and uncertainty | Three undispatched expiries retain history and exhaust into failed. An expired running attempt becomes outcome_unknown and cannot be reclaimed. Lost claim/start results are never taken as rollback. The actual adapter can observe running through its older leased receipt. M1 concerns only malformed recovered receipt acceptance; valid SQL transitions are correct. |
| Trigger rollback and malformed history | Complete expected job/attempt history and capture are compared after all writes. Required row counts and an early inserted-job read prevent suppressed writes from producing success. Native injection covers suppression, alteration, cross-row old-attempt mutation, capture mutation and malformed historical rows. |
| Scope and callers | The new adapter has no production execution caller or Storage import. The unchanged in-memory `executeDeletionRequestTargets` remains separate. The inventory diff adds exactly the one forward migration. Report/plan/handoff pending statuses are intentional until this review/correction closes; they are not findings. |

## Quality assessment

M1 is the sole actionable quality issue. The shared adapter request path keeps argument forwarding, strict parsing, cancellation, conservative deadlines and generic failures in one place. It performs one `.rpc(...).abortSignal(...).retry(false)` operation, with an independent cancellation race for ignored SDK aborts and no table fallback. Tests exercise actual public exports, not just implementation-shaped helpers. The native adapter runner compiles the real module and substitutes only RPC transport; it does not reimplement the lease state machine.

The SQL is bounded to three attempts and has explicit state transitions and complete-row validation. Global capture locks and full target scans retain a scaling boundary, already acknowledged by the accepted design; this review found no new correctness problem from that tradeoff.

## Independent evidence and preservation audit

These are fresh hash/snapshot checks of retained artifacts, not new full-suite runs. The only behavioral reproduction performed in this review was M1 above.

- Recomputed all **18** whole-manifest entries and patch SHA256 `484ea402bd95f5ac1b6d674c6c879a3e61076195f14ac652384ee40dd8443028`. Fresh `git apply --reverse --check whole-change.patch` passed. Matched both task patch hashes and owned-source manifests; Task 1's README is correctly the unchanged prefix retained in Task 2's immediate baseline.
- Rehashed all **5,133** Task 2 protected paths and all **4,866** prior evidence files. Matched the protected before/after maps. Rechecked **1,365** takeover paths: only the five declared existing document/inventory paths differ; historical capture/seal SQL, accepted API/fixture dependencies and root ESLint remain unchanged.
- Matched **23** compressed command archives, their decompressed hashes and recorded source maps: Task 1's 12, Task 2's 10 and `final-gate-01`. The gate's exact command is `npm run verify && npm test --workspace=packages/shared -- --runInBand && npm run test:infra`; its actual retained output reports **Web 161/3,338, shared 4/16, infra 23/23 and 184 generated pages**, exit 0. All **907** measured gate source hashes match current files and both gate source maps are equal. This remains pre-M1-correction evidence.
- SQL native result: `native-1793981704070-21b57f37-c7a4-496a-9ed9-2e2c45fcb5fc/results.json`, SHA256 `5fad8ffd6c1bec279180044957155a01d8a9e04c57816634ac30523a194a37ed`. Matched all **32** source hashes. Independently compared **134** complete rejection snapshots and expected SQLSTATEs, **34** complete capture replays, **30** lifecycle steps and check read-only state. Also compared queued tampering, post-wait capture, requester removal and timeout snapshots. All **six** recorded waits have actual ungranted locks and blocking PIDs; timeout is SQLSTATE 55P03 after **3004.071678 ms**. The recorded suite is **14 groups / 578 assertions**, with six real expiries.
- Adapter native result: `adapter-1793983734238-ec199cb7-0fcd-4216-86d3-09f8b17213f4/results.json`, SHA256 `d7680194c7d5b25472af648b2a8aacf853698741287aad6b5df707f320c1606c`. Matched all **29** source hashes. Transpiled the current module in memory and confirmed byte equality with retained compiled SHA256 `97536b05713b591612f93f0668aeb1ef8e6eb2ac86292fbfab946ac55cf3d5bb`.
- Independently compared all **20** adapter operations' non-ledger rows and other requests' ledger rows, **10** entirely read-only operations, and **five** complete capture replays. Each successful application receipt, after removing its local deadline, equals its actual SQL receipt. Checked all **19** one-subscription, one-AbortSignal, one-`retry(false)` transport records with exact null arguments. All three server expiry intervals satisfy `before < expiry <= after`, and the new connection has a different backend PID. These checks confirm the separate `parent-adapter-audit.json` claims. The retained adapter suite is **3 groups / 281 assertions**.
- Traversed **479** full SQL/adapter snapshots and independently decoded **5,800** synthetic object-byte entries. Their sizes and SHA256 values match their complete storage metadata rows. Both native runs retain successful cluster/directory/client cleanup records.
- Current `packages/web/next-env.d.ts` is byte-identical to the immediate saved baseline, SHA256 `7b550dda9686c16f36a17bf9051d5dbf31e98555b30d114ac49fc49a1e712651`, matching `next-env-restoration-01.json`. Independently reconstructed the recorded generated SHA256 `1862ac4bbbc5192d4bf562161df66ea547ed3e67173100656ab606ae9797db2b`: its only delta is `import "./.next/types/root-params.d.ts";` plus newline at baseline byte 117, immediately after the existing routes import. This also matches the parent's retained reconstruction `next-env-generated-01.d.ts`; the original receipt is unchanged. HEAD remains the takeover SHA; the index remains empty; fresh `git diff --check` passes. Only this review report was written by the reviewer.

## Acceptance boundary and next action

Apply one narrow adapter/test correction for M1 and refresh affected verification/fingerprints through the existing parent acceptance flow. A scoped re-review of M1 and its affected evidence is sufficient; this completed broad review need not be repeated.

All claims remain local synthetic-prerequisite qualification. Native pg transport is not live PostgREST. The restart case is a new worker/database connection, not an OS process-relaunch test. Loss cases deliberately discard committed SQL responses and do not qualify real network partitions. No full-chain migration, physical deletion, GC, late-write reconciliation, real backup/restore, cloud/provider or actual device qualification is conferred. All receipts retain `canDeleteStorage:false` and `physicalDeletionComplete:false`; **G1 remains 0/9**. No staging, commit, push, remote migration, deployment or other destructive action was performed or authorized by this review.
