# Captured Storage behavior on local PostgreSQL 17.4

This isolated experiment replays the six verified private Storage functions and seven triggers against the fixed historical buckets/objects metadata. It imports the frozen Harness and metadata identifier helper without editing earlier experiments. It does not contact Supabase or operate on real objects.

Run from the repository root:

```sh
node experiments/pg17-storage-behavior/pin-inputs.mjs
node experiments/pg17-storage-behavior/verify.mjs --red
node experiments/pg17-storage-behavior/verify.mjs
node experiments/pg17-storage-behavior/verify-lifecycle.mjs
```

`pin-inputs.mjs` is an explicit development command. Review changes before repinning. Verification checks frozen source, private capture, CommonJS dependencies, Node executable, PostgreSQL bin/lib/share and private permission fingerprints before and after each run. Existing input pins never update automatically. Failed and successful runs receive separate timestamp/UUID evidence files under `docs/research/evidence/2026-10-24-storage-behavior/`.

The RED command records two expected incompatibilities independently: all enum labels with seven triggers omitted; then STANDARD-only enum with the seven exact triggers installed. A passed RED report means the expected defects were observed. It is not a passing Storage fixture.

The normal matrix checks full column/constraint/index/function/trigger catalogs, literal folder boundaries, 100/101 ASCII and multibyte names, lifecycle INSERT/UPDATE branches across five actual role connections, MEMBER versus exact effective role including SET ROLE, exact DELETE GUC strings, RLS separation, SET LOCAL reset, and object UPDATE/upsert transaction timestamps. Every expected SQL failure compares complete buckets and objects state before and after; SQLSTATE, constraint or sanitized function identity distinguish the source. Successful zero-row DELETE is recorded separately from SQL failure.

`foldername(NULL)` and `foldername('')` yield SQL NULL; a nonempty name without a slash yields an empty array. Literal expectations are supported by a separate PostgreSQL empty-dimension/NULL-bound check without calling foldername. EXPLAIN ANALYZE records actual trigger call counts for name/lifecycle UPDATE OF matching. The lifecycle AFTER trigger's PST01 supplies a CONSTRAINT diagnostic naming the trigger; the classifier uses PL/pgSQL context before classifying actual table CHECK errors. Actor and admin sessions use UTC to make timestamp comparisons deterministic; captured function search_path attributes remain unchanged, and ambient caller search_path is the frozen Harness setting rather than a production equivalence claim.

The owner name matches captured catalog metadata, but its NOLOGIN/NOSUPERUSER/NOBYPASSRLS attributes are synthetic. R is created locally as LOGIN/NOSUPERUSER/NOBYPASSRLS; its private name appears only in memory and SQL sent to the temporary server. A member inherits and can SET ROLE to R. Ordinary and BYPASSRLS test actors are not members. The local admin is a superuser. These choices do not reproduce the uncollected production membership graph. The initial permissive test policies isolate trigger semantics. The later `synthetic_authority.members` SELECT/DELETE policies use actual current_user and synthetic family labels to isolate visibility and revocation behavior; they do not rerun the previous full application RLS composition.

Queries, connections, subprocesses and each run have fixed bounds. The cluster listens only on a private Unix socket and ignores PG environment variables. The external lifecycle observer tests hostile PG variables, real SIGTERM after fixture readiness, invalid-server-setting startup failure, and missing-role connection failure. It independently observes allocations, live postmaster/socket state and final PID/socket/directory absence. Raw SQL errors and PostgreSQL logs are withheld; the report retains only safe codes and a log digest. Cleanup runs in finally.

This is synthetic SQL metadata evidence. Direct DELETE does not delete object bytes; updated_at is transaction time rather than a content version. Storage HTTP, Auth/JWT, service GUC setup, production role membership, object backend, multipart dependencies, private bucket migration and a real backup restoration remain unverified. Historical enum labels came from user-returned results without an execution timestamp or project ref. System libraries and kernel remain ambient. No application, dependency, root migration, earlier experiment or earlier evidence file is changed.
