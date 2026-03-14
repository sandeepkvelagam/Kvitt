import React, { useState, useCallback, useRef } from "react";
import { View, StyleSheet, useWindowDimensions } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  runOnJS,
  cancelAnimation,
} from "react-native-reanimated";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { CommonActions, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useTheme } from "../../context/ThemeContext";

import { WelcomeScreen } from "./WelcomeScreen";
import { FeaturesScreen } from "./FeaturesScreen";
import { SocialProofScreen } from "./SocialProofScreen";
import { NotificationScreen } from "./NotificationScreen";

const STORAGE_KEY = "kvitt_onboarding_seen_v1";
const TOTAL_STEPS = 4;

type Direction = "forward" | "back";

/**
 * OnboardingFlow — Single screen registered in the navigator.
 *
 * Manages internal step state (0-3) with animated page transitions.
 * On completion: sets AsyncStorage key, resets navigation to Login.
 */
export function OnboardingFlow() {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const navigation = useNavigation<NativeStackNavigationProp<any>>();

  const [step, setStep] = useState(0);
  const isTransitioning = useRef(false);

  // Animation values for current and next page
  const currentTranslateX = useSharedValue(0);
  const currentOpacity = useSharedValue(1);
  const nextTranslateX = useSharedValue(width);
  const nextOpacity = useSharedValue(0);

  // Track which step is rendering in "next" slot during transition
  const [nextStep, setNextStep] = useState<number | null>(null);

  const currentStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: currentTranslateX.value }],
    opacity: currentOpacity.value,
  }));

  const nextStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: nextTranslateX.value }],
    opacity: nextOpacity.value,
  }));

  const finishTransition = useCallback((toStep: number) => {
    // Cancel any lingering spring on nextTranslateX before resetting
    cancelAnimation(nextTranslateX);
    cancelAnimation(nextOpacity);
    cancelAnimation(currentTranslateX);
    cancelAnimation(currentOpacity);

    setStep(toStep);
    setNextStep(null);
    isTransitioning.current = false;

    // Reset positions for next transition (immediate, no animation)
    currentTranslateX.value = 0;
    currentOpacity.value = 1;
    nextTranslateX.value = width;
    nextOpacity.value = 0;
  }, [width]);

  const animateTransition = useCallback(
    (toStep: number, direction: Direction) => {
      if (isTransitioning.current) return;
      isTransitioning.current = true;
      setNextStep(toStep);

      const exitX = direction === "forward" ? -width / 3 : width / 3;
      const enterFromX = direction === "forward" ? width : -width;

      // Position the next page offscreen
      nextTranslateX.value = enterFromX;
      nextOpacity.value = 0;

      // Animate current page out
      currentTranslateX.value = withTiming(exitX, { duration: 200 });
      currentOpacity.value = withTiming(0, { duration: 200 });

      // Animate next page in
      nextTranslateX.value = withSpring(0, {
        damping: 12,
        stiffness: 120,
        mass: 0.8,
      });
      nextOpacity.value = withTiming(1, { duration: 250 }, () => {
        // Transition complete — swap on JS thread
        runOnJS(finishTransition)(toStep);
      });
    },
    [width, finishTransition]
  );

  const goForward = useCallback(() => {
    if (step < TOTAL_STEPS - 1) {
      animateTransition(step + 1, "forward");
    }
  }, [step, animateTransition]);

  const goBack = useCallback(() => {
    if (step > 0) {
      animateTransition(step - 1, "back");
    }
  }, [step, animateTransition]);

  const completeOnboarding = useCallback(async () => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, "true");
    } catch {
      console.warn("Failed to save onboarding completion, continuing anyway");
    }
    // Reset navigation stack so user cannot swipe back to onboarding
    navigation.dispatch(
      CommonActions.reset({
        index: 0,
        routes: [{ name: "Login" }],
      })
    );
  }, [navigation]);

  const renderStep = (stepIndex: number) => {
    switch (stepIndex) {
      case 0:
        return <WelcomeScreen onNext={goForward} />;
      case 1:
        return <FeaturesScreen onNext={goForward} onBack={goBack} />;
      case 2:
        return <SocialProofScreen onNext={goForward} onBack={goBack} />;
      case 3:
        return (
          <NotificationScreen onComplete={completeOnboarding} onBack={goBack} />
        );
      default:
        return null;
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Current page */}
      <Animated.View style={[styles.page, currentStyle]}>
        {renderStep(step)}
      </Animated.View>

      {/* Next page (only during transition) */}
      {nextStep !== null && (
        <Animated.View style={[styles.page, styles.pageAbsolute, nextStyle]}>
          {renderStep(nextStep)}
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  page: {
    flex: 1,
  },
  pageAbsolute: {
    ...StyleSheet.absoluteFillObject,
  },
});
