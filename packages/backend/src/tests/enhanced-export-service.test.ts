import { ArchivalExportService, ArchivalExportOptions } from '../services/archival-export-service';
import { Project } from '../models/project';
import { Story } from '../models/story';
import { Interaction } from '../models/interaction';
import { ChapterSummary } from '../models/chapter-summary';
import { ExportRequestModel } from '../models/export-request';
import { ProjectRole } from '../models/project-role';
import { StorageService } from '../services/storage-service';
import { AnalyticsService } from '../services/analytics-service';

// Mock dependencies
jest.mock('../models/project');
jest.mock('../models/story');
jest.mock('../models/interaction');
jest.mock('../models/chapter-summary');
jest.mock('../models/export-request');
jest.mock('../models/project-role');
jest.mock('../services/storage-service');
jest.mock('../services/analytics-service');

describe('Enhanced ArchivalExportService', () => {
  let exportService: ArchivalExportService;
  
  const mockProject = {
    id: 'project-123',
    name: 'Family Stories',
    description: 'Our family memories',
    status: 'active',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-06-01'),
    facilitators: [{
      user: {
        id: 'user-123',
        name: 'John Doe',
        email: 'john@example.com'
      },
      role: 'facilitator',
      createdAt: new Date('2024-01-01')
    }],
    storyteller: {
      user: {
        id: 'user-456',
        name: 'Jane Doe',
        email: 'jane@example.com'
      },
      createdAt: new Date('2024-01-01')
    }
  };

  const mockStories = [
    {
      id: 'story-1',
      title: 'Childhood Memory',
      transcript: 'This is a story about my childhood...',
      audioUrl: 'https://example.com/audio1.mp3',
      photoUrl: 'https://example.com/photo1.jpg',
      createdAt: new Date('2024-02-01'),
      updatedAt: new Date('2024-02-01'),
      duration: 120,
      recordingDevice: 'iPhone',
      location: 'Home',
      chapter: {
        id: 'chapter-1',
        name: 'Early Life'
      }
    },
    {
      id: 'story-2',
      title: 'School Days',
      transcript: 'I remember my first day at school...',
      audioUrl: 'https://example.com/audio2.mp3',
      createdAt: new Date('2024-03-01'),
      updatedAt: new Date('2024-03-01'),
      duration: 180,
      recordingDevice: 'Android',
      chapter: {
        id: 'chapter-2',
        name: 'Education'
      }
    }
  ];

  const mockInteractions = [
    {
      id: 'interaction-1',
      storyId: 'story-1',
      facilitator: {
        id: 'user-123',
        name: 'John Doe'
      },
      type: 'comment',
      content: 'What a wonderful memory!',
      createdAt: new Date('2024-02-02')
    }
  ];

  const mockChapterSummaries = [
    {
      id: 'summary-1',
      chapterId: 'chapter-1',
      chapter: {
        id: 'chapter-1',
        name: 'Early Life'
      },
      summary: 'This chapter covers early childhood memories...',
      storyCount: 1,
      createdAt: new Date('2024-02-15')
    }
  ];

  const mockExportRequest = {
    id: 'export-123',
    projectId: 'project-123',
    facilitatorId: 'user-123',
    status: 'queued',
    createdAt: new Date()
  };

  beforeEach(() => {
    exportService = new ArchivalExportService();
    jest.clearAllMocks();
  });

  describe('Export Creation', () => {
    beforeEach(() => {
      (Project.query as jest.Mock).mockReturnValue({
        findById: jest.fn().mockReturnValue({
          withGraphFetched: jest.fn().mockResolvedValue(mockProject)
        })
      });

      (ProjectRole.query as jest.Mock).mockReturnValue({
        where: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue({ id: 'role-123' })
      });

      (ExportRequestModel.createExportRequest as jest.Mock).mockResolvedValue(mockExportRequest);
      (ExportRequestModel.query as jest.Mock).mockReturnValue({
        where: jest.fn().mockReturnThis(),
        whereIn: jest.fn().mockReturnThis(),
        mockResolvedValue: []
      });
    });

    it('creates export with default options', async () => {
      const options: ArchivalExportOptions = {
        includeAudio: true,
        includePhotos: true,
        includeTranscripts: true,
        includeInteractions: true,
        includeChapterSummaries: true,
        includeMetadata: true,
        format: 'zip'
      };

      const exportId = await exportService.createArchivalExport('project-123', 'user-123', options);

      expect(exportId).toBe('export-123');
      expect(ExportRequestModel.createExportRequest).toHaveBeenCalledWith({
        projectId: 'project-123',
        facilitatorId: 'user-123'
      });
      expect(AnalyticsService.trackExportRequest).toHaveBeenCalled();
    });

    it('creates custom export with name and date range', async () => {
      const options: ArchivalExportOptions = {
        includeAudio: true,
        includePhotos: false,
        includeTranscripts: true,
        includeInteractions: false,
        includeChapterSummaries: true,
        includeMetadata: true,
        format: 'json',
        customName: 'My Family Stories',
        dateRange: {
          startDate: new Date('2024-01-01'),
          endDate: new Date('2024-06-01')
        },
        notifyOnComplete: true
      };

      const exportId = await exportService.createCustomExport('project-123', 'user-123', {
        name: 'My Family Stories',
        includeAudio: true,
        includePhotos: false,
        includeTranscripts: true,
        includeInteractions: false,
        includeChapterSummaries: true,
        format: 'json',
        dateRange: {
          startDate: '2024-01-01',
          endDate: '2024-06-01'
        },
        notifyOnComplete: true
      });

      expect(exportId).toBe('export-123');
    });

    it('validates export options', async () => {
      const invalidOptions: ArchivalExportOptions = {
        includeAudio: false,
        includePhotos: false,
        includeTranscripts: false,
        includeInteractions: false,
        includeChapterSummaries: false,
        includeMetadata: false,
        format: 'zip'
      };

      await expect(
        exportService.createArchivalExport('project-123', 'user-123', invalidOptions)
      ).rejects.toThrow('At least one content type must be included');
    });

    it('validates custom name format', async () => {
      const options: ArchivalExportOptions = {
        includeAudio: true,
        includePhotos: true,
        includeTranscripts: true,
        includeInteractions: true,
        includeChapterSummaries: true,
        includeMetadata: true,
        format: 'zip',
        customName: 'Invalid/Name<>:"|?*'
      };

      await expect(
        exportService.createArchivalExport('project-123', 'user-123', options)
      ).rejects.toThrow('Custom name can only contain letters, numbers, spaces, hyphens, and underscores');
    });

    it('validates date range', async () => {
      const options: ArchivalExportOptions = {
        includeAudio: true,
        includePhotos: true,
        includeTranscripts: true,
        includeInteractions: true,
        includeChapterSummaries: true,
        includeMetadata: true,
        format: 'zip',
        dateRange: {
          startDate: new Date('2024-06-01'),
          endDate: new Date('2024-01-01') // End before start
        }
      };

      await expect(
        exportService.createArchivalExport('project-123', 'user-123', options)
      ).rejects.toThrow('Start date must be before end date');
    });

    it('prevents concurrent exports', async () => {
      (ExportRequestModel.query as jest.Mock).mockReturnValue({
        where: jest.fn().mockReturnThis(),
        whereIn: jest.fn().mockReturnThis(),
        mockResolvedValue: [{ id: 'existing-export' }]
      });

      const options: ArchivalExportOptions = {
        includeAudio: true,
        includePhotos: true,
        includeTranscripts: true,
        includeInteractions: true,
        includeChapterSummaries: true,
        includeMetadata: true,
        format: 'zip'
      };

      await expect(
        exportService.createArchivalExport('project-123', 'user-123', options)
      ).rejects.toThrow('An export is already in progress');
    });

    it('handles project not found', async () => {
      (Project.query as jest.Mock).mockReturnValue({
        findById: jest.fn().mockReturnValue({
          withGraphFetched: jest.fn().mockResolvedValue(null)
        })
      });

      const options: ArchivalExportOptions = {
        includeAudio: true,
        includePhotos: true,
        includeTranscripts: true,
        includeInteractions: true,
        includeChapterSummaries: true,
        includeMetadata: true,
        format: 'zip'
      };

      await expect(
        exportService.createArchivalExport('nonexistent-project', 'user-123', options)
      ).rejects.toThrow('Project not found');
    });

    it('handles access denied', async () => {
      (ProjectRole.query as jest.Mock).mockReturnValue({
        where: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue(null)
      });

      const options: ArchivalExportOptions = {
        includeAudio: true,
        includePhotos: true,
        includeTranscripts: true,
        includeInteractions: true,
        includeChapterSummaries: true,
        includeMetadata: true,
        format: 'zip'
      };

      await expect(
        exportService.createArchivalExport('project-123', 'unauthorized-user', options)
      ).rejects.toThrow('Access denied');
    });
  });

  describe('Export Status and Progress', () => {
    beforeEach(() => {
      (ExportRequestModel.findById as jest.Mock).mockResolvedValue({
        id: 'export-123',
        status: 'processing',
        downloadUrl: null,
        expiresAt: null,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01')
      });
    });

    it('gets export status', async () => {
      const status = await exportService.getExportStatus('export-123');

      expect(status).toEqual({
        id: 'export-123',
        status: 'processing',
        downloadUrl: null,
        expiresAt: null,
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
        progress: {
          progress: 0,
          currentStep: 'Queued'
        }
      });
    });

    it('handles export not found', async () => {
      (ExportRequestModel.findById as jest.Mock).mockResolvedValue(null);

      await expect(
        exportService.getExportStatus('nonexistent-export')
      ).rejects.toThrow('Export not found');
    });

    it('gets completed export status', async () => {
      (ExportRequestModel.findById as jest.Mock).mockResolvedValue({
        id: 'export-123',
        status: 'ready',
        downloadUrl: 'https://example.com/download',
        expiresAt: new Date('2024-02-01'),
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01')
      });

      const status = await exportService.getExportStatus('export-123');

      expect(status.status).toBe('ready');
      expect(status.downloadUrl).toBe('https://example.com/download');
      expect(status.progress.progress).toBe(100);
      expect(status.progress.currentStep).toBe('Completed');
    });
  });

  describe('Export Analytics', () => {
    beforeEach(() => {
      const mockExports = [
        {
          id: 'export-1',
          format: 'zip',
          size: 1024000,
          includeAudio: true,
          includePhotos: true,
          createdAt: new Date('2024-01-15')
        },
        {
          id: 'export-2',
          format: 'json',
          size: 512000,
          includeAudio: false,
          includePhotos: true,
          createdAt: new Date('2024-02-15')
        },
        {
          id: 'export-3',
          format: 'zip',
          size: 2048000,
          includeAudio: true,
          includePhotos: false,
          createdAt: new Date('2024-01-20')
        }
      ];

      (ExportRequestModel.findByProject as jest.Mock).mockResolvedValue(mockExports);
    });

    it('calculates export analytics', async () => {
      const analytics = await exportService.getExportAnalytics('project-123');

      expect(analytics).toEqual({
        totalExports: 3,
        exportsByFormat: {
          zip: 2,
          json: 1
        },
        exportsByMonth: [
          { month: '2024-01', count: 2 },
          { month: '2024-02', count: 1 }
        ],
        averageSize: 1194667, // Average of the three sizes
        mostPopularOptions: {
          includeAudio: 67, // 2 out of 3
          includePhotos: 67, // 2 out of 3
          includeTranscripts: 100, // Default assumption
          includeInteractions: 100 // Default assumption
        }
      });
    });

    it('handles empty analytics', async () => {
      (ExportRequestModel.findByProject as jest.Mock).mockResolvedValue([]);

      const analytics = await exportService.getExportAnalytics('project-123');

      expect(analytics.totalExports).toBe(0);
      expect(analytics.averageSize).toBe(0);
      expect(analytics.exportsByMonth).toEqual([]);
    });
  });

  describe('Export Management', () => {
    it('gets project exports', async () => {
      const mockExports = [
        {
          id: 'export-1',
          status: 'ready',
          downloadUrl: 'https://example.com/export1',
          expiresAt: new Date('2024-02-01'),
          createdAt: new Date('2024-01-01')
        },
        {
          id: 'export-2',
          status: 'processing',
          downloadUrl: null,
          expiresAt: null,
          createdAt: new Date('2024-01-15')
        }
      ];

      (ExportRequestModel.findByProject as jest.Mock).mockResolvedValue(mockExports);

      const exports = await exportService.getProjectExports('project-123');

      expect(exports).toHaveLength(2);
      expect(exports[0]).toEqual({
        id: 'export-1',
        status: 'ready',
        downloadUrl: 'https://example.com/export1',
        expiresAt: expect.any(Date),
        createdAt: expect.any(Date)
      });
    });

    it('deletes export', async () => {
      const mockExport = {
        id: 'export-123',
        downloadUrl: 'https://example.com/export123'
      };

      (ExportRequestModel.findById as jest.Mock).mockResolvedValue(mockExport);
      (StorageService.deleteFile as jest.Mock).mockResolvedValue(undefined);
      (ExportRequestModel.deleteById as jest.Mock).mockResolvedValue(undefined);

      await exportService.deleteExport('export-123');

      expect(StorageService.deleteFile).toHaveBeenCalledWith('https://example.com/export123');
      expect(ExportRequestModel.deleteById).toHaveBeenCalledWith('export-123');
    });

    it('handles delete export not found', async () => {
      (ExportRequestModel.findById as jest.Mock).mockResolvedValue(null);

      await expect(
        exportService.deleteExport('nonexistent-export')
      ).rejects.toThrow('Export not found');
    });
  });

  describe('File Name Sanitization', () => {
    it('sanitizes file names correctly', () => {
      // Access private method through any cast for testing
      const service = exportService as any;
      
      expect(service.sanitizeFileName('My Story')).toBe('My_Story');
      expect(service.sanitizeFileName('Story<>:"/\\|?*')).toBe('Story');
      expect(service.sanitizeFileName('Story   with   spaces')).toBe('Story_with_spaces');
      expect(service.sanitizeFileName('___Story___')).toBe('Story');
      expect(service.sanitizeFileName('')).toBe('unnamed');
      
      const longName = 'A'.repeat(150);
      expect(service.sanitizeFileName(longName)).toHaveLength(100);
    });
  });

  describe('Export Validation', () => {
    it('validates ZIP export format', async () => {
      const service = exportService as any;
      const mockZipBuffer = Buffer.from('mock zip content');
      
      // Mock JSZip
      const mockZip = {
        loadAsync: jest.fn().mockResolvedValue(undefined),
        file: jest.fn().mockImplementation((filename) => {
          if (filename === 'manifest.json') {
            return {
              async: jest.fn().mockResolvedValue(JSON.stringify({
                projectInfo: {},
                exportInfo: {},
                structure: {}
              }))
            };
          }
          return filename === 'README.txt' ? {} : null;
        })
      };

      // Mock JSZip constructor
      jest.doMock('jszip', () => {
        return jest.fn().mockImplementation(() => mockZip);
      });

      const options: ArchivalExportOptions = {
        includeAudio: true,
        includePhotos: true,
        includeTranscripts: true,
        includeInteractions: true,
        includeChapterSummaries: true,
        includeMetadata: true,
        format: 'zip'
      };

      const isValid = await service.validateExportFile(mockZipBuffer, options);
      expect(isValid).toBe(true);
    });

    it('validates JSON export format', async () => {
      const service = exportService as any;
      const mockJsonData = {
        manifest: {},
        project: {},
        stories: []
      };
      const mockJsonBuffer = Buffer.from(JSON.stringify(mockJsonData));

      const options: ArchivalExportOptions = {
        includeAudio: true,
        includePhotos: true,
        includeTranscripts: true,
        includeInteractions: true,
        includeChapterSummaries: true,
        includeMetadata: true,
        format: 'json'
      };

      const isValid = await service.validateExportFile(mockJsonBuffer, options);
      expect(isValid).toBe(true);
    });

    it('handles invalid export format', async () => {
      const service = exportService as any;
      const mockInvalidBuffer = Buffer.from('invalid content');

      const options: ArchivalExportOptions = {
        includeAudio: true,
        includePhotos: true,
        includeTranscripts: true,
        includeInteractions: true,
        includeChapterSummaries: true,
        includeMetadata: true,
        format: 'json'
      };

      const isValid = await service.validateExportFile(mockInvalidBuffer, options);
      expect(isValid).toBe(false);
    });
  });
});