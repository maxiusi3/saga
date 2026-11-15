# G2 final-increment code-quality review

Reviewer: `/root/g2_audit`. Baseline: `before-manifest.json` (flat repository path→SHA256 map captured before G2). Scope discovery found 13 modified existing source/test/harness/documentation files and 22 new source/test/harness files. This includes the historical P2 benchmark corrections in `experiments/pg17-p2-g2-verification/{verify.mjs,README.md}` and excludes unrelated pre-existing G1 edits.

The persistence, service, provider, connected UI, client and local harness review is independent. The six gateway/provenance/benchmark helper files were authored by this reviewer; their independent review belongs to `/root/g2_transcription`, with findings in `helper-independent-review.md`. No claim of independent self-review is made.

## Findings addressed

1. **Persisted supplement loses origin after later dispute.** Native RED reproduces modification labelled as family supplement, later dispute changing it to disputed memory, primary author label disappearing and approval failing `23514`. A distinct retained origin author is also necessary when another actor reviews/disputes the supplement. Persistence now stores `supplemented_by` separately and preserves family-supplement attribution. A final independent run passed 486 native assertions including cross-actor modify/dispute/accept/approval and correction/dispute/approval; see `spec-review.md`.
2. **Client action crosses actor change during asynchronous token lookup.** Both new clients now capture the starting actor, require a bearer token and recheck current actor after token lookup before issuing the request. This closes the previous fallback-to-cookie behavior on a changed session.
3. **Parent review edits change CAS during an in-flight transcription.** The transcription control reports busy state to the parent. Parent review mutations, transcript correction and reload are locked while the outbound operation is active; the parent epoch rejects stale responses after story/actor changes.
4. **Detached source audio continues after reload.** Reload and component cleanup pause the existing element before detaching it. The unit regression checks the actual detached element was paused; installed-Chrome timing is a separate parent acceptance receipt.
5. **Helper verification could strip qualifiers and dispute unsupported generated primary prose.** Exact complete segment context replaces substring acceptance. Unsupported primary claims cannot become sourced memories via a dispute. Approval takes an explicit trusted transcript, checks source identity/hash and rechecks claim/quote/timing against its real segment. Generated factual titles are replaced by a neutral title. The helper's trust boundary is documented: callers must fetch the authoritative transcript; the pure helper does not authenticate arbitrary JavaScript callers.
6. **Helper supplement origin confused with latest reviewer.** `supplementedBy` records the primary supplement author. Later decisions update the reviewer without changing that origin, while alternatives retain their separate authors. A different-actor modify→dispute→accept→approve test first failed and then passed.
7. **Historical benchmark falsely reported quality from constants.** The old standalone migration harness now labels the constants as an unmeasured arithmetic illustration. Model/family/audio quality fields are null and `g2GatePassed` is false. The current helper benchmark is labelled synthetic regression with zero real-family/model/playback measurement and unmeasured ablation.
8. **Correction field accessible label included mutable textarea prose.** Parent's installed-Chrome failure identified an implicit-label ambiguity. Current panel uses stable `useId` labels via `htmlFor` and sibling textareas. This change is limited to reliable labels, with the browser regression rerun by the parent.
9. **ASR checkbox referred to an opaque hash as the policy.** Parent replaced model/region/hash display with clear recording transfer and US processing language plus the official provider privacy link; the policy hash remains bound on the wire. A general privacy link must not be described as evidence of account-specific retention/training settings.

## Reviewed boundaries

- SQL write capabilities are not caller-set GUCs. Direct service-role mutations cannot change revision membership or reviewed source. G1 authorized purge is the sole erasure exception; completed and unknown request identities are part of that purge graph.
- The provider adapter accepts only configured provider/model/region/policy. Source storage URL is derived from the authorized media asset; bytes are bounded and matched to its SHA256. Consent, source, asset and CAS checks repeat around external waits. The pending ledger prevents repeat outbound requests after uncertain results.
- Source words/events are retained by the provider parser; confidence is unknown rather than invented from log probability. Speaker/time bounds and exact normalized provider-text coverage are checked. This validates adapter structure, not real speech accuracy.
- UI output is rendered as React text; family and alternative attribution remain explicit. Review request IDs persist for unknown write retries, and response epochs isolate actor/story changes. The history view consumes approved snapshots rather than reconstructing old approvals from mutable current state.
- Browser fixtures declare synthetic Auth/PostgREST/Storage/provider boundaries, use real compiled route handlers and Supabase SDK/native PG, and explicitly block undeclared provider network destinations. Tone WAV playback tests timing mechanics only. The Range fixture fix returns `206` and `Accept-Ranges`; it does not create a speech-fidelity claim.

## Evidence

- `helpers-independent-red.log`: 8 independent-review cases fail before repair.
- `helpers-supplement-author-red.log`: separate primary-author attribution regression fails before repair.
- `helpers-final-green.log`: 3 helper suites / 43 tests pass after repairs.
- `helpers-final-lint.log`: all six final helper/benchmark source and test files pass ESLint. `audit-diff-check.log`: repository diff check passes.
- `audit-typecheck.log`: web TypeScript check passed before the final supplement-origin/UI wording amendments; parent/final receipts must cover those later edits.
- `spec-independent-native-results.json`: independent full-schema run, 450 assertions / 33 migration files, no drift, clean teardown; original source-integrity issues all pass.
- `supplement-dispute-independent-red-results.json`: final action-chain defect reproduced independently.

Final installed-Chrome and aggregate verification receipts are parent-owned. The already inspected pre-origin-patch receipt passed 507 integrated assertions and both Chrome flows; the parent is rerunning after the final SQL patch. No unobserved final run is asserted here.

## Remaining limits

No real household sample, live ASR accuracy, semantic alignment, generative editing quality or measured ablation was run. Unknown provider outcomes deliberately remain pending, requiring an explicit future reconciliation path rather than automatically risking another paid/audio disclosure. Hosted Supabase deployment and production credentials/policy evidence remain outside this local acceptance scope. These are stated coverage limits, not silently passed gates.


## Final code-review disposition

**No unresolved blocking finding in the reviewed final code.** The persisted origin fix passed independent native replay (486 assertions, no source drift, clean teardown), and the six helper/benchmark files passed the other reviewer's final independent checks (`helper-independent-recheck.json`). Final helper test count is 43; lint and diff checks passed. The final integrated browser/build/test receipt remains the parent's completion gate and is appended once observed.
