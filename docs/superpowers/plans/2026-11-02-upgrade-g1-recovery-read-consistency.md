# G1 Recovery Read Consistency Implementation Plan

> **For agentic workers:** Continue on the existing branch/workspace. Use TDD, independent specification review then independent quality review; keep historical evidence unchanged. User authorizes local execution and requests an explicit G1 gap list separating human actions from engineering work.

**Goal:** Concurrent appends or cleanup during recovery reads must be reported as `changed`, not as damaged audio; genuine corruption and post-hash changes must still fail closed.

**Architecture:** Reuse the existing session consistency comparison immediately after chunk acquisition and again after byte/hash verification. Keep initial identity validation before reading chunks. This is optimistic consistency checking, not an atomic database snapshot or server authorization. No retry, write, deletion, schema or recorder queue changes.

**Tech Stack:** Existing TypeScript, Jest, native IndexedDB/Chromium harness. No dependencies or SQL changes.

## Baseline

- HEAD `8d4fc6dc540a74ad260ba9689db57b410e0eb059`, branch `codex/october-upgrade-p0`, initially clean, three local commits ahead of remote-tracking `1921766c2`.
- Prior G1 transaction/write-guard/connection batches are complete; 1471 historical inputs and 85 prior local evidence files protected.
- Current recovery reads session and chunks separately, classifies count mismatch as `damaged`, and only then rechecks session metadata. A legitimate append or cleanup between those reads can therefore be misclassified before the existing change guard runs.
- Alternatives: auto-retry reads (hides concurrent work and expands behavior), add a database-wide snapshot API (broader API/mock change), or reuse the existing optimistic guard before and after validation (selected minimal fix).

## Task 1: Reproduce The Read Race

**Modify:** `packages/web/src/lib/__tests__/recording-recovery.test.ts`, `scripts/browser-tests/recorder-recovery.test.cjs`.

- [x] Add Jest cases for append-to-existing, append-to-empty and concurrent clear during chunk acquisition; require `changed`, not `damaged`/`empty`, and no mutation of returned chunk fixtures.
- [x] Add a positive guard regression: mutate session metadata during real SHA-256 verification; the final recheck must still reject `changed` (no replacement of the final gate with only an early gate).
- [x] In the native harness, queue a competing readwrite transaction on the first session-read success before production resumes; append or clear atomically. Verify actual `changed`, preserved resulting bytes/session state, and successful subsequent explicit selection where a draft remains.
- [x] Preserve all old 28 native cases and existing Jest assertions. Freeze actual behavioral RED with distinct browser/Jest logs and source hashes.

```ts
jest.mocked(recorderDB.getChunksBySession).mockImplementation(async () => {
  jest.mocked(recorderDB.getSession).mockResolvedValue(undefined)
  return []
})
await expect(loadLocalRecording('draft', 'project', 'user'))
  .rejects.toMatchObject({ code: 'changed' })
```

```bash
node --test scripts/browser-tests/recorder-recovery.test.cjs
npm test --workspace=packages/web -- --runInBand --runTestsByPath src/lib/__tests__/recording-recovery.test.ts
```

## Task 2: Minimal Recovery Classification Fix

**Modify:** `packages/web/src/lib/recording-recovery.ts` only.

- [x] Extract the existing current-session comparison into a private async helper retaining all identity, state, confirmation, MIME, start, timestamp and watermark checks.
- [x] Call the same helper just after reading chunks, before empty/count/hash classification, and retain its call after SHA-256 verification.
- [x] Leave initial identity checks, genuine corruption rules, final Blob assembly and all recorder DB mutation APIs unchanged.
- [x] Run same-source browser GREEN and focused four-suite Jest regression, preserving real counts and exits.

```ts
const chunks = [...await recorderDB.getChunksBySession(sessionId)].sort((a, b) => a.index - b.index)
await assertSessionUnchanged(session, projectId, userId)
// Existing empty/count/byte/hash checks remain here.
// After verification, retain the final guard:
await assertSessionUnchanged(session, projectId, userId)
```

```bash
npm test --workspace=packages/web -- --runInBand --runTestsByPath \
  src/lib/__tests__/recording-session.test.ts \
  src/lib/__tests__/recording-recovery.test.ts \
  src/components/recording/__tests__/smart-recorder-session.test.tsx \
  src/components/recording/__tests__/recording-recovery-panel.test.tsx
```

Actual evidence: browser RED exit 1 (3 new cases fail; Node 28 pass / 4 fail including parent), Jest RED 24 pass / 3 fail; GREEN browser 31 subcases / Node 32 passed, focused Jest 4 suites / 72 tests passed, both exit 0. Hash-verification regression is a positive guard check and also passed before the fix.

## Task 3: Current G1 Gap / Human Action Register

**Create:** `docs/research/2026-11-02-g1-gap-register.md`.

- [x] Map original integrated plan section 7.1 and quality-gate sections 2-3 to current implemented code and existing evidence, not old milestone labels.
- [x] Verify current client upload/seal/confirmation path and distinguish available server contracts from end-to-end recorder wiring; do not call all remaining work merely manual testing.
- [x] List precise gaps, present evidence, minimum closure evidence, and owner: agent can continue locally / human provides inputs or authorization / human physically operates devices.
- [x] Distinguish G1 fictional test material and device qualification from G3/G4 real-household longitudinal study; do not demand household recruitment to begin G1.
- [x] Keep real 5/20/30-minute recordings, lock/call/process kill/physical quota, listening and second-device offline export separate from synthetic tests. Preserve section A #1/#2/#6 restrictions and no new push authorization.

## Task 4: Review, Verify And Seal

- [x] Independent specification PASS then independent quality Approved; fix real findings with RED/GREEN and re-review.
- [x] Run full chain, compare generated next-env changes and restore saved original bytes; preserve build diagnostics, audit not rerun.
- [x] Recheck 1471 historical inputs, 85 prior evidence files, source/log/document hashes and staged scope.
- [x] Prepare the report, evidence, current handoff/index and this checklist for the new local checkpoint only, no amend/push. Final staged byte validation is recorded in `final-integrity.json`; actual commit identity and post-commit clean state are checked with Git after commit.

```bash
npm run verify && npm test --workspace=packages/shared -- --runInBand && npm run test:infra
git diff --check
```

No remote migration/repair, deployment, main merge, paid calls or family-media transfer. No SQL change means no repeated PG experiments. Local classification fix does not prove real-device G1; `g1MilestoneSatisfied: false`, `pushConditionSatisfied: false`.

Closeout: full chain exit 0 (Web 139/2200, shared 4/16, infra 14, build 184 pages); next-env saved original restored. Specification initial FAIL for omitted AI-failure gap is preserved; corrected G1-08 re-review PASS, then separate quality Approved. Both reviewers independently passed native browser and focused Jest. Final gap register covers nine gaps; no real G1 qualification or new push authorization.
