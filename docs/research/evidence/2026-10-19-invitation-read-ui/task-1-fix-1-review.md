# Task 1 fix 1 scoped independent review

## Spec Compliance

- ✅ **I1: ADDRESSED.** The fix satisfies the stale-account-result constraint in `docs/superpowers/specs/2026-10-19-invitation-read-ui.md:28`: genuine identity transitions synchronously increment a generation at `packages/web/src/components/invitations/invitation-recipient.tsx:77`; the snapshot records it at `:78`; both the mounted flow key at `:119` and its current-identity guard at `:138` include that generation. A departure and return in the same React batch therefore cannot make the old request current again.
- ✅ Same-user credential refresh leaves the generation unchanged (`packages/web/src/components/invitations/invitation-recipient.tsx:77`), while the parent-owned per-user write locks remain outside the remounted action flow (`:62`). The returning account consequently retains explicit-query recovery after an unresolved acceptance instead of receiving a fresh write opportunity.
- ⚠️ Fresh full-project verification remains a controller check on the fixed source. The earlier run does not establish verification of this change. Existing auth-privacy/G0/G1 boundaries and M1 verification noise are unchanged by this scoped review.

## Strengths

- Immediate generation invalidation fixes the ordering bug before a React commit, rather than relying only on eventual component cleanup. Cleanup and unavailable identity also invalidate the old generation (`packages/web/src/components/invitations/invitation-recipient.tsx:85`, `:105`).
- The acceptance regression resolves the old response inside the same batch as departure/return and checks no navigation, no automatic recovery request, retained explicit query, and later safe continuation (`packages/web/src/components/invitations/__tests__/invitation-recipient.test.tsx:284`).
- The stale-read regression proves an old accepted response cannot enable continuation, while the new generation's declined response controls the UI (`packages/web/src/components/invitations/__tests__/invitation-recipient.test.tsx:304`). The refresh regression verifies no duplicate read or write for same-user credential rotation (`:322`). These assertions exercise observable behavior through the existing real helper/parser.

## Findings

- **Critical:** None introduced by fix 1.
- **Important:** None outstanding from I1; no new findings in the scoped diff.
- **Minor:** No new findings. Previously recorded M1 remains an unrelated verification-output cleanup item; this fix does not claim to address it.

## Checks and Evidence

- Reviewed only `.superpowers/sdd/2026-10-19-upgrade-invitation-read-ui/task-1-fix-1-diff.md`, the updated report's fix section, and the referenced fix evidence. No additional application files, git operations, suite reruns, or code edits were needed.
- The saved RED reproduces both identified behaviors: stale acceptance navigation at `docs/research/evidence/2026-10-19-invitation-read-ui/fix-1-red.txt:6` and stale continuation at `:23`; totals are 2 failed / 1 passed / 38 skipped at `:40`.
- The matching targeted GREEN records 3 passed / 38 skipped at `docs/research/evidence/2026-10-19-invitation-read-ui/fix-1-green.txt:6`. The complete focused regression records 5 suites / 253 tests passed at `fix-1-focused-tests.txt:6`–`:7`, with no warnings in either successful capture.
- `docs/research/evidence/2026-10-19-invitation-read-ui/fix-1-type-check.txt:2`–`:3` records the completed type-check command. `fix-1-lint.txt` and `fix-1-diff-check.txt` are empty captures, consistent with the implementer's reported exit-0 results.

## Assessment

**Spec verdict: Approved for fix 1; I1 addressed.**

**Task quality: Approved at the scoped review gate.** The generation check covers old request completions and actions, preserves the existing write lock, and avoids remounting on valid same-user refresh. No blocking findings remain from this review; the controller must finish fresh full-project verification and the remaining batch gates.

**Report path:** `.superpowers/sdd/2026-10-19-upgrade-invitation-read-ui/task-1-fix-1-review.md`.
