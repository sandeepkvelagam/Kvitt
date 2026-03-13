import React from "react";
import { Text, TextProps, TextStyle } from "react-native";
import { FONT } from "../../styles/tokens";

export type TextVariant =
  | "screenTitle"
  | "navTitle"
  | "cardTitle"
  | "body"
  | "bodyStrong"
  | "secondary"
  | "sectionLabel"
  | "meta"
  | "micro";

interface AppTextProps extends TextProps {
  variant?: TextVariant;
  color?: string;
}

/**
 * AppText — Semantic text component backed by the canonical FONT tokens.
 *
 * `sectionLabel` auto-applies uppercase + letterSpacing: 1.
 */
export function AppText({
  variant = "body",
  color,
  style,
  ...props
}: AppTextProps) {
  const token = FONT[variant];

  const baseStyle: TextStyle = {
    fontSize: token.size,
    fontWeight: token.weight,
    ...(color ? { color } : undefined),
  };

  if (variant === "sectionLabel") {
    baseStyle.textTransform = "uppercase";
    baseStyle.letterSpacing = 1;
  }

  return <Text style={[baseStyle, style]} {...props} />;
}
