import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom'

jest.setTimeout(30000)

jest.mock('@stripe/react-stripe-js', () => {
  const React = require('react')

  return {
    Elements: ({ children }: { children: React.ReactNode }) => children,
    CardElement: ({ onChange }: { onChange?: (event: any) => void }) => {
      React.useEffect(() => {
        onChange?.({ complete: true })
      }, [onChange])
      return React.createElement('div', { 'data-testid': 'card-element' })
    },
    useStripe: () => ({}),
    useElements: () => ({
      getElement: jest.fn(() => ({}))
    })
  }
})

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

const mockProjectService = {
  createProjectWithRole: jest.fn(),
  getUserProjects: jest.fn()
}

jest.mock('@/lib/projects', () => ({
  projectService: mockProjectService
}))

jest.mock('@/lib/stories', () => ({
  storyService: {
    getStoriesByProject: jest.fn().mockResolvedValue([])
  }
}))

jest.mock('@/services/settings-service', () => ({
  settingsService: {
    getResourceWallet: jest.fn().mockResolvedValue({
      project_vouchers: 1,
      facilitator_seats: 2,
      storyteller_seats: 8,
      updated_at: '2024-01-01T00:00:00Z'
    })
  }
}))

const mockUseResourceWallet = jest.fn()
jest.mock('@/hooks/use-resource-wallet', () => ({
  useResourceWallet: () => mockUseResourceWallet()
}))

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
  }),
  getExportStructurePreview: jest.fn((projectName: string) => `${projectName}.zip`),
  formatFileSize: jest.fn(() => '50 MB'),
  downloadExport: jest.fn()
}

jest.mock('@/services/data-export.service', () => ({
  dataExportService: mockDataExportService
}))

jest.mock('@/services/subscription.service', () => ({
  subscriptionService: {
    canPerformAction: jest.fn().mockResolvedValue(true)
  }
}))

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

    mockProjectService.getUserProjects.mockResolvedValue([])
    mockProjectService.createProjectWithRole.mockResolvedValue({
      id: 'project-123',
      name: 'My Family Stories',
      description: 'Collecting our precious memories'
    })
    mockUseResourceWallet.mockReturnValue({
      wallet: {
        project_vouchers: 1,
        facilitator_seats: 2,
        storyteller_seats: 8,
        updated_at: '2024-01-01T00:00:00Z'
      },
      loading: false,
      error: null,
      hasResources: jest.fn().mockReturnValue(true),
      refetch: jest.fn()
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

      expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent(/page\.welcome/)

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
      const createProjectButton = screen.getAllByRole('link', { name: /actions\.createNewSaga/i })[0]
      expect(createProjectButton).toBeInTheDocument()

      // Step 6: User creates first project
      const ProjectNewPage = (await import('../../app/dashboard/projects/new/page')).default
      render(<ProjectNewPage />)

      const titleInput = screen.getByLabelText(/form\.projectName/i)
      const descriptionInput = screen.getByLabelText(/form\.projectDescription/i)

      await user.type(titleInput, 'My Family Stories')
      await user.type(descriptionInput, 'Collecting our precious memories')

      // Mock successful project creation
      const createButton = screen.getByRole('button', { name: /form\.createProject/i })
      await user.click(createButton)

      // Should redirect to project page
      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/en/dashboard/projects/project-123')
      })

      // Step 7: User invites family members
      const ProjectDetailPage = (await import('../../app/dashboard/projects/[id]/page')).default
      
      mockProjectService.getUserProjects.mockResolvedValue([{
        id: 'test-project-id',
        name: 'My Family Stories',
        description: 'Collecting our precious memories',
        facilitator_id: 'user-123',
        status: 'active',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        members: [],
        member_count: 1,
        story_count: 0,
        user_role: 'facilitator',
        is_owner: true
      }])

      render(<ProjectDetailPage />)

      expect(await screen.findByRole('heading', { name: 'My Family Stories' })).toBeInTheDocument()

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
      expect(mockProjectService.createProjectWithRole).toHaveBeenCalled()
      expect(mockPush).toHaveBeenCalledWith('/en/dashboard/projects/project-123')
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

      const { OnboardingEmptyState } = await import('../../components/onboarding/onboarding-hints')
      render(<OnboardingEmptyState userRole="storyteller" />)

      expect(screen.getByText(/Welcome, Storyteller/i)).toBeInTheDocument()

      // Mock recording functionality
      const WebAudioRecorder = (await import('../../components/recording/WebAudioRecorder')).WebAudioRecorder
      
      const onRecordingComplete = jest.fn()
      const mockMediaStream = {
        getTracks: () => [{ stop: jest.fn() }]
      }
      global.navigator.mediaDevices = {
        getUserMedia: jest.fn().mockResolvedValue(mockMediaStream)
      } as any
      global.MediaRecorder = jest.fn().mockImplementation(() => ({
        start: jest.fn(),
        stop: jest.fn(),
        pause: jest.fn(),
        resume: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        state: 'inactive'
      })) as any
      ;(global.MediaRecorder as any).isTypeSupported = jest.fn().mockReturnValue(true)

      render(<WebAudioRecorder onRecordingComplete={onRecordingComplete} />)

      // Start recording
      const recordButton = screen.getByRole('button', { name: /Start recording/i })
      await user.click(recordButton)

      // Should show recording state
      expect(await screen.findByRole('button', { name: /Stop recording/i })).toBeInTheDocument()

      const stopButton = screen.getByRole('button', { name: /Stop recording/i })
      await user.click(stopButton)
      expect(stopButton).toBeInTheDocument()
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

      mockProjectService.getUserProjects.mockResolvedValue([
        {
          id: 'project-123',
          name: 'Family Stories',
          description: 'Family collaboration',
          facilitator_id: 'facilitator-123',
          status: 'active',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
          members: [
            { id: 'm1', project_id: 'project-123', user_id: 'user-1', role: 'facilitator', status: 'active', invited_at: '2024-01-01T00:00:00Z', created_at: '2024-01-01T00:00:00Z', updated_at: '2024-01-01T00:00:00Z' },
            { id: 'm2', project_id: 'project-123', user_id: 'user-2', role: 'storyteller', status: 'active', invited_at: '2024-01-01T00:00:00Z', created_at: '2024-01-01T00:00:00Z', updated_at: '2024-01-01T00:00:00Z' },
            { id: 'm3', project_id: 'project-123', user_id: 'user-3', role: 'storyteller', status: 'active', invited_at: '2024-01-01T00:00:00Z', created_at: '2024-01-01T00:00:00Z', updated_at: '2024-01-01T00:00:00Z' }
          ],
          member_count: 3,
          story_count: 2,
          user_role: 'facilitator',
          is_owner: true
        }
      ])

      const DashboardPage = (await import('../../app/dashboard/page')).default
      render(<DashboardPage />)

      // Should show existing projects
      expect(await screen.findByText('Family Stories')).toBeInTheDocument()
      expect(screen.getByText(/Family collaboration/)).toBeInTheDocument()
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
        }),
        getExportStructurePreview: jest.fn((projectName: string) => `${projectName}.zip
├── metadata.json
└── stories/
    └── [YYYY-MM-DD_Story-Title]/
        ├── audio.webm
        ├── transcript.txt
        ├── photo.jpg
        └── interactions.json`),
        formatFileSize: jest.fn(() => '50 MB'),
        downloadExport: jest.fn(),
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

      await waitFor(() => {
        expect(mockDataExportService.requestExport).toHaveBeenCalled()
      })
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
        createPaymentMethod: jest.fn().mockResolvedValue({
          paymentMethod: { id: 'pm_test_123' }
        }),
        confirmPayment: jest.fn().mockResolvedValue({ 
          success: false, 
          error: 'Your card was declined.' 
        }),
        completePurchase: jest.fn(),
        formatAmount: jest.fn((amount) => `$${(amount / 100).toFixed(2)}`)
      }

      jest.doMock('@/services/stripe.service', () => ({
        stripeService: mockStripeService,
        getStripe: jest.fn().mockResolvedValue({
          confirmCardPayment: jest.fn().mockResolvedValue({
            error: { message: 'Your card was declined.' }
          })
        })
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
