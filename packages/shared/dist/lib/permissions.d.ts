export type UserRole = 'facilitator' | 'storyteller';
export type MemberStatus = 'pending' | 'active' | 'declined' | 'removed';
export interface ProjectMember {
    id: string;
    project_id: string;
    user_id: string;
    role: UserRole;
    status: MemberStatus;
    invited_by?: string;
    invited_at: string;
    joined_at?: string;
    created_at: string;
    updated_at: string;
}
export interface UserPermissions {
    canEditProjectSettings: boolean;
    canInviteMembers: boolean;
    canRemoveMembers: boolean;
    canDeleteProject: boolean;
    canCreateStories: boolean;
    canEditStoryTitles: boolean;
    canEditStoryTranscripts: boolean;
    canDeleteStories: boolean;
    canViewAllStories: boolean;
    canAddComments: boolean;
    canAskFollowUpQuestions: boolean;
    canViewComments: boolean;
    canEditAIContent: boolean;
    canViewAIContent: boolean;
}
/**
 * Calculate user permissions based on their role in a project
 */
export declare function calculateUserPermissions(userRole: UserRole, isProjectOwner?: boolean): UserPermissions;
/**
 * Check if a user can perform a specific action
 */
export declare function canUserPerformAction(action: keyof UserPermissions, userRole: UserRole, isProjectOwner?: boolean): boolean;
/**
 * Get role display information
 */
export declare function getRoleDisplayInfo(role: UserRole): {
    label: string;
    description: string;
    color: string;
    icon: string;
};
/**
 * Validate role transitions (for role changes)
 */
export declare function canChangeRole(fromRole: UserRole, toRole: UserRole, changerRole: UserRole, isChangerProjectOwner: boolean): boolean;
//# sourceMappingURL=permissions.d.ts.map