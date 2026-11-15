# Task 1 implementation report — frozen for independent review

Task 1 is implemented and its local checks passed. The parent still owns independent task review, application integration, whole-change review, the full repository gate and final handoff. This report does not claim a G1 milestone or physical deletion.

## Scope and contract

Nine owned files are frozen in `task-1.patch` and `task-1-hashes.json`, against this plan's immediate `before/` copies:

- New `supabase/migrations/20261106000004_media_deletion_leases.sql`.
- New `experiments/pg17-deletion-leases/{fixture,verify,scenarios,lifecycle,faults,locks}.mjs` and README.
- Exactly one new migration inventory line after `20261106000003_recording_seal_deletion_fence.sql` in `scripts/__tests__/deployment-config.test.js`. The earlier seven uncommitted inventory additions remain intact.

The migration creates private `media_deletion_jobs` and `media_deletion_attempts` tables with finite/bounded time, state, owner and attempt constraints. RLS denies unprivileged clients; service-role gets SELECT only, with all writes through the service-only SECURITY DEFINER, VOLATILE five-action routine. Fixed settings are `pg_catalog, pg_temp`, UTC and 3s lock timeout. Receipt fields are closed, contain no storage coordinates, and always include `canDeleteStorage:false` and `physicalDeletionComplete:false`.

The routine takes request SHARE then target SHARE locks, a per-request transaction advisory lock, and ordered job/attempt row locks. All source observations and clock decisions occur after waits at READ COMMITTED. It validates complete version-1 request/target capture, digest/count, safe closed target shapes, full job bindings, all attempt history and coherent chronology. No current membership lookup revokes the persisted work order.

Claims append one attempt, at most three; live/expired ownership always needs explicit recovery before reassignment. Start replays preserve timestamps; heartbeat never shortens expiry, even when a new shorter duration was requested. Checks and inactive recovery replays write nothing. Actual expired undispatched attempts become `expired` while jobs enter `retry_wait` or third-attempt `failed`; expired running work becomes `outcome_unknown`, never reclaimable. Old attempt owners cannot act again.

Expected whole job/current/prior attempt rows are derived before DML and compared after all writes/triggers. Required row counts and an early complete job check stop suppression/alteration before dependent inserts. Final comparison also verifies the original capture unchanged and re-samples server time to avoid returning already expired ownership. Malformed history is rejected, not rewritten into valid history.

The fixture exports the requested `setup(h,source,migrate=true)`, `lease(client,requestId,action,workerId=null,attempt=null,leaseMs=null)` and `snapshot(h)` interface. It reuses the accepted capture fixture without editing it, adds both lease tables to whole snapshots, and sets only the snapshot observer's timezone to UTC so cross-connection `to_jsonb(timestamptz)` values remain exactly comparable. The native runner fingerprints its transitive fixture module imports and actual applied SQL.

## Validation evidence

All evidence is under `docs/research/evidence/2026-11-06-g1-deletion-leases/`; each command has a unique JSON receipt and compressed log, with no source drift during the command.

| Command receipt | Result |
| --- | --- |
| `task1-red-01.json` | Expected `42883` missing RPC after actual recording publication and deletion capture; 28 prior assertions; no production migration existed yet. |
| `task1-green-smoke-01.json` | Initial actual PG17 claim passed, 29 assertions. |
| `task1-native-06.json` | Final native PG17 GREEN: **578 assertions, 14 scenarios, 134 expected rejection cases, 6 real server-clock expiries, 6 observed actual lock waits**. |
| `task1-inventory-01.json` | Deployment inventory tests **7/7**. Inventory ordering only, not full-chain migration qualification. |
| `task1-syntax-01.json` | `node --check` passed for all six new `.mjs` files. |
| `task1-eslint-01.json` | Canonical root `eslint.config.cjs` passed on all six new `.mjs` files and the changed inventory file. |
| `task1-patch-check-01.json` | `git apply --reverse --check` accepted the complete immediate-baseline patch without changing files. |

