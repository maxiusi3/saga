# RPC access guards — Task 3 and final batch review

2026-10-18 (Asia/Taipei). Fresh independent review of Task 3 and the complete current RPC access-guards batch. The reviewer performed this review directly, without subagents.

## Verdicts

| Review | Verdict |
|---|---|
| Task 3 specification compliance | **PASS** |
| Task 3 quality | **PASS** |
| Final whole-batch review | **PASS for the defined local batch** |
| Open actionable findings | **Critical 0 / Important 0 / Minor 0** |
| Ready for local batch completion | **Yes**, after the controller records this actual verdict and refreshes final integrity/status references |
| Original G0/G1 or release readiness | **No — neither milestone is achieved** |

The pending final-review wording and unchecked last item in `docs/superpowers/plans/2026-10-18-upgrade-rpc-access-guards.md:70` were correct at the reviewed snapshot. Task 3 did not manufacture an independent batch PASS from author checks or earlier task reviews. This report supplies that separate verdict; it does not itself edit their status.

## Scope and review basis

The binding requirements were the Task 3 brief, controller checks and ruling, `docs/superpowers/specs/2026-10-18-rpc-access-guards.md`, and the batch implementation plan. The review used the supplied session-start diff, not a HEAD diff containing unrelated earlier upgrade work. Current branch remains `codex/october-upgrade-p0`; HEAD remains `1caa21a72a23d6f5166ed127847ca931374b890a`.

Reviewed package SHA-256:

- `.superpowers/sdd/2026-10-18-upgrade-rpc-access-guards/batch-final-diff.md`: `58935ca5f90d1abdc0026d6764b0a91d1b4a14a86ae92a190104a217f7e22d25`.
- `.superpowers/sdd/2026-10-18-upgrade-rpc-access-guards/batch-final-snapshot.json`: `b50c78cc14216d85350c98632b52e6364373f9c073e776043e053f4e4e3032ff`.
- Binding spec: `55b3af526d34d49244365258cbf01ae09ca918646d0ad593f8dde16c99113bbe`.
- Final candidate: `f37f6ce363fd63a9891fbe85c137033e8d3d5a4f2aeb72b6ebdd6748b5358057`.

I read the candidate, scenario/concurrency runners, lifecycle observer, dependency/replay mechanisms, changed document sections, invitation audit, task reports and prior reviews. I also inspected the actual saved normal/hostile/R1 RED/lifecycle results, application logs, relevant invitation/wallet call sites, and original milestone definitions. Earlier review verdicts were supporting history, not substitutes for these checks.

## Strengths

- **Authorization follows locked current facts.** `experiments/pg17-access-guards/candidate.sql:20` rejects missing/foreign callers. Lines 24–49 retain the first project/user tuple, lock project then member, compare the locked binding, and independently check current user, pending state, role, project status and inviter. Success updates only the target member and returns the persisted restricted TABLE result. The SQL change closes R1 without changing the interface or resource behavior.
- **Creation is one resource transaction.** `experiments/pg17-access-guards/candidate.sql:60` checks the caller and supported inputs; line 69 locks an existing wallet before eligibility checks. Lines 78–88 consume the correct voucher/seat, create the owned project and member, and write both consumption records in the same transaction. Missing wallets are not created and `payment_status='unverified'` avoids claiming that legacy balance consumption proves payment.
- **Tests measure meaningful state and concurrency.** `experiments/pg17-access-guards/scenarios.mjs:42` compares complete seven-table snapshots on denials; line 180 onward injects actual CHECK failures and caller rollbacks. `experiments/pg17-access-guards/concurrency.mjs:6` observes ungranted locks, wait events and blocker identities. The R1 regression at line 25 keeps the committed changer baseline separate from the accepting transaction, so a false success cannot hide its writes. Export composition covers both existing overloads at `scenarios.mjs:220`.
- **Compatibility work exposes the real integration gap.** `docs/research/2026-10-18-invitation-compatibility.md:26` distinguishes all five mismatched calls, JWT versus service execution, TABLE handling and pre-read fallback. Lines 59–67 account for nullable CHECKs, independent unique indexes and the lack of invitation/member mapping. Lines 73–104 preserve cancellation, expiry, wallet-source, token and unknown-commit requirements as future work. The implementation does not silently replace this audit with a claim that email invitations now work.
- **Task 3 retains evidence history and release limits.** `docs/research/evidence/2026-10-18-rpc-access-guards/verification.json:49` retains the initial review and implementation references; the research record at `docs/research/2026-10-18-rpc-access-guards.md:23` distinguishes the original RED, initial 116/1828 run, R1 RED and fixed run. The current handoff, index, P0/P1 notes and plan agree on local scope, remaining production gates and the pending final review.

