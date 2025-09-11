"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateUserPermissions = calculateUserPermissions;
exports.canUserPerformAction = canUserPerformAction;
exports.getRoleDisplayInfo = getRoleDisplayInfo;
exports.canChangeRole = canChangeRole;
/**
 * Calculate user permissions based on their role in a project
 */
function calculateUserPermissions(userRole, isProjectOwner = false) {
    // Project owner (facilitator) has all permissions
    if (isProjectOwner) {
        return {
            canEditProjectSettings: true,
            canInviteMembers: true,
            canRemoveMembers: true,
            canDeleteProject: true,
            canCreateStories: false, // Project owners typically don't record stories
            canEditStoryTitles: true,
            canEditStoryTranscripts: true,
            canDeleteStories: true,
            canViewAllStories: true,
            canAddComments: true,
            canAskFollowUpQuestions: true,
            canViewComments: true,
            canEditAIContent: true,
            canViewAIContent: true,
        };
    }
    switch (userRole) {
        case 'facilitator':
            return {
                canEditProjectSettings: true,
                canInviteMembers: true,
                canRemoveMembers: true,
                canDeleteProject: false, // Only project owner can delete
                canCreateStories: false,
                canEditStoryTitles: true,
                canEditStoryTranscripts: true,
                canDeleteStories: true,
                canViewAllStories: true,
                canAddComments: true,
                canAskFollowUpQuestions: true,
                canViewComments: true,
                canEditAIContent: true,
                canViewAIContent: true,
            };
        case 'storyteller':
            return {
                canEditProjectSettings: false,
                canInviteMembers: false,
                canRemoveMembers: false,
                canDeleteProject: false,
                canCreateStories: true, // Primary function - can record stories
                canEditStoryTitles: false, // Cannot edit their own story titles
                canEditStoryTranscripts: false, // Cannot edit transcripts
                canDeleteStories: false,
                canViewAllStories: true, // Can view all stories in the project
                canAddComments: true, // Can respond to comments on their stories
                canAskFollowUpQuestions: false, // Cannot ask follow-up questions
                canViewComments: true,
                canEditAIContent: false,
                canViewAIContent: true, // Can view AI-generated content for their stories
            };
        default:
            // No permissions for unknown roles
            return {
                canEditProjectSettings: false,
                canInviteMembers: false,
                canRemoveMembers: false,
                canDeleteProject: false,
                canCreateStories: false,
                canEditStoryTitles: false,
                canEditStoryTranscripts: false,
                canDeleteStories: false,
                canViewAllStories: false,
                canAddComments: false,
                canAskFollowUpQuestions: false,
                canViewComments: false,
                canEditAIContent: false,
                canViewAIContent: false,
            };
    }
}
/**
 * Check if a user can perform a specific action
 */
function canUserPerformAction(action, userRole, isProjectOwner = false) {
    const permissions = calculateUserPermissions(userRole, isProjectOwner);
    return permissions[action];
}
/**
 * Get role display information
 */
function getRoleDisplayInfo(role) {
    switch (role) {
        case 'facilitator':
            return {
                label: 'Facilitator',
                description: 'Can manage project settings and edit all content',
                color: 'bg-primary text-primary-foreground',
                icon: '👑'
            };
        case 'storyteller':
            return {
                label: 'Storyteller',
                description: 'Can record stories and respond to comments',
                color: 'bg-accent text-accent-foreground',
                icon: '🎙️'
            };
        default:
            return {
                label: 'Unknown',
                description: 'Unknown role',
                color: 'bg-muted text-muted-foreground',
                icon: '❓'
            };
    }
}
/**
 * Validate role transitions (for role changes)
 */
function canChangeRole(fromRole, toRole, changerRole, isChangerProjectOwner) {
    // Only facilitators and project owners can change roles
    if (changerRole !== 'facilitator' && !isChangerProjectOwner) {
        return false;
    }
    // Cannot change project owner role (would need to transfer ownership)
    if (fromRole === 'facilitator' && isChangerProjectOwner) {
        return false;
    }
    // All other role changes are allowed for facilitators
    return true;
}
//# sourceMappingURL=permissions.js.map