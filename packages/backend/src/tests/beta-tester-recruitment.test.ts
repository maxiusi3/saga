import { UserAcceptanceTestingService, BetaTester } from '../services/user-acceptance-testing-service';
import { EmailNotificationService } from '../services/email-notification-service';
import { AnalyticsService } from '../services/analytics-service';
import { User } from '../models/user';

describe('Beta Tester Recruitment', () => {
  let userAcceptanceService: UserAcceptanceTestingService;
  let emailService: EmailNotificationService;
  let analyticsService: AnalyticsService;

  beforeEach(() => {
    userAcceptanceService = new UserAcceptanceTestingService();
    emailService = new EmailNotificationService();
    analyticsService = new AnalyticsService();
  });

  describe('Target Demographics Recruitment', () => {
    it('should recruit diverse beta testers from target family demographics', async () => {
      const recruitmentCriteria = {
        targetCount: 50,
        familySizeRange: [2, 8] as [number, number],
        ageRanges: ['45-54', '55-64', '65-74', '75+'],
        techComfortLevels: ['low', 'medium', 'high'],
        deviceTypes: ['ios', 'android', 'both']
      };

      const recruitedTesters = await userAcceptanceService.recruitBetaTesters(recruitmentCriteria);
      
      // Validate recruitment targets
      expect(recruitedTesters.length).toBeLessThanOrEqual(recruitmentCriteria.targetCount);
      
      // Validate age distribution
      const ageDistribution = recruitedTesters.reduce((acc, tester) => {
        acc[tester.ageRange] = (acc[tester.ageRange] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      expect(Object.keys(ageDistribution).length).toBeGreaterThanOrEqual(3);
      expect(ageDistribution['55-64']).toBeGreaterThan(0); // Primary target demographic
      expect(ageDistribution['65-74']).toBeGreaterThan(0); // Key storyteller demographic
      
      // Validate tech comfort distribution
      const techDistribution = recruitedTesters.reduce((acc, tester) => {
        acc[tester.techComfort] = (acc[tester.techComfort] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      expect(Object.keys(techDistribution).length).toBeGreaterThanOrEqual(2);
      expect(techDistribution['low']).toBeGreaterThan(0); // Important for accessibility testing
      expect(techDistribution['medium']).toBeGreaterThan(0); // Largest user segment
      
      // Validate family size distribution
      const familySizes = recruitedTesters.map(t => t.familySize);
      expect(Math.min(...familySizes)).toBeGreaterThanOrEqual(2);
      expect(Math.max(...familySizes)).toBeLessThanOrEqual(8);
      expect(familySizes.filter(size => size >= 3).length).toBeGreaterThan(0); // Multi-generational families
      
      // Validate device type coverage
      const deviceTypes = recruitedTesters.map(t => t.deviceType);
      expect(deviceTypes.includes('ios')).toBe(true);
      expect(deviceTypes.includes('android')).toBe(true);
    });

    it('should prioritize families with storytelling potential', async () => {
      const familyProfiles = [
        {
          id: 'family-1',
          primaryAge: '65-74',
          familySize: 5,
          techComfort: 'medium',
          hasGrandchildren: true,
          storytellingInterest: 'high',
          deviceType: 'ios'
        },
        {
          id: 'family-2',
          primaryAge: '45-54',
          familySize: 3,
          techComfort: 'high',
          hasGrandchildren: false,
          storytellingInterest: 'medium',
          deviceType: 'android'
        },
        {
          id: 'family-3',
          primaryAge: '75+',
          familySize: 7,
          techComfort: 'low',
          hasGrandchildren: true,
          storytellingInterest: 'high',
          deviceType: 'ios'
        }
      ];

      const prioritizedFamilies = await userAcceptanceService.prioritizeFamiliesForRecruitment(familyProfiles);
      
      // Families with high storytelling interest should be prioritized
      expect(prioritizedFamilies[0].storytellingInterest).toBe('high');
      expect(prioritizedFamilies[1].storytellingInterest).toBe('high');
      
      // Multi-generational families should be prioritized
      expect(prioritizedFamilies[0].hasGrandchildren).toBe(true);
      expect(prioritizedFamilies[1].hasGrandchildren).toBe(true);
      
      // Diverse tech comfort levels should be represented
      const techLevels = prioritizedFamilies.map(f => f.techComfort);
      expect(new Set(techLevels).size).toBeGreaterThanOrEqual(2);
    });

    it('should create effective recruitment campaigns', async () => {
      const campaignConfig = {
        targetDemographic: 'families-with-aging-parents',
        channels: ['email', 'social_media', 'community_groups'],
        messaging: {
          primary: 'Help preserve your family\'s stories',
          secondary: 'Be among the first to try Saga',
          callToAction: 'Join our beta testing program'
        },
        incentives: {
          earlyAccess: true,
          freePackage: true,
          recognitionInApp: true
        }
      };

      const campaign = await userAcceptanceService.createRecruitmentCampaign(campaignConfig);
      
      expect(campaign.id).toBeDefined();
      expect(campaign.targetReach).toBeGreaterThan(1000);
      expect(campaign.expectedConversion).toBeGreaterThanOrEqual(0.05); // 5% conversion rate
      expect(campaign.messaging.primary).toContain('family');
      expect(campaign.messaging.primary).toContain('stories');
      
      // Validate incentive structure
      expect(campaign.incentives.earlyAccess).toBe(true);
      expect(campaign.incentives.freePackage).toBe(true);
      
      // Track campaign creation
      expect(analyticsService.trackEvent).toHaveBeenCalledWith('recruitment_campaign_created', {
        campaignId: campaign.id,
        targetDemographic: campaignConfig.targetDemographic,
        channels: campaignConfig.channels
      });
    });
  });

  describe('Recruitment Process Management', () => {
    it('should manage recruitment funnel effectively', async () => {
      const funnelStages = [
        { stage: 'campaign_exposure', count: 10000 },
        { stage: 'landing_page_visit', count: 500 },
        { stage: 'signup_interest', count: 150 },
        { stage: 'screening_completed', count: 100 },
        { stage: 'accepted_to_beta', count: 50 }
      ];

      const funnelAnalysis = await userAcceptanceService.analyzeRecruitmentFunnel(funnelStages);
      
      expect(funnelAnalysis.overallConversion).toBeGreaterThanOrEqual(0.005); // 0.5% overall conversion
      expect(funnelAnalysis.stageConversions['landing_page_visit']).toBeGreaterThanOrEqual(0.05); // 5% from exposure
      expect(funnelAnalysis.stageConversions['signup_interest']).toBeGreaterThanOrEqual(0.30); // 30% from landing
      expect(funnelAnalysis.stageConversions['accepted_to_beta']).toBeGreaterThanOrEqual(0.50); // 50% from screening
      
      // Identify optimization opportunities
      expect(funnelAnalysis.optimizationOpportunities).toContain('landing_page_optimization');
      expect(funnelAnalysis.bottlenecks.length).toBeGreaterThan(0);
    });

    it('should screen candidates for quality and fit', async () => {
      const candidates = [
        {
          id: 'candidate-1',
          email: 'john@example.com',
          ageRange: '55-64',
          familySize: 4,
          techComfort: 'medium',
          motivations: ['preserve family history', 'connect with grandchildren'],
          availability: 'high',
          deviceType: 'ios'
        },
        {
          id: 'candidate-2',
          email: 'jane@example.com',
          ageRange: '45-54',
          familySize: 2,
          techComfort: 'high',
          motivations: ['try new technology'],
          availability: 'low',
          deviceType: 'android'
        },
        {
          id: 'candidate-3',
          email: 'bob@example.com',
          ageRange: '65-74',
          familySize: 6,
          techComfort: 'low',
          motivations: ['preserve family history', 'share stories with family'],
          availability: 'high',
          deviceType: 'ios'
        }
      ];

      const screeningResults = await userAcceptanceService.screenCandidates(candidates);
      
      // Candidates with family history motivation should score higher
      const familyHistoryCandidate = screeningResults.find(r => r.candidateId === 'candidate-1');
      const techOnlyCandidate = screeningResults.find(r => r.candidateId === 'candidate-2');
      
      expect(familyHistoryCandidate.score).toBeGreaterThan(techOnlyCandidate.score);
      
      // High availability should be weighted positively
      expect(familyHistoryCandidate.score).toBeGreaterThan(7); // Out of 10
      expect(techOnlyCandidate.score).toBeLessThan(6); // Lower due to low availability
      
      // Validate screening criteria
      const acceptedCandidates = screeningResults.filter(r => r.accepted);
      expect(acceptedCandidates.length).toBeGreaterThan(0);
      expect(acceptedCandidates.every(c => c.score >= 6)).toBe(true);
    });

    it('should send personalized recruitment emails', async () => {
      const candidate = {
        id: 'candidate-1',
        name: 'John Smith',
        email: 'john@example.com',
        ageRange: '55-64',
        familySize: 4,
        interests: ['family history', 'technology'],
        referralSource: 'community_group'
      };

      await userAcceptanceService.sendRecruitmentEmail(candidate);
      
      expect(emailService.sendEmail).toHaveBeenCalledWith({
        to: candidate.email,
        subject: expect.stringContaining('Saga'),
        template: 'beta-recruitment',
        data: expect.objectContaining({
          name: candidate.name,
          personalizedMessage: expect.stringContaining('family history'),
          incentives: expect.any(Array)
        })
      });
      
      // Track email sent
      expect(analyticsService.trackEvent).toHaveBeenCalledWith('recruitment_email_sent', {
        candidateId: candidate.id,
        ageRange: candidate.ageRange,
        referralSource: candidate.referralSource
      });
    });
  });

  describe('Beta Tester Onboarding and Management', () => {
    it('should onboard accepted beta testers effectively', async () => {
      const acceptedTester = {
        id: 'tester-1',
        userId: 'user-1',
        email: 'tester@example.com',
        name: 'Test User',
        familySize: 4,
        ageRange: '55-64',
        techComfort: 'medium' as const,
        deviceType: 'ios' as const,
        testingPhase: 'onboarding' as const,
        recruitedAt: new Date()
      };

      const onboardingResult = await userAcceptanceService.onboardBetaTester(acceptedTester);
      
      expect(onboardingResult.welcomeEmailSent).toBe(true);
      expect(onboardingResult.testingAccountCreated).toBe(true);
      expect(onboardingResult.initialSurveyCompleted).toBe(true);
      expect(onboardingResult.testingScheduleProvided).toBe(true);
      
      // Validate onboarding materials
      expect(onboardingResult.materials).toContain('testing_guide');
      expect(onboardingResult.materials).toContain('feedback_forms');
      expect(onboardingResult.materials).toContain('contact_information');
      
      // Track onboarding completion
      expect(analyticsService.trackEvent).toHaveBeenCalledWith('beta_tester_onboarded', {
        testerId: acceptedTester.id,
        ageRange: acceptedTester.ageRange,
        techComfort: acceptedTester.techComfort
      });
    });

    it('should track beta tester progress through testing phases', async () => {
      const tester = {
        id: 'tester-1',
        userId: 'user-1',
        email: 'tester@example.com',
        name: 'Test User',
        familySize: 4,
        ageRange: '55-64',
        techComfort: 'medium' as const,
        deviceType: 'ios' as const,
        testingPhase: 'onboarding' as const,
        recruitedAt: new Date()
      };

      // Progress through phases
      await userAcceptanceService.updateTesterPhase(tester.id, 'recording');
      let updatedTester = await userAcceptanceService.getBetaTester(tester.id);
      expect(updatedTester.testingPhase).toBe('recording');

      await userAcceptanceService.updateTesterPhase(tester.id, 'interaction');
      updatedTester = await userAcceptanceService.getBetaTester(tester.id);
      expect(updatedTester.testingPhase).toBe('interaction');

      await userAcceptanceService.updateTesterPhase(tester.id, 'export');
      updatedTester = await userAcceptanceService.getBetaTester(tester.id);
      expect(updatedTester.testingPhase).toBe('export');

      await userAcceptanceService.completeTesterPhase(tester.id);
      const completedTester = await userAcceptanceService.getBetaTester(tester.id);
      expect(completedTester.testingPhase).toBe('complete');
      expect(completedTester.completedAt).toBeDefined();
      
      // Validate phase progression tracking
      const progressHistory = await userAcceptanceService.getTesterProgressHistory(tester.id);
      expect(progressHistory.length).toBe(5); // onboarding -> recording -> interaction -> export -> complete
      expect(progressHistory[0].phase).toBe('onboarding');
      expect(progressHistory[4].phase).toBe('complete');
    });

    it('should manage beta tester communication and support', async () => {
      const tester = {
        id: 'tester-1',
        email: 'tester@example.com',
        name: 'Test User',
        testingPhase: 'recording' as const
      };

      // Send phase-specific guidance
      await userAcceptanceService.sendPhaseGuidance(tester.id, 'recording');
      
      expect(emailService.sendEmail).toHaveBeenCalledWith({
        to: tester.email,
        subject: 'Recording Phase Testing Guide',
        template: 'beta-phase-guidance',
        data: expect.objectContaining({
          name: tester.name,
          phase: 'recording',
          instructions: expect.any(Array),
          supportContact: expect.any(String)
        })
      });

      // Handle support requests
      const supportRequest = {
        testerId: tester.id,
        issue: 'Unable to complete recording',
        priority: 'high' as const,
        category: 'technical' as const
      };

      const supportResponse = await userAcceptanceService.handleSupportRequest(supportRequest);
      
      expect(supportResponse.ticketId).toBeDefined();
      expect(supportResponse.estimatedResolution).toBeLessThanOrEqual(24); // hours
      expect(supportResponse.assignedTo).toBeDefined();
      
      // Track support metrics
      expect(analyticsService.trackEvent).toHaveBeenCalledWith('beta_support_request', {
        testerId: tester.id,
        issue: supportRequest.issue,
        priority: supportRequest.priority,
        category: supportRequest.category
      });
    });
  });

  describe('Recruitment Analytics and Optimization', () => {
    it('should track recruitment metrics and ROI', async () => {
      const recruitmentMetrics = await userAcceptanceService.calculateRecruitmentMetrics();
      
      expect(recruitmentMetrics.totalCampaignReach).toBeGreaterThan(5000);
      expect(recruitmentMetrics.totalSignups).toBeGreaterThan(100);
      expect(recruitmentMetrics.qualifiedCandidates).toBeGreaterThan(50);
      expect(recruitmentMetrics.acceptedTesters).toBeGreaterThan(25);
      
      expect(recruitmentMetrics.conversionRates.signupRate).toBeGreaterThanOrEqual(0.02); // 2%
      expect(recruitmentMetrics.conversionRates.qualificationRate).toBeGreaterThanOrEqual(0.50); // 50%
      expect(recruitmentMetrics.conversionRates.acceptanceRate).toBeGreaterThanOrEqual(0.50); // 50%
      
      expect(recruitmentMetrics.costMetrics.costPerSignup).toBeLessThan(10);
      expect(recruitmentMetrics.costMetrics.costPerQualifiedTester).toBeLessThan(25);
      expect(recruitmentMetrics.costMetrics.totalRecruitmentCost).toBeLessThan(2500);
      
      // ROI calculation
      expect(recruitmentMetrics.roi.feedbackValue).toBeGreaterThan(10000); // Value of feedback received
      expect(recruitmentMetrics.roi.productImprovementValue).toBeGreaterThan(25000); // Value of improvements
      expect(recruitmentMetrics.roi.overallROI).toBeGreaterThan(5); // 5x return on investment
    });

    it('should optimize recruitment strategies based on performance', async () => {
      const performanceData = {
        channels: [
          { name: 'email', reach: 5000, signups: 150, cost: 500 },
          { name: 'social_media', reach: 10000, signups: 200, cost: 800 },
          { name: 'community_groups', reach: 2000, signups: 100, cost: 300 }
        ],
        demographics: [
          { ageRange: '45-54', signupRate: 0.03, qualificationRate: 0.60 },
          { ageRange: '55-64', signupRate: 0.04, qualificationRate: 0.70 },
          { ageRange: '65-74', signupRate: 0.02, qualificationRate: 0.80 },
          { ageRange: '75+', signupRate: 0.01, qualificationRate: 0.90 }
        ]
      };

      const optimizationRecommendations = await userAcceptanceService.optimizeRecruitmentStrategy(performanceData);
      
      // Channel optimization
      expect(optimizationRecommendations.channelRecommendations).toContain('increase_community_groups_budget');
      expect(optimizationRecommendations.channelRecommendations).toContain('optimize_social_media_targeting');
      
      // Demographic optimization
      expect(optimizationRecommendations.demographicRecommendations).toContain('focus_on_55_64_age_group');
      expect(optimizationRecommendations.demographicRecommendations).toContain('improve_45_54_qualification_process');
      
      // Budget allocation
      expect(optimizationRecommendations.budgetAllocation.community_groups).toBeGreaterThan(0.4); // 40%+
      expect(optimizationRecommendations.budgetAllocation.email).toBeGreaterThan(0.2); // 20%+
      
      // Expected improvements
      expect(optimizationRecommendations.expectedImprovements.signupIncrease).toBeGreaterThanOrEqual(0.15); // 15%
      expect(optimizationRecommendations.expectedImprovements.costReduction).toBeGreaterThanOrEqual(0.10); // 10%
    });

    it('should generate recruitment success report', async () => {
      const recruitmentReport = await userAcceptanceService.generateRecruitmentReport();
      
      expect(recruitmentReport.summary.totalRecruitmentGoal).toBe(50);
      expect(recruitmentReport.summary.actualRecruited).toBeGreaterThanOrEqual(45); // 90% of goal
      expect(recruitmentReport.summary.goalAchievementRate).toBeGreaterThanOrEqual(0.90);
      
      expect(recruitmentReport.demographics.diversityScore).toBeGreaterThanOrEqual(0.80);
      expect(recruitmentReport.demographics.representativenessScore).toBeGreaterThanOrEqual(0.75);
      
      expect(recruitmentReport.quality.averageMotivationScore).toBeGreaterThanOrEqual(7.5);
      expect(recruitmentReport.quality.averageAvailabilityScore).toBeGreaterThanOrEqual(7.0);
      expect(recruitmentReport.quality.expectedCompletionRate).toBeGreaterThanOrEqual(0.85);
      
      expect(recruitmentReport.recommendations.length).toBeGreaterThan(0);
      expect(recruitmentReport.recommendations[0].priority).toMatch(/^(high|medium|low)$/);
      expect(recruitmentReport.recommendations[0].category).toMatch(/^(process|targeting|communication|incentives)$/);
    });
  });
});

// Helper interfaces for recruitment testing
interface RecruitmentCampaign {
  id: string;
  targetReach: number;
  expectedConversion: number;
  messaging: {
    primary: string;
    secondary: string;
    callToAction: string;
  };
  incentives: {
    earlyAccess: boolean;
    freePackage: boolean;
    recognitionInApp: boolean;
  };
}

interface FunnelAnalysis {
  overallConversion: number;
  stageConversions: Record<string, number>;
  optimizationOpportunities: string[];
  bottlenecks: string[];
}

interface ScreeningResult {
  candidateId: string;
  score: number;
  accepted: boolean;
  feedback: string;
}

interface OnboardingResult {
  welcomeEmailSent: boolean;
  testingAccountCreated: boolean;
  initialSurveyCompleted: boolean;
  testingScheduleProvided: boolean;
  materials: string[];
}

interface RecruitmentMetrics {
  totalCampaignReach: number;
  totalSignups: number;
  qualifiedCandidates: number;
  acceptedTesters: number;
  conversionRates: {
    signupRate: number;
    qualificationRate: number;
    acceptanceRate: number;
  };
  costMetrics: {
    costPerSignup: number;
    costPerQualifiedTester: number;
    totalRecruitmentCost: number;
  };
  roi: {
    feedbackValue: number;
    productImprovementValue: number;
    overallROI: number;
  };
}