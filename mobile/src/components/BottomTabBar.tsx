import React, { useCallback, useEffect } from "react";
import { View, TouchableOpacity, Text, StyleSheet, Platform, LayoutChangeEvent } from "react-native";
import { BlurView } from "expo-blur";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from "react-native-reanimated";
import { useTheme } from "../context/ThemeContext";
import { RADIUS } from "../styles/tokens";

type TabName = "Home" | "Progress" | "Groups" | "Profile";

interface BottomTabBarProps {
  activeTab: TabName;
  onTabPress: (tab: TabName) => void;
  onFabPress: () => void;
  /** First letter of user name, shown in the Profile avatar */
  userInitial?: string;
}

const TABS: { name: TabName; icon: string; iconFilled: string; iconSet?: "ionicons" | "material" }[] = [
  { name: "Home", icon: "home-outline", iconFilled: "home", iconSet: "material" },
  { name: "Progress", icon: "stats-chart-outline", iconFilled: "stats-chart" },
  { name: "Groups", icon: "account-group-outline", iconFilled: "account-group", iconSet: "material" },
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

  // Sliding indicator style — account for padding so Profile (rightmost) doesn't clip
  const indicatorStyle = useAnimatedStyle(() => {
    const innerWidth = Math.max(0, barWidth.value - 16);
    const tabW = innerWidth / TAB_COUNT;
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

  // Theme-aware colors — match Cal AI: dark = black page + gray nav + gray selection; light = light page + white nav + light gray selection
  const tabBarBg = colors.navBarBackground ?? (isDark ? "#171717" : "#FFFFFF");
  const tabBarBorder = isDark ? "rgba(255,255,255,0.18)" : "rgba(0,0,0,0.12)";
  const indicatorBg = isDark ? "#3A3A3C" : "#E8E8ED";
  const activeColor = colors.textPrimary;
  const inactiveColor = colors.textMuted;

  return (
    <View
      style={[
        styles.container,
        { paddingBottom: Math.max(insets.bottom, 4) },
      ]}
      pointerEvents="box-none"
    >
      <View style={styles.row}>
        {/* Tab bar */}
        <View style={[
          styles.tabBarOuter,
          {
            borderWidth: 1,
            borderColor: tabBarBorder,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: isDark ? 0.35 : 0.08,
            shadowRadius: isDark ? 12 : 16,
            elevation: isDark ? 8 : 4,
          },
        ]}>
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
                          { backgroundColor: "#F26306" },
                          isActive && styles.avatarActive,
                        ]}>
                          <Text style={[styles.avatarText, { color: "#FFFFFF" }]}>{userInitial}</Text>
                        </View>
                      ) : tab.iconSet === "material" ? (
                        <MaterialCommunityIcons
                          name={(isActive ? tab.iconFilled : tab.icon) as any}
                          size={isActive ? 20 : 18}
                          color={isActive ? activeColor : inactiveColor}
                        />
                      ) : (
                        <Ionicons
                          name={(isActive ? tab.iconFilled : tab.icon) as any}
                          size={isActive ? 20 : 18}
                          color={isActive ? activeColor : inactiveColor}
                        />
                      )}
                      <Text style={[
                        styles.tabLabel,
                        { color: inactiveColor },
                        isActive && { color: activeColor },
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
            <Ionicons name="add" size={28} color={colors.buttonText} />
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
  },
  tabLabel: {
    fontSize: 12,
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
  fab: {
    width: 64,
    height: 64,
    borderRadius: 32,
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