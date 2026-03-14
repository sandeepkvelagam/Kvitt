import React, { useEffect } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Alert } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withDelay,
} from "react-native-reanimated";
import Svg, { Path } from "react-native-svg";
import { OnboardingShell, OB } from "../../components/ui/OnboardingShell";

interface SignInScreenProps {
  onComplete: () => void;
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
 * SignInScreen — Apple + Google sign-in buttons.
 * Matches Figma Sign In screen exactly.
 */
export function SignInScreen({ onComplete, onBack }: SignInScreenProps) {
  const headingAnim = useFadeInUp(0);
  const appleAnim = useFadeInUp(150);
  const googleAnim = useFadeInUp(250);

  const handleApple = () => {
    // TODO: Wire up Apple Sign In
    Alert.alert("Coming Soon", "Apple Sign In will be available soon.");
  };

  const handleGoogle = () => {
    // TODO: Wire up Google Sign In
    Alert.alert("Coming Soon", "Google Sign In will be available soon.");
  };

  return (
    <OnboardingShell
      progress={1.0}
      onBack={onBack}
      // No standard CTA — the sign-in buttons are the CTAs
    >
      <View style={styles.content}>
        <Animated.View style={headingAnim}>
          <Text style={styles.heading}>Save your progress</Text>
        </Animated.View>

        <View style={styles.buttons}>
          {/* Apple Sign In */}
          <Animated.View style={appleAnim}>
            <TouchableOpacity
              onPress={handleApple}
              style={styles.appleBtn}
              activeOpacity={0.8}
            >
              <Svg width={20} height={20} viewBox="0 0 24 24" fill="#FFFFFF">
                <Path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
              </Svg>
              <Text style={styles.appleBtnText}>Sign in with Apple</Text>
            </TouchableOpacity>
          </Animated.View>

          {/* Google Sign In */}
          <Animated.View style={googleAnim}>
            <TouchableOpacity
              onPress={handleGoogle}
              style={styles.googleBtn}
              activeOpacity={0.8}
            >
              <Svg width={20} height={20} viewBox="0 0 24 24">
                <Path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <Path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <Path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <Path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </Svg>
              <Text style={styles.googleBtnText}>Sign in with Google</Text>
            </TouchableOpacity>
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
  heading: {
    color: OB.text,
    fontSize: 32,
    fontWeight: "700",
    lineHeight: 32 * 1.18,
    letterSpacing: -32 * 0.03,
    textAlign: "center",
    paddingTop: 16,
  },
  buttons: {
    flex: 1,
    justifyContent: "center",
    gap: 16,
    paddingBottom: 40,
  },
  appleBtn: {
    height: 56,
    borderRadius: 9999,
    backgroundColor: "#000000",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  appleBtnText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "600",
  },
  googleBtn: {
    height: 56,
    borderRadius: 9999,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E0E0E0",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  googleBtnText: {
    color: OB.text,
    fontSize: 17,
    fontWeight: "600",
  },
});
