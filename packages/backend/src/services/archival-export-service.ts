import { BaseService } from './base-service';
import { Project } from '../models/project';
import { Story } from '../models/story';
import { Interaction } from '../models/interaction';
import { ChapterSummary } from '../models/chapter-summary';
import { ExportRequestModel } from '../models/export-request';
import { ProjectRole } from '../models/project-role';
import { User } from '../models/user';
import { StorageService } from './storage-service';
import { LoggingService } from './logging-service';
import { AnalyticsService } from './analytics-service';
import { ArchivalService } from './archival-service';
import JSZip from 'jszip';
import path from 'path';

export interface ArchivalExportOptions {
  includeAudio: boolean;
  includePhotos: boolean;
  includeTranscripts: boolean;
  includeInteractions: boolean;
  includeChapterSummaries: boolean;
  includeMetadata: boolean;
  format: 'zip' | 'json';
  dateRange?: {
    startDate: Date;
    endDate: Date;
  };
  chapters?: string[]; // Specific chapter IDs to include
  notifyOnComplete?: boolean;
  customName?: string;
  includeAnalytics?: boolean;
}

export interface ExportProgress {
  exportId: string;
  status: 'queued' | 'processing' | 'ready' | 'failed' | 'expired';
  progress: number; // 0-100
  currentStep: string;
  totalSteps: number;
  currentStepIndex: number;
  estimatedTimeRemaining?: number; // in seconds
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
}

export interface ExportManifest {
  projectInfo: {
    id: string;
    name: string;
    description: string;
    status: string;
    createdAt: Date;
    archivedAt?: Date;
    facilitators: Array<{
      id: string;
      name: string;
      email: string;
      role: string;
    }>;
    storyteller?: {
      id: string;
      name: string;
      email: string;
    };
  };
  exportInfo: {
    exportedAt: Date;
    exportedBy: string;
    options: ArchivalExportOptions;
    totalStories: number;
    totalInteractions: number;
    totalChapters: number;
    totalFiles: number;
    totalSize: number;
  };
  structure: {
    folders: string[];
    files: Array<{
      path: string;
      type: string;
      size: number;
      description: string;
    }>;
  };
}

/**
 * Enhanced export service specifically for archived projects
 */
export class ArchivalExportService extends BaseService {
  private loggingService: LoggingService;
  private storageService: StorageService;
  private archivalService: ArchivalService;

  constructor() {
    super();
    this.loggingService = LoggingService; // LoggingService is already an instance
    this.storageService = new StorageService();
    this.archivalService = new ArchivalService();
  }

  /**
   * Create an enhanced export for an archived project
   */
  async createArchivalExport(
    projectId: string,
    facilitatorId: string,
    options: ArchivalExportOptions
  ): Promise<string> {
    try {
      // Validate export options
      this.validateExportOptions(options);

      // Verify project exists and user has access
      const project = await Project.query()
        .findById(projectId)
        .withGraphFetched('[facilitators.user, storyteller.user]');

      if (!project) {
        throw new Error('Project not found');
      }

      // Check if user has access to this project
      const userRole = await ProjectRole.query()
        .where('projectId', projectId)
        .where('userId', facilitatorId)
        .first();

      if (!userRole) {
        throw new Error('Access denied');
      }

      // Check for existing pending exports
      const existingExports = await ExportRequestModel.query()
        .where('projectId', projectId)
        .where('facilitatorId', facilitatorId)
        .whereIn('status', ['queued', 'processing'])
        .where('createdAt', '>', new Date(Date.now() - 60 * 60 * 1000)); // Last hour

      if (existingExports.length > 0) {
        throw new Error('An export is already in progress. Please wait for it to complete.');
      }

      // Validate date range if provided
      if (options.dateRange) {
        if (options.dateRange.startDate >= options.dateRange.endDate) {
          throw new Error('Start date must be before end date');
        }
        
        const maxRangeMonths = 24; // 2 years max
        const monthsDiff = (options.dateRange.endDate.getTime() - options.dateRange.startDate.getTime()) / (1000 * 60 * 60 * 24 * 30);
        if (monthsDiff > maxRangeMonths) {
          throw new Error(`Date range cannot exceed ${maxRangeMonths} months`);
        }
      }

      // Create export request
      const exportRequest = await ExportRequestModel.createExportRequest({
        projectId,
        facilitatorId,
      });

      // Start background export process
      this.processArchivalExport(exportRequest.id, options).catch(error => {
        this.loggingService.error('Error in background export process', {
          exportId: exportRequest.id,
          error: error as Error,
        });
      });

      // Track analytics
      AnalyticsService.trackExportRequest(facilitatorId, projectId, options.format, {
        isArchival: true,
        includeAudio: options.includeAudio,
        includePhotos: options.includePhotos,
        customOptions: {
          hasDateRange: !!options.dateRange,
          hasChapterFilter: !!(options.chapters && options.chapters.length > 0),
          customName: !!options.customName,
        },
      });

      return exportRequest.id;
    } catch (error) {
      this.loggingService.error('Error creating archival export', {
        projectId,
        facilitatorId,
        error: error as Error,
      });
      throw error;
    }
  }

  /**
   * Validate export options
   */
  private validateExportOptions(options: ArchivalExportOptions): void {
    // Validate format
    if (!['zip', 'json'].includes(options.format)) {
      throw new Error('Invalid export format. Must be "zip" or "json"');
    }

    // Validate that at least one content type is included
    const hasContent = options.includeAudio || 
                      options.includePhotos || 
                      options.includeTranscripts || 
                      options.includeInteractions || 
                      options.includeChapterSummaries;
    
    if (!hasContent) {
      throw new Error('At least one content type must be included in the export');
    }

    // Validate custom name if provided
    if (options.customName) {
      if (options.customName.length > 100) {
        throw new Error('Custom name cannot exceed 100 characters');
      }
      
      if (!/^[a-zA-Z0-9\s\-_]+$/.test(options.customName)) {
        throw new Error('Custom name can only contain letters, numbers, spaces, hyphens, and underscores');
      }
    }

    // Validate chapters if provided
    if (options.chapters && options.chapters.length > 50) {
      throw new Error('Cannot select more than 50 chapters at once');
    }
  }

