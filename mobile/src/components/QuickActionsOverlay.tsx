/**
 * Global quick-actions sheet (opened from tab bar FAB on Home, Groups, Profile, Chats).
 * Hoisted above the tab navigator so it appears on top of any tab.
 */
import React, { useCallback, useEffect, useState } from "react";
import { View, Pressable, TouchableOpacity, StyleSheet, Dimensions, Platform } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolate,
  Easing,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../context/ThemeContext";
import { useLanguage } from "../context/LanguageContext";
import { useHomeQuickActions } from "../context/HomeQuickActionsContext";
import { useStartGameModal } from "../context/StartGameModalContext";
import { Title2, Subhead } from "./ui";
import { QUICK_ACTIONS, type QuickActionDef } from "../screens/dashboardQuickActionsConfig";
import { appleTileShadow } from "../styles/appleShadows";
import { SPACE, LAYOUT, RADIUS, BUTTON_SIZE } from "../styles/tokens";
import type { TranslationKeys } from "../i18n/translations";
import type { RootStackParamList } from "../navigation/RootNavigator";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const SCREEN_PAD = LAYOUT.screenPadding;
const QUICK_GRID_GAP = LAYOUT.elementGap;
const QA_ANIM_OPEN_MS = 280;
const QA_ANIM_CLOSE_MS = 240;
const TAB_BAR_RESERVE_BASE = 128;

function quickActionLabel(action: QuickActionDef, tr: TranslationKeys): string {
  switch (action.id) {
    case "schedule":
      return tr.scheduler.title;
    case "startGame":
      return tr.game.startGame;
    case "ai":
      return tr.nav.aiAssistant;
    case "settlements":
      return tr.nav.settlements;
    default:
      return action.id;
  }
}

export function QuickActionsOverlay() {
  const { quickActionsOpen, setQuickActionsOpen } = useHomeQuickActions();
  const { openStartGame } = useStartGameModal();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const { t } = useLanguage();
  const [mounted, setMounted] = useState(false);
  const qaOpenProgress = useSharedValue(0);

  const tabBarReserve = TAB_BAR_RESERVE_BASE + Math.max(insets.bottom, 8);
  const quickTileWidth = (SCREEN_WIDTH - SCREEN_PAD * 2 - QUICK_GRID_GAP) / 2;

  const close = useCallback(() => setQuickActionsOpen(false), [setQuickActionsOpen]);

  useEffect(() => {
    if (quickActionsOpen) {
      setMounted(true);
      qaOpenProgress.value = withTiming(1, {
        duration: QA_ANIM_OPEN_MS,
        easing: Easing.out(Easing.cubic),
      });
      return;
    }
    qaOpenProgress.value = withTiming(0, {
      duration: QA_ANIM_CLOSE_MS,
      easing: Easing.in(Easing.cubic),
    });
    const timer = setTimeout(() => setMounted(false), QA_ANIM_CLOSE_MS);
    return () => clearTimeout(timer);
  }, [quickActionsOpen]);

  const qaDimStyle = useAnimatedStyle(() => ({
    opacity: interpolate(qaOpenProgress.value, [0, 1], [0, 1]),
  }));

  const qaPanelStyle = useAnimatedStyle(() => ({
    opacity: interpolate(qaOpenProgress.value, [0, 1], [0, 1]),
    transform: [{ translateY: interpolate(qaOpenProgress.value, [0, 1], [24, 0]) }],
  }));

  const onQuickActionPress = useCallback(
    (action: QuickActionDef) => {
      close();
      if (action.id === "startGame") {
        // Defer so overlay hit-testing / teardown cannot race the modal on Android.
        requestAnimationFrame(() => {
          openStartGame();
        });
        return;
      }
      if (action.screen === "SettlementHistory") {
        navigation.navigate("SettlementHistory" as never);
        return;
      }
      if (action.screen) {
        navigation.navigate(action.screen as never);
      }
    },
    [close, navigation, openStartGame]
  );

  if (!mounted) return null;

  return (
    <View style={styles.overlayRoot} pointerEvents="box-none">
      <Animated.View style={[StyleSheet.absoluteFill, qaDimStyle]} pointerEvents="none">
        <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(0,0,0,0.4)" }]} />
      </Animated.View>
      <Pressable
        style={[StyleSheet.absoluteFill, styles.backdropPressable]}
        onPress={close}
        accessibilityLabel="Dismiss quick actions"
        disabled={!quickActionsOpen}
      />
      <Animated.View
        pointerEvents="box-none"
        style={[
          StyleSheet.absoluteFill,
          styles.overlayBottom,
          styles.quickPanelLayer,
          { paddingBottom: tabBarReserve + SPACE.sm },
          qaPanelStyle,
        ]}
      >
        <View style={[styles.quickHeaderBlock, { width: SCREEN_WIDTH - SCREEN_PAD * 2 }]}>
          <Title2 style={styles.quickHeaderTitle}>{t.dashboard.quickActionsTitle}</Title2>
          <Subhead style={styles.quickHeaderSub}>{t.dashboard.quickActionsSubtitle}</Subhead>
        </View>
        <View style={[styles.quickGrid, { width: SCREEN_WIDTH - SCREEN_PAD * 2, gap: QUICK_GRID_GAP }]}>
          {QUICK_ACTIONS.map((action) => (
            <TouchableOpacity
              key={action.id}
              activeOpacity={0.85}
              onPress={() => onQuickActionPress(action)}
              style={[
                styles.quickTile,
                {
                  width: quickTileWidth,
                  backgroundColor: isDark ? "rgba(45, 45, 48, 0.98)" : "rgba(255, 255, 255, 0.98)",
                  borderColor: isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.08)",
                  ...appleTileShadow(isDark),
                },
              ]}
            >
              <Ionicons name={action.icon as any} size={28} color={colors.textPrimary} />
              <Subhead
                bold
                numberOfLines={2}
                style={{ marginTop: SPACE.sm, textAlign: "center", color: colors.textPrimary }}
              >
                {quickActionLabel(action, t)}
              </Subhead>
            </TouchableOpacity>
          ))}
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlayRoot: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 220,
  },
  /** Below quick panel so tiles always receive presses (Android hit-testing). */
  backdropPressable: {
    zIndex: 0,
  },
  /** Above backdrop; elevation on Android matches zIndex for touch order. */
  quickPanelLayer: {
    zIndex: 1,
    ...(Platform.OS === "android" ? { elevation: 12 } : {}),
  },
  overlayBottom: {
    justifyContent: "flex-end",
    alignItems: "center",
  },
  quickHeaderBlock: {
    marginBottom: SPACE.md,
    paddingHorizontal: SPACE.xs,
  },
  quickHeaderTitle: {
    letterSpacing: -0.35,
  },
  quickHeaderSub: {
    marginTop: SPACE.xs,
    lineHeight: 20,
    opacity: 0.88,
  },
  quickGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
  },
  quickTile: {
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    minHeight: BUTTON_SIZE.compact.height + SPACE.xxxl,
    paddingVertical: SPACE.md,
    paddingHorizontal: SPACE.sm,
    alignItems: "center",
    justifyContent: "center",
  },
});
