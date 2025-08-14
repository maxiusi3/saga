import { AudioRecordingService } from '../audio-recording-service';

// Mock expo-av
jest.mock('expo-av', () => ({
  Audio: {
    setAudioModeAsync: jest.fn(),
    Recording: jest.fn().mockImplementation(() => ({
      prepareToRecordAsync: jest.fn(),
      startAsync: jest.fn(),
      stopAndUnloadAsync: jest.fn(),
      pauseAsync: jest.fn(),
      getStatusAsync: jest.fn(),
      getURI: jest.fn(),
    })),
    RECORDING_OPTION_ANDROID_OUTPUT_FORMAT_MPEG_4: 'mpeg4',
    RECORDING_OPTION_ANDROID_AUDIO_ENCODER_AAC: 'aac',
    RECORDING_OPTION_IOS_OUTPUT_FORMAT_MPEG4AAC: 'mpeg4aac',
    RECORDING_OPTION_IOS_AUDIO_QUALITY_HIGH: 'high',
    RECORDING_OPTION_IOS_AUDIO_QUALITY_MEDIUM: 'medium',
    RECORDING_OPTION_IOS_AUDIO_QUALITY_LOW: 'low',
  },
}));

// Mock expo-file-system
jest.mock('expo-file-system', () => ({
  getInfoAsync: jest.fn(),
  deleteAsync: jest.fn(),
}));

// Mock permissions
jest.mock('../utils/permissions', () => ({
  requestAudioPermission: jest.fn(),
}));

describe('AudioRecordingService', () => {
  const mockAudio = require('expo-av').Audio;
  const mockFileSystem = require('expo-file-system');
  const mockPermissions = require('../utils/permissions');

  beforeEach(() => {
    jest.clearAllMocks();
    mockPermissions.requestAudioPermission.mockResolvedValue(true);
  });

  describe('initialize', () => {
    it('should initialize successfully with permissions', async () => {
      const result = await AudioRecordingService.initialize();
      
      expect(result).toBe(true);
      expect(mockPermissions.requestAudioPermission).toHaveBeenCalled();
      expect(mockAudio.setAudioModeAsync).toHaveBeenCalled();
    });

    it('should fail initialization without permissions', async () => {
      mockPermissions.requestAudioPermission.mockResolvedValue(false);
      
      const result = await AudioRecordingService.initialize();
      
      expect(result).toBe(false);
    });

    it('should handle initialization errors', async () => {
      mockAudio.setAudioModeAsync.mockRejectedValue(new Error('Audio mode error'));
      
      const result = await AudioRecordingService.initialize();
      
      expect(result).toBe(false);
    });
  });

  describe('startRecording', () => {
    beforeEach(async () => {
      await AudioRecordingService.initialize();
    });

    it('should start recording successfully', async () => {
      const mockRecording = {
        prepareToRecordAsync: jest.fn(),
        startAsync: jest.fn(),
        getStatusAsync: jest.fn().mockResolvedValue({ isRecording: true }),
        getURI: jest.fn().mockReturnValue('file://recording.m4a'),
      };
      
      mockAudio.Recording.mockImplementation(() => mockRecording);
      
      const result = await AudioRecordingService.startRecording();
      
      expect(result).toBe(true);
      expect(mockRecording.prepareToRecordAsync).toHaveBeenCalled();
      expect(mockRecording.startAsync).toHaveBeenCalled();
    });

    it('should handle recording start errors', async () => {
      const mockRecording = {
        prepareToRecordAsync: jest.fn().mockRejectedValue(new Error('Prepare error')),
      };
      
      mockAudio.Recording.mockImplementation(() => mockRecording);
      
      const result = await AudioRecordingService.startRecording();
      
      expect(result).toBe(false);
    });
  });

  describe('stopRecording', () => {
    it('should stop recording and return URI', async () => {
      const mockUri = 'file://recording.m4a';
      const mockRecording = {
        stopAndUnloadAsync: jest.fn(),
        getURI: jest.fn().mockReturnValue(mockUri),
      };
      
      // Simulate active recording
      AudioRecordingService['recording'] = mockRecording as any;
      
      const result = await AudioRecordingService.stopRecording();
      
      expect(result).toBe(mockUri);
      expect(mockRecording.stopAndUnloadAsync).toHaveBeenCalled();
    });

    it('should return null when no recording is active', async () => {
      const result = await AudioRecordingService.stopRecording();
      
      expect(result).toBeNull();
    });
  });

  describe('getRecordingStatus', () => {
    it('should return default state when no recording', async () => {
      const status = await AudioRecordingService.getRecordingStatus();
      
      expect(status).toEqual({
        isRecording: false,
        isPaused: false,
        duration: 0,
        uri: null,
        size: 0,
      });
    });

    it('should return recording status', async () => {
      const mockRecording = {
        getStatusAsync: jest.fn().mockResolvedValue({
          isRecording: true,
          durationMillis: 5000,
        }),
        getURI: jest.fn().mockReturnValue('file://recording.m4a'),
      };
      
      mockFileSystem.getInfoAsync.mockResolvedValue({
        exists: true,
        size: 1024,
      });
      
      AudioRecordingService['recording'] = mockRecording as any;
      
      const status = await AudioRecordingService.getRecordingStatus();
      
      expect(status.isRecording).toBe(true);
      expect(status.duration).toBe(5000);
      expect(status.size).toBe(1024);
    });
  });

  describe('utility methods', () => {
    it('should format duration correctly', () => {
      expect(AudioRecordingService.formatDuration(0)).toBe('0:00');
      expect(AudioRecordingService.formatDuration(30000)).toBe('0:30');
      expect(AudioRecordingService.formatDuration(90000)).toBe('1:30');
      expect(AudioRecordingService.formatDuration(3661000)).toBe('61:01');
    });

    it('should format file size correctly', () => {
      expect(AudioRecordingService.formatFileSize(0)).toBe('0 B');
      expect(AudioRecordingService.formatFileSize(1024)).toBe('1 KB');
      expect(AudioRecordingService.formatFileSize(1048576)).toBe('1 MB');
      expect(AudioRecordingService.formatFileSize(1073741824)).toBe('1 GB');
    });

    it('should validate file size', () => {
      const maxSize = 50 * 1024 * 1024; // 50MB
      
      expect(AudioRecordingService.isFileSizeValid(1024)).toBe(true);
      expect(AudioRecordingService.isFileSizeValid(maxSize)).toBe(true);
      expect(AudioRecordingService.isFileSizeValid(maxSize + 1)).toBe(false);
    });
  });
});