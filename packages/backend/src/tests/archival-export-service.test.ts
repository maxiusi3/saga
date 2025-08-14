import { ArchivalExportService, ArchivalExportOptions } from '../services/archival-export-service';
import { Project } from '../models/project';
import { Story } from '../models/story';
import { ExportRequestModel } from '../models/export-request';
import { setupTestDatabase, cleanupTestDatabase } from './setup';

describe('ArchivalExportService', () => {
  let exportService: ArchivalExportService;
  let testProjectId: string;
  let testUserId: string;

  beforeAll(async () => {
    await setupTestDatabase();
    exportService = new ArchivalExportService();
  });

  afterAll(async () => {
    await cleanupTestDatabase();
  });

  beforeEach(async () => {
    // Create test project
    const project = await Project.query().insert({
      name: 'Test Project',
      description: 'Test project for export',
      status: 'archived',
      createdBy: 'test-user-id',
    });
    testProjectId = project.id;
    testUserId = 'test-user-id';

    // Create test story
    await Story.query().insert({
      projectId: testProjectId,
      audioUrl: 'test-audio-url',
      transcript: 'Test transcript',
      title: 'Test Story',
    });
  });

  afterEach(async () => {
    // Clean up test data
    await Story.query().where('projectId', testProjectId).delete();
    await Project.query().deleteById(testProjectId);
  });

  describe('createArchivalExport', () => {
    it('should create an archival export request', async () => {
      const options: ArchivalExportOptions = {
        includeAudio: true,
        includePhotos: true,
        includeTranscripts: true,
        includeInteractions: true,
        includeChapterSummaries: true,
        includeMetadata: true,
        format: 'zip',
      };

      const exportId = await exportService.createArchivalExport(
        testProjectId,
        testUserId,
        options
      );

      expect(exportId).toBeDefined();
      expect(typeof exportId).toBe('string');

      // Verify export request was created
      const exportRequest = await ExportRequestModel.findById(exportId);
      expect(exportRequest).toBeDefined();
      expect(exportRequest?.projectId).toBe(testProjectId);
      expect(exportRequest?.facilitatorId).toBe(testUserId);
    });

    it('should handle different export formats', async () => {
      const zipOptions: ArchivalExportOptions = {
        includeAudio: true,
        includePhotos: false,
        includeTranscripts: true,
        includeInteractions: false,
        includeChapterSummaries: false,
        includeMetadata: true,
        format: 'zip',
      };

      const jsonOptions: ArchivalExportOptions = {
        ...zipOptions,
        format: 'json',
      };

      const zipExportId = await exportService.createArchivalExport(
        testProjectId,
        testUserId,
        zipOptions
      );

      const jsonExportId = await exportService.createArchivalExport(
        testProjectId,
        testUserId,
        jsonOptions
      );

      expect(zipExportId).toBeDefined();
      expect(jsonExportId).toBeDefined();
      expect(zipExportId).not.toBe(jsonExportId);
    });

    it('should handle date range filtering', async () => {
      const options: ArchivalExportOptions = {
        includeAudio: true,
        includePhotos: true,
        includeTranscripts: true,
        includeInteractions: true,
        includeChapterSummaries: true,
        includeMetadata: true,
        format: 'zip',
        dateRange: {
          startDate: new Date('2023-01-01'),
          endDate: new Date('2023-12-31'),
        },
      };

      const exportId = await exportService.createArchivalExport(
        testProjectId,
        testUserId,
        options
      );

      expect(exportId).toBeDefined();
    });

    it('should handle chapter filtering', async () => {
      const options: ArchivalExportOptions = {
        includeAudio: true,
        includePhotos: true,
        includeTranscripts: true,
        includeInteractions: true,
        includeChapterSummaries: true,
        includeMetadata: true,
        format: 'zip',
        chapters: ['chapter-1', 'chapter-2'],
      };

      const exportId = await exportService.createArchivalExport(
        testProjectId,
        testUserId,
        options
      );

      expect(exportId).toBeDefined();
    });
  });

  describe('getExportStatus', () => {
    it('should return export status', async () => {
      const options: ArchivalExportOptions = {
        includeAudio: true,
        includePhotos: true,
        includeTranscripts: true,
        includeInteractions: true,
        includeChapterSummaries: true,
        includeMetadata: true,
        format: 'zip',
      };

      const exportId = await exportService.createArchivalExport(
        testProjectId,
        testUserId,
        options
      );

      const status = await exportService.getExportStatus(exportId);

      expect(status).toBeDefined();
      expect(status.id).toBe(exportId);
      expect(status.status).toBeDefined();
      expect(['pending', 'processing', 'ready', 'failed', 'expired']).toContain(status.status);
    });

    it('should throw error for non-existent export', async () => {
      await expect(
        exportService.getExportStatus('non-existent-id')
      ).rejects.toThrow('Export not found');
    });
  });

  describe('getProjectExports', () => {
    it('should return all exports for a project', async () => {
      const options: ArchivalExportOptions = {
        includeAudio: true,
        includePhotos: true,
        includeTranscripts: true,
        includeInteractions: true,
        includeChapterSummaries: true,
        includeMetadata: true,
        format: 'zip',
      };

      // Create multiple exports
      const exportId1 = await exportService.createArchivalExport(
        testProjectId,
        testUserId,
        options
      );

      const exportId2 = await exportService.createArchivalExport(
        testProjectId,
        testUserId,
        { ...options, format: 'json' }
      );

      const exports = await exportService.getProjectExports(testProjectId);

      expect(exports).toBeDefined();
      expect(Array.isArray(exports)).toBe(true);
      expect(exports.length).toBeGreaterThanOrEqual(2);

      const exportIds = exports.map(exp => exp.id);
      expect(exportIds).toContain(exportId1);
      expect(exportIds).toContain(exportId2);
    });

    it('should return empty array for project with no exports', async () => {
      // Create a new project without exports
      const newProject = await Project.query().insert({
        name: 'New Project',
        description: 'Project without exports',
        status: 'active',
        createdBy: testUserId,
      });

      const exports = await exportService.getProjectExports(newProject.id);

      expect(exports).toBeDefined();
      expect(Array.isArray(exports)).toBe(true);
      expect(exports.length).toBe(0);

      // Clean up
      await Project.query().deleteById(newProject.id);
    });
  });

  describe('deleteExport', () => {
    it('should delete an export', async () => {
      const options: ArchivalExportOptions = {
        includeAudio: true,
        includePhotos: true,
        includeTranscripts: true,
        includeInteractions: true,
        includeChapterSummaries: true,
        includeMetadata: true,
        format: 'zip',
      };

      const exportId = await exportService.createArchivalExport(
        testProjectId,
        testUserId,
        options
      );

      // Verify export exists
      const exportBefore = await ExportRequestModel.findById(exportId);
      expect(exportBefore).toBeDefined();

      // Delete export
      await exportService.deleteExport(exportId);

      // Verify export is deleted
      await expect(
        ExportRequestModel.findById(exportId)
      ).rejects.toThrow();
    });

    it('should throw error when deleting non-existent export', async () => {
      await expect(
        exportService.deleteExport('non-existent-id')
      ).rejects.toThrow('Export not found');
    });
  });

  describe('Export Generation', () => {
    it('should handle minimal export options', async () => {
      const minimalOptions: ArchivalExportOptions = {
        includeAudio: false,
        includePhotos: false,
        includeTranscripts: true,
        includeInteractions: false,
        includeChapterSummaries: false,
        includeMetadata: false,
        format: 'json',
      };

      const exportId = await exportService.createArchivalExport(
        testProjectId,
        testUserId,
        minimalOptions
      );

      expect(exportId).toBeDefined();
    });

    it('should handle maximal export options', async () => {
      const maximalOptions: ArchivalExportOptions = {
        includeAudio: true,
        includePhotos: true,
        includeTranscripts: true,
        includeInteractions: true,
        includeChapterSummaries: true,
        includeMetadata: true,
        format: 'zip',
        dateRange: {
          startDate: new Date('2020-01-01'),
          endDate: new Date('2024-12-31'),
        },
        chapters: ['chapter-1', 'chapter-2', 'chapter-3'],
      };

      const exportId = await exportService.createArchivalExport(
        testProjectId,
        testUserId,
        maximalOptions
      );

      expect(exportId).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid project ID', async () => {
      const options: ArchivalExportOptions = {
        includeAudio: true,
        includePhotos: true,
        includeTranscripts: true,
        includeInteractions: true,
        includeChapterSummaries: true,
        includeMetadata: true,
        format: 'zip',
      };

      await expect(
        exportService.createArchivalExport('invalid-project-id', testUserId, options)
      ).rejects.toThrow('Project not found');
    });

    it('should handle unauthorized user', async () => {
      const options: ArchivalExportOptions = {
        includeAudio: true,
        includePhotos: true,
        includeTranscripts: true,
        includeInteractions: true,
        includeChapterSummaries: true,
        includeMetadata: true,
        format: 'zip',
      };

      await expect(
        exportService.createArchivalExport(testProjectId, 'unauthorized-user', options)
      ).rejects.toThrow('Access denied');
    });
  });
});