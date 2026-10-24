# T02 source ledger — independent initial review

Date: 2026-10-17 (Asia/Taipei)

**Verdict: CHANGES REQUESTED — one P2 specification finding.**

This review is independent of implementation and separate from the older T02 compatibility follow-up. It covers the five complete new files in `.superpowers/sdd/2026-10-17-upgrade-t02-source-ledger/task-2-review.diff`, the Task 2 brief/report, the source-ledger plan's Global Constraints / Task 2, and sections 3, 5 and 7 of the P1 contracts. The supplied review package matches all five current files byte for byte; its SHA-256 is `60be9a10fa49f651ed187dde804b9e0ed688aafc2728e5b802ac640f82b84ba2`. The reviewer did not derive the scope from the historical Git worktree.

The implementation's completed normal, host-environment and signal suites were not rerun. Saved evidence and source fingerprints were checked. One narrowly targeted real PostgreSQL reproduction was run for the finding below, with invented records in a separate temporary Unix-socket cluster; it used the actual unmodified schema, adapter and TypeScript projector. No remote access, credentials, implementation changes, commit or push were involved. Only this review artifact was added.

## Specification

### R1 / P2 — retain the source version when the final reference is removed

**Location:** `experiments/t02-source-ledger/ledger.cjs:78–80` (the insertion loop continues through line 95).

The plan requires: “不同版本追加观察且明确冲突，不覆盖原始值、旧核查结论或旧绑定”, and source versions must cover the entire selected field. `observeStory` only calculates a field version and persists history for references currently emitted by `planLegacyStoryMedia`. That fixed dependency intentionally omits null scalar fields and null/empty arrays (`legacy-story-media.ts:62–76`). Therefore clearing the last value removes every opportunity to save the new field digest. The call succeeds, returns no observation for that field and leaves only the old version in the ledger. The ledger cannot distinguish “field was collected after it was cleared” from “the collector has not revisited the old reference.” This also leaves removed positional identities without an explicit successor when arrays shrink.

**Independently reproduced on real PostgreSQL 14.17:**

| Operation using the actual adapter | Returned observations | Persisted result |
| --- | --- | --- |
| Collect a story with `photo_url='review/photo.jpg'` | 1 (`/photo_url`) | 1 observation |
| Set `photo_url=NULL`, then collect again | 0 | Still 1 observation; 0 records containing the null field version |
| Set `photo_urls=ARRAY['review/array.jpg']`, then collect | 1 (`/photo_urls/0`) | 2 observations in total |
| Set `photo_urls=ARRAY[]::text[]`, then collect again | 0 | Still 2 observations; 0 records containing the empty-array field version |

The reproduction's queries inspected `source_payload::jsonb -> 'value'` to confirm absence of the null and empty-array snapshots, rather than relying only on returned counts. The temporary cluster stopped and its directory was removed successfully. There was no new fixture binding, object access or real data. Source inspection also confirms that the current binding path rechecks the full field and rejects an old observation after clearing; this finding concerns missing append-only change history, not a demonstrated stale binding acceptance.

**Required correction:** persist an explicit cleared/removed source version for previously observed fields/paths, or introduce a field-version record that records these transitions and links the affected prior observations. Preserve the original records/reviews/bindings and idempotency on repeated collection. Keep null/empty/removal records non-bindable. Add focused real PostgreSQL cases for scalar-to-null, array-to-empty/null and a removed array position, including repeated collection and retained old review/binding. The old projector's decision not to create a locator for an absent value need not change.

### Other scoped requirements

- For emitted references, the versioned SHA-256 envelope covers actual PostgreSQL type, canonical jsonb full-field value and PostgreSQL field text. The saved scenarios exercise sibling changes, order, SQL NULL versus JSON null, array bounds and `jsonb[]` versus `jsonb`. Database keys include project/table/row/field/path/algorithm/digest; conflict insertions preserve existing observations, reviews and bindings.
- Binding identity comes from immutable observations and verification records, not request-provided locators or digests. Current source project/type/digest/projection and asset project/story/kind/bucket/key/version/object-version/size/hash are checked. A second asset cannot overwrite the binding's unique observation key. Composite foreign keys bind project and verification/asset/version identity.
- The adapter acquires project, story, current membership, asset and observation locks in a consistent order and retains them through COMMIT. READ COMMITTED reads follow waits. The saved real lock evidence supports source/project/asset changes, revocation and tombstones, as well as four mutations blocked at the COMMIT barrier. Project serialization also protects identities before an observation row exists.
- Ordinary fixture roles are denied access to the ledger schema and tables. This is consistent with the declared trusted-adapter boundary; it does not implement the full P1 action/consent/production RLS model.
- The unknown-COMMIT scenario performs a real PostgreSQL COMMIT before the wrapper injects lost acknowledgement. The adapter does not compensate or delete; a different connection reconciles durable IDs, including after later source/asset versions change. Actual division-by-zero and backend termination cover rollback and failed-ROLLBACK reporting. These are faithful local fault scenarios within their declared transport-injection limits.

