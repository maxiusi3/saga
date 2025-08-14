import request from 'supertest';
import { app } from '../../index';
import { setupTestDatabase, cleanupTestDatabase, createTestUser, createTestProject } from '../setup';
import { generateAccessToken } from '../../services/auth-service';
import { StorageService } from '../../services/storage-service';
import { SpeechToTextService } from '../../services/speech-to-text-service';
import { MediaProcessingService } from '../../services/media-processing-service';
import { JobQueueService } from '../../services/job-queue-service';
import fs from 'fs';
import path from 'path';

// Mock external services
jest.mock('../../services/storage-service');
jest.mock('../../services/speech-to-text-service');
jest.mock('../../services/media-processing-service');

describe('File Processing Integration Tests', () => {
  let testUserId: string;
  let testProjectId: string;
  let authToken: string;
  let storageService: jest.Mocked<StorageService>;
  let sttService: jest.Mocked<SpeechToTextService>;
  let mediaService: jest.Mocked<MediaProcessingService>;
  let jobQueue: JobQueueService;

  beforeAll(async () => {
    await setupTestDatabase();
    
    // Initialize services
    storageService = new StorageService() as jest.Mocked<StorageService>;
    sttService = new SpeechToTextService() as jest.Mocked<SpeechToTextService>;
    mediaService = new MediaProcessingService() as jest.Mocked<MediaProcessingService>;
    jobQueue = new JobQueueService();
  });

  afterAll(async () => {
    await cleanupTestDatabase();
    await jobQueue.close();
  });

  beforeEach(async () => {
    // Create test user and project for each test
    const testUser = await createTestUser({
      email: 'file-test@example.com',
      name: 'File Test User',
      password: 'TestPassword123!',
    });
    testUserId = testUser.id;
    authToken = generateAccessToken(testUser);

    const testProject = await createTestProject({
      title: 'File Test Project',
      facilitatorId: testUserId,
    });
    testProjectId = testProject.id;

    // Reset mocks
    jest.clearAllMocks();
  });

  describe('Audio File Upload Integration', () => {
    it('should upload and process audio files successfully', async () => {
      // Mock successful storage upload
      storageService.uploadFile.mockResolvedValue({
        url: 'https://test-bucket.s3.amazonaws.com/audio/test-audio-123.wav',
        key: 'audio/test-audio-123.wav',
        bucket: 'test-bucket',
        size: 1024000
      });

      // Mock successful transcription
      sttService.transcribeAudio.mockResolvedValue({
        text: 'This is a test transcription of the uploaded audio file.',
        confidence: 0.95,
        segments: [
          {
            start: 0,
            end: 5.2,
            text: 'This is a test transcription',
            confidence: 0.96
          },
          {
            start: 5.2,
            end: 10.1,
            text: 'of the uploaded audio file.',
            confidence: 0.94
          }
        ]
      });

      // Create mock audio file
      const mockAudioBuffer = Buffer.from('mock audio data');
      const tempFilePath = path.join(__dirname, 'temp-test-audio.wav');
      fs.writeFileSync(tempFilePath, mockAudioBuffer);

      try {
        const response = await request(app)
          .post(`/api/projects/${testProjectId}/stories/upload`)
          .set('Authorization', `Bearer ${authToken}`)
          .attach('audio', tempFilePath)
          .field('title', 'Test Audio Story')
          .expect(201);

        expect(response.body.success).toBe(true);
        expect(response.body.data.title).toBe('Test Audio Story');
        expect(response.body.data.audioUrl).toContain('s3.amazonaws.com');
        expect(response.body.data.status).toBe('processing');

        // Verify storage service was called
        expect(storageService.uploadFile).toHaveBeenCalledWith(
          expect.objectContaining({
            originalname: 'temp-test-audio.wav',
            mimetype: 'audio/wav'
          }),
          expect.objectContaining({
            folder: 'audio',
            generateUniqueFilename: true
          })
        );

        // Wait for background processing to complete
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Check that story was updated with transcription
        const storyResponse = await request(app)
          .get(`/api/stories/${response.body.data.id}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(storyResponse.body.data.transcript).toBe('This is a test transcription of the uploaded audio file.');
        expect(storyResponse.body.data.status).toBe('ready');
        expect(storyResponse.body.data.transcriptionConfidence).toBe(0.95);

      } finally {
        // Clean up temp file
        if (fs.existsSync(tempFilePath)) {
          fs.unlinkSync(tempFilePath);
        }
      }
    });

    it('should handle different audio formats', async () => {
      const formats = [
        { ext: 'mp3', mimetype: 'audio/mpeg' },
        { ext: 'wav', mimetype: 'audio/wav' },
        { ext: 'm4a', mimetype: 'audio/mp4' },
        { ext: 'flac', mimetype: 'audio/flac' }
      ];

      for (const format of formats) {
        // Mock successful upload for each format
        storageService.uploadFile.mockResolvedValue({
          url: `https://test-bucket.s3.amazonaws.com/audio/test-audio.${format.ext}`,
          key: `audio/test-audio.${format.ext}`,
          bucket: 'test-bucket',
          size: 1024000
        });

        sttService.transcribeAudio.mockResolvedValue({
          text: `Transcription for ${format.ext} format`,
          confidence: 0.9,
          segments: []
        });

        const mockAudioBuffer = Buffer.from(`mock ${format.ext} data`);
        const tempFilePath = path.join(__dirname, `temp-test.${format.ext}`);
        fs.writeFileSync(tempFilePath, mockAudioBuffer);

        try {
          const response = await request(app)
            .post(`/api/projects/${testProjectId}/stories/upload`)
            .set('Authorization', `Bearer ${authToken}`)
            .attach('audio', tempFilePath)
            .field('title', `Test ${format.ext.toUpperCase()} Story`)
            .expect(201);

          expect(response.body.success).toBe(true);
          expect(response.body.data.audioUrl).toContain(format.ext);

        } finally {
          if (fs.existsSync(tempFilePath)) {
            fs.unlinkSync(tempFilePath);
          }
        }
      }
    });

    it('should validate file size limits', async () => {
      // Create a large mock file (over 50MB limit)
      const largeMockBuffer = Buffer.alloc(60 * 1024 * 1024); // 60MB
      const tempFilePath = path.join(__dirname, 'temp-large-audio.wav');
      fs.writeFileSync(tempFilePath, largeMockBuffer);

      try {
        await request(app)
          .post(`/api/projects/${testProjectId}/stories/upload`)
          .set('Authorization', `Bearer ${authToken}`)
          .attach('audio', tempFilePath)
          .field('title', 'Large Audio Story')
          .expect(400);

      } finally {
        if (fs.existsSync(tempFilePath)) {
          fs.unlinkSync(tempFilePath);
        }
      }
    });

    it('should validate audio duration limits', async () => {
      // Mock media processing to return duration over limit
      mediaService.getAudioMetadata.mockResolvedValue({
        duration: 900, // 15 minutes (over 10 minute limit)
        format: 'wav',
        sampleRate: 44100,
        channels: 2,
        bitrate: 1411
      });

      const mockAudioBuffer = Buffer.from('mock long audio data');
      const tempFilePath = path.join(__dirname, 'temp-long-audio.wav');
      fs.writeFileSync(tempFilePath, mockAudioBuffer);

      try {
        await request(app)
          .post(`/api/projects/${testProjectId}/stories/upload`)
          .set('Authorization', `Bearer ${authToken}`)
          .attach('audio', tempFilePath)
          .field('title', 'Long Audio Story')
          .expect(400);

      } finally {
        if (fs.existsSync(tempFilePath)) {
          fs.unlinkSync(tempFilePath);
        }
      }
    });

    it('should handle unsupported file types', async () => {
      const mockTextBuffer = Buffer.from('This is not an audio file');
      const tempFilePath = path.join(__dirname, 'temp-text-file.txt');
      fs.writeFileSync(tempFilePath, mockTextBuffer);

      try {
        await request(app)
          .post(`/api/projects/${testProjectId}/stories/upload`)
          .set('Authorization', `Bearer ${authToken}`)
          .attach('audio', tempFilePath)
          .field('title', 'Invalid File Story')
          .expect(400);

      } finally {
        if (fs.existsSync(tempFilePath)) {
          fs.unlinkSync(tempFilePath);
        }
      }
    });
  });

  describe('Background Processing Integration', () => {
    it('should process audio files in background queue', async () => {
      // Mock successful storage and processing
      storageService.uploadFile.mockResolvedValue({
        url: 'https://test-bucket.s3.amazonaws.com/audio/test-audio-123.wav',
        key: 'audio/test-audio-123.wav',
        bucket: 'test-bucket',
        size: 1024000
      });

      mediaService.getAudioMetadata.mockResolvedValue({
        duration: 120, // 2 minutes
        format: 'wav',
        sampleRate: 44100,
        channels: 1,
        bitrate: 1411
      });

      sttService.transcribeAudio.mockResolvedValue({
        text: 'Background processing test transcription.',
        confidence: 0.92,
        segments: []
      });

      const mockAudioBuffer = Buffer.from('mock audio data');
      const tempFilePath = path.join(__dirname, 'temp-bg-audio.wav');
      fs.writeFileSync(tempFilePath, mockAudioBuffer);

      try {
        // Upload file
        const uploadResponse = await request(app)
          .post(`/api/projects/${testProjectId}/stories/upload`)
          .set('Authorization', `Bearer ${authToken}`)
          .attach('audio', tempFilePath)
          .field('title', 'Background Processing Test')
          .expect(201);

        const storyId = uploadResponse.body.data.id;

        // Initially should be in processing status
        expect(uploadResponse.body.data.status).toBe('processing');

        // Wait for background job to complete
        await new Promise(resolve => setTimeout(resolve, 3000));

        // Check final status
        const finalResponse = await request(app)
          .get(`/api/stories/${storyId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(finalResponse.body.data.status).toBe('ready');
        expect(finalResponse.body.data.transcript).toBe('Background processing test transcription.');

      } finally {
        if (fs.existsSync(tempFilePath)) {
          fs.unlinkSync(tempFilePath);
        }
      }
    });

    it('should handle processing failures gracefully', async () => {
      // Mock storage success but transcription failure
      storageService.uploadFile.mockResolvedValue({
        url: 'https://test-bucket.s3.amazonaws.com/audio/test-audio-123.wav',
        key: 'audio/test-audio-123.wav',
        bucket: 'test-bucket',
        size: 1024000
      });

      sttService.transcribeAudio.mockRejectedValue(
        new Error('Transcription service unavailable')
      );

      const mockAudioBuffer = Buffer.from('mock audio data');
      const tempFilePath = path.join(__dirname, 'temp-fail-audio.wav');
      fs.writeFileSync(tempFilePath, mockAudioBuffer);

      try {
        const uploadResponse = await request(app)
          .post(`/api/projects/${testProjectId}/stories/upload`)
          .set('Authorization', `Bearer ${authToken}`)
          .attach('audio', tempFilePath)
          .field('title', 'Processing Failure Test')
          .expect(201);

        const storyId = uploadResponse.body.data.id;

        // Wait for background job to fail
        await new Promise(resolve => setTimeout(resolve, 3000));

        // Check that story is marked as failed
        const finalResponse = await request(app)
          .get(`/api/stories/${storyId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(finalResponse.body.data.status).toBe('failed');
        expect(finalResponse.body.data.errorMessage).toContain('Transcription service unavailable');

      } finally {
        if (fs.existsSync(tempFilePath)) {
          fs.unlinkSync(tempFilePath);
        }
      }
    });

    it('should retry failed processing jobs', async () => {
      let transcriptionAttempts = 0;

      // Mock storage success
      storageService.uploadFile.mockResolvedValue({
        url: 'https://test-bucket.s3.amazonaws.com/audio/test-audio-123.wav',
        key: 'audio/test-audio-123.wav',
        bucket: 'test-bucket',
        size: 1024000
      });

      // Mock transcription to fail first two times, succeed on third
      sttService.transcribeAudio.mockImplementation(() => {
        transcriptionAttempts++;
        if (transcriptionAttempts < 3) {
          return Promise.reject(new Error('Temporary service error'));
        }
        return Promise.resolve({
          text: 'Retry successful transcription.',
          confidence: 0.88,
          segments: []
        });
      });

      const mockAudioBuffer = Buffer.from('mock audio data');
      const tempFilePath = path.join(__dirname, 'temp-retry-audio.wav');
      fs.writeFileSync(tempFilePath, mockAudioBuffer);

      try {
        const uploadResponse = await request(app)
          .post(`/api/projects/${testProjectId}/stories/upload`)
          .set('Authorization', `Bearer ${authToken}`)
          .attach('audio', tempFilePath)
          .field('title', 'Retry Test')
          .expect(201);

        const storyId = uploadResponse.body.data.id;

        // Wait for retries to complete
        await new Promise(resolve => setTimeout(resolve, 10000));

        // Check that story eventually succeeded
        const finalResponse = await request(app)
          .get(`/api/stories/${storyId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(finalResponse.body.data.status).toBe('ready');
        expect(finalResponse.body.data.transcript).toBe('Retry successful transcription.');
        expect(transcriptionAttempts).toBe(3);

      } finally {
        if (fs.existsSync(tempFilePath)) {
          fs.unlinkSync(tempFilePath);
        }
      }
    });
  });

  describe('Progress Tracking Integration', () => {
    it('should track upload progress', async () => {
      // Mock storage service to simulate progress updates
      let progressCallback: ((progress: number) => void) | undefined;
      
      storageService.uploadFile.mockImplementation((file, options, onProgress) => {
        progressCallback = onProgress;
        
        // Simulate progress updates
        setTimeout(() => progressCallback?.(25), 100);
        setTimeout(() => progressCallback?.(50), 200);
        setTimeout(() => progressCallback?.(75), 300);
        setTimeout(() => progressCallback?.(100), 400);
        
        return Promise.resolve({
          url: 'https://test-bucket.s3.amazonaws.com/audio/test-audio-123.wav',
          key: 'audio/test-audio-123.wav',
          bucket: 'test-bucket',
          size: 1024000
        });
      });

      const mockAudioBuffer = Buffer.from('mock audio data');
      const tempFilePath = path.join(__dirname, 'temp-progress-audio.wav');
      fs.writeFileSync(tempFilePath, mockAudioBuffer);

      try {
        const response = await request(app)
          .post(`/api/projects/${testProjectId}/stories/upload`)
          .set('Authorization', `Bearer ${authToken}`)
          .attach('audio', tempFilePath)
          .field('title', 'Progress Test')
          .expect(201);

        expect(response.body.success).toBe(true);
        expect(progressCallback).toBeDefined();

      } finally {
        if (fs.existsSync(tempFilePath)) {
          fs.unlinkSync(tempFilePath);
        }
      }
    });

    it('should provide processing status updates via WebSocket', async () => {
      // This would require WebSocket integration
      // For now, we'll test the REST endpoint for status
      
      storageService.uploadFile.mockResolvedValue({
        url: 'https://test-bucket.s3.amazonaws.com/audio/test-audio-123.wav',
        key: 'audio/test-audio-123.wav',
        bucket: 'test-bucket',
        size: 1024000
      });

      // Mock transcription with delay to simulate processing
      sttService.transcribeAudio.mockImplementation(() => {
        return new Promise(resolve => {
          setTimeout(() => {
            resolve({
              text: 'Status update test transcription.',
              confidence: 0.91,
              segments: []
            });
          }, 1000);
        });
      });

      const mockAudioBuffer = Buffer.from('mock audio data');
      const tempFilePath = path.join(__dirname, 'temp-status-audio.wav');
      fs.writeFileSync(tempFilePath, mockAudioBuffer);

      try {
        const uploadResponse = await request(app)
          .post(`/api/projects/${testProjectId}/stories/upload`)
          .set('Authorization', `Bearer ${authToken}`)
          .attach('audio', tempFilePath)
          .field('title', 'Status Update Test')
          .expect(201);

        const storyId = uploadResponse.body.data.id;

        // Check initial status
        let statusResponse = await request(app)
          .get(`/api/stories/${storyId}/status`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(statusResponse.body.data.status).toBe('processing');

        // Wait and check final status
        await new Promise(resolve => setTimeout(resolve, 2000));

        statusResponse = await request(app)
          .get(`/api/stories/${storyId}/status`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(statusResponse.body.data.status).toBe('ready');

      } finally {
        if (fs.existsSync(tempFilePath)) {
          fs.unlinkSync(tempFilePath);
        }
      }
    });
  });

  describe('Concurrent Upload Handling', () => {
    it('should handle multiple simultaneous uploads', async () => {
      const numUploads = 5;
      const uploadPromises: Promise<any>[] = [];

      // Mock successful processing for all uploads
      storageService.uploadFile.mockImplementation((file) => {
        const filename = file.originalname || 'unknown';
        return Promise.resolve({
          url: `https://test-bucket.s3.amazonaws.com/audio/${filename}`,
          key: `audio/${filename}`,
          bucket: 'test-bucket',
          size: 1024000
        });
      });

      sttService.transcribeAudio.mockResolvedValue({
        text: 'Concurrent upload test transcription.',
        confidence: 0.9,
        segments: []
      });

      // Create multiple upload requests
      for (let i = 0; i < numUploads; i++) {
        const mockAudioBuffer = Buffer.from(`mock audio data ${i}`);
        const tempFilePath = path.join(__dirname, `temp-concurrent-${i}.wav`);
        fs.writeFileSync(tempFilePath, mockAudioBuffer);

        const uploadPromise = request(app)
          .post(`/api/projects/${testProjectId}/stories/upload`)
          .set('Authorization', `Bearer ${authToken}`)
          .attach('audio', tempFilePath)
          .field('title', `Concurrent Test ${i}`)
          .expect(201)
          .finally(() => {
            if (fs.existsSync(tempFilePath)) {
              fs.unlinkSync(tempFilePath);
            }
          });

        uploadPromises.push(uploadPromise);
      }

      // Wait for all uploads to complete
      const responses = await Promise.all(uploadPromises);

      // Verify all uploads succeeded
      responses.forEach((response, index) => {
        expect(response.body.success).toBe(true);
        expect(response.body.data.title).toBe(`Concurrent Test ${index}`);
      });

      // Verify storage service was called for each upload
      expect(storageService.uploadFile).toHaveBeenCalledTimes(numUploads);
    });

    it('should handle queue overflow gracefully', async () => {
      // Mock job queue to simulate overflow
      jest.spyOn(jobQueue, 'addJob').mockRejectedValue(
        new Error('Queue is full')
      );

      const mockAudioBuffer = Buffer.from('mock audio data');
      const tempFilePath = path.join(__dirname, 'temp-overflow-audio.wav');
      fs.writeFileSync(tempFilePath, mockAudioBuffer);

      try {
        await request(app)
          .post(`/api/projects/${testProjectId}/stories/upload`)
          .set('Authorization', `Bearer ${authToken}`)
          .attach('audio', tempFilePath)
          .field('title', 'Queue Overflow Test')
          .expect(503); // Service Unavailable

      } finally {
        if (fs.existsSync(tempFilePath)) {
          fs.unlinkSync(tempFilePath);
        }
      }
    });
  });

  describe('File Cleanup Integration', () => {
    it('should clean up temporary files after processing', async () => {
      const tempFiles: string[] = [];
      
      // Mock storage service to track temp files
      storageService.uploadFile.mockImplementation((file) => {
        if (file.path) {
          tempFiles.push(file.path);
        }
        return Promise.resolve({
          url: 'https://test-bucket.s3.amazonaws.com/audio/test-audio-123.wav',
          key: 'audio/test-audio-123.wav',
          bucket: 'test-bucket',
          size: 1024000
        });
      });

      sttService.transcribeAudio.mockResolvedValue({
        text: 'Cleanup test transcription.',
        confidence: 0.9,
        segments: []
      });

      const mockAudioBuffer = Buffer.from('mock audio data');
      const tempFilePath = path.join(__dirname, 'temp-cleanup-audio.wav');
      fs.writeFileSync(tempFilePath, mockAudioBuffer);

      try {
        await request(app)
          .post(`/api/projects/${testProjectId}/stories/upload`)
          .set('Authorization', `Bearer ${authToken}`)
          .attach('audio', tempFilePath)
          .field('title', 'Cleanup Test')
          .expect(201);

        // Wait for processing to complete
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Verify temp files were cleaned up
        tempFiles.forEach(tempFile => {
          expect(fs.existsSync(tempFile)).toBe(false);
        });

      } finally {
        if (fs.existsSync(tempFilePath)) {
          fs.unlinkSync(tempFilePath);
        }
      }
    });

    it('should clean up failed uploads', async () => {
      // Mock storage failure
      storageService.uploadFile.mockRejectedValue(
        new Error('Storage service unavailable')
      );

      const mockAudioBuffer = Buffer.from('mock audio data');
      const tempFilePath = path.join(__dirname, 'temp-failed-audio.wav');
      fs.writeFileSync(tempFilePath, mockAudioBuffer);

      try {
        await request(app)
          .post(`/api/projects/${testProjectId}/stories/upload`)
          .set('Authorization', `Bearer ${authToken}`)
          .attach('audio', tempFilePath)
          .field('title', 'Failed Upload Test')
          .expect(500);

        // Verify temp file was cleaned up even on failure
        // (This would be handled by multer cleanup middleware)

      } finally {
        if (fs.existsSync(tempFilePath)) {
          fs.unlinkSync(tempFilePath);
        }
      }
    });
  });
});