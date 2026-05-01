import { NextRequest, NextResponse } from 'next/server'

export type CronSecretResult =
  | { ok: true }
  | { ok: false; response: NextResponse }

export function requireCronSecret(request: NextRequest): CronSecretResult {
  const expected = process.env.ADMIN_CRON_SECRET
  const provided = request.headers.get('x-cron-secret')

  if (!expected) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Admin cron secret is not configured' }, { status: 503 }),
    }
  }

  if (provided !== expected) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    }
  }

  return { ok: true }
}
