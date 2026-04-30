const nextConfig = require('../../next.config.js')

describe('Next release gates', () => {
  it('does not ignore TypeScript build errors', () => {
    expect(nextConfig.typescript?.ignoreBuildErrors).not.toBe(true)
  })

  it('does not ignore ESLint during builds', () => {
    expect(nextConfig.eslint?.ignoreDuringBuilds).not.toBe(true)
  })
})
