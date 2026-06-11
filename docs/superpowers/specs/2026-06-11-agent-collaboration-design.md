# UR Saga Multi-Agent Collaboration Design

## Status

Approved in conversation. Ready for user review as a written spec.

## Context

UR Saga is a family biography platform for recording, preserving, and sharing life stories. The current product already has AI-assisted transcription, title generation, summaries, follow-up questions, real-time silence prompts, and a mock resonance notification. These capabilities are useful, but they are implemented as separate features rather than as a coordinated agent system.

The user wants to embed multiple AI agents that collaborate across the story lifecycle:

1. An interview host agent that helps the storyteller begin, continue, and finish a story.
2. An editor and librarian agent that turns each recording into both a standalone story and structured biography material.
3. A wiki editor agent that receives anonymized opt-in stories and organizes public event knowledge across users.
4. A media agent that provides image repair, photo enhancement, and video generation services.

The design must preserve the storyteller's train of thought. The interview host must be helpful without becoming intrusive.

## Problem Statement

The current AI implementation has three structural gaps:

1. AI outputs are not durable agent artifacts. Most outputs are returned directly to UI or stored in a few `ai_*` story fields.
2. The interview flow is prompt-based rather than host-based. It can ask a follow-up after silence, but it does not manage opening, warmup, recap, transitions, or emotional safety as a coherent conversation.
3. Public sharing is represented mostly by `is_public`, which is not enough for anonymized collective memory, consent scope, cross-user event clustering, or source traceability.

## Goals

1. Define a multi-agent architecture that can be added incrementally to the existing Next.js and Supabase codebase.
2. Make the Interview Agent responsible for opening, warmup, prior-story recap, gentle interventions, transitions, emotional support, and closing.
3. Give users three intervention levels for the Interview Agent: off, low, and high.
4. Preserve each story as a standalone narrative while also extracting reusable elements for biography assembly.
5. Separate private family biography work from public collective archive work.
6. Add explicit consent, anonymization, provenance, and review states before any story contributes to the public archive.
7. Treat media enhancement as an asynchronous value-added workflow with clear job status and user approval.

## Non-Goals

1. Replace human facilitators. Human family members still create projects, invite storytellers, review output, and ask personal follow-up questions.
2. Build a fully autonomous public encyclopedia in the first phase.
3. Let AI perform clinical mental health care. The Interview Agent may provide supportive language and pause suggestions, but it must not diagnose or treat.
4. Share voice, images, names, or exact locations publicly without explicit consent for each data type.

## Recommended Approach

Build an agent artifact layer and an asynchronous task layer before implementing advanced agent behavior.

The artifact layer records what each agent produced, why it produced it, which source transcript span or media asset it used, and whether the result has been reviewed. The task layer lets long-running work continue after story submission, retry safely, and show progress in the UI.

Phase 1 should focus on the private biography loop:

1. Interview Agent.
2. Editor and Librarian Agent.
3. Agent run logging.
4. Story element extraction.
5. Human review surfaces for story and element edits.

Phase 2 should add the public archive:

1. Explicit sharing consent by data type.
2. Anonymization pipeline.
3. Wiki Editor Agent.
4. Event cluster and perspective summaries.

Phase 3 should add paid media services:

1. Media job queue.
2. Photo restoration and enhancement.
3. Photo-to-video and story-to-video generation.
4. User preview and approval before final export.

## Agent Roles

### Interview Agent

The Interview Agent is a host-style conversation partner. It should feel like an experienced talk show host who knows when to speak and when to stay quiet.

Responsibilities:

