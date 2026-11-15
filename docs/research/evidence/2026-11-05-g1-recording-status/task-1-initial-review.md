# Task 1 initial review

Spec compliance: **Needs fixes**. The scoped SQL authority and its native database coverage match the binding specification; two required native HTTP evidence properties are not established by the original package.

Task quality: **Needs fixes**. No production SQL defect was found. Correct and independently review the evidence capture and timeout changes before accepting Task 1.

## Reviewed scope

- Reviewed `.superpowers/sdd/2026-11-05-upgrade-g1-recording-status/task-1-review.patch` against the supplied takeover baseline at HEAD `c0669e8058343f91deba8e468b03e4bf817b1ca5`, not against clean HEAD bytes. This preserves the inherited dirty deployment test.
- Binding inputs: `task-1-brief.md`, `task-1-report.md`, `task-1-review-hashes.json`, and `docs/superpowers/specs/2026-11-05-g1-recording-status-design.md`.
- Read the patch once. Tool output truncated `database.mjs` after its authorization tests and the beginning of `fixture.mjs`; only those omitted hunks were recovered. No changed source was independently reread, no git command or test suite was run, and no implementation file was changed.

## Strengths and verified checks

- `supabase/migrations/20261105000001_recording_session_snapshot.sql:5`: exact four-argument function, STABLE SECURITY DEFINER, fixed trusted search path and UTC; explicit READ COMMITTED validation precedes the SELECT-only snapshot query.
- `supabase/migrations/20261105000001_recording_session_snapshot.sql:27`: current user/project/session/hash, active storyteller, optional story owner and optional deletion blockers are evaluated in the statement snapshot. Deletion requests cover project/session/asset/story; errors remain non-disclosing.
- `supabase/migrations/20261105000001_recording_session_snapshot.sql:52`: jobs/attempts/candidates/chunks use the specified 2/4/4/2001 sentinel limits; foreign relationships remain visible. The envelope has exactly 13 keys and whole-row JSON. Matching session count is capped at two.
- `supabase/migrations/20261105000001_recording_session_snapshot.sql:90`: execution is revoked from PUBLIC/anon/authenticated and granted to service_role without changing table ACLs.
- `scripts/__tests__/deployment-config.test.js:137`: only the snapshot migration is added after its prerequisites in the supplied scoped patch.
- `experiments/pg17-recording-status/database.mjs:94`: the native concurrency test synchronizes with `pg_stat_activity`, sees the old tuple twice in one STABLE statement across a real atomic commit, then sees the new tuple on the next explicit READ COMMITTED statement. Later explicit reads reject committed role revocation and a tombstone.
- `experiments/pg17-recording-status/fixture.mjs:36`: complete tuple comparisons cover authorization, application and synthetic Storage tables. `application.mjs:66` additionally compares actual local/source/candidate synthetic file hashes and audits one status RPC without replay/fallback.

## Issues

### Critical

- None found in the supplied scope.

### Important

1. **Compiled runtime snapshots are absent.** `experiments/pg17-recording-status/verify.mjs:69` tests the cached module path against the non-canonical temporary root. On this macOS host, `require.cache` uses `/private/tmp/...` while the scratch root is `/tmp/...`, so the runtime-copy branch is skipped. The original HTTP run has 110 source snapshots and **zero** `compiled/` snapshots, despite its 13-module production graph. Its behavior results do not establish the required preserved runtime coverage. Canonicalize the temporary root, require the expected loaded compiled snapshots, retain the old run and produce fresh evidence. This issue was independently identified by the implementer/controller before the reviewer reached its final evidence verdict.

2. **The native timeout scenario exercises caller abort.** `experiments/pg17-recording-status/application.mjs:64` installs `checkpoint: () => controller.abort()` for every case; `experiments/pg17-recording-status/http.mjs:51` calls that checkpoint for both `timeout` and `abort`. Consequently the `timeoutMs:100` case terminates through the caller signal. The original evidence records **18.224451 ms**, not the intended timer path (`native-http-2026-11-05T09-14-05.222Z-76518153-4ef1-4d2a-ab8b-133a8f0c2063/results.json:42598`). Call the checkpoint only for caller-abort mode, assert the caller signal remains un-aborted for timeout, and require elapsed time consistent with its timer budget plus a bounded upper limit. Preserve old evidence and rerun the corrected native HTTP cases.

### Minor

- None found in the supplied scope.

## Original evidence independently inspected

