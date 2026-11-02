# G1-01 Durable Seal Manifest Implementation Plan

> **For agentic workers:** Continue the user-approved G1-01 local chain on the current branch. Use TDD and subagent-driven development for the isolated SQL task; obtain independent specification PASS before independent quality Approved. No remote actions. One final local checkpoint after verification.

**Goal:** Persist an immutable, owner-bound recording session/chunk input atomically before asset/job registration, and align new client chunk uploads with its physical namespace.

**Architecture:** Keep the existing merge verifier's logical `projects/<project>/sessions/<session>/<index>` contract. A shared pure builder maps that key to the physical `<user>/<logical-key>` Storage path used by the existing uploader. A service-role-only PostgreSQL RPC atomically creates the existing session/chunk ledger and pins its complete canonical seal input. The HTTP route awaits a validated durable receipt before existing recoverable asset/job registration. This is trusted input identity/durability, NOT proof that the declared bytes exist or decode; Worker readback remains mandatory.

**Tech Stack:** Existing TypeScript/Next/Supabase JS/Jest, PostgreSQL 17.4 isolated Unix-socket harness. No new dependencies. New root migration is a local candidate only.

## Design And Limits

- Baseline `1ca1e06dd`, clean, `codex/october-upgrade-p0`, ahead 5 of the local remote-tracking ref. Prior five batches and the 9-gap register remain frozen.
- Alternatives: client-only path rename does not provide durable input; independent session/chunk inserts leave partial manifests; selected one service RPC makes only the manifest atomic. Asset/job publication remains the previous recoverable two-write operation, not one transaction with the manifest.
- Canonical manifest: `{schemaVersion:1, projectId, sessionId, userId, storyId, assetId, mimeType, chunks}`. Each ordered chunk has `{index, chunkId, bucket, objectKey, storageObjectKey, byteSize, sha256}`. Logical paths preserve the verifier; physical paths derive from the owner, with no extension. Caller paths never choose a different owner/project/session.
- RPC `seal_recording_manifest(p_manifest jsonb)` returns `{schemaVersion:1, sessionId, state:'sealing', manifestSha256, manifest, canClearLocalDrafts:false}`. The server validates the complete echoed manifest, hash format, identity, state and cleanup denial. No missing/errored RPC fallback, automatic replay, browser-write capability, cleanup or ready assertion.
- Add nullable `recording_sessions.seal_input` and `recording_chunks.seal_chunk_id`; legacy rows remain unchanged and are not adopted. New records contain canonical manifests; subsequent changed input, legacy state or inconsistent rows fail closed. Limit 2000 contiguous unique chunks and 100 MiB total. SHA-256 is canonical lowercase.
- Revoke service-role direct writes to both ledgers; only the security-definer RPC can create sealed input. Preserve authenticated read policy, add service read policies. Pin search_path and revoke PUBLIC/anon/authenticated function execution. Future Worker state changes/deletion require dedicated authorized RPCs; do not silently widen current grants.
- Check current project, active storyteller, own optional story and tombstones inside the transaction. Permission row locks stabilize those rows during this RPC, not all future revocation/deletion. Future Worker reauthorization and content validation remain required.
- Existing temp objects and local `uploaded` flags are not migrated or relabeled. New captures use the canonical path; historical recovery/reconciliation remains a separate entry. Upload success remains a diagnostic, never cloud confirmation.

## Task 1: Atomic Ledger (Isolated SQL Agent)

**Create:** `supabase/migrations/20261102000001_recording_seal_manifest.sql`, `experiments/pg17-recording-manifest/verify.mjs`, `experiments/pg17-recording-manifest/README.md`.
**Modify:** `scripts/__tests__/deployment-config.test.js` migration inventory only.

- [x] Write PG tests before migration; run `node experiments/pg17-recording-manifest/verify.mjs --without-migration` and preserve actual missing-RPC RED with sources/exit.
- [x] Implement bounded input validation, scope/role/story/tombstone checks, canonical path validation, transactional session/chunk creation, exact replay and conflict rejection, immutable direct-write ACLs.
- [x] Verify concurrent identical seals converge, changed payload has one winner, failed chunk insert rolls back entire new session, no legacy adoption, revoked/cross-project callers reject, malformed manifests reject and data/grants survive migration replay.
- [x] Run normal and polluted-environment PG17.4 checks in disposable local clusters; preserve exact evidence and cleanup. No old harness edits or remote connection. Final pre-interruption and resumed runs each pass 15 scenarios / 645 assertions; intermediate coherence failure is retained separately.

## Task 2: Namespace And HTTP Gate (Primary Agent)

**Create:** `packages/web/src/lib/recording-chunk-location.ts`, `packages/web/src/lib/server/recording-manifest-ledger.ts`, their colocated tests.
**Modify:** `packages/web/src/lib/local-recording-session.ts`, its new colocated test, seal route and route tests; update the existing SmartRecorder MP4 upload-path assertion to the canonical no-extension path while retaining MIME/owner checks.

- [x] RED: a real local session uploads to `projects/<project>/sessions/<session>` with filename equal to its chunk index; unsafe segments reject; existing logical merge validation remains unchanged.
- [x] RED: seal route must call the durable RPC before inserting asset/job; database missing/error/conflict/malformed receipts write neither. Tests retain prior retry/authorization/deletion scenarios.
- [x] Implement canonical location builder and switch only new uploads; no generic StorageService behavior changes.
- [x] Implement server manifest builder and bounded, abortable, non-retrying RPC call; validate echoed input and fixed receipt. Insert gate before existing registration and preserve exact feature flag, headers and conservative cleanup.
- [x] Run focused Jest with explicit `--runTestsByPath`; preserve real RED/GREEN and source hashes. Final parent focused run `web-green-4`: type-check and 8 suites / 165 tests passed. Earlier path assertion and TypeScript compatibility failures remain separate evidence.

## Task 3: Verify, Review And Seal

- [x] Preserve next-env bytes; run `npm run verify && npm test --workspace=packages/shared -- --runInBand && npm run test:infra`; inspect all counts/exits and restore only known generated next-env change. Audit not rerun. `full-chain-resume`: exit 0, Web 142/2295, shared 4/16, infra 14, build 184. Original incomplete `full-chain.json`/log retained and not counted as PASS.
- [x] Independent specification review PASS, then separate quality review Approved; retain findings and re-test any repairs. Both reviews found no actionable issues; no implementation repair or test rerun was needed. Reviewers independently checked evidence and sources, not a second execution of the parent test chain.
- [x] Check 1471 historical inputs, all previous five G1 evidence directories (140 files), tested sources and raw/gzip logs; update report/current handoff/index without rewriting old gaps or evidence. Final document/index fingerprints are bound by the packaging receipts.
- Checkpoint procedure: stage only this batch, verify document links/hashes and exact index bytes, create a new local commit, then inspect the clean state. Completion of this operation is read from Git and `final-integrity.json`, not a self-referential commit hash cached in this plan. G1-01 remains partial; no push/main merge, remote migration/repair/deployment, paid calls or family-media transfer.

Next entry after this slice: a trusted Worker reader loads the pinned physical manifest, validates actual Storage bytes/hash and full audio decode, then durable claim/publication. Only after that wire client seal/status/confirmation, idempotent story save and safe local cleanup.
