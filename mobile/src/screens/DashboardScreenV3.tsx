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
import { LinearGradient } from "expo-linear-gradient";
import { BottomTabBar } from "../components/BottomTabBar";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const PAGE_WIDTH = SCREEN_WIDTH - 40;
// Each page should be tall enough so the next page isn't visible
const PAGE_HEIGHT = 340;

export function DashboardScreenV3() {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const { user } = useAuth();
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

  useEffect(() => { fetchDashboard(); }, [fetchDashboard]);

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

  return (
    <View style={styles.root}>
      {/* Subtle warm gradient at top */}
      <LinearGradient colors={["#FEF3EC", "#F8F8F6"]} style={styles.topGradient} />

      <SafeAreaView style={styles.safeArea} edges={["top"]}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.logoEmoji}>{"\u2660\uFE0F"}</Text>
            <Text style={styles.logoText}>Kvitt</Text>
          </View>
          <View style={styles.streakPill}>
            <Text style={styles.streakFire}>{"\uD83D\uDD25"}</Text>
            <Text style={styles.streakNum}>{stats?.streak || 0}</Text>
          </View>
        </View>

        {/* Welcome */}
        <View style={styles.welcomeWrap}>
          <Text style={styles.overline}>OVERVIEW</Text>
          <Text style={styles.welcomeH1}>
            Welcome back, <Text style={styles.nameOrange}>{userName.split(" ")[0]}</Text>
          </Text>
          <Text style={styles.welcomeSub}>Here's your poker overview</Text>
        </View>
        <LinearGradient
          colors={["#EE6C2966", "transparent"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.dividerLine}
        />
      </SafeAreaView>

      {/* Scrollable Body */}
      <ScrollView
        style={styles.body}
        contentContainerStyle={styles.bodyContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#C0C0C0" />}
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
          {/* ─── Page 1: Live Games + Groups ──────────────── */}
          <View style={[styles.page, { height: PAGE_HEIGHT }]}>
            {/* Hero: Live Games */}
            <TouchableOpacity
              style={styles.heroCard}
              activeOpacity={0.7}
              onPress={() => {
                if (activeGames.length > 0) {
                  navigation.navigate("GameNight", { gameId: activeGames[0].game_id || activeGames[0]._id });
                } else {
                  navigation.navigate("Groups");
                }
              }}
            >
              <View style={styles.heroLeft}>
                <Text style={styles.heroNum}>{activeGames.length}</Text>
                <Text style={styles.heroLabel}>Live games</Text>
                <View style={styles.heroStat}>
                  <View style={[styles.liveDotHero, activeGames.length > 0 && styles.liveDotHeroActive]} />
                  <Text style={[styles.heroStatText, { color: activeGames.length > 0 ? "#22C55E" : "#AAA" }]}>
                    {activeGames.length > 0 ? "Active now" : "None active"}
                  </Text>
                </View>
              </View>
              <View style={styles.ring}>
                <Text style={styles.ringEmoji}>{"\u2660\uFE0F"}</Text>
              </View>
            </TouchableOpacity>

            {/* Groups row */}
            <View style={styles.triRow}>
              <TouchableOpacity style={styles.triCard} onPress={() => navigation.navigate("Groups")} activeOpacity={0.7}>
                <Text style={styles.triVal}>{groups.length}</Text>
                <Text style={styles.triLabel}>Groups</Text>
                <View style={styles.triRing}><Ionicons name="people" size={16} color="#EE6C29" /></View>
              </TouchableOpacity>
              <View style={styles.triCard}>
                <Text style={[styles.triVal, { color: netProfit >= 0 ? "#22C55E" : "#EF4444" }]}>{fmt(netProfit)}</Text>
                <Text style={styles.triLabel}>Net profit</Text>
                <View style={styles.triRing}><Text style={styles.triEmoji}>{"\uD83D\uDCB0"}</Text></View>
              </View>
              <View style={styles.triCard}>
                <Text style={[styles.triVal, { color: balances.net_balance >= 0 ? "#22C55E" : "#EF4444" }]}>
                  ${Math.abs(balances.net_balance || 0).toFixed(0)}
                </Text>
                <Text style={styles.triLabel}>Balance</Text>
                <View style={styles.triRing}><Text style={styles.triEmoji}>{"\uD83D\uDCB3"}</Text></View>
              </View>
            </View>
          </View>

          {/* ─── Page 2: Performance ──────────────────────── */}
          <View style={[styles.page, { height: PAGE_HEIGHT }]}>
            <View style={styles.triRow}>
              <View style={styles.triCard}>
                <Text style={[styles.triVal, { color: avgProfit >= 0 ? "#22C55E" : "#EF4444" }]}>{fmt(avgProfit)}</Text>
                <Text style={styles.triLabel}>Avg profit</Text>
                <View style={styles.triRing}><Text style={styles.triEmoji}>{"\uD83D\uDCC8"}</Text></View>
              </View>
              <View style={styles.triCard}>
                <Text style={[styles.triVal, { color: "#22C55E" }]}>+${bestWin.toFixed(0)}</Text>
                <Text style={styles.triLabel}>Best win</Text>
                <View style={styles.triRing}><Text style={styles.triEmoji}>{"\u2B50"}</Text></View>
              </View>
              <View style={styles.triCard}>
                <Text style={[styles.triVal, { color: "#EF4444" }]}>-${Math.abs(worstLoss).toFixed(0)}</Text>
                <Text style={styles.triLabel}>Worst loss</Text>
                <View style={styles.triRing}><Text style={styles.triEmoji}>{"\uD83D\uDCA8"}</Text></View>
              </View>
            </View>

            <View style={styles.scoreCard}>
              <View style={styles.scoreRow}>
                <Text style={styles.scoreLabel}>Performance Score</Text>
                <Text style={[styles.scoreNum, { color: roiPercent >= 0 ? "#22C55E" : "#EF4444" }]}>
                  {totalGames > 0 ? `${roiPercent.toFixed(0)}%` : "N/A"}
                </Text>
              </View>
              <View style={styles.barTrack}>
                <View style={[styles.barFill, {
                  width: totalGames > 0 ? `${Math.min(Math.max(roiPercent, 0), 100)}%` : "0%",
                  backgroundColor: roiPercent >= 0 ? "#22C55E" : "#EF4444",
                }]} />
              </View>
              <Text style={styles.scoreSub}>
                {totalGames > 0
                  ? `${wins}W / ${losses}L across ${totalGames} games. Your ROI reflects return on total buy-ins.`
                  : "Play a few games to generate your performance score. Your score reflects win rate and return on buy-ins."}
              </Text>
            </View>
          </View>

          {/* ─── Page 3: Activity ─────────────────────────── */}
          <View style={[styles.page, { height: PAGE_HEIGHT }]}>
            <View style={styles.splitRow}>
              <View style={styles.splitCard}>
                <Text style={styles.splitLabel}>Win Rate</Text>
                <Text style={styles.splitBig}>{winRate.toFixed(0)}%</Text>
                <View style={styles.splitMeta}>
                  <Ionicons name="trophy" size={12} color="#EE6C29" />
                  <Text style={styles.splitSub}>{wins}W / {losses}L</Text>
                </View>
              </View>
              <View style={styles.splitCard}>
                <Text style={styles.splitLabel}>Total Games</Text>
                <Text style={styles.splitBig}>{totalGames}</Text>
                <View style={styles.splitMeta}>
                  <Ionicons name="game-controller" size={12} color="#AAA" />
                  <Text style={styles.splitSub}>{totalGames > 0 ? "Lifetime" : "No games yet"}</Text>
                </View>
              </View>
            </View>

            <TouchableOpacity style={styles.aiBar} onPress={() => navigation.navigate("AIAssistant")} activeOpacity={0.7}>
              <View style={styles.aiBarLeft}>
                <View style={styles.aiIconBox}>
                  <Ionicons name="sparkles" size={18} color="#7C3AED" />
                </View>
                <View>
                  <Text style={styles.aiBarTitle}>AI Assistant</Text>
                  <Text style={styles.aiBarSub}>
                    {aiUsage ? `${aiUsage.requests_remaining} requests left` : "Analyze your game"}
                  </Text>
                </View>
              </View>
              <View style={styles.aiBarBtn}>
                <Text style={styles.aiBarBtnText}>Open</Text>
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

        {/* ── Recent Games ────────────────────────────────── */}
        <Text style={styles.sectionH2}>Recent games</Text>

        {recentGames.length > 0 ? (
          <View style={styles.recentWrap}>
            {recentGames.map((game, idx) => {
              const result = game.net_result || game.result || 0;
              const title = game.title || game.group_name || "Game Night";
              const dateStr = game.ended_at || game.created_at || game.date || "";
              const playerCount = game.player_count || game.players?.length || 0;
              const isActive = game.status === "active";
              return (
                <TouchableOpacity
                  key={game.game_id || game._id || idx}
                  style={[styles.gameRow, idx < recentGames.length - 1 && styles.gameRowBorder]}
                  onPress={() => navigation.navigate("GameNight", { gameId: game.game_id || game._id })}
                  activeOpacity={0.6}
                >
                  <View style={[styles.gameAvatar, isActive && styles.gameAvatarLive]}>
                    <Ionicons
                      name={isActive ? "play-circle" : "game-controller"}
                      size={16}
                      color={isActive ? "#22C55E" : "#999"}
                    />
                  </View>
                  <View style={styles.gameInfo}>
                    <Text style={styles.gameTitle} numberOfLines={1}>{title}</Text>
                    <Text style={styles.gameMeta}>
                      {playerCount > 0 ? `${playerCount} players` : ""}
                      {playerCount > 0 && dateStr ? "  ·  " : ""}
                      {formatDate(dateStr)}
                    </Text>
                  </View>
                  <View style={styles.gameResultCol}>
                    <Text style={[styles.gameResultText, { color: result >= 0 ? "#22C55E" : "#EF4444" }]}>
                      {result !== 0 ? fmt(result) : "--"}
                    </Text>
                    {isActive && (
                      <View style={styles.liveBadge}>
                        <Text style={styles.liveBadgeText}>LIVE</Text>
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        ) : (
          /* Stacked card empty state — like CalAI "Recently uploaded" */
          <View style={styles.emptyOuter}>
            {/* Stacked shadow lines behind */}
            <View style={styles.stackLine2} />
            <View style={styles.stackLine1} />
            {/* Main card */}
            <View style={styles.emptyMainCard}>
              <View style={styles.emptyInner}>
                <View style={styles.emptyCircle}>
                  <Ionicons name="game-controller-outline" size={18} color="#BBBBC4" />
                </View>
                <View style={styles.emptyLines}>
                  <View style={styles.emptyLine1} />
                  <View style={styles.emptyLine2} />
                </View>
              </View>
            </View>
            <Text style={styles.emptyText}>Tap + to start your first game</Text>
          </View>
        )}

        <View style={{ height: 24 }} />
      </ScrollView>

      {/* Bottom Tab Bar */}
      <BottomTabBar
        activeTab={activeTab}
        onTabPress={handleTabPress}
        onFabPress={handleFabPress}
        userInitial={userInitial}
      />
    </View>
  );
}

/* ══════════════════════════════════════════════════════════ */
const CARD = {
  backgroundColor: "#FFFFFF",
  borderRadius: 24,
  shadowColor: "#000",
  shadowOffset: { width: 0, height: 6 },
  shadowOpacity: 0.06,
  shadowRadius: 20,
  elevation: 3,
} as const;

const CARD_SM = { ...CARD, borderRadius: 20 } as const;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#F8F8F6" },
  topGradient: { position: "absolute", top: 0, left: 0, right: 0, height: 220 },
  safeArea: {},

  /* Header */
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingTop: 8,
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  logoEmoji: { fontSize: 26 },
  logoText: { color: "#1A1A1A", fontSize: 26, fontWeight: "800", letterSpacing: -0.8 },
  streakPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#FFFFFF",
    borderRadius: 100,
    paddingHorizontal: 14,
    paddingVertical: 7,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  streakFire: { fontSize: 16 },
  streakNum: { color: "#1A1A1A", fontSize: 16, fontWeight: "700" },

  /* Welcome */
  welcomeWrap: { paddingHorizontal: 24, marginTop: 18 },
  overline: { color: "#AAAAAA", fontSize: 11, fontWeight: "700", letterSpacing: 1.8 },
  welcomeH1: { color: "#1A1A1A", fontSize: 21, fontWeight: "700", marginTop: 3, letterSpacing: -0.4 },
  nameOrange: { color: "#EE6C29" },
  welcomeSub: { color: "#AAAAAA", fontSize: 13, marginTop: 2 },
  dividerLine: { height: 1.5, marginHorizontal: 24, marginTop: 14, borderRadius: 1 },

  /* Body */
  body: { flex: 1 },
  bodyContent: { paddingTop: 18, paddingBottom: 8 },

  /* Pager */
  pager: { flexGrow: 0 },
  pagerInner: { paddingHorizontal: 20 },
  page: { width: PAGE_WIDTH },

  /* Hero Card */
  heroCard: {
    ...CARD,
    paddingHorizontal: 24,
    paddingVertical: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  heroLeft: {},
  heroNum: { color: "#000", fontSize: 52, fontWeight: "800", letterSpacing: -2.5, lineHeight: 52 },
  heroLabel: { color: "#888", fontSize: 14, marginTop: 4, fontWeight: "500" },
  heroStat: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8 },
  heroStatText: { fontSize: 13, fontWeight: "600" },
  liveDotHero: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#CCC" },
  liveDotHeroActive: { backgroundColor: "#22C55E" },
  ring: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 7,
    borderColor: "#EEECF4",
    alignItems: "center",
    justifyContent: "center",
  },
  ringEmoji: { fontSize: 26 },

  /* Tri cards */
  triRow: { flexDirection: "row", gap: 10, marginTop: 12 },
  triCard: {
    flex: 1,
    ...CARD_SM,
    paddingHorizontal: 12,
    paddingVertical: 14,
  },
  triVal: { color: "#000", fontSize: 19, fontWeight: "800", letterSpacing: -0.5 },
  triLabel: { color: "#888", fontSize: 11, marginTop: 1, fontWeight: "500" },
  triRing: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 4.5,
    borderColor: "#EEECF4",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginTop: 10,
  },
  triEmoji: { fontSize: 16 },

  /* Score Card */
  scoreCard: { ...CARD, paddingHorizontal: 20, paddingVertical: 18, marginTop: 12 },
  scoreRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  scoreLabel: { color: "#1A1A1A", fontSize: 16, fontWeight: "700" },
  scoreNum: { fontSize: 16, fontWeight: "700" },
  barTrack: { height: 5, borderRadius: 2.5, backgroundColor: "#EEECF4", marginTop: 12, overflow: "hidden" },
  barFill: { height: 5, borderRadius: 2.5 },
  scoreSub: { color: "#AAAAAA", fontSize: 12, lineHeight: 17, marginTop: 12 },

  /* Split Cards */
  splitRow: { flexDirection: "row", gap: 10 },
  splitCard: { flex: 1, ...CARD, paddingHorizontal: 16, paddingVertical: 20 },
  splitLabel: { color: "#888", fontSize: 12, fontWeight: "600" },
  splitBig: { color: "#000", fontSize: 34, fontWeight: "800", letterSpacing: -1.2, marginTop: 2 },
  splitMeta: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 8 },
  splitSub: { color: "#AAA", fontSize: 11, fontWeight: "500" },

  /* AI Bar */
  aiBar: {
    ...CARD,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  aiBarLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  aiIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#F3F0FF",
    alignItems: "center",
    justifyContent: "center",
  },
  aiBarTitle: { color: "#1A1A1A", fontSize: 15, fontWeight: "700" },
  aiBarSub: { color: "#AAA", fontSize: 12, marginTop: 1 },
  aiBarBtn: { backgroundColor: "#1A1A1A", borderRadius: 18, paddingHorizontal: 18, paddingVertical: 9 },
  aiBarBtnText: { color: "#fff", fontSize: 13, fontWeight: "700" },

  /* Page dots */
  dots: { flexDirection: "row", justifyContent: "center", gap: 8, marginTop: 16 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "rgba(0,0,0,0.12)" },
  dotActive: { backgroundColor: "#1A1A1A" },

  /* Section title */
  sectionH2: {
    color: "#1A1A1A",
    fontSize: 20,
    fontWeight: "800",
    letterSpacing: -0.5,
    marginTop: 32,
    paddingHorizontal: 20,
  },

  /* Recent games (populated) */
  recentWrap: {
    ...CARD,
    marginTop: 14,
    marginHorizontal: 20,
    overflow: "hidden",
  },
  gameRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  gameRowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#F0F0F0" },
  gameAvatar: {
    width: 36,
    height: 36,
    borderRadius: 11,
    backgroundColor: "#F4F4F8",
    alignItems: "center",
    justifyContent: "center",
  },
  gameAvatarLive: { backgroundColor: "#ECFDF5" },
  gameInfo: { flex: 1, marginLeft: 12 },
  gameTitle: { color: "#1A1A1A", fontSize: 14, fontWeight: "600" },
  gameMeta: { color: "#AAA", fontSize: 11, marginTop: 2 },
  gameResultCol: { alignItems: "flex-end" },
  gameResultText: { fontSize: 14, fontWeight: "700" },
  liveBadge: {
    backgroundColor: "#ECFDF5",
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
    marginTop: 2,
  },
  liveBadgeText: { color: "#22C55E", fontSize: 9, fontWeight: "800", letterSpacing: 0.5 },

  /* Recent games (empty — stacked card style) */
  emptyOuter: {
    marginTop: 14,
    marginHorizontal: 20,
    position: "relative",
  },
  /* Stacked shadow lines behind the main card */
  stackLine2: {
    position: "absolute",
    bottom: 28,
    left: 14,
    right: 14,
    height: 50,
    backgroundColor: "#E8E8EC",
    borderRadius: 18,
  },
  stackLine1: {
    position: "absolute",
    bottom: 24,
    left: 7,
    right: 7,
    height: 50,
    backgroundColor: "#EEEEEF",
    borderRadius: 20,
  },
  emptyMainCard: {
    backgroundColor: "#F2F2F7",
    borderRadius: 22,
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 16,
    position: "relative",
    zIndex: 1,
  },
  emptyInner: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
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
    backgroundColor: "#F4F4F8",
    alignItems: "center",
    justifyContent: "center",
  },
  emptyLines: { flex: 1, gap: 10 },
  emptyLine1: { height: 11, borderRadius: 5.5, backgroundColor: "#E4E4EA", width: "100%" },
  emptyLine2: { height: 9, borderRadius: 4.5, backgroundColor: "#ECECF0", width: "65%" },
  emptyText: { color: "#888", fontSize: 14, textAlign: "center", marginTop: 14, position: "relative", zIndex: 1 },
});
