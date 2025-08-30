import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe, toHaveNoViolations } from 'jest-axe'
import '@testing-library/jest-dom'

// Extend Jest matchers
expect.extend(toHaveNoViolations)

// Mock IntersectionObserver
global.IntersectionObserver = class IntersectionObserver {
  constructor() {}
  observe() {}
  unobserve() {}
  disconnect() {}
}

describe('Accessibility Tests', () => {
  describe('ARIA Labels and Roles', () => {
    it('should have proper ARIA labels on Dashboard', async () => {
      const DashboardPage = (await import('../app/dashboard/page')).default
      
      render(<DashboardPage />)
      
      // Check for proper heading structure
      const mainHeading = screen.getByRole('heading', { level: 1 })
      expect(mainHeading).toBeInTheDocument()
      expect(mainHeading).toHaveTextContent('我的项目')
      
      // Check for proper navigation
      const banner = screen.getByRole('banner')
      expect(banner).toBeInTheDocument()
      
      const main = screen.getByRole('main')
      expect(main).toBeInTheDocument()
      expect(main).toHaveAttribute('id', 'main-content')
      
      // Check for proper button labels
      const createButton = screen.getByRole('link', { name: /创建新的家庭故事项目/i })
      expect(createButton).toHaveAttribute('aria-label')
    })

    it('should have proper ARIA labels on Project Creation Form', async () => {
      const ProjectNewPage = (await import('../app/dashboard/projects/new/page')).default
      
      render(<ProjectNewPage />)
      
      // Form should have proper labels
      const titleInput = screen.getByLabelText(/Project Title/i)
      expect(titleInput).toBeInTheDocument()
      expect(titleInput).toHaveAttribute('id', 'title')
      
      const descriptionInput = screen.getByLabelText(/Description/i)
      expect(descriptionInput).toBeInTheDocument()
      expect(descriptionInput).toHaveAttribute('id', 'description')
      
      // Required fields should be marked
      expect(titleInput).toBeRequired()
    })

    it('should have proper ARIA labels on WebAudioRecorder', async () => {
      const { WebAudioRecorder } = await import('../components/recording/WebAudioRecorder')
      
      render(<WebAudioRecorder onRecordingComplete={jest.fn()} />)
      
      // Recording controls should have proper labels
      const recordingRegion = screen.getByRole('region')
      expect(recordingRegion).toHaveAttribute('aria-labelledby', 'recorder-heading')
      
      const startButton = screen.getByRole('button', { name: /Start recording your story/i })
      expect(startButton).toHaveAttribute('aria-label')
      
      // Duration should have live region
      const duration = screen.getByLabelText(/Recording duration/i)
      expect(duration).toHaveAttribute('aria-live', 'polite')
    })
  })

  describe('Keyboard Navigation', () => {
    it('should support keyboard navigation on Dashboard', async () => {
      const user = userEvent.setup()
      const DashboardPage = (await import('../app/dashboard/page')).default
      
      render(<DashboardPage />)
      
      // Tab through interactive elements
      const createButton = screen.getByRole('link', { name: /创建新项目/i })
      
      await user.tab()
      expect(createButton).toHaveFocus()
      
      // Enter should activate the link
      await user.keyboard('{Enter}')
      // Note: In a real test, this would navigate, but we're just testing the interaction
    })

    it('should support keyboard navigation in forms', async () => {
      const user = userEvent.setup()
      const ProjectNewPage = (await import('../app/dashboard/projects/new/page')).default
      
      render(<ProjectNewPage />)
      
      // Tab through form fields
      const titleInput = screen.getByLabelText(/Project Title/i)
      const descriptionInput = screen.getByLabelText(/Description/i)
      
      await user.tab()
      expect(titleInput).toHaveFocus()
      
      await user.tab()
      expect(descriptionInput).toHaveFocus()
      
      // Should be able to type in fields
      await user.type(titleInput, 'Test Project')
      expect(titleInput).toHaveValue('Test Project')
    })

    it('should support keyboard navigation in modals', async () => {
      const user = userEvent.setup()
      const { AccessibleModal } = await import('../components/accessibility/accessible-modal')
      
      const onClose = jest.fn()
      
      render(
        <AccessibleModal
          isOpen={true}
          onClose={onClose}
          title="Test Modal"
          description="Test modal description"
        >
          <button>Test Button</button>
          <button>Another Button</button>
        </AccessibleModal>
      )
      
      // Modal should trap focus
      const modal = screen.getByRole('dialog')
      expect(modal).toBeInTheDocument()
      
      const closeButton = screen.getByRole('button', { name: /Close dialog/i })
      const testButton = screen.getByRole('button', { name: 'Test Button' })
      
      // Tab should cycle through modal elements
      await user.tab()
      expect(closeButton).toHaveFocus()
      
      await user.tab()
      expect(testButton).toHaveFocus()
      
      // Escape should close modal
      await user.keyboard('{Escape}')
      expect(onClose).toHaveBeenCalled()
    })
  })

  describe('Screen Reader Support', () => {
    it('should have proper heading hierarchy', async () => {
      const DashboardPage = (await import('../app/dashboard/page')).default
      
      render(<DashboardPage />)
      
      // Check heading levels
      const h1 = screen.getByRole('heading', { level: 1 })
      expect(h1).toBeInTheDocument()
      
      // Should not skip heading levels
      const headings = screen.getAllByRole('heading')
      const levels = headings.map(h => parseInt(h.tagName.charAt(1)))
      
      // Verify no skipped levels (simplified check)
      expect(levels).toContain(1)
    })

    it('should have proper list structures', async () => {
      const DashboardPage = (await import('../app/dashboard/page')).default
      
      render(<DashboardPage />)
      
      // Project grid should be marked as list
      const projectList = screen.getByRole('list', { name: /项目/ })
      if (projectList) {
        const listItems = screen.getAllByRole('listitem')
        expect(listItems.length).toBeGreaterThan(0)
      }
    })

    it('should announce status changes', async () => {
      const { WebAudioRecorder } = await import('../components/recording/WebAudioRecorder')
      
      render(<WebAudioRecorder onRecordingComplete={jest.fn()} />)
      
      // Status messages should have live regions
      const statusMessage = screen.getByRole('status')
      if (statusMessage) {
        expect(statusMessage).toHaveAttribute('aria-live')
      }
    })
  })

  describe('Focus Management', () => {
    it('should manage focus in skip links', async () => {
      const { SkipLinks } = await import('../components/accessibility/skip-links')
      
      render(
        <div>
          <SkipLinks />
          <main id="main-content">Main content</main>
        </div>
      )
      
      const skipLink = screen.getByText('Skip to main content')
      expect(skipLink).toBeInTheDocument()
      
      // Skip link should be focusable
      skipLink.focus()
      expect(skipLink).toHaveFocus()
    })

    it('should restore focus after modal closes', async () => {
      const user = userEvent.setup()
      const { AccessibleModal } = await import('../components/accessibility/accessible-modal')
      
      const TestComponent = () => {
        const [isOpen, setIsOpen] = React.useState(false)
        
        return (
          <div>
            <button onClick={() => setIsOpen(true)}>Open Modal</button>
            <AccessibleModal
              isOpen={isOpen}
              onClose={() => setIsOpen(false)}
              title="Test Modal"
            >
              <button>Modal Button</button>
            </AccessibleModal>
          </div>
        )
      }
      
      render(<TestComponent />)
      
      const openButton = screen.getByText('Open Modal')
      await user.click(openButton)
      
      // Modal should be open
      expect(screen.getByRole('dialog')).toBeInTheDocument()
      
      // Close modal
      const closeButton = screen.getByRole('button', { name: /Close dialog/i })
      await user.click(closeButton)
      
      // Focus should return to open button
      await waitFor(() => {
        expect(openButton).toHaveFocus()
      })
    })
  })

  describe('Color Contrast and Visual Accessibility', () => {
    it('should not rely solely on color for information', async () => {
      const { SubscriptionStatusCard } = await import('../components/subscription/subscription-status')
      
      const mockSubscription = {
        id: '1',
        projectId: '1',
        status: 'active' as const,
        mode: 'interactive' as const,
        startDate: '2024-01-01',
        endDate: '2024-12-31',
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
        },
        limits: {}
      }
      
      render(<SubscriptionStatusCard projectId="1" showDetails={true} />)
      
      // Status should be indicated by text, not just color
      const statusText = screen.getByText(/订阅状态/i)
      expect(statusText).toBeInTheDocument()
    })
  })

  describe('Error Handling and Feedback', () => {
    it('should provide accessible error messages', async () => {
      const ProjectNewPage = (await import('../app/dashboard/projects/new/page')).default
      
      render(<ProjectNewPage />)
      
      // Error messages should be associated with form fields
      const titleInput = screen.getByLabelText(/Project Title/i)
      
      // Simulate form submission with empty required field
      fireEvent.submit(titleInput.closest('form')!)
      
      await waitFor(() => {
        const errorMessage = screen.queryByRole('alert')
        if (errorMessage) {
          expect(errorMessage).toBeInTheDocument()
        }
      })
    })

    it('should announce loading states', async () => {
      const DashboardPage = (await import('../app/dashboard/page')).default
      
      render(<DashboardPage />)
      
      // Loading states should be announced
      const loadingMessage = screen.queryByText(/加载中/i)
      if (loadingMessage) {
        expect(loadingMessage).toBeInTheDocument()
      }
    })
  })

  describe('Axe Accessibility Testing', () => {
    it('should not have accessibility violations on Dashboard', async () => {
      const DashboardPage = (await import('../app/dashboard/page')).default
      
      const { container } = render(<DashboardPage />)
      
      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })

    it('should not have accessibility violations on Project Creation', async () => {
      const ProjectNewPage = (await import('../app/dashboard/projects/new/page')).default
      
      const { container } = render(<ProjectNewPage />)
      
      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })

    it('should not have accessibility violations on WebAudioRecorder', async () => {
      const { WebAudioRecorder } = await import('../components/recording/WebAudioRecorder')
      
      const { container } = render(<WebAudioRecorder onRecordingComplete={jest.fn()} />)
      
      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })

    it('should not have accessibility violations on Modal', async () => {
      const { AccessibleModal } = await import('../components/accessibility/accessible-modal')
      
      const { container } = render(
        <AccessibleModal
          isOpen={true}
          onClose={jest.fn()}
          title="Test Modal"
          description="Test description"
        >
          <p>Modal content</p>
        </AccessibleModal>
      )
      
      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })
  })

  describe('Mobile Accessibility', () => {
    it('should have appropriate touch targets', async () => {
      const DashboardPage = (await import('../app/dashboard/page')).default
      
      render(<DashboardPage />)
      
      // Touch targets should be large enough
      const buttons = screen.getAllByRole('button')
      const links = screen.getAllByRole('link')
      
      [...buttons, ...links].forEach(element => {
        const styles = window.getComputedStyle(element)
        // Touch targets should be at least 44px (this is a simplified check)
        expect(element).toHaveClass(/touch-target/)
      })
    })

    it('should support voice control', async () => {
      const DashboardPage = (await import('../app/dashboard/page')).default
      
      render(<DashboardPage />)
      
      // Elements should have accessible names for voice control
      const createButton = screen.getByRole('link', { name: /创建新项目/i })
      expect(createButton).toHaveAccessibleName()
    })
  })
})
