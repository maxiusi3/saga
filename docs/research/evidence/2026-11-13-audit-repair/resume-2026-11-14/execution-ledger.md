# SDD ledger — plan: docs/superpowers/plans/2026-11-13-upgrade-audit-repair.md

Baseline HEAD c0669e8058343f91deba8e468b03e4bf817b1ca5; dirty required baseline archived in /tmp/saga-audit-repair-baseline.tar.gz, file hashes docs/research/evidence/2026-11-13-audit-repair/baseline-manifest.json.

Preflight:

| Task/pair | Contract check | Resolution |
|---|---|---|
| 1 | Recovery regression and code share real IO boundaries | Failed reproduction retained; persistent send fence required |
| 2 | Source-bounded AI drafts match family approval model | Separate service-only draft RPC; no arbitrary unbound body |
| 3 | Semantic results retain current citation contract | Explicit mode extends literal interface; same source validation |
| 4 | Payment expiry creates notifications, never alters expiry | Atomic station delivery and optional email receipt |
| 5 | Full suite includes every forward migration | Parent owns allowlists and complete harness |
| 1/2 | Both consume story-review-service | Task1 owns existing file; Task2 separate client module, existing review methods unchanged |
| 2/3 | Provider policy registry shared | Task2 owns registry changes, Task3 reads existing Voyage target; coordinate additions |
| 1/4 | Shared CLI runtime loader | Parent exclusively edits shared loader; worker entry names coordinated |
| 1/2/3/4 | Root migration order | Assigned 20261113000001/2/3/4; no historical migration edits |
| all/4 | package/lock mutation and dependency compilation | Parent exclusively updates manifests; owners report needed interface adaptations |

Ruling: Continue on existing codex/october-upgrade-p0 branch and preserve dirty worktree — all audited implementation depends on uncommitted G1–G4 inputs; a clean checkout would omit required fixes — incorrect isolation choice would require replaying the captured baseline.
Ruling: User's request to fix the listed findings authorizes the previously proposed repairs and planned feature completion — no repeated design permission — reversible implementation choices remain documented in the new spec.
Ruling: Four disjoint ownership scopes may execute concurrently under dispatching-parallel-agents — avoid overlapping files and serialize shared manifest/harness edits — any integration conflict must be resolved and independently reviewed.

Task 1: implemented, first review found cleanup snapshot race P1 and stale audio pointer retry P2. repair_recovery executing fix round 1; original native/Chrome681 + Jest91 passed but not accepted as closure.
Task 2: implemented, first review found corrected-source author loss P1 and unchanged modify search omission P2. implement_ai_review executing combined AI+semantic fix round1. Initial fullAI/G2/Chrome827 passed, final readiness196 native; fresh integration still required.
Task 3: implemented, original semantic native219/41files + Jest122 + literal191 passed. Combined review findings owned by Task2 fixwave modifying00002/00003 together.
Task 4: parent authored initial SQL/native/service RED, delegated reminder completion to implement_reminders for disjoint scope. Service8, actualChrome/SDK/native passed with further edge tests in progress. Parent finished Q3 OpenAI6.49.0+Zod4.6.7+follow-redirects1.16.3, migrated z.record/.issues, 23consumer tests passed, audit:high exit0 (0high/0critical;26moderate3low retained). Node20 floor preserved.
Task 5: full harness hooks --ai-edit/--semantic-search/--hosting-reminders and migration allowlist updated; worker loader+package script wired. Await stable reviewed sources for complete validation.

Ruling: Use OpenAI6.49.0 instead of latest7.56.0 — latter raises minimum Node to22 while project supports20.9 — latest-only SDK features remain out of scope; existing Chat Completions API and new fetch adapters are compatible.
Ruling: Authorised semantic citations for approved AI text use verbatim source_quote, not generated paraphrase — prevents paraphrase being represented as original audio — edited words may differ from searchable source but embedding search remains meaning-based.

## 2026-11-14 resume completion

Task 1: complete (no commits; Q1/Q2 and both rereview findings closed, native combined2479/41 and prior independent recovery receipt).
Task 2: complete (no commits; corrected author and unchanged modify search fixes rereviewed, source-bound editor/reviewer route/UI integrated).
Task 3: complete (no commits; real vector ranking/rerank and authoritative final revalidation, combined2479/41).
Task 4: complete (no commits; reminders228/41 including real CSS keyboard/touch row checks, audit0high0critical, inherited whole-page narrow overflow documented).
Task 5: complete (no commits; final Web188/3798 + shared4/16 + infra30 + build187 + native combined2479/G4-188/reminders228/backup597, all41 migrations/current hashes clean; final independent scope review clean).
Ruling: Retain this ledger and source worktree without commits or cleanup — the authorized plan expressly preserves uncommitted work and no Git snapshot of this batch exists — deleting it would lose recovery evidence.
Ruling: Correct only the invalid combined-test fixture creation order and asset identity — production deletion guards properly rejected dangling references after prior tombstones — disabling guards would invalidate safety verification.
Final report: docs/research/2026-11-14-audit-repair.md. Final durable evidence: docs/research/evidence/2026-11-13-audit-repair/resume-2026-11-14/verification.json.
