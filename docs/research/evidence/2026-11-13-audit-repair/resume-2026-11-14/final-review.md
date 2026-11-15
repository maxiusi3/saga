# Final independent review — six-finding audit repair

Reviewed 2026-11-14 against `docs/superpowers/specs/2026-11-13-upgrade-audit-repair.md`, its implementation plan, the SDD ledger, and `resume-review.diff` / `resume-changed-files.json`. The comparison package captures the actual pre-repair dirty baseline; HEAD `c0669e8` alone was not treated as that baseline. This reviewer made no product edits and ran no remote calls, provider requests, migrations, notifications, staging or commits.

## Verdict

**Spec: the reviewed Q1/Q2 and S1–S3 production changes satisfy the repair specification. Quality: no remaining actionable P1/P2 was found in the reviewed changes.** The prior corrected-source attribution and unchanged-text modification findings are closed. The two recovery rereview findings remain closed.

Q3's pinned OpenAI 6.49.0 / Zod 4.6.7 changes retain the Node 20.9 project floor. The affected `z.record` and Zod error uses were inspected; no remaining incompatible occurrence was found in the production search. The security-gate verdict must come from the parent's fresh `audit:high` result, not this read-only review.

**Not yet covered by this receipt:** the concurrent notification action-visibility repair and explicit backup coverage for the new AI/reminder tables. Those workstreams were still being completed when this receipt was written; this verdict neither accepts nor rejects their final changes. A focused supplement will review them after their reports land. The parent's current combined native/Chrome run is also still in progress and is not claimed as passed here.

## Findings and closure

No new P1/P2 findings.

| Area | Reviewed behavior and evidence |
| --- | --- |
| Q1 ZIP recovery | `publication-delivery-worker.ts` reconciles a lost finish acknowledgement against job, lease, ready status, size and digest. Unknown reads preserve the attempt. Cleanup is separate from commit; directory names are captured before the DB snapshot, and missing-row cleanup uses nonrecursive root removal. This retains the previously reviewed race fix. |
| Q2 transcription recovery | Migration `00001` persists preparing/outbound identity and a bounded preparation budget. The begin RPC grants at most one send; release cannot roll back an outbound lease. Current permission, consent, asset, source/CAS and audio pointer are rechecked. The readiness wrapper only advertises the same valid preparing request; changed/cleared audio pointers remain non-retryable. |
| S1 model execution | The real HTTP adapters are config/policy/consent gated, bounded and non-retrying. Both the service and SQL bind the request to current revision/edit version, transcript/source fingerprint, policy and model configuration. Exactly one ordered paragraph per authoritative segment is validated; the independent verdict covers those actual paragraphs. Serious or unsupported output is rejected; family decisions and explicit approval remain necessary. |
| Corrected-source author fix | `00002` derives corrected-source attribution from the transcript/segment correction state, retains `transcript_versions.created_by` as the family source author, and omits original-audio timing. `story_ai_claim_supported` also checks this attribution. Native fixwave scenarios use a source author distinct from the AI requester and verify the resulting approved body and both search modes. |
| Same-text modification fix | The existing family modify operation clears segment/source/timing links even when the text is unchanged. The new support predicate therefore returns false and the UI no longer displays AI source support. `00003` projects `family_supplement` claim text before considering AI source quotation, so the approved family text remains searchable with its actual author and no playback time. |
| S2 semantic retrieval | SQL first selects the current authorized corpus and enforces whole-corpus limits. The service performs query/document embeddings, actual cosine ranking and reranking. Each outbound boundary and final return rechecks source and consent identity. Citation text comes from the authority projection, not the model; approved original-source AI paragraphs cite their exact original quote. Existing protected playback revalidates source identities. |
| S3 reminders | The reviewed SQL/worker path keeps fixed expiry rights authoritative, deduplicates delivery identity, writes in-app notifications transactionally and fences optional email sends. Refund/revocation/changed expiry and project deletion cancel or erase applicable work. Unknown email outcomes are not re-claimed; a sent receipt is not inferred from a scan or log. The separate pre-existing invisible-action issue is excluded pending its active repair. |
| Cross-feature source/approval/delete boundaries | New AI drafts cannot overwrite approved revisions. Approved AI bodies and assertion snapshots feed the existing frozen-publication source/finish checks; SQL compares the actual approved body and provenance snapshot. Family modifications and disputed alternatives retain their existing attribution rules. G1 story deletion removes AI requests through transcript/revision cascades and its explicit story-erasure trigger, while tombstone guards block reintroduction. Semantic search creates no durable text/vector store and uses the same current-source resolver as literal playback. |

## Verification reviewed

This pass inspected current production paths, the four forward migrations, route/client/UI connections, focused regression scenarios, prior independent receipts and saved native/Chrome reports. It did not rerun already passed test suites. Current SHA-256 values were independently compared with the recorded product paths:

