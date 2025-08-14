/**
 * Comprehensive Recording Service for v1.5 "Review & Send" workflow
 * Combines recording, draft management, quality validation, and upload functionality
 */

import { LocalRecordingDraft, RecordingQuality, RecordingUploadProgress } from '@saga/shared';
import { EnhancedRecordingService, EnhancedRecordingState } from './enhanced-recording-service';
import { RecordingUploadService, UploadOptions } from './recording-upload-service';

export interface RecordingServiceState {
  recording: EnhancedRecordingState;
  draft: LocalRecordingDraft | null;
  uploadProgress: RecordingUploadProgress | null;
}

export interface StartRecordingOptions {
  userId: string;
  projectId: string;
  promptId?: string;
  userPromptId?: string;
  chapterId?: string;
}

export interface ReviewAndSendOptions extends UploadOptions {
  photoUri?: string;
}

class RecordingServiceClass {
  private currentState: RecordingServiceState = {
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

  private stateListeners: Array<(state: RecordingServiceState) => void> = [];

  // === State Management ===

  getState(): RecordingServiceState {
    return { ...this.currentState };
  }

  subscribe(listener: (state: RecordingServiceState) => void): () => void {
    this.stateListeners.push(listener);
    
    // Return unsubscribe function
    return () => {
      const index = this.stateListeners.indexOf(listener);
      if (index > -1) {
        this.stateListeners.splice(index, 1);
      }
    };
  }

  private notifyStateChange(): void {
    this.stateListeners.forEach(listener => {
      try {
        listener(this.getState());
      } catch (error) {
        console.error('Error in state listener:', error);
      }
    });
  }

  private updateState(updates: Partial<RecordingServiceState>): void {
    this.currentState = {
      ...this.currentState,
      ...updates
    };
    this.notifyStateChange();
  }

  // === Recording Workflow ===

  async initialize(): Promise<boolean> {
    try {
      const success = await EnhancedRecordingService.initialize();
      if (success) {
        console.log('Recording service initialized successfully');
      }
      return success;
    } catch (error) {
      console.error('Failed to initialize recording service:', error);
      return false;
    }
  }

  async startRecording(options: StartRecordingOptions): Promise<boolean> {
    try {
      const { userId, projectId, promptId, userPromptId, chapterId } = options;

      // Clear any existing draft
      if (this.currentState.draft) {
        await this.discardDraft();
      }

      // Start recording
      const sessionId = await EnhancedRecordingService.startRecording(
        userId,
        projectId,
        promptId,
        userPromptId
      );

      if (!sessionId) {
        throw new Error('Failed to start recording');
      }

      // Update state
      const recordingState = await EnhancedRecordingService.getEnhancedRecordingState();
      this.updateState({
        recording: recordingState,
        draft: null,
        uploadProgress: null
      });

      console.log('Recording started successfully');
      return true;
    } catch (error) {
      console.error('Failed to start recording:', error);
      return false;
    }
  }

  async stopRecording(): Promise<boolean> {
    try {
      const audioUri = await EnhancedRecordingService.stopRecording();
      
      if (!audioUri) {
        throw new Error('Failed to stop recording');
      }

      // Update recording state
      const recordingState = await EnhancedRecordingService.getEnhancedRecordingState();
      this.updateState({
        recording: recordingState
      });

      console.log('Recording stopped successfully');
      return true;
    } catch (error) {
      console.error('Failed to stop recording:', error);
      return false;
    }
  }

  async createDraft(
    userId: string,
    projectId: string,
    photoUri?: string,
    promptId?: string,
    userPromptId?: string,
    chapterId?: string
  ): Promise<boolean> {
    try {
      const recordingState = await EnhancedRecordingService.getEnhancedRecordingState();
      
      if (!recordingState.uri) {
        throw new Error('No recording available to create draft');
      }

      const draft = await EnhancedRecordingService.createDraftFromRecording(
        userId,
        projectId,
        recordingState.uri,
        photoUri,
        promptId,
        userPromptId,
        chapterId
      );

      if (!draft) {
        throw new Error('Failed to create draft');
      }

      this.updateState({ draft });
      console.log('Draft created successfully');
      return true;
    } catch (error) {
      console.error('Failed to create draft:', error);
      return false;
    }
  }

  async recoverDraft(userId: string): Promise<boolean> {
    try {
      const draft = await EnhancedRecordingService.recoverDraft(userId);
      
      if (draft) {
        this.updateState({ draft });
        console.log('Draft recovered successfully');
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Failed to recover draft:', error);
      return false;
    }
  }

  async discardDraft(): Promise<void> {
    try {
      if (this.currentState.draft) {
        await EnhancedRecordingService.discardDraft(this.currentState.draft.sessionId);
        this.updateState({ draft: null });
        console.log('Draft discarded successfully');
      }
    } catch (error) {
      console.error('Failed to discard draft:', error);
      throw error;
    }
  }

  // === Review & Send Workflow ===

  async validateCurrentRecording(): Promise<RecordingQuality | null> {
    try {
      const recordingState = await EnhancedRecordingService.getEnhancedRecordingState();
      
      if (!recordingState.uri) {
        return null;
      }

      const quality = await EnhancedRecordingService.validateRecordingQuality(recordingState.uri);
      
      // Update state with quality info
      this.updateState({
        recording: {
          ...recordingState,
          quality
        }
      });

      return quality;
    } catch (error) {
      console.error('Failed to validate recording:', error);
      return null;
    }
  }

  async sendToFamily(options: ReviewAndSendOptions = {}): Promise<string | null> {
    try {
      const { draft } = this.currentState;
      
      if (!draft) {
        throw new Error('No draft available to send');
      }

      // Set up progress tracking
      const uploadOptions: UploadOptions = {
        ...options,
        onProgress: (progress) => {
          this.updateState({ uploadProgress: progress });
          options.onProgress?.(progress);
        },
        onComplete: (storyId) => {
          this.updateState({ 
            uploadProgress: null,
            draft: null 
          });
          options.onComplete?.(storyId);
        },
        onError: (error) => {
          this.updateState({ 
            uploadProgress: {
              sessionId: draft.sessionId,
              bytesUploaded: 0,
              totalBytes: 0,
              percentage: 0,
              status: 'failed',
              error
            }
          });
          options.onError?.(error);
        }
      };

      // Upload the draft
      const storyId = await RecordingUploadService.uploadRecordingDraft(draft, uploadOptions);
      
      if (storyId) {
        // Clean up draft after successful upload
        await this.discardDraft();
        console.log('Recording sent to family successfully');
      }

      return storyId;
    } catch (error) {
      console.error('Failed to send recording to family:', error);
      
      if (this.currentState.draft) {
        this.updateState({
          uploadProgress: {
            sessionId: this.currentState.draft.sessionId,
            bytesUploaded: 0,
            totalBytes: 0,
            percentage: 0,
            status: 'failed',
            error: error instanceof Error ? error.message : 'Upload failed'
          }
        });
      }
      
      return null;
    }
  }

  async retryUpload(): Promise<string | null> {
    try {
      const { draft } = this.currentState;
      
      if (!draft) {
        throw new Error('No draft available to retry');
      }

      const storyId = await RecordingUploadService.retryUpload(draft, {
        onProgress: (progress) => {
          this.updateState({ uploadProgress: progress });
        },
        onComplete: (storyId) => {
          this.updateState({ 
            uploadProgress: null,
            draft: null 
          });
        },
        onError: (error) => {
          this.updateState({ 
            uploadProgress: {
              sessionId: draft.sessionId,
              bytesUploaded: 0,
              totalBytes: 0,
              percentage: 0,
              status: 'failed',
              error
            }
          });
        }
      });

      if (storyId) {
        await this.discardDraft();
        console.log('Recording retry successful');
      }

      return storyId;
    } catch (error) {
      console.error('Failed to retry upload:', error);
      return null;
    }
  }

  async cancelUpload(): Promise<void> {
    try {
      if (this.currentState.draft) {
        await RecordingUploadService.cancelUpload(this.currentState.draft.sessionId);
        this.updateState({ uploadProgress: null });
        console.log('Upload cancelled');
      }
    } catch (error) {
      console.error('Failed to cancel upload:', error);
    }
  }

  // === Utility Methods ===

  async updateRecordingState(): Promise<void> {
    try {
      const recordingState = await EnhancedRecordingService.getEnhancedRecordingState();
      this.updateState({ recording: recordingState });
    } catch (error) {
      console.error('Failed to update recording state:', error);
    }
  }

  formatDuration(milliseconds: number): string {
    return EnhancedRecordingService.formatDuration(milliseconds);
  }

  formatFileSize(bytes: number): string {
    return EnhancedRecordingService.formatFileSize(bytes);
  }

  isRecording(): boolean {
    return this.currentState.recording.isRecording;
  }

  hasDraft(): boolean {
    return this.currentState.draft !== null;
  }

  isUploading(): boolean {
    return this.currentState.uploadProgress?.status === 'uploading';
  }

  getUploadProgress(): RecordingUploadProgress | null {
    return this.currentState.uploadProgress;
  }

  // === Cleanup ===

  async cleanup(): Promise<void> {
    try {
      // Cancel any active uploads
      await RecordingUploadService.cleanup();
      
      // Clear state
      this.updateState({
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

      // Clear listeners
      this.stateListeners = [];
      
      console.log('Recording service cleaned up');
    } catch (error) {
      console.error('Failed to cleanup recording service:', error);
    }
  }
}

export const RecordingService = new RecordingServiceClass();