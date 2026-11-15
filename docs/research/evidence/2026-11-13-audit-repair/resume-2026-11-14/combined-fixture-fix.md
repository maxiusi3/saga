# Combined recovery fixture repair — 2026-11-14

The previously failing combined native PG17/Chrome command now passes: **2,479 assertions, 41 bootstrap/migration files, exit 0, no source drift**. This repair changes only `experiments/pg17-processing-recovery/scenarios.mjs`; production code, migrations, deletion triggers, and the parent-owned combined verifier were not changed by this task.

## Root cause

The prior report, `docs/research/evidence/2026-11-11-g3-delivery/migrations-1794637626943-3c79c8bf-0185-4d9d-95a5-961aadafc263/results.json`, failed after 795 assertions with PostgreSQL `23505: Media deletion reference fenced`; G1 story deletion and G2 review had passed and its source-drift list was empty.

The recovery fixture previously inserted `stories.audio_url` before inserting its referenced `media_assets` row. After earlier story-deletion scenarios produce persistent deletion scopes, `media_deletion_legacy_blocked` rejects an unknown asset identity (`supabase/migrations/20261109000001_media_deletion_execution.sql:54`), and `guard_media_deletion_reference` raises `23505` (`supabase/migrations/20261109000002_story_content_deletion.sql:173`, `:192`). An isolated fixture with no prior tombstones had hidden that invalid write ordering. Two later recovery checks likewise wrote a nonexistent fixed UUID, which would be rejected by the same fence before reaching the recovery behavior they intended to test.

## Repair

- `experiments/pg17-processing-recovery/scenarios.mjs:7`: extract a small `createAudio(story)` fixture helper. Each real asset has its own object key and is attached to the same story under test.
- `experiments/pg17-processing-recovery/scenarios.mjs:12`: insert a story with no audio pointer, create its asset, then set `audio_url`. This matches the existing adapter fixture's valid ordering.
- `experiments/pg17-processing-recovery/scenarios.mjs:69`: test both a null pointer and a real replacement asset for released preparation. Both request-specific and readiness status calls must withhold safe retry. Restore the original pointer and assert the original request becomes retryable, providing a positive control for the pointer checks.
- `experiments/pg17-processing-recovery/scenarios.mjs:79`: after obtaining the outbound permit, replace the pointer with a second real same-story asset and retain the expected `23505` on transcript ingestion. The rejection now comes from the recovery identity check instead of an invalid fixture write.

The adapter fixture already used the correct creation order and needed no change.

## Verification

Executed from the repository root:

```sh
PATH="/Users/eat/.cache/codex-runtimes/codex-primary-runtime/dependencies/native/poppler/poppler/bin:$PATH" node experiments/g1-local/verify-migrations.mjs --g3-delivery --g2-review --story-deletion --processing-recovery --ai-edit --semantic-search --chrome > /tmp/saga-combined-fixture-20261114.log 2>&1
```

- Exec session: `86923`, completed with exit code `0`.
- Results: `docs/research/evidence/2026-11-11-g3-delivery/migrations-1794640344909-f2282e03-2097-4bfe-a27f-397dc03fba5a/results.json`.
- Passed sections: story deletion and Chrome, story review and Chrome, transcription Chrome, processing recovery, recovery adapter, publication recovery, story AI edit and Chrome, semantic search and Chrome, authoritative search, archive, payment HTTP/Chrome, and delivery Chrome.
- All 41 bootstrap/migration files passed; 2,479 assertions passed; 189 source files recorded; `sourceDrift: []`.
- Recovery scenario SHA-256 in evidence equals the current file: `53c1c42485436857d4da19b53b09db3fa55abd4fb7b7a79fc27781135e5a5425`.
- Cleanup reports `clusterStopped: true`, `tempDirectoryRemoved: true`, `clientsRemaining: 0`, `errors: []`.
- `node --check experiments/pg17-processing-recovery/scenarios.mjs` and `git diff --check` passed.

The harness runs actual native PG17 and installed Chrome with synthetic families, local transport/provider substitutes and controlled responses. This is local integration evidence, not hosted Supabase or paid-provider qualification. No remote production data, credentials, staging, commit, or push was used. The scenario is in an already-untracked experiment directory and remains unstaged.
