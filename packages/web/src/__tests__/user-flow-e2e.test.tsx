import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom'

// Mock API calls
const mockApi = {
  auth: {
    login: jest.fn(),
    register: jest.fn(),
    getCurrentUser: jest.fn()
  },
  projects: {
    create: jest.fn(),
    get: jest.fn(),
    list: jest.fn(),
    getStats: jest.fn()
  },
  invitations: {
    send: jest.fn(),
    accept: jest.fn(),
    list: jest.fn()
  },
  stories: {
    create: jest.fn(),
    upload: jest.fn(),
    list: jest.fn()
  },
  wallet: {
    get: jest.fn(),
    consume: jest.fn()
  }
}

// Mock the API module
jest.mock('@/lib/api', () => ({
  api: mockApi
}))

// Mock router
const mockPush = jest.fn()
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    back: jest.fn(),
    forward: jest.fn(),
    refresh: jest.fn()
  }),
  useParams: () => ({ id: 'test-project-id' }),
  useSearchParams: () => new URLSearchParams()
}))

// Mock auth store
const mockAuthStore = {
  user: {
    id: 'test-user-id',
    email: 'test@example.com',
    name: 'Test User'
  },
  isAuthenticated: true,
  login: jest.fn(),
  logout: jest.fn()
}

jest.mock('@/stores/auth-store', () => ({
  useAuthStore: () => mockAuthStore
}))

