// Synthetic Auth only: no JWT signature, OAuth provider, SMTP, RLS or database qualification.
const { createServer } = require('node:http')
const { createHash } = require('node:crypto')
const user = { id: '11111111-1111-4111-8111-111111111111', aud: 'authenticated', role: 'authenticated', email: 'synthetic@example.invalid', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' }
const sessionName = 'sb-127-auth-token'
const verifierName = `${sessionName}-code-verifier`
const jwt = (counter) => [Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url'), Buffer.from(JSON.stringify({ sub: user.id, aud: 'authenticated', role: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600, iat: Math.floor(Date.now() / 1000), synthetic: counter })).toString('base64url'), 'synthetic-signature'].join('.')
async function startSessionFixture(bridge) {
  const sockets = new Set(), captured = [], codes = new Map(), tokens = new Set(), refreshes = new Set()
  let counter = 0, origin = '', mailChallenge = null
  const control = { userStatus: 200, refreshStatus: 200, hold: false, drop: false, headersOnly: false, userMetadataSize: 0, userDelay: 0 }
  const issue = () => {
    const access_token = jwt(++counter), refresh_token = `synthetic-refresh-${counter}`
    tokens.add(access_token); refreshes.add(refresh_token)
    return { access_token, refresh_token, token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, user: { ...user, user_metadata: control.userMetadataSize ? { padding: 'x'.repeat(control.userMetadataSize) } : {} } }
  }
  const server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url, origin)
      if (!url.pathname.startsWith('/auth/v1/')) {
        if (bridge) return await bridge(request, response, origin)
        response.writeHead(404); return response.end()
      }
      let raw = ''; for await (const chunk of request) raw += chunk.toString()
      const body = raw ? JSON.parse(raw) : null
      captured.push({ path: url.pathname + url.search, method: request.method, body, authorization: request.headers.authorization, apikey: request.headers.apikey })
      response.setHeader('X-Supabase-Api-Version', '2024-01-01')
      response.setHeader('Content-Type', 'application/json')
      const reply = (value, status = 200) => { response.writeHead(status); response.end(JSON.stringify(value)) }
      if (control.drop) return request.socket.destroy()
      if (control.hold) return
      if (control.headersOnly) { response.writeHead(200); response.write('{'); return }
      if (url.pathname.endsWith('/authorize')) {
        if (url.searchParams.get('code_challenge_method') !== 's256') return reply({ msg: 'S256 required' }, 400)
        const code = `synthetic-code-${++counter}`
        codes.set(code, url.searchParams.get('code_challenge'))
        const target = new URL(url.searchParams.get('redirect_to'))
        if (target.origin !== origin) return reply({ msg: 'Loopback redirect required' }, 400)
        target.searchParams.set('code', code)
        response.writeHead(302, { Location: target.toString() }); return response.end()
      }
      if (url.pathname.endsWith('/otp')) {
        mailChallenge = body.code_challenge
        if (body.code_challenge_method !== 's256') return reply({ msg: 'S256 required' }, 400)
        return reply({})
      }
      if (url.pathname.endsWith('/token')) {
        if (url.searchParams.get('grant_type') === 'pkce') {
          const challenge = codes.get(body.auth_code)
          codes.delete(body.auth_code)
          if (!challenge || createHash('sha256').update(body.code_verifier || '').digest('base64url') !== challenge) return reply({ msg: 'Invalid synthetic verifier', code: 'bad_code_verifier' }, 400)
          return reply(issue())
        }
        if (control.refreshStatus !== 200 || !refreshes.has(body.refresh_token)) return reply({ msg: 'PRIVATE_REFRESH_SENTINEL', code: 'refresh_token_not_found' }, control.refreshStatus === 200 ? 400 : control.refreshStatus)
        refreshes.delete(body.refresh_token)
        return reply(issue())
      }
      if (url.pathname.endsWith('/verify')) {
        if (body.token_hash === 'synthetic-token-hash' || (body.email === user.email && body.token === '123456')) return reply(issue())
        return reply({ msg: 'Invalid synthetic OTP' }, 400)
      }
      if (url.pathname.endsWith('/user')) {
        if (control.userDelay) await new Promise(resolve => setTimeout(resolve, control.userDelay))
        const token = (request.headers.authorization || '').replace(/^Bearer /, '')
        if (control.userStatus !== 200 || !tokens.has(token)) return reply({ msg: 'PRIVATE_USER_SENTINEL', code: 'bad_jwt' }, control.userStatus === 200 ? 401 : control.userStatus)
        return reply(user)
      }
      if (url.pathname.endsWith('/logout')) { tokens.clear(); refreshes.clear(); response.writeHead(204); return response.end() }
      reply({ msg: 'Unexpected synthetic request' }, 400)
    } catch { if (!response.headersSent) response.writeHead(500); response.end() }
  })
  server.on('connection', socket => { sockets.add(socket); socket.once('close', () => sockets.delete(socket)) })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  origin = `http://127.0.0.1:${server.address().port}`
  return {
    origin, user, control, captured, issue,
    emailCode() { const code = `synthetic-email-code-${++counter}`; codes.set(code, mailChallenge); return code },
    async close() {
      const closed = [...sockets].map(socket => new Promise(resolve => socket.once('close', resolve)))
      for (const socket of sockets) socket.destroy()
      await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
      await Promise.all(closed)
      return { listening: server.listening, sockets: sockets.size }
    },
  }
}
module.exports = { startSessionFixture, user, sessionName, verifierName }
