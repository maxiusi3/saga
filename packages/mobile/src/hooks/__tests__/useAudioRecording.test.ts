import { renderHook, act } from '@testing-library/react-native';
import { useAudioRecording } from '../useAudioRecording';

// Mock the audio recording service
jest.mock('../services/audio-recording-service', () => ({
  AudioRecordingService: {
    initialize: jest.fn(),
    startRecording: jest.fn(),
    stopRecording: jest.fn(),
    pauseRecording: jest.fn(),
    resumeRecording: jest.fn(),
    discardRecording: jest.fn(),
    getRecordingStatus: jest.fn(),
    formatDuration: jest.fn(),
    formatFileSize: jest.fn(),
    isFileSizeValid: jest.fn(),
  },
}));

// Mock Alert
jest.mock('react-native', () => ({
  Alert: {
    alert: jest.fn(),
  },
}));

describe('useAudioRecording', () => {
  const mockAudioService = require('../services/audio-recording-service').AudioRecordingService;

  beforeEach(() => {
    jest.clearAllMocks();
    mockAudioService.initialize.mockResolvedValue(true);
    mockAudioService.getRecordingStatus.mockResolvedValue({
      isRecording: false,
      isPaused: false,
      duration: 0,
      uri: null,
      size: 0,
    });
    mockAudioService.formatDuration.mockImplementation((ms) => `${Math.floor(ms / 1000)}s`);
    mockAudioService.formatFileSize.mockImplementation((bytes) => `${bytes}B`);
    mockAudioService.isFileSizeValid.mockReturnValue(true);
  });

  it('should initialize successfully', async () => {
    const { result } = renderHook(() => useAudioRecording());

    // Wait for initialization
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    expect(result.current.isInitialized).toBe(true);
    expect(result.current.error).toBeNull();
    expect(mockAudioService.initialize).toHaveBeenCalled();
  });

  it('should handle initialization failure', async () => {
    mockAudioService.initialize.mockResolvedValue(false);

    const { result } = renderHook(() => useAudioRecording());

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    expect(result.current.isInitialized).toBe(false);
    expect(result.current.error).toBe('Failed to initialize audio recording. Please check permissions.');
  });

  it('should start recording successfully', async () => {
    mockAudioService.startRecording.mockResolvedValue(true);

    const { result } = renderHook(() => useAudioRecording());

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    await act(async () => {
      const success = await result.current.startRecording();
      expect(success).toBe(true);
    });

    expect(mockAudioService.startRecording).toHaveBeenCalled();
    expect(result.current.error).toBeNull();
  });

  it('should handle recording start failure', async () => {
    mockAudioService.startRecording.mockResolvedValue(false);

    const { result } = renderHook(() => useAudioRecording());

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    await act(async () => {
      const success = await result.current.startRecording();
      expect(success).toBe(false);
    });

    expect(result.current.error).toBe('Failed to start recording');
  });

  it('should stop recording and return URI', async () => {
    const mockUri = 'file://recording.m4a';
    mockAudioService.stopRecording.mockResolvedValue(mockUri);

    const { result } = renderHook(() => useAudioRecording());

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    await act(async () => {
      const uri = await result.current.stopRecording();
      expect(uri).toBe(mockUri);
    });

    expect(mockAudioService.stopRecording).toHaveBeenCalled();
    expect(result.current.error).toBeNull();
  });

  it('should pause and resume recording', async () => {
    mockAudioService.pauseRecording.mockResolvedValue(true);
    mockAudioService.resumeRecording.mockResolvedValue(true);

    const { result } = renderHook(() => useAudioRecording());

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    await act(async () => {
      const pauseSuccess = await result.current.pauseRecording();
      expect(pauseSuccess).toBe(true);
    });

    await act(async () => {
      const resumeSuccess = await result.current.resumeRecording();
      expect(resumeSuccess).toBe(true);
    });

    expect(mockAudioService.pauseRecording).toHaveBeenCalled();
    expect(mockAudioService.resumeRecording).toHaveBeenCalled();
  });

  it('should discard recording', async () => {
    const { result } = renderHook(() => useAudioRecording());

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    await act(async () => {
      await result.current.discardRecording();
    });

    expect(mockAudioService.discardRecording).toHaveBeenCalled();
  });

  it('should format duration and file size', async () => {
    const { result } = renderHook(() => useAudioRecording());

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    const formattedDuration = result.current.formatDuration(5000);
    const formattedSize = result.current.formatFileSize(1024);

    expect(formattedDuration).toBe('5s');
    expect(formattedSize).toBe('1024B');
    expect(mockAudioService.formatDuration).toHaveBeenCalledWith(5000);
    expect(mockAudioService.formatFileSize).toHaveBeenCalledWith(1024);
  });

  it('should detect max duration reached', async () => {
    const maxDurationMs = 600 * 1000; // 10 minutes
    mockAudioService.getRecordingStatus.mockResolvedValue({
      isRecording: true,
      isPaused: false,
      duration: maxDurationMs,
      uri: null,
      size: 0,
    });

    const { result } = renderHook(() => useAudioRecording());

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    expect(result.current.isMaxDurationReached).toBe(true);
  });
});