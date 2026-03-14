import React, { useEffect, useState } from "react";
import { View, StyleSheet } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withDelay,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import * as Notifications from "expo-notifications";
import * as Haptics from "expo-haptics";
import { useTheme } from "../../context/ThemeContext";
import { useLanguage } from "../../context/LanguageContext";
import { SPACE, LAYOUT, RADIUS } from "../../styles/tokens";
import { AppText } from "../../components/ui/AppText";
import { GlassSurface } from "../../components/ui/GlassSurface";
import { OnboardingShell } from "../../components/ui/OnboardingShell";

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

export function NotificationScreen({ onComplete, onBack }: NotificationScreenProps) {
  const { colors } = useTheme();
  const { t } = useLanguage();
  const [granted, setGranted] = useState(false);

  const headingAnim = useFadeInUp(0);
  const subheadingAnim = useFadeInUp(80);
  const row1Anim = useFadeInUp(160);
  const row2Anim = useFadeInUp(260);
  const row3Anim = useFadeInUp(360);

  // Checkmark animation
  const checkScale = useSharedValue(0);
  const checkStyle = useAnimatedStyle(() => ({
    transform: [{ scale: checkScale.value }],
    opacity: checkScale.value,
  }));

  const handleEnable = async () => {
    try {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status === "granted") {
        setGranted(true);
        checkScale.value = withSpring(1, BOUNCY);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        // Delay before completing
        setTimeout(onComplete, 500);
      } else {
        // Permission denied — advance silently
        onComplete();
      }
    } catch {
      // Exception in permission request — advance silently
      console.warn("Notification permission request failed, advancing silently");
      onComplete();
    }
  };

  const notifExamples = [
    {
      icon: "notifications-outline" as const,
      text: t.onboarding.notifExample1,
      anim: row1Anim,
    },
    {
      icon: "cash-outline" as const,
      text: t.onboarding.notifExample2,
      anim: row2Anim,
    },
    {
      icon: "mail-outline" as const,
      text: t.onboarding.notifExample3,
      anim: row3Anim,
    },
  ];

  return (
    <OnboardingShell
      progress={1.0}
      onBack={onBack}
      ctaLabel={t.onboarding.enableNotifications}
      onCta={handleEnable}
      secondaryCta={{ label: t.onboarding.maybeLater, onPress: onComplete }}
    >
      {/* Heading */}
      <Animated.View style={headingAnim}>
        <AppText variant="screenTitle" color={colors.textPrimary}>
          {t.onboarding.notifTitle}
        </AppText>
      </Animated.View>

      {/* Subheading */}
      <Animated.View style={[{ marginTop: SPACE.md }, subheadingAnim]}>
        <AppText variant="body" color={colors.textSecondary}>
          {t.onboarding.notifSubtitle}
        </AppText>
      </Animated.View>

      {/* Notification examples */}
      <View style={styles.examplesWrapper}>
        <GlassSurface noInner>
          <View style={styles.examplesContent}>
            {notifExamples.map((item, index) => (
              <Animated.View key={item.icon} style={item.anim}>
                <View
                  style={[
                    styles.exampleRow,
                    index < notifExamples.length - 1 && {
                      borderBottomWidth: 1,
                      borderBottomColor: colors.border,
                    },
                  ]}
                >
                  <Ionicons name={item.icon} size={24} color={colors.textSecondary} />
                  <AppText variant="body" color={colors.textPrimary} style={styles.exampleText}>
                    {item.text}
                  </AppText>
                </View>
              </Animated.View>
            ))}
          </View>
        </GlassSurface>
      </View>

      {/* Success checkmark (only shows after permission granted) */}
      {granted && (
        <Animated.View style={[styles.checkWrapper, checkStyle]}>
          <Ionicons name="checkmark-circle" size={48} color={colors.orange} />
        </Animated.View>
      )}
    </OnboardingShell>
  );
}

const styles = StyleSheet.create({
  examplesWrapper: {
    marginTop: LAYOUT.sectionGap,
  },
  examplesContent: {
    padding: LAYOUT.cardPadding,
  },
  exampleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.md,
    paddingVertical: SPACE.md,
  },
  exampleText: {
    flex: 1,
  },
  checkWrapper: {
    alignItems: "center",
    marginTop: LAYOUT.sectionGap,
  },
});
