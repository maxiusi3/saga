# Final independent batch review — 2026-10-21

**Verdict: PASS. Actionable findings: none.** The implementation, retained execution evidence, independent Task 1 specification/quality reviews, Task 2 documentation review and current handoff compose into a complete local batch. This verdict does not grant G0/G1, production readiness or authorization to commit, push, migrate or deploy.

## Scope and independent work

Reviewed the binding specification and implementation plan; the ten files under `experiments/pg17-entitlement-events/`; the imported invitation transaction and export candidates where composition depends on them; the current handoff, research/evidence summaries, integrated plan, documentation index and P0/P1 updates; and all three preceding independent review reports. Traced the actual legacy send, cancellation and cleanup application call sites documented for the next batch.

Reconstructed all nine added source/document files in the frozen Task 1 patch and compared them with current bytes: exact matches. The tenth file, the input manifest, was checked separately. Reconstructed all eight Task 2 documents from their patch and saved originals; their hashes match the documentation review's recorded identities. Applying only the expressly permitted documentation-approval status/link and milestone-reference replacements reproduces the current eight files exactly. No substantive unreviewed documentation change was found.

This review used local source reads, raw JSON/log inspection, in-memory patch reconstruction, hashes, inventory checks and Git metadata/diff checks. It did not rerun the unchanged SQL or project matrices: the frozen inputs match and no concrete unresolved concern justified a rerun. This reviewer wrote only this report. Branch remains `codex/october-upgrade-p0`, HEAD `1caa21a72a23d6f5166ed127847ca931374b890a`.

## Composition and evidence assessment

| Area | Independent result |
| --- | --- |
| Event and source contract | The SQL validates bounded case-sensitive identifiers and typed payloads, protects immutable event/source associations, grants once, preserves legacy history, and treats revoke as terminal. New wallets receive only the selected credit; NULL/overflow failures roll back. Persistent lookup and the actual commit/discard/close/new-connection recovery test agree with the documented unknown-commit boundary. |
| Permission and invitation boundary | Real writer authority comes from database EXECUTE ACLs, not JWT/GUC text. Installation closes candidate and sensitive public table/column privileges and seven exact unsafe legacy write signatures while preserving public function definitions. The original invitation paths require protected, unrevoked remaining source capacity; release refunds exactly once without reactivating a source. Revocation checks precise member mappings and preserves unrelated membership and independent project ownership. Both export overloads check current active membership. |
| Locking and rollback | Project locks are sorted before wallet, source/binding and member locks. The wallet-locked discovery reread refuses a newly discovered project with `40001`; a retry covers both mapped members. Each final full run contains 20 actual ungranted lock observations with the expected holder in `pg_blocking_pids`, and the discovery outcome is `40001` followed by success. Each run has 135 equal complete before/after state checks: three pre-install checks cover 12 then-existing tables; 132 checks cover all 14. Thirteen owned write-stage faults and both caller rollbacks are present. |
| RED, GREEN and cleanup | Both final normal and hostile reports contain 95 passed scenarios and 3,211 assertions. The original pre-candidate RED has no candidate SQL input, records missing-interface `42883`, and retains a real unauthorized wallet fingerprint change under the deliberately permissive synthetic fixture. Final RED records both intended failed assertions. Four lifecycle cases pass with expected exits `0 / 143 / 1 / 1`, stopped clusters, removed scratch directories, zero clients, no cleanup errors and no rescue; child hashes match. |
| Project validation and dates | The three retained commands exit 0 on 2026-10-20. Raw logs confirm Web 96 suites/1,278 tests, shared 4/16, infra 7 and 176 built pages. All 773 application inputs still match and `next-env.d.ts` equals the saved original bytes. The documents accurately distinguish October 20 execution from October 21 review and fingerprint checks. Existing build diagnostics and the unresolved historical 42-vulnerability audit remain disclosed. |
| Input and reference integrity | Independently recomputed all 25 direct-source, 44 CommonJS/package and 743 PG runtime hashes: zero mismatches. The complete direct-source and runtime inventories match; Node v22.22.2 and its executable hash match. All 22 summary/log/manifest/lifecycle-child path/hash references match. All 473 local Markdown file links resolve. No generated invitation token matched retained JSON, and `git diff --check` exits 0. |

The synthetic `entitlement_writer` represents preverified input; the tests do not qualify a real provider or production role topology. The implementation's positive wallet mirror after revoke, suppressed late grants, refusal to adopt orphan historical sources, retained mappings and explicit serialization retry are intentional specification choices, not missing functionality.

## Scope, next work and original milestones

Independent comparison with the 1,879-file pre-batch baseline finds exactly the seven allowed existing documentation/specification changes. All 55 new tracked-or-unignored files present before this report fall within this batch's experiment, evidence or research paths. Against the 1,927-file resume baseline, only the nine expected status/documentation files changed. The experiment, application and retained raw evidence remain unchanged; these observations agree with the current final-integrity record.

The documented next implementation is correctly limited to default-off send/release HTTP adapters and authenticated sender recovery. Actual code confirms the old send RPC callers, management-page nested DELETE path versus collection-handler query parameter, separate invitation/wallet refund writes and old cleanup RPC calls. These are accurately marked as remaining compatibility work. The request ID, strict result decoding and explicit unknown-commit recovery requirements remain necessary; lookup rejection is not proof that a write did not commit.

The original integrated plan section 7.1 is byte-identical to its saved pre-batch form. The current milestone assessment's predecessor hash matches the preserved October 20 assessment, and G0–G4 remain false. Real provider/account/product verification, production Auth/JWT/PostgREST/RLS/ACL and deployment qualification, Storage/Worker/existing-URL revocation, migration/backfill/rollback/backup, vendor conditions and device/household acceptance remain outside this local approval.

