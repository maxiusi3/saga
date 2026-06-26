import { render, screen, waitFor } from '@testing-library/react'

const mockGetResourceWallet = jest.fn()

jest.mock('@/services/settings-service', () => ({
  settingsService: {
    getResourceWallet: (...args: unknown[]) => mockGetResourceWallet(...args),
  },
}))

describe('resources page', () => {
  beforeEach(() => {
    mockGetResourceWallet.mockReset()
  })

  it('renders the real wallet balances and does not show mocked activity', async () => {
    mockGetResourceWallet.mockResolvedValue({
      user_id: 'user-1',
      project_vouchers: 1,
      facilitator_seats: 2,
      storyteller_seats: 2,
    })
    const Page = (await import('../page')).default

    render(<Page />)

    await waitFor(() => {
      expect(mockGetResourceWallet).toHaveBeenCalled()
    })

    expect(await screen.findByText('1 available')).toBeInTheDocument()
    expect(screen.getAllByText('2 available')).toHaveLength(2)
    expect(screen.getAllByText('usageStats')).toHaveLength(3)
    expect(screen.queryByText(/Dad's Life Story/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/John Doe/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Beth Smith/i)).not.toBeInTheDocument()
  })
})
