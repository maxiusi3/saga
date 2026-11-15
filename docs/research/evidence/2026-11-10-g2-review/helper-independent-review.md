# Independent G2 helper review

**Final disposition: original A/B/C findings and D title observation resolved by independently replayed counterexamples; final helper suites 43/43 passed.** The original findings below are retained as review history.

Reviewer: `g2_transcription`, reviewing `g2_audit` changes read-only. Review scope: `ai-capability-gateway.ts`, `provenance-editor.ts`, `eval/g2-fidelity-benchmark.ts`, and their three Jest suites. No implementation files were changed during this review. The owning auditor and root agent received the substantive findings before this report was saved.

## Baseline and evidence

For all six files, the SHA-256 stored in `before-manifest.json` exactly matches the corresponding `git show HEAD:<path>` content. Therefore the working-tree diff against HEAD isolates this G2 helper change; it does not conflate inherited G1 modifications for these files. The originating specification is `docs/superpowers/specs/2026-11-10-g2-review-design.md`. Repository conventions came from `CLAUDE.md`; no additional AGENTS/CODING_STANDARDS/CONTRIBUTING file was found in the tracked-file search.

The three existing suites pass: **34 tests**, recorded in `helper-independent-tests.log`. Additional counterexamples below were executed against the actual TypeScript helpers transpiled in memory with the installed TypeScript compiler. They required no network, mock helper implementation or source modification. Passing the existing suites does not cover the counterexamples.

## Standards

No separate documented standards breach found. The changes remain pure, colocate their tests, preserve `null` confidence, and use UUID defaults without including generated segment IDs in the transcript content hash. Tests confirm zero confidence remains zero and nonfinite confidence is rejected. The new explicit `g2GatePassed:false` and unmeasured ablation fields correctly separate local regression evidence from release qualification.

## Spec findings

### P2 — Qualified text can become an unqualified verified assertion

Location at review time: `provenance-editor.ts:87-90`, `245`, `270-295`; related test `provenance-editor.test.ts` named “keeps negation and uncertainty in source excerpts instead of verifying their removal”.

Executed input: source and sourceQuote `Perhaps John won the race.`, subject `John`, claimText `John won the race.`, valid segment/time references. Observed result: `verificationStatus === 'verified'`; `accept` followed by `approveStoryRevision` returns body `John won the race.`. The substring checks allow dropping the qualifier. The current uncertainty test changes the wording of the verb, which fails the substring check for another reason and misses this case.

The design says “source-preserving paragraphs” and “Generative rearrangement cannot silently certify semantic truth.” A lexical substring can verify that characters occur in a segment; it cannot establish that removing their surrounding qualification preserves the account. Keep the complete source context for automatic verification or require explicit supplement treatment when shortening can remove qualification. Do not present a new substring heuristic as general semantic entailment.

### P2 — Dispute can launder an unsupported model claim into the primary approved account

Location at review time: `provenance-editor.ts:379-398`, `436-452`.

Executed input: source `John planted the tree.`, claim `John won the Nobel Prize.`, sourceQuote equal to the actual source. The draft correctly marks the claim `pending_review`. Applying `dispute` with the alternative `I remember a different story.` changes status to `disputed`, clears severe-fabrication state, and permits approval. Observed approved body:

```text
Disputed memory: John won the Nobel Prize.
Family alternative (family): I remember a different story.
```

The original sentence in this body was never a storyteller account. The design requires disputes to retain attributed accounts, and prohibits unsupported assertions from approval. Disputing should not convert unsupported model prose into an original disputed memory. Require a grounded original, or first require an explicit attributed family supplement/correction and preserve that attribution through later dispute.

### P2 — Approval's source recheck still trusts two mutable fields from the same assertion

Location at review time: `provenance-editor.ts:439-441`.

Executed input: build a valid source-backed draft `John planted the tree.`, accept its assertion, then change both `claimText` and `sourceQuote` to `John won the Nobel Prize.` while retaining the legitimate segment/transcript/story IDs. Observed result: approval succeeds and emits the fabricated body. The added check only compares the two supplied fields against one another; no immutable trusted segment snapshot is available at approval. The new test changes only claimText, so it does not exercise this paired modification.

The design requires source identities and actual evidence to be rechecked rather than trusting a separate assertion list. Either bind approval to trusted source data from the draft/transcript and revalidate against it, or explicitly keep this helper outside any authoritative approval boundary. The current production route uses the separate SQL workflow, so this is an exported-helper correctness gap, not evidence of a bypass of the new HTTP/SQL route.

### P3 observation — Arbitrary candidate title survives otherwise grounded approval

Location at review time: `provenance-editor.ts:204`, `458-471`.

Executed input: candidateTitle `John won a Nobel Prize` with a fully genuine source/claim `John planted the tree.`. Observed approved title remains `John won a Nobel Prize`. The diff correctly ignores candidateBody/candidateSummary, but leaves candidateTitle as unverified generated prose. If this is intentionally a caller-authorized family title, the API should distinguish it from model candidate text; otherwise it remains outside the helper's grounding guarantees. The current SQL story title originates from the saved story rather than this helper.