| Saved report | Reported result | Current bytes checked by this reviewer |
| --- | --- | --- |
| `docs/research/evidence/2026-11-13-audit-repair/ai/fixwave-native-chrome/results.json` | Passed, 1,203 assertions | 45 relevant production/migration paths; no current drift |
| `docs/research/evidence/2026-11-13-audit-repair/recovery/native-1794567914438-c615bd09-4207-475e-86d8-d70b69392350/report.json` | Passed, 730 assertions | 35 relevant production/migration paths; no current drift |
| `docs/research/evidence/2026-11-13-audit-repair/reviews/reminders-probe/results.json` | Passed, 106 assertions | Four repair migration paths; no current drift |

These are inspected prior execution results, not tests independently rerun in this pass. The independent recovery and reminder receipts provide their own separate probe/test details. Parent-reported fresh verify/shared/infra/audit results are being collected in the integration workstream and are not relabelled as reviewer executions.

| Core file | Reviewed SHA-256 |
| --- | --- |
| `packages/web/src/lib/server/publication-delivery-worker.ts` | `03d2b89db4ecb6d45cc9aa6e01089abce8b38cf1bd611985fcef9ec306dbe8db` |
| `packages/web/src/lib/server/story-transcription.ts` | `88359ca6a910b8f96e5edbcff135c753302f2bfd7facd303ec344f29cf57a64a` |
| `packages/web/src/lib/server/story-ai-edit.ts` | `c83cc37acfcf3c295b1e0c15579c1f2ae6a5608a4a59304c21b7d539c10eb8c8` |
| `packages/web/src/lib/server/story-ai-edit-service.ts` | `d367c7d1875306a7af1b180f71048f5c73adf4375010f3211564dd41023435ad` |
| `packages/web/src/lib/server/semantic-search.ts` | `c3bedd316476c96342dbe3ceb82ccd5296599cabc2666e6a99c495ae664c0b8d` |
| `packages/web/src/lib/server/hosting-reminders.ts` | `7ca78049ad02f16fbb4682f48078aeb519a048399373f5f3b771f8d0fcfba6ff` |
| `supabase/migrations/20261113000001_processing_recovery.sql` | `c3e97220d7ffb13b5b24234391fef2a9265fd7adf0f22baadeeee6fbef5b3d94` |
| `supabase/migrations/20261113000002_story_ai_edit.sql` | `7314dae125ea99305762f9392d6453bc6c449776f42da93d5183dfbc77341512` |
| `supabase/migrations/20261113000003_semantic_sources.sql` | `51d523f0fc304823eacdc546e3e9a3d51ca532bc63186faaf3c63ad0fdc39cc9` |
| `supabase/migrations/20261113000004_hosting_reminders.sql` | `d345d55a750b3df8930ecec8fa1c03914f1d224d0776e80e28021360c48d3fd0` |

## Limits

The inspected native runs use actual PostgreSQL17, complete repository migrations and synthetic Supabase platform tables. Browser/provider integration uses installed Chrome and controlled transports. They do not prove hosted Supabase behavior, live model availability, editing/ASR/semantic quality, provider residency/retention qualification, real email delivery, production Realtime, deployment, or completed family usability acceptance. The focused source/deletion review does not replace the pending explicit backup/restore coverage supplement or the parent's full integration gates.

## Final scoped supplement — 2026-11-14

**Final spec and quality verdict for the reviewed repair: pass; no new actionable P1/P2.** This supplement accepts the now-stable notification visibility, explicit durable-record backup coverage, and combined-recovery fixture changes. It supersedes the earlier exclusion of these workstreams. The prior notification action-opacity P2 is closed. The combined native/Chrome run has now completed successfully; the parent's repository-wide gate receipt remains separate.

Reviewed `resume-final-scope.diff`, the final source files, `resume-task-4-report.md`, `resume-task-5-report.md`, `combined-fixture-report.md`, saved failed and passing reports, and desktop/360px notification screenshots. No tests were rerun and no product source was changed by this reviewer.

### Notification actions

The production change removes `opacity-0 group-hover:opacity-100` from both buttons, makes the row `relative`, adds `min-w-0` to its shrinking text column, and prevents the action group from shrinking. These classes directly remove the unreachable hover dependency, contain the unread dot, and keep the buttons inside the row at the exercised narrow widths. The desktop and 360px screenshots visibly show both icons.

The new verification is meaningful: it compiles current application CSS and first proves that an `opacity-0` probe actually receives opacity 0. It then checks each action's own and effective ancestor opacity, minimum target size, configured viewport containment, row containment and center hit-testing. Real Tab navigation checks both focus-visible rings. Separate no-hover/coarse-pointer contexts exercise 360px and 390px widths. This avoids the original false confidence from Playwright visibility/click checks, which do not reject opacity zero. The saved first red run fails on actual opacity 0; the next red run fails on 360px row containment. The final twelve action observations report opacity 1, 36×40.5 CSS px targets, containment and unobscured hits. Existing real page/Hook/API/SQL mark-read, delete and durable-dismissal checks remain, with a new explicit single-row read persistence check.

