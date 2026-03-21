/**
 * Kvitt Mobile — Canonical Design Tokens
 *
 * Single source of truth for typography, spacing, radius, sizing, and action colors.
 * All UI components and screens must reference these tokens.
 *
 * Typography scale: display → h1 → h2 → h3 → title → body → secondary → caption
 */

// ===========================================
// TYPOGRAPHY
// ===========================================

export const FONT = {
  // Canonical 8-token scale
  display:   { size: 34, weight: '700' as const },
  h1:        { size: 28, weight: '700' as const },
  h2:        { size: 24, weight: '700' as const },
  h3:        { size: 20, weight: '600' as const },
  title:     { size: 18, weight: '600' as const },
  body:      { size: 16, weight: '400' as const },
  secondary: { size: 14, weight: '400' as const },
  caption:   { size: 12, weight: '400' as const },

  // Legacy aliases — use canonical names above in new code
  screenTitle:  { size: 24, weight: '700' as const },   // → h2
  navTitle:     { size: 18, weight: '600' as const },   // → title
  cardTitle:    { size: 18, weight: '500' as const },   // → title (weight differs)
  bodyStrong:   { size: 16, weight: '600' as const },   // → body + fontWeight override
  sectionLabel: { size: 12, weight: '600' as const },   // → caption + fontWeight override
  meta:         { size: 12, weight: '500' as const },   // → caption
  micro:        { size: 11, weight: '500' as const },   // → caption (deprecated size)
} as const;

/**
 * Apple HIG Typography — Semantic scale for page headers, section titles, body, etc.
 * Use with Typography components (LargeTitle, Title1, Headline, Body, etc.).
 */
export const APPLE_TYPO = {
  largeTitle: { size: 34, weight: '700' as const },
  title1:     { size: 28, weight: '700' as const },
  title2:     { size: 22, weight: '700' as const },
  title3:     { size: 20, weight: '600' as const },
  headline:   { size: 17, weight: '600' as const },
  body:       { size: 17, weight: '400' as const },
  subhead:    { size: 15, weight: '400' as const },
  footnote:   { size: 13, weight: '400' as const },
  caption:    { size: 12, weight: '400' as const },
  caption2:   { size: 11, weight: '400' as const },
  label:      { size: 12, weight: '500' as const },
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

/**
 * ACTION_COLOR — deprecated. Use colors.buttonPrimary / colors.buttonText from useTheme() instead.
 * Kept temporarily for backward compatibility during migration.
 */
export const ACTION_COLOR = {
  primary: '#111111',        // grayscale primary (light theme default)
  primaryPressed: '#000000',
  secondary: 'transparent',
  secondaryPressed: 'transparent',
  tertiary: 'transparent',
  destructive: '#FF3B30',    // semantic error
} as const;
