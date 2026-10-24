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

  it.each([undefined, 'saga'] as const)('sends the explicit or upload-default storage bucket %s', async storageBucket => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ text: 'Original words' }) })
    await AIService.transcribeAudio(new Blob(['audio']), {
      storagePath: 'alice/projects/family-a/stories/temp/memory.mp3', storageBucket, maxRetries: 0,
    })
    const form = fetchMock.mock.calls[0][1].body as FormData
    expect(form.get('storageBucket')).toBe(storageBucket ?? 'audio-recordings')
    expect(form.get('storagePath')).toBe('alice/projects/family-a/stories/temp/memory.mp3')
    expect(form.has('audio')).toBe(false)
  })

  it('preserves a direct File name and does not attach storage-only fields', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ text: 'Original words' }) })
    await AIService.transcribeAudio(new File(['audio'], 'original.mp3', { type: 'audio/mpeg' }), { maxRetries: 0 })
    const form = fetchMock.mock.calls[0][1].body as FormData
    expect((form.get('audio') as File).name).toBe('original.mp3')
    expect(form.has('storageBucket')).toBe(false)
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

describe('AIService truthful results', () => {
  const originalFetch = global.fetch
  const fetchMock = jest.fn()
  const audio = new Blob(['test audio'])

  beforeEach(() => {
    jest.useFakeTimers()
    getAccessToken.mockResolvedValue('access-token-1')
    fetchMock.mockReset()
    global.fetch = fetchMock
    jest.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    jest.useRealTimers()
    jest.restoreAllMocks()
    global.fetch = originalFetch
  })

  it.each(['transcribe', 'generate'] as const)('rejects %s when the network is unavailable instead of returning a pretend story', async kind => {
    fetchMock.mockRejectedValue(new Error('offline'))
    const onProgress = jest.fn()
    const operation = kind === 'transcribe'
      ? AIService.transcribeAudio(audio, { maxRetries: 0, onProgress })
      : AIService.generateAIContent('Actual family words', undefined, { maxRetries: 0, onProgress })
    const result = operation.then(value => ({ value }), error => ({ error }))

    await jest.runAllTimersAsync()

    expect(await result).toEqual({ error: expect.any(Error) })
    expect(onProgress.mock.calls.some(([, progress]) => progress === 100)).toBe(false)
  })

  it.each([0, 0.2, undefined])('preserves reported transcription confidence %s without inventing a high score', async confidence => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ text: 'Original words', confidence }) })
    const result = await AIService.transcribeAudio(audio, { maxRetries: 0 })
    expect(result).toMatchObject({ text: 'Original words' })
    expect(result.confidence).toBe(confidence)
  })

  it.each([0, 0.2, undefined])('preserves content confidence %s without inventing a high score', async confidence => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ title: 'Their words', summary: 'Their account.', followUpQuestions: [], confidence }) })
    const result = await AIService.generateAIContent('Original words', undefined, { maxRetries: 0 })
    expect(result.transcript).toBe('Original words')
    expect(result.confidence).toBe(confidence)
  })

  it('rejects a malformed successful transcription response', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ text: { unexpected: true } }) })
    await expect(AIService.transcribeAudio(audio, { maxRetries: 0 })).rejects.toThrow()
  })

  it('rejects missing generated content instead of adding a generic family story', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({}) })
    await expect(AIService.generateAIContent('Original words', undefined, { maxRetries: 0 })).rejects.toThrow()
  })

  it('reports unavailable capabilities even when the health endpoint returns HTTP 200', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ services: { transcription: false, content_generation: false } }) })
    await expect(AIService.getServiceStatus()).resolves.toEqual({ available: false, mode: 'unavailable' })
  })
})
