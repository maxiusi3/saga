# G2 persisted family review and local Chrome acceptance

User authorization: continue G2 under the G1 standard. Local synthetic accounts and environments are authorized; installed Chrome Web automation is the acceptance surface. Human-operated gates are waived into a follow-up list, not marked tested. No hosted deployment or paid live provider calls are included. Work builds on the existing uncommitted G1 implementation in its current branch; moving to a clean checkout would omit required deletion safeguards.

## Design

Keep the existing P2 tables and add a forward migration providing an atomic service-only review RPC. The actual story detail page mounts a connected family review panel. The panel loads durable review state, explicitly prepares a draft, presents every source paragraph for accept/modify/dispute/skip/reject, corrects transcript through a new version, and approves an immutable rendition. The existing disconnected assertion props are insufficient; the old POST endpoint's non-transactional mutations are replaced.

The selected approach uses source-preserving paragraphs as the baseline. Imported story text is explicitly `legacy_unaligned`, with no invented provider, confidence or audio timing. A configured transcription adapter can supply validated timed segments; controlled provider HTTP responses in local tests exercise the real adapter without claiming live ASR accuracy. Generative rearrangement cannot silently certify semantic truth. Only actual source excerpts are audio-backed; all edited text is labelled as a family supplement, and disputes retain multiple attributed alternatives. Arbitrary supplied draft prose is never approved merely because a separate assertion list passes.

Alternatives considered: retaining separate body and mutable assertion state allows rejected text to survive in the approved body; rebuilding all P2 storage loses compatibility with G1 erasure and existing downstream consumers. The incremental transaction approach addresses both issues.

## Persistence and concurrency

Each new revision owns its assertions. Stable request IDs, revision `edit_version` CAS and source hashes guard retry, stale page and concurrent reviewer writes. Each operation rechecks current membership, the story/project/asset deletion state and source identity in the transaction. Reading blocked sources fails closed. Approval is limited to the project owner or an active facilitator/co-facilitator; active storytellers may review. Empty, unreviewed, skipped, invalidated or unsupported assertions cannot be approved. Reject removes a paragraph; modifying a quote changes its attribution to family supplement and clears claims of audio verification. Disputes append author/time/text records and render alongside the original account.

Approval reconstructs body, summary, references and an assertion/attribution snapshot together, with a hash covering the result. Approved snapshots remain immutable even after supersession. Correcting transcription produces a new transcript and draft, invalidates old drafts, and leaves approved history intact. Source-hash comparison also catches direct legacy edits. New tables/columns must remain compatible with G1 deletion: story-owned audit/idempotency rows contain no retained prose and are removed with the story purge, or are represented in existing revision/assertion rows that purge already erases.

## Browser and evidence

Use the production connected panel and real review/transcription route handlers against a complete native PG17 schema, installed Google Chrome, and actual playable local media. Local auth/HTTP/Storage and controlled provider responses are declared substitutes. Verify durable reload, real seek/time progression, negative permissions, feature-off behavior, provider errors, repeat requests, simultaneous edits, transcript correction, immutable approvals and deletion. Keep first failing tests and all final receipts/source hashes. Existing synthetic benchmarks remain regression suites; real family/model quality and semantic audio alignment remain explicit human/provider follow-ups.
