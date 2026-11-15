# G1 whole-story deletion evidence

- [Final receipt](verification.json), [independent review](review.md), [source manifest](source-manifest.json), [archived source](source.tar.gz).
- [Native complete schema + actual product Chrome, 241 assertions](../2026-11-07-g1-chrome/migrations-1794225437686-989f6d06-1df3-4c07-b245-010145d2175a/results.json), [before](../2026-11-07-g1-chrome/migrations-1794225437686-989f6d06-1df3-4c07-b245-010145d2175a/chrome-story-before.png), [after reload](../2026-11-07-g1-chrome/migrations-1794225437686-989f6d06-1df3-4c07-b245-010145d2175a/chrome-story-after.png).
- [Actual complete migration/backup restore, 493 assertions](../2026-11-07-g1-chrome/migrations-1794225801813-9ca27747-b443-41b7-ad29-94a9e5ecb52c/results.json). Backup artifacts remain together with the original run.
- [Independent native, 205 assertions](review-native.json), [extra probes, 93 assertions including the base checks](review-probes.json), [probe script](review-probes.mjs).
- [Full project gate](final-verify.log), [shared](shared.log), [infra](infra.log), [final targeted checks](final-targeted.log).
- Initial fixture/setup failures are retained in red.log, client-red.log, native-initial.log and native-2/3 logs. They are not described as behavioral TDD proof. [Late unprovenanced cluster behavioral RED](late-cluster-red.log) and [independent withdrawal regression RED](review-withdraw-red.json) are the actual defect reproductions. [Fixed full flow](withdraw-fix.log).

No human-waived item is marked executed. G1 local acceptance follows the user's Chrome Web criterion; provider backend deletion and hosted/mobile qualification remain explicit follow-up boundaries. Previous reports, logs and source archive have been checked by hash and remain unchanged.
