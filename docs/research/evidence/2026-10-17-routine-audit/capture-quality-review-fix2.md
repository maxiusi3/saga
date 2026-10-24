# Task 1 collector quality review — Fix 2

**SCOPED PASS — P2 closed; no remaining quality finding in the reviewed collector scope.** Re-reviewed on 2026-10-17. This closes the startup-failure cleanup finding in [the initial quality review](capture-quality-review.md); that review's production scope and limitations remain unchanged.

The [startup-attempt flag](../../../../scripts/__tests__/inspect-supabase-routines-local.test.cjs#L111) remains set before starting PostgreSQL, covering a start timeout that leaves a server running. [Cleanup](../../../../scripts/__tests__/inspect-supabase-routines-local.test.cjs#L86) now checks bounded `pg_ctl status` first. Exit 3 permits removal without issuing stop; exit 0 requires successful bounded stop and another status 3 before removal. Unknown status, unsuccessful stop or a still-running server throw before deletion. An initdb failure has no start attempt and can remove its owned scratch. Both [signal cleanup](../../../../scripts/__tests__/inspect-supabase-routines-local.test.cjs#L103) and [ordinary cleanup](../../../../scripts/__tests__/inspect-supabase-routines-local.test.cjs#L153) remove SIGINT/SIGTERM listeners in `finally`, including cleanup failure.

Inspected the [seven new regressions](../../../../scripts/__tests__/inspect-supabase-routines-local-cleanup.test.cjs#L64). They evaluate the actual harness callback with fake subprocess outcomes and a real owned temporary directory, asserting removal for confirmed absence and retention for live/unknown states, plus listener/environment restoration. The test runner removes fake retained trees only after those assertions; no real database is involved in these cases.

Read the supplied RED (**6 failed / 1 passed**), cleanup GREEN (**7/7**) and hostile-environment full GREEN (**52/52**, including the PG16 fixture), and the verification record. No new test run or database access was needed for this scoped rereview. Independently recomputed the fingerprints below: the two Fix 2 sources match their frozen hashes; all three production files, the existing metadata/routine tests and `.gitignore` retain the initial reviewed bytes. Existing environment isolation and lifecycle time bounds remain intact.

No implementation edits, credential reads, remote calls, dependencies, commits or subagents. Only this closure report was written. Actual remote capture, routine semantics and PG17 verification remain outside this review.

## Reviewed source SHA-256

| File | SHA-256 |
|---|---|
| `scripts/__tests__/inspect-supabase-routines-local.test.cjs` | `9fd8a6badb57df3d880c4b6c46c1ce7ecde98719324aed891eee993624b57e1b` |
| `scripts/__tests__/inspect-supabase-routines-local-cleanup.test.cjs` | `05c1073dbf458a76abf69aeb4f7a2e1ca65d0590d8fdbceefe40ae8e233b6554` |
| `scripts/inspect-supabase-routines.cjs` | `f838b8762324302073bdfc657551069666357b9a2bd66299a3fe2f6ec4d4f928` |
| `scripts/supabase-capture-runtime.cjs` | `6b6e2ed78758076af37cb6fa2383d61f0e07090b32d44288b3abe46c6e15353a` |
| `scripts/inspect-supabase-metadata.cjs` | `be8f08d62a6ac3fcae20911f8b6569dab8f6a52bb2e099a233855ac63f8e27d2` |
| `scripts/__tests__/inspect-supabase-routines.test.cjs` | `0bd3c95ca57d60566ca0bf3df46d33866f03f03d005d81b0d42b9ad0b6adbdc8` |
| `scripts/__tests__/inspect-supabase-metadata.test.cjs` | `772cf50cb7fa3d5cfbc9c07400a842b5dbe9039db37f83504a64d0e00406686a` |
| `.gitignore` | `d32441029111fe11e841724d2cc515f05029d6d46160336239acd0c034d1ef67` |

## Reviewed evidence SHA-256

| File | SHA-256 |
|---|---|
| `capture-fix2-red.tap` | `0c6c8f062f6249ff29b6b33bf5128116ce516a880e89e642af42bac736819cdb` |
| `capture-fix2-green-cleanup.tap` | `ca781ded988f2bb81f06810eba184bd1b5b24277879a10ddd180e991e62ad8f3` |
| `capture-fix2-green-hostile.tap` | `390255a35201d02a4c8f1f3c1fb981ad43eb023862cee4ee4f8250c2746cf0a4` |
| `capture-fix2-verification.json` | `03e45f98e9d9f171f284f1a789256f31b1eca9efaa5aac4128e16471bb33e980` |
