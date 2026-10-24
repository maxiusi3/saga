import React from 'react'
import { render, screen, cleanup } from '@testing-library/react'
import InvitationsPage from '@/app/[locale]/dashboard/projects/[id]/invitations/page'

const project = '22222222-2222-4222-8222-222222222222'
const actor = '11111111-1111-4111-8111-111111111111'
const source = '44444444-4444-4444-8444-444444444444'
const getAccessToken = jest.fn(async () => 'synthetic-session.opaque.signature')
jest.mock('next/navigation', () => ({
  useParams: () => ({ id: '22222222-2222-4222-8222-222222222222', locale: 'en' }),
  useRouter: () => ({ back: jest.fn() }),
}))
jest.mock('@/stores/auth-store', () => ({
  useAuthStore: Object.assign(() => ({ user: { id: actor }, getAccessToken }), {
    getState: () => ({ user: { id: actor }, getAccessToken }),
    subscribe: () => () => {},
  }),
}))
jest.mock('sonner', () => ({ toast: { success: jest.fn(), error: jest.fn() } }))
const originalFetch = global.fetch
beforeEach(() => {
  sessionStorage.clear()
  global.fetch = jest.fn(async url => ({
    ok: true,
    status: 200,
    json: async () =>
      String(url).includes('/projects/')
        ? []
        : String(url).endsWith('/sources')
          ? {
              success: true,
              items: [
                { source_id: source, project_id: project, role: 'storyteller', remaining: 2 },
              ],
            }
          : { success: true, items: [] },
  })) as jest.Mock
})
afterEach(() => {
  cleanup()
  global.fetch = originalFetch
  jest.clearAllMocks()
})
test('actual dashboard offers a verified source before sending', async () => {
  render(<InvitationsPage />)
  expect(await screen.findByRole('option', { name: /2 seats available/ })).toHaveValue(source)
})
