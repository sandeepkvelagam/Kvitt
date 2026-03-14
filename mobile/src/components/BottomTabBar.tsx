import React from "react";
import { View, TouchableOpacity, Text, StyleSheet, Platform } from "react-native";
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

export function BottomTabBar({ activeTab, onTabPress, onFabPress, userInitial = "S" }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const fabScale = useSharedValue(1);

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
            <View style={styles.tabBarInner}>
              {TABS.map((tab) => {
                const isActive = activeTab === tab.name;
                const isAvatar = tab.icon === "__avatar__";
                return (
                  <TouchableOpacity
                    key={tab.name}
                    onPress={() => onTabPress(tab.name)}
                    style={styles.tab}
                    activeOpacity={0.7}
                  >
                    {isActive && <View style={styles.activeIndicator} />}
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
  },
  tab: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 5,
    position: "relative",
  },
  activeIndicator: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 28,
    backgroundColor: "rgba(255,255,255,0.96)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
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
