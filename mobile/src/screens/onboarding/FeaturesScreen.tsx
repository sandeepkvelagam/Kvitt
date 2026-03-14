import React, { useState, useEffect } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withDelay,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { useLanguage } from "../../context/LanguageContext";
import { OnboardingShell, OB } from "../../components/ui/OnboardingShell";

interface GoalSelectScreenProps {
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

const OPTIONS = [
  { icon: "\u2660\uFE0F", label: "Track poker games" },
  { icon: "\uD83D\uDCB0", label: "Settle up with friends" },
  { icon: "\uD83D\uDCC5", label: "Organize game nights" },
  { icon: "\uD83E\uDD1D", label: "All of the above" },
];

/**
 * GoalSelectScreen — "What brings you to Kvitt?"
 * Full-width stacked option cards with selection state.
 * Selected = solid black bg with white text. Matches Figma Goal Select.
 */
export function FeaturesScreen({ onNext, onBack }: GoalSelectScreenProps) {
  const { t } = useLanguage();
  const [selected, setSelected] = useState(3); // Default: "All of the above"

  const headingAnim = useFadeInUp(0);
  const card0 = useFadeInUp(80);
  const card1 = useFadeInUp(160);
  const card2 = useFadeInUp(240);
  const card3 = useFadeInUp(320);
  const anims = [card0, card1, card2, card3];

  const handleSelect = (index: number) => {
    setSelected(index);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  return (
    <OnboardingShell
      progress={0.35}
      onBack={onBack}
      ctaLabel={t.onboarding.continue}
      onCta={onNext}
    >
      <Animated.View style={headingAnim}>
        <Text style={styles.heading}>What brings you to Kvitt?</Text>
      </Animated.View>

      <View style={styles.options}>
        {OPTIONS.map((opt, i) => {
          const active = selected === i;
          return (
            <Animated.View key={opt.label} style={anims[i]}>
              <TouchableOpacity
                onPress={() => handleSelect(i)}
                activeOpacity={0.7}
                style={[
                  styles.optionCard,
                  active && styles.optionCardActive,
                ]}
              >
                <View
                  style={[
                    styles.iconCircle,
                    active && styles.iconCircleActive,
                  ]}
                >
                  <Text style={styles.icon}>{opt.icon}</Text>
                </View>
                <Text
                  style={[
                    styles.optionLabel,
                    active && styles.optionLabelActive,
                  ]}
                >
                  {opt.label}
                </Text>
              </TouchableOpacity>
            </Animated.View>
          );
        })}
      </View>
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
  options: {
    marginTop: 24,
    gap: 12,
  },
  optionCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: OB.cardBg,
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 18,
    gap: 16,
  },
  optionCardActive: {
    backgroundColor: OB.primary,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  iconCircleActive: {
    backgroundColor: "rgba(255,255,255,0.15)",
  },
  icon: {
    fontSize: 22,
  },
  optionLabel: {
    color: OB.text,
    fontSize: 17,
    fontWeight: "500",
    letterSpacing: -17 * 0.01,
    flex: 1,
  },
  optionLabelActive: {
    color: "#FFFFFF",
  },
});
