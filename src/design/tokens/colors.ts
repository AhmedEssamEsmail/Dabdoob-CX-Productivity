/**
 * Color tokens from the original CX Helm Productivity system
 * Extracted from original_deprecated/index.html CSS variables
 */

export const colors = {
  // Background colors
  background: {
    primary: '#f2f5f4',
    blueGradient: '#cfe4ff',
    pinkGradient: '#fbd9e8',
    dark: '#131b1d',
  },

  // Text colors
  text: {
    primary: '#4d5d63',
    darkMode: '#a9b8b5',
  },

  // Status colors
  status: {
    neutral: {
      fg: '#46546a',
      bg: '#e6eaf1',
      edge: '#8a96a8',
    },
    info: {
      fg: '#0f5a96',
      bg: '#e3eefa',
      edge: '#176aaa',
    },
    success: {
      fg: '#17744a',
      bg: '#e4f4ec',
      edge: '#2e9a69',
    },
    warning: {
      fg: '#7d5000',
      bg: '#fdf0d6',
      edge: '#c68a1a',
    },
    error: {
      fg: '#b3261e',
      bg: '#fbe9e7',
      edge: '#d9483f',
    },
  },

  // Accent colors (pine green tones)
  accent: {
    primary: '#2d5a4d', // --pine-2
    hover: '#1e4238', // --pine
    ink: '#ffffff',
    soft: 'rgba(45, 90, 77, 0.12)',
  },

  // Focus ring
  focus: '#0066cc',

  // Dark mode specific
  darkMode: {
    background: '#131b1d',
    text: '#a9b8b5',
    skeleton: '#22324d',
  },
} as const

export type Colors = typeof colors
