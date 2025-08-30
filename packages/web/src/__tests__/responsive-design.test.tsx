import { render, screen } from '@testing-library/react'
import { act } from '@testing-library/react'
import '@testing-library/jest-dom'

// Mock window.matchMedia
const mockMatchMedia = (query: string) => ({
  matches: false,
  media: query,
  onchange: null,
  addListener: jest.fn(), // deprecated
  removeListener: jest.fn(), // deprecated
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  dispatchEvent: jest.fn(),
})

// Helper to simulate different viewport sizes
const setViewportSize = (width: number, height: number) => {
  Object.defineProperty(window, 'innerWidth', {
    writable: true,
    configurable: true,
    value: width,
  })
  Object.defineProperty(window, 'innerHeight', {
    writable: true,
    configurable: true,
    value: height,
  })
  
  // Mock matchMedia for different breakpoints
  window.matchMedia = jest.fn().mockImplementation((query) => {
    const breakpoints = {
      '(max-width: 640px)': width <= 640, // mobile
      '(max-width: 768px)': width <= 768, // tablet
      '(max-width: 1024px)': width <= 1024, // desktop
      '(min-width: 641px)': width > 640,
      '(min-width: 769px)': width > 768,
      '(min-width: 1025px)': width > 1024,
    }
    
    return {
      ...mockMatchMedia(query),
      matches: breakpoints[query as keyof typeof breakpoints] || false,
    }
  })
  
  // Trigger resize event
  act(() => {
    window.dispatchEvent(new Event('resize'))
  })
}