**Scope observation, not a new repair regression:** `packages/web/src/app/[locale]/dashboard/notifications/page.tsx:86` and `:133` retain nonwrapping header/filter rows. The 360px screenshot confirms horizontal overflow of page-level actions and filter choices. This is an inherited whole-page responsive issue, outside the changed notification row; it does not invalidate the repaired read/delete visibility and hit targets. It does mean this evidence must not be described as complete mobile notification-page acceptance. The row's long title also wraps heavily at 360px. Physical-device, screen-reader and complete dropdown interaction are not established by the current evidence.

### Durable records and restore boundaries

The new backup helper creates completed and pending AI state through actual review/AI SQL transitions, obtains a family-approved source where G3 needs it, and creates sent/unknown reminder state through the real reminder scheduler and outbound functions. It captures exact rows in the two new tables and their related revisions, assertions, transcripts, segments, consents and notifications before the custom-format dump. After `pg_restore` into a separate database, the test compares the entire records rather than only counts or table existence.

The subsequent checks exercise restored behavior: wrong leases are rejected; a reviewing AI request cannot obtain another reviewer send; changed source/CAS blocks completion; the original unchanged lease can still complete; unknown email cannot receive another outbound permit; a changed expiry cancels authorization. Mutation probes roll back before survivor comparison. Exact post-freeze story capture and project tombstone replay erase the applicable AI/reminder state, block late completion/resurrection and scheduler reissue, and leave unrelated records exactly unchanged. The helper runs before the existing G3 snapshot and after restoration/replay at the intended boundaries, so these are actual dump/restore and deletion-chain checks rather than separately seeded restored lookalikes.

This establishes local maintenance recovery behavior for the new durable tables. It does not establish a project-deletion UI/API that is not implemented, hosted Storage recovery, real email receipts, or provider inference; the fixture's direct project-tombstone insertion and synthetic model/payment/email data remain explicitly documented. The restored RPC probes use the maintenance connection and therefore supplement, rather than replace, the earlier service-role/anonymous/authenticated authorization tests.

### Combined recovery fixture

`experiments/pg17-processing-recovery/scenarios.mjs` now inserts a story without an audio pointer, creates a valid same-story asset, and then assigns the pointer. Its stale-pointer checks use a second real asset rather than a nonexistent UUID. This repairs an invalid fixture ordering exposed by prior deletion scopes; it does not disable or relax any production deletion or recovery guard. The released preparation still rejects null/replaced pointers, restoring the reserved pointer is a positive control, and changed-pointer ingestion still expects `23505` after a real outbound permit. All original concurrency, budget, consent, permission, source and erasure checks remain.

### Evidence and current source identity

| Report | Saved result inspected | Independent current-byte comparison |
| --- | --- | --- |
| `docs/research/evidence/2026-11-07-g1-chrome/migrations-1794638890086-aeff217c-cc20-4989-8732-c7df971c1bda/results.json` | Passed, 228 assertions / 41 bootstrap-migration files; Chrome 157; no browser errors | `NotificationItem.tsx` and reminder HTTP scenario match their recorded hashes |
| `docs/research/evidence/2026-11-07-g1-chrome/migrations-1794639820529-32be6d09-7343-4882-81f2-ab998ebdd963/results.json` | Passed, 597 assertions / 41 files; backup and durable-record sections passed | Backup rehearsal and new helper match their recorded hashes |
| `docs/research/evidence/2026-11-11-g3-delivery/migrations-1794640344909-f2282e03-2097-4bfe-a27f-397dc03fba5a/results.json` | Passed, 2,479 assertions / 41 files; combined G2/G3/deletion/recovery/AI/semantic/Chrome | All 189 recorded source files compared with the current checkout; no drift |

All three reports record stopped clusters, removed temporary directories, zero remaining clients and no cleanup errors. These remain inspected execution results, not a claim that this reviewer reran them.

| Final scoped file | Reviewed SHA-256 |
| --- | --- |
| `packages/web/src/components/notifications/NotificationItem.tsx` | `ed30310c76e8ab652e3ad90426b57bb2c64fd527a22d2c54df56d75b8be91ddd` |
| `experiments/pg17-hosting-reminders/http.mjs` | `a0bcc3624447141413b8d38f49eff41026776478450e1b72758b304cff0914d3` |
| `experiments/g1-local/backup-rehearsal.mjs` | `bf5ae0c7d83d92e1de1d0af49bb59d1d7212606720996b9e8cc3bf03b7e798c3` |
| `experiments/g1-local/durable-records-backup.mjs` | `420b120d51f3e061c5890940bc1c8f1de71740b99bc5fba1d5484c7018148dec` |
| `experiments/pg17-processing-recovery/scenarios.mjs` | `53c1c42485436857d4da19b53b09db3fa55abd4fb7b7a79fc27781135e5a5425` |
