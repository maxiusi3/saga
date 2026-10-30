# Task 2 independent specification re-review

Verdict: PASS. The initial review's sole P2 is corrected. No remaining or newly introduced specification gap was identified. Task 2 may proceed to its separate quality review; this is not a quality-review or release-gate approval.

Date: 2026-10-30. Specification remains the global constraints and Task 2 in `docs/superpowers/plans/2026-10-30-upgrade-upload-observations.md`, with `CLAUDE.md` applied. The original `task2-spec-review.md` is preserved as the initial review of the original freeze. This re-review evaluates the revised source directly rather than relying on `task2-review-fix-report.md`.

## Revision integrity

- All 11 current source/test files match `task2-source-freeze-revised.json` SHA-256 entries; the revised and original manifests contain the same 11 paths.
- Exactly two entries differ from the original freeze: the upload-attempts route and its test. The other nine files retain their originally reviewed bytes.
- Removing the new synchronous response adapter and restoring the two guard-response call sites reproduces the original route hash exactly. Removing only the appended guard-failure test block reproduces the original test hash exactly. Existing tests were not weakened or removed.
- `packages/web/src/lib/server/media-asset-guard.ts` has no diff against baseline `d13d55ab0`; shared behavior for other media routes is unchanged.

## Initial P2 resolution

The new `guardFailure` adapter at `packages/web/src/app/api/media/assets/[assetId]/upload-attempts/route.ts:32` preserves only 401/403/404/409 authorization/existence/state responses. All other guard failure statuses become the exact finite body `{ "error": "Upload observation is unavailable" }` with HTTP 503.

Both guard exits use that adapter: the pre-RPC guard at `packages/web/src/app/api/media/assets/[assetId]/upload-attempts/route.ts:49` and the final guard at `packages/web/src/app/api/media/assets/[assetId]/upload-attempts/route.ts:62`. Therefore actual media-reload/deletion-query failures, invalid identity, project-access database errors and exceptions converted to 500 by the real media guard now satisfy plan line 54. The adapter is synchronous; no await was added after the final media guard.

The added tests at `packages/web/src/app/api/media/assets/[assetId]/upload-attempts/__tests__/route.test.ts:233` exercise the actual route and shared media guard, not a mocked guard return alone. For both begin and finish, and both pre/post-RPC checks, they verify:

- Media-asset database errors, deletion-ledger database errors, invalid identity, project-access database errors and thrown access exceptions produce the exact sanitized 503 body.
- Legitimate 401/403/404/409 responses retain their status/body; unexpected 400/502/503 responses use the generic 503 body.
- Both refreshed cookies and `Cache-Control: no-store` survive all paths.
- Precheck failure makes zero writer RPCs; postcheck failure makes exactly one, with no replay.
- Exact error bodies contain no attempt receipt, report token or raw database/provider diagnostic.

## Independent rerun

```sh
npm test --workspace=packages/web -- --runInBand --runTestsByPath \
  'src/app/api/media/assets/[assetId]/upload-attempts/__tests__/route.test.ts' \
  src/lib/server/__tests__/upload-observations.test.ts \
  src/lib/server/__tests__/media-asset-guard.test.ts \
  src/lib/__tests__/project-hub-client.test.ts \
  src/lib/server/__tests__/operational-snapshot.test.ts \
  src/app/api/admin/cutover-readiness/__tests__/route.test.ts
```

Result: exit 0; 6 suites passed; 312 tests passed. This independently selected suite set includes the real client sequencing/deadline tests, writers, actual guard, v3 parsing/health wiring and admin readiness. It differs from the implementer's six-suite selection, so its test total is reported separately rather than borrowed from the implementation report.

Evidence: `spec-rereview-focused-jest.log` and `spec-rereview-focused-jest.exit`.

## Remaining scope and boundaries

The unchanged nine files retain the original review's positive specification findings, and their focused regression tests passed again. The revised two-file delta does not change actual SDK outcome/cancellation handling, unknown-write boundaries, 20-second browser or 5-second RPC deadlines, strict receipts, credential binding/minimization, asset state rules, no-store/cookies, v3 counter/time validation, rate suppression, or honest unavailable coverage/status. No new specification issue was found in that delta.

No production or test source was edited during this re-review. No build, type-check, staging, commit, push or remote call was performed. Full verify/build and milestone assessment remain the parent's responsibility; separate quality review is still required. Local mocked-boundary results do not establish real Storage acceptance, deployed browser coverage, global upload success, provider-policy approval, alert delivery or original G0-G4 completion.
