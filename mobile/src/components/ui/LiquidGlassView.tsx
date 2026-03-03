/**
 * LiquidGlassView - Platform-aware glass effect component
 * 
 * Uses native iOS 26+ Liquid Glass when available, falls back to
 * expo-blur BlurView on older iOS and Android.
 * 
 * Based on Apple's Liquid Glass design language (WWDC 2025).
 */

import React, { useMemo } from "react";
import {
  View,
  ViewStyle,
  StyleProp,
  StyleSheet,
  Platform,
} from "react-native";
import { BlurView } from "expo-blur";

// Conditionally import expo-glass-effect (only available on iOS 26+)
let GlassView: any = null;
let GlassContainer: any = null;
let isLiquidGlassAvailable: () => boolean = () => false;
let isGlassEffectAPIAvailable: () => boolean = () => false;

try {
  const glassEffect = require("expo-glass-effect");
  GlassView = glassEffect.GlassView;
  GlassContainer = glassEffect.GlassContainer;
  isLiquidGlassAvailable = glassEffect.isLiquidGlassAvailable;
  isGlassEffectAPIAvailable = glassEffect.isGlassEffectAPIAvailable;
} catch {
  // expo-glass-effect not available (older Expo SDK or unsupported platform)
}

// ============================================
// TYPES
// ============================================

export type GlassStyle = "clear" | "regular" | "none";
export type GlassColorScheme = "auto" | "light" | "dark";

export interface LiquidGlassViewProps {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  glassStyle?: GlassStyle;
  colorScheme?: GlassColorScheme;
  isInteractive?: boolean;
  tintColor?: string;
  blurIntensity?: number;
  blurTint?: "light" | "dark" | "default";
  fallbackBackgroundColor?: string;
}

export interface LiquidGlassContainerProps {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  spacing?: number;
}

// ============================================
// HELPERS
// ============================================

/**
 * Check if native Liquid Glass is available on this device.
 */
export function isNativeLiquidGlassSupported(): boolean {
  if (Platform.OS !== "ios") return false;
  
  try {
    // Check both API availability and Liquid Glass availability
    const apiAvailable = isGlassEffectAPIAvailable?.() ?? false;
    const glassAvailable = isLiquidGlassAvailable?.() ?? false;
    return apiAvailable && glassAvailable && GlassView !== null;
  } catch {
    return false;
  }
}

/**
 * Get the current platform's glass support status.
 */
export function getGlassSupportStatus(): {
  platform: string;
  nativeGlass: boolean;
  blurFallback: boolean;
} {
  return {
    platform: Platform.OS,
    nativeGlass: isNativeLiquidGlassSupported(),
    blurFallback: Platform.OS === "ios" || Platform.OS === "android",
  };
}

// ============================================
// LIQUID GLASS VIEW
// ============================================

/**
 * LiquidGlassView - Renders native Liquid Glass on iOS 26+,
 * falls back to BlurView on older iOS/Android.
 */
export function LiquidGlassView({
  children,
  style,
  glassStyle = "regular",
  colorScheme = "auto",
  isInteractive = false,
  tintColor,
  blurIntensity = 50,
  blurTint = "dark",
  fallbackBackgroundColor = "rgba(40, 43, 43, 0.7)",
}: LiquidGlassViewProps) {
  const useNativeGlass = useMemo(() => isNativeLiquidGlassSupported(), []);
  
  // Native Liquid Glass (iOS 26+)
  if (useNativeGlass && GlassView) {
    return (
      <GlassView
        style={style}
        glassEffectStyle={glassStyle}
        colorScheme={colorScheme}
        isInteractive={isInteractive}
        tintColor={tintColor}
      >
        {children}
      </GlassView>
    );
  }
  
  // Blur fallback (iOS < 26, Android)
  if (Platform.OS === "ios" || Platform.OS === "android") {
    return (
      <View style={[styles.container, style]}>
        <BlurView
          intensity={blurIntensity}
          tint={blurTint}
          style={StyleSheet.absoluteFill}
        />
        <View
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: fallbackBackgroundColor },
          ]}
        />
        {children}
      </View>
    );
  }
  
  // Web/other fallback (solid background)
  return (
    <View style={[styles.container, { backgroundColor: fallbackBackgroundColor }, style]}>
      {children}
    </View>
  );
}

// ============================================
// LIQUID GLASS CONTAINER
// ============================================

/**
 * LiquidGlassContainer - Groups multiple glass views for combined effects.
 * Only has effect on iOS 26+ with native Liquid Glass.
 */
export function LiquidGlassContainer({
  children,
  style,
  spacing = 10,
}: LiquidGlassContainerProps) {
  const useNativeGlass = useMemo(() => isNativeLiquidGlassSupported(), []);
  
  // Native Glass Container (iOS 26+)
  if (useNativeGlass && GlassContainer) {
    return (
      <GlassContainer style={style} spacing={spacing}>
        {children}
      </GlassContainer>
    );
  }
  
  // Fallback: regular View
  return <View style={style}>{children}</View>;
}

// ============================================
// PRESETS
// ============================================

/**
 * Pre-configured glass styles for common use cases.
 */
export const GlassPresets = {
  /**
   * Card surface - subtle glass for cards and panels.
   */
  card: {
    glassStyle: "regular" as GlassStyle,
    blurIntensity: 40,
    blurTint: "dark" as const,
    fallbackBackgroundColor: "rgba(50, 53, 53, 0.85)",
  },
  
  /**
   * Modal backdrop - strong blur for modals.
   */
  modal: {
    glassStyle: "clear" as GlassStyle,
    blurIntensity: 60,
    blurTint: "dark" as const,
    fallbackBackgroundColor: "rgba(40, 43, 43, 0.92)",
  },
  
  /**
   * Header - light glass for navigation headers.
   */
  header: {
    glassStyle: "regular" as GlassStyle,
    blurIntensity: 50,
    blurTint: "dark" as const,
    fallbackBackgroundColor: "rgba(40, 43, 43, 0.8)",
  },
  
  /**
   * Popup menu - clear glass for dropdown menus.
   */
  popup: {
    glassStyle: "clear" as GlassStyle,
    blurIntensity: 80,
    blurTint: "dark" as const,
    fallbackBackgroundColor: "rgba(40, 43, 43, 0.95)",
  },
  
  /**
   * Tab bar - subtle glass for bottom navigation.
   */
  tabBar: {
    glassStyle: "regular" as GlassStyle,
    blurIntensity: 45,
    blurTint: "dark" as const,
    fallbackBackgroundColor: "rgba(40, 43, 43, 0.9)",
  },
  
  /**
   * Interactive button - glass that responds to touch.
   */
  button: {
    glassStyle: "clear" as GlassStyle,
    isInteractive: true,
    blurIntensity: 30,
    blurTint: "dark" as const,
    fallbackBackgroundColor: "rgba(255, 255, 255, 0.08)",
  },
};

// ============================================
// ANIMATED GLASS (for transitions)
// ============================================

export interface AnimatedGlassConfig {
  style: GlassStyle;
  animate: boolean;
  animationDuration: number;
}

/**
 * Create an animated glass style config for transitions.
 * Note: Only works with native Liquid Glass on iOS 26+.
 */
export function createAnimatedGlassStyle(
  visible: boolean,
  duration: number = 0.3
): AnimatedGlassConfig {
  return {
    style: visible ? "clear" : "none",
    animate: true,
    animationDuration: duration,
  };
}

// ============================================
// STYLES
// ============================================

const styles = StyleSheet.create({
  container: {
    overflow: "hidden",
  },
});

// ============================================
// EXPORTS
// ============================================

export default LiquidGlassView;
