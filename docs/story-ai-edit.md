# Story AI editing and independent fact review

The story detail page's `StoryReviewPanel` now includes **Prepare AI edited draft**. The existing manual workflow remains available. A current review selects the transcript version; the user sees model/region readiness and must explicitly consent to sending that story's transcript to both processors. Anthropic edits one paragraph per authoritative segment. OpenAI independently reviews the exact edited paragraphs against the full ordered original transcript. A passing model result creates a new unapproved draft. Family members still accept, modify, dispute, or remove every paragraph before an authorized family approver can approve it.

## Configuration

All variables are server-only except the existing media feature flag. No real provider call was made in the local verification.

```dotenv
MEDIA_ASSETS_ENABLED=true
G2_AI_EDIT_ENABLED=true
ANTHROPIC_API_KEY=<qualified account key>
OPENAI_API_KEY=<qualified account key>
G2_AI_EDITOR_MODEL=claude-opus-5-5
G2_AI_REVIEWER_MODEL=gpt-6-astra
G2_AI_EDITOR_REGION=us
G2_AI_REVIEWER_REGION=us
G2_AI_EDITOR_POLICY_EVIDENCE=<JSON evidence below>
G2_AI_REVIEWER_POLICY_EVIDENCE=<JSON evidence below>
```

The present serving configurations are the direct US Anthropic Messages endpoint and direct US OpenAI Responses endpoint, with the exact approved Opus 5.5 and Astra model IDs. Other regions, older Opus IDs, or arbitrary base URLs remain unavailable. A future destination/model must be qualified and admitted in the policy registry **and** the forward SQL configuration allowlist. Readiness is not a claim that credentials work or the provider contract has been independently audited.

Each evidence value follows `ProviderPolicyEvidence`: `provider` (`anthropic` / `openai`), `accountOrOrgId`, exact `modelId`, `allowedRegions:["us"]`, `trainingOptOutConfirmed:true`, `zeroDataRetentionConfirmed`, `maxRetentionDaysAllowed` (0–7 when not ZDR), UTC `evidenceDate` no older than 90 days, and an operator-supplied `evidenceReference`. Never copy the synthetic fixture evidence into deployment. The public configuration exposes model, provider, region and a policy digest, without account documents or keys. Consent records bind each provider, region, policy version, actor and story.

Sources for adapter shapes: [Anthropic Messages TypeScript API](https://github.com/anthropics/anthropic-sdk-typescript/blob/main/src/resources/messages/messages.ts), [OpenAI Responses create](https://developers.openai.com/api/reference/resources/responses/methods/create). Anthropic receives `/v1/messages` with `model`, `max_tokens`, `system`, `messages` and version header. OpenAI receives `/v1/responses` with `instructions`, `input`, `max_output_tokens`, and `store:false`. Both responses must identify the exact configured model and indicate complete output; refusal/truncation is rejected. No tools or provider SDK automatic retries are used.

## Boundaries and persistence

`GET /api/stories/:storyId/ai-edit` authenticates and reads authorized durable status before returning readiness. `POST` accepts only request UUID, revision UUID, edit version, true consent and the displayed policy version. The server loads segments and source fingerprint. Browser-supplied prose, actor IDs, citations and model output are rejected.

Input is limited to 200 segments / 180 KB serialized source. There is exactly one edited paragraph per source segment in source order, retaining the entire exact quote, segment UUID and exact nullable timing. Total generated paragraph data is limited to 350 KB, each paragraph to 10,000 characters, and each provider response to 700 KB. Calls share a default 55-second deadline and stream-reading races enforce it even if a transport ignores abort. Empty/malformed JSON, extra body fields, unknown source IDs, quote substitutions, false timing, omitted/duplicated/reordered source segments, unsupported verdicts and severe risk are rejected.

The service-only `story_ai_edit` RPC persists a contentless reservation bound to actor, story, current transcript/revision/edit version, source hash/fingerprint and policy/configuration. It issues a sender token only on first reservation. Atomic `editor` and `reviewer` transitions recheck membership, source/CAS, media lineage, tombstones and both consent records before permitting each send. Duplicate or uncertain attempts do not acquire a second sender token. The final commit rechecks the same conditions and validates every paragraph/verdict against authoritative segment rows.

Request states are `prepared`, `editing`, `reviewing`, `completed`, `rejected`, or `invalidated`. A transport error, timeout or ambiguous DB response remains unresolved; the UI asks the user to reload and makes no automatic resend. A lost successful commit can be recovered by repeating the **same** request identity, returning durable state without a new model call. Identical-source unresolved requests remain blocked. A newly selected source/CAS with explicit consent can retire an obsolete reservation; its previous lease can never commit. Known malformed output is marked rejected with only a fixed error code, no provider prose copy.

Draft body and summary are generated only from the ordered persisted assertions. The model cannot attach harmless assertions to an arbitrary body. Each assertion retains an AI evidence record binding its exact claim hash, full source fingerprint, independent verdict/risk flags, policy and provider/model response metadata to the completed request. Family approval accepts such checked paraphrases only through this evidence predicate, while still verifying exact source quote and timing. Approved body is regenerated from actual family decisions. Family modifications lose audio provenance and appear as attributed family supplements; original AI approval labels are suppressed when the wording changes. Approved and superseded snapshots remain immutable.

When the transcript or source segment was human-corrected, AI editing inherits `family_supplement` and the transcript creator as `supplemented_by`. The edit requester and approver do not replace the correction author. Such paragraphs retain textual source links for model review but expose no audio timing or original-audio evidence. The support predicate checks those source links and attribution as well as the claim hash; a manual modification that clears the links loses AI source support even when its text is unchanged. Literal and semantic search always project a family supplement's approved claim text with the family author's identity, while an original-transcript AI paraphrase projects its exact source quote.

AI request rows contain no transcript/paragraph copy. Their FKs and the G1 erasure trigger delete them with story content. Generated prose/evidence resides solely in existing `story_revisions` / `story_assertions`, which the G1 purge and tombstone restore fence already cover. Late responses after deletion cannot reinsert content. Forward migration `20261113000002_story_ai_edit.sql` extends the private pre-recovery approval predicate and the review JSON; it leaves the public transcription recovery wrapper intact and asserts each original fragment occurs exactly once.

## Local acceptance

Focused Jest tests cover configuration/consent, bounded real request/response shapes, exact citation validation, independent verdict rejection, UI consent/state and route auth/input. Native `--ai-edit` scenarios cover separate service-role connections, duplicate dispatch prevention, evidence immutability, family approval, older approval preservation, stale version/source replacement, revoked consent/membership, cross-family access and erasure. `--ai-edit --chrome` exercises the production handlers, Supabase SDK, full migration chain and installed Chrome against controlled loopback HTTP provider servers. The browser shows text visibly different from raw source, the full original quote, explicit family acceptance and persisted approval. Controlled outputs also test fabricated citations, severe risk, withdrawal, deletion, stale results, interrupted transport and completed replay.

Evidence is indexed in `docs/research/evidence/2026-11-13-audit-repair/ai/`. These tests prove local code/contract behavior only. Real provider credential availability, retention/region qualification, speech meaning preservation, Chinese family editing quality, and family usability acceptance remain external gates before deployment. This batch does not deploy or apply remote migrations.
