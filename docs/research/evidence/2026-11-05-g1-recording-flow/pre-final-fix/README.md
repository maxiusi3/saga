# G1 recording workflow evidence

Current status: final source passed all required local checks; final whole-change review is in progress. G1/device/cloud qualification remains false. No commit, push, deployment, remote migration, paid API or family material.

## Final source and repository gate

- [Complete command, exit code and 902 before/after source fingerprints](final-gate-01.json), [compressed complete output](final-gate-01.log.gz): type-check/lint, Web159 suites/3204 tests, build184 pages,shared4/16,infra20 all passed. Configuration warnings are retained and do not establish production availability.
- [Source lock](source-lock.json) and [937 measured final source inputs](verified-source.tar.gz), including application/test/SQL/fixture sources and manifests. The gzip/tar archive contains ordinary relative-path source files, not runtime secrets or recorded family content.
- [Known generated next-env line restored](next-env-restoration.json).
- [Pre-final-review integrity](integrity-before-final-review.json):4477 prior evidence files unchanged,1360 takeover inputs preserved except explicitly authorized changes,HEAD/index unchanged,staged diff empty,diff check passed.

## Selected final native integration

[Candidate validation manifest](candidate-validation.json) pins the three result files and their hashes. Earlier successful runs remain historical; these are the runs matching the final worker-source hash.

| Run | Assertions | Boundary and outcome |
| --- | --- | --- |
| [Ordinary browser](integrated-browser-1793901807013-361344fb-b612-4171-8cbf-b399291156da/results.json) | 297 | Native recording,complete/reload/recover/save,actual host+SQL+FFmpeg,actual player advancement,IDB cleanup abort/retry,mobile geometry |
| [Interrupted browser](interrupted-browser-1793901807026-1863cacc-16d9-4739-8c5e-0f29c67b5756/results.json) | 329 | Active capture flushed with native requestData then reloaded;offline/account-change;reserve/seal/confirm committed replies truncated;reload and duplicate save;playback/cleanup |
| [Server and host](integrated-server-1793901806798-86cf43f9-38f6-4412-9dab-b2f6658ed151/results.json) | 723 | Actual route/SDK/SQL/FFmpeg;single story and full playback bytes;real wall-clock lease expiry,retry_wait versus outcome_unknown,invalid-row cursor,future work exclusion |

[Desktop screenshot](integrated-browser-1793901807013-361344fb-b612-4171-8cbf-b399291156da/saved-desktop.png) · [375px screenshot](integrated-browser-1793901807013-361344fb-b612-4171-8cbf-b399291156da/saved-mobile.png).

The actual UI,MediaRecorder,IndexedDB,WebCrypto,Web Locks,Next route implementations,Supabase SDK,SQL,queue host and FFmpeg execute. Auth/project-access transport,PostgREST/Storage HTTP and microphone are explicit synthetic/local boundaries. This does not prove cloud RLS/storage provisioning,physical devices,long recording or one-minute chunk timing. HTTP reply loss is represented by unusable truncated JSON after actual commit; resetting TCP before headers allowed Chromium to replay transparently, so that earlier fixture attempt did not force a lost result at the application boundary. All three selected runs completed temporary browser/server/database/directory cleanup. Assertion totals include database-role checks and can vary with polling; the named scenarios are the acceptance basis.

## Focused native and review evidence

- Task1:169 focused tests and130 native assertions; atomic confirmation refuses six corrupt lineage cases before any story/intent change. [Report](reviews/task-1-report.md), [initial findings](reviews/task-1-review.md), [fix review Approved](reviews/task-1-fix-1-review.md).
- Task2:110 host/terminal/lease tests,6 CLI cases and offline real-FFmpeg readiness. [Report](reviews/task-2-report.md), [review Approved](reviews/task-2-review.md). The final native runs above supersede the report's earlier integration-source caveat.
- Task3:117 focused tests,15 native scenarios. Final actual flow digest counts4/8/16=>24/48/96;three late raw-Blob mutations refused;exact confirmation-put rollback;cleanup rollback and cross-tab locks. [Report](reviews/task-3-report.md), [initial findings](reviews/task-3-review.md), [fix review Approved](reviews/task-3-fix-1-review.md). [Archived native test source fingerprints](task-3-native-source/source-lock.json); run the archived verify-task-3-db.cjs from repo root with existing dependencies to reproduce it.
- [Task4 controller report](reviews/task-4-report.md). Final whole-change review will be archived alongside these reports.

All intermediate failures,RED logs and fixture corrections are retained. They are not counted as passing evidence. [Current user-operation report and remaining G1 gaps](../../2026-11-06-g1-recording-flow.md) is the human-facing handoff; [final receipt](verification.json) records the final review state and limitations.
