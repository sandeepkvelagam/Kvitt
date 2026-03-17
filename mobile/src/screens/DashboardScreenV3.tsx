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
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { BottomTabBar } from "../components/BottomTabBar";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { FONT, SPACE, LAYOUT, RADIUS } from "../styles/tokens";
import { Title1, Title3, Label, Subhead, Title2 } from "../components/ui";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const HORIZONTAL_PADDING = 24;
// Full width pages, no peek-through
const PAGE_WIDTH = SCREEN_WIDTH;
const PAGE_HEIGHT = 340;

const FLOATING_HEADER_HEIGHT = 170;

export function DashboardScreenV3() {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const insets = useSafeAreaInsets();
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
      setRecentGames(games.slice(0, 2));
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

  // Muted profit formatting - less aggressive colors
  const fmt = (val: number, showSign = true) => {
    const sign = showSign ? (val >= 0 ? "+" : "") : "";
    return `${sign}$${Math.abs(val).toFixed(0)}`;
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "Recent";
    const d = new Date(dateStr);
    const diffH = (Date.now() - d.getTime()) / 3600000;
    if (diffH < 1) return "Just now";
    if (diffH < 24) return `${Math.floor(diffH)}h ago`;
    if (diffH < 48) return "Yesterday";
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  // Card style - matching Cal AI: subtle borders, muted shadows
  const cardStyle = {
    backgroundColor: isDark ? "rgba(45, 45, 48, 0.9)" : "rgba(255, 255, 255, 0.95)",
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.06)",
  };

  const cardSmStyle = { ...cardStyle, borderRadius: RADIUS.lg };

  // Recent games: thin borders, inner box light dark / shade of black
  const recentCardBorder = {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: isDark ? "rgba(255,255,255,0.18)" : "rgba(0,0,0,0.12)",
    borderRadius: RADIUS.xl,
  };
  const innerBoxStyle = {
    backgroundColor: isDark ? "rgba(28, 28, 31, 0.98)" : "rgba(15, 15, 20, 0.08)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: isDark ? "rgba(255,255,255,0.18)" : "rgba(0,0,0,0.12)",
    borderRadius: RADIUS.lg,
  };

  // Muted profit colors - subtle tints instead of harsh red/green
  const profitColor = (val: number) => {
    if (val === 0) return colors.textSecondary;
    return val > 0 
      ? (isDark ? "rgba(52, 199, 89, 0.9)" : "#1B7340") 
      : (isDark ? "rgba(255, 69, 58, 0.9)" : "#C41E3A");
  };

  // Background gradient - starts at top, subtle wash down (not too much)
  const backgroundGradient = isDark 
    ? ["#121214", "#0d0d0f", "#0a0a0a"] as const
    : ["#F5F6F8", "#F0F1F3", "#E8E8EC"] as const;

  const headerTop = insets.top;

  return (
    <View style={styles.root}>
      {/* Background gradient - starts at top, subtle wash to bottom */}
      <LinearGradient
        colors={backgroundGradient}
        style={StyleSheet.absoluteFillObject}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        locations={[0, 0.5, 1]}
      />
      {/* Very light sunset overlay - from top only, subtle */}
      <LinearGradient
        colors={["rgba(255, 230, 210, 0.025)", "transparent"]}
        style={StyleSheet.absoluteFillObject}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        locations={[0, 0.2]}
      />

      {/* Floating header */}
      <View style={[styles.floatingHeader, { paddingTop: headerTop }]} pointerEvents="box-none">
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={{ fontSize: 28 }}>♠️</Text>
            <Text style={[styles.logoText, { color: colors.textPrimary }]}>Kvitt</Text>
          </View>
          <TouchableOpacity
            style={[styles.streakPill, {
              backgroundColor: isDark ? "rgba(45, 45, 48, 0.9)" : "rgba(255, 255, 255, 0.95)",
              borderWidth: 1,
              borderColor: isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.06)",
            }]}
            onPress={() => navigation.navigate("Milestones")}
            activeOpacity={0.7}
          >
            <Text style={{ fontSize: 16 }}>🔥</Text>
            <Text style={[{ fontSize: 16, fontWeight: "700", color: colors.textPrimary }]}>
              {stats?.streak || 0}
            </Text>
          </TouchableOpacity>
        </View>
        
        <View style={styles.welcomeWrap}>
          <Label style={{ letterSpacing: 1.5 }}>OVERVIEW</Label>
          <Title1 style={{ marginTop: 4, fontWeight: "700" }}>Welcome back, {userName.split(" ")[0]}</Title1>
          <Subhead style={{ marginTop: 2, opacity: 0.7 }}>Here's your poker overview</Subhead>
        </View>
        
        {/* Shooting star divider - orange gradient left to right fade */}
        <View style={styles.dividerWrap}>
          <LinearGradient
            colors={["#FF6B35", "#FF8C42", "transparent"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.shootingStarLine}
          />
        </View>
      </View>

      {/* Scrollable Body */}
      <ScrollView
        style={styles.body}
        contentContainerStyle={[styles.bodyContent, { paddingTop: FLOATING_HEADER_HEIGHT + headerTop }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.textMuted} />}
      >
        {/* Horizontal Pager - no peek-through */}
        <View style={styles.pagerWrap}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={handlePageScroll}
            decelerationRate="fast"
            snapToInterval={PAGE_WIDTH}
            snapToAlignment="start"
            contentContainerStyle={styles.pagerInner}
          >
            {/* Page 1: Live Games + Groups - top box = bottom 3 boxes height */}
            <View style={styles.page}>
            <View style={styles.pageSection}>
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
                  <View style={[styles.liveDot, { backgroundColor: activeGames.length > 0 ? profitColor(1) : colors.textMuted }]} />
                  <Text style={{ fontSize: 13, fontWeight: "600", color: colors.textSecondary }}>
                    {activeGames.length > 0 ? "Active now" : "None active"}
                  </Text>
                </View>
              </View>
              <View style={[styles.ring, { borderColor: isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.08)" }]}>
                <Text style={{ fontSize: 32 }}>♠️</Text>
              </View>
            </TouchableOpacity>
            </View>
            <View style={styles.pageSection}>
            <View style={styles.triRow}>
              <TouchableOpacity style={[styles.triCard, cardSmStyle]} onPress={() => navigation.navigate("Groups")} activeOpacity={0.7}>
                <Text style={[styles.triVal, { color: colors.textPrimary }]}>{groups.length}</Text>
                <Text style={[styles.triLabel, { color: colors.textSecondary }]}>Groups</Text>
                <View style={[styles.triRing, { borderColor: isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.08)" }]}>
                  <Ionicons name="people" size={16} color={colors.textSecondary} />
                </View>
              </TouchableOpacity>
              <View style={[styles.triCard, cardSmStyle]}>
                <Text style={[styles.triVal, { color: profitColor(netProfit) }]}>{fmt(netProfit)}</Text>
                <Text style={[styles.triLabel, { color: colors.textSecondary }]}>Net profit</Text>
                <View style={[styles.triRing, { borderColor: isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.08)" }]}>
                  <Text style={{ fontSize: 18 }}>💰</Text>
                </View>
              </View>
              <View style={[styles.triCard, cardSmStyle]}>
                <Text style={[styles.triVal, { color: profitColor(balances.net_balance || 0) }]}>
                  ${Math.abs(balances.net_balance || 0).toFixed(0)}
                </Text>
                <Text style={[styles.triLabel, { color: colors.textSecondary }]}>Balance</Text>
                <View style={[styles.triRing, { borderColor: isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.08)" }]}>
                  <Text style={{ fontSize: 18 }}>💳</Text>
                </View>
              </View>
            </View>
            </View>
          </View>

            {/* Page 2: Performance - top 3 boxes = bottom 1 box height */}
            <View style={styles.page}>
            <View style={styles.pageSection}>
            <View style={styles.triRow}>
              <View style={[styles.triCard, cardSmStyle]}>
                <Text style={[styles.triVal, { color: profitColor(avgProfit) }]}>{fmt(avgProfit)}</Text>
                <Text style={[styles.triLabel, { color: colors.textSecondary }]}>Avg profit</Text>
                <View style={[styles.triRing, { borderColor: isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.08)" }]}>
                  <Text style={{ fontSize: 18 }}>📈</Text>
                </View>
              </View>
              <View style={[styles.triCard, cardSmStyle]}>
                <Text style={[styles.triVal, { color: profitColor(bestWin) }]}>+${bestWin.toFixed(0)}</Text>
                <Text style={[styles.triLabel, { color: colors.textSecondary }]}>Best win</Text>
                <View style={[styles.triRing, { borderColor: isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.08)" }]}>
                  <Text style={{ fontSize: 18 }}>⭐</Text>
                </View>
              </View>
              <View style={[styles.triCard, cardSmStyle]}>
                <Text style={[styles.triVal, { color: profitColor(-worstLoss) }]}>-${Math.abs(worstLoss).toFixed(0)}</Text>
                <Text style={[styles.triLabel, { color: colors.textSecondary }]}>Worst loss</Text>
                <View style={[styles.triRing, { borderColor: isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.08)" }]}>
                  <Text style={{ fontSize: 18 }}>💨</Text>
                </View>
              </View>
            </View>
            </View>
            <View style={styles.pageSection}>
            <View style={[styles.scoreCard, cardStyle]}>
              <View style={styles.scoreRow}>
                <Text style={{ color: colors.textPrimary, fontSize: 17, fontWeight: "600" }}>
                  Performance Score
                </Text>
                <Text style={{ fontSize: 15, fontWeight: "700", color: profitColor(roiPercent) }}>
                  {totalGames > 0 ? `${roiPercent.toFixed(0)}%` : "N/A"}
                </Text>
              </View>
              <View style={[styles.barTrack, { backgroundColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)" }]}>
                <View style={[styles.barFill, {
                  width: totalGames > 0 ? `${Math.min(Math.max(roiPercent, 0), 100)}%` as any : "0%",
                  backgroundColor: profitColor(roiPercent),
                }]} />
              </View>
              <Text style={{ color: colors.textMuted, fontSize: 12, lineHeight: 17, marginTop: 12 }}>
                {totalGames > 0
                  ? `${wins}W / ${losses}L across ${totalGames} games`
                  : "Play games to generate your score"}
              </Text>
            </View>
            </View>
          </View>

            {/* Page 3: Activity - top 2 boxes 80%, bottom 20% */}
            <View style={styles.page}>
            <View style={styles.pageSection80}>
            <View style={styles.splitRow}>
              <View style={[styles.splitCard, cardStyle]}>
                <Text style={{ color: colors.textSecondary, fontSize: 13, fontWeight: "600" }}>Win Rate</Text>
                <Text style={[styles.splitBig, { color: colors.textPrimary }]}>{winRate.toFixed(0)}%</Text>
                <View style={styles.splitMeta}>
                  <Ionicons name="trophy" size={12} color={colors.textMuted} />
                  <Text style={{ color: colors.textMuted, fontSize: 11 }}>{wins}W / {losses}L</Text>
                </View>
              </View>
              <View style={[styles.splitCard, cardStyle]}>
                <Text style={{ color: colors.textSecondary, fontSize: 13, fontWeight: "600" }}>Total Games</Text>
                <Text style={[styles.splitBig, { color: colors.textPrimary }]}>{totalGames}</Text>
                <View style={styles.splitMeta}>
                  <Ionicons name="game-controller" size={12} color={colors.textMuted} />
                  <Text style={{ color: colors.textMuted, fontSize: 11 }}>
                    {totalGames > 0 ? "Lifetime" : "No games"}
                  </Text>
                </View>
              </View>
            </View>
            </View>
            <View style={styles.pageSection20}>
            <TouchableOpacity
              style={[styles.aiBar, cardStyle]}
              onPress={() => navigation.navigate("AIAssistant")}
              activeOpacity={0.7}
            >
              <View style={styles.aiBarLeft}>
                <View style={[styles.aiIconBox, { backgroundColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)" }]}>
                  <Ionicons name="sparkles" size={18} color={colors.textSecondary} />
                </View>
                <View>
                  <Text style={{ color: colors.textPrimary, fontSize: 15, fontWeight: "600" }}>AI Assistant</Text>
                  <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 1 }}>
                    {aiUsage ? `${aiUsage.requests_remaining} requests left` : "Analyze your game"}
                  </Text>
                </View>
              </View>
              <View style={[styles.aiBarBtn, { backgroundColor: colors.textPrimary }]}>
                <Text style={{ color: isDark ? "#000" : "#FFF", fontSize: 13, fontWeight: "600" }}>Open</Text>
              </View>
            </TouchableOpacity>
            </View>
            </View>
          </ScrollView>

          {/* Page dots - inside pager, close to cards */}
          <View style={styles.dots}>
          {[0, 1, 2].map((i) => (
            <View key={i} style={[
              styles.dot,
              { backgroundColor: isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.12)" },
              activePage === i && { backgroundColor: colors.textPrimary, width: 8 },
            ]} />
          ))}
          </View>
        </View>

        {/* Recent Games - outer box + inner box style */}
        <Title2 style={styles.sectionH2}>Recent games</Title2>

        <View style={styles.recentOuter}>
          <View style={[
            styles.recentCard,
            {
              backgroundColor: isDark ? "rgba(45, 45, 48, 0.9)" : "rgba(255, 255, 255, 0.95)",
              ...recentCardBorder,
            },
          ]}>
            {recentGames.length > 0 ? (
              <>
                {recentGames.map((game, idx) => {
                  const result = game.net_result || game.result || 0;
                  const title = game.title || game.group_name || "Game Night";
                  const dateStr = game.ended_at || game.created_at || game.date || "";
                  const playerCount = game.player_count || game.players?.length || 0;
                  const isActive = game.status === "active";
                  return (
                    <TouchableOpacity
                      key={game.game_id || game._id || idx}
                      activeOpacity={0.6}
                      onPress={() => navigation.navigate("GameNight", { gameId: game.game_id || game._id })}
                      style={idx > 0 && styles.gameRowSpacer}
                    >
                      <View style={[styles.innerBox, innerBoxStyle]}>
                        <View style={[
                          styles.gameAvatar,
                          { backgroundColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)" },
                          isActive && { backgroundColor: isDark ? "rgba(52,199,89,0.12)" : "rgba(52,199,89,0.08)" }
                        ]}>
                          <Text style={{ fontSize: 18 }}>♠️</Text>
                        </View>
                        <View style={styles.gameInfo}>
                          <Title3 style={{ color: colors.textPrimary, fontSize: 17 }} numberOfLines={1}>
                            {title}
                          </Title3>
                          <Text style={{ color: colors.textMuted, fontSize: 13, marginTop: 4 }}>
                            {playerCount > 0 ? `${playerCount} players` : ""}
                            {playerCount > 0 && dateStr ? "  ·  " : ""}
                            {formatDate(dateStr)}
                          </Text>
                        </View>
                        <View style={styles.gameResultCol}>
                          <Text style={{ fontSize: 16, fontWeight: "700", color: result !== 0 ? profitColor(result) : colors.textMuted }}>
                            {result !== 0 ? fmt(result) : "--"}
                          </Text>
                          {isActive && (
                            <View style={[styles.liveBadge, { backgroundColor: isDark ? "rgba(52,199,89,0.12)" : "rgba(52,199,89,0.08)" }]}>
                              <Text style={{ color: profitColor(1), fontSize: 9, fontWeight: "700", letterSpacing: 0.5 }}>LIVE</Text>
                            </View>
                          )}
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                })}
                <Text style={[styles.recentCta, { color: colors.textSecondary }]}>
                  Start a game to see results here
                </Text>
              </>
            ) : (
              <View style={styles.emptyState}>
                <View style={[styles.innerBox, innerBoxStyle]}>
                  <View style={[styles.emptyCircle, { backgroundColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)" }]}>
                    <Text style={{ fontSize: 18 }}>♠️</Text>
                  </View>
                  <View style={styles.emptyLines}>
                    <View style={[styles.emptyLine1, { backgroundColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)" }]} />
                    <View style={[styles.emptyLine2, { backgroundColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)" }]} />
                  </View>
                </View>
                <Text style={[styles.recentCta, { color: colors.textSecondary }]}>
                  Start a game to see results here
                </Text>
              </View>
            )}
          </View>
        </View>

        <View style={{ height: 100 }} />
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
  
  floatingHeader: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: HORIZONTAL_PADDING,
    paddingTop: SPACE.sm,
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  logoText: { 
    fontSize: 28,
    fontWeight: "800", 
    letterSpacing: -0.5 
  },
  streakPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 100,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },

  welcomeWrap: { paddingHorizontal: HORIZONTAL_PADDING, marginTop: 16 },
  
  dividerWrap: { 
    paddingHorizontal: HORIZONTAL_PADDING, 
    marginTop: 14,
  },
  shootingStarLine: {
    height: 1,
    borderRadius: 0.5,
    width: "85%",
  },

  body: { flex: 1 },
  bodyContent: { paddingBottom: 88 },

  pagerWrap: {
    overflow: "hidden",
    marginBottom: SPACE.sm,
  },
  pagerInner: {},
  page: { 
    width: PAGE_WIDTH,
    height: PAGE_HEIGHT,
    paddingHorizontal: HORIZONTAL_PADDING,
    gap: SPACE.sm,
  },
  pageSection: { flex: 1, minHeight: 0 },
  pageSection80: { flex: 8, minHeight: 0 },
  pageSection20: { flex: 2, minHeight: 0 },

  heroCard: {
    flex: 1,
    paddingHorizontal: SPACE.xl,
    paddingVertical: SPACE.xl,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  heroNum: { fontSize: 64, fontWeight: "800", letterSpacing: -2, lineHeight: 64 },
  heroLabel: { fontSize: 14, marginTop: 4, fontWeight: "500" },
  heroStat: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8 },
  liveDot: { width: 6, height: 6, borderRadius: 3 },
  ring: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 6,
    alignItems: "center",
    justifyContent: "center",
  },

  triRow: { flex: 1, flexDirection: "row", gap: SPACE.sm },
  triCard: {
    flex: 1,
    paddingHorizontal: SPACE.lg,
    paddingVertical: SPACE.lg,
  },
  triVal: { fontSize: 20, fontWeight: "700", letterSpacing: -0.3 },
  triLabel: { fontSize: 11, marginTop: 2, fontWeight: "500" },
  triRing: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 4,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginTop: 10,
  },

  scoreCard: { flex: 1, paddingHorizontal: SPACE.xl, paddingVertical: SPACE.xl },
  scoreRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  barTrack: { height: 4, borderRadius: 2, marginTop: 12, overflow: "hidden" },
  barFill: { height: 4, borderRadius: 2 },

  splitRow: { flex: 1, flexDirection: "row", gap: SPACE.sm },
  splitCard: { flex: 1, paddingHorizontal: SPACE.xl, paddingVertical: SPACE.xl },
  splitBig: { fontSize: 48, fontWeight: "800", letterSpacing: -1, marginTop: 2 },
  splitMeta: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 8 },

  aiBar: {
    flex: 1,
    paddingHorizontal: SPACE.xl,
    paddingVertical: SPACE.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  aiBarLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  aiIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  aiBarBtn: { borderRadius: 16, paddingHorizontal: 16, paddingVertical: 8 },

  dots: { 
    flexDirection: "row", 
    justifyContent: "center", 
    gap: SPACE.sm, 
    marginTop: SPACE.sm,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },

  sectionH2: {
    marginTop: LAYOUT.sectionGap,
    paddingHorizontal: HORIZONTAL_PADDING,
    fontWeight: "700",
  },

  recentOuter: {
    marginTop: SPACE.md,
    marginHorizontal: HORIZONTAL_PADDING,
  },
  recentCard: {
    overflow: "hidden",
    padding: SPACE.lg,
  },
  innerBox: {
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  gameAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  gameInfo: { flex: 1 },
  gameResultCol: { alignItems: "flex-end" },
  liveBadge: {
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
    marginTop: 2,
  },

  gameRowSpacer: { marginTop: 10 },
  recentCta: {
    fontSize: 14,
    textAlign: "center",
    marginTop: 14,
  },
  emptyState: {
    paddingVertical: 20,
  },
  emptyCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyLines: { flex: 1, gap: 8 },
  emptyLine1: { height: 10, borderRadius: 5, width: "80%" },
  emptyLine2: { height: 8, borderRadius: 4, width: "50%" },
});