## Plan alignment and binding ruling

Task 1 delivers the required source/contract audit and future atomic adapter boundary. Task 2 preserves signatures/defaults/results, limits the candidate to the new experiment, uses actual low-privilege sessions, tightens the exact local ACL, and covers the planned rollback, race, export-composition and lifecycle cases. Task 3 records application verification, restores next-env, retains the unchanged dependency-audit failure, updates the six authorized existing documents and new research/evidence summaries, and evaluates the original milestones without changing their threshold.

The two spec paragraphs changed at `docs/superpowers/specs/2026-10-18-rpc-access-guards.md:17` and `:19` narrow the earlier ambiguous rebinding wording to an observable per-call consistency rule. I independently find the resulting contract and SQL consistent: a locked tuple differing from the first observed tuple is rejected, while authorization still uses the locked current row. A valid binding committed before the first read is therefore accepted as current fact. The existing signature contains no trusted previous version or mapping from which lifetime identity could be proven.

This is **not** historical immutability or ABA detection. The retained pre-lookup-rebinding success scenario and the new in-call-rebinding denial scenario demonstrate the distinction. If a later integration requires an invitation identity to remain permanently bound, this candidate alone cannot meet that requirement; the separately documented trusted version/mapping and migration work is necessary. Under the explicit current ruling and binding spec, this is a disclosed scope limit, not an unclosed R1 defect.

## Independently checked evidence

All checks below were local, read-only inspections or hash/reference comparisons. No PostgreSQL, application suite, dependency audit or successful unchanged behavioral matrix was rerun.

