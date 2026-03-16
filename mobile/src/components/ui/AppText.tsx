import React from "react";
import { Text, TextProps, TextStyle } from "react-native";
import { FONT } from "../../styles/tokens";
import { useTheme } from "../../context/ThemeContext";

export type TextVariant =
  | "display"
  | "h1"
  | "h2"
  | "h3"
  | "title"
  | "body"
  | "secondary"
  | "caption"
  // Legacy aliases (mapped to canonical names)
  | "screenTitle"
  | "navTitle"
  | "cardTitle"
  | "bodyStrong"
  | "sectionLabel"
  | "meta"
  | "micro";

/** Map legacy variant names to canonical FONT keys */
const VARIANT_MAP: Record<string, keyof typeof FONT> = {
  screenTitle: "h2",
  navTitle: "title",
  cardTitle: "title",
  bodyStrong: "body",
  sectionLabel: "caption",
  meta: "caption",
  micro: "caption",
};

/** Variants that default to textSecondary */
const SECONDARY_VARIANTS = new Set(["secondary"]);
/** Variants that default to textMuted */
const MUTED_VARIANTS = new Set(["caption", "sectionLabel", "meta", "micro"]);

interface AppTextProps extends TextProps {
  variant?: TextVariant;
  color?: string;
}

/**
 * AppText — Semantic text component backed by the canonical FONT tokens.
 *
 * Each variant gets a default theme-aware color:
 * - display/h1/h2/h3/title/body → textPrimary
 * - secondary → textSecondary
 * - caption/sectionLabel/meta/micro → textMuted
 *
 * Override with the `color` prop.
 */
export function AppText({
  variant = "body",
  color,
  style,
  ...props
}: AppTextProps) {
  const { colors } = useTheme();

  // Resolve legacy names to canonical font key
  const fontKey = (VARIANT_MAP[variant] ?? variant) as keyof typeof FONT;
  const token = FONT[fontKey] ?? FONT.body;

  // Use the original FONT entry for legacy variants that have different weight
  const legacyToken = FONT[variant as keyof typeof FONT];
  const resolvedWeight = legacyToken ? legacyToken.weight : token.weight;

  // Default color by variant
  const defaultColor = SECONDARY_VARIANTS.has(variant)
    ? colors.textSecondary
    : MUTED_VARIANTS.has(variant)
      ? colors.textMuted
      : colors.textPrimary;

  const baseStyle: TextStyle = {
    fontSize: token.size,
    fontWeight: resolvedWeight,
    color: color ?? defaultColor,
  };

  // sectionLabel gets uppercase + letter spacing
  if (variant === "sectionLabel") {
    baseStyle.textTransform = "uppercase";
    baseStyle.letterSpacing = 1;
  }

  return <Text style={[baseStyle, style]} {...props} />;
}
