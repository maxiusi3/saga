import { StorageService } from '../services/storage-service'
import { MediaProcessingService } from '../services/media-processing-service'
import { AWSConfig } from '../config/aws'

// Mock AWS SDK
jest.mock('aws-sdk', () => ({
  S3: jest.fn(() => ({
    upload: jest.fn(() => ({
      promise: jest.fn(() => Promise.resolve({
        Location: 'https://test-bucket.s3.amazonaws.com/test-key',
        Key: 'test-key',
        Bucket: 'test-bucket',
      })),
    })),
    deleteObject: jest.fn(() => ({
      promise: jest.fn(() => Promise.resolve()),
    })),
    headObject: jest.fn(() => ({
      promise: jest.fn(() => Promise.resolve({
        ContentLength: 1024,
        ContentType: 'audio/mpeg',
        LastModified: new Date(),
        ETag: '"test-etag"',
        Metadata: {},
      })),
    })),
    getSignedUrl: jest.fn(() => 'https://presigned-url.com'),
    createPresignedPost: jest.fn(() => ({
      url: 'https://upload-url.com',
      fields: { key: 'test-key' },
    })),
    listObjectsV2: jest.fn(() => ({
      promise: jest.fn(() => Promise.resolve({
        Contents: [
          {
            Key: 'exports/old-file.zip',
            LastModified: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000), // 40 days ago
          },
        ],
      })),
    })),
    deleteObjects: jest.fn(() => ({
      promise: jest.fn(() => Promise.resolve()),
    })),
  })),
  CloudFront: jest.fn(() => ({})),
}))

// Mock Sharp
jest.mock('sharp', () => {
  return jest.fn(() => ({
    resize: jest.fn().mockReturnThis(),
    jpeg: jest.fn().mockReturnThis(),
    png: jest.fn().mockReturnThis(),
    webp: jest.fn().mockReturnThis(),
    toBuffer: jest.fn(() => Promise.resolve({
      buffer: Buffer.from('processed-image'),
      info: { width: 800, height: 600 },
    })),
  }))
})

// Mock fluent-ffmpeg
jest.mock('fluent-ffmpeg', () => {
  const mockFfmpeg = jest.fn(() => ({
    ffprobe: jest.fn((callback) => {
      callback(null, {
        format: {
          duration: '120.5',
          format_name: 'mp3',
          bit_rate: '128000',
        },
        streams: [{
          codec_type: 'audio',
          sample_rate: 44100,
          channels: 2,
        }],
      })
    }),
    audioCodec: jest.fn().mockReturnThis(),
    audioBitrate: jest.fn().mockReturnThis(),
    audioChannels: jest.fn().mockReturnThis(),
    format: jest.fn().mockReturnThis(),
    on: jest.fn().mockReturnThis(),
    pipe: jest.fn(() => ({
      on: jest.fn((event, callback) => {
        if (event === 'data') {
          callback(Buffer.from('audio-data'))
        } else if (event === 'end') {
          setTimeout(callback, 10)
        }
      }),
    })),
    outputOptions: jest.fn().mockReturnThis(),
  }))
  return mockFfmpeg
})

describe('StorageService', () => {
  const mockAudioFile: Express.Multer.File = {
    fieldname: 'audio',
    originalname: 'test-audio.mp3',
    encoding: '7bit',
    mimetype: 'audio/mpeg',
    size: 1024 * 1024, // 1MB
    buffer: Buffer.from('mock-audio-data'),
    destination: '',
    filename: '',
    path: '',
    stream: {} as any,
  }

  const mockImageFile: Express.Multer.File = {
    fieldname: 'photo',
    originalname: 'test-image.jpg',
    encoding: '7bit',
    mimetype: 'image/jpeg',
    size: 512 * 1024, // 512KB
    buffer: Buffer.from('mock-image-data'),
    destination: '',
    filename: '',
    path: '',
    stream: {} as any,
  }

  beforeEach(() => {
    // Set up environment variables
    process.env.AWS_S3_BUCKET = 'test-bucket'
    process.env.AWS_CLOUDFRONT_DOMAIN = 'cdn.example.com'
    process.env.AWS_REGION = 'us-east-1'
    process.env.AWS_ACCESS_KEY_ID = 'test-key'
    process.env.AWS_SECRET_ACCESS_KEY = 'test-secret'
  })

  describe('uploadAudioFile', () => {
    it('should upload audio file successfully', async () => {
      const result = await StorageService.uploadAudioFile(
        mockAudioFile,
        'project-123',
        'story-456'
      )

      expect(result.key).toContain('audio/project-123/story-456/')
      expect(result.url).toBe('https://test-bucket.s3.amazonaws.com/test-key')
      expect(result.cdnUrl).toContain('https://cdn.example.com/')
      expect(result.size).toBe(mockAudioFile.size)
      expect(result.contentType).toBe('audio/mpeg')
    })

    it('should reject invalid audio file', async () => {
      const invalidFile = { ...mockAudioFile, mimetype: 'text/plain' }

      await expect(
        StorageService.uploadAudioFile(invalidFile, 'project-123', 'story-456')
      ).rejects.toThrow('Invalid audio file format')
    })
  })

  describe('uploadImageFile', () => {
    it('should upload and process image file', async () => {
      const result = await StorageService.uploadImageFile(
        mockImageFile,
        'project-123',
        'story-456',
        {
          maxWidth: 1920,
          maxHeight: 1080,
          quality: 85,
          format: 'jpeg',
        }
      )

      expect(result.key).toContain('images/project-123/story-456/')
      expect(result.contentType).toBe('image/jpeg')
    })

    it('should generate thumbnail when requested', async () => {
      const result = await StorageService.uploadImageFile(
        mockImageFile,
        'project-123',
        'story-456',
        {
          generateThumbnail: true,
          thumbnailSize: 300,
        }
      )

      expect(result).toBeDefined()
      // Thumbnail generation is fire-and-forget, so we just verify it doesn't throw
    })
  })

  describe('uploadExportFile', () => {
    it('should upload export file with expiration', async () => {
      const exportBuffer = Buffer.from('export-data')

      const result = await StorageService.uploadExportFile(
        exportBuffer,
        'project-123',
        'export.zip'
      )

      expect(result.key).toContain('exports/project-123/')
      expect(result.contentType).toBe('application/zip')
      expect(result.size).toBe(exportBuffer.length)
    })
  })

  describe('deleteFile', () => {
    it('should delete file successfully', async () => {
      await expect(
        StorageService.deleteFile('test-key')
      ).resolves.not.toThrow()
    })
  })

  describe('getFileMetadata', () => {
    it('should retrieve file metadata', async () => {
      const metadata = await StorageService.getFileMetadata('test-key')

      expect(metadata.ContentLength).toBe(1024)
      expect(metadata.ContentType).toBe('audio/mpeg')
      expect(metadata.ETag).toBe('"test-etag"')
    })
  })

  describe('generateSecureDownloadUrl', () => {
    it('should generate presigned download URL', () => {
      const url = StorageService.generateSecureDownloadUrl('test-key', 3600)

      expect(url).toBe('https://presigned-url.com')
    })
  })

  describe('generateUploadUrl', () => {
    it('should generate presigned upload URL', () => {
      const result = StorageService.generateUploadUrl(
        'project-123',
        'audio',
        'audio/mpeg'
      )

      expect(result.uploadUrl).toBe('https://upload-url.com')
      expect(result.fields).toEqual({ key: 'test-key' })
      expect(result.key).toContain('audio/project-123/')
    })
  })

  describe('cleanupExpiredFiles', () => {
    it('should cleanup expired export files', async () => {
      const deletedCount = await StorageService.cleanupExpiredFiles()

      expect(deletedCount).toBe(1)
    })
  })
})

