# Local G1 Chrome acceptance

Run from the repository root. Uses installed **Google Chrome** (`channel: chrome`), the existing pinned PostgreSQL fixture and `/usr/local/bin/ffmpeg`. Chrome receives a generated alternating-tone WAV through its native test microphone. `getUserMedia`, MediaRecorder, minute timeslices, IndexedDB, the recording page, route handlers, SQL and Worker are real. No real microphone or family material is needed.

```sh
# Short smoke; real-time long recording (2–1800 seconds)
node experiments/recording-flow-browser/verify-browser.mjs --chrome
node experiments/recording-flow-browser/verify-browser.mjs --chrome --seconds=300
node experiments/recording-flow-browser/verify-browser.mjs --chrome --seconds=1200
node experiments/recording-flow-browser/verify-browser.mjs --chrome --seconds=1800

# Interrupted native one-minute WebM recovery and fault matrix
node experiments/recording-flow-browser/verify-browser.mjs --chrome --seconds=65 --interruptions

# Supply results.json from a passed Chrome recording; verifies actual export
# handlers, role matrix, missing/corrupt originals, revocation, tombstones and
# a separate offline Chrome context opening the extracted archive by file URL.
node experiments/g1-local/verify-export.mjs /absolute/path/to/results.json

# One or more passed recording reports; strict full decode and tone continuity
node experiments/g1-local/verify-audio.mjs /absolute/path/to/results.json

# Separate PG17.4 build with real pgcrypto and uuid-ossp, macOS + Homebrew OpenSSL
sh experiments/g1-local/prepare-runtime.sh
node experiments/g1-local/verify-migrations.mjs

# Full migrated DB, actual custom dump/restore and object/tombstone replay
node experiments/g1-local/verify-migrations.mjs --backup

# Byte-preserving envelope proof and actual Chrome AI/save fault matrix
node experiments/g1-local/verify-webm-envelope.mjs
node experiments/g1-local/verify-ai.mjs
```

The isolated account set is owner, active storyteller, pending storyteller, removed member and family B owner. IDs and `example.test` addresses are written to each export report. These are local synthetic bearer identities, not GoTrue accounts; no real sign-in password is necessary. Project permission checks, membership changes and deletion checks run through production code against PostgreSQL. PostgREST HTTP and Storage bytes remain declared adapters. Direct hosted Storage/RLS and provider behavior are not qualified by this environment.

Every invocation writes a unique directory in `docs/research/evidence/2026-11-07-g1-chrome/` or `2026-11-07-g1-fixes/`. Successful recording reports retain every captured chunk and the published object, their hashes, database evidence, elapsed wall time, UI screenshots and source hashes. Export writes `archive.zip` and `offline/index.html`. The archive opens offline without a login. Backup mode retains a real `database.dump`, object manifest, backed-up/restored object bytes and the exact post-freeze deletion capture. Temporary PostgreSQL clusters and browser contexts close at the end; the reusable extension runtime stays under `/tmp/saga-g1-runtime`.

The interrupted envelope and missing historical-table failures are fixed; their original failure runs remain unchanged. See the [current report](../../docs/research/2026-11-07-g1-fixes-and-recovery.md). Envelope closure changes only the temporary decoding copy; the published recovered original retains every saved source byte. AI mode supplies synthetic browser captions and controlled provider HTTP outcomes while exercising the actual UI and save pipeline. Backup mode is an offline local maintenance rehearsal; online media deletion and API-visible late-writer reconciliation are now tested separately by `node experiments/pg17-deletion-execution/verify.mjs --chrome`. See [the current report](../../docs/research/2026-11-09-g1-deletion-execution.md) for the distinction between Storage API absence and backend-only orphans.


Whole-story product acceptance on the complete schema:

```sh
node experiments/g1-local/verify-migrations.mjs --story-deletion --chrome
```

This renders the production ProjectDetailClient/StoryCard/StoryService and calls
the actual deletion and project-list routes against native PostgreSQL. Auth and
non-story project/chapter responses are declared local transport substitutes.
The media worker uses separate Storage metadata and actual disk bytes. Native
scenarios cover purge/replay, direct and indirect late writes, publication/Wiki
copies, withdrawal compatibility and unrelated survivors. Backup mode now also
purges restored story and recording-intent prose after exact tombstone replay.
See [the latest G1 report](../../docs/research/2026-11-09-g1-story-deletion.md).