## Immutable history and benchmark observations

`approveStoryRevision` now refuses approved/superseded/invalidated records, reconstructs approved body/summary/provenance together, and clones assertion and alternative snapshots. `applyFamilyReviewDecision` returns new objects and appends alternatives rather than overwriting the previous array. I found no newly introduced mutation of a prior approved snapshot in the changed execution paths. `propagateTranscriptCorrection` remains unchanged and should not be treated as a database authorization or immutable-storage boundary.

The benchmark now correctly reports `evidenceKind:synthetic_regression`, zero real families, no measured playback or real-model quality, `g2GatePassed:false`, and null unmeasured ablation counters. Its 200 examples are generated from ten synthetic templates. `audioSeekSpotCheck*` is a historical metadata comparison counter, not audio playback; “omission” means missing citation fields, not detecting omitted story content. Wilson intervals on these fixtures are descriptive synthetic calculations and do not estimate independent real-family/model performance. The E0 severe-approval check still starts with unreviewed assertions, so that individual check can fail at the review prerequisite; the separate planted-error loop was improved to mark claims accepted before attempting approval. These are scope/interpretation limits, not a reason to claim G2 acceptance.

## Disposition

Three actionable helper findings and one title-contract observation were sent to the owning auditor/root. No production-helper edits were made by this reviewer. Recheck their fixes and rerun these counterexamples before marking the helper review resolved. Browser/provider acceptance remains a separate root-agent task.


## Final independent recheck

The final auditor implementation was re-read and the original counterexamples rerun against the actual helpers using independent in-memory TypeScript transpilation. Recorded receipt: `helper-independent-recheck.json`. The three Jest suites were then run independently: **43 tests passed**, with the result in `helper-independent-final-tests.log`.

| Original finding | Final observed behavior | Disposition |
|---|---|---|
| A: dropped qualification/context | Three prefix/negation/later-context variants remain pending and cannot be directly accepted | Resolved |
| B: unsupported primary made disputed | `dispute` throws for the unsupported generated primary | Resolved |
| C: paired claim/sourceQuote mutation | Approval compares against its required trusted transcript argument and rejects both changed fields | Resolved |
| D: generated factual title | Both draft creation and approval use neutral `Family Memory`, including a title changed after draft creation | Resolved |
| Supplement author confused with later reviewer | Clara modifies, Ben disputes, Owner accepts: primary remains attributed to Clara and alternative to Ben; latest reviewer remains Owner separately | Resolved |

Positive checks also passed: a complete unchanged self-correction remains an honest quoted source; mutating the later input alternative cannot mutate the already-approved assertion snapshot; superseded approved state cannot be approved again; and benchmark output still refuses to claim actual G2 acceptance, real-family/model quality or measured audio playback.

The new source argument explicitly requires the caller to load authoritative transcript data. This pure helper does not authenticate a caller or make an arbitrary supplied transcript trustworthy; the production SQL workflow remains the persistence/authorization boundary. Automatic verification now conservatively requires the entire source segment rather than asserting semantic entailment of arbitrary excerpts. No remaining actionable issue was found in the reviewed repaired cases. No implementation files were edited by this reviewer.

### Final reviewed file hashes

| File | SHA-256 |
|---|---|
| `packages/web/src/lib/server/ai-capability-gateway.ts` | `c36d79f6bc472101f6ec75b3c771c3116486e08c39dcf4fc28b38e544257d3c5` |
| `packages/web/src/lib/server/provenance-editor.ts` | `661fbde1b8473cc3d88a448c0356b2c87183205925e3fb8b74e695a39c01d31e` |
| `packages/web/src/lib/eval/g2-fidelity-benchmark.ts` | `ba84524a11376d882da785b9c65d166d75d98839d36e0ad30c062eb76e65c919` |
| `packages/web/src/lib/server/__tests__/ai-capability-gateway.test.ts` | `bb144dfe7ae0061ce0a85fefa917fe007251bedd37463cb19bb5f2e557a55389` |
| `packages/web/src/lib/server/__tests__/provenance-editor.test.ts` | `9173b14d552967818563aae11a8a6c483129d316c2d32e7ec94dca9fe488bc13` |
| `packages/web/src/lib/eval/__tests__/g2-fidelity-benchmark.test.ts` | `162e7cec2615dd94b886975996e7f200a74615b65b2c99d8a32c6b6a830efde6` |

### Separate Chrome receipt verified

The root-agent receipt at `docs/research/evidence/2026-11-07-g1-chrome/migrations-1794315062161-7004540c-9739-4d36-9f9f-a2ef1a0b75d1/results.json` was read during this recheck. It reports overall **507 assertions passed**, `transcriptionChrome.status: passed`, zero unexpected transcription errors, three exact multipart loopback calls (success, consent withdrawal, invalid response), restored globals, and a fully stopped/removed native PG cluster. This confirms the declared local execution path; its synthetic tone audio and provider response do not measure real speech/model quality or semantic audio alignment.
