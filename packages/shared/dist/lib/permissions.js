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
    // Calculate permissions based on user's actual role, project owners get additional management permissions
    let basePermissions;
    switch (userRole) {
        case 'facilitator':
            basePermissions = {
                canEditProjectSettings: true,
                canInviteMembers: true,
                canRemoveMembers: true,
                canDeleteProject: false, // Only project owner can delete
                canCreateStories: false,
                canEditStoryTitles: false, // Cannot edit story titles (only owner can)
                canEditStoryTranscripts: false, // Cannot edit transcripts (only owner can)
                canDeleteStories: true,
                canViewAllStories: true,
                canAddComments: true,
                canAskFollowUpQuestions: true,
                canViewComments: true,
                canEditAIContent: true,
                canViewAIContent: true,
            };
            break;
        case 'storyteller':
            basePermissions = {
                canEditProjectSettings: false,
                canInviteMembers: false,
                canRemoveMembers: false,
                canDeleteProject: false,
                canCreateStories: true, // Primary function - can record stories
                canEditStoryTitles: true, // Can edit their own story titles
                canEditStoryTranscripts: true, // Can edit transcripts
                canDeleteStories: false,
                canViewAllStories: true, // Can view all stories in the project
                canAddComments: true, // Can add comments
                canAskFollowUpQuestions: false, // Cannot ask follow-up questions
                canViewComments: true,
                canEditAIContent: false,
                canViewAIContent: true, // Can view AI-generated content for their stories
            };
            break;
        default:
            // No permissions for unknown roles
            basePermissions = {
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
            break;
    }
    // If user is project owner, add owner permissions (role permissions OR owner permissions)
    if (isProjectOwner) {
        // Owner permission matrix: A=N, B=N, C=N, D=Y, E=Y, F=N
        const ownerBasePermissions = {
            canCreateStories: false, // A=N
            canAddComments: false, // B=N
            canAskFollowUpQuestions: false, // C=N
            canEditStoryTitles: true, // D=Y
            canEditStoryTranscripts: true, // E=Y
            canViewComments: false, // F=N (This should be canRespondToFollowups, but we use canViewComments as substitute)
        };
        // Overlay logic: role permissions OR owner permissions
        const combinedPermissions = {
            ...basePermissions,
            // Management permissions: owners always have these permissions
            canEditProjectSettings: true,
            canInviteMembers: true,
            canRemoveMembers: true,
            canDeleteProject: true,
            canDeleteStories: true,
            canViewAllStories: true,
            canEditAIContent: true,
            canViewAIContent: true,
            canViewComments: true,
            // Overlay permissions: if any one is true, result is true
            canCreateStories: basePermissions.canCreateStories || ownerBasePermissions.canCreateStories,
            canAddComments: basePermissions.canAddComments || ownerBasePermissions.canAddComments,
            canAskFollowUpQuestions: basePermissions.canAskFollowUpQuestions || ownerBasePermissions.canAskFollowUpQuestions,
            canEditStoryTitles: basePermissions.canEditStoryTitles || ownerBasePermissions.canEditStoryTitles,
            canEditStoryTranscripts: basePermissions.canEditStoryTranscripts || ownerBasePermissions.canEditStoryTranscripts,
        };
        return combinedPermissions;
    }
    return basePermissions;
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