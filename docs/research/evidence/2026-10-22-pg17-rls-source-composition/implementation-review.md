# Task 1 independent implementation review

Review date: 2026-10-23. Spec verdict: **PASS for Task 1**. Quality verdict: **Approved**. Actionable findings: **none**.

This review covers only the nine new files in `experiments/pg17-rls-source-composition/` represented by the supplied Task 1 patch. `BASE=HEAD=1caa21a72a23d6f5166ed127847ca931374b890a` was confirmed. Earlier dirty-branch work was not reviewed as part of this change. Frozen interfaces were inspected only to resolve concrete composition, role, locking, replay and lifecycle questions. No matrices or prior application suites were rerun; the saved final execution evidence was inspected and its hashes verified. This review changed only this file.

## Review inputs and integrity

The patch's added bytes equal the current bytes of every reviewed file. All nine hashes equal the supplied source-hash manifest. The generated pin file was inspected as an inventory and its entries were independently rehashed: 53 source/support files, 49 loaded CommonJS/package files and 743 PostgreSQL bin/lib/share files all match. The installed Node v22.22.2 executable independently matches pin `0b8f2f0b030bb443caa2a6781bc2d2e7069e173143726a1627bf527b3ef3126b`. Normal and hostile reports bind to the same source map and pin file; their dependency/runtime closure digests also match that file.

| Reviewed file | SHA256 |
|---|---|
| `experiments/pg17-rls-source-composition/README.md` | `ffceee1e2fd2709abd99c9f0d550769d174842f969f550a1ad43729e6eec6f12` |
| `experiments/pg17-rls-source-composition/compatibility.mjs` | `090f25f614deb00ec67ed517d9271fd4190a8ebe22084a2cb7a702c3c0d0ab43` |
| `experiments/pg17-rls-source-composition/fixture.mjs` | `636f51fbb2fbf5cb3345f981354965f01170262c2213c618c48299740fe73508` |
| `experiments/pg17-rls-source-composition/input-pins.json` | `c730e281df0fde3b9f8069be60bd3fb8fccaa4c8402b1579923eab6993efd7a2` |
| `experiments/pg17-rls-source-composition/inputs.mjs` | `cb38568f15cdd841eaf7ea0204dd2318ec7422069323f16317c9c5cf1930eed5` |
| `experiments/pg17-rls-source-composition/pin-inputs.mjs` | `17ac9f0d902be26f3483db12c2fc2cdd3be92a8a181c4dcd95c859c5b60cdee1` |
| `experiments/pg17-rls-source-composition/scenarios.mjs` | `af1dc140937c09a896366a55e7b8c13ddab853da4c4b339cb8ccc3452da4232b` |
| `experiments/pg17-rls-source-composition/verify-lifecycle.mjs` | `6cc7dbb3925fc4839436668fefbf7b0ec0bf0493af394b06a66816e43744e84f` |
| `experiments/pg17-rls-source-composition/verify.mjs` | `0089f2e2aefd890822c278245a5a7640f0db2e072ebd159957cc32fc1c5cb910` |

Additional review anchors:

- Binding spec `docs/superpowers/specs/2026-10-22-pg17-rls-source-composition.md`: `ac702833a2e78258f511763511bda6f3d1e108b249ca991aa8f6980ed4e16388`.
- Task brief `.superpowers/sdd/2026-10-22-upgrade-pg17-rls-source-composition/task-1-brief.md`: `34c0ce8f0d8ea53cb9579cdb748ba0f7cd54b68819fbba563a7c15f43ee1d616`.
- Implementer report `.superpowers/sdd/2026-10-22-upgrade-pg17-rls-source-composition/task-1-report.md`: `0078d847b9eb084fe9f6ff60b61e7da57fa4f6896677dc80c6723d8370a95939`.
- Supplied patch: `07d62ed419eb3571cfb63441daba361cf95dc0b359f28c5192ad32029c3d15a5`.
- Supplied source-hash manifest: `ddceaf7fbcd4a9653871bfea41e9417c81334e524096766cbf837c8bb89252ea`.

## Spec review

