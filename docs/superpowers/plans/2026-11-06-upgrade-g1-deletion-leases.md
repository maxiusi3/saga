# G1 Durable Deletion Leases Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox syntax.

**Goal:** Persist deletion task ownership, attempts and safe recovery without mutating the accepted deletion capture.

**Architecture:** A private SQL job/attempt ledger and five-action lease RPC sit beside immutable requests/targets. A strict server adapter exposes bounded calls and nontransferable local deadlines. This slice never authorizes physical deletion.

**Tech Stack:** PostgreSQL 17, PL/pgSQL, TypeScript/Jest, existing Supabase client, isolated native Node/pg harness.

**Spec:** `docs/superpowers/specs/2026-11-06-g1-deletion-leases-design.md`

## Global Constraints

- Continue in the inherited `codex/october-upgrade-p0` checkout at `c0669e805`; preserve unrelated dirty work and all prior evidence.
- No stage, commit, push, deployment, remote migration, paid calls, real family data, Storage deletion or metadata purge.
- Local isolated synthetic PG clusters/files and their cleanup are authorized. New evidence uses unique paths under `docs/research/evidence/2026-11-06-g1-deletion-leases/`.
- Do not edit historical migrations or the accepted capture API/SQL; execution is a separate ledger. Root ESLint is canonical; no helper-only Jest suites.
- Each implementer works alone on assigned files; parent owns task/whole-change reviews and final status documents.

### Task 1: Persisted lease and attempt boundary

**Files:** create `supabase/migrations/20261106000004_media_deletion_leases.sql`; create `experiments/pg17-deletion-leases/{fixture,scenarios,verify}.mjs` and README, split native scenarios by responsibility if necessary; modify `scripts/__tests__/deployment-config.test.js` only to append the new migration after `20261106000003_recording_seal_deletion_fence.sql`.

**Interfaces:** SQL and closed receipt are exactly as specified in the design. Export `setup(h, source, migrate=true)`, `lease(client, requestId, action, workerId=null, attempt=null, leaseMs=null)` and `snapshot(h)` from the new fixture. Reuse the accepted deletion-capture fixture without editing it. `setup` applies the actual new migration and records its hash; `snapshot` includes all prior capture fixture rows/synthetic files plus both new tables. The application runner in Task 2 consumes these three exports.

- [x] Write native RED calling `SELECT public.media_deletion_job_lease($1::uuid,$2::text,$3::text,$4::integer,$5::integer)` after actual capture; preserve missing-RPC failure before adding production SQL.
- [x] Implement the two private tables, constraints and service-only routine. Match first-lock fence order, fresh capture validation, exact transitions, immutable capture, complete history/postwrite validation and false capability flags in the spec.
- [x] Native scenarios explicitly exercise claim/start/heartbeat/check/recover; use actual server expiry and independent connections for claims, capture lock waits, tampering while queued and timeout. Force expired fixtures only where labeled; at least one real expiry/timeout and actual lock observation is required. Reuse actual capture and replay before/after every lifecycle group.
- [x] Inject job/attempt INSERT/UPDATE suppression and alteration, plus capture tampering during writes; require full rollback. Validate preexisting malformed history rejection, identity/digest/count drift, actual anon/authenticated denial, and no service direct writes. Keep full before/after rows and bytes; retain all failed diagnostics.
- [x] Run native runner, deployment inventory, Node syntax and canonical root ESLint. Freeze immediate diff/hash/report under this plan workspace. Parent independently reviews this task before Task 2 consumes it.

### Task 2: Strict application calls and recovery integration

**Files:** create `packages/web/src/lib/server/media-deletion-lease.ts`, `packages/web/src/lib/server/__tests__/media-deletion-lease.test.ts`, `experiments/pg17-deletion-leases/verify-adapter.mjs`; extend only the new experiment README. No changes to Task 1 SQL or shared fixtures without a reviewed interface issue.

**Interfaces:** export the five function names and `MediaDeletionLease`/`MediaDeletionLeaseReceipt` in the spec. Active receipts add `deadline:number`; recovery receipts never carry a deadline. All operations set exact null arguments for inapplicable SQL fields.

- [x] Write Jest RED for a successful fake lease RPC and strict argument forwarding; demonstrate missing module before implementation. Add meaningful contract failures for bad keys/capabilities/identities, historical time shapes, inverted microseconds, expiry, mutations, cancellation, hung SDK and response loss.
- [x] Implement exact validation, immutable pinned inputs, process-local monotonic deadline, single no-retry bounded RPC and generic failure. All active operations pin project/subject/digest/count/worker/attempt and enforce expected states. Recover accepts only inactive states. Do not add a Storage import or deletion worker.
- [x] Compile the actual adapter into the isolated native runtime; substitute only pg-backed RPC transport and explicitly assert `.abortSignal`/`.retry(false)`. Exercise real state sequence, a new worker connection after undispatched expiry, a lost start response becoming outcome_unknown after expiry, and unchanged capture replay. Retain full rows and source hashes.
- [x] Run focused Jest, native adapter runner, root type-check and canonical root ESLint. Freeze report/diff/hash; parent independently reviews. Report any specific SQL interface doubt without broadening implementation.

### Task 3: Integration acceptance and handoff

**Files:** create `docs/research/2026-11-06-g1-deletion-leases.md` and evidence index/receipts; update current handoff, docs index and G1 gap only after validation.

- [x] Verify task source hashes and native results, inspect complete lifecycle evidence, and run the full required gate on frozen sources. Restore only a verified build-generated next-env line to the immediate baseline.
- [x] Package complete batch diff and evidence for one independent whole-change review. Resolve actual load-bearing findings in one consolidated correction and scoped re-review.
- [x] Archive final measured inputs, compare every prior evidence hash and unrelated takeover file, verify HEAD/index unchanged and `git diff --check` clean. Retain this plan's recovery workspace while work remains uncommitted.
- [x] Report the concrete durable ownership/recovery behavior and its limits. Keep all G1/physical deletion/GC/backup/full-chain/cloud/device qualification flags false. Set the next engineering dependency to reference-safe operation planning, writer reconciliation and physical-result persistence.

Final local acceptance 2026-11-07: Task1/Task2 independent Spec/Quality PASS; whole-change M1 corrected in adapter/test and scoped re-review PASS. Corrected final-gate-02 and refreshed adapter native evidence pass. Source/archive integrity is recorded in docs/research/evidence/2026-11-06-g1-deletion-leases/verification.json. G1 remains0/9; no physical deletion or remote qualification.
