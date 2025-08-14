import { useState, useEffect, useCallback, useRef } from 'react';
import { Alert } from 'react-native';

import { AudioRecordingService, RecordingState, RecordingOptions } from '../services/audio-recording-service';
import { AUDIO_CONFIG } from '../utils/constants';

export interface UseAudioRecordingResult {
  // State
  recordingState: RecordingState;
  isInitialized: boolean;
  error: string | null;
  
  // Actions
  startRecording: (options?: RecordingOptions) => Promise<boolean>;
  stopRecording: () => Promise<string | null>;
  pauseRecording: () => Promise<boolean>;
  resumeRecording: () => Promise<boolean>;
  discardRecording: () => Promise<void>;
  
  // Utilities
  formatDuration: (ms: number) => string;
  formatFileSize: (bytes: number) => string;
  isMaxDurationReached: boolean;
  isMaxFileSizeReached: boolean;
}

export function useAudioRecording(): UseAudioRecordingResult {
  const [recordingState, setRecordingState] = useState<RecordingState>({
    isRecording: false,
    isPaused: false,
    duration: 0,
    uri: null,
    size: 0,
  });
  
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const statusUpdateInterval = useRef<NodeJS.Timeout | null>(null);
  const maxDurationMs = AUDIO_CONFIG.maxDuration * 1000;

  // Initialize audio recording service
  useEffect(() => {
    const initialize = async () => {
      try {
        const success = await AudioRecordingService.initialize();
        setIsInitialized(success);
        
        if (!success) {
          setError('Failed to initialize audio recording. Please check permissions.');
        }
      } catch (err: any) {
        setError(err.message || 'Failed to initialize audio recording');
        setIsInitialized(false);
      }
    };

    initialize();
  }, []);

  // Update recording status periodically
  const updateRecordingStatus = useCallback(async () => {
    try {
      const status = await AudioRecordingService.getRecordingStatus();
      setRecordingState(status);
    } catch (err: any) {
      console.error('Failed to update recording status:', err);
    }
  }, []);

  // Start status updates when recording
  useEffect(() => {
    if (recordingState.isRecording) {
      statusUpdateInterval.current = setInterval(updateRecordingStatus, 100);
    } else {
      if (statusUpdateInterval.current) {
        clearInterval(statusUpdateInterval.current);
        statusUpdateInterval.current = null;
      }
    }

    return () => {
      if (statusUpdateInterval.current) {
        clearInterval(statusUpdateInterval.current);
      }
    };
  }, [recordingState.isRecording, updateRecordingStatus]);

  const startRecording = useCallback(async (options: RecordingOptions = {}): Promise<boolean> => {
    if (!isInitialized) {
      setError('Audio recording not initialized');
      return false;
    }

    try {
      setError(null);
      
      const recordingOptions: RecordingOptions = {
        maxDuration: AUDIO_CONFIG.maxDuration,
        onProgress: (duration) => {
          // Progress is handled by status updates
        },
        onMaxDurationReached: () => {
          Alert.alert(
            'Recording Complete',
            `Maximum recording time of ${AUDIO_CONFIG.maxDuration / 60} minutes reached.`,
            [{ text: 'OK' }]
          );
        },
        ...options,
      };

      const success = await AudioRecordingService.startRecording(recordingOptions);
      
      if (success) {
        await updateRecordingStatus();
      } else {
        setError('Failed to start recording');
      }
      
      return success;
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to start recording';
      setError(errorMessage);
      return false;
    }
  }, [isInitialized, updateRecordingStatus]);

  const stopRecording = useCallback(async (): Promise<string | null> => {
    try {
      setError(null);
      const uri = await AudioRecordingService.stopRecording();
      await updateRecordingStatus();
      return uri;
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to stop recording';
      setError(errorMessage);
      return null;
    }
  }, [updateRecordingStatus]);

  const pauseRecording = useCallback(async (): Promise<boolean> => {
    try {
      setError(null);
      const success = await AudioRecordingService.pauseRecording();
      await updateRecordingStatus();
      return success;
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to pause recording';
      setError(errorMessage);
      return false;
    }
  }, [updateRecordingStatus]);

  const resumeRecording = useCallback(async (): Promise<boolean> => {
    try {
      setError(null);
      const success = await AudioRecordingService.resumeRecording();
      await updateRecordingStatus();
      return success;
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to resume recording';
      setError(errorMessage);
      return false;
    }
  }, [updateRecordingStatus]);

  const discardRecording = useCallback(async (): Promise<void> => {
    try {
      setError(null);
      await AudioRecordingService.discardRecording();
      await updateRecordingStatus();
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to discard recording';
      setError(errorMessage);
    }
  }, [updateRecordingStatus]);

  const formatDuration = useCallback((ms: number): string => {
    return AudioRecordingService.formatDuration(ms);
  }, []);

  const formatFileSize = useCallback((bytes: number): string => {
    return AudioRecordingService.formatFileSize(bytes);
  }, []);

  const isMaxDurationReached = recordingState.duration >= maxDurationMs;
  const isMaxFileSizeReached = !AudioRecordingService.isFileSizeValid(recordingState.size);

  return {
    recordingState,
    isInitialized,
    error,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    discardRecording,
    formatDuration,
    formatFileSize,
    isMaxDurationReached,
    isMaxFileSizeReached,
  };
}