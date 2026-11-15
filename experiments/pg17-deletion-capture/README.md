# PG17 atomic deletion capture rehearsal

Run from the repository root:

```sh
node experiments/pg17-deletion-capture/verify.mjs
node experiments/pg17-deletion-capture/verify.mjs --without-migration
```

Every invocation writes a unique `docs/research/evidence/2026-11-06-g1-deletion-capture/native-*` directory, including failures. The local PG17 runtime has TCP disabled, synthetic identities/content, real unprivileged service-role connections, and automatic cluster cleanup. `--without-migration` deliberately reproduces the missing-RPC RED. Existing recording migrations are applied unchanged. `deletion_targets` DDL and the authenticated deletion-request read policy are extracted from the actual foundation migration; the story table comes from the actual bootstrap. Auth/project/storage prerequisites remain explicitly synthetic. This is not the full migration-chain qualification.

`fixture.mjs` exports reusable `setup(h, source, migrate=true, sealFence=true)`, `fresh(h, service, prepareRecordingSessionSeal, publish=true)`, `capture(client, { actorId=OTHER, projectId=PROJECT, subjectId, subjectType='story', requestId })`, `snapshot(h)`, `materialize(h, fixture)`, `compileCapture(h, source)` and `applicationAdmin(h, service)`. `fresh` uses the existing published-recording fixture. `capture` calls the actual SQL RPC. A follow-on backup check can consume its actual `deletion_targets` bucket/object_key tuples without hand-writing coordinates. The native report's `publishedCapture` contains the public receipt, complete durable request and target rows, plus full database snapshots.

The application adapter is compiled from its actual TypeScript source. Only its PostgREST transport is replaced with a real `pg` service-role connection; abort/retry wiring is asserted. This does not exercise a live PostgREST server. Focused Jest covers deadline/cancellation/network failure without fallback writes.

The default native matrix now contains the original 14 scenario groups, two registration-gap regression groups and five seal-fence regression groups. Per-group assertion counts include full-row comparisons of all previously existing assets/jobs; they are not independent test-case counts. `observations` retain the full before/after rows, source coordinates and synthetic file bytes; `waits` retain `pg_stat_activity`, actual blocking backend IDs and `pg_locks`. Publication in both orders, reservation overlap, two submissions, request-ID collision and owner/facilitator/subject changes during waits all use independent transactions. Rollback injections cover errors, suppressed request/target/asset/cancellation writes, altered request/target rows, later changes to assets/candidates, and a newly inserted source phantom.

The request stores a target count and SHA256 of the complete canonical JSONB target rows ordered by logical target ID. This includes target row ID, request ID, kind, bucket/key, state, error and timestamp. The full rows remain private in `deletion_targets`; adding a JSON snapshot to the existing member-readable request table would expose reserved candidate paths. The first write compares actual full rows with expected full rows after all triggers. Replay validates count and full-row digest. Native authenticated reads exercise the actual request read policy and confirm that targets remain unreadable.

A subject replay may return its original durable request ID when the caller generates a new ID. SQL checks supplied request-ID collisions before subject lookup, then pins project, subject, subject kind and original actor. The application pins project/subject/kind and validates the returned UUID; it cannot require equality with a newly generated request ID.

The capture locks `deletion_requests` first against the publication/confirmation SHARE fence, then authority and source populations. Conservative global locks remain deliberate local correctness choices. Complete tuple snapshots are scoped to relevant authority, stories, assets, sessions, chunks, jobs, attempts, candidates, intents and requests/targets. After writes the RPC rediscovers source membership and physical aliases, then compares scoped complete tuples. It does not JSON-serialize unrelated story content or global history. Discovery/alias scans and global writer contention still require throughput, data-volume and cloud qualification. Legacy reverse lock orders can safely abort with a deadlock or bounded lock timeout. A client abort/lost result does not prove SQL rollback; resubmission recovers a committed capture.

