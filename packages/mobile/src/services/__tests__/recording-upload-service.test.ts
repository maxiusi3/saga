import * as FileSystem from 'expo-file-system';

import { RecordingUploadService } from '../recording-upload-service';
import { LocalRecordingDraft } from '@saga/shared';
import { apiClient } from '../api-client';

// Mock dependencies
jest.mock('expo-file-system');
jest.mock('../api-client');

const mockFileSystem = FileSystem as jest.Mocked<typeof FileSystem>;
const mockApiClient = apiClient as jest.Mocked<typeof apiClient>;

// Mock XMLHttpRequest
const mockXHR = {
  open: jest.fn(),
  send: jest.fn(),
  setRequestHeader: jest.fn(),
  abort: jest.fn(),
  addEventListener: jest.fn(),
  upload: {
    addEventListener: jest.fn()
  },
  status: 200,
  statusText: 'OK',
  responseText: '{"story": {"id": "story-123"}}',
  timeout: 0
};

// Mock global XMLHttpRequest
(global as any).XMLHttpRequest = jest.fn(() => mockXHR);

describe('RecordingUploadService', () => {
  const mockDraft: LocalRecordingDraft = {
    sessionId: 'test-session-123',
    userId: 'user-123',
    projectId: 'project-123',
    localAudioUri: 'file://test-audio.m4a',
    duration: 30000,
    localPhotoUri: 'file://test-photo.jpg',
    createdAt: new Date('2023-01-01T00:00:00Z'),
    promptId: 'prompt-123'
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset XMLHttpRequest mock
    mockXHR.open.mockClear();
    mockXHR.send.mockClear();
    mockXHR.setRequestHeader.mockClear();
    mockXHR.addEventListener.mockClear();
    mockXHR.upload.addEventListener.mockClear();

    // Mock API client defaults
    mockApiClient.defaults = {
      baseURL: 'https://api.example.com',
      headers: {
        common: {
          'Authorization': 'Bearer test-token'
        }
      }
    } as any;
  });

  describe('uploadRecordingDraft', () => {
    it('should upload draft successfully', async () => {
      // Mock file info
      mockFileSystem.getInfoAsync
        .mockResolvedValueOnce({ exists: true, size: 1024 * 1024 } as any) // Audio file
        .mockResolvedValueOnce({ exists: true, size: 512 * 1024 } as any); // Photo file

      // Mock successful upload
      let progressCallback: (event: any) => void;
      let loadCallback: () => void;

      mockXHR.upload.addEventListener.mockImplementation((event, callback) => {
        if (event === 'progress') {
          progressCallback = callback;
        }
      });

      mockXHR.addEventListener.mockImplementation((event, callback) => {
        if (event === 'load') {
          loadCallback = callback;
        }
      });

      const progressSpy = jest.fn();
      const completeSpy = jest.fn();

      // Start upload
      const uploadPromise = RecordingUploadService.uploadRecordingDraft(mockDraft, {
        onProgress: progressSpy,
        onComplete: completeSpy
      });

      // Simulate progress
      progressCallback!({ lengthComputable: true, loaded: 512 * 1024, total: 1536 * 1024 });
      
      // Simulate completion
      loadCallback!();

      const result = await uploadPromise;

      expect(result).toBe('story-123');
      expect(mockXHR.open).toHaveBeenCalledWith(
        'POST',
        'https://api.example.com/api/projects/project-123/stories'
      );
      expect(mockXHR.setRequestHeader).toHaveBeenCalledWith(
        'Authorization',
        'Bearer test-token'
      );
      expect(progressSpy).toHaveBeenCalledWith({
        sessionId: 'test-session-123',
        bytesUploaded: 512 * 1024,
        totalBytes: 1536 * 1024,
        percentage: 33,
        status: 'uploading'
      });
      expect(completeSpy).toHaveBeenCalledWith('story-123');
    });

    it('should handle upload without photo', async () => {
      const draftWithoutPhoto = { ...mockDraft, localPhotoUri: undefined };

      mockFileSystem.getInfoAsync
        .mockResolvedValueOnce({ exists: true, size: 1024 * 1024 } as any);

      let loadCallback: () => void;
      mockXHR.addEventListener.mockImplementation((event, callback) => {
        if (event === 'load') {
          loadCallback = callback;
        }
      });

      const uploadPromise = RecordingUploadService.uploadRecordingDraft(draftWithoutPhoto);
      loadCallback!();

      const result = await uploadPromise;

      expect(result).toBe('story-123');
      expect(mockFileSystem.getInfoAsync).toHaveBeenCalledTimes(1); // Only audio file checked
    });

    it('should handle missing audio file', async () => {
      mockFileSystem.getInfoAsync
        .mockResolvedValueOnce({ exists: false } as any);

      const errorSpy = jest.fn();

      const result = await RecordingUploadService.uploadRecordingDraft(mockDraft, {
        onError: errorSpy
      });

      expect(result).toBeNull();
      expect(errorSpy).toHaveBeenCalledWith('Audio file not found');
    });

    it('should handle upload errors', async () => {
      mockFileSystem.getInfoAsync
        .mockResolvedValueOnce({ exists: true, size: 1024 * 1024 } as any);

      let errorCallback: () => void;
      mockXHR.addEventListener.mockImplementation((event, callback) => {
        if (event === 'error') {
          errorCallback = callback;
        }
      });

      const errorSpy = jest.fn();

      const uploadPromise = RecordingUploadService.uploadRecordingDraft(mockDraft, {
        onError: errorSpy
      });

      // Simulate network error
      errorCallback!();

      const result = await uploadPromise;

      expect(result).toBeNull();
      expect(errorSpy).toHaveBeenCalledWith('Network error during upload');
    });

    it('should handle HTTP errors', async () => {
      mockFileSystem.getInfoAsync
        .mockResolvedValueOnce({ exists: true, size: 1024 * 1024 } as any);

      let loadCallback: () => void;
      mockXHR.addEventListener.mockImplementation((event, callback) => {
        if (event === 'load') {
          loadCallback = callback;
        }
      });

      // Mock HTTP error response
      mockXHR.status = 400;
      mockXHR.statusText = 'Bad Request';

      const errorSpy = jest.fn();

      const uploadPromise = RecordingUploadService.uploadRecordingDraft(mockDraft, {
        onError: errorSpy
      });

      loadCallback!();

      const result = await uploadPromise;

      expect(result).toBeNull();
      expect(errorSpy).toHaveBeenCalledWith('HTTP 400: Bad Request');
    });

    it('should handle upload timeout', async () => {
      mockFileSystem.getInfoAsync
        .mockResolvedValueOnce({ exists: true, size: 1024 * 1024 } as any);

      let timeoutCallback: () => void;
      mockXHR.addEventListener.mockImplementation((event, callback) => {
        if (event === 'timeout') {
          timeoutCallback = callback;
        }
      });

      const errorSpy = jest.fn();

      const uploadPromise = RecordingUploadService.uploadRecordingDraft(mockDraft, {
        onError: errorSpy
      });

      // Simulate timeout
      timeoutCallback!();

      const result = await uploadPromise;

      expect(result).toBeNull();
      expect(errorSpy).toHaveBeenCalledWith('Upload timeout');
    });
  });

  describe('cancelUpload', () => {
    it('should cancel active upload', async () => {
      // Start an upload to create an active upload
      mockFileSystem.getInfoAsync
        .mockResolvedValueOnce({ exists: true, size: 1024 * 1024 } as any);

      const uploadPromise = RecordingUploadService.uploadRecordingDraft(mockDraft);

      // Cancel the upload
      await RecordingUploadService.cancelUpload('test-session-123');

      expect(mockXHR.abort).toHaveBeenCalled();

      // The upload should be rejected
      await expect(uploadPromise).rejects.toThrow('Upload cancelled');
    });

    it('should handle cancelling non-existent upload', async () => {
      // Should not throw when cancelling non-existent upload
      await expect(RecordingUploadService.cancelUpload('non-existent'))
        .resolves.not.toThrow();
    });
  });

  describe('retryUpload', () => {
    it('should retry upload with exponential backoff', async () => {
      mockFileSystem.getInfoAsync
        .mockResolvedValue({ exists: true, size: 1024 * 1024 } as any);

      let loadCallback: () => void;
      mockXHR.addEventListener.mockImplementation((event, callback) => {
        if (event === 'load') {
          loadCallback = callback;
        }
      });

      // Mock successful retry
      const retryPromise = RecordingUploadService.retryUpload(mockDraft);
      loadCallback!();

      const result = await retryPromise;

      expect(result).toBe('story-123');
    });

    it('should fail after max retries', async () => {
      mockFileSystem.getInfoAsync
        .mockResolvedValue({ exists: true, size: 1024 * 1024 } as any);

      let errorCallback: () => void;
      mockXHR.addEventListener.mockImplementation((event, callback) => {
        if (event === 'error') {
          errorCallback = callback;
        }
      });

      const retryPromise = RecordingUploadService.retryUpload(mockDraft);

      // Simulate repeated failures
      setTimeout(() => errorCallback!(), 10);

      await expect(retryPromise).rejects.toThrow('Upload failed after 3 retries');
    }, 10000); // Increase timeout for retry delays
  });

  describe('Utility Methods', () => {
    it('should track active uploads', () => {
      expect(RecordingUploadService.getActiveUploads()).toEqual([]);
      expect(RecordingUploadService.isUploading('test-session')).toBe(false);
    });

    it('should cleanup active uploads', async () => {
      // Start an upload
      mockFileSystem.getInfoAsync
        .mockResolvedValueOnce({ exists: true, size: 1024 * 1024 } as any);

      RecordingUploadService.uploadRecordingDraft(mockDraft);

      // Verify upload is active
      expect(RecordingUploadService.isUploading('test-session-123')).toBe(true);

      // Cleanup
      await RecordingUploadService.cleanup();

      // Verify upload is cancelled
      expect(RecordingUploadService.isUploading('test-session-123')).toBe(false);
    });
  });

  describe('Compression', () => {
    it('should return original audio URI (compression not implemented)', async () => {
      const originalUri = 'file://test-audio.m4a';
      const compressedUri = await RecordingUploadService.compressAudio(originalUri);
      
      expect(compressedUri).toBe(originalUri);
    });

    it('should compress image using ImageManipulator', async () => {
      const originalUri = 'file://test-image.jpg';
      const compressedUri = 'file://compressed-image.jpg';

      // Mock ImageManipulator
      const mockImageManipulator = {
        manipulateAsync: jest.fn().mockResolvedValue({ uri: compressedUri }),
        SaveFormat: { JPEG: 'jpeg' }
      };

      jest.doMock('expo-image-manipulator', () => ({
        ImageManipulator: mockImageManipulator
      }));

      const result = await RecordingUploadService.compressImage(originalUri, 0.8);

      expect(result).toBe(compressedUri);
      expect(mockImageManipulator.manipulateAsync).toHaveBeenCalledWith(
        originalUri,
        [{ resize: { width: 1920 } }],
        {
          compress: 0.8,
          format: 'jpeg'
        }
      );
    });

    it('should return original image URI on compression failure', async () => {
      const originalUri = 'file://test-image.jpg';

      // Mock ImageManipulator to throw error
      jest.doMock('expo-image-manipulator', () => ({
        ImageManipulator: {
          manipulateAsync: jest.fn().mockRejectedValue(new Error('Compression failed'))
        }
      }));

      const result = await RecordingUploadService.compressImage(originalUri);

      expect(result).toBe(originalUri);
    });
  });
});