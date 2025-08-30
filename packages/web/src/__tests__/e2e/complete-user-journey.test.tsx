import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom'

// Mock Next.js router
const mockPush = jest.fn()
const mockBack = jest.fn()
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    back: mockBack,
    refresh: jest.fn()
  }),
  useParams: () => ({ id: 'test-project-id' }),
  useSearchParams: () => new URLSearchParams()
}))

// Mock API services
const mockApi = {
  auth: {
    register: jest.fn(),
    login: jest.fn(),
    getCurrentUser: jest.fn()
  },
  packages: {
    list: jest.fn(),
    purchase: jest.fn()
  },
  projects: {
    create: jest.fn(),
    list: jest.fn(),
    get: jest.fn()
  },
  invitations: {
    send: jest.fn(),
    accept: jest.fn()
  },
  stories: {
    create: jest.fn(),
    upload: jest.fn()
  },
  wallet: {
    get: jest.fn(),
    consume: jest.fn()
  }
}

jest.mock('@/lib/api', () => ({ api: mockApi }))

// Mock Stripe
jest.mock('@/services/stripe.service', () => ({
  stripeService: {
    createPaymentIntent: jest.fn().mockResolvedValue({
      id: 'pi_test_123',
      client_secret: 'pi_test_123_secret',
      amount: 12900,
      currency: 'usd',
      status: 'requires_payment_method'
    }),
    confirmPayment: jest.fn().mockResolvedValue({ success: true }),
    completePurchase: jest.fn().mockResolvedValue({ 
      success: true, 
      packageId: 'saga-package' 
    }),
    formatAmount: jest.fn((amount, currency) => `$${(amount / 100).toFixed(2)}`)
  },
  getStripe: jest.fn().mockResolvedValue({
    confirmCardPayment: jest.fn().mockResolvedValue({
      paymentIntent: { status: 'succeeded' }
    }),
    createPaymentMethod: jest.fn().mockResolvedValue({
      paymentMethod: { id: 'pm_test_123' }
    })
  })
}))

// Mock auth store
const mockAuthStore = {
  user: null,
  isAuthenticated: false,
  login: jest.fn(),
  logout: jest.fn(),
  register: jest.fn()
}

jest.mock('@/stores/auth-store', () => ({
  useAuthStore: () => mockAuthStore
}))

