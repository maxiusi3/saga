# Independent RLS rehearsal fix review

2026-10-17. Verdict: **PASS within this incremental scope. R1 and R2 are closed; the two P3 follow-ups identified during the first incremental inspection are also closed. No remaining actionable finding was identified in the reviewed fixes.**

This report combines the earlier static inspection of the R1/R2 fixes with a narrowly targeted final inspection of the cancellation checkpoint, PostgreSQL start instrumentation, and explicit local pg connection settings. Requirements come from [the prior independent review](review-followup.md). It does not repeat the review of unchanged authorization policies or extend acceptance beyond this local synthetic PostgreSQL 14 experiment.

Only this new report was written. No tests were rerun, source or Git state changed, credentials read, remote services contacted, or additional agents spawned. Saved reports were read and their source manifests compared with current files; runtime results below remain the recorded executions, not executions performed by this reviewer.

## Closure of the original findings

### R1 — P2: Complete ECMAScript edge whitespace

Closed. `candidate.sql:46–49` supplies all 25 current ECMAScript WhiteSpace/LineTerminator code points to the boundary comparison, including U+1680, U+2000–U+200A, U+2028/U+2029, U+202F, U+205F, U+3000 and U+FEFF. It compares the exact key with its trimmed value rather than changing the stored key. The shared read helper also gates insertion.

`scenarios.mjs:252–275` checks both edges for every listed code point against JavaScript `trim()` and SQL insertion denial, then checks that an interior U+3000 remains accepted. The current `parseMediaReference` rejects `path !== path.trim()` at `packages/web/src/lib/media-reference.ts:17`; the regression checks that exact rejection predicate rather than importing the TypeScript parser. The saved pre-fix run [run-1792214184167-50104.json](run-1792214184167-50104.json) failed when U+1680 was accepted. The final run passes the edge and interior cases.

### R2 — P2: Pending acquisition and signal cleanup

Closed. `emergency()` now records cancellation instead of independently cleaning or exiting. `allocateScratch()` registers the real allocation before returning it, and the main path checks cancellation after acquisition. Database clients are registered before connecting; connection/query checkpoints stop subsequent work. The main `finally` owns the final cleanup and report, while the main catch preserves an existing interruption request. Cleanup can remove registered allocations even if the caller did not receive a completed allocation result.

The allocation regression pauses around the return of a real `mkdtemp` result using an explicit IPC gate. It exercises SIGTERM, SIGINT and the deadline at that boundary, preserves the stable-fixture SIGTERM case, and covers exceptions after allocation and setup. The controller checks exit status and directory absence separately from the child's cleanup claims. The pre-fix [shutdown report](shutdown-regression-1792214184125-50105.json) recorded a surviving directory and a separate rescue; final cases require no rescue. This is a controlled acquisition-boundary regression, not a claim that every possible OS scheduling point was exercised.

## Follow-ups found and closed during this review

1. **P3 — Check cancellation after the first evidence save.** The initially reviewed code awaited `save()` and then began socket-directory creation without another checkpoint. A signal during that save could permit one additional setup step inside the already-owned scratch directory. Current `verify.mjs:280–283` checks cancellation before `mkdir`; this ordering gap is closed.
2. **P3 — Give the no-start assertion a real input.** The initially reviewed shutdown test checked `runtime.clusterStartAttempted`, but the runner never wrote that field. Current `verify.mjs:296–298` checks cancellation and records `true` immediately before `pg_ctl start`. `verify-shutdown.mjs:119–122` requires the field to remain absent for cancelled allocations and to be true for both fixture cases. The final child reports exhibit both expected values, so the assertion is no longer vacuous.

The final targeted check also covers the separately reported host pg environment issue. `verify.mjs:314–315` explicitly sets `ssl: false` and a nonempty synthetic password. The installed pg 8.16.3 code honors an explicit SSL value, prefers the nonempty configured password, and skips pgpass lookup when that password is present. This supports the updated README's specific PGSSLMODE/PGPASSWORD/pgpass isolation claim. The supplied pre-fix [host-environment run](run-1792214636839-52369.json) records an SSL failure with successful cleanup. This review did not inspect or certify the separate T02 implementation.

## Final saved evidence and source identity

- [Final normal run](run-1792214844651-52596.json): `passed`, **63 scenarios / 351 assertions**, PostgreSQL 14.17, Node 22.22.2, pg 8.16.3.
- [Final shutdown controller](shutdown-regression-1792214844605-52597.json): **6/6 expected outcomes passed**. Allocation SIGTERM/SIGINT/deadline retain `interrupted` and the expected signal; the stable-fixture case retains `synthetic_fixture_ready`. Both injected exception cases retain `failed` as intended.
- All final cases report `clusterStopped=true`, `tempDirectoryRemoved=true`, `clientsRemaining=0`, `errors=[]`; the controller observes each directory absent after exit and records `rescue.needed=false` for every case.
- Both final manifests and all six child manifests match current sources. Earlier RED and intermediate evidence retain their original hashes and outcomes.

| Source | Current SHA-256 |
|---|---|
| `README.md` | `62712b43e2e702fc3225b636e21680161c1545a31cde1f4b678c409bd92b96ec` |
| `candidate.sql` | `4fbb8a4449c27b8f19dee2a173fcf8f03c945b5a6949f5e3c9a752e3c496164b` |
| `fixture.sql` | `d70b14d3f789f10fcf3f37c40767b0e877fbb5f6851cf83ef41d01d625e9f550` |
| `scenarios.mjs` | `029af8de89675f3f90d6b4b201b25a911b969e4f4229f9e52074b726d6a83c91` |
| `verify.mjs` | `2131ef7c1ac40669b1c12c5868c5f28eb5873a1e12634d9a6e514fd0964e4c70` |
| `verify-shutdown.mjs` | `b643a37aca55fd05d8cd4415be425a7e6d809eb012d6debc667fcaa559b551d8` |

This PASS closes the reviewed local fixes. Storage HTTP, authentication-gateway trust, the complete production schema, PostgreSQL 17 behavior, privileged adapters, lifecycle/consent rules, old-client compatibility, and deployment/rollback remain outside its acceptance scope.
