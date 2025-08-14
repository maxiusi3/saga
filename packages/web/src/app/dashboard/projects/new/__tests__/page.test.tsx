import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { useRouter } from 'next/navigation'
import { toast } from 'react-hot-toast'
import NewProjectPage from '../page'
import { useProjectStore } from '@/stores/project-store'

// Mock dependencies
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}))

jest.mock('react-hot-toast', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
  },
}))

jest.mock('@/stores/project-store', () => ({
  useProjectStore: jest.fn(),
}))

const mockPush = jest.fn()
const mockCreateProject = jest.fn()
const mockClearError = jest.fn()

describe('NewProjectPage', () => {
  beforeEach(() => {
    ;(useRouter as jest.Mock).mockReturnValue({
      push: mockPush,
    })

    ;(useProjectStore as jest.Mock).mockReturnValue({
      createProject: mockCreateProject,
      isLoading: false,
      error: null,
      clearError: mockClearError,
    })

    jest.clearAllMocks()
  })

  it('renders new project form', () => {
    render(<NewProjectPage />)

    expect(screen.getByText('Create New Project')).toBeInTheDocument()
    expect(screen.getByText('Start collecting and preserving your family\'s stories and memories.')).toBeInTheDocument()
    expect(screen.getByLabelText('Project Title *')).toBeInTheDocument()
    expect(screen.getByLabelText('Description')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Create Project' })).toBeInTheDocument()
  })

  it('validates required fields', async () => {
    render(<NewProjectPage />)

    const submitButton = screen.getByRole('button', { name: 'Create Project' })
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(screen.getByText('Project title is required')).toBeInTheDocument()
    })
  })

  it('validates field lengths', async () => {
    render(<NewProjectPage />)

    const titleInput = screen.getByLabelText('Project Title *')
    const descriptionInput = screen.getByLabelText('Description')

    // Test title too long
    fireEvent.change(titleInput, { 
      target: { value: 'a'.repeat(101) } 
    })

    // Test description too long
    fireEvent.change(descriptionInput, { 
      target: { value: 'a'.repeat(501) } 
    })

    const submitButton = screen.getByRole('button', { name: 'Create Project' })
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(screen.getByText('Title must be less than 100 characters')).toBeInTheDocument()
      expect(screen.getByText('Description must be less than 500 characters')).toBeInTheDocument()
    })
  })

  it('shows preview when fields are filled', () => {
    render(<NewProjectPage />)

    const titleInput = screen.getByLabelText('Project Title *')
    const descriptionInput = screen.getByLabelText('Description')

    fireEvent.change(titleInput, { target: { value: 'My Family Stories' } })
    fireEvent.change(descriptionInput, { target: { value: 'A collection of family memories' } })

    expect(screen.getByText('Preview')).toBeInTheDocument()
    expect(screen.getByText('My Family Stories')).toBeInTheDocument()
    expect(screen.getByText('A collection of family memories')).toBeInTheDocument()
  })

  it('creates project successfully', async () => {
    const mockProject = {
      id: '1',
      title: 'My Family Stories',
      description: 'A collection of family memories',
    }

    mockCreateProject.mockResolvedValue(mockProject)

    render(<NewProjectPage />)

    const titleInput = screen.getByLabelText('Project Title *')
    const descriptionInput = screen.getByLabelText('Description')
    const submitButton = screen.getByRole('button', { name: 'Create Project' })

    fireEvent.change(titleInput, { target: { value: 'My Family Stories' } })
    fireEvent.change(descriptionInput, { target: { value: 'A collection of family memories' } })
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(mockClearError).toHaveBeenCalled()
      expect(mockCreateProject).toHaveBeenCalledWith({
        title: 'My Family Stories',
        description: 'A collection of family memories',
      })
      expect(toast.success).toHaveBeenCalledWith('Project created successfully!')
    })

    // Should show package selection step
    expect(screen.getByText('Project Created Successfully!')).toBeInTheDocument()
    expect(screen.getByText('The Saga Package')).toBeInTheDocument()
  })

  it('handles creation error', async () => {
    const error = new Error('Creation failed')
    mockCreateProject.mockRejectedValue(error)

    render(<NewProjectPage />)

    const titleInput = screen.getByLabelText('Project Title *')
    const submitButton = screen.getByRole('button', { name: 'Create Project' })

    fireEvent.change(titleInput, { target: { value: 'My Family Stories' } })
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Creation failed')
    })
  })

  it('displays error message', () => {
    ;(useProjectStore as jest.Mock).mockReturnValue({
      createProject: mockCreateProject,
      isLoading: false,
      error: 'Something went wrong',
      clearError: mockClearError,
    })

    render(<NewProjectPage />)

    expect(screen.getByText('Something went wrong')).toBeInTheDocument()
  })

  it('shows loading state', () => {
    ;(useProjectStore as jest.Mock).mockReturnValue({
      createProject: mockCreateProject,
      isLoading: true,
      error: null,
      clearError: mockClearError,
    })

    render(<NewProjectPage />)

    const submitButton = screen.getByRole('button', { name: 'Create Project' })
    expect(submitButton).toBeDisabled()
  })

  it('has cancel link', () => {
    render(<NewProjectPage />)

    const cancelLink = screen.getByRole('link', { name: 'Cancel' })
    expect(cancelLink).toHaveAttribute('href', '/dashboard/projects')
  })

  it('has back to projects link', () => {
    render(<NewProjectPage />)

    const backLink = screen.getByRole('link', { name: /Back to Projects/ })
    expect(backLink).toHaveAttribute('href', '/dashboard/projects')
  })

  describe('Package selection step', () => {
    beforeEach(async () => {
      const mockProject = {
        id: '1',
        title: 'My Family Stories',
        description: 'A collection of family memories',
      }

      mockCreateProject.mockResolvedValue(mockProject)

      render(<NewProjectPage />)

      const titleInput = screen.getByLabelText('Project Title *')
      const submitButton = screen.getByRole('button', { name: 'Create Project' })

      fireEvent.change(titleInput, { target: { value: 'My Family Stories' } })
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText('Project Created Successfully!')).toBeInTheDocument()
      })
    })

    it('shows package details', () => {
      expect(screen.getByText('The Saga Package')).toBeInTheDocument()
      expect(screen.getByText('$129')).toBeInTheDocument()
      expect(screen.getByText('one-time payment')).toBeInTheDocument()
      expect(screen.getByText('Unlimited story recordings')).toBeInTheDocument()
      expect(screen.getByText('AI-powered transcription')).toBeInTheDocument()
    })

    it('handles package purchase', () => {
      const purchaseButton = screen.getByRole('button', { name: 'Purchase Package' })
      fireEvent.click(purchaseButton)

      expect(toast.info).toHaveBeenCalledWith('Package purchase will be implemented with Stripe integration')
      expect(mockPush).toHaveBeenCalledWith('/dashboard/projects')
    })

    it('handles skip package', () => {
      const skipButton = screen.getByRole('button', { name: 'Skip for now' })
      fireEvent.click(skipButton)

      expect(mockPush).toHaveBeenCalledWith('/dashboard/projects')
    })
  })
})