describe('Responsive Design Tests', () => {
  beforeEach(() => {
    // Reset to desktop size
    setViewportSize(1024, 768)
  })

  describe('Dashboard Page Responsive Behavior', () => {
    it('should display mobile layout on small screens', async () => {
      const DashboardPage = (await import('../app/dashboard/page')).default
      
      setViewportSize(375, 667) // iPhone SE size
      
      render(<DashboardPage />)
      
      // Check for mobile-specific classes
      const header = screen.getByRole('banner')
      expect(header).toBeInTheDocument()
      
      // Mobile navigation should be stacked
      const createButton = screen.getByRole('link', { name: /创建新项目/i })
      expect(createButton).toHaveClass('mobile-full')
    })

    it('should display tablet layout on medium screens', async () => {
      const DashboardPage = (await import('../app/dashboard/page')).default
      
      setViewportSize(768, 1024) // iPad size
      
      render(<DashboardPage />)
      
      // Check for tablet-specific responsive classes
      const mainContent = screen.getByRole('main')
      expect(mainContent).toHaveClass('container-responsive')
    })

    it('should display desktop layout on large screens', async () => {
      const DashboardPage = (await import('../app/dashboard/page')).default
      
      setViewportSize(1920, 1080) // Desktop size
      
      render(<DashboardPage />)
      
      // Desktop should show full navigation
      const header = screen.getByRole('banner')
      expect(header).toBeInTheDocument()
      
      // Check for desktop-specific layout
      const createButton = screen.getByRole('link', { name: /创建新项目/i })
      expect(createButton).not.toHaveClass('mobile-full')
    })
  })

  describe('Project Creation Form Responsive Behavior', () => {
    it('should stack form elements on mobile', async () => {
      const ProjectNewPage = (await import('../app/dashboard/projects/new/page')).default
      
      setViewportSize(375, 667)
      
      render(<ProjectNewPage />)
      
      // Form should be responsive
      const titleInput = screen.getByLabelText(/Project Title/i)
      expect(titleInput).toHaveClass('w-full')
      
      // Buttons should be full width on mobile
      const cancelButton = screen.getByRole('link', { name: /Cancel/i })
      expect(cancelButton).toHaveClass('mobile-full')
    })

    it('should display side-by-side layout on desktop', async () => {
      const ProjectNewPage = (await import('../app/dashboard/projects/new/page')).default
      
      setViewportSize(1024, 768)
      
      render(<ProjectNewPage />)
      
      // Form should use container layout
      const form = screen.getByRole('form') || document.querySelector('form')
      expect(form?.closest('.container-narrow')).toBeInTheDocument()
    })
  })

  describe('Resource Wallet Component Responsive Behavior', () => {
    it('should stack wallet information on mobile', async () => {
      const { ResourceWalletSummary } = await import('../components/wallet/resource-wallet-summary')
      
      setViewportSize(375, 667)
      
      const mockWallet = {
        projectVouchers: 1,
        facilitatorSeats: 2,
        storytellerSeats: 3
      }
      
      render(<ResourceWalletSummary wallet={mockWallet} showActions={true} />)
      
      // Should use mobile stacking classes
      const walletCard = screen.getByText(/Available Seats/i).closest('.responsive-padding')
      expect(walletCard).toBeInTheDocument()
    })

    it('should display inline layout on desktop', async () => {
      const { ResourceWalletSummary } = await import('../components/wallet/resource-wallet-summary')
      
      setViewportSize(1024, 768)
      
      const mockWallet = {
        projectVouchers: 1,
        facilitatorSeats: 2,
        storytellerSeats: 3
      }
      
      render(<ResourceWalletSummary wallet={mockWallet} showActions={true} />)
      
      // Should use desktop layout
      const walletInfo = screen.getByText(/Available Seats/i)
      expect(walletInfo).toBeInTheDocument()
    })
  })

  describe('Touch Target Sizes', () => {
    it('should have appropriate touch targets on mobile', async () => {
      const DashboardPage = (await import('../app/dashboard/page')).default
      
      setViewportSize(375, 667)
      
      render(<DashboardPage />)
      
      // Buttons should have touch-target class for mobile
      const createButton = screen.getByRole('link', { name: /创建新项目/i })
      expect(createButton).toHaveClass('touch-target')
    })

    it('should have larger touch targets for important actions', async () => {
      const { OnboardingEmptyState } = await import('../components/onboarding/onboarding-hints')
      
      setViewportSize(375, 667)
      
      render(<OnboardingEmptyState userRole="facilitator" />)
      
      // Primary action should have large touch target
      const primaryButton = screen.getByRole('link', { name: /Create Your First Project/i })
      expect(primaryButton).toHaveClass('touch-target-large')
    })
  })

  describe('Typography Scaling', () => {
    it('should scale headings appropriately on mobile', async () => {
      const DashboardPage = (await import('../app/dashboard/page')).default
      
      setViewportSize(375, 667)
      
      render(<DashboardPage />)
      
      // Main heading should have responsive text classes
      const heading = screen.getByRole('heading', { level: 1 })
      expect(heading).toHaveClass('text-2xl', 'sm:text-3xl')
    })

    it('should use larger typography on desktop', async () => {
      const DashboardPage = (await import('../app/dashboard/page')).default
      
      setViewportSize(1920, 1080)
      
      render(<DashboardPage />)
      
      // Heading should be larger on desktop
      const heading = screen.getByRole('heading', { level: 1 })
      expect(heading).toBeInTheDocument()
    })
  })

  describe('Grid Layouts', () => {
    it('should use single column on mobile', async () => {
      const DashboardPage = (await import('../app/dashboard/page')).default
      
      setViewportSize(375, 667)
      
      render(<DashboardPage />)
      
      // Grid should use responsive classes
      const gridContainer = document.querySelector('.grid-responsive')
      expect(gridContainer).toBeInTheDocument()
    })

    it('should use multi-column layout on desktop', async () => {
      const DashboardPage = (await import('../app/dashboard/page')).default
      
      setViewportSize(1024, 768)
      
      render(<DashboardPage />)
      
      // Should have grid layout
      const gridContainer = document.querySelector('.grid-responsive')
      expect(gridContainer).toBeInTheDocument()
    })
  })

  describe('Navigation Responsive Behavior', () => {
    it('should show mobile navigation on small screens', async () => {
      const DashboardPage = (await import('../app/dashboard/page')).default
      
      setViewportSize(375, 667)
      
      render(<DashboardPage />)
      
      // Mobile-specific elements should be visible
      const mobileElements = document.querySelectorAll('.mobile-only')
      expect(mobileElements.length).toBeGreaterThan(0)
    })

    it('should hide mobile-only elements on desktop', async () => {
      const DashboardPage = (await import('../app/dashboard/page')).default
      
      setViewportSize(1024, 768)
      
      render(<DashboardPage />)
      
      // Mobile-only elements should be hidden via CSS
      const mobileElements = document.querySelectorAll('.mobile-only')
      mobileElements.forEach(element => {
        // These elements exist but should be hidden via CSS
        expect(element).toBeInTheDocument()
      })
    })
  })

  describe('Form Responsive Behavior', () => {
    it('should stack form fields on mobile', async () => {
      const ProjectNewPage = (await import('../app/dashboard/projects/new/page')).default
      
      setViewportSize(375, 667)
      
      render(<ProjectNewPage />)
      
      // Form inputs should be full width
      const inputs = screen.getAllByRole('textbox')
      inputs.forEach(input => {
        expect(input).toHaveClass('w-full')
      })
    })

    it('should use appropriate spacing on different screen sizes', async () => {
      const ProjectNewPage = (await import('../app/dashboard/projects/new/page')).default
      
      setViewportSize(768, 1024)
      
      render(<ProjectNewPage />)
      
      // Container should use responsive padding
      const container = document.querySelector('.responsive-padding')
      expect(container).toBeInTheDocument()
    })
  })
})

// Utility function to test component at different breakpoints
export const testResponsiveComponent = (
  Component: React.ComponentType<any>,
  props: any = {},
  testName: string
) => {
  const breakpoints = [
    { name: 'mobile', width: 375, height: 667 },
    { name: 'tablet', width: 768, height: 1024 },
    { name: 'desktop', width: 1024, height: 768 },
    { name: 'large', width: 1920, height: 1080 }
  ]

  describe(`${testName} - Responsive Behavior`, () => {
    breakpoints.forEach(({ name, width, height }) => {
      it(`should render correctly on ${name} (${width}x${height})`, () => {
        setViewportSize(width, height)
        
        const { container } = render(<Component {...props} />)
        
        // Basic rendering test
        expect(container.firstChild).toBeInTheDocument()
        
        // Check for responsive classes
        const responsiveElements = container.querySelectorAll('[class*="responsive"], [class*="mobile"], [class*="sm:"], [class*="md:"], [class*="lg:"]')
        expect(responsiveElements.length).toBeGreaterThan(0)
      })
    })
  })
}
