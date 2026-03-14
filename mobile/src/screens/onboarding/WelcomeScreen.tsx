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
import { KvittLogo } from "../../components/ui/KvittLogo";
import { GlassSurface } from "../../components/ui/GlassSurface";
import { AppText } from "../../components/ui/AppText";
import { OnboardingShell } from "../../components/ui/OnboardingShell";

interface WelcomeScreenProps {
  onNext: () => void;
}

const BOUNCY = { damping: 12, stiffness: 120, mass: 0.8 };

function useFadeInUp(delay: number) {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(24);

  useEffect(() => {
    opacity.value = withDelay(delay, withSpring(1, BOUNCY));
    translateY.value = withDelay(delay, withSpring(0, BOUNCY));
  }, []);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return style;
}

export function WelcomeScreen({ onNext }: WelcomeScreenProps) {
  const { colors } = useTheme();
  const { t } = useLanguage();

  const logoAnim = useFadeInUp(0);
  const headingAnim = useFadeInUp(80);
  const subheadingAnim = useFadeInUp(160);
  const trustAnim = useFadeInUp(240);

  return (
    <OnboardingShell
      progress={0.25}
      ctaLabel={t.onboarding.getStarted}
      onCta={onNext}
    >
      <View style={styles.content}>
        {/* Logo in GlassSurface */}
        <Animated.View style={[styles.logoArea, logoAnim]}>
          <GlassSurface glowVariant="orange" style={styles.logoSurface}>
            <View style={styles.logoInner}>
              <KvittLogo size="large" showText showTagline />
            </View>
          </GlassSurface>
        </Animated.View>

        {/* Heading */}
        <Animated.View style={headingAnim}>
          <AppText variant="screenTitle" color={colors.textPrimary}>
            {t.onboarding.welcomeTitle}
          </AppText>
        </Animated.View>

        {/* Subheading */}
        <Animated.View style={{ marginTop: SPACE.md }}>
          <Animated.View style={subheadingAnim}>
            <AppText variant="body" color={colors.textSecondary}>
              {t.onboarding.welcomeSubtitle}
            </AppText>
          </Animated.View>
        </Animated.View>

        {/* Trust text at bottom */}
        <View style={styles.trustArea}>
          <Animated.View style={trustAnim}>
            <AppText
              variant="secondary"
              color={colors.textMuted}
              style={styles.trustText}
            >
              {t.onboarding.welcomeTrust}
            </AppText>
          </Animated.View>
        </View>
      </View>
    </OnboardingShell>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
  },
  logoArea: {
    alignItems: "center",
    marginBottom: LAYOUT.sectionGap,
  },
  logoSurface: {
    alignSelf: "center",
  },
  logoInner: {
    padding: LAYOUT.cardPadding,
    alignItems: "center",
    justifyContent: "center",
  },
  trustArea: {
    flex: 1,
    justifyContent: "flex-end",
    paddingBottom: SPACE.lg,
  },
  trustText: {
    textAlign: "center",
  },
});
