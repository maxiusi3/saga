import { act, fireEvent, render, screen } from '@testing-library/react'
import { PurchasePanel } from '../purchase-panel'
const state = { user: { id: 'payer-a' } }
const startPurchase = jest.fn(), getPurchaseStatus = jest.fn()
jest.mock('@/stores/auth-store', () => ({ useAuthStore: Object.assign((selector: (s: typeof state) => unknown) => selector(state), { getState: () => state }) }))
jest.mock('@/lib/payments/client', () => ({ startPurchase: (...args: unknown[]) => startPurchase(...args), getPurchaseStatus: (...args: unknown[]) => getPurchaseStatus(...args), allocatePurchase: jest.fn() }))
jest.mock('../purchase-checkout', () => ({ PurchaseCheckout: () => null }))
describe('purchase UI account isolation', () => {
  beforeEach(() => { localStorage.clear(); state.user = { id: 'payer-a' }; jest.clearAllMocks() })
  it('does not show the previous payer order when an in-flight response arrives after account switch', async () => {
    let resolve!: (value: unknown) => void
    startPurchase.mockReturnValue(new Promise(done => { resolve = done }))
    const view = render(<PurchasePanel enabled />)
    fireEvent.click(screen.getByRole('button', { name: 'Start test purchase' }))
    state.user = { id: 'payer-b' }; view.rerender(<PurchasePanel enabled />)
    await act(async () => { resolve({ orderId: 'private-order-a', status: 'paid', amount: 5900, currency: 'usd' }) })
    expect(screen.queryByText('private-order-a')).not.toBeInTheDocument()
  })
  it('retains one request id across uncertain responses and a remount', async () => {
    startPurchase.mockRejectedValue(new Error('uncertain'))
    let view = render(<PurchasePanel enabled />)
    fireEvent.click(screen.getByRole('button', { name: 'Start test purchase' }))
    await screen.findByRole('alert'); const first = startPurchase.mock.calls[0][0]
    view.unmount(); view = render(<PurchasePanel enabled />)
    fireEvent.click(screen.getByRole('button', { name: /purchase/ }))
    await screen.findByRole('alert')
    expect(startPurchase.mock.calls[1][0]).toBe(first)
    view.unmount()
  })
})
