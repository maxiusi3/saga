import { BaseService } from './base-service';
import { UserTestingFeedback, BetaTester } from './user-acceptance-testing-service';
import { AnalyticsService } from './analytics-service';
import { EmailNotificationService } from './email-notification-service';

export interface OnboardingTestSession {
  id: string;
  testerId: string;
  userType: 'facilitator' | 'storyteller';
  platform: 'web' | 'mobile';
  startTime: Date;
  endTime?: Date;
  status: 'in_progress' | 'completed' | 'abandoned';
  currentStep: number;
  totalSteps: number;
  completedSteps: OnboardingStep[];
  abandonmentPoint?: string;
  abandonmentReason?: string;
  overallExperience: number; // 1-5 rating
  recommendations: string[];
}

export interface OnboardingStep {
  stepId: string;
  stepName: string;
  description: string;
  startTime: Date;
  endTime?: Date;
  completed: boolean;
  timeToComplete?: number; // in seconds
  attemptsRequired: number;
  difficultyRating: number; // 1-5 scale
  confusionPoints: string[];
  helpSought: boolean;
  userFeedback?: string;
  issues: OnboardingIssue[];
}

export interface OnboardingIssue {
  type: 'conf