- `red-without-migration-2026-11-05T08-55-35.906Z-e218e110-0a7c-44fc-acb0-178e6160168f/results.json:385`: actual service-role SQLSTATE **42883**, null RPC probe and expected failed assertion; the compressed PG log confirms missing function invocation.
- `native-sql-2026-11-05T09-11-06.782Z-8c2b800f-27a6-4350-8459-af3caa80fd9c/results.json:5`: **5 scenarios / 191 assertions** passed. All **41** stored full tuple before/after pairs are equal. The same-statement pair is equal, later state is succeeded, and observed timestamps preserve database precision. Only expected unavailable/permission-denied PG diagnostics occur.
- `native-http-2026-11-05T09-14-05.222Z-76518153-4ef1-4d2a-ab8b-133a8f0c2063/results.json:5`: **4 scenarios / 580 assertions** passed behavior checks, with the two evidence limitations above. All **27** stored tuple before/after pairs are equal. The HTTP ledger has exactly one explicit publication mutation; all snapshot requests are READ ONLY. Verified compact receipts retain `canClearLocalDrafts:false`.
- All compressed source snapshot hashes and their decompressed hashes in those two original GREEN runs match their manifests; their compressed PG log hashes also match. Their production source hashes match the current files. Only the acknowledged in-progress `verify.mjs` edit differs from the original run source map.
- Both original GREEN results report zero remaining clients/errors, removed temporary/socket directories and stopped server PIDs. HTTP additionally reports zero sockets/pending handlers and all native transports settled. All G1 and push flags remain false.
- Earlier SQL failures and the later runtime-capture assertion failure remain present. No original evidence was overwritten or regenerated by this review.

## Exact initial source hashes

Seven unchanged task files matched the supplied initial hash manifest byte for byte. The original `verify.mjs` hash below matches the reviewed patch/evidence; its live hash had already changed to `f6221b7d1b2781c5aba5ce2a7855c2797f3f9084d08727e8be2e02d6455b0652` during the authorized capture repair. A final delta/hash review is required.

| File | Reviewed initial SHA-256 |
| --- | --- |
| `experiments/pg17-recording-status/README.md` | `0dff9c55c6361e8eb8f90b8ea210bbd9fa10447a4949808d3457ebd316bd69ea` |
| `experiments/pg17-recording-status/application.mjs` | `55d01eab6df2ec157ca46edbb3ec11ef208f0fe8263d3d94580990f2e7876be5` |
| `experiments/pg17-recording-status/database.mjs` | `43ca60f84e5db9421dd8db3a2e0fdf63267b0259a625dca3d201b1bb2dd11bad` |
| `experiments/pg17-recording-status/fixture.mjs` | `08d04babdb7ffbdcfef4b365a8599e82d25ca40d6807a6a3bcea71e16adee6fb` |
| `experiments/pg17-recording-status/http.mjs` | `795755ce507c59bbdf4c02d99eb1cbe95681bb43d62c8b9ea3ddd4ef7285116b` |
| `experiments/pg17-recording-status/verify.mjs` | `170e6f080d1cac56df1defe3e5e40041adc8fa3ef536c7ffe40bd4f81e384c06` |
| `scripts/__tests__/deployment-config.test.js` | `035ea556299f752fef904f0bad88fcd6b0aab90550be542274883a227f192098` |
| `supabase/migrations/20261105000001_recording_session_snapshot.sql` | `7e303f64a6d7abd2893a1d4f537901d14849bbc35594073a4cb57817ea1f91af` |

## Named outside-diff checks and cross-task needs

- **Risk: importing old fixture modules could execute old evidence writers.** Checked imports/exports and writer references in the worker/candidate/finalization fixture modules and `pg17-routines/runtime.mjs`. Imports do not enter any previous verify/evidence-writer entrypoint; the new harness explicitly owns its evidence destination.
- **Risk: two compilation helpers could leave stale CommonJS dependencies.** Checked `experiments/pg17-recording-worker/fixture.mjs:10`. It uses the same ES2022/CommonJS transpile options and alias rewrite as new `application.mjs:12`; overlapping modules are compiled from the same frozen source, so the common cache does not introduce a different compiler contract.
- **Risk: a STABLE PL/pgSQL function might refresh snapshots between its SELECTs.** Checked the [official PostgreSQL volatility documentation](https://www.postgresql.org/docs/current/xfunc-volatility.html), which explicitly uses the calling query's fixed snapshot. The actual PG17 concurrency record independently verifies the required behavior.
- **Cannot verify from this task diff:** Task 2's complete strict validator and HTTP-route contract, focused route/Jest checks, historical compiler graphs and the final project/shared/infra gate. These remain controller/Task 2 review responsibilities. The native runtime and timer fixes need a combined delta plus fresh exact-source results before this task is closed.
- The initial whole-project gate failure attributed to the Task 2 fixture in `__tests__` remains a controller-owned cross-task result; no production change or repeated suite execution is inferred from it here. Cloud/managed Storage/device qualification remains outside this slice.
