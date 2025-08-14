import * as FileSystem from 'expo-file-system';
import { Platform } from 'react-native';

import { LocalRecordingDraft, RecordingUploadProgress } from '@saga/shared';
import { apiClient } from './api-client';

export interface UploadOptions {
  onProgress?: (progress: RecordingUploadProgress) => void;
  onComplete?: (storyId: string) => void;
  onError?: (error: string) => void;
  compressionQuality?: number; // 0.1 to 1.0
}

class RecordingUploadServiceClass {
  private activeUploads = new Map<string, AbortController>();

  async uploadRecordingDraft(draft: LocalRecordingDraft, options: UploadOptions = {}): Promise<string | null> {
    const { onProgress, onComplete, onError, compressionQuality = 0.8 } = options;

    try {
      // Create abort controller for this upload
      const abortController = new AbortController();
      this.activeUploads.set(draft.sessionId, abortController);

      // Initial progress
      onProgress?.({
        sessionId: draft.sessionId,
        bytesUploaded: 0,
        totalBytes: 0,
        percentage: 0,
        status: 'uploading'
      });

      // Prepare audio file for upload
      const audioFileInfo = await FileSystem.getInfoAsync(draft.localAudioUri);
      if (!audioFileInfo.exists) {
        throw new Error('Audio file not found');
      }

      let photoFileInfo = null;
      if (draft.localPhotoUri) {
        photoFileInfo = await FileSystem.getInfoAsync(draft.localPhotoUri);
        if (!photoFileInfo.exists) {
          console.warn('Photo file not found, continuing without photo');
        }
      }

      // Calculate total bytes for progress tracking
      const totalBytes = (audioFileInfo.size || 0) + (photoFileInfo?.size || 0);

      // Create FormData for multipart upload
      const formData = new FormData();
      
      // Add audio file
      formData.append('audio', {
        uri: draft.localAudioUri,
        type: 'audio/m4a',
        name: `recording_${draft.sessionId}.m4a`
      } as any);

      // Add photo if exists
      if (draft.localPhotoUri && photoFileInfo?.exists) {
        const photoExtension = draft.localPhotoUri.split('.').pop()?.toLowerCase() || 'jpg';
        formData.append('photo', {
          uri: draft.localPhotoUri,
          type: `image/${photoExtension === 'jpg' ? 'jpeg' : photoExtension}`,
          name: `photo_${draft.sessionId}.${photoExtension}`
        } as any);
      }

      // Add metadata
      formData.append('projectId', draft.projectId);
      formData.append('duration', draft.duration.toString());
      formData.append('sessionId', draft.sessionId);
      
      if (draft.promptId) {
        formData.append('promptId', draft.promptId);
      }
      if (draft.userPromptId) {
        formData.append('userPromptId', draft.userPromptId);
      }
      if (draft.chapterId) {
        formData.append('chapterId', draft.chapterId);
      }

      // Upload with progress tracking
      const response = await this.uploadWithProgress(
        `/api/projects/${draft.projectId}/stories`,
        formData,
        {
          sessionId: draft.sessionId,
          totalBytes,
          onProgress,
          abortController
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Upload failed');
      }

      const result = await response.json();
      const storyId = result.story?.id;

      if (!storyId) {
        throw new Error('No story ID returned from server');
      }

      // Final progress update
      onProgress?.({
        sessionId: draft.sessionId,
        bytesUploaded: totalBytes,
        totalBytes,
        percentage: 100,
        status: 'completed'
      });

      onComplete?.(storyId);
      this.activeUploads.delete(draft.sessionId);

      return storyId;
    } catch (error) {
      console.error('Upload failed:', error);
      
      const errorMessage = error instanceof Error ? error.message : 'Upload failed';
      
      onProgress?.({
        sessionId: draft.sessionId,
        bytesUploaded: 0,
        totalBytes: 0,
        percentage: 0,
        status: 'failed',
        error: errorMessage
      });

      onError?.(errorMessage);
      this.activeUploads.delete(draft.sessionId);
      
      return null;
    }
  }

  private async uploadWithProgress(
    endpoint: string,
    formData: FormData,
    options: {
      sessionId: string;
      totalBytes: number;
      onProgress?: (progress: RecordingUploadProgress) => void;
      abortController: AbortController;
    }
  ): Promise<Response> {
    const { sessionId, totalBytes, onProgress, abortController } = options;

    // For React Native, we'll use XMLHttpRequest for better progress tracking
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      // Handle abort
      abortController.signal.addEventListener('abort', () => {
        xhr.abort();
        reject(new Error('Upload cancelled'));
      });

      // Track upload progress
      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable) {
          const percentage = Math.round((event.loaded / event.total) * 100);
          
          onProgress?.({
            sessionId,
            bytesUploaded: event.loaded,
            totalBytes: event.total,
            percentage,
            status: 'uploading'
          });
        }
      });

      // Handle completion
      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          // Create a Response-like object
          const response = {
            ok: true,
            status: xhr.status,
            statusText: xhr.statusText,
            json: async () => JSON.parse(xhr.responseText),
            text: async () => xhr.responseText,
          } as Response;
          
          resolve(response);
        } else {
          reject(new Error(`HTTP ${xhr.status}: ${xhr.statusText}`));
        }
      });

      // Handle errors
      xhr.addEventListener('error', () => {
        reject(new Error('Network error during upload'));
      });

      xhr.addEventListener('timeout', () => {
        reject(new Error('Upload timeout'));
      });

      // Configure request
      xhr.open('POST', `${apiClient.defaults.baseURL}${endpoint}`);
      
      // Add authorization header if available
      const token = apiClient.defaults.headers.common['Authorization'];
      if (token) {
        xhr.setRequestHeader('Authorization', token);
      }

      // Set timeout (10 minutes for large files)
      xhr.timeout = 10 * 60 * 1000;

      // Send the request
      xhr.send(formData);
    });
  }

  async cancelUpload(sessionId: string): Promise<void> {
    const abortController = this.activeUploads.get(sessionId);
    if (abortController) {
      abortController.abort();
      this.activeUploads.delete(sessionId);
      console.log('Upload cancelled:', sessionId);
    }
  }

  async retryUpload(draft: LocalRecordingDraft, options: UploadOptions = {}): Promise<string | null> {
    // Cancel any existing upload for this session
    await this.cancelUpload(draft.sessionId);
    
    // Retry with exponential backoff
    const maxRetries = 3;
    let retryCount = 0;
    
    while (retryCount < maxRetries) {
      try {
        const result = await this.uploadRecordingDraft(draft, options);
        if (result) {
          return result;
        }
      } catch (error) {
        retryCount++;
        console.log(`Upload retry ${retryCount}/${maxRetries} failed:`, error);
        
        if (retryCount < maxRetries) {
          // Wait before retrying (exponential backoff)
          const delay = Math.pow(2, retryCount) * 1000; // 2s, 4s, 8s
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    throw new Error(`Upload failed after ${maxRetries} retries`);
  }

  // Compression utilities
  async compressAudio(audioUri: string, quality: number = 0.8): Promise<string> {
    try {
      // For now, we'll return the original URI
      // In a production app, you might want to use a library like react-native-audio-toolkit
      // or implement server-side compression
      console.log('Audio compression not implemented, using original file');
      return audioUri;
    } catch (error) {
      console.error('Audio compression failed:', error);
      return audioUri; // Return original on failure
    }
  }

  async compressImage(imageUri: string, quality: number = 0.8): Promise<string> {
    try {
      // Use Expo's ImageManipulator for image compression
      const { ImageManipulator } = await import('expo-image-manipulator');
      
      const result = await ImageManipulator.manipulateAsync(
        imageUri,
        [{ resize: { width: 1920 } }], // Resize to max width of 1920px
        {
          compress: quality,
          format: ImageManipulator.SaveFormat.JPEG,
        }
      );
      
      return result.uri;
    } catch (error) {
      console.error('Image compression failed:', error);
      return imageUri; // Return original on failure
    }
  }

  // Utility methods
  getActiveUploads(): string[] {
    return Array.from(this.activeUploads.keys());
  }

  isUploading(sessionId: string): boolean {
    return this.activeUploads.has(sessionId);
  }

  async cleanup(): Promise<void> {
    // Cancel all active uploads
    for (const [sessionId, controller] of this.activeUploads) {
      controller.abort();
      console.log('Cancelled upload during cleanup:', sessionId);
    }
    this.activeUploads.clear();
  }
}

export const RecordingUploadService = new RecordingUploadServiceClass();