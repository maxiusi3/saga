import { PromptManagementController } from '../controllers/prompt-management-controller';
import { PromptQualityService } from '../services/prompt-quality-service';
import { PromptAnalyticsService } from '../services/prompt-analytics-service';
import { PromptABTestingService } from '../services/prompt-ab-testing-service';
import { Prompt } from '../models/prompt';

// Mock dependencies
jest.mock('../models/prompt');
jest.mock('../services/prompt-quality-service');
jest.mock('../services/prompt-analytics-service');
jest.mock('../services/prompt-ab-testing-service');
jest.mock('openai');

const mockPrompt = Prompt as jest.Mocked<typeof Prompt>;
const mockPromptQualityService = PromptQualityService as jest.Mocked<typeof PromptQualityService>;
const mockPromptAnalyticsService = PromptAnalyticsService as jest.Mocked<typeof PromptAnalyticsService>;
const mockPromptABTestingService = PromptABTestingService as jest.Mocked<typeof PromptABTestingService>;

describe('Prompt Management System', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('PromptManagementController', () => {
    describe('getLibraryPrompts', () => {
      it('should return paginated library prompts', async () => {
        const mockPrompts = [
          {
            data: {
              id: 'prompt-1',
              text: 'Test prompt 1',
              category: 'childhood',
              difficulty: 'easy',
              tags: ['memory'],
              followUpQuestions: ['Follow up?'],
              audioUrl: 'audio1.mp3',
              createdAt: new Date(),
              updatedAt: new Date(),
            },
            getTags: () => ['memory'],
            getFollowUpQuestions: () => ['Follow up?'],
            hasAudio: () => true,
          },
        ];

        mockPrompt.findLibraryPrompts.mockResolvedValue(mockPrompts as any);

        const req = {
          query: {
            page: '1',
            limit: '20',
            category: 'childhood',
          },
        };
        const res = {
          json: jest.fn(),
          status: jest.fn().mockReturnThis(),
        };

        await PromptManagementController.getLibraryPrompts(req as any, res as any);

        expect(res.json).toHaveBeenCalledWith({
          success: true,
          data: {
            prompts: expect.arrayContaining([
              expect.objectContaining({
                id: 'prompt-1',
                text: 'Test prompt 1',
                category: 'childhood',
                difficulty: 'easy',
              }),
            ]),
            pagination: expect.objectContaining({
              page: 1,
              limit: 20,
            }),
          },
        });
      });

      it('should handle search queries', async () => {
        const mockPrompts = [];
        mockPrompt.search.mockResolvedValue(mockPrompts as any);

        const req = {
          query: {
            search: 'childhood',
            page: '1',
            limit: '20',
          },
        };
        const res = {
          json: jest.fn(),
          status: jest.fn().mockReturnThis(),
        };

        await PromptManagementController.getLibraryPrompts(req as any, res as any);

        expect(mockPrompt.search).toHaveBeenCalledWith('childhood', {
          category: undefined,
          difficulty: undefined,
          limit: 20,
        });
      });
    });

    describe('createPrompt', () => {
      it('should create a new prompt successfully', async () => {
        const mockCreatedPrompt = {
          data: {
            id: 'new-prompt',
            text: 'New test prompt',
            category: 'family',
            difficulty: 'medium',
            tags: ['test'],
            followUpQuestions: [],
            audioUrl: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          getTags: () => ['test'],
          getFollowUpQuestions: () => [],
          hasAudio: () => false,
        };

        mockPrompt.create.mockResolvedValue(mockCreatedPrompt as any);

        const req = {
          body: {
            text: 'New test prompt',
            category: 'family',
            difficulty: 'medium',
            tags: ['test'],
            followUpQuestions: [],
          },
        };
        const res = {
          json: jest.fn(),
          status: jest.fn().mockReturnThis(),
        };

        await PromptManagementController.createPrompt(req as any, res as any);

        expect(res.status).toHaveBeenCalledWith(201);
        expect(res.json).toHaveBeenCalledWith({
          success: true,
          data: expect.objectContaining({
            id: 'new-prompt',
            text: 'New test prompt',
            category: 'family',
            difficulty: 'medium',
          }),
        });
      });

      it('should validate required fields', async () => {
        const req = {
          body: {
            text: 'Test prompt',
            // Missing category and difficulty
          },
        };
        const res = {
          json: jest.fn(),
          status: jest.fn().mockReturnThis(),
        };

        await PromptManagementController.createPrompt(req as any, res as any);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
          success: false,
          error: 'Text, category, and difficulty are required',
        });
      });

      it('should validate category values', async () => {
        const req = {
          body: {
            text: 'Test prompt',
            category: 'invalid-category',
            difficulty: 'easy',
          },
        };
        const res = {
          json: jest.fn(),
          status: jest.fn().mockReturnThis(),
        };

        await PromptManagementController.createPrompt(req as any, res as any);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
          success: false,
          error: expect.stringContaining('Invalid category'),
        });
      });
    });
  });

  describe('PromptQualityService', () => {
    it('should analyze prompt quality', async () => {
      const mockPrompt = {
        data: {
          id: 'prompt-1',
          text: 'Tell me about your childhood',
          category: 'childhood',
          difficulty: 'easy',
        },
        getTags: () => ['memory'],
        getFollowUpQuestions: () => ['What was special about it?'],
      };

      const mockQualityScore = {
        overall: 85,
        clarity: 90,
        engagement: 85,
        specificity: 80,
        culturalSensitivity: 95,
        feedback: ['Clear and engaging prompt'],
        suggestions: ['Could be more specific'],
      };

      Prompt.findById = jest.fn().mockResolvedValue(mockPrompt);
      mockPromptQualityService.analyzePromptQuality.mockResolvedValue({
        promptId: 'prompt-1',
        score: mockQualityScore,
        analyzedAt: new Date(),
      });

      const result = await PromptQualityService.analyzePromptQuality('prompt-1');

      expect(result.score.overall).toBe(85);
      expect(result.score.feedback).toContain('Clear and engaging prompt');
    });

    it('should handle quality analysis errors gracefully', async () => {
      Prompt.findById = jest.fn().mockRejectedValue(new Error('Database error'));

      await expect(PromptQualityService.analyzePromptQuality('invalid-id'))
        .rejects.toThrow('Database error');
    });
  });

  describe('PromptAnalyticsService', () => {
    it('should track prompt usage', async () => {
      const trackUsageSpy = jest.spyOn(PromptAnalyticsService, 'trackPromptUsage')
        .mockResolvedValue();

      await PromptAnalyticsService.trackPromptUsage(
        'prompt-1',
        'user-1',
        'engagement',
        { storyLength: 150 }
      );

      expect(trackUsageSpy).toHaveBeenCalledWith(
        'prompt-1',
        'user-1',
        'engagement',
        { storyLength: 150 }
      );
    });

    it('should generate analytics report', async () => {
      const mockReport = {
        timeframe: '30d',
        totalPrompts: 50,
        activePrompts: 35,
        topPerformingPrompts: [],
        underperformingPrompts: [],
        categoryPerformance: {},
        difficultyPerformance: {},
        trends: {
          engagementTrend: 5.2,
          completionTrend: -2.1,
          skipTrend: -3.5,
        },
      };

      mockPromptAnalyticsService.generateAnalyticsReport.mockResolvedValue(mockReport);

      const result = await PromptAnalyticsService.generateAnalyticsReport('30d');

      expect(result.totalPrompts).toBe(50);
      expect(result.trends.engagementTrend).toBe(5.2);
    });
  });

  describe('PromptABTestingService', () => {
    it('should create A/B test', async () => {
      const testConfig = {
        name: 'Childhood Prompts Test',
        description: 'Testing different childhood prompt variations',
        variants: [
          { id: 'variant-a', name: 'Original', promptId: 'prompt-1', trafficPercentage: 50 },
          { id: 'variant-b', name: 'Modified', promptId: 'prompt-2', trafficPercentage: 50 },
        ],
        trafficSplit: [50, 50],
        status: 'draft' as const,
        targetMetric: 'engagement' as const,
      };

      mockPromptABTestingService.createABTest.mockResolvedValue({
        ...testConfig,
        id: 'test-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await PromptABTestingService.createABTest(testConfig);

      expect(result.id).toBe('test-1');
      expect(result.variants).toHaveLength(2);
    });

    it('should get prompt variant for user', async () => {
      const mockVariant = {
        promptId: 'prompt-1',
        testId: 'test-1',
        variantId: 'variant-a',
      };

      mockPromptABTestingService.getPromptVariant.mockResolvedValue(mockVariant);

      const result = await PromptABTestingService.getPromptVariant('user-1', 'childhood');

      expect(result.promptId).toBe('prompt-1');
      expect(result.testId).toBe('test-1');
    });

    it('should record test interactions', async () => {
      const recordInteractionSpy = jest.spyOn(PromptABTestingService, 'recordTestInteraction')
        .mockResolvedValue();

      await PromptABTestingService.recordTestInteraction(
        'user-1',
        'test-1',
        'variant-a',
        'engagement'
      );

      expect(recordInteractionSpy).toHaveBeenCalledWith(
        'user-1',
        'test-1',
        'variant-a',
        'engagement'
      );
    });
  });

  describe('Integration Tests', () => {
    it('should handle complete prompt management workflow', async () => {
      // Create prompt
      const mockPrompt = {
        data: {
          id: 'workflow-prompt',
          text: 'Workflow test prompt',
          category: 'general',
          difficulty: 'medium',
        },
        getTags: () => [],
        getFollowUpQuestions: () => [],
        hasAudio: () => false,
        update: jest.fn(),
        delete: jest.fn(),
      };

      mockPrompt.create.mockResolvedValue(mockPrompt as any);
      Prompt.findById = jest.fn().mockResolvedValue(mockPrompt);

      // Analyze quality
      mockPromptQualityService.analyzePromptQuality.mockResolvedValue({
        promptId: 'workflow-prompt',
        score: {
          overall: 75,
          clarity: 80,
          engagement: 70,
          specificity: 75,
          culturalSensitivity: 85,
          feedback: ['Good prompt'],
          suggestions: ['Could be more engaging'],
        },
        analyzedAt: new Date(),
      });

      // Track usage
      const trackUsageSpy = jest.spyOn(PromptAnalyticsService, 'trackPromptUsage')
        .mockResolvedValue();

      // Execute workflow
      const createdPrompt = await Prompt.create({
        text: 'Workflow test prompt',
        category: 'general',
        difficulty: 'medium',
        isLibraryPrompt: true,
      });

      const qualityAnalysis = await PromptQualityService.analyzePromptQuality(createdPrompt.data.id);

      await PromptAnalyticsService.trackPromptUsage(
        createdPrompt.data.id,
        'test-user',
        'impression'
      );

      // Verify workflow
      expect(createdPrompt.data.id).toBe('workflow-prompt');
      expect(qualityAnalysis.score.overall).toBe(75);
      expect(trackUsageSpy).toHaveBeenCalled();
    });
  });
});