Final native result: `native-1793981704070-21b57f37-c7a4-496a-9ed9-2e2c45fcb5fc/results.json`.

Native coverage includes all five actions and closed false-capability receipts; exact live start/recovery replay; retained longer TTL after shorter heartbeat; three real expired undispatched attempts through exhaustion; discarded start response/new connection/read-only check leading to actual running expiry and unknown outcome; absent/legacy/tampered capture; input errors; real anon/authenticated RPC/table denial and service direct INSERT/UPDATE/DELETE denial; REPEATABLE READ and SERIALIZABLE rejection; malformed old history and identity/digest/count/time binding drift; job/attempt INSERT/UPDATE suppression/alteration; triggers rewriting capture or previous attempts; same-request competition while different requests proceed; an actual capture transaction blocking a claim; both capture table fences; queued tamper; requester removal while waiting; and an actual **3004 ms** lock timeout (`55P03`).

Every lifecycle group captures/replays the accepted actual capture. Snapshots retain complete capture/other source/lease rows and synthetic file bytes; rejection snapshots prove full rollback. No valid expiry was fabricated. The only malformed rows are explicitly labeled local rollback fixtures. All local clusters stopped, temporary directories were removed, and no clients remained after every recorded run.

## Preserved failures and diagnosed corrections

All failed logs/results are retained; none was replaced by a passing record.

- `task1-native-01`: 374 assertions, job INSERT suppression surfaced a dependent FK `23503`. Added required write row-count checks and early independently expected job-row comparison. Final expected full-row/capture verification remains after all DML. The same scenario now returns conflict `23505` with complete rollback.
- `task1-native-02`: 378 assertions, fault trigger referenced unqualified tables under the production fixed search path and got `42P01`. Corrected only experimental trigger bodies to explicit `public` names.
- `task1-native-03`: 522 assertions, an experimental service-role capture lock holder correctly lacked SELECT on private `recording_story_intents`. The capture lock holder now uses the isolated rehearsal admin so it can snapshot its complete uncommitted rows; the contender remains an independent real service-role connection.
- `task1-native-04`/`task1-native-05`: 534 assertions, cross-connection full-row comparison exposed observer timezone rendering (`+08:00` vs `+00:00`), not different persisted instants. Native05 retains full `captureWait.before/captureRows/after` diagnostic frames in `native-1793981483746-7b33cb6b-70a5-41ea-9082-5f62bec1351d/results.json`. For example, the same tombstone is `2026-11-07T00:11:34.626482+08:00` versus `2026-11-06T16:11:34.626482+00:00`. The new fixture now sets snapshot observer timezone UTC; it does not normalize/drop any persisted field. Native06 passes the unchanged full comparison excluding only the two intentionally changed lease tables.

## Preservation and limits

HEAD remains `c0669e8058343f91deba8e468b03e4bf817b1ca5`. No stage, commit, push, deployment, remote migration, paid call, family data access, Storage deletion or metadata purge occurred. `git diff --check` passed. The immediate baseline inventory comparison proves this task added exactly its one owned line. Accepted capture fixture/runner/scenarios, capture SQL, seal-fence SQL, capture adapter and canonical root ESLint all match this plan's baseline byte-for-byte; their hashes are retained in `task-1-hashes.json`. The parent owns the broader protected-source/evidence audit.

Final native source fingerprints match current files. Patch SHA256: `39b046b9190b9f7ae112b24c50e23549d5ee04eebcc82161ef77fd33826b4ff5`.

The native transport is local Unix-socket PostgreSQL, with synthetic prerequisites rather than the full migration chain. This slice adds durable coordination only. Physical execution, reference-safe planning, late-write reconciliation, metadata/Storage cleanup, backup/restore, hosted PostgREST and actual-device qualification remain open; G1 remains 0/9.
