# Storage System Documentation

## Overview

The Saga platform uses AWS S3 for secure media storage with CloudFront CDN for fast global delivery. The system handles audio files, images, and export archives with comprehensive processing and validation.

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Client App    │    │   API Server    │    │   AWS S3        │
│                 │    │                 │    │                 │
│ File Upload ────┼────┼─► Validation    │    │                 │
│                 │    │ Processing ─────┼────┼─► Storage       │
│                 │    │ Job Queue       │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │                       │
                                │                       │
                       ┌─────────────────┐    ┌─────────────────┐
                       │   Redis Queue   │    │  CloudFront CDN │
                       │                 │    │                 │
                       │ Background Jobs │    │ Fast Delivery   │
                       └─────────────────┘    └─────────────────┘
```

## File Organization

### S3 Bucket Structure
```
saga-media-bucket/
├── audio/
│   └── {projectId}/
│       └── {storyId}/
│           └── {uuid}.mp3
├── images/
│   └── {projectId}/
│       └── {storyId}/
│           └── {uuid}.jpg
├── thumbnails/
│   └── {projectId}/
│       └── {storyId}/
│           └── {uuid}_thumb.jpg
└── exports/
    └── {projectId}/
        └── {uuid}-export.zip
```

## File Processing Pipeline

### Audio Files
1. **Upload Validation**
   - File type: MP3, WAV, MP4, AAC
   - Size limit: 50MB
   - Duration limit: 10 minutes

2. **Processing**
   - Format conversion to MP3
   - Bitrate optimization (128kbps)
   - Metadata extraction
   - Waveform generation

3. **Storage**
   - Encrypted storage (AES-256)
   - CDN distribution
   - Presigned URL generation

### Image Files
1. **Upload Validation**
   - File type: JPEG, PNG, WebP
   - Size limit: 10MB

2. **Processing**
   - Resize to max 1920x1080
   - Quality optimization (85%)
   - Thumbnail generation (300px)
   - Format conversion to JPEG

3. **Storage**
   - Encrypted storage
   - CDN distribution
   - Multiple size variants

## API Endpoints

### Upload Management
- `POST /api/uploads/url` - Generate presigned upload URL
- `POST /api/uploads/validate` - Validate upload completion
- `GET /api/uploads/download/:key` - Generate secure download URL
- `GET /api/uploads/metadata/:key` - Get file metadata
- `DELETE /api/uploads/:key` - Delete file
- `GET /api/uploads/stats` - Storage statistics
- `DELETE /api/uploads/cleanup/expired` - Cleanup expired files

### Story Upload
- `POST /api/projects/:projectId/stories` - Upload story with audio/photo

## Security Features

### Access Control
- JWT authentication required
- Project-level authorization
- Role-based permissions (facilitator/storyteller)

### File Security
- Server-side encryption (AES-256)
- Presigned URLs with expiration
- Content-type validation
- File size limits
- Malware scanning (planned)

### Data Privacy
- Encrypted in transit (TLS 1.3)
- Encrypted at rest (AES-256)
- Access logging
- GDPR compliance ready

## Configuration

### Environment Variables
```bash
# AWS Configuration
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_S3_BUCKET=saga-media-bucket
AWS_CLOUDFRONT_DOMAIN=cdn.saga.com

# File Limits
MAX_AUDIO_SIZE=52428800    # 50MB
MAX_IMAGE_SIZE=10485760    # 10MB
MAX_AUDIO_DURATION=600     # 10 minutes
```

### IAM Permissions
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:PutObject",
        "s3:DeleteObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::saga-media-bucket",
        "arn:aws:s3:::saga-media-bucket/*"
      ]
    }
  ]
}
```

## Background Jobs

### Job Types
1. **Audio Processing** - Format conversion, metadata extraction
2. **STT Processing** - Speech-to-text transcription
3. **Export Processing** - Project data export to ZIP

### Queue Configuration
- Redis-backed job queues
- Retry logic with exponential backoff
- Progress tracking
- Error handling and logging

## Monitoring & Maintenance

### Health Checks
- S3 connectivity
- CDN availability
- Queue status
- Storage quotas

### Cleanup Tasks
- Expired export files (30 days)
- Failed upload cleanup
- Orphaned file detection
- Storage optimization

### Metrics
- Upload success rate
- Processing times
- Storage usage
- CDN hit rates
- Error rates by type

## Error Handling

### Common Errors
- `INVALID_AUDIO_FORMAT` - Unsupported audio format
- `INVALID_IMAGE_FORMAT` - Unsupported image format
- `FILE_TOO_LARGE` - File exceeds size limit
- `AUDIO_TOO_LONG` - Audio exceeds duration limit
- `UPLOAD_FAILED` - S3 upload error
- `PROCESSING_FAILED` - Media processing error

### Recovery Strategies
- Automatic retry with backoff
- Fallback processing options
- Manual intervention alerts
- Data integrity checks

## Performance Optimization

### CDN Strategy
- Global edge locations
- Cache headers optimization
- Compression enabled
- HTTP/2 support

### Upload Optimization
- Multipart uploads for large files
- Progress tracking
- Resume capability
- Parallel processing

### Storage Optimization
- Lifecycle policies
- Intelligent tiering
- Compression
- Deduplication (planned)

## Development & Testing

### Local Development
```bash
# Start local services
docker-compose up -d

# Run with local S3 (MinIO)
npm run dev:local-s3

# Test file uploads
npm run test:storage
```

### Testing Strategy
- Unit tests for all services
- Integration tests with mock S3
- End-to-end upload tests
- Performance benchmarks
- Security penetration tests

## Deployment

### Production Checklist
- [ ] S3 bucket configured with encryption
- [ ] CloudFront distribution set up
- [ ] IAM roles and policies applied
- [ ] Environment variables configured
- [ ] Monitoring and alerts enabled
- [ ] Backup strategy implemented
- [ ] Security scan completed

### Scaling Considerations
- Multiple S3 buckets by region
- CDN optimization
- Queue scaling
- Processing worker scaling
- Database connection pooling

## Troubleshooting

### Common Issues
1. **Upload Failures**
   - Check AWS credentials
   - Verify bucket permissions
   - Check file size limits

2. **Processing Delays**
   - Monitor queue status
   - Check Redis connectivity
   - Review worker capacity

3. **CDN Issues**
   - Verify CloudFront configuration
   - Check cache invalidation
   - Monitor edge locations

### Debug Commands
```bash
# Check queue status
npm run queue:status

# Retry failed jobs
npm run queue:retry

# Clear queue
npm run queue:clear

# Test S3 connectivity
npm run test:s3
```