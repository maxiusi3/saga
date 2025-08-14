import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import { Platform } from 'react-native';

import { AUDIO_CONFIG } from '../utils/constants';
import { requestAudioPermission } from '../utils/permissions';

export interface RecordingState {
  isRecording: boolean;
  isPaused: boolean;
  duration: number;
  uri: string | null;
  size: number;
}

export interface RecordingOptions {
  maxDuration?: number;
  quality?: 'low' | 'medium' | 'high';
  onProgress?: (duration: number) => void;
  onMaxDurationReached?: () => void;
}

class AudioRecordingServiceClass {
  private recording: Audio.Recording | null = null;
  private recordingStatus: Audio.RecordingStatus | null = null;
  private progressTimer: NodeJS.Timeout | null = null;
  private maxDuration: number = AUDIO_CONFIG.maxDuration * 1000; // Convert to milliseconds

  async initialize(): Promise<boolean> {
    try {
      // Request audio permissions
      const hasPermission = await requestAudioPermission();
      if (!hasPermission) {
        throw new Error('Audio permission not granted');
      }

      // Set audio mode for recording
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
        staysActiveInBackground: false,
      });

      return true;
    } catch (error) {
      console.error('Failed to initialize audio recording:', error);
      return false;
    }
  }

  async startRecording(options: RecordingOptions = {}): Promise<boolean> {
    try {
      if (this.recording) {
        console.warn('Recording already in progress');
        return false;
      }

      const maxDuration = options.maxDuration ? options.maxDuration * 1000 : this.maxDuration;

      // Configure recording options based on quality
      const recordingOptions = this.getRecordingOptions(options.quality || 'high');

      // Create and start recording
      this.recording = new Audio.Recording();
      await this.recording.prepareToRecordAsync(recordingOptions);
      await this.recording.startAsync();

      // Start progress tracking
      this.startProgressTracking(options.onProgress, maxDuration, options.onMaxDurationReached);

      return true;
    } catch (error) {
      console.error('Failed to start recording:', error);
      this.cleanup();
      return false;
    }
  }

  async stopRecording(): Promise<string | null> {
    try {
      if (!this.recording) {
        console.warn('No recording in progress');
        return null;
      }

      // Stop progress tracking
      this.stopProgressTracking();

      // Stop and unload recording
      await this.recording.stopAndUnloadAsync();
      const uri = this.recording.getURI();
      
      // Clean up
      this.recording = null;
      this.recordingStatus = null;

      return uri;
    } catch (error) {
      console.error('Failed to stop recording:', error);
      this.cleanup();
      return null;
    }
  }

  async pauseRecording(): Promise<boolean> {
    try {
      if (!this.recording) {
        return false;
      }

      await this.recording.pauseAsync();
      this.stopProgressTracking();
      return true;
    } catch (error) {
      console.error('Failed to pause recording:', error);
      return false;
    }
  }

  async resumeRecording(options: RecordingOptions = {}): Promise<boolean> {
    try {
      if (!this.recording) {
        return false;
      }

      await this.recording.startAsync();
      
      // Resume progress tracking
      const maxDuration = options.maxDuration ? options.maxDuration * 1000 : this.maxDuration;
      this.startProgressTracking(options.onProgress, maxDuration, options.onMaxDurationReached);
      
      return true;
    } catch (error) {
      console.error('Failed to resume recording:', error);
      return false;
    }
  }

  async getRecordingStatus(): Promise<RecordingState> {
    const defaultState: RecordingState = {
      isRecording: false,
      isPaused: false,
      duration: 0,
      uri: null,
      size: 0,
    };

    if (!this.recording) {
      return defaultState;
    }

    try {
      const status = await this.recording.getStatusAsync();
      
      let size = 0;
      if (status.isRecording && this.recording.getURI()) {
        try {
          const fileInfo = await FileSystem.getInfoAsync(this.recording.getURI()!);
          size = fileInfo.exists ? fileInfo.size || 0 : 0;
        } catch (error) {
          console.warn('Failed to get file size:', error);
        }
      }

      return {
        isRecording: status.isRecording || false,
        isPaused: status.isDoneRecording === false && !status.isRecording,
        duration: status.durationMillis || 0,
        uri: this.recording.getURI(),
        size,
      };
    } catch (error) {
      console.error('Failed to get recording status:', error);
      return defaultState;
    }
  }

  async discardRecording(): Promise<void> {
    try {
      if (this.recording) {
        const uri = this.recording.getURI();
        await this.recording.stopAndUnloadAsync();
        
        // Delete the file if it exists
        if (uri) {
          try {
            await FileSystem.deleteAsync(uri, { idempotent: true });
          } catch (error) {
            console.warn('Failed to delete recording file:', error);
          }
        }
      }
    } catch (error) {
      console.error('Failed to discard recording:', error);
    } finally {
      this.cleanup();
    }
  }

  private getRecordingOptions(quality: 'low' | 'medium' | 'high'): Audio.RecordingOptions {
    const baseOptions: Audio.RecordingOptions = {
      android: {
        extension: '.m4a',
        outputFormat: Audio.RECORDING_OPTION_ANDROID_OUTPUT_FORMAT_MPEG_4,
        audioEncoder: Audio.RECORDING_OPTION_ANDROID_AUDIO_ENCODER_AAC,
        numberOfChannels: AUDIO_CONFIG.numberOfChannels,
        bitRate: AUDIO_CONFIG.bitRate,
        sampleRate: AUDIO_CONFIG.sampleRate,
      },
      ios: {
        extension: '.m4a',
        outputFormat: Audio.RECORDING_OPTION_IOS_OUTPUT_FORMAT_MPEG4AAC,
        audioQuality: Audio.RECORDING_OPTION_IOS_AUDIO_QUALITY_HIGH,
        numberOfChannels: AUDIO_CONFIG.numberOfChannels,
        bitRate: AUDIO_CONFIG.bitRate,
        sampleRate: AUDIO_CONFIG.sampleRate,
      },
      web: {
        mimeType: 'audio/webm',
        bitsPerSecond: AUDIO_CONFIG.bitRate,
      },
    };

    // Adjust quality settings
    switch (quality) {
      case 'low':
        if (baseOptions.android) {
          baseOptions.android.bitRate = 64000;
          baseOptions.android.sampleRate = 22050;
        }
        if (baseOptions.ios) {
          baseOptions.ios.bitRate = 64000;
          baseOptions.ios.sampleRate = 22050;
          baseOptions.ios.audioQuality = Audio.RECORDING_OPTION_IOS_AUDIO_QUALITY_LOW;
        }
        break;
      case 'medium':
        if (baseOptions.android) {
          baseOptions.android.bitRate = 96000;
          baseOptions.android.sampleRate = 44100;
        }
        if (baseOptions.ios) {
          baseOptions.ios.bitRate = 96000;
          baseOptions.ios.sampleRate = 44100;
          baseOptions.ios.audioQuality = Audio.RECORDING_OPTION_IOS_AUDIO_QUALITY_MEDIUM;
        }
        break;
      // 'high' uses default values
    }

    return baseOptions;
  }

  private startProgressTracking(
    onProgress?: (duration: number) => void,
    maxDuration?: number,
    onMaxDurationReached?: () => void
  ): void {
    this.progressTimer = setInterval(async () => {
      try {
        const status = await this.getRecordingStatus();
        
        if (onProgress) {
          onProgress(status.duration);
        }

        // Check if max duration reached
        if (maxDuration && status.duration >= maxDuration) {
          if (onMaxDurationReached) {
            onMaxDurationReached();
          }
          await this.stopRecording();
        }
      } catch (error) {
        console.error('Error in progress tracking:', error);
      }
    }, 100); // Update every 100ms for smooth progress
  }

  private stopProgressTracking(): void {
    if (this.progressTimer) {
      clearInterval(this.progressTimer);
      this.progressTimer = null;
    }
  }

  private cleanup(): void {
    this.stopProgressTracking();
    this.recording = null;
    this.recordingStatus = null;
  }

  // Utility methods
  formatDuration(milliseconds: number): string {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }

  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  isFileSizeValid(bytes: number): boolean {
    return bytes <= AUDIO_CONFIG.maxFileSize;
  }
}

export const AudioRecordingService = new AudioRecordingServiceClass();