# Storage Behavior Rehearsal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Continue the existing dirty upgrade branch; preserve every earlier batch. No commit/push until the original milestone is achieved.

**Goal:** Close the captured Storage definitions' local behavior gap and produce reviewable migration compatibility evidence.

**Architecture:** A new standalone experiment imports the frozen PG17 runtime and metadata fixture helpers, materializes only the necessary Storage dependencies, then installs the exact private capture in memory. SQL behavior, catalog matching, lifecycle observations and redacted evidence stay separate from application qualification.

**Tech Stack:** PostgreSQL 17.4, Node.js, existing pg dependency; no new packages.

## Task 1: Captured Storage behavior and lifecycle evidence

Files: new `experiments/pg17-storage-behavior/{fixture,scenarios,inputs,verify,verify-lifecycle,pin-inputs}.mjs`, `input-pins.json`, `README.md`; evidence under `docs/research/evidence/2026-10-24-storage-behavior/`. Split scenario modules within this directory only if needed to keep responsibilities clear.

- [x] Verify fixed snapshot/capture digests and create independent missing-trigger/partial-enum RED probes. Read the binding [specification](../specs/2026-10-24-storage-behavior-rehearsal.md), whose six numbered sections are the acceptance matrix.
- [x] Reuse `Harness` from `experiments/pg17-routines/runtime.mjs`; reuse catalog materialization helpers where appropriate without editing them. Install exact definitions only after digest/identity validation, retain raw text solely in memory, and record owner/member substitutions as synthetic.
- [x] Implement all six behavior/catalog sections with independent expected values and complete failed-statement state checks. Use `h.scenario`, `h.eq`, actual role connections/SET ROLE and SQLSTATE checks; no business mocks.
- [x] Run `node experiments/pg17-storage-behavior/pin-inputs.mjs`, then `node experiments/pg17-storage-behavior/verify.mjs --red`; expected successful RED-observation report, with each original incompatibility established.
- [x] Run `node experiments/pg17-storage-behavior/verify.mjs`; expected passed behavior report and complete cleanup. Keep development failures separate.
- [x] Run `node experiments/pg17-storage-behavior/verify-lifecycle.mjs`; expected passing normal-hostile-environment, actual SIGTERM, startup-failure and connection-failure observations, including external cleanup checks.
- [x] Independent spec review, fixes/recheck, then independent quality review, fixes/recheck. Preserve reports and exact source pins.

## Task 2: Migration reconciliation and handoff

Files: new `docs/research/2026-10-24-storage-behavior-and-migrations.md` and evidence summary; update `docs/HANDOFF-2026-10-13-upgrade.md`, main plan, preparation plan and docs index.

- [x] Compare the seven unregistered root migrations against fixed captured schema/policies/routines/ACL/trigger metadata. State semantic mismatches and unobserved data effects per migration; table-name presence is not equivalence. No repair or SQL replay on remote.
- [x] Verify prior 810 application-input hashes/logs and preserve 10月23日 verification as historical reuse if unchanged; if application inputs change, run required project checks. Do not relabel old tests as new runs.
- [x] Record current local results, precise production/HTTP/role/backup limits, remaining P0 and next concrete implementation work. Keep original milestone false unless its original evidence is actually satisfied.
- [x] Final independent scoped review and file/link/input integrity check; update handoff with results and conditional push decision.
