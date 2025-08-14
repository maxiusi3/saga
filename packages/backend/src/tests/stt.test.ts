import request from 'supertest'
import { app } from '../index'
import { UserModel } from '../models/user'
import { ProjectModel } from '../models/project'
import { StoryModel } from '../models/story'
import { AuthConfig } from '../config/auth'
import { SpeechToTextService, GoogleCloudSTTProvider, AWSTranscribeProvider, AssemblyAIProvider } from '../services/speech-to-text-service'

// Mock Google Cloud Speech
jest.mock('@google-cloud/speech', () => ({
  SpeechClient: jest.fn(() => ({
    recognize: jest.fn(() => Promise.resolve([{
      results: [{
        alternatives: [{
          transcript: 'This is a test transcript from Google Cloud Speech.',
          confidence: 0.95,
          words: [
            { word: 'This', startTime: { seconds: '0', nanos: 0 }, endTime: { seconds: '0', nanos: 500000000 } },
            { word: 'is', startTime: { seconds: '0', nanos: 500000000 }, endTime: { seconds: '0', nanos: 700000000 } },
            { word: 'a', startTime: { seconds: '0', nanos: 700000000 }, endTime: { seconds: '0', nanos: 800000000 } },
            { word: 'test', startTime: { seconds: '0', nanos: 800000000 }, endTime: { seconds: '1', nanos: 200000000 } },
          ],
        }],
      }],
    }])),
    longRunningRecognize: jest.fn(() => ({
      promise: jest.fn(() => Promise.resolve([{
        results: [{
          alternatives: [{
            transcript: 'This is a long-running test transcript.',
            confidence: 0.92,
          }],
        }],
      }])),
    })),
    listModels: jest.fn(() => Promise.resolve([{}])),
  })),
}))

// Mock axios for external API calls
jest.mock('axios', () => ({
  get: jest.fn(() => Promise.resolve({
    data: Buffer.from('mock-audio-data'),
    headers: { 'content-length': '1048576' }, // 1MB
  })),
  head: jest.fn(() => Promise.resolve({
    headers: { 'content-length': '1048576' },
  })),
  post: jest.fn((url, data) => {
    if (url.includes('assemblyai.com/v2/transcript') && !url.includes('/')) {
      // Submit transcription
      return Promise.resolve({
        data: { id: 'test-transcript-id' },
      })
    } else if (url.includes('assemblyai.com/v2/transcript/')) {
      // Poll for results
      return Promise.resolve({
        data: {
          status: 'completed',
          text: 'This is a test transcript from AssemblyAI.',
          confidence: 0.88,
          words: [
            { text: 'This', start: 0, end: 500, confidence: 0.9 },
            { text: 'is', start: 500, end: 700, confidence: 0.95 },
          ],
        },
      })
    }
    return Promise.resolve({ data: {} })
  }),
}))

