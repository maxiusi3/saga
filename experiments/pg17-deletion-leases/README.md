# Local PG17 deletion lease rehearsal

Run from the repository root:

```bash
node experiments/pg17-deletion-leases/verify.mjs
node experiments/pg17-deletion-leases/verify.mjs --without-migration
```

The second command intentionally fails with PostgreSQL `42883` after an actual published synthetic recording is captured by the accepted deletion-capture RPC. It is the retained RED control, not a passing verification command.

The runner uses the existing fingerprinted PostgreSQL 17.4 Unix-socket harness, isolated synthetic prerequisites, actual seal/capture migrations and the new `20261106000004_media_deletion_leases.sql`. No remote configuration is loaded. It starts and removes its local cluster and synthetic files, retaining full row/byte snapshots, source fingerprints, SQLSTATE diagnostics, receipts and observed blocking PIDs in a uniquely named `docs/research/evidence/2026-11-06-g1-deletion-leases/native-*/results.json`.

Coverage includes all five actions, unchanged start/recovery replay, no shortening on a shorter heartbeat, three **real server-clock** undispatched expiries through exhaustion, a discarded start response leading to `outcome_unknown`, reconnecting workers, stale worker/attempt rejection, closed capture validation, malformed complete attempt history, actual role permissions/RLS, two disallowed isolation modes, INSERT/UPDATE suppression and alteration, capture changes during writes, competing claims, different-request progress, actual capture-lock waits, queued tampering, requester removal during a wait, and the real three-second lock timeout. Every lifecycle group replays the actual accepted capture and compares complete snapshots including synthetic bytes. Invalid history is injected only into local rollback transactions; no valid expiry is fabricated.

`fixture.mjs` exports `setup(h, source, migrate=true)`, `lease(client, requestId, action, workerId=null, attempt=null, leaseMs=null)` and `snapshot(h)` for the separate application runner. `setup` fingerprints SQL through the supplied `source` reader. `snapshot` extends the unchanged accepted capture fixture with the two private lease tables. The native runner also fingerprints the transitive local fixture import graph.

A transaction holding an uncommitted capture uses the local rehearsal administrator so its full snapshot can include private prerequisite tables; contending lease calls and permission tests use independent non-superuser, non-bypass-RLS service/anon/authenticated connections. Fault triggers use explicit `public` names because the production routine fixes its search path to `pg_catalog, pg_temp`.

This validates local durable ownership and conservative recovery only. Every receipt has `canDeleteStorage:false` and `physicalDeletionComplete:false`. No physical deletion, metadata purge, GC, hosted PostgREST, full migration-chain, backup/restore or device qualification is claimed. Reference safety and late-write reconciliation remain prerequisites for any destructive executor.

## Actual application adapter rehearsal

```bash
node experiments/pg17-deletion-leases/verify-adapter.mjs
npm test --workspace=packages/web -- --runInBand src/lib/server/__tests__/media-deletion-lease.test.ts
```

The separate runner compiles the actual `media-deletion-lease.ts` into CommonJS and substitutes only the Supabase RPC transport with the exported local `lease` SQL helper. Each operation asserts one `.abortSignal(...)` and one `.retry(false)` call. The runner fingerprints the transitive fixture graph, SQL and application source, and retains the compiled artifact, transport arguments, server receipts, full before/after rows, capture replay and synthetic file bytes under a unique `adapter-*/` evidence directory. It cleans up its isolated local cluster and synthetic files.

The native scenarios exercise claim, start, idempotent start, heartbeat with a shorter requested duration, checks, recovery and denied reclaim. A deliberately lost claim result remains durably leased, expires using the actual PostgreSQL clock, and is recovered over a new worker connection before attempt 2. A start that commits before its response is lost can be observed as running using the previous leased receipt; after expiry it becomes `outcome_unknown` and cannot be reclaimed. Lost responses are never interpreted as rollback.

The adapter returns immutable closed receipts, adds a process-local monotonic deadline only to active receipts, and never returns Storage coordinates. UTC calendar validation and exact integer microsecond comparisons reject inverted or oversized submillisecond intervals. Inputs and options are copied before transport. Calls using an active receipt are bounded by its pinned existing deadline. Returned active deadlines include transport and lock waiting; only heartbeat may extend the previous local deadline. SDK cancellation is backed by a local rejection race, and every failure is generic with no automatic retry. Jest covers malformed receipts, changing identities, caller mutations, hung transports, aborts, timeout bounds and lost results. This transport substitution does not qualify hosted PostgREST cancellation or production networks.
