/**
 * @jest-environment node
 */

describe('validateConfig', () => {
  const originalEnv = process.env

  beforeEach(() => {
    jest.resetModules()
    process.env = {
      ...originalEnv,
      NEXT_PUBLIC_SUPABASE_URL: 'https://project.supabase.co',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon-key',
      SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
      TEXT_API_KEY: 'text-key',
      TEXT_API_BASE_URL: 'https://integrate.api.nvidia.com/v1/chat/completions',
      TEXT_MODEL: 'glm-5.1',
    }
    delete process.env.OPENROUTER_API_KEY
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('accepts TEXT_API_KEY as the required text model credential', async () => {
    const { validateConfig } = await import('../config')

    const result = validateConfig()

    expect(result.errors).not.toContain('Missing required server environment variable: OPENROUTER_API_KEY')
    expect(result.isValid).toBe(true)
  })
})
