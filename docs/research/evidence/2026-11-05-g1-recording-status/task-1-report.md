# Task 1 implementation report

Date: 2026-11-05. Source freeze: SQL, deployment-order addition and all files in
`experiments/pg17-recording-status/` are ready for independent review. Task 2's
production reader/validator was frozen before the successful native HTTP run.
The independent review's timeout-fixture finding has been fixed through a
retained RED/GREEN cycle. Final review acceptance and whole-project gate remain
owned by the controller.

## Implemented

- Added `supabase/migrations/20261105000001_recording_session_snapshot.sql`.
  Exact four-argument, 13-key contract; STABLE SECURITY DEFINER, fixed
  `pg_catalog, pg_temp` search path and UTC, READ COMMITTED requirement.
- Current actor/project/session/hash, active storyteller, optional story owner,
  authorization subject blockers and project/session/asset/story tombstones are
  checked in the statement snapshot. Unavailability uses a fixed message.
- One envelope-building query returns whole rows and bounded arrays: matching
  sessions 2, jobs 2, attempts 4, candidates 4 and ordered chunks 2001. Related
  foreign/corrupt identities remain present for the strict application validator.
- No DML, mutation helper, row/advisory/write lock or table ACL widening. Actual
  service role succeeds in explicit READ ONLY; PUBLIC/anon/authenticated cannot
  execute. Only ordinary AccessShare locks were observed in `pg_locks`.
- New local native harness imports existing fixture exports without executing
  any previous verify/evidence writer. HTTP compiles the actual 13-module reader
  and finalizer runtime graph and uses installed Supabase/PostgREST JS 2.105.3,
  TypeScript 5.9.3, native Node fetch/HTTP and pinned PostgreSQL 17.4.
- Only this task's single migration-order line was added to the inherited dirty
  `scripts/__tests__/deployment-config.test.js`. Exact comparison against its
  provided before copy passed; SHA-256 of current file is
  `035ea556299f752fef904f0bad88fcd6b0aab90550be542274883a227f192098`.

## Commands and evidence

All run directories below are under
`docs/research/evidence/2026-11-05-g1-recording-status/` and contain `results.json`,
compressed source/runtime copies and PG logs. Failed runs were retained.

| Command | Result | Run directory |
| --- | --- | --- |
| `node experiments/pg17-recording-status/verify.mjs --without-migration` | Expected actual service-role RED; SQLSTATE 42883 | `red-without-migration-2026-11-05T08-55-35.906Z-e218e110-0a7c-44fc-acb0-178e6160168f` |
| `node experiments/pg17-recording-status/verify.mjs` | Failed exact whole-row mapping assertion | `native-sql-2026-11-05T08-59-57.596Z-a0a0b02c-fde0-4e3c-9bd5-5d5af8b7b6ee` |
| same | Harness parameter type error 42P08 | `native-sql-2026-11-05T09-01-39.594Z-2b5031b5-b7e1-4bc8-ab68-4a3bbb4018e4` |
| same | GREEN 5 scenarios / 190 assertions | `native-sql-2026-11-05T09-04-42.113Z-94c7007e-56cf-4934-a8d8-cae408858f63` |
| same, after exact attempt bound assertion | GREEN 5 scenarios / 191 assertions | `native-sql-2026-11-05T09-11-06.782Z-8c2b800f-27a6-4350-8459-af3caa80fd9c` |
| `node experiments/pg17-recording-status/verify.mjs --http` | Historical behavior GREEN 4/580; missing compiled archive and timeout fixture issue subsequently found | `native-http-2026-11-05T09-14-05.222Z-76518153-4ef1-4d2a-ab8b-133a8f0c2063` |
| same, with compiled-runtime archive assertion | Expected evidence RED: loaded compiled runtime archives absent | `native-http-2026-11-05T09-24-29.413Z-76e583dd-bf63-466e-b99a-dd94f9725c7f` |
| `node experiments/pg17-recording-status/verify.mjs` | **Final SQL GREEN 5/191**, 6 loaded compiled modules archived | `native-sql-2026-11-05T09-26-15.086Z-dbd5ed7b-1d35-4c19-913c-da74fa582bbc` |
| `node experiments/pg17-recording-status/verify.mjs --http` | Intermediate GREEN 4/580, 13 compiled modules archived; timeout fixture issue subsequently found | `native-http-2026-11-05T09-26-20.275Z-f2d5cf99-9ee9-4273-bd42-95b606448fd8` |
| same, with caller/deadline assertions | Expected native timeout RED: caller cancellation triggered; also exposed socket-close observation race | `native-http-2026-11-05T09-30-05.226Z-b6ac5278-4084-4a1b-bc26-4cd349b758a2` |
| same, after isolated timeout and socket close fixes | **Final HTTP GREEN 4/585**, 13/13 compiled graph modules archived | `native-http-2026-11-05T09-33-17.998Z-3ae4565f-fc32-4849-93d1-ab65ad742d37` |
| `node --test scripts/__tests__/deployment-config.test.js` | 7/7 passed | Tool output; controller also owns full infrastructure gate |
| `git diff --check -- supabase/migrations/20261105000001_recording_session_snapshot.sql experiments/pg17-recording-status scripts/__tests__/deployment-config.test.js` | Exit 0 | Tool output |

