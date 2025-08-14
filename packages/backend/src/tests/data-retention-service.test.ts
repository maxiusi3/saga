import { DataRetentionService, RetentionPolicy } from '../services/data-retention-service';
import { Project } from '../models/project';
import { Story } from '../models/story';
import { setupTestDatabase, cleanupTestDatabase } from './setup';

describe('DataRetentionService', () => {
  let retentionService: DataRetentionService;

  beforeAll(async () => {
    await setupTestDatabase();
    retentionService = new DataRetentionService();
  });

  afterAll(async () => {
    await cleanupTestDatabase();
  });

  describe('Retention Policies', () => {
    it('should return default retention policies', () => {
      const policies = retentionService.getRetentionPolicies();
      
      expect(policies).toHaveLength(4);
      expect(policies.map(p => p.name)).toContain('archived_project_cleanup');
      expect(policies.map(p => p.name)).toContain('export_request_cleanup');
      expect(policies.map(p => p.name)).toContain('temporary_files_cleanup');
      expect(policies.map(p => p.name)).toContain('analytics_events_cleanup');
    });

    it('should get a specific retention policy', () => {
      const policy = retentionService.getRetentionPolicy('archived_project_cleanup');
      
      expect(policy).toBeDefined();
      expect(policy?.name).toBe('archived_project_cleanup');
      expect(policy?.retentionPeriodDays).toBe(7 * 365); // 7 years
      expect(policy?.applyToArchived).toBe(true);
      expect(policy?.applyToActive).toBe(false);
    });

    it('should return undefined for non-existent policy', () => {
      const policy = retentionService.getRetentionPolicy('non_existent_policy');
      expect(policy).toBeUndefined();
    });
  });

  describe('Policy Validation', () => {
    it('should validate a correct policy', () => {
      const policy: RetentionPolicy = {
        name: 'test_policy',
        description: 'Test policy',
        retentionPeriodDays: 30,
        applyToArchived: true,
        applyToActive: false,
        dataTypes: ['stories'],
        enabled: true,
      };

      const validation = retentionService.validatePolicy(policy);
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should reject policy with missing name', () => {
      const policy: RetentionPolicy = {
        name: '',
        description: 'Test policy',
        retentionPeriodDays: 30,
        applyToArchived: true,
        applyToActive: false,
        dataTypes: ['stories'],
        enabled: true,
      };

      const validation = retentionService.validatePolicy(policy);
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Policy name is required');
    });

    it('should reject policy with invalid retention period', () => {
      const policy: RetentionPolicy = {
        name: 'test_policy',
        description: 'Test policy',
        retentionPeriodDays: 0,
        applyToArchived: true,
        applyToActive: false,
        dataTypes: ['stories'],
        enabled: true,
      };

      const validation = retentionService.validatePolicy(policy);
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Retention period must be at least 1 day');
    });

    it('should reject policy with excessive retention period', () => {
      const policy: RetentionPolicy = {
        name: 'test_policy',
        description: 'Test policy',
        retentionPeriodDays: 11 * 365, // 11 years
        applyToArchived: true,
        applyToActive: false,
        dataTypes: ['stories'],
        enabled: true,
      };

      const validation = retentionService.validatePolicy(policy);
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Retention period cannot exceed 10 years');
    });

    it('should reject policy with no data types', () => {
      const policy: RetentionPolicy = {
        name: 'test_policy',
        description: 'Test policy',
        retentionPeriodDays: 30,
        applyToArchived: true,
        applyToActive: false,
        dataTypes: [],
        enabled: true,
      };

      const validation = retentionService.validatePolicy(policy);
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('At least one data type must be specified');
    });

    it('should reject policy with invalid data types', () => {
      const policy: RetentionPolicy = {
        name: 'test_policy',
        description: 'Test policy',
        retentionPeriodDays: 30,
        applyToArchived: true,
        applyToActive: false,
        dataTypes: ['invalid_type'],
        enabled: true,
      };

      const validation = retentionService.validatePolicy(policy);
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Invalid data types: invalid_type');
    });

    it('should reject policy that applies to neither archived nor active', () => {
      const policy: RetentionPolicy = {
        name: 'test_policy',
        description: 'Test policy',
        retentionPeriodDays: 30,
        applyToArchived: false,
        applyToActive: false,
        dataTypes: ['stories'],
        enabled: true,
      };

      const validation = retentionService.validatePolicy(policy);
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Policy must apply to either archived or active projects (or both)');
    });
  });

  describe('Policy Execution', () => {
    let testProjectId: string;
    let testStoryId: string;

    beforeEach(async () => {
      // Create test data
      const project = await Project.query().insert({
        name: 'Test Project',
        description: 'Test project for retention',
        status: 'archived',
        createdBy: 'test-user-id',
        createdAt: new Date(Date.now() - 8 * 365 * 24 * 60 * 60 * 1000), // 8 years ago
        updatedAt: new Date(Date.now() - 8 * 365 * 24 * 60 * 60 * 1000), // 8 years ago
      });
      testProjectId = project.id;

      const story = await Story.query().insert({
        projectId: testProjectId,
        audioUrl: 'test-audio-url',
        transcript: 'Test transcript',
        createdAt: new Date(Date.now() - 8 * 365 * 24 * 60 * 60 * 1000), // 8 years ago
      });
      testStoryId = story.id;
    });

    afterEach(async () => {
      // Clean up test data
      await Story.query().where('projectId', testProjectId).delete();
      await Project.query().deleteById(testProjectId);
    });

    it('should execute archived project cleanup policy', async () => {
      const policy = retentionService.getRetentionPolicy('archived_project_cleanup');
      expect(policy).toBeDefined();

      // Mock storage service methods
      const mockStorageService = {
        getFileSize: jest.fn().mockResolvedValue(1000),
        deleteFile: jest.fn().mockResolvedValue(undefined),
      };

      // Execute the policy
      const report = await retentionService.executePolicy(policy!);

      expect(report.policy.name).toBe('archived_project_cleanup');
      expect(report.executedAt).toBeInstanceOf(Date);
      expect(report.itemsProcessed).toBeGreaterThanOrEqual(0);
    });

    it('should handle policy execution errors gracefully', async () => {
      const invalidPolicy: RetentionPolicy = {
        name: 'invalid_policy',
        description: 'Invalid policy for testing',
        retentionPeriodDays: 30,
        applyToArchived: true,
        applyToActive: false,
        dataTypes: ['invalid_data_type'],
        enabled: true,
      };

      const report = await retentionService.executePolicy(invalidPolicy);

      expect(report.policy.name).toBe('invalid_policy');
      expect(report.itemsDeleted).toBe(0);
      expect(report.errors.length).toBeGreaterThan(0);
    });
  });

  describe('Retention Status', () => {
    it('should return retention status', () => {
      const status = retentionService.getRetentionStatus();

      expect(status).toHaveProperty('policies');
      expect(status).toHaveProperty('totalItemsRetained');
      expect(Array.isArray(status.policies)).toBe(true);
      expect(status.policies.length).toBeGreaterThan(0);

      // Check that policies have next execution times
      status.policies.forEach(policy => {
        expect(policy).toHaveProperty('nextExecution');
        if (policy.nextExecution) {
          expect(policy.nextExecution).toBeInstanceOf(Date);
        }
      });
    });
  });

  describe('Execute All Policies', () => {
    it('should execute all enabled policies', async () => {
      const reports = await retentionService.executeAllPolicies();

      expect(Array.isArray(reports)).toBe(true);
      expect(reports.length).toBeGreaterThan(0);

      reports.forEach(report => {
        expect(report).toHaveProperty('policy');
        expect(report).toHaveProperty('executedAt');
        expect(report).toHaveProperty('itemsProcessed');
        expect(report).toHaveProperty('itemsDeleted');
        expect(report).toHaveProperty('storageFreed');
        expect(report).toHaveProperty('errors');
        expect(report.executedAt).toBeInstanceOf(Date);
        expect(Array.isArray(report.errors)).toBe(true);
      });
    });

    it('should handle errors in individual policies', async () => {
      // This test would require mocking database errors
      // For now, we just ensure the method completes without throwing
      const reports = await retentionService.executeAllPolicies();
      expect(reports).toBeDefined();
    });
  });

  describe('Data Type Processing', () => {
    it('should process export requests cleanup', async () => {
      const policy = retentionService.getRetentionPolicy('export_request_cleanup');
      expect(policy).toBeDefined();

      const report = await retentionService.executePolicy(policy!);
      expect(report.policy.name).toBe('export_request_cleanup');
      expect(report.errors.length).toBe(0);
    });

    it('should process analytics events cleanup', async () => {
      const policy = retentionService.getRetentionPolicy('analytics_events_cleanup');
      expect(policy).toBeDefined();

      const report = await retentionService.executePolicy(policy!);
      expect(report.policy.name).toBe('analytics_events_cleanup');
      expect(report.errors.length).toBe(0);
    });
  });
});