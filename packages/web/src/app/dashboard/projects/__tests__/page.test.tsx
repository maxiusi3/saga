import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { useRouter } from 'next/navigation'
import { toast } from 'react-hot-toast'
import ProjectsPage from '../page'
import { useProjectStore } from '@/stores/project-store'

// Mock dependencies
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}))

jest.mock('react-hot-toast', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}))

jest.mock('@/stores/project-store', () => ({
  useProjectStore: jest.fn(),
}))

const mockPush = jest.fn()
const mockFetchProjects = jest.fn()
const mockDeleteProject = jest.fn()
const mockClearError = jest.fn()

const mockProjects = [
  {
    id: '1',
    title: 'Family Stories',
    description: 'Collecting family memories',
    storyCount: 5,
    updatedAt: new Date('2023-12-01'),
  },
  {
    id: '2',
    title: 'Mom\'s Life',
    description: 'Mom\'s life stories',
    storyCount: 3,
    updatedAt: new Date('2023-11-15'),
  },
]

describe('ProjectsPage', () => {
  beforeEach(() => {
    ;(useRouter as jest.Mock).mockReturnValue({
      push: mockPush,
    })

    ;(useProjectStore as jest.Mock).mockReturnValue({
      projects: mockProjects,
      isLoading: false,
      error: null,
      fetchProjects: mockFetchProjects,
      deleteProject: mockDeleteProject,
      clearError: mockClearError,
    })

    jest.clearAllMocks()
  })

  it('renders projects page with header', () => {
    render(<ProjectsPage />)

    expect(screen.getByText('Projects')).toBeInTheDocument()
    expect(screen.getByText('Manage your family story projects and track their progress.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /New Project/ })).toBeInTheDocument()
  })

  it('fetches projects on mount', () => {
    render(<ProjectsPage />)
    expect(mockFetchProjects).toHaveBeenCalled()
  })

  it('displays projects in grid', () => {
    render(<ProjectsPage />)

    expect(screen.getByText('Family Stories')).toBeInTheDocument()
    expect(screen.getByText('Collecting family memories')).toBeInTheDocument()
    expect(screen.getByText('5 stories')).toBeInTheDocument()

    expect(screen.getByText('Mom\'s Life')).toBeInTheDocument()
    expect(screen.getByText('Mom\'s life stories')).toBeInTheDocument()
    expect(screen.getByText('3 stories')).toBeInTheDocument()
  })

  it('shows loading state', () => {
    ;(useProjectStore as jest.Mock).mockReturnValue({
      projects: [],
      isLoading: true,
      error: null,
      fetchProjects: mockFetchProjects,
      deleteProject: mockDeleteProject,
      clearError: mockClearError,
    })

    render(<ProjectsPage />)

    expect(screen.getByTestId('loading-skeleton')).toBeInTheDocument()
  })

  it('shows empty state when no projects', () => {
    ;(useProjectStore as jest.Mock).mockReturnValue({
      projects: [],
      isLoading: false,
      error: null,
      fetchProjects: mockFetchProjects,
      deleteProject: mockDeleteProject,
      clearError: mockClearError,
    })

    render(<ProjectsPage />)

    expect(screen.getByText('No projects')).toBeInTheDocument()
    expect(screen.getByText('Get started by creating your first family story project.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Create Your First Project/ })).toBeInTheDocument()
  })

  it('displays error message', () => {
    ;(useProjectStore as jest.Mock).mockReturnValue({
      projects: mockProjects,
      isLoading: false,
      error: 'Failed to load projects',
      fetchProjects: mockFetchProjects,
      deleteProject: mockDeleteProject,
      clearError: mockClearError,
    })

    render(<ProjectsPage />)

    expect(screen.getByText('Failed to load projects')).toBeInTheDocument()
  })

  it('clears error when close button clicked', () => {
    ;(useProjectStore as jest.Mock).mockReturnValue({
      projects: mockProjects,
      isLoading: false,
      error: 'Failed to load projects',
      fetchProjects: mockFetchProjects,
      deleteProject: mockDeleteProject,
      clearError: mockClearError,
    })

    render(<ProjectsPage />)

    const closeButton = screen.getByRole('button', { name: '' }) // Close icon button
    fireEvent.click(closeButton)

    expect(mockClearError).toHaveBeenCalled()
  })

  it('handles project deletion', async () => {
    // Mock window.confirm
    const originalConfirm = window.confirm
    window.confirm = jest.fn(() => true)

    mockDeleteProject.mockResolvedValue(undefined)

    render(<ProjectsPage />)

    const deleteButtons = screen.getAllByTitle('Delete project')
    fireEvent.click(deleteButtons[0])

    expect(window.confirm).toHaveBeenCalledWith(
      'Are you sure you want to delete "Family Stories"? This action cannot be undone.'
    )

    await waitFor(() => {
      expect(mockDeleteProject).toHaveBeenCalledWith('1')
      expect(toast.success).toHaveBeenCalledWith('Project deleted successfully')
    })

    // Restore window.confirm
    window.confirm = originalConfirm
  })

  it('cancels deletion when user declines confirmation', () => {
    // Mock window.confirm
    const originalConfirm = window.confirm
    window.confirm = jest.fn(() => false)

    render(<ProjectsPage />)

    const deleteButtons = screen.getAllByTitle('Delete project')
    fireEvent.click(deleteButtons[0])

    expect(window.confirm).toHaveBeenCalled()
    expect(mockDeleteProject).not.toHaveBeenCalled()

    // Restore window.confirm
    window.confirm = originalConfirm
  })

  it('handles deletion error', async () => {
    // Mock window.confirm
    const originalConfirm = window.confirm
    window.confirm = jest.fn(() => true)

    const error = new Error('Deletion failed')
    mockDeleteProject.mockRejectedValue(error)

    render(<ProjectsPage />)

    const deleteButtons = screen.getAllByTitle('Delete project')
    fireEvent.click(deleteButtons[0])

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Deletion failed')
    })

    // Restore window.confirm
    window.confirm = originalConfirm
  })

  it('has correct navigation links', () => {
    render(<ProjectsPage />)

    // Check project detail links
    const viewDetailButtons = screen.getAllByText('View Details')
    expect(viewDetailButtons[0]).toHaveAttribute('href', '/dashboard/projects/1')
    expect(viewDetailButtons[1]).toHaveAttribute('href', '/dashboard/projects/2')

    // Check edit links
    const editButtons = screen.getAllByTitle('Edit project')
    expect(editButtons[0]).toHaveAttribute('href', '/dashboard/projects/1/edit')
    expect(editButtons[1]).toHaveAttribute('href', '/dashboard/projects/2/edit')

    // Check invite links
    const inviteLinks = screen.getAllByText('Invite')
    expect(inviteLinks[0]).toHaveAttribute('href', '/dashboard/projects/1/invite')
    expect(inviteLinks[1]).toHaveAttribute('href', '/dashboard/projects/2/invite')

    // Check stories links
    const storiesLinks = screen.getAllByText('Stories')
    expect(storiesLinks[0]).toHaveAttribute('href', '/dashboard/projects/1/stories')
    expect(storiesLinks[1]).toHaveAttribute('href', '/dashboard/projects/2/stories')
  })

  it('shows progress bars for projects', () => {
    render(<ProjectsPage />)

    expect(screen.getByText('5 of 10+ stories collected')).toBeInTheDocument()
    expect(screen.getByText('3 of 10+ stories collected')).toBeInTheDocument()
  })
})