| Check | Independent observation |
|---|---|
| Review snapshot and preservation | All 21 snapshot hashes match. Of 1,514 baseline files, 1,507 are byte-identical; exactly the seven authorized document files differ. There are 36 new visible batch files before this review report, with no unexpected new files. Application, prior experiment/runtime, dependencies and root migrations are preserved. |
| Final experiment inputs | Seven final experiment hashes match. The 12 direct source, 44 loaded CommonJS/package and 743 installed PostgreSQL support hashes all match, as does the pinned Node executable. |
| Evidence integrity | 28 referenced whole-file evidence hashes match, including the initial nine run files and final run/observer children. The append-only Task 2 report entry is correctly a byte-prefix hash; its declared prefix matches. The old review and implementation manifest remain unchanged. |
| Original RED | The saved original run lacks candidate.sql in its source list, reports EXPECTED_RED, and records actual unauthorized activations and one project/role created with zero vouchers. It is a real behavior failure, not a fixture/pin failure. |
| R1 RED | The saved pre-fix candidate run fails specifically at the replacement-user regression. It observes a real lock wait, returns 00000, changes project_roles and records activation. Its old candidate/input hashes are appropriately distinct from the final ones. |
| Final normal and hostile runs | Each contains 117 passed scenarios, 1,834 total harness assertions, 26 actual waits, and no failed scenario. Every recorded waiter has an ungranted Lock wait with the reported holder among its blockers. Both runs use the final source/pin maps and record source stability through completion. |
| R1 and state invariants | Both fixed runs return 42501 for R1; all seven committed-changer and after-caller fingerprints match, with no activation. All 145 recorded invariant checks in each full run compare equal complete seven-table snapshots. |
| Actual catalog and local identities | Saved catalog entries retain parameter names, sole creator_role default, TABLE/UUID return, owner, volatility and non-strict semantics; search_path is empty and ACL is owner plus authenticated. Recorded caller sessions are real independent nonsuperuser/non-bypass roles. The report explicitly identifies synthetic auth, stricter table ACL, omitted production policies and other environment differences. |
| Lifecycle | Four observer cases pass with exits 0/143/1/1. Each child records stopped cluster, removed temp directory, zero clients and no cleanup error. SIGTERM follows fixture-ready; startup and connection failures have the expected real failure evidence. Observer PID/absence, safe output and no-rescue results agree with the child reports. |
| Application validation | All 707 recorded input hashes and three log hashes match. Logs support 77 Web suites/766 tests, shared 4/16, infra 7 and 175 generated pages; the controller manifest records exit 0 for verify/shared/infra. Current next-env bytes equal the prebatch copy. Existing Next configuration and missing Supabase service configuration warnings remain visible. |
| Invitation references and hash reconciliation | All 245 line ranges are in bounds and 184 JSON Pointers resolve. All 177 value/source pairs match their referenced objects (145 metadata objects plus 32 prior run summaries), as do three catalog objects. Of 32 audit source hashes, only the two declared spec/plan updates differ; their old/current hashes match the reconciliation record. Source spot checks confirm the reported parameter, principal, TABLE/fallback and wallet/return defects. |
| Links, whitespace and private inputs | All 383 relative file targets resolve; no scanned trailing whitespace; git diff --check exits 0. Both private capture files match their fixed hashes and retain file/parent modes 0600/0700. No whitespace-normalized complete copy of the 13 private definitions, specified credential-pattern match or tracked private capture/credential path was found in the reviewed public material. Credentials were not read and private definitions were never printed. |

The 1,834 assertions include harness/input-fingerprint assertions; they are not 1,834 separate business scenarios. Saved execution results establish the reported local behavior, while hash matching establishes that the current reviewed inputs are those results' inputs. Neither establishes current remote state.

## Issues

### Critical (must fix)

None found in the reviewed batch.

### Important (should fix)

None found in the reviewed batch. The previously identified R1 is addressed, and the preserved initial CHANGES_REQUIRED report accurately remains historical evidence.

### Minor (nice to have)

None requiring action for this batch.

## Recommendations and assessment

The controller can close the final review checkbox and update current status/handoff references to this actual PASS, then refresh the integrity report and any affected current-document hashes. Preserve all historical RED, initial-review, initial-run and scoped-fix evidence.

**Ready for local batch completion: Yes.** The implementation and Task 3 reporting meet the current binding spec and plan, and no actionable correctness, security, evidence-fidelity or maintainability defect was found within that scope.

**Ready to merge or release on milestone grounds: No.** The original G0/G1 criteria at `docs/2026-10-10-integrated-upgrade-plan.md:311` and `docs/superpowers/specs/2026-10-13-upgrade-p0-gates.md:11` require actual permission/environment, rollback/provider and device/integration evidence this batch does not supply. The recorded NOT-achieved judgment is sound. No new local milestone or commit/push authorization follows from this PASS.

Remaining scope limits include formal token/confirmed-email/persistent-reservation adaptation; trusted wallet grants and payment provenance; direct-table and other RPC paths; real JWT/role inheritance/production ACL/RLS/Storage; old RLS/source-ledger matrices under full PG17 dependencies; historical equivalence and rollback for seven unregistered migrations; bucket/object, backup restoration, provider and formal adapter evidence; and the real-device 5/20/30-minute matrix. No idempotency key or automatic unknown-commit recovery is implemented. The unchanged historical dependency audit remains failed at 42 findings (34 high, 8 moderate).

Only this review report was written. No source/document status, index, HEAD or branch change; no remote/network/authentication/email/payment action; no commit, push, merge, migration or deployment was performed by this review.
