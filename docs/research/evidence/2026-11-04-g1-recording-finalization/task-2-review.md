# Task 2 independent specification and code-quality review

Reviewed on 2026-11-05. Specification verdict: **PASS**. Code-quality verdict:
**APPROVED**. No actionable findings in the Task 2 change set.

## Review boundary

- Reviewed `task-2-brief.md`, the linked finalization design, the scoped
  `task-2-review.patch`, all 14 files in `task-2-review-hashes.json`, and the
  implementer's completed `task-2-report.md`.
- The supplied base is `c0669e8058343f91deba8e468b03e4bf817b1ca5`. Patch SHA-256:
  `836260d5ab5ba5ca2e7912bbb763b638a8fcb5a7c938b0c4877239e533eec507`.
  Independently rehashed all 14 scoped files; all match the frozen review list.
  Inherited untracked worker/candidate code is not attributed to this task.
- Applied the specification and quality axes separately, using `CLAUDE.md`
  conventions. Read inherited candidate validation, processing-error branding,
  generic media parsing and Task 1's exact SQL argument/receipt contract only
  where needed to assess integration. Task 1's SQL approval is not repeated.

## Specification verdict: PASS

1. **Exact terminal contract.** `recording-job-finalization.ts:38–75` validates
   the closed running lease, valid identity, bounded attempt/TTL and live local
   deadline; publication also requires a prepared, closed candidate with the
   same complete identity. Inputs are copied before yielding. Lines 87–94 send
   the exact eight Task 1 arguments, including branch-inapplicable nulls and the
   four exact output fields. Lines 48–56 validate every receipt field against
   the supplied identity/content and the action's state tuple; returned receipts
   are frozen and always retain `canClearLocalDrafts:false`.
2. **Permanent failures and ambiguity.** Lines 72–74 use the existing real
   WeakSet brand and permanent disposition. Forged prototypes, class-like
   objects, unknown codes and transient errors cannot select permanent failure.
   Lines 77–101 bound the sole RPC by timeout and lease deadline, propagate
   cancellation, explicitly disable SDK retry, and clear listeners/timers.
   Rejection returns a fixed unavailable error. There is no subsequent failure
   call, direct write, deletion or cleanup authorization after malformed,
   rejected, cancelled or lost responses.
3. **Timestamp precision.** Lines 30–36 reject impossible calendar dates,
   non-UTC values and excess precision, while preserving PostgreSQL
   microseconds. A terminal time must be at/after server time and preparation,
   and strictly before lease expiry. Tests include one-microsecond boundary
   failures and a PostgreSQL `+00:00` success receipt.
4. **Immutable candidate lineage.** `recording-asset-lineage.ts:11–30` queries
   the exact bucket/key once, requires one prepared candidate, reuses the
   existing closed scalar validator for id/job/attempt path and session UUID,
   and compares project/asset plus hash/MIME/bytes/duration. Query failures and
   missing/malformed/mismatched rows fail closed. Ordinary assets do not cause
   candidate queries. Ready/deleting/deleted candidate pointers can supply
   lineage; impossible prepublication/quarantined pointers are rejected.
5. **Access and export deletion checks.** Access route lines 45–58 add candidate
   session and project to the initial deletion check before signing, then use
   the current-media guard. Guard lines 40–51 resolve current lineage before
   their final asset/story/project/session tombstone read, with no later await.
   Export lines 84–93 resolve candidate lineage before removed-media
   classification, including legitimate deleted pointers, and retain the
   existing transcript/legacy provenance block. Lines 224–241 check project and
   surviving asset/session/story subjects after all asynchronous assembly work,
   including empty archives. Tests prove deletion during signing/download
   withholds the URL/archive and invalid lineage is not silently omitted.
6. **Compatibility and scope.** The two legacy server bucket changes are type
   unions only. Generic media/legacy URL parsers and seal registration were not
   widened. The inherited verifier/worker remains disconnected from finalizing
   callbacks. Export limits, hash verification, existing presentation and URL
   TTL are preserved. No worker/status/GC/backup implementation or G1 completion
   is claimed.

## Code-quality verdict: APPROVED

The finalizer exposes a small action-specific interface around one shared
request implementation, with immutable scalar snapshots and one closed receipt
validator. The real processing-error brand is reused rather than approximated
from names or messages. Lineage validation is shared by the access guard and
export route, avoiding different candidate-path rules across consumers. The
small duplicated UTC conversion preserves the inherited candidate/worker import
graph required by this slice; no refactoring is required for approval.

The tests inspect exact payloads and absence of extra calls, exercise caller
mutation across the await, and distinguish legitimate removed candidates from
corrupt lineage. Access tests execute the real guard/lineage helper and assert
the final database read order. Export tests inspect ZIP bytes and late deletion
behavior. The HTTP harness uses native fetch and the installed Supabase client,
executes parameterized SQL in disposable PostgreSQL, captures before/after
tuples, and observes both rollback and commit-before-response-loss. Cleanup is
explicitly asserted. No documented-standard violation or actionable maintainability
issue was found.

## Evidence and limits

Independently read and hash-checked the command receipts plus compressed/raw
logs under `docs/research/evidence/2026-11-04-g1-recording-finalization/`:

- `task2-focused-final-01`: 14 suites / 445 tests passed.
- `task2-input-storage-final-01`: 2 suites / 232 tests passed.
- `task2-typecheck-final-01`, `task2-compat-final-01` and
  `task2-diff-final-01`: exit code 0, with no recorded source drift.

These final receipts match all scoped sources they record. Earlier standalone
85-test and 183-test logs were also inspected, but precede subsequent changes;
the final combined receipts above supply current-version coverage. Their
compressed and raw hashes match, as do the final log hashes.

Inspected `http-application-2026-11-04T16-57-11.120Z-0b324a81-c131-4d93-ab8a-e46c007364fc/results.json`:
**8 passed scenarios / 278 assertions**, using Supabase JS **2.105.3**.
There are 13 actual SDK fetches and 13 server requests, exactly one per
invocation. Malformed receipts, response loss and cancellation after commit
leave SQL success intact while the application reports unavailable. Precommit
cancellation/timeout and post-candidate permanent failure leave complete tuples
unchanged. All 25 current source hashes and compressed/decoded source snapshots
were independently verified. Cleanup records no HTTP listener, sockets, pending
handlers or unsettled fetches; PostgreSQL stopped with zero clients, temporary
and socket directories removed, server PID gone and no cleanup errors.

This review did not rerun suites or experiments: no concrete uncovered concern
required a narrow reproduction, and the parent owns the full repository gate.
Passing counts above are independently inspected retained execution evidence.
Repository-wide `npm run verify`, shared tests and infra results are outside
this task review's approval.

The HTTP endpoint is a **PostgREST-shaped substitute**, not actual PostgREST or
cloud qualification, and this boundary does not transfer/verify Storage audio.
Access/export retain optimistic reads rather than an atomic privacy snapshot.
Physical deletion target capture, candidate GC protection, backup allowlists,
status reconciliation, browser acknowledgement and worker orchestration remain
explicit residuals. This approval grants no deployment, remote migration,
push, local-draft deletion or G1-completion authority.
