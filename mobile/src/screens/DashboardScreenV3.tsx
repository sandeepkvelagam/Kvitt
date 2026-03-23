import React, { useState, useCallback, useEffect, useRef, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Dimensions,
  RefreshControl,
  TouchableOpacity,
  Platform,
  NativeSyntheticEvent,
  NativeScrollEvent,
  LayoutChangeEvent,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import type { CompositeNavigationProp } from "@react-navigation/native";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { MainTabParamList } from "../navigation/mainTabTypes";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { FONT, SPACE, LAYOUT, RADIUS, APPLE_TYPO, BUTTON_SIZE } from "../styles/tokens";
import { COLORS, PAGE_HERO_GRADIENT, pageHeroGradientColors } from "../styles/liquidGlass";
import { Title1, Label, Subhead, Title2, Headline, Footnote, Caption2 } from "../components/ui";
import { useLanguage } from "../context/LanguageContext";
import { appleCardShadowResting, appleTileShadow } from "../styles/appleShadows";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
/** Apple-style horizontal margins — single value for the whole screen */
const SCREEN_PAD = LAYOUT.screenPadding;
// Full width pages, no peek-through
/** Slightly shorter pager so Upcoming sits higher and clears the floating tab bar */
const PAGE_HEIGHT = 300;
/** Full-width pages; measured on layout for paging + dots (matches ScrollView viewport) */
const INITIAL_METRICS_PAGER_W = SCREEN_WIDTH;

const TAB_BAR_RESERVE_BASE = 128;
const UPCOMING_CARD_WIDTH = Math.min(SCREEN_WIDTH * 0.78, 320);
const UPCOMING_ROW_HEIGHT = 112;
const UPCOMING_GAP = LAYOUT.elementGap;

type DashboardNav = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, "Home">,
  NativeStackNavigationProp<any>
>;

export function DashboardScreenV3() {
  const navigation = useNavigation<DashboardNav>();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { colors, isDark } = useTheme();
  const { t } = useLanguage();
  const [activePage, setActivePage] = useState(0);
  /** Viewport width of the metrics horizontal ScrollView — must match each page width for paging + dots */
  const [metricsPagerW, setMetricsPagerW] = useState(INITIAL_METRICS_PAGER_W);
  const metricsPagerWRef = useRef(INITIAL_METRICS_PAGER_W);
  const [refreshing, setRefreshing] = useState(false);

  // API data
  const [stats, setStats] = useState<any>(null);
  const [balances, setBalances] = useState<any>({ net_balance: 0, total_you_owe: 0, total_owed_to_you: 0 });
  const [liveGames, setLiveGames] = useState<any[]>([]);
  const [scheduledGames, setScheduledGames] = useState<any[]>([]);
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
      setLiveGames(games.filter((g: any) => g.status === "active"));
      setScheduledGames(games.filter((g: any) => g.status === "scheduled"));
      setGroups(Array.isArray(groupsRes.data) ? groupsRes.data : []);
      if (aiUsageRes.data) setAiUsage(aiUsageRes.data);
    } catch {}
  }, []);

  useEffect(() => {
    (async () => {
      await api.post("/users/me/activity").catch(() => {});
      await fetchDashboard();
    })();
  }, [fetchDashboard]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      // Don’t block refresh on activity logging — spinner follows dashboard fetch only
      void api.post("/users/me/activity").catch(() => {});
      await fetchDashboard();
    } finally {
      setRefreshing(false);
    }
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

  const updateActivePageFromOffset = useCallback((offsetX: number) => {
    const w = metricsPagerWRef.current;
    if (w <= 0) return;
    const page = Math.round(offsetX / w);
    setActivePage(Math.min(Math.max(page, 0), 2));
  }, []);

  const onMetricsPagerLayout = useCallback((e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w > 0 && Math.abs(w - metricsPagerWRef.current) > 0.5) {
      metricsPagerWRef.current = w;
      setMetricsPagerW(w);
    }
  }, []);

  const handleMetricsPagerScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      updateActivePageFromOffset(e.nativeEvent.contentOffset.x);
    },
    [updateActivePageFromOffset]
  );

  const handleMetricsPagerScrollEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      updateActivePageFromOffset(e.nativeEvent.contentOffset.x);
    },
    [updateActivePageFromOffset]
  );

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

  const cardStyle = {
    backgroundColor: isDark ? "rgba(45, 45, 48, 0.9)" : "rgba(255, 255, 255, 0.95)",
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.06)",
    ...appleCardShadowResting(isDark),
  };

  const cardSmStyle = { ...cardStyle, borderRadius: RADIUS.lg };

  // Muted profit colors - subtle tints instead of harsh red/green
  const profitColor = (val: number) => {
    if (val === 0) return colors.textSecondary;
    return val > 0 
      ? (isDark ? "rgba(52, 199, 89, 0.9)" : "#1B7340") 
      : (isDark ? "rgba(255, 69, 58, 0.9)" : "#C41E3A");
  };

  /** Thin pad between rim and icon: soft cool neutral (not a brand/highlight accent) */
  const metricRingPad = useMemo(
    () => ({
      padBg: isDark ? "rgba(168, 182, 215, 0.1)" : "rgba(88, 102, 138, 0.07)",
      rimBorder: isDark ? "rgba(255, 255, 255, 0.09)" : "rgba(0, 0, 0, 0.07)",
    }),
    [isDark]
  );

  const backgroundColor = isDark ? COLORS.jetDark : colors.contentBg;

  const headerTop = insets.top;
  const tabBarReserve = TAB_BAR_RESERVE_BASE + Math.max(insets.bottom, 8);
  /** Extra scroll padding so Upcoming clears the floating tab bar + FAB comfortably */
  const scrollBottomPad = tabBarReserve + LAYOUT.sectionGap + SPACE.xxxl + SPACE.xl;

  const firstGameId = liveGames[0]?.game_id || liveGames[0]?._id || scheduledGames[0]?.game_id || scheduledGames[0]?._id;

  return (
    <View style={[styles.root, { backgroundColor }]}>
      <LinearGradient
        pointerEvents="none"
        colors={pageHeroGradientColors(isDark)}
        locations={[...PAGE_HERO_GRADIENT.locations]}
        start={PAGE_HERO_GRADIENT.start}
        end={PAGE_HERO_GRADIENT.end}
        style={[
          styles.topGradient,
          {
            height: Math.min(PAGE_HERO_GRADIENT.maxHeight, headerTop + PAGE_HERO_GRADIENT.safeAreaPad),
          },
        ]}
      />

      {/*
        Use RN ScrollView here (not RNGH) so the system pull-to-refresh spinner shows reliably.
      */}
      <ScrollView
        style={[styles.body, styles.bodyAboveGradient]}
        contentContainerStyle={[
          styles.bodyContent,
          {
            flexGrow: 1,
            paddingBottom: scrollBottomPad,
          },
        ]}
        showsVerticalScrollIndicator={false}
        bounces
        alwaysBounceVertical
        {...(Platform.OS === "android"
          ? ({ overScrollMode: "always" } as const)
          : {})}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.orange}
            titleColor={colors.textSecondary}
            colors={[colors.orange]}
            progressBackgroundColor={isDark ? "#3A3A3C" : "#FFFFFF"}
            progressViewOffset={Platform.OS === "android" ? headerTop + 12 : undefined}
          />
        }
      >
        {/* Safe area as content, not contentContainer padding — keeps pull-to-refresh spinner visible */}
        <View style={{ height: headerTop }} collapsable={false} />
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={{ fontSize: 28 }}>♠️</Text>
            <Text style={[styles.logoText, { color: colors.textPrimary }]}>Kvitt</Text>
          </View>
          <View style={styles.headerTrailing}>
            {refreshing ? (
              <View
                style={styles.headerRefreshIndicator}
                accessibilityLabel="Refreshing"
                accessibilityLiveRegion="polite"
              >
                <ActivityIndicator size="small" color={colors.orange} />
              </View>
            ) : null}
            <TouchableOpacity
              style={[styles.streakPill, {
                backgroundColor: isDark ? "rgba(45, 45, 48, 0.9)" : "rgba(255, 255, 255, 0.95)",
                borderWidth: 1,
                borderColor: isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.06)",
                ...appleCardShadowResting(isDark),
              }]}
              onPress={() => navigation.navigate("Milestones")}
              activeOpacity={0.7}
              hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
              accessibilityRole="button"
              accessibilityLabel="Milestones and streak"
            >
              <Text style={{ fontSize: APPLE_TYPO.footnote.size, lineHeight: 18 }}>🔥</Text>
              <Text
                style={[
                  {
                    fontSize: APPLE_TYPO.footnote.size,
                    lineHeight: 18,
                    fontWeight: "700" as const,
                    color: colors.textPrimary,
                  },
                ]}
              >
                {stats?.streak || 0}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.welcomeWrap}>
          <Label style={{ letterSpacing: 1.5 }}>OVERVIEW</Label>
          <Title1 style={{ marginTop: SPACE.xs, fontWeight: "700" }}>Welcome back, {userName.split(" ")[0]}</Title1>
          <Subhead style={{ marginTop: SPACE.xs, opacity: 0.7 }}>Here's your poker overview</Subhead>
        </View>

        <View style={styles.dividerWrap}>
          <LinearGradient
            colors={["#FF6B35", "#FF8C42", "transparent"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.shootingStarLine}
          />
        </View>
        {/* Metrics carousel — no outer wrapper (only individual cards have surfaces); transparent scroll */}
        <View style={styles.pagerWrap}>
            <ScrollView
              horizontal
              pagingEnabled
              nestedScrollEnabled
              showsHorizontalScrollIndicator={false}
              style={styles.metricsPagerScroll}
              contentContainerStyle={styles.pagerInner}
              onLayout={onMetricsPagerLayout}
              onScroll={handleMetricsPagerScroll}
              scrollEventThrottle={16}
              onMomentumScrollEnd={handleMetricsPagerScrollEnd}
            >
            {/* Page 1: Live Games + Groups */}
            <View style={[styles.page, { width: metricsPagerW }]}>
            <View style={styles.pageSection}>
            <TouchableOpacity
              style={[styles.heroCard, cardStyle]}
              activeOpacity={0.7}
              hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
              onPress={() => {
                if (firstGameId) {
                  navigation.navigate("GameNight", { gameId: firstGameId });
                } else {
                  navigation.navigate("Groups");
                }
              }}
            >
              <View>
                <Text style={[styles.heroNum, { color: colors.textPrimary }]}>{liveGames.length}</Text>
                <Text style={[styles.heroLabel, { color: colors.textSecondary }]}>Live games</Text>
                <View style={styles.heroStat}>
                  <View style={[styles.liveDot, { backgroundColor: liveGames.length > 0 ? profitColor(1) : colors.textMuted }]} />
                  <Footnote bold color={colors.textSecondary}>
                    {liveGames.length > 0 ? "Active now" : "None active"}
                  </Footnote>
                </View>
              </View>
              <View
                style={[
                  styles.ringOuter,
                  { backgroundColor: metricRingPad.padBg, borderColor: metricRingPad.rimBorder },
                ]}
              >
                <View style={[styles.ringInner, { backgroundColor: cardStyle.backgroundColor }]}>
                  <Text style={{ fontSize: 32 }}>♠️</Text>
                </View>
              </View>
            </TouchableOpacity>
            </View>
            <View style={styles.pageSection}>
            <View style={styles.triRow}>
              <TouchableOpacity
                style={[styles.triCard, cardSmStyle]}
                onPress={() => navigation.navigate("Groups")}
                activeOpacity={0.7}
                hitSlop={{ top: 8, bottom: 8, left: 0, right: 0 }}
              >
                <Text style={[styles.triVal, { color: colors.textPrimary }]}>{groups.length}</Text>
                <Text style={[styles.triLabel, { color: colors.textSecondary }]}>{t.nav.groups}</Text>
                <View
                  style={[
                    styles.triRingOuter,
                    { backgroundColor: metricRingPad.padBg, borderColor: metricRingPad.rimBorder },
                  ]}
                >
                  <View style={[styles.triRingInner, { backgroundColor: cardStyle.backgroundColor }]}>
                    <Ionicons name="people" size={18} color={colors.textSecondary} />
                  </View>
                </View>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.triCard, cardSmStyle]}
                onPress={() => navigation.navigate("Milestones")}
                activeOpacity={0.7}
                hitSlop={{ top: 8, bottom: 8, left: 0, right: 0 }}
              >
                <Text style={[styles.triVal, { color: colors.textPrimary }]}>{stats?.streak ?? 0}</Text>
                <Text style={[styles.triLabel, { color: colors.textSecondary }]}>{t.dashboard.streak}</Text>
                <View
                  style={[
                    styles.triRingOuter,
                    { backgroundColor: metricRingPad.padBg, borderColor: metricRingPad.rimBorder },
                  ]}
                >
                  <View style={[styles.triRingInner, { backgroundColor: cardStyle.backgroundColor }]}>
                    <Ionicons name="flame" size={18} color={isDark ? "rgba(255, 149, 0, 0.95)" : "#FF9500"} />
                  </View>
                </View>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.triCard, cardSmStyle]}
                onPress={() => navigation.navigate("Wallet")}
                activeOpacity={0.7}
                hitSlop={{ top: 8, bottom: 8, left: 0, right: 0 }}
              >
                <Text style={[styles.triVal, { color: profitColor(balances.net_balance || 0) }]}>
                  ${Math.abs(balances.net_balance || 0).toFixed(0)}
                </Text>
                <Text style={[styles.triLabel, { color: colors.textSecondary }]}>{t.nav.wallet}</Text>
                <View
                  style={[
                    styles.triRingOuter,
                    { backgroundColor: metricRingPad.padBg, borderColor: metricRingPad.rimBorder },
                  ]}
                >
                  <View style={[styles.triRingInner, { backgroundColor: cardStyle.backgroundColor }]}>
                    <Ionicons name="wallet-outline" size={18} color={colors.textSecondary} />
                  </View>
                </View>
              </TouchableOpacity>
            </View>
            </View>
          </View>

            {/* Page 2: Performance */}
            <View style={[styles.page, { width: metricsPagerW }]}>
            <View style={styles.pageSection}>
            <View style={styles.triRow}>
              <View style={[styles.triCard, cardSmStyle]}>
                <Text style={[styles.triVal, { color: profitColor(avgProfit) }]}>{fmt(avgProfit)}</Text>
                <Text style={[styles.triLabel, { color: colors.textSecondary }]}>Avg / game</Text>
                <View
                  style={[
                    styles.triRingOuter,
                    { backgroundColor: metricRingPad.padBg, borderColor: metricRingPad.rimBorder },
                  ]}
                >
                  <View style={[styles.triRingInner, { backgroundColor: cardStyle.backgroundColor }]}>
                    <Ionicons name="analytics-outline" size={18} color={colors.textSecondary} />
                  </View>
                </View>
              </View>
              <TouchableOpacity
                style={[styles.triCard, cardSmStyle]}
                onPress={() => navigation.navigate("SettlementHistory" as any)}
                activeOpacity={0.7}
                hitSlop={{ top: 8, bottom: 8, left: 0, right: 0 }}
              >
                <Text style={[styles.triVal, { color: profitColor(netProfit) }]}>{fmt(netProfit)}</Text>
                <Text style={[styles.triLabel, { color: colors.textSecondary }]}>{t.dashboard.netProfit}</Text>
                <View
                  style={[
                    styles.triRingOuter,
                    { backgroundColor: metricRingPad.padBg, borderColor: metricRingPad.rimBorder },
                  ]}
                >
                  <View style={[styles.triRingInner, { backgroundColor: cardStyle.backgroundColor }]}>
                    <Ionicons name="cash-outline" size={18} color={colors.textSecondary} />
                  </View>
                </View>
              </TouchableOpacity>
              <View style={[styles.triCard, cardSmStyle]}>
                <Text style={[styles.triVal, { color: profitColor(roiPercent) }]}>
                  {totalBuyIns > 0 ? `${roiPercent.toFixed(0)}%` : "—"}
                </Text>
                <Text style={[styles.triLabel, { color: colors.textSecondary }]}>ROI</Text>
                <View
                  style={[
                    styles.triRingOuter,
                    { backgroundColor: metricRingPad.padBg, borderColor: metricRingPad.rimBorder },
                  ]}
                >
                  <View style={[styles.triRingInner, { backgroundColor: cardStyle.backgroundColor }]}>
                    <Ionicons name="trending-up-outline" size={18} color={colors.textSecondary} />
                  </View>
                </View>
              </View>
            </View>
            </View>
            <View style={styles.pageSection}>
            <View style={[styles.scoreCard, cardStyle]}>
              <View style={styles.scoreRow}>
                <Headline>Performance Score</Headline>
                <Subhead bold style={{ color: profitColor(roiPercent) }}>
                  {totalGames > 0 ? `${roiPercent.toFixed(0)}%` : "N/A"}
                </Subhead>
              </View>
              <View style={[styles.barTrack, { backgroundColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)" }]}>
                <View style={[styles.barFill, {
                  width: totalGames > 0 ? `${Math.min(Math.max(roiPercent, 0), 100)}%` as any : "0%",
                  backgroundColor: profitColor(roiPercent),
                }]} />
              </View>
              <Text
                style={{
                  color: colors.textMuted,
                  fontSize: APPLE_TYPO.caption.size,
                  lineHeight: 17,
                  marginTop: SPACE.md,
                }}
              >
                {totalGames > 0
                  ? `${wins}W / ${losses}L across ${totalGames} games`
                  : "Play games to generate your score"}
              </Text>
            </View>
            </View>
          </View>

            {/* Page 3: Activity */}
            <View style={[styles.page, { width: metricsPagerW }]}>
            <View style={styles.pageSection80}>
            <View style={styles.splitRow}>
              <View style={[styles.splitCard, cardStyle]}>
                <Footnote bold color={colors.textSecondary}>Win Rate</Footnote>
                <Text style={[styles.splitBig, { color: colors.textPrimary }]}>{winRate.toFixed(0)}%</Text>
                <View style={styles.splitMeta}>
                  <Ionicons name="trophy" size={12} color={colors.textMuted} />
                  <Caption2 style={{ color: colors.textMuted }}>{wins}W / {losses}L</Caption2>
                </View>
              </View>
              <View style={[styles.splitCard, cardStyle]}>
                <Footnote bold color={colors.textSecondary}>Total Games</Footnote>
                <Text style={[styles.splitBig, { color: colors.textPrimary }]}>{totalGames}</Text>
                <View style={styles.splitMeta}>
                  <Ionicons name="game-controller" size={12} color={colors.textMuted} />
                  <Caption2 style={{ color: colors.textMuted }}>
                    {totalGames > 0 ? "Lifetime" : "No games"}
                  </Caption2>
                </View>
              </View>
            </View>
            </View>
            <View style={styles.pageSection20}>
            <TouchableOpacity
              style={[styles.aiBar, cardStyle]}
              onPress={() => navigation.navigate("AIAssistant")}
              activeOpacity={0.7}
              hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
            >
              <View style={styles.aiBarLeft}>
                <View style={[styles.aiIconBox, { backgroundColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)" }]}>
                  <Ionicons name="sparkles" size={18} color={colors.textSecondary} />
                </View>
                <View>
                  <Subhead bold>AI Assistant</Subhead>
                  <Caption2 style={{ color: colors.textMuted, marginTop: SPACE.xs }}>
                    {aiUsage ? `${aiUsage.requests_remaining} requests left` : "Analyze your game"}
                  </Caption2>
                </View>
              </View>
              <View style={[styles.aiBarBtn, { backgroundColor: colors.textPrimary }]}>
                <Text style={{ color: isDark ? "#000" : "#FFF", fontSize: APPLE_TYPO.footnote.size, fontWeight: "600" }}>Open</Text>
              </View>
            </TouchableOpacity>
            </View>
            </View>
            </ScrollView>

          <View style={styles.dots} accessibilityLabel="Metrics pages">
            {[0, 1, 2].map((i) => (
              <View
                key={i}
                style={[
                  activePage === i ? styles.dotActive : styles.dot,
                  {
                    backgroundColor:
                      activePage === i
                        ? colors.textPrimary
                        : isDark
                          ? "rgba(255,255,255,0.2)"
                          : "rgba(0,0,0,0.14)",
                  },
                ]}
              />
            ))}
          </View>
        </View>

        <Title2 style={styles.sectionH2}>{t.dashboard.upcoming}</Title2>

        <View style={styles.upcomingOuter}>
          {scheduledGames.length > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              decelerationRate="fast"
              snapToInterval={UPCOMING_CARD_WIDTH + UPCOMING_GAP}
              snapToAlignment="start"
              contentContainerStyle={styles.upcomingScrollContent}
            >
              {scheduledGames.map((game, idx) => {
                const title = game.title || game.group_name || "Game Night";
                const dateStr = game.scheduled_at || game.started_at || game.created_at || game.date || "";
                const playerCount = game.player_count || game.players?.length || 0;
                return (
                  <TouchableOpacity
                    key={game.game_id || game._id || idx}
                    activeOpacity={0.85}
                    onPress={() => navigation.navigate("GameNight", { gameId: game.game_id || game._id })}
                    style={[
                      styles.upcomingCard,
                      {
                        width: UPCOMING_CARD_WIDTH,
                        backgroundColor: isDark ? "rgba(45, 45, 48, 0.95)" : "rgba(255, 255, 255, 0.98)",
                        borderColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.08)",
                        ...appleCardShadowResting(isDark),
                      },
                    ]}
                  >
                    <View style={[styles.upcomingIconWrap, { backgroundColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)" }]}>
                      <Ionicons name="calendar-outline" size={22} color={colors.textSecondary} />
                    </View>
                    <View style={styles.upcomingCardText}>
                      <Text style={[styles.upcomingTitle, { color: colors.textPrimary }]} numberOfLines={1}>
                        {title}
                      </Text>
                      <Text style={[styles.upcomingMeta, { color: colors.textMuted }]} numberOfLines={1}>
                        {formatDate(dateStr)}
                        {playerCount > 0 ? ` · ${playerCount} players` : ""}
                      </Text>
                      <View style={[styles.scheduledPill, { backgroundColor: isDark ? "rgba(255,149,0,0.15)" : "rgba(255,149,0,0.12)" }]}>
                        <Caption2 style={{ fontWeight: "700", letterSpacing: 0.5, color: colors.textSecondary }}>
                          SCHEDULED
                        </Caption2>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          ) : (
            <View
              style={[
                styles.upcomingEmptyCard,
                {
                  backgroundColor: isDark ? "rgba(45, 45, 48, 0.75)" : "rgba(255, 255, 255, 0.9)",
                  borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)",
                  ...appleCardShadowResting(isDark),
                },
              ]}
            >
              <Ionicons name="calendar-outline" size={28} color={colors.textMuted} />
              <Text style={[styles.upcomingEmptyTitle, { color: colors.textPrimary }]}>{t.dashboard.upcomingEmpty}</Text>
              <Text style={[styles.upcomingEmptySub, { color: colors.textSecondary }]}>{t.dashboard.upcomingHint}</Text>
              <TouchableOpacity
                style={[
                  styles.upcomingCta,
                  {
                    backgroundColor: colors.buttonPrimary,
                    minHeight: LAYOUT.touchTarget,
                    justifyContent: "center",
                    alignItems: "center",
                  },
                ]}
                onPress={() => navigation.navigate("Scheduler")}
                activeOpacity={0.85}
              >
                <Text style={{ color: colors.buttonText, fontSize: APPLE_TYPO.subhead.size, fontWeight: "600" }}>{t.dashboard.openScheduler}</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>

    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  topGradient: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 0,
  },
  bodyAboveGradient: {
    zIndex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SCREEN_PAD,
    paddingTop: SPACE.md,
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: SPACE.sm },
  /** Streak + in-flight refresh indicator (spinner only while pull-refresh runs) */
  headerTrailing: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.sm,
  },
  headerRefreshIndicator: {
    width: LAYOUT.touchTarget,
    height: LAYOUT.touchTarget,
    alignItems: "center",
    justifyContent: "center",
  },
  logoText: {
    fontSize: FONT.h1.size,
    fontWeight: FONT.h1.weight,
    letterSpacing: -0.5,
  },
  streakPill: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACE.xs,
    borderRadius: 100,
    paddingHorizontal: SPACE.md,
    paddingVertical: SPACE.xs,
  },

  welcomeWrap: { paddingHorizontal: SCREEN_PAD, marginTop: LAYOUT.sectionGap },
  
  dividerWrap: { 
    paddingHorizontal: SCREEN_PAD, 
    marginTop: SPACE.lg,
  },
  shootingStarLine: {
    height: 1,
    borderRadius: 0.5,
    width: "85%",
  },

  body: { flex: 1 },
  bodyContent: {},

  pagerWrap: {
    marginTop: SPACE.md,
    marginBottom: SPACE.sm,
    backgroundColor: "transparent",
  },
  metricsPagerScroll: {
    backgroundColor: "transparent",
  },
  pagerInner: {
    backgroundColor: "transparent",
  },
  /** Width set inline to match ScrollView viewport (required for pagingEnabled + dots) */
  page: {
    height: PAGE_HEIGHT,
    paddingHorizontal: SCREEN_PAD,
    gap: LAYOUT.elementGap,
  },
  pageSection: { flex: 1, minHeight: 0 },
  pageSection80: { flex: 8, minHeight: 0 },
  pageSection20: { flex: 2, minHeight: 0 },

  heroCard: {
    flex: 1,
    paddingHorizontal: SPACE.lg,
    paddingVertical: SPACE.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  heroNum: {
    fontSize: 56,
    fontWeight: "800",
    letterSpacing: -2,
    lineHeight: 56,
  },
  heroLabel: {
    fontSize: APPLE_TYPO.footnote.size,
    lineHeight: 18,
    marginTop: SPACE.xs,
    fontWeight: "500",
  },
  heroStat: { flexDirection: "row", alignItems: "center", gap: SPACE.sm, marginTop: SPACE.sm },
  liveDot: { width: 6, height: 6, borderRadius: 3 },
  ringOuter: {
    width: 88,
    height: 88,
    borderRadius: 44,
    padding: 5,
    borderWidth: StyleSheet.hairlineWidth * 2,
    alignItems: "center",
    justifyContent: "center",
  },
  ringInner: {
    width: 78,
    height: 78,
    borderRadius: 39,
    alignItems: "center",
    justifyContent: "center",
  },

  triRow: { flex: 1, flexDirection: "row", gap: SPACE.sm },
  triCard: {
    flex: 1,
    paddingHorizontal: SPACE.md,
    paddingVertical: SPACE.md,
  },
  triVal: {
    fontSize: FONT.h3.size,
    fontWeight: "700",
    letterSpacing: -0.3,
  },
  triLabel: {
    fontSize: APPLE_TYPO.caption.size,
    lineHeight: 16,
    marginTop: SPACE.xs,
    fontWeight: "500",
  },
  triRingOuter: {
    width: 44,
    height: 44,
    borderRadius: 22,
    padding: 3,
    borderWidth: StyleSheet.hairlineWidth * 2,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginTop: SPACE.sm,
  },
  triRingInner: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },

  scoreCard: { flex: 1, paddingHorizontal: SPACE.lg, paddingVertical: SPACE.lg },
  scoreRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  barTrack: { height: 4, borderRadius: 2, marginTop: SPACE.md, overflow: "hidden" },
  barFill: { height: 4, borderRadius: 2 },

  splitRow: { flex: 1, flexDirection: "row", gap: SPACE.sm },
  splitCard: { flex: 1, paddingHorizontal: SPACE.lg, paddingVertical: SPACE.lg },
  splitBig: { fontSize: 44, fontWeight: "800", letterSpacing: -1, marginTop: SPACE.xs },
  splitMeta: { flexDirection: "row", alignItems: "center", gap: SPACE.xs, marginTop: SPACE.sm },

  aiBar: {
    flex: 1,
    paddingHorizontal: SPACE.lg,
    paddingVertical: SPACE.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  aiBarLeft: { flexDirection: "row", alignItems: "center", gap: LAYOUT.elementGap },
  aiIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  aiBarBtn: {
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACE.lg,
    paddingVertical: SPACE.sm,
    minHeight: LAYOUT.touchTarget,
    justifyContent: "center",
    alignItems: "center",
  },

  dots: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: SPACE.sm,
    marginTop: SPACE.sm,
    paddingBottom: 0,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  dotActive: {
    width: 22,
    height: 6,
    borderRadius: 3,
  },

  sectionH2: {
    marginTop: SPACE.md,
    paddingHorizontal: SCREEN_PAD,
    fontWeight: "700",
  },

  upcomingOuter: {
    marginTop: SPACE.sm,
    marginBottom: LAYOUT.sectionGap + SPACE.md,
    minHeight: UPCOMING_ROW_HEIGHT,
  },
  upcomingScrollContent: {
    paddingHorizontal: SCREEN_PAD,
    paddingVertical: SPACE.xs,
    paddingRight: SCREEN_PAD + UPCOMING_GAP,
  },
  upcomingCard: {
    height: UPCOMING_ROW_HEIGHT,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    paddingHorizontal: SPACE.md,
    paddingVertical: SPACE.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.md,
    marginRight: UPCOMING_GAP,
  },
  upcomingIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  upcomingCardText: { flex: 1, minWidth: 0 },
  upcomingTitle: { fontSize: FONT.title.size, fontWeight: "700" },
  upcomingMeta: { fontSize: FONT.caption.size, marginTop: SPACE.xs },
  scheduledPill: {
    alignSelf: "flex-start",
    marginTop: SPACE.sm,
    paddingHorizontal: SPACE.sm,
    paddingVertical: SPACE.xs,
    borderRadius: SPACE.sm,
  },
  upcomingEmptyCard: {
    marginHorizontal: SCREEN_PAD,
    borderRadius: RADIUS.xl,
    borderWidth: StyleSheet.hairlineWidth,
    padding: SPACE.lg,
    alignItems: "center",
    minHeight: UPCOMING_ROW_HEIGHT + 24,
    justifyContent: "center",
  },
  upcomingEmptyTitle: {
    fontSize: FONT.title.size,
    fontWeight: "700",
    marginTop: SPACE.sm,
    textAlign: "center",
  },
  upcomingEmptySub: {
    fontSize: APPLE_TYPO.footnote.size,
    marginTop: SPACE.sm,
    textAlign: "center",
    lineHeight: 18,
    paddingHorizontal: SPACE.md,
  },
  upcomingCta: {
    marginTop: SPACE.md,
    paddingHorizontal: SPACE.xl,
    paddingVertical: SPACE.md,
    borderRadius: RADIUS.lg,
  },

});