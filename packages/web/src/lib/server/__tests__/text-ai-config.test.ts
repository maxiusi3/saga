import { getTextAiConfig, normalizeOpenAiBaseUrl } from '../text-ai-config'

describe('text AI configuration', () => {
  const originalEnv = process.env

  beforeEach(() => {
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('normalizes a full chat completions endpoint into an OpenAI-compatible base URL', () => {
    process.env.TEXT_API_KEY = 'text-key'
    process.env.TEXT_API_BASE_URL = 'https://integrate.api.nvidia.com/v1/chat/completions'
    process.env.TEXT_MODEL = 'glm-5.1'

    expect(getTextAiConfig()).toEqual({
      apiKey: 'text-key',
      baseURL: 'https://integrate.api.nvidia.com/v1',
      model: 'glm-5.1',
    })
  })

  it('falls back to the existing OpenRouter settings when TEXT_* is not configured', () => {
    delete process.env.TEXT_API_KEY
    delete process.env.TEXT_API_BASE_URL
    delete process.env.TEXT_MODEL
    process.env.OPENROUTER_API_KEY = 'openrouter-key'

    expect(getTextAiConfig()).toEqual({
      apiKey: 'openrouter-key',
      baseURL: 'https://openrouter.ai/api/v1',
      model: 'openai/gpt-oss-20b:free',
    })
  })

  it('leaves API root URLs unchanged', () => {
    expect(normalizeOpenAiBaseUrl('https://example.com/v1/')).toBe('https://example.com/v1')
  })
})
