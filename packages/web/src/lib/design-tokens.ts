export const designTokens = {
  colors: {
    brand: {
      orange: {
        DEFAULT: "var(--furbridge-orange)",
        hover: "var(--furbridge-orange-hover)",
      },
      teal: {
        DEFAULT: "var(--furbridge-teal)",
        hover: "var(--furbridge-teal-hover)",
      },
      warmGray: "var(--furbridge-warm-gray)",
      lightGray: "var(--furbridge-light-gray)",
    },
  },
  typography: {
    fontFamily: {
      sans: "var(--font-geist-sans)",
      mono: "var(--font-geist-mono)",
    },
    fontSize: {
      hero: ["3.5rem", { lineHeight: "1.1", letterSpacing: "-0.02em" }],
      "hero-sm": ["2.5rem", { lineHeight: "1.2", letterSpacing: "-0.02em" }],
      subtitle: ["1.25rem", { lineHeight: "1.6" }],
      body: ["1rem", { lineHeight: "1.6" }],
      caption: ["0.875rem", { lineHeight: "1.5" }],
    },
  },
  spacing: {
    section: "5rem",
    "section-sm": "3rem",
    container: "1.5rem",
  },
  borderRadius: {
    button: "0.5rem",
    card: "1rem",
  },
} as const

export type DesignTokens = typeof designTokens
