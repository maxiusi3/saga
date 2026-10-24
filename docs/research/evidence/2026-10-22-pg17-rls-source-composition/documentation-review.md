# Task 2 documentation and closeout review

Reviewed: 2026-10-23 (Asia/Taipei)

- Spec: **Issues — 1 open finding**
- Quality: **Needs fixes**
- Severity: one P2; no other actionable findings
- Reviewed patch: `.superpowers/sdd/2026-10-22-upgrade-pg17-rls-source-composition/task-2-review.patch`
- Patch SHA256: `07d648e8b567cc481aea40586dc93c5e3fffc3fa46b4b93746125d5236936cbc`
- Reviewed snapshot: `.superpowers/sdd/2026-10-22-upgrade-pg17-rls-source-composition/task-2-review-snapshot.json`
- Snapshot SHA256: `9f7e5be5cbaace73a0d808044377c57b0442a848e7d6b9f67a18544db76fb52c`

## Finding

### [P2] Align the handoff startup instructions with the current PG17 batch

**Locations:** `docs/HANDOFF-2026-10-13-upgrade.md:34`, `docs/HANDOFF-2026-10-13-upgrade.md:46`; related undated current-run wording at line 48.

The new header correctly identifies PG17 composition as the current batch with reviews and final integrity still pending, but the dedicated “新会话先读什么” section still says “当前先读” and “最新先读” and routes both entries to the completed October 21 invitation-management record, plan/spec, verification, and milestone. Its following “本轮…推进…RPC权限候选批” text also reads as current despite describing an earlier batch. A resumed agent following this explicit startup sequence receives the old batch's completed review status and old next-step instructions instead of the current PG17 closeout state. This leaves Task 2's current handoff requirement incomplete.

Point the current/latest entry set to the PG17 composition research record, current plan/spec, verification/milestone, and current progress entry. Preserve the earlier batch links and resume history with explicit historical labels. A focused text/link re-review is sufficient; no matrices or historical tests need rerunning.

## Spec assessment

**Issues** solely for the handoff entry conflict above. The rest of the preparation snapshot satisfies the reviewed Task 2 requirements:

- The research record and verification distinguish historical ledger execution before the immutable-story RLS trigger, the full RLS phase, and the final independent seed with all candidates active in one database. They retain the actual reverse-order 42501 failure and do not claim historical identity-mutation races passed under the RLS guard.
- Selected normal and hostile reports each contain 72 passed scenarios, 832 summed behavior assertions, 236 ledger checks, 18 lock observations, and 997 total assertions including setup/pins. The six-scenario RED report contains eight behavior assertions and 149 total assertions. All summary counts match the selected reports. The hostile run records 14 scrubbed environment keys.
- Selected lifecycle evidence contains all four named observations with the documented exits and cleanup. Normal/hostile catalog checks, low-privilege identities, all seven retained RPC denials, final RLS state, same-database revocation/read/bind results, and source/pin fingerprints agree with current claims.
- Fixture claims match the selected metadata: seven base public tables/13 replayed functions, added stories 34 columns, buckets 14 columns, objects 15 live columns, 13 selected constraints, 20 selected indexes, and seven omitted Storage trigger bindings. The local enum, helper, dropped-column placeholder, synthetic Auth/objects and production limitations remain explicit.
- The 796-input preservation report is from October 23, while the application execution remains October 21. Referenced published logs substantiate targeted 5 suites/54 tests, Web 105/1420, shared 4/16, infra 7, and 180 generated pages. The historical audit still records 34 high and eight moderate findings. No historical tests or audit were represented as rerun or newly fixed.
- P0/G0–G4 remain false, production/action flags remain false, and devices remain `deferred_by_user`. The original gate definitions after `## 1.` and integrated plan section 7 through 7.1 are byte-identical to the supplied prior document snapshot.
- Implementation, documentation, whole-batch review and final seal are pending in this preparation snapshot. These pending states are correct and are not findings. The controller must insert actual verdict references and terminal status updates only after their reports exist, then seal those final bytes.

## Quality and closeout checker assessment

