# Task 2 independent specification and documentation review

**Spec: PASS. Documentation quality: Approved.** No Critical or Important findings. One nonblocking Minor wording finding is recorded below. This approves the frozen Task 2 documentation scope; it is not whole-batch, production or original-milestone approval.

Reviewed at 2026-10-18 22:13 Asia/Taipei against `task-2-brief.md`, `task-2-controller-notes.md`, the binding HTTP-adapter spec and plan, `task-2-report.md`, the supplied `task-2-diff.md` and `task-2-snapshot.json`. The supplied diff was reviewed without regenerating a HEAD comparison. The initial Task 1 review, Fix 1 review, appended implementation report and referenced source, focused, project, prior-experiment and integrity evidence were also read. No tests or external operations were performed.

## Findings

**Minor M1 — attribute the 194-test total to the combined focused suite.**

Locations: `docs/2026-10-10-integrated-upgrade-plan.md:46` and `docs/superpowers/specs/2026-10-13-upgrade-p0-gates.md:29`.

Both summaries describe the 194 tests as actual SDK-to-loopback checks. The total includes 77 protocol tests and 29 client/facade tests, in addition to the 88 handler tests. A narrow source check to resolve this exact attribution ambiguity confirmed that the protocol suite calls parsers directly (`packages/web/src/lib/__tests__/invitation-acceptance-protocol.test.ts:12`) and the client suite substitutes session/fetch boundaries (`packages/web/src/lib/__tests__/invitation-acceptance-client.test.ts:7` and `:21`). Actual SDK/loopback coverage belongs to the handler suite. The research record's validation table and verification JSON already distinguish the three groups correctly, so this does not undermine the validation result or the declared production limitations.

Suggested remedy: use “定向三套共 194 项通过；handler 测试使用实际 SDK 对接合成 loopback” in both summaries. Do not relabel all 194 cases, or every handler case, as a network round trip.

## Specification and evidence checks

- The research record, handoff, main plan, index and P0/P1 updates consistently describe the replaced acceptance handlers, exact enabled-value gate, default 503 before external work, canonical input and explicit credential requirements, and absence of a legacy write fallback. They preserve the facade wrapper and required success fields, require final acceptance confirmation, and distinguish explicit read-only recovery from automatic retries.
- The documented identity verification, same-client status/accept ordering, distinct RPC argument names, single acceptance attempt, result/member consistency and deadline/cancellation behavior agree with the binding spec and the approved Task 1 review. No additional application-source inspection was needed for these previously reviewed behavior claims.
- All ten frozen document hashes match `task-2-snapshot.json`. The published implementation report is an exact byte copy of the appended Task 1 report. Its earlier paths/digest are explicitly historical; current references select Fix 1. The final source digest recomputes to `690149536961419859643d1e5348866856edec38311e6a4844688d997481fa9e`; all eleven current source hashes match that manifest and are covered by the canonical project's input map.
- All ten path/hash references in `verification.json` match their files. The fixed focused evidence records 194 passing tests with open-handle detection, clean discovery, type-check and scoped lint. The retained initial review remains FAIL / Needs fixes for I1; the separate Fix 1 review says I1 ADDRESSED / PASS / Approved.
- The three successful public project logs and the failed predecessor log match their manifest hashes. Their summaries confirm Web 80 suites / 960 tests, shared 4 / 16, infra 7 and 176 generated pages. The successful canonical manifest names three exit-0 commands, a fresh current-batch execution, 715 unchanged inputs and restored next-env bytes. The failed predecessor remains exit 1 despite 960 passing assertions; it is never represented as successful full verification.
- The documented build warnings and unresolved 42-item dependency audit match the evidence. Prior PG matrices are described only as preserved fingerprint evidence, not rerun or combined with synthetic HTTP evidence into a deployed integration claim.
- All 372 local Markdown links found in the ten frozen documents resolve. `integrity-before-task2-review.json` separately records 374 checked links across the controller's broader scope, no whitespace failures, exactly eight authorized old-file changes, and no unexpected application, task-evidence or prior-experiment changes. Its 715 / 11 / 10 / 18 / 838 integrity counts agree with the documented attribution and preliminary snapshot limits.
- The first privacy scan's sole reported file is the exact implementation-report copy. The referenced credential-precedence wording is ordinary prose, not a credential value. The retained first scan and narrowly disclosed whole-phrase exclusion account for the later passing result without rewriting historical evidence. No private definition, credential value, address or raw provider error was added to this review.

## Controller follow-ups and limits

Task 2 and whole-batch review fields are correctly pending in the frozen documents. After receiving actual verdicts, the controller must publish/backfill their references, update current status/checklists and regenerate integrity for those final document changes. The evidence README explicitly dates its final-checks description to document freeze; the later pre-review integrity snapshot does not itself close the whole batch. These future closure actions cannot be certified by this task-scoped review and are not missing implementation work.

The documentation keeps real Auth/JWT, deployed schema/PostgREST/PG17 integration, production RLS/ACL, trusted entitlement provisioning, remaining legacy paths, historical compatibility/migration/rollback and recovery UI as separate open work. G0/G1 remain false, as do commit, push, merge, migration and deployment actions. No approval here changes those boundaries.

Only this review file was written. No implementation, evidence, other document, index, HEAD or branch mutation was performed; no tests, subagents, commits or remote calls were used.
