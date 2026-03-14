import React, { useState } from "react";
import { View, Text, ScrollView, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { BottomTabBar } from "../components/BottomTabBar";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DATES = [8, 9, 10, 11, 12, 13, 14];
const TODAY_INDEX = 5; // Friday

/**
 * DashboardScreenV3 — Redesigned dashboard matching Figma Home screen.
 * Warm off-white (#F8F8F6) bg, poker-adapted content, bottom tab bar.
 */
export function DashboardScreenV3() {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const [activeTab, setActiveTab] = useState<"Home" | "Progress" | "Groups" | "Profile">("Home");

  const handleTabPress = (tab: "Home" | "Progress" | "Groups" | "Profile") => {
    setActiveTab(tab);
    if (tab === "Groups") navigation.navigate("Groups");
    if (tab === "Profile") navigation.navigate("Profile");
  };

  const handleFabPress = () => {
    // Quick action — e.g., start a game or create group
    navigation.navigate("Groups");
  };

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={["top"]}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.headerEmoji}>{"\u2660\uFE0F"}</Text>
            <Text style={styles.headerTitle}>Kvitt</Text>
          </View>
          <View style={styles.streakBadge}>
            <Text style={styles.streakEmoji}>{"\uD83D\uDD25"}</Text>
            <Text style={styles.streakCount}>0</Text>
          </View>
        </View>

        {/* Week Calendar */}
        <View style={styles.weekStrip}>
          {DAYS.map((day, index) => {
            const active = index === TODAY_INDEX;
            return (
              <View key={day} style={styles.dayColumn}>
                <Text style={[styles.dayLabel, active && styles.dayLabelActive]}>
                  {day}
                </Text>
                <View style={[styles.dateCircle, active && styles.dateCircleActive]}>
                  <Text style={[styles.dateText, active && styles.dateTextActive]}>
                    {DATES[index]}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      </SafeAreaView>

      {/* Scrollable content */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Main stats card */}
        <View style={styles.mainCard}>
          <View style={styles.mainCardLeft}>
            <Text style={styles.bigNumber}>3</Text>
            <Text style={styles.bigLabel}>Games this week</Text>
          </View>
          <View style={styles.progressRing}>
            <Text style={styles.ringIcon}>{"\u2660\uFE0F"}</Text>
          </View>
        </View>

        {/* 3 Metric cards */}
        <View style={styles.metricRow}>
          {[
            { value: "$45", label: "Net balance", icon: "\uD83D\uDCB0" },
            { value: "5", label: "Players active", icon: "\uD83D\uDC65" },
            { value: "2", label: "Pending", icon: "\u23F3" },
          ].map((item) => (
            <View key={item.label} style={styles.metricCard}>
              <Text style={styles.metricValue}>{item.value}</Text>
              <Text style={styles.metricLabel}>{item.label}</Text>
              <View style={styles.metricIconRing}>
                <Text style={styles.metricIcon}>{item.icon}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Page dots */}
        <View style={styles.dots}>
          <View style={[styles.dot, styles.dotActive]} />
          <View style={styles.dot} />
          <View style={styles.dot} />
        </View>

        {/* Recent games */}
        <Text style={styles.sectionTitle}>Recent games</Text>
        <View style={styles.emptyCard}>
          <View style={styles.emptyPlaceholder}>
            <View style={styles.placeholderCircle} />
            <View style={styles.placeholderLines}>
              <View style={styles.placeholderLine1} />
              <View style={styles.placeholderLine2} />
            </View>
          </View>
          <Text style={styles.emptyText}>Tap + to start your first game</Text>
        </View>
      </ScrollView>

      {/* Bottom Tab Bar */}
      <BottomTabBar
        activeTab={activeTab}
        onTabPress={handleTabPress}
        onFabPress={handleFabPress}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8F8F6",
  },
  safeArea: {
    backgroundColor: "#F8F8F6",
  },
  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingTop: 12,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerEmoji: {
    fontSize: 28,
  },
  headerTitle: {
    color: "#1A1A1A",
    fontSize: 28,
    fontWeight: "700",
    letterSpacing: -28 * 0.03,
  },
  streakBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#FFFFFF",
    borderRadius: 9999,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  streakEmoji: {
    fontSize: 18,
  },
  streakCount: {
    color: "#1A1A1A",
    fontSize: 17,
    fontWeight: "600",
  },
  // Week calendar
  weekStrip: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    marginTop: 16,
  },
  dayColumn: {
    alignItems: "center",
  },
  dayLabel: {
    color: "#999999",
    fontSize: 12,
    fontWeight: "400",
  },
  dayLabelActive: {
    color: "#1A1A1A",
    fontWeight: "600",
  },
  dateCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
    borderWidth: 1.5,
    borderColor: "#D0D0D8",
    borderStyle: "dashed",
  },
  dateCircleActive: {
    backgroundColor: "#FFFFFF",
    borderWidth: 2,
    borderColor: "#C8C8D0",
    borderStyle: "solid",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  dateText: {
    color: "#B8B8C4",
    fontSize: 15,
    fontWeight: "500",
  },
  dateTextActive: {
    color: "#1A1A1A",
  },
  // Content
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
  },
  // Main card
  mainCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    paddingHorizontal: 24,
    paddingVertical: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 16,
    elevation: 2,
  },
  mainCardLeft: {},
  bigNumber: {
    color: "#000000",
    fontSize: 48,
    fontWeight: "700",
    letterSpacing: -48 * 0.04,
    lineHeight: 48,
  },
  bigLabel: {
    color: "#666666",
    fontSize: 15,
    marginTop: 4,
  },
  progressRing: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 8,
    borderColor: "#EEECF4",
    alignItems: "center",
    justifyContent: "center",
  },
  ringIcon: {
    fontSize: 28,
  },
  // Metric cards
  metricRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 12,
  },
  metricCard: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 16,
    elevation: 2,
  },
  metricValue: {
    color: "#000000",
    fontSize: 20,
    fontWeight: "700",
    letterSpacing: -20 * 0.02,
  },
  metricLabel: {
    color: "#666666",
    fontSize: 13,
    lineHeight: 13 * 1.3,
    marginTop: 2,
  },
  metricIconRing: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 6,
    borderColor: "#EEECF4",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginTop: 12,
  },
  metricIcon: {
    fontSize: 20,
  },
  // Dots
  dots: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
    marginTop: 16,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "rgba(0,0,0,0.15)",
  },
  dotActive: {
    backgroundColor: "#000000",
  },
  // Recent games
  sectionTitle: {
    color: "#1A1A1A",
    fontSize: 19,
    fontWeight: "700",
    letterSpacing: -19 * 0.02,
    marginTop: 24,
  },
  emptyCard: {
    backgroundColor: "#F2F2F7",
    borderRadius: 22,
    paddingHorizontal: 20,
    paddingVertical: 20,
    marginTop: 12,
  },
  emptyPlaceholder: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    alignSelf: "center",
    width: "85%",
  },
  placeholderCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#ECECF0",
  },
  placeholderLines: {
    flex: 1,
    gap: 8,
  },
  placeholderLine1: {
    height: 10,
    borderRadius: 5,
    backgroundColor: "#ECECF0",
    width: "100%",
  },
  placeholderLine2: {
    height: 8,
    borderRadius: 4,
    backgroundColor: "#ECECF0",
    width: "75%",
  },
  emptyText: {
    color: "#666666",
    fontSize: 15,
    textAlign: "center",
    marginTop: 12,
  },
});
