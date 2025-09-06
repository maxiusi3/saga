export interface Notification {
    id: string;
    userId: string;
    type: NotificationType;
    title: string;
    body: string;
    data?: Record<string, any>;
    status: NotificationStatus;
    deliveryMethod: NotificationDeliveryMethod[];
    scheduledAt?: Date;
    sentAt?: Date;
    readAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}
export type NotificationType = 'story_uploaded' | 'story_processed' | 'interaction_added' | 'follow_up_question' | 'export_ready' | 'invitation_received' | 'subscription_expiring' | 'subscription_expired' | 'project_archived' | 'subscription_renewed';
export type NotificationStatus = 'pending' | 'sent' | 'delivered' | 'failed' | 'read';
export type NotificationDeliveryMethod = 'push' | 'email' | 'websocket';
export interface NotificationPreferences {
    id: string;
    userId: string;
    storyUploaded: NotificationDeliveryMethod[];
    storyProcessed: NotificationDeliveryMethod[];
    interactionAdded: NotificationDeliveryMethod[];
    followUpQuestion: NotificationDeliveryMethod[];
    exportReady: NotificationDeliveryMethod[];
    invitationReceived: NotificationDeliveryMethod[];
    subscriptionExpiring: NotificationDeliveryMethod[];
    subscriptionExpired: NotificationDeliveryMethod[];
    projectArchived: NotificationDeliveryMethod[];
    subscriptionRenewed: NotificationDeliveryMethod[];
    emailEnabled: boolean;
    pushEnabled: boolean;
    quietHoursStart?: string;
    quietHoursEnd?: string;
    timezone: string;
    createdAt: Date;
    updatedAt: Date;
}
export interface DeviceToken {
    id: string;
    userId: string;
    token: string;
    platform: 'ios' | 'android' | 'web';
    deviceId?: string;
    isActive: boolean;
    lastUsedAt: Date;
    createdAt: Date;
    updatedAt: Date;
}
export interface CreateNotificationInput {
    userId: string;
    type: NotificationType;
    title: string;
    body: string;
    data?: Record<string, any>;
    deliveryMethod?: NotificationDeliveryMethod[];
    scheduledAt?: Date;
}
export interface UpdateNotificationInput {
    status?: NotificationStatus;
    sentAt?: Date;
    readAt?: Date;
}
export interface CreateNotificationPreferencesInput {
    userId: string;
    storyUploaded?: NotificationDeliveryMethod[];
    storyProcessed?: NotificationDeliveryMethod[];
    interactionAdded?: NotificationDeliveryMethod[];
    followUpQuestion?: NotificationDeliveryMethod[];
    exportReady?: NotificationDeliveryMethod[];
    invitationReceived?: NotificationDeliveryMethod[];
    subscriptionExpiring?: NotificationDeliveryMethod[];
    subscriptionExpired?: NotificationDeliveryMethod[];
    projectArchived?: NotificationDeliveryMethod[];
    subscriptionRenewed?: NotificationDeliveryMethod[];
    emailEnabled?: boolean;
    pushEnabled?: boolean;
    quietHoursStart?: string;
    quietHoursEnd?: string;
    timezone?: string;
}
export interface UpdateNotificationPreferencesInput {
    storyUploaded?: NotificationDeliveryMethod[];
    storyProcessed?: NotificationDeliveryMethod[];
    interactionAdded?: NotificationDeliveryMethod[];
    followUpQuestion?: NotificationDeliveryMethod[];
    exportReady?: NotificationDeliveryMethod[];
    invitationReceived?: NotificationDeliveryMethod[];
    subscriptionExpiring?: NotificationDeliveryMethod[];
    subscriptionExpired?: NotificationDeliveryMethod[];
    projectArchived?: NotificationDeliveryMethod[];
    subscriptionRenewed?: NotificationDeliveryMethod[];
    emailEnabled?: boolean;
    pushEnabled?: boolean;
    quietHoursStart?: string;
    quietHoursEnd?: string;
    timezone?: string;
}
export interface CreateDeviceTokenInput {
    userId: string;
    token: string;
    platform: 'ios' | 'android' | 'web';
    deviceId?: string;
}
export interface NotificationTemplate {
    type: NotificationType;
    title: string;
    body: string;
    emailSubject?: string;
    emailTemplate?: string;
}
export interface NotificationDeliveryResult {
    method: NotificationDeliveryMethod;
    success: boolean;
    error?: string;
    messageId?: string;
}
export interface BulkNotificationInput {
    userIds: string[];
    type: NotificationType;
    title: string;
    body: string;
    data?: Record<string, any>;
    deliveryMethod?: NotificationDeliveryMethod[];
}
//# sourceMappingURL=notification.d.ts.map