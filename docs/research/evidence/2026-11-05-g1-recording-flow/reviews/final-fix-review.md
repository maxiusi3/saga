# G1 final confirmation fix — scoped re-review

## Scope and verdict

**Spec compliance: Approved.** **Fix quality: Approved.**

**I1 from `final-review.md`: ADDRESSED.** No new blocking defect was found in the five-file correction. This verdict closes the previously reported SQL-before-DML validation mismatch. It does not repeat the full change review or qualify G1, cloud/device behavior, merge, push or deployment.

Reviewed `final-fix-brief.md`, `final-fix-report.md`, the complete 346-line `final-fix.patch`, `final-fix-hashes.json`, `final-fix-validation.json`, the saved baseline manifest/bytes and the new native RED/GREEN evidence. The patch baseline is the immediate `final-fix-before/` snapshot, not HEAD. No suite or native harness was rerun.

## Finding resolution

| I1 requirement | Status | Review evidence |
| --- | --- | --- |
| Historical worker/provider/request/usage/cost fields | **ADDRESSED** | `supabase/migrations/20261106000001_recording_story_save.sql:299`–`:306` checks every ordered attempt, including the latest, for the worker format and all five null provider/usage/cost fields. Moving the prior latest-only null checks into this loop does not weaken latest-attempt validation. Native cases cover all historical positions in two-/three-attempt chains, including non-null numeric zero; all 24 earlier committed-write failures now reject before DML. |
| Exact numbering and row population | **ADDRESSED** | The retained count equality at SQL `:270`, valid latest-row checks, and expected sequence checks at `:300`/`:318` require `1..attempt_count`. The reported `2,3` and `2,3,4` cases are rejected, along with missing and extra rows. No schema constraints were disabled. |
| Chronological history | **ADDRESSED** | SQL `:298` initializes the predecessor time from job creation; `:306` and `:317` maintain order across historical finishes; `:309`–`:315` preserve seal/dispatch bounds, undispatched retry history and the final dispatch boundary. Comparisons retain PostgreSQL microseconds. The before-job and reversed-predecessor cases that previously committed writes now return SQL conflict, and the remaining seven history regressions also pass. |
| Finite and application-compatible timestamp domain | **ADDRESSED** | SQL `:235`–`:242` checks all required session/asset/job/latest-attempt/candidate timestamps before writes; `:289`–`:291` checks each persisted chunk; `:304`–`:306` checks all historical finishes. Null, non-finite, BC and five-digit AD timestamps are rejected where required. The AD 0001 inclusive / AD 10000 exclusive UTC domain is compatible with the existing application parser and PostgreSQL serialization. The positive early-AD microsecond control and Asia/Taipei caller confirm/replay pass. |
| Actual-service rejection before any story/intent mutation | **ADDRESSED** | All new checks precede story and intent writes at SQL `:329`/`:332`. `experiments/pg17-recording-flow/confirmation-regressions.mjs:120` validates each unmodified published control through the real service before mutation; `:124`–`:145` captures raw corrupted state and full PostgreSQL JSON rows, calls the real confirmation service, then requires no receipt, SQL 409 and exact full-row equality. |
| Valid retries and existing protections | **ADDRESSED** | `experiments/pg17-recording-flow/fixture.mjs:70`–`:84` constructs historical attempts through real claim, PostgreSQL-clock expiry, recovery, final dispatch, candidate preparation and publication routines. Valid two-/three-attempt confirmation and identical receipt replay remain successful. The existing canonical-identity, publication-corruption, authorization, deletion and concurrent lock-wait scenarios remain and pass in the GREEN result. |

## Strengths

