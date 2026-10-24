/** @jest-environment node */
import { NextRequest } from 'next/server'
import { GET } from '../route'

describe('AI configuration health', () => {
  const originalEnv = process.env

  beforeEach(() => {
    process.env = { ...originalEnv }
    for (const key of ['TEXT_API_KEY', 'OPENROUTER_API_KEY', 'SILICONFLOW_API_KEY']) delete process.env[key]
  })

  afterEach(() => { process.env = originalEnv })

  it('does not claim a server transcription service or demo mode without credentials', async () => {
    const response = await GET(new NextRequest('http://localhost/api/ai/health'))
    expect(await response.json()).toMatchObject({
      services: { transcription: false, content_generation: false },
      mode: 'unavailable',
    })
  })

  it('recognizes TEXT configuration independently of legacy OpenRouter', async () => {
    process.env.TEXT_API_KEY = 'test-text-key'
    process.env.TEXT_MODEL = 'configured-model'
    const response = await GET(new NextRequest('http://localhost/api/ai/health'))
    const body = await response.json()
    expect(body).toMatchObject({ services: { transcription: false, content_generation: true }, mode: 'configured' })
    expect(JSON.stringify(body)).not.toContain('test-text-key')
  })

  it('recognizes ASR configuration independently of text generation', async () => {
    process.env.SILICONFLOW_API_KEY = 'test-asr-key'
    const response = await GET(new NextRequest('http://localhost/api/ai/health'))
    expect(await response.json()).toMatchObject({ services: { transcription: true, content_generation: false }, mode: 'configured' })
  })
})
