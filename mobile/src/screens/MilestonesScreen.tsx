import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { api } from "../api/client";
import { COLORS } from "../styles/liquidGlass";
import { FONT, SPACE, RADIUS, LAYOUT } from "../styles/tokens";

interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  earned: boolean;
}

interface BadgeData {
  badges: Badge[];
  earned_count: number;
  total_badges: number;
  streak: {
    current: number;
    longest: number;
    start_date: string | null;
  };
}

export function MilestonesScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const [data, setData] = useState<BadgeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const res = await api.get("/users/me/badges");
      setData(res.data);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, [fetchData]);

  const streak = data?.streak?.current ?? 0;
  const longestStreak = data?.streak?.longest ?? 0;
  const earnedCount = data?.earned_count ?? 0;
  const totalBadges = data?.total_badges ?? 0;
  const badges = data?.badges ?? [];
  const streakStartDate = data?.streak?.start_date;

  const badgeProgress = totalBadges > 0 ? earnedCount / totalBadges : 0;

  if (loading) {
    return (
      <View style={[styles.root, styles.center]}>
        <ActivityIndicator size="large" color={COLORS.orange} />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable
            style={({ pressed }) => [styles.headerBtn, pressed && { opacity: 0.7 }]}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color={COLORS.text.primary} />
          </Pressable>
          <Text style={styles.headerTitle}>Milestones</Text>
          <Pressable
            style={({ pressed }) => [styles.headerBtn, pressed && { opacity: 0.7 }]}
            onPress={() =>
              navigation.navigate("ShareCard", {
                streak,
                streakStartDate,
              })
            }
          >
            <Ionicons name="share-outline" size={24} color={COLORS.text.primary} />
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.text.secondary} />
          }
        >
          {/* Hero Section */}
          <View style={styles.heroRow}>
            {/* Day Streak */}
            <View style={styles.heroCard}>
              <Text style={styles.heroEmoji}>{"\uD83D\uDD25"}</Text>
              <Text style={styles.heroNumber}>{streak}</Text>
              <Text style={styles.heroLabel}>Day Streak</Text>
            </View>
            {/* Badges Earned */}
            <View style={styles.heroCard}>
              <View style={styles.badgeIconWrap}>
                <Ionicons name="shield-checkmark" size={48} color={COLORS.text.secondary} />
                <View style={styles.badgeCountBubble}>
                  <Text style={styles.badgeCountText}>{earnedCount}</Text>
                </View>
              </View>
              <Text style={styles.heroLabel}>Badges earned</Text>
            </View>
          </View>

          {/* Stats Row */}
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <View style={styles.statIconRow}>
                <Text style={{ fontSize: FONT.screenTitle.size }}>{"\uD83D\uDD25"}</Text>
                <Text style={styles.statValue}>{longestStreak} days</Text>
              </View>
              <Text style={styles.statLabel}>longest streak</Text>
            </View>
            <View style={styles.statCard}>
              <View style={styles.statIconRow}>
                <View style={styles.progressDot} />
                <Text style={styles.statValue}>
                  {earnedCount}/{totalBadges} badges
                </Text>
              </View>
              <View style={styles.progressBarBg}>
                <View style={[styles.progressBarFill, { width: `${badgeProgress * 100}%` }]} />
              </View>
            </View>
          </View>

          {/* Badge Grid */}
          <View style={styles.badgeGrid}>
            {badges.map((badge) => (
              <View key={badge.id} style={styles.badgeItem}>
                <View style={[styles.badgeHex, !badge.earned && styles.badgeHexDimmed]}>
                  <Text style={[styles.badgeEmoji, !badge.earned && styles.badgeEmojiDimmed]}>
                    {badge.icon}
                  </Text>
                </View>
                <Text
                  style={[styles.badgeName, !badge.earned && styles.badgeNameDimmed]}
                  numberOfLines={1}
                >
                  {badge.name}
                </Text>
                <Text
                  style={[styles.badgeDesc, !badge.earned && styles.badgeDescDimmed]}
                  numberOfLines={2}
                >
                  {badge.description}
                </Text>
              </View>
            ))}
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.deepBlack,
  },
  center: {
    justifyContent: "center",
    alignItems: "center",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: LAYOUT.screenPadding,
    paddingVertical: SPACE.md,
  },
  headerBtn: {
    width: LAYOUT.touchTarget,
    height: LAYOUT.touchTarget,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.glass.bg,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: FONT.screenTitle.size,
    fontWeight: FONT.screenTitle.weight,
    color: COLORS.text.primary,
  },
  scrollContent: {
    paddingHorizontal: LAYOUT.screenPadding,
    paddingBottom: 40,
  },
  // Hero
  heroRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginTop: SPACE.xxl,
    marginBottom: SPACE.xxl,
  },
  heroCard: {
    alignItems: "center",
    flex: 1,
  },
  heroEmoji: {
    fontSize: 64,
  },
  heroNumber: {
    fontSize: 36,
    fontWeight: "800",
    color: COLORS.text.primary,
    marginTop: -8,
  },
  heroLabel: {
    fontSize: FONT.secondary.size,
    fontWeight: FONT.secondary.weight,
    color: COLORS.text.secondary,
    marginTop: SPACE.xs,
  },
  badgeIconWrap: {
    position: "relative",
    width: 64,
    height: 64,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeCountBubble: {
    position: "absolute",
    bottom: 0,
    right: -4,
    backgroundColor: COLORS.orange,
    borderRadius: RADIUS.full,
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeCountText: {
    fontSize: FONT.micro.size,
    fontWeight: "700",
    color: "#fff",
  },
  // Stats
  statsRow: {
    flexDirection: "row",
    gap: SPACE.md,
    marginBottom: SPACE.xxxl,
  },
  statCard: {
    flex: 1,
    backgroundColor: COLORS.glass.bg,
    borderRadius: RADIUS.lg,
    padding: LAYOUT.cardPadding,
    borderWidth: 1,
    borderColor: COLORS.glass.border,
  },
  statIconRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.sm,
  },
  statValue: {
    fontSize: FONT.body.size,
    fontWeight: "600",
    color: COLORS.text.primary,
  },
  statLabel: {
    fontSize: FONT.meta.size,
    color: COLORS.text.muted,
    marginTop: SPACE.xs,
  },
  progressDot: {
    width: 16,
    height: 16,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.text.secondary,
  },
  progressBarBg: {
    height: 6,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 3,
    marginTop: SPACE.sm,
    overflow: "hidden",
  },
  progressBarFill: {
    height: 6,
    backgroundColor: COLORS.orange,
    borderRadius: 3,
  },
  // Badge Grid
  badgeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  badgeItem: {
    width: "31%",
    alignItems: "center",
    marginBottom: SPACE.xxl,
  },
  badgeHex: {
    width: 80,
    height: 80,
    borderRadius: RADIUS.lg,
    backgroundColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: SPACE.sm,
  },
  badgeHexDimmed: {
    opacity: 0.4,
  },
  badgeEmoji: {
    fontSize: 36,
  },
  badgeEmojiDimmed: {
    opacity: 0.5,
  },
  badgeName: {
    fontSize: FONT.secondary.size,
    fontWeight: "600" as const,
    color: COLORS.text.primary,
    textAlign: "center",
  },
  badgeNameDimmed: {
    color: COLORS.text.muted,
  },
  badgeDesc: {
    fontSize: FONT.micro.size,
    color: COLORS.text.secondary,
    textAlign: "center",
    marginTop: 2,
  },
  badgeDescDimmed: {
    color: COLORS.text.muted,
  },
});