- The fix removes the weaker historical-attempt predicate and uses one bounded ordered validation loop. It preserves the existing authorization, lock order, terminal-chain identity checks, independent application validator and cleanup receipt contract.
- Regression outcomes are collected before aggregate assertions. The RED run therefore preserves all 35 partial-commit failures, rather than stopping after the first case. The only measured implementation difference between the RED and GREEN inputs is the saved versus amended SQL.
- Full rows are read as PostgreSQL JSON, retaining columns and microseconds. The evidence demonstrates unchanged story/intent state, not merely an HTTP/service error or absence of cleanup.
- Positive controls prevent over-restrictive repair: genuine retry histories still confirm/replay, and valid early AD timestamps continue to work despite a non-UTC caller session. Synthetic auth/project prerequisites and the local RPC adapter are explicitly documented; this native test is not represented as an audio/HTTP/cloud qualification.

## Independent evidence checks

- Recomputed all five amended file SHA-256 values and all nine artifact hashes listed in `final-fix-validation.json`: every value matches.
- Recomputed all four preserved original-file hashes and compared them to both `final-fix-before/manifest.json` and the original whole-change freeze: every value matches. The regression module is correctly listed as a new file.
- Applied every supplied unified-diff hunk to the preserved original text **in memory only**. All five reconstructed outputs match the frozen current hashes; no checkout or Git mutation was used to verify the patch.
- Parsed both complete native result JSON files and independently derived the case totals and row-equality outcomes from the raw `before`, `after`, `receipt` and `apiStatus` fields. The computed values equal the reported summaries and every recorded per-case predicate. Both runs contain the same ordered 88 case names.
- **RED:** `native-before-final-fix-1793929111642-b22a4d0e-9647-4d33-9432-9654848bc4fd/results.json` records 826 assertions and the expected aggregate assertion failure after all cases. Raw data confirms 35 changed story/intent rows followed by application 503, and 53 unchanged SQL-409 rejections. All 88 have no receipt. The 35 failures comprise 24 historical-field, two numbering, two ordering and seven timestamp-domain cases.
- **GREEN:** `native-1793929246225-f153d6c1-189c-460b-b827-6fb505ec038d/results.json` records 1,091 assertions with every scenario passed. All **88/88** corruptions return **409**, have **no receipt**, retain `processing`/null audio/null confirmation, and preserve both complete rows exactly. No raw observation contradicts the report.
- Independently compared both native source maps to current/preserved files. All hashes match; all common RED/GREEN hashes are equal. The only source-path substitution is the saved pre-fix SQL versus the amended SQL. Each recorded two-/three-attempt case contains the expected number of actual lease-transition receipts. Both positive multi-attempt controls preserve complete rows on replay.
- Both runs report actual unprivileged caller roles and complete cluster/client/temp-directory cleanup with no errors. The RED failure is the intended final predicate, not setup, compilation, migration or cleanup failure.
- Read existing focused-check logs: **2 suites / 207 tests passed**, canonical root ESLint output empty. The validation record reports successful syntax/diff checks. These are implementer runs inspected here, not reviewer reruns.

## New regressions and out-of-scope items

- **Critical:** none found in this correction.
- **Important:** none remaining from I1; none introduced by the reviewed five files.
- **Minor:** none requiring a further fix.
- **Out-of-scope changes:** none in the supplied patch. Four existing SQL/experiment files and one new regression module are the complete correction.
- The new full repository gate, three actual integration runs, versioned source archive and final integrity receipt are controller responsibilities. This scoped approval does **not** reuse the old SQL archive or earlier integration runs as evidence for the amended SQL. Their completion is a separate delivery step.

## Assessment

**I1: ADDRESSED.**

**Scoped spec verdict: Approved.**

**Scoped quality verdict: Approved.**

The correction rejects all identified historical-attempt and timestamp mismatches before story/intent DML while retaining successful confirmation/replay for valid chains. The native RED/GREEN record directly establishes the reported failure and its correction, and no further suite run was necessary to resolve this review.

Only this review file was written. No product/test/fixture edit, subagent, Git/index operation, suite/native execution, remote call, stage, commit, push or deployment was performed by this reviewer.