describe('Prompt Localization', () => {
    it('should get supported languages', async () => {
      const { PromptLocalizationService } = await import('../services/prompt-localization-service');
      
      const languages = PromptLocalizationService.getSupportedLanguages();
      
      expect(languages).toBeInstanceOf(Array);
      expect(languages.length).toBeGreaterThan(0);
      expect(languages[0]).toHaveProperty('code');
      expect(languages[0]).toHaveProperty('name');
      expect(languages[0]).toHaveProperty('nativeName');
    });

    it('should create localized prompt', async () => {
      const { PromptLocalizationService } = await import('../services/prompt-localization-service');
      
      // Mock database operations
      const mockDb = {
        insert: jest.fn().mockReturnValue({
          returning: jest.fn().mockResolvedValue([{
            id: 'localized-1',
            original_prompt_id: 'prompt-1',
            language: 'es',
            text: '[ES] Test prompt',
            status: 'draft',
            created_at: new Date(),
            updated_at: new Date(),
          }]),
        }),
        where: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue(null), // No existing localization
      };

      (PromptLocalizationService as any).db = mockDb;

      // Mock Prompt.findById
      const mockPrompt = {
        data: {
          id: 'prompt-1',
          text: 'Test prompt',
        },
        getFollowUpQuestions: () => ['Follow up?'],
      };
      
      Prompt.findById = jest.fn().mockResolvedValue(mockPrompt);

      const result = await PromptLocalizationService.createLocalizedPrompt({
        promptId: 'prompt-1',
        targetLanguage: 'es',
      });

      expect(result.language).toBe('es');
      expect(result.originalPromptId).toBe('prompt-1');
    });

    it('should get localization coverage', async () => {
      const { PromptLocalizationService } = await import('../services/prompt-localization-service');
      
      // Mock database operations
      const mockDb = {
        select: jest.fn().mockReturnThis(),
        count: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockResolvedValue([
          { language: 'es', count: '5' },
          { language: 'fr', count: '3' },
        ]),
        pluck: jest.fn().mockResolvedValue(['prompt-1', 'prompt-2']),
      };

      (PromptLocalizationService as any).db = mockDb;

      // Mock Prompt.findLibraryPrompts
      mockPrompt.findLibraryPrompts.mockResolvedValue([
        { data: { id: 'prompt-1' } },
        { data: { id: 'prompt-2' } },
        { data: { id: 'prompt-3' } },
      ]);

      const coverage = await PromptLocalizationService.getLocalizationCoverage();

      expect(coverage).toHaveProperty('totalPrompts');
      expect(coverage).toHaveProperty('localizedPrompts');
      expect(coverage).toHaveProperty('coveragePercentage');
    });
  });

  describe('Prompt Backup and Versioning', () => {
    it('should create prompt version', async () => {
      const { PromptBackupService } = await import('../services/prompt-backup-service');
      
      // Mock database operations
      const mockDb = {
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue({ version: 1 }),
        insert: jest.fn().mockReturnValue({
          returning: jest.fn().mockResolvedValue([{
            id: 'version-1',
            prompt_id: 'prompt-1',
            version: 2,
            text: 'Updated prompt text',
            created_at: new Date(),
          }]),
        }),
      };

      (PromptBackupService as any).db = mockDb;

      // Mock Prompt.findById
      const mockPrompt = {
        data: {
          id: 'prompt-1',
          text: 'Updated prompt text',
          category: 'general',
          difficulty: 'medium',
        },
        getTags: () => ['test'],
        getFollowUpQuestions: () => ['Follow up?'],
      };
      
      Prompt.findById = jest.fn().mockResolvedValue(mockPrompt);

      const version = await PromptBackupService.createPromptVersion(
        'prompt-1',
        'Updated for clarity',
        'admin-user'
      );

      expect(version.promptId).toBe('prompt-1');
      expect(version.version).toBe(2);
      expect(version.changeReason).toBe('Updated for clarity');
    });

    it('should create backup', async () => {
      const { PromptBackupService } = await import('../services/prompt-backup-service');
      
      // Mock file system operations
      const mockFs = {
        mkdir: jest.fn().mockResolvedValue(undefined),
        writeFile: jest.fn().mockResolvedValue(undefined),
        stat: jest.fn().mockResolvedValue({ size: 1024 }),
      };

      // Mock crypto
      const mockCrypto = {
        createHash: jest.fn().mockReturnValue({
          update: jest.fn().mockReturnThis(),
          digest: jest.fn().mockReturnValue('mock-checksum'),
        }),
      };

      // Mock database operations
      const mockDb = {
        insert: jest.fn().mockReturnValue({
          returning: jest.fn().mockResolvedValue([{
            id: 'backup-1',
            backup_type: 'manual',
            prompt_count: 10,
            file_path: '/backups/test.json',
            file_size: 1024,
            checksum: 'mock-checksum',
            created_at: new Date(),
          }]),
        }),
      };

      (PromptBackupService as any).db = mockDb;

      // Mock Prompt.findLibraryPrompts
      mockPrompt.findLibraryPrompts.mockResolvedValue([
        {
          data: {
            id: 'prompt-1',
            text: 'Test prompt',
            category: 'general',
            difficulty: 'easy',
          },
          getTags: () => [],
          getFollowUpQuestions: () => [],
        },
      ]);

      const backup = await PromptBackupService.createBackup('manual', 'admin-user');

      expect(backup.backupType).toBe('manual');
      expect(backup.promptCount).toBe(10);
    });

    it('should get version history', async () => {
      const { PromptBackupService } = await import('../services/prompt-backup-service');
      
      // Mock database operations
      const mockDb = {
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockResolvedValue([
          {
            id: 'version-1',
            prompt_id: 'prompt-1',
            version: 1,
            text: 'Original text',
            created_at: new Date(),
          },
          {
            id: 'version-2',
            prompt_id: 'prompt-1',
            version: 2,
            text: 'Updated text',
            created_at: new Date(),
          },
        ]),
      };

      (PromptBackupService as any).db = mockDb;

      const versions = await PromptBackupService.getPromptVersionHistory('prompt-1');

      expect(versions).toHaveLength(2);
      expect(versions[0].version).toBe(1);
      expect(versions[1].version).toBe(2);
    });
  });

  describe('Integration with existing services', () => {
    it('should integrate localization with prompt delivery', async () => {
      const { PromptLocalizationService } = await import('../services/prompt-localization-service');
      
      // Mock localized prompt
      const mockLocalizedPrompt = {
        id: 'localized-1',
        originalPromptId: 'prompt-1',
        language: 'es',
        text: 'Cuéntame sobre tu infancia',
        followUpQuestions: ['¿Qué fue especial de eso?'],
        status: 'approved',
      };

      // Mock database operations
      const mockDb = {
        where: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue({
          id: 'localized-1',
          original_prompt_id: 'prompt-1',
          language: 'es',
          text: 'Cuéntame sobre tu infancia',
          follow_up_questions: JSON.stringify(['¿Qué fue especial de eso?']),
          status: 'approved',
        }),
      };

      (PromptLocalizationService as any).db = mockDb;

      const result = await PromptLocalizationService.getPromptForUser('prompt-1', 'es');

      expect(result.text).toBe('Cuéntame sobre tu infancia');
      expect(result.language).toBe('es');
      expect(result.isLocalized).toBe(true);
    });

    it('should create version when prompt is updated', async () => {
      const { PromptBackupService } = await import('../services/prompt-backup-service');
      
      // Mock the version creation process
      const createVersionSpy = jest.spyOn(PromptBackupService, 'createPromptVersion')
        .mockResolvedValue({
          id: 'version-1',
          promptId: 'prompt-1',
          version: 2,
          text: 'Updated text',
          category: 'general',
          difficulty: 'medium',
          tags: [],
          followUpQuestions: [],
          changeReason: 'Updated for clarity',
          changedBy: 'admin',
          createdAt: new Date(),
        });

      // Simulate prompt update
      await PromptBackupService.createPromptVersion(
        'prompt-1',
        'Updated for clarity',
        'admin'
      );

      expect(createVersionSpy).toHaveBeenCalledWith(
        'prompt-1',
        'Updated for clarity',
        'admin'
      );
    });
  });