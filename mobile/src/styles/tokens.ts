/**
 * Kvitt Mobile — Canonical Design Tokens
 *
 * Single source of truth for typography, spacing, radius, sizing, and action colors.
 * All UI components and screens must reference these tokens.
 *
 * Apple HIG alignment (defaults):
 * - Body / list text: `APPLE_TYPO` + `Typography` components (`Body` = 17pt).
 * - Minimum tap targets: `LAYOUT.touchTarget` (44). If the visible control is smaller,
 *   use `hitSlopExpandToMinSize(widthOrHeight)` so the interactive area still meets 44×44 pt.
 * - Primary buttons: prefer `BUTTON_SIZE` heights (44 / 52 / 56).
 *
 * Screen title typography (do not mix arbitrarily):
 * - **Main tab roots** (Chats, Groups, full-width chrome): use `Typography` **`Title1`** (`APPLE_TYPO.title1`, 28pt) — large title row.
 * - **Modal / bottom-sheet stacks** using `PageHeader`: prefer **`titleVariant="prominent"`** — `PAGE_HEADER_PROMINENT_TITLE` (`FONT.h2`, 24pt bold), same as Voice Commands.
 * - **`PageHeader` `titleVariant="default"`** (or omit): **`Headline`** (17pt semibold) — iOS nav-bar title size.
 *
 * Legacy `FONT` scale remains for gradual migration; prefer `APPLE_TYPO` for new UI.
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

/** Voice Commands sheet / `PageHeader` prominent title — keep in sync with Settings voice modal. */
export const PAGE_HEADER_PROMINENT_TITLE = FONT.h2;

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

/** Uppercase section labels (`Label`); keep in sync with `Typography` `Label`. */
export const SECTION_LABEL_LETTER_SPACING = 1;

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
  /** Apple HIG: minimum 44×44 pt for interactive controls (tap targets). */
  touchTarget: 44,
  /** GameThreadChat: game meta strip above messages (keeps chat affordance visible). */
  gameThreadContextMaxHeight: 248,
} as const;

/**
 * Apple HIG — minimum tap targets and hitSlop helpers.
 * @see https://developer.apple.com/design/human-interface-guidelines/accessibility
 */
export function hitSlopExpandToMinSize(
  visualSize: number,
  minSize: number = LAYOUT.touchTarget
): { top: number; bottom: number; left: number; right: number } {
  const pad = Math.max(0, (minSize - visualSize) / 2);
  return { top: pad, bottom: pad, left: pad, right: pad };
}

// ===========================================
// BORDER RADIUS
// ===========================================

export const RADIUS = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  /** Bottom sheet / Settings voice modal top corners — keep in sync with SettingsScreen voice sheet */
  sheet: 32,
  full: 9999,
} as const;

// ===========================================
// CIRCULAR ICON WELLS (metrics, rows, lists)
// ===========================================

/**
 * Circular icon containers — outer/inner diameters and ring padding.
 * Use `borderRadius: diameter / 2` for circles. Pair with theme surfaces and `COLORS.glass.*` tints (no new palette).
 */
export const ICON_WELL = {
  /** Live games hero — double ring (outer pad + inner disc) */
  hero: { outer: 88, inner: 78, ringPadding: SPACE.xs },
  /** Larger hero ring (e.g. Wallet gradient card) — same structure, bigger silhouette */
  /** outer 104 − 2×pad 8 − border ≈ 86 inner (same ring math as `hero`) */
  heroXl: { outer: 104, inner: 86, ringPadding: SPACE.sm },
  /** Tri-card metric row — double ring */
  tri: { outer: 44, inner: 38, ringPadding: 3 },
  /** AI bar / compact row — double ring (replaces rounded-square icon boxes) */
  row: { outer: 44, inner: 38, ringPadding: 3 },
  /** Upcoming card — single disc */
  upcoming: { diameter: 48 },
} as const;

// ===========================================
// BILLING SCREEN (canonical layout + chrome)
// ===========================================

/**
 * Billing stack screen — spacing, hit areas, and radii.
 * Icon wells use the same double-ring model as Dashboard V3 / `ICON_WELL`: outer rim + `ringPadding` + inner disc.
 */
export const BILLING_PAGE = {
  padH: LAYOUT.screenPadding,
  gapAfterBanner: SPACE.lg,
  gapBetweenSections: SPACE.xl,
  card: {
    radius: RADIUS.lg,
    borderWidth: 1,
    padding: LAYOUT.cardPadding,
  },
  /** Double-ring icon wells — `outer` = inner + 2×ringPadding (+ hairline border in UI) */
  banner: {
    outer: 44,
    inner: 38,
    ringPadding: ICON_WELL.tri.ringPadding,
  },
  plan: {
    outer: 52,
    inner: 46,
    ringPadding: ICON_WELL.tri.ringPadding,
  },
  menu: {
    outer: 36,
    inner: 30,
    ringPadding: ICON_WELL.tri.ringPadding,
    rowMinHeight: 52,
  },
  pill: {
    radius: RADIUS.full,
    padH: SPACE.sm,
    padV: 3,
  },
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
