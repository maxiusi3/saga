import { createFixedWindowLimiter } from '../rate-limit'

describe('createFixedWindowLimiter', () => {
  it('allows requests before the limit and blocks after the limit', () => {
    const limiter = createFixedWindowLimiter({ max: 2, windowMs: 60_000, now: () => 1_000 })

    expect(limiter.check('user-1')).toMatchObject({ allowed: true, remaining: 1 })
    expect(limiter.check('user-1')).toMatchObject({ allowed: true, remaining: 0 })
    expect(limiter.check('user-1')).toMatchObject({ allowed: false, remaining: 0 })
  })

  it('resets counts after the fixed window expires', () => {
    let now = 1_000
    const limiter = createFixedWindowLimiter({ max: 1, windowMs: 10_000, now: () => now })

    expect(limiter.check('user-1').allowed).toBe(true)
    expect(limiter.check('user-1').allowed).toBe(false)

    now = 12_000
    expect(limiter.check('user-1')).toMatchObject({ allowed: true, remaining: 0 })
  })

  it('prunes expired buckets during periodic checks', () => {
    let now = 1_000
    const limiter = createFixedWindowLimiter({ max: 1, windowMs: 10_000, now: () => now })

    limiter.check('user-1')
    limiter.check('user-2')
    expect(limiter.size()).toBe(2)

    now = 12_000
    limiter.check('user-3')

    expect(limiter.size()).toBe(1)
  })
})
