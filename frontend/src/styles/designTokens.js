/**
 * Kvitt Web - Liquid Glass Design Tokens
 *
 * Ported from mobile/src/styles/liquidGlass.ts for web consistency.
 * These tokens drive the GlassTile component and dashboard-lab page.
 */

// ===========================================
// COLOR PALETTE
// ===========================================

export const COLORS = {
  // Base
  jetDark: "#282B2B",
  jetSurface: "#323535",
  charcoal: "#1a1a1a",
  deepBlack: "#0a0a0a",
  cream: "#F5F3EF",
  white: "#FFFFFF",

  // Brand
  orange: "#EE6C29",
  orangeDark: "#C45A22",
  trustBlue: "#3B82F6",
  moonstone: "#7AA6B3",

  // Glass (dark theme)
  glass: {
    bg: "rgba(255, 255, 255, 0.06)",
    bgHover: "rgba(255, 255, 255, 0.10)",
    border: "rgba(255, 255, 255, 0.12)",
    borderHover: "rgba(255, 255, 255, 0.18)",
    inner: "rgba(255, 255, 255, 0.03)",
    highlight: "rgba(255, 255, 255, 0.08)",
  },

  // Glass (light theme)
  glassLight: {
    bg: "rgba(255, 255, 255, 0.60)",
    bgHover: "rgba(255, 255, 255, 0.75)",
    border: "rgba(0, 0, 0, 0.08)",
    borderHover: "rgba(0, 0, 0, 0.12)",
    inner: "rgba(255, 255, 255, 0.40)",
    highlight: "rgba(255, 255, 255, 0.90)",
  },

  // Glow tints
  glow: {
    purple: "rgba(168, 85, 247, 0.15)",
    mint: "rgba(34, 197, 94, 0.15)",
    amber: "rgba(245, 158, 11, 0.15)",
    rose: "rgba(244, 63, 94, 0.15)",
    slate: "rgba(148, 163, 184, 0.10)",
    orange: "rgba(238, 108, 41, 0.15)",
    blue: "rgba(59, 130, 246, 0.15)",
  },

  // Gradients (CSS strings)
  gradient: {
    purple: "linear-gradient(135deg, rgba(168, 85, 247, 0.15), rgba(99, 102, 241, 0.08))",
    mint: "linear-gradient(135deg, rgba(34, 197, 94, 0.15), rgba(16, 185, 129, 0.08))",
    amber: "linear-gradient(135deg, rgba(245, 158, 11, 0.15), rgba(234, 88, 12, 0.08))",
    rose: "linear-gradient(135deg, rgba(244, 63, 94, 0.15), rgba(236, 72, 153, 0.08))",
    slate: "linear-gradient(135deg, rgba(148, 163, 184, 0.08), rgba(100, 116, 139, 0.04))",
    orange: "linear-gradient(135deg, rgba(238, 108, 41, 0.15), rgba(249, 115, 22, 0.08))",
    blue: "linear-gradient(135deg, rgba(59, 130, 246, 0.15), rgba(96, 165, 250, 0.08))",
    hero: "linear-gradient(135deg, rgba(238, 108, 41, 0.12), rgba(168, 85, 247, 0.08), rgba(59, 130, 246, 0.06))",
  },

  // Text
  text: {
    primary: "#F5F5F5",
    secondary: "#B8B8B8",
    muted: "#8E8E8E",
    inverse: "#1a1a1a",
  },

  textLight: {
    primary: "#1a1a1a",
    secondary: "#525252",
    muted: "#737373",
    inverse: "#F5F5F5",
  },

  // Status
  status: {
    success: "#22C55E",
    danger: "#EF4444",
    warning: "#F59E0B",
    info: "#3B82F6",
  },
};

// ===========================================
// TYPOGRAPHY
// ===========================================

export const TYPOGRAPHY = {
  sizes: {
    heroTitle: 28,
    sectionTitle: 20,
    body: 16,
    small: 14,
    button: 16,
    caption: 12,
    micro: 11,
  },
  weights: {
    regular: 400,
    medium: 500,
    semiBold: 600,
    bold: 700,
    extraBold: 800,
  },
  lineHeights: {
    tight: 1.2,
    normal: 1.4,
    relaxed: 1.6,
  },
};

// ===========================================
// SPACING
// ===========================================

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

// ===========================================
// RADIUS (Tiered system)
// ===========================================

export const RADIUS = {
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  full: 9999,
};

// Tile-specific radius + padding rules
export const TILE_CONFIG = {
  sm: { radius: 12, padding: 12 },
  md: { radius: 16, padding: 16 },
  lg: { radius: 20, padding: 20 },
  hero: { radius: 24, padding: 24 },
};

// ===========================================
// GLASS EFFECT CONFIGS
// ===========================================

export const GLASS = {
  blur: 20,
  noise: 0.03,       // opacity of noise overlay
  highlight: 0.08,   // top highlight line opacity
  shadow: "0 8px 32px rgba(0, 0, 0, 0.12)",
  shadowElevated: "0 16px 48px rgba(0, 0, 0, 0.20)",
};

// ===========================================
// ANIMATION
// ===========================================

export const ANIMATION = {
  fast: "150ms",
  normal: "250ms",
  slow: "400ms",
  spring: "cubic-bezier(0.16, 1, 0.3, 1)",
  ease: "cubic-bezier(0.4, 0, 0.2, 1)",
};
