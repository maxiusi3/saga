# T05 isolated durable-worker PoC — independent review

Reviewed 2026-10-15. Scope: the supplied `review-package.diff` and current `experiments/t05-durable-worker/{store.mjs,worker.mjs,verify.mjs,package.json,package-lock.json,README.md}`. Historical dirty application changes are excluded. The unchanged production state helper and installed pg-boss/pg implementations were read only to verify the PoC's contracts.

## Verdicts

- **Spec compliance: changes required.** The main transaction, recovery, review, cancellation, and isolation scenarios are implemented and supported by the supplied evidence. Two failure/concurrency edges prevent full compliance with the current-time lease fence and cleanup-on-failure requirements.
- **Code quality: changes required.** Two actionable P2 correctness findings; no P0/P1 findings. The transaction adapter and state-helper reuse are otherwise coherent, and no unrelated scope expansion was identified.

## Findings

### 1. [P2] Read the lease clock after acquiring the business row lock

**Location:** `experiments/t05-durable-worker/store.mjs:205–213`, with the dispatch call site at `store.mjs:272–279`.

`guard(..., now)` receives an already evaluated `now()` from its caller, then awaits `SELECT ... FOR UPDATE` before comparing the persisted lease expiry to that value. A row-lock wait can consume the remainder of the five-second lease. The comparison still uses the time from before the wait.

A concrete failing interleaving is: the worker has committed `running`; another transaction locks the same business row without changing its snapshot; the worker enters the dispatch guard while its lease is still live; the lock is released after the lease expires. `guard()` accepts the old owner/attempt using its stale timestamp, and the following `poc_calls` insert records a simulated dispatch after expiry. The final publication check will normally reject the eventual result, but it cannot undo that separately committed dispatch. This does not require changing the production state helper or a takeover; ordinary lock contention is sufficient.

**Spec basis:** plan lines 35–37 require current owner/attempt/expiry fencing and a five-second business lease; P1 section 4 requires authorization checks at dispatch. The existing tests delay at checkpoints and inside publication, but do not hold the business row lock across a guard's clock read.

**Fix:** pass a clock function or logical-clock option into `guard`, and evaluate it after `lockJob` resolves before recovery/lease decisions. Preserve the explicit logical-clock review scenario. Add a focused contention regression that holds the business row lock before the dispatch guard until the real lease expires, then verifies no new simulated call, no artifact, and appropriate unknown recovery.

### 2. [P2] Treat failed child creation as terminal during cleanup

**Location:** `experiments/t05-durable-worker/verify.mjs:137–140`, supported by child bookkeeping at `verify.mjs:66–83`.

A child is added to `children` immediately, but only its `exit` handler removes it. If `fork` cannot create a process, Node emits `error` and `close`; it need not emit `exit`. The error makes the scenario reject, but `cleanup()` then registers a new `exit` listener, calls `kill('SIGKILL')`, and waits forever for the failed child. `kill` returns false because there is no process. Cleanup never reaches `context.close()`, `pg_ctl stop`, directory removal, or evidence writing, leaving the already-started private database running.

This is a real failure path for process-resource errors such as `EAGAIN`, not an assumption about a successful worker's normal event ordering. A minimal standalone Node diagnostic with an unavailable executable produced `error`, then `close`, no `exit`, a null PID, and `killResult: false`; it started no database and no worker process.

**Spec basis:** plan lines 12 and 46 require owned processes/cluster cleanup on exit and failure. The recorded clean successful run does not exercise process-creation failure.

**Fix:** track child lifecycle completion on `close` (including failed creation), avoid waiting for an already terminal child, and give cleanup a bounded failure path when termination cannot be confirmed. Continue attempting owned-cluster shutdown even if child cleanup fails, and record incomplete cleanup truthfully. Add a failure-injection regression for a fork error/close sequence with no exit, asserting that cleanup terminates and stops/removes the owned cluster.

## Requirements checked without additional findings

- The harness creates a unique `/tmp/saga-t05-*` directory and private Unix socket; startup explicitly disables TCP. Connection fields are explicit, the host validator rejects TCP hosts, and neither `DATABASE_URL` nor a production database/schema is selected.
- The experimental package pins pg-boss 12.37.1 and direct pg 8.16.3 with its own lockfile and Node >=22.12.0 requirement. pg-boss uses the supplied pool adapter, so its separate transitive pg package does not alter the selected adapter runtime.
- Business insertion and `boss.send` use the same PostgreSQL client/transaction. Existing job IDs do not enqueue again. Final artifact, snapshot, attempt state, and queue completion also share one client/transaction.
- The pinned pg-boss implementation accepts `{ id, retryCount }`, applies active-state/attempt predicates, uses the supplied transaction adapter, and returns the affected count. `settle()` requires one affected row and raises an error that rolls back business writes if the queue fence is lost.
- Row locks and owner/attempt comparisons prevent an old worker from overwriting a newer attempt. Real-clock business leases are capped at the fetched queue deadline. The stale-clock issue above is the remaining lease-check gap found in this review.
- `leased` is committed before `running`; `running` is committed before the simulated provider ledger insertion. The three IPC checkpoints expose the intended persisted/uncommitted boundaries.
- Expired pre-dispatch work can recover; expired running work becomes `outcome_unknown`, and repeat deliveries do not redispatch it. The supervisor is explicitly controlled by the harness with a one-second monitor interval.
- Review prepares one unpublished artifact, releases the lease, and acknowledges the message. Approval and requeue are atomic, preserve attempt count/reference, and the resumed worker reuses that reference without a second call.
- Cancellation/revocation is reread under the business row lock before dispatch/publication; a committed cancellation blocks late publication and redelivery. The additional check after `before_commit` prevents publication if that checkpoint outlasts the lease.
- The README accurately limits this to a synthetic local PoC and identifies the logical cross-day clock, lack of heartbeat/production supervisor, and missing real billing, Storage/RLS, deployment, and device evidence.

## Evidence and review limits

Read the plan, P1 section 4, task-1/task-2 reports, supplied diff, README, and `docs/research/evidence/2026-10-15-t05-worker/results.json`. The latter reports **11 scenarios / 109 assertions passed**, with zero owned children remaining, cluster stopped, and temporary directory removed. Its SHA-256 values match the current lockfile, store, worker, harness, and production state-helper files. The task-2 report also records the completed application verification gate; this review did not rerun it.

No database was started, no passing test suite was rerun, and no implementation, existing evidence, application file, dependency, Git commit, push, or deployment was changed during review. Only this report was written. Findings are based on source/event-order analysis; the failed-process event behavior additionally has the small standalone diagnostic described above. The current successful evidence remains valid for the exercised scenarios, but does not establish the two uncovered edges as correct.
