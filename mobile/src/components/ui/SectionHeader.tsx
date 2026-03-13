import React from "react";
import { StyleProp, TextStyle } from "react-native";
import { AppText } from "./AppText";

interface SectionHeaderProps {
  title: string;
  color?: string;
  style?: StyleProp<TextStyle>;
}

/**
 * SectionHeader — Locked pattern: 12px/600/uppercase/letterSpacing:1.
 * Use ONLY for section dividers and overlines.
 */
export function SectionHeader({ title, color, style }: SectionHeaderProps) {
  return (
    <AppText variant="sectionLabel" color={color} style={style}>
      {title}
    </AppText>
  );
}
