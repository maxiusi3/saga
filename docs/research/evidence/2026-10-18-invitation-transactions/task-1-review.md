### Spec Compliance

- ✅ **PASS — Task 1 is spec compliant.** The supplied batch-only diff implements all five operations, typed reservation/request facts, canonical tokens, strict TABLE result decoding, the pinned invitation fixture, real database failure/concurrency scenarios and final immutable verification evidence. Scope is the isolated candidate described by `docs/superpowers/specs/2026-10-18-invitation-transactions.md:5`, not production readiness.
- ✅ Candidate isolation and access boundaries match the contract: independent database/marker guards, private schema owner, inaccessible tables and exact authenticated function grants (`experiments/pg17-invitation-transactions/candidate.sql:2`, `:60`, `:286`); actual catalog/ACL and original-public-definition preservation are asserted by `experiments/pg17-invitation-transactions/scenarios.mjs:856`, `:939`.
- ✅ Send, accept, release and recovery behavior match the requested state machine: immutable payload deduplication, no second reservation/activation charge, durable member mapping, current-facilitator cleanup and read-only status/lookup (`experiments/pg17-invitation-transactions/candidate.sql:162`, `:218`, `:243`, `:265`). The real commit-and-discard recovery exercise is at `experiments/pg17-invitation-transactions/scenarios.mjs:781`.
- ⚠️ **Controller-owned gates are outside this task diff:** prior 707-input application-test reuse, unchanged audit failures, whole-batch review, final workspace preservation and handoff/plan/index/P0/P1 closure (`docs/superpowers/specs/2026-10-18-invitation-transactions.md:75`). They must remain separate from this Task 1 approval. Real JWT/payment integration, migrations, backups, delivery and device evidence are expressly outside the candidate (`experiments/pg17-invitation-transactions/README.md:3`, `:15`, `:17`, `:31`).

### Strengths

- One shared persisted-invitation loader enforces the project → auth → invitation → wallet → source/binding → member order, then validates the protected fields, resource/log associations and current membership. Auth uses `FOR NO KEY UPDATE`, preserving identity-update exclusion without conflicting with later foreign-key key-share locks (`experiments/pg17-invitation-transactions/candidate.sql:90`). The former deadlock is preserved as an actual `40P01` failure, and the final three-connection regression requires both independently funded operations to succeed (`experiments/pg17-invitation-transactions/concurrency.mjs:391`).
- Full-table snapshot comparisons support rejection and atomicity claims; real CHECK failures cover every operation's writes and caller rollback is explicit (`experiments/pg17-invitation-transactions/scenarios.mjs:48`, `:146`, `:635`). Repeated acceptance refuses inactive, changed or deleted members instead of recreating access (`experiments/pg17-invitation-transactions/scenarios.mjs:562`).
- Concurrency observations use `pg_locks` and `pg_blocking_pids`, including both orders for project, identity, source and member changes. They verify the failed operation adds no writes (`experiments/pg17-invitation-transactions/concurrency.mjs:26`, `:223`, `:486`).
- Protocol errors retain only safe SQLSTATE rejection codes, while malformed results and uncertain transport become `unknown`; required fields and operation outcomes are checked (`experiments/pg17-invitation-transactions/protocol.mjs:15`, `:48`). Verification never rewrites pins, and lifecycle checks distinguish expected failing child exits from a successful cleanup observer (`experiments/pg17-invitation-transactions/verify.mjs:45`, `experiments/pg17-invitation-transactions/verify-lifecycle.mjs:109`).

### Issues

- **Critical:** None.
- **Important:** None.
- **Minor:** None.

### Checks

- Reviewed the supplied 4,230-line batch diff in passes. Reconstructed all 14 added files from the diff and compared their complete bytes with the current files: every file matches. Earlier uncommitted upgrades were not used as this task's diff.
- Named risk — evidence/source drift: independently matched the manifest's 24 direct inputs, 44 CommonJS/package inputs, 743 PostgreSQL files, input-pins file and all 27 owned evidence artifacts. All 868 references encountered, including repeated references, matched. The input-pin maps equal the implementation manifest maps (`docs/research/evidence/2026-10-18-invitation-transactions/implementation-verification.json:1`).
- Inspected the raw final normal and lifecycle reports: normal and hostile runs each record 158 passing scenarios, 2,288 harness assertions, 33 real concurrency cases and 282 unchanged complete-state checks. All 33 normal-run concurrency entries contain an observed blocking PID. Four lifecycle cases record expected child exits 0/143/1/1, zero remaining clients, removed allocations, stopped clusters, empty stderr and no rescue (`docs/research/evidence/2026-10-18-invitation-transactions/implementation-verification.json:834`, `experiments/pg17-invitation-transactions/verify-lifecycle.mjs:128`).
- Read the final protocol TAP: 18 tests passed, no failures/skips/cancellations. Inspected the original token-signature RED (`42883`, zero writes) and the actual pre-fix auth/FK deadlock (`00000`/`40P01`) separately from final passing results. Scanned all 27 owned evidence artifacts: no canonical token strings. No test suite was rerun.
- Reviewed diff SHA-256: `59e8f250149ace748afba7d08a48e8a0366bb75ad203cc99f1e88440d28423a5`.
- Binding spec SHA-256: `0b003e13cc4a80c22aa784ed8a2d330685af6088daa3c17d0810d32c00cda9df`.
- Implementation manifest SHA-256: `28a007ff93595ad7746c92e25412234b9f71347c18987c94ddced88032d8b501`.

### Assessment

**Task quality: Approved — PASS.** Critical 0 / Important 0 / Minor 0.

The shared validation path, atomic state transitions, persisted request/member facts and real lock/failure evidence support the local candidate's contract. This approval does not change the original production or G0/G1 milestone gates.
