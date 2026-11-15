# G1 recording workflow — final whole-change and Task4 review

## Scope and spec compliance

**Whole-change spec compliance: Needs fixes.** **Whole-change quality: Needs fixes.**

**Task4 harness/evidence quality: Approved for the stated local boundary.** The selected evidence genuinely exercises the production page, recorder/recovery/save modules, native IndexedDB/WebCrypto/Web Locks, actual Next route implementations, Supabase SDK, SQL, production queue host and FFmpeg. The unresolved finding below is in production confirmation validation, not an invented harness success.

Reviewed the supplied 5,050-line takeover-baseline patch in logical passes: contracts/SQL and routes; durable capture/save/cleanup and page wiring; worker host/CLI; tests and fixtures; documentation and recorded evidence. Base and HEAD are both `c0669e8058343f91deba8e468b03e4bf817b1ca5`; no whole-branch diff was substituted for the 62-file patch. The scope is local delivery, with G1 and conditional push qualification false.

The required record/reopen/continue → durable intent and unique story → immutable verified upload/seal → standalone host → terminal status → separate confirmation → guarded stable playback → explicit atomic cleanup path is implemented. Lost replies and scope changes retain local audio, and the page contains no whole-Blob save fallback. One remaining SQL/application validation difference permits a corrupt chain to change the story before the API rejects it.

## Strengths

- `packages/web/src/lib/recording-save-flow.ts:37` freezes scope, takes the shared capture/save lock and persists intent before the first reservation request. Resume looks up the same reservation/hash; a lost response does not invent a new session or story. Status is only a hint to the separate confirmation operation.
- `packages/web/src/lib/recorder-db.ts:56` keeps byte verification and confirmation/cleanup writes within the IndexedDB transaction. Intermediate upload checks avoid repeated whole-recording hashing; final seal, confirmation and explicit cleanup retain full-byte checks. Generic chunk/session mutators refuse frozen drafts.
- `packages/web/src/app/[locale]/dashboard/projects/[id]/record/page.tsx:32` keys the recording scope by project/user and aborts the owned operation on unmount/reset. The recovered draft supplies the original session and pinned metadata. Saved playback and cleanup controls are distinct, and the recorded 375px screenshot is readable with truthful cleared-state text.
- `packages/web/src/lib/server/recording-worker-host.ts:35` selects at most one eligible job, preserves claim authority in the existing lease routine, advances past invalid rows and leaves dispatched unknown outcomes unreplayed. The production CLI and offline readiness have separate, bounded responsibilities.
- `experiments/recording-flow-browser/browser-server.mjs:35` injects unusable JSON only after the actual handler completes. The interrupted browser run records three such losses, retains chunks, reloads and reconverges on one story. This addresses the earlier TCP-reset fixture weakness rather than calling transparent browser replay a lost-response test.
- Task4 observes actual saved-player advancement and native decode, genuine transaction abort after a chunk deletion, retained chunks, and successful explicit cleanup retry. The server run uses the production host and actual SQL clock to distinguish expired pre-dispatch retry from post-dispatch `outcome_unknown`.

## Issues

### Critical (Must Fix)

None found. The application validator still refuses the bad confirmation, so this finding does not claim a false cleanup receipt or local audio deletion.

### Important (Should Fix)

**I1 / P2 — Complete the SQL confirmation checks before changing story/intent state.**

- **Primary location:** `supabase/migrations/20261106000001_recording_story_save.sql:277`–`:279`; committed writes follow at `:291` and `:294`.
- **Integration counterpart:** `packages/web/src/lib/server/recording-status-validation.ts:68`–`:88` validates every attempt, but `packages/web/src/lib/server/recording-story-save.ts:44` runs that validator only after the RPC has committed.
- **Problem:** the SQL checks the latest attempt’s provider/usage/cost fields, while its historical-attempt query checks only a subset of state and time fields. It omits each historical `worker_id` format; null `provider`, `provider_request_id`, `usage_units`, `reserved_cost_usd`, `settled_cost_usd`; the exact sequence `1..attempt_count`; and finish-time ordering relative to job creation and the preceding attempt. Row count plus a valid latest row does not establish that sequence. For example, for `attempt_count=2`, rows numbered `2,3` still have a latest row numbered 2 and count 2, and the query has no prior row to reject.
- **Concrete trigger:** start with a valid published two-attempt recording whose first lease expired before dispatch. After publication, set the first attempt’s `provider` to a non-null value (or give that historical worker an invalid identifier), then call the actual confirmation service. The table schema permits this mutation. SQL’s current predicates do not inspect that field on the historical row, so it writes `stories.status=ready` and the intent’s `confirmed_at`. `read_recording_session_snapshot` collects the raw attempts without validating those fields. The application then rejects the snapshot with 503. This is the same committed-ready/API-rejection failure class that the earlier canonical-identity correction removed.
- **Related time gaps in the same pre-write validation block:** `:269` and `:276` use ordering comparisons without the application’s finite/UTC timestamp domain checks for asset/job creation and chunk persistence. A one-attempt published chain with `media_assets.created_at='-infinity'`, or a chunk with `persisted_at='-infinity'`, passes those SQL comparisons and is rejected later by the strict application timestamp parser. The relevant foundation columns have no finite-time CHECK. This should be corrected in the same consistency fix rather than left as another path to the same partial outcome.
- **Impact:** a corrupt historical chain becomes a ready story/confirmed intent even though the save API refuses it; retry and lookup remain rejected. Local audio is retained, but the server has committed the state that this confirmation boundary is meant to deny. The failure is not covered by the recorded native corruption cases, which use one-attempt chains and focus on other tuple/identity fields.
- **Fix:** validate the entire ordered attempts collection and compatible timestamp domain under the existing locks before any story/intent DML. Reject extra/missing/out-of-range attempt numbers, malformed historical worker/provider/usage/cost fields, invalid/nonmonotone history and non-finite creation/persistence timestamps. Preserve the independent application validator and the existing no-cleanup-on-rejection rule.
- **Required narrow evidence:** through the actual confirmation service, add native two-/three-attempt regressions for each historical field category, the `2,3` numbering example, reversed/before-job history times, and the non-finite asset/chunk examples. Assert no receipt and full before/after equality of both story and intent rows. Retain valid two-/three-attempt successful confirmation/replay controls and the prior canonical-identity regressions. A static defect is established here; no new native reproduction or suite was run by this reviewer.

