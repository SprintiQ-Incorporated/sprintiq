/**
 * SprintIQ Dark Theme Design System
 * TypeScript design tokens for consistent dark theme UI/UX
 */

// ===================================
// COLOR PALETTE
// ===================================

export const colors = {
  // Background colors (slate scale)
  background: {
    primary: '#020617',    // slate-950 - main app background
    secondary: '#0f172a',  // slate-900 - elevated surfaces
    tertiary: '#1e293b',   // slate-800 - cards, panels
    elevated: '#334155',   // slate-700 - hover states, borders
  },

  // Card colors
  card: {
    DEFAULT: '#0f172a',    // slate-900
    hover: '#1e293b',      // slate-800
    active: '#334155',     // slate-700
    border: '#334155',     // slate-700
  },

  // Primary accent (emerald)
  primary: {
    DEFAULT: '#10b981',    // emerald-500
    50: '#ecfdf5',
    100: '#d1fae5',
    200: '#a7f3d0',
    300: '#6ee7b7',
    400: '#34d399',
    500: '#10b981',
    600: '#059669',
    700: '#047857',
    800: '#065f46',
    900: '#064e3b',
    950: '#022c22',
  },

  // Text colors
  text: {
    primary: '#f8fafc',    // slate-50 - headings, important text
    secondary: '#94a3b8',  // slate-400 - body text, descriptions
    tertiary: '#64748b',   // slate-500 - muted text, placeholders
    inverse: '#020617',    // slate-950 - text on light backgrounds
  },

  // Semantic colors
  success: {
    DEFAULT: '#22c55e',    // green-500
    light: '#86efac',      // green-300
    dark: '#16a34a',       // green-600
    bg: 'rgba(34, 197, 94, 0.1)',
  },

  warning: {
    DEFAULT: '#f59e0b',    // amber-500
    light: '#fcd34d',      // amber-300
    dark: '#d97706',       // amber-600
    bg: 'rgba(245, 158, 11, 0.1)',
  },

  error: {
    DEFAULT: '#ef4444',    // red-500
    light: '#fca5a5',      // red-300
    dark: '#dc2626',       // red-600
    bg: 'rgba(239, 68, 68, 0.1)',
  },

  info: {
    DEFAULT: '#3b82f6',    // blue-500
    light: '#93c5fd',      // blue-300
    dark: '#2563eb',       // blue-600
    bg: 'rgba(59, 130, 246, 0.1)',
  },

  // Border colors
  border: {
    DEFAULT: '#334155',    // slate-700
    light: '#475569',      // slate-600
    dark: '#1e293b',       // slate-800
    focus: '#10b981',      // emerald-500
  },
} as const;

// ===================================
// SPACING SCALE (4px increments)
// ===================================

export const spacing = {
  px: '1px',
  0: '0px',
  0.5: '2px',
  1: '4px',
  1.5: '6px',
  2: '8px',
  2.5: '10px',
  3: '12px',
  3.5: '14px',
  4: '16px',
  5: '20px',
  6: '24px',
  7: '28px',
  8: '32px',
  9: '36px',
  10: '40px',
  11: '44px',
  12: '48px',
  14: '56px',
  16: '64px',
  20: '80px',
  24: '96px',
  28: '112px',
  32: '128px',
  36: '144px',
  40: '160px',
  44: '176px',
  48: '192px',
  52: '208px',
  56: '224px',
  60: '240px',
  64: '256px',
  72: '288px',
  80: '320px',
  96: '384px',
} as const;

// ===================================
// BORDER RADIUS TOKENS
// ===================================

export const borderRadius = {
  none: '0px',
  sm: '4px',
  DEFAULT: '8px',
  md: '8px',
  lg: '12px',
  xl: '16px',
  '2xl': '20px',
  '3xl': '24px',
  full: '9999px',
} as const;

// ===================================
// SHADOW TOKENS
// ===================================

