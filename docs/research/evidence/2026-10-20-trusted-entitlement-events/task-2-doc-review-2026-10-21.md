# Task 2 independent documentation review — 2026-10-21

**Verdict: PASS / Approved. Actionable findings: none.** The documentation accurately reports the local candidate, retained validation, independent Task 1 verdicts, compatibility gaps and original milestone limits. This verdict covers Task 2 documentation and its evidence/scope checks. It does not approve the final batch, G0/G1 or production activation.

## Scope and method

Read the binding specification and Task 2 plan; reviewed all eight files in `.superpowers/sdd/2026-10-21-entitlement-review/task-2-review-package.diff` against the saved original documents and current bytes. Independently regenerated the unified diff in memory: all eight sections match exactly. Also inspected the current verification, project logs, authoritative RED/GREEN/lifecycle reports, Task 1 independent spec/quality reviews, resume/final integrity records, and both milestone assessments. Checked the newly documented sender/cancel/cleanup gaps against actual application routes, facade, UI and imported invitation SQL.

This reviewer performed local reads, hashes and static comparisons only. No SQL/project tests, remote calls, commits, pushes, migrations or deployments were run. The only file written by this reviewer is this report. Branch remains `codex/october-upgrade-p0`; HEAD remains `1caa21a72a23d6f5166ed127847ca931374b890a`.

## Evidence and claims

| Area | Result |
| --- | --- |
| Execution dates | Current summaries explicitly attribute the business/project matrices to 2026-10-20 and the renewed fingerprints and independent reviews to 2026-10-21. Historical service errors and controller review are not represented as independent approval. Pending documentation/final status is honest at the reviewed snapshot. |
| PG17 results | Normal and hostile raw reports each contain 95 passed scenarios, 3,211 assertions, 20 concurrent schedules and 13 `atomic_fault_` scenarios. Each has 135 equal before/after checks: three pre-install checks cover the 12 then-existing tables and 132 checks cover all 14 tables. The documentation's 14-table claim is specifically about owned write-stage faults and caller rollback, consistent with the evidence. |
| RED and cleanup | Original pre-candidate RED records missing-interface `42883` and a real wallet change under the deliberately permissive synthetic ACL. Lifecycle records four passed observer cases, expected exits `0 / 143 / 1 / 1`, stopped clusters, removed temporary directories, zero clients, no cleanup errors and no rescue. The report correctly distinguishes expected failure exits from business success. |
| Project validation | The retained three command records all exit 0 on 2026-10-20. Raw logs confirm Web 96 suites/1,278 tests, shared 4/16, infra 7 and 176 built pages. All 773 recorded application inputs still match; `next-env.d.ts` equals the saved original bytes. Existing build diagnostics and the historical audit's 42 vulnerabilities (34 high/8 moderate) remain disclosed. |
| Input identities | Independently hashed all 25 direct sources, 44 CommonJS/package files and 743 PG runtime files: no mismatch. Node executable pin matches. The current direct-source and runtime file inventories match their pins; the runtime inventory contains exactly 743 files. The documented ambient macOS dependency limit remains explicit. |
| Evidence references and links | All 20 current summary/log/input-manifest/lifecycle-child path/hash references match. All 456 local Markdown file links across the reviewed documents, binding spec and existing evidence reports resolve; the new handoff anchor exists. No generated `v1_` invitation token matched retained JSON. `git diff --check` exits 0. |

## Compatibility and next step

The new static gap map is accurate and useful:

- `api-supabase.ts:341–352` and project invitation `route.ts:377–400` still create a legacy UUID token and call `send_project_invitation`; POST separately reads the wallet/invitation through the admin client and attempts email delivery. The proposed separation between durable invitation registration and email delivery is warranted.
- The management page at `page.tsx:148` sends DELETE to the nested invitation-ID path, while the API directory contains only the collection route. Its DELETE reads `?invitation_id=` at `route.ts:456`, updates the invitation at line 508 and separately reads/updates the wallet at lines 528–543 without checking the refund result. The documentation correctly requires fixing the actual UI call chain and using atomic release.
- Both cleanup methods retain `cleanup_expired_invitations`; GET can invoke it after finding expired invitations. The candidate closes this exact legacy signature locally. The documentation correctly leaves application replacement/closure pending.
- Imported SQL declares `send(p_project_id,p_request_id,p_invitee_email,p_role,p_source_id,p_message)`, `release(p_invitation_id,p_reason)` and `lookup(request_id)` at lines 162, 243 and 276. Its sender lookup can reject unavailable or invalid bindings; the documentation does not equate rejection with proof that no send committed. Keeping the original request ID and requiring explicit recovery is consistent with the contract.

