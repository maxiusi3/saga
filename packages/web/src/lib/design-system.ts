/**
 * Saga Design System Configuration
 * Based on prototype designs for consistent UI implementation
 */

export const designSystem = {
  colors: {
    // Primary Saga Green Palette
    primary: {
      50: '#F0F9F4',
      100: '#DCFCE7', 
      200: '#BBF7D0',
      300: '#86EFAC',
      400: '#4ADE80',
      500: '#2D5A3D', // Primary green from prototype
      600: '#4A7C59', // Secondary green from prototype
      700: '#15803D',
      800: '#166534',
      900: '#14532D',
    },
    
    // Status Colors
    success: '#22C55E',
    warning: '#F59E0B', 
    error: '#EF4444',
    
    // Neutral Grays (from prototype)
    gray: {
      50: '#F8FAFC',
      100: '#F1F5F9',
      200: '#E2E8F0',
      300: '#CBD5E1',
      400: '#94A3B8',
      500: '#64748B',
      600: '#475569',
      700: '#334155',
      800: '#1E293B',
      900: '#0F172A',
    }
  },
  
  typography: {
    fontSizes: {
      display: '3rem', // 48px
      h1: '2.25rem', // 36px
      h2: '1.875rem', // 30px
      h3: '1.5rem', // 24px
      h4: '1.25rem', // 20px
      bodyLarge: '1.125rem', // 18px
      body: '1rem', // 16px
      bodySmall: '0.875rem', // 14px
      caption: '0.75rem', // 12px
    },
    
    lineHeights: {
      display: '3.5rem', // 56px
      h1: '2.75rem', // 44px
      h2: '2.25rem', // 36px
      h3: '2rem', // 32px
      h4: '1.75rem', // 28px
      bodyLarge: '1.75rem', // 28px
      body: '1.5rem', // 24px
      bodySmall: '1.25rem', // 20px
      caption: '1rem', // 16px
    },
    
    fontWeights: {
      normal: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
    }
  },
  
  spacing: {
    1: '0.25rem', // 4px
    2: '0.5rem', // 8px
    3: '0.75rem', // 12px
    4: '1rem', // 16px
    6: '1.5rem', // 24px
    8: '2rem', // 32px
    12: '3rem', // 48px
    16: '4rem', // 64px
    24: '6rem', // 96px
  },
  
  borderRadius: {
    small: '0.375rem', // 6px
    medium: '0.75rem', // 12px
    large: '1rem', // 16px
    xl: '1.5rem', // 24px
    full: '9999px',
  },
  
  shadows: {
    small: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
    medium: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
    large: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
    elevated: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
  },
  
  components: {
    card: {
      background: '#ffffff',
      border: '#E2E8F0',
      shadow: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
      shadowHover: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
      borderRadius: '0.75rem', // 12px
    },
    
    button: {
      primary: {
        background: '#2D5A3D',
        backgroundHover: '#4A7C59',
        text: '#ffffff',
        borderRadius: '0.5rem', // 8px
      },
      secondary: {
        border: '#2D5A3D',
        text: '#2D5A3D',
        backgroundHover: '#F8FAFC',
        borderRadius: '0.5rem', // 8px
      }
    },
    
    badge: {
      borderRadius: '9999px', // Full rounded
      padding: '0.25rem 0.75rem', // 4px 12px
    }
  }
} as const

export type DesignSystem = typeof designSystem

// Helper function to get design system values
export function getDesignToken(path: string): string {
  const keys = path.split('.')
  let value: any = designSystem
  
  for (const key of keys) {
    value = value?.[key]
  }
  
  return value || ''
}

// Common component class generators
export const componentClasses = {
  card: {
    base: 'bg-white rounded-xl border border-gray-200 shadow-sm',
    hover: 'hover:shadow-md transition-shadow duration-200',
    elevated: 'shadow-lg',
  },
  
  button: {
    primary: 'bg-saga-green text-white px-6 py-3 rounded-lg font-medium hover:bg-saga-green-secondary transition-colors duration-200',
    secondary: 'border-2 border-saga-green text-saga-green px-6 py-3 rounded-lg font-medium hover:bg-gray-50 transition-colors duration-200',
    tertiary: 'text-saga-green px-6 py-3 rounded-lg font-medium hover:bg-gray-50 transition-colors duration-200',
  },
  
  badge: {
    success: 'bg-green-500 text-white px-3 py-1 rounded-full text-xs font-medium',
    warning: 'bg-yellow-500 text-white px-3 py-1 rounded-full text-xs font-medium',
    error: 'bg-red-500 text-white px-3 py-1 rounded-full text-xs font-medium',
    neutral: 'bg-gray-500 text-white px-3 py-1 rounded-full text-xs font-medium',
    primary: 'bg-saga-green text-white px-3 py-1 rounded-full text-xs font-medium',
  }
}