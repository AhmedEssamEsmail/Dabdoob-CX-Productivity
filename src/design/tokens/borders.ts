/**
 * Border radius tokens from the original CX Helm Productivity system
 * Extracted from original_deprecated/index.html CSS variables
 */

export const borders = {
  // Border radius values
  control: '6px',
  object: '10px',
  bar: '4px',
} as const

export type Borders = typeof borders