## Code quality

No additional actionable code-quality finding was identified in the supplied five-file scope. Responsibilities are separated into schema, trusted adapter, scenarios and runner. Dynamic field SQL uses the fixed allowlist, history mutation protection includes TRUNCATE, and binding checks are explicit. The coarse project lock and required dedicated idle owner connection are documented limitations rather than claims of production scalability or public API safety.

The runner fixes socket/user/database/SSL/password settings, filters `PG*` / `DATABASE_URL` for subprocesses, uses bounded statements/locks/commands/barriers, tracks opened clients and runs cleanup on its exercised stable-fixture signal path. This review does not extend that saved signal result to every possible interruption phase. The synthetic host-environment run covers its declared set of settings; it is not a proof that every possible node-postgres environment option is neutralized.

## Evidence checked

All three final reports match the seven current experiment/projector source fingerprints and the pinned metadata snapshot. Counts below are assertions recorded by the implementer, not newly rerun suites by this reviewer. Both successful runs record 18 actual PostgreSQL lock observations and final counts of 63 source observations, 1 review, 6 bindings and 32 simulated assets.

| Report | Recorded result | Independently recomputed SHA-256 |
| --- | --- | --- |
| [normal-final-1792216844015-57651.json](normal-final-1792216844015-57651.json) | passed; 190 checks | `adf368dedd9e1026ac4270286f4804dfa30c99c95da319449fff9f9b40bd9268` |
| [host-env-final-1792216862629-57771.json](host-env-final-1792216862629-57771.json) | passed; 190 checks | `68a03f51199fa617b97a8b758608ef096f6c8729ee44e986132493935c2ddc6c` |
| [signal-final-1792216862630-57772.json](signal-final-1792216862630-57772.json) | interrupted by SIGTERM at stable fixture; 21 checks | `8a6cc12ef5ede14aae5d6f81ed90003813bf8b6c6eeef91bba9976f4d64dfc66` |

All three record the cluster stopped, temporary directory removed, zero remaining clients and no cleanup errors. Exit codes and the synthetic host launch configuration are supplied in the implementation report; the reviewer did not independently observe those prior launches. The saved genuine observation, binding-contract and TRUNCATE RED reports each match their five preserved source snapshots. They were correctly distinguished from initial setup/fidelity failures and intermediate evidence.

## Reviewed source fingerprints

| File | SHA-256 |
| --- | --- |
| `experiments/t02-source-ledger/README.md` | `f9ca5b865576fcb1b476b1448ed18459b700a3b3e0c77ebf89d227dcb75d97e5` |
| `experiments/t02-source-ledger/ledger.cjs` | `995e447c9dc81bcc4d7307b336758577d437eb05662561f286e535d9669ad79f` |
| `experiments/t02-source-ledger/scenarios.cjs` | `3190a0490270ca03c4e4886c3e51c0583b78b2a1c969c9573d269239babfb610` |
| `experiments/t02-source-ledger/schema.sql` | `1ee41a18d58a45b07ffef264534f8dca94d02757a0381883606b49b2c67323a4` |
| `experiments/t02-source-ledger/verify.cjs` | `2f737e882361a1ca2e740f30893ac27c301369fd27677825d124b5f6a3e9c1a5` |

The fixed dependency `packages/web/src/lib/legacy-story-media.ts` was read only to trace the concrete absence-handling concern. Its hash remains `1fe15dd0e88a62a04b75eab107658ea777c58598639816a6f62646627243158e`. No wider historical source review was performed.

## Remaining boundary

Close R1 through implementation, focused regression evidence and an independent follow-up. This report establishes neither production object verification nor complete action authorization/consent, PG17 equivalence, complete schema/RLS/trigger compatibility, Storage HTTP behavior, backup/restore, device acceptance, release readiness or an original upgrade-plan milestone. Existing incomplete plan gates remain separate.