  /**
   * Validate export file integrity
   */
  async validateExportFile(exportBuffer: Buffer, options: ArchivalExportOptions): Promise<boolean> {
    try {
      if (options.format === 'zip') {
        // Validate ZIP file
        const zip = new JSZip();
        await zip.loadAsync(exportBuffer);
        
        // Check for required files
        const requiredFiles = ['manifest.json', 'README.txt'];
        for (const file of requiredFiles) {
          if (!zip.file(file)) {
            throw new Error(`Missing required file: ${file}`);
          }
        }
        
        // Validate manifest structure
        const manifestFile = zip.file('manifest.json');
        if (manifestFile) {
          const manifestContent = await manifestFile.async('string');
          const manifest = JSON.parse(manifestContent);
          
          if (!manifest.projectInfo || !manifest.exportInfo || !manifest.structure) {
            throw new Error('Invalid manifest structure');
          }
        }
        
        return true;
      } else if (options.format === 'json') {
        // Validate JSON structure
        const jsonContent = exportBuffer.toString('utf-8');
        const exportData = JSON.parse(jsonContent);
        
        if (!exportData.manifest || !exportData.project || !exportData.stories) {
          throw new Error('Invalid JSON export structure');
        }
        
        return true;
      }
      
      return false;
    } catch (error) {
      this.loggingService.error('Export file validation failed', {
        error: error as Error,
        format: options.format,
        size: exportBuffer.length,
      });
      return false;
    }
  }

