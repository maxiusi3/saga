# M1 scoped final re-review

Reviewed 2026-11-07 against `final-fix-before/` and the exact two-file `final-fix.patch`.

**M1: ADDRESSED. Spec: PASS. Quality: PASS.** New breakage caused by this correction: **none found**. Critical: **0**; Important: **0**; Minor: **0** remaining within this scoped review. The correction closes the sole finding in `whole-review.md`; that original broad review is preserved unchanged.

## Scope and correction

Read `final-fix-report.md`, `final-fix.patch`, `final-fix-hashes.json`, the original M1, and the affected parser/test context. This review is limited to the added inactive-state guard in `packages/web/src/lib/server/media-deletion-lease.ts:66` and recovery cases in `packages/web/src/lib/server/__tests__/media-deletion-lease.test.ts:75–94`. It does not repeat the broad batch review.

The new guard rejects `failed` unless attempt is 3 and rejects `retry_wait` at attempt 3. The earlier integer/range check still rejects values outside 1–3. `outcome_unknown` remains valid at all three attempts. The change is in the inactive-state branch, so the active claim/start/heartbeat/check parsing and deadline paths remain unchanged. Existing null-ownership, false-capability, exact-key, request identity and generic-error checks remain in place. SQL, capture, native runner and transport were not changed by this patch.

The positive fixture now uses valid state/attempt pairs rather than accepting `failed` at attempt 1. Tests exercise the real exported `recoverMediaDeletionJob`, covering all three rejected combinations and all six valid combinations.

## Independent focused reproduction

Transpiled the actual corrected source in memory with TypeScript 5.9.3 and repeated M1's public-export reproduction over the complete 3×3 recovery matrix. No Jest suite or native cluster was rerun in this review.

| Recovered state | Attempt 1 | Attempt 2 | Attempt 3 |
| --- | --- | --- | --- |
| `failed` | Generic rejection | Generic rejection | Accepted |
| `retry_wait` | Accepted | Accepted | Generic rejection |
| `outcome_unknown` | Accepted | Accepted | Accepted |

All three failures equal `media_deletion_lease_unavailable`. Every valid result equals its input receipt, is frozen, has exactly 14 own keys and retains `canDeleteStorage:false` / `physicalDeletionComplete:false`. Every matrix case performs exactly one RPC, one AbortSignal call and one `retry(false)` call. Thus the original M1 reproduction now behaves as required without broadening capabilities or adding retries.

## Exact code and evidence verification

- Recomputed both immediate before hashes and both current after hashes. Regenerated the unified diff in memory from these saved-before/current files and obtained byte-for-byte equality with `final-fix.patch`, SHA256 `9ae9f4921770c29c594fe9b0a89522d66d6f17d7782878a08bba5cdae2042b95`. Fresh reverse-patch check passes.
- Corrected adapter SHA256: `9d38b746b82142b5d085b12e82b1b426ae8f071d58a3dda0703c0ecc2154e4a5`. Corrected tests SHA256: `54ccef1ad269ee3f70f6d904d4cda6d93beb1c5bf1a1ae37be1d73c23101620a`. Both match the frozen manifest.
- Recomputed the report hash and all **five** correction command-receipt, compressed-log and decompressed-log hashes. Each command's before/after measured source maps are equal. Final Jest, native and canonical ESLint command maps each contain **907** sources and match current files.
- Read the actual RED log: exactly `failed/1`, `failed/2` and `retry_wait/3` resolve instead of rejecting, giving **3 failures / 82 skipped**. Read the final GREEN log: **85/85 tests pass**. Canonical root ESLint and reverse-patch commands have exit 0. These are checked retained executions, not suite reruns during review.
- Refreshed native artifact: `docs/research/evidence/2026-11-06-g1-deletion-leases/adapter-1793985490922-059af2d5-4041-4b95-b02d-28033c060bee/results.json`, SHA256 `de9c80394a61be1dbe6d5576607bc12fffa335507f834069e6e9439ae633fac9`. It records **3 scenario groups / 281 assertions**, status passed. All **29** native source hashes match current files, including the corrected adapter and unchanged SQL/fixtures/runner.
- Recompiled the corrected adapter in memory with the runner's compiler options. Output equals the retained compiled artifact byte for byte, SHA256 `5fd7ee62f2e4ee3420b3ab0096a341569d43debc72fab0f4bdc9170bde762e77`.
- Independently compared all **20** refreshed native operations' complete non-ledger snapshots and other requests' ledger rows. All **10** entirely read-only operations and all **five** capture replays preserve complete snapshots. Every successful application receipt, excluding its local deadline, equals its actual SQL receipt.
- Checked all **19** transport records for exact argument shape/action-specific nulls, one subscription, one AbortSignal and one `retry(false)`. Each signal begins live and is eventually aborted. All **three** real expiry intervals satisfy `before < expiry <= after`; the replacement worker has a different backend PID. Lost-start and lost-claim behavior remains consistent with the original accepted integration.
- Traversed all **54** full snapshots retained in the refreshed adapter result and checked **202** synthetic byte entries against storage metadata size/SHA256. Cleanup records show the cluster stopped, scratch removed and zero clients/errors.
- Rehashed all **72** pre-correction evidence paths against `pre-final-fix-evidence.json`; every hash matches. Original `whole-review.md` remains SHA256 `060fdc8da81a4dd4228e5410123f9bc59201fd7a5cf94da721d0f6803544ebd7`. HEAD is still `c0669e8058343f91deba8e468b03e4bf817b1ca5`, index empty, and fresh `git diff --check` passes.
- After the parent completed `final-gate-02`, independently checked its compressed archive SHA256 `2c71b1e7a039eb1ecbfd34dcfa4e45378151672c7a3b2ceb206f8ae11959b783`, decompressed SHA256 `7434e4a99e996bc4ed6fba5c3cb2020fe5b6581c1866ba8f4a82283b79f1938c`, exit 0, exact required command and equal before/after source maps. All **907** gate source hashes match current files. Actual retained output reports **Web 161/3,344, shared 4/16, infra 23/23 and 184 generated pages**. This is the completed post-correction gate, not the superseded first gate.
- Verified `next-env-restoration-02.json` against the immediate baseline, restored current file and directly retained `next-env-generated-02.d.ts`. The generated bytes differ only by `import "./.next/types/root-params.d.ts";` plus newline inserted at byte 117. Generated SHA256 is `1862ac4bbbc5192d4bf562161df66ea547ed3e67173100656ab606ae9797db2b`; baseline and restored SHA256 both equal `7b550dda9686c16f36a17bf9051d5dbf31e98555b30d114ac49fc49a1e712651`.

## Acceptance boundary

There is no remaining M1 code correction or scoped review action. The corrected source and completed `final-gate-02` are verified. The parent owns the final preservation package and overall local acceptance documents. Together with the preserved broad review, this scoped PASS closes the sole code finding without a new broad review.

The original whole-review limitations remain binding: local synthetic prerequisites and explicit pg transport substitution; no live PostgREST/network, physical deletion, GC, late-write reconciliation, backup/restore, full migration-chain, cloud/provider or actual-device qualification. **G1 remains 0/9**, and all destructive/remote qualification flags remain false. No source edit, staging, commit, push, remote action or destructive operation was performed by this reviewer. Only this new scoped report was written.
