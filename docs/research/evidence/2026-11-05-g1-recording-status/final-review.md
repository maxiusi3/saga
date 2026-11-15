# G1 recording status — final whole-slice review

Date: 2026-11-05 (Asia/Taipei).

**Spec verdict: Approved. Quality verdict: Approved.** No Critical, Important,
or new Minor finding remains in the reviewed slice. The two Task 1 evidence
findings are resolved, and both tasks' cross-task evidence conditions are now
satisfied. Final controller receipt generation follows this review; G1 and push
conditions remain false.

## Review scope

- Applied the `requesting-code-review/code-reviewer.md` final review template.
  Reviewed the binding design and all three tasks in
  `docs/superpowers/specs/2026-11-05-g1-recording-status-design.md` and
  `docs/superpowers/plans/2026-11-05-upgrade-g1-recording-status.md`.
- Base and current HEAD are both
  `c0669e8058343f91deba8e468b03e4bf817b1ca5`. The review scope is the inherited
  working-tree takeover, not a clean-HEAD diff. Independently reconstructed the
  20-file, 1859-line `final-review.patch` against its saved before bytes; every
  reconstructed file equals the current file. Patch SHA-256:
  `7b9d564adf282d366c9c7bb7e73ee7bfb3a033fa3c8ee96b0aca5d32b2e7d855`.
- All **15/15** frozen production, test, fixture and harness files match
  `.superpowers/sdd/2026-11-05-upgrade-g1-recording-status/final-review-hashes.json`.
  That manifest's SHA-256 is
  `e21acf9772a07673abd668b4c5b362c4a4bd7c45c09ec8687dd49c6964d07d43`.
- Inspected the current research report, handoff/index delta, evidence README,
  implementation ledger, both task reviews, the initial Task 1 findings, final
  native records, full-gate records and planned `closeout.py` receipt writer.
  No suite, native harness or historical evidence writer was rerun. Review
  execution was read-only apart from creating this report.

## Strengths

- **One authorized, read-only observation.** The snapshot migration at
  `supabase/migrations/20261105000001_recording_session_snapshot.sql:5` is STABLE,
  SECURITY DEFINER, fixed to the trusted search path and UTC, and requires READ
  COMMITTED. Its single envelope query checks the existing actor/project/session,
  active storyteller role, optional story ownership and deletion subjects
  together. It has no mutating helper or write/advisory lock. PUBLIC, anon and
  authenticated execution are revoked; native evidence verifies service access,
  READ ONLY execution, ordinary AccessShare locks and unchanged table ACLs.
- **Corruption remains visible to the validator.** The SQL limits at
  `supabase/migrations/20261105000001_recording_session_snapshot.sql:52` expose
  excess sessions/jobs/attempts/candidates/chunks using 2/2/4/4/2001 sentinels.
  Related foreign-identity rows are retained. The application independently
  requires the exact 13-key envelope, a single session binding and valid row
  cardinalities at `packages/web/src/lib/server/recording-status-validation.ts:153`.
- **Terminal classification agrees with the existing writers.** Manifest/hash,
  deterministic seal identity, physical chunk paths and immutable asset/job
  metadata are checked before classification. The attempt and candidate helpers
  enforce contiguous undispatched retry history, current worker/attempt binding,
  real UTC dates and microsecond ordering. Success requires the prepared
  candidate and the complete published asset/job/attempt/session tuple; permanent
  failure requires one of the six existing codes, the original quarantined asset
  pointer and no candidate. Partial terminals reject. See
  `packages/web/src/lib/server/recording-status-validation.ts:68`, `:93`, `:167`
  and `:213`.
- **Unresolved preserves the recovery boundary.** Sealed-only and asset-only
  registration states, active/expired leases and the exact existing recovery
  histories remain unresolved at
  `packages/web/src/lib/server/recording-status-validation.ts:111` and `:190`.
  Generic failures or successful-content fragments cannot become a trusted
  terminal receipt. No branch recovers, seals, publishes, signs or deletes.
- **The HTTP boundary preserves identity and cancellation.** The small reader
  snapshots scalar input/options, makes one RPC with `abortSignal` and
  `retry(false)`, races interruption and returns fixed unavailable diagnostics
  (`packages/web/src/lib/server/recording-session-status.ts:10`). The GET derives
  actorId from verified authentication, requires the exact enabled flag, rejects
  duplicate/unknown arguments, forwards request.signal, selects 200/202/400/404/
  503 correctly and preserves every auth cookie with no-store
  (`packages/web/src/app/api/recordings/sessions/[sessionId]/status/route.ts:13`).
  The only receipt fields are the specified 12, and every receipt retains
  `canClearLocalDrafts:false`.
- **Regression and evidence preservation are concrete.** Existing manifest
  parsing/hashing and candidate validation are reused. The original 13,735 bytes
  of `recording-job-input.ts` remain intact, followed only by 393 bytes of pure
  exports. The historical compiler graphs and exact-source full gate passed.
  The current report and handoff distinguish this local slice from the remaining
  client, cleanup, cloud and device work.

## Cross-task resolution and independently checked evidence

Evidence paths in this section are relative to this report's directory.

