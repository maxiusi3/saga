import { AIService } from '../ai-service'

const getAccessToken = jest.fn()

jest.mock('@/stores/auth-store', () => ({
  useAuthStore: {
    getState: () => ({ getAccessToken }),
  },
}))

describe('AIService authenticated requests', () => {
  const fetchMock = jest.fn()

  beforeEach(() => {
    jest.spyOn(AIService, 'checkAvailability').mockResolvedValue(true)
    getAccessToken.mockResolvedValue('access-token-1')
    fetchMock.mockReset()
    global.fetch = fetchMock
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('sends the Supabase bearer token to protected AI POST endpoints', async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ text: 'transcript', confidence: 0.9 }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          title: 'Story',
          summary: 'Summary',
          followUpQuestions: [],
          confidence: 0.8,
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ prompt: 'What happened next?' }),
      })

    await AIService.transcribeAudio(new Blob(['audio']), { maxRetries: 0 })
    await AIService.generateAIContent('story transcript', undefined, { maxRetries: 0 })
    await AIService.generateRealtimePrompt('story transcript')

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      '/api/ai/transcribe',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer access-token-1',
        }),
      }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      '/api/ai/generate-content',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer access-token-1',
        }),
      }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      '/api/ai/realtime-prompt',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer access-token-1',
        }),
      }),
    )
  })
})