  /**
   * Process the archival export in the background with progress tracking
   */
  private async processArchivalExport(
    exportId: string,
    options: ArchivalExportOptions
  ): Promise<void> {
    const startTime = Date.now();
    
    try {
      // Update status to processing with initial progress
      await this.updateExportProgress(exportId, {
        status: 'processing',
        progress: 0,
        currentStep: 'Initializing export',
        totalSteps: 7,
        currentStepIndex: 0,
        startedAt: new Date(),
      });

      const exportRequest = await ExportRequestModel.findById(exportId);
      if (!exportRequest) {
        throw new Error('Export request not found');
      }

      // Step 1: Validate project and permissions
      await this.updateExportProgress(exportId, {
        progress: 10,
        currentStep: 'Validating project access',
        currentStepIndex: 1,
      });

      const project = await Project.query()
        .findById(exportRequest.projectId)
        .withGraphFetched('[facilitators.user, storyteller.user]');

      if (!project) {
        throw new Error('Project not found');
      }

      // Step 2: Collect data
      await this.updateExportProgress(exportId, {
        progress: 25,
        currentStep: 'Collecting stories and data',
        currentStepIndex: 2,
      });

      const stories = await this.getProjectStories(exportRequest.projectId, options);
      const interactions = options.includeInteractions 
        ? await this.getProjectInteractions(exportRequest.projectId, options)
        : [];
      const chapterSummaries = options.includeChapterSummaries
        ? await this.getProjectChapterSummaries(exportRequest.projectId, options)
        : [];

      // Step 3: Download media files
      await this.updateExportProgress(exportId, {
        progress: 40,
        currentStep: 'Downloading media files',
        currentStepIndex: 3,
      });

      // Step 4: Generate export
      await this.updateExportProgress(exportId, {
        progress: 60,
        currentStep: 'Generating export archive',
        currentStepIndex: 4,
      });

      const exportBuffer = await this.generateArchivalExportWithProgress(
        project,
        stories,
        interactions,
        chapterSummaries,
        options,
        (progress) => this.updateExportProgress(exportId, { progress: 60 + (progress * 0.2) })
      );

      // Step 5: Upload to storage
      await this.updateExportProgress(exportId, {
        progress: 85,
        currentStep: 'Uploading to secure storage',
        currentStepIndex: 5,
      });

      const fileName = options.customName 
        ? `${this.sanitizeFileName(options.customName)}-${exportId}`
        : `archival-export-${exportId}`;

      const uploadResult = await StorageService.uploadExportFile(
        exportBuffer,
        exportRequest.projectId,
        fileName,
        options.format === 'zip' ? 'application/zip' : 'application/json'
      );

      // Step 6: Finalize
      await this.updateExportProgress(exportId, {
        progress: 95,
        currentStep: 'Finalizing export',
        currentStepIndex: 6,
      });

      // Set expiry date (30 days for archival exports)
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30);

      // Step 7: Complete
      await this.updateExportProgress(exportId, {
        status: 'ready',
        progress: 100,
        currentStep: 'Export completed',
        currentStepIndex: 7,
        completedAt: new Date(),
      });

      // Update export request with download URL
      await ExportRequestModel.updateExportRequest(exportId, {
        status: 'ready',
        downloadUrl: uploadResult.url,
        expiresAt,
      });

      // Send notification if requested
      if (options.notifyOnComplete) {
        await this.sendExportCompleteNotification(exportRequest.facilitatorId, exportId, project.name);
      }

      // Track analytics
      const processingTime = Date.now() - startTime;
      AnalyticsService.trackExportCompleted(exportRequest.facilitatorId, exportRequest.projectId, {
        format: options.format,
        size: exportBuffer.length,
        processingTimeMs: processingTime,
        storiesCount: stories.length,
        interactionsCount: interactions.length,
        includeAudio: options.includeAudio,
        includePhotos: options.includePhotos,
      });

      this.loggingService.info('Archival export completed', {
        exportId,
        projectId: exportRequest.projectId,
        size: exportBuffer.length,
        processingTimeMs: processingTime,
      });

    } catch (error) {
      // Update status to failed
      await this.updateExportProgress(exportId, {
        status: 'failed',
        error: (error as Error).message,
      });

      await ExportRequestModel.updateExportRequest(exportId, {
        status: 'failed',
      });

      this.loggingService.error('Error processing archival export', {
        exportId,
        error: error as Error,
      });
      throw error;
    }
  }

  /**
   * Update export progress
   */
  private async updateExportProgress(
    exportId: string, 
    progress: Partial<ExportProgress>
  ): Promise<void> {
    // This would update a progress tracking table or cache
    // For now, we'll log the progress
    this.loggingService.info('Export progress update', {
      exportId,
      ...progress,
    });

    // In a real implementation, you might:
    // 1. Update a progress table in the database
    // 2. Send real-time updates via WebSocket
    // 3. Cache progress in Redis for quick access
  }

  /**
   * Generate export with progress callbacks
   */
  private async generateArchivalExportWithProgress(
    project: any,
    stories: any[],
    interactions: any[],
    chapterSummaries: any[],
    options: ArchivalExportOptions,
    onProgress: (progress: number) => Promise<void>
  ): Promise<Buffer> {
    await onProgress(0);

    if (options.format === 'zip') {
      return await this.generateZipExportWithProgress(
        project, 
        stories, 
        interactions, 
        chapterSummaries, 
        options,
        onProgress
      );
    } else {
      const result = await this.generateJsonExport(project, stories, interactions, chapterSummaries, options);
      await onProgress(100);
      return result;
    }
  }

  /**
   * Generate ZIP export with progress tracking
   */
  private async generateZipExportWithProgress(
    project: any,
    stories: any[],
    interactions: any[],
    chapterSummaries: any[],
    options: ArchivalExportOptions,
    onProgress: (progress: number) => Promise<void>
  ): Promise<Buffer> {
    // Use the existing generateZipExport method but add progress callbacks
    // This is a simplified version - in practice you'd add progress tracking throughout
    await onProgress(25);
    const result = await this.generateZipExport(project, stories, interactions, chapterSummaries, options);
    await onProgress(100);
    return result;
  }

  /**
   * Send export completion notification
   */
  private async sendExportCompleteNotification(
    facilitatorId: string,
    exportId: string,
    projectName: string
  ): Promise<void> {
    try {
      // This would integrate with the notification service
      this.loggingService.info('Export completion notification sent', {
        facilitatorId,
        exportId,
        projectName,
      });
    } catch (error) {
      this.loggingService.warn('Failed to send export completion notification', {
        facilitatorId,
        exportId,
        error: error as Error,
      });
    }
  }

  /**
   * Generate the actual export data
   */
  private async generateArchivalExport(
    projectId: string,
    options: ArchivalExportOptions
  ): Promise<Buffer> {
    const project = await Project.query()
      .findById(projectId)
      .withGraphFetched('[facilitators.user, storyteller.user]');

    if (!project) {
      throw new Error('Project not found');
    }

    // Get all project data
    const stories = await this.getProjectStories(projectId, options);
    const interactions = options.includeInteractions 
      ? await this.getProjectInteractions(projectId, options)
      : [];
    const chapterSummaries = options.includeChapterSummaries
      ? await this.getProjectChapterSummaries(projectId, options)
      : [];

    if (options.format === 'zip') {
      return await this.generateZipExport(project, stories, interactions, chapterSummaries, options);
    } else {
      return await this.generateJsonExport(project, stories, interactions, chapterSummaries, options);
    }
  }

  /**
   * Get project stories with filtering
   */
  private async getProjectStories(
    projectId: string,
    options: ArchivalExportOptions
  ): Promise<any[]> {
    let query = Story.query()
      .where('projectId', projectId)
      .withGraphFetched('[chapter]')
      .orderBy('createdAt', 'asc');

    // Apply date range filter
    if (options.dateRange) {
      query = query
        .where('createdAt', '>=', options.dateRange.startDate)
        .where('createdAt', '<=', options.dateRange.endDate);
    }

    // Apply chapter filter
    if (options.chapters && options.chapters.length > 0) {
      query = query.whereIn('chapterId', options.chapters);
    }

    return await query;
  }

  /**
   * Get project interactions with filtering
   */
  private async getProjectInteractions(
    projectId: string,
    options: ArchivalExportOptions
  ): Promise<any[]> {
    let query = Interaction.query()
      .joinRelated('story')
      .where('story.projectId', projectId)
      .withGraphFetched('[story, facilitator]')
      .orderBy('createdAt', 'asc');

    // Apply date range filter
    if (options.dateRange) {
      query = query
        .where('interactions.createdAt', '>=', options.dateRange.startDate)
        .where('interactions.createdAt', '<=', options.dateRange.endDate);
    }

    return await query;
  }

  /**
   * Get project chapter summaries with filtering
   */
  private async getProjectChapterSummaries(
    projectId: string,
    options: ArchivalExportOptions
  ): Promise<any[]> {
    let query = ChapterSummary.query()
      .where('projectId', projectId)
      .withGraphFetched('[chapter]')
      .orderBy('createdAt', 'asc');

    // Apply chapter filter
    if (options.chapters && options.chapters.length > 0) {
      query = query.whereIn('chapterId', options.chapters);
    }

    return await query;
  }

  /**
   * Generate ZIP export with organized folder structure
   */
  private async generateZipExport(
    project: any,
    stories: any[],
    interactions: any[],
    chapterSummaries: any[],
    options: ArchivalExportOptions
  ): Promise<Buffer> {
    const zip = new JSZip();
    let totalSize = 0;
    let totalFiles = 0;

    // Create enhanced folder structure organized by chapters and stories
    const storiesFolder = zip.folder('stories');
    const dataFolder = zip.folder('data');
    const metadataFolder = zip.folder('metadata');
    
    // Create chapter-based organization
    const chapterFolders = new Map<string, JSZip>();
    const chapterNames = new Set<string>();
    
    // Collect unique chapters
    stories.forEach(story => {
      if (story.chapter?.name) {
        chapterNames.add(story.chapter.name);
      }
    });
    
    // Create chapter folders
    chapterNames.forEach(chapterName => {
      const sanitizedName = this.sanitizeFileName(chapterName);
      const chapterFolder = storiesFolder?.folder(sanitizedName);
      if (chapterFolder) {
        chapterFolders.set(chapterName, chapterFolder);
      }
    });
    
    // Create uncategorized folder for stories without chapters
    const uncategorizedFolder = storiesFolder?.folder('uncategorized');

    // Add project metadata
    if (options.includeMetadata) {
      const manifest = await this.generateExportManifest(
        project,
        stories,
        interactions,
        chapterSummaries,
        options
      );
      
      zip.file('manifest.json', JSON.stringify(manifest, null, 2));
      zip.file('README.txt', this.generateReadmeText(project, manifest));
      
      // Add comprehensive metadata files
      const exportInfo = {
        exportId: this.generateId(),
        exportedAt: new Date().toISOString(),
        exportVersion: '2.0',
        options,
        statistics: {
          totalStories: stories.length,
          totalInteractions: interactions.length,
          totalChapterSummaries: chapterSummaries.length,
          totalFiles: totalFiles,
          estimatedSize: totalSize,
          chaptersIncluded: Array.from(chapterNames),
          dateRange: options.dateRange ? {
            startDate: options.dateRange.startDate.toISOString(),
            endDate: options.dateRange.endDate.toISOString(),
          } : null,
        },
        compatibility: {
          minimumViewerVersion: '1.0',
          recommendedViewerVersion: '2.0',
          dataFormat: 'saga-export-v2',
        },
      };
      
      const projectInfo = {
        id: project.id,
        name: project.name,
        description: project.description,
        status: project.status,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
        facilitators: project.facilitators?.map((f: any) => ({
          id: f.user?.id,
          name: f.user?.name,
          email: f.user?.email,
          role: f.role,
          joinedAt: f.createdAt,
        })) || [],
        storyteller: project.storyteller?.user ? {
          id: project.storyteller.user.id,
          name: project.storyteller.user.name,
          email: project.storyteller.user.email,
          joinedAt: project.storyteller.createdAt,
        } : null,
        settings: {
          privacy: 'family-only',
          archivalMode: project.status === 'archived',
          exportPermissions: 'facilitators-only',
        },
      };
      
      metadataFolder?.file('export-info.json', JSON.stringify(exportInfo, null, 2));
      metadataFolder?.file('project-info.json', JSON.stringify(projectInfo, null, 2));
      
      totalFiles += 4; // manifest, README, export-info, project-info
    }

    // Add stories data with per-story folder organization
    const storiesData = [];
    for (const story of stories) {
      const storyTitle = this.sanitizeFileName(story.title || `Story ${story.id}`);
      const chapterName = story.chapter?.name;
      
      // Determine which folder to use
      const parentFolder = chapterName && chapterFolders.has(chapterName) 
        ? chapterFolders.get(chapterName)
        : uncategorizedFolder;
      
      // Create individual story folder
      const storyFolder = parentFolder?.folder(storyTitle);
      
      const storyData: any = {
        id: story.id,
        title: story.title || `Story ${story.id}`,
        transcript: options.includeTranscripts ? story.transcript : null,
        createdAt: story.createdAt,
        chapterName: story.chapter?.name,
        folderPath: chapterName 
          ? `stories/${this.sanitizeFileName(chapterName)}/${storyTitle}`
          : `stories/uncategorized/${storyTitle}`,
        metadata: {
          duration: story.duration,
          recordingDevice: story.recordingDevice,
          location: story.location,
          fileSize: 0,
          audioFormat: story.audioUrl ? this.getFileExtension(story.audioUrl) : null,
          photoFormat: story.photoUrl ? this.getFileExtension(story.photoUrl) : null,
        },
      };

      // Download and add audio files to story folder
      if (options.includeAudio && story.audioUrl) {
        try {
          const audioBuffer = await this.downloadFile(story.audioUrl);
          const audioFileName = `audio.${this.getFileExtension(story.audioUrl)}`;
          storyFolder?.file(audioFileName, audioBuffer);
          storyData.audioFile = `${storyData.folderPath}/${audioFileName}`;
          storyData.metadata.fileSize += audioBuffer.length;
          totalSize += audioBuffer.length;
          totalFiles++;
        } catch (error) {
          this.loggingService.warn('Failed to download audio file', {
            storyId: story.id,
            audioUrl: story.audioUrl,
            error: error as Error,
          });
        }
      }

      // Download and add photo files to story folder
      if (options.includePhotos && story.photoUrl) {
        try {
          const photoBuffer = await this.downloadFile(story.photoUrl);
          const photoFileName = `photo.${this.getFileExtension(story.photoUrl)}`;
          storyFolder?.file(photoFileName, photoBuffer);
          storyData.photoFile = `${storyData.folderPath}/${photoFileName}`;
          storyData.metadata.fileSize += photoBuffer.length;
          totalSize += photoBuffer.length;
          totalFiles++;
        } catch (error) {
          this.loggingService.warn('Failed to download photo file', {
            storyId: story.id,
            photoUrl: story.photoUrl,
            error: error as Error,
          });
        }
      }

      // Add transcript to story folder
      if (options.includeTranscripts && story.transcript) {
        const transcriptFileName = 'transcript.txt';
        storyFolder?.file(transcriptFileName, story.transcript);
        storyData.transcriptFile = `${storyData.folderPath}/${transcriptFileName}`;
        totalFiles++;
      }

      // Add story metadata file
      const storyMetadata = {
        id: story.id,
        title: story.title,
        createdAt: story.createdAt,
        updatedAt: story.updatedAt,
        chapterName: story.chapter?.name,
        duration: story.duration,
        recordingDevice: story.recordingDevice,
        location: story.location,
        hasAudio: !!story.audioUrl,
        hasPhoto: !!story.photoUrl,
        transcriptLength: story.transcript?.length || 0,
        interactionCount: interactions.filter(i => i.storyId === story.id).length,
      };
      
      storyFolder?.file('metadata.json', JSON.stringify(storyMetadata, null, 2));
      storyData.metadataFile = `${storyData.folderPath}/metadata.json`;
      totalFiles++;

      storiesData.push(storyData);
    }

    // Add structured data files
    dataFolder?.file('stories.json', JSON.stringify(storiesData, null, 2));
    totalFiles++;

    if (options.includeInteractions && interactions.length > 0) {
      const interactionsData = interactions.map(interaction => ({
        id: interaction.id,
        storyId: interaction.storyId,
        facilitatorName: interaction.facilitator?.name,
        type: interaction.type,
        content: interaction.content,
        createdAt: interaction.createdAt,
      }));
      dataFolder?.file('interactions.json', JSON.stringify(interactionsData, null, 2));
      totalFiles++;
    }

    if (options.includeChapterSummaries && chapterSummaries.length > 0) {
      const summariesData = chapterSummaries.map(summary => ({
        id: summary.id,
        chapterName: summary.chapter?.name,
        summary: summary.summary,
        storyCount: summary.storyCount,
        createdAt: summary.createdAt,
      }));
      dataFolder?.file('chapter-summaries.json', JSON.stringify(summariesData, null, 2));
      totalFiles++;
    }

    // Generate the ZIP buffer
    const zipBuffer = await zip.generateAsync({
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    });

    this.loggingService.info('Generated ZIP export', {
      projectId: project.id,
      totalFiles,
      totalSize,
      zipSize: zipBuffer.length,
    });

    return zipBuffer;
  }

  /**
   * Generate JSON export with all data in structured format
   */
  private async generateJsonExport(
    project: any,
    stories: any[],
    interactions: any[],
    chapterSummaries: any[],
    options: ArchivalExportOptions
  ): Promise<Buffer> {
    const exportData = {
      manifest: await this.generateExportManifest(
        project,
        stories,
        interactions,
        chapterSummaries,
        options
      ),
      project: {
        id: project.id,
        name: project.name,
        description: project.description,
        status: project.status,
        createdAt: project.createdAt,
        facilitators: project.facilitators?.map((f: any) => ({
          id: f.user?.id,
          name: f.user?.name,
          email: f.user?.email,
          role: f.role,
        })) || [],
        storyteller: project.storyteller?.user ? {
          id: project.storyteller.user.id,
          name: project.storyteller.user.name,
          email: project.storyteller.user.email,
        } : null,
      },
      stories: stories.map(story => ({
        id: story.id,
        title: story.title,
        transcript: options.includeTranscripts ? story.transcript : null,
        audioUrl: options.includeAudio ? story.audioUrl : null,
        photoUrl: options.includePhotos ? story.photoUrl : null,
        createdAt: story.createdAt,
        chapterName: story.chapter?.name,
        metadata: {
          duration: story.duration,
          recordingDevice: story.recordingDevice,
          location: story.location,
        },
      })),
      interactions: options.includeInteractions ? interactions.map(interaction => ({
        id: interaction.id,
        storyId: interaction.storyId,
        facilitatorName: interaction.facilitator?.name,
        type: interaction.type,
        content: interaction.content,
        createdAt: interaction.createdAt,
      })) : [],
      chapterSummaries: options.includeChapterSummaries ? chapterSummaries.map(summary => ({
        id: summary.id,
        chapterName: summary.chapter?.name,
        summary: summary.summary,
        storyCount: summary.storyCount,
        createdAt: summary.createdAt,
      })) : [],
    };

    const jsonString = JSON.stringify(exportData, null, 2);
    return Buffer.from(jsonString, 'utf-8');
  }

  /**
   * Generate export manifest with metadata
   */
  private async generateExportManifest(
    project: any,
    stories: any[],
    interactions: any[],
    chapterSummaries: any[],
    options: ArchivalExportOptions
  ): Promise<ExportManifest> {
    const totalSize = await StorageService.getProjectStorageUsage(project.id);
    
    return {
      projectInfo: {
        id: project.id,
        name: project.name,
        description: project.description,
        status: project.status,
        createdAt: project.createdAt,
        archivedAt: project.status === 'archived' ? project.updatedAt : undefined,
        facilitators: project.facilitators?.map((f: any) => ({
          id: f.user?.id || '',
          name: f.user?.name || '',
          email: f.user?.email || '',
          role: f.role || '',
        })) || [],
        storyteller: project.storyteller?.user ? {
          id: project.storyteller.user.id,
          name: project.storyteller.user.name,
          email: project.storyteller.user.email,
        } : undefined,
      },
      exportInfo: {
        exportedAt: new Date(),
        exportedBy: 'system', // This would be the actual user ID
        options,
        totalStories: stories.length,
        totalInteractions: interactions.length,
        totalChapters: chapterSummaries.length,
        totalFiles: this.calculateTotalFiles(stories, options),
        totalSize,
      },
      structure: {
        folders: this.generateFolderStructure(options),
        files: this.generateFileList(stories, options),
      },
    };
  }

  /**
   * Generate README text for the export
   */
  private generateReadmeText(project: any, manifest: ExportManifest): string {
    return `
# ${project.name} - Family Story Archive

This archive contains the complete family story collection for the project "${project.name}".

## Project Information
- Project ID: ${project.id}
- Status: ${project.status}
- Created: ${new Date(project.createdAt).toLocaleDateString()}
- Exported: ${manifest.exportInfo.exportedAt.toLocaleDateString()}

## Archive Contents
- Total Stories: ${manifest.exportInfo.totalStories}
- Total Interactions: ${manifest.exportInfo.totalInteractions}
- Total Chapters: ${manifest.exportInfo.totalChapters}
- Total Files: ${manifest.exportInfo.totalFiles}

## Folder Structure
${manifest.structure.folders.map(folder => `- ${folder}/`).join('\n')}

## Files Included
${manifest.structure.files.map(file => `- ${file.path} (${file.type})`).join('\n')}

## How to Use This Archive
1. Extract all files to a folder on your computer
2. Open the 'data' folder to find structured JSON files with all story data
3. Audio files are in the 'audio' folder
4. Photos are in the 'photos' folder
5. Individual transcripts are in the 'transcripts' folder
6. The manifest.json file contains detailed metadata about this export

## Data Preservation
This archive is designed to preserve your family stories for future generations. 
All files are in standard formats that can be opened with common software.

Generated by Saga Family Biography Platform
© ${new Date().getFullYear()} Saga. All rights reserved.
    `.trim();
  }

  /**
   * Download a file from storage
   */
  private async downloadFile(url: string): Promise<Buffer> {
    // This would implement the actual file download logic
    // For now, we'll return a placeholder
    return Buffer.from('placeholder file content');
  }

  /**
   * Get file extension from URL
   */
  private getFileExtension(url: string): string {
    return path.extname(url).slice(1) || 'bin';
  }

  /**
   * Calculate total number of files that will be included
   */
  private calculateTotalFiles(stories: any[], options: ArchivalExportOptions): number {
    let count = 0;
    
    stories.forEach(story => {
      if (options.includeAudio && story.audioUrl) count++;
      if (options.includePhotos && story.photoUrl) count++;
      if (options.includeTranscripts && story.transcript) count++;
    });

    // Add data files
    count += 1; // stories.json
    if (options.includeInteractions) count++;
    if (options.includeChapterSummaries) count++;
    if (options.includeMetadata) count += 2; // manifest.json + README.txt

    return count;
  }

  /**
   * Generate folder structure list
   */
  private generateFolderStructure(options: ArchivalExportOptions): string[] {
    const folders = ['data'];
    
    if (options.includeAudio) folders.push('audio');
    if (options.includePhotos) folders.push('photos');
    if (options.includeTranscripts) folders.push('transcripts');

    return folders;
  }

  /**
   * Generate file list for manifest
   */
  private generateFileList(stories: any[], options: ArchivalExportOptions): Array<{
    path: string;
    type: string;
    size: number;
    description: string;
  }> {
    const files = [];

    if (options.includeMetadata) {
      files.push({
        path: 'manifest.json',
        type: 'JSON',
        size: 0, // Would be calculated
        description: 'Export metadata and structure information',
      });
      files.push({
        path: 'README.txt',
        type: 'Text',
        size: 0,
        description: 'Human-readable information about this archive',
      });
      files.push({
        path: 'metadata/export-info.json',
        type: 'JSON',
        size: 0,
        description: 'Detailed export configuration and statistics',
      });
      files.push({
        path: 'metadata/project-info.json',
        type: 'JSON',
        size: 0,
        description: 'Complete project information and settings',
      });
    }

    files.push({
      path: 'data/stories.json',
      type: 'JSON',
      size: 0,
      description: 'Structured data for all stories',
    });

    if (options.includeInteractions) {
      files.push({
        path: 'data/interactions.json',
        type: 'JSON',
        size: 0,
        description: 'All facilitator interactions and comments',
      });
    }

    if (options.includeChapterSummaries) {
      files.push({
        path: 'data/chapter-summaries.json',
        type: 'JSON',
        size: 0,
        description: 'AI-generated chapter summaries',
      });
    }

    // Add individual story files
    stories.forEach(story => {
      const storyTitle = this.sanitizeFileName(story.title || `Story ${story.id}`);
      const chapterName = story.chapter?.name;
      const basePath = chapterName 
        ? `stories/${this.sanitizeFileName(chapterName)}/${storyTitle}`
        : `stories/uncategorized/${storyTitle}`;

      files.push({
        path: `${basePath}/metadata.json`,
        type: 'JSON',
        size: 0,
        description: `Metadata for story: ${story.title || story.id}`,
      });

      if (options.includeTranscripts && story.transcript) {
        files.push({
          path: `${basePath}/transcript.txt`,
          type: 'Text',
          size: story.transcript.length,
          description: `Transcript for story: ${story.title || story.id}`,
        });
      }

      if (options.includeAudio && story.audioUrl) {
        files.push({
          path: `${basePath}/audio.${this.getFileExtension(story.audioUrl)}`,
          type: 'Audio',
          size: 0, // Would be calculated from actual file
          description: `Audio recording for story: ${story.title || story.id}`,
        });
      }

      if (options.includePhotos && story.photoUrl) {
        files.push({
          path: `${basePath}/photo.${this.getFileExtension(story.photoUrl)}`,
          type: 'Image',
          size: 0, // Would be calculated from actual file
          description: `Photo for story: ${story.title || story.id}`,
        });
      }
    });

    return files;
  }

  /**
   * Sanitize filename for safe file system usage
   */
  private sanitizeFileName(filename: string): string {
    return filename
      .replace(/[<>:"/\\|?*]/g, '') // Remove invalid characters
      .replace(/\s+/g, '_') // Replace spaces with underscores
      .replace(/_{2,}/g, '_') // Replace multiple underscores with single
      .replace(/^_|_$/g, '') // Remove leading/trailing underscores
      .substring(0, 100) // Limit length
      || 'unnamed'; // Fallback for empty names
  }

  /**
   * Get export status with progress information
   */
  async getExportStatus(exportId: string): Promise<any> {
    const exportRequest = await ExportRequestModel.findById(exportId);
    if (!exportRequest) {
      throw new Error('Export not found');
    }

    // Get progress information (this would come from cache/database in real implementation)
    const progress = await this.getExportProgress(exportId);

    return {
      id: exportRequest.id,
      status: exportRequest.status,
      downloadUrl: exportRequest.downloadUrl,
      expiresAt: exportRequest.expiresAt,
      createdAt: exportRequest.createdAt,
      updatedAt: exportRequest.updatedAt,
      progress: progress || {
        progress: exportRequest.status === 'ready' ? 100 : 0,
        currentStep: exportRequest.status === 'ready' ? 'Completed' : 'Queued',
      },
    };
  }

  /**
   * Get export progress information
   */
  private async getExportProgress(exportId: string): Promise<ExportProgress | null> {
    // In a real implementation, this would fetch from cache or database
    // For now, return null to indicate no detailed progress available
    return null;
  }

  /**
   * Create export with customization options
   */
  async createCustomExport(
    projectId: string,
    facilitatorId: string,
    customOptions: {
      name?: string;
      description?: string;
      includeAudio?: boolean;
      includePhotos?: boolean;
      includeTranscripts?: boolean;
      includeInteractions?: boolean;
      includeChapterSummaries?: boolean;
      includeMetadata?: boolean;
      format?: 'zip' | 'json';
      dateRange?: {
        startDate: string;
        endDate: string;
      };
      chapters?: string[];
      notifyOnComplete?: boolean;
      includeAnalytics?: boolean;
    }
  ): Promise<string> {
    const options: ArchivalExportOptions = {
      includeAudio: customOptions.includeAudio ?? true,
      includePhotos: customOptions.includePhotos ?? true,
      includeTranscripts: customOptions.includeTranscripts ?? true,
      includeInteractions: customOptions.includeInteractions ?? true,
      includeChapterSummaries: customOptions.includeChapterSummaries ?? true,
      includeMetadata: customOptions.includeMetadata ?? true,
      format: customOptions.format ?? 'zip',
      dateRange: customOptions.dateRange ? {
        startDate: new Date(customOptions.dateRange.startDate),
        endDate: new Date(customOptions.dateRange.endDate),
      } : undefined,
      chapters: customOptions.chapters,
      notifyOnComplete: customOptions.notifyOnComplete ?? true,
      customName: customOptions.name,
      includeAnalytics: customOptions.includeAnalytics ?? false,
    };

    return await this.createArchivalExport(projectId, facilitatorId, options);
  }

  /**
   * Get export analytics for a project
   */
  async getExportAnalytics(projectId: string): Promise<{
    totalExports: number;
    exportsByFormat: Record<string, number>;
    exportsByMonth: Array<{ month: string; count: number }>;
    averageSize: number;
    mostPopularOptions: {
      includeAudio: number;
      includePhotos: number;
      includeTranscripts: number;
      includeInteractions: number;
    };
  }> {
    try {
      const exports = await ExportRequestModel.findByProject(projectId);
      
      const analytics = {
        totalExports: exports.length,
        exportsByFormat: exports.reduce((acc, exp) => {
          const format = exp.format || 'zip';
          acc[format] = (acc[format] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
        exportsByMonth: this.calculateExportsByMonth(exports),
        averageSize: this.calculateAverageSize(exports),
        mostPopularOptions: this.calculatePopularOptions(exports),
      };

      return analytics;
    } catch (error) {
      this.loggingService.error('Error getting export analytics', {
        projectId,
        error: error as Error,
      });
      throw error;
    }
  }

  /**
   * Calculate exports by month
   */
  private calculateExportsByMonth(exports: any[]): Array<{ month: string; count: number }> {
    const monthCounts = exports.reduce((acc, exp) => {
      const month = new Date(exp.createdAt).toISOString().substring(0, 7); // YYYY-MM
      acc[month] = (acc[month] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(monthCounts)
      .map(([month, count]) => ({ month, count }))
      .sort((a, b) => a.month.localeCompare(b.month));
  }

  /**
   * Calculate average export size
   */
  private calculateAverageSize(exports: any[]): number {
    const sizesWithData = exports.filter(exp => exp.size && exp.size > 0);
    if (sizesWithData.length === 0) return 0;
    
    const totalSize = sizesWithData.reduce((sum, exp) => sum + exp.size, 0);
    return Math.round(totalSize / sizesWithData.length);
  }

  /**
   * Calculate most popular export options
   */
  private calculatePopularOptions(exports: any[]): {
    includeAudio: number;
    includePhotos: number;
    includeTranscripts: number;
    includeInteractions: number;
  } {
    const total = exports.length;
    if (total === 0) {
      return {
        includeAudio: 0,
        includePhotos: 0,
        includeTranscripts: 0,
        includeInteractions: 0,
      };
    }

    // This would be based on actual export options stored with each export
    // For now, return estimated percentages
    return {
      includeAudio: Math.round((exports.filter(exp => exp.includeAudio !== false).length / total) * 100),
      includePhotos: Math.round((exports.filter(exp => exp.includePhotos !== false).length / total) * 100),
      includeTranscripts: Math.round((exports.filter(exp => exp.includeTranscripts !== false).length / total) * 100),
      includeInteractions: Math.round((exports.filter(exp => exp.includeInteractions !== false).length / total) * 100),
    };
  }

  /**
   * Get all exports for a project
   */
  async getProjectExports(projectId: string): Promise<any[]> {
    const exports = await ExportRequestModel.findByProject(projectId);
    return exports.map(exp => ({
      id: exp.id,
      status: exp.status,
      downloadUrl: exp.downloadUrl,
      expiresAt: exp.expiresAt,
      createdAt: exp.createdAt,
    }));
  }

  /**
   * Delete an export
   */
  async deleteExport(exportId: string): Promise<void> {
    const exportRequest = await ExportRequestModel.findById(exportId);
    if (!exportRequest) {
      throw new Error('Export not found');
    }

    // Delete file from storage if it exists
    if (exportRequest.downloadUrl) {
      try {
        await StorageService.deleteFile(exportRequest.downloadUrl);
      } catch (error) {
        this.loggingService.warn('Failed to delete export file from storage', {
          exportId,
          downloadUrl: exportRequest.downloadUrl,
          error: error as Error,
        });
      }
    }

    // Delete export request from database
    await ExportRequestModel.deleteById(exportId);

    this.loggingService.info('Export deleted', { exportId });
  }

  /**
   * Share export with other facilitators
   */
  async shareExport(
    exportId: string,
    sharedBy: string,
    shareWith: string[],
    message?: string
  ): Promise<void> {
    try {
      const exportRequest = await ExportRequestModel.findById(exportId);
      if (!exportRequest) {
        throw new Error('Export not found');
      }

      // Verify the user has access to this export
      const userRole = await ProjectRole.query()
        .where('projectId', exportRequest.projectId)
        .where('userId', sharedBy)
        .first();

      if (!userRole) {
        throw new Error('Access denied');
      }

      // Verify all recipients have access to the project
      for (const userId of shareWith) {
        const recipientRole = await ProjectRole.query()
          .where('projectId', exportRequest.projectId)
          .where('userId', userId)
          .first();

        if (!recipientRole) {
          throw new Error(`User ${userId} does not have access to this project`);
        }
      }

      // Create share records (this would be a new table in a real implementation)
      const shareData = {
        exportId,
        sharedBy,
        shareWith,
        message,
        sharedAt: new Date(),
        expiresAt: exportRequest.expiresAt,
      };

      // Send notifications to recipients
      for (const userId of shareWith) {
        await this.sendExportShareNotification(
          userId,
          sharedBy,
          exportId,
          exportRequest.projectId,
          message
        );
      }

      // Track analytics
      AnalyticsService.trackExportShared(sharedBy, exportRequest.projectId, {
        exportId,
        recipientCount: shareWith.length,
        hasMessage: !!message,
      });

      this.loggingService.info('Export shared', {
        exportId,
        sharedBy,
        recipientCount: shareWith.length,
      });

    } catch (error) {
      this.loggingService.error('Error sharing export', {
        exportId,
        sharedBy,
        error: error as Error,
      });
      throw error;
    }
  }

  /**
   * Get shared exports for a user
   */
  async getSharedExports(userId: string): Promise<Array<{
    exportId: string;
    projectName: string;
    sharedBy: string;
    sharedByName: string;
    sharedAt: Date;
    message?: string;
    status: string;
    downloadUrl?: string;
    expiresAt?: Date;
  }>> {
    try {
      // This would query a shares table in a real implementation
      // For now, return empty array as placeholder
      return [];
    } catch (error) {
      this.loggingService.error('Error getting shared exports', {
        userId,
        error: error as Error,
      });
      throw error;
    }
  }

  /**
   * Create collaborative export (multiple facilitators can contribute)
   */
  async createCollaborativeExport(
    projectId: string,
    initiatedBy: string,
    collaborators: string[],
    options: ArchivalExportOptions & {
      collaborationMessage?: string;
      allowContributions?: boolean;
      contributionDeadline?: Date;
    }
  ): Promise<string> {
    try {
      // Validate all collaborators have access
      for (const userId of [initiatedBy, ...collaborators]) {
        const userRole = await ProjectRole.query()
          .where('projectId', projectId)
          .where('userId', userId)
          .first();

        if (!userRole) {
          throw new Error(`User ${userId} does not have access to this project`);
        }
      }

      // Create the export with collaboration metadata
      const exportId = await this.createArchivalExport(projectId, initiatedBy, {
        ...options,
        customName: options.customName || `Collaborative Export - ${new Date().toLocaleDateString()}`,
        notifyOnComplete: true,
      });

      // Create collaboration record (this would be a new table)
      const collaborationData = {
        exportId,
        initiatedBy,
        collaborators,
        message: options.collaborationMessage,
        allowContributions: options.allowContributions ?? true,
        contributionDeadline: options.contributionDeadline,
        createdAt: new Date(),
      };

      // Notify all collaborators
      for (const userId of collaborators) {
        await this.sendCollaborationInviteNotification(
          userId,
          initiatedBy,
          exportId,
          projectId,
          options.collaborationMessage
        );
      }

      // Track analytics
      AnalyticsService.trackCollaborativeExportCreated(initiatedBy, projectId, {
        exportId,
        collaboratorCount: collaborators.length,
        hasDeadline: !!options.contributionDeadline,
      });

      this.loggingService.info('Collaborative export created', {
        exportId,
        initiatedBy,
        collaboratorCount: collaborators.length,
      });

      return exportId;

    } catch (error) {
      this.loggingService.error('Error creating collaborative export', {
        projectId,
        initiatedBy,
        error: error as Error,
      });
      throw error;
    }
  }

  /**
   * Add contribution to collaborative export
   */
  async addExportContribution(
    exportId: string,
    contributorId: string,
    contribution: {
      type: 'story_selection' | 'chapter_selection' | 'comment' | 'metadata';
      data: any;
      message?: string;
    }
  ): Promise<void> {
    try {
      // Verify export exists and is collaborative
      const exportRequest = await ExportRequestModel.findById(exportId);
      if (!exportRequest) {
        throw new Error('Export not found');
      }

      // Verify contributor has access
      const userRole = await ProjectRole.query()
        .where('projectId', exportRequest.projectId)
        .where('userId', contributorId)
        .first();

      if (!userRole) {
        throw new Error('Access denied');
      }

      // Record the contribution (this would be a new table)
      const contributionData = {
        exportId,
        contributorId,
        type: contribution.type,
        data: contribution.data,
        message: contribution.message,
        createdAt: new Date(),
      };

      // Notify other collaborators
      await this.sendContributionNotification(
        exportId,
        contributorId,
        contribution.type,
        contribution.message
      );

      this.loggingService.info('Export contribution added', {
        exportId,
        contributorId,
        type: contribution.type,
      });

    } catch (error) {
      this.loggingService.error('Error adding export contribution', {
        exportId,
        contributorId,
        error: error as Error,
      });
      throw error;
    }
  }

  /**
   * Generate shareable link for export
   */
  async generateShareableLink(
    exportId: string,
    generatedBy: string,
    options: {
      expiresIn?: number; // hours
      requiresAuth?: boolean;
      allowDownload?: boolean;
      trackAccess?: boolean;
    } = {}
  ): Promise<{
    shareUrl: string;
    expiresAt: Date;
    accessToken: string;
  }> {
    try {
      const exportRequest = await ExportRequestModel.findById(exportId);
      if (!exportRequest) {
        throw new Error('Export not found');
      }

      // Verify user has access
      const userRole = await ProjectRole.query()
        .where('projectId', exportRequest.projectId)
        .where('userId', generatedBy)
        .first();

      if (!userRole) {
        throw new Error('Access denied');
      }

      // Generate secure access token
      const accessToken = this.generateSecureToken();
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + (options.expiresIn || 24));

      // Create shareable link record (this would be a new table)
      const shareableLinkData = {
        exportId,
        generatedBy,
        accessToken,
        expiresAt,
        requiresAuth: options.requiresAuth ?? false,
        allowDownload: options.allowDownload ?? true,
        trackAccess: options.trackAccess ?? true,
        createdAt: new Date(),
      };

      const shareUrl = `${process.env.FRONTEND_URL}/shared-export/${accessToken}`;

      // Track analytics
      AnalyticsService.trackShareableLinkGenerated(generatedBy, exportRequest.projectId, {
        exportId,
        expiresIn: options.expiresIn || 24,
        requiresAuth: options.requiresAuth ?? false,
      });

      this.loggingService.info('Shareable link generated', {
        exportId,
        generatedBy,
        expiresAt,
      });

      return {
        shareUrl,
        expiresAt,
        accessToken,
      };

    } catch (error) {
      this.loggingService.error('Error generating shareable link', {
        exportId,
        generatedBy,
        error: error as Error,
      });
      throw error;
    }
  }

  /**
   * Send export share notification
   */
  private async sendExportShareNotification(
    recipientId: string,
    sharedBy: string,
    exportId: string,
    projectId: string,
    message?: string
  ): Promise<void> {
    try {
      // This would integrate with the notification service
      this.loggingService.info('Export share notification sent', {
        recipientId,
        sharedBy,
        exportId,
        projectId,
      });
    } catch (error) {
      this.loggingService.warn('Failed to send export share notification', {
        recipientId,
        sharedBy,
        exportId,
        error: error as Error,
      });
    }
  }

  /**
   * Send collaboration invite notification
   */
  private async sendCollaborationInviteNotification(
    recipientId: string,
    initiatedBy: string,
    exportId: string,
    projectId: string,
    message?: string
  ): Promise<void> {
    try {
      // This would integrate with the notification service
      this.loggingService.info('Collaboration invite notification sent', {
        recipientId,
        initiatedBy,
        exportId,
        projectId,
      });
    } catch (error) {
      this.loggingService.warn('Failed to send collaboration invite notification', {
        recipientId,
        initiatedBy,
        exportId,
        error: error as Error,
      });
    }
  }

  /**
   * Send contribution notification
   */
  private async sendContributionNotification(
    exportId: string,
    contributorId: string,
    contributionType: string,
    message?: string
  ): Promise<void> {
    try {
      // This would integrate with the notification service
      this.loggingService.info('Contribution notification sent', {
        exportId,
        contributorId,
        contributionType,
      });
    } catch (error) {
      this.loggingService.warn('Failed to send contribution notification', {
        exportId,
        contributorId,
        contributionType,
        error: error as Error,
      });
    }
  }

  /**
   * Generate secure token for shareable links
   */
  private generateSecureToken(): string {
    return `${Date.now()}_${Math.random().toString(36).substr(2, 16)}_${Math.random().toString(36).substr(2, 16)}`;
  }
}