# Task 2 review correction: guard infrastructure failure status

Status: frozen again for independent specification re-review and subsequent quality review.

The interruption affected only the execution/authentication channel. This resume only inspected the existing code and validation logs and produced this report and a new source freeze. No source edits or repeated verification commands were performed during this finalization.

## Verified correction

The upload-attempts route now applies one synchronous guard-failure adapter to both pre-RPC and post-RPC requireCurrentMediaAsset failures. It preserves only 401/403/404/409 authorization, existence and eligibility responses. Infrastructure/unknown failures are converted to a sanitized HTTP 503 body: {"error":"Upload observation is unavailable"}. Both paths retain refreshed cookies and Cache-Control: no-store. The shared guard and its behavior for other routes are unchanged.

Exactly two of the original 11 frozen source/test paths changed:

- `packages/web/src/app/api/media/assets/[assetId]/upload-attempts/route.ts`
- `packages/web/src/app/api/media/assets/[assetId]/upload-attempts/__tests__/route.test.ts`

The other nine original source hashes match task2-source-freeze.json. The new task2-source-freeze-revised.json contains the current SHA-256 hashes for the same original 11 paths. The original freeze, implementation report and all previous logs are preserved.

## Validation already executed after the correction

- task2-review-fix-red.log / .exit: exit 1; 32 failed, 71 passed, 103 total. Failures established incorrect status/sanitization for infrastructure and unexpected guard responses.
- task2-review-fix-green.log / .exit: exit 0; 6 suites, 316 tests passed. Includes the 103-test upload-attempts route suite plus upload writers, shared media guard, original media access/complete, and real project-hub client regressions.
- task2-review-fix-type-check.log / .exit: exit 0; npm run type-check --workspace=packages/web.
- task2-review-fix-lint.log / .exit: exit 0; npm run lint --workspace=packages/web.
- task2-review-fix-diff-check.log / .exit: exit 0; git diff --check.

The new tests exercise both begin/finish and both pre/post-RPC guards: asset/deletion database errors, invalid identity, project-access database errors and thrown access failures, plus the preserved status allowlist. They assert sanitized response, exact refreshed cookies, no-store, zero RPC before a failed precheck and exactly one RPC for a failed postcheck.

## Remaining scope

No full verify or build was executed for this correction by this implementer. Parent owns the subsequent full verify and independent reviews. No stage, commit, push, remote migration or deployment occurred. Task1 source/evidence and all unrelated files were not modified. No evidence of real deployed browser collection coverage or external supplier/delivery readiness is claimed.
