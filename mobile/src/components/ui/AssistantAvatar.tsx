import React, { useEffect, useRef } from "react";
import { View, StyleSheet, Animated, Platform, Easing } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../context/ThemeContext";

type AssistantAvatarProps = {
  /** Outer diameter in dp */
  size?: number;
  /** Slower scale + opacity “breathing” (welcome, typing row). */
  breathAnim?: boolean;
  /** Gentle opacity pulse only — for message rows (no scale jump). */
  subtlePulse?: boolean;
};

/**
 * Neutral, token-aware assistant mark — replaces the orange gradient orb in AI chrome.
 * Optional motion: full breath (scale + opacity), or subtle list pulse.
 */
export function AssistantAvatar({
  size = 32,
  breathAnim = true,
  subtlePulse = false,
}: AssistantAvatarProps) {
  const { colors } = useTheme();
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (breathAnim) {
      const loop = Animated.loop(
        Animated.parallel([
          Animated.sequence([
            Animated.timing(scale, {
              toValue: 1.06,
              duration: 2600,
              easing: Easing.inOut(Easing.sin),
              useNativeDriver: true,
            }),
            Animated.timing(scale, {
              toValue: 1,
              duration: 2600,
              easing: Easing.inOut(Easing.sin),
              useNativeDriver: true,
            }),
          ]),
          Animated.sequence([
            Animated.timing(opacity, {
              toValue: 0.9,
              duration: 2600,
              easing: Easing.inOut(Easing.sin),
              useNativeDriver: true,
            }),
            Animated.timing(opacity, {
              toValue: 1,
              duration: 2600,
              easing: Easing.inOut(Easing.sin),
              useNativeDriver: true,
            }),
          ]),
        ])
      );
      loop.start();
      return () => {
        loop.stop();
        scale.setValue(1);
        opacity.setValue(1);
      };
    }

    if (subtlePulse) {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(opacity, {
            toValue: 0.88,
            duration: 3200,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(opacity, {
            toValue: 1,
            duration: 3200,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
        ])
      );
      loop.start();
      return () => {
        loop.stop();
        opacity.setValue(1);
      };
    }

    return undefined;
  }, [breathAnim, subtlePulse, scale, opacity]);

  const iconSize = Math.max(14, Math.round(size * 0.36));
  const dot = Math.max(4, Math.round(size * 0.14));

  const inner = (
    <View
      style={[
        styles.disk,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: colors.inputBg,
          borderColor: colors.border,
        },
        Platform.OS === "ios" && { borderCurve: "continuous" as const },
      ]}
    >
      <View
        style={[
          styles.accentDot,
          {
            width: dot,
            height: dot,
            borderRadius: dot / 2,
            backgroundColor: colors.orange,
            top: Math.max(2, size * 0.1),
            right: Math.max(2, size * 0.1),
          },
        ]}
      />
      <Ionicons name="chatbubbles-outline" size={iconSize} color={colors.textPrimary} />
    </View>
  );

  if (!breathAnim && !subtlePulse) {
    return <View style={{ width: size, height: size }}>{inner}</View>;
  }

  return (
    <Animated.View
      style={{
        width: size,
        height: size,
        transform: breathAnim ? [{ scale }] : [],
        opacity,
      }}
    >
      {inner}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  disk: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
  accentDot: {
    position: "absolute",
    zIndex: 1,
  },
});
