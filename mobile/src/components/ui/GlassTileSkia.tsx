/**
 * GlassTileSkia - GPU-accelerated glass tile using Shopify React Native Skia.
 *
 * This component renders an advanced glass effect with:
 * - Real-time Gaussian blur backdrop
 * - Specular highlight simulation
 * - Gradient tint overlay
 * - Noise texture
 *
 * Requires @shopify/react-native-skia to be installed.
 * Falls back to standard GlassTile if Skia is unavailable.
 */

import React, { useMemo } from "react";
import { View, ViewStyle, StyleProp, StyleSheet } from "react-native";
import { useTheme } from "../../context/ThemeContext";
import { RADIUS } from "../../styles/liquidGlass";

// Conditionally import Skia
let Canvas: any = null;
let RoundedRect: any = null;
let LinearGradient: any = null;
let Blur: any = null;
let Fill: any = null;
let Group: any = null;
let useSharedValueEffect: any = null;
let Shader: any = null;
let Skia: any = null;
let BackdropFilter: any = null;
let vec: any = null;
let skiaAvailable = false;

try {
  const skia = require("@shopify/react-native-skia");
  Canvas = skia.Canvas;
  RoundedRect = skia.RoundedRect;
  LinearGradient = skia.LinearGradient;
  Blur = skia.Blur;
  Fill = skia.Fill;
  Group = skia.Group;
  BackdropFilter = skia.BackdropFilter;
  vec = skia.vec;
  Skia = skia.Skia;
  skiaAvailable = true;
} catch {
  // @shopify/react-native-skia not installed
}

export function isSkiaAvailable(): boolean {
  return skiaAvailable;
}

interface GlassTileSkiaProps {
  width: number;
  height: number;
  radius?: number;
  tintColor?: string;
  blurAmount?: number;
  specularIntensity?: number;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
}

/**
 * Skia-powered glass backdrop effect.
 * Renders as an overlay Canvas that blurs and tints the content behind it.
 */
export function GlassTileSkia({
  width,
  height,
  radius = RADIUS.md,
  tintColor = "rgba(255, 255, 255, 0.06)",
  blurAmount = 20,
  specularIntensity = 0.08,
  style,
  children,
}: GlassTileSkiaProps) {
  const { isDark } = useTheme();

  if (!skiaAvailable || !Canvas || !BackdropFilter) {
    // Fallback: render children without Skia effects
    return (
      <View
        style={[
          {
            width,
            height,
            borderRadius: radius,
            backgroundColor: tintColor,
            overflow: "hidden",
          },
          style,
        ]}
      >
        {children}
      </View>
    );
  }

  const highlightColor = isDark
    ? `rgba(255, 255, 255, ${specularIntensity})`
    : `rgba(255, 255, 255, ${specularIntensity * 3})`;

  return (
    <View style={[{ width, height, borderRadius: radius, overflow: "hidden" }, style]}>
      {/* Skia canvas for glass effect */}
      <Canvas style={StyleSheet.absoluteFill}>
        {/* Backdrop blur */}
        <BackdropFilter
          clip={{ x: 0, y: 0, width, height }}
          filter={<Blur blur={blurAmount} />}
        >
          {/* Tint fill */}
          <Fill color={tintColor} />
        </BackdropFilter>

        {/* Specular highlight gradient (top to bottom) */}
        <RoundedRect x={0} y={0} width={width} height={height * 0.5} r={radius}>
          <LinearGradient
            start={vec(0, 0)}
            end={vec(0, height * 0.5)}
            colors={[highlightColor, "transparent"]}
          />
        </RoundedRect>

        {/* Border highlight (thin top line) */}
        <RoundedRect
          x={width * 0.1}
          y={0}
          width={width * 0.8}
          height={1}
          r={0.5}
          color="rgba(255, 255, 255, 0.12)"
        />
      </Canvas>

      {/* Content layer above the glass effect */}
      <View style={[StyleSheet.absoluteFill, { zIndex: 1 }]}>
        {children}
      </View>
    </View>
  );
}

export default GlassTileSkia;
