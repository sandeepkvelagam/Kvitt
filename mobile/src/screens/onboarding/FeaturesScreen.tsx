import React, { useEffect } from "react";
import { View, StyleSheet } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withDelay,
} from "react-native-reanimated";
import { useTheme } from "../../context/ThemeContext";
import { useLanguage } from "../../context/LanguageContext";
import { SPACE, LAYOUT } from "../../styles/tokens";
import { AppText } from "../../components/ui/AppText";
import { FeatureCard } from "../../components/ui/FeatureCard";
import { OnboardingShell } from "../../components/ui/OnboardingShell";

interface FeaturesScreenProps {
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

export function FeaturesScreen({ onNext, onBack }: FeaturesScreenProps) {
  const { colors } = useTheme();
  const { t } = useLanguage();

  const headingAnim = useFadeInUp(0);
  const card0Anim = useFadeInUp(80);
  const card1Anim = useFadeInUp(160);
  const card2Anim = useFadeInUp(240);
  const card3Anim = useFadeInUp(320);

  const features = [
    { icon: "\u{1F0CF}", label: t.onboarding.featureTrackGames, sublabel: t.onboarding.featureTrackGamesSub, anim: card0Anim },
    { icon: "\u{1F91D}", label: t.onboarding.featureSettleUp, sublabel: t.onboarding.featureSettleUpSub, anim: card1Anim },
    { icon: "\u{1F4C5}", label: t.onboarding.featureSchedule, sublabel: t.onboarding.featureScheduleSub, anim: card2Anim },
    { icon: "\u2728", label: t.onboarding.featureAI, sublabel: t.onboarding.featureAISub, anim: card3Anim },
  ];

  return (
    <OnboardingShell
      progress={0.50}
      onBack={onBack}
      ctaLabel={t.onboarding.continue}
      onCta={onNext}
    >
      <Animated.View style={headingAnim}>
        <AppText variant="screenTitle" color={colors.textPrimary}>
          {t.onboarding.featuresTitle}
        </AppText>
      </Animated.View>

      <View style={styles.grid}>
        {features.map((f) => (
          <Animated.View key={f.label} style={[styles.cardWrapper, f.anim]}>
            <FeatureCard
              icon={f.icon}
              label={f.label}
              sublabel={f.sublabel}
            />
          </Animated.View>
        ))}
      </View>
    </OnboardingShell>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACE.md,
    marginTop: LAYOUT.sectionGap,
  },
  cardWrapper: {
    width: "48%",
  },
});
