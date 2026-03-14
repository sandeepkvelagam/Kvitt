import React, { useEffect } from "react";
import { View, Text, StyleSheet } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withDelay,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { useLanguage } from "../../context/LanguageContext";
import { OnboardingShell, OB } from "../../components/ui/OnboardingShell";

interface WelcomeScreenProps {
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
 * WelcomeScreen — "Thank you for trusting us"
 * Illustration ring with 🙌, privacy card, black CTA.
 * Matches Figma Thank You screen exactly.
 */
export function WelcomeScreen({ onNext, onBack }: WelcomeScreenProps) {
  const { t } = useLanguage();

  const ringAnim = useFadeInUp(0);
  const headingAnim = useFadeInUp(100);
  const subtitleAnim = useFadeInUp(200);
  const cardAnim = useFadeInUp(300);

  return (
    <OnboardingShell
      progress={0.50}
      onBack={onBack}
      ctaLabel={t.onboarding.continue}
      onCta={onNext}
    >
      <View style={styles.content}>
        {/* Illustration Ring */}
        <Animated.View style={[styles.ringWrapper, ringAnim]}>
          <LinearGradient
            colors={["#F5DCE7", "#DEE7F7"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.ringGradient}
          >
            <View style={styles.ringInner}>
              <Text style={styles.ringEmoji}>{"\uD83D\uDE4C"}</Text>
            </View>
          </LinearGradient>
        </Animated.View>

        {/* Heading */}
        <Animated.View style={[styles.headingWrap, headingAnim]}>
          <Text style={styles.heading}>Thank you for{"\n"}trusting us</Text>
        </Animated.View>

        {/* Subtitle */}
        <Animated.View style={subtitleAnim}>
          <Text style={styles.subtitle}>Now let's personalize Kvitt for you...</Text>
        </Animated.View>

        {/* Privacy card */}
        <Animated.View style={[styles.privacyCard, cardAnim]}>
          <View style={styles.lockIconWrap}>
            <Text style={styles.lockIcon}>{"\uD83D\uDD12"}</Text>
          </View>
          <Text style={styles.privacyTitle}>
            Your privacy and security matter to us.
          </Text>
          <Text style={styles.privacyDetail}>
            We promise to always keep your personal information private and secure.
          </Text>
        </Animated.View>
      </View>
    </OnboardingShell>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingBottom: 16,
  },
  ringWrapper: {
    marginBottom: 32,
  },
  ringGradient: {
    width: 200,
    height: 200,
    borderRadius: 100,
    padding: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  ringInner: {
    width: "100%",
    height: "100%",
    borderRadius: 94,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  ringEmoji: {
    fontSize: 64,
  },
  headingWrap: {
    marginBottom: 12,
  },
  heading: {
    color: OB.text,
    fontSize: 32,
    fontWeight: "700",
    lineHeight: 32 * 1.18,
    letterSpacing: -32 * 0.03,
    textAlign: "center",
  },
  subtitle: {
    color: OB.secondary,
    fontSize: 17,
    lineHeight: 17 * 1.4,
    textAlign: "center",
    maxWidth: 260,
  },
  privacyCard: {
    marginTop: 32,
    width: "100%",
    backgroundColor: OB.contentBg,
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 20,
    alignItems: "center",
  },
  lockIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  lockIcon: {
    fontSize: 20,
  },
  privacyTitle: {
    color: OB.text,
    fontSize: 15,
    fontWeight: "600",
    lineHeight: 15 * 1.35,
    textAlign: "center",
  },
  privacyDetail: {
    color: OB.secondary,
    fontSize: 14,
    lineHeight: 14 * 1.45,
    textAlign: "center",
    marginTop: 8,
    maxWidth: 250,
  },
});
