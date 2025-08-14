import { createError } from '../middleware/error-handler'
import { StorageService } from './storage-service'
import ffmpeg from 'fluent-ffmpeg'
import { Readable } from 'stream'
import { FILE_LIMITS } from '@saga/shared'

export interface AudioMetadata {
  duration: number // in seconds
  format: string
  bitrate: number
  sampleRate: number
  channels: number
  size: number
}

export interface ProcessedAudio {
  buffer: Buffer
  metadata: AudioMetadata
}

export class MediaProcessingService {
  static async processAudioFile(
    file: Express.Multer.File,
    options: {
      maxDuration?: number
      targetFormat?: 'mp3' | 'aac'
      targetBitrate?: number
    } = {}
  ): Promise<ProcessedAudio> {
    try {
      // Get audio metadata first
      const metadata = await this.getAudioMetadata(file.buffer)

      // Validate duration
      const maxDuration = options.maxDuration || FILE_LIMITS.AUDIO.MAX_DURATION
      if (metadata.duration > maxDuration) {
        throw createError(
          `Audio duration exceeds maximum allowed (${maxDuration} seconds)`,
          400,
          'AUDIO_TOO_LONG'
        )
      }

      // Process audio if needed
      let processedBuffer = file.buffer
      let processedMetadata = metadata

      // Convert format if needed
      if (options.targetFormat && metadata.format !== options.targetFormat) {
        const converted = await this.convertAudioFormat(
          file.buffer,
          options.targetFormat,
          options.targetBitrate
        )
        processedBuffer = converted.buffer
        processedMetadata = converted.metadata
      }

      // Compress if file is too large
      if (processedBuffer.length > FILE_LIMITS.AUDIO.MAX_SIZE) {
        const compressed = await this.compressAudio(processedBuffer, options.targetBitrate || 128)
        processedBuffer = compressed.buffer
        processedMetadata = compressed.metadata
      }

      return {
        buffer: processedBuffer,
        metadata: processedMetadata,
      }
    } catch (error) {
      console.error('Audio processing failed:', error)
      if (error instanceof Error && error.message.includes('AUDIO_')) {
        throw error
      }
      throw createError('Failed to process audio file', 500, 'AUDIO_PROCESSING_FAILED')
    }
  }

  static async getAudioMetadata(buffer: Buffer): Promise<AudioMetadata> {
    return new Promise((resolve, reject) => {
      const stream = new Readable()
      stream.push(buffer)
      stream.push(null)

      ffmpeg(stream)
        .ffprobe((err, metadata) => {
          if (err) {
            reject(createError('Failed to read audio metadata', 400, 'INVALID_AUDIO_FILE'))
            return
          }

          const audioStream = metadata.streams.find(s => s.codec_type === 'audio')
          if (!audioStream) {
            reject(createError('No audio stream found in file', 400, 'NO_AUDIO_STREAM'))
            return
          }

          resolve({
            duration: parseFloat(metadata.format.duration || '0'),
            format: metadata.format.format_name || 'unknown',
            bitrate: parseInt(metadata.format.bit_rate || '0'),
            sampleRate: audioStream.sample_rate || 0,
            channels: audioStream.channels || 0,
            size: buffer.length,
          })
        })
    })
  }

  static async convertAudioFormat(
    buffer: Buffer,
    targetFormat: 'mp3' | 'aac',
    bitrate = 128
  ): Promise<ProcessedAudio> {
    return new Promise((resolve, reject) => {
      const inputStream = new Readable()
      inputStream.push(buffer)
      inputStream.push(null)

      const chunks: Buffer[] = []

      const command = ffmpeg(inputStream)
        .audioCodec(targetFormat === 'mp3' ? 'libmp3lame' : 'aac')
        .audioBitrate(bitrate)
        .format(targetFormat)
        .on('error', (err) => {
          reject(createError('Audio conversion failed', 500, 'AUDIO_CONVERSION_FAILED'))
        })
        .on('end', async () => {
          try {
            const convertedBuffer = Buffer.concat(chunks)
            const metadata = await this.getAudioMetadata(convertedBuffer)
            resolve({
              buffer: convertedBuffer,
              metadata,
            })
          } catch (error) {
            reject(error)
          }
        })

      const stream = command.pipe()
      stream.on('data', (chunk) => chunks.push(chunk))
      stream.on('error', (err) => {
        reject(createError('Audio conversion stream error', 500, 'AUDIO_STREAM_ERROR'))
      })
    })
  }

