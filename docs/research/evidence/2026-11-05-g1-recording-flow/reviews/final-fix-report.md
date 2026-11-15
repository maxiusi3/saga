# Final-review I1 confirmation consistency fix

Status: implementation and focused verification complete; source, fixture and experiment README frozen for parent full-gate/integration refresh and scoped re-review.

Only the final-review I1/P2 mismatch was corrected. The independent application validator and cleanup receipt contract are unchanged. No staging, commits, push, deploy, remote database, paid API, family data, or broad repository gate was performed by this fix agent. HEAD remains `c0669e8058343f91deba8e468b03e4bf817b1ca5`; the staged diff is empty. Inherited changes were preserved.

## Finding mapping

| I1 requirement | Implementation and native evidence |
| --- | --- |
| Historical worker/provider/request/usage/cost parity | One ordered pre-DML loop validates every attempt, including the latest. It requires a valid worker identifier and null provider, provider_request_id, usage_units, reserved_cost_usd and settled_cost_usd. The native suite mutates all historical positions (2/1, 3/1, 3/2), with malformed/empty/129-character worker values and zero non-null usage/cost values: 24 cases. All 24 wrote ready rows before this fix; all now reject before DML. |
| Exact numbering | Existing count check plus explicit ordered expected numbers 1..attempt_count; rejects out-of-range rows. Five native cases cover 2,3 for count=2; 2,3,4 for count=3; missing historical row; missing latest row; and extra row 4. The first two were RED committed writes. Positive/unique numbering constraints remain enabled. |
| Historical order | Preserve microsecond comparisons from job.created_at through each predecessor finish to latest dispatch. Historical retries must also finish after seal, before latest dispatch, remain undispatched, and retain the exact retryable state/error. Nine native cases cover before-job, reversed predecessor order, after-dispatch, before-seal, missing/non-finite finish, dispatched history, wrong state and wrong retry code. Before-job and reversed-history cases were RED committed writes. |
| Finite UTC-compatible timestamps | Before DML, check all required session/asset/job/latest-attempt/candidate timestamps, every historical finish and every chunk persistence time. Required values must be finite and within AD 0001 inclusive to AD 10000 exclusive. The routine already uses UTC; PostgreSQL cannot serialize year zero as the application's four-digit AD timestamp. Twelve timestamp columns each receive -infinity, infinity, finite BC and year 10000 mutations (48 cases); two finite ordered candidate-pair cases retain candidate schema CHECKs. Seven time-domain cases were RED committed writes. |
| Actual controls and rollback | Every corruption control first passes lookupRecordingStorySave against the compiled real application graph. Valid two-/three-attempt controls use real claims, actual 1000ms PostgreSQL-clock expiry, recovery, latest start, candidate reserve/prepare and finalize routines; confirm/replay uses confirmRecordingStorySave. Full PostgreSQL JSON rows retain all columns and microseconds. No receipt plus exact story/intent equality is required for every corruption. |
| Existing coverage and evidence | Existing reservation/publication, canonical-identity corruption, access, deletion and lock-wait scenarios remain. Current tests run against saved SQL with --before-final-fix (separate from --before-fix-1), collecting all 88 corruption observations before aggregate assertions. Old evidence was not overwritten. |

## Exact amended files and SHA-256

| Path | SHA-256 |
| --- | --- |
| `supabase/migrations/20261106000001_recording_story_save.sql` | `20ba20cdda0ec79c997cf1a0eafc38e7d7c022ad95b6146e7658d4208b8d5569` |
| `experiments/pg17-recording-flow/fixture.mjs` | `b579bef2d0532e0e517d9b1dc37979c7448e90c39305e1b725cd615c0e201571` |
| `experiments/pg17-recording-flow/verify.mjs` | `3437b3daa303eb5a8b5f1663108f3cdd80dff8a29635ef1d0611c2f8e6d90aad` |
| `experiments/pg17-recording-flow/README.md` | `44bb9b56308103b5baaa6f013665a7a5ba77c918f768f3f16067ae15bd96b100` |
| `experiments/pg17-recording-flow/confirmation-regressions.mjs` | `d49526fc2fa796348ac3b8a69b5cf2f1504b850e8111f91d6273f87a2c387703` |