| Requirement | Verdict and evidence |
|---|---|
| Frozen dependencies and exact catalog composition | PASS. `fixture.mjs:10` selects the fixed snapshot; `fixture.mjs:29` materializes complete selected relations, followed by column/ordinal, constraint, index and trigger checks. The reused replay verifies 7 tables, 70 columns, 34 constraints, 34 indexes, 13 reviewed routines and 3 trigger bindings. The extension matches 63 live columns across stories/buckets/objects, 13 constraints, 20 indexes and the fourth reviewed public update trigger. Dropped Storage ordinal 13, owners, synthetic tombstones/t02, STANDARD-only enum, foldername/Auth shims and all 7 omitted Storage trigger bindings are explicit. No legacy unique constraint masks partial-index inference. |
| Authentic compatibility RED and precise adaptations | PASS. `scenarios.mjs:15` creates two valid users and projects before separate probes. Actual failures are 23502 for positional/missing-name projects, 23503 for both swapped-role INSERT forms and 42P10 for the old Storage conflict target. The trigger proof compares before/after whole-row hashes, independently verifies an advanced timestamp and equal non-timestamp values. `compatibility.mjs:6` contains 6 exact statement allowlist entries with occurrence counts, source/derived hashes and actual use counts; unknown SQL passes unchanged. Only the old test hash removes updated_at. The candidate derivation changes exactly one local database guard and records both hashes. |
| Complete old RLS graph and candidate scenarios | PASS. All 32 original policies are replayed. The report records actual 42P17 with dependency RLS enabled, then separately labels the deliberately reduced diagnostic conditions. `scenarios.mjs:48` restores table RLS, tests candidate marker refusal, transaction rollback and reapplication, and calls the entire frozen `verifyCandidate`. The final report contains all 60 candidate scenarios, including unexpected permissive policies, immutable story identity, next-statement READ COMMITTED refusal and the REPEATABLE READ limitation. |
| Complete source ledger behavior on PG17 | PASS. `scenarios.mjs:101` calls the unchanged old seed/run and real ledger adapter. `scenarios.mjs:87` transpiles and loads the actual two TypeScript projector sources and records source/generated hashes. All 236 checks completed, including source-removal history, SQL NULL/JSON null, array order/bounds/type, tombstones, rollback, disconnection and unknown-COMMIT recovery. All 18 recorded waits have `wait_event_type=Lock` and include the expected blocker in the server-observed blocking chain. |
| Real low privilege sessions and final combined flow | PASS. `scenarios.mjs:112` adds real saga_anon/saga_authenticated connections, and the Harness plus trusted writer helper assert session_user=current_user with no superuser/RLS bypass. `scenarios.mjs:130` extends the same live database with frozen invitation/entitlement/management candidates and an independent seed. Grant → available source → send → accept → management history → story/object read → cross-family denial → trusted revoke → inactive membership → next-statement denial in the already-open READ COMMITTED transaction → fresh denial → ledger bind access_denied all execute together. The final identity mutation remains 42501; all seven existing write-RPC overloads and four direct wallet/member bypass attempts remain denied. All 11 selected final public/Storage tables retain RLS. |
| Normal, hostile and lifecycle evidence | PASS. `verify.mjs:20` verifies inputs before start, retains unique reports, and verifies closure again before cleanup. Query/connection/lock/child operations use the bounded frozen Harness; the new runner provides its overall interruption deadline. `verify-lifecycle.mjs:15` observes the full hostile matrix and actual SIGTERM, pg_ctl start failure and missing-role connection failure. Exact phase/code/event checks prevent an observer timeout or unrelated setup error from satisfying the cases. All selected children report stopped cluster, removed temp directory, zero clients and no cleanup errors; the observer independently checks allocated directories and reported postmaster PIDs. |

The phase order is compliant with binding composition item 6, which expressly permits clear phases for different old seeds and requires a separate final combined seed. `verify.mjs:54` runs historical ledger mutation races before installing the immutable RLS identity guard, then runs the complete RLS matrix and final combined flow. The retained reverse-order failure is real: `run-2026-10-23T01-49-34.634Z-1143fc6b-a88b-4ad9-a3a3-c70b7920cb02.json` has SHA256 `3644985c7efded2caac3d0dc12e61e3788976415baa14acf209731c5ec5453bf`, records 181 completed checks, then 42501 at the next intentional story-project mutation, and clean cleanup. The implementation does not weaken or claim to pass that historical mutation with the immutable guard active.

## Quality review

