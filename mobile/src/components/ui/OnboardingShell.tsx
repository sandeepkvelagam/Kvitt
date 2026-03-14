import React from "react";
import { View, ScrollView, TouchableOpacity, Text, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";

/**
 * Onboarding color palette — hardcoded from Figma, NOT from useTheme().
 * The onboarding flow has its own visual language: clean black & white.
 */
const OB = {
  bg: "#FFFFFF",
  text: "#1A1A1A",
  secondary: "#666666",
  tertiary: "#999999",
  primary: "#1A1A1A",
  cardBg: "#F2F2F7",
  contentBg: "#F8F8F6",
  border: "#E8E8E8",
  progressTrack: "#E8E8E8",
  progressFill: "#1A1A1A",
  backBtnBg: "#F2F2F7",
  white: "#FFFFFF",
};

export { OB };

interface OnboardingShellProps {
  children: React.ReactNode;
  progress: number; // 0-1
  onBack?: () => void;
  ctaLabel?: string;
  onCta?: () => void;
  secondaryCta?: { label: string; onPress: () => void };
}

/**
 * OnboardingShell — Shared wrapper for onboarding screens.
 * Black & white visual language matching the Figma exactly.
 * NO Glass components, NO orange, NO theme colors.
 */
export function OnboardingShell({
  children,
  progress,
  onBack,
  ctaLabel,
  onCta,
  secondaryCta,
}: OnboardingShellProps) {
  const progressWidth = useSharedValue(progress);

  React.useEffect(() => {
    progressWidth.value = withSpring(progress, {
      damping: 14,
      stiffness: 150,
      mass: 0.6,
    });
  }, [progress]);

  const progressStyle = useAnimatedStyle(() => ({
    width: `${progressWidth.value * 100}%`,
  }));

  return (
    <SafeAreaView style={styles.container}>
      {/* Header: back button + progress bar */}
      <View style={styles.header}>
        {onBack ? (
          <TouchableOpacity
            onPress={onBack}
            style={styles.backBtn}
            activeOpacity={0.7}
          >
            <Ionicons name="chevron-back" size={20} color={OB.text} />
          </TouchableOpacity>
        ) : (
          <View style={styles.backSpacer} />
        )}
        <View style={styles.progressTrack}>
          <Animated.View style={[styles.progressFill, progressStyle]} />
        </View>
      </View>

      {/* Scrollable content */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        {children}
      </ScrollView>

      {/* Bottom CTA area */}
      {ctaLabel && onCta && (
        <View style={styles.bottom}>
          <TouchableOpacity
            onPress={onCta}
            style={styles.ctaBtn}
            activeOpacity={0.8}
          >
            <Text style={styles.ctaText}>{ctaLabel}</Text>
          </TouchableOpacity>
          {secondaryCta && (
            <TouchableOpacity
              onPress={secondaryCta.onPress}
              style={styles.secondaryCta}
              activeOpacity={0.7}
            >
              <Text style={styles.secondaryCtaText}>{secondaryCta.label}</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: OB.bg,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingTop: 16,
    gap: 12,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: OB.backBtnBg,
    alignItems: "center",
    justifyContent: "center",
  },
  backSpacer: {
    width: 44,
    height: 44,
  },
  progressTrack: {
    flex: 1,
    height: 4,
    borderRadius: 9999,
    backgroundColor: OB.progressTrack,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 9999,
    backgroundColor: OB.progressFill,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 12,
    flexGrow: 1,
  },
  bottom: {
    paddingHorizontal: 24,
    paddingBottom: 40,
    paddingTop: 16,
  },
  ctaBtn: {
    height: 56,
    borderRadius: 9999,
    backgroundColor: OB.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  ctaText: {
    color: OB.white,
    fontSize: 17,
    fontWeight: "600",
    letterSpacing: 0.01,
  },
  secondaryCta: {
    marginTop: 12,
    alignItems: "center",
    minHeight: 44,
    justifyContent: "center",
  },
  secondaryCtaText: {
    color: OB.secondary,
    fontSize: 16,
    fontWeight: "500",
  },
});
