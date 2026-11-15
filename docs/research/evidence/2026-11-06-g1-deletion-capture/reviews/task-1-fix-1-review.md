# Task 1 fix round 1 — scoped independent re-review

Date: 2026-11-06. Scope: I1, I2 and regressions introduced by their fix. Reviewed the patch against `task-1-fix-1-before/`; did not substitute a branch diff or rerun the broad test suite.

**Scoped Spec: Approved. Scoped Quality: Approved.**

**I1: Approved / resolved. I2: Approved / resolved.** No new Critical, Important or Minor findings within this fix scope. The prior Task 1 review's two must-fix findings are closed by these frozen bytes and the verified evidence below. Parent-owned Task 2 and final repository gates remain outstanding.

## I1 — legitimate seal-before-registration window

The migration now accepts an absent, well-formed intended asset for a session bound to the requested story (`supabase/migrations/20261106000002_media_deletion_capture.sql:131–145`). It still rejects an existing intended asset outside the selected project/story, with a different owner/kind, or claimed by another session. Actual target generation continues to read only persisted media-asset, chunk and candidate coordinates (lines 173–184), so accepting the absent intended asset does not invent its row, object address, target or job.

Verified the original-SQL RED and final default native run directly:

- RED `native-fix1-red-1793934408307-49608342-392c-4f02-bf36-8f2fa50622b9/results.json` records the untampered reserve → seal → capture scene rejecting with `23505: Deletion source identity conflict`; its intended asset is absent. SHA256: `e5918851eacfe61288920f5d869ff5391cd12a935edac9b527328d1333c0130d`.
- Final `native-1793934773961-cfab3e45-06f7-4191-a5a7-436dae09ca50/results.json` records the sealed-only story returning three targets (story metadata and two real chunks), and the mixed registered/published plus sealed-only story returning six targets. Independently reconstructed these coordinate sets from the full before rows, rather than trusting target counts or the fixture's expected list. Checked pending target states, null errors, request timestamps, exact selected-asset transitions and unchanged full evidence tuples.
- Neither positive case creates the unregistered intended asset/job. The regression uses the real reserve/seal routines and passes `register=false` only after actual sealing; it does not fabricate a missing-registration state by deleting an existing asset.
- Both post-capture records show actual seal RPC rejection `23505` and the compiled actual seal route returning `409` with `Recording is being deleted`. Its recorded queries are limited to `project_roles`, `stories` and `deletion_requests`; no media-asset/job access or registrar mutation occurs. Entire before/after snapshots and synthetic bytes remain equal.
- All four existing-intended-asset negative cases—foreign project, story, owner and another session—reject with `23505` and identical full before/after rows.

The actual-route check substitutes synthetic auth/access and the local SQL transport, as documented. The added local service-role SELECT policy models existing hosted service-role read capability while retaining a NOBYPASSRLS test login; no production grants changed. Publication against the still-absent job also rejects. That particular missing-job result is not treated as proof of a publication tombstone fence; the original registered/pending-chain publication controls provide that evidence and remain passing.

## I2 — remove unrelated-content serialization while preserving checks

The global lock order is unchanged (migration lines 52–63). Runtime tuple snapshots now have explicit, fixed scope predicates for relevant authority, stories, assets, sessions, chunks, jobs, attempts, candidates, intents, blockers and the current request/targets (lines 200–231 and 282–289). Unrelated story bodies and historical target populations no longer enter those JSON aggregates.

After writes/triggers, separate queries rederive asset/job/session/candidate membership, including formerly absent intended assets, and recheck physical-address aliases (lines 249–280). Complete scoped tuple comparisons still detect changed or suppressed required rows. Selected chunk/attempt/intent population changes are also visible through their parent-scoped aggregate queries. This implements the requested narrower oracle without a table-lock architecture rewrite.

Verified both the corrected saved-SQL cost RED and frozen-SQL GREEN. Evidence paths below are under `docs/research/evidence/2026-11-06-g1-deletion-capture/`:

| Evidence | SHA256 | Result |
| --- | --- | --- |
| `snapshot-cost-red-1793934655909-9152134f-9065-4860-a17f-38c45ec61b5d/results.json` | `73adb9e4a11826fd55828148827e05d90024b5d61b513c94ca3339fb32c0e3dd` | Fails the intended zero-unrelated-body assertion |
| `snapshot-cost-1793934664953-d05261e9-a122-4da1-acbb-abb6c9a1edea/results.json` | `7d980a47d93b3fc15cf40284f1b886d9b4db2d0dd48f7a529d9404c545b624f2` | Passes |

| Unrelated body | Old serialized bytes / body calls | Fixed serialized bytes / body calls | Actual fixed RPC elapsed |
| --- | ---: | ---: | ---: |
| 0 MiB | 24,442 / 0 | 3,726 / 0 | 22.60 ms |
| 8 MiB | 33,597,924 / 4 | 3,726 / 0 | 11.54 ms |
| 32 MiB | 134,280,296 / 4 | 3,720 / 0 | 10.34 ms |

For each runner, verified all six compressed before/after artifacts against archive SHA256, decompressed SHA256 and byte counts. Parsed the actual rows, checked exact 0/8/32 MiB body lengths, full source tuple equality and exactly one new request/target per actual capture.

Independently reconstructed `serializer-probe.sql`: the measured probe differs from its source routine only by function name and the transparent `to_jsonb` substitution. Both wrapper and derived-routine hashes match. Actual elapsed times invoke the unmodified capture routine; serializer counts come from the separately identified diagnostic copy. The stronger evidence is zero unrelated-body serialization at all three sizes, not the noisy elapsed-time comparison. No throughput/SLA qualification is inferred.

## Regression and integrity verification

- Recomputed all **13** frozen source hashes: every file matches `task-1-fix-1-hashes.json`.
- Recomputed the nine original Task 1 hashes against `task-1-fix-1-before/`: the immediate baseline is intact. Applied the fix patch in memory to those bytes: all **eight** changed/new files exactly reproduce current contents.
- Fix patch SHA256: `379ca6e5d0034696ffbae65db3932f53ce91dc58a9b12a2807aa54c13be66ad9`. Fix hash-manifest SHA256: `15bf083797a2f4c7cfe09facda795d121a17261caa640674d6975ca63f1d78d5`.
- Final native result SHA256: `c294c6003a8ed9dce80c5332a3ea85303b28291ec0f14aec865502b24485df44`. Every recorded native source hash matches its current file, including actual route/dependency sources. The report contains **16 groups / 699 assertions**, including the original 14 groups and two I1 groups; counts are not treated as independent scenario counts.
- Independently checked all **12** retained trigger/failure-injection observations: non-success SQLSTATE and complete equality of before/after database rows and synthetic bytes. The original scenarios module remains byte-identical. All **eight** original lock waits still include actual blockers and ungranted locks.
- Checked the focused Jest, root ESLint and native syntax/whitespace result files plus both archive/raw log hashes. They record exit 0, no source drift, **2 suites / 45 tests**, and all seven native modules parsing. Application TypeScript files are unchanged from the prior successful typecheck.
- Reviewed only changed implementation and directly named integration seams. No broad reruns, extra agents, remote calls, paid calls, source edits or Git mutations were made. The only review output is this file.

## Remaining boundaries

Global source locks and discovery/alias scans still impose contention; their broader scalability is intentionally outside this fix. Client cancellation/lost-result ambiguity, noncooperating future Storage writes, physical removal/GC, hosted services, complete migration-chain rehearsal and G1/push qualification remain unproven. None is newly claimed by this approval. Proceed with Task 2 and the parent's required final gate.
