import React, { useMemo } from "react";
import { View, ViewStyle, StyleProp, StyleSheet, Platform } from "react-native";
import { BlurView } from "expo-blur";
import { COLORS, SHADOWS, BLUR, getGlowColor } from "../../styles/liquidGlass";
import { SPACE, LAYOUT, RADIUS } from "../../styles/tokens";
import { useTheme } from "../../context/ThemeContext";
import {
  LiquidGlassView,
  isNativeLiquidGlassSupported,
  GlassPresets,
} from "./LiquidGlassView";

interface GlassSurfaceProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  innerStyle?: StyleProp<ViewStyle>;
  glowVariant?: "orange" | "blue" | "green" | "red";
  noPadding?: boolean;
  noInner?: boolean;
  /** Enable real blur translucency (default: true). Set false for performance in long lists. */
  blur?: boolean;
  /** Override blur intensity (uses theme-aware defaults) */
  blurIntensity?: number;
  /** Optional color wash over the glass surface */
  tintColor?: string;
  /** Use native Liquid Glass on iOS 26+ (default: true) */
  useNativeGlass?: boolean;
}

/**
 * GlassSurface - Premium glass morphism card component
 *
 * On iOS 26+: Uses native Liquid Glass via expo-glass-effect
 * On older iOS/Android: Uses BlurView from expo-blur
 * Fallback: Flat rgba background
 */
export function GlassSurface({
  children,
  style,
  innerStyle,
  glowVariant,
  noPadding = false,
  noInner = false,
  blur = true,
  blurIntensity,
  tintColor,
  useNativeGlass = true,
}: GlassSurfaceProps) {
  const { isDark } = useTheme();
  const innerBgColor = glowVariant ? getGlowColor(glowVariant) : COLORS.glass.inner;
  
  // Check for native Liquid Glass support
  const hasNativeGlass = useMemo(() => 
    useNativeGlass && isNativeLiquidGlassSupported(), 
    [useNativeGlass]
  );

  // Determine blur config
  const shouldBlur = blur && (Platform.OS === "ios" || Platform.OS === "android");
  const intensity = blurIntensity ??
    (Platform.OS === "android"
      ? BLUR.surface.intensity.android
      : isDark
        ? BLUR.surface.intensity.dark
        : BLUR.surface.intensity.light);
  const blurTint = isDark ? BLUR.surface.tint.dark : BLUR.surface.tint.light;
  const overlayColor = tintColor ?? (isDark ? BLUR.surface.overlay.dark : BLUR.surface.overlay.light);

  // Native Liquid Glass path (iOS 26+)
  if (hasNativeGlass) {
    if (noInner) {
      return (
        <LiquidGlassView
          style={[styles.outer, style]}
          {...GlassPresets.card}
          colorScheme={isDark ? "dark" : "light"}
          tintColor={glowVariant ? getGlowColor(glowVariant) : undefined}
        >
          {children}
        </LiquidGlassView>
      );
    }

    return (
      <LiquidGlassView
        style={[styles.outer, style]}
        {...GlassPresets.card}
        colorScheme={isDark ? "dark" : "light"}
        tintColor={glowVariant ? getGlowColor(glowVariant) : undefined}
      >
        <View
          style={[
            styles.inner,
            { backgroundColor: innerBgColor },
            noPadding && { padding: 0 },
            innerStyle,
          ]}
        >
          {children}
        </View>
      </LiquidGlassView>
    );
  }

  // BlurView fallback path (iOS < 26, Android)
  if (noInner) {
    return (
      <View style={[styles.outer, shouldBlur && styles.blurOuter, style]}>
        {shouldBlur && (
          <>
            <BlurView intensity={intensity} tint={blurTint} style={StyleSheet.absoluteFill} />
            <View style={[StyleSheet.absoluteFill, { backgroundColor: overlayColor }]} />
          </>
        )}
        {children}
      </View>
    );
  }

  return (
    <View style={[styles.outer, shouldBlur && styles.blurOuter, style]}>
      {shouldBlur && (
        <>
          <BlurView intensity={intensity} tint={blurTint} style={StyleSheet.absoluteFill} />
          <View style={[StyleSheet.absoluteFill, { backgroundColor: overlayColor }]} />
        </>
      )}
      <View
        style={[
          styles.inner,
          { backgroundColor: innerBgColor },
          noPadding && { padding: 0 },
          innerStyle,
        ]}
      >
        {children}
      </View>
    </View>
  );
}

/**
 * GlassSurfaceFlat - Single layer glass surface (no inner)
 * For simpler use cases like list items
 */
export function GlassSurfaceFlat({
  children,
  style,
  blur = false,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  blur?: boolean;
}) {
  const { isDark } = useTheme();

  const shouldBlur = blur && (Platform.OS === "ios" || Platform.OS === "android");
  const intensity = Platform.OS === "android"
    ? BLUR.surface.intensity.android
    : isDark
      ? BLUR.surface.intensity.dark
      : BLUR.surface.intensity.light;
  const blurTint = isDark ? BLUR.surface.tint.dark : BLUR.surface.tint.light;
  const overlayColor = isDark ? BLUR.surface.overlay.dark : BLUR.surface.overlay.light;

  return (
    <View style={[styles.flat, shouldBlur && { overflow: "hidden" }, style]}>
      {shouldBlur && (
        <>
          <BlurView intensity={intensity} tint={blurTint} style={StyleSheet.absoluteFill} />
          <View style={[StyleSheet.absoluteFill, { backgroundColor: overlayColor }]} />
        </>
      )}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    backgroundColor: COLORS.glass.bg,
    borderColor: COLORS.glass.border,
    borderWidth: 1.5,
    borderRadius: RADIUS.xl,       // 24
    padding: 4,                     // glass card outer→inner gap
    ...SHADOWS.glassCard,
  },
  blurOuter: {
    overflow: "hidden",
    backgroundColor: "transparent",
  },
  inner: {
    backgroundColor: COLORS.glass.inner,
    borderRadius: RADIUS.lg,       // 16 (was 20)
    padding: LAYOUT.cardPadding,   // 16 (was 18)
  },
  flat: {
    backgroundColor: COLORS.glass.bg,
    borderColor: COLORS.glass.border,
    borderWidth: 1,
    borderRadius: RADIUS.lg,       // 16
    padding: SPACE.lg,             // 16
  },
});
