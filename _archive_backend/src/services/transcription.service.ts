import OpenAI from 'openai'
import fs from 'fs'

export class TranscriptionService {
    private openai: OpenAI

    constructor() {
        this.openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY,
        })
    }

    async transcribe(filePath: string, language: string = 'en'): Promise<string> {
        try {
            const transcription = await this.openai.audio.transcriptions.create({
                file: fs.createReadStream(filePath),
                model: 'whisper-1',
                language,
                response_format: 'text',
            })

            return transcription as unknown as string
        } catch (error) {
            console.error('Transcription error:', error)
            throw error
        }
    }
}

export const transcriptionService = new TranscriptionService()
