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

type TabName = "Home" | "Progress" | "Groups" | "Settings";

interface BottomTabBarProps {
  activeTab: TabName;
  onTabPress: (tab: TabName) => void;
  onFabPress: () => void;
}

const TABS: { name: TabName; icon: string; iconFilled: string }[] = [
  { name: "Home", icon: "home-outline", iconFilled: "home" },
  { name: "Progress", icon: "bar-chart-outline", iconFilled: "bar-chart" },
  { name: "Groups", icon: "people-outline", iconFilled: "people" },
  { name: "Settings", icon: "settings-outline", iconFilled: "settings-sharp" },
];

/**
 * BottomTabBar — Floating tab bar with glass blur + black FAB.
 * Matches Figma Home screen bottom nav exactly.
 */
export function BottomTabBar({ activeTab, onTabPress, onFabPress }: BottomTabBarProps) {
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
    <View style={[styles.container, { paddingBottom: Math.max(insets.bottom, 8) }]}>
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
                return (
                  <TouchableOpacity
                    key={tab.name}
                    onPress={() => onTabPress(tab.name)}
                    style={styles.tab}
                    activeOpacity={0.7}
                  >
                    {isActive && <View style={styles.activeIndicator} />}
                    <Ionicons
                      name={(isActive ? tab.iconFilled : tab.icon) as any}
                      size={isActive ? 24 : 22}
                      color={isActive ? "#000000" : "#8E8E93"}
                    />
                    <Text
                      style={[
                        styles.tabLabel,
                        isActive && styles.tabLabelActive,
                      ]}
                    >
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
            <Ionicons name="add" size={26} color="#FFFFFF" />
          </TouchableOpacity>
        </Animated.View>
      </View>

      {/* Home indicator */}
      <View style={styles.homeIndicator}>
        <View style={styles.homeIndicatorBar} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 12,
    paddingTop: 4,
    backgroundColor: "#F8F8F6",
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
  },
  tabBarOuter: {
    flex: 1,
    borderRadius: 28,
    overflow: "hidden",
  },
  tabBarBlur: {
    borderRadius: 28,
  },
  tabBarInner: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
    paddingHorizontal: 4,
    backgroundColor: "rgba(255,255,255,0.7)",
  },
  tab: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 8,
    position: "relative",
  },
  activeIndicator: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.95)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: "400",
    color: "#8E8E93",
    marginTop: 4,
  },
  tabLabelActive: {
    fontSize: 11,
    fontWeight: "600",
    color: "#000000",
  },
  fab: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: "#1C1C1E",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 8,
  },
  homeIndicator: {
    alignItems: "center",
    paddingTop: 10,
    paddingBottom: 4,
  },
  homeIndicatorBar: {
    width: 134,
    height: 5,
    borderRadius: 9999,
    backgroundColor: "rgba(0,0,0,0.15)",
  },
});
