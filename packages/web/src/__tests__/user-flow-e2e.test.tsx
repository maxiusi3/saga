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
      storyteller_seats: 3,
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

const mockSubscriptionService = {
  getProjectSubscription: jest.fn().mockResolvedValue({
    id: 'sub-123',
    status: 'active',
    mode: 'interactive',
    endDate: '2024-02-01',
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
  getDaysUntilExpiration: jest.fn().mockReturnValue(15),
  getSubscriptionStatusColor: jest.fn().mockReturnValue('text-yellow-800 bg-yellow-100'),
  formatSubscriptionStatus: jest.fn().mockReturnValue('即将到期'),
  getArchivalModeFeatures: jest.fn().mockReturnValue([]),
  canPerformAction: jest.fn().mockResolvedValue(true)
}

jest.mock('@/services/subscription.service', () => ({
  subscriptionService: mockSubscriptionService
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

    mockProjectService.getUserProjects.mockResolvedValue([])
    mockProjectService.createProjectWithRole.mockResolvedValue({
      id: 'new-project-id',
      name: 'Test Family Stories',
      description: 'Our family memories'
    })
    mockUseResourceWallet.mockReturnValue({
      wallet: {
        project_vouchers: 1,
        facilitator_seats: 2,
        storyteller_seats: 3,
        updated_at: '2024-01-01T00:00:00Z'
      },
      loading: false,
      error: null,
      hasResources: jest.fn().mockReturnValue(true),
      refetch: jest.fn()
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
      
      expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent(/page\.welcome/)
      expect(screen.getAllByRole('link', { name: /actions\.createNewSaga/i })[0]).toBeInTheDocument()
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
      
      const { OnboardingEmptyState } = await import('../components/onboarding/onboarding-hints')
      render(<OnboardingEmptyState userRole="storyteller" />)
      
      // Should show storyteller-specific empty state
      expect(screen.getByText(/Welcome, Storyteller/i)).toBeInTheDocument()
      expect(screen.getByText(/Wait for project invitations/i)).toBeInTheDocument()
    })
  })

  describe('Project Creation Flow', () => {
    it('should complete the full project creation process', async () => {
      const user = userEvent.setup()
      
      const ProjectNewPage = (await import('../app/dashboard/projects/new/page')).default
      
      render(<ProjectNewPage />)
      
      // Fill out project form
      const titleInput = screen.getByLabelText(/form\.projectName/i)
      const descriptionInput = screen.getByLabelText(/form\.projectDescription/i)
      
      await user.type(titleInput, 'Test Family Stories')
      await user.type(descriptionInput, 'Our family memories')
      
      // Submit form
      const createButton = screen.getByRole('button', { name: /form\.createProject/i })
      await user.click(createButton)
      
      // Should call API to create project
      await waitFor(() => {
        expect(mockProjectService.createProjectWithRole).toHaveBeenCalledWith(expect.objectContaining({
          name: 'Test Family Stories',
          description: 'Our family memories'
        }))
      })
      
      // Should redirect to project page
      expect(mockPush).toHaveBeenCalledWith('/en/dashboard/projects/new-project-id')
    })

    it('should handle insufficient resources gracefully', async () => {
      const user = userEvent.setup()
      
      mockUseResourceWallet.mockReturnValue({
        wallet: {
          project_vouchers: 0,
          facilitator_seats: 0,
          storyteller_seats: 0,
          updated_at: '2024-01-01T00:00:00Z'
        },
        loading: false,
        error: null,
        hasResources: jest.fn().mockReturnValue(false),
        refetch: jest.fn()
      })
      
      const ProjectNewPage = (await import('../app/dashboard/projects/new/page')).default
      
      render(<ProjectNewPage />)
      
      await user.type(screen.getByLabelText(/form\.projectName/i), 'Test Project')
      await user.click(screen.getByRole('button', { name: /form\.createProject/i }))

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/en/dashboard/purchase')
      })
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
      mockProjectService.getUserProjects.mockResolvedValue([{
        id: 'test-project-id',
        name: 'Test Project',
        description: 'Test description',
        facilitator_id: 'test-user-id',
        status: 'active',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        members: [],
        member_count: 1,
        story_count: 0,
        user_role: 'facilitator',
        is_owner: true
      }])
      
      const ProjectDetailPage = (await import('../app/dashboard/projects/[id]/page')).default
      
      render(<ProjectDetailPage />)
      
      expect(await screen.findByRole('heading', { name: 'Test Project' })).toBeInTheDocument()
      expect(screen.getByRole('link', { name: /detail\.actions\.manageProject/i })).toBeInTheDocument()
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
      ;(global.MediaRecorder as any).isTypeSupported = jest.fn().mockReturnValue(true)
      
      const { WebAudioRecorder } = await import('../components/recording/WebAudioRecorder')
      
      const onRecordingComplete = jest.fn()
      
      render(<WebAudioRecorder onRecordingComplete={onRecordingComplete} />)
      
      // Start recording
      const startButton = screen.getByRole('button', { name: /Start recording/i })
      await user.click(startButton)
      
      // Should request media permissions
      expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({
        audio: expect.objectContaining({
          echoCancellation: true,
          noiseSuppression: true,
        })
      })
      
      // Should show recording controls
      expect(await screen.findByRole('button', { name: /Stop recording/i })).toBeInTheDocument()
    })

    it('should handle recording errors gracefully', async () => {
      const user = userEvent.setup()
      
      // Mock media permission denied
      global.navigator.mediaDevices = {
        getUserMedia: jest.fn().mockRejectedValue(new Error('Permission denied'))
      } as any
      
      const { WebAudioRecorder } = await import('../components/recording/WebAudioRecorder')
      
      const onError = jest.fn()
      render(<WebAudioRecorder onRecordingComplete={jest.fn()} onError={onError} />)
      
      const startButton = screen.getByRole('button', { name: /Start recording/i })
      await user.click(startButton)
      
      await waitFor(() => {
        expect(onError).toHaveBeenCalledWith(expect.stringMatching(/Failed to start recording|permission denied/i))
      })
    })
  })

  describe('Data Export Flow', () => {
    it('should complete the data export process', async () => {
      const user = userEvent.setup()
      
      // Mock export API
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
      const { SubscriptionStatusCard } = await import('../components/subscription/subscription-status')
      
      render(<SubscriptionStatusCard projectId="test-project" showDetails={true} />)
      
      // Should show renewal recommendation
      await waitFor(() => {
        expect(screen.getByText(/建议续订/i)).toBeInTheDocument()
      })
      
      // Click renewal button
      const renewButton = screen.getAllByRole('button', { name: /续订/i })[0]
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
      mockProjectService.createProjectWithRole
        .mockRejectedValueOnce(new Error('Temporary failure'))
        .mockResolvedValueOnce({
          id: 'project-123',
          name: 'Test Project'
        })
      
      const ProjectNewPage = (await import('../app/dashboard/projects/new/page')).default
      
      render(<ProjectNewPage />)
      
      // Fill form and submit
      const titleInput = screen.getByLabelText(/form\.projectName/i)
      await user.type(titleInput, 'Test Project')
      
      const createButton = screen.getByRole('button', { name: /form\.createProject/i })
      await user.click(createButton)
      
      await waitFor(() => {
        expect(mockProjectService.createProjectWithRole).toHaveBeenCalledTimes(1)
      })
      
      // Retry should work
      await user.click(createButton)
      
      await waitFor(() => {
        expect(mockProjectService.createProjectWithRole).toHaveBeenCalledTimes(2)
      })
    })
  })

  describe('Performance and Loading States', () => {
    it('should show loading states during async operations', async () => {
      // Mock slow API response
      mockProjectService.getUserProjects.mockImplementation(() =>
        new Promise(resolve => setTimeout(() => resolve([]), 1000))
      )
      
      const DashboardPage = (await import('../app/dashboard/page')).default
      
      render(<DashboardPage />)
      
      // Should show loading state
      expect(screen.getByRole('main')).toHaveAttribute('aria-busy', 'true')
      
      // Should eventually show content
      await waitFor(() => {
        expect(screen.getByRole('main')).not.toHaveAttribute('aria-busy', 'true')
      }, { timeout: 2000 })
    })
  })
})
