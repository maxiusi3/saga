# Enhanced Recording Service Documentation

## Overview

The Enhanced Recording Service is a comprehensive solution for the Saga v1.5 "Review & Send" recording workflow. It provides draft management, quality validation, upload functionality, and crash recovery for storyteller recordings.

## Architecture

The service is composed of three main components:

1. **EnhancedRecordingService** - Core recording functionality with draft management
2. **RecordingUploadService** - Upload handling with progress tracking and retry logic
3. **RecordingService** - Unified interface combining all recording functionality

## Key Features

### 1. Draft Management with MMKV Storage

- **Persistent Storage**: Uses MMKV for fast, encrypted local storage of recording drafts
- **Crash Recovery**: Automatically recovers drafts after app crashes or interruptions
- **File Management**: Handles both audio and photo files with proper cleanup

```typescript
// Save a draft
await RecordingService.createDraft(
  userId,
  projectId,
  photoUri,
  promptId
);

// Recover draft on app launch
const hasDraft = await RecordingService.recoverDraft(userId);
if (hasDraft) {
  // Show recovery UI
}
```

### 2. Recording Quality Validation

- **File Size Validation**: Ensures recordings don't exceed 50MB limit
- **Duration Validation**: Enforces 10-minute maximum and 1-second minimum
- **Format Validation**: Checks for supported audio formats
- **Quality Analysis**: Provides detailed quality reports with suggestions

```typescript
const quality = await RecordingService.validateCurrentRecording();
if (!quality.isValid) {
  // Show quality issues to user
  quality.issues.forEach(issue => {
    console.log(`${issue.severity}: ${issue.message}`);
    if (issue.suggestion) {
      console.log(`Suggestion: ${issue.suggestion}`);
    }
  });
}
```

### 3. Upload with Progress Tracking

- **Progress Monitoring**: Real-time upload progress with byte-level accuracy
- **Retry Logic**: Automatic retry with exponential backoff
- **Cancellation**: Ability to cancel uploads in progress
- **Error Handling**: Comprehensive error handling with user-friendly messages

```typescript
await RecordingService.sendToFamily({
  onProgress: (progress) => {
    console.log(`Upload: ${progress.percentage}%`);
  },
  onComplete: (storyId) => {
    console.log(`Story created: ${storyId}`);
  },
  onError: (error) => {
    console.error(`Upload failed: ${error}`);
  }
});
```

### 4. State Management

- **Reactive State**: Subscribe to state changes for UI updates
- **Centralized State**: Single source of truth for recording state
- **Type Safety**: Full TypeScript support with comprehensive interfaces

```typescript
const unsubscribe = RecordingService.subscribe((state) => {
  // Update UI based on state changes
  if (state.recording.isRecording) {
    // Show recording UI
  }
  if (state.draft) {
    // Show review UI
  }
  if (state.uploadProgress) {
    // Show upload progress
  }
});
```

## Usage Examples

### Basic Recording Flow

```typescript
// Initialize the service
await RecordingService.initialize();

// Start recording
await RecordingService.startRecording({
  userId: 'user-123',
  projectId: 'project-123',
  promptId: 'prompt-123'
});

// Stop recording
await RecordingService.stopRecording();

// Create draft for review
await RecordingService.createDraft(
  'user-123',
  'project-123',
  photoUri, // optional
  'prompt-123'
);

// Send to family
const storyId = await RecordingService.sendToFamily({
  onProgress: updateProgressBar,
  onComplete: showSuccessMessage,
  onError: showErrorMessage
});
```

### Draft Recovery Flow

```typescript
// On app launch, check for drafts
const hasDraft = await RecordingService.recoverDraft(userId);

if (hasDraft) {
  // Show recovery dialog
  const userChoice = await showRecoveryDialog();
  
  if (userChoice === 'resume') {
    // Continue with existing draft
    const storyId = await RecordingService.sendToFamily();
  } else {
    // Discard draft
    await RecordingService.discardDraft();
  }
}
```

### Error Handling and Retry

