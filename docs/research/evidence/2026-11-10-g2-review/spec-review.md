# G2 independent specification review

Reviewer: `/root/g2_audit`. Scope: `docs/superpowers/specs/2026-11-10-g2-review-design.md` against the final local persistence, adapter and connected review implementation. Six helper/benchmark files were authored by this reviewer and are independently reviewed by `/root/g2_transcription`; see `helper-independent-review.md`. The persistence, service, provider and UI review is independent of their implementation authors.

## Current disposition

The previously identified source-integrity and revision-membership blockers passed independent replay on the frozen SQL: 450 assertions, all 33 complete bootstrap/migration files, no source drift, native PG17.4, actual service-role connections, and clean teardown. The additional family-supplement action-chain finding was repaired and passed a second independent full-chain run: 486 assertions. No unresolved specification blocker remains in the reviewed local implementation. Final aggregate/browser acceptance is recorded separately below.

`spec-independent-native-results.json` contains the complete receipt, including `independentSpecProbes`. `spec-independent-native-final.log` records invocation output. Native platform substitutes cover Auth/Storage schemas, not hosted Supabase behavior.

## Original findings and independent replay

| Finding | Original observation | Replayed outcome |
|---|---|---|
| Cross-story asset attached to a transcript | Another story's asset could prepare and approve | Prepare fails `23505` |
| Media identity changed after preparation | Changed SHA256 could still approve | Read and approval fail `23505` |
| Owned assertion mutation/removal outside review | Source paragraphs could be changed or omitted | Direct edit/delete fail `23514`; forged transaction context fails `42501` |
| First-source-capture race | While prepare waited on revisions, another transaction changed source text; injected body prepared and approved | Source writer fails `55P03`; prepare and approval succeed with original text |
| Current transcript pointer diverged from revision | Read mixed old assertions and new transcript with `sourceChanged:false` | Read fails `23505` |
| Empty draft preview | Source appeared only on approval | Native suite verifies prepare and decisions use the shared canonical renderer |

Earlier RED receipts remain immutable under `docs/research/evidence/2026-11-07-g1-chrome/`:

- `migrations-1794310618087-421e0f61-e602-4d25-bf90-0d7c6b522dd7/results.json`: asset ownership and source SHA failures in `specProbes`.
- `migrations-1794312002529-85d41acd-edf3-4e42-aa54-0cd16a889348/results.json`: capture race and current-pointer failures in `specRaceProbes`.

Those old receipts' harness `status:passed` means the probe executed; their observed SQL states and content demonstrate the defects. They do not represent specification acceptance.

## Verified contract boundaries

- Review writes are atomic, service-only, with stable request identity, revision ownership, expected-version CAS and current authorization/deletion/source checks. Internal write authority is transaction/story scoped, inaccessible to service-role callers, and cleaned up.
- Imported text retains explicit legacy provider/model and unknown timing/confidence. Source text is not promoted into measured audio fidelity. Human decisions are separately represented in the wire format.
- Approval regenerates body, summary and source/assertion snapshots. Rejected text is removed; unreviewed/skipped/empty/invalidated sources cannot approve. Superseded approved snapshots stay immutable. Correcting transcript creates a new source and revision.
- Transcription reservations pin consent, policy, asset identity and revision state before outbound work. Unknown outcomes remain pending and do not trigger another provider request. Storage bytes are bounded and SHA256 checked; provider bodies and timed segments are bounded/validated.
- G1 story purge removes review and transcription retry identities and all story prose. The independent run includes the existing native story deletion suite.

## Final action-chain finding

Independent RED: `supplement-dispute-independent-red-results.json` (`sourceDrift:[]`, clean teardown). Modify created a `family_supplement`; dispute changed it to `disputed_memory`, dropped the primary supplement label, and approval failed `23514`. In addition, overwriting `reviewed_by` on later decisions must not change who authored the primary family supplement. The correction now preserves the original supplement author in `supplemented_by`, separately from latest `reviewed_by` and each alternative actor. Modified supplements and human-corrected transcript drafts retain that identity through later decisions.

## Acceptance limits

Actual installed-Chrome acceptance, visual results and browser seek/time progression are owned by the parent; this report does not infer those results from unit tests. Controlled local provider HTTP responses exercise the real adapter but do not measure provider ASR accuracy. No paid live provider request or remote deployment was performed by this reviewer. Real family participants, semantic audio alignment, fidelity/false-positive quality and ablation remain explicit unmeasured follow-ups; no synthetic counter passes the real G2 quality gate.


## Final independent disposition

**PASS for reviewed code and native specification boundaries.** `supplement-origin-independent-green-results.json` records 486 assertions against all 33 complete migration files with `sourceDrift:[]`, stopped cluster, removed scratch directory, zero clients and no cleanup errors. Reproducible probe: `node docs/research/evidence/2026-11-10-g2-review/supplement-origin-independent-probe.mjs --g2-review --story-deletion`.

The run repeats the complete durable source/race/CAS/deletion scenarios and independently checks three distinct actors through modify→dispute→accept→approve and correction→dispute→approve. Both outputs retain the primary author's ID, alternative author's ID and actual latest reviewer, and the prior approved rendition is unchanged.

`helper-independent-recheck.json` and the final addendum in `helper-independent-review.md` record the second reviewer's independent replay of all helper findings and the author chain; all pass. The helper suites pass 43 tests, with full-source context and trusted-source revalidation preserved.

The reviewed parent receipt `../2026-11-07-g1-chrome/migrations-1794315062161-7004540c-9739-4d36-9f9f-a2ef1a0b75d1/results.json` passed 507 integrated assertions and both installed-Chrome flows before the final supplement-origin SQL patch. Actual source seek/time progression, durable review, same-request replay, consent withdrawal and invalid-provider pending behavior were observed. A final parent run after that patch remains the aggregate acceptance source; the earlier browser result is not represented as exercising the later patch.
