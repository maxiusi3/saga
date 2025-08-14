import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { toast } from 'react-hot-toast'
import ExportsPage from '../page'
import { useProjectStore } from '@/stores/project-store'
import { apiClient } from '@/lib/api'

// Mock dependencies
jest.mock('react-hot-toast', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}))

jest.mock('@/stores/project-store', () => ({
  useProjectStore: jest.fn(),
}))

jest.mock('@/lib/api', () => ({
  apiClient: {
    exports: {
      list: jest.fn(),
      create: jest.fn(),
      download: jest.fn(),
    },
  },
}))

// Mock URL.createObjectURL and related APIs
global.URL.createObjectURL = jest.fn(() => 'mock-url')
global.URL.revokeObjectURL = jest.fn()

const mockFetchProjects = jest.fn()

const mockProjects = [
  {
    id: '1',
    title: 'Family Stories',
    description: 'Our family memories',
    storyCount: 5,
  },
  {
    id: '2',
    title: 'Mom\'s Life',
    description: 'Mom\'s life stories',
    storyCount: 3,
  },
]

const mockExports = [
  {
    id: '1',
    projectId: '1',
    facilitatorId: 'user1',
    status: 'ready',
    downloadUrl: 'https://example.com/download1',
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
    createdAt: new Date('2023-12-01'),
    updatedAt: new Date('2023-12-01'),
  },
  {
    id: '2',
    projectId: '2',
    facilitatorId: 'user1',
    status: 'processing',
    createdAt: new Date('2023-11-30'),
    updatedAt: new Date('2023-11-30'),
  },
]

