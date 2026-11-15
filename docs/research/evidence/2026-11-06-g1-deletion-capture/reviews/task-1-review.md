# Task 1 independent consolidated review

Date: 2026-11-06. Reviewed the immediate-takeover patch, not the branch diff. Baseline HEAD: `c0669e8058343f91deba8e468b03e4bf817b1ca5`.

**Spec: Needs fixes. Quality: Needs fixes.** Two distinct Important findings, both accepted by the parent as must-fix; no Critical or Minor findings. The source-coverage defect also affects implementation correctness. This report consolidates all requested Task 1 review findings for one fix dispatch.

## Important findings

### I1 — Capture rejects a legitimate sealed recording before asset registration

**Axis:** Spec and correctness. **Location:** `supabase/migrations/20261106000002_media_deletion_capture.sql:124–128`, with the selected population at lines 107–112.

The session predicate requires every non-null `seal_input.assetId` to appear in `v_assets`, which contains only already registered `media_assets` rows. A valid story can already have a sealed session and persisted chunks while its asset and job have not been registered. The actual seal endpoint commits `persistRecordingManifest` at `packages/web/src/app/api/recordings/sessions/[sessionId]/seal/route.ts:95`, then performs access checks and invokes `registerRecordingSeal` at line 103. An interruption or registration failure between these operations leaves exactly this durable state. The seal SQL intentionally inserts session/chunk rows without an asset/job (`supabase/migrations/20261102000001_recording_seal_manifest.sql:178–186`).

The smallest native reproduction used the actual story-reserve and seal RPCs on a fresh isolated PG17 database, then called `request_media_deletion` as the actual `service_role`. The owner was authorized, the subject existed, all identities and addresses came from the real seal preparation service, and no source rows were tampered with. Capture returned `23505: Deletion source identity conflict`, leaving zero tombstones and targets. Thus a manager cannot request deletion of the story or its persisted audio until unrelated registration work succeeds. This violates design line 17: targets cover the subject's “bound recording sessions and their persisted chunk addresses.”

The existing native tests miss this because their `fresh` and `multipleChunks` fixtures always insert the asset/job immediately after sealing. The metadata-only control at `experiments/pg17-deletion-capture/scenarios.mjs:101–103` has neither a session nor chunks, so it does not cover this case.

**Required fix:** Treat a story-bound, correctly identified sealed session whose intended asset does not yet exist as a legitimate capture source. Capture its actual persisted chunk coordinates and story metadata without inventing an asset row, asset address, or job. Continue to reject an intended asset that exists but belongs to another project/story/chain. Add a native regression at the actual reserve → seal → deletion boundary, plus the mixed case containing both registered and unregistered sealed sessions. Ensure the resulting tombstone blocks subsequent seal registration/publication as intended.

**Exact reproduction and observed result:** embedded below in “I1 native evidence”; that section of this file is the review evidence artifact.

### I2 — Every deletion serializes the entire database content into JSON while globally blocking writers

**Axis:** Quality and operational cost. **Location:** `supabase/migrations/20261106000002_media_deletion_capture.sql:186–195` and `214–216`; global lock duration is established at lines 51–59.

Both verification loops select `jsonb_agg(to_jsonb(t))` without a predicate from twelve entire tables. This includes unrelated `stories.content`, transcripts, session manifests, all prior requests/targets, and every project's job/attempt history. The first loop repeatedly copies the expanding object into `v_expected`, and the second materializes the same full populations again. The cost of deleting one empty story therefore grows with all families' content, not with the deletion scope. During this work the transaction holds global locks that block story/media/job writes and publication; the `auth.users` SHARE lock also remains held.

A small synthetic local check kept every deletion at **one story-metadata target** and varied only the content of an unrelated story:

| Unrelated story body | Capture elapsed | Unrelated story UPDATE blocked |
| --- | ---: | ---: |
| 0 MiB | 12 ms | Not sampled |
| 8 MiB | 198 ms | Not sampled |
| 32 MiB | 964 ms | 965 ms |

The last sample recorded an actual `pg_stat_activity.wait_event_type = 'Lock'`, `wait_event = 'relation'`, `pg_blocking_pids = [39234]`, and an ungranted `RowExclusiveLock` on `stories` for the unrelated update. The blocker was the capture backend. These are single local diagnostic observations, not a throughput benchmark or a production capacity estimate. They directly demonstrate avoidable cross-subject work and lock occupancy; no large stress test was run.

