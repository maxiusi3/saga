# UR Saga Phase 2 Public Archive And Wiki Editor Agent Design

## Summary

Phase 2 adds a controlled public archive draft layer to UR Saga. It lets a storyteller opt in to contribute a specific story as anonymized text plus structured story elements, then lets the Wiki Editor Agent organize active public contributions into candidate events and reviewer-approved event drafts.

This phase validates the public collective memory loop without launching a fully public encyclopedia. It does not add public event pages, media enhancement, photo restoration, audio sharing, photo sharing, or generated video.

The selected approach is the controlled Wiki draft layer:

1. The storyteller or story creator is the only user who can formally opt in.
2. A facilitator can invite the storyteller to contribute a story, but cannot consent on their behalf.
3. The user sees an anonymized preview before committing the contribution.
4. The committed public contribution contains anonymized text and anonymized structured elements only.
5. The user can immediately see their own anonymized contribution after committing.
6. The Wiki Editor Agent processes only active public contributions.
7. A single contribution can create a candidate event.
8. Two or more matching active contributions can upgrade the candidate into a draft event.
9. A platform-level public archive reviewer must approve a Wiki draft before contributors can see the event summary.
10. Contributors see aggregate event summaries and a small number of anonymized micro-perspective excerpts, not all contributed text.

## Current Context

Phase 1 has implemented the private biography loop:

1. Interview Agent.
2. Editor and Librarian Agent.
3. `agent_runs`, `agent_artifacts`, `interview_sessions`, `interview_events`, and `story_elements`.
4. Durable private agent artifacts and structured elements.
5. Off, Low, and High Interview Agent intervention levels.

The current product still has shallow sharing concepts:

1. `stories.is_public` exists in parts of the app.
2. Existing share UI is oriented around sharing stories with project members.
3. The privacy pledge currently promises that stories remain visible only to invited family members.
4. There is no durable public archive consent model, anonymized contribution snapshot, platform reviewer role, or Wiki Editor Agent.

Phase 2 must not overload `stories.is_public`. Family sharing, story visibility, and anonymous public archive contribution are separate concepts and need separate storage, permissions, and UI.

## Goals

1. Add per-story public archive opt-in with explicit consent.
2. Generate a balanced anonymized preview before contribution.
3. Store an immutable contribution snapshot that contains only anonymized text and structured elements.
4. Let the contributor view their own anonymized contribution immediately after submission.
5. Add the Wiki Editor Agent for candidate event and draft event creation.
6. Add platform-level public archive reviewer permissions.
7. Let contributors view approved event summaries related to their own contributions.
8. Support withdrawal so a contribution is removed from visible results and future Wiki inputs.
9. Preserve minimum audit evidence for consent, withdrawal, review, and processing.
10. Keep public archive identifiers separate from private project, story, and user identifiers.

## Non-Goals

1. No full public event pages.
2. No anonymous browsing of the public archive.
3. No all-user public feed.
4. No Media Agent.
5. No photo repair, color correction, clarity enhancement, photo-to-video, or story-to-video generation.
6. No public sharing of voice, audio, photos, exact identity, exact home address, or generated derivatives.
7. No facilitator opt-in on behalf of the storyteller.
8. No user editing of the anonymized preview in this phase.
9. No use of existing privacy pledge as public archive consent.
10. No Wiki Editor access to private story transcripts, private audio, private photos, or private story elements after contribution commit.

## Roles And Permissions

### Storyteller Or Story Creator

The storyteller or story creator is the consent authority for a story. In the current schema, `stories.storyteller_id` is the authoritative user unless a future migration introduces a separate creator column.

This user can:

1. Open the contribution flow for their story.
2. Generate an anonymized preview.
3. Commit or cancel the public contribution.
4. View their own anonymized public contribution.
5. Withdraw the contribution.
6. View approved Wiki event summaries linked to their active contribution.

This user cannot:

1. Approve Wiki event drafts.
2. See unapproved Wiki drafts.
3. See other users' full contributions.

### Facilitator

The facilitator can help start the process but cannot provide consent.

This user can:

1. Invite the storyteller to contribute a specific story.
2. See that an invitation was sent.

This user cannot:

1. Generate the final consent preview for another user's story.
2. Commit public archive opt-in for the storyteller.
3. Review cross-user public archive drafts.
4. See another user's anonymized contribution unless the storyteller separately has access to the same approved event summary and the product exposes it later.

### Wiki Editor Agent

The Wiki Editor Agent is a public archive processing agent. It can only read committed active public contributions and public contribution elements.

It cannot:

1. Read `stories.transcript`.
2. Read audio assets.
3. Read photo assets.
4. Read private `story_elements` directly.
5. Read private project, story, or user identifiers from public output.
6. Continue using withdrawn contributions as active inputs.

### Public Archive Reviewer

The reviewer is a platform-level role, not a project role. Phase 2 adds `platform_roles` with `public_archive_reviewer`.

This user can:

1. View pending Wiki event drafts.
2. View enough anonymized source contribution material to review the draft.
3. Approve or reject Wiki drafts.
4. Return a draft to `needs_reprocessing` when the summary or matching quality is insufficient.

This user cannot:

1. Access private source stories through the reviewer UI.
2. Override contributor withdrawal.
3. Act as a storyteller's consent authority.

## User Experience

### Entry Points

Phase 2 has two contribution entry points:

1. Story detail page: the storyteller sees an action such as "Anonymously add this story to the Collective Archive."
2. Resonance CTA: after private story processing, the system may show a prompt when private story elements suggest a possible public resonance event.

The Resonance CTA may use private-side data for lightweight matching and messaging. It must not create a public contribution, write public archive rows, or start Wiki Editor processing before explicit opt-in.

### Contribution Preview

When the storyteller opens the contribution flow, the server generates an anonymized preview. The preview shows:

1. The anonymized story text to be contributed.
2. The structured elements to be contributed.
3. A clear consent scope: text and structured elements only.
4. A clear exclusion list: no audio, voice, photos, exact identity information, or generated media.
5. The current public archive consent copy version.
6. Submit and cancel actions.

The user can submit or cancel. They cannot edit the anonymized preview in Phase 2. This keeps the MVP narrow and makes anonymization quality measurable. If trust or quality problems emerge, a later phase can add a preview editor.

### Facilitator Invitation

When a facilitator believes a story belongs in the public archive, the facilitator can send a contribution invitation to the storyteller. The invitation is a prompt, not consent.

The invitation flow must:

1. Create a durable invitation record or notification tied to the specific story.
2. Show the storyteller that the facilitator requested contribution.
3. Require the storyteller to open the preview and consent flow themselves.
4. Expire or dismiss independently from any public contribution state.
5. Never create a `public_contributions` row by itself.

### Contribution Commit

After the user confirms, the system creates a public contribution snapshot and contribution element rows. The storyteller can immediately view the committed anonymized contribution in a "My Public Contribution" panel on the story detail page.

The contribution status starts as active with Wiki processing pending. If Wiki processing fails, the contribution remains active and can be retried.

### Wiki Result Visibility

Before reviewer approval, the contributor sees a pending state.

After approval, the contributor can see an event summary related to their contribution:

1. Event label.
2. Active contribution count.
3. Timeframe.
4. Place scope.
5. Historical context summary derived from active public contributions.
6. Perspective summary showing different micro-experiences.
7. A small number of anonymized representative excerpts.
8. Uncertainty notes.

The contributor cannot see every full contribution in the cluster.

### Withdrawal

The contributor can withdraw their public archive contribution. Withdrawal must:

1. Mark the contribution as withdrawn.
2. Remove it from contributor-visible event summaries.
3. Remove its excerpts from approved and pending event drafts.
4. Exclude it from all future Wiki Editor inputs.
5. Recalculate or mark affected event clusters for reprocessing.
6. Preserve a minimum audit record proving the opt-in and withdrawal lifecycle.

If an event draft only has one active linked contribution after withdrawal, it should downgrade to candidate or return to pending reviewer attention, depending on the implementation state.

## Anonymization Policy

Phase 2 uses balanced anonymization.

The anonymizer must remove or generalize:

1. Names of private people.
2. Contact information.
3. Precise home addresses.
4. Exact workplace identifiers when not necessary for event matching.
5. Exact school names when not necessary for event matching.
6. Unnecessary precise dates that increase re-identification risk.
7. Any photo, voice, audio, or media reference.

The anonymizer may preserve:

1. Decade, year, month, or date range when needed for event matching.
2. City, region, state, province, or country-level place scope.
3. Institution type, such as factory, school, hospital, military unit type, or local office.
4. Family relationship roles, such as older brother, mother, neighbor, teacher, or supervisor.
5. Event keywords.
6. Emotional and reflective content.

When uncertain, the anonymizer should prefer generalization over detail preservation. The preview should make the anonymized output visible to the contributor before commit.

## Data Model

Phase 2 should add focused tables rather than expanding `stories.metadata` or reusing `stories.is_public`.

### `platform_roles`

Platform-level role assignment.

Key fields:

1. `id`.
2. `user_id`.
3. `role`, initially `public_archive_reviewer`.
4. `granted_by`.
5. `granted_at`.
6. `revoked_at`.

This table is independent from `project_roles`.

### `public_contribution_invitations`

Facilitator request for a storyteller to consider contributing a story. This is not consent.

Key fields:

1. `id`.
2. `story_id`.
3. `project_id`.
4. `invited_storyteller_id`.
5. `invited_by`.
6. `status`, such as `pending`, `accepted`, `dismissed`, or `expired`.
7. `message`.
8. `created_at`.
9. `responded_at`.

Accepting an invitation only opens the storyteller-owned preview flow. It does not commit a contribution.

### `public_contributions`

Committed public archive contribution snapshot.

Key fields:

1. `id`.
2. `public_ref`, a non-private stable identifier used in public archive outputs.
3. `source_project_id`, private service-side reference.
4. `source_story_id`, private service-side reference.
5. `source_user_id`, private service-side reference.
6. `source_story_hash`, safe source reference for audit and deduplication.
7. `source_content_hash`, used to detect stale previews.
8. `consent_scope`, limited to anonymized text and structured elements in Phase 2.
9. `consent_copy_version`.
10. `anonymized_title`.
11. `anonymized_text`.
12. `anonymized_summary`.
13. `status`, such as `active` or `withdrawn`.
14. `wiki_status`, such as `pending`, `processed`, or `failed`.
15. `submitted_at`.
16. `withdrawn_at`.

The private source references must never be exposed in contributor-facing public archive responses.

### `public_contribution_elements`

Anonymized structured elements derived from Phase 1 `story_elements`.

Key fields:

1. `id`.
2. `public_contribution_id`.
3. `element_type`, matching private element types: time, place, person, event, theme, emotion, decision, consequence, reflection.
4. `value`.
5. `normalized_value`.
6. `source_quote`, anonymized or omitted when quote disclosure is risky.
7. `confidence`.
8. `review_status`.

Person elements must store relationship or social role rather than private names.

### `public_event_clusters`

Wiki Editor event candidates and drafts.

Key fields:

1. `id`.
2. `status`, such as `candidate`, `draft`, `approved`, `rejected`, or `needs_reprocessing`.
3. `event_label`.
4. `timeframe`.
5. `place_scope`.
6. `historical_context_summary`.
7. `perspective_summary`.
8. `representative_excerpts`.
9. `uncertainty_notes`.
10. `confidence`.
11. `review_status`.
12. `reviewed_by`.
13. `reviewed_at`.
14. `created_at`.
15. `updated_at`.

Single-contribution clusters remain candidates. Multi-contribution matches may become drafts.

### `public_event_contributions`

Join table between public event clusters and active contributions.

Key fields:

1. `public_event_cluster_id`.
2. `public_contribution_id`.
3. `match_confidence`.
4. `perspective_summary`.
5. `excerpt_allowed`.
6. `created_at`.
7. `removed_at`.

Withdrawal should set linkage inactive or removed rather than preserving active visibility.

### `public_archive_audit_events`

Minimum audit trail for consent and processing.

Key fields:

1. `id`.
2. `event_type`, such as `preview_generated`, `opted_in`, `wiki_processed`, `review_approved`, `review_rejected`, or `withdrawn`.
3. `actor_user_id`.
4. `public_contribution_id`.
5. `public_event_cluster_id`.
6. `consent_copy_version`.
7. `metadata`.
8. `created_at`.

After withdrawal, this table may retain minimum source hashes and timestamps, but must not retain active Wiki input content.

### Existing Agent Tables

Phase 2 should extend the shared agent layer:

1. Add `wiki_editor` to shared `AGENT_TYPES`.
2. Extend the `agent_runs.agent_type` check constraint to allow `wiki_editor`.
3. Add artifact types such as `anonymized_contribution_preview`, `wiki_event_candidate`, and `wiki_event_draft`.
4. Continue using `agent_runs` for model metadata, status, input summary, output summary, errors, and traceability.

The implementation must ensure Phase 1 private agent reads remain scoped to private story access, and Phase 2 Wiki agent reads remain scoped to public contribution access.

## Data Flow

### Preview Flow

1. The storyteller opens the contribution flow for a story.
2. The API verifies the current user is the story's storyteller or creator.
3. The API reads the story, completed Editor Agent artifacts, and private `story_elements`.
4. The anonymizer produces a preview with anonymized text and anonymized structured elements.
5. The preview is returned to the user.
6. No `public_contributions` row is created during preview.

Preview may be recorded as a private `agent_artifact` linked to the story so the commit step can detect stale content and avoid reprocessing.

### Commit Flow

