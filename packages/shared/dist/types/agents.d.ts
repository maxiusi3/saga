export declare const AGENT_TYPES: readonly ["interview", "editor_librarian", "wiki_editor"];
export type AgentType = (typeof AGENT_TYPES)[number];
export declare const AGENT_RUN_STATUSES: readonly ["pending", "running", "completed", "failed"];
export type AgentRunStatus = (typeof AGENT_RUN_STATUSES)[number];
export declare const AGENT_REVIEW_STATUSES: readonly ["unreviewed", "approved", "rejected", "edited"];
export type AgentReviewStatus = (typeof AGENT_REVIEW_STATUSES)[number];
export declare const INTERVENTION_LEVELS: readonly ["off", "low", "high"];
export type InterventionLevel = (typeof INTERVENTION_LEVELS)[number];
export declare const INTERVIEW_EVENT_KINDS: readonly ["opening", "warmup", "prior_story_recap", "gentle_probe", "transition", "emotional_support", "closing"];
export type InterviewEventKind = (typeof INTERVIEW_EVENT_KINDS)[number];
export declare const STORY_ELEMENT_TYPES: readonly ["time", "place", "person", "event", "theme", "emotion", "decision", "consequence", "reflection"];
export type StoryElementType = (typeof STORY_ELEMENT_TYPES)[number];
export interface AgentRun {
    id: string;
    agent_type: AgentType;
    status: AgentRunStatus;
    project_id: string | null;
    story_id: string | null;
    interview_session_id: string | null;
    content_hash: string | null;
    input: Record<string, unknown>;
    output: Record<string, unknown> | null;
    model: string | null;
    error: string | null;
    started_at: string;
    completed_at: string | null;
    created_by: string;
}
export interface AgentArtifact {
    id: string;
    agent_run_id: string;
    project_id: string;
    story_id: string | null;
    artifact_type: 'host_intervention' | 'standalone_story' | 'story_summary' | 'follow_up_questions' | 'story_elements' | 'anonymized_contribution_preview' | 'wiki_event_candidate' | 'wiki_event_draft';
    payload: Record<string, unknown>;
    source_refs: AgentSourceRef[];
    review_status: AgentReviewStatus;
    confidence: number;
    created_at: string;
    updated_at: string;
}
export interface AgentSourceRef {
    source_type: 'transcript' | 'story' | 'interview_event' | 'media';
    source_id: string;
    start_offset?: number;
    end_offset?: number;
    quote?: string;
}
export interface InterviewSession {
    id: string;
    project_id: string;
    storyteller_id: string;
    prompt_text: string | null;
    recording_mode: 'deep_dive' | 'chat';
    intervention_level: InterventionLevel;
    status: 'active' | 'completed' | 'abandoned';
    started_at: string;
    completed_at: string | null;
}
export interface InterviewEvent {
    id: string;
    interview_session_id: string;
    project_id: string;
    storyteller_id: string;
    event_kind: InterviewEventKind;
    intervention_level: InterventionLevel;
    trigger_reason: string;
    prompt_text: string;
    transcript_window: string | null;
    transcript_start_offset: number | null;
    transcript_end_offset: number | null;
    accepted: boolean | null;
    created_at: string;
}
export interface StoryElement {
    id: string;
    project_id: string;
    story_id: string;
    agent_run_id: string;
    element_type: StoryElementType;
    value: string;
    normalized_value: string | null;
    source_quote: string;
    source_start_offset: number | null;
    source_end_offset: number | null;
    confidence: number;
    review_status: AgentReviewStatus;
    created_at: string;
    updated_at: string;
}
//# sourceMappingURL=agents.d.ts.map