The remaining work is correctly scoped to default-off send/release HTTP adapters and sender recovery, followed separately by real event verification and production role/deployment qualification. Local SQL event supply, terminal revocation and ACL closure are no longer misclassified as unimplemented. Mirror balances, no orphan-source adoption, precise member deactivation, independent owner rights and outstanding Worker/Storage/URL revocation are described without promoting the candidate to production readiness.

## Scope preservation and milestones

Independent comparison with the 1,879-file pre-batch baseline finds only the seven allowed existing documentation/specification changes. All 54 new tracked-or-unignored files present at review are in the permitted experiment, batch evidence or research paths. Against the 1,927-file resume baseline, only the nine expected status/documentation files changed; experiment source and retained raw evidence are unchanged. These observations agree with the reviewed final-integrity snapshot.

The original integrated plan section 7.1 and P0 requirements remain intact. The new [2026-10-21 milestone assessment](milestone-check-2026-10-21.json) correctly leaves G0–G4 false: production permissions/provider/deployment, Storage and migration/backup qualification, formal adapters/device fault evidence, later delivery/household/economic acceptance remain incomplete. Its recorded predecessor hash matches the untouched October 20 assessment. No local substitute milestone or push authorization was introduced.

Mechanical closure updates are permitted to reflect **this actual Task 2 PASS / Approved**: add this report's link/hash, update documentation-review status and refresh corresponding integrity checks. After a separate final reviewer actually approves, the controller may likewise update final-review status, timestamps, links/hashes, plan checkboxes and handoff's first-next item to the already-reviewed send/release work. Pointing the milestone links to the reviewed October 21 assessment is permitted while preserving its October 20 predecessor. This allowance does not approve a future final verdict or substantive source/claim changes; the raw execution dates and evidence must remain unchanged.

## Reviewed identities

Hashes were independently recomputed before writing this report. Status documents may later receive the limited closure updates described above.

| Document / package | SHA-256 |
| --- | --- |
| `.superpowers/sdd/2026-10-21-entitlement-review/task-2-review-package.diff` | `9306057cda2692f1a33a364072ecd4003fbecee5416e2efa04b1b691cb60c077` |
| [Integrated plan](../../../2026-10-10-integrated-upgrade-plan.md) | `3a444014f99ce0f9efdf6f9eb639cde8dca21d8da23f4bd5b9a1b222be4b1478` |
| [Documentation index](../../../README.md) | `2885ece45f54efbbefa434fa333eca8e793ca220e186599fb9c10f153775f38e` |
| [Handoff](../../../HANDOFF-2026-10-13-upgrade.md) | `fa82c870dcba9e5d8788ee07cd60cee49f0eacdf6c8bed6fb0fe7fda7e3b76d6` |
| [P0 gates](../../../superpowers/specs/2026-10-13-upgrade-p0-gates.md) | `4c137fb7be5700d594721eb335f0268256eb09916c381611c89d9ef5f5f866f1` |
| [P1 contracts](../../../superpowers/specs/2026-10-13-upgrade-p1-contracts.md) | `f7314c5fbd7e98ffe195e7f739d4a78413b5930e86ae1e7f22a9739bcd584476` |
| [Research report](../../2026-10-20-trusted-entitlement-events.md) | `64f2403e67e6acd6f442377af32ac5ca3e10a9a6ed701421ac462656b0b62f99` |
| [Evidence index](README.md) | `c90b4189c70a290f488b7fb345afaeff646fa05351e0ad885a4baebe9a232d7f` |
| [Implementation plan](../../../superpowers/plans/2026-10-20-upgrade-trusted-entitlement-events.md) | `5b776fa6819125d3b2a63bc325124312948ed8dad25b5476d12f4c6575d0609c` |
| [Verification snapshot](verification.json) | `e5712bffc72138a8878b3594fff3d994686605b4c1b054f7db5e6f94461f2a59` |
| [Final-integrity snapshot](final-integrity-2026-10-21.json) | `c442388e4b39955daccfd6224e10665e33ecd85238242111d31ee736f5ad26d4` |
| [October 21 milestone assessment](milestone-check-2026-10-21.json) | `0496439b3ca3b63014b1d0c230fac942a0b09e98baf45c4531b9a3fc240341f2` |
| [Retained project validation](project-verification.json) | `0bd6cc2a491c1c1bc888c0cc8cf610cc5df0acd48f79e15e4dbecdeed0283ee6` |
| [Resume integrity](resume-integrity-2026-10-21.json) | `c2214c4a544fd166d363fca9bb6b83f1980d9108756b8aca89314af1928035b0` |
| [Resume runtime](resume-runtime-2026-10-21.json) | `31e6ad703a324ccccf35236852ce60e6386be61b90c8317ed8c5beba0f4d3796` |
| [Complete input pins](../../../../experiments/pg17-entitlement-events/input-pins.json) | `af0f5c27bbd091462a17224039efbc3b113de844e57f05d8716a1ec1f3a53dea` |
