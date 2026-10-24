# Invitation management whole-batch independent review

Reviewed 2026-10-22 (Asia/Taipei) on `codex/october-upgrade-p0`, HEAD `1caa21a72a23d6f5166ed127847ca931374b890a`. Scope: the 19 frozen source files in `source-sha256.json` and the twelve current documents enumerated by the Task 3 review brief. The upgrade is intentionally uncommitted, so this assessment uses the exact working-tree source and documentation diffs rather than an empty commit range.

The reviewer was independent of both the implementation and documentation authors. **The same reviewer conducted this whole-batch assessment and `task-3-review.md`; these are distinct scopes, not independent opinions from two reviewers.** The separately assigned documentation reviewer was interrupted without a report or verdict and contributes no approval. The earlier October 21 implementation review remains separately preserved.

## Verdicts and findings

- **Spec compliance: PASS** for the reviewed local invitation-management batch.
- **Quality: Approved.** Critical: 0; Important: 0; Minor: 0. No supported actionable findings remain.
- **Local readiness: ready for closeout.** No additional implementation change is required by this review. The controller still must record the actual review reports in current status documents and pass the final integrity check over that resulting state. Approval here does not assert that future bookkeeping or its integrity check has already occurred.
- **Original milestone/release readiness: not passed.** P0 and G0–G4 remain false. No commit/push, merge, migration, deployment or production enablement is justified by these local results.

## Cross-layer assessment

| Contract | Current source and assessment |
| --- | --- |
| Trusted source selection | `experiments/pg17-invitation-management/candidate.sql:24` verifies the durable grant event, ledger identity and purchase audit. At line 40, source reads require confirmed current facilitator authority, an active project, matching actor/role, verified/unrevoked positive availability, a positive wallet mirror and no storyteller member/reservation conflict. Results are ordered and capped at 100. The snapshot does not reserve a seat; the existing sender retains atomic write authorization. |
| Bound management history | `candidate.sql:65` authorizes the current facilitator without requiring an active project or unrevoked source. It validates the entire bound history before pagination, including payload, reserve/release/activation audit, request mapping and surviving accepted-member identity. It permits inactive/deleted accepted membership as history. Unbound invitations are excluded; the eight-field projection exposes only the current actor's request mapping and no token/message/provider data. UUID pagination remains ordered, exclusive and capped at 50. |
| Database boundary | `candidate.sql:3` requires both the local database name and independent marker; lines 42, 67 and 124 establish STABLE SECURITY DEFINER ports with empty search paths and authenticated-only execution. The new helpers remain non-public, and no direct table grants are added. The scenarios exercise actual low-privilege sessions and read-only transactions. |
| HTTP boundary | `packages/web/src/lib/server/invitation-management.ts:20` refuses before body or external I/O unless both flags are exactly `true`. It validates input, verifies the Bearer through provider `getUser`, then invokes the matching restricted RPC with a per-request anon client and the same Authorization. Body/auth/RPC share one ten-second deadline; cookie/service fallback, redirects and retries are excluded. Responses are no-store and project-bound strict minimal projections. Read failures make no claim about a prior write. |
| Response contract | `packages/web/src/lib/invitation-management-protocol.ts:27` and the row parsers reject extra input fields, malformed UUID/role/cursor values, invalid state/email/timestamp values, context mismatches, duplicates, disorder and excess rows. Output construction strips unrequested fields. Existing timestamp parsing accepts the PostgreSQL/PostgREST timezone and fractional-second forms used by the intended boundary. |
| Recovery/write lifecycle | `packages/web/src/components/invitations/invitation-management.tsx:178` locks actions synchronously; line 221 compare-clears only this invocation's definitely undispatched ticket, including departure while token acquisition never settles. Storage must succeed before dispatch at line 254. Unknown writes retain the minimal ticket; rejected/unknown lookup retains it and new sends stay blocked. `packages/web/src/lib/invitation-recovery.ts:13` strictly scopes the exact five-field ticket by actor/project and refuses malformed storage. Late cleanup cannot delete a different request. |
| Context and explicit actions | `invitation-management.tsx:34` tracks every account departure, including batched departure/return; the keyed session at line 55 and controller checks isolate account/project generations. Role changes clear the old confirmed link at line 387. Explicit lookup at line 287 verifies history invitation identity, and release at line 315 uses the global invitation ID with project-bound confirmation and no lookup prerequisite. Full pages keep the next-page action at line 552. |
| Actual entries and legacy paths | The dashboard invitations page and `invitation-manager.tsx` both mount the shared component. The embedded member list preserves actual role/status and record-ID removal while removing invented emails/Owner labels. The current project invitation route still refuses legacy GET/DELETE; admin cleanup remains unavailable. New sends use the existing strict POST sender path. |

The two earlier implementation findings are resolved in the frozen source: undispatched recovery cleanup and stale links after role changes. The explicit abort listener plus saved/dispatched ownership flags address the never-resolving-token case without clearing dispatched unknown writes. The status-array coercion regression is also closed by an actual string check. No new documented-standard violation or actionable maintainability issue was identified; the binding Bearer-only/SQL-overlay requirements take precedence over the repository's general auth/migration patterns.

## Evidence and meaningful coverage

I read the binding spec/plan, progress rulings, both exact diffs, all scoped source and tests, Task 1–3 reports, the prior implementation review, the original SQL/lifecycle reports, current verification/milestone JSON, and the relevant handoff/gate documents. I inspected the existing sender client/deadline and acceptance protocol for transport, cancellation and timestamp compatibility, and the actual legacy route wiring for bypass risk.

