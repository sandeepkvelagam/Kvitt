/**
 * Kvitt Mobile — Canonical Design Tokens
 *
 * Single source of truth for typography, spacing, radius, sizing, and action colors.
 * All UI components and screens must reference these tokens.
 *
 * Banned font sizes:  9, 10, 13, 15, 17, 19, 20, 22
 * Banned spacing:     14, 18, 22, 28
 * Banned radius:      14, 18, 20, 28, 32
 */

// ===========================================
// TYPOGRAPHY
// ===========================================

export const FONT = {
  screenTitle:  { size: 24, weight: '700' as const },
  navTitle:     { size: 18, weight: '600' as const },
  cardTitle:    { size: 18, weight: '500' as const },
  body:         { size: 16, weight: '400' as const },
  bodyStrong:   { size: 16, weight: '600' as const },
  secondary:    { size: 14, weight: '400' as const },
  sectionLabel: { size: 12, weight: '600' as const },
  meta:         { size: 12, weight: '500' as const },
  micro:        { size: 11, weight: '500' as const },
} as const;

// ===========================================
// SPACING
// ===========================================

export const SPACE = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

// ===========================================
// SEMANTIC LAYOUT
// ===========================================

export const LAYOUT = {
  screenPadding: 20,
  sectionGap: 24,
  cardPadding: 16,
  elementGap: 12,
  touchTarget: 44,
} as const;

// ===========================================
// BORDER RADIUS
// ===========================================

export const RADIUS = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
} as const;

// ===========================================
// BUTTON SIZES
// ===========================================

export const BUTTON_SIZE = {
  compact: { height: 44 },
  regular: { height: 52 },
  large:   { height: 56 },
} as const;

// ===========================================
// AVATAR SIZES
// ===========================================

export const AVATAR_SIZE = {
  xs: 24,
  sm: 32,
  md: 40,
  lg: 56,
  xl: 72,
} as const;

// ===========================================
// ACTION COLORS
// ===========================================

export const ACTION_COLOR = {
  primary: '#C45A22',        // orangeDark
  primaryPressed: '#A34B1B', // orangeDark darkened
  secondary: '#3B82F6',      // trustBlue
  secondaryPressed: '#2563EB', // trustBlue darkened
  tertiary: 'transparent',
  destructive: '#EF4444',    // status.danger
} as const;
