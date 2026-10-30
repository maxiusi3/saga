# Upload Observation Batch Closeout Review

Verdict: **PASS** for the staged local upload-observation slice and its evidence reconciliation. No unresolved correctness, security, regression or evidence-integrity finding was identified. This is not an original milestone, P0-wide completion, deployment or push approval.

Reviewed on 2026-10-30, Asia/Taipei. Base: `d13d55ab0a2ab8bb493da404a55f475613c7a372`. Branch: `codex/october-upgrade-p0`. The review began with 153 staged paths, no unstaged changes and no non-ignored untracked files. The parent deliberately left final closeout/checklist/commit statuses pending; those honest pending fields are not missing implementation.

## Scope And Method

- Read `CLAUDE.md`, the upload implementation plan, the current four documentation surfaces, the original quality gates in integrated-plan section 7.1, and the staged implementation/evidence diff. This was a targeted Task 3 and cross-batch consistency review, not a new historical repository audit.
- Independently read the current SQL, HTTP writer, browser sequence, v3 parser/health wiring and retained review reports. Checked adjacent unchanged media/auth/request/component boundaries where needed to evaluate the documentation claims.
- Used read-only Git comparison, Python SHA-256/gzip/JSON checks, exact-byte reconstruction, local link resolution, retained-log inspection and post-exit PID/path checks. Did not rerun build, Jest, PostgreSQL, audit or external services; runtime results below are verified retained evidence, not newly executed suites by this reviewer.
- This reviewer writes only this report. Source, documentation, statuses, staging and historical evidence remain unchanged. No commit, push, remote refresh, migration, deployment or real-family-data external call was performed.

## Snapshot Integrity

| Check | Result |
| --- | --- |
| Staged/worktree correspondence | All 153 staged files exactly match their worktree bytes. No unstaged or non-ignored untracked input appeared before this report. |
| Final implementation manifest | All 15 entries in `source-hashes.json` match actual files. The set covers the four Task 1 files and 11 Task 2 files. |
| Protected baseline inputs | All 1471 `protected-inputs.json` entries match current files and the actual `HEAD` bytes. Older experiments, evidence, migrations and dependency inputs remain unchanged. |
| Evidence manifest | All 133 existing `verification.json.evidenceHashes` entries match actual files, including the evidence README, archive mapping and review reports. |
| Documentation manifest | All four `documentationHashes` entries match: handoff, docs README, research report and implementation plan. The evidence README is separately covered by `evidenceHashes`. |
| Generated declaration restoration | `packages/web/next-env.d.ts` matches its protected baseline exactly; SHA-256 is `7b550dda9686c16f36a17bf9051d5dbf31e98555b30d114ac49fc49a1e712651`. |
| Whitespace checks | Both `git diff --check` and `git diff --cached --check` pass on the reviewed snapshot. |

Pre-seal fingerprints, recorded to identify this review checkpoint rather than constrain the parent's subsequent status-only seal:

| Input | SHA-256 |
| --- | --- |
| `git diff --cached --binary` | `cd5980667053d9a727dcd2d3a16138deb3a6d63210d4cf4aae138bd8252eac4e` |
| `verification.json` | `7486592120ca9e5e37ef19a2d02549d3ba8558204d232af2693d3e7a5ea7f7fc` |
| `source-hashes.json` | `125d046f18e43fb9770e3bde1f192d5a28d3ab95c3abd4a6089cf45fa354761e` |
| `protected-inputs.json` | `0575178f36c8f22c99e9a6944a5fa74acefb55019c3c274410b85b8a5a1c7251` |

## Original And Revised Evidence

The Task 2 original and revised freezes contain the same 11 paths. Exactly two hashes differ: the new upload-attempts route and its test. All 11 revised hashes match current bytes. Removing only the synchronous guard-failure adapter and restoring its two call sites reproduces the original route SHA-256. The original route test is an exact 12,298-byte prefix of the revised test; the appended regression block does not remove or weaken prior tests. The other nine source/test files retain their original frozen bytes.

Task 1's later formatting correction is also exact: decompressing `raw/verify-before-eof-fix.mjs.gz` produces the final runner plus precisely one trailing LF byte. Original SHA-256 is `bdd840144b68686643f63afc8b6fc5c3caa4bd99285476939085cd2dba44e95d`; final SHA-256 is `dcbadf2e28dd3a73f3fd18a1e482f705f2932e37a4e03974cdcc65f66c1c2dcf`. SQL remains `68e8d4ec610185db89a2f2fcec0d29fe9e2b86cf5f34988762f8982b565b4c78`. Executable text and SQL were not changed by this correction. The original freeze, Task 1 review and earlier PG reports remain historical; they are not silently relabeled with the new runner hash.

Both reports selected by `final-pg-verification.json` contain the final runner hash and all seven actual source hashes. Each records exit 0, 14 passed scenarios and 631 assertions. The scenario totals sum to 619; the remaining 12 are accounted for outside scenarios by seven harness startup checks, four exact P1-table DDL checks and the initial service-role identity check. This is consistent with the runner's assertion accounting, not a count discrepancy.

Both final runs record clean shutdown, zero remaining clients and no cleanup errors. Independent current checks confirm that each recorded server PID, private socket and scratch directory is absent. The contaminated run records the same 13 scrubbed keys in both index and raw report; the normal run records none. The fixture remains synthetic prerequisites plus four exact P1 tables, not a full migration-chain rehearsal.

## Raw Log Preservation

