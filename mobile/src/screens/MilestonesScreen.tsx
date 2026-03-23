import React, { useState, useEffect, useCallback, useMemo } from "react";
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
import { useTheme } from "../context/ThemeContext";
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
  const { colors, isDark } = useTheme();
  const [data, setData] = useState<BadgeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fetchError, setFetchError] = useState(false);

  const themed = useMemo(
    () => ({
      glassBg: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)",
      glassBorder: isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.08)",
      badgeHex: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)",
      progressTrack: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.08)",
    }),
    [isDark]
  );

  const fetchData = useCallback(async () => {
    try {
      const res = await api.get("/users/me/badges");
      setData(res.data);
      setFetchError(false);
    } catch {
      setFetchError(true);
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
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.orange} />
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
        <View style={styles.header}>
          <Pressable
            style={({ pressed }) => [
              styles.headerBtn,
              { backgroundColor: themed.glassBg },
              pressed && { opacity: 0.7 },
            ]}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Milestones</Text>
          <Pressable
            style={({ pressed }) => [
              styles.headerBtn,
              { backgroundColor: themed.glassBg },
              pressed && { opacity: 0.7 },
            ]}
            onPress={() =>
              navigation.navigate("ShareCard", {
                streak,
                streakStartDate,
              })
            }
          >
            <Ionicons name="share-outline" size={24} color={colors.textPrimary} />
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.textMuted} />
          }
        >
          {fetchError && (
            <View
              style={[
                styles.errorBanner,
                {
                  backgroundColor: isDark ? "rgba(255, 69, 58, 0.15)" : "rgba(255, 69, 58, 0.1)",
                  borderColor: isDark ? "rgba(255, 69, 58, 0.4)" : "rgba(255, 69, 58, 0.3)",
                },
              ]}
            >
              <Text style={[styles.errorBannerText, { color: colors.textSecondary }]}>
                {"Couldn't load milestones. Check your connection."}
              </Text>
              <Pressable
                style={({ pressed }) => [
                  styles.errorRetry,
                  { backgroundColor: colors.orange },
                  pressed && { opacity: 0.8 },
                ]}
                onPress={() => {
                  setLoading(true);
                  fetchData();
                }}
              >
                <Text style={styles.errorRetryText}>Retry</Text>
              </Pressable>
            </View>
          )}
          <View style={styles.heroRow}>
            <View style={styles.heroCard}>
              <View style={styles.heroVisualSlot}>
                <View style={styles.heroStreakStack}>
                  <Text style={styles.heroEmoji}>{"\uD83D\uDD25"}</Text>
                  <Text style={[styles.heroNumber, { color: colors.textPrimary }]}>{streak}</Text>
                </View>
              </View>
              <Text style={[styles.heroLabel, { color: colors.textSecondary }]}>Day streak</Text>
            </View>
            <View style={styles.heroCard}>
              <View style={styles.heroVisualSlot}>
                <View style={styles.badgeIconWrap}>
                  <Ionicons name="shield-checkmark" size={48} color={colors.textSecondary} />
                  <View style={[styles.badgeCountBubble, { backgroundColor: colors.orange }]}>
                    <Text style={styles.badgeCountText}>{earnedCount}</Text>
                  </View>
                </View>
              </View>
              <Text style={[styles.heroLabel, { color: colors.textSecondary }]}>Badges earned</Text>
            </View>
          </View>

          <View style={styles.statsRow}>
            <View
              style={[
                styles.statCard,
                { backgroundColor: themed.glassBg, borderColor: themed.glassBorder },
              ]}
            >
              <View style={styles.statIconRow}>
                <Text style={{ fontSize: FONT.screenTitle.size }}>{"\uD83D\uDD25"}</Text>
                <Text style={[styles.statValue, { color: colors.textPrimary }]}>{longestStreak} days</Text>
              </View>
              <Text style={[styles.statLabel, { color: colors.textMuted }]}>longest streak</Text>
            </View>
            <View
              style={[
                styles.statCard,
                { backgroundColor: themed.glassBg, borderColor: themed.glassBorder },
              ]}
            >
              <View style={styles.statIconRow}>
                <View style={[styles.progressDot, { backgroundColor: colors.textSecondary }]} />
                <Text style={[styles.statValue, { color: colors.textPrimary }]}>
                  {earnedCount}/{totalBadges} badges
                </Text>
              </View>
              <View style={[styles.progressBarBg, { backgroundColor: themed.progressTrack }]}>
                <View style={[styles.progressBarFill, { width: `${badgeProgress * 100}%`, backgroundColor: colors.orange }]} />
              </View>
            </View>
          </View>

          <View style={styles.badgeGrid}>
            {badges.map((badge) => (
              <View key={badge.id} style={styles.badgeItem}>
                <View style={[styles.badgeHex, { backgroundColor: themed.badgeHex }, !badge.earned && styles.badgeHexDimmed]}>
                  <Text style={[styles.badgeEmoji, !badge.earned && styles.badgeEmojiDimmed]}>{badge.icon}</Text>
                </View>
                <Text
                  style={[styles.badgeName, { color: colors.textPrimary }, !badge.earned && { color: colors.textMuted }]}
                  numberOfLines={1}
                >
                  {badge.name}
                </Text>
                <Text
                  style={[styles.badgeDesc, { color: colors.textSecondary }, !badge.earned && { color: colors.textMuted }]}
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
  },
  center: {
    flex: 1,
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
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: FONT.screenTitle.size,
    fontWeight: FONT.screenTitle.weight,
  },
  scrollContent: {
    paddingHorizontal: LAYOUT.screenPadding,
    paddingBottom: 40,
  },
  errorBanner: {
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    padding: SPACE.md,
    marginBottom: SPACE.lg,
    gap: SPACE.sm,
  },
  errorBannerText: {
    fontSize: FONT.secondary.size,
    lineHeight: 20,
  },
  errorRetry: {
    alignSelf: "flex-start",
    paddingHorizontal: SPACE.lg,
    paddingVertical: SPACE.sm,
    borderRadius: RADIUS.md,
  },
  errorRetryText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: FONT.secondary.size,
  },
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
  /** Same height for streak + badges so captions share one baseline */
  heroVisualSlot: {
    height: 112,
    width: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  heroStreakStack: {
    alignItems: "center",
    justifyContent: "center",
  },
  heroEmoji: {
    fontSize: 64,
    lineHeight: 70,
  },
  heroNumber: {
    fontSize: 36,
    fontWeight: "800",
    marginTop: -6,
    lineHeight: 40,
  },
  heroLabel: {
    fontSize: FONT.secondary.size,
    fontWeight: "600" as const,
    marginTop: SPACE.sm,
    textAlign: "center",
    lineHeight: 20,
    width: "100%",
  },
  badgeIconWrap: {
    position: "relative",
    width: 72,
    height: 72,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeCountBubble: {
    position: "absolute",
    bottom: 0,
    right: -4,
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
  statsRow: {
    flexDirection: "row",
    gap: SPACE.md,
    marginBottom: SPACE.xxxl,
  },
  statCard: {
    flex: 1,
    borderRadius: RADIUS.lg,
    padding: LAYOUT.cardPadding,
    borderWidth: 1,
  },
  statIconRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.sm,
  },
  statValue: {
    fontSize: FONT.body.size,
    fontWeight: "600",
  },
  statLabel: {
    fontSize: FONT.meta.size,
    marginTop: SPACE.xs,
  },
  progressDot: {
    width: 16,
    height: 16,
    borderRadius: RADIUS.full,
  },
  progressBarBg: {
    height: 6,
    borderRadius: 3,
    marginTop: SPACE.sm,
    overflow: "hidden",
  },
  progressBarFill: {
    height: 6,
    borderRadius: 3,
  },
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
    textAlign: "center",
  },
  badgeDesc: {
    fontSize: FONT.micro.size,
    textAlign: "center",
    marginTop: 2,
  },
});
