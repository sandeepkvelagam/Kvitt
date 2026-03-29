import React, { useCallback, useEffect } from "react";
import { View, TouchableOpacity, Text, StyleSheet, Platform, LayoutChangeEvent } from "react-native";
import { BlurView } from "expo-blur";
import { AppIcon, type IconName } from "./icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { BottomTabBarProps as RNTabBarProps } from "@react-navigation/bottom-tabs";
import { CommonActions } from "@react-navigation/native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  interpolate,
  Easing,
} from "react-native-reanimated";
import { useTheme } from "../context/ThemeContext";
import { useLanguage } from "../context/LanguageContext";
import { RADIUS } from "../styles/tokens";
import type { TranslationKeys } from "../i18n/translations";
import type { MainTabParamList } from "../navigation/mainTabTypes";

export type TabName = keyof MainTabParamList;

type TabEntry =
  | { name: TabName; kind: "avatar" }
  | { name: TabName; kind: "symbol"; outline: IconName; filled: IconName };

const TABS: TabEntry[] = [
  { name: "Home", kind: "symbol", outline: "tabHomeOutline", filled: "tabHomeFill" },
  { name: "Chats", kind: "symbol", outline: "tabChatsOutline", filled: "tabChatsFill" },
  { name: "Groups", kind: "symbol", outline: "tabGroupsOutline", filled: "tabGroupsFill" },
  { name: "Profile", kind: "avatar" },
];

const TAB_COUNT = TABS.length;

const SPRING_CONFIG = { damping: 18, stiffness: 200, mass: 0.8 };
const FAB_ICON_MS = 260;
const FAB_EASING = Easing.bezier(0.25, 0.1, 0.25, 1);

function getTabIndex(tab: TabName): number {
  return TABS.findIndex((t) => t.name === tab);
}

function tabLabel(tab: TabName, t: TranslationKeys): string {
  switch (tab) {
    case "Home":
      return "Home";
    case "Chats":
      return t.nav.chats;
    case "Groups":
      return t.nav.groups;
    case "Profile":
      return t.nav.profile;
    default:
      return tab;
  }
}

export type MainAppTabBarExtraProps = {
  quickActionsOpen: boolean;
  onQuickActionsToggle: () => void;
  userInitial: string;
  /** Close quick actions when user leaves Home (called from parent on tab index change). */
  onTabIndexChange?: (index: number, routeName: string) => void;
};

