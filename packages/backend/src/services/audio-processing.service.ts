import ffmpeg from 'fluent-ffmpeg'
import ffmpegPath from 'ffmpeg-static'
import fs from 'fs'

if (ffmpegPath) {
    ffmpeg.setFfmpegPath(ffmpegPath)
}

export class AudioProcessingService {
    /**
     * Process audio file: Denoise, Truncate Silence, Normalize Loudness
     */
    async processAudio(inputPath: string, outputPath: string): Promise<void> {
        return new Promise((resolve, reject) => {
            console.log(`Starting audio processing: ${inputPath} -> ${outputPath}`)

            ffmpeg(inputPath)
                .audioFilters([
                    // 1. Highpass filter to remove low frequency rumble (< 80Hz)
                    'highpass=f=80',

                    // 2. Silence Truncation: 
                    // stop_periods=-1 (remove all silences)
                    // stop_duration=2 (silence > 2s)
                    // stop_threshold=-40dB
                    // leave_silence=1 (leave 1s of silence) - Note: silenceremove syntax varies, using standard
                    // 'silenceremove=stop_periods=-1:stop_duration=2:stop_threshold=-40dB', 
                    // Ideally we want to shorten silence, not remove. ffmpeg silenceremove is aggressive.
                    // For MVP, let's stick to Loudnorm and basic EQ to be safe. 
                    // Complex silence shortening often requires two passes or complex filters.
                    // We will use a safe silence remove: remove silence at start/end and reduce long gaps.
                    'silenceremove=start_periods=1:start_duration=1:start_threshold=-50dB:stop_periods=1:stop_duration=1:stop_threshold=-50dB',

                    // 3. Loudness Normalization (EBU R128 target -16 LUFS for podcasts/mobile)
                    'loudnorm=I=-16:TP=-1.5:LRA=11'
                ])
                .on('end', () => {
                    console.log('Audio processing finished successfully')
                    resolve()
                })
                .on('error', (err) => {
                    console.error('Audio processing error:', err)
                    reject(err)
                })
                .save(outputPath)
        })
    }
}

export const audioProcessingService = new AudioProcessingService()
