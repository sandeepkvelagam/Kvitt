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
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { FONT, SPACE, LAYOUT, RADIUS } from "../styles/tokens";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const PAGE_WIDTH = SCREEN_WIDTH - 40;
const PAGE_HEIGHT = 380;

export function DashboardScreenV3() {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const { user } = useAuth();
  const { colors, isDark } = useTheme();
  const [activeTab, setActiveTab] = useState<"Home" | "Progress" | "Groups" | "Profile">("Home");
  const [activePage, setActivePage] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  // API data
  const [stats, setStats] = useState<any>(null);
  const [balances, setBalances] = useState<any>({ net_balance: 0, total_you_owe: 0, total_owed_to_you: 0 });
  const [activeGames, setActiveGames] = useState<any[]>([]);
  const [recentGames, setRecentGames] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [aiUsage, setAiUsage] = useState<{ requests_remaining: number; daily_limit: number; is_premium: boolean } | null>(null);

  const userName = user?.name || user?.email?.split("@")[0] || "Player";
  const userInitial = userName.charAt(0).toUpperCase();

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
      setRecentGames(games.slice(0, 5));
      setGroups(Array.isArray(groupsRes.data) ? groupsRes.data : []);
      if (aiUsageRes.data) setAiUsage(aiUsageRes.data);
    } catch {}
  }, []);

  useEffect(() => {
    fetchDashboard();
    api.post("/users/me/activity").catch(() => {});
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

  const handleTabPress = (tab: "Home" | "Progress" | "Groups" | "Profile") => {
    setActiveTab(tab);
    if (tab === "Groups") navigation.navigate("Groups");
    if (tab === "Profile") navigation.navigate("Settings");
  };

  const handleFabPress = () => navigation.navigate("Groups");

  const handlePageScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const page = Math.round(e.nativeEvent.contentOffset.x / PAGE_WIDTH);
    setActivePage(Math.min(Math.max(page, 0), 2));
  };

  const fmt = (val: number) => `${val >= 0 ? "+$" : "-$"}${Math.abs(val).toFixed(0)}`;

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "Recent";
    const d = new Date(dateStr);
    const diffH = (Date.now() - d.getTime()) / 3600000;
    if (diffH < 1) return "Just now";
    if (diffH < 24) return `${Math.floor(diffH)}h ago`;
    if (diffH < 48) return "Yesterday";
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  // Theme-aware card style
  const cardStyle = {
    backgroundColor: isDark ? colors.bgSecondary : colors.bgPrimary,
    borderRadius: RADIUS.xl,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: isDark ? 0.2 : 0.06,
    shadowRadius: 20,
    elevation: 3,
  };

  const cardSmStyle = { ...cardStyle, borderRadius: RADIUS.lg };

  const profitColor = (val: number) => val >= 0 ? colors.success : colors.error;

  return (
    <View style={[styles.root, { backgroundColor: colors.bgPrimary }]}>
      <SafeAreaView style={styles.safeArea} edges={["top"]}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={{ fontSize: FONT.h1.size }}>{"\u2660\uFE0F"}</Text>
            <Text style={[styles.logoText, { color: colors.textPrimary }]}>Kvitt</Text>
          </View>
          <TouchableOpacity
            style={[styles.streakPill, { backgroundColor: colors.bgSecondary }]}
            onPress={() => navigation.navigate("Milestones")}
            activeOpacity={0.7}
          >
            <Text style={{ fontSize: FONT.body.size }}>{"\uD83D\uDD25"}</Text>
            <Text style={[{ fontSize: FONT.body.size, fontWeight: "700", color: colors.textPrimary }]}>
              {stats?.streak || 0}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Welcome */}
        <View style={styles.welcomeWrap}>
          <Text style={{ color: colors.textMuted, fontSize: FONT.caption.size, fontWeight: "700", letterSpacing: 1.8 }}>
            OVERVIEW
          </Text>
          <Text style={[styles.welcomeH1, { color: colors.textPrimary }]}>
            Welcome back, {userName.split(" ")[0]}
          </Text>
          <Text style={{ color: colors.textMuted, fontSize: FONT.secondary.size, marginTop: 2 }}>
            Here's your poker overview
          </Text>
        </View>
        <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
      </SafeAreaView>

      {/* Scrollable Body */}
      <ScrollView
        style={styles.body}
        contentContainerStyle={styles.bodyContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.textMuted} />}
      >
        {/* Horizontal Pager */}
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={handlePageScroll}
          decelerationRate="fast"
          snapToInterval={PAGE_WIDTH}
          style={styles.pager}
          contentContainerStyle={styles.pagerInner}
        >
          {/* Page 1: Live Games + Groups */}
          <View style={[styles.page, { height: PAGE_HEIGHT }]}>
            <TouchableOpacity
              style={[styles.heroCard, cardStyle]}
              activeOpacity={0.7}
              onPress={() => {
                if (activeGames.length > 0) {
                  navigation.navigate("GameNight", { gameId: activeGames[0].game_id || activeGames[0]._id });
                } else {
                  navigation.navigate("Groups");
                }
              }}
            >
              <View>
                <Text style={[styles.heroNum, { color: colors.textPrimary }]}>{activeGames.length}</Text>
                <Text style={[styles.heroLabel, { color: colors.textSecondary }]}>Live games</Text>
                <View style={styles.heroStat}>
                  <View style={[styles.liveDot, { backgroundColor: activeGames.length > 0 ? colors.success : colors.textMuted }]} />
                  <Text style={{ fontSize: FONT.secondary.size, fontWeight: "600", color: activeGames.length > 0 ? colors.success : colors.textMuted }}>
                    {activeGames.length > 0 ? "Active now" : "None active"}
                  </Text>
                </View>
              </View>
              <View style={[styles.ring, { borderColor: colors.border }]}>
                <Text style={{ fontSize: 30 }}>{"\u2660\uFE0F"}</Text>
              </View>
            </TouchableOpacity>

            <View style={styles.triRow}>
              <TouchableOpacity style={[styles.triCard, cardSmStyle]} onPress={() => navigation.navigate("Groups")} activeOpacity={0.7}>
                <Text style={[styles.triVal, { color: colors.textPrimary }]}>{groups.length}</Text>
                <Text style={[styles.triLabel, { color: colors.textSecondary }]}>Groups</Text>
                <View style={[styles.triRing, { borderColor: colors.border }]}>
                  <Ionicons name="people" size={16} color={colors.textSecondary} />
                </View>
              </TouchableOpacity>
              <View style={[styles.triCard, cardSmStyle]}>
                <Text style={[styles.triVal, { color: profitColor(netProfit) }]}>{fmt(netProfit)}</Text>
                <Text style={[styles.triLabel, { color: colors.textSecondary }]}>Net profit</Text>
                <View style={[styles.triRing, { borderColor: colors.border }]}>
                  <Text style={{ fontSize: FONT.title.size }}>{"\uD83D\uDCB0"}</Text>
                </View>
              </View>
              <View style={[styles.triCard, cardSmStyle]}>
                <Text style={[styles.triVal, { color: profitColor(balances.net_balance || 0) }]}>
                  ${Math.abs(balances.net_balance || 0).toFixed(0)}
                </Text>
                <Text style={[styles.triLabel, { color: colors.textSecondary }]}>Balance</Text>
                <View style={[styles.triRing, { borderColor: colors.border }]}>
                  <Text style={{ fontSize: FONT.title.size }}>{"\uD83D\uDCB3"}</Text>
                </View>
              </View>
            </View>
          </View>

          {/* Page 2: Performance */}
          <View style={[styles.page, { height: PAGE_HEIGHT }]}>
            <View style={styles.triRow}>
              <View style={[styles.triCard, cardSmStyle]}>
                <Text style={[styles.triVal, { color: profitColor(avgProfit) }]}>{fmt(avgProfit)}</Text>
                <Text style={[styles.triLabel, { color: colors.textSecondary }]}>Avg profit</Text>
                <View style={[styles.triRing, { borderColor: colors.border }]}>
                  <Text style={{ fontSize: FONT.title.size }}>{"\uD83D\uDCC8"}</Text>
                </View>
              </View>
              <View style={[styles.triCard, cardSmStyle]}>
                <Text style={[styles.triVal, { color: colors.success }]}>+${bestWin.toFixed(0)}</Text>
                <Text style={[styles.triLabel, { color: colors.textSecondary }]}>Best win</Text>
                <View style={[styles.triRing, { borderColor: colors.border }]}>
                  <Text style={{ fontSize: FONT.title.size }}>{"\u2B50"}</Text>
                </View>
              </View>
              <View style={[styles.triCard, cardSmStyle]}>
                <Text style={[styles.triVal, { color: colors.error }]}>-${Math.abs(worstLoss).toFixed(0)}</Text>
                <Text style={[styles.triLabel, { color: colors.textSecondary }]}>Worst loss</Text>
                <View style={[styles.triRing, { borderColor: colors.border }]}>
                  <Text style={{ fontSize: FONT.title.size }}>{"\uD83D\uDCA8"}</Text>
                </View>
              </View>
            </View>

            <View style={[styles.scoreCard, cardStyle]}>
              <View style={styles.scoreRow}>
                <Text style={{ color: colors.textPrimary, fontSize: FONT.title.size, fontWeight: "700" }}>
                  Performance Score
                </Text>
                <Text style={{ fontSize: FONT.body.size, fontWeight: "700", color: profitColor(roiPercent) }}>
                  {totalGames > 0 ? `${roiPercent.toFixed(0)}%` : "N/A"}
                </Text>
              </View>
              <View style={[styles.barTrack, { backgroundColor: colors.border }]}>
                <View style={[styles.barFill, {
                  width: totalGames > 0 ? `${Math.min(Math.max(roiPercent, 0), 100)}%` as any : "0%",
                  backgroundColor: profitColor(roiPercent),
                }]} />
              </View>
              <Text style={{ color: colors.textMuted, fontSize: FONT.caption.size, lineHeight: 17, marginTop: SPACE.md }}>
                {totalGames > 0
                  ? `${wins}W / ${losses}L across ${totalGames} games. Your ROI reflects return on total buy-ins.`
                  : "Play a few games to generate your performance score. Your score reflects win rate and return on buy-ins."}
              </Text>
            </View>
          </View>

          {/* Page 3: Activity */}
          <View style={[styles.page, { height: PAGE_HEIGHT }]}>
            <View style={styles.splitRow}>
              <View style={[styles.splitCard, cardStyle]}>
                <Text style={{ color: colors.textSecondary, fontSize: FONT.secondary.size, fontWeight: "600" }}>Win Rate</Text>
                <Text style={[styles.splitBig, { color: colors.textPrimary }]}>{winRate.toFixed(0)}%</Text>
                <View style={styles.splitMeta}>
                  <Ionicons name="trophy" size={12} color={colors.textSecondary} />
                  <Text style={{ color: colors.textMuted, fontSize: FONT.caption.size }}>{wins}W / {losses}L</Text>
                </View>
              </View>
              <View style={[styles.splitCard, cardStyle]}>
                <Text style={{ color: colors.textSecondary, fontSize: FONT.secondary.size, fontWeight: "600" }}>Total Games</Text>
                <Text style={[styles.splitBig, { color: colors.textPrimary }]}>{totalGames}</Text>
                <View style={styles.splitMeta}>
                  <Ionicons name="game-controller" size={12} color={colors.textMuted} />
                  <Text style={{ color: colors.textMuted, fontSize: FONT.caption.size }}>
                    {totalGames > 0 ? "Lifetime" : "No games yet"}
                  </Text>
                </View>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.aiBar, cardStyle]}
              onPress={() => navigation.navigate("AIAssistant")}
              activeOpacity={0.7}
            >
              <View style={styles.aiBarLeft}>
                <View style={[styles.aiIconBox, { backgroundColor: colors.bgSecondary }]}>
                  <Ionicons name="sparkles" size={18} color={colors.textSecondary} />
                </View>
                <View>
                  <Text style={{ color: colors.textPrimary, fontSize: FONT.body.size, fontWeight: "700" }}>AI Assistant</Text>
                  <Text style={{ color: colors.textMuted, fontSize: FONT.caption.size, marginTop: 1 }}>
                    {aiUsage ? `${aiUsage.requests_remaining} requests left` : "Analyze your game"}
                  </Text>
                </View>
              </View>
              <View style={[styles.aiBarBtn, { backgroundColor: colors.buttonPrimary }]}>
                <Text style={{ color: colors.buttonText, fontSize: FONT.secondary.size, fontWeight: "700" }}>Open</Text>
              </View>
            </TouchableOpacity>
          </View>
        </ScrollView>

        {/* Page dots */}
        <View style={styles.dots}>
          {[0, 1, 2].map((i) => (
            <View key={i} style={[
              styles.dot,
              { backgroundColor: isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.12)" },
              activePage === i && { backgroundColor: colors.textPrimary },
            ]} />
          ))}
        </View>

        {/* Recent Games */}
        <Text style={[styles.sectionH2, { color: colors.textPrimary }]}>Recent games</Text>

        {recentGames.length > 0 ? (
          <View style={styles.emptyOuter}>
            <View style={[styles.stackLine2, { backgroundColor: colors.border }]} />
            <View style={[styles.stackLine1, { backgroundColor: colors.border }]} />
            <View style={[styles.recentStackedCard, cardStyle]}>
              {recentGames.map((game, idx) => {
                const result = game.net_result || game.result || 0;
                const title = game.title || game.group_name || "Game Night";
                const dateStr = game.ended_at || game.created_at || game.date || "";
                const playerCount = game.player_count || game.players?.length || 0;
                const isActive = game.status === "active";
                return (
                  <TouchableOpacity
                    key={game.game_id || game._id || idx}
                    style={[styles.gameRow, idx < recentGames.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }]}
                    onPress={() => navigation.navigate("GameNight", { gameId: game.game_id || game._id })}
                    activeOpacity={0.6}
                  >
                    <View style={[styles.gameAvatar, { backgroundColor: colors.bgSecondary }, isActive && { backgroundColor: isDark ? "rgba(52,199,89,0.15)" : "#ECFDF5" }]}>
                      <Ionicons
                        name={isActive ? "play-circle" : "game-controller"}
                        size={16}
                        color={isActive ? colors.success : colors.textMuted}
                      />
                    </View>
                    <View style={styles.gameInfo}>
                      <Text style={{ color: colors.textPrimary, fontSize: FONT.secondary.size, fontWeight: "600" }} numberOfLines={1}>{title}</Text>
                      <Text style={{ color: colors.textMuted, fontSize: FONT.caption.size, marginTop: 2 }}>
                        {playerCount > 0 ? `${playerCount} players` : ""}
                        {playerCount > 0 && dateStr ? "  \u00B7  " : ""}
                        {formatDate(dateStr)}
                      </Text>
                    </View>
                    <View style={styles.gameResultCol}>
                      <Text style={{ fontSize: FONT.secondary.size, fontWeight: "700", color: profitColor(result) }}>
                        {result !== 0 ? fmt(result) : "--"}
                      </Text>
                      {isActive && (
                        <View style={[styles.liveBadge, { backgroundColor: isDark ? "rgba(52,199,89,0.15)" : "#ECFDF5" }]}>
                          <Text style={{ color: colors.success, fontSize: 9, fontWeight: "800", letterSpacing: 0.5 }}>LIVE</Text>
                        </View>
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        ) : (
          <View style={styles.emptyOuter}>
            <View style={[styles.stackLine2, { backgroundColor: colors.border }]} />
            <View style={[styles.stackLine1, { backgroundColor: colors.border }]} />
            <View style={[styles.emptyMainCard, { backgroundColor: colors.bgSecondary }]}>
              <View style={[styles.emptyInner, { backgroundColor: isDark ? colors.bgSecondary : colors.bgPrimary }]}>
                <View style={[styles.emptyCircle, { backgroundColor: colors.bgSecondary }]}>
                  <Ionicons name="game-controller-outline" size={18} color={colors.textMuted} />
                </View>
                <View style={styles.emptyLines}>
                  <View style={[styles.emptyLine1, { backgroundColor: colors.border }]} />
                  <View style={[styles.emptyLine2, { backgroundColor: colors.border }]} />
                </View>
              </View>
            </View>
            <Text style={{ color: colors.textSecondary, fontSize: FONT.secondary.size, textAlign: "center", marginTop: 14 }}>
              Tap + to start your first game
            </Text>
          </View>
        )}

        <View style={{ height: SPACE.xxl }} />
      </ScrollView>

      <BottomTabBar
        activeTab={activeTab}
        onTabPress={handleTabPress}
        onFabPress={handleFabPress}
        userInitial={userInitial}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safeArea: {},

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SPACE.xxl,
    paddingTop: SPACE.sm,
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: SPACE.sm },
  logoText: { fontSize: FONT.h1.size, fontWeight: "800", letterSpacing: -0.8 },
  streakPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: 100,
    paddingHorizontal: SPACE.lg,
    paddingVertical: 7,
  },

  welcomeWrap: { paddingHorizontal: SPACE.xxl, marginTop: SPACE.title ? undefined : 18 },
  welcomeH1: { fontSize: FONT.h3.size, fontWeight: "700", marginTop: 3, letterSpacing: -0.4 },
  dividerLine: { height: 1, marginHorizontal: SPACE.xxl, marginTop: SPACE.lg, borderRadius: 1 },

  body: { flex: 1 },
  bodyContent: { paddingTop: SPACE.title ? undefined : 18, paddingBottom: 100 },

  pager: { flexGrow: 0 },
  pagerInner: { paddingHorizontal: LAYOUT.screenPadding },
  page: { width: PAGE_WIDTH, overflow: "hidden" },

  heroCard: {
    paddingHorizontal: SPACE.xxl,
    paddingVertical: SPACE.xxl,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  heroNum: { fontSize: FONT.display.size + 20, fontWeight: "800", letterSpacing: -2.5, lineHeight: 56 },
  heroLabel: { fontSize: FONT.secondary.size, marginTop: 4, fontWeight: "500" },
  heroStat: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: SPACE.sm },
  liveDot: { width: 8, height: 8, borderRadius: 4 },
  ring: {
    width: 110,
    height: 110,
    borderRadius: 55,
    borderWidth: 8,
    alignItems: "center",
    justifyContent: "center",
  },

  triRow: { flexDirection: "row", gap: 10, marginTop: SPACE.md },
  triCard: {
    flex: 1,
    paddingHorizontal: SPACE.lg,
    paddingVertical: SPACE.title ? undefined : 18,
  },
  triVal: { fontSize: FONT.h3.size, fontWeight: "800", letterSpacing: -0.5 },
  triLabel: { fontSize: FONT.caption.size, marginTop: 2, fontWeight: "500" },
  triRing: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 5,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginTop: 10,
  },

  scoreCard: { paddingHorizontal: LAYOUT.screenPadding, paddingVertical: SPACE.xxl, marginTop: SPACE.md },
  scoreRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  barTrack: { height: 5, borderRadius: 2.5, marginTop: SPACE.md, overflow: "hidden" },
  barFill: { height: 5, borderRadius: 2.5 },

  splitRow: { flexDirection: "row", gap: 10 },
  splitCard: { flex: 1, paddingHorizontal: SPACE.lg, paddingVertical: SPACE.xxl },
  splitBig: { fontSize: FONT.display.size + 6, fontWeight: "800", letterSpacing: -1.2, marginTop: 2 },
  splitMeta: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: SPACE.sm },

  aiBar: {
    paddingHorizontal: SPACE.lg,
    paddingVertical: SPACE.lg,
    marginTop: SPACE.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  aiBarLeft: { flexDirection: "row", alignItems: "center", gap: SPACE.md },
  aiIconBox: {
    width: LAYOUT.touchTarget,
    height: LAYOUT.touchTarget,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  aiBarBtn: { borderRadius: 18, paddingHorizontal: 18, paddingVertical: 9 },

  dots: { flexDirection: "row", justifyContent: "center", gap: SPACE.sm, marginTop: SPACE.sm },
  dot: { width: 8, height: 8, borderRadius: 4 },

  sectionH2: {
    fontSize: FONT.h3.size,
    fontWeight: "800",
    letterSpacing: -0.5,
    marginTop: SPACE.xxxl,
    paddingHorizontal: LAYOUT.screenPadding,
  },

  recentStackedCard: {
    overflow: "hidden",
    position: "relative",
    zIndex: 1,
  },
  gameRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: SPACE.lg,
    paddingVertical: SPACE.lg,
  },
  gameAvatar: {
    width: 36,
    height: 36,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  gameInfo: { flex: 1, marginLeft: SPACE.md },
  gameResultCol: { alignItems: "flex-end" },
  liveBadge: {
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
    marginTop: 2,
  },

  emptyOuter: {
    marginTop: SPACE.lg,
    marginHorizontal: LAYOUT.screenPadding,
    paddingBottom: SPACE.lg,
    position: "relative",
  },
  stackLine2: {
    position: "absolute",
    bottom: 2,
    left: 16,
    right: 16,
    height: 8,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
  },
  stackLine1: {
    position: "absolute",
    bottom: 6,
    left: 8,
    right: 8,
    height: 8,
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18,
  },
  emptyMainCard: {
    borderRadius: 22,
    paddingHorizontal: LAYOUT.screenPadding,
    paddingTop: SPACE.xxl,
    paddingBottom: SPACE.lg,
    position: "relative",
    zIndex: 1,
  },
  emptyInner: {
    borderRadius: RADIUS.lg,
    paddingHorizontal: SPACE.lg,
    paddingVertical: SPACE.lg,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    alignSelf: "center",
    width: "88%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },
  emptyCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyLines: { flex: 1, gap: 10 },
  emptyLine1: { height: 11, borderRadius: 5.5, width: "100%" },
  emptyLine2: { height: 9, borderRadius: 4.5, width: "65%" },
});
