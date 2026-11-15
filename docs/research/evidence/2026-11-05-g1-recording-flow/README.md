# G1 recording workflow evidence

Current status: the corrected final source passed the full gate and three refreshed integrations; whole-change review and the scoped final correction review are complete and Approved. G1/device/cloud qualification remains false. No commit, push, deployment, remote migration, paid API or family material.

## Final source and repository gate

- [Complete command, exit code and 903 before/after source fingerprints](final-gate-02.json), [compressed complete output](final-gate-02.log.gz): type-check/lint, Web159 suites/3204 tests, build184 pages,shared4/16,infra20 all passed. Configuration warnings are retained and do not establish production availability.
- [Source lock](source-lock-02.json) and [938 measured final source inputs](verified-source-02.tar.gz), including application/test/SQL/fixture sources and manifests. The gzip/tar archive contains ordinary relative-path source files, not runtime secrets or recorded family content.
- [Known generated next-env line restored](next-env-restoration-02.json).
- [Final integrity](integrity-final-02.json):4477 prior evidence files unchanged,1360 takeover inputs preserved except explicitly authorized changes,HEAD/index unchanged,staged diff empty,diff check passed. All 167 pre-fix evidence files remain unchanged or have an exact preserved pointer snapshot.

## Selected final native integration

[Final validation manifest](candidate-validation-02.json) pins the three result files and their hashes. Earlier successful runs remain historical; these runs match the final worker source and corrected confirmation SQL.

| Run | Assertions | Boundary and outcome |
| --- | --- | --- |
| [Ordinary browser](integrated-browser-1793929758961-97783f87-95d8-42ed-a730-278bccd1166d/results.json) | 310 | Native recording,complete/reload/recover/save,actual host+SQL+FFmpeg,actual player advancement,IDB cleanup abort/retry,mobile geometry |
| [Interrupted browser](interrupted-browser-1793929758962-7260df22-824e-4ab0-98f1-b5fb43391537/results.json) | 341 | Active capture flushed with native requestData then reloaded;offline/account-change;reserve/seal/confirm committed replies truncated;reload and duplicate save;playback/cleanup |
| [Server and host](integrated-server-1793929757727-7a493cbd-7e64-4219-95f3-d0aa3719e36a/results.json) | 723 | Actual route/SDK/SQL/FFmpeg;single story and full playback bytes;real wall-clock lease expiry,retry_wait versus outcome_unknown,invalid-row cursor,future work exclusion |

[Desktop screenshot](integrated-browser-1793929758961-97783f87-95d8-42ed-a730-278bccd1166d/saved-desktop.png) · [375px screenshot](integrated-browser-1793929758961-97783f87-95d8-42ed-a730-278bccd1166d/saved-mobile.png).

The actual UI,MediaRecorder,IndexedDB,WebCrypto,Web Locks,Next route implementations,Supabase SDK,SQL,queue host and FFmpeg execute. Auth/project-access transport,PostgREST/Storage HTTP and microphone are explicit synthetic/local boundaries. This does not prove cloud RLS/storage provisioning,physical devices,long recording or one-minute chunk timing. HTTP reply loss is represented by unusable truncated JSON after actual commit; resetting TCP before headers allowed Chromium to replay transparently, so that earlier fixture attempt did not force a lost result at the application boundary. All three selected runs completed temporary browser/server/database/directory cleanup. Assertion totals include database-role checks and can vary with polling; the named scenarios are the acceptance basis.

The original `final-gate-01`, `candidate-validation.json`, `source-lock.json` and `verified-source.tar.gz` remain intact as pre-fix evidence. [Pre-fix preservation manifest](pre-final-fix-evidence.json) pins the old records; they are not evidence for the corrected SQL.

## Focused native and review evidence

- Final confirmation correction: [native GREEN](native-1793929246225-f153d6c1-189c-460b-b827-6fb505ec038d/results.json) passed1091 assertions with88/88 corruptions returning409,no receipt and exactly unchanged full story/intent rows. Real2/3-attempt confirmation/replay and early-AD/Taipei controls pass. [Saved-SQL RED](native-before-final-fix-1793929111642-b22a4d0e-9647-4d33-9432-9654848bc4fd/results.json) captures35 committed-state failures across the same88 cases. [Fix validation](reviews/final-fix-validation.json), [patch](reviews/final-fix.patch) and [immediate baseline](final-fix-before/manifest.json) are preserved; focused207 tests/root ESLint pass.
- Task1 initial delivery:169 focused tests and130 native assertions; atomic confirmation refuses six corrupt lineage cases before any story/intent change. [Report](reviews/task-1-report.md), [initial findings](reviews/task-1-review.md), [fix review Approved](reviews/task-1-fix-1-review.md).
- Task2:110 host/terminal/lease tests,6 CLI cases and offline real-FFmpeg readiness. [Report](reviews/task-2-report.md), [review Approved](reviews/task-2-review.md). The final native runs above supersede the report's earlier integration-source caveat.
- Task3:117 focused tests,15 native scenarios. Final actual flow digest counts4/8/16=>24/48/96;three late raw-Blob mutations refused;exact confirmation-put rollback;cleanup rollback and cross-tab locks. [Report](reviews/task-3-report.md), [initial findings](reviews/task-3-review.md), [fix review Approved](reviews/task-3-fix-1-review.md). [Archived native test source fingerprints](task-3-native-source/source-lock.json); run the archived verify-task-3-db.cjs from repo root with existing dependencies to reproduce it.
- [Final Task4 controller report](reviews/task-4-final-report.md). [Initial whole-change finding](reviews/final-review.md), [correction report](reviews/final-fix-report.md), and [scoped final review Approved](reviews/final-fix-review.md) preserve the complete review outcome.

All intermediate failures,RED logs and fixture corrections are retained. They are not counted as passing evidence. [Current user-operation report and remaining G1 gaps](../../2026-11-06-g1-recording-flow.md) is the human-facing handoff; [final receipt](verification.json) records the final review state and limitations.