The immediate pre-fix bytes of the four existing files are in `final-fix-before/`, with their original hashes in `final-fix-before/manifest.json`; the new regression module is recorded there as a new file. `final-fix.patch` is against these bytes, not repository HEAD. `git apply --check`, application into an isolated temporary directory, and all five post-apply file hashes verified the patch round trip. That temporary directory was removed.

## RED/GREEN commands and observed rows

Commands ran from the repository root. Logs are retained verbatim under this report directory.

```sh
node experiments/pg17-recording-flow/verify.mjs --before-final-fix > .superpowers/sdd/2026-11-05-upgrade-g1-recording-flow/final-fix-red-01.log 2>&1
node experiments/pg17-recording-flow/verify.mjs > .superpowers/sdd/2026-11-05-upgrade-g1-recording-flow/final-fix-green-01.log 2>&1
```

| Observation | RED: saved pre-fix SQL | GREEN: final SQL |
| --- | --- | --- |
| Process exit / assertions | Expected exit 1 / 826 | Exit 0 / 1,091 |
| New corruption cases collected | 88 | 88 |
| SQL conflict / application 409 | 53 | 88 |
| Committed ready story + confirmed intent, then application 503 | 35 | 0 |
| No cleanup receipt | 88 | 88 |
| Full story and intent rows unchanged | 53 | 88 |
| Valid real 2/3-attempt confirmation and replay | Pass | Pass |
| Early AD microsecond timestamp / Asia-Taipei caller control | Pass | Pass |

The RED failure is the expected assertion `every corruption rejects with no receipt and exact story/intent equality`, after all observations were collected. It is not a migration/compiler/setup failure. The 35 failures comprise 24 historical-field cases, two out-of-range numbering cases, two historical ordering cases, and seven time-domain cases: asset.created_at=-infinity/BC; job.created_at=-infinity/BC (asset moved with it to preserve relative order); session.started_at=BC; chunk.persisted_at=-infinity/BC.

Each result contains `confirmationConsistency.controls`, `rejections` (baseline, corrupted snapshot, actual lease transitions, before/after full rows, status and receipt), `violations` and `summary`. Both clusters stopped, temporary directories were removed, no clients remained, and cleanup errors were empty. Every common RED/GREEN source hash is equal; the only tested implementation difference is saved versus final SQL. Every GREEN recorded source hash was rechecked against current files.

RED result: `docs/research/evidence/2026-11-05-g1-recording-flow/native-before-final-fix-1793929111642-b22a4d0e-9647-4d33-9432-9654848bc4fd/results.json`.

GREEN result: `docs/research/evidence/2026-11-05-g1-recording-flow/native-1793929246225-f153d6c1-189c-460b-b827-6fb505ec038d/results.json`.

## Focused application tests and static checks

Covering test files:

- `experiments/pg17-recording-flow/confirmation-regressions.mjs` — new native history/time regressions and positive controls.
- `experiments/pg17-recording-flow/verify.mjs` — preserved reservation, authorization, publication, canonical identity, deletion and concurrency scenarios.
- `packages/web/src/lib/server/__tests__/recording-story-save.test.ts` — existing strict confirmation/receipt behavior.
- `packages/web/src/lib/server/__tests__/recording-session-status.test.ts` — existing independent strict chain validation.

```sh
npm test --workspace=packages/web -- --runInBand src/lib/server/__tests__/recording-story-save.test.ts src/lib/server/__tests__/recording-session-status.test.ts > .superpowers/sdd/2026-11-05-upgrade-g1-recording-flow/final-fix-jest-01.log 2>&1
./node_modules/.bin/eslint --config eslint.config.cjs experiments/pg17-recording-flow/fixture.mjs experiments/pg17-recording-flow/verify.mjs experiments/pg17-recording-flow/confirmation-regressions.mjs > .superpowers/sdd/2026-11-05-upgrade-g1-recording-flow/final-fix-eslint-01.log 2>&1
node --check experiments/pg17-recording-flow/confirmation-regressions.mjs
node --check experiments/pg17-recording-flow/fixture.mjs
node --check experiments/pg17-recording-flow/verify.mjs
git diff --check
git diff --cached --name-only
```

