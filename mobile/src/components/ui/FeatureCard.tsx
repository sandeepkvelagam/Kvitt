import React from "react";
import { Pressable, View, Text, StyleSheet, StyleProp, ViewStyle } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { useTheme } from "../../context/ThemeContext";
import { SPACE, LAYOUT, RADIUS } from "../../styles/tokens";
import { GlassSurface } from "./GlassSurface";
import { AppText } from "./AppText";

interface FeatureCardProps {
  icon: string;
  label: string;
  sublabel: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * FeatureCard — Tappable card for the onboarding features screen.
 *
 * Purely informational: press animation + haptic for delight,
 * but NO selection state and NO data collection.
 */
export function FeatureCard({ icon, label, sublabel, style }: FeatureCardProps) {
  const { colors } = useTheme();
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const onPressIn = () => {
    scale.value = withSpring(0.97, {
      damping: 8,
      stiffness: 200,
      mass: 0.5,
    });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const onPressOut = () => {
    scale.value = withSpring(1, {
      damping: 5,
      stiffness: 400,
      mass: 0.3,
    });
  };

  return (
    <Animated.View style={[animatedStyle, style]}>
      <Pressable onPressIn={onPressIn} onPressOut={onPressOut}>
        <GlassSurface noInner style={styles.surface}>
          <View style={styles.content}>
            <Text style={styles.icon}>{icon}</Text>
            <AppText variant="bodyStrong" color={colors.textPrimary} style={styles.label}>
              {label}
            </AppText>
            <AppText variant="secondary" color={colors.textMuted} style={styles.sublabel}>
              {sublabel}
            </AppText>
          </View>
        </GlassSurface>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  surface: {
    borderRadius: RADIUS.lg,
  },
  content: {
    padding: LAYOUT.cardPadding,
    alignItems: "center",
    gap: SPACE.sm,
  },
  icon: {
    fontSize: 32,
  },
  label: {
    textAlign: "center",
  },
  sublabel: {
    textAlign: "center",
  },
});
