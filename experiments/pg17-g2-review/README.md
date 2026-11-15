# G2 review and transcription acceptance

Run from the repository root:

```sh
node experiments/g1-local/verify-migrations.mjs --g2-review --chrome
node experiments/g1-local/verify-migrations.mjs --g2-review --story-deletion
```

The runner creates a disposable native PostgreSQL 17.4 cluster, applies bootstrap plus every root migration, and creates fresh synthetic identities. It requires the local runtime used by `experiments/g1-local`, installed Google Chrome and the repository's Node dependencies. All test schemas and clients are cleaned up, including failure paths. Source hashes, assertions, cleanup, browser requests and screenshots are saved in the evidence directory printed by the runner.

`scenarios.mjs` tests the production service-only review RPC and persisted ASR reservations, source/CAS/idempotency guards, permissions, immutable history, real concurrency and G1 erasure. `chrome.mjs` mounts the production StoryReviewPanel (also connected in the real story page), calls production review and protected playback routes via the real Supabase SDK, and checks edits, attributed disputes, approval/reload, audio seek, correction, narrow layout and deletion. The browser shell replaces navigation and login; it does not claim a hosted full-app login run.

`transcription-chrome.mjs` uses the production transcription route and adapter. A strictly allowed loopback HTTP server receives the actual multipart audio request in place of ElevenLabs. It tests policy/consent, permissions, successful ingestion, replay, revocation during I/O and durable unknown output without repeat sends. Generated WAV tones and controlled words prove byte/timing transport, not speech accuracy. Never pass live account credentials to this harness.

The shared Storage substitute implements byte-range `206` responses, as required for Chrome's native audio seeking. Its Auth/PostgREST/Storage behavior is a declared local transport substitute; real rows and service RPCs execute in PostgreSQL. No real household or provider quality claims follow from these tests.

See [design](../../docs/superpowers/specs/2026-11-10-g2-review-design.md), [adapter configuration](../../docs/research/evidence/2026-11-10-g2-review/transcription-adapter.md) and [manual follow-up](../../docs/research/2026-11-10-g2-manual-follow-up.md).
