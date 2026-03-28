import React from "react";
import { StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { AnimationSpec } from "expo-symbols";
import { SymbolView } from "expo-symbols";
import { iconMap, type IconName } from "./iconMap";

export type AppIconSize =
  | 10
  | 11
  | 12
  | 13
  | 14
  | 15
  | 16
  | 18
  | 20
  | 22
  | 24
  | 26
  | 28
  | 30
  | 32
  | 36
  | 40
  | 42
  | 44
  | 48
  | 56;

type AppIconProps = {
  name: IconName;
  color: string;
  /** Default 20 — matches list row / tri-well icons. */
  size?: AppIconSize;
  style?: StyleProp<ViewStyle>;
  /** iOS only — use sparingly (success/error, primary CTA), not on dense lists. */
  animationSpec?: AnimationSpec;
};

/**
 * SF Symbols on iOS (system); Ionicons on Android / web via expo-symbols fallback.
 * Do not use `SymbolView` or raw `Ionicons` in feature screens — use this or add a key to `iconMap`.
 */
export function AppIcon({ name, color, size = 20, style, animationSpec }: AppIconProps) {
  const def = iconMap[name];
  const dim = { width: size, height: size };

  return (
    <SymbolView
      name={def.ios}
      size={size}
      tintColor={color}
      animationSpec={animationSpec}
      fallback={<Ionicons name={def.ionicons} size={size} color={color} />}
      style={[styles.box, dim, style]}
    />
  );
}

const styles = StyleSheet.create({
  box: { alignItems: "center", justifyContent: "center" },
});
