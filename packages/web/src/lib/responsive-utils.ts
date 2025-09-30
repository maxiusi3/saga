/**
 * Responsive Design Utilities for Saga UI Components
 * Provides consistent breakpoints and responsive patterns
 */

// Tailwind CSS Breakpoints
export const breakpoints = {
  sm: '640px',   // Small devices (phones)
  md: '768px',   // Medium devices (tablets)
  lg: '1024px',  // Large devices (desktops)
  xl: '1280px',  // Extra large devices
  '2xl': '1536px' // 2X large devices
} as const

// Responsive Grid Classes
export const responsiveGrids = {
  // Card grids for different content types
  projectCards: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4',
  storyCards: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
  featureCards: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4',
  
  // Layout grids
  sidebar: 'grid-cols-1 lg:grid-cols-4',
  twoColumn: 'grid-cols-1 lg:grid-cols-2',
  threeColumn: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
  
  // Form layouts
  formFields: 'grid-cols-1 md:grid-cols-2',
  formFieldsThree: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
} as const

// Responsive Spacing
export const responsiveSpacing = {
  container: 'px-4 sm:px-6 lg:px-8',
  section: 'py-8 sm:py-12 lg:py-16',
  cardGap: 'gap-4 md:gap-6 lg:gap-8',
  elementGap: 'gap-2 sm:gap-3 md:gap-4',
} as const

// Responsive Typography
export const responsiveText = {
  display: 'text-3xl sm:text-4xl lg:text-5xl xl:text-6xl',
  h1: 'text-2xl sm:text-3xl lg:text-4xl',
  h2: 'text-xl sm:text-2xl lg:text-3xl',
  h3: 'text-lg sm:text-xl lg:text-2xl',
  body: 'text-sm sm:text-base',
  bodyLarge: 'text-base sm:text-lg',
} as const

// Touch Target Sizes (44x44dp minimum for accessibility)
export const touchTargets = {
  minimum: 'min-h-[44px] min-w-[44px]',
  button: 'h-11 px-4 py-2', // Default button size
  buttonSm: 'h-9 px-3 py-1.5',
  buttonLg: 'h-12 px-6 py-3',
  icon: 'h-11 w-11 p-2',
  iconSm: 'h-9 w-9 p-1.5',
  iconLg: 'h-12 w-12 p-2.5',
} as const

// Responsive Component Patterns
export const responsivePatterns = {
  // Navigation patterns
  mobileMenu: 'block lg:hidden',
  desktopMenu: 'hidden lg:block',
  
  // Layout patterns
  stackOnMobile: 'flex-col lg:flex-row',
  hideOnMobile: 'hidden sm:block',
  showOnMobile: 'block sm:hidden',
  
  // Content patterns
  truncateOnMobile: 'truncate sm:text-clip',
  fullWidthOnMobile: 'w-full sm:w-auto',
  
  // Card patterns
  cardPadding: 'p-4 sm:p-6',
  cardPaddingLarge: 'p-6 sm:p-8',
} as const

// Media Query Hooks (for use with CSS-in-JS or custom hooks)
export const mediaQueries = {
  sm: `(min-width: ${breakpoints.sm})`,
  md: `(min-width: ${breakpoints.md})`,
  lg: `(min-width: ${breakpoints.lg})`,
  xl: `(min-width: ${breakpoints.xl})`,
  '2xl': `(min-width: ${breakpoints['2xl']})`,
  
  // Max width queries
  maxSm: `(max-width: ${parseInt(breakpoints.sm) - 1}px)`,
  maxMd: `(max-width: ${parseInt(breakpoints.md) - 1}px)`,
  maxLg: `(max-width: ${parseInt(breakpoints.lg) - 1}px)`,
  
  // Orientation queries
  portrait: '(orientation: portrait)',
  landscape: '(orientation: landscape)',
  
  // Accessibility queries
  reducedMotion: '(prefers-reduced-motion: reduce)',
  highContrast: '(prefers-contrast: high)',
} as const

// Responsive Image Sizes
export const responsiveImages = {
  avatar: {
    xs: 'w-5 h-5',
    sm: 'w-6 h-6',
    default: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-12 h-12',
    xl: 'w-16 h-16',
    '2xl': 'w-20 h-20',
  },
  thumbnail: {
    sm: 'w-12 h-12',
    default: 'w-16 h-16',
    lg: 'w-20 h-20',
  },
  hero: {
    mobile: 'h-64 sm:h-80',
    desktop: 'h-96 lg:h-[32rem]',
  }
} as const

// Utility Functions
export const cn = (...classes: (string | undefined | null | false)[]): string => {
  return classes.filter(Boolean).join(' ')
}

export const getResponsiveClasses = (
  base: string,
  responsive: Record<string, string>
): string => {
  const classes = [base]
  
  Object.entries(responsive).forEach(([breakpoint, className]) => {
    if (breakpoint === 'default') {
      classes.unshift(className)
    } else {
      classes.push(`${breakpoint}:${className}`)
    }
  })
  
  return classes.join(' ')
}

// Component-specific responsive utilities
export const componentResponsive = {
  // Dashboard layout
  dashboard: {
    container: cn(responsiveSpacing.container, 'max-w-7xl mx-auto'),
    grid: responsiveGrids.projectCards,
    spacing: responsiveSpacing.cardGap,
  },
  
  // Story list layout
  storyList: {
    container: cn(responsiveSpacing.container, 'max-w-6xl mx-auto'),
    grid: responsiveGrids.storyCards,
    sidebar: 'lg:col-span-1',
    main: 'lg:col-span-2',
  },
  
  // Settings layout
  settings: {
    container: cn(responsiveSpacing.container, 'max-w-5xl mx-auto'),
    navigation: 'lg:col-span-1',
    content: 'lg:col-span-3',
    grid: 'grid-cols-1 lg:grid-cols-4',
  },
  
  // Purchase page layout
  purchase: {
    container: cn(responsiveSpacing.container, 'max-w-6xl mx-auto'),
    pricingGrid: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
    hero: responsiveText.display,
  },
} as const

// Accessibility-focused responsive utilities
export const accessibilityResponsive = {
  // Focus indicators
  focusRing: 'focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2',
  focusVisible: 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
  
  // Touch targets
  touchTarget: touchTargets.minimum,
  
  // High contrast support
  highContrast: 'contrast-more:border-black contrast-more:text-black',
  
  // Reduced motion support
  reducedMotion: 'motion-reduce:transition-none motion-reduce:animate-none',
} as const

export default {
  breakpoints,
  responsiveGrids,
  responsiveSpacing,
  responsiveText,
  touchTargets,
  responsivePatterns,
  mediaQueries,
  responsiveImages,
  componentResponsive,
  accessibilityResponsive,
  cn,
  getResponsiveClasses,
}