  static async compressAudio(buffer: Buffer, targetBitrate = 96): Promise<ProcessedAudio> {
    return new Promise((resolve, reject) => {
      const inputStream = new Readable()
      inputStream.push(buffer)
      inputStream.push(null)

      const chunks: Buffer[] = []

      const command = ffmpeg(inputStream)
        .audioBitrate(targetBitrate)
        .audioChannels(1) // Convert to mono for smaller size
        .on('error', (err) => {
          reject(createError('Audio compression failed', 500, 'AUDIO_COMPRESSION_FAILED'))
        })
        .on('end', async () => {
          try {
            const compressedBuffer = Buffer.concat(chunks)
            const metadata = await this.getAudioMetadata(compressedBuffer)
            resolve({
              buffer: compressedBuffer,
              metadata,
            })
          } catch (error) {
            reject(error)
          }
        })

      const stream = command.pipe()
      stream.on('data', (chunk) => chunks.push(chunk))
      stream.on('error', (err) => {
        reject(createError('Audio compression stream error', 500, 'AUDIO_STREAM_ERROR'))
      })
    })
  }

  static async generateWaveformData(buffer: Buffer): Promise<number[]> {
    try {
      // This is a simplified waveform generation
      // In production, you might want to use a more sophisticated library
      const sampleRate = 44100
      const samplesPerPixel = 1000
      const waveformData: number[] = []

      // Extract audio samples (simplified approach)
      for (let i = 0; i < buffer.length; i += samplesPerPixel * 2) {
        let sum = 0
        let count = 0

        for (let j = 0; j < samplesPerPixel * 2 && i + j < buffer.length; j += 2) {
          // Read 16-bit sample
          const sample = buffer.readInt16LE(i + j)
          sum += Math.abs(sample)
          count++
        }

        const average = count > 0 ? sum / count : 0
        const normalized = Math.min(1, average / 32768) // Normalize to 0-1
        waveformData.push(normalized)
      }

      return waveformData
    } catch (error) {
      console.error('Waveform generation failed:', error)
      // Return empty array if generation fails
      return []
    }
  }

  static async validateAudioFile(file: Express.Multer.File): Promise<boolean> {
    try {
      const metadata = await this.getAudioMetadata(file.buffer)
      
      // Check duration
      if (metadata.duration > FILE_LIMITS.AUDIO.MAX_DURATION) {
        return false
      }

      // Check if it's actually an audio file
      if (metadata.duration === 0 || !metadata.format) {
        return false
      }

      return true
    } catch (error) {
      return false
    }
  }

  static async extractAudioThumbnail(buffer: Buffer): Promise<Buffer | null> {
    try {
      // Extract embedded artwork/thumbnail from audio file
      return new Promise((resolve, reject) => {
        const inputStream = new Readable()
        inputStream.push(buffer)
        inputStream.push(null)

        const chunks: Buffer[] = []

        ffmpeg(inputStream)
          .outputOptions(['-an', '-vcodec', 'copy'])
          .format('image2')
          .on('error', () => {
            resolve(null) // No thumbnail available
          })
          .on('end', () => {
            const thumbnailBuffer = Buffer.concat(chunks)
            resolve(thumbnailBuffer.length > 0 ? thumbnailBuffer : null)
          })
          .pipe()
          .on('data', (chunk) => chunks.push(chunk))
      })
    } catch (error) {
      return null
    }
  }

  static getAudioDurationFromBuffer(buffer: Buffer): Promise<number> {
    return this.getAudioMetadata(buffer).then(metadata => metadata.duration)
  }

  static async optimizeForStreaming(buffer: Buffer): Promise<Buffer> {
    // Optimize audio file for streaming (move metadata to beginning)
    return new Promise((resolve, reject) => {
      const inputStream = new Readable()
      inputStream.push(buffer)
      inputStream.push(null)

      const chunks: Buffer[] = []

      ffmpeg(inputStream)
        .outputOptions(['-movflags', 'faststart']) // Move metadata to beginning
        .on('error', (err) => {
          reject(createError('Audio optimization failed', 500, 'AUDIO_OPTIMIZATION_FAILED'))
        })
        .on('end', () => {
          resolve(Buffer.concat(chunks))
        })
        .pipe()
        .on('data', (chunk) => chunks.push(chunk))
    })
  }
}