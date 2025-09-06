export type SagaNotificationType = 'new_story' | 'new_comment' | 'new_follow_up_question' | 'story_response' | 'project_invitation' | 'member_joined';
export interface SagaNotification {
    id: string;
    recipient_id: string;
    sender_id?: string;
    project_id: string;
    story_id?: string;
    comment_id?: string;
    notification_type: SagaNotificationType;
    title: string;
    message: string;
    preview_text?: string;
    action_url?: string;
    is_read: boolean;
    read_at?: string;
    created_at: string;
    updated_at: string;
    sender_name?: string;
    sender_avatar?: string;
    project_title?: string;
    story_title?: string;
}
export interface SagaNotificationSettings {
    id: string;
    user_id: string;
    project_id?: string;
    notification_type: SagaNotificationType;
    enabled: boolean;
    email_enabled: boolean;
    created_at: string;
    updated_at: string;
}
export interface SagaNotificationGroup {
    type: SagaNotificationType;
    count: number;
    latest_notification: SagaNotification;
    notifications: SagaNotification[];
}
export interface SagaNotificationSummary {
    total_unread: number;
    groups: SagaNotificationGroup[];
    recent_notifications: SagaNotification[];
}
/**
 * Get notification display information
 */
export declare function getNotificationDisplayInfo(type: SagaNotificationType): {
    icon: string;
    color: string;
    bgColor: string;
    label: string;
};
/**
 * Format notification time
 */
export declare function formatNotificationTime(timestamp: string): string;
/**
 * Group notifications by type and recency
 */
export declare function groupNotifications(notifications: SagaNotification[]): SagaNotificationGroup[];
/**
 * Create notification summary
 */
export declare function createNotificationSummary(notifications: SagaNotification[]): SagaNotificationSummary;
/**
 * Generate notification message based on type and context
 */
export declare function generateNotificationMessage(type: SagaNotificationType, context: {
    senderName?: string;
    storyTitle?: string;
    projectTitle?: string;
    commentPreview?: string;
}): {
    title: string;
    message: string;
};
/**
 * Check if user should receive notification based on their role and settings
 */
export declare function shouldReceiveNotification(notificationType: SagaNotificationType, userRole: string, isProjectOwner: boolean, isStoryteller: boolean, settings?: SagaNotificationSettings[]): boolean;
//# sourceMappingURL=notifications.d.ts.map