```typescript
let storyId = await RecordingService.sendToFamily({
  onError: async (error) => {
    console.error('Upload failed:', error);
    
    // Show retry option to user
    const shouldRetry = await showRetryDialog();
    
    if (shouldRetry) {
      storyId = await RecordingService.retryUpload();
    }
  }
});
```

## Configuration

### Audio Configuration

The service uses configuration from `utils/constants.ts`:

```typescript
export const AUDIO_CONFIG = {
  maxDuration: 600, // 10 minutes in seconds
  sampleRate: 44100,
  numberOfChannels: 1,
  bitRate: 128000,
  format: 'mp4',
  extension: '.m4a',
  maxFileSize: 50 * 1024 * 1024, // 50MB
};
```

### Storage Configuration

MMKV storage is configured with encryption:

```typescript
const draftStorage = new MMKV({
  id: 'recording-drafts',
  encryptionKey: 'saga-recording-drafts-key'
});
```

## Error Handling

The service provides comprehensive error handling:

### Recording Errors
- Permission denied
- Hardware unavailable
- Storage full
- Recording interrupted

### Upload Errors
- Network connectivity issues
- Server errors
- File corruption
- Timeout errors

### Quality Validation Errors
- File too large
- Duration too long/short
- Unsupported format
- File corruption

## Performance Considerations

### Memory Management
- Efficient audio recording with minimal memory usage
- Automatic cleanup of temporary files
- Progress tracking with minimal overhead

### Storage Optimization
- MMKV for fast, synchronous storage operations
- Encrypted storage for security
- Automatic cleanup of old drafts

### Network Optimization
- Chunked upload for large files
- Automatic retry with exponential backoff
- Upload cancellation to save bandwidth

## Security

### Data Protection
- Encrypted local storage using MMKV
- Secure file handling with proper permissions
- Automatic cleanup of sensitive data

### Network Security
- HTTPS-only uploads
- Authentication token validation
- Secure multipart form data transmission

## Testing

The service includes comprehensive test coverage:

- **Unit Tests**: Individual component testing
- **Integration Tests**: End-to-end workflow testing
- **Error Scenario Tests**: Comprehensive error handling validation
- **Performance Tests**: Memory and storage efficiency validation

### Running Tests

```bash
# Run all recording service tests
npm test -- --testPathPattern=recording

# Run specific test file
npm test enhanced-recording-service.test.ts

# Run with coverage
npm test -- --coverage --testPathPattern=recording
```

## Troubleshooting

### Common Issues

1. **Draft Recovery Fails**
   - Check file permissions
   - Verify MMKV storage initialization
   - Ensure audio files still exist

2. **Upload Fails Repeatedly**
   - Check network connectivity
   - Verify authentication tokens
   - Check server status

3. **Quality Validation Fails**
   - Check file size limits
   - Verify audio format support
   - Check recording duration

### Debug Logging

Enable debug logging for troubleshooting:

```typescript
// Enable detailed logging
console.log('Recording state:', RecordingService.getState());
console.log('Active uploads:', RecordingUploadService.getActiveUploads());
```

## Migration Guide

### From v1.0 to v1.5

The enhanced recording service replaces the basic audio recording service:

```typescript
// Old v1.0 approach
import { AudioRecordingService } from './audio-recording-service';

// New v1.5 approach
import { RecordingService } from './recording-service';

// Migration steps:
// 1. Replace AudioRecordingService with RecordingService
// 2. Update recording flow to use draft system
// 3. Add quality validation
// 4. Implement upload progress tracking
```

## Future Enhancements

### Planned Features
- Audio editing capabilities (trim, volume adjustment)
- Multiple recording takes with selection
- Real-time transcription preview
- Advanced quality enhancement using AI
- Offline queue for uploads

### Performance Improvements
- Background upload processing
- Intelligent compression based on content
- Predictive quality validation
- Advanced retry strategies

## API Reference

See the TypeScript interfaces in the service files for complete API documentation:

- `EnhancedRecordingService` - Core recording functionality
- `RecordingUploadService` - Upload handling
- `RecordingService` - Unified interface
- `LocalRecordingDraft` - Draft data structure
- `RecordingQuality` - Quality validation results
- `RecordingUploadProgress` - Upload progress tracking