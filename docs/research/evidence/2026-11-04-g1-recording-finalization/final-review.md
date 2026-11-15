# G1 recording finalization — independent final whole-slice review

Reviewed on 2026-11-05. **Specification: PASS. Quality: APPROVED. Ready to
complete this local slice: YES.** No actionable findings remain from this
review. This assessment does not authorize merge, staging, commit, push, remote
migration, deployment, object/local-draft deletion, or G1 completion.

## Review boundary

Read the binding finalization design first, then its implementation plan,
`CLAUDE.md`, the independent-review rubric, scoped final patch and hash manifest,
both task reports/reviews and the progress ledger. Reviewed the complete new
SQL transaction, application adapter, shared lineage reader, affected
access/export consumers, added tests and native SQL/HTTP harnesses. Read the
inherited lease/candidate contracts and worker behavior to assess integration,
without treating the inherited dirty checkout as this batch's changes.

The review package SHA-256 is
`d318210bef1b89bcd8ec43ce0a60dcda862a5b863ccd86135841f9e516da0c21`.
Independently rehashed all **20** frozen scoped files; all match
`final-review-hashes.json`. HEAD remains
`c0669e8058343f91deba8e468b03e4bf817b1ca5`, and the index is empty. The additional
dependency-order assertion includes only the new finalization migration after
its existing prerequisites.

## Strengths and specification assessment

- **One authority for input and prepared evidence.**
  `supabase/migrations/20261104000001_recording_job_finalization.sql:58` reuses
  the full inherited lease validator; publication then locks and checks the
  prepared candidate before calling the exact prepare replay. That replay
  cannot promote a reserved row because finalization rejects it first. The
  candidate job/project/asset/session/attempt/worker/manifest and exact output
  remain bound to the same validated lease. The failure branch checks every
  candidate for the job while holding the job lock, including other attempts.

- **The SQL and TypeScript terminal contracts agree.** The migration's eight
  arguments, branch-specific nulls, six permanent failure codes, terminal
  states and all receipt fields match
  `packages/web/src/lib/server/recording-job-finalization.ts:48` and `:87`.
  Publication updates asset/job/current attempt/session together and keeps
  candidate/input tuples unchanged. Failure leaves successful verification and
  confirmation fields unset, clears the lease and returns null content fields.
  Before/after clock checks and complete persisted tuple comparisons reject
  late, suppressed or tampered writes. Every receipt retains
  `canClearLocalDrafts:false`.

- **Concurrency and authorization boundaries compose.** The migration at
  `:49` requires READ COMMITTED and at `:56` acquires the deletion table SHARE
  lock before the existing advisory/row lock order. Ordinary tombstone DML
  participates without modifying old writers, including first insertion of an
  absent tombstone. Existing lease locks stabilize current role, ownership and
  input while terminal updates execute. The fixed search path, UTC, bounded
  lock timeout and service-only grants agree with the native ACL checks. The
  cross-project contention and reverse-order abort behavior are explicitly
  documented limitations of this barrier.

- **An uncertain request cannot become success or a second mutation.** The
  finalizer at `:60` snapshots validated scalar inputs before yielding, requires
  a live running lease, and accepts permanent failures only through the
  inherited WeakSet-branded error. The shared request at `:77` propagates abort,
  bounds time by timeout/lease, disables SDK retry and releases timers/listeners.
  Closed receipt validation checks exact identity/content and genuine UTC
  timestamps without losing microseconds. All failed, malformed, cancelled and
  lost outcomes expose only the fixed unavailable error; no fallback fail,
  direct write or deletion path exists.

- **The promoted pointer is consumable without weakening provenance.**
  `packages/web/src/lib/server/recording-asset-lineage.ts:11` resolves one
  immutable candidate by exact bucket/key, validates its prepared identity and
  metadata, and binds it to the expected asset/project. This supports legitimate
  ready/deleting/deleted pointers and rejects corrupt lineage before it can be
  treated as an unrelated omission. The access route at `:45` and shared media
  guard at `:40` include project and candidate-session tombstones before and
  after signing. The export route at `:84` resolves lineage before removal and
  transcript-source decisions, and at `:229` includes those subjects in its
  final deletion read after download/compression/observation writes. Empty
  exports still check project deletion. Hash verification, synchronous limits,
  signed URL TTL and strict legacy URL parsing remain intact.

- **The existing worker remains a separate, prepare-only surface.** Production
  references to `publishRecordingJob` and `failRecordingJob` are currently only
  their definitions. The old verifier/supervisor still perform active-lease
  checks after consumption; finalization is not inserted into those callbacks.
  The compatibility gate exercises the historical compiler graph. The two
  older server bucket edits are type-union extensions, and migration ordering
  retains the inherited entries.

