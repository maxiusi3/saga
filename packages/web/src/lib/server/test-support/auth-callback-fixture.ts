import { createServer, ServerResponse, IncomingHttpHeaders } from 'node:http'
import type { Socket } from 'node:net'

export const callbackUser = { id: '11111111-1111-4111-8111-111111111111', aud: 'authenticated', role: 'authenticated', email: 'synthetic@example.invalid', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' }
export const callbackSession = { access_token: 'synthetic-access-token', refresh_token: 'synthetic-refresh-token', expires_in: 3600, token_type: 'bearer', user: callbackUser }
export const verifierName = 'sb-127-auth-token-code-verifier'
export const sessionName = 'sb-127-auth-token'
export const verifier = 'synthetic-pkce-verifier-only-for-loopback'
export const verifierCookie = `${verifierName}=base64-${Buffer.from(JSON.stringify(verifier)).toString('base64url')}`
type Reply = { status?: number; body?: unknown; headers?: Record<string, string>; action?: 'hold' | 'headers-only' | 'drop' | 'invalid-json' }

export async function startAuthCallbackFixture() {
  const captured: Array<{ path: string; method?: string; body: unknown; headers: IncomingHttpHeaders }> = []
  const reply: Reply = { body: callbackSession }
  const sockets = new Set<Socket>()
  const held = new Set<ServerResponse>()
  const waiters: Array<() => void> = []
  const server = createServer(async (request, response) => {
    let raw = ''
    for await (const chunk of request) raw += chunk.toString()
    captured.push({ path: request.url || '', method: request.method, body: raw ? JSON.parse(raw) : null, headers: request.headers })
    if (reply.action === 'drop') request.socket.destroy()
    else if (reply.action === 'hold' || reply.action === 'headers-only') {
      held.add(response)
      response.once('close', () => held.delete(response))
      if (reply.action === 'headers-only') { response.writeHead(200, { 'Content-Type': 'application/json' }); response.write('{') }
    } else {
      response.writeHead(reply.status || 200, { 'Content-Type': 'application/json', 'X-Supabase-Api-Version': '2024-01-01', ...reply.headers })
      response.end(reply.action === 'invalid-json' ? '{invalid json' : JSON.stringify(reply.body))
    }
    for (const resolve of waiters.splice(0)) resolve()
  })
  server.on('connection', socket => { sockets.add(socket); socket.once('close', () => sockets.delete(socket)) })
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('Synthetic fixture unavailable')
  return {
    url: `http://127.0.0.1:${address.port}`, captured, reply,
    waitForRequest: () => captured.length ? Promise.resolve() : new Promise<void>(resolve => waiters.push(resolve)),
    async close() {
      const closed = [...sockets].map(socket => new Promise<void>(resolve => socket.once('close', () => resolve())))
      for (const response of held) response.destroy()
      for (const socket of sockets) socket.destroy()
      await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
      await Promise.all(closed)
      return { listening: server.listening, sockets: sockets.size, held: held.size }
    },
  }
}