Approved with no actionable findings. The new layer preserves frozen implementations, limits compatibility transformations to exact test SQL, distinguishes catalog adaptation from permission behavior, and keeps phase-specific counts separate. Reports retain failed/RED attempts and use unique names with exclusive creation. The execution and observer paths avoid raw exception messages, SQL CONTEXT and private routine definitions; PostgreSQL logs are hashed before deletion. The frozen lock tests poll actual PostgreSQL blockers rather than treating elapsed time as evidence. Unknown-COMMIT recovery verifies a durable binding and zero compensating rollbacks on another connection.

No finding requires a source edit or additional matrix run for this review.

## Selected evidence verified

Paths below are relative to this evidence directory. Every listed hash was independently verified.

| Report | Result | SHA256 |
|---|---|---|
| `run-2026-10-23T01-57-40.064Z-866c69eb-00c2-46b6-9637-5e96f4d4dbd7.json` | PASS; 72 scenarios, 832 behavior assertions, 997 total assertions, 236 ledger checks, 18 lock observations | `4bde0ca5cdb2ced8de01cb4f4e4e39d5466cf9ba1837405b75d0fff06c971a0a` |
| `red-2026-10-23T01-58-32.869Z-ccb54d4b-eff2-49c8-8767-ed140e3cba27.json` | PASS; all 6 expected compatibility failures/invariant changes | `5a6e0138318df1fb05eb701ba2cf1c4f0cb22eb1e66c5d86539c2ce3b44fc52a` |
| `lifecycle-2026-10-23T01-58-56.415Z-ccdd7767-5d65-4dea-89db-4d6656532b4b.json` | PASS; 4 actual observations | `6dddf31f4cc4808e845b678d85b268b4417249e43bb88c659edb795293b7953d` |
| `run-2026-10-23T01-58-56.841Z-d54c7c7a-53a0-4bc6-bea7-7b1f4217e9d2.json` | Hostile environment PASS; same full matrix and 14 scrubbed keys | `485d9bfad68ee7f4b0f170f0e096a08487f852ecb4fef8bb4acedf5658b808bb` |
| `run-2026-10-23T01-59-03.168Z-df09e994-6896-4a92-8c92-3cba1ad8fccc.json` | Observed SIGTERM at fixture-ready, exit 143, clean cleanup | `fa94c57674836cfa1a5267e084b2b239fb29d70dd071c78756f5a6faac8f32a4` |
| `run-2026-10-23T01-59-05.837Z-73b6fb61-1f47-46e2-a2be-71dba358df18.json` | Observed cluster_start/SUBPROCESS_FAILED, exit 1, clean cleanup | `0bdc9330369ce07dbf54bbabc06fa19d319767a45c282d4858f4bb88f0f3aeb5` |
| `run-2026-10-23T01-59-07.996Z-ba519266-6059-4440-8d82-937330943c97.json` | Observed client_connection_failure/28000, exit 1, clean cleanup | `567caac3ab99f372360b5f7f48edfac8b2641c572ddf926752c50c31588e8434` |

## Evidence qualifications and remaining batch gates

- This is source review plus verification of saved evidence, not an independent execution of the database matrices. The selected final reports support the implementation claims; earlier setup failures are not counted as successful RED probes.
- The historical ledger races execute on the complete PG17 metadata fixture before candidate RLS's immutable identity trigger. The final dedicated seed establishes composition with that guard active; it does not establish that every historical intentional identity mutation is valid in the composed fixture.
- The COMMIT test executes a real server COMMIT, then injects a local lost-acknowledgement error. The separate disconnect test actually terminates a backend before commit. These establish the tested adapter boundaries, not a remote network failure distribution.
- SIGTERM evidence is for the explicit fixture-ready gate, alongside startup and connection failures. It does not claim successful cleanup after uncatchable SIGKILL or arbitrary operating-system failure.
- Synthetic Auth/GUC identities, t02 objects, partial Storage enum and seven omitted Storage trigger semantics, absent Storage HTTP and production inheritance remain unverified production dependencies. The digest examples apply to PostgreSQL 17.4; ambient macOS system libraries/kernel remain unpinned.
- Unchanged application verification reuse, full prior-work preservation, user-action checklist, document/whole-batch review and final batch integrity are controller closeout gates outside this Task 1 review. Real-device 5/20/30-minute checks remain deferred. This approval does not pass P0/G0–G4, create a release milestone, or authorize commit, push, remote migration or deployment.
