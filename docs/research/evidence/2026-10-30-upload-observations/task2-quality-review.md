# Task 2 Independent Quality Review

Verdict: **Approved** for the assigned local implementation slice. No actionable correctness, security, regression or maintainability findings were identified. Blocking findings: **0**.

This is a quality review after the revised specification gate passed, not deployment, milestone or G0-G4 approval.

## Scope And Integrity

- Reviewed `CLAUDE.md`, the global constraints and Task 2 of `docs/superpowers/plans/2026-10-30-upgrade-upload-observations.md`, and the actual unstaged implementation against base `d13d55ab0a2ab8bb493da404a55f475613c7a372`.
- All **11/11** source/test entries in `task2-source-freeze-revised.json` matched SHA-256 at the beginning and end of review. This verdict applies to the revised route with the synchronous guard-failure adapter, not the earlier failed snapshot.
- All **4/4** Task 1 entries in `.superpowers/sdd/2026-10-30-upgrade-upload-observations/task-1-freeze.json` also matched. Read the SQL for cross-layer parameter, receipt, binding and aggregation compatibility; did not repeat the completed SQL/harness review or rerun PostgreSQL.
- Inspected unchanged auth, project-access, media guard/header, registration, project-hub component and installed SDK implementations where needed to validate integration assumptions. The shared media guard/header, registration route and component have no diff against the base.
- Historical reviews and implementation reports were treated as claims to verify. Pending/pre-fix draft documentation was outside the code-quality verdict. The parent confirmed that the observed `next-env.d.ts` restoration was its anticipated build cleanup; no reviewed source changed.

## Findings

None. No Critical, Important or Minor issue requiring a code change was found in the frozen slice.

## Review Results

| Area | Quality assessment and anchors |
| --- | --- |
| Authorization and credential isolation | `packages/web/src/app/api/media/assets/[assetId]/upload-attempts/route.ts:26` authenticates before data access. Exact request keys prevent client-supplied identity, path, time or diagnostics. At `:48`, the real media guard checks current permission, pinned asset identity/state and authoritative deletion requests. At `:52`, independent random credentials are bound by SHA-256 over loaded asset ID, authenticated user ID and token. Only the hash reaches SQL; terminal reporting re-derives it. SQL checks the binding before mutation or same-terminal disclosure. The browser's server-type import is type-only, not a runtime server dependency. |
| Publication and safe failures | `packages/web/src/app/api/media/assets/[assetId]/upload-attempts/route.ts:60` performs the final real guard and publishes synchronously, with no subsequent awaited operation. The revised `:32` adapter preserves expected 401/403/404/409 responses and sanitizes other guard failures to finite 503. Refreshed cookies and no-store survive these exits. No signed URL, raw provider diagnostic or token appears in finish/error receipts. The route does not mutate media state. This remains a recheck, not an atomic revocation barrier. |
| Writer uncertainty | `packages/web/src/lib/server/upload-observations.ts:16` requires exact receipt keys, schema, ID and requested state; begin cannot accept a replayed terminal. Actual SQL argument names match. The shared RPC wrapper uses one call, a 5-second whole-call race and `.retry(false)`; installed PostgREST code honors that switch. Unknown, conflicting and late results cannot authorize subsequent client work. Finish deliberately does not inherit caller cancellation. |
| Browser cancellation and late settlement | `packages/web/src/lib/project-hub-client.ts:116` bounds token acquisition, fetch and response body together for 20 seconds, including promises that ignore abort. Cleanup removes listeners/timers, and the race handles late rejections. At `:181`, confirmed begin precedes PUT; cancellation before PUT receives a cancellation report. The actual SDK result is classified before independent finish. Successful non-cancellable PUT is not relabeled cancelled merely because the caller aborts; complete is then blocked. Unknown finish takes precedence over a known SDK error. Independent probes also confirmed that late successful auth/fetch/body settlement cannot restart PUT, complete or retry. |
| Storage errors and explicit retry | `packages/web/src/lib/project-hub-client.ts:186` sends `upsert: false`. The installed Storage SDK emitted one PUT with `x-upsert: false` in independent synthetic transport probes. 409 and narrowly recognized legacy duplicate 400 responses become conflict; unrelated 400, 503 and transport errors become failure, never successful new-object writes. Only confirmed reports permit the existing complete verifier. Ready/verifying/uploaded replays avoid invented PUT attempts. The unchanged component retains the File and idempotency key for explicit retries. |
| v3 arithmetic and coverage | `packages/web/src/lib/server/operational-snapshot.ts:44` validates the exact v3 shape without fallback and retains strict inherited export validation. Upload counts must be safe nonnegative integers, failures cannot exceed evaluated attempts, and epochs/freshness/coverage comparisons retain PostgreSQL microseconds. SQL includes succeeded/failed/conflict in the finished-window denominator, failed only in the numerator, cancellations separately, and valid unsettled/invalid rows globally. At `:127`, invalid, unsettled or incomplete upload observations suppress the rate. At `:145`, collection coverage remains unavailable, and status/coverage are recomputed without hiding real critical alerts. Alert wording identifies the client-reported source. Admin remains 503/not_ready. |
| Maintainability and regressions | The change reuses the established authenticated client request, media guard/header and bounded RPC boundaries rather than adding a second auth implementation. Validation and sequencing remain compact and explicit. Existing archive writers still use the unchanged RPC execution machinery. The focused rerun covered registration, completion, export assembly, media guards, readiness and project-hub components as well as new paths. |