1. The user confirms the preview.
2. The API verifies the story content hash still matches the preview source.
3. The API creates `public_contributions`.
4. The API creates `public_contribution_elements`.
5. The API records an `opted_in` audit event.
6. The API queues or triggers Wiki Editor processing.
7. The user sees their committed anonymized contribution immediately.

### Wiki Editor Flow

1. The Wiki Editor Agent reads active public contributions and public contribution elements.
2. It finds similar existing event candidates or drafts.
3. If no suitable match exists, it creates or updates a candidate event.
4. If at least two active contributions match, it creates or updates a draft event.
5. It writes `public_event_clusters`, `public_event_contributions`, and Wiki agent artifacts.
6. The draft remains hidden from contributors until reviewed.
7. A `public_archive_reviewer` approves or rejects the draft.
8. After approval, linked contributors can view the event summary.

### Withdrawal Flow

1. The contributor requests withdrawal.
2. The API verifies the current user owns the contribution.
3. The contribution status becomes withdrawn.
4. Event linkages are removed or marked inactive.
5. A withdrawal audit event is recorded.
6. Affected event clusters are marked for reprocessing.
7. Contributor-visible summaries stop including withdrawn content.

## Wiki Editor Agent Rules

The Wiki Editor Agent should behave like a careful encyclopedia editor, not like an oracle.

Phase 2 event context is evidence-limited. The Wiki Editor can summarize what active public contributions support, but it must not invent external historical facts. If later phases add cited external source ingestion, those facts must be stored with explicit citations and separated from contribution-derived claims.

Required output:

1. `event_label`, a neutral title.
2. `timeframe`, with precision matching the evidence.
3. `place_scope`, no more precise than needed.
4. `historical_context_summary`, derived only from active public contributions unless the implementation later adds cited external sources.
5. `perspective_summary`, preserving micro-perspective diversity.
6. `representative_excerpts`, using anonymized snippets only.
7. `uncertainty_notes`, explaining ambiguous matches, dates, or places.
8. `source_trace`, containing public contribution IDs only.

Required behavior:

1. Do not turn one contribution into a public consensus.
2. Do not merge low-confidence similar events.
3. Prefer separate candidates when event identity is ambiguous.
4. Never expose private source identifiers in public output.
5. Remove withdrawn contributions from active reasoning on the next processing pass.
6. Keep evidence and uncertainty visible to reviewers.

## API And Service Boundaries

Implementation should keep public archive operations behind server routes and server-side stores.

Expected API surfaces:

1. Generate contribution preview for a story.
2. Commit a contribution from a preview.
3. Get the current user's contribution status for a story.
4. Withdraw a contribution.
5. Invite a storyteller to consider contributing a story.
6. Trigger or retry Wiki Editor processing.
7. List reviewer-visible pending Wiki drafts.
8. Approve or reject a Wiki draft.
9. Get contributor-visible approved event summaries.

Expected server modules:

1. `public-archive-store`, for public contribution and event persistence.
2. `public-archive-access`, for contributor and reviewer authorization.
3. `public-archive-anonymizer`, for deterministic preview transformation.
4. `wiki-editor-agent`, for candidate and draft event generation.

Public archive code should not be added to the existing private story services in a way that makes private and public responsibilities unclear.

## Privacy And RLS

All new public archive tables must have RLS enabled.

Direct `anon` and generic `authenticated` table privileges should be revoked unless a narrowly scoped policy is explicitly required.

Access rules:

1. Contributors can read their own public contributions.
2. Contributors can withdraw their own active contributions.
3. Contributors can read approved event summaries linked to their active contribution.
4. Contributors cannot read unapproved drafts.
5. Contributors cannot read all source contributions for an event.
6. Reviewers can read and update pending public event drafts.
7. Reviewers can see anonymized source material needed for review.
8. Facilitators can create contribution invitations only for stories in projects they can manage.
9. Invited storytellers can read, accept, dismiss, or ignore their own invitations.
10. No client can directly read private source story, project, or user identifiers from public archive responses.
11. Service-role routes can perform server-side processing and auditing.

The existing privacy pledge must be updated or supplemented in UI copy so public archive consent is clearly separate from family-only project privacy.

## Error Handling

1. Preview generation failure must not create a public contribution.
2. Stale preview commit must fail and ask the user to regenerate the preview.
3. Missing private `story_elements` should not block contribution; the contribution can use anonymized text only and mark element quality as missing.
4. Wiki Editor failure should set `wiki_status = failed` and allow retry.
5. Reviewer rejection should leave the user's own anonymized contribution visible but hide event draft results.
6. Withdrawal failure must not show a false withdrawn state.
7. Permission failures should return 403 without confirming whether unrelated contributions or event drafts exist.
8. Public archive processing should be idempotent by content hash and active contribution set.

