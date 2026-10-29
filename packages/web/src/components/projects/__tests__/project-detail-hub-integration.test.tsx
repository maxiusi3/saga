import React from 'react'
import { render, screen } from '@testing-library/react'
import ProjectDetailPage from '@/app/[locale]/dashboard/projects/[id]/page'

const mockProjects = jest.fn()
const mockParams = jest.fn()
const mockHub = jest.fn()
jest.mock('@/lib/projects', () => ({ projectService: { getUserProjects: (...args: unknown[]) => mockProjects(...args) } }))
jest.mock('@/lib/stories', () => ({ storyService: { getStoriesByProject: jest.fn().mockResolvedValue([]) } }))
jest.mock('@/stores/auth-store', () => ({ useAuthStore: () => ({ user: { id: 'user-123' } }) }))
jest.mock('next/navigation', () => ({ useParams: () => mockParams(), useRouter: () => ({ push: jest.fn() }) }))
jest.mock('../ConnectedProjectHub', () => ({ ConnectedProjectHub: (props: unknown) => { mockHub(props); return <div data-testid="connected-hub" /> } }))

const originalFlag = process.env.MEDIA_ASSETS_ENABLED
beforeEach(() => {
  jest.clearAllMocks()
  mockParams.mockReturnValue({ id: 'project-123', locale: 'en' })
  mockProjects.mockResolvedValue([{ id: 'project-123', name: 'Synthetic Family', user_role: 'storyteller', is_owner: false, members: [] }])
})
afterEach(() => {
  if (originalFlag === undefined) delete process.env.MEDIA_ASSETS_ENABLED
  else process.env.MEDIA_ASSETS_ENABLED = originalFlag
})

it.each([undefined, 'false', 'TRUE'])('does not mount new capabilities for flag %s', async flag => {
  if (flag === undefined) delete process.env.MEDIA_ASSETS_ENABLED
  else process.env.MEDIA_ASSETS_ENABLED = flag
  render(<ProjectDetailPage />)
  await screen.findByText('Synthetic Family')
  expect(mockHub).not.toHaveBeenCalled()
})

it('mounts the existing hub on the real project page only for exact true', async () => {
  process.env.MEDIA_ASSETS_ENABLED = 'true'
  render(<ProjectDetailPage />)
  await screen.findByTestId('connected-hub')
  expect(mockHub).toHaveBeenCalledWith(expect.objectContaining({ projectId: 'project-123', projectName: 'Synthetic Family', userId: 'user-123', locale: 'en', canRecord: true, canInvite: false }))
})

it('does not replace a failed project lookup with a fictional project', async () => {
  process.env.MEDIA_ASSETS_ENABLED = 'true'
  mockParams.mockReturnValue({ id: '1', locale: 'en' })
  mockProjects.mockRejectedValue(new Error('private backend details'))
  render(<ProjectDetailPage />)
  await screen.findByText('Failed to load project data')
  expect(mockHub).not.toHaveBeenCalled()
  expect(screen.queryByText("Grandma's Memoir")).not.toBeInTheDocument()
})
