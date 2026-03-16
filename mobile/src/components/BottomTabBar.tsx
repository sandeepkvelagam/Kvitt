import React, { useCallback, useEffect } from "react";
import { View, TouchableOpacity, Text, StyleSheet, Platform, LayoutChangeEvent } from "react-native";
import { BlurView } from "expo-blur";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from "react-native-reanimated";
import { useTheme } from "../context/ThemeContext";

type TabName = "Home" | "Progress" | "Groups" | "Profile";

interface BottomTabBarProps {
  activeTab: TabName;
  onTabPress: (tab: TabName) => void;
  onFabPress: () => void;
  /** First letter of user name, shown in the Profile avatar */
  userInitial?: string;
}

const TABS: { name: TabName; icon: string; iconFilled: string }[] = [
  { name: "Home", icon: "home-outline", iconFilled: "home" },
  { name: "Progress", icon: "stats-chart-outline", iconFilled: "stats-chart" },
  { name: "Groups", icon: "people-outline", iconFilled: "people" },
  { name: "Profile", icon: "__avatar__", iconFilled: "__avatar__" },
];

const TAB_COUNT = TABS.length;

const SPRING_CONFIG = { damping: 18, stiffness: 200, mass: 0.8 };

function getTabIndex(tab: TabName): number {
  return TABS.findIndex((t) => t.name === tab);
}

export function BottomTabBar({ activeTab, onTabPress, onFabPress, userInitial = "S" }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const { isDark, colors } = useTheme();

  // Animated indicator position
  const activeIndex = useSharedValue(getTabIndex(activeTab));
  const barWidth = useSharedValue(0);

  // FAB scale
  const fabScale = useSharedValue(1);

  // Per-tab press scale values
  const tabScales = [useSharedValue(1), useSharedValue(1), useSharedValue(1), useSharedValue(1)];

  // Sync activeIndex when activeTab prop changes
  useEffect(() => {
    activeIndex.value = withSpring(getTabIndex(activeTab), SPRING_CONFIG);
  }, [activeTab]);

  const onBarLayout = useCallback((e: LayoutChangeEvent) => {
    barWidth.value = e.nativeEvent.layout.width;
  }, []);

  // Sliding indicator style
  const indicatorStyle = useAnimatedStyle(() => {
    const tabW = barWidth.value / TAB_COUNT;
    return {
      width: tabW,
      transform: [{ translateX: activeIndex.value * tabW }],
    };
  });

  // Tab press scale styles
  const tabStyle0 = useAnimatedStyle(() => ({ transform: [{ scale: tabScales[0].value }] }));
  const tabStyle1 = useAnimatedStyle(() => ({ transform: [{ scale: tabScales[1].value }] }));
  const tabStyle2 = useAnimatedStyle(() => ({ transform: [{ scale: tabScales[2].value }] }));
  const tabStyle3 = useAnimatedStyle(() => ({ transform: [{ scale: tabScales[3].value }] }));
  const tabStyles = [tabStyle0, tabStyle1, tabStyle2, tabStyle3];

  const fabStyle = useAnimatedStyle(() => ({
    transform: [{ scale: fabScale.value }],
  }));

  const handleFabPressIn = () => {
    fabScale.value = withSpring(0.9, { damping: 8, stiffness: 200, mass: 0.5 });
  };
  const handleFabPressOut = () => {
    fabScale.value = withSpring(1, { damping: 5, stiffness: 400, mass: 0.3 });
  };

  // Theme-aware colors
  const tabBarBg = isDark ? "rgba(28,28,30,0.95)" : "rgba(255,255,255,0.95)";
  const indicatorBg = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)";
  const activeColor = colors.textPrimary;
  const inactiveColor = colors.textMuted;

  return (
    <View style={[styles.container, { paddingBottom: Math.max(insets.bottom, 6) }]}>
      <View style={styles.row}>
        {/* Tab bar */}
        <View style={styles.tabBarOuter}>
          <BlurView
            intensity={Platform.OS === "ios" ? 24 : 10}
            tint={isDark ? "dark" : "light"}
            style={styles.tabBarBlur}
          >
            <View style={[styles.tabBarInner, { backgroundColor: tabBarBg }]} onLayout={onBarLayout}>
              {/* Sliding indicator */}
              <Animated.View style={[styles.slidingIndicator, { backgroundColor: indicatorBg }, indicatorStyle]} />

              {TABS.map((tab, idx) => {
                const isActive = activeTab === tab.name;
                const isAvatar = tab.icon === "__avatar__";
                return (
                  <TouchableOpacity
                    key={tab.name}
                    onPress={() => onTabPress(tab.name)}
                    onPressIn={() => {
                      tabScales[idx].value = withSpring(0.88, { damping: 10, stiffness: 300, mass: 0.4 });
                    }}
                    onPressOut={() => {
                      tabScales[idx].value = withSpring(1, { damping: 8, stiffness: 400, mass: 0.3 });
                    }}
                    style={styles.tab}
                    activeOpacity={1}
                  >
                    <Animated.View style={[styles.tabContent, tabStyles[idx]]}>
                      {isAvatar ? (
                        <View style={[
                          styles.avatar,
                          { backgroundColor: colors.buttonPrimary },
                          isActive && styles.avatarActive,
                        ]}>
                          <Text style={[styles.avatarText, { color: colors.buttonText }]}>{userInitial}</Text>
                        </View>
                      ) : (
                        <Ionicons
                          name={(isActive ? tab.iconFilled : tab.icon) as any}
                          size={isActive ? 24 : 22}
                          color={isActive ? activeColor : inactiveColor}
                        />
                      )}
                      <Text style={[
                        styles.tabLabel,
                        { color: inactiveColor },
                        isActive && { fontWeight: "700", color: activeColor },
                      ]}>
                        {tab.name}
                      </Text>
                    </Animated.View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </BlurView>
        </View>

        {/* FAB */}
        <Animated.View style={fabStyle}>
          <TouchableOpacity
            onPress={onFabPress}
            onPressIn={handleFabPressIn}
            onPressOut={handleFabPressOut}
            style={[styles.fab, { backgroundColor: colors.buttonPrimary }]}
            activeOpacity={0.9}
          >
            <Ionicons name="add" size={24} color={colors.buttonText} />
          </TouchableOpacity>
        </Animated.View>
      </View>

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 4,
    backgroundColor: "transparent",
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
  },
  tabBarOuter: {
    flex: 1,
    borderRadius: 35,
    overflow: "hidden",
  },
  tabBarBlur: {
    borderRadius: 35,
  },
  tabBarInner: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
    paddingHorizontal: 4,
    position: "relative",
  },
  slidingIndicator: {
    position: "absolute",
    top: 6,
    left: 4,
    bottom: 6,
    borderRadius: 28,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 8,
  },
  tabContent: {
    alignItems: "center",
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: "500",
    marginTop: 3,
  },
  avatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarActive: {
    width: 26,
    height: 26,
    borderRadius: 13,
  },
  avatarText: {
    fontSize: 12,
    fontWeight: "700",
  },
  fab: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.22,
    shadowRadius: 16,
    elevation: 8,
  },
});