Direct evidence checks confirm:

- The original dashboard UI RED fails because the verified-source option is absent; SQL RED receives `42883` for both missing ports. Earlier harness failures are retained and are not substituted for those behavioral RED results.
- `review-fix-red.log.txt` records the three real failing regressions for project departure, never-settling token acquisition and role-link clearing. The subsequent two-suite/22-test GREEN and final five-suite/54-test logs pass.
- The frozen UI/client/HTTP tests cover both actual entries, source selection and duplicate clicks, minimal storage before dispatch, unknown remount/manual recovery, refused lookup retention, storage failures, account/project and same-batch identity races, strict lookup/release confirmation, expired release and UUID pagination. The HTTP tests use the actual SDK against loopback and exercise exact gates/zero I/O, auth/refusal, malformed rows, abort and a real shared ten-second deadline.
- The final PG17 report passes 16 named scenarios and 2448 total harness assertions. Those assertions include composed setup/fingerprint checks, not 2448 independent user behaviors or a new execution of every prior matrix. New scenarios cover source provenance/filters, wallet-only refusal, history transfer/revocation/corruption, accepted-member history, pagination, exact ACL, direct-table/helper refusal and no writes. All four lifecycle cases pass with stopped clusters, removed temporary directories, zero clients and no cleanup errors.
- Original project execution was October 21, 23:01:19–23:04:58 Asia/Taipei. All five commands exited 0: targeted 5/54, Web 105/1420, shared 4/16, infra 7, typecheck/lint/build with 180 pages and diff-check. The final log hashes match their manifest; next-env was restored and the report records 796 unchanged inputs.
- This reviewer independently rehashed all 19 frozen source files, 986 protected inputs and 38 raw/published logs, plus the original report/hash-bearing summary references, with zero mismatches. Added documentation links resolve. The October 22 resume/closeout reports match the reviewed snapshot and explicitly represent integrity checks, not new application/SQL runs.

No application or SQL suite was rerun during this review: inspection and existing frozen evidence resolved the relevant questions without a new test concern. No provider or remote database was contacted.

## Reviewed fingerprints and documentation verdict

| Artifact | SHA256 |
| --- | --- |
| Exact source diff `batch-review-20261022T023104Z.diff` | `0c5caf533e24d3fe64c78ae738a66109df6aa9ab1a1267ff650612f93dc501f5` |
| Exact documentation diff `task-3-review-20261022T014626348879Z.diff` | `c4cf7f3809c965f233bc5c17306e15d2a0d2472431bc1b837e703b619a6562fd` |
| `source-sha256.json` | `98fae85fa188e2e341c51aa840fdbe2f068306017ec4958d83e848ce386d5c2b` |
| `project-verification.json` | `a2bb06b8dd3c7522b13b6d2042635dc2c0f26f4bf8d559c30808be5ced687618` |
| Final SQL report, `14:47:16.084Z` | `177a479669d23fcaaed154308769ce25346eea9b7b9f6622cc0ec20da596a883` |
| Final lifecycle report, `14:49:45.910Z` | `b858c6cea49dcab8421c65ec9a8e6e7662947c33fb3315f3b519c7bb36b6751b` |
| `resume-integrity-20261022T022858575708Z.json` | `313638afbfd6e1bec5a25d113bbcae25b36b2b7b9af4219b9de0a7e7378c3b8f` |
| `closeout-integrity-20261022T023656327892Z.json` | `431ffa0f44e96208628e356530b0c9e38902f3a25a0d4c1f90d1e99539ff61f1` |
| `task-3-review.md` | `ad03b68980aa26116b0c302218fe8ada98e67b5ea8365a35eff66bd2f6330909` |

Task 3 documentation is **PASS / Approved**, with zero open findings; its report records each of the twelve document snapshot hashes. It correctly separates October 21 execution from October 22 integrity checks, minimal ticket recovery from form recovery, trusted bindings from historical mapping, and local implementation approval from pending final closeout and original quality gates.

## Limits and original milestones

I read the original integrated plan §7/7.1 (`docs/2026-10-10-integrated-upgrade-plan.md:293` and `:323`) and P0 gate specification. The frozen results do not satisfy their missing production permissions/Storage, provider account/data and event/writer qualification, seven unregistered migrations' semantic equivalence/backfill/rollback/backup recovery, formal adapters or declared-device 5/20/30-minute fault/save/export/deletion acceptance. Later real evaluation, delivery/payment and household observation gates are also outstanding. The next PG17 composition of the old RLS/source-ledger matrices is a separate local batch, not a completed result here.

The evidence is layered local verification: real isolated PG17 with synthetic identity/events, actual SDK with local loopback, and React fixtures. It does not prove real Supabase Auth/JWT/PostgREST/database end-to-end behavior, payment or email delivery, complete production ACL/RLS/Storage or device support. Runtime bytes are pinned in the experiment evidence; ambient OS libraries are not. Successful build output still contains the documented old Next configuration and missing server-key diagnostics. The historical audit remains 42 issues (34 high, 8 moderate), neither rerun nor resolved by this batch.

This review changed no source, tests, configuration, index, HEAD or prior evidence. Only the two authorized review reports were written. All final status integration and its final integrity check remain controller-owned; original P0/milestone false and no-push/no-deployment boundaries remain in force.
