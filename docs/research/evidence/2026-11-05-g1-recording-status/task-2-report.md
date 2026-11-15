# Task 2 report — strict recording status reader and GET

Status: implementation and tests frozen again after the fixture-discovery correction below. All four production sources match the first freeze exactly. No stage, commit, push, remote migration, deployment, paid API or family data operations.

## Delivered

- `recording-session-status.ts`: exact `readRecordingSessionStatus(input, {admin, signal?, timeoutMs?})`; closed/canonical input validation, local input/options snapshot, one `read_recording_session_snapshot` RPC, `abortSignal`, explicit `retry(false)`, bounded 5000 ms default and 1..60000 limits. Every failure becomes `recording_status_unavailable`.
- `recording-status-validation.ts`: pure `validateRecordingSessionSnapshot` and input validator. Exact 13-key internal envelope; existing closed manifest parser/canonical PostgreSQL hash; deterministic seal asset/idempotency identity; exact chunk identities/physical locations/count/bytes; optional blocker rejection; real UTC calendar validation with microsecond equality/order. Raw rows stay inside server code.
- Closed, frozen compact receipt with the exact 12 specified fields. Frozen content exists only for a fully certified success. No candidate ID, worker, raw row, storage pointer, URL or diagnostic is returned. `canClearLocalDrafts` is always false.
- Success certifies complete session/asset/job/current-attempt/candidate identity, immutable metadata and content, common terminal time, and contiguous undispatched retry history. Permanent failure accepts only the six existing permanent codes and the full failed/quarantined/fatal tuple on the original pointer, with all successful content/confirmation fields null and no candidate from any attempt.
- Unresolved accepts sealed-only, asset-only, queued, leased/running (including expired), current reserved/prepared candidate, exact retry-wait, outcome-unknown and undispatched max-attempt recovery histories. Generic or incoherent failure records reject instead of becoming an inferred permanent failure. Partial terminal state rejects.
- GET `/api/recordings/sessions/[sessionId]/status`: auth first, `MEDIA_ASSETS_ENABLED === 'true'`, canonical UUID/lower-case SHA-256, exactly one each `projectId`/`manifestSha256` and no other query keys. Actor comes only from auth. 200 terminal / 202 unresolved / 400 invalid / existing auth status / 404 disabled / fixed 503 unavailable. Existing helper preserves every auth Set-Cookie and enforces no-store.
- Existing `recording-job-input.ts` has only two appended pure exports: `parseRecordingJobManifest` and `recordingManifestSha256`. Every previous byte remains an identical prefix; imports and existing behavior are unchanged.

## Tests and evidence

All new logs and command/exit records are under `docs/research/evidence/2026-11-05-g1-recording-status/`.

- `task2-red2.log`: executable behavioral RED before implementation: 2 suites, 61 failed / 162 passed (223 total). Explicit `--runTestsByPath` includes the dynamic route. Failures asserted missing behavior in real scaffold functions, not missing imports. The earlier `task2-red.log` is retained but excluded as route evidence because Jest regex selection omitted the bracketed path.
- `task2-green-attempt1.log`: first implementation, 2 suites / 223 tests pass.
- `task2-timestamp-red.log`: two additional behavior failures discovered during self-review, before their production corrections: transaction timestamp compatibility and asset/job creation ordering.
- `task2-focused-green.log`: final focused regression, 5 suites / 564 tests pass (225 new reader/route cases plus original input/candidate/finalization tests).
- `task2-typecheck-final.log`: `npm run type-check --workspace=packages/web`, exit 0.
- `task2-legacy-verifier.log`: original verifier compiler graph executes, exit 0.
- `task2-legacy-candidate.log`: original candidate compiler graph executes, exit 0. The new local harness invokes only its compiler export and cleans its scratch directory; old evidence writers were not run.
- `task2-diff-check.log`: `git diff --check`, exit 0.
- `task2-legacy-input-preservation.json`: original input loader byte prefix is intact; 393 bytes appended and zero new imports.
- `task2-source-snapshots.json` and `task2-source-snapshots/`: frozen exact copies and SHA-256 of the seven owned production/test sources.

The tests exercise the actual reader/validator and installed Supabase JS with a transport-only HTTP response fake. Route tests mock only authentication/admin factories and execute the actual reader. They verify terminal schemas/status, malformed/lost receipts, cancellation, timeouts, one request, no unrelated HTTP branches, fixed diagnostics, refreshed cookies, auth/flag/query rejection, and immutability.

## Important timestamp detail

The existing seal routine uses `statement_timestamp()` for session start/seal, whereas chunk `persisted_at` retains `DEFAULT now()` (transaction timestamp). Therefore a chunk can legitimately precede session start in an explicit transaction. The validator still requires a real UTC chunk timestamp no later than the seal; it does not invent a lower bound that would reject existing legitimate rows. Asset creation cannot postdate the referencing job creation. All equality/order comparisons preserve PostgreSQL microseconds rather than relying on millisecond Date equality.

## Full-gate fixture discovery correction

The controller's `full-gate-01.log` is the failure evidence: all 3100 assertions passed, but Jest's default discovery treated `src/lib/server/__tests__/fixtures/recording-status-fixture.ts` as an empty test suite. Focused `--runTestsByPath` had not exercised default discovery. The helper was moved to the repository's existing `src/lib/server/test-support/` convention. Only its relative service import and the two consumer-test imports changed; no Jest configuration or production code changed.

- `task2-fixture-move-focused.log`: 2 suites / 225 tests passed.
- `task2-fixture-move-typecheck.log`: web typecheck passed with the helper now included in its normal source graph.
- `task2-fixture-move-discovery.log` and `task2-fixture-move-discovery-result.json`: default Jest discovery lists 153 suites, includes the two intended status suites, and excludes the helper.
- `task2-fixture-move-diff-check.log`: whitespace check passed.
- `task2-source-snapshots-02.json`, `task2-source-snapshots-02/`, and `task2-fixture-move-freeze.json`: new freeze receipts and source copies. Original freeze receipts and archived source files remain unchanged. The four production source hashes match the original freeze exactly.

The controller owns the canonical full-gate rerun after this corrected freeze.

## Boundaries and pending integration

- No full repository gate or native harness run by this task; controller owns the full gate and Task 1 owns native PostgreSQL/HTTP evidence. The application source/test freeze was sent to both before native integration.
- No SQL/schema/type changes, old evidence replacement, browser workflow, story-save, local cleanup, access signing, Storage mutation, worker/finalizer replay or recovery path.
- An accepted receipt is a point-in-time observation; later revocation/deletion can invalidate access. It never authorizes local cleanup. G1 qualification and push conditions remain false.
