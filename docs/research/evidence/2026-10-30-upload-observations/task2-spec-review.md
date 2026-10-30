# Task 2 independent specification review

Verdict: GAPS FOUND. One P2 specification violation must be fixed before quality review.

Reviewed on 2026-10-30 against `docs/superpowers/plans/2026-10-30-upgrade-upload-observations.md` global constraints and Task 2, with `CLAUDE.md` applied. Baseline: `d13d55ab0`. The implementation report was treated as claims, not proof. This is a specification review, not the subsequent quality review.

## Finding

### P2 - Convert guard infrastructure failures to the specified HTTP 503

- Source: `packages/web/src/app/api/media/assets/[assetId]/upload-attempts/route.ts:46` and `packages/web/src/app/api/media/assets/[assetId]/upload-attempts/route.ts:59`.
- Requirement: plan line 54 specifies HTTP 503 for database/unknown-receipt failures, while authorization failures retain the existing guard behavior.
- Both guard calls currently forward every failure response unchanged. The real guard returns HTTP 500 for a failed media reload (`packages/web/src/lib/server/media-asset-guard.ts:26`), a failed deletion-ledger query (`packages/web/src/lib/server/media-asset-guard.ts:46`), or an exception (`packages/web/src/lib/server/media-asset-guard.ts:50`). Consequently the new route violates its unavailable-response contract whenever a database failure occurs inside either guard rather than in the initial asset query or writer RPC.
- Independently reproduced using the actual current route, media guard, header helper and RPC adapter, transpiled in memory with mocked auth/project-access/database boundaries. Initial-guard asset-read failure and tombstone-read failure each returned 500 with zero RPCs; final-guard failures of the same types each returned 500 after one confirmed RPC. All four should be sanitized 503 responses under this specification. Raw output: `spec-review-guard-status-confirmed.log`.
- This does not currently permit PUT/complete to continue after an unavailable observation, and the reproduced responses retain `no-store`. It is nevertheless a concrete HTTP-contract gap, especially after a write has already been confirmed and publication becomes unavailable.
- Existing route tests at `packages/web/src/app/api/media/assets/[assetId]/upload-attempts/__tests__/route.test.ts:183` cover only the initial asset-load database failure. They do not exercise infrastructure failures inside either guard.
- Required correction: normalize infrastructure 500 responses from both guard sites to the finite upload-observation-unavailable 503 response, without changing legitimate 401/403/404/409 denials or modifying the shared guard. Add regressions for both begin/finish and both pre/post-RPC guard database failures, including cookie/no-store preservation and no additional RPC or receipt/token publication. No correction was made by this reviewer.

## Independently checked behavior

No other specification gap was identified in the reviewed source:

- All 11 SHA-256 entries in `task2-source-freeze.json` matched their actual source/test bytes before review. No implementation or test source was modified by the reviewer.
- SQL adapter arguments match the actual new migration: `p_attempt_id`, `p_binding_hash`, and `p_outcome`. Exact schema/ID/state writer receipts are required; ambiguous/replayed-terminal begin receipts and conflicting finish receipts are rejected. Each writer makes one bounded RPC through the existing 5-second race and `retry(false)`; late rejection is handled and unknown writes are not automatically replayed.
- The route accepts only the exact begin/finish body variants, uses the exact media feature switch and centralized verified auth, and loads the real media schema through `select('*')`. It permits only original audio, limits begin to pending uploads, and permits finish in pending/uploaded/verifying/ready/quarantined states subject to current authorization and deletion checks.
- Credentials use `randomUUID()` and 32 random bytes encoded as base64url. The only persisted binding is SHA-256 over JSON `[loaded asset ID, verified user ID, report token]`; begin/finish recompute that binding. The raw token is not sent to the database, returned by finish, logged or persisted in browser storage. The new route performs no direct table mutation and returns no signed URL.
- Both successful writer paths re-run the real media guard. The final guard is the final awaited operation before synchronous response publication. This preserves sequential reauthorization only, not atomic revocation or a new signed-URL TTL guarantee.
- Browser observation requests share the existing auth request function and include an overall 20-second deadline covering token acquisition, fetch and response body, including promises that ignore abort. Begin inherits caller cancellation; finish has an independent signal. Strict HTTP 200, exact JSON keys, schema version, UUID/token and receipt identity/state checks gate progression. Late rejections are consumed and no observation request is retried automatically.
- The actual `importProjectAudio` function implements confirmed begin -> pre-PUT cancellation check -> SDK PUT with `upsert: false` -> actual SDK outcome -> independent confirmed finish -> caller cancellation check -> existing complete. Pre-PUT cancellation and thrown SDK AbortError are cancelled; SDK success remains succeeded even if the caller cancels during the non-cancellable SDK operation. Defined duplicate/409 results are conflict, other errors are failed. Known SDK errors are not exposed until finish confirms; unknown reporting takes precedence over them.
- Ready/verifying/uploaded replay paths do not fabricate upload attempts. The original File/key remain caller-owned. The unchanged connected project-hub component retains the selection and explicitly retries the same key rather than silently reporting success or mutating asset state.
- The v3 loader uses the v3 RPC without fallback while retaining prior v2 export-group validation. It enforces exact fields, safe nonnegative integer counts, failures <= evaluated, finite valid calendar timestamps, freshness, microseconds and epoch/window consistency. Invalid, unsettled or short upload windows suppress the upload rate. Cancellation is separate from its denominator.
- Valid-window alerts retain existing thresholds and explicitly say `Client-reported`. Collection coverage is always unavailable; additional window/outcome gaps are conditional. Coverage/status are recomputed after gaps are added while real warning/critical alerts retain priority. Admin response remains 503/not_ready; actual responder/delivery and provider-policy readiness remain unproven.

## Independent verification

Command executed without build or type-check:

```sh
npm test --workspace=packages/web -- --runInBand --runTestsByPath \
  src/lib/server/__tests__/upload-observations.test.ts \
  'src/app/api/media/assets/[assetId]/upload-attempts/__tests__/route.test.ts' \
  src/lib/__tests__/project-hub-client.test.ts \
  src/lib/server/__tests__/operational-snapshot.test.ts \
  src/app/api/admin/cutover-readiness/__tests__/route.test.ts
```

Result: exit 0, 5 suites passed, 240 tests passed. Evidence: `spec-review-focused-jest.log` and `spec-review-focused-jest.exit`. The client suite imports and executes the actual client module, not only a detached observation helper. The route suite executes the real media guard and RPC adapter, mocking external boundaries. These tests passed despite the missing guard-database-status cases described above.

The supplied RED exit records were inspected and are nonzero; their historical runs were not independently replayed. Full verify/build, shared/infra tests and fresh PG evidence remain the parent's responsibility. No build, type-check, staging, commit, push, deployment, migration application or remote call was performed by this reviewer. Writes are limited to this review and uniquely named local review logs.

## Evidence boundary

This review establishes local client-reported diagnostic behavior only. It does not establish real Storage acceptance, original-byte integrity, decode/save success, deployed collection coverage, global upload success, supplier approval, alert delivery or any original G0-G4 gate. The prior Task 1 review is not replaced: the new SQL was inspected read-only here only for its adapter parameter/receipt and aggregate wire contract. Quality review must wait until the finding is corrected and independently re-reviewed.
