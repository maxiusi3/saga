/**
 * Job Queue Service Unit Tests
 */

import { JobQueueService } from '../services/job-queue-service';
import Bull from 'bull';

// Mock Bull queue
jest.mock('bull');

describe('JobQueueService', () => {
  let jobQueueService: JobQueueService;
  let mockQueue: jest.Mocked<Bull.Queue>;

  beforeEach(() => {
    mockQueue = {
      add: jest.fn(),
      process: jest.fn(),
      on: jest.fn(),
      getJobs: jest.fn(),
      getJob: jest.fn(),
      clean: jest.fn(),
      pause: jest.fn(),
      resume: jest.fn(),
      close: jest.fn()
    } as any;

    (Bull as jest.MockedClass<typeof Bull>).mockImplementation(() => mockQueue);
    
    jobQueueService = new JobQueueService();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('addJob', () => {
    it('should add a job to the queue successfully', async () => {
      const jobData = { storyId: 'story-123', action: 'transcribe' };
      const jobOptions = { delay: 1000, attempts: 3 };
      
      mockQueue.add.mockResolvedValue({ id: 'job-123' } as any);

      const result = await jobQueueService.addJob('transcription', jobData, jobOptions);

      expect(mockQueue.add).toHaveBeenCalledWith('transcription', jobData, jobOptions);
      expect(result).toEqual({ id: 'job-123' });
    });

    it('should handle job addition errors', async () => {
      const jobData = { storyId: 'story-123' };
      
      mockQueue.add.mockRejectedValue(new Error('Queue connection failed'));

      await expect(jobQueueService.addJob('transcription', jobData))
        .rejects.toThrow('Queue connection failed');
    });

    it('should add job with default options when none provided', async () => {
      const jobData = { storyId: 'story-123' };
      
      mockQueue.add.mockResolvedValue({ id: 'job-123' } as any);

      await jobQueueService.addJob('transcription', jobData);

      expect(mockQueue.add).toHaveBeenCalledWith('transcription', jobData, {
        attempts: 3,
        backoff: 'exponential',
        removeOnComplete: 10,
        removeOnFail: 5
      });
    });
  });

  describe('processJobs', () => {
    it('should register job processor successfully', () => {
      const mockProcessor = jest.fn();

      jobQueueService.processJobs('transcription', mockProcessor);

      expect(mockQueue.process).toHaveBeenCalledWith('transcription', mockProcessor);
    });

    it('should register job processor with concurrency', () => {
      const mockProcessor = jest.fn();
      const concurrency = 5;

      jobQueueService.processJobs('transcription', concurrency, mockProcessor);

      expect(mockQueue.process).toHaveBeenCalledWith('transcription', concurrency, mockProcessor);
    });
  });

  describe('getJobStatus', () => {
    it('should return job status for existing job', async () => {
      const mockJob = {
        id: 'job-123',
        data: { storyId: 'story-123' },
        opts: { attempts: 3 },
        progress: 50,
        returnvalue: null,
        failedReason: null,
        processedOn: Date.now(),
        finishedOn: null
      };

      mockQueue.getJob.mockResolvedValue(mockJob as any);

      const result = await jobQueueService.getJobStatus('job-123');

      expect(result).toEqual({
        id: 'job-123',
        data: { storyId: 'story-123' },
        progress: 50,
        state: 'active',
        result: null,
        error: null,
        processedOn: mockJob.processedOn,
        finishedOn: null
      });
    });

    it('should return null for non-existent job', async () => {
      mockQueue.getJob.mockResolvedValue(null);

      const result = await jobQueueService.getJobStatus('non-existent');

      expect(result).toBeNull();
      expect(mockQueue.getJob).toHaveBeenCalledWith('non-existent');
    });

    it('should handle job status retrieval errors', async () => {
      mockQueue.getJob.mockRejectedValue(new Error('Database connection failed'));

      await expect(jobQueueService.getJobStatus('job-123'))
        .rejects.toThrow('Database connection failed');
    });
  });

  describe('getQueueStats', () => {
    it('should return queue statistics', async () => {
      const mockJobs = [
        { opts: { delay: 0 } },
        { opts: { delay: 1000 } },
        { opts: { delay: 0 } }
      ];

      mockQueue.getJobs.mockImplementation((state) => {
        const jobCounts = {
          waiting: 2,
          active: 1,
          completed: 5,
          failed: 1,
          delayed: 1
        };
        return Promise.resolve(new Array(jobCounts[state] || 0).fill({}));
      });

      const result = await jobQueueService.getQueueStats();

      expect(result).toEqual({
        waiting: 2,
        active: 1,
        completed: 5,
        failed: 1,
        delayed: 1,
        total: 10
      });
    });
  });

  describe('cleanQueue', () => {
    it('should clean completed jobs older than specified time', async () => {
      const olderThan = 24 * 60 * 60 * 1000; // 24 hours
      
      mockQueue.clean.mockResolvedValue([]);

      await jobQueueService.cleanQueue('completed', olderThan);

      expect(mockQueue.clean).toHaveBeenCalledWith(olderThan, 'completed');
    });

    it('should clean failed jobs', async () => {
      const olderThan = 7 * 24 * 60 * 60 * 1000; // 7 days
      
      mockQueue.clean.mockResolvedValue([]);

      await jobQueueService.cleanQueue('failed', olderThan);

      expect(mockQueue.clean).toHaveBeenCalledWith(olderThan, 'failed');
    });

    it('should handle queue cleaning errors', async () => {
      mockQueue.clean.mockRejectedValue(new Error('Cleanup failed'));

      await expect(jobQueueService.cleanQueue('completed', 1000))
        .rejects.toThrow('Cleanup failed');
    });
  });

  describe('pauseQueue', () => {
    it('should pause the queue', async () => {
      mockQueue.pause.mockResolvedValue();

      await jobQueueService.pauseQueue();

      expect(mockQueue.pause).toHaveBeenCalled();
    });

    it('should handle pause errors', async () => {
      mockQueue.pause.mockRejectedValue(new Error('Pause failed'));

      await expect(jobQueueService.pauseQueue())
        .rejects.toThrow('Pause failed');
    });
  });

  describe('resumeQueue', () => {
    it('should resume the queue', async () => {
      mockQueue.resume.mockResolvedValue();

      await jobQueueService.resumeQueue();

      expect(mockQueue.resume).toHaveBeenCalled();
    });

    it('should handle resume errors', async () => {
      mockQueue.resume.mockRejectedValue(new Error('Resume failed'));

      await expect(jobQueueService.resumeQueue())
        .rejects.toThrow('Resume failed');
    });
  });

  describe('shutdown', () => {
    it('should close the queue gracefully', async () => {
      mockQueue.close.mockResolvedValue();

      await jobQueueService.shutdown();

      expect(mockQueue.close).toHaveBeenCalled();
    });

    it('should handle shutdown errors', async () => {
      mockQueue.close.mockRejectedValue(new Error('Shutdown failed'));

      await expect(jobQueueService.shutdown())
        .rejects.toThrow('Shutdown failed');
    });
  });

  describe('job event handling', () => {
    it('should set up job event listeners', () => {
      jobQueueService = new JobQueueService();

      expect(mockQueue.on).toHaveBeenCalledWith('completed', expect.any(Function));
      expect(mockQueue.on).toHaveBeenCalledWith('failed', expect.any(Function));
      expect(mockQueue.on).toHaveBeenCalledWith('stalled', expect.any(Function));
    });

    it('should handle job completion events', () => {
      const completedHandler = mockQueue.on.mock.calls.find(
        call => call[0] === 'completed'
      )[1];

      const mockJob = { id: 'job-123', data: { storyId: 'story-123' } };
      const result = { success: true };

      // Should not throw when handling completion
      expect(() => completedHandler(mockJob, result)).not.toThrow();
    });

    it('should handle job failure events', () => {
      const failedHandler = mockQueue.on.mock.calls.find(
        call => call[0] === 'failed'
      )[1];

      const mockJob = { id: 'job-123', data: { storyId: 'story-123' } };
      const error = new Error('Job processing failed');

      // Should not throw when handling failure
      expect(() => failedHandler(mockJob, error)).not.toThrow();
    });
  });

  describe('retry logic', () => {
    it('should configure exponential backoff for retries', async () => {
      const jobData = { storyId: 'story-123' };
      const customOptions = {
        attempts: 5,
        backoff: {
          type: 'exponential',
          delay: 2000
        }
      };

      mockQueue.add.mockResolvedValue({ id: 'job-123' } as any);

      await jobQueueService.addJob('transcription', jobData, customOptions);

      expect(mockQueue.add).toHaveBeenCalledWith('transcription', jobData, customOptions);
    });

    it('should handle maximum retry attempts', async () => {
      const jobData = { storyId: 'story-123' };
      const options = { attempts: 1 }; // Only one attempt

      mockQueue.add.mockResolvedValue({ id: 'job-123' } as any);

      await jobQueueService.addJob('transcription', jobData, options);

      expect(mockQueue.add).toHaveBeenCalledWith('transcription', jobData, options);
    });
  });
});