import React, { useEffect, useState } from "react";
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

function RatingCounter() {
  const [display, setDisplay] = useState("0.0");
  useEffect(() => {
    const totalSteps = 48;
    let step = 0;
    const interval = setInterval(() => {
      step++;
      const progress = Math.min(step / totalSteps, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay((eased * 4.8).toFixed(1));
      if (step >= totalSteps) clearInterval(interval);
    }, 800 / totalSteps);
    return () => clearInterval(interval);
  }, []);
  return <Text style={styles.ratingNumber}>{display}</Text>;
}

function GoldStars() {
  return (
    <View style={styles.starsRow}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Text key={i} style={styles.star}>{"\u2605"}</Text>
      ))}
    </View>
  );
}

/**
 * SocialProofScreen — Rating, avatars, testimonials.
 * Matches Figma Social Proof screen exactly.
 */
export function SocialProofScreen({ onNext, onBack }: SocialProofScreenProps) {
  const { t } = useLanguage();

  const headingAnim = useFadeInUp(0);
  const ratingAnim = useFadeInUp(80);
  const madeForAnim = useFadeInUp(200);
  const testimonialAnim = useFadeInUp(320);

  return (
    <OnboardingShell
      progress={0.55}
      onBack={onBack}
      ctaLabel={t.onboarding.continue}
      onCta={onNext}
    >
      {/* Heading */}
      <Animated.View style={headingAnim}>
        <Text style={styles.heading}>{t.onboarding.socialProofTitle}</Text>
      </Animated.View>

      {/* Rating card */}
      <Animated.View style={[styles.ratingCard, ratingAnim]}>
        <View style={styles.ratingRow}>
          <Text style={styles.flourish}>{"\u2766"}</Text>
          <RatingCounter />
          <GoldStars />
          <Text style={styles.flourish}>{"\u2766"}</Text>
        </View>
        <Text style={styles.ratingSubtext}>{t.onboarding.socialProofRating}</Text>
      </Animated.View>

      {/* Made for you section */}
      <Animated.View style={[styles.madeForSection, madeForAnim]}>
        <Text style={styles.madeForHeading}>
          Kvitt was made for{"\n"}people like you
        </Text>

        {/* Avatar stack */}
        <View style={styles.avatarStack}>
          <LinearGradient colors={["#D9A06B", "#C47D4E"]} style={[styles.avatar, { zIndex: 3 }]} />
          <LinearGradient colors={["#D89AB2", "#A979A1"]} style={[styles.avatar, styles.avatarOverlap, { zIndex: 2 }]} />
          <LinearGradient colors={["#89A8E8", "#5277D8"]} style={[styles.avatar, styles.avatarOverlap2, { zIndex: 1 }]} />
        </View>

        <Text style={styles.communityText}>Growing poker community</Text>
      </Animated.View>

      {/* Testimonial card */}
      <Animated.View style={[styles.testimonialCard, testimonialAnim]}>
        <View style={styles.testimonialHeader}>
          <View style={styles.testimonialRow}>
            <LinearGradient colors={["#8ED0A1", "#4D9B67"]} style={styles.testimonialAvatar} />
            <Text style={styles.testimonialName}>Jake Sullivan</Text>
          </View>
          <GoldStars />
        </View>
        <Text style={styles.testimonialQuote}>
          Finally an app that makes settling up after poker night actually easy. No more Venmo math!
        </Text>
      </Animated.View>
    </OnboardingShell>
  );
}

const styles = StyleSheet.create({
  heading: {
    color: OB.text,
    fontSize: 32,
    fontWeight: "700",
    lineHeight: 32 * 1.15,
    letterSpacing: -32 * 0.02,
  },
  // Rating card
  ratingCard: {
    backgroundColor: OB.contentBg,
    borderRadius: 22,
    paddingHorizontal: 24,
    paddingVertical: 24,
    alignItems: "center",
    marginTop: 24,
  },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  flourish: {
    color: "#E0A066",
    fontSize: 22,
  },
  ratingNumber: {
    color: OB.text,
    fontSize: 26,
    fontWeight: "700",
  },
  starsRow: {
    flexDirection: "row",
    gap: 2,
  },
  star: {
    color: "#F5A623",
    fontSize: 18,
  },
  ratingSubtext: {
    color: OB.secondary,
    fontSize: 16,
    fontWeight: "500",
    marginTop: 8,
  },
  // Made for you
  madeForSection: {
    alignItems: "center",
    marginTop: 24,
  },
  madeForHeading: {
    color: OB.text,
    fontSize: 28,
    fontWeight: "700",
    lineHeight: 28 * 1.2,
    letterSpacing: -28 * 0.02,
    textAlign: "center",
  },
  avatarStack: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 20,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 3,
    borderColor: "#FFFFFF",
  },
  avatarOverlap: {
    marginLeft: -12,
  },
  avatarOverlap2: {
    marginLeft: -12,
  },
  communityText: {
    color: OB.text,
    fontSize: 16,
    fontWeight: "500",
    marginTop: 12,
  },
  // Testimonial
  testimonialCard: {
    backgroundColor: OB.contentBg,
    borderRadius: 22,
    paddingHorizontal: 20,
    paddingVertical: 20,
    marginTop: 24,
  },
  testimonialHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  testimonialRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  testimonialAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  testimonialName: {
    color: OB.text,
    fontSize: 16,
    fontWeight: "600",
  },
  testimonialQuote: {
    color: OB.secondary,
    fontSize: 15,
    lineHeight: 15 * 1.55,
    marginTop: 12,
  },
});
