/**
 * Apple HIG Typography — Semantic text components with theme-aware colors.
 *
 * Use for page headers, section titles, body text, etc. Auto-applies theme colors.
 * Override with the `color` prop. Supports `bold` where applicable.
 */
import React from "react";
import { Text, TextProps, TextStyle } from "react-native";
import { APPLE_TYPO } from "../../styles/tokens";
import { useTheme } from "../../context/ThemeContext";

type TypographyBaseProps = TextProps & {
  color?: string;
};

type BoldableProps = TypographyBaseProps & {
  bold?: boolean;
};

function createTypographyComponent(
  token: { size: number; weight: string },
  defaultColorKey: "textPrimary" | "textSecondary" | "textMuted"
) {
  return function TypographyComponent({
    color,
    style,
    ...props
  }: TypographyBaseProps) {
    const { colors } = useTheme();
    const resolvedColor = color ?? colors[defaultColorKey];
    return (
      <Text
        style={[
          { fontSize: token.size, fontWeight: token.weight as TextStyle["fontWeight"], color: resolvedColor },
          style,
        ]}
        {...props}
      />
    );
  };
}

function createBoldableTypographyComponent(
  token: { size: number; weight: string },
  boldToken: { size: number; weight: string },
  defaultColorKey: "textPrimary" | "textSecondary" | "textMuted"
) {
  return function TypographyComponent({ color, bold, style, ...props }: BoldableProps) {
    const { colors } = useTheme();
    const resolvedColor = color ?? colors[defaultColorKey];
    const t = bold ? boldToken : token;
    return (
      <Text
        style={[
          { fontSize: t.size, fontWeight: t.weight as TextStyle["fontWeight"], color: resolvedColor },
          style,
        ]}
        {...props}
      />
    );
  };
}

// Page / section headers — textPrimary
export const LargeTitle = createTypographyComponent(APPLE_TYPO.largeTitle, "textPrimary");
export const Title1 = createTypographyComponent(APPLE_TYPO.title1, "textPrimary");
export const Title2 = createTypographyComponent(APPLE_TYPO.title2, "textPrimary");
export const Title3 = createTypographyComponent(APPLE_TYPO.title3, "textPrimary");

// Emphasized content — textPrimary
export const Headline = createTypographyComponent(APPLE_TYPO.headline, "textPrimary");

// Body with optional bold — textPrimary
export const Body = createBoldableTypographyComponent(
  APPLE_TYPO.body,
  { size: 17, weight: "600" },
  "textPrimary"
);

// Descriptions — textSecondary by default
export const Subhead = createBoldableTypographyComponent(
  APPLE_TYPO.subhead,
  { size: 15, weight: "600" },
  "textSecondary"
);

// Timestamps, hints — textMuted
export const Footnote = createBoldableTypographyComponent(
  APPLE_TYPO.footnote,
  { size: 13, weight: "600" },
  "textMuted"
);

// Badges, labels — textMuted
export const Caption = createTypographyComponent(APPLE_TYPO.caption, "textMuted");

// Tab label — textMuted
export const Caption2 = createTypographyComponent(APPLE_TYPO.caption2, "textMuted");

// Section header — 12pt Medium + UPPERCASE
export function Label({ color, style, ...props }: TypographyBaseProps) {
  const { colors } = useTheme();
  const resolvedColor = color ?? colors.textMuted;
  return (
    <Text
      style={[
        {
          fontSize: APPLE_TYPO.label.size,
          fontWeight: APPLE_TYPO.label.weight as TextStyle["fontWeight"],
          color: resolvedColor,
          textTransform: "uppercase",
          letterSpacing: 1,
        },
        style,
      ]}
      {...props}
    />
  );
}
