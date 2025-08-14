import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import { MMKV } from 'react-native-mmkv';

import { EnhancedRecordingService } from '../enhanced-recording-service';
import { LocalRecordingDraft } from '@saga/shared';

// Mock dependencies
jest.mock('expo-av');
jest.mock('expo-file-system');
jest.mock('react-native-mmkv');
jest.mock('../utils/permissions');

const mockAudio = Audio as jest.Mocked<typeof Audio>;
const mockFileSystem = FileSystem as jest.Mocked<typeof FileSystem>;
const mockMMKV = MMKV as jest.MockedClass<typeof MMKV>;

describe('EnhancedRecordingService', () => {
  let mockRecording: jest.Mocked<Audio.Recording>;
  let mockStorage: jest.Mocked<MMKV>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock Audio.Recording
    mockRecording = {
      prepareToRecordAsync: jest.fn(),
      startAsync: jest.fn(),
      stopAndUnloadAsync: jest.fn(),
      getStatusAsync: jest.fn(),
      getURI: jest.fn(),
    } as any;

    // Mock MMKV storage
    mockStorage = {
      set: jest.fn(),
      getString: jest.fn(),
      delete: jest.fn(),
      getAllKeys: jest.fn(),
    } as any;

    mockMMKV.mockImplementation(() => mockStorage);

    // Mock Audio constructor
    (mockAudio.Recording as any) = jest.fn(() => mockRecording);

    // Mock Audio.setAudioModeAsync
    mockAudio.setAudioModeAsync = jest.fn().mockResolvedValue(undefined);

    // Mock FileSystem
    mockFileSystem.getInfoAsync = jest.fn();
    mockFileSystem.deleteAsync = jest.fn();
  });

  describe('Draft Management', () => {
    const mockDraft: LocalRecordingDraft = {
      sessionId: 'test-session-123',
      userId: 'user-123',
      projectId: 'project-123',
      localAudioUri: 'file://test-audio.m4a',
      duration: 30000,
      createdAt: new Date('2023-01-01T00:00:00Z'),
      promptId: 'prompt-123'
    };

    describe('saveDraft', () => {
      it('should save draft to MMKV storage', async () => {
        await EnhancedRecordingService.saveDraft(mockDraft);

        expect(mockStorage.set).toHaveBeenCalledWith(
          'draft_user-123',
          JSON.stringify({
            ...mockDraft,
            createdAt: '2023-01-01T00:00:00.000Z'
          })
        );
      });

      it('should handle save errors gracefully', async () => {
        mockStorage.set.mockImplementation(() => {
          throw new Error('Storage error');
        });

        await expect(EnhancedRecordingService.saveDraft(mockDraft))
          .rejects.toThrow('Failed to save recording draft');
      });
    });

    describe('recoverDraft', () => {
      it('should recover valid draft from storage', async () => {
        const draftData = JSON.stringify({
          ...mockDraft,
          createdAt: '2023-01-01T00:00:00.000Z'
        });

        mockStorage.getString.mockReturnValue(draftData);
        mockFileSystem.getInfoAsync.mockResolvedValue({ exists: true, size: 1024 } as any);

        const recovered = await EnhancedRecordingService.recoverDraft('user-123');

        expect(recovered).toEqual(mockDraft);
        expect(mockStorage.getString).toHaveBeenCalledWith('draft_user-123');
        expect(mockFileSystem.getInfoAsync).toHaveBeenCalledWith(mockDraft.localAudioUri);
      });

      it('should return null if no draft exists', async () => {
        mockStorage.getString.mockReturnValue(undefined);

        const recovered = await EnhancedRecordingService.recoverDraft('user-123');

        expect(recovered).toBeNull();
      });

      it('should clean up invalid draft if audio file missing', async () => {
        const draftData = JSON.stringify({
          ...mockDraft,
          createdAt: '2023-01-01T00:00:00.000Z'
        });

        mockStorage.getString.mockReturnValue(draftData);
        mockFileSystem.getInfoAsync.mockResolvedValue({ exists: false } as any);
        mockStorage.getAllKeys.mockReturnValue(['draft_user-123']);

        const recovered = await EnhancedRecordingService.recoverDraft('user-123');

        expect(recovered).toBeNull();
        expect(mockStorage.delete).toHaveBeenCalledWith('draft_user-123');
      });

      it('should handle recovery errors gracefully', async () => {
        mockStorage.getString.mockImplementation(() => {
          throw new Error('Storage error');
        });

        const recovered = await EnhancedRecordingService.recoverDraft('user-123');

        expect(recovered).toBeNull();
      });
    });

    describe('discardDraft', () => {
      it('should delete draft and associated files', async () => {
        const draftData = JSON.stringify({
          ...mockDraft,
          localPhotoUri: 'file://test-photo.jpg',
          createdAt: '2023-01-01T00:00:00.000Z'
        });

        mockStorage.getAllKeys.mockReturnValue(['draft_user-123']);
        mockStorage.getString.mockReturnValue(draftData);

        await EnhancedRecordingService.discardDraft('test-session-123');

        expect(mockFileSystem.deleteAsync).toHaveBeenCalledWith(
          mockDraft.localAudioUri,
          { idempotent: true }
        );
        expect(mockFileSystem.deleteAsync).toHaveBeenCalledWith(
          'file://test-photo.jpg',
          { idempotent: true }
        );
        expect(mockStorage.delete).toHaveBeenCalledWith('draft_user-123');
      });

      it('should handle file deletion errors gracefully', async () => {
        const draftData = JSON.stringify({
          ...mockDraft,
          createdAt: '2023-01-01T00:00:00.000Z'
        });

        mockStorage.getAllKeys.mockReturnValue(['draft_user-123']);
        mockStorage.getString.mockReturnValue(draftData);
        mockFileSystem.deleteAsync.mockRejectedValue(new Error('Delete failed'));

        // Should not throw despite file deletion error
        await expect(EnhancedRecordingService.discardDraft('test-session-123'))
          .resolves.not.toThrow();

        expect(mockStorage.delete).toHaveBeenCalledWith('draft_user-123');
      });
    });
  });

  describe('Recording Quality Validation', () => {
    it('should validate recording quality successfully', async () => {
      const audioUri = 'file://test-recording.m4a';
      
      mockFileSystem.getInfoAsync.mockResolvedValue({
        exists: true,
        size: 1024 * 1024 // 1MB
      } as any);

      // Mock recording status for duration
      (EnhancedRecordingService as any).recordingStatus = {
        durationMillis: 30000 // 30 seconds
      };

      const quality = await EnhancedRecordingService.validateRecordingQuality(audioUri);

      expect(quality.isValid).toBe(true);
      expect(quality.duration).toBe(30000);
      expect(quality.fileSize).toBe(1024 * 1024);
      expect(quality.format).toBe('m4a');
      expect(quality.issues).toHaveLength(0);
    });

    it('should detect file size issues', async () => {
      const audioUri = 'file://test-recording.m4a';
      const largeFileSize = 60 * 1024 * 1024; // 60MB (exceeds 50MB limit)
      
      mockFileSystem.getInfoAsync.mockResolvedValue({
        exists: true,
        size: largeFileSize
      } as any);

      (EnhancedRecordingService as any).recordingStatus = {
        durationMillis: 30000
      };

      const quality = await EnhancedRecordingService.validateRecordingQuality(audioUri);

      expect(quality.isValid).toBe(false);
      expect(quality.issues).toHaveLength(1);
      expect(quality.issues[0].type).toBe('fileSize');
      expect(quality.issues[0].severity).toBe('error');
    });

    it('should detect duration issues', async () => {
      const audioUri = 'file://test-recording.m4a';
      
      mockFileSystem.getInfoAsync.mockResolvedValue({
        exists: true,
        size: 1024 * 1024
      } as any);

      // Mock long duration (over 10 minutes)
      (EnhancedRecordingService as any).recordingStatus = {
        durationMillis: 11 * 60 * 1000 // 11 minutes
      };

      const quality = await EnhancedRecordingService.validateRecordingQuality(audioUri);

      expect(quality.isValid).toBe(false);
      expect(quality.issues).toHaveLength(1);
      expect(quality.issues[0].type).toBe('duration');
      expect(quality.issues[0].severity).toBe('error');
    });

    it('should detect short recording warning', async () => {
      const audioUri = 'file://test-recording.m4a';
      
      mockFileSystem.getInfoAsync.mockResolvedValue({
        exists: true,
        size: 1024
      } as any);

      // Mock very short duration
      (EnhancedRecordingService as any).recordingStatus = {
        durationMillis: 1000 // 1 second
      };

      const quality = await EnhancedRecordingService.validateRecordingQuality(audioUri);

      expect(quality.isValid).toBe(true); // Still valid, just a warning
      expect(quality.issues).toHaveLength(1);
      expect(quality.issues[0].type).toBe('duration');
      expect(quality.issues[0].severity).toBe('warning');
    });

    it('should handle missing file', async () => {
      const audioUri = 'file://missing-recording.m4a';
      
      mockFileSystem.getInfoAsync.mockResolvedValue({
        exists: false
      } as any);

      const quality = await EnhancedRecordingService.validateRecordingQuality(audioUri);

      expect(quality.isValid).toBe(false);
      expect(quality.issues).toHaveLength(1);
      expect(quality.issues[0].type).toBe('corruption');
      expect(quality.issues[0].severity).toBe('error');
    });
  });

  describe('Recording Operations', () => {
    it('should start recording successfully', async () => {
      mockRecording.prepareToRecordAsync.mockResolvedValue(undefined);
      mockRecording.startAsync.mockResolvedValue(undefined);

      const sessionId = await EnhancedRecordingService.startRecording(
        'user-123',
        'project-123',
        'prompt-123'
      );

      expect(sessionId).toBeTruthy();
      expect(mockRecording.prepareToRecordAsync).toHaveBeenCalled();
      expect(mockRecording.startAsync).toHaveBeenCalled();
    });

    it('should stop recording successfully', async () => {
      const mockUri = 'file://test-recording.m4a';
      
      // Set up recording state
      (EnhancedRecordingService as any).recording = mockRecording;
      
      mockRecording.stopAndUnloadAsync.mockResolvedValue(undefined);
      mockRecording.getURI.mockReturnValue(mockUri);
      mockRecording.getStatusAsync.mockResolvedValue({
        durationMillis: 30000,
        isRecording: false
      } as any);

      const uri = await EnhancedRecordingService.stopRecording();

      expect(uri).toBe(mockUri);
      expect(mockRecording.stopAndUnloadAsync).toHaveBeenCalled();
    });

    it('should create draft from recording', async () => {
      const mockUri = 'file://test-recording.m4a';
      
      // Set up recording state
      (EnhancedRecordingService as any).currentSessionId = 'test-session-123';
      (EnhancedRecordingService as any).recordingStatus = {
        durationMillis: 30000
      };

      const draft = await EnhancedRecordingService.createDraftFromRecording(
        'user-123',
        'project-123',
        mockUri,
        'file://photo.jpg',
        'prompt-123'
      );

      expect(draft).toBeTruthy();
      expect(draft?.sessionId).toBe('test-session-123');
      expect(draft?.localAudioUri).toBe(mockUri);
      expect(draft?.localPhotoUri).toBe('file://photo.jpg');
      expect(draft?.duration).toBe(30000);
    });
  });

  describe('Utility Methods', () => {
    it('should format duration correctly', () => {
      expect(EnhancedRecordingService.formatDuration(0)).toBe('0:00');
      expect(EnhancedRecordingService.formatDuration(30000)).toBe('0:30');
      expect(EnhancedRecordingService.formatDuration(90000)).toBe('1:30');
      expect(EnhancedRecordingService.formatDuration(3661000)).toBe('61:01');
    });

    it('should format file size correctly', () => {
      expect(EnhancedRecordingService.formatFileSize(0)).toBe('0 B');
      expect(EnhancedRecordingService.formatFileSize(1024)).toBe('1.0 KB');
      expect(EnhancedRecordingService.formatFileSize(1024 * 1024)).toBe('1.0 MB');
      expect(EnhancedRecordingService.formatFileSize(1536 * 1024)).toBe('1.5 MB');
    });

    it('should validate file size correctly', () => {
      expect(EnhancedRecordingService.isFileSizeValid(1024)).toBe(true);
      expect(EnhancedRecordingService.isFileSizeValid(50 * 1024 * 1024)).toBe(true);
      expect(EnhancedRecordingService.isFileSizeValid(60 * 1024 * 1024)).toBe(false);
    });

    it('should validate duration correctly', () => {
      expect(EnhancedRecordingService.isDurationValid(30000)).toBe(true);
      expect(EnhancedRecordingService.isDurationValid(600000)).toBe(true);
      expect(EnhancedRecordingService.isDurationValid(700000)).toBe(false);
      expect(EnhancedRecordingService.isDurationValid(500)).toBe(false);
    });
  });
});