Jest: exit 0, 2 suites / 207 tests passed. Root canonical ESLint: exit 0, empty output. Node syntax checks: exit 0. Diff check: exit 0; staged paths: none. Native compileFlow transpiled the actual confirmation-service graph, and native setup executed final SQL on PostgreSQL 17.4; no separate broad build/type-check gate is claimed.

## Artifact hashes

`final-fix-validation.json` records commands, exits, summary counts, result paths, source parity and patch verification. Artifact SHA-256 values:

| Artifact | SHA-256 |
| --- | --- |
| `.superpowers/sdd/2026-11-05-upgrade-g1-recording-flow/final-fix-red-01.log` | `48b1aca2b846c364a43dd86f32019533fd43dcf836c93dd63d25056eeb14f8b6` |
| `docs/research/evidence/2026-11-05-g1-recording-flow/native-before-final-fix-1793929111642-b22a4d0e-9647-4d33-9432-9654848bc4fd/results.json` | `b7f7475ae076603888d066b696d4c9f650c1c285c361494ca226eda678942785` |
| `.superpowers/sdd/2026-11-05-upgrade-g1-recording-flow/final-fix-green-01.log` | `ac889b3d4548bbd41a85e848c62b7a7b15ea42bf40312bd8a4dad050ed34f564` |
| `docs/research/evidence/2026-11-05-g1-recording-flow/native-1793929246225-f153d6c1-189c-460b-b827-6fb505ec038d/results.json` | `6ecf8308b60d770cc28bbbb1a87d400a5eb8eb2a8dedee68eebdfb55dcf7e58d` |
| `.superpowers/sdd/2026-11-05-upgrade-g1-recording-flow/final-fix-jest-01.log` | `09350c51696af858d8d066608356c56df141d5cca6033fbb5cc713323d7f539e` |
| `.superpowers/sdd/2026-11-05-upgrade-g1-recording-flow/final-fix-eslint-01.log` | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| `.superpowers/sdd/2026-11-05-upgrade-g1-recording-flow/final-fix.patch` | `1f665b4f2e8bfef013f3adb3dbb1776be00b3c4ddd0c6743e423bfc793c869a9` |
| `.superpowers/sdd/2026-11-05-upgrade-g1-recording-flow/final-fix-hashes.json` | `f67d4401d6f5de1c5e12a1f015cb25e25f19fd6ac1b42c3b879ab87787be411e` |
| `.superpowers/sdd/2026-11-05-upgrade-g1-recording-flow/final-fix-before/manifest.json` | `6bd803e28b1e77fd31528594cffb7f78ba54b951312c5d8add454a7d3b5a88bf` |

## Remaining boundaries

The local fixture uses actual bootstrap story DDL and actual recording schema/migrations, plus synthetic auth/project/Storage prerequisites. Its RPC adapter reaches real SQL through an unprivileged service_role connection and returns raw JSON to the actual application service; it does not claim HTTP/PostgREST/network fidelity. Real lease expiry and history construction do not require audio decoding. Candidate table finite/order CHECKs, attempt number positivity/uniqueness, primary keys and NOT NULL constraints stay enabled; tests do not disable them to manufacture impossible rows. Candidate BC/five-digit cases mutate an ordered pair because independent mutations may be stopped by the schema.

Cloud/device/long-capture, full migration-chain rehearsal, deletion/GC/backup and G1 qualification remain open. Parent owns full gate 02, frozen archive/evidence refresh and final integration. This report does not qualify merge, push or deployment.

Timestamp semantics checked against PostgreSQL documentation: [date/time functions](https://www.postgresql.org/docs/current/functions-datetime.html) (`isfinite`) and [date/time types](https://www.postgresql.org/docs/current/datatype-datetime.html) (BC/AD range, infinities and microsecond resolution).