## Independent Verification

Executed from the repository root:

```sh
npm test --workspace=packages/web -- --runInBand --runTestsByPath \
  'src/app/api/media/assets/[assetId]/upload-attempts/__tests__/route.test.ts' \
  src/lib/server/__tests__/upload-observations.test.ts \
  src/lib/__tests__/project-hub-client.test.ts \
  src/lib/server/__tests__/operational-snapshot.test.ts \
  src/app/api/admin/cutover-readiness/__tests__/route.test.ts \
  src/lib/server/__tests__/cutover-readiness.test.ts \
  src/lib/server/__tests__/media-asset-guard.test.ts \
  'src/app/api/media/assets/[assetId]/complete/__tests__/route.test.ts' \
  src/app/api/media/assets/__tests__/route.test.ts \
  'src/app/api/projects/[id]/export/__tests__/route.test.ts' \
  src/lib/server/__tests__/archival-export-service.test.ts \
  src/components/projects/__tests__/connected-project-hub.test.tsx \
  src/components/projects/__tests__/two-entry-project-hub.test.tsx
```

Result: **exit 0; 13 suites passed; 510 tests passed**. Raw output and exit code are retained in `quality-review-focused-jest.log` and `quality-review-focused-jest.exit`.

Additionally executed **14/14 passing** read-only, in-memory Node probes against the frozen client, transpiled with the installed TypeScript runtime. They used the installed `StorageClient` with synthetic fetches, the real UUID helper, stubbed auth and fake deadlines; no source file was created or modified. Six scenarios verified actual SDK request/error mapping, six verified late successful settlement after a 20-second deadline across begin/finish auth/fetch/body, and two verified cancellation during PUT/finish while preserving a successful SDK outcome. These supplement, not replace, Jest or browser integration evidence. Output and exit code are in `quality-review-edge-probes.log` and `quality-review-edge-probes.exit`.

Evidence SHA-256:

| File | SHA-256 |
| --- | --- |
| `quality-review-focused-jest.log` | `89a11e54daa9bad37f1a553d22f879c317ccb3fa622644a2fcd54bbaf909354d` |
| `quality-review-focused-jest.exit` | `9a271f2a916b0b6ee6cecb2426f0b3206ef074578be55d9bc94f6f3fe3ab86aa` |
| `quality-review-edge-probes.log` | `fc0c44ccebd39bbf9a7ef3da0593f8c9fd78bf8f6b7aa31a23b327f136bfe698` |
| `quality-review-edge-probes.exit` | `9a271f2a916b0b6ee6cecb2426f0b3206ef074578be55d9bc94f6f3fe3ab86aa` |

Both staged and unstaged `git diff --check` passed; the index was empty at the review checkpoint. This reviewer wrote only this report and the four uniquely named evidence logs/exit files. No production/test edits, build, type-check, migration execution, staging, commit, push or remote operation were performed.

## Residual Boundaries

- Route tests mock the auth/database transport boundary; SDK probes use synthetic transport, not an actual browser, PostgREST deployment or Storage account. They do not prove Storage acceptance, original-byte validity or deployed collection coverage.
- A lost begin/finish receipt, process loss, or a non-settling SDK PUT can leave an unsettled report. The deliberately conservative global completeness rule then suppresses the upload rate; no automatic replay, repair or expiry is claimed.
- Current media authorization is still a multi-query recheck. Atomic revocation, signed URL TTL, production ledger growth/latency and real alert delivery remain outside this slice.
- Client reports remain untrusted diagnostics. Ledger age, local PG/Jest results and this approval do not establish provider-policy acceptance, G0-G4 or an original upgrade milestone. Full verification/build and final documentation/evidence reconciliation remain the parent's separate responsibility.
