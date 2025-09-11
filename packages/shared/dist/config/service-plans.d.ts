/**
 * Service plan configurations for Saga Family Biography projects
 * These settings control service duration and can be used for pricing tiers
 */
export interface ServicePlan {
    id: string;
    name: string;
    description: string;
    durationDays: number;
    price?: number;
    currency?: string;
    features: {
        maxProjects: number;
        maxFacilitatorSeats: number;
        maxStorytellerSeats: number;
        aiFeatures: boolean;
        dataExport: boolean;
        prioritySupport: boolean;
    };
    isDefault?: boolean;
}
export declare const SERVICE_PLANS: ServicePlan[];
/**
 * Get default service plan
 */
export declare function getDefaultServicePlan(): ServicePlan;
/**
 * Get service plan by ID
 */
export declare function getServicePlanById(planId: string): ServicePlan | null;
/**
 * Calculate service end date based on plan and start date
 */
export declare function calculateServiceEndDate(startDate: Date, planId: string): Date;
/**
 * Check if service is expired
 */
export declare function isServiceExpired(endDate: Date): boolean;
/**
 * Get days remaining in service
 */
export declare function getDaysRemaining(endDate: Date): number;
/**
 * Get service progress percentage
 */
export declare function getServiceProgress(startDate: Date, endDate: Date): number;
/**
 * Format service status for display
 */
export declare function formatServiceStatus(endDate: Date): {
    status: 'active' | 'expiring_soon' | 'expired';
    message: string;
    daysRemaining: number;
};
//# sourceMappingURL=service-plans.d.ts.map