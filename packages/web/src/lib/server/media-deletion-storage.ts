import { deletionBounded, validateDeletionObject, type DeletionObject } from './media-deletion-execution'

export type DeletionStorageOptions = { storageUrl: string; serviceRoleKey: string; signal?: AbortSignal; ioTimeoutMs?: number; fetch?: typeof fetch }
const unavailable = () => new Error('media_deletion_storage_unavailable')

export function createDeletionStorage(options: DeletionStorageOptions) {
  const { storageUrl, serviceRoleKey, signal, ioTimeoutMs = 30000, fetch: fetcher = fetch } = options
  const base = new URL(storageUrl)
  if (base.protocol !== 'https:' || base.username || base.password || base.pathname !== '/' || base.search || base.hash ||
    typeof serviceRoleKey !== 'string' || !serviceRoleKey || /\s/.test(serviceRoleKey) ||
    !Number.isInteger(ioTimeoutMs) || ioTimeoutMs < 1 || ioTimeoutMs > 60000) throw unavailable()
  const headers = { Authorization: `Bearer ${serviceRoleKey}`, apikey: serviceRoleKey }
  async function request<T>(path: string, init: RequestInit, read: (response: Response) => Promise<T>): Promise<T> {
    try {
      return await deletionBounded(ioTimeoutMs, signal, async abort => {
        const pending = fetcher(base.origin + '/storage/v1/' + path, { ...init, headers: { ...headers, ...init.headers }, signal: abort, redirect: 'error', cache: 'no-store' })
        void pending.then(late => { if (abort.aborted) void late.body?.cancel().catch(() => {}) }, () => {})
        const response = await pending
        try { if (response.redirected) throw unavailable(); return await read(response) }
        finally { void response.body?.cancel().catch(() => {}) }
      })
    } catch { throw unavailable() }
  }
  async function json(response: Response): Promise<unknown> {
    if (!response.body) throw unavailable()
    const reader = response.body.getReader(), chunks: Uint8Array[] = []
    let size = 0
    try {
      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        size += value.byteLength
        if (size > 1048576) throw unavailable()
        chunks.push(value)
      }
      return JSON.parse(Buffer.concat(chunks).toString('utf8'))
    } finally { void reader.cancel().catch(() => {}); reader.releaseLock() }
  }
  return {
    async exists(value: DeletionObject): Promise<boolean> {
      const o = validateDeletionObject(value)
      return request(`object/authenticated/${o.bucket}/${o.objectKey}`, { method: 'GET', headers: { Range: 'bytes=0-0' } }, async response => {
        if ([200, 206].includes(response.status)) return true
        if (response.status === 404) return false
        if (response.status === 400) {
          const body = await json(response) as { statusCode?: unknown }
          if (body && String(body.statusCode) === '404') return false
        }
        throw unavailable()
      })
    },
    async remove(value: DeletionObject): Promise<'deleted' | 'not_found'> {
      const o = validateDeletionObject(value)
      return request(`object/${o.bucket}`, { method: 'DELETE', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ prefixes: [o.objectKey] }) }, async response => {
        if (response.status !== 200) throw unavailable()
        const rows = await json(response)
        if (!Array.isArray(rows) || rows.length > 1 || rows.some(row => !row || row.name !== o.objectKey || (row.bucket_id != null && row.bucket_id !== o.bucket))) throw unavailable()
        return rows.length ? 'deleted' : 'not_found'
      })
    },
    async list(value: DeletionObject): Promise<DeletionObject[]> {
      const prefix = validateDeletionObject(value), found: DeletionObject[] = []
      let previous = ''
      for (let offset = 0; offset < 100000; offset += 1000) {
        const rows = await request(`object/list/${prefix.bucket}`, { method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ prefix: prefix.objectKey, limit: 1000, offset, sortBy: { column: 'name', order: 'asc' } }) }, async response => {
          if (response.status !== 200) throw unavailable()
          const data = await json(response)
          if (!Array.isArray(data) || data.length > 1000) throw unavailable()
          return data as Record<string, unknown>[]
        })
        for (const row of rows) {
          if (!row || typeof row.name !== 'string' || !/^(0|[1-9][0-9]*)$/.test(row.name) || typeof row.id !== 'string' || !row.id || row.name <= previous) throw unavailable()
          previous = row.name
          found.push(validateDeletionObject({ bucket: prefix.bucket, objectKey: prefix.objectKey + '/' + row.name }))
        }
        if (rows.length < 1000) return found
      }
      throw unavailable()
    },
  }
}
