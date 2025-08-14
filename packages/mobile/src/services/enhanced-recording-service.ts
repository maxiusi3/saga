import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import { Platform } from 'react-native';
import { MMKV } from 'react-native-mmkv';

import { LocalRecordingDraft, RecordingQuality, RecordingUploadProgress, RecordingMetadata } from '@saga/shared';
import { AUDIO_CONFIG } from '../utils/constants';
import { requestAudioPermission } from '../utils/permissions';
import { apiClient } from './api-client';

// MMKV storage instance for drafts
const draftStorage = new MMKV({
  id: 'recording-drafts',
  encryptionKey: 'saga-recording-drafts-key'
});

export interface EnhancedRecordingState {
  isRecording: boolean;
  isPaused: boolean;
  duration: number;
  uri: string | null;
  size: number;
  quality: RecordingQuality | null;
  metadata: Partial<RecordingMetadata>;
}

export interface ReviewAndSendOptions {
  onUploadProgress?: (progress: RecordingUploadProgress) => void;
  onUploadComplete?: (storyId: string) => void;
  onUploadError?: (error: string) => void;
}

class EnhancedRecordingServiceClass {
  private recording: Audio.Recording | null = null;
  private recordingStatus: Audio.RecordingStatus | null = null;
  private progressTimer: NodeJS.Timeout | null = null;
  private maxDuration: number = AUDIO_CONFIG.maxDuration * 1000; // Convert to milliseconds
  private currentSessionId: string | null = null;
  private currentUserId: string | null = null;
  private currentProjectId: string | null = null;
  private recordingStartTime: Date | null = null;
  private retryCount: number = 0;

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
      console.error('Failed to initialize enhanced recording:', error);
      return false;
    }
  }

  // === Draft Management ===

  async saveDraft(draft: LocalRecordingDraft): Promise<void> {
    try {
      const draftKey = `draft_${draft.userId}`;
      const draftData = JSON.stringify({
        ...draft,
        createdAt: draft.createdAt.toISOString()
      });
      
      draftStorage.set(draftKey, draftData);
      console.log('Draft saved successfully:', draft.sessionId);
    } catch (error) {
      console.error('Failed to save draft:', error);
      throw new Error('Failed to save recording draft');
    }
  }

  async recoverDraft(userId: string): Promise<LocalRecordingDraft | null> {
    try {
      const draftKey = `draft_${userId}`;
      const draftData = draftStorage.getString(draftKey);
      
      if (!draftData) {
        return null;
      }

      const parsedDraft = JSON.parse(draftData);
      
      // Verify the audio file still exists
      const fileInfo = await FileSystem.getInfoAsync(parsedDraft.localAudioUri);
      if (!fileInfo.exists) {
        // Clean up invalid draft
        await this.discardDraft(parsedDraft.sessionId);
        return null;
      }

      return {
        ...parsedDraft,
        createdAt: new Date(parsedDraft.createdAt)
      };
    } catch (error) {
      console.error('Failed to recover draft:', error);
      return null;
    }
  }

  async discardDraft(sessionId: string): Promise<void> {
    try {
      // Find and remove draft by sessionId
      const allKeys = draftStorage.getAllKeys();
      
      for (const key of allKeys) {
        if (key.startsWith('draft_')) {
          const draftData = draftStorage.getString(key);
          if (draftData) {
            const draft = JSON.parse(draftData);
            if (draft.sessionId === sessionId) {
              // Track analytics event before discarding
              if (this.currentSessionId === sessionId) {
                await this.trackRecordingDiscarded();
              }

              // Delete the audio file
              try {
                await FileSystem.deleteAsync(draft.localAudioUri, { idempotent: true });
              } catch (error) {
                console.warn('Failed to delete draft audio file:', error);
              }

              // Delete the photo file if exists
              if (draft.localPhotoUri) {
                try {
                  await FileSystem.deleteAsync(draft.localPhotoUri, { idempotent: true });
                } catch (error) {
                  console.warn('Failed to delete draft photo file:', error);
                }
              }

              // Remove from storage
              draftStorage.delete(key);
              console.log('Draft discarded successfully:', sessionId);
              return;
            }
          }
        }
      }
    } catch (error) {
      console.error('Failed to discard draft:', error);
      throw new Error('Failed to discard recording draft');
    }
  }

  // === Recording Quality Validation ===

  async validateRecordingQuality(uri: string): Promise<RecordingQuality> {
    const issues: RecordingQuality['issues'] = [];
    
    try {
      const fileInfo = await FileSystem.getInfoAsync(uri);
      
      if (!fileInfo.exists) {
        return {
          isValid: false,
          duration: 0,
          fileSize: 0,
          format: 'unknown',
          issues: [{
            type: 'corruption',
            severity: 'error',
            message: 'Recording file does not exist',
            suggestion: 'Please try recording again'
          }]
        };
      }

      const fileSize = fileInfo.size || 0;
      
      // Get audio duration (this is approximate from recording status)
      const duration = this.recordingStatus?.durationMillis || 0;
      
      // Validate file size
      if (fileSize > AUDIO_CONFIG.maxFileSize) {
        issues.push({
          type: 'fileSize',
          severity: 'error',
          message: `File size (${this.formatFileSize(fileSize)}) exceeds maximum allowed (${this.formatFileSize(AUDIO_CONFIG.maxFileSize)})`,
          suggestion: 'Try recording a shorter message or use lower quality settings'
        });
      }

      // Validate duration
      if (duration > AUDIO_CONFIG.maxDuration * 1000) {
        issues.push({
          type: 'duration',
          severity: 'error',
          message: `Recording duration (${this.formatDuration(duration)}) exceeds maximum allowed (${AUDIO_CONFIG.maxDuration / 60} minutes)`,
          suggestion: 'Please keep recordings under 10 minutes'
        });
      }

      // Validate minimum duration (2 seconds)
      if (duration < 2000) {
        issues.push({
          type: 'duration',
          severity: 'warning',
          message: 'Recording is very short',
          suggestion: 'Consider recording a longer message for better context'
        });
      }

      // Check file format
      const format = uri.split('.').pop()?.toLowerCase() || 'unknown';
      if (!['m4a', 'mp4', 'wav'].includes(format)) {
        issues.push({
          type: 'format',
          severity: 'warning',
          message: `Unexpected file format: ${format}`,
          suggestion: 'Recording may not play correctly on all devices'
        });
      }

      const hasErrors = issues.some(issue => issue.severity === 'error');

      return {
        isValid: !hasErrors,
        duration,
        fileSize,
        format,
        sampleRate: AUDIO_CONFIG.sampleRate,
        bitRate: AUDIO_CONFIG.bitRate,
        issues
      };
    } catch (error) {
      console.error('Failed to validate recording quality:', error);
      return {
        isValid: false,
        duration: 0,
        fileSize: 0,
        format: 'unknown',
        issues: [{
          type: 'corruption',
          severity: 'error',
          message: 'Failed to analyze recording quality',
          suggestion: 'Please try recording again'
        }]
      };
    }
  }

  // === Recording Metadata Collection ===

  private async collectRecordingMetadata(): Promise<Partial<RecordingMetadata>> {
    try {
      return {
        deviceInfo: {
          platform: Platform.OS as 'ios' | 'android',
          version: Platform.Version.toString(),
          // model: await DeviceInfo.getModel(), // Would need react-native-device-info
        },
        recordingEnvironment: {
          hasHeadphones: false, // Would need to detect headphones
          backgroundNoise: 'medium', // Would need audio analysis
          location: 'indoor', // Would need location/environment detection
        },
        userBehavior: {
          retryCount: 0,
          reviewDuration: 0,
          editedTranscript: false,
        }
      };
    } catch (error) {
      console.error('Failed to collect recording metadata:', error);
      return {};
    }
  }

  // === Enhanced Recording Methods ===

  async startRecording(userId: string, projectId: string, promptId?: string, userPromptId?: string): Promise<string | null> {
    try {
      if (this.recording) {
        console.warn('Recording already in progress');
        return null;
      }

      // Generate session ID and store context
      this.currentSessionId = `recording_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      this.currentUserId = userId;
      this.currentProjectId = projectId;
      this.recordingStartTime = new Date();
      this.retryCount = 0;

      // Configure recording options
      const recordingOptions = this.getRecordingOptions('high');

      // Create and start recording
      this.recording = new Audio.Recording();
      await this.recording.prepareToRecordAsync(recordingOptions);
      await this.recording.startAsync();

      // Start progress tracking
      this.startProgressTracking();

      // Track analytics event
      await this.trackAnalyticsEvent('recording_started', {
        metadata: await this.collectRecordingMetadata(),
      });

      console.log('Recording started with session ID:', this.currentSessionId);
      return this.currentSessionId;
    } catch (error) {
      console.error('Failed to start recording:', error);
      this.cleanup();
      return null;
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
      
      if (!uri) {
        console.error('No recording URI available');
        this.cleanup();
        return null;
      }

      // Store recording status for quality validation
      this.recordingStatus = await this.recording.getStatusAsync();

      // Track analytics event
      const duration = this.recordingStatus?.durationMillis || 0;
      await this.trackAnalyticsEvent('recording_stopped', {
        duration,
        metadata: await this.collectRecordingMetadata(),
      });

      console.log('Recording stopped, URI:', uri);
      return uri;
    } catch (error) {
      console.error('Failed to stop recording:', error);
      this.cleanup();
      return null;
    }
  }

  async createDraftFromRecording(
    userId: string,
    projectId: string,
    audioUri: string,
    photoUri?: string,
    promptId?: string,
    userPromptId?: string,
    chapterId?: string
  ): Promise<LocalRecordingDraft | null> {
    try {
      if (!this.currentSessionId) {
        throw new Error('No active recording session');
      }

      const duration = this.recordingStatus?.durationMillis || 0;
      
      const draft: LocalRecordingDraft = {
        sessionId: this.currentSessionId,
        userId,
        projectId,
        localAudioUri: audioUri,
        duration,
        localPhotoUri: photoUri,
        createdAt: new Date(),
        promptId,
        userPromptId,
        chapterId
      };

      await this.saveDraft(draft);

      // Track analytics event for review stage
      const quality = await this.validateRecordingQuality(audioUri);
      await this.trackAnalyticsEvent('recording_reviewed', {
        duration,
        quality,
        metadata: await this.collectRecordingMetadata(),
      });

      return draft;
    } catch (error) {
      console.error('Failed to create draft from recording:', error);
      return null;
    }
  }

  /**
   * Track recording retry
   */
  async trackRecordingRetry(): Promise<void> {
    this.retryCount++;
    await this.trackAnalyticsEvent('recording_retry', {
      retryCount: this.retryCount,
      metadata: await this.collectRecordingMetadata(),
    });
  }

  /**
   * Track recording sent
   */
  async trackRecordingSent(duration: number, quality: RecordingQuality): Promise<void> {
    await this.trackAnalyticsEvent('recording_sent', {
      duration,
      quality,
      retryCount: this.retryCount,
      metadata: await this.collectRecordingMetadata(),
    });
  }

  /**
   * Track recording discarded
   */
  async trackRecordingDiscarded(): Promise<void> {
    await this.trackAnalyticsEvent('recording_discarded', {
      retryCount: this.retryCount,
      metadata: await this.collectRecordingMetadata(),
    });
  }

  async getEnhancedRecordingState(): Promise<EnhancedRecordingState> {
    const basicState = await this.getBasicRecordingState();
    
    let quality: RecordingQuality | null = null;
    if (basicState.uri) {
      quality = await this.validateRecordingQuality(basicState.uri);
    }

    const metadata = await this.collectRecordingMetadata();

    return {
      ...basicState,
      quality,
      metadata
    };
  }

  // === Utility Methods ===

  private async getBasicRecordingState() {
    const defaultState = {
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

  private startProgressTracking(): void {
    this.progressTimer = setInterval(async () => {
      try {
        const status = await this.getBasicRecordingState();
        
        // Check if max duration reached
        if (status.duration >= this.maxDuration) {
          console.log('Max duration reached, stopping recording');
          await this.stopRecording();
        }
      } catch (error) {
        console.error('Error in progress tracking:', error);
      }
    }, 100); // Update every 100ms
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
    this.currentSessionId = null;
    this.currentUserId = null;
    this.currentProjectId = null;
    this.recordingStartTime = null;
    this.retryCount = 0;
  }

  /**
   * Track analytics event
   */
  private async trackAnalyticsEvent(
    eventType: 'recording_started' | 'recording_stopped' | 'recording_reviewed' | 'recording_sent' | 'recording_discarded' | 'recording_retry',
    data: {
      duration?: number;
      quality?: RecordingQuality;
      retryCount?: number;
      reviewDuration?: number;
      metadata?: Partial<RecordingMetadata>;
    } = {}
  ): Promise<void> {
    try {
      if (!this.currentSessionId || !this.currentUserId || !this.currentProjectId) {
        console.warn('Missing session context for analytics tracking');
        return;
      }

      await apiClient.post('/recording-analytics/events', {
        sessionId: this.currentSessionId,
        projectId: this.currentProjectId,
        eventType,
        ...data,
      });
    } catch (error) {
      console.warn('Failed to track analytics event:', error);
      // Don't throw - analytics failures shouldn't break the main flow
    }
  }

  // === Utility Formatting Methods ===

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

  isDurationValid(milliseconds: number): boolean {
    return milliseconds <= AUDIO_CONFIG.maxDuration * 1000 && milliseconds >= 1000; // At least 1 second
  }
}

export const EnhancedRecordingService = new EnhancedRecordingServiceClass();