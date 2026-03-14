import React from "react";
import { View, ScrollView, TouchableOpacity, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../context/ThemeContext";
import { SPACE, LAYOUT, RADIUS } from "../../styles/tokens";
import { GlassButton } from "./GlassButton";
import { GlassIconButton } from "./GlassButton";
import { AppText } from "./AppText";

interface OnboardingShellProps {
  children: React.ReactNode;
  progress: number; // 0-1
  onBack?: () => void;
  ctaLabel: string;
  onCta: () => void;
  secondaryCta?: { label: string; onPress: () => void };
}

/**
 * OnboardingShell — Shared wrapper for onboarding screens.
 *
 * Provides: header with back button + animated progress bar,
 * scrollable content area, pinned bottom CTA.
 */
export function OnboardingShell({
  children,
  progress,
  onBack,
  ctaLabel,
  onCta,
  secondaryCta,
}: OnboardingShellProps) {
  const { colors } = useTheme();
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
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header: back button + progress bar */}
      <View style={styles.header}>
        {onBack ? (
          <GlassIconButton
            icon={<Ionicons name="chevron-back" size={18} color={colors.textPrimary} />}
            onPress={onBack}
            variant="ghost"
            size="small"
          />
        ) : (
          <View style={styles.backSpacer} />
        )}
        <View style={[styles.progressTrack, { backgroundColor: colors.glassBg }]}>
          <Animated.View
            style={[
              styles.progressFill,
              { backgroundColor: colors.orange },
              progressStyle,
            ]}
          />
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
      <View style={styles.bottom}>
        <GlassButton
          onPress={onCta}
          variant="primary"
          size="large"
          fullWidth
        >
          {ctaLabel}
        </GlassButton>
        {secondaryCta && (
          <TouchableOpacity
            onPress={secondaryCta.onPress}
            style={styles.secondaryCta}
            activeOpacity={0.7}
          >
            <AppText variant="secondary" color={colors.textMuted} style={styles.secondaryCtaText}>
              {secondaryCta.label}
            </AppText>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: LAYOUT.screenPadding,
    paddingTop: SPACE.lg,
    gap: SPACE.md,
  },
  backSpacer: {
    width: 40,
    height: 40,
  },
  progressTrack: {
    flex: 1,
    height: 4,
    borderRadius: RADIUS.full,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: RADIUS.full,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: LAYOUT.screenPadding,
    paddingTop: SPACE.xxl,
    flexGrow: 1,
  },
  bottom: {
    paddingHorizontal: LAYOUT.screenPadding,
    paddingBottom: SPACE.xxxl,
    paddingTop: SPACE.lg,
  },
  secondaryCta: {
    marginTop: SPACE.md,
    alignItems: "center",
    minHeight: 44,
    justifyContent: "center",
  },
  secondaryCtaText: {
    textAlign: "center",
  },
});