- `log-hashes.json` contains **37** logs. All 37 gzip files, decompressed original byte hashes and corresponding `.txt` hashes match. Available local ignored `.log` originals also match the decompressed bytes. The archive file set and mapping are identical, and every gzip/display counterpart is staged.
- All **11** run entries across `sql-verification.json`, `resume-pg-verification.json` and `final-pg-verification.json` resolve their original log names through the archive map. Each declared log hash matches `originalSha256`; every referenced structured report hash also matches. Checkout portability does not depend on ignored `.log` files.
- The 38th gzip file is the explicitly documented pre-EOF-correction runner, not an unindexed log. It is covered by the evidence manifest and format-correction record.
- Raw output remains byte-faithful. Reading copies normalize line endings, remove trailing whitespace and outer blank lines, and give nonempty text one terminal newline. The parent has acknowledged a pending wording-only clarification in the research report and evidence README to state this exact normalization. It does not change raw evidence or any result.

## Retained Verification Results

| Evidence | Verified result and scope |
| --- | --- |
| Task 1 review | Independent specification PASS then quality PASS for the historical SQL/runner/infra slice; no open finding. |
| Initial Task 2 targeted run | 20 suites / 599 tests, exit 0; pre-correction only. |
| Initial full command chain | Web 135 suites / 2017 tests, shared 4 / 16, infra 7, 184 pages, exit 0; pre-correction only. |
| Guard-status regression RED | 32 failed / 71 passed / 103 total, exit 1; retained as the genuine pre-fix failure. |
| Corrected targeted run | 6 suites / 316 tests, exit 0; type-check and lint exit 0. |
| Independent specification re-review | PASS; separate six-suite selection / 312 tests, exit 0. |
| Independent quality review | Approved; 13 suites / 510 tests, exit 0; 14 SDK/late-settlement synthetic probes pass. |
| Corrected full command chain | `npm run verify && npm test --workspace=packages/shared -- --runInBand && npm run test:infra`; exit 0, Web 135 / 2065, shared 4 / 16, infra 7, 184 pages. |
| Final post-format PostgreSQL | Normal and contaminated runs each 14 / 631, exit 0; final sources and independent cleanup checks pass. |

The final full raw output SHA-256 is `26de458e001454a06e9eaedf341825e7ef8e4d9e576179987f918426f9233830`; the distinct original full output is `e461dd3a6e27fbc585cb25ecc7c13c74a700ed385c3591b427367425b455ec59`. Both exit files contain 0. The logs retain Next's legacy `eslint` / `images.domains` warnings and missing `SUPABASE_SERVICE_ROLE_KEY` diagnostics. Audit was not rerun and no claim that it passed was introduced.

## Documentation And Code Boundaries

- All **23** newly introduced relative Markdown links in the four current documentation surfaces resolve locally. The prior handoff body is byte-identical after its current-state heading is relabeled as the previous batch. The docs README's historical section is byte-identical to baseline.
- The actual scope remains `importProjectAudio` pending-upload non-overwrite PUT reporting. Confirmed begin precedes PUT; independently bounded finish precedes the unchanged complete flow. Unknown receipts do not trigger automatic replay or completion. Skipped PUTs do not fabricate attempts. The unchanged component retains the selected File and idempotency key on failure.
- The HTTP route's synchronous adapter maps unexpected/infrastructure guard failures to sanitized 503 while retaining legitimate 401/403/404/409 responses, cookies and no-store. Shared auth/media guard/header, registration, complete and project-hub component files remain byte-identical to baseline. Existing operational RPC execution code is unchanged after its type declaration; only the allowed function-name union changes.
- Credential binding, client outcome reporting and v3 aggregate counters agree across SQL, adapter, route and browser. Actual SDK success is not relabeled cancelled solely because the caller aborts. Conflict remains distinct from successful new-object creation. Neither finish nor client claims change media validation or authorize access.
- The v3 health path always retains missing collection coverage, suppresses upload rates for invalid/unsettled/incomplete observations, and recomputes partial/unavailable status without hiding real critical alerts. Admin still returns `503 not_ready`; provider-policy confirmations remain false. No deployed coverage, real Storage acceptance, decode/hash/save success, atomic revocation or changed signed-URL TTL is claimed.

## Milestone Decision And Remaining Limits

`milestone-basis.md` and `milestone-check.json` use the actual original section 7.1 gates rather than promoting this local slice to a new milestone. Unverified selected-provider account/region/data conditions alone prevent a new complete G0 conclusion. G1 device/fault/isolation requirements, G2 real-model/source evidence, G3 delivery/operations/household iteration and G4 mature longitudinal evidence remain separate requirements, not additions to G0.

The local evidence therefore supports `originalMilestoneNewlyProven=false`, `p0CompletionProvenByThisBatch=false` and `pushConditionSatisfied=false`. The planned local checkpoint after sealing is distinct from a conditional GitHub push. No main merge, remote migration, deployment or external use of real family material is authorized by this review; real Plan B backup/restore remains owner-directed.

Residual limits are explicit: local synthetic Auth/Supabase/Storage transport tests and synthetic PG fixtures do not establish live PostgREST/Storage/device/family behavior, complete remote migrations, production ledger growth/latency/retention, actual alert delivery or provider qualification. Client reports remain untrusted diagnostic observations; started can precede PUT and failed/unknown reports cannot prove object absence. Sequential media rechecks are not atomic revocation barriers.

The parent may now perform the final status/checklist seal, the acknowledged normalization wording clarification, refreshed documentation/evidence hashes, staging checks and local checkpoint. Those administrative steps were intentionally outside this review. This report has no circular self-hash; the parent adds its hash to the final evidence manifest.