1. Opening: greet the storyteller, introduce itself, explain that the storyteller can speak slowly, and set expectations for gentle help.
2. Warmup: use brief small talk or low-pressure questions to reduce nervousness before the main recording.
3. Prior-story recap: if the project has previous stories, summarize the last relevant story in one or two sentences and offer a natural bridge into the current topic.
4. Story listening: stay silent while the storyteller is flowing.
5. Gentle probing: ask short, concrete questions when there is a long pause, unclear reference, missing context, or a useful emotional detail to explore.
6. Transition hosting: summarize the previous beat and bridge to the next beat without forcing a new topic.
7. Emotional support: acknowledge sadness, guilt, grief, or anxiety, offer permission to pause, and avoid clinical claims.
8. Closing: summarize what was covered, thank the storyteller, and suggest optional follow-up items such as names, places, dates, or photos.

Intervention levels:

1. Off: no AI-generated opening, recap, live prompt, transition, or closing. The user sees only the selected recording prompt and manual controls.
2. Low: the agent gives a short opening and closing, may recap prior stories, and intervenes only after long silence, clear confusion, or emotional distress.
3. High: the agent behaves like an active host with opening, warmup, recap, occasional transitions, and more proactive detail prompts while still avoiding interruption during fluent speech.

The selected intervention level should be configurable at project level by the facilitator and adjustable by the storyteller before recording.

Recommended state machine:

```text
opening -> warmup -> prior_story_recap -> story_listening -> gentle_probe -> transition -> emotional_support -> closing
```

The state machine is not strictly linear. For example, `story_listening` may enter `emotional_support` and then return to `story_listening`, or `gentle_probe` may return directly to `story_listening`.

Every intervention should be recorded as an `interview_event` with:

1. Agent state.
2. Intervention level.
3. Trigger reason.
4. Prompt text shown or spoken.
5. Related transcript window.
6. User action, if known.

This is required so later agents can distinguish storyteller content from AI hosting.

### Editor And Librarian Agent

The Editor and Librarian Agent runs after a new story is saved. It should act like a rigorous publishing editor and an archivist.

Responsibilities:

1. Produce a polished standalone story without erasing the original transcript.
2. Preserve source spans so every edited paragraph can be traced back to transcript text.
3. Extract biography elements such as time, place, people, events, relationships, themes, emotions, decisions, consequences, and reflections.
4. Attach confidence scores and review states to extracted elements.
5. Update project-level timeline and chapter candidates.
6. Suggest follow-up questions for missing context, but route them through existing facilitator or prompt workflows.

The key product rule is that standalone stories are not discarded when biography structure improves. The stories are the flesh. The extracted elements are the index and skeleton.

### Wiki Editor Agent

The Wiki Editor Agent only works on explicit opt-in public contributions. It must never process private stories for public clustering unless a user has shared the specific story and accepted the relevant consent scope.

Responsibilities:

1. Receive anonymized story text and structured elements.
2. Remove or generalize personally identifying details according to the consent scope.
3. Cluster public contributions around shared events, eras, places, and historical experiences.
4. Preserve multiple micro-perspectives on the same event instead of flattening them into one official narrative.
5. Produce event summaries with provenance, uncertainty, and perspective diversity.
6. Keep private project identifiers separate from public archive identifiers.

### Media Agent

The Media Agent provides value-added media services. It should operate through explicit jobs rather than synchronous UI calls.

Responsibilities:

1. Repair blurry, damaged, faded, or low-resolution old photos.
2. Generate preview assets before replacing or adding final media.
3. Create short videos from photos and story excerpts when the user requests it.
4. Link generated media back to source photos, source stories, and user approvals.
5. Track cost, provider, status, and failure reason for each job.

## Data Model Additions

The implementation should add focused tables rather than overloading `stories.metadata`.

Recommended tables:

1. `agent_runs`: one row per agent execution with agent type, input references, status, model, token or cost metadata, started time, completed time, and error details.
2. `agent_artifacts`: outputs from agent runs, including artifact type, JSON payload, source references, review status, and confidence.
3. `interview_sessions`: one row per recording session with project, storyteller, selected intervention level, prompt, mode, and status.
4. `interview_events`: durable record of host openings, prompts, transitions, emotional support moments, and closings.
5. `story_elements`: extracted private biography elements with type, value, date precision, source span, confidence, and review state.
6. `public_contributions`: opt-in anonymized story payloads with consent scope and review state.
7. `event_clusters`: public archive event clusters with canonical event labels, timeframe, place, and confidence.
8. `media_jobs`: asynchronous media enhancement and video generation jobs with source assets, generated assets, provider metadata, and user approval state.

## Data Flow

Recording flow:

1. The user selects a recording mode and an Interview Agent intervention level.
2. The Interview Agent creates an `interview_session`.
3. The agent performs opening, warmup, optional recap, listening, prompts, transitions, emotional support, and closing according to the selected level.
4. Each intervention is stored as an `interview_event`.
5. The raw recording and transcript are saved as a story.
6. The Editor and Librarian Agent creates structured story artifacts and story elements.

Private biography flow:

1. The facilitator or storyteller reviews the standalone story.
2. Extracted elements appear in a reviewable biography structure.
3. Timeline, chapters, and biography scaffold update progressively as stories accumulate.
4. The final biography is assembled from reviewed stories and reviewed elements.

Public archive flow:

1. The user opts in to share a specific story.
2. The user selects consent scope for text, structured elements, voice, photos, and derived media.
3. The Wiki Editor Agent anonymizes the shared material.
4. The public contribution is reviewed and then matched into event clusters.
5. Public event pages show multiple perspectives with uncertainty and provenance.

Media flow:

1. The user uploads or selects a photo or story.
2. The Media Agent creates a job with a specific requested service.
3. The job produces a preview.
4. The user approves, rejects, or requests a regenerated result.
5. Approved media is attached to the relevant story or export.

## Privacy And Safety Rules

1. Private stories remain private unless a specific story has explicit opt-in.
2. Consent must be granular by data type: text, structured elements, voice, photos, and generated derivatives.
3. Public archive processing must use anonymized payloads and public identifiers.
4. Interview Agent emotional support must avoid diagnosis, therapy claims, or pressure to continue.
5. If a user expresses immediate self-harm intent, the product must stop normal interviewing, encourage contacting local emergency services or a trusted person, and surface a human-help path.
6. AI-generated edits and extracted elements must remain reviewable and reversible.

## Testing Strategy

1. Unit test intervention-level gating for off, low, and high.
2. Unit test Interview Agent state transitions.
3. Integration test that storyteller transcript text and agent intervention text are stored separately.
4. Integration test that story save triggers Editor and Librarian Agent jobs.
5. Privacy test that public archive jobs cannot run without explicit consent.
6. Privacy test that voice and photo sharing require separate consent from text sharing.
7. Media job test for preview, approval, failure, and retry states.
8. Regression test existing AI authentication and rate limits.

## Migration Strategy

1. Fix the current schema drift before adding agent tables.
2. Add tables with nullable foreign keys and no destructive story migration.
3. Store new agent artifacts alongside existing `ai_*` fields during transition.
4. Backfill story elements only for reviewed or recently created stories first.
5. Switch UI reads from `ai_*` fields to agent artifacts after parity is verified.

## MVP Decisions

1. The Interview Agent is text-only for the first implementation. TTS can be added later without changing the agent artifact model.
2. Project facilitators can set the default intervention level and a maximum allowed intervention level. Storytellers can lower the level before recording, but cannot raise it above the project maximum.
3. Public archive contributions require human review before event clustering.
4. Media provider selection is outside the first implementation. The first implementation should create provider-agnostic `media_jobs` records and adapter boundaries.

## Recommendation

Implement the private biography loop first. The minimum valuable release is:

1. Interview Agent with off, low, and high intervention levels.
2. Persistent interview sessions and interview events.
3. Editor and Librarian Agent for standalone story editing and structured element extraction.
4. Reviewable story elements feeding a private biography timeline.

This gives the product a durable agent architecture while improving the core storyteller experience immediately. The Wiki Editor Agent and Media Agent should follow after consent, anonymization, and job infrastructure are proven.
