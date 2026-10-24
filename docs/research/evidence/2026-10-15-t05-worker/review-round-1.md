# T05 scoped re-review — round 1

Reviewed 2026-10-15. Scope is limited to the two findings in `review.md`, `fix-round-1.diff`, the related README changes, and new breakage introduced by that fix. No historical application review was reopened.

## Verdicts

- **Original finding 1 — ADDRESSED.** `store.mjs:205–209` now accepts the clock function and samples it after the business row lock is acquired. All four guard call sites pass the function. The logical review clock remains intact.
- **Original finding 2 — ADDRESSED.** `verify.mjs:65–110` recognizes `close` and failed creation without a PID as terminal, bounds termination waits, and records failures while allowing owned-cluster cleanup to continue. The failed-fork path no longer depends on an `exit` event.
- **Spec compliance — changes required:** one new P2 cleanup issue in the nested regression harness.
- **Code quality — changes required:** the same one new P2 correctness issue; no additional findings in this scoped fix review.

## New finding in the fix diff

### [P2] Register the nested cluster with outer cleanup before killing its harness

**Location:** `experiments/t05-durable-worker/verify.mjs:239–249`, with the interaction at `verify.mjs:96–101`, `264–289`, and `295–297`.

The new fork-failure regression launches another harness that owns its own PostgreSQL cluster. That cluster's path is held only in the regression-local `ownedScratch`, and its fallback shutdown is conditional on `!closed`. Global cleanup knows only about the outer cluster and applies `SIGKILL` to every tracked child, including this nested harness.

A concrete failure is `SIGTERM` or `SIGINT` delivered to the outer harness while the nested cluster is running, before its normal cleanup finishes. Outer `cleanup()` kills the nested harness, preventing its own `finally` from stopping PostgreSQL. The nested child's `close` event sets `closed = true`; the regression's `finally` therefore skips its fallback cluster shutdown. The global cleanup then stops/removes only the outer `scratch` and exits. The nested PostgreSQL daemon and its separate `/tmp/saga-t05-*` directory can remain. An unexpected nested-harness exit after cluster startup has the same missing fallback.

This is new behavior introduced by adding a child harness that owns a database; the preexisting worker children did not own independent clusters. It violates the plan's owned-process/cluster cleanup-on-exit requirement and the README's signal-cleanup claim. The normal injected-fork-error evidence passes because the nested harness reaches its own `finally`; it does not cover interruption of the outer harness.

**Fix:** place the known nested cluster lifecycle in the outer harness's shared cleanup registry, with ownership registered before startup and idempotent stop/removal after child termination regardless of its exit reason. Ensure signal cleanup awaits that registry before `process.exit`. A graceful shutdown attempt for nested harnesses may help, but force-kill fallback must still clean their owned clusters. Add a focused regression that interrupts the supervising harness while a nested cluster is demonstrably active and verifies both clusters/directories are gone. Use exact registered owned paths only.

## Evidence checked

- Read the implementer's appended RED/GREEN report. The lock-contention RED recorded one unexpected simulated call; GREEN recorded zero calls with durable unknown recovery. The failed-fork RED timed out as expected; GREEN exited with the expected inner failure status and complete inner cleanup.
- The refreshed `results.json` records **13 scenarios / 125 assertions passed**, including the real row-lock wait crossing the lease deadline and the nested failed-fork cleanup scenario. Both the nested scenario and final outer cleanup record zero children, stopped cluster, removed temporary directory, and no cleanup errors.
- SHA-256 values in the evidence match the current store, harness, worker, lockfile, and production state helper. `worker.mjs`, the lockfile, and the production helper remain unchanged from the first review.
- The README documents the test-only `before_dispatch` boundary and targeted/internal regression flags. The added checkpoint leaves the durable running-before-dispatch ordering intact and is auto-continued by the existing worker protocol in other scenarios.

No tests or databases were rerun, no agents were spawned, and no implementation, dependencies, existing evidence, commits, pushes, or deployments were changed. Only this re-review report was written. The new finding is based on the concrete signal/child-close/cleanup control flow above, not a claim that the supplied successful run failed.
