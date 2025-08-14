import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { Audio } from 'expo-av';

import { ReviewAndSendScreen } from '../ReviewAndSendScreen';
import { RecordingService } from '../../../services/recording-service';
import { LocalRecordingDraft, RecordingQuality } from '@saga/shared';

// Mock dependencies
jest.mock('expo-av');
jest.mock('../../../services/recording-service');
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 44, bottom: 34, left: 0, right: 0 }),
}));

const mockAudio = Audio as jest.Mocked<typeof Audio>;
const mockRecordingService = RecordingService as jest.Mocked<typeof RecordingService>;

describe('ReviewAndSendScreen', () => {
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

  const mockQuality: RecordingQuality = {
    isValid: true,
    duration: 30000,
    fileSize: 1024 * 1024,
    format: 'm4a',
    issues: []
  };

  const mockNavigation = {
    navigate: jest.fn(),
    goBack: jest.fn(),
  };

  const mockRoute = {
    params: {
      draft: mockDraft,
      quality: mockQuality,
    },
  };

  const mockSound = {
    createAsync: jest.fn(),
    getStatusAsync: jest.fn(),
    playAsync: jest.fn(),
    pauseAsync: jest.fn(),
    setPositionAsync: jest.fn(),
    unloadAsync: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock Audio.Sound
    mockAudio.Sound = {
      createAsync: jest.fn().mockResolvedValue({ sound: mockSound }),
    } as any;

    // Mock sound status
    mockSound.getStatusAsync.mockResolvedValue({
      isLoaded: true,
      durationMillis: 30000,
      positionMillis: 0,
      didJustFinish: false,
    });

    // Mock Alert
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders correctly with draft and quality data', async () => {
    const { getByText, getByLabelText } = render(
      <ReviewAndSendScreen navigation={mockNavigation} route={mockRoute} />
    );

    await waitFor(() => {
      expect(getByText('Review & Send')).toBeTruthy();
      expect(getByText('Send to Family')).toBeTruthy();
      expect(getByText('Re-record')).toBeTruthy();
      expect(getByText('Delete')).toBeTruthy();
      expect(getByLabelText('Play recording')).toBeTruthy();
    });
  });

  it('loads and plays audio correctly', async () => {
    const { getByLabelText } = render(
      <ReviewAndSendScreen navigation={mockNavigation} route={mockRoute} />
    );

    await waitFor(() => {
      expect(mockAudio.Sound.createAsync).toHaveBeenCalledWith(
        { uri: mockDraft.localAudioUri },
        { shouldPlay: false }
      );
    });

    // Test play button
    const playButton = getByLabelText('Play recording');
    fireEvent.press(playButton);

    await waitFor(() => {
      expect(mockSound.playAsync).toHaveBeenCalled();
    });
  });

  it('shows quality issues when recording is invalid', () => {
    const invalidQuality: RecordingQuality = {
      isValid: false,
      duration: 30000,
      fileSize: 60 * 1024 * 1024, // 60MB - exceeds limit
      format: 'm4a',
      issues: [
        {
          type: 'fileSize',
          severity: 'error',
          message: 'File size exceeds maximum allowed',
          suggestion: 'Try recording a shorter message'
        }
      ]
    };

    const invalidRoute = {
      params: {
        draft: mockDraft,
        quality: invalidQuality,
      },
    };

    const { getByText } = render(
      <ReviewAndSendScreen navigation={mockNavigation} route={invalidRoute} />
    );

    expect(getByText('Please fix the quality issues above before sending.')).toBeTruthy();
  });

  it('handles send to family flow', async () => {
    mockRecordingService.sendToFamily.mockResolvedValue('story-123');

    const { getByText } = render(
      <ReviewAndSendScreen navigation={mockNavigation} route={mockRoute} />
    );

    const sendButton = getByText('Send to Family');
    fireEvent.press(sendButton);

    // Should show confirmation dialog
    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith(
        'Send to Family',
        'Are you ready to send this recording to your family? Once sent, it cannot be changed.',
        expect.any(Array)
      );
    });
  });

  it('handles re-record action', async () => {
    const { getByText } = render(
      <ReviewAndSendScreen navigation={mockNavigation} route={mockRoute} />
    );

    const reRecordButton = getByText('Re-record');
    fireEvent.press(reRecordButton);

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith(
        'Re-record',
        'Are you sure you want to record again? This will discard the current recording.',
        expect.any(Array)
      );
    });
  });

  it('handles delete action', async () => {
    const { getByText } = render(
      <ReviewAndSendScreen navigation={mockNavigation} route={mockRoute} />
    );

    const deleteButton = getByText('Delete');
    fireEvent.press(deleteButton);

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith(
        'Delete Recording',
        'Are you sure you want to delete this recording? This action cannot be undone.',
        expect.any(Array)
      );
    });
  });

  it('disables send button when quality is invalid', () => {
    const invalidQuality: RecordingQuality = {
      isValid: false,
      duration: 30000,
      fileSize: 1024 * 1024,
      format: 'm4a',
      issues: [
        {
          type: 'duration',
          severity: 'error',
          message: 'Recording too short',
        }
      ]
    };

    const invalidRoute = {
      params: {
        draft: mockDraft,
        quality: invalidQuality,
      },
    };

    const { getByText } = render(
      <ReviewAndSendScreen navigation={mockNavigation} route={invalidRoute} />
    );

    const sendButton = getByText('Send to Family');
    expect(sendButton.props.accessibilityState?.disabled).toBe(true);
  });

  it('shows upload progress during upload', async () => {
    let progressCallback: (progress: any) => void;

    mockRecordingService.sendToFamily.mockImplementation(async (options) => {
      progressCallback = options.onProgress!;
      
      // Simulate progress
      setTimeout(() => {
        progressCallback({
          sessionId: mockDraft.sessionId,
          bytesUploaded: 512 * 1024,
          totalBytes: 1024 * 1024,
          percentage: 50,
          status: 'uploading'
        });
      }, 100);
      
      return 'story-123';
    });

    const { getByText, queryByText } = render(
      <ReviewAndSendScreen navigation={mockNavigation} route={mockRoute} />
    );

    const sendButton = getByText('Send to Family');
    fireEvent.press(sendButton);

    // Confirm in alert
    const alertCall = (Alert.alert as jest.Mock).mock.calls[0];
    const confirmButton = alertCall[2][1]; // Second button (Send)
    confirmButton.onPress();

    await waitFor(() => {
      expect(queryByText('Uploading to family...')).toBeTruthy();
    });
  });

  it('handles upload errors gracefully', async () => {
    mockRecordingService.sendToFamily.mockImplementation(async (options) => {
      options.onError?.('Network error');
      return null;
    });

    const { getByText } = render(
      <ReviewAndSendScreen navigation={mockNavigation} route={mockRoute} />
    );

    const sendButton = getByText('Send to Family');
    fireEvent.press(sendButton);

    // Confirm in alert
    const alertCall = (Alert.alert as jest.Mock).mock.calls[0];
    const confirmButton = alertCall[2][1];
    confirmButton.onPress();

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith(
        'Upload Failed',
        'Failed to send recording: Network error',
        expect.any(Array)
      );
    });
  });

  it('navigates back when back button is pressed', () => {
    const { getByLabelText } = render(
      <ReviewAndSendScreen navigation={mockNavigation} route={mockRoute} />
    );

    const backButton = getByLabelText('Go back');
    fireEvent.press(backButton);

    expect(mockNavigation.goBack).toHaveBeenCalled();
  });

  it('cleans up audio resources on unmount', async () => {
    const { unmount } = render(
      <ReviewAndSendScreen navigation={mockNavigation} route={mockRoute} />
    );

    await waitFor(() => {
      expect(mockAudio.Sound.createAsync).toHaveBeenCalled();
    });

    unmount();

    expect(mockSound.unloadAsync).toHaveBeenCalled();
  });
});