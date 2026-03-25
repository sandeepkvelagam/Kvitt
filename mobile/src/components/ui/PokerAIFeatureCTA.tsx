import React, { useEffect, useRef, useState } from "react";
import {
  View,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Animated,
  AccessibilityInfo,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../context/ThemeContext";
import { Subhead, Footnote } from "./Typography";
import { SPACE, RADIUS, BUTTON_SIZE, APPLE_TYPO } from "../../styles/tokens";
import { appleCardShadowResting } from "../../styles/appleShadows";

type Props = {
  onPress: () => void;
  title: string;
  subtitle: string;
  /** Defaults to diamond (Poker AI). Use e.g. sparkles-outline for Smart Flows. */
  icon?: keyof typeof Ionicons.glyphMap;
  testID?: string;
};

/**
 * Featured primary CTA — filled (buttonPrimary / buttonText) with optional soft shadow pulse.
 * Used for Poker AI on the assistant screen and matching rows elsewhere (e.g. Smart Flows).
 */
export function PokerAIFeatureCTA({ onPress, title, subtitle, icon = "diamond", testID }: Props) {
  const { colors, isDark } = useTheme();
  const shadowPulse = useRef(new Animated.Value(isDark ? 0.22 : 0.14)).current;
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((v) => {
      if (mounted) setReduceMotion(v);
    });
    const sub = AccessibilityInfo.addEventListener?.("reduceMotionChanged", (v: boolean) =>
      setReduceMotion(v)
    );
    return () => {
      mounted = false;
      sub?.remove?.();
    };
  }, []);

  useEffect(() => {
    if (reduceMotion) {
      shadowPulse.setValue(isDark ? 0.28 : 0.18);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(shadowPulse, {
          toValue: isDark ? 0.42 : 0.3,
          duration: 2200,
          useNativeDriver: false,
        }),
        Animated.timing(shadowPulse, {
          toValue: isDark ? 0.22 : 0.14,
          duration: 2200,
          useNativeDriver: false,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [reduceMotion, shadowPulse, isDark]);

  const resting = appleCardShadowResting(isDark);
  const androidElevation = typeof resting.elevation === "number" ? resting.elevation : 6;

  return (
    <Animated.View
      style={[
        styles.shadowShell,
        {
          borderRadius: RADIUS.xl + 4,
          ...(Platform.OS === "ios"
            ? {
                shadowColor: "#000000",
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: shadowPulse,
                shadowRadius: isDark ? 16 : 12,
              }
            : { elevation: androidElevation }),
        },
      ]}
    >
      <TouchableOpacity
        style={[
          styles.button,
          {
            backgroundColor: colors.buttonPrimary,
            minHeight: BUTTON_SIZE.large.height,
          },
          Platform.OS === "ios" && { borderCurve: "continuous" as const },
        ]}
        onPress={onPress}
        activeOpacity={0.88}
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={`${title}. ${subtitle}`}
      >
        <View style={styles.titleRow}>
          <Ionicons name={icon} size={22} color={colors.buttonText} />
          <Subhead style={[styles.titleText, { color: colors.buttonText }]} numberOfLines={1}>
            {title}
          </Subhead>
          <Ionicons name="chevron-forward" size={22} color={colors.buttonText} style={styles.chevron} />
        </View>
        <Footnote
          style={[styles.subtitle, { color: colors.buttonText, opacity: 0.82 }]}
          numberOfLines={3}
        >
          {subtitle}
        </Footnote>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  shadowShell: {
    alignSelf: "stretch",
    width: "100%",
    backgroundColor: "transparent",
  },
  button: {
    width: "100%",
    borderRadius: RADIUS.xl,
    paddingHorizontal: SPACE.xl,
    paddingVertical: SPACE.md,
    justifyContent: "center",
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.sm,
  },
  titleText: {
    flex: 1,
    fontWeight: "600",
    fontSize: APPLE_TYPO.body.size,
  },
  chevron: {
    marginLeft: SPACE.xs,
    opacity: 0.9,
  },
  subtitle: {
    marginTop: SPACE.xs,
    lineHeight: 18,
  },
});
