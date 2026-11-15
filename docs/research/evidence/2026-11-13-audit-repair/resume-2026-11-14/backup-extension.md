# Task 5 native backup integration report — 2026-11-14

Scope: delegated backup/restore integration for the new AI edit and hosting reminder durable records. This report does not claim completion of the parent's complete Task 5 audit, manifests, unit tests, or external acceptance gates.

## Changes

- `experiments/g1-local/backup-rehearsal.mjs`: records and invokes the new helper before the existing G3 snapshot, after restoration, and after post-freeze story deletion replay. Carries an additional exact project tombstone into the restored database before reminder scheduling.
- `experiments/g1-local/durable-records-backup.mjs`: creates real `story_review` and `story_ai_edit` RPC state, including a family-approved completed AI draft and a retained reviewing attempt with a previously approved baseline. Creates synthetic paid/allocated projects and real reminder scheduler/permit RPC records in `sent` and `unknown` states.
- No modifications to `g3-backup.mjs`, `verify-migrations.mjs`, migrations, application production code, dependencies, or global manifests. No staging, commits, pushes, remote migrations, deployments, external provider calls, or real notifications.

## New coverage

The real custom-format dump restores exact rows for `story_ai_edit_requests`, `story_revisions`, `story_assertions`, `transcript_versions`, `transcript_segments`, `consent_records`, `hosting_reminders`, and their `notifications`.

Restoration preserves source hashes/fingerprints, transcript and revision identities, expected edit versions, model/policy/consent bindings, AI lease tokens and completed evidence; reminder expiry/version identity, station delivery, email token, unknown state, and synthetic receipt are preserved too.

Actual restored RPCs reject a wrong AI lease, reject repeated reviewer dispatch, and reject completing against changed transcript or revision. An unchanged pending request can complete with its original lease. Source/CAS mutation probes and successful completion run inside rolled-back transactions so the survivor can be compared exactly afterward.

Actual restored reminder RPCs reject a wrong completion token, keep unknown outbound state from becoming a new send permit, and cancel authorization on an expiry-version change. Exact post-freeze story capture removes AI requests/drafts/assertions; old completion cannot resurrect them. Exact post-freeze project tombstone removes reminder/notification/receipt state, cancels a late callback, and prevents scheduler reissue. The unrelated AI and reminder records remain exactly unchanged.

## Verification

Command (run outside the sandbox because macOS shared-memory creation is denied inside it):

```sh
node experiments/g1-local/verify-migrations.mjs --backup > /tmp/saga-task5-backup-3.log 2>&1
node --check experiments/g1-local/durable-records-backup.mjs
node --check experiments/g1-local/backup-rehearsal.mjs
git diff --check
```

All exited 0. Report-derived results:

- Native PostgreSQL 17.4, bootstrap + 40 migrations = **41 files**, **597 assertions**.
- Main report, backup, new durable-record subsection, and existing G3 publication replay: **passed**.
- Installed Chrome **157.0.8103.78** played the unrelated restored original recording.
- `sourceDrift: []`.
- Cleanup: cluster stopped; temporary directory removed; zero clients remaining; no cleanup errors.

Evidence directory:

`docs/research/evidence/2026-11-07-g1-chrome/migrations-1794639820529-32be6d09-7343-4882-81f2-ab998ebdd963/`

Relevant artifacts: `results.json`, `database.dump`, `dump-toc.txt`, `durable-records-before-freeze.json`, `post-freeze-reminder-project-tombstone.json`, `post-freeze-tombstones.json`, `storage-manifest.json`, publication volume manifest/copies, backed-up and surviving restored object bytes, and `restored-chrome.png`.

Source SHA-256:

```text
bf5ae0c7d83d92e1de1d0af49bb59d1d7212606720996b9e8cc3bf03b7e798c3  experiments/g1-local/backup-rehearsal.mjs
420b120d51f3e061c5890940bc1c8f1de71740b99bc5fba1d5484c7018148dec  experiments/g1-local/durable-records-backup.mjs
```

## Failures resolved and boundaries

The first sandbox attempt failed at `initdb` shared-memory allocation (`shmget: Operation not permitted`); it reached no migrations. The first native fixture run hit the existing archive guard `Reviewed story has no approved rendition`; the fixture was corrected to obtain family approval via the actual RPCs. The second native fixture run reached the new project tombstone insertion but failed PostgreSQL UUID/text parameter inference (`42P08`); explicit UUID-to-text casting corrected the fixture. All unique failed evidence directories remain; native failed logs remain at `/tmp/saga-task5-backup.log` and `/tmp/saga-task5-backup-2.log`.

No production defect was found by the final run. AI responses, payment allocation, and email receipts are explicitly synthetic. Project-scope tombstone insertion uses the existing maintenance contract: production `request_media_deletion` currently captures only stories/media assets, so this is not a project-deletion UI/API acceptance claim. The existing backup boundary remains quiesced local writers, native PG dump/restore, local object and private publication spool copies. Hosted Supabase Storage recovery, live-provider quality/delivery, and operator/human gates remain outside this test.
