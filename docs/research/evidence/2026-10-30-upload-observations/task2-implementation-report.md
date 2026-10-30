# Task 2 implementation handoff (frozen for independent review)

Status: DONE_WITH_CONCERNS (local implementation/targeted validation only; independent spec and quality review pending).
Branch: codex/october-upgrade-p0. Base HEAD: d13d55ab0. No stage, commit, push, deployment, remote migration, build or full verify was performed by this implementer.

## Implemented

- Exact service-role upload writer receipts, validated ID/binding/outcome, one RPC with the existing 5s independent deadline and retry(false). Unknown writes are not replayed.
- POST upload-attempts: centralized auth, loaded original-audio asset, real existing media guard before/after RPC, no-store and refreshed cookies. Random UUID/32-byte token; SHA-256 of JSON [loaded asset ID, authenticated user ID, token]. Only opaque hash crosses into the ledger.
- Project-hub pending-upload path: strict confirmed begin -> non-overwrite SDK PUT -> independently bounded strict finish -> existing complete. Entire observation auth/fetch/body deadline is 20s, including abort-ignoring promises; no new auth implementation or dependencies.
- Actual SDK outcomes remain distinct from caller cancellation; conflict is not new-object success. Unknown receipts take precedence over known SDK failure. Skipped-PUT replay states create no observations. Original File/idempotency key remain caller-owned for explicit retry.
- Strict v3 read with retained v2 export validation, safe counters, freshness, microsecond coverage boundary, no fallback. Incomplete/invalid/unsettled upload reports suppress the rate; cancellation is separate. Client-reported alert text, always-partial collection coverage, recomputed health status preserving real alerts. Admin remains 503/not_ready with supplier/delivery unavailable.

## Test evidence

Raw command output and separate exit files are retained under task2-*; no old evidence was overwritten.

- task2-red-server-snapshot: exit 1; new writer module absent plus 17 behavioral failures / 84 passes in existing snapshot/admin suites.
- task2-red-route: exit 1; expected new route module absent (no tests executable before the route existed).
- task2-red-client: exit 1; 41 failures / 14 passes, absent begin/finish sequencing and deadlines.
- task2-green-initial: exit 1; 231/232 passes. The remaining test injected cancellation during body receipt rather than after confirmed begin; corrected the simulation to abort at the synchronous receipt-validation boundary, without weakening the expected zero PUT and confirmed cancellation finish.
- task2-red-edge-cases: exit 1; 5 failures / 142 passes for strict HTTP 200, custom pre-PUT cancellation reason and year-zero coverage validation. Fixed under TDD.
- task2-green-focused: exit 0; 5 suites / 237 tests (before adding three supplementary existing-behavior assertions).
- task2-green-regressions: exit 0; 20 suites / 599 tests, including current upload observations, v3/admin, original media authorization/complete/access, shared guards/auth session, exports, real client and connected UI retry regressions.
- task2-type-check-final: exit 0; npm run type-check --workspace=packages/web.
- task2-lint-final: exit 0; npm run lint --workspace=packages/web.
- task2-diff-check: exit 0; git diff --check.

## Boundaries and concerns

- Reports are untrusted browser diagnostics, not Storage acceptance, checksum/decode/save or permission proof. A started attempt can be a pre-PUT crash. An unknown outcome remains unsettled and is not silently repaired/replayed.
- Existing auth/asset guards are sequential reauthorization, not atomic revocation barriers. Signed-URL TTL and already-issued credential behavior are unchanged.
- Local Jest uses boundary mocks for Supabase/auth; existing guard logic and real client sequencing are exercised. No live network/deployed browser collection coverage, supplier readiness or alert delivery is established.
- Parent owns fresh PG17 reruns, full verify/build, handoff/plan updates and milestone assessment. SQL/experiments/Task1 evidence are untouched by this implementer.

## Exact source paths

The following 11 paths are frozen in task2-source-freeze.json (SHA-256). All modifications are unstaged. No further edits until parent review feedback.

- `packages/web/src/lib/server/upload-observations.ts`
- `packages/web/src/lib/server/__tests__/upload-observations.test.ts`
- `packages/web/src/app/api/media/assets/[assetId]/upload-attempts/route.ts`
- `packages/web/src/app/api/media/assets/[assetId]/upload-attempts/__tests__/route.test.ts`
- `packages/web/src/lib/server/operational-rpc.ts`
- `packages/web/src/lib/server/operational-snapshot.ts`
- `packages/web/src/lib/server/__tests__/operational-snapshot.test.ts`
- `packages/web/src/lib/server/cutover-readiness.ts`
- `packages/web/src/lib/project-hub-client.ts`
- `packages/web/src/lib/__tests__/project-hub-client.test.ts`
- `packages/web/src/app/api/admin/cutover-readiness/__tests__/route.test.ts`
