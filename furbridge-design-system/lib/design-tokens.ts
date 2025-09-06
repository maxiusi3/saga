// Design Tokens for FurBridge Design System
export const designTokens = {
  colors: {
    primary: {
      50: "oklch(0.95 0.05 180)",
      100: "oklch(0.90 0.08 180)",
      200: "oklch(0.80 0.10 180)",
      300: "oklch(0.70 0.12 180)",
      400: "oklch(0.60 0.14 180)",
      500: "oklch(0.45 0.15 180)", // Main primary
      600: "oklch(0.40 0.15 180)",
      700: "oklch(0.35 0.14 180)",
      800: "oklch(0.30 0.12 180)",
      900: "oklch(0.25 0.10 180)",
    },
    secondary: {
      50: "oklch(0.95 0.05 45)",
      100: "oklch(0.90 0.08 45)",
      200: "oklch(0.80 0.12 45)",
      300: "oklch(0.75 0.15 45)",
      400: "oklch(0.70 0.17 45)",
      500: "oklch(0.65 0.18 45)", // Main secondary
      600: "oklch(0.60 0.18 45)",
      700: "oklch(0.55 0.17 45)",
      800: "oklch(0.50 0.15 45)",
      900: "oklch(0.45 0.12 45)",
    },
    brown: {
      50: "oklch(0.95 0.02 45)",
      100: "oklch(0.90 0.03 45)",
      200: "oklch(0.80 0.04 45)",
      300: "oklch(0.70 0.05 45)",
      400: "oklch(0.60 0.06 45)",
      500: "oklch(0.50 0.07 45)",
      600: "oklch(0.40 0.08 45)",
      700: "oklch(0.35 0.08 45)", // Main brown
      800: "oklch(0.30 0.07 45)",
      900: "oklch(0.25 0.06 45)",
    },
  },

  typography: {
    fontSizes: {
      xs: "0.75rem",
      sm: "0.875rem",
      base: "1rem",
      lg: "1.125rem",
      xl: "1.25rem",
      "2xl": "1.5rem",
      "3xl": "1.875rem",
      "4xl": "2.25rem",
      "5xl": "3rem",
    },
    fontWeights: {
      normal: "400",
      medium: "500",
      semibold: "600",
      bold: "700",
    },
    lineHeights: {
      tight: "1.25",
      normal: "1.5",
      relaxed: "1.625",
    },
  },

  spacing: {
    xs: "0.25rem",
    sm: "0.5rem",
    md: "1rem",
    lg: "1.5rem",
    xl: "2rem",
    "2xl": "3rem",
    "3xl": "4rem",
  },

  borderRadius: {
    sm: "calc(var(--radius) - 4px)",
    md: "calc(var(--radius) - 2px)",
    lg: "var(--radius)",
    xl: "calc(var(--radius) + 4px)",
  },

  shadows: {
    sm: "0 1px 2px 0 rgb(0 0 0 / 0.05)",
    md: "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
    lg: "0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)",
    xl: "0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)",
  },
} as const

export type DesignTokens = typeof designTokens