The exact-row RED found a real PostgreSQL name-resolution mistake: a composite
column named `a` in the authorized CTE shadowed an attempts relation alias, so
`to_jsonb(a)` serialized the asset. Naming those composite columns `session_row`
and `asset_row` fixed the cause; the exact whole-row assertion remains. The 42P08
was confined to adversarial fixture SQL using one parameter in UUID and text
contexts; explicit UUID casts corrected it.

Self-review then found macOS `require.cache` paths use `/private/tmp`, whereas
the archive selector used `/tmp`. An explicit archive-presence RED was retained,
and `realpath` plus an assertion for every production graph module now prevent
that evidence gap. Earlier behavior-green artifacts remain historical and are
not the complete final runtime archive evidence.

Independent review found the HTTP fixture called its caller-abort checkpoint in
both abort and timeout modes. New assertions first failed because the timeout
caller's signal was aborted. The checkpoint now runs only for explicit abort;
timeout must leave that signal un-aborted, consume at least `timeoutMs - 10ms`,
abort native fetch, close the native peer, and never finish a normal response.
That RED also caught a cleanup observation race: `server.close` returned before
one socket emitted `close`. Cleanup now explicitly awaits tracked socket close
events before asserting zero sockets. The final run satisfies both checks.

## Native observations

- Full database tuples, including authorization, deletion and synthetic Storage
  tables, compare equal across successful and denied reads.
- A writer first runs actual atomic publication inside an uncommitted transaction.
  An independent READ ONLY reader executes two STABLE snapshot calls in one SQL
  statement around `pg_sleep`. `pg_stat_activity` confirms it reached that pause
  despite the writer's locks, then the writer commits. Both snapshots are exactly
  equal to the old tuple; the next explicit statement inside the same READ
  COMMITTED transaction sees all published states and equal microsecond finish
  timestamps. Further explicit reads reject a committed revoke and tombstone.
- REPEATABLE READ/SERIALIZABLE, incorrect identity/hash, revoked ownership,
  deleting/deleted assets and all optional blockers reject without writes.
  Duplicate session binding, foreign job/candidate identity and oversized
  collections remain visible to the application through bounded sentinel rows.
- Actual production `publishRecordingJob` receives a lost native HTTP response
  after PostgreSQL COMMIT and returns unavailable. A separate actual production
  `readRecordingSessionStatus` sends one read-only RPC and returns the verified
  compact success receipt. The HTTP ledger contains exactly one publication
  mutation across all cases, no replay/fallback/recovery/Storage/delete request.
- HTTP scenarios cover all six permanent failures, queued, asset-before-job,
  sealed-before-registration, live running, real expired running lease and an
  explicitly recovered outcome_unknown. Unresolved never authorizes retries.
- Extra envelope keys, foreign identities, read errors, wrong actor/project/hash,
  revoked role, story tombstone, partial terminal state, foreign candidate and
  changed job owner reject with exactly `recording_status_unavailable`.
- Real timeout and caller abort reach fetch and close the native peer within the
  test bound. In final telemetry, the 100ms timeout took 101.61ms with
  `callerAborted:false`; explicit caller abort took 16.24ms with
  `callerAborted:true`. Both have `fetchAborted:true`, `peerClosed:true` and
  `responseFinished:false`. Already-aborted invocation makes no request. Every read compares
  every persisted tuple plus actual local-draft/source/candidate synthetic file
  byte hashes before/after. Receipts always retain `canClearLocalDrafts:false`.
- The final HTTP run stores 110 source snapshots, including loaded CommonJS
  dependencies, plus all 13 compiled runtime modules (123 compressed archives).
  Final SQL stores 58 source snapshots plus 6 loaded compiled modules. A separate
  integrity pass checked every compressed and decompressed SHA-256 and confirmed
  all source hashes match current files. Both final runs report no source drift, stopped
  server PID, removed socket/temp directory, zero clients/errors. HTTP also has
  zero sockets/pending handlers and all native fetch calls settled.

## Self-review and remaining bounds

The SQL authority deliberately does not reproduce the terminal tuple validator.
It makes a current authorized consistent snapshot; Task 2 performs strict
certification. Raw rows remain internal. A receipt is a point-in-time observation,
not atomic permission after the response, and grants no URL or cleanup authority.

Only isolated synthetic data was used. The local HTTP substitute is not managed
PostgREST/Storage, TLS, cloud/device qualification or a full migration replay.
Existing native terminal-worker evidence covers FFmpeg bytes; this status slice
uses actual publication with prepared synthetic candidate metadata and retained
synthetic files. Node builtins and OS-linked libraries are outside copied source
coverage; executables are fingerprinted rather than copied.

No production TypeScript was edited by Task 1. No git stage/commit/push, remote
migration, deploy, paid API, family data or old evidence overwrite occurred.
G1 and push conditions remain false. The full npm gate was intentionally left to
the controller, as instructed. No known unresolved implementation issue remains;
independent review is pending.