## Testing Strategy

### Unit Tests

1. Anonymizer removes direct PII and precise addresses.
2. Anonymizer preserves useful public event context at safe granularity.
3. Consent scope includes text and structured elements only.
4. Wiki matcher creates candidate for one contribution.
5. Wiki matcher upgrades to draft for two or more matching active contributions.
6. Wiki matcher avoids merging low-confidence events.
7. Withdrawal removes a contribution from active Wiki inputs.

### API Tests

1. Storyteller can generate preview.
2. Facilitator cannot commit contribution for storyteller.
3. Facilitator invitation creates no public contribution.
4. Accepting an invitation only opens the storyteller preview flow.
5. Opt-in before preview or with stale preview fails.
6. Commit creates contribution, elements, and audit event.
7. Commit does not persist audio, photo, or media data.
8. Contributor can read own contribution.
9. Contributor cannot read unapproved Wiki draft.
10. Contributor can read approved summary linked to own active contribution.
11. Withdrawn contribution no longer appears in approved summary results.
12. Reviewer endpoints require `platform_roles.public_archive_reviewer`.

### Integration Tests

1. End-to-end contribution flow from story detail to committed public contribution.
2. Wiki processing flow from two active contributions to pending draft.
3. Reviewer approval flow to contributor-visible event summary.
4. Withdrawal flow from active contribution to reprocessed event cluster.
5. Regression tests proving Phase 1 Interview and Editor Agent flows still pass.

### Database Tests Or Migration Checks

1. RLS is enabled on all new public archive tables.
2. Direct `anon` and broad `authenticated` access is revoked.
3. Agent type constraints allow `wiki_editor`.
4. Artifact type constraints allow Phase 2 artifact types.
5. Invitation policies prevent facilitator-created invitations from creating consent.
6. Private source identifiers do not appear in contributor-facing query payloads.

## Rollout Plan

Phase 2 should be implemented behind a feature flag such as `NEXT_PUBLIC_PUBLIC_ARCHIVE_ENABLED` or a server-side equivalent.

Recommended rollout:

1. Add schema, types, and RLS.
2. Add anonymized preview generation with tests.
3. Add facilitator invitation flow.
4. Add commit and withdrawal flows.
5. Add contributor-facing contribution status panel.
6. Add Wiki Editor Agent processing for candidates and drafts.
7. Add `platform_roles` reviewer authorization.
8. Add reviewer queue and approval actions.
9. Add contributor-facing approved event summary panel.
10. Run full regression on Phase 1 agent flows.

## Open Decisions Resolved In Brainstorming

1. Phase 2 depth: consent, anonymization, Wiki Editor drafts, but no complete public event pages.
2. Wiki draft visibility: contributor-visible only after review.
3. Consent scope: anonymized story text plus structured elements.
4. Review model: anonymized contribution visible immediately; Wiki draft requires reviewer approval.
5. Entry points: story detail action and Resonance CTA.
6. Withdrawal: remove from visible results and future Wiki inputs, keep minimum audit.
7. Event creation: single contribution creates candidate; multiple matching contributions create draft.
8. Review authority: platform-level public archive reviewer.
9. Opt-in authority: storyteller or story creator; facilitator can invite only.
10. Contributor view: aggregate summary plus limited anonymized excerpts.
11. Reviewer role model: `platform_roles`.
12. Anonymization strictness: balanced.
13. Preview editing: submit or cancel only, no editing in Phase 2.

## Acceptance Criteria

1. A storyteller can preview and commit a public archive contribution for their own story.
2. A facilitator cannot commit public archive consent for a storyteller.
3. A facilitator can invite the storyteller to contribute without creating consent or contribution rows.
4. No public contribution exists before explicit opt-in.
5. Public contribution data contains anonymized text and structured elements only.
6. The contributor can view their committed anonymized contribution immediately.
7. Wiki Editor Agent processes only active public contribution rows.
8. A single active contribution creates a candidate event.
9. Two or more matching active contributions create or update a draft event.
10. Draft events are hidden from contributors until approved by a public archive reviewer.
11. Approved event summaries show aggregate context and limited anonymized excerpts.
12. Withdrawal removes the contribution from visible summaries and future Wiki inputs.
13. Minimum audit records remain after withdrawal.
14. RLS and server authorization prevent unauthorized contribution, draft, and source identifier access.
15. Phase 1 private Interview Agent and Editor Agent behavior remains unchanged.