export function MainAppTabBar({
  state,
  navigation,
  insets: tabSafeInsets,
  quickActionsOpen,
  onQuickActionsToggle,
  userInitial,
  onTabIndexChange,
}: RNTabBarProps & MainAppTabBarExtraProps) {
  const insets = useSafeAreaInsets();
  const { isDark, colors } = useTheme();
  const { t } = useLanguage();

  const activeRoute = state.routes[state.index]?.name as TabName;
  const activeTab = activeRoute ?? "Home";
  const trailingMode: "fab" | "searchOnly" | "none" =
    activeTab === "Chats"
      ? "searchOnly"
      : activeTab === "Home" || activeTab === "Groups" || activeTab === "Profile"
        ? "fab"
        : "none";

  useEffect(() => {
    const route = state.routes[state.index];
    onTabIndexChange?.(state.index, route?.name ?? "");
  }, [state.index, state.routes, onTabIndexChange]);

  const activeIndex = useSharedValue(getTabIndex(activeTab));
  const barWidth = useSharedValue(0);
  const fabOpenProgress = useSharedValue(quickActionsOpen ? 1 : 0);
  const tabScales = [useSharedValue(1), useSharedValue(1), useSharedValue(1), useSharedValue(1)];

  useEffect(() => {
    activeIndex.value = withSpring(getTabIndex(activeTab), SPRING_CONFIG);
  }, [activeTab]);

  useEffect(() => {
    fabOpenProgress.value = withTiming(quickActionsOpen ? 1 : 0, {
      duration: FAB_ICON_MS,
      easing: FAB_EASING,
    });
  }, [quickActionsOpen]);

  const onBarLayout = useCallback((e: LayoutChangeEvent) => {
    barWidth.value = e.nativeEvent.layout.width;
  }, []);

  const indicatorStyle = useAnimatedStyle(() => {
    const innerWidth = Math.max(0, barWidth.value - 16);
    const tabW = innerWidth / TAB_COUNT;
    return {
      width: tabW,
      transform: [{ translateX: activeIndex.value * tabW }],
    };
  });

  const tabStyle0 = useAnimatedStyle(() => ({ transform: [{ scale: tabScales[0].value }] }));
  const tabStyle1 = useAnimatedStyle(() => ({ transform: [{ scale: tabScales[1].value }] }));
  const tabStyle2 = useAnimatedStyle(() => ({ transform: [{ scale: tabScales[2].value }] }));
  const tabStyle3 = useAnimatedStyle(() => ({ transform: [{ scale: tabScales[3].value }] }));
  const tabStyles = [tabStyle0, tabStyle1, tabStyle2, tabStyle3];

  const fabPlusStyle = useAnimatedStyle(() => ({
    opacity: interpolate(fabOpenProgress.value, [0, 0.4, 0.75, 1], [1, 0.85, 0.2, 0]),
    transform: [
      { rotate: `${interpolate(fabOpenProgress.value, [0, 1], [0, 45])}deg` },
      { scale: interpolate(fabOpenProgress.value, [0, 1], [1, 0.65]) },
    ],
  }));

  const fabCloseStyle = useAnimatedStyle(() => ({
    opacity: interpolate(fabOpenProgress.value, [0, 0.25, 0.6, 1], [0, 0, 0.85, 1]),
    transform: [
      { rotate: `${interpolate(fabOpenProgress.value, [0, 1], [-55, 0])}deg` },
      { scale: interpolate(fabOpenProgress.value, [0, 1], [0.65, 1]) },
    ],
  }));

  const tabBarTint = isDark ? "rgba(28, 28, 30, 0.52)" : "rgba(255, 255, 255, 0.55)";
  const tabBarBorder = isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.08)";
  const indicatorBg = isDark ? "#3A3A3C" : "#E8E8ED";
  const activeColor = colors.textPrimary;
  const inactiveColor = colors.textMuted;

  const onTabPress = (tab: TabName, idx: number) => {
    const event = navigation.emit({
      type: "tabPress",
      target: state.routes[idx].key,
      canPreventDefault: true,
    });
    if (!event.defaultPrevented) {
      navigation.navigate(tab as never);
    }
  };

  const onSearchTrailingPress = useCallback(() => {
    navigation.dispatch(
      CommonActions.navigate({
        name: "Chats",
        params: { focusSearch: true },
        merge: true,
      })
    );
  }, [navigation]);

  return (
    <View
      style={[
        styles.container,
        {
          paddingBottom: Math.max(insets.bottom, tabSafeInsets.bottom, 4),
          zIndex: 200,
          elevation: Platform.OS === "android" ? 24 : undefined,
        },
      ]}
      pointerEvents="box-none"
    >
      <View style={styles.row}>
        <View
          style={[
            styles.tabBarOuter,
            {
              borderWidth: StyleSheet.hairlineWidth * 2,
              borderColor: tabBarBorder,
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: isDark ? 0.22 : 0.06,
              shadowRadius: isDark ? 10 : 14,
              elevation: isDark ? 6 : 3,
            },
          ]}
        >
          <BlurView
            intensity={Platform.OS === "ios" ? 42 : 18}
            tint={isDark ? "dark" : "light"}
            style={styles.tabBarBlur}
          >
            <View style={[styles.tabBarInner, { backgroundColor: tabBarTint }]} onLayout={onBarLayout}>
              <Animated.View style={[styles.slidingIndicator, { backgroundColor: indicatorBg }, indicatorStyle]} />

              {TABS.map((tab, idx) => {
                const isActive = activeTab === tab.name;
                const isAvatar = tab.kind === "avatar";
                return (
                  <TouchableOpacity
                    key={tab.name}
                    onPress={() => onTabPress(tab.name, idx)}
                    onPressIn={() => {
                      if (quickActionsOpen) return;
                      tabScales[idx].value = withSpring(0.88, { damping: 10, stiffness: 300, mass: 0.4 });
                    }}
                    onPressOut={() => {
                      if (quickActionsOpen) return;
                      tabScales[idx].value = withSpring(1, { damping: 8, stiffness: 400, mass: 0.3 });
                    }}
                    style={styles.tab}
                    activeOpacity={1}
                  >
                    <Animated.View style={[styles.tabContent, tabStyles[idx]]}>
                      {isAvatar ? (
                        <View
                          style={[
                            styles.avatar,
                            { backgroundColor: "#F26306" },
                            isActive && styles.avatarActive,
                          ]}
                        >
                          <Text style={[styles.avatarText, { color: "#FFFFFF" }]}>{userInitial}</Text>
                        </View>
                      ) : (
                        <AppIcon
                          name={isActive ? tab.filled : tab.outline}
                          size={isActive ? 20 : 18}
                          color={isActive ? activeColor : inactiveColor}
                        />
                      )}
                      <Text
                        style={[styles.tabLabel, { color: inactiveColor }, isActive && { color: activeColor }]}
                        numberOfLines={1}
                      >
                        {tabLabel(tab.name, t)}
                      </Text>
                    </Animated.View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </BlurView>
        </View>

        {trailingMode === "none" ? (
          <View style={styles.fabPlaceholder} />
        ) : trailingMode === "searchOnly" ? (
          <View>
            <TouchableOpacity
              onPress={onSearchTrailingPress}
              style={[styles.fab, { backgroundColor: colors.buttonPrimary }, appleFabShadow(isDark)]}
              activeOpacity={1}
              accessibilityLabel={t.chatsScreen.searchAccessibility}
            >
              <AppIcon name="fabSearch" size={26} color={colors.buttonText} />
            </TouchableOpacity>
          </View>
        ) : (
          <View>
            <TouchableOpacity
              onPress={onQuickActionsToggle}
              style={[styles.fab, { backgroundColor: colors.buttonPrimary }, appleFabShadow(isDark)]}
              activeOpacity={1}
              accessibilityLabel={quickActionsOpen ? "Close quick actions" : "Open quick actions"}
            >
              <View style={styles.fabIconSlot} pointerEvents="none">
                <Animated.View style={[styles.fabIconLayer, fabPlusStyle]}>
                  <AppIcon name="fabAdd" size={28} color={colors.buttonText} />
                </Animated.View>
                <Animated.View style={[styles.fabIconLayer, fabCloseStyle]}>
                  <AppIcon name="fabClose" size={28} color={colors.buttonText} />
                </Animated.View>
              </View>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
}

function appleFabShadow(isDark: boolean): object {
  if (Platform.OS === "android") {
    return { elevation: isDark ? 10 : 8 };
  }
  return {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: isDark ? 0.45 : 0.2,
    shadowRadius: 18,
  };
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 24,
    paddingTop: 4,
    paddingBottom: 2,
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
  },
  tabBarOuter: {
    flex: 1,
    borderRadius: RADIUS.full,
    overflow: "hidden",
  },
  tabBarBlur: {
    borderRadius: RADIUS.full,
  },
  tabBarInner: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 4,
    paddingHorizontal: 8,
    position: "relative",
  },
  slidingIndicator: {
    position: "absolute",
    top: 4,
    left: 8,
    bottom: 4,
    borderRadius: RADIUS.full,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
    paddingVertical: 10,
  },
  tabContent: {
    alignItems: "center",
    maxWidth: "100%",
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: "400",
    marginTop: 3,
  },
  avatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarActive: {
    width: 22,
    height: 22,
    borderRadius: 11,
  },
  avatarText: {
    fontSize: 10,
    fontWeight: "700",
  },
  fabPlaceholder: {
    width: 64,
    height: 64,
    marginBottom: 2,
  },
  fab: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
  },
  fabIconSlot: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  fabIconLayer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
});
