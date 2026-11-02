# G1-01 Reliable Seal Registration Implementation Plan

> **For agentic workers:** User approved advancing G1-01 and continuing local implementation without generic reconfirmation. Stay in this workspace/branch, use TDD, independent specification review then independent quality review. Preserve previous evidence and commit only this batch locally.

**Goal:** Establish a retry-safe, fail-closed HTTP seal-registration boundary before connecting the recorder to the cloud-confirmation chain.

**Architecture:** Stable server-derived asset identity for an actor/project/session; canonical manifest remains in the existing task idempotency key. Exact inserts plus unique-conflict reloads and missing-job repair make asset/job registration recoverable without upsert, deletion or pretending it is atomic. The HTTP acknowledgement never authorizes local cleanup; trusted chunk ledger, running Worker and durable client confirmation remain separate follow-up work.

**Tech Stack:** Existing TypeScript, Next Route Handler, Supabase JS and Jest. No dependency/schema/SQL changes. Local HTTP tests use a stateful constraint-aware fake, not a deployed PostgreSQL qualification.

## Baseline And Design Decision

- HEAD `665484289e4dc15896073572fd730923f701c7b1`, clean, branch `codex/october-upgrade-p0`, four local checkpoints ahead of `1921766c2`.
- Current `prepareRecordingSessionSeal` allocates a random asset ID before deriving a key that includes that ID. Thus identical HTTP retries have different keys; existing tests mask this by supplying fixed IDs or ignoring query filters.
- The route writes an asset then a job. A job-write failure leaves an asset but retries do not repair it; current replay also treats `asset.state === ready` alone as cleanup permission and ignores lookup failures.
- Alternatives: replace registration with a new SQL transaction/RPC now (larger migration/runtime slice), upsert all fields (risks overwriting immutable input), or stable identity plus explicit reconciliation (selected incremental fix). Registration is still not atomic; an incomplete asset remains visible as verifying, never a successful seal acknowledgement without its matching job.
- Live client temp upload paths do not match server `projects/<project>/sessions/<session>/<index>` manifests. No frontend/Worker wiring is enabled by this slice. Legacy random-ID registrations are not silently adopted or rewritten.

## Task 1: Behavioral RED

**Modify:** `packages/web/src/lib/server/__tests__/recording-session-service.test.ts`, `packages/web/src/app/api/recordings/sessions/[sessionId]/seal/__tests__/route.test.ts`.

- [x] Add service tests without supplied IDs: identical capture => same asset/task identity, new job attempt ID allowed; actor/project/session changes => distinct asset identity. Explicit IDs remain supported.
- [x] Replace filter-ignoring route mocks with a stateful exact-filter store enforcing asset primary key and job idempotency uniqueness. Preserve replay and deletion scenarios, tighten incomplete ready acknowledgement to never permit local cleanup.
- [x] Reproduce duplicate sequential/concurrent seals, asset/job unique-conflict races, job insert failing before or after commit then explicit retry, missing/inconsistent jobs, changed manifest/story/owner, lookup errors and thrown I/O; assert no upsert/delete, no duplicate rows and safe headers.
- [x] Cover actual active storyteller role, story project/owner, deletion lookup failures/tombstones and revalidation after registration; preserve exact feature flag and auth failure handling.
- [x] Freeze actual RED logs, exits and source hashes before production edits.

```ts
const first = await seal(request)
const second = await seal(request)
expect(first.asset.id).toBe(second.asset.id)
expect(store.assets).toHaveLength(1)
expect(store.jobs).toHaveLength(1)
expect(second.canClearLocalDrafts).toBe(false)
```

## Task 2: Stable Identity And Registration Reconciliation

**Modify:** `packages/web/src/lib/server/recording-session-service.ts`.
**Create:** `packages/web/src/lib/server/recording-seal-registration.ts`.
**Modify:** `packages/web/src/app/api/recordings/sessions/[sessionId]/seal/route.ts`.

- [x] Derive the default asset UUID from a versioned SHA-256 namespace plus the JSON tuple project/session/actor, excluding manifest so changed input conflicts rather than creating a second asset. Keep explicit asset IDs and existing merge task key semantics unchanged.
- [x] Implement registration helper: lookup by stable ID; exact identity/input comparison; insert and reload on 23505 only; find/insert matching job using its immutable input fields. Repair a missing job only on a verifying asset. Query failure is not absence. No loop, upsert, rollback deletion or source mutation.
- [x] Validate matching asset/job identities and coherent queued/running/ready states; reject cancelled/failed/unknown or malformed receipts. `canClearLocalDrafts` is always false: seal registration is not final cloud confirmation.
- [x] Route validates bounded metadata/manifest count, uses actual active storyteller role and verifies optional story ownership/project. Recheck access/role/deletion before job publication and before response, using the existing asset guard without modifying its semantics; preserve no-store/auth cookies and fixed errors.
- [x] Execute focused GREEN; inspect assertion counts and exact tested source hashes.

```bash
npm test --workspace=packages/web -- --runInBand --runTestsByPath \
  'src/app/api/recordings/sessions/[sessionId]/seal/__tests__/route.test.ts' \
  src/lib/server/__tests__/recording-session-service.test.ts \
  src/lib/server/__tests__/recording-merge.test.ts \
  src/lib/server/__tests__/recording-merge-executor.test.ts
```

Actual TDD: initial `seal-red` included a test syntax error (retained, not accepted as route RED); corrected harness `seal-red-behavior` executed 57 tests, 44 failed / 13 passed against untouched production. `seal-green` passed 4 suites / 97 tests with unchanged behavioral RED tests.

## Task 3: Independent Review And Complete Verification

- [x] Obtain independent specification PASS, then separate quality Approved; preserve initial findings and fix/re-review if required. Both reviewers independently passed 4 suites / 97 tests; no outstanding findings. Quality inspected, but did not independently rerun, the full chain.
- [x] Save next-env original bytes, run full chain, compare only known generated change before restoring originals. Preserve warnings; audit not rerun. No SQL change means no new PG experiment.
- [x] Verify 1471 historical inputs and all four prior G1 evidence directories (115 files) unchanged; freeze source/raw gzip/document hashes and staged scope. See the hash indexes and final-integrity receipt; zero protected-input mismatches.

```bash
npm run verify && npm test --workspace=packages/shared -- --runInBand && npm run test:infra
git diff --check
```

## Task 4: Report And Local Checkpoint

- [x] Create `docs/research/2026-11-02-g1-seal-registration.md` and a new evidence directory; update current handoff/index without rewriting prior gap-register evidence.
- [x] Record G1-01 as partial: registration fixed, but trusted chunk ledger/namespace, atomic durable manifest, Worker host/claim/publication, UI/idempotent story save, client confirmation/cleanup and actual cloud qualification remain open. Do not claim full end-to-end completion.
- [x] Restrict the local checkpoint to this batch and validate staged index bytes against the tested sources and frozen evidence. Commit identity and post-commit clean state are checked with Git after the checkpoint, rather than embedding a self-referential commit ID in its payload. No amend/push/main merge, remote migration/repair/deployment, paid calls or family-media transfer. `g1MilestoneSatisfied: false`, `pushConditionSatisfied: false`.

Final full chain: exit 0; Web 139 suites / 2251 tests, shared 4 suites / 16 tests, infra 14 tests, Next 184 pages. Source code and test hashes are unchanged since GREEN and both independent reviews. Next entry is trusted session/chunk input plus upload namespace alignment; current local work needs no manual owner action.
