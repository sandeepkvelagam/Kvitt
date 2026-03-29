import React from "react";
import { View, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

const GRADIENT_FAB = ["#FF8C42", "#EE6C29", "#C45A22"] as const;
const GRADIENT_MESSAGING = ["#FF8C42", "#FF6EA8", "#EE6C29"] as const;

export type KvittOrbVariant = "fab" | "messaging";

export type KvittOrbMarkProps = {
  size?: number;
  variant?: KvittOrbVariant;
};

/**
 * Kvitt brand orb: orange gradient, top-left specular highlight, two white diamond “stars” bottom-right.
 */
export function KvittOrbMark({ size = 38, variant = "fab" }: KvittOrbMarkProps) {
  const colors = variant === "messaging" ? [...GRADIENT_MESSAGING] : [...GRADIENT_FAB];
  const s = size;
  const eyeSize = Math.max(3, Math.round((s * 4) / 38));
  const showEyes = s >= 22;

  const highlightSize = Math.max(6, (s * 12) / 38);
  const highlightTop = (s * 4) / 38;
  const highlightLeft = (s * 6) / 38;

  /** Twin diamonds along bottom edge, toward bottom-right (mirrors legacy left-edge spacing: right 8 and 16 @ 38px). */
  const eyeBottom = (s * 10) / 38;
  const eyeRightOuter = (s * 8) / 38;
  const eyeRightInner = (s * 16) / 38;

  return (
    <View style={[styles.wrap, { width: s, height: s }]}>
      <LinearGradient
        colors={colors}
        start={{ x: 0.3, y: 0.3 }}
        end={{ x: 0.7, y: 0.9 }}
        style={[styles.gradient, { width: s, height: s, borderRadius: s / 2 }]}
      >
        <View
          style={[
            styles.highlight,
            {
              top: highlightTop,
              left: highlightLeft,
              width: highlightSize,
              height: highlightSize,
              borderRadius: highlightSize / 2,
            },
          ]}
        />
        {showEyes && (
          <>
            <View
              style={[
                styles.eye,
                {
                  width: eyeSize,
                  height: eyeSize,
                  bottom: eyeBottom,
                  right: eyeRightInner,
                },
              ]}
            />
            <View
              style={[
                styles.eye,
                {
                  width: eyeSize,
                  height: eyeSize,
                  bottom: eyeBottom,
                  right: eyeRightOuter,
                },
              ]}
            />
          </>
        )}
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    justifyContent: "center",
  },
  gradient: {
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  highlight: {
    position: "absolute",
    backgroundColor: "rgba(255,255,255,0.25)",
    transform: [{ rotate: "-30deg" }, { scaleX: 0.8 }],
  },
  eye: {
    position: "absolute",
    backgroundColor: "#fff",
    transform: [{ rotate: "45deg" }],
  },
});
