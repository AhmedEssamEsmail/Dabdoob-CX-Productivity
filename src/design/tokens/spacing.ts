/**
 * Spacing tokens from the original CX Helm Productivity system
 * Extracted from original_deprecated/index.html CSS variables
 */

export const spacing = {
  // Base spacing units (rem to px: 1rem = 16px)
  '1': '0.25rem', // 4px
  '2': '0.5rem', // 8px
  '3': '0.75rem', // 12px
  '4': '1rem', // 16px
  '5': '1.5rem', // 24px
  '6': '2rem', // 32px
  '7': '3rem', // 48px
  '8': '4rem', // 64px

  // Special spacing values
  gutter: '1rem', // 16px
  target: '2.75rem', // 44px - touch target size
} as const

export type Spacing = typeof spacing
