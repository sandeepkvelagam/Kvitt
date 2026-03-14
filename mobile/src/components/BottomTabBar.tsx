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

  return (
    <View style={[styles.container, { paddingBottom: Math.max(insets.bottom, 6) }]}>
      <View style={styles.row}>
        {/* Tab bar */}
        <View style={styles.tabBarOuter}>
          <BlurView
            intensity={Platform.OS === "ios" ? 24 : 10}
            tint="light"
            style={styles.tabBarBlur}
          >
            <View style={styles.tabBarInner} onLayout={onBarLayout}>
              {/* Sliding indicator */}
              <Animated.View style={[styles.slidingIndicator, indicatorStyle]} />

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
                        <View style={[styles.avatar, isActive && styles.avatarActive]}>
                          <Text style={styles.avatarText}>{userInitial}</Text>
                        </View>
                      ) : (
                        <Ionicons
                          name={(isActive ? tab.iconFilled : tab.icon) as any}
                          size={isActive ? 20 : 18}
                          color={isActive ? "#000000" : "#8E8E93"}
                        />
                      )}
                      <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>
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
            style={styles.fab}
            activeOpacity={0.9}
          >
            <Ionicons name="add" size={22} color="#FFFFFF" />
          </TouchableOpacity>
        </Animated.View>
      </View>

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 14,
    paddingTop: 4,
    paddingBottom: 4,
    backgroundColor: "transparent",
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
  },
  tabBarOuter: {
    flex: 1,
    borderRadius: 40,
    overflow: "hidden",
  },
  tabBarBlur: {
    borderRadius: 40,
  },
  tabBarInner: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 4,
    paddingHorizontal: 3,
    backgroundColor: "rgba(245,245,245,0.85)",
    position: "relative",
  },
  slidingIndicator: {
    position: "absolute",
    top: 4,
    left: 3,
    bottom: 4,
    borderRadius: 28,
    backgroundColor: "rgba(255,255,255,0.96)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 5,
  },
  tabContent: {
    alignItems: "center",
  },
  tabLabel: {
    fontSize: 9,
    fontWeight: "500",
    color: "#8E8E93",
    marginTop: 2,
  },
  tabLabelActive: {
    fontSize: 9,
    fontWeight: "700",
    color: "#000000",
  },
  /* Orange avatar circle for Profile tab */
  avatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#EE6C29",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarActive: {
    width: 22,
    height: 22,
    borderRadius: 11,
  },
  avatarText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "700",
  },
  fab: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "#1C1C1E",
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