A running candidate's expired attempt becomes `outcome_unknown` and cannot be automatically reclaimed. The positive mixed-candidate fixture therefore uses two real sessions in one story (one published prepared candidate and one retained reserved candidate), with genuine sealed chunks. It never rewrites attempts to fabricate a retry history.

No Storage removal is invoked. Local synthetic files stand in for physical bytes and are compared unchanged while capture runs; only the local harness cluster/scratch is cleaned up at exit. Metadata capture does not qualify object downloads, reference-safe GC, late noncooperating Storage writes, actual physical deletion, remote migrations, device recovery, cloud/device testing, backup-ledger qualification, G1 completion or push readiness.

## Review fix 1 regressions

```sh
node experiments/pg17-deletion-capture/verify-fix-1.mjs --before-fix-1
node experiments/pg17-deletion-capture/verify-fix-1.mjs
node experiments/pg17-deletion-capture/verify-snapshot-cost.mjs --before-fix-1
node experiments/pg17-deletion-capture/verify-snapshot-cost.mjs
```

The `--before-fix-1` option reads the SQL saved in this plan workspace's `task-1-fix-1-before/` snapshot. It never rewrites the current migration. The first runner isolates the legitimate reserve → seal → capture interval before asset/job registration, the mixed case and conflicting existing intended-asset identities. It also compiles the actual seal HTTP route and dependencies; only auth/access for the synthetic user and a real PostgreSQL service-role transport replace external services. The route must return 409 before registrar asset/job access. Actual SQL seal replay and publication also reject. All full database and synthetic-file snapshots remain in the evidence.

The cost runner holds one target constant in size and varies one unrelated story body across exactly 0/8/32 MiB. It times the **unmodified actual RPC**. Separately, a diagnostic copy replaces only `to_jsonb` with a transparent serializer/logger, reporting payload byte counts and whether the unrelated body was serialized. This supplemental instrumentation is not the production behavior oracle. The complete derived SQL and hashes are retained; full before/after database snapshots are archived as gzip JSON with raw/archive hashes. The pre-fix SQL serializes the unrelated body four times; repaired SQL records no such calls and approximately 3.7 KiB of scoped tuple serialization for all three samples. These are local diagnostics, not a throughput benchmark or SLA.

A story-bound sealed session can legitimately name an asset that has not been registered yet. Its actual persisted chunks and story metadata are captured without guessing an asset address or creating an asset/job target. An existing intended asset must match the session's project, story, owner and recording chain. The local service-role SELECT policy on deletion requests models the hosted service role's existing read capability while keeping the test role NOBYPASSRLS, so the actual registration route can read its tombstone.

## Final seal/capture fence regression

```sh
node experiments/pg17-deletion-capture/verify-seal-fence.mjs --without-seal-fence
node experiments/pg17-deletion-capture/verify-seal-fence.mjs
```

The first command deliberately exits nonzero at the no-missed-chunk assertion. It applies the historical seal and capture migrations unchanged but omits the new forward seal replacement. A temporary scheduling transaction holds `recording_sessions` EXCLUSIVE: the old seal passes the tombstone check, waits at SELECT, then its INSERT waits behind capture. Full rows show a story-only capture, late real chunks and an immutable replay that cannot recover their coordinates. Unique `native-seal-fence-*` directories preserve every result, including RED.

The corrected queued-lock test proves capture waits on seal's deletion SHARE fence and captures both committed chunk addresses. The reverse order proves seal waits on capture's EXCLUSIVE fence before advisory/source locks and then rejects the fresh tombstone. Additional native groups establish stale REPEATABLE READ/SERIALIZABLE snapshots before capture and prove rejection without writes; exercise the three-second lock timeout, rollback and lock release; and check real role EXECUTE, VOLATILE/settings and unchanged valid seal/replay. Observations retain all database rows and synthetic bytes; waits retain blocker PIDs and both waiter/blocker lock rows.

Default capture includes these regressions. The default fixture, including backup compatibility, applies `20261106000003_recording_seal_deletion_fence.sql` after capture. `20261102000001_recording_seal_manifest.sql` remains unchanged. This is selected-routine local integration, not complete migration-chain or hosted qualification.
