import { UserAcceptanceTestingService } from '../services/user-acceptance-testing-service';
import { OnboardingTestingService } from '../services/onboarding-testing-service';
import { AnalyticsService } from '../services/analytics-service';
import { EmailNotificationService } from '../services/email-notification-service';

describe('Onboarding User Acceptance Testing', () => {
  let userAcceptanceService: UserAcceptanceTestingService;
  let onboardingService: OnboardingTestingService;
  let analyticsService: AnalyticsService;
  let emailService: EmailNotificationService;

  beforeEach(() => {
    userAcceptanceService = new UserAcceptanceTestingService();
    onboardingService = new OnboardingTestingService();
    analyticsService = new AnalyticsService();
    emailService = new EmailNotificationService();
  });

  describe('First-Time User Experience Testing', () => {
    it('should validate complete facilitator onboarding flow', async () => {
      const testScenario = {
        id: 'facilitator-first-time',
        name: 'First-Time Facilitator Complete Flow',
        description: 'Test complete facilitator journey from signup to first story interaction',
        targetRole: 'facilitator' as const,
        estimatedDuration: 25,
        steps: [
          {
            stepNumber: 1,
            instruction: 'Sign up for new account using preferred OAuth method',
            expectedOutcome: 'Account created successfully with resource wallet initialized',
            platform: 'web' as const
          },
          {
            stepNumber: 2,
            instruction: 'Navigate to dashboard and understand the package/seat model',
            expectedOutcome: 'User understands they need to purchase package to create project',
            platform: 'web' as const
          },
          {
            stepNumber: 3,
            instruction: 'Purchase "The Saga Package" using preferred payment method',
            expectedOutcome: 'Payment completes successfully and wallet is credited',
            platform: 'web' as const
          },
          {
            stepNumber: 4,
            instruction: 'Create first project with meaningful name and description',
            expectedOutcome: 'Project created and voucher consumed from wallet',
            platform: 'web' as const
          },
          {
            stepNumber: 5,
            instruction: 'Generate and share storyteller invitation link',
            expectedOutcome: 'Invitation link generated and ready to share',
            platform: 'web' as const
          },
          {
            stepNumber: 6,
            instruction: 'Wait for storyteller to record first story and provide feedback',
            expectedOutcome: 'Successfully interact with first story using follow-up questions',
            platform: 'web' as const
          }
        ],
        successCriteria: [
          'Signup completes in under 2 minutes',
          'Package purchase flow is trustworthy and clear',
          'Project creation is intuitive and satisfying',
          'Invitation sharing is simple and reliable',
          'First story interaction feels meaningful',
          'User understands the value proposition'
        ]
      };

      const testResult = await userAcceptanceService.conductTestingScenario(testScenario);
      
      expect(testResult.completedSuccessfully).toBe(true);
      expect(testResult.completionTime).toBeLessThan(25);
      expect(testResult.rating).toBeGreaterThanOrEqual(4);
      expect(testResult.usabilityIssues.filter(i => i.severity === 'critical')).toHaveLength(0);
    });

    it('should validate storyteller onboarding and first recording experience', async () => {
      const testScenario = {
        id: 'storyteller-first-time',
        name: 'First-Time Storyteller Complete Flow',
        description: 'Test storyteller journey from invitation to first successful recording',
        targetRole: 'storyteller' as const,
        estimatedDuration: 20,
        steps: [
          {
            stepNumber: 1,
            instruction: 'Receive invitation link via email/text and tap to open',
            expectedOutcome: 'App downloads/opens and shows personalized welcome',
            platform: 'mobile' as const
          },
          {
            stepNumber: 2,
            instruction: 'Review facilitator names and project information',
            expectedOutcome: 'Clear understanding of who invited them and project purpose',
            platform: 'mobile' as const
          },
          {
            stepNumber: 3,
            instruction: 'Accept invitation with single tap',
            expectedOutcome: 'Invitation accepted and privacy pledge displayed',
            platform: 'mobile' as const
          },
          {
            stepNumber: 4,
            instruction: 'Read and accept privacy pledge',
            expectedOutcome: 'Privacy concerns addressed and agreement completed',
            platform: 'mobile' as const
          },
          {
            stepNumber: 5,
            instruction: 'Navigate to recording screen and review first AI prompt',
            expectedOutcome: 'Prompt is engaging and recording interface is clear',
            platform: 'mobile' as const
          },
          {
            stepNumber: 6,
            instruction: 'Record first story using press-and-hold interface',
            expectedOutcome: 'Recording completes successfully with good audio quality',
            platform: 'mobile' as const
          },
          {
            stepNumber: 7,
            instruction: 'Review recording and use "Send to Family" confirmation',
            expectedOutcome: 'Review process builds confidence and sending is satisfying',
            platform: 'mobile' as const
          }
        ],
        successCriteria: [
          'Onboarding completes in 3 interactions or less',
          'Privacy pledge is reassuring and clear',
          'Recording interface is intuitive for older adults',
          'Review & Send workflow builds confidence',
          'First story submission feels meaningful',
          'User wants to record more stories'
        ]
      };

      const testResult = await userAcceptanceService.conductTestingScenario(testScenario);
      
      expect(testResult.completedSuccessfully).toBe(true);
      expect(testResult.completionTime).toBeLessThan(20);
      expect(testResult.rating).toBeGreaterThanOrEqual(4);
      expect(testResult.wouldRecommend).toBe(true);
    });

    it('should test accessibility features with real users', async () => {
      const accessibilityScenario = {
        id: 'accessibility-first-time',
        name: 'Accessibility Features Validation',
        description: 'Test accessibility features with users who have disabilities',
        targetRole: 'storyteller' as const,
        estimatedDuration: 35,
        steps: [
          {
            stepNumber: 1,
            instruction: 'Navigate onboarding using screen reader or voice control',
            expectedOutcome: 'All elements properly labeled and accessible',
            platform: 'mobile' as const
          },
          {
            stepNumber: 2,
            instruction: 'Adjust font size to Extra Large setting',
            expectedOutcome: 'Text becomes clearly readable throughout app',
            platform: 'mobile' as const
          },
          {
            stepNumber: 3,
            instruction: 'Enable high contrast mode',
            expectedOutcome: 'Colors provide sufficient contrast for visibility',
            platform: 'mobile' as const
          },
          {
            stepNumber: 4,
            instruction: 'Complete full recording workflow using accessibility features',
            expectedOutcome: 'Recording process fully accessible with assistive technology',
            platform: 'mobile' as const
          },
          {
            stepNumber: 5,
            instruction: 'Navigate story review and feedback features',
            expectedOutcome: 'All content accessible and interaction possible',
            platform: 'mobile' as const
          }
        ],
        successCriteria: [
          'WCAG 2.1 AA compliance verified by real users',
          'Screen reader navigation is smooth and logical',
          'Visual accessibility features are effective',
          'Touch targets meet 44x44dp minimum requirement',
          'Color contrast ratios meet accessibility standards',
          'Users can complete all core workflows independently'
        ]
      };

      const testResult = await userAcceptanceService.conductTestingScenario(accessibilityScenario);
      
      expect(testResult.completedSuccessfully).toBe(true);
      expect(testResult.usabilityIssues.filter(i => i.category === 'accessibility')).toHaveLength(0);
      expect(testResult.rating).toBeGreaterThanOrEqual(4);
    });
  });

  describe('Business Model Validation Testing', () => {
    it('should validate user understanding of package/seat model', async () => {
      const businessModelScenario = {
        id: 'business-model-understanding',
        name: 'Package/Seat Model Comprehension',
        description: 'Test user understanding and acceptance of the business model',
        targetRole: 'facilitator' as const,
        estimatedDuration: 15,
        steps: [
          {
            stepNumber: 1,
            instruction: 'Review "The Saga Package" pricing and value proposition',
            expectedOutcome: 'User understands what they get for $99-149',
            platform: 'web' as const
          },
          {
            stepNumber: 2,
            instruction: 'Examine resource wallet and seat allocation',
            expectedOutcome: 'Clear understanding of vouchers and seats concept',
            platform: 'web' as const
          },
          {
            stepNumber: 3,
            instruction: 'Invite facilitator and storyteller using seats',
            expectedOutcome: 'Seat consumption is expected and transparent',
            platform: 'web' as const
          },
          {
            stepNumber: 4,
            instruction: 'Review subscription timeline and archival mode explanation',
            expectedOutcome: 'User understands 1-year active period and archival transition',
            platform: 'web' as const
          }
        ],
        successCriteria: [
          'Pricing perceived as fair value for offering',
          'Seat model is intuitive and clear',
          'Archival mode concept is understood and accepted',
          'Users would recommend to other families',
          'Business model supports family collaboration goals'
        ]
      };

      const testResult = await userAcceptanceService.conductTestingScenario(businessModelScenario);
      
      expect(testResult.completedSuccessfully).toBe(true);
      expect(testResult.rating).toBeGreaterThanOrEqual(4);
      expect(testResult.wouldRecommend).toBe(true);
      
      // Validate specific business model metrics
      const businessValidation = await userAcceptanceService.analyzeBusinessModelValidation([testResult]);
      expect(businessValidation.pricingAcceptance).toBeGreaterThanOrEqual(0.8);
      expect(businessValidation.seatModelUnderstanding).toBeGreaterThanOrEqual(0.9);
      expect(businessValidation.archivalModeAcceptance).toBeGreaterThanOrEqual(0.7);
    });

    it('should test pricing sensitivity and value perception', async () => {
      const pricingTestScenarios = [
        { price: 99, expectedAcceptance: 0.9 },
        { price: 124, expectedAcceptance: 0.8 },
        { price: 149, expectedAcceptance: 0.7 }
      ];

      for (const scenario of pricingTestScenarios) {
        const testResult = await userAcceptanceService.testPricingSensitivity({
          price: scenario.price,
          features: [
            '1 Project Voucher',
            '2 Facilitator Seats',
            '2 Storyteller Seats',
            '1 Year Interactive Service',
            'Permanent Archival Access',
            'Full Data Export'
          ]
        });

        expect(testResult.acceptanceRate).toBeGreaterThanOrEqual(scenario.expectedAcceptance);
        expect(testResult.perceivedValue).toBeGreaterThanOrEqual(4.0);
      }
    });

    it('should validate multi-facilitator collaboration value', async () => {
      const collaborationScenario = {
        id: 'multi-facilitator-value',
        name: 'Multi-Facilitator Collaboration Value',
        description: 'Test perceived value of sibling collaboration features',
        targetRole: 'facilitator' as const,
        estimatedDuration: 20,
        steps: [
          {
            stepNumber: 1,
            instruction: 'Invite sibling as co-facilitator using facilitator seat',
            expectedOutcome: 'Invitation process is clear and seat consumption understood',
            platform: 'web' as const
          },
          {
            stepNumber: 2,
            instruction: 'Collaborate on story interactions with co-facilitator',
            expectedOutcome: 'Real-time collaboration feels valuable and organized',
            platform: 'web' as const
          },
          {
            stepNumber: 3,
            instruction: 'Review attribution and activity tracking',
            expectedOutcome: 'Clear understanding of who contributed what',
            platform: 'web' as const
          }
        ],
        successCriteria: [
          'Multi-facilitator features justify additional seat cost',
          'Collaboration enhances rather than complicates experience',
          'Attribution provides accountability and recognition',
          'Users see value in coordinated family effort'
        ]
      };

      const testResult = await userAcceptanceService.conductTestingScenario(collaborationScenario);
      
      expect(testResult.completedSuccessfully).toBe(true);
      expect(testResult.rating).toBeGreaterThanOrEqual(4);
      
      // Validate collaboration-specific metrics
      const collaborationValue = testResult.generalFeedback;
      expect(collaborationValue).toContain('valuable');
      expect(testResult.wouldRecommend).toBe(true);
    });
  });

  describe('User Testing Report Generation', () => {
    it('should generate comprehensive testing report with actionable insights', async () => {
      // Simulate multiple test sessions
      const testFeedback = [
        {
          id: 'feedback-1',
          betaTesterId: 'tester-1',
          scenarioId: 'facilitator-first-time',
          rating: 5,
          completionTime: 22,
          completedSuccessfully: true,
          usabilityIssues: [],
          generalFeedback: 'Very intuitive and easy to use',
          suggestions: 'Maybe add more guidance on pricing',
          wouldRecommend: true,
          createdAt: new Date()
        },
        {
          id: 'feedback-2',
          betaTesterId: 'tester-2',
          scenarioId: 'storyteller-first-time',
          rating: 4,
          completionTime: 18,
          completedSuccessfully: true,
          usabilityIssues: [
            {
              severity: 'medium' as const,
              category: 'accessibility' as const,
              description: 'Font could be larger by default',
              location: 'Recording screen',
              reproductionSteps: ['Open recording screen', 'Notice small text']
            }
          ],
          generalFeedback: 'Great concept, minor accessibility improvements needed',
          suggestions: 'Default to larger font size',
          wouldRecommend: true,
          createdAt: new Date()
        }
      ];

      const report = await userAcceptanceService.generateTestingReport();
      
      expect(report.summary.totalTesters).toBeGreaterThan(0);
      expect(report.summary.averageRating).toBeGreaterThanOrEqual(4.0);
      expect(report.summary.completionRate).toBeGreaterThanOrEqual(0.8);
      expect(report.summary.recommendationRate).toBeGreaterThanOrEqual(0.8);
      
      expect(report.usabilityFindings.totalIssues).toBeDefined();
      expect(report.businessModelValidation.overallBusinessModelScore).toBeGreaterThanOrEqual(4.0);
      
      expect(report.recommendations).toBeInstanceOf(Array);
      expect(report.recommendations.length).toBeGreaterThan(0);
      
      // Validate recommendation structure
      const criticalRecommendations = report.recommendations.filter(r => r.priority === 'critical');
      expect(criticalRecommendations.length).toBe(0); // No critical issues expected
      
      const highPriorityRecommendations = report.recommendations.filter(r => r.priority === 'high');
      expect(highPriorityRecommendations.every(r => r.timeline && r.impact && r.effort)).toBe(true);
    });

    it('should track key success metrics for MVP validation', async () => {
      const metrics = await userAcceptanceService.calculateMVPMetrics();
      
      // Business metrics targets
      expect(metrics.purchaseConversionRate).toBeGreaterThanOrEqual(0.05); // > 5%
      expect(metrics.projectActivationRate).toBeGreaterThanOrEqual(0.60); // > 60%
      expect(metrics.week2StorytellerRetention).toBeGreaterThanOrEqual(0.15); // > 15%
      expect(metrics.interactionLoopRate).toBeGreaterThanOrEqual(0.20); // > 20%
      expect(metrics.multiFacilitatorCollaborationRate).toBeGreaterThanOrEqual(0.10); // > 10%
      
      // User experience metrics
      expect(metrics.onboardingCompletionRate).toBeGreaterThanOrEqual(0.80); // > 80%
      expect(metrics.recordingCompletionRate).toBeGreaterThanOrEqual(0.90); // > 90%
      expect(metrics.userSatisfactionScore).toBeGreaterThanOrEqual(4.0); // > 4.0/5.0
    });
  });

  describe('Beta Tester Recruitment and Management', () => {
    it('should recruit diverse beta testers from target demographics', async () => {
      const recruitmentCriteria = {
        targetCount: 50,
        familySizeRange: [2, 8] as [number, number],
        ageRanges: ['45-54', '55-64', '65-74', '75+'],
        techComfortLevels: ['low', 'medium', 'high'],
        deviceTypes: ['ios', 'android', 'both']
      };

      const recruitedTesters = await userAcceptanceService.recruitBetaTesters(recruitmentCriteria);
      
      expect(recruitedTesters.length).toBeLessThanOrEqual(recruitmentCriteria.targetCount);
      
      // Validate demographic diversity
      const ageDistribution = recruitedTesters.reduce((acc, tester) => {
        acc[tester.ageRange] = (acc[tester.ageRange] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      expect(Object.keys(ageDistribution).length).toBeGreaterThanOrEqual(3);
      
      const techComfortDistribution = recruitedTesters.reduce((acc, tester) => {
        acc[tester.techComfort] = (acc[tester.techComfort] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      expect(Object.keys(techComfortDistribution).length).toBeGreaterThanOrEqual(2);
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

      await userAcceptanceService.updateTesterPhase(tester.id, 'recording');
      const updatedTester = await userAcceptanceService.getBetaTester(tester.id);
      
      expect(updatedTester.testingPhase).toBe('recording');
      
      // Track completion
      await userAcceptanceService.completeTesterPhase(tester.id);
      const completedTester = await userAcceptanceService.getBetaTester(tester.id);
      
      expect(completedTester.testingPhase).toBe('complete');
      expect(completedTester.completedAt).toBeDefined();
    });
  });
});

// Helper functions for testing
async function createMockTestingSession(scenario: any): Promise<any> {
  return {
    id: 'session-1',
    betaTesterId: 'tester-1',
    moderatorId: 'moderator-1',
    scheduledAt: new Date(),
    duration: scenario.estimatedDuration,
    scenarios: [scenario.id],
    status: 'scheduled',
    notes: ''
  };
}

async function simulateUserInteraction(step: any): Promise<boolean> {
  // Simulate user completing the step
  const success = Math.random() > 0.1; // 90% success rate
  return success;
}

async function measureCompletionTime(steps: any[]): Promise<number> {
  // Simulate realistic completion times
  const baseTime = steps.length * 2; // 2 minutes per step base
  const variance = Math.random() * 5; // Up to 5 minutes variance
  return baseTime + variance;
}