### Minor (Nice to Have)

No additional actionable finding. Documentation’s pending-review wording was intentional at this snapshot and must remain unapproved until I1 is fixed.

## Checks and evidence

- Recomputed all 62 entries in `whole-change-hashes.json`: no drift. Read the design, implementation plan, Task4 report and Task1/2/3 approval/fix reports. Existing task approvals were treated as scoped evidence, not as a substitute for this cross-task check.
- Independently rehashed the 937 entries in `source-lock.json` against current files and every ordinary-file tar member in `verified-source.tar.gz`: all match, exactly 937 members, no extra members, and the archive SHA-256 matches. This establishes the recorded measured-input set; it is not a claim of a hermetic archive of all runtime tools/dependencies.
- Checked `final-gate-01.json`, its compressed log SHA-256 and decompressed raw SHA-256. Before/after 902-file maps are equal; recorded command exits 0. The log confirms Web 159 suites/3204 tests, shared 4/16, infra 20 and 184 generated pages. Configuration warnings remain visible and do not qualify production configuration.
- Independently rehashed all three `candidate-validation.json` result files and all their recorded source maps. Selected final browser/interrupted/server results are passed with 297/329/723 assertions respectively, no source drift, and complete cluster/client/temp-directory cleanup. Browser results contain no uncaught page errors or external requests. Expected synthetic AI/agent 503s, duplicate-upload 409s, offline error and denied wake lock are retained rather than hidden.
- Read the Task4 browser/server builders, auth/Storage boundaries, local PostgREST adapter and both verification runners. Actual SDK queries reach SQL, and the host’s filter/cursor behavior is exercised by the native server run. The HTTP and microphone substitutions are documented. Browser assertion totals include repeated unprivileged caller checks; the named behavioral scenarios, not the count alone, support acceptance.
- Read the archived Task3 native runner and mutation fixture and its 15-scenario evidence. The actual production flow’s measured 4/8/16-chunk digest counts are 24/48/96. Late same-metadata Blob changes and the exact confirmation-put fault target the relevant boundaries. This is linear byte-hash work, not a device wall-clock benchmark.
- Read `integrity-before-final-review.json`: it records 4,477 prior evidence files unchanged, 1,360 takeover inputs protected except the named authorized changes, unchanged HEAD/index, empty staged diff and successful diff check. These are the controller’s recorded integrity results; this reviewer did not re-run the whole baseline audit or any completed suite.
- Named external integration reads were limited to the existing strict status validator/snapshot RPC, foundational attempt/asset schema constraints, terminal-worker lease handoff, playback guard and story playback consumer, capture stop handling, and the inherited native harness. They resolved concrete boundary questions raised by the patch.

## Recommendations

Make one focused confirmation-consistency correction for I1, record native RED/GREEN row-equality evidence and refresh the affected frozen-source evidence. Then request a limited re-review of that fix. The successful existing local suites and scenarios remain valid for their recorded source snapshot; they do not cover this missing corruption class.

Keep the existing cloud/device/long-capture, deletion/GC/backup and complete-migration-chain gaps open. No deployed service, physical microphone, one-minute capture interval, long-form content completeness or G1 milestone has been qualified by this review.

## Assessment

**Local delivery spec: Needs fixes.**

**Local delivery quality: Needs fixes.**

**Task4 harness/evidence: Approved within its explicitly documented local boundaries.**

**Ready to merge/deploy: Not assessed or authorized; this is a local-delivery review.**

The main save/recovery/worker/playback/cleanup chain and its local integration evidence are substantial and internally consistent. I1 must be fixed because the current database confirmation can commit a ready story before the strict service rejects its historical chain. No other blocking category was found in the reviewed change.

Review actions were read-only except this report. No test suite, native harness, remote call, product edit, stage, commit, push or deployment was performed.
