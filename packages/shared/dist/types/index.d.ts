export * from './user';
export * from './project';
export * from './story';
export * from './interaction';
export * from './subscription';
export * from './resource-wallet';
export * from './project-role';
export * from './chapter';
export * from './prompt';
export * from './payment';
export * from './notification';
export * from './invitation';
export * from './recording';
export * from './export';
export * from './api';
export * from './story-discovery';
export * from './story-sharing';
export interface ApiResponse<T> {
    success: boolean;
    data?: T;
    error?: string;
    message?: string;
}
export interface PaginatedResponse<T> {
    data: T[];
    total: number;
    page: number;
    limit: number;
    has_more: boolean;
}
export interface ErrorResponse {
    success: false;
    error: string;
    message: string;
    code?: string;
}
export type SortOrder = 'asc' | 'desc';
export interface SortOptions {
    field: string;
    order: SortOrder;
}
export interface PaginationOptions {
    page: number;
    limit: number;
    sort?: SortOptions;
}
export interface DateRange {
    start: Date;
    end: Date;
}
export interface ProjectCreationResponse {
    project: {
        id: string;
        name: string;
        facilitator_id: string;
        status: 'pending' | 'active' | 'archived';
        created_at: Date;
    };
    resource_usage: {
        resource_type: 'project_voucher' | 'facilitator_seat' | 'storyteller_seat';
        amount: number;
        project_id: string;
    }[];
    invitation_sent: boolean;
}
export interface PromptDeliveryResponse {
    prompt: {
        id: string;
        text: string;
        audio_url?: string;
        chapter_id?: string;
    };
    chapter: {
        id: string;
        name: string;
        order_index: number;
    };
    progress: {
        chapter_progress: number;
        overall_progress: number;
        remaining_prompts: number;
    };
    audio_url?: string;
}
export interface ResourcePurchaseResponse {
    transaction: {
        id: string;
        user_id: string;
        transaction_type: 'purchase' | 'consume' | 'refund';
        resource_type: 'project_voucher' | 'facilitator_seat' | 'storyteller_seat';
        amount: number;
        created_at: Date;
    };
    new_balance: {
        project_vouchers: number;
        facilitator_seats: number;
        storyteller_seats: number;
    };
    receipt_url?: string;
}
//# sourceMappingURL=index.d.ts.map