The design explicitly permits conservative population locks for this correctness slice. That does not require copying unrelated story bodies and every historical tuple into the production RPC. Documenting the full scans as unqualified throughput does not remove their runtime impact from the implemented endpoint. The adapter's five-second deadline bounds the caller's wait; as the implementation report correctly states, it does not itself prove SQL has stopped or released these locks.

**Required fix:** Retain the existing conservative locks and their correctness ordering; this fix does not require a table-lock throughput architecture rewrite. Construct the expected new request/targets and expected selected asset/job transitions from scoped rows. Preserve and compare complete tuples for the selected sessions/chunks/candidates/attempts/intents and relevant authority. After all writes/triggers, rederive the subject population and compare its membership plus required tuples/addresses to the captured expectation. That catches the demonstrated selected-asset restoration, selected-candidate tampering, suppressed writes, and newly inserted same-story phantom without reading every unrelated story body. Continue to keep full before/after database snapshots in the native harness as the independent oracle for unexpected side effects. Add a focused check showing that unrelated content growth does not increase the RPC's JSON snapshot work. A global full-row oracle should be retained only if a concrete additional invariant requires it and its cost is bounded.

**Exact measured scene:** embedded below in “I2 native evidence”; that section of this file is the review evidence artifact.

## Verified evidence and accepted behavior

- Recomputed all nine `task-1-hashes.json` entries: all match current bytes. Independently reconstructed every changed file by applying `task-1.patch` in memory to the immediate `before/` snapshot: all nine equal current files. No branch-diff substitution.
- Patch SHA256: `ee67d6361c874be7bab95ffa0bf60190fdc560b7bcda7dd59d395058b0d425f2`. Hash-manifest SHA256: `064e6101c4b510ebd61ae29bb2521d113d7cf783e632e3e3b7f45c10f6cdb629`.
- Final native report `docs/research/evidence/2026-11-06-g1-deletion-capture/native-1793933441582-fe7a1fb8-a48d-4eeb-a951-44b927a4c52b/results.json` SHA256 is `d2545095a2b8adbc7623dc533788183ba876d8d29f8f0aadc8b748bd30d21531`. Every source hash recorded there matches current bytes, including the unchanged recording migrations and actual application adapter.
- Inspected the actual scenario code and retained rows: 14 scenario groups, 647 assertions, 54 observations, and eight lock waits. Published/pending candidate and multichunk captures use real recording RPCs. Scope controls retain full sibling rows. All twelve rollback injections preserve the complete before/after snapshots, including synthetic bytes. Tampered/missing-target replay rejects without writes. Same-ID and new-ID subject replay preserve full rows. The test count is not treated as 647 independent cases.
- The eight waits have real blocking backends and ungranted relation locks: publication/delete and reservation/delete on `deletion_requests`; two captures/collision on the same table; revocations on `projects` and `project_roles`; subject rebinding on `stories`. The reserve overlap waits on the existing deletion fence. It should not be interpreted as independent evidence that a bare source-table writer was the blocking lock.
- Current owner/facilitator authorization is read after the locks. Direct anon/authenticated/metadata-reader calls fail even when they spoof a service-role claim. Existing project/session/story/asset blockers, cross-project candidate/chunk relationships, unsafe addresses, and physical aliases into unselected chains are checked. No additional confirmed auth defect found.
- New-request write validation compares complete expected tuples after all immediate writes/triggers. Cancellation sets only `cancel_requested_at` for unfinished jobs and preserves live attempts, leases and candidate evidence. Actual publication and confirmation refuse captured chains.
- The authenticated request-read observation uses the foundational RLS policy and exposes only the receipt metadata/digest/count; candidate coordinates remain in unreadable `deletion_targets`. Closed application receipts contain no paths and cannot report physical completion.
- The adapter validates primitive identity, subject scope, closed receipt shape, timestamps/counts and physical-deletion status; uses one bounded no-retry RPC; and provides no table-write fallback on timeout, abort or lost result. Returning the original durable ID on subject replay with a newly generated request ID is consistent with the parent's recorded ruling.
- Inspected the archived focused Jest, root ESLint and typecheck results and verified their `.log.gz` SHA256 values. All owned TypeScript files match those recorded runs. Jest log reports 2 suites / 45 tests passed; root ESLint and both workspace typechecks exited 0. These were not rerun.
- Staging remains empty. Review made no Git changes, remote calls, paid calls, physical removals or changes to implementation/evidence files. Only this report is written. Its local diagnostic databases were stopped and removed with zero remaining clients/errors.

## I1 native evidence

Reviewer ran `node --input-type=module` from the repository root using `Harness` in `experiments/pg17-routines/runtime.mjs`, `setup/capture` in the Task 1 fixture, `compileModules` from the recording-worker fixture, and `save/METADATA` from the recording-flow fixture. No comprehensive harness rerun occurred.

Exact execution sequence:

1. Start isolated PostgreSQL 17.4, apply the same actual foundation table DDL and recording migrations through Task 1 `setup`.
2. Connect as actual `service_role`; use the synthetic project owner `22222222-2222-4222-8222-222222222222` for capture and the existing active storyteller `11111111-1111-4111-8111-111111111111` for the reserved recording.
3. Call actual `recording_story_save` with `action='reserve'`, a fresh session UUID and existing `METADATA`; take its returned `storyId`.
4. Compile/use actual `prepareRecordingSessionSeal` with one chunk containing `Buffer.from('sealed-before-register')`, its actual byte length/SHA256, bucket `audio-recordings`, and `projects/<project>/sessions/<session>/0` object key.
5. Construct the actual schema-version-1 manifest from that prepared asset ID and chunk, with `storageObjectKey = <storyteller>/<objectKey>`. Call and commit `SELECT seal_recording_manifest($1::jsonb)`.
6. Do not invoke asset/job registration. Invoke `capture(service, {subjectId: storyId, requestId: randomUUID()})`.

Observed output:

```json
{
  "scenario": "Actual reserve and seal completed, registration not started",
  "before": {"sessions":"1","chunks":"1","assets":"0","jobs":"0","requests":"0","targets":"0"},
  "outcome": {
    "code":"23505",
    "message":"Deletion source identity conflict",
    "where":"PL/pgSQL function public.request_media_deletion(uuid,uuid,uuid,text,uuid) line 115 at RAISE"
  },
  "after": {"sessions":"1","chunks":"1","assets":"0","jobs":"0","requests":"0","targets":"0"},
  "cleanup":{"clusterStopped":true,"tempDirectoryRemoved":true,"clientsRemaining":0,"errors":[]}
}
```

The counts above describe the reproducing state; they are not claimed to replace the full-row rollback oracle in the original native suite. This diagnostic establishes rejection of an untampered legal source state, not a new successful-capture or rollback qualification.

## I2 native evidence

Reviewer ran a separate minimal `node --input-type=module` diagnostic with the same fresh local PG17 setup, two actual `service_role` backends and one observer. Every target story and the unrelated story was created using actual `recording_story_save(..., 'reserve', METADATA)`; no sessions/assets/jobs were registered. For each sample, reserve a new empty target story, then change only the unrelated story using:

```sql
UPDATE stories SET content = repeat('x', :bytes) WHERE id = :unrelated_story;
```

`:bytes` was `0`, `8*1024*1024`, then `32*1024*1024`. Measure `performance.now()` around the actual capture call. For the last sample, observe the capture backend's granted `ShareRowExclusiveLock` on `stories`, dispatch `UPDATE stories SET title=title WHERE id=:unrelated_story` on the second backend, and record its actual lock wait and completion time. All captures returned valid requested receipts with `targetCount=1` and `physicalDeletionComplete=false`.

Exact diagnostic values:

```json
[
  {"unrelatedStoryBodyMiB":0,"elapsedMs":12,"targetCount":1},
  {"unrelatedStoryBodyMiB":8,"elapsedMs":198,"targetCount":1},
  {
    "unrelatedStoryBodyMiB":32,
    "elapsedMs":964,
    "targetCount":1,
    "writerBlockedMs":965,
    "writerWait":{
      "wait_event_type":"Lock",
      "wait_event":"relation",
      "blockers":[39234],
      "lock":[{"relation":"stories","mode":"RowExclusiveLock","granted":false}]
    },
    "receiptId":"cfa85534-ff2d-42f1-ac6a-3edc02b4fcb9",
    "tombstoneAt":"2026-11-06T03:00:25.975221+00:00"
  }
]
```

Cleanup: `{"clusterStopped":true,"tempDirectoryRemoved":true,"clientsRemaining":0,"errors":[]}`. The diagnostic deliberately used synthetic repetitive text, no family content. It makes no memory-peak estimate and no production SLA claim.

## Scope limits and handoff

Task 2 backup compatibility and the parent-owned final repository gate remain outside this Task 1 review. Hosted PostgREST/Storage, full migration-chain rehearsal, physical GC/removal, throughput qualification, backup-ledger qualification and G1/push qualification remain unproven. These existing limits are not additional review findings. Re-review I1 and I2 against the repaired implementation and native regressions before approving Task 1.
