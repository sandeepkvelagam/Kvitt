import React, { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withDelay,
} from "react-native-reanimated";
import * as Notifications from "expo-notifications";
import * as Haptics from "expo-haptics";
import { useLanguage } from "../../context/LanguageContext";
import { OnboardingShell, OB } from "../../components/ui/OnboardingShell";

interface NotificationScreenProps {
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
 * NotificationScreen — iOS-style permission dialog mock.
 * Matches Figma Notification screen exactly.
 * No bottom CTA — the dialog IS the action.
 */
export function NotificationScreen({ onComplete, onBack }: NotificationScreenProps) {
  const { t } = useLanguage();

  const headingAnim = useFadeInUp(0);
  const dialogAnim = useFadeInUp(200);
  const pointerAnim = useFadeInUp(400);

  const handleAllow = async () => {
    try {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status === "granted") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch {
      console.warn("Notification permission request failed");
    }
    // Always advance regardless of result
    setTimeout(onComplete, 300);
  };

  const handleDontAllow = () => {
    onComplete();
  };

  return (
    <OnboardingShell
      progress={0.65}
      onBack={onBack}
      // No CTA — dialog is the action
    >
      <View style={styles.content}>
        {/* Heading */}
        <Animated.View style={headingAnim}>
          <Text style={styles.heading}>{t.onboarding.notifTitle}</Text>
        </Animated.View>

        {/* iOS-style notification dialog */}
        <Animated.View style={[styles.dialog, dialogAnim]}>
          <View style={styles.dialogBody}>
            <Text style={styles.dialogText}>
              Kvitt would like to send you
            </Text>
            <Text style={styles.dialogText}>
              Notifications
            </Text>
          </View>

          <View style={styles.dialogButtons}>
            <TouchableOpacity
              onPress={handleDontAllow}
              style={[styles.dialogBtn, styles.dialogBtnLeft]}
              activeOpacity={0.7}
            >
              <Text style={styles.dialogBtnTextGray}>Don't Allow</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleAllow}
              style={[styles.dialogBtn, styles.dialogBtnRight]}
              activeOpacity={0.8}
            >
              <Text style={styles.dialogBtnTextWhite}>Allow</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>

        {/* Pointer emoji */}
        <Animated.View style={[styles.pointerWrap, pointerAnim]}>
          <Text style={styles.pointer}>{"\uD83D\uDC46"}</Text>
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
    paddingBottom: 64,
  },
  heading: {
    color: OB.text,
    fontSize: 32,
    fontWeight: "700",
    lineHeight: 32 * 1.18,
    letterSpacing: -32 * 0.03,
    textAlign: "center",
  },
  // iOS dialog mock
  dialog: {
    marginTop: 40,
    width: "100%",
    borderRadius: 18,
    backgroundColor: "#D8D8DD",
    overflow: "hidden",
  },
  dialogBody: {
    paddingHorizontal: 24,
    paddingVertical: 24,
    alignItems: "center",
  },
  dialogText: {
    color: OB.text,
    fontSize: 17,
    fontWeight: "600",
    lineHeight: 17 * 1.4,
    textAlign: "center",
  },
  dialogButtons: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: "#BDBDC6",
  },
  dialogBtn: {
    flex: 1,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  dialogBtnLeft: {
    borderRightWidth: 1,
    borderRightColor: "#BDBDC6",
  },
  dialogBtnRight: {
    backgroundColor: OB.primary,
  },
  dialogBtnTextGray: {
    color: "#5A5A63",
    fontSize: 17,
    fontWeight: "500",
  },
  dialogBtnTextWhite: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "600",
  },
  pointerWrap: {
    marginTop: 24,
  },
  pointer: {
    fontSize: 40,
  },
});