Specification verdict: **PASS**. No unapproved scope expansion or missing
requirement within the local primitive/adapter/lineage slice was found.

## Quality and evidence assessment

The small orchestration transaction relies on established validators rather
than introducing a competing manifest authority. The application exposes
action-specific functions around one request implementation, and the same
lineage reader serves access and export. The duplicate small UTC conversion is
consistent with preserving the inherited compiler boundary. No actionable
maintainability, error-handling or type-safety defect was found in this scope.

The tests cover behavior at the integration boundaries: exact payloads and
receipts, caller mutation across an await, impossible timestamps, real error
branding, no additional calls, and late deletion withholding a signed URL or
ZIP. Native PostgreSQL tests observe actual blocking backends and complete
tuples, including every DML rollback point, lease expiry, duplicate publication,
both deletion/revocation orders, reverse-lock abort and restrictive privileges.
The HTTP harness uses the installed SDK and native fetch against actual
parameterized PostgreSQL mutations and distinguishes rollback from committed
response loss.

Independently checked retained execution records and their integrity:

| Evidence | Observed result |
| --- | --- |
| `task2-focused-final-01` + `task2-input-storage-final-01` | 16 suites / 677 tests; both exit 0 |
| `task2-typecheck-final-01` + `task2-compat-final-01` | Type checking and historical compiler graph pass; exit 0 |
| Final SQL run `sql-only-2026-11-04T16-14-22.203Z-0b981799-c094-4aab-ba08-ab5dbc0ef943` | 15 scenarios / 492 assertions; 166 tuple snapshots; 10 receipts |
| Final HTTP run `http-application-2026-11-04T16-57-11.120Z-0b324a81-c131-4d93-ab8a-e46c007364fc` | 8 scenarios / 278 assertions; 13 SDK fetches and 13 server requests |
| `full-gate.json` / `full-gate.log.gz` | Full command exit 0; type-check/lint, Web 150/2829, shared 4/16, infra 14/14, production 184 pages |

For all five command receipts above, compressed/raw log hashes match, their
recorded source drift is empty, and all **688** current source hashes match each
final manifest. All **21 SQL + 25 HTTP** source files, compressed/decoded source
snapshots and PostgreSQL logs match their native reports. Read the HTTP request
outcomes: malformed receipt, response loss and cancellation after commit retain
SQL success; precommit cancellation/timeout and post-candidate failure roll back.
Each invocation has one request. Native cleanup reports stopped clusters,
removed temporary/socket directories, absent server PIDs, zero clients and no
errors; HTTP cleanup reports no listener, sockets or pending handlers and all
fetches settled.

These are inspected retained execution results, not rerun claims. No suite or
native experiment was rerun by this reviewer, and no uncovered concern required
a narrow reproduction. The parent's separate preservation audit of 2,542 older
evidence files, 1,471 historical inputs and original next-env bytes is recorded
in the handoff; this review did not repeat that historical sweep.

Quality verdict: **APPROVED**.

## Issues

- Critical: none.
- Important: none.
- Minor: none.

## Handoff and readiness

The research report, evidence README, current handoff block and documentation
index distinguish the implemented primitive from the unfinished G1 chain.
Their pending-final-review wording is appropriate before this verdict and can
now be updated by the parent while completing the planned evidence closeout.
The next entry points are concrete: `prepareLeasedRecordingJobCandidate` and
`withRecordingJobLease`, with finalization only after cleanup/revalidation and
heartbeat drain. Successful and branded permanent-failure orchestration still
need deliberate wiring; an unavailable outcome must retain all copies.

Keep the documented residuals: dedicated status/read reconciliation and browser
confirmation, strict terminal seal conflict, physical deletion's stale target
capture, reference-safe candidate GC, candidate backup allowlist coverage,
table-lock contention/large-manifest qualification, full migration replay,
actual PostgREST/Storage, and cloud/device/audio-worker qualification. The HTTP
harness is a PostgREST-shaped local substitute and processes no Storage audio.
Access/export retain optimistic checks; they are not an atomic privacy snapshot.

**Ready to complete the local slice: YES.** The cross-task contracts and retained
verification support this boundary, with no required implementation fix.
`g1Item01Complete`, `g1MilestoneSatisfied` and `pushConditionSatisfied` remain
false. Only this report was written; no implementation, old evidence, index,
branch or HEAD was modified by this review.
