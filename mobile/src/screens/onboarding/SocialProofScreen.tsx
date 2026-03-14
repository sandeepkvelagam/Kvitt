import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withDelay,
} from "react-native-reanimated";
import { useTheme } from "../../context/ThemeContext";
import { useLanguage } from "../../context/LanguageContext";
import { SPACE, LAYOUT, FONT } from "../../styles/tokens";
import { AppText } from "../../components/ui/AppText";
import { GlassSurface } from "../../components/ui/GlassSurface";
import { StarRating } from "../../components/ui/StarRating";
import { OnboardingShell } from "../../components/ui/OnboardingShell";

interface SocialProofScreenProps {
  onNext: () => void;
  onBack: () => void;
}

const BOUNCY = { damping: 12, stiffness: 120, mass: 0.8 };

function useFadeInUp(delay: number) {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(24);

  useEffect(() => {
    opacity.value = withDelay(delay, withSpring(1, BOUNCY));
    translateY.value = withDelay(delay, withSpring(0, BOUNCY));
  }, []);

  return useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));
}

/**
 * Animated counter that counts from 0.0 to 4.8 over ~800ms with ease-out cubic.
 * Uses a simple JS-thread interval since Reanimated shared values
 * cannot drive text content directly in React Native.
 */
function RatingCounter({ color }: { color: string }) {
  const [display, setDisplay] = useState("0.0");

  useEffect(() => {
    const totalSteps = 48; // ~800ms at 60fps
    let step = 0;
    const interval = setInterval(() => {
      step++;
      const progress = Math.min(step / totalSteps, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      setDisplay((eased * 4.8).toFixed(1));
      if (step >= totalSteps) clearInterval(interval);
    }, 800 / totalSteps);

    return () => clearInterval(interval);
  }, []);

  return (
    <Text
      style={{
        fontSize: FONT.screenTitle.size,
        fontWeight: FONT.screenTitle.weight,
        color,
      }}
    >
      {display}
    </Text>
  );
}

export function SocialProofScreen({ onNext, onBack }: SocialProofScreenProps) {
  const { colors } = useTheme();
  const { t } = useLanguage();

  const headingAnim = useFadeInUp(0);
  const ratingAnim = useFadeInUp(80);
  const testimonial1Anim = useFadeInUp(200);
  const testimonial2Anim = useFadeInUp(320);

  return (
    <OnboardingShell
      progress={0.75}
      onBack={onBack}
      ctaLabel={t.onboarding.continue}
      onCta={onNext}
    >
      {/* Heading */}
      <Animated.View style={headingAnim}>
        <AppText variant="screenTitle" color={colors.textPrimary}>
          {t.onboarding.socialProofTitle}
        </AppText>
      </Animated.View>

      {/* Rating section */}
      <Animated.View style={[styles.ratingSection, ratingAnim]}>
        <View style={styles.ratingRow}>
          <RatingCounter color={colors.textPrimary} />
          <StarRating rating={5} readonly size="medium" />
        </View>
        <AppText variant="secondary" color={colors.textMuted} style={styles.ratingSubtext}>
          {t.onboarding.socialProofRating}
        </AppText>
      </Animated.View>

      {/* Testimonial 1 */}
      <Animated.View style={[styles.testimonialWrapper, testimonial1Anim]}>
        <GlassSurface>
          <View style={styles.testimonialContent}>
            <AppText variant="body" color={colors.textPrimary} style={styles.quote}>
              {"\u201C"}{t.onboarding.testimonial1}{"\u201D"}
            </AppText>
            <AppText variant="secondary" color={colors.textMuted} style={styles.author}>
              {"\u2014"} {t.onboarding.testimonial1Author}
            </AppText>
          </View>
        </GlassSurface>
      </Animated.View>

      {/* Testimonial 2 */}
      <Animated.View style={[styles.testimonialWrapper, testimonial2Anim]}>
        <GlassSurface>
          <View style={styles.testimonialContent}>
            <AppText variant="body" color={colors.textPrimary} style={styles.quote}>
              {"\u201C"}{t.onboarding.testimonial2}{"\u201D"}
            </AppText>
            <AppText variant="secondary" color={colors.textMuted} style={styles.author}>
              {"\u2014"} {t.onboarding.testimonial2Author}
            </AppText>
          </View>
        </GlassSurface>
      </Animated.View>
    </OnboardingShell>
  );
}

const styles = StyleSheet.create({
  ratingSection: {
    alignItems: "center",
    marginTop: LAYOUT.sectionGap,
  },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.md,
  },
  ratingSubtext: {
    marginTop: SPACE.sm,
    textAlign: "center",
  },
  testimonialWrapper: {
    marginTop: SPACE.lg,
  },
  testimonialContent: {
    padding: LAYOUT.cardPadding,
  },
  quote: {
    fontStyle: "italic",
  },
  author: {
    marginTop: SPACE.sm,
  },
});