## Permitted mechanical closure

The pending final-review status and final plan checkbox were honest at the reviewed snapshot. This actual PASS permits the controller to add this report's link/hash; update final-review status, timestamps, integrity references and the last plan checkbox; and make the already-reviewed send/release work the handoff's first-next item. Corresponding current milestone status text may reflect this verdict while all original gates remain false and the October 20 predecessor remains unchanged. Run a fresh scope/link/hash integrity check after those mechanical edits. Substantive source, evidence or claim changes require re-review. Original raw execution dates and bytes must remain unchanged.

## Reviewed identities

SHA-256 values below were recomputed immediately before writing this report. Status documents may subsequently receive only the closure changes above; their snapshot identities remain recorded here. The complete input manifest identifies the full source/dependency/runtime closure, and the lifecycle observer identifies its four children.

| Input | SHA-256 |
| --- | --- |
| [Binding specification](../../../superpowers/specs/2026-10-20-trusted-entitlement-events.md) | `136b3e6eb7b88bb9d0131ebbf5323054cd82fe59db5e85fe51da926ccd72c964` |
| [Implementation plan](../../../superpowers/plans/2026-10-20-upgrade-trusted-entitlement-events.md) | `cbae6014fdc404d55180b821cdcd0fde304abc895971ec29c5a704b1637f340c` |
| [Current handoff](../../../HANDOFF-2026-10-13-upgrade.md) | `6e59e76fbbb7a01d3435e265285b254ddef8bbed2af7555978f5c943f692fc96` |
| [Research report](../../2026-10-20-trusted-entitlement-events.md) | `da175ccf8e8038cd1a0e978f7e369d3669237d7feff91d90536b7fc3603104e9` |
| [Candidate SQL](../../../../experiments/pg17-entitlement-events/candidate.sql) | `97045cd661e420d4b55f157a8667c0434ea11ea9a741bffcf2294583c5288300` |
| [Complete input manifest](../../../../experiments/pg17-entitlement-events/input-pins.json) | `af0f5c27bbd091462a17224039efbc3b113de844e57f05d8716a1ec1f3a53dea` |
| `.superpowers/sdd/2026-10-20-upgrade-trusted-entitlement-events/task-1-review-package.diff` | `504bdce02be4e3ce4e58277f87173f7127c704e763a0fa8c0d6b252d2ef82dca` |
| `.superpowers/sdd/2026-10-21-entitlement-review/task-2-review-package.diff` | `9306057cda2692f1a33a364072ecd4003fbecee5416e2efa04b1b691cb60c077` |
| [Independent specification review](task-1-spec-review-2026-10-21.md) | `ef129a780a9c06236367b7eff5c015808e38d68bfe6182c91d3823a3110b9825` |
| [Independent quality review](task-1-quality-review-2026-10-21.md) | `848df34e2c06fc9465539a442f3bbdfdb0f8160db90fc0e5198b42a68fbcb625` |
| [Independent documentation review](task-2-doc-review-2026-10-21.md) | `4a11ad43ec64998823e72657c0a9746f4ee0c1edcdf54d8410893fa4ad2f73d8` |
| [Verification snapshot](verification.json) | `ed31adec8d58231742c79e60fd23e1f3f3099c11b168b595ebc8c7ef829ae0c9` |
| [Final-integrity snapshot](final-integrity-2026-10-21.json) | `1f9cc0733054d025410da2ad03456b788ff20a2637dbd4be5696093b2b094adb` |
| [Resume integrity](resume-integrity-2026-10-21.json) | `c2214c4a544fd166d363fca9bb6b83f1980d9108756b8aca89314af1928035b0` |
| [Resume runtime](resume-runtime-2026-10-21.json) | `31e6ad703a324ccccf35236852ce60e6386be61b90c8317ed8c5beba0f4d3796` |
| [Current milestone assessment](milestone-check-2026-10-21.json) | `b91bfa945a28747dc7578ec0ed55b6a7bb4a1ee9f07d507bf5841b573278de3d` |
| [Retained project validation](project-verification.json) | `0bd6cc2a491c1c1bc888c0cc8cf610cc5df0acd48f79e15e4dbecdeed0283ee6` |
| [Original pre-candidate RED](entitlement-red-2026-10-20T01-25-59.143Z-2676dc06-0d30-4fb8-ba48-7f9818dcabc2.json) | `6bd9841f65ba1a1146bc0ca313ca95bd990903fedfa0bcf1977c58335601e0b2` |
| [Final RED](entitlement-red-2026-10-20T01-49-27.230Z-6936367a-ef75-4d8d-a28b-c0a3b887c8fa.json) | `c84b5b3b861221832da92b8d566282885ae61c34bbb36101d8666d4196ebb126` |
| [Final normal PG17](entitlement-run-2026-10-20T01-49-29.584Z-84c14462-17c7-4663-8f34-dfd1ff831594.json) | `66b635eb6a4880d52e3b5a5c44dbff68251d8849df50ee570017f9fc3789cc4b` |
| [Final hostile PG17](entitlement-run-2026-10-20T01-49-41.146Z-ad34f7f8-7fe7-46ee-b208-893dc59b3e2f.json) | `b50e4ec127319ddfd7ff60304234cbc9f81a60c903d089db0e654c7a43a8f2ff` |
| [Final lifecycle observer](entitlement-lifecycle-2026-10-20T01-49-40.980Z-05dcfebb-69b5-495d-b445-1d1358f52c17.json) | `ff9ac96afceccfbb6f7968c7c8f33dd55cb9286c6ebd1c14f77de6fd59a4076d` |
