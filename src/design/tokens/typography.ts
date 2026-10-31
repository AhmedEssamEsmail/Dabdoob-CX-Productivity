/**
 * Typography tokens from the original CX Helm Productivity system
 * Extracted from original_deprecated/index.html CSS variables
 */

export const typography = {
  // Font families
  fontFamily: {
    sans: "'IBM Plex Sans', system-ui, sans-serif",
    arabic: "'IBM Plex Sans Arabic', sans-serif",
    mono: "'IBM Plex Mono', monospace",
  },

  // Font weights
  fontWeight: {
    regular: 400,
    medium: 500,
    strong: 600,
  },

  // Font sizes (mapped from CSS variables)
  fontSize: {
    xs: '0.75rem', // 12px
    sm: '0.875rem', // 14px
    md: '1rem', // 16px
    lg: '1.125rem', // 18px
    xl: '1.25rem', // 20px
    '2xl': '1.5rem', // 24px
    '3xl': '1.875rem', // 30px
  },

  // Line heights
  lineHeight: {
    latin: '1.45',
    latinDense: '1.3',
    arabic: '1.8',
    arabicDense: '1.6',
  },
} as const

export type Typography = typeof typography