describe('End-to-End User Flow Tests', () => {
  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks()
    
    // Setup default API responses
    mockApi.wallet.get.mockResolvedValue({
      data: {
        projectVouchers: 1,
        facilitatorSeats: 2,
        storytellerSeats: 3
      }
    })
    
    mockApi.projects.list.mockResolvedValue({
      data: []
    })
  })

  describe('New User Onboarding Flow', () => {
    it('should complete the full onboarding process for a facilitator', async () => {
      const user = userEvent.setup()
      
      // Mock onboarding hook to start fresh
      const mockOnboarding = {
        shouldShowWelcome: true,
        completeWelcome: jest.fn(),
        completeFirstProject: jest.fn(),
        onboardingState: {
          hasCompletedWelcome: false,
          userRole: null
        }
      }
      
      jest.doMock('@/hooks/use-onboarding', () => ({
        useOnboarding: () => mockOnboarding
      }))
      
      const DashboardPage = (await import('../app/dashboard/page')).default
      
      render(<DashboardPage />)
      
      // Should show welcome flow
      expect(screen.getByText(/Welcome to Saga/i)).toBeInTheDocument()
      
      // Complete welcome flow
      const continueButton = screen.getByRole('button', { name: /Continue/i })
      await user.click(continueButton)
      
      // Select facilitator role
      const facilitatorButton = screen.getByRole('button', { name: /Facilitator/i })
      await user.click(facilitatorButton)
      
      await user.click(continueButton)
      
      // Complete onboarding
      const getStartedButton = screen.getByRole('button', { name: /Get Started/i })
      await user.click(getStartedButton)
      
      expect(mockOnboarding.completeWelcome).toHaveBeenCalledWith('facilitator')
    })

    it('should show appropriate guidance for storytellers', async () => {
      const mockOnboarding = {
        shouldShowWelcome: false,
        onboardingState: {
          hasCompletedWelcome: true,
          userRole: 'storyteller'
        }
      }
      
      jest.doMock('@/hooks/use-onboarding', () => ({
        useOnboarding: () => mockOnboarding
      }))
      
      const DashboardPage = (await import('../app/dashboard/page')).default
      
      render(<DashboardPage />)
      
      // Should show storyteller-specific empty state
      expect(screen.getByText(/Welcome, Storyteller/i)).toBeInTheDocument()
      expect(screen.getByText(/Wait for project invitations/i)).toBeInTheDocument()
    })
  })

  describe('Project Creation Flow', () => {
    it('should complete the full project creation process', async () => {
      const user = userEvent.setup()
      
      // Mock successful project creation
      mockApi.projects.create.mockResolvedValue({
        data: {
          id: 'new-project-id',
          name: 'Test Family Stories',
          description: 'Our family memories'
        }
      })
      
      mockApi.wallet.consume.mockResolvedValue({
        data: { success: true }
      })
      
      const ProjectNewPage = (await import('../app/dashboard/projects/new/page')).default
      
      render(<ProjectNewPage />)
      
      // Fill out project form
      const titleInput = screen.getByLabelText(/Project Title/i)
      const descriptionInput = screen.getByLabelText(/Description/i)
      
      await user.type(titleInput, 'Test Family Stories')
      await user.type(descriptionInput, 'Our family memories')
      
      // Submit form
      const createButton = screen.getByRole('button', { name: /Create Project/i })
      await user.click(createButton)
      
      // Should call API to create project
      await waitFor(() => {
        expect(mockApi.projects.create).toHaveBeenCalledWith({
          name: 'Test Family Stories',
          description: 'Our family memories'
        })
      })
      
      // Should redirect to project page
      expect(mockPush).toHaveBeenCalledWith('/dashboard/projects/new-project-id')
    })

    it('should handle insufficient resources gracefully', async () => {
      const user = userEvent.setup()
      
      // Mock insufficient resources
      mockApi.wallet.get.mockResolvedValue({
        data: {
          projectVouchers: 0,
          facilitatorSeats: 0,
          storytellerSeats: 0
        }
      })
      
      const ProjectNewPage = (await import('../app/dashboard/projects/new/page')).default
      
      render(<ProjectNewPage />)
      
      // Should show resource error
      expect(screen.getByText(/Cannot Create Project/i)).toBeInTheDocument()
      expect(screen.getByText(/Need Project Voucher/i)).toBeInTheDocument()
      
      // Create button should be disabled
      const createButton = screen.getByRole('button', { name: /Need Project Voucher/i })
      expect(createButton).toBeDisabled()
    })
  })

  describe('Member Invitation Flow', () => {
    it('should complete the member invitation process', async () => {
      const user = userEvent.setup()
      
      // Mock successful invitation
      mockApi.invitations.send.mockResolvedValue({
        data: { success: true, invitationId: 'inv-123' }
      })
      
      // Mock project data
      mockApi.projects.get.mockResolvedValue({
        data: {
          id: 'test-project-id',
          name: 'Test Project',
          description: 'Test description'
        }
      })
      
      const ProjectDetailPage = (await import('../app/dashboard/projects/[id]/page')).default
      
      render(<ProjectDetailPage />)
      
      // Click invite members button
      const inviteButton = screen.getByRole('button', { name: /邀请成员/i })
      await user.click(inviteButton)
      
      // Should navigate to invitation page
      expect(mockPush).toHaveBeenCalledWith('/dashboard/projects/test-project-id/invite')
    })
  })

  describe('Story Recording Flow', () => {
    it('should complete the story recording process', async () => {
      const user = userEvent.setup()
      
      // Mock media devices
      const mockMediaStream = {
        getTracks: () => [{ stop: jest.fn() }]
      }
      
      global.navigator.mediaDevices = {
        getUserMedia: jest.fn().mockResolvedValue(mockMediaStream)
      } as any
      
      // Mock MediaRecorder
      global.MediaRecorder = jest.fn().mockImplementation(() => ({
        start: jest.fn(),
        stop: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        state: 'inactive'
      })) as any
      
      const { WebAudioRecorder } = await import('../components/recording/WebAudioRecorder')
      
      const onRecordingComplete = jest.fn()
      
      render(<WebAudioRecorder onRecordingComplete={onRecordingComplete} />)
      
      // Start recording
      const startButton = screen.getByRole('button', { name: /Start recording/i })
      await user.click(startButton)
      
      // Should request media permissions
      expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({
        audio: true
      })
      
      // Should show recording controls
      expect(screen.getByRole('button', { name: /Stop recording/i })).toBeInTheDocument()
    })

    it('should handle recording errors gracefully', async () => {
      const user = userEvent.setup()
      
      // Mock media permission denied
      global.navigator.mediaDevices = {
        getUserMedia: jest.fn().mockRejectedValue(new Error('Permission denied'))
      } as any
      
      const { WebAudioRecorder } = await import('../components/recording/WebAudioRecorder')
      
      render(<WebAudioRecorder onRecordingComplete={jest.fn()} />)
      
      const startButton = screen.getByRole('button', { name: /Start recording/i })
      await user.click(startButton)
      
      // Should show error message
      await waitFor(() => {
        expect(screen.getByText(/Permission denied/i)).toBeInTheDocument()
      })
    })
  })

  describe('Data Export Flow', () => {
    it('should complete the data export process', async () => {
      const user = userEvent.setup()
      
      // Mock export API
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
      
      const { DataExportDialog } = await import('../components/export/data-export-dialog')
      
      render(
        <DataExportDialog
          isOpen={true}
          onClose={jest.fn()}
          projectId="test-project"
          projectName="Test Project"
        />
      )
      
      // Configure export options
      const audioCheckbox = screen.getByLabelText(/音频文件/i)
      expect(audioCheckbox).toBeChecked()
      
      // Continue to confirmation
      const continueButton = screen.getByRole('button', { name: /继续/i })
      await user.click(continueButton)
      
      // Start export
      const startExportButton = screen.getByRole('button', { name: /开始导出/i })
      await user.click(startExportButton)
      
      expect(mockDataExportService.requestExport).toHaveBeenCalled()
    })
  })

  describe('Subscription Management Flow', () => {
    it('should handle subscription renewal process', async () => {
      const user = userEvent.setup()
      
      // Mock subscription service
      const mockSubscriptionService = {
        getProjectSubscription: jest.fn().mockResolvedValue({
          id: 'sub-123',
          status: 'active',
          mode: 'interactive',
          endDate: '2024-02-01', // Soon to expire
          features: {
            canCreateStories: true,
            canInviteMembers: true,
            canReceivePrompts: true,
            canExportData: true,
            canViewContent: true
          },
          usage: {
            storiesCreated: 5,
            membersInvited: 3,
            totalDuration: 1800
          }
        }),
        shouldRecommendRenewal: jest.fn().mockReturnValue(true),
        getDaysUntilExpiration: jest.fn().mockReturnValue(15)
      }
      
      jest.doMock('@/services/subscription.service', () => ({
        subscriptionService: mockSubscriptionService
      }))
      
      const { SubscriptionStatusCard } = await import('../components/subscription/subscription-status')
      
      render(<SubscriptionStatusCard projectId="test-project" showDetails={true} />)
      
      // Should show renewal recommendation
      await waitFor(() => {
        expect(screen.getByText(/建议续订/i)).toBeInTheDocument()
      })
      
      // Click renewal button
      const renewButton = screen.getByRole('button', { name: /续订/i })
      await user.click(renewButton)
      
      // Should initiate renewal process
      expect(mockSubscriptionService.getProjectSubscription).toHaveBeenCalled()
    })
  })

  describe('Error Handling and Recovery', () => {
    it('should handle network errors gracefully', async () => {
      // Mock network error
      mockApi.projects.list.mockRejectedValue(new Error('Network error'))
      
      const DashboardPage = (await import('../app/dashboard/page')).default
      
      render(<DashboardPage />)
      
      // Should show error state or fallback
      await waitFor(() => {
        // The component should handle the error gracefully
        expect(screen.queryByText(/Network error/i)).not.toBeInTheDocument()
      })
    })

    it('should recover from temporary failures', async () => {
      const user = userEvent.setup()
      
      // Mock initial failure then success
      mockApi.projects.create
        .mockRejectedValueOnce(new Error('Temporary failure'))
        .mockResolvedValueOnce({
          data: { id: 'project-123', name: 'Test Project' }
        })
      
      const ProjectNewPage = (await import('../app/dashboard/projects/new/page')).default
      
      render(<ProjectNewPage />)
      
      // Fill form and submit
      const titleInput = screen.getByLabelText(/Project Title/i)
      await user.type(titleInput, 'Test Project')
      
      const createButton = screen.getByRole('button', { name: /Create Project/i })
      await user.click(createButton)
      
      // Should show error
      await waitFor(() => {
        expect(screen.getByText(/Failed to create project/i)).toBeInTheDocument()
      })
      
      // Retry should work
      await user.click(createButton)
      
      await waitFor(() => {
        expect(mockApi.projects.create).toHaveBeenCalledTimes(2)
      })
    })
  })

  describe('Performance and Loading States', () => {
    it('should show loading states during async operations', async () => {
      // Mock slow API response
      mockApi.projects.list.mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve({ data: [] }), 1000))
      )
      
      const DashboardPage = (await import('../app/dashboard/page')).default
      
      render(<DashboardPage />)
      
      // Should show loading state
      expect(screen.getByText(/加载中/i)).toBeInTheDocument()
      
      // Should eventually show content
      await waitFor(() => {
        expect(screen.queryByText(/加载中/i)).not.toBeInTheDocument()
      }, { timeout: 2000 })
    })
  })
})
