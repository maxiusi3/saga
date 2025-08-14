import { RecordingService } from '../recording-service';
import { EnhancedRecordingService } from '../enhanced-recording-service';
import { RecordingUploadService } from '../recording-upload-service';
import { LocalRecordingDraft, RecordingQuality } from '@saga/shared';

// Mock dependencies
jest.mock('../enhanced-recording-service');
jest.mock('../recording-upload-service');

const mockEnhancedRecordingService = EnhancedRecordingService as jest.Mocked<typeof EnhancedRecordingService>;
const mockRecordingUploadService = RecordingUploadService as jest.Mocked<typeof RecordingUploadService>;

describe('RecordingService', () => {
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

  const mockRecordingState = {
    isRecording: false,
    isPaused: false,
    duration: 30000,
    uri: 'file://test-audio.m4a',
    size: 1024 * 1024,
    quality: null,
    metadata: {}
  };

  const mockQuality: RecordingQuality = {
    isValid: true,
    duration: 30000,
    fileSize: 1024 * 1024,
    format: 'm4a',
    issues: []
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset service state
    (RecordingService as any).currentState = {
      recording: {
        isRecording: false,
        isPaused: false,
        duration: 0,
        uri: null,
        size: 0,
        quality: null,
        metadata: {}
      },
      draft: null,
      uploadProgress: null
    };
    (RecordingService as any).stateListeners = [];
  });

  describe('State Management', () => {
    it('should return current state', () => {
      const state = RecordingService.getState();
      
      expect(state).toEqual({
        recording: {
          isRecording: false,
          isPaused: false,
          duration: 0,
          uri: null,
          size: 0,
          quality: null,
          metadata: {}
        },
        draft: null,
        uploadProgress: null
      });
    });

    it('should handle state subscriptions', () => {
      const listener = jest.fn();
      
      const unsubscribe = RecordingService.subscribe(listener);
      
      // Trigger state change
      (RecordingService as any).updateState({ draft: mockDraft });
      
      expect(listener).toHaveBeenCalledWith({
        recording: expect.any(Object),
        draft: mockDraft,
        uploadProgress: null
      });

      // Unsubscribe
      unsubscribe();
      
      // Trigger another state change
      (RecordingService as any).updateState({ draft: null });
      
      // Listener should not be called again
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('should handle listener errors gracefully', () => {
      const errorListener = jest.fn().mockImplementation(() => {
        throw new Error('Listener error');
      });
      const goodListener = jest.fn();
      
      RecordingService.subscribe(errorListener);
      RecordingService.subscribe(goodListener);
      
      // Should not throw despite error in first listener
      expect(() => {
        (RecordingService as any).updateState({ draft: mockDraft });
      }).not.toThrow();
      
      expect(goodListener).toHaveBeenCalled();
    });
  });

  describe('Recording Workflow', () => {
    it('should initialize successfully', async () => {
      mockEnhancedRecordingService.initialize.mockResolvedValue(true);
      
      const result = await RecordingService.initialize();
      
      expect(result).toBe(true);
      expect(mockEnhancedRecordingService.initialize).toHaveBeenCalled();
    });

    it('should start recording successfully', async () => {
      mockEnhancedRecordingService.startRecording.mockResolvedValue('session-123');
      mockEnhancedRecordingService.getEnhancedRecordingState.mockResolvedValue(mockRecordingState);
      
      const result = await RecordingService.startRecording({
        userId: 'user-123',
        projectId: 'project-123',
        promptId: 'prompt-123'
      });
      
      expect(result).toBe(true);
      expect(mockEnhancedRecordingService.startRecording).toHaveBeenCalledWith(
        'user-123',
        'project-123',
        'prompt-123',
        undefined
      );
      
      const state = RecordingService.getState();
      expect(state.recording).toEqual(mockRecordingState);
      expect(state.draft).toBeNull();
    });

    it('should handle start recording failure', async () => {
      mockEnhancedRecordingService.startRecording.mockResolvedValue(null);
      
      const result = await RecordingService.startRecording({
        userId: 'user-123',
        projectId: 'project-123'
      });
      
      expect(result).toBe(false);
    });

    it('should stop recording successfully', async () => {
      mockEnhancedRecordingService.stopRecording.mockResolvedValue('file://audio.m4a');
      mockEnhancedRecordingService.getEnhancedRecordingState.mockResolvedValue({
        ...mockRecordingState,
        uri: 'file://audio.m4a'
      });
      
      const result = await RecordingService.stopRecording();
      
      expect(result).toBe(true);
      expect(mockEnhancedRecordingService.stopRecording).toHaveBeenCalled();
    });

    it('should create draft successfully', async () => {
      mockEnhancedRecordingService.getEnhancedRecordingState.mockResolvedValue({
        ...mockRecordingState,
        uri: 'file://audio.m4a'
      });
      mockEnhancedRecordingService.createDraftFromRecording.mockResolvedValue(mockDraft);
      
      const result = await RecordingService.createDraft(
        'user-123',
        'project-123',
        'file://photo.jpg',
        'prompt-123'
      );
      
      expect(result).toBe(true);
      expect(mockEnhancedRecordingService.createDraftFromRecording).toHaveBeenCalledWith(
        'user-123',
        'project-123',
        'file://audio.m4a',
        'file://photo.jpg',
        'prompt-123',
        undefined,
        undefined
      );
      
      const state = RecordingService.getState();
      expect(state.draft).toEqual(mockDraft);
    });

    it('should recover draft successfully', async () => {
      mockEnhancedRecordingService.recoverDraft.mockResolvedValue(mockDraft);
      
      const result = await RecordingService.recoverDraft('user-123');
      
      expect(result).toBe(true);
      expect(mockEnhancedRecordingService.recoverDraft).toHaveBeenCalledWith('user-123');
      
      const state = RecordingService.getState();
      expect(state.draft).toEqual(mockDraft);
    });

    it('should discard draft successfully', async () => {
      // Set up initial state with draft
      (RecordingService as any).updateState({ draft: mockDraft });
      
      mockEnhancedRecordingService.discardDraft.mockResolvedValue(undefined);
      
      await RecordingService.discardDraft();
      
      expect(mockEnhancedRecordingService.discardDraft).toHaveBeenCalledWith('test-session-123');
      
      const state = RecordingService.getState();
      expect(state.draft).toBeNull();
    });
  });

  describe('Review & Send Workflow', () => {
    it('should validate recording quality', async () => {
      mockEnhancedRecordingService.getEnhancedRecordingState.mockResolvedValue({
        ...mockRecordingState,
        uri: 'file://audio.m4a'
      });
      mockEnhancedRecordingService.validateRecordingQuality.mockResolvedValue(mockQuality);
      
      const quality = await RecordingService.validateCurrentRecording();
      
      expect(quality).toEqual(mockQuality);
      expect(mockEnhancedRecordingService.validateRecordingQuality).toHaveBeenCalledWith('file://audio.m4a');
    });

    it('should send to family successfully', async () => {
      // Set up initial state with draft
      (RecordingService as any).updateState({ draft: mockDraft });
      
      mockRecordingUploadService.uploadRecordingDraft.mockImplementation(async (draft, options) => {
        // Simulate progress
        options?.onProgress?.({
          sessionId: draft.sessionId,
          bytesUploaded: 512 * 1024,
          totalBytes: 1024 * 1024,
          percentage: 50,
          status: 'uploading'
        });
        
        // Simulate completion
        options?.onComplete?.('story-123');
        
        return 'story-123';
      });
      
      mockEnhancedRecordingService.discardDraft.mockResolvedValue(undefined);
      
      const progressSpy = jest.fn();
      const completeSpy = jest.fn();
      
      const result = await RecordingService.sendToFamily({
        onProgress: progressSpy,
        onComplete: completeSpy
      });
      
      expect(result).toBe('story-123');
      expect(mockRecordingUploadService.uploadRecordingDraft).toHaveBeenCalledWith(
        mockDraft,
        expect.objectContaining({
          onProgress: expect.any(Function),
          onComplete: expect.any(Function),
          onError: expect.any(Function)
        })
      );
      expect(progressSpy).toHaveBeenCalled();
      expect(completeSpy).toHaveBeenCalledWith('story-123');
      
      // Draft should be cleared after successful upload
      const state = RecordingService.getState();
      expect(state.draft).toBeNull();
    });

    it('should handle send to family failure', async () => {
      // Set up initial state with draft
      (RecordingService as any).updateState({ draft: mockDraft });
      
      mockRecordingUploadService.uploadRecordingDraft.mockImplementation(async (draft, options) => {
        options?.onError?.('Upload failed');
        return null;
      });
      
      const errorSpy = jest.fn();
      
      const result = await RecordingService.sendToFamily({
        onError: errorSpy
      });
      
      expect(result).toBeNull();
      expect(errorSpy).toHaveBeenCalledWith('Upload failed');
      
      // Upload progress should show error
      const state = RecordingService.getState();
      expect(state.uploadProgress?.status).toBe('failed');
    });

    it('should retry upload successfully', async () => {
      // Set up initial state with draft
      (RecordingService as any).updateState({ draft: mockDraft });
      
      mockRecordingUploadService.retryUpload.mockResolvedValue('story-123');
      mockEnhancedRecordingService.discardDraft.mockResolvedValue(undefined);
      
      const result = await RecordingService.retryUpload();
      
      expect(result).toBe('story-123');
      expect(mockRecordingUploadService.retryUpload).toHaveBeenCalledWith(
        mockDraft,
        expect.any(Object)
      );
    });

    it('should cancel upload successfully', async () => {
      // Set up initial state with draft
      (RecordingService as any).updateState({ draft: mockDraft });
      
      mockRecordingUploadService.cancelUpload.mockResolvedValue(undefined);
      
      await RecordingService.cancelUpload();
      
      expect(mockRecordingUploadService.cancelUpload).toHaveBeenCalledWith('test-session-123');
      
      const state = RecordingService.getState();
      expect(state.uploadProgress).toBeNull();
    });
  });

  describe('Utility Methods', () => {
    it('should update recording state', async () => {
      mockEnhancedRecordingService.getEnhancedRecordingState.mockResolvedValue(mockRecordingState);
      
      await RecordingService.updateRecordingState();
      
      const state = RecordingService.getState();
      expect(state.recording).toEqual(mockRecordingState);
    });

    it('should format duration', () => {
      expect(RecordingService.formatDuration(30000)).toBe('0:30');
    });

    it('should format file size', () => {
      expect(RecordingService.formatFileSize(1024 * 1024)).toBe('1.0 MB');
    });

    it('should check recording status', () => {
      expect(RecordingService.isRecording()).toBe(false);
      
      // Update state to recording
      (RecordingService as any).updateState({
        recording: { ...mockRecordingState, isRecording: true }
      });
      
      expect(RecordingService.isRecording()).toBe(true);
    });

    it('should check draft status', () => {
      expect(RecordingService.hasDraft()).toBe(false);
      
      // Update state with draft
      (RecordingService as any).updateState({ draft: mockDraft });
      
      expect(RecordingService.hasDraft()).toBe(true);
    });

    it('should check upload status', () => {
      expect(RecordingService.isUploading()).toBe(false);
      
      // Update state with upload progress
      (RecordingService as any).updateState({
        uploadProgress: {
          sessionId: 'test',
          bytesUploaded: 0,
          totalBytes: 1024,
          percentage: 0,
          status: 'uploading'
        }
      });
      
      expect(RecordingService.isUploading()).toBe(true);
    });
  });

  describe('Cleanup', () => {
    it('should cleanup successfully', async () => {
      // Set up some state
      const listener = jest.fn();
      RecordingService.subscribe(listener);
      (RecordingService as any).updateState({ draft: mockDraft });
      
      mockRecordingUploadService.cleanup.mockResolvedValue(undefined);
      
      await RecordingService.cleanup();
      
      expect(mockRecordingUploadService.cleanup).toHaveBeenCalled();
      
      // State should be reset
      const state = RecordingService.getState();
      expect(state.draft).toBeNull();
      expect(state.uploadProgress).toBeNull();
      
      // Listeners should be cleared
      expect((RecordingService as any).stateListeners).toHaveLength(0);
    });
  });
});