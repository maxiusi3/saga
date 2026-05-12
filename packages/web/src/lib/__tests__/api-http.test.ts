import { httpApi } from '../api-http'

function jsonResponse(body: unknown, init: { status?: number; statusText?: string; ok?: boolean } = {}) {
  return {
    ok: init.ok ?? ((init.status ?? 200) >= 200 && (init.status ?? 200) < 300),
    status: init.status ?? 200,
    statusText: init.statusText ?? 'OK',
    headers: new Headers({ 'Content-Type': 'application/json' }),
    json: jest.fn(async () => body),
    text: jest.fn(async () => JSON.stringify(body)),
    blob: jest.fn(),
  }
}

function emptyResponse(status = 204) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: 'No Content',
    headers: new Headers(),
    json: jest.fn(async () => {
      throw new SyntaxError('Unexpected end of JSON input')
    }),
    text: jest.fn(async () => ''),
    blob: jest.fn(),
  }
}

describe('httpApi', () => {
  const fetchMock = jest.fn()

  beforeEach(() => {
    fetchMock.mockReset()
    global.fetch = fetchMock
  })

  it('serializes params into the request URL', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true }))

    await httpApi.get('/billing/history', {
      params: { limit: 10, cursor: 'next', includeFailed: false, empty: undefined },
    })

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/billing/history?limit=10&cursor=next&includeFailed=false',
      expect.objectContaining({ method: 'GET', credentials: 'include' }),
    )
  })

  it('throws axios-like errors with parsed response data', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ error: { message: 'Search failed' } }, { status: 400, statusText: 'Bad Request' }),
    )

    await expect(httpApi.get('/search')).rejects.toMatchObject({
      message: 'Search failed',
      status: 400,
      response: {
        status: 400,
        data: { error: { message: 'Search failed' } },
      },
    })
  })

  it('returns null data for empty success responses', async () => {
    fetchMock.mockResolvedValueOnce(emptyResponse())

    await expect(httpApi.delete('/exports/export-1')).resolves.toMatchObject({
      data: null,
      status: 204,
    })
  })

  it('preserves non-JSON body types without stringifying them', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true }))
    const body = new URLSearchParams({ q: 'family' })

    await httpApi.post('/search', body, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    })

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/search',
      expect.objectContaining({ body }),
    )
  })
})