describe('Complete User Journey E2E Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    
    // Setup default API responses
    mockApi.wallet.get.mockResolvedValue({
      data: {
        projectVouchers: 0,
        facilitatorSeats: 0,
        storytellerSeats: 0
      }
    })
    
    mockApi.packages.list.mockResolvedValue({
      data: [
        {
          id: 'saga-package',
          name: 'Saga Package',
          price: 12900,
          currency: 'usd',
          contents: {
            projectVouchers: 1,
            facilitatorSeats: 2,
            storytellerSeats: 8
          }
        }
      ]
    })
  })

  describe('New User Complete Journey', () => {
    it('should complete the full journey from registration to story creation', async () => {
      const user = userEvent.setup()

      // Step 1: User visits landing page and registers
      mockAuthStore.isAuthenticated = false
      
      // Mock successful registration
      mockApi.auth.register.mockResolvedValue({
        data: {
          user: {
            id: 'user-123',
            email: 'test@example.com',
            name: 'Test User'
          },
          token: 'jwt-token'
        }
      })

      // Step 2: User sees empty wallet and needs to purchase package
      const DashboardPage = (await import('../../app/dashboard/page')).default
      render(<DashboardPage />)

      // Should show purchase prompt due to empty wallet
      expect(screen.getByText(/Need Project Voucher/i)).toBeInTheDocument()

      // Step 3: User navigates to purchase page
      const PurchasePage = (await import('../../app/purchase/page')).default
      render(<PurchasePage />)

      // Should show available packages
      expect(screen.getByText('Choose Your Saga Package')).toBeInTheDocument()
      expect(screen.getByText('Saga Package')).toBeInTheDocument()

      // User selects a package
      const selectPackageButton = screen.getByRole('button', { name: /Choose Saga Package/i })
      await user.click(selectPackageButton)

      // Should show payment form
      await waitFor(() => {
        expect(screen.getByText('Complete Your Purchase')).toBeInTheDocument()
      })

      // Step 4: User completes payment (mocked)
      const payButton = screen.getByRole('button', { name: /Pay \$129\.00/i })
      await user.click(payButton)

      // Should show success and redirect
      await waitFor(() => {
        expect(screen.getByText('Purchase Complete!')).toBeInTheDocument()
      })

      // Step 5: User now has resources and can create project
      mockApi.wallet.get.mockResolvedValue({
        data: {
          projectVouchers: 1,
          facilitatorSeats: 2,
          storytellerSeats: 8
        }
      })

      mockAuthStore.user = {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User'
      }
      mockAuthStore.isAuthenticated = true

      render(<DashboardPage />)

      // Should now show create project option
      const createProjectButton = screen.getByRole('link', { name: /创建新项目/i })
      expect(createProjectButton).toBeInTheDocument()

      // Step 6: User creates first project
      const ProjectNewPage = (await import('../../app/dashboard/projects/new/page')).default
      render(<ProjectNewPage />)

      const titleInput = screen.getByLabelText(/Project Title/i)
      const descriptionInput = screen.getByLabelText(/Description/i)

      await user.type(titleInput, 'My Family Stories')
      await user.type(descriptionInput, 'Collecting our precious memories')

      // Mock successful project creation
      mockApi.projects.create.mockResolvedValue({
        data: {
          id: 'project-123',
          name: 'My Family Stories',
          description: 'Collecting our precious memories'
        }
      })

      const createButton = screen.getByRole('button', { name: /Create Project/i })
      await user.click(createButton)

      // Should redirect to project page
      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/dashboard/projects/project-123')
      })

      // Step 7: User invites family members
      const ProjectDetailPage = (await import('../../app/dashboard/projects/[id]/page')).default
      
      mockApi.projects.get.mockResolvedValue({
        data: {
          id: 'project-123',
          name: 'My Family Stories',
          description: 'Collecting our precious memories'
        }
      })

      render(<ProjectDetailPage />)

      const inviteButton = screen.getByRole('button', { name: /邀请成员/i })
      await user.click(inviteButton)

      // Should navigate to invite page
      expect(mockPush).toHaveBeenCalledWith('/dashboard/projects/project-123/invite')

      // Step 8: Storyteller receives invitation and records story
      // Mock storyteller accepting invitation
      mockApi.invitations.accept.mockResolvedValue({
        data: { success: true }
      })

      // Mock story creation
      mockApi.stories.create.mockResolvedValue({
        data: {
          id: 'story-123',
          title: 'My Childhood Memory',
          status: 'recorded'
        }
      })

      // Verify the complete flow worked
      expect(mockApi.auth.register).toHaveBeenCalled()
      expect(mockApi.projects.create).toHaveBeenCalled()
      expect(mockPush).toHaveBeenCalledWith('/dashboard/projects/project-123')
    })
  })

  describe('Storyteller Journey', () => {
    it('should complete storyteller invitation acceptance and recording flow', async () => {
      const user = userEvent.setup()

      // Setup storyteller user
      mockAuthStore.user = {
        id: 'storyteller-123',
        email: 'storyteller@example.com',
        name: 'Storyteller User'
      }
      mockAuthStore.isAuthenticated = true

      // Mock storyteller dashboard
      const StorytellerDashboard = (await import('../../components/storyteller/storyteller-dashboard')).StorytellerDashboard
      
      render(<StorytellerDashboard />)

      // Should show pending invitations
      expect(screen.getByText(/Project Invitations/i)).toBeInTheDocument()

      // Accept invitation
      const acceptButton = screen.getByRole('button', { name: /Accept Invitation/i })
      await user.click(acceptButton)

      // Should show recording interface
      await waitFor(() => {
        expect(screen.getByText(/Record Your Story/i)).toBeInTheDocument()
      })

      // Mock recording functionality
      const WebAudioRecorder = (await import('../../components/recording/WebAudioRecorder')).WebAudioRecorder
      
      const onRecordingComplete = jest.fn()
      render(<WebAudioRecorder onRecordingComplete={onRecordingComplete} />)

      // Start recording
      const recordButton = screen.getByRole('button', { name: /Start recording/i })
      await user.click(recordButton)

      // Should show recording state
      expect(screen.getByRole('button', { name: /Stop recording/i })).toBeInTheDocument()

      // Stop recording
      const stopButton = screen.getByRole('button', { name: /Stop recording/i })
      await user.click(stopButton)

      // Should show review and send options
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Send Recording/i })).toBeInTheDocument()
      })

      // Send recording
      const sendButton = screen.getByRole('button', { name: /Send Recording/i })
      await user.click(sendButton)

      // Should complete the recording flow
      expect(onRecordingComplete).toHaveBeenCalled()
    })
  })

  describe('Multi-User Collaboration', () => {
    it('should handle multiple facilitators and storytellers', async () => {
      const user = userEvent.setup()

      // Setup facilitator with existing project
      mockAuthStore.user = {
        id: 'facilitator-123',
        email: 'facilitator@example.com',
        name: 'Facilitator User'
      }
      mockAuthStore.isAuthenticated = true

      mockApi.projects.list.mockResolvedValue({
        data: [
          {
            id: 'project-123',
            name: 'Family Stories',
            memberCount: 3,
            storyCount: 2
          }
        ]
      })

      const DashboardPage = (await import('../../app/dashboard/page')).default
      render(<DashboardPage />)

      // Should show existing projects
      expect(screen.getByText('Family Stories')).toBeInTheDocument()

      // Navigate to project
      const projectLink = screen.getByText('Family Stories')
      await user.click(projectLink)

      // Should show project details with members and stories
      await waitFor(() => {
        expect(screen.getByText(/3 位成员/i)).toBeInTheDocument()
        expect(screen.getByText(/2 个故事/i)).toBeInTheDocument()
      })
    })
  })

  describe('Data Export Journey', () => {
    it('should complete data export process', async () => {
      const user = userEvent.setup()

      // Mock export service
      const mockDataExportService = {
        requestExport: jest.fn().mockResolvedValue({ exportId: 'export-123' }),
        getExportStatus: jest.fn().mockResolvedValue({
          id: 'export-123',
          status: 'completed',
          progress: 100,
          downloadUrl: 'https://example.com/download'
        }),
        validateExportRequest: jest.fn().mockReturnValue({ isValid: true, errors: [] }),
        estimateExportSize: jest.fn().mockResolvedValue({
          estimatedSizeMB: 50,
          estimatedDuration: '2-3 minutes'
        })
      }

      jest.doMock('@/services/data-export.service', () => ({
        dataExportService: mockDataExportService
      }))

      const { DataExportDialog } = await import('../../components/export/data-export-dialog')

      render(
        <DataExportDialog
          isOpen={true}
          onClose={jest.fn()}
          projectId="project-123"
          projectName="Family Stories"
        />
      )

      // Configure export
      const continueButton = screen.getByRole('button', { name: /继续/i })
      await user.click(continueButton)

      // Start export
      const startExportButton = screen.getByRole('button', { name: /开始导出/i })
      await user.click(startExportButton)

      // Should show completion
      await waitFor(() => {
        expect(screen.getByText('导出完成！')).toBeInTheDocument()
      })

      expect(mockDataExportService.requestExport).toHaveBeenCalled()
    })
  })

  describe('Error Handling and Recovery', () => {
    it('should handle payment failures gracefully', async () => {
      const user = userEvent.setup()

      // Mock payment failure
      const mockStripeService = {
        createPaymentIntent: jest.fn().mockResolvedValue({
          id: 'pi_test_123',
          client_secret: 'pi_test_123_secret'
        }),
        confirmPayment: jest.fn().mockResolvedValue({ 
          success: false, 
          error: 'Your card was declined.' 
        })
      }

      jest.doMock('@/services/stripe.service', () => ({
        stripeService: mockStripeService
      }))

      const { PaymentForm } = await import('../../components/payment/payment-form')

      render(
        <PaymentForm
          packageId="saga-package"
          packageName="Saga Package"
          amount={12900}
          onSuccess={jest.fn()}
          onError={jest.fn()}
          onCancel={jest.fn()}
        />
      )

      // Attempt payment
      const payButton = screen.getByRole('button', { name: /Pay/i })
      await user.click(payButton)

      // Should show error message
      await waitFor(() => {
        expect(screen.getByText(/Your card was declined/i)).toBeInTheDocument()
      })
    })

    it('should handle network errors gracefully', async () => {
      // Mock network error
      mockApi.projects.list.mockRejectedValue(new Error('Network error'))

      const DashboardPage = (await import('../../app/dashboard/page')).default
      render(<DashboardPage />)

      // Should handle error gracefully without crashing
      await waitFor(() => {
        // Component should still render, possibly with error state
        expect(screen.getByRole('main')).toBeInTheDocument()
      })
    })
  })
})
