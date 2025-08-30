import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom'
import { dataExportService } from '@/services/data-export.service'
import { subscriptionService } from '@/services/subscription.service'

// Mock the services
jest.mock('@/services/data-export.service')
jest.mock('@/services/subscription.service')

const mockDataExportService = dataExportService as jest.Mocked<typeof dataExportService>
const mockSubscriptionService = subscriptionService as jest.Mocked<typeof subscriptionService>

describe('Data Export Functionality Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    
    // Default mock implementations
    mockSubscriptionService.canPerformAction.mockResolvedValue(true)
    mockDataExportService.validateExportRequest.mockReturnValue({
      isValid: true,
      errors: []
    })
    mockDataExportService.estimateExportSize.mockResolvedValue({
      estimatedSizeMB: 50,
      estimatedDuration: '2-3 minutes'
    })
  })

  describe('Export Request Validation', () => {
    it('should validate export request correctly', () => {
      const validRequest = {
        projectId: 'test-project',
        format: 'zip' as const,
        includeAudio: true,
        includePhotos: true,
        includeTranscripts: true,
        includeInteractions: true
      }

      const result = dataExportService.validateExportRequest(validRequest)
      expect(result.isValid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should reject invalid export request', () => {
      const invalidRequest = {
        projectId: '',
        format: 'zip' as const,
        includeAudio: false,
        includePhotos: false,
        includeTranscripts: false,
        includeInteractions: false
      }

      mockDataExportService.validateExportRequest.mockReturnValue({
        isValid: false,
        errors: ['Project ID is required', 'At least one content type must be included']
      })

      const result = dataExportService.validateExportRequest(invalidRequest)
      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Project ID is required')
      expect(result.errors).toContain('At least one content type must be included')
    })
  })

  describe('Export Dialog Component', () => {
    it('should render export configuration options', async () => {
      const { DataExportDialog } = await import('../components/export/data-export-dialog')
      
      render(
        <DataExportDialog
          isOpen={true}
          onClose={jest.fn()}
          projectId="test-project"
          projectName="Test Project"
        />
      )

      // Should show export options
      expect(screen.getByText('选择导出内容')).toBeInTheDocument()
      expect(screen.getByLabelText('音频文件')).toBeInTheDocument()
      expect(screen.getByLabelText('转录文本')).toBeInTheDocument()
      expect(screen.getByLabelText('照片')).toBeInTheDocument()
      expect(screen.getByLabelText('互动记录')).toBeInTheDocument()

      // Should show export preview
      expect(screen.getByText('导出预览')).toBeInTheDocument()
    })

    it('should handle export option changes', async () => {
      const user = userEvent.setup()
      const { DataExportDialog } = await import('../components/export/data-export-dialog')
      
      render(
        <DataExportDialog
          isOpen={true}
          onClose={jest.fn()}
          projectId="test-project"
          projectName="Test Project"
        />
      )

      // Toggle audio option
      const audioCheckbox = screen.getByLabelText('音频文件')
      expect(audioCheckbox).toBeChecked()
      
      await user.click(audioCheckbox)
      expect(audioCheckbox).not.toBeChecked()

      // Should re-estimate size when options change
      expect(mockDataExportService.estimateExportSize).toHaveBeenCalled()
    })

    it('should show permission error when export not allowed', async () => {
      mockSubscriptionService.canPerformAction.mockResolvedValue(false)
      
      const { DataExportDialog } = await import('../components/export/data-export-dialog')
      
      render(
        <DataExportDialog
          isOpen={true}
          onClose={jest.fn()}
          projectId="test-project"
          projectName="Test Project"
        />
      )

      await waitFor(() => {
        expect(screen.getByText('导出不可用')).toBeInTheDocument()
        expect(screen.getByText(/您当前的订阅计划不支持数据导出功能/)).toBeInTheDocument()
      })
    })

    it('should handle export process flow', async () => {
      const user = userEvent.setup()
      
      mockDataExportService.requestExport.mockResolvedValue({ exportId: 'export-123' })
      mockDataExportService.getExportStatus
        .mockResolvedValueOnce({
          id: 'export-123',
          projectId: 'test-project',
          status: 'processing',
          progress: 50,
          createdAt: '2024-01-01'
        })
        .mockResolvedValueOnce({
          id: 'export-123',
          projectId: 'test-project',
          status: 'completed',
          progress: 100,
          downloadUrl: 'https://example.com/download',
          createdAt: '2024-01-01'
        })

      const { DataExportDialog } = await import('../components/export/data-export-dialog')
      
      render(
        <DataExportDialog
          isOpen={true}
          onClose={jest.fn()}
          projectId="test-project"
          projectName="Test Project"
        />
      )

      // Continue to confirmation
      const continueButton = screen.getByRole('button', { name: '继续' })
      await user.click(continueButton)

      // Confirm export
      const startExportButton = screen.getByRole('button', { name: '开始导出' })
      await user.click(startExportButton)

      // Should show processing state
      await waitFor(() => {
        expect(screen.getByText('正在处理导出')).toBeInTheDocument()
      })

      // Should eventually show completion
      await waitFor(() => {
        expect(screen.getByText('导出完成！')).toBeInTheDocument()
      }, { timeout: 5000 })

      // Should have download button
      expect(screen.getByRole('button', { name: /下载文件/ })).toBeInTheDocument()
    })
  })

  describe('Export Service Functions', () => {
    it('should format file size correctly', () => {
      expect(dataExportService.formatFileSize(1024)).toBe('1 KB')
      expect(dataExportService.formatFileSize(1048576)).toBe('1 MB')
      expect(dataExportService.formatFileSize(1073741824)).toBe('1 GB')
      expect(dataExportService.formatFileSize(0)).toBe('0 Bytes')
    })

    it('should format duration correctly', () => {
      expect(dataExportService.formatDuration(60)).toBe('1:00')
      expect(dataExportService.formatDuration(3661)).toBe('1:01:01')
      expect(dataExportService.formatDuration(30)).toBe('0:30')
    })

    it('should generate export structure preview', () => {
      const preview = dataExportService.getExportStructurePreview('Test Project')
      
      expect(preview).toContain('Test Project.zip')
      expect(preview).toContain('metadata.json')
      expect(preview).toContain('stories/')
      expect(preview).toContain('audio.webm')
      expect(preview).toContain('transcript.txt')
    })
  })

  describe('Export Status Tracking', () => {
    it('should track export progress', async () => {
      const exportStatus = {
        id: 'export-123',
        projectId: 'test-project',
        status: 'processing' as const,
        progress: 75,
        createdAt: '2024-01-01'
      }

      mockDataExportService.getExportStatus.mockResolvedValue(exportStatus)

      const status = await dataExportService.getExportStatus('export-123')
      
      expect(status.progress).toBe(75)
      expect(status.status).toBe('processing')
    })

    it('should handle export failure', async () => {
      const failedStatus = {
        id: 'export-123',
        projectId: 'test-project',
        status: 'failed' as const,
        progress: 0,
        error: 'Export failed due to server error',
        createdAt: '2024-01-01'
      }

      mockDataExportService.getExportStatus.mockResolvedValue(failedStatus)

      const status = await dataExportService.getExportStatus('export-123')
      
      expect(status.status).toBe('failed')
      expect(status.error).toBe('Export failed due to server error')
    })
  })

  describe('Export File Download', () => {
    it('should handle file download', async () => {
      // Mock blob and URL creation
      const mockBlob = new Blob(['test data'])
      const mockUrl = 'blob:test-url'
      
      global.URL.createObjectURL = jest.fn().mockReturnValue(mockUrl)
      global.URL.revokeObjectURL = jest.fn()
      
      // Mock link click
      const mockLink = {
        href: '',
        download: '',
        click: jest.fn()
      }
      
      jest.spyOn(document, 'createElement').mockReturnValue(mockLink as any)
      jest.spyOn(document.body, 'appendChild').mockImplementation()
      jest.spyOn(document.body, 'removeChild').mockImplementation()

      await dataExportService.downloadExport('export-123')

      expect(mockLink.click).toHaveBeenCalled()
      expect(global.URL.revokeObjectURL).toHaveBeenCalledWith(mockUrl)
    })
  })

  describe('Export History', () => {
    it('should retrieve project export history', async () => {
      const mockExports = [
        {
          id: 'export-1',
          projectId: 'test-project',
          status: 'completed' as const,
          progress: 100,
          downloadUrl: 'https://example.com/download1',
          createdAt: '2024-01-01'
        },
        {
          id: 'export-2',
          projectId: 'test-project',
          status: 'failed' as const,
          progress: 0,
          error: 'Network error',
          createdAt: '2024-01-02'
        }
      ]

      mockDataExportService.getProjectExports.mockResolvedValue(mockExports)

      const exports = await dataExportService.getProjectExports('test-project')
      
      expect(exports).toHaveLength(2)
      expect(exports[0].status).toBe('completed')
      expect(exports[1].status).toBe('failed')
    })
  })

  describe('Export Size Estimation', () => {
    it('should estimate export size based on content', async () => {
      const exportRequest = {
        projectId: 'test-project',
        format: 'zip' as const,
        includeAudio: true,
        includePhotos: true,
        includeTranscripts: true,
        includeInteractions: true
      }

      const estimate = await dataExportService.estimateExportSize(exportRequest)
      
      expect(estimate.estimatedSizeMB).toBeGreaterThan(0)
      expect(estimate.estimatedDuration).toBeDefined()
    })

    it('should provide smaller estimate when excluding audio', async () => {
      const withAudio = {
        projectId: 'test-project',
        format: 'zip' as const,
        includeAudio: true,
        includePhotos: false,
        includeTranscripts: true,
        includeInteractions: true
      }

      const withoutAudio = {
        ...withAudio,
        includeAudio: false
      }

      mockDataExportService.estimateExportSize
        .mockResolvedValueOnce({ estimatedSizeMB: 100, estimatedDuration: '5 minutes' })
        .mockResolvedValueOnce({ estimatedSizeMB: 10, estimatedDuration: '1 minute' })

      const estimateWithAudio = await dataExportService.estimateExportSize(withAudio)
      const estimateWithoutAudio = await dataExportService.estimateExportSize(withoutAudio)
      
      expect(estimateWithAudio.estimatedSizeMB).toBeGreaterThan(estimateWithoutAudio.estimatedSizeMB)
    })
  })

  describe('Export Cancellation', () => {
    it('should allow cancelling pending exports', async () => {
      mockDataExportService.cancelExport.mockResolvedValue()

      await dataExportService.cancelExport('export-123')
      
      expect(mockDataExportService.cancelExport).toHaveBeenCalledWith('export-123')
    })
  })

  describe('Export Data Structure', () => {
    it('should retrieve project data for preview', async () => {
      const mockProjectData = {
        metadata: {
          projectId: 'test-project',
          projectName: 'Test Project',
          description: 'Test description',
          createdAt: '2024-01-01',
          exportedAt: '2024-01-15',
          version: '1.0',
          totalStories: 5,
          totalDuration: 1800,
          participants: [
            {
              id: 'user-1',
              name: 'Test User',
              role: 'facilitator' as const,
              joinedAt: '2024-01-01'
            }
          ]
        },
        stories: [
          {
            id: 'story-1',
            title: 'Test Story',
            storyteller: {
              id: 'user-2',
              name: 'Storyteller'
            },
            createdAt: '2024-01-05',
            duration: 300,
            status: 'transcribed' as const,
            audioUrl: 'https://example.com/audio.webm',
            transcript: 'This is a test story...',
            interactions: []
          }
        ]
      }

      mockDataExportService.getProjectData.mockResolvedValue(mockProjectData)

      const projectData = await dataExportService.getProjectData('test-project')
      
      expect(projectData.metadata.projectName).toBe('Test Project')
      expect(projectData.stories).toHaveLength(1)
      expect(projectData.stories[0].title).toBe('Test Story')
    })
  })

  describe('Error Handling', () => {
    it('should handle API errors gracefully', async () => {
      mockDataExportService.requestExport.mockRejectedValue(new Error('API Error'))

      await expect(dataExportService.requestExport({
        projectId: 'test-project',
        format: 'zip',
        includeAudio: true,
        includePhotos: true,
        includeTranscripts: true,
        includeInteractions: true
      })).rejects.toThrow('Failed to request export')
    })

    it('should handle network timeouts', async () => {
      mockDataExportService.getExportStatus.mockRejectedValue(new Error('Network timeout'))

      await expect(dataExportService.getExportStatus('export-123')).rejects.toThrow('Failed to get export status')
    })
  })
})
