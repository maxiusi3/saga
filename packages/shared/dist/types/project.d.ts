export interface Project {
    id: string;
    name: string;
    facilitator_id: string;
    storyteller_id?: string;
    status: 'pending' | 'active' | 'archived';
    created_at: Date;
    updated_at: Date;
}
export interface ProjectInvitation {
    id: string;
    project_id: string;
    token: string;
    expires_at: Date;
    used_at?: Date;
    status: 'pending' | 'accepted' | 'expired';
    role: 'facilitator' | 'storyteller';
    created_at: Date;
    updated_at: Date;
}
export interface CreateProjectRequest {
    name: string;
    storyteller_email?: string;
}
export interface ProjectStats {
    total_stories: number;
    total_duration: number;
    completion_percentage: number;
    last_activity: Date;
    chapters_completed: number;
    total_chapters: number;
}
export interface ProjectWithRoles {
    project: Project;
    roles: {
        id: string;
        project_id: string;
        user_id: string;
        role: 'facilitator' | 'storyteller';
        created_at: Date;
    }[];
    collaborators: {
        id: string;
        name: string;
        email: string;
        role: 'facilitator' | 'storyteller';
        joined_at: Date;
    }[];
    subscription?: {
        id: string;
        status: 'active' | 'canceled' | 'past_due';
        current_period_end: Date;
    };
}
export interface ProjectDashboard {
    project: Project;
    stats: ProjectStats;
    recent_stories: {
        id: string;
        title?: string;
        created_at: Date;
        facilitator_id: string;
        storyteller_id: string;
    }[];
    prompt_progress: {
        current_chapter: {
            id: string;
            name: string;
            order_index: number;
        };
        chapter_progress: number;
        overall_progress: number;
        remaining_prompts: number;
    };
    collaborators: {
        id: string;
        name: string;
        email: string;
        role: 'facilitator' | 'storyteller';
        joined_at: Date;
    }[];
}
export interface ArchivalPermissions {
    canView: boolean;
    canExport: boolean;
    canRenew: boolean;
    isArchived: boolean;
    archiveDate?: Date;
}
export type ProjectStatus = 'pending' | 'active' | 'archived';
//# sourceMappingURL=project.d.ts.map