describe('Speech-to-Text Service', () => {
  let facilitatorUser: any
  let facilitatorToken: string
  let testProject: any
  let testStory: any

  beforeEach(async () => {
    // Set up environment variables
    process.env.GOOGLE_CLOUD_PROJECT_ID = 'test-project'
    process.env.GOOGLE_CLOUD_CREDENTIALS = JSON.stringify({
      type: 'service_account',
      project_id: 'test-project',
    })
    process.env.ASSEMBLYAI_API_KEY = 'test-assemblyai-key'

    // Create test user
    facilitatorUser = await UserModel.createUser({
      name: 'Facilitator User',
      email: 'facilitator@example.com',
      password: 'Password123',
    })

    facilitatorToken = AuthConfig.generateTokens(facilitatorUser).accessToken

    // Create test project
    testProject = await ProjectModel.createProject({
      name: 'Test Project',
      facilitatorId: facilitatorUser.id,
    })

    // Add facilitator role
    await ProjectModel.db('user_roles').insert({
      user_id: facilitatorUser.id,
      type: 'facilitator',
      project_id: testProject.id,
    })

    // Create test story
    testStory = await StoryModel.createStory({
      projectId: testProject.id,
      title: 'Test Story',
      audioUrl: 'https://example.com/audio.mp3',
      aiPrompt: 'Tell me about your childhood',
    })
  })

  describe('SpeechToTextService', () => {
    let sttService: SpeechToTextService

    beforeEach(() => {
      sttService = new SpeechToTextService()
    })

    describe('transcribeAudio', () => {
      it('should transcribe audio using Google Cloud Speech', async () => {
        const result = await sttService.transcribeAudio('https://example.com/test-audio.mp3', {
          audioFormat: 'audio/mp3',
          duration: 30,
          languageCode: 'en-US',
        })

        expect(result.transcript).toBe('This is a test transcript from Google Cloud Speech.')
        expect(result.confidence).toBe(0.95)
        expect(result.words).toHaveLength(4)
        expect(result.words![0].word).toBe('This')
      })

      it('should handle long audio files with long-running recognition', async () => {
        const result = await sttService.transcribeAudio('https://example.com/long-audio.mp3', {
          audioFormat: 'audio/mp3',
          duration: 300, // 5 minutes
          languageCode: 'en-US',
        })

        expect(result.transcript).toBe('This is a long-running test transcript.')
        expect(result.confidence).toBe(0.92)
      })

      it('should fall back to alternative providers when primary fails', async () => {
        // Mock Google Cloud to fail
        const mockSpeechClient = require('@google-cloud/speech').SpeechClient
        mockSpeechClient.mockImplementation(() => ({
          recognize: jest.fn(() => Promise.reject(new Error('Google Cloud failed'))),
          listModels: jest.fn(() => Promise.reject(new Error('Connection failed'))),
        }))

        const result = await sttService.transcribeAudio('https://example.com/test-audio.mp3', {
          audioFormat: 'audio/mp3',
          duration: 30,
          languageCode: 'en-US',
        })

        // Should get result from AssemblyAI fallback
        expect(result.transcript).toBe('This is a test transcript from AssemblyAI.')
        expect(result.confidence).toBe(0.88)
      })
    })

    describe('getAvailableProviders', () => {
      it('should return list of available providers', async () => {
        const providers = await sttService.getAvailableProviders()

        expect(providers).toHaveLength(3)
        expect(providers[0].name).toBe('Google Cloud Speech-to-Text')
        expect(providers[1].name).toBe('AWS Transcribe')
        expect(providers[2].name).toBe('AssemblyAI')
      })
    })

    describe('validateConfiguration', () => {
      it('should validate configuration successfully', async () => {
        const validation = await sttService.validateConfiguration()

        expect(validation.valid).toBe(true)
        expect(validation.errors).toHaveLength(0)
      })

      it('should detect configuration issues', async () => {
        delete process.env.GOOGLE_CLOUD_PROJECT_ID

        const validation = await sttService.validateConfiguration()

        expect(validation.valid).toBe(false)
        expect(validation.errors.length).toBeGreaterThan(0)
      })
    })

    describe('getSupportedLanguages', () => {
      it('should return list of supported languages', () => {
        const languages = sttService.getSupportedLanguages()

        expect(languages.length).toBeGreaterThan(0)
        expect(languages[0]).toHaveProperty('code')
        expect(languages[0]).toHaveProperty('name')
        expect(languages.find(l => l.code === 'en-US')).toBeDefined()
      })
    })
  })

  describe('Individual STT Providers', () => {
    describe('GoogleCloudSTTProvider', () => {
      let provider: GoogleCloudSTTProvider

      beforeEach(() => {
        provider = new GoogleCloudSTTProvider()
      })

      it('should transcribe audio successfully', async () => {
        const config = {
          encoding: 'MP3' as const,
          sampleRateHertz: 44100,
          languageCode: 'en-US',
          enableAutomaticPunctuation: true,
        }

        const result = await provider.transcribe('https://example.com/test.mp3', config)

        expect(result.transcript).toBe('This is a test transcript from Google Cloud Speech.')
        expect(result.confidence).toBe(0.95)
      })

      it('should check availability', async () => {
        const isAvailable = await provider.isAvailable()
        expect(isAvailable).toBe(true)
      })
    })

    describe('AssemblyAIProvider', () => {
      let provider: AssemblyAIProvider

      beforeEach(() => {
        provider = new AssemblyAIProvider()
      })

      it('should transcribe audio successfully', async () => {
        const config = {
          encoding: 'MP3' as const,
          sampleRateHertz: 44100,
          languageCode: 'en-US',
          enableAutomaticPunctuation: true,
        }

        const result = await provider.transcribe('https://example.com/test.mp3', config)

        expect(result.transcript).toBe('This is a test transcript from AssemblyAI.')
        expect(result.confidence).toBe(0.88)
      })

      it('should check availability', async () => {
        const isAvailable = await provider.isAvailable()
        expect(isAvailable).toBe(true)
      })
    })
  })
})

