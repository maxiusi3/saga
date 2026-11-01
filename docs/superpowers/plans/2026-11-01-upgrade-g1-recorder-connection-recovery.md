# G1 Recorder Connection Recovery Implementation Plan

> **For agentic workers:** Use the existing branch and workspace. Follow TDD, independent specification review then independent quality review. The user has authorized proceeding with a new local slice without a generic confirmation stop; no remote actions or new worktree.

**Goal:** A failed or closed IndexedDB connection must not permanently poison later explicit local recorder operations, and an old client must not indefinitely block a database version change.

**Architecture:** Keep a single shared opening promise. Invalidate only that same cached promise on open failure, abnormal-close notification or versionchange; close the versionchange target so other connections can proceed. Reject the current failed operation as before. Never replay transactions, delete/recreate data, lower the schema version, or silently accept a newer incompatible database.

**Tech Stack:** Existing TypeScript, idb 8.0.3 and Playwright Chromium native IndexedDB harness; no dependency or schema changes.

## Baseline And Design

- HEAD `f59e8f8634cb3c10aa87092a4e615a90ca335ef8`, branch `codex/october-upgrade-p0`, initially clean and ahead of remote-tracking `1921766c2` by two local commits.
- Previous transaction/recovery and write-guard batches are complete. This is a separate G1 connection lifecycle slice under the existing save/recovery contract, not a repeat of those fixes.
- Inspection: `getDB` stores the first opening promise indefinitely, including rejection; it supplies no versionchange or terminated handler. idb forwards native open failures and exposes `blocking` / `terminated` callbacks; ordinary `db.close()` does not emit the abnormal-close signal.
- Alternatives: retain a poisoned promise (requires reload and blocks recovery); automatically retry every read/write (can replay uncertain writes); selected minimal approach invalidates the cache for the next explicit call only.
- Scope: `packages/web/src/lib/recorder-db.ts`, `scripts/browser-tests/recorder-recovery.test.cjs`, this new plan/report/evidence and the two current entry documents.
- Non-goals: schema migration, automatic recording continuation, transaction retry, data deletion, unknown-version compatibility, saveSession/deleteChunk semantic changes, cloud confirmation, UI, SQL, dependency updates or real-device qualification.

## Task 1: Native Browser RED

**Test:** `scripts/browser-tests/recorder-recovery.test.cjs`.

- [x] Preserve the original 23 cases and their assertions.
- [x] Seed a durable draft, reopen only the page/module, inject a one-shot native lower-version open (`VersionError`). Three concurrent operations must share the one failing attempt; no implicit retry occurs. A later explicit concurrent read opens once and recovers the untouched draft.
- [x] Capture the adapter's native connection and request version 3 from a separate native connection. The adapter must release version 2 without reaching `blocked`; after version 3 succeeds, the old client rejects with VersionError and preserves all draft bytes. A blocked fixture may close the old handle solely to finish the failing test.
- [x] Repeat the versionchange with the competing upgrade deliberately aborted. A later explicit read must reopen version 2 and recover the original draft without reload.
- [x] Close a captured native handle and explicitly dispatch the abnormal `close` notification; the next explicit recovery read reopens and preserves bytes. This is signal injection, not evidence of actual browser/process termination.
- [x] After replacement opens, deliver a late close notification from the old handle. It must not invalidate the newer cache or trigger another open.
- [x] Run and freeze RED using a unique receipt/log name. Failures must be behavioral assertions; unrelated harness errors are not RED evidence.

Representative injected open failure:

```js
IDBFactory.prototype.open = function (name, version) {
  calls += 1
  return originalOpen.call(this, name, calls === 1 ? 1 : version)
}
const first = await Promise.allSettled([
  recorderDB.getSession('capture'),
  recorderDB.getChunksBySession('capture'),
  recorderDB.updateSession('capture', { state: 'interrupted' }),
])
```

```bash
node --test scripts/browser-tests/recorder-recovery.test.cjs
```

## Task 2: Minimal GREEN

**Modify:** `packages/web/src/lib/recorder-db.ts`, connection acquisition only.

- [x] Name each opening promise `opening`; retain shared single-flight behavior.
- [x] On rejection, observe the cleanup promise and clear only when `dbPromise === opening`; return the original rejected promise to existing callers.
- [x] In `blocking`, close the native database from the versionchange event and invalidate that generation. In `terminated`, invalidate only that generation.
- [x] Do not change DB_VERSION, schema upgrade body, transaction helper, mutation methods or call sites.
- [x] Run GREEN and the four existing recorder/recovery Jest files; preserve all logs and hashes.

Core generation guard:

```ts
const forgetConnection = () => {
    if (dbPromise === opening) dbPromise = null
}
// The opening promise is shared and returned; cleanup does not retry operations.
dbPromise = opening
void opening.catch(forgetConnection)
```

```bash
npm test --workspace=packages/web -- --runInBand --runTestsByPath \
  src/lib/__tests__/recording-session.test.ts \
  src/lib/__tests__/recording-recovery.test.ts \
  src/components/recording/__tests__/smart-recorder-session.test.tsx \
  src/components/recording/__tests__/recording-recovery-panel.test.tsx
```

## Task 3: Reviews, Verification And Local Checkpoint

- [x] Independent specification PASS, then independent quality Approved; any genuine finding follows RED/fix/re-review.
- [x] Run the full chain after preserving next-env; restore only the verified generated addition from the exact original backup.
- [x] Verify 1471 historical protected inputs and all 60 local evidence files from the preceding two G1 batches.
- [x] Seal unique source/log/document hashes, review receipts and milestone decision in `docs/research/evidence/2026-11-01-g1-recorder-connection-recovery/`; add the report and update handoff/docs index.
- [x] Check staged/unstaged scope and seal this checklist in one new local checkpoint; actual commit identity and clean status verified using Git. No amend or push.

```bash
npm run verify && npm test --workspace=packages/shared -- --runInBand && npm run test:infra
git diff --check
```

## Evidence Limits

Use loopback and synthetic bytes only. Native version-change/open errors and injected close notifications do not prove real device termination, physical storage exhaustion, microphone recording duration or audio decoding. Section A #6 device/version-specific 5/20/30-minute recordings and failure/listening evidence remain missing; #1/#2 still constrain deployed/cloud qualification. `g1MilestoneSatisfied: false`, `pushConditionSatisfied: false`; no remote migration, main merge, deployment, paid call or family-media transfer. Audit not rerun; no SQL changes, so no repeated PG experiments.

Reference checked: idb openDB lifecycle documentation and installed 8.0.3 implementation; callbacks do not add automatic retries or cross-query authorization.

## Completion Record

Five new behavioral RED cases, original 23 cases retained; same test hash GREEN has 28 subcases / Node 29 passing. Focused Jest 4/68 and full chain Web 139/2196, shared 4/16, infra 14, 184 pages exit 0. Independent specification PASS followed by independent quality Approved, no findings requiring changes. next-env restored, 1471 historical inputs and 60 prior evidence files unchanged. This plan and evidence are sealed in the new local checkpoint only; G1 and push remain false.
