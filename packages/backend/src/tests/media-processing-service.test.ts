/**
 * Media Processing Service Unit Tests
 */

import { MediaProcessingService } from '../services/media-processing-service';
import { StorageService } from '../services/storage-service';

// Mock dependencies
jest.mock('../services/storage-service');
jest.mock('sharp');
jest.mock('fluent-ffmpeg');

describe('MediaProcessingService', () => {
  let mediaProcessingService: MediaProcessingService;
  let mockStorageService: jest.Mocked<StorageService>;

  beforeEach(() => {
    mockStorageService = new StorageService() as jest.Mocked<StorageService>;
    mediaProcessingService = new MediaProcessingService(mockStorageService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('processAudio', () => {
    it('should process audio file successfully', async () => {
      const mockAudioBuffer = Buffer.from('mock audio data');
      const mockProcessedAudio = {
        buffer: Buffer.from('processed audio'),
        format: 'mp3',
        duration: 120,
        size: 1024
      };

      // Mock ffmpeg processing
      const mockFfmpeg = {
        format: jest.fn().mockReturnThis(),
        audioBitrate: jest.fn().mockReturnThis(),
        audioChannels: jest.fn().mockReturnThis(),
        on: jest.fn().mockImplementation((event, callback) => {
          if (event === 'end') {
            setTimeout(() => callback(), 10);
          }
          return mockFfmpeg;
        }),
        pipe: jest.fn().mockReturnValue(mockProcessedAudio.buffer)
      };

      require('fluent-ffmpeg').mockReturnValue(mockFfmpeg);

      const result = await mediaProcessingService.processAudio(mockAudioBuffer);

      expect(result).toBeDefined();
      expect(mockFfmpeg.format).toHaveBeenCalledWith('mp3');
      expect(mockFfmpeg.audioBitrate).toHaveBeenCalledWith(128);
    });

    it('should handle audio processing errors', async () => {
      const mockAudioBuffer = Buffer.from('invalid audio data');

      const mockFfmpeg = {
        format: jest.fn().mockReturnThis(),
        audioBitrate: jest.fn().mockReturnThis(),
        audioChannels: jest.fn().mockReturnThis(),
        on: jest.fn().mockImplementation((event, callback) => {
          if (event === 'error') {
            setTimeout(() => callback(new Error('Processing failed')), 10);
          }
          return mockFfmpeg;
        }),
        pipe: jest.fn()
      };

      require('fluent-ffmpeg').mockReturnValue(mockFfmpeg);

      await expect(mediaProcessingService.processAudio(mockAudioBuffer))
        .rejects.toThrow('Processing failed');
    });

    it('should validate audio file size limits', async () => {
      const largeAudioBuffer = Buffer.alloc(100 * 1024 * 1024); // 100MB

      await expect(mediaProcessingService.processAudio(largeAudioBuffer))
        .rejects.toThrow('Audio file too large');
    });

    it('should validate audio duration limits', async () => {
      const mockAudioBuffer = Buffer.from('mock audio data');

      const mockFfmpeg = {
        format: jest.fn().mockReturnThis(),
        audioBitrate: jest.fn().mockReturnThis(),
        audioChannels: jest.fn().mockReturnThis(),
        on: jest.fn().mockImplementation((event, callback) => {
          if (event === 'end') {
            setTimeout(() => callback(), 10);
          }
          return mockFfmpeg;
        }),
        pipe: jest.fn().mockReturnValue(Buffer.from('processed')),
        ffprobe: jest.fn().mockImplementation((callback) => {
          callback(null, { format: { duration: 900 } }); // 15 minutes
        })
      };

      require('fluent-ffmpeg').mockReturnValue(mockFfmpeg);

      await expect(mediaProcessingService.processAudio(mockAudioBuffer))
        .rejects.toThrow('Audio duration exceeds limit');
    });
  });

  describe('compressImage', () => {
    it('should compress image successfully', async () => {
      const mockImageBuffer = Buffer.from('mock image data');
      const mockCompressedBuffer = Buffer.from('compressed image');

      const mockSharp = {
        resize: jest.fn().mockReturnThis(),
        jpeg: jest.fn().mockReturnThis(),
        toBuffer: jest.fn().mockResolvedValue(mockCompressedBuffer)
      };

      require('sharp').mockReturnValue(mockSharp);

      const result = await mediaProcessingService.compressImage(mockImageBuffer);

      expect(result).toBeDefined();
      expect(result.buffer).toBe(mockCompressedBuffer);
      expect(mockSharp.resize).toHaveBeenCalledWith(1920, 1080, { fit: 'inside' });
      expect(mockSharp.jpeg).toHaveBeenCalledWith({ quality: 85 });
    });

    it('should handle image compression errors', async () => {
      const mockImageBuffer = Buffer.from('invalid image data');

      const mockSharp = {
        resize: jest.fn().mockReturnThis(),
        jpeg: jest.fn().mockReturnThis(),
        toBuffer: jest.fn().mockRejectedValue(new Error('Compression failed'))
      };

      require('sharp').mockReturnValue(mockSharp);

      await expect(mediaProcessingService.compressImage(mockImageBuffer))
        .rejects.toThrow('Compression failed');
    });

    it('should validate image file size limits', async () => {
      const largeImageBuffer = Buffer.alloc(20 * 1024 * 1024); // 20MB

      await expect(mediaProcessingService.compressImage(largeImageBuffer))
        .rejects.toThrow('Image file too large');
    });
  });

  describe('generateThumbnail', () => {
    it('should generate thumbnail successfully', async () => {
      const mockImageBuffer = Buffer.from('mock image data');
      const mockThumbnailBuffer = Buffer.from('thumbnail image');

      const mockSharp = {
        resize: jest.fn().mockReturnThis(),
        jpeg: jest.fn().mockReturnThis(),
        toBuffer: jest.fn().mockResolvedValue(mockThumbnailBuffer)
      };

      require('sharp').mockReturnValue(mockSharp);

      const result = await mediaProcessingService.generateThumbnail(mockImageBuffer);

      expect(result).toBe(mockThumbnailBuffer);
      expect(mockSharp.resize).toHaveBeenCalledWith(300, 300, { fit: 'cover' });
      expect(mockSharp.jpeg).toHaveBeenCalledWith({ quality: 80 });
    });

    it('should handle thumbnail generation errors', async () => {
      const mockImageBuffer = Buffer.from('invalid image data');

      const mockSharp = {
        resize: jest.fn().mockReturnThis(),
        jpeg: jest.fn().mockReturnThis(),
        toBuffer: jest.fn().mockRejectedValue(new Error('Thumbnail generation failed'))
      };

      require('sharp').mockReturnValue(mockSharp);

      await expect(mediaProcessingService.generateThumbnail(mockImageBuffer))
        .rejects.toThrow('Thumbnail generation failed');
    });
  });

  describe('validateMediaFile', () => {
    it('should validate supported audio formats', () => {
      const supportedFormats = ['mp3', 'wav', 'm4a', 'aac'];
      
      supportedFormats.forEach(format => {
        expect(() => mediaProcessingService.validateAudioFormat(format))
          .not.toThrow();
      });
    });

    it('should reject unsupported audio formats', () => {
      const unsupportedFormats = ['flac', 'ogg', 'wma'];
      
      unsupportedFormats.forEach(format => {
        expect(() => mediaProcessingService.validateAudioFormat(format))
          .toThrow('Unsupported audio format');
      });
    });

    it('should validate supported image formats', () => {
      const supportedFormats = ['jpg', 'jpeg', 'png', 'webp'];
      
      supportedFormats.forEach(format => {
        expect(() => mediaProcessingService.validateImageFormat(format))
          .not.toThrow();
      });
    });

    it('should reject unsupported image formats', () => {
      const unsupportedFormats = ['gif', 'bmp', 'tiff'];
      
      unsupportedFormats.forEach(format => {
        expect(() => mediaProcessingService.validateImageFormat(format))
          .toThrow('Unsupported image format');
      });
    });
  });

  describe('getMediaMetadata', () => {
    it('should extract audio metadata', async () => {
      const mockAudioBuffer = Buffer.from('mock audio data');
      const mockMetadata = {
        format: 'mp3',
        duration: 120,
        bitrate: 128,
        sampleRate: 44100
      };

      const mockFfmpeg = {
        ffprobe: jest.fn().mockImplementation((callback) => {
          callback(null, {
            format: {
              format_name: 'mp3',
              duration: '120.5',
              bit_rate: '128000'
            },
            streams: [{
              sample_rate: '44100'
            }]
          });
        })
      };

      require('fluent-ffmpeg').mockReturnValue(mockFfmpeg);

      const result = await mediaProcessingService.getAudioMetadata(mockAudioBuffer);

      expect(result).toEqual(expect.objectContaining({
        format: 'mp3',
        duration: 120.5,
        bitrate: 128000
      }));
    });

    it('should extract image metadata', async () => {
      const mockImageBuffer = Buffer.from('mock image data');
      const mockMetadata = {
        width: 1920,
        height: 1080,
        format: 'jpeg',
        size: 1024
      };

      const mockSharp = {
        metadata: jest.fn().mockResolvedValue(mockMetadata)
      };

      require('sharp').mockReturnValue(mockSharp);

      const result = await mediaProcessingService.getImageMetadata(mockImageBuffer);

      expect(result).toEqual(mockMetadata);
      expect(mockSharp.metadata).toHaveBeenCalled();
    });
  });
});