# Independent RLS rehearsal follow-up review

2026-10-17. Verdict: **changes requested — two P2 findings; no P0/P1 finding identified in the reviewed scope.**

This review covers only the five uncommitted files in `experiments/rls-rehearsal`. BASE and HEAD are both `1caa21a72a23d6f5166ed127847ca931374b890a`; an empty commit diff is not treated as a review of the historical dirty worktree. The brief, review package, package source manifest, experiment README, [implementation record](../../2026-10-17-rls-rehearsal.md), latest handoff and P1 authorization contract supplied the requirements. Existing media-reference/project-access source was read only to resolve the referenced canonical authorization contract, not reviewed as a new change.

The review did not mutate source, Git state or historical evidence, read credentials, or contact remote services. No passed suite was rerun and no further agents were spawned. Only this new review report was written. The findings below are static code analysis, not newly executed failure reproductions.

## Spec finding

### R1 — P2: Match the full canonical key whitespace rule

Location: `experiments/rls-rehearsal/candidate.sql:46` (with the control-character check at lines 48–49). Missing regression coverage: `experiments/rls-rehearsal/scenarios.mjs:252–280`.

The SQL rejection list for leading/trailing whitespace contains ASCII whitespace, NBSP and BOM, but omits other characters removed by JavaScript `String.prototype.trim()`, including U+1680, U+2000–U+200A, U+2028, U+2029, U+202F, U+205F and U+3000. These also pass the subsequent `ascii(ch) < 32` / `127..159` check. For example, an authenticated synthetic storyteller can supply their own valid UUID prefix followed by `/temp/new.webm` and a final U+3000: `object_readable` reaches the private-owner branch and `object_insertable` accepts it. The same exact key is rejected by the existing `parseMediaReference` predicate `path !== path.trim()` at `packages/web/src/lib/media-reference.ts:17`.

This contradicts README lines 20–21 and P1 section 2 (`docs/superpowers/specs/2026-10-13-upgrade-p1-contracts.md:24`), which require the canonical media key boundary. It creates direct Storage uploads that the protected signing/processing API refuses, even though their bucket and user scope are otherwise valid. This finding does **not** claim cross-family access.

Requested fix: make the SQL boundary reject the complete established ECMAScript trim set without normalizing the stored key. Add representative Unicode edge-whitespace cases to the SQL denial matrix and check that those same cases are rejected by the existing parser. Keep ordinary interior Unicode filename characters valid where the current contract allows them.

## Quality / harness finding

### R2 — P2: Coordinate signal shutdown with pending initialization

Locations: `experiments/rls-rehearsal/verify.mjs:184–192` and `experiments/rls-rehearsal/verify.mjs:226–241`; cleanup tests currently enter through lines 293–297.

`emergency()` sets `finished` and starts cleanup while the main `try` block continues independently. In particular, `scratch` is assigned only after `await mkdtemp(...)`. A SIGTERM delivered while that filesystem operation is pending makes cleanup observe an undefined `scratch`; the operation can nevertheless create its directory and then resolve. There is no cancellation check after the await, and the main `finally` skips cleanup because `finished` is already true. The new directory therefore has no guaranteed cleanup owner. Main initialization can also keep progressing while the signal handler awaits its evidence write, and a concurrent main-path failure can replace the intended `interrupted` status.

This violates README lines 33–35's signal-cleanup claim. The saved SIGTERM run is valid for its actual `synthetic_fixture_ready` injection point, where allocation and setup have already completed; it does not exercise this acquisition/shutdown race.

Requested fix: make signal handling request cancellation, settle/stop the main setup path and all pending resource acquisition, and then perform one final cleanup/report write. Any resource created after cancellation must still be registered for that cleanup, and the main body must not begin another setup step after shutdown is requested. Add a deterministic signal/cancellation case while directory acquisition is pending, asserting that every allocated directory is removed, no postmaster remains and the final report keeps its interruption status. Preserve the existing stable-fixture SIGTERM case.

## Verified evidence and accepted scope

The five current source SHA-256 values match both the review package manifest and both final reports:

| File | SHA-256 |
|---|---|
| README.md | `492b5c80d943c8be4b465cc791a0f8a9c33e3861a34c5aa52f6d50efd5d3efa1` |
| candidate.sql | `5375ceef7810fd373998883fb36ff05743f12334bf7a35e302687eeca17019cd` |
| fixture.sql | `d70b14d3f789f10fcf3f37c40767b0e877fbb5f6851cf83ef41d01d625e9f550` |
| scenarios.mjs | `67786579cf79c8c43b40163c5ec24bd80e95ad75c9203399a7c900cf2f7ceb1f` |
| verify.mjs | `1b2909f3197aae833f039f174b764c94adbe78073ba729e819cde0a8cf684380` |

- [Normal final report](run-1792208657930-45113.json): `passed`, 61 scenarios / 199 assertions, no failed scenarios. Its SHA-256 matches `verification.json`: `ccddb9cc9f09e1f40eff221a2e6ef385219bef6c5381aa4f29937729fcba43a0`.
- [SIGTERM final report](run-1792208657922-45114.json): `interrupted`, `SIGTERM`, phase `synthetic_fixture_ready`. Its SHA-256 matches `verification.json`: `08afc9fd86e3c6aa948c6864d1cd661220f10b9c967462aa6c4ebc2bdd756770`. The verification index records exit 143.
- Both record PostgreSQL 14.17, Node 22.22.2 and pg 8.16.3, `clusterStopped=true`, `tempDirectoryRemoved=true`, `clientsRemaining=0`, `errors=[]` for their actual runs.
- The saved metadata snapshot matches the runner's pinned SHA-256 `bb808a1ce050947d21963ca91ec49c3adfa0ab80fe24f24f653f8c18bc6e6a4f`. The final normal report distinguishes full-graph 42P17 from the five observations with dependency RLS disabled. Candidate verification explicitly re-enables those tables first.

Within the local fixture, the qualified SECURITY DEFINER helpers, fixed search path, schema/function permissions, current-membership lookup and command-specific restrictive policies are coherent. The retained project/role management predicates were inspected for a direct self-enrollment bypass; the saved writes require the project's facilitator and no such bypass was identified. Project-owner access is an explicit existing contract, not an accidental exemption inferred from inactive role status.

The ordinary managed-object UPDATE/DELETE/overwrite restriction and raw story DELETE restriction are deliberate, documented boundaries. They are consistent with immutable asset identity and deletion orchestration in P1 sections 3 and 5; they are **not** counted as missing ordinary-client features in this rehearsal. The immutable-story trigger prevents an otherwise authorized writer from moving a story to another project. READ COMMITTED and already-established REPEATABLE READ behavior are accurately distinguished.

No production acceptance follows from this review: Storage HTTP, JWT gateway trust, complete production schema/ACLs/triggers, PostgreSQL 17, privileged adapters, consent/tombstones, backup/rollback and old-client compatibility remain explicitly outside this candidate's acceptance. The prior rate-limit status and historical test files were left intact. This report completes the independent review attempt, but the two findings remain open and the candidate should not be recorded as an independent PASS yet.

Standards/quality axis: one P2 finding (R2). Spec axis: one P2 finding (R1).
