import React, { useEffect } from "react";
import { View, Text, StyleSheet } from "react-native";
import * as ExpoSplashScreen from "expo-splash-screen";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from "react-native-reanimated";

/**
 * SplashScreen — ♠️ + "Kvitt" centered on pure white.
 * Visual-only: launch duration is owned by RootNavigator (min hold + boot ready).
 */
export function SplashScreen() {
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.8);

  useEffect(() => {
    ExpoSplashScreen.hideAsync().catch(() => {});
    opacity.value = withTiming(1, { duration: 600, easing: Easing.out(Easing.cubic) });
    scale.value = withTiming(1, { duration: 600, easing: Easing.out(Easing.cubic) });
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