describe('MediaProcessingService', () => {
  const mockAudioBuffer = Buffer.from('mock-audio-data')

  describe('getAudioMetadata', () => {
    it('should extract audio metadata', async () => {
      const metadata = await MediaProcessingService.getAudioMetadata(mockAudioBuffer)

      expect(metadata.duration).toBe(120.5)
      expect(metadata.format).toBe('mp3')
      expect(metadata.bitrate).toBe(128000)
      expect(metadata.sampleRate).toBe(44100)
      expect(metadata.channels).toBe(2)
    })
  })

  describe('processAudioFile', () => {
    const mockAudioFile: Express.Multer.File = {
      fieldname: 'audio',
      originalname: 'test.mp3',
      encoding: '7bit',
      mimetype: 'audio/mpeg',
      size: 1024,
      buffer: mockAudioBuffer,
      destination: '',
      filename: '',
      path: '',
      stream: {} as any,
    }

    it('should process audio file successfully', async () => {
      const result = await MediaProcessingService.processAudioFile(mockAudioFile, {
        targetFormat: 'mp3',
        targetBitrate: 128,
      })

      expect(result.buffer).toBeDefined()
      expect(result.metadata.duration).toBe(120.5)
      expect(result.metadata.format).toBe('mp3')
    })

    it('should reject audio file that is too long', async () => {
      await expect(
        MediaProcessingService.processAudioFile(mockAudioFile, {
          maxDuration: 60, // 1 minute max, but file is 120.5 seconds
        })
      ).rejects.toThrow('Audio duration exceeds maximum allowed')
    })
  })

  describe('validateAudioFile', () => {
    it('should validate valid audio file', async () => {
      const mockFile: Express.Multer.File = {
        fieldname: 'audio',
        originalname: 'test.mp3',
        encoding: '7bit',
        mimetype: 'audio/mpeg',
        size: 1024,
        buffer: mockAudioBuffer,
        destination: '',
        filename: '',
        path: '',
        stream: {} as any,
      }

      const isValid = await MediaProcessingService.validateAudioFile(mockFile)
      expect(isValid).toBe(true)
    })
  })

  describe('getAudioDurationFromBuffer', () => {
    it('should get audio duration', async () => {
      const duration = await MediaProcessingService.getAudioDurationFromBuffer(mockAudioBuffer)
      expect(duration).toBe(120.5)
    })
  })
})

describe('AWSConfig', () => {
  beforeEach(() => {
    // Clear environment variables
    delete process.env.AWS_S3_BUCKET
    delete process.env.AWS_REGION
    delete process.env.AWS_ACCESS_KEY_ID
    delete process.env.AWS_SECRET_ACCESS_KEY
  })

  describe('validateConfig', () => {
    it('should validate complete configuration', () => {
      process.env.AWS_S3_BUCKET = 'test-bucket'
      process.env.AWS_REGION = 'us-east-1'
      process.env.AWS_ACCESS_KEY_ID = 'test-key'
      process.env.AWS_SECRET_ACCESS_KEY = 'test-secret'

      expect(() => AWSConfig.validateConfig()).not.toThrow()
    })

    it('should throw error for missing configuration', () => {
      expect(() => AWSConfig.validateConfig()).toThrow('Missing required AWS environment variables')
    })
  })

  describe('bucketName', () => {
    it('should return bucket name when configured', () => {
      process.env.AWS_S3_BUCKET = 'test-bucket'
      expect(AWSConfig.bucketName).toBe('test-bucket')
    })

    it('should throw error when bucket name not configured', () => {
      expect(() => AWSConfig.bucketName).toThrow('AWS S3 bucket name not configured')
    })
  })
})