export interface ProjectRole {
    id: string;
    project_id: string;
    user_id: string;
    role: 'facilitator' | 'storyteller';
    created_at: Date;
}
export interface ProjectRoleAssignment {
    project_id: string;
    user_id: string;
    role: 'facilitator' | 'storyteller';
}
export interface ProjectCollaborator {
    id: string;
    name: string;
    email: string;
    role: 'facilitator' | 'storyteller';
    joined_at: Date;
}
export interface ProjectRoleInvitation {
    project_id: string;
    email: string;
    role: 'facilitator' | 'storyteller';
    message?: string;
}
//# sourceMappingURL=project-role.d.ts.map