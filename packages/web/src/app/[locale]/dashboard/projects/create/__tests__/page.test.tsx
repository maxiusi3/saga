import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import CreateProjectPage from '../page'
const mockCreate = jest.fn(), mockPush = jest.fn()
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: mockPush }), useParams: () => ({ locale: 'zh-TW' }) }))
jest.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }))
jest.mock('@/stores/auth-store', () => ({ useAuthStore: () => ({ user: { id: 'payer' } }) }))
jest.mock('@/lib/projects', () => ({ projectService: { createProjectWithRole: (...args: unknown[]) => mockCreate(...args) } }))
jest.mock('@/hooks/use-resource-wallet', () => ({ useResourceWallet: () => ({ wallet: { project_vouchers: 0, facilitator_seats: 0, storyteller_seats: 0 }, loading: false, hasResources: () => false }) }))
jest.mock('react-hot-toast', () => ({ toast: { error: jest.fn(), success: jest.fn() } }))
beforeEach(() => jest.clearAllMocks())
it('uses the trusted project allocation with a paid right even when the old wallet is zero', async () => {
  mockCreate.mockResolvedValue({ id: 'new-project' })
  render(<CreateProjectPage />)
  fireEvent.change(screen.getByLabelText(/form.projectName/), { target: { value: 'Family' } })
  fireEvent.click(screen.getByRole('button', { name: 'form.createProject' }))
  await waitFor(() => expect(mockCreate).toHaveBeenCalledWith({ name: 'Family', description: '', facilitator_id: 'payer', role: 'facilitator' }))
  expect(mockPush).toHaveBeenCalledWith('/zh-TW/dashboard/projects/new-project')
})
it('keeps the form and shows a purchase link when a verified right is missing', async () => {
  mockCreate.mockRejectedValue(new Error('Purchase a project first; historical wallet credits do not verify payment'))
  render(<CreateProjectPage />)
  fireEvent.change(screen.getByLabelText(/form.projectName/), { target: { value: 'Family' } })
  fireEvent.click(screen.getByRole('button', { name: 'form.createProject' }))
  await screen.findByRole('alert')
  expect(screen.getByRole('link', { name: 'View purchases and project rights' })).toHaveAttribute('href', '/zh-TW/dashboard/purchase')
  expect(screen.getByLabelText(/form.projectName/)).toHaveValue('Family')
  expect(mockPush).not.toHaveBeenCalled()
})
