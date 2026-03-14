import React, { useEffect } from "react";
import { View, Text, StyleSheet } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  Easing,
} from "react-native-reanimated";

interface SplashScreenProps {
  onComplete: () => void;
}

/**
 * SplashScreen — ♠️ + "Kvitt" centered on pure white.
 * Auto-advances after 2.5s. Matches Figma splash exactly.
 */
export function SplashScreen({ onComplete }: SplashScreenProps) {
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.8);

  useEffect(() => {
    // Fade in
    opacity.value = withTiming(1, { duration: 600, easing: Easing.out(Easing.cubic) });
    scale.value = withTiming(1, { duration: 600, easing: Easing.out(Easing.cubic) });

    // Auto-advance after 2.5s
    const timer = setTimeout(onComplete, 2500);
    return () => clearTimeout(timer);
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.content, animStyle]}>
        <Text style={styles.spade}>{"\u2660\uFE0F"}</Text>
        <Text style={styles.title}>Kvitt</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    alignItems: "center",
  },
  spade: {
    fontSize: 64,
    marginBottom: 8,
  },
  title: {
    color: "#1A1A1A",
    fontSize: 48,
    fontWeight: "700",
    letterSpacing: -48 * 0.04,
  },
});
