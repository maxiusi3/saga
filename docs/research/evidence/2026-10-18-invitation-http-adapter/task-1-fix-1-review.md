# Task 1 Fix 1 independent re-review

**I1: ADDRESSED. Spec: PASS for Task 1's local implementation and validation scope. Code quality: Approved.** No new Critical, Important or Minor issues were found in the scoped fix. The initial failed verdict and evidence remain preserved in `task-1-review.md`.

This review covers only `task-1-fix-1-diff.md`, its snapshot, the appended Fix 1 implementation report and the corresponding focused, project and integrity evidence. It does not repeat the initial application review or test execution. Fixed source digest: `690149536961419859643d1e5348866856edec38311e6a4844688d997481fa9e`.

The helper now resides at `packages/web/src/lib/server/test-support/invitation-fixture.ts:1`, outside Jest's test directory. Its contents have the same SHA-256 as the original helper. The only other changes are imports at `packages/web/src/lib/__tests__/invitation-acceptance-client.test.ts:5`, `packages/web/src/lib/__tests__/invitation-acceptance-protocol.test.ts:9` and `packages/web/src/lib/server/__tests__/invitation-acceptance.test.ts:41`. Reversing those three import strings reproduces the original test hashes. All seven production source hashes are unchanged, the old fixture path is absent, and every current source hash matches the fixed snapshot/manifest. The fix therefore removes the discovery failure while preserving the assertions and tested behavior.

The retained discovery GREEN log contains 80 suites, excludes the fixture and includes all three intended invitation suites. Its digest matches the focused evidence. The corrected targeted run passes all 194 tests with open-handle detection; TypeScript and scoped lint also exit 0. All four focused raw logs have the recorded hashes, mode 0600 and matching source-input digest. The Fix 1 evidence manifest and each of its three entries also verify.

The controller's canonical `project-checks.json` now records a completed passing matrix on the corrected input:

- `npm run verify`: 80 web suites, 960 tests and 176 generated pages.
- Shared tests: four suites and 16 tests.
- Infrastructure tests: seven tests.

All three commands exit 0. Their public and private raw log hashes match the recorded values, and the log summaries confirm the reported counts. The project input map includes all eleven fixed Task 1 source hashes and excludes the removed fixture path. Its referenced execution manifest hash also matches. Existing build configuration/service-key warnings and the unchanged 42-item dependency audit remain explicitly documented; this approval does not reinterpret them as resolved.

`integrity-pre-docs.json` reports 715 matching application inputs, eleven matching Task 1 sources, ten matched task evidence artifacts, 18 matching private-log references/modes and 838 preserved prior experiment inputs/evidence, with no reported unexpected source or evidence changes. This is preliminary controller integrity evidence; final document and whole-batch review remain separate work.

The initial review report is preserved unchanged with SHA-256 `f82a19f09b1c011f2373b82df6c0fd9e596471fccf14ec2c0843eb14f0d6f64e`. No tests, remote actions, configuration changes or implementation edits were performed during this re-review. The initial review's production integration, legacy bypass, compatibility, rollout and milestone limits continue to apply.

Report: `.superpowers/sdd/2026-10-18-upgrade-invitation-http-adapter/task-1-fix-1-review.md`. Verdict: **I1 ADDRESSED; Task 1 Spec PASS; quality Approved.**