describe('ExportsPage', () => {
  beforeEach(() => {
    ;(useProjectStore as jest.Mock).mockReturnValue({
      projects: mockProjects,
      fetchProjects: mockFetchProjects,
    })

    ;(apiClient.exports.list as jest.Mock).mockResolvedValue({
      data: { data: mockExports },
    })

    ;(apiClient.exports.create as jest.Mock).mockResolvedValue({
      data: { data: { id: '3', status: 'pending' } },
    })

    jest.clearAllMocks()
  })

  it('renders exports page with header', async () => {
    render(<ExportsPage />)

    expect(screen.getByText('Data Exports')).toBeInTheDocument()
    expect(screen.getByText('Export and download your family story archives.')).toBeInTheDocument()
  })

  it('fetches projects and exports on mount', async () => {
    render(<ExportsPage />)

    expect(mockFetchProjects).toHaveBeenCalled()
    expect(apiClient.exports.list).toHaveBeenCalled()
  })

  it('displays projects for export creation', async () => {
    render(<ExportsPage />)

    await waitFor(() => {
      expect(screen.getByText('Family Stories')).toBeInTheDocument()
      expect(screen.getByText('Mom\'s Life')).toBeInTheDocument()
      expect(screen.getByText('5 stories')).toBeInTheDocument()
      expect(screen.getByText('3 stories')).toBeInTheDocument()
    })
  })

  it('creates new export when button clicked', async () => {
    render(<ExportsPage />)

    await waitFor(() => {
      expect(screen.getByText('Family Stories')).toBeInTheDocument()
    })

    const exportButtons = screen.getAllByText('Export')
    fireEvent.click(exportButtons[0])

    await waitFor(() => {
      expect(apiClient.exports.create).toHaveBeenCalledWith('1')
      expect(toast.success).toHaveBeenCalledWith('Export request created successfully')
    })
  })

  it('displays export history', async () => {
    render(<ExportsPage />)

    await waitFor(() => {
      expect(screen.getByText('Export History')).toBeInTheDocument()
      expect(screen.getByText('Ready for Download')).toBeInTheDocument()
      expect(screen.getByText('Processing')).toBeInTheDocument()
    })
  })

  it('downloads export when download button clicked', async () => {
    const mockBlob = new Blob(['test'], { type: 'application/zip' })
    ;(apiClient.exports.download as jest.Mock).mockResolvedValue({
      data: mockBlob,
    })

    // Mock document.createElement and appendChild
    const mockLink = {
      href: '',
      download: '',
      click: jest.fn(),
    }
    const createElementSpy = jest.spyOn(document, 'createElement').mockReturnValue(mockLink as any)
    const appendChildSpy = jest.spyOn(document.body, 'appendChild').mockImplementation()
    const removeChildSpy = jest.spyOn(document.body, 'removeChild').mockImplementation()

    render(<ExportsPage />)

    await waitFor(() => {
      expect(screen.getByText('Download')).toBeInTheDocument()
    })

    const downloadButton = screen.getByText('Download')
    fireEvent.click(downloadButton)

    await waitFor(() => {
      expect(apiClient.exports.download).toHaveBeenCalledWith('1')
      expect(createElementSpy).toHaveBeenCalledWith('a')
      expect(mockLink.click).toHaveBeenCalled()
      expect(toast.success).toHaveBeenCalledWith('Download started')
    })

    // Cleanup
    createElementSpy.mockRestore()
    appendChildSpy.mockRestore()
    removeChildSpy.mockRestore()
  })

  it('shows retry button for failed exports', async () => {
    const failedExport = {
      ...mockExports[0],
      status: 'failed',
    }

    ;(apiClient.exports.list as jest.Mock).mockResolvedValue({
      data: { data: [failedExport] },
    })

    render(<ExportsPage />)

    await waitFor(() => {
      expect(screen.getByText('Failed')).toBeInTheDocument()
      expect(screen.getByText('Retry')).toBeInTheDocument()
    })
  })

  it('shows processing indicator for processing exports', async () => {
    render(<ExportsPage />)

    await waitFor(() => {
      expect(screen.getByText('Processing...')).toBeInTheDocument()
    })
  })

  it('shows empty state when no projects', async () => {
    ;(useProjectStore as jest.Mock).mockReturnValue({
      projects: [],
      fetchProjects: mockFetchProjects,
    })

    render(<ExportsPage />)

    await waitFor(() => {
      expect(screen.getByText('No projects')).toBeInTheDocument()
      expect(screen.getByText('Create a project first to export stories.')).toBeInTheDocument()
    })
  })

  it('shows empty state when no exports', async () => {
    ;(apiClient.exports.list as jest.Mock).mockResolvedValue({
      data: { data: [] },
    })

    render(<ExportsPage />)

    await waitFor(() => {
      expect(screen.getByText('No exports yet')).toBeInTheDocument()
      expect(screen.getByText('Your export requests will appear here once created.')).toBeInTheDocument()
    })
  })

  it('handles API errors gracefully', async () => {
    ;(apiClient.exports.list as jest.Mock).mockRejectedValue(new Error('API Error'))

    render(<ExportsPage />)

    await waitFor(() => {
      expect(screen.getByText('Failed to load exports')).toBeInTheDocument()
    })
  })

  it('refreshes export list when refresh button clicked', async () => {
    render(<ExportsPage />)

    await waitFor(() => {
      expect(screen.getByText('Refresh')).toBeInTheDocument()
    })

    const refreshButton = screen.getByText('Refresh')
    fireEvent.click(refreshButton)

    expect(apiClient.exports.list).toHaveBeenCalledTimes(2) // Once on mount, once on refresh
  })

  it('shows loading state', () => {
    ;(apiClient.exports.list as jest.Mock).mockImplementation(() => new Promise(() => {})) // Never resolves

    render(<ExportsPage />)

    expect(screen.getByTestId('loading-skeleton')).toBeInTheDocument()
  })

  it('displays export information section', async () => {
    render(<ExportsPage />)

    await waitFor(() => {
      expect(screen.getByText('About Exports')).toBeInTheDocument()
      expect(screen.getByText(/Exports include all stories, transcripts, photos/)).toBeInTheDocument()
      expect(screen.getByText(/Export files are available for download for 7 days/)).toBeInTheDocument()
    })
  })

  it('handles export creation error', async () => {
    ;(apiClient.exports.create as jest.Mock).mockRejectedValue(new Error('Creation failed'))

    render(<ExportsPage />)

    await waitFor(() => {
      expect(screen.getByText('Family Stories')).toBeInTheDocument()
    })

    const exportButtons = screen.getAllByText('Export')
    fireEvent.click(exportButtons[0])

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Creation failed')
    })
  })

  it('handles download error', async () => {
    ;(apiClient.exports.download as jest.Mock).mockRejectedValue(new Error('Download failed'))

    render(<ExportsPage />)

    await waitFor(() => {
      expect(screen.getByText('Download')).toBeInTheDocument()
    })

    const downloadButton = screen.getByText('Download')
    fireEvent.click(downloadButton)

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Download failed')
    })
  })
})