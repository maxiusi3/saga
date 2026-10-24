# Task 1 independent review — initial frozen candidate

Spec: **FAIL**. Code quality: **Needs fixes**. One Important integration issue prevents approval of this initial candidate. No Critical or additional Minor issues were found. The reviewed application behavior satisfies the local adapter contract; the required whole-project verification fails because the new fixture is discovered as an empty test suite.

Review basis: the binding specification, Task 1 brief, original implementation report preserved as `task-1-report-before-fix-1.md`, the complete 11-file `task-1-diff.md`, `task-1-snapshot.json`, and original RED/GREEN and controller evidence. Comparison is against saved session-start bytes or `/dev/null`, not Git HEAD. Reviewed source digest: `3546f70018324f5b9d54752180581a4dd55e92bd9f9ded2fe04736f39d498a59`. Fix 1 is excluded from this verdict and requires its own scoped review.

**Important issue I1 — move the fixture outside Jest's test directory.**

Location: `packages/web/src/lib/server/__tests__/invitation-fixture.ts:1`.

This helper contains no tests, but its location under `__tests__` makes it a suite under the project's existing Jest discovery rules. The controller's original `npm run verify` exits 1 with “Your test suite must contain at least one test.” The preserved run reports 80 passing suites, one failing suite, and all 960 assertions passing. The focused command explicitly selects only three test files, so its 194 passing assertions do not detect this integration failure.

Requested remedy: move the helper to a nearby directory outside `__tests__`, update the three importing test files, and verify that normal test discovery excludes the helper while retaining the real suites. Have the controller complete the required full verification on the corrected frozen source, preserving this failed run and assigning new input/log fingerprints to the fix. No production logic or global Jest configuration change is needed for this remedy.

Evidence: `project-checks-20261018T133506.json` records exit 1, unchanged source inputs, and restored next-env bytes. Its input map matches all 11 reviewed source hashes. The retained verification log's SHA-256 matches its recorded digest; its failure is the fixture suite above. This independently confirms the integration finding supplied by the controller.

**Strengths and contract checks.**

- `packages/web/src/lib/server/invitation-acceptance.ts:49` gates before request-body parsing, Auth configuration reads and client construction. Only the exact enabled value enters the flow. Both old acceptance routes delegate to it, and the status entry point delegates to its read-only mode.
- `packages/web/src/lib/server/invitation-acceptance.ts:78` creates one request-scoped SDK client with session persistence, refresh and URL session detection disabled. Explicit `getUser(bearer)` verification and later RPCs share the same credential. Only approved top-level provider identity is accepted; body identity is a strict equality assertion. Cookie/service-key/legacy-RPC fallbacks are absent from these adapters.
- `packages/web/src/lib/invitation-acceptance-protocol.ts:68`, `:94` and `:108` enforce canonical request input, exactly one status/accept row, strict field types and identity/role/project consistency. Accepted pre-reads additionally constrain member, join timestamp and final idempotent outcome. Success fields are copied from the validated final accept row, and status omits the token.
- `packages/web/src/lib/server/invitation-acceptance.ts:111` uses the actual schema and distinct RPC parameter names. A valid status pre-read establishes expectations but never substitutes for accept. The status branch returns before the sole accept dispatch; accepted pre-reads still require that final RPC. Known SQL rejections map safely, while unconfirmed post-dispatch results remain non-2xx and unknown.
- `packages/web/src/lib/server/invitation-acceptance.ts:23` supplies one ten-second deadline plus caller cancellation. The guarded transport covers both headers and body reads; cancellation prevents later transport dispatch, RPC retry is disabled, and finalization clears the timer and listeners. The loopback tests exercise real SDK requests, dropped connections, stage-specific aborts, a deadline spanning delayed Auth and a stalled accept body, and explicit status recovery without another write.
- `packages/web/src/lib/invitation-acceptance-client.ts:16` performs a single HTTP call, validates complete confirmation, rejects malformed 2xx, strips unapproved fields and reports safe failures without automatic retry or recovery. `packages/web/src/lib/api-supabase.ts:359` changes only the acceptance method, plus its required import, to obtain the current session credential; missing/rejected sessions cannot send HTTP. Existing facade wrapping is covered by the client tests.
- `packages/web/src/lib/server/invitation-acceptance.ts:8` centralizes safe JSON errors and no-store/Authorization-vary headers. The transport catches raw fetch failures before the Auth SDK can log them. Reviewed code and response/log assertions provide no secret or provider-error echo path.

**Evidence verification.**

The original business RED is meaningful: both saved old route implementations entered the Cookie authentication boundary and returned 401 while the switch was absent, violating the required 503 and zero-call behavior. Their saved source hashes match the RED ledger. The retained raw RED confirms both failures; it is distinct from later stub, fixture-cleanup and provider-header failures.

The original final focused run contains three passing suites and 194 passing tests with open-handle detection. TypeScript and scoped lint record exit 0. All eleven private ledger logs have matching SHA-256 values and mode 0600. All seven evidence-manifest entries match their files; the evidence manifest digest recomputes to `899694a9381f30a466ef7386a3bac62d2009123c51ce2d50b17199288e2aff59`. The source manifest digest and snapshot agree. Hash-only checks of eight preserved pre-fix files and the three application files unchanged by Fix 1 match all eleven reviewed source entries.

No tests were rerun for this review. Existing coverage resolved the behavior questions, and the preserved full-verification output established I1 directly.

**Focused checks outside the diff.**

Two named interface risks justified narrow reads: candidate SQL compatibility and Jest discovery. The candidate's email normalization/validation, status/accept signatures and returned fields match the adapter contract, including the deliberately different parameter names and persisted accepted-member fields. The web Jest configuration supplies no helper exclusion, consistent with the observed fixture discovery failure. No unrelated application implementation was inspected.

**Cannot verify here / controller follow-ups.**

- This initial verdict does not include Fix 1 or the controller's corrected-source full verify/shared/infra rerun. The original failed verify did not establish completion of that matrix.
- Task 2's five handoff documents, whole-batch scope integrity, dependency and old-experiment preservation, and the final whole-batch independent review remain controller-owned checks. Their absence from this source review is not a separate inferred failure.
- Actual deployed Auth/JWT/PostgREST schema exposure, SQL grants/RLS, migration and production integration are outside this local synthetic-provider evidence. Sending/releasing/provisioning, legacy read routes, direct RPC/table bypasses, historical compatibility and formal recovery UI remain open scope boundaries. The implementation report states these limits and keeps the feature disabled and G0/G1 unachieved.

Report: `.superpowers/sdd/2026-10-18-upgrade-invitation-http-adapter/task-1-review.md`. Initial verdict: **Spec FAIL; quality Needs fixes — I1 only.**