describe('STT API Endpoints', () => {
  let facilitatorUser: any
  let facilitatorToken: string
  let testStory: any

  beforeEach(async () => {
    // Create test user and story (reuse setup from above)
    facilitatorUser = await UserModel.createUser({
      name: 'Facilitator User',
      email: 'facilitator@example.com',
      password: 'Password123',
    })

    facilitatorToken = AuthConfig.generateTokens(facilitatorUser).accessToken

    const testProject = await ProjectModel.createProject({
      name: 'Test Project',
      facilitatorId: facilitatorUser.id,
    })

    await ProjectModel.db('user_roles').insert({
      user_id: facilitatorUser.id,
      type: 'facilitator',
      project_id: testProject.id,
    })

    testStory = await StoryModel.createStory({
      projectId: testProject.id,
      title: 'Test Story',
      audioUrl: 'https://example.com/audio.mp3',
    })
  })

  describe('GET /api/stt/providers', () => {
    it('should return available STT providers', async () => {
      const response = await request(app)
        .get('/api/stt/providers')
        .expect(200)

      expect(response.body.data.providers).toHaveLength(3)
      expect(response.body.data.providers[0]).toHaveProperty('name')
      expect(response.body.data.providers[0]).toHaveProperty('available')
    })
  })

  describe('GET /api/stt/languages', () => {
    it('should return supported languages', async () => {
      const response = await request(app)
        .get('/api/stt/languages')
        .expect(200)

      expect(response.body.data.languages.length).toBeGreaterThan(0)
      expect(response.body.data.languages[0]).toHaveProperty('code')
      expect(response.body.data.languages[0]).toHaveProperty('name')
    })
  })

  describe('GET /api/stt/config/validate', () => {
    it('should validate STT configuration', async () => {
      const response = await request(app)
        .get('/api/stt/config/validate')
        .expect(200)

      expect(response.body.data).toHaveProperty('valid')
      expect(response.body.data).toHaveProperty('errors')
    })
  })

  describe('POST /api/stt/stories/:storyId/retranscribe', () => {
    it('should queue story for retranscription', async () => {
      const response = await request(app)
        .post(`/api/stt/stories/${testStory.id}/retranscribe`)
        .set('Authorization', `Bearer ${facilitatorToken}`)
        .send({
          languageCode: 'en-US',
          enableSpeakerDiarization: true,
        })
        .expect(200)

      expect(response.body.data.storyId).toBe(testStory.id)
      expect(response.body.data.status).toBe('queued')
    })

    it('should reject retranscription without authentication', async () => {
      const response = await request(app)
        .post(`/api/stt/stories/${testStory.id}/retranscribe`)
        .send({
          languageCode: 'en-US',
        })
        .expect(401)

      expect(response.body.error.code).toBe('MISSING_TOKEN')
    })
  })

  describe('GET /api/stt/stories/:storyId/status', () => {
    it('should return transcription status', async () => {
      const response = await request(app)
        .get(`/api/stt/stories/${testStory.id}/status`)
        .set('Authorization', `Bearer ${facilitatorToken}`)
        .expect(200)

      expect(response.body.data.storyId).toBe(testStory.id)
      expect(response.body.data).toHaveProperty('status')
      expect(response.body.data).toHaveProperty('hasTranscript')
    })
  })

  describe('POST /api/stt/test', () => {
    it('should perform test transcription', async () => {
      const response = await request(app)
        .post('/api/stt/test')
        .set('Authorization', `Bearer ${facilitatorToken}`)
        .send({
          audioUrl: 'https://example.com/test-audio.mp3',
          languageCode: 'en-US',
        })
        .expect(200)

      expect(response.body.data).toHaveProperty('transcript')
      expect(response.body.data).toHaveProperty('confidence')
    })
  })

  describe('GET /api/stt/queue/stats', () => {
    it('should return queue statistics', async () => {
      const response = await request(app)
        .get('/api/stt/queue/stats')
        .set('Authorization', `Bearer ${facilitatorToken}`)
        .expect(200)

      expect(response.body.data).toHaveProperty('sttQueue')
      expect(response.body.data).toHaveProperty('audioQueue')
    })
  })
})