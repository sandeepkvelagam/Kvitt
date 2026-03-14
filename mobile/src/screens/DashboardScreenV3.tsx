import React, { useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Dimensions,
  RefreshControl,
  TouchableOpacity,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { BottomTabBar } from "../components/BottomTabBar";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { LinearGradient } from "expo-linear-gradient";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const PAGE_WIDTH = SCREEN_WIDTH - 40; // matches paddingHorizontal: 20

/**
 * DashboardScreenV3 — Redesigned dashboard with swipeable data pages.
 * Warm off-white (#F8F8F6) bg, CalAI-inspired cards, real API data.
 */
export function DashboardScreenV3() {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<"Home" | "Progress" | "Groups" | "Settings">("Home");
  const [activePage, setActivePage] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  // API data
  const [stats, setStats] = useState<any>(null);
  const [balances, setBalances] = useState<any>({ net_balance: 0, total_you_owe: 0, total_owed_to_you: 0 });
  const [activeGames, setActiveGames] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [aiUsage, setAiUsage] = useState<{ requests_remaining: number; daily_limit: number; is_premium: boolean } | null>(null);

  const userName = user?.name || user?.email?.split("@")[0] || "Player";

  const fetchDashboard = useCallback(async () => {
    try {
      const [statsRes, gamesRes, groupsRes, balancesRes, aiUsageRes] = await Promise.all([
        api.get("/stats/me").catch(() => ({ data: null })),
        api.get("/games").catch(() => ({ data: [] })),
        api.get("/groups").catch(() => ({ data: [] })),
        api.get("/ledger/consolidated").catch(() => ({ data: { net_balance: 0, total_you_owe: 0, total_owed_to_you: 0 } })),
        api.get("/assistant/usage").catch(() => ({ data: null })),
      ]);
      setStats(statsRes.data);
      setBalances(balancesRes.data);
      const games = Array.isArray(gamesRes.data) ? gamesRes.data : [];
      setActiveGames(games.filter((g: any) => g.status === "active" || g.status === "scheduled"));
      setGroups(Array.isArray(groupsRes.data) ? groupsRes.data : []);
      if (aiUsageRes.data) setAiUsage(aiUsageRes.data);
    } catch {}
  }, []);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchDashboard();
    setRefreshing(false);
  }, [fetchDashboard]);

  // Derived metrics
  const totalGames = stats?.total_games || 0;
  const netProfit = stats?.net_profit || 0;
  const winRate = stats?.win_rate || 0;
  const wins = totalGames > 0 ? Math.round((winRate / 100) * totalGames) : 0;
  const losses = totalGames - wins;
  const avgProfit = totalGames > 0 ? netProfit / totalGames : 0;
  const bestWin = stats?.best_win || stats?.biggest_win || 0;
  const worstLoss = stats?.worst_loss || stats?.biggest_loss || 0;
  const totalBuyIns = stats?.total_buy_ins || 0;
  const roiPercent = totalBuyIns > 0 ? (netProfit / totalBuyIns) * 100 : 0;

  const handleTabPress = (tab: "Home" | "Progress" | "Groups" | "Settings") => {
    setActiveTab(tab);
    if (tab === "Groups") navigation.navigate("Groups");
    if (tab === "Settings") navigation.navigate("Settings");
  };

  const handleFabPress = () => {
    navigation.navigate("Groups");
  };

  const handlePageScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const page = Math.round(e.nativeEvent.contentOffset.x / PAGE_WIDTH);
    setActivePage(Math.min(Math.max(page, 0), 2));
  };

  const formatMoney = (val: number) => {
    const prefix = val >= 0 ? "+$" : "-$";
    return `${prefix}${Math.abs(val).toFixed(0)}`;
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
            <Text style={styles.streakCount}>{stats?.streak || 0}</Text>
          </View>
        </View>

        {/* Welcome Section */}
        <View style={styles.welcomeSection}>
          <Text style={styles.welcomeOverline}>OVERVIEW</Text>
          <Text style={styles.welcomeTitle}>
            Welcome back, <Text style={styles.welcomeNameAccent}>{userName.split(" ")[0]}</Text>
          </Text>
          <Text style={styles.welcomeSubtitle}>Here's your poker overview</Text>
        </View>
        <LinearGradient
          colors={["#EE6C2980", "transparent"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.gradientDivider}
        />
      </SafeAreaView>

      {/* Scrollable content */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#999" />
        }
      >
        {/* ── Horizontal Pager ─────────────────────────────────── */}
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={handlePageScroll}
          decelerationRate="fast"
          snapToInterval={PAGE_WIDTH}
          style={styles.pager}
          contentContainerStyle={styles.pagerContent}
        >
          {/* ── Page 1: Overview ─────────────────────────────── */}
          <View style={styles.page}>
            {/* Main stats card */}
            <View style={styles.mainCard}>
              <View style={styles.mainCardLeft}>
                <Text style={styles.bigNumber}>{totalGames}</Text>
                <Text style={styles.bigLabel}>Games played</Text>
                {totalGames > 0 && (
                  <View style={styles.bigSubRow}>
                    <Ionicons
                      name={netProfit >= 0 ? "trending-up" : "trending-down"}
                      size={14}
                      color={netProfit >= 0 ? "#22C55E" : "#EF4444"}
                    />
                    <Text style={[styles.bigSub, { color: netProfit >= 0 ? "#22C55E" : "#EF4444" }]}>
                      {formatMoney(netProfit)}
                    </Text>
                  </View>
                )}
              </View>
              <View style={styles.progressRing}>
                <Text style={styles.ringIcon}>{"\u2660\uFE0F"}</Text>
              </View>
            </View>

            {/* 3 Metric cards */}
            <View style={styles.metricRow}>
              <View style={styles.metricCard}>
                <Text style={[styles.metricValue, { color: netProfit >= 0 ? "#22C55E" : "#EF4444" }]}>
                  {formatMoney(netProfit)}
                </Text>
                <Text style={styles.metricLabel}>Net profit</Text>
                <View style={styles.metricIconRing}>
                  <Text style={styles.metricIcon}>{"\uD83D\uDCB0"}</Text>
                </View>
              </View>
              <View style={styles.metricCard}>
                <Text style={styles.metricValue}>{winRate.toFixed(0)}%</Text>
                <Text style={styles.metricLabel}>Win rate</Text>
                <View style={styles.metricIconRing}>
                  <Text style={styles.metricIcon}>{"\uD83C\uDFC6"}</Text>
                </View>
              </View>
              <View style={styles.metricCard}>
                <Text style={[styles.metricValue, { color: balances.net_balance >= 0 ? "#22C55E" : "#EF4444" }]}>
                  ${Math.abs(balances.net_balance || 0).toFixed(0)}
                </Text>
                <Text style={styles.metricLabel}>Balance</Text>
                <View style={styles.metricIconRing}>
                  <Text style={styles.metricIcon}>{"\uD83D\uDCB3"}</Text>
                </View>
              </View>
            </View>
          </View>

          {/* ── Page 2: Performance ──────────────────────────── */}
          <View style={styles.page}>
            {/* 3 Performance metric cards */}
            <View style={styles.metricRow}>
              <View style={styles.metricCard}>
                <Text style={[styles.metricValue, { color: avgProfit >= 0 ? "#22C55E" : "#EF4444" }]}>
                  {formatMoney(avgProfit)}
                </Text>
                <Text style={styles.metricLabel}>Avg profit</Text>
                <View style={styles.metricIconRing}>
                  <Text style={styles.metricIcon}>{"\uD83D\uDCC8"}</Text>
                </View>
              </View>
              <View style={styles.metricCard}>
                <Text style={[styles.metricValue, { color: "#22C55E" }]}>
                  +${bestWin.toFixed(0)}
                </Text>
                <Text style={styles.metricLabel}>Best win</Text>
                <View style={styles.metricIconRing}>
                  <Text style={styles.metricIcon}>{"\u2B50"}</Text>
                </View>
              </View>
              <View style={styles.metricCard}>
                <Text style={[styles.metricValue, { color: "#EF4444" }]}>
                  -${Math.abs(worstLoss).toFixed(0)}
                </Text>
                <Text style={styles.metricLabel}>Worst loss</Text>
                <View style={styles.metricIconRing}>
                  <Text style={styles.metricIcon}>{"\uD83D\uDCA8"}</Text>
                </View>
              </View>
            </View>

            {/* Performance Score card */}
            <View style={styles.scoreCard}>
              <View style={styles.scoreHeader}>
                <Text style={styles.scoreTitle}>Performance Score</Text>
                <Text style={[styles.scoreValue, { color: roiPercent >= 0 ? "#22C55E" : "#EF4444" }]}>
                  {totalGames > 0 ? `${roiPercent.toFixed(0)}%` : "N/A"}
                </Text>
              </View>
              {/* ROI progress bar */}
              <View style={styles.roiBarTrack}>
                <View
                  style={[
                    styles.roiBarFill,
                    {
                      width: totalGames > 0 ? `${Math.min(Math.max(roiPercent, 0), 100)}%` : "0%",
                      backgroundColor: roiPercent >= 0 ? "#22C55E" : "#EF4444",
                    },
                  ]}
                />
              </View>
              <Text style={styles.scoreDescription}>
                {totalGames > 0
                  ? `${wins}W / ${losses}L across ${totalGames} games. Your ROI reflects return on total buy-ins.`
                  : "Play a few games to generate your performance score. Your score reflects win rate and return on buy-ins."}
              </Text>
            </View>
          </View>

          {/* ── Page 3: Activity ─────────────────────────────── */}
          <View style={styles.page}>
            {/* Split card: Live Games + Groups */}
            <View style={styles.splitRow}>
              <TouchableOpacity
                style={styles.splitCard}
                onPress={() => navigation.navigate("Groups")}
                activeOpacity={0.7}
              >
                <Text style={styles.splitLabel}>Live Games</Text>
                <Text style={styles.splitValue}>{activeGames.length}</Text>
                <View style={styles.splitDetail}>
                  <View style={[styles.liveDot, activeGames.length > 0 && styles.liveDotActive]} />
                  <Text style={styles.splitSub}>
                    {activeGames.length > 0 ? "Active now" : "None active"}
                  </Text>
                </View>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.splitCard}
                onPress={() => navigation.navigate("Groups")}
                activeOpacity={0.7}
              >
                <Text style={styles.splitLabel}>Groups</Text>
                <Text style={styles.splitValue}>{groups.length}</Text>
                <View style={styles.splitDetail}>
                  <Ionicons name="people" size={12} color="#999" />
                  <Text style={styles.splitSub}>
                    {groups.reduce((sum: number, g: any) => sum + (g.member_count || 0), 0)} members
                  </Text>
                </View>
              </TouchableOpacity>
            </View>

            {/* AI Assistant card */}
            <TouchableOpacity
              style={styles.aiCard}
              onPress={() => navigation.navigate("AIAssistant")}
              activeOpacity={0.7}
            >
              <View style={styles.aiCardLeft}>
                <View style={styles.aiIconWrap}>
                  <Ionicons name="sparkles" size={22} color="#7C3AED" />
                </View>
                <View>
                  <Text style={styles.aiCardTitle}>AI Assistant</Text>
                  <Text style={styles.aiCardSub}>
                    {aiUsage
                      ? `${aiUsage.requests_remaining} requests left`
                      : "Analyze your game"}
                  </Text>
                </View>
              </View>
              <View style={styles.aiCardButton}>
                <Text style={styles.aiCardButtonText}>Open</Text>
              </View>
            </TouchableOpacity>
          </View>
        </ScrollView>

        {/* Page dots */}
        <View style={styles.dots}>
          {[0, 1, 2].map((i) => (
            <View key={i} style={[styles.dot, activePage === i && styles.dotActive]} />
          ))}
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
  // Welcome section
  welcomeSection: {
    paddingHorizontal: 24,
    marginTop: 16,
  },
  welcomeOverline: {
    color: "#999999",
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 1.5,
  },
  welcomeTitle: {
    color: "#1A1A1A",
    fontSize: 22,
    fontWeight: "700",
    marginTop: 4,
    letterSpacing: -22 * 0.02,
  },
  welcomeNameAccent: {
    color: "#EE6C29",
  },
  welcomeSubtitle: {
    color: "#999999",
    fontSize: 14,
    marginTop: 2,
  },
  gradientDivider: {
    height: 2,
    marginHorizontal: 24,
    marginTop: 12,
    borderRadius: 1,
  },
  // Content
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 20,
    paddingBottom: 16,
  },
  // Pager
  pager: {
    flexGrow: 0,
  },
  pagerContent: {
    paddingHorizontal: 20,
  },
  page: {
    width: PAGE_WIDTH,
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
    shadowOpacity: 0.04,
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
  bigSubRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 6,
  },
  bigSub: {
    fontSize: 14,
    fontWeight: "600",
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
    paddingHorizontal: 14,
    paddingVertical: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
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
    fontSize: 12,
    lineHeight: 16,
    marginTop: 2,
  },
  metricIconRing: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 5,
    borderColor: "#EEECF4",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginTop: 10,
  },
  metricIcon: {
    fontSize: 18,
  },
  // Score card (Performance page)
  scoreCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingVertical: 20,
    marginTop: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 16,
    elevation: 2,
  },
  scoreHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  scoreTitle: {
    color: "#1A1A1A",
    fontSize: 17,
    fontWeight: "700",
  },
  scoreValue: {
    fontSize: 17,
    fontWeight: "700",
  },
  roiBarTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: "#EEECF4",
    marginTop: 14,
    overflow: "hidden",
  },
  roiBarFill: {
    height: 6,
    borderRadius: 3,
  },
  scoreDescription: {
    color: "#999999",
    fontSize: 13,
    lineHeight: 18,
    marginTop: 14,
  },
  // Split cards (Activity page)
  splitRow: {
    flexDirection: "row",
    gap: 12,
  },
  splitCard: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingVertical: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 16,
    elevation: 2,
  },
  splitLabel: {
    color: "#666666",
    fontSize: 13,
    fontWeight: "500",
  },
  splitValue: {
    color: "#000000",
    fontSize: 36,
    fontWeight: "700",
    letterSpacing: -36 * 0.03,
    marginTop: 4,
  },
  splitDetail: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 8,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#CCCCCC",
  },
  liveDotActive: {
    backgroundColor: "#22C55E",
  },
  splitSub: {
    color: "#999999",
    fontSize: 12,
    fontWeight: "500",
  },
  // AI card
  aiCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingVertical: 16,
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 16,
    elevation: 2,
  },
  aiCardLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  aiIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "#F3F0FF",
    alignItems: "center",
    justifyContent: "center",
  },
  aiCardTitle: {
    color: "#1A1A1A",
    fontSize: 16,
    fontWeight: "600",
  },
  aiCardSub: {
    color: "#999999",
    fontSize: 13,
    marginTop: 1,
  },
  aiCardButton: {
    backgroundColor: "#1A1A1A",
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  aiCardButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
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
    paddingHorizontal: 20,
  },
  emptyCard: {
    backgroundColor: "#F2F2F7",
    borderRadius: 22,
    paddingHorizontal: 20,
    paddingVertical: 20,
    marginTop: 12,
    marginHorizontal: 20,
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
