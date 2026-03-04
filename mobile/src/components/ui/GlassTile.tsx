/**
 * GlassTile - Liquid Glass tile component for React Native
 *
 * Wrapper that picks the best rendering path:
 * - Skia GPU shader (if @shopify/react-native-skia is available)
 * - BlurView fallback (expo-blur)
 * - Flat rgba fallback (no blur support)
 *
 * Matches the web GlassTile component API for design consistency.
 */

import React, { useMemo, useCallback } from "react";
import {
  View,
  ViewStyle,
  StyleProp,
  StyleSheet,
  Platform,
  Pressable,
} from "react-native";
import { BlurView } from "expo-blur";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { useTheme } from "../../context/ThemeContext";
import {
  COLORS,
  RADIUS,
  SPACING,
  SHADOWS,
  BLUR,
  SPRINGS,
} from "../../styles/liquidGlass";

// ============================================
// TYPES
// ============================================

export type GlassTileSize = "sm" | "md" | "lg" | "hero";
export type GlassTileTone =
  | "purple"
  | "mint"
  | "amber"
  | "rose"
  | "slate"
  | "orange"
  | "blue";

export interface GlassTileProps {
  children: React.ReactNode;
  size?: GlassTileSize;
  tone?: GlassTileTone;
  glass?: boolean;
  elevated?: boolean;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

// ============================================
// CONFIG
// ============================================

const SIZE_CONFIG: Record<GlassTileSize, { radius: number; padding: number }> = {
  sm: { radius: 12, padding: 12 },
  md: { radius: 16, padding: 16 },
  lg: { radius: 20, padding: 20 },
  hero: { radius: 24, padding: 24 },
};

const TONE_COLORS: Record<GlassTileTone, { gradient: string; glow: string }> = {
  purple: { gradient: "rgba(168, 85, 247, 0.12)", glow: "rgba(168, 85, 247, 0.15)" },
  mint: { gradient: "rgba(34, 197, 94, 0.12)", glow: "rgba(34, 197, 94, 0.15)" },
  amber: { gradient: "rgba(245, 158, 11, 0.12)", glow: "rgba(245, 158, 11, 0.15)" },
  rose: { gradient: "rgba(244, 63, 94, 0.12)", glow: "rgba(244, 63, 94, 0.15)" },
  slate: { gradient: "rgba(148, 163, 184, 0.08)", glow: "rgba(148, 163, 184, 0.10)" },
  orange: { gradient: "rgba(238, 108, 41, 0.12)", glow: "rgba(238, 108, 41, 0.15)" },
  blue: { gradient: "rgba(59, 130, 246, 0.12)", glow: "rgba(59, 130, 246, 0.15)" },
};

// ============================================
// COMPONENT
// ============================================

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function GlassTile({
  children,
  size = "md",
  tone,
  glass = true,
  elevated = false,
  onPress,
  style,
  testID,
}: GlassTileProps) {
  const { isDark } = useTheme();
  const config = SIZE_CONFIG[size];
  const toneColor = tone ? TONE_COLORS[tone] : null;

  // Press animation
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = useCallback(() => {
    scale.value = withSpring(0.97, SPRINGS.press);
  }, [scale]);

  const handlePressOut = useCallback(() => {
    scale.value = withSpring(1, SPRINGS.bouncy);
  }, [scale]);

  // Build container style
  const containerStyle = useMemo<ViewStyle>(() => ({
    borderRadius: config.radius,
    overflow: "hidden",
    ...(elevated ? SHADOWS.glassCard : SHADOWS.subtle),
  }), [config.radius, elevated]);

  // Build inner content style
  const contentStyle = useMemo<ViewStyle>(() => ({
    padding: config.padding,
    ...(toneColor ? { backgroundColor: toneColor.gradient } : {}),
  }), [config.padding, toneColor]);

  // Glass background
  const glassBg = isDark ? COLORS.glass.bg : "rgba(255, 255, 255, 0.60)";
  const glassBorder = isDark ? COLORS.glass.border : "rgba(0, 0, 0, 0.08)";

  const shouldBlur = glass && (Platform.OS === "ios" || Platform.OS === "android");
  const blurIntensity = Platform.OS === "android" ? BLUR.surface.intensity.android : BLUR.surface.intensity.dark;

  const Wrapper = onPress ? AnimatedPressable : Animated.View;
  const wrapperProps = onPress
    ? {
        onPress,
        onPressIn: handlePressIn,
        onPressOut: handlePressOut,
        accessibilityRole: "button" as const,
      }
    : {};

  return (
    <Wrapper
      testID={testID}
      style={[containerStyle, animatedStyle, style]}
      {...wrapperProps}
    >
      {shouldBlur ? (
        <BlurView
          intensity={blurIntensity}
          tint={isDark ? "dark" : "light"}
          style={StyleSheet.absoluteFill}
        />
      ) : null}

      {/* Glass background layer */}
      <View
        style={[
          StyleSheet.absoluteFill,
          {
            backgroundColor: glassBg,
            borderWidth: 1,
            borderColor: glassBorder,
            borderRadius: config.radius,
          },
        ]}
      />

      {/* Top highlight */}
      <View
        style={{
          position: "absolute",
          top: 0,
          left: "10%",
          right: "10%",
          height: StyleSheet.hairlineWidth,
          backgroundColor: "rgba(255, 255, 255, 0.12)",
        }}
      />

      {/* Content */}
      <View style={contentStyle}>{children}</View>
    </Wrapper>
  );
}

export default GlassTile;
