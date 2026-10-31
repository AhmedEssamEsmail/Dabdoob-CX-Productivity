/**
 * Layout dimensions from the original CX Helm Productivity system
 * Extracted from original_deprecated/index.html CSS variables
 */

export const layout = {
  // Dimensions
  railWidth: '15rem', // 240px
  topBarHeight: '3.5rem', // 56px
} as const

export type Layout = typeof layout
