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

import { WelcomeScreen } from "./WelcomeScreen";
import { FeaturesScreen } from "./FeaturesScreen";
import { SocialProofScreen } from "./SocialProofScreen";
import { NotificationScreen } from "./NotificationScreen";
import { SignInScreen } from "./SignInScreen";

const STORAGE_KEY = "kvitt_onboarding_seen_v1";
/** Splash is shown at app root (RootNavigator); onboarding starts at Welcome. */
const TOTAL_STEPS = 5;

type Direction = "forward" | "back";

/**
 * OnboardingFlow — 5 screens with animated transitions (root splash is separate).
 *
 * Step 0: Welcome / Trust
 * Step 1: Goal Select
 * Step 2: Social Proof
 * Step 3: Notification Permission
 * Step 4: Sign In
 *
 * On completion: sets AsyncStorage key, navigates to Login.
 */
export function OnboardingFlow() {
  const { width } = useWindowDimensions();
  const navigation = useNavigation<NativeStackNavigationProp<any>>();

  const [step, setStep] = useState(0);
  const isTransitioning = useRef(false);

  const currentTranslateX = useSharedValue(0);
  const currentOpacity = useSharedValue(1);
  const nextTranslateX = useSharedValue(width);
  const nextOpacity = useSharedValue(0);

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
    cancelAnimation(nextTranslateX);
    cancelAnimation(nextOpacity);
    cancelAnimation(currentTranslateX);
    cancelAnimation(currentOpacity);

    setStep(toStep);
    setNextStep(null);
    isTransitioning.current = false;

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

      nextTranslateX.value = enterFromX;
      nextOpacity.value = 0;

      currentTranslateX.value = withTiming(exitX, { duration: 200 });
      currentOpacity.value = withTiming(0, { duration: 200 });

      nextTranslateX.value = withSpring(0, { damping: 12, stiffness: 120, mass: 0.8 });
      nextOpacity.value = withTiming(1, { duration: 250 }, () => {
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
      console.warn("Failed to save onboarding completion");
    }
    navigation.dispatch(
      CommonActions.reset({ index: 0, routes: [{ name: "Login" }] })
    );
  }, [navigation]);

  const renderStep = (stepIndex: number) => {
    switch (stepIndex) {
      case 0:
        return <WelcomeScreen onNext={goForward} onBack={() => {}} />;
      case 1:
        return <FeaturesScreen onNext={goForward} onBack={goBack} />;
      case 2:
        return <SocialProofScreen onNext={goForward} onBack={goBack} />;
      case 3:
        return <NotificationScreen onComplete={goForward} onBack={goBack} />;
      case 4:
        return <SignInScreen onComplete={completeOnboarding} onBack={goBack} />;
      default:
        return null;
    }
  };

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.page, currentStyle]}>
        {renderStep(step)}
      </Animated.View>

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
    backgroundColor: "#FFFFFF",
  },
  page: {
    flex: 1,
  },
  pageAbsolute: {
    ...StyleSheet.absoluteFillObject,
  },
});
