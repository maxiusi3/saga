export interface ApiRequestOptions extends RequestInit {
  responseType?: 'json' | 'blob' | 'text'
}

export interface ApiResponse<T = unknown> {
  data: T
  status: number
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  options: ApiRequestOptions = {},
): Promise<ApiResponse<T>> {
  const headers = new Headers(options.headers)

  if (!(body instanceof FormData) && body !== undefined && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  const response = await fetch(path.startsWith('/api') ? path : `/api${path}`, {
    ...options,
    method,
    credentials: options.credentials ?? 'include',
    headers,
    body: body instanceof FormData ? body : body === undefined ? undefined : JSON.stringify(body),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(text || `API request failed with ${response.status}`)
  }

  if (options.responseType === 'blob') {
    return { data: (await response.blob()) as T, status: response.status }
  }

  if (options.responseType === 'text') {
    return { data: (await response.text()) as T, status: response.status }
  }

  return { data: (await response.json()) as T, status: response.status }
}

export const httpApi = {
  get: <T = unknown>(path: string, options?: ApiRequestOptions) =>
    request<T>('GET', path, undefined, options),
  post: <T = unknown>(path: string, body?: unknown, options?: ApiRequestOptions) =>
    request<T>('POST', path, body, options),
  put: <T = unknown>(path: string, body?: unknown, options?: ApiRequestOptions) =>
    request<T>('PUT', path, body, options),
  delete: <T = unknown>(path: string, options?: ApiRequestOptions) =>
    request<T>('DELETE', path, undefined, options),
}