export const shadows = {
  // Standard shadows
  none: 'none',
  xs: '0 1px 2px 0 rgba(0, 0, 0, 0.3)',
  sm: '0 1px 3px 0 rgba(0, 0, 0, 0.4), 0 1px 2px -1px rgba(0, 0, 0, 0.4)',
  DEFAULT: '0 4px 6px -1px rgba(0, 0, 0, 0.4), 0 2px 4px -2px rgba(0, 0, 0, 0.4)',
  md: '0 4px 6px -1px rgba(0, 0, 0, 0.4), 0 2px 4px -2px rgba(0, 0, 0, 0.4)',
  lg: '0 10px 15px -3px rgba(0, 0, 0, 0.4), 0 4px 6px -4px rgba(0, 0, 0, 0.4)',
  xl: '0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5)',
  '2xl': '0 25px 50px -12px rgba(0, 0, 0, 0.6)',
  inner: 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.3)',

  // Emerald glow variants for hover states
  'emerald-sm': '0 0 10px rgba(16, 185, 129, 0.3)',
  'emerald-md': '0 0 20px rgba(16, 185, 129, 0.4)',
  'emerald-lg': '0 0 30px rgba(16, 185, 129, 0.5)',
  'emerald-xl': '0 0 40px rgba(16, 185, 129, 0.6)',

  // Combined shadows with emerald glow
  'card-hover': '0 10px 15px -3px rgba(0, 0, 0, 0.4), 0 4px 6px -4px rgba(0, 0, 0, 0.4), 0 0 20px rgba(16, 185, 129, 0.2)',
  'button-hover': '0 4px 6px -1px rgba(0, 0, 0, 0.4), 0 0 15px rgba(16, 185, 129, 0.4)',
  'input-focus': '0 0 0 3px rgba(16, 185, 129, 0.3)',
} as const;

// ===================================
// GRADIENTS
// ===================================

export const gradients = {
  // Primary gradients
  primary: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
  primaryHover: 'linear-gradient(135deg, #34d399 0%, #10b981 100%)',

  // Background gradients
  darkRadial: 'radial-gradient(ellipse at top, #1e293b 0%, #020617 100%)',
  darkSubtle: 'linear-gradient(180deg, #0f172a 0%, #020617 100%)',

  // Accent gradients
  emeraldGlow: 'linear-gradient(135deg, rgba(16, 185, 129, 0.2) 0%, rgba(16, 185, 129, 0) 100%)',

  // Card gradients
  cardHover: 'linear-gradient(135deg, rgba(16, 185, 129, 0.05) 0%, transparent 100%)',
} as const;

// ===================================
// TYPOGRAPHY
// ===================================

export const typography = {
  fontFamily: {
    sans: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', 'sans-serif'],
    mono: ['Menlo', 'Monaco', 'Consolas', 'Liberation Mono', 'Courier New', 'monospace'],
  },
  fontSize: {
    xs: ['11px', { lineHeight: '1.5' }],
    sm: ['13px', { lineHeight: '1.5' }],
    base: ['14px', { lineHeight: '1.5' }],
    md: ['15px', { lineHeight: '1.5' }],
    lg: ['16px', { lineHeight: '1.5' }],
    xl: ['20px', { lineHeight: '1.4' }],
    '2xl': ['24px', { lineHeight: '1.3' }],
    '3xl': ['30px', { lineHeight: '1.2' }],
    '4xl': ['36px', { lineHeight: '1.2' }],
    '5xl': ['48px', { lineHeight: '1.1' }],
  },
  fontWeight: {
    light: '300',
    normal: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
    extrabold: '800',
  },
} as const;

// ===================================
// TRANSITIONS
// ===================================

export const transitions = {
  fast: '150ms ease',
  base: '200ms ease',
  slow: '300ms ease',
  slower: '500ms ease',
} as const;

// ===================================
// Z-INDEX LAYERS
// ===================================

export const zIndex = {
  dropdown: '1000',
  sticky: '1020',
  fixed: '1030',
  modalBackdrop: '1040',
  modal: '1050',
  popover: '1060',
  tooltip: '1070',
} as const;

// ===================================
// LAYOUT
// ===================================

export const layout = {
  sidebarWidth: '260px',
  sidebarCollapsedWidth: '64px',
  headerHeight: '64px',
  maxContentWidth: '1280px',
} as const;

// ===================================
// TAILWIND EXTEND CONFIG
// ===================================

export const tailwindExtend = {
  colors: {
    // Dark theme backgrounds
    'dark-bg': colors.background.primary,
    'dark-surface': colors.background.secondary,
    'dark-card': colors.background.tertiary,
    'dark-elevated': colors.background.elevated,

    // Card variants
    card: {
      DEFAULT: colors.card.DEFAULT,
      hover: colors.card.hover,
      active: colors.card.active,
      border: colors.card.border,
    },

    // Primary accent
    primary: colors.primary,

    // Text colors
    'text-primary': colors.text.primary,
    'text-secondary': colors.text.secondary,
    'text-tertiary': colors.text.tertiary,

    // Semantic colors
    success: colors.success,
    warning: colors.warning,
    error: colors.error,
    info: colors.info,

    // Border colors
    'border-dark': colors.border,
  },

  spacing,

  borderRadius,

  boxShadow: shadows,

  backgroundImage: gradients,
} as const;

// Default export for easy importing
export default {
  colors,
  spacing,
  borderRadius,
  shadows,
  gradients,
  typography,
  transitions,
  zIndex,
  layout,
  tailwindExtend,
};