**Needs fixes** for the single handoff issue. No additional actionable issue found in `seal-closeout.py` or the remaining document changes.

Static inspection confirms that the checker requires final approved review metadata and referenced report hashes, matching selected evidence/source/pin hashes, scoped input inventories, successful selected cleanup, required normal/hostile outcomes, lifecycle case identities/exits, unchanged original gate definitions, false original gate/action flags, a complete plan, and a fresh input-integrity check. It validates local document links and writes a new seal without overwriting an existing report. Its inventory subprocess performs fingerprint collection; the script does not run the business matrices or historical application suites. Python AST parsing succeeded. The seal itself was not executed by this review and is not claimed as passed.

All local links in the 14-document list resolved in the preparation snapshot. The pre-resume prior-evidence inventory contains 1,226 entries. All ten selected evidence hashes matched; all six selected execution reports marked for current-source checks matched their source maps and input-pin file fingerprints. The final seal must still run after the actual remaining reviews and focused fix.

## Review method and boundaries

Read Task 2's controller report, current plan, binding spec, the full review patch, and its selected snapshot. Checked actual selected reports and narrowly referenced baseline/log evidence against the claims. All 13 snapshot files matched the working files at review time. This review used the code-review spec/quality axes; it did not delegate, edit implementation/docs, alter Git, contact a remote system, or rerun any matrix or old test. Only this review report was written. The prior assistance review was treated as existing provenance and was not re-reviewed; implementation remains the separate reviewer's scope.

## Reviewed file hashes

| File | SHA256 |
| --- | --- |
| `docs/HANDOFF-2026-10-13-upgrade.md` | `adb71abecd47ef1abde8def44428d4cf20e70d59f6e3e9a33ea0db48041984ae` |
| `docs/2026-10-10-integrated-upgrade-plan.md` | `360ae1d3dda4222994dc9f4ce674a22755fea7c153c34ca85caeb82b357da6c0` |
| `docs/README.md` | `40f898639f4328c3b6c4e260c181070e1fb4197e057189a1971f45ef2fbc8d82` |
| `docs/superpowers/plans/2026-10-11-upgrade-p0-preparation.md` | `b68404e607fd6484fe961994d2d40aad03af3d058cd9f946755185db839faef4` |
| `docs/superpowers/specs/2026-10-13-upgrade-p0-gates.md` | `51e9510fcab6d56468e8e6d26ea03b9724f7d1b3d7b17b76feeb0a8ce69a7ac9` |
| `docs/superpowers/specs/2026-10-13-upgrade-p1-contracts.md` | `6107c992fe51ef88392e93326a435a4512308f8a775b4846ff5a540830981b3b` |
| `docs/research/2026-10-22-pg17-rls-source-composition.md` | `5ba2d77882c04f4d49ce68b3f83d9238112e565311d51e16a36d0ddce3c15673` |
| `docs/research/evidence/2026-10-22-pg17-rls-source-composition/README.md` | `b3afdcd686e20442d9d6ad4b138032bf03df2bee309e19601de56bcbf0e49dce` |
| `docs/superpowers/plans/2026-10-22-upgrade-pg17-rls-source-composition.md` | `b7c165e415c3ab84de736596f8deee73f44452d9f4a7e108cb482f706ae7966e` |
| `docs/research/evidence/2026-10-22-pg17-rls-source-composition/verification.json` | `a7a3ea04ec3c0d1a6af163781656fb0586a3eac6de0a085361bc13528746783c` |
| `docs/research/evidence/2026-10-22-pg17-rls-source-composition/milestone-check.json` | `d463e81fc5119b7ec6503d7c4945edc5bbc53d727b5bdf4e9acd14c616b530ab` |
| `.superpowers/sdd/2026-10-22-upgrade-pg17-rls-source-composition/seal-closeout.py` | `ed87f379432bf87d950f87dea37e12137be0e5b7368b75ee0423e40fc47ee7af` |
| `.superpowers/sdd/2026-10-22-upgrade-pg17-rls-source-composition/task-2-report.md` | `201a86bbf4336c082948caf987f782dab38d4ab91e5155480346923e2188d310` |
