export interface ApiRequestOptions extends RequestInit {
  responseType?: 'json' | 'blob' | 'text'
  params?: Record<string, string | number | boolean | null | undefined> | URLSearchParams
}

export interface ApiResponse<T = any> {
  data: T
  success: boolean
  error?: string
  status: number
  headers: Headers
  statusText: string
}

export class ApiError<T = any> extends Error {
  response: ApiResponse<T>
  status: number
  data: T

  constructor(message: string, response: ApiResponse<T>) {
    super(message)
    this.name = 'ApiError'
    this.response = response
    this.status = response.status
    this.data = response.data
  }
}

function normalizePath(path: string) {
  if (/^https?:\/\//i.test(path) || path.startsWith('/api')) {
    return path
  }

  return path.startsWith('/') ? `/api${path}` : `/api/${path}`
}

function appendParams(path: string, params?: ApiRequestOptions['params']) {
  if (!params) return path

  const url = new URL(path, 'http://saga.local')
  const append = (value: string | number | boolean | null | undefined, key: string) => {
    if (value === undefined || value === null) return
    url.searchParams.set(key, String(value))
  }

  if (params instanceof URLSearchParams) {
    params.forEach(append)
  } else {
    Object.entries(params).forEach(([key, value]) => append(value, key))
  }

  if (/^https?:\/\//i.test(path)) {
    return url.toString()
  }

  return `${url.pathname}${url.search}${url.hash}`
}

function isFetchBody(body: unknown): body is BodyInit {
  return (
    typeof body === 'string' ||
    body instanceof FormData ||
    body instanceof Blob ||
    body instanceof URLSearchParams ||
    body instanceof ArrayBuffer ||
    ArrayBuffer.isView(body) ||
    (typeof ReadableStream !== 'undefined' && body instanceof ReadableStream)
  )
}

function isJsonBody(body: unknown) {
  return body !== undefined && !isFetchBody(body)
}

async function readResponseData<T>(response: Response, responseType?: ApiRequestOptions['responseType']): Promise<T> {
  if (response.status === 204) return null as T

  if (responseType === 'blob') {
    return (await response.blob()) as T
  }

  if (responseType === 'text') {
    return (await response.text()) as T
  }

  try {
    return (await response.json()) as T
  } catch {
    return null as T
  }
}

function errorMessage(data: unknown, fallback: string) {
  if (data && typeof data === 'object') {
    const maybeData = data as { error?: { message?: unknown } | string; message?: unknown }
    if (maybeData.error && typeof maybeData.error === 'object' && typeof maybeData.error.message === 'string') {
      return maybeData.error.message
    }
    if (typeof maybeData.error === 'string') {
      return maybeData.error
    }
    if (typeof maybeData.message === 'string') {
      return maybeData.message
    }
  }

  if (typeof data === 'string' && data) return data
  return fallback
}

async function request<T = any>(
  method: string,
  path: string,
  body?: unknown,
  options: ApiRequestOptions = {},
): Promise<ApiResponse<T>> {
  const { params, responseType, ...fetchOptions } = options
  const headers = new Headers(options.headers)
  const requestBody = isJsonBody(body) ? JSON.stringify(body) : (body as BodyInit | undefined)

  if (isJsonBody(body) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  const response = await fetch(appendParams(normalizePath(path), params), {
    ...fetchOptions,
    method,
    credentials: options.credentials ?? 'include',
    headers,
    body: requestBody,
  })

  const data = await readResponseData<T>(response, responseType)
  const apiResponse: ApiResponse<T> = {
    data,
    success: response.ok,
    error: response.ok ? undefined : errorMessage(data, `API request failed with ${response.status}`),
    status: response.status,
    headers: response.headers,
    statusText: response.statusText,
  }

  if (!response.ok) {
    throw new ApiError(apiResponse.error ?? `API request failed with ${response.status}`, apiResponse)
  }

  return apiResponse
}

export const httpApi = {
  get: <T = any>(path: string, options?: ApiRequestOptions) =>
    request<T>('GET', path, undefined, options),
  post: <T = any>(path: string, body?: unknown, options?: ApiRequestOptions) =>
    request<T>('POST', path, body, options),
  put: <T = any>(path: string, body?: unknown, options?: ApiRequestOptions) =>
    request<T>('PUT', path, body, options),
  patch: <T = any>(path: string, body?: unknown, options?: ApiRequestOptions) =>
    request<T>('PATCH', path, body, options),
  delete: <T = any>(path: string, options?: ApiRequestOptions) =>
    request<T>('DELETE', path, undefined, options),
}