| Evidence | Independently checked result |
| --- | --- |
| `task2-focused-green.log:6` | 5 suites / 564 tests; the source report identifies 225 new reader/route cases. The fixture-move rerun retains 225 passing cases. |
| `task2-legacy-verifier-command.json`, `task2-legacy-candidate-command.json` and logs | Both historical compiler commands exit 0 and report executable dependency graphs. Original loader prefix and all 7 final Task 2 source archives match current bytes. |
| `full-gate-02.json`, `full-gate-02.log:34`, `:225`, `:387`, `:483` | Exit 0; Web153/3100, shared4/16, infra14,184 built pages. All 724 before/after source hashes match each other and current files. Raw/gzip log hashes and decoded contents match. |
| `native-sql-2026-11-05T09-26-15.086Z-dbd5ed7b-1d35-4c19-913c-da74fa582bbc/results.json` | 5 scenarios / 191 assertions; all 41 complete before/after tuple pairs equal. Two STABLE calls in the same statement retain the old tuple across a real atomic publish; the next statement sees the complete committed success. Current revocation/tombstone and stale-isolation cases reject. |
| Same final SQL record and archives | All 58 source hashes match current files. All 64 source/runtime archives plus the PG log pass compressed and decoded SHA-256 verification, including 6 loaded compiled modules. |
| `native-http-2026-11-05T09-33-17.998Z-3ae4565f-fc32-4849-93d1-ab65ad742d37/results.json` | 4 scenarios / 585 assertions; all 27 complete tuple pairs and copy comparisons equal. Saved synthetic files match their lengths/hashes. Exactly one explicit publication request commits before response loss; the following 26 snapshot requests are READ ONLY, with no extra mutation or retry. |
| Same final HTTP record and archives | All 110 source hashes match current files. All 123 source/runtime archives plus the PG log pass compressed and decoded SHA-256 verification. All 13 production graph modules are archived. |
| Final interruption and cleanup records | The 100ms timer takes 101.611129ms with callerAborted=false; explicit caller abort takes 16.244543ms with callerAborted=true. Both reach native fetch/peer closure without a finished response. Zero sockets, handlers, clients or fixture errors remain. Both PG scratch/socket paths are absent and server PIDs are gone. |

The **compiled-runtime archive finding is resolved** by canonical scratch-path
matching and required archive coverage in
`experiments/pg17-recording-status/verify.mjs:68` and `:91`. The **false-timeout
finding is resolved** by restricting the caller checkpoint to abort mode at
`experiments/pg17-recording-status/http.mjs:52` and asserting independent timer
behavior at `experiments/pg17-recording-status/application.mjs:92`. Cleanup now
waits for actual tracked socket close events (`http.mjs:94`).

The actual missing-RPC 42883 RED, archive-presence RED at 09:24 and false-timeout
RED at 09:30 remain present. The latter records the old callerAborted=true result
and one-socket cleanup observation. These are superseded by the final 09:26 SQL
and 09:33 HTTP records, with unchanged application source hashes. Task 2's native
pending note is therefore closed. Task 1's application/compiler/full-gate pending
notes are closed by Task 2's final review and full-gate-02. The first full-gate
empty-fixture failure remains preserved, and the corrected default discovery is
verified by the full 153-suite gate.

## Preservation and named dependency checks

- Independently compared all **4,447 takeover files**. Exactly the four allowed
  inherited files changed: the appended job-input exports, migration-order test,
  handoff and documentation index. All **3,393 prior evidence files** are intact.
  The compressed baseline and prior-evidence maps decode to the saved controller
  baseline. HEAD is unchanged, the index is empty and `git diff --check` passes.
- Confirmed `next-env.d.ts` equals the saved original bytes. The recorded
  restoration concerns only the generated root-params import.
- Checked the existing pure seal preparation, closed manifest/canonical hash
  logic, candidate receipt validator, lease state-writing branches and atomic
  finalization updates against the new reader. In particular, recording_sessions
  has no separate failure-finish timestamp: permanent failure compares asset/job
  updated_at and attempt finished_at while session confirmation fields stay null,
  as documented in the implementation ledger.
- Checked existing auth failure handling and `withMediaHeaders`; the GET's
  cookie/no-store handling agrees with these helpers. Current Supabase source
  documentation confirms abortSignal propagation and disabled retry semantics;
  the retained tests/native transport demonstrate those behaviors on the
  installed client.
- Inspected the planned `closeout.py` checks and exclusive receipt writes.
  `integrity.json`, `source-lock.json` and `verification.json` are intentionally
  generated by the controller after this verdict. This review independently
  verifies their underlying preservation/source/native evidence, and does not
  claim those not-yet-written receipts already exist.

## Issues

### Critical (Must Fix)

None found.

### Important (Should Fix)

None remaining. Both initial Task 1 Important evidence findings are resolved.

### Minor (Nice to Have)

No new Minor issue in the scoped source. The previously reported Next configuration
and optional-environment warnings remain visible at `full-gate-02.log:61` and
`:73`. They are inherited qualification limits and are disclosed in the current
research report; the successful gate is not described as warning-free.

## Recommendations

Proceed with the planned controller closeout, binding this report and the final
documents to the checked source/evidence hashes. Complete the plan checkboxes and
append the integrity outcome once those receipts are written successfully.

Keep the documented qualification boundary: native PG is real, while the HTTP
peer, authorization prerequisites and media copies are synthetic. Managed
PostgREST/Storage/JWT/TLS, full migration replay and cloud/device long-recording
qualification are not established by this slice. Client confirmation, idempotent
story save, safe local cleanup, deletion/GC and candidate backup remain later
work. A statement snapshot grants neither a future access capability nor cleanup.

## Assessment

**Ready to merge? Yes, on the reviewed slice's specification and code quality.**
The authorized workflow remains local closeout, with no stage, commit, push or
deployment and with G1/push gates false.

**Reasoning:** The SQL authorization snapshot, strict reconciliation and GET
boundary agree with the persisted writer contracts and are supported by exact
source regression/native evidence. No implementation fix remains; the controller
can complete the already-planned integrity/source-lock/verification receipts.
