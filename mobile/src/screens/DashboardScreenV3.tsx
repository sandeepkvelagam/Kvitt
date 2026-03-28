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
  Animated,
  Easing,
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
import { FONT, SPACE, LAYOUT, RADIUS, APPLE_TYPO, BUTTON_SIZE, ICON_WELL } from "../styles/tokens";
import { COLORS, PAGE_HERO_GRADIENT, pageHeroGradientColors, SCHEDULE_COLORS } from "../styles/liquidGlass";
import { Title1, Label, Subhead, Title2, Headline, Footnote, Caption2 } from "../components/ui";
import { useLanguage } from "../context/LanguageContext";
import { appleCardShadowResting } from "../styles/appleShadows";
import { categoryIconForGame } from "../utils/gameCategoryIcon";
import { normalizeRsvpStats, pendingInviteCount } from "../utils/rsvpStats";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
/** Apple-style horizontal margins — single value for the whole screen */
const SCREEN_PAD = LAYOUT.screenPadding;
// Full width pages, no peek-through
/** Slightly shorter pager so Upcoming sits higher and clears the floating tab bar */
const PAGE_HEIGHT = 300;
/** Full-width pages; measured on layout for paging + dots (matches ScrollView viewport) */
const INITIAL_METRICS_PAGER_W = SCREEN_WIDTH;

const TAB_BAR_RESERVE_BASE = 128;
const UPCOMING_ROW_MIN_HEIGHT = 88;
/** Matches logo row + padding below safe area (aligns Android PTR with Chats/Groups). */
/** Android RefreshControl offset — below status bar + header row */
const HEADER_ROW_APPROX = 52;

/** Future start time for dashboard upcoming (not the past-oriented formatDate). */
function formatUpcomingStartsAt(isoStr: string): string {
  const d = new Date(isoStr);
  if (Number.isNaN(d.getTime())) return "";
  const datePart = d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  const timePart = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
  return `${datePart} · ${timePart}`;
}

interface DashboardEventRsvpStats {
  accepted: number;
  declined: number;
  maybe: number;
  invited: number;
  proposed_new_time: number;
  no_response: number;
  total: number;
}

interface DashboardEventOccurrence {
  event_id: string;
  occurrence_id: string;
  title: string;
  starts_at: string | null;
  location: string | null;
  game_category: string;
  my_rsvp: string | null;
  rsvp_stats?: DashboardEventRsvpStats;
}

type UpcomingMergedItem = {
  key: string;
  source: "event" | "game";
  title: string;
  startsAt: string;
  gameId?: string;
  occurrenceId?: string;
  gameCategory: string;
  playerCount?: number;
  myRsvp?: string | null;
  location?: string | null;
  rsvpStats?: DashboardEventRsvpStats;
};

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
  const [eventOccurrences, setEventOccurrences] = useState<DashboardEventOccurrence[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [aiUsage, setAiUsage] = useState<{ requests_remaining: number; daily_limit: number; is_premium: boolean } | null>(null);

  const userName = user?.name || user?.email?.split("@")[0] || "Player";

  const fetchDashboard = useCallback(async () => {
    try {
      const [statsRes, gamesRes, groupsRes, balancesRes, aiUsageRes, eventsRes] = await Promise.all([
        api.get("/stats/me").catch(() => ({ data: null })),
        api.get("/games").catch(() => ({ data: [] })),
        api.get("/groups").catch(() => ({ data: [] })),
        api.get("/ledger/consolidated").catch(() => ({ data: { net_balance: 0, total_you_owe: 0, total_owed_to_you: 0 } })),
        api.get("/assistant/usage").catch(() => ({ data: null })),
        api.get("/events").catch(() => ({ data: { events: [] } })),
      ]);
      setStats(statsRes.data);
      setBalances(balancesRes.data);
      const games = Array.isArray(gamesRes.data) ? gamesRes.data : [];
      setLiveGames(games.filter((g: any) => g.status === "active"));
      setScheduledGames(games.filter((g: any) => g.status === "scheduled"));
      const rawEvents = (eventsRes as { data?: { events?: unknown } }).data?.events;
      setEventOccurrences(
        Array.isArray(rawEvents)
          ? (rawEvents as Record<string, unknown>[]).map((ev) => {
              const normalized = normalizeRsvpStats(ev.rsvp_stats ?? ev.rsvpStats);
              return {
                ...(ev as unknown as DashboardEventOccurrence),
                rsvp_stats: normalized as DashboardEventOccurrence["rsvp_stats"],
              };
            })
          : []
      );
      setGroups(Array.isArray(groupsRes.data) ? groupsRes.data : []);
      if (aiUsageRes.data) setAiUsage(aiUsageRes.data);
    } catch {}
  }, []);

  useEffect(() => {
    void api.post("/users/me/activity").catch(() => {});
    void fetchDashboard();
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

  /** Metrics carousel: hairline border + `appleCardShadowResting` — avoids a 1px “frame” that reads as a bottom rule when shadows clip in horizontal ScrollView. */
  const metricsCardStyle = { ...cardStyle, borderWidth: StyleSheet.hairlineWidth };
  const metricsCardSmStyle = { ...cardSmStyle, borderWidth: StyleSheet.hairlineWidth };

  // Muted profit colors - subtle tints instead of harsh red/green
  const profitColor = (val: number) => {
    if (val === 0) return colors.textSecondary;
    return val > 0 
      ? (isDark ? "rgba(52, 199, 89, 0.9)" : "#1B7340") 
      : (isDark ? "rgba(255, 69, 58, 0.9)" : "#C41E3A");
  };

  /** Tri / row metric rings — cool neutral pad */
  const metricRingPad = useMemo(
    () => ({
      padBg: isDark ? "rgba(168, 182, 215, 0.1)" : "rgba(88, 102, 138, 0.07)",
      rimBorder: isDark ? "rgba(255, 255, 255, 0.09)" : "rgba(0, 0, 0, 0.07)",
    }),
    [isDark]
  );

  const backgroundColor = isDark ? COLORS.jetDark : colors.contentBg;

  const headerTop = insets.top;
  const refreshProgressOffset = headerTop + HEADER_ROW_APPROX;
  const tabBarReserve = TAB_BAR_RESERVE_BASE + Math.max(insets.bottom, 8);
  /** Scroll padding so content clears the floating tab bar + FAB (tokens only; avoid stacking xxxl+xl on top of sectionGap). */
  const scrollBottomPad = tabBarReserve + LAYOUT.sectionGap;

  const upcomingMerged = useMemo((): UpcomingMergedItem[] => {
    const now = Date.now();
    const graceMs = 60_000;
    const items: UpcomingMergedItem[] = [];

    for (const e of eventOccurrences) {
      if (!e.starts_at) continue;
      if (new Date(e.starts_at).getTime() < now - graceMs) continue;
      items.push({
        key: `occ-${e.occurrence_id}`,
        source: "event",
        title: e.title || "Game Night",
        startsAt: e.starts_at,
        occurrenceId: e.occurrence_id,
        gameCategory: e.game_category || "poker",
        myRsvp: e.my_rsvp,
        location: e.location,
        rsvpStats: e.rsvp_stats,
      });
    }

    for (const g of scheduledGames) {
      const gid = g.game_id || g._id;
      if (!gid) continue;
      const starts =
        g.scheduled_at || g.started_at || g.created_at || g.date || "";
      if (!starts) continue;
      if (new Date(starts).getTime() < now - graceMs) continue;
      items.push({
        key: `game-${gid}`,
        source: "game",
        title: g.title || g.group_name || "Game Night",
        startsAt: starts,
        gameId: gid,
        gameCategory: g.game_category || "poker",
        playerCount: g.player_count || g.players?.length || 0,
      });
    }

    items.sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
    return items;
  }, [eventOccurrences, scheduledGames]);

  const firstGameId =
    liveGames[0]?.game_id ||
    liveGames[0]?._id ||
    upcomingMerged.find((u) => u.gameId)?.gameId ||
    scheduledGames[0]?.game_id ||
    scheduledGames[0]?._id;

  const primaryLiveGame = liveGames[0];
  const livePot = Number(primaryLiveGame?.total_pot ?? 0);
  const livePlayerCount = Number(primaryLiveGame?.player_count ?? 0);

  const livePulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (liveGames.length === 0) {
      livePulse.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(livePulse, {
          toValue: 1.06,
          duration: 1000,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(livePulse, {
          toValue: 1,
          duration: 1000,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [liveGames.length, livePulse]);

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
      <View style={[styles.body, styles.bodyAboveGradient]}>
        <ScrollView
          style={styles.bodyScroll}
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
              progressViewOffset={Platform.OS === "android" ? refreshProgressOffset + 8 : undefined}
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
            <TouchableOpacity
              style={[styles.streakPill, {
                backgroundColor: isDark ? "rgba(45, 45, 48, 0.9)" : "rgba(255, 255, 255, 0.95)",
                borderWidth: 1,
                borderColor: isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.06)",
                ...appleCardShadowResting(isDark),
              }]}
              onPress={() => navigation.navigate("Milestones")}
              activeOpacity={0.7}
              hitSlop={{ top: SPACE.sm, bottom: SPACE.sm, left: SPACE.sm, right: SPACE.sm }}
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
          <Label>OVERVIEW</Label>
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
              removeClippedSubviews={false}
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
              style={[styles.heroCard, metricsCardStyle]}
              activeOpacity={0.7}
              hitSlop={{ top: SPACE.sm, bottom: SPACE.sm, left: SPACE.xs, right: SPACE.xs }}
              onPress={() => {
                if (firstGameId) {
                  navigation.navigate("GameNight", { gameId: firstGameId });
                } else {
                  navigation.navigate("Groups");
                }
              }}
            >
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[styles.heroNum, { color: colors.textPrimary }]}>{liveGames.length}</Text>
                <Text style={[styles.heroLabel, { color: colors.textSecondary }]}>Live games</Text>
                {liveGames.length > 0 && primaryLiveGame ? (
                  <Caption2
                    style={{
                      color: colors.textMuted,
                      marginTop: SPACE.xs,
                      marginBottom: SPACE.xs,
                      fontVariant: ["tabular-nums"],
                    }}
                    numberOfLines={1}
                  >
                    {`$${Number.isInteger(livePot) ? String(livePot) : livePot.toFixed(0)} ${t.chatsScreen.pot} · ${livePlayerCount} ${livePlayerCount === 1 ? "player" : "players"}`}
                  </Caption2>
                ) : null}
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
                  {
                    width: ICON_WELL.hero.outer,
                    height: ICON_WELL.hero.outer,
                    borderRadius: ICON_WELL.hero.outer / 2,
                    padding: ICON_WELL.hero.ringPadding,
                    backgroundColor: metricRingPad.padBg,
                    borderColor: metricRingPad.rimBorder,
                  },
                ]}
              >
                <Animated.View
                  style={{
                    width: ICON_WELL.hero.inner,
                    height: ICON_WELL.hero.inner,
                    borderRadius: ICON_WELL.hero.inner / 2,
                    backgroundColor: metricsCardStyle.backgroundColor,
                    alignItems: "center",
                    justifyContent: "center",
                    transform: [{ scale: liveGames.length > 0 ? livePulse : 1 }],
                  }}
                >
                  <Text style={{ fontSize: 32 }}>♠️</Text>
                </Animated.View>
              </View>
            </TouchableOpacity>
            </View>
            <View style={styles.pageSection}>
            <View style={styles.triRow}>
              <TouchableOpacity
                style={[styles.triCard, metricsCardSmStyle]}
                onPress={() => navigation.navigate("Groups")}
                activeOpacity={0.7}
                hitSlop={{ top: SPACE.sm, bottom: SPACE.sm, left: 0, right: 0 }}
              >
                <Text style={[styles.triVal, { color: colors.textPrimary }]}>{groups.length}</Text>
                <Text style={[styles.triLabel, { color: colors.textSecondary }]}>{t.nav.groups}</Text>
                <View
                  style={[
                    styles.triRingOuter,
                    {
                      width: ICON_WELL.tri.outer,
                      height: ICON_WELL.tri.outer,
                      borderRadius: ICON_WELL.tri.outer / 2,
                      padding: ICON_WELL.tri.ringPadding,
                      backgroundColor: metricRingPad.padBg,
                      borderColor: metricRingPad.rimBorder,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.triRingInner,
                      {
                        width: ICON_WELL.tri.inner,
                        height: ICON_WELL.tri.inner,
                        borderRadius: ICON_WELL.tri.inner / 2,
                        backgroundColor: metricsCardStyle.backgroundColor,
                      },
                    ]}
                  >
                    <Ionicons name="people" size={18} color={colors.textSecondary} />
                  </View>
                </View>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.triCard, metricsCardSmStyle]}
                onPress={() => navigation.navigate("Milestones")}
                activeOpacity={0.7}
                hitSlop={{ top: SPACE.sm, bottom: SPACE.sm, left: 0, right: 0 }}
              >
                <Text style={[styles.triVal, { color: colors.textPrimary }]}>{stats?.streak ?? 0}</Text>
                <Text style={[styles.triLabel, { color: colors.textSecondary }]}>{t.dashboard.streak}</Text>
                <View
                  style={[
                    styles.triRingOuter,
                    {
                      width: ICON_WELL.tri.outer,
                      height: ICON_WELL.tri.outer,
                      borderRadius: ICON_WELL.tri.outer / 2,
                      padding: ICON_WELL.tri.ringPadding,
                      backgroundColor: metricRingPad.padBg,
                      borderColor: metricRingPad.rimBorder,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.triRingInner,
                      {
                        width: ICON_WELL.tri.inner,
                        height: ICON_WELL.tri.inner,
                        borderRadius: ICON_WELL.tri.inner / 2,
                        backgroundColor: metricsCardStyle.backgroundColor,
                      },
                    ]}
                  >
                    <Ionicons name="flame" size={18} color={isDark ? "rgba(255, 149, 0, 0.95)" : "#FF9500"} />
                  </View>
                </View>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.triCard, metricsCardSmStyle]}
                onPress={() => navigation.navigate("Wallet")}
                activeOpacity={0.7}
                hitSlop={{ top: SPACE.sm, bottom: SPACE.sm, left: 0, right: 0 }}
              >
                <Text style={[styles.triVal, { color: profitColor(balances.net_balance || 0) }]}>
                  ${Math.abs(balances.net_balance || 0).toFixed(0)}
                </Text>
                <Text style={[styles.triLabel, { color: colors.textSecondary }]}>{t.nav.wallet}</Text>
                <View
                  style={[
                    styles.triRingOuter,
                    {
                      width: ICON_WELL.tri.outer,
                      height: ICON_WELL.tri.outer,
                      borderRadius: ICON_WELL.tri.outer / 2,
                      padding: ICON_WELL.tri.ringPadding,
                      backgroundColor: metricRingPad.padBg,
                      borderColor: metricRingPad.rimBorder,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.triRingInner,
                      {
                        width: ICON_WELL.tri.inner,
                        height: ICON_WELL.tri.inner,
                        borderRadius: ICON_WELL.tri.inner / 2,
                        backgroundColor: metricsCardStyle.backgroundColor,
                      },
                    ]}
                  >
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
              <View style={[styles.triCard, metricsCardSmStyle]}>
                <Text style={[styles.triVal, { color: profitColor(avgProfit) }]}>{fmt(avgProfit)}</Text>
                <Text style={[styles.triLabel, { color: colors.textSecondary }]}>Avg / game</Text>
                <View
                  style={[
                    styles.triRingOuter,
                    {
                      width: ICON_WELL.tri.outer,
                      height: ICON_WELL.tri.outer,
                      borderRadius: ICON_WELL.tri.outer / 2,
                      padding: ICON_WELL.tri.ringPadding,
                      backgroundColor: metricRingPad.padBg,
                      borderColor: metricRingPad.rimBorder,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.triRingInner,
                      {
                        width: ICON_WELL.tri.inner,
                        height: ICON_WELL.tri.inner,
                        borderRadius: ICON_WELL.tri.inner / 2,
                        backgroundColor: metricsCardStyle.backgroundColor,
                      },
                    ]}
                  >
                    <Ionicons name="analytics-outline" size={18} color={colors.textSecondary} />
                  </View>
                </View>
              </View>
              <TouchableOpacity
                style={[styles.triCard, metricsCardSmStyle]}
                onPress={() => navigation.navigate("SettlementHistory" as any)}
                activeOpacity={0.7}
                hitSlop={{ top: SPACE.sm, bottom: SPACE.sm, left: 0, right: 0 }}
              >
                <Text style={[styles.triVal, { color: profitColor(netProfit) }]}>{fmt(netProfit)}</Text>
                <Text style={[styles.triLabel, { color: colors.textSecondary }]}>{t.dashboard.netProfit}</Text>
                <View
                  style={[
                    styles.triRingOuter,
                    {
                      width: ICON_WELL.tri.outer,
                      height: ICON_WELL.tri.outer,
                      borderRadius: ICON_WELL.tri.outer / 2,
                      padding: ICON_WELL.tri.ringPadding,
                      backgroundColor: metricRingPad.padBg,
                      borderColor: metricRingPad.rimBorder,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.triRingInner,
                      {
                        width: ICON_WELL.tri.inner,
                        height: ICON_WELL.tri.inner,
                        borderRadius: ICON_WELL.tri.inner / 2,
                        backgroundColor: metricsCardStyle.backgroundColor,
                      },
                    ]}
                  >
                    <Ionicons
                      name="cash-outline"
                      size={18}
                      color={isDark ? "rgba(255, 149, 0, 0.95)" : "#FF9500"}
                    />
                  </View>
                </View>
              </TouchableOpacity>
              <View style={[styles.triCard, metricsCardSmStyle]}>
                <Text style={[styles.triVal, { color: profitColor(roiPercent) }]}>
                  {totalBuyIns > 0 ? `${roiPercent.toFixed(0)}%` : "—"}
                </Text>
                <Text style={[styles.triLabel, { color: colors.textSecondary }]}>ROI</Text>
                <View
                  style={[
                    styles.triRingOuter,
                    {
                      width: ICON_WELL.tri.outer,
                      height: ICON_WELL.tri.outer,
                      borderRadius: ICON_WELL.tri.outer / 2,
                      padding: ICON_WELL.tri.ringPadding,
                      backgroundColor: metricRingPad.padBg,
                      borderColor: metricRingPad.rimBorder,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.triRingInner,
                      {
                        width: ICON_WELL.tri.inner,
                        height: ICON_WELL.tri.inner,
                        borderRadius: ICON_WELL.tri.inner / 2,
                        backgroundColor: metricsCardStyle.backgroundColor,
                      },
                    ]}
                  >
                    <Ionicons name="trending-up-outline" size={18} color={colors.textSecondary} />
                  </View>
                </View>
              </View>
            </View>
            </View>
            <View style={styles.pageSection}>
            <View style={[styles.scoreCard, metricsCardStyle]}>
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
            <View style={styles.pageSection70}>
            <View style={styles.splitRow}>
              <View style={[styles.splitCard, metricsCardStyle]}>
                <Footnote bold color={colors.textSecondary}>Win Rate</Footnote>
                <Text style={[styles.splitBig, { color: colors.textPrimary }]}>{winRate.toFixed(0)}%</Text>
                <View style={styles.splitMeta}>
                  <Ionicons name="trophy" size={APPLE_TYPO.caption.size} color={colors.textMuted} />
                  <Caption2 style={{ color: colors.textMuted }}>{wins}W / {losses}L</Caption2>
                </View>
              </View>
              <View style={[styles.splitCard, metricsCardStyle]}>
                <Footnote bold color={colors.textSecondary}>Total Games</Footnote>
                <Text style={[styles.splitBig, { color: colors.textPrimary }]}>{totalGames}</Text>
                <View style={styles.splitMeta}>
                  <Ionicons name="game-controller" size={APPLE_TYPO.caption.size} color={colors.textMuted} />
                  <Caption2 style={{ color: colors.textMuted }}>
                    {totalGames > 0 ? "Lifetime" : "No games"}
                  </Caption2>
                </View>
              </View>
            </View>
            </View>
            <View style={styles.pageSection30}>
            <TouchableOpacity
              style={[styles.aiBar, metricsCardStyle]}
              onPress={() => navigation.navigate("AIAssistant")}
              activeOpacity={0.7}
              hitSlop={{ top: SPACE.xs, bottom: SPACE.xs, left: SPACE.xs, right: SPACE.xs }}
            >
              <View style={styles.aiBarLeft}>
                <View
                  style={[
                    styles.triRingOuter,
                    {
                      width: ICON_WELL.row.outer,
                      height: ICON_WELL.row.outer,
                      borderRadius: ICON_WELL.row.outer / 2,
                      padding: ICON_WELL.row.ringPadding,
                      backgroundColor: metricRingPad.padBg,
                      borderColor: metricRingPad.rimBorder,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.triRingInner,
                      {
                        width: ICON_WELL.row.inner,
                        height: ICON_WELL.row.inner,
                        borderRadius: ICON_WELL.row.inner / 2,
                        backgroundColor: metricsCardStyle.backgroundColor,
                      },
                    ]}
                  >
                    <Ionicons name="sparkles" size={APPLE_TYPO.title3.size} color={colors.textSecondary} />
                  </View>
                </View>
                <View style={styles.aiBarTextCol}>
                  <Headline style={{ fontWeight: "700" }}>AI Assistant</Headline>
                  <Subhead style={{ color: colors.textMuted, marginTop: SPACE.xs }} numberOfLines={2}>
                    {aiUsage ? `${aiUsage.requests_remaining} requests left` : "Analyze your game"}
                  </Subhead>
                </View>
              </View>
              <View style={[styles.aiBarBtn, { backgroundColor: colors.textPrimary }]}>
                <Text
                  style={{
                    color: isDark ? "#000" : "#FFF",
                    fontSize: APPLE_TYPO.subhead.size,
                    fontWeight: "600",
                  }}
                >
                  Open
                </Text>
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
          {upcomingMerged.length > 0 ? (
            <View style={[styles.upcomingCardOuter, cardStyle, styles.upcomingCardOuterFilled]}>
              <TouchableOpacity
                activeOpacity={0.92}
                onPress={() => navigation.navigate("Scheduler")}
                accessibilityRole="button"
                accessibilityLabel={(() => {
                  const mc = upcomingMerged.length - 1;
                  return [
                    t.dashboard.upcoming,
                    upcomingMerged[0]?.title,
                    mc > 0
                      ? t.dashboard.upcomingMoreFooter.replace("{count}", String(mc))
                      : t.dashboard.upcomingOpenScheduleHint,
                  ]
                    .filter(Boolean)
                    .join(". ");
                })()}
                style={styles.upcomingFilledTouchable}
              >
                <View
                  style={[
                    styles.upcomingContentBlock,
                    {
                      backgroundColor: isDark ? "rgba(255, 255, 255, 0.08)" : "#F2F2F7",
                    },
                  ]}
                >
              {(() => {
                const preview = upcomingMerged[0];
                const moreCount = upcomingMerged.length - 1;
                const metaLine = [
                  formatUpcomingStartsAt(preview.startsAt),
                  preview.source === "game" && (preview.playerCount ?? 0) > 0
                    ? `${preview.playerCount} players`
                    : null,
                  preview.source === "event" && preview.location ? preview.location : null,
                ]
                  .filter(Boolean)
                  .join(" · ");
                const pillLabel =
                  preview.source === "game"
                    ? "SCHEDULED"
                    : (preview.myRsvp || t.scheduler.invited).toUpperCase();
                const isRsvpAccepted = preview.source === "event" && preview.myRsvp === "accepted";
                const iconName = categoryIconForGame(preview.gameCategory);
                const stats = preview.rsvpStats;
                const showRsvpQuick =
                  preview.source === "event" &&
                  stats &&
                  (stats.total > 0 ||
                    stats.accepted > 0 ||
                    stats.declined > 0 ||
                    stats.maybe > 0 ||
                    stats.invited > 0 ||
                    stats.no_response > 0);
                return (
                  <>
                    <View style={[styles.upcomingRowInner, { minHeight: UPCOMING_ROW_MIN_HEIGHT }]}>
                      <View
                        style={[
                          styles.upcomingIconCircle,
                          {
                            width: ICON_WELL.upcoming.diameter,
                            height: ICON_WELL.upcoming.diameter,
                            borderRadius: ICON_WELL.upcoming.diameter / 2,
                            backgroundColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.06)",
                          },
                        ]}
                      >
                        <Ionicons name={iconName} size={22} color={colors.textSecondary} />
                      </View>
                      <View style={styles.upcomingCardText}>
                        <Headline numberOfLines={1}>{preview.title}</Headline>
                        <Footnote numberOfLines={2} style={{ marginTop: SPACE.xs }}>
                          {metaLine}
                        </Footnote>
                        {showRsvpQuick && stats ? (
                          <View
                            style={{
                              flexDirection: "row",
                              flexWrap: "wrap",
                              alignItems: "center",
                              marginTop: SPACE.xs,
                            }}
                          >
                            <Text
                              style={{
                                fontSize: APPLE_TYPO.footnote.size,
                                lineHeight: 18,
                                fontWeight: "600",
                                color: SCHEDULE_COLORS.accepted,
                              }}
                            >
                              {stats.accepted}
                            </Text>
                            <Text
                              style={{
                                fontSize: APPLE_TYPO.footnote.size,
                                lineHeight: 18,
                                color: colors.textSecondary,
                              }}
                            >
                              {` ${t.scheduler.upcomingRsvpAcceptedWord} · `}
                            </Text>
                            <Text
                              style={{
                                fontSize: APPLE_TYPO.footnote.size,
                                lineHeight: 18,
                                color: colors.textMuted,
                              }}
                            >
                              {pendingInviteCount(stats)}
                            </Text>
                            <Text
                              style={{
                                fontSize: APPLE_TYPO.footnote.size,
                                lineHeight: 18,
                                color: colors.textMuted,
                              }}
                            >
                              {` ${t.scheduler.upcomingRsvpPendingWord}`}
                            </Text>
                          </View>
                        ) : null}
                        <View
                          style={[
                            styles.scheduledPill,
                            {
                              backgroundColor: isRsvpAccepted
                                ? "rgba(52,199,89,0.15)"
                                : isDark
                                  ? "rgba(255,149,0,0.15)"
                                  : "rgba(255,149,0,0.12)",
                            },
                          ]}
                        >
                          <Label
                            color={isRsvpAccepted ? SCHEDULE_COLORS.accepted : colors.textSecondary}
                          >
                            {pillLabel}
                          </Label>
                        </View>
                      </View>
                    </View>
                    {moreCount > 0 ? (
                      <Footnote style={[styles.upcomingTrayFooter, { color: colors.textMuted }]}>
                        {t.dashboard.upcomingMoreFooter.replace("{count}", String(moreCount))}
                      </Footnote>
                    ) : null}
                  </>
                );
              })()}
                </View>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={[styles.upcomingCardOuter, cardStyle, styles.upcomingSectionShellEmpty]}>
              <Ionicons name="calendar-outline" size={28} color={colors.textMuted} />
              <Headline style={styles.upcomingEmptyTitle}>{t.dashboard.upcomingEmpty}</Headline>
              <Subhead style={styles.upcomingEmptySub}>{t.dashboard.upcomingHint}</Subhead>
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
                <Subhead bold style={{ color: colors.buttonText }}>{t.dashboard.openScheduler}</Subhead>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>
      </View>

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
  bodyScroll: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SCREEN_PAD,
    paddingTop: SPACE.md,
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: SPACE.sm },
  /** Streak pill */
  headerTrailing: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.sm,
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
    marginTop: LAYOUT.elementGap,
    marginBottom: LAYOUT.elementGap,
  },
  shootingStarLine: {
    height: StyleSheet.hairlineWidth,
    borderRadius: StyleSheet.hairlineWidth / 2,
    width: "85%",
  },

  body: { flex: 1 },
  bodyContent: {},

  pagerWrap: {
    marginTop: 0,
    marginBottom: LAYOUT.elementGap,
    backgroundColor: "transparent",
  },
  metricsPagerScroll: {
    backgroundColor: "transparent",
  },
  pagerInner: {
    backgroundColor: "transparent",
    /** Top: minimal inset for shadow; bottom: room so `appleCardShadowResting` is not clipped. Divider→cards rhythm uses `dividerWrap.marginBottom`, not extra top padding here. */
    paddingTop: SPACE.sm,
    paddingBottom: LAYOUT.elementGap,
  },
  /** Width set inline to match ScrollView viewport (required for pagingEnabled + dots) */
  page: {
    height: PAGE_HEIGHT,
    paddingHorizontal: SCREEN_PAD,
    gap: LAYOUT.elementGap,
  },
  pageSection: { flex: 1, minHeight: 0 },
  /** Page 3: win rate / total games vs AI bar (70/30 for assistant row height). */
  pageSection70: { flex: 7, minHeight: 0 },
  pageSection30: { flex: 3, minHeight: 0 },

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
    borderWidth: StyleSheet.hairlineWidth * 2,
    alignItems: "center",
    justifyContent: "center",
  },
  ringInner: {
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
    borderWidth: StyleSheet.hairlineWidth * 2,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginTop: SPACE.sm,
  },
  triRingInner: {
    alignItems: "center",
    justifyContent: "center",
  },

  scoreCard: { flex: 1, paddingHorizontal: SPACE.lg, paddingVertical: SPACE.lg },
  scoreRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  barTrack: { height: SPACE.xs, borderRadius: SPACE.xs / 2, marginTop: SPACE.md, overflow: "hidden" },
  barFill: { height: SPACE.xs, borderRadius: SPACE.xs / 2 },

  splitRow: { flex: 1, flexDirection: "row", gap: SPACE.sm },
  splitCard: { flex: 1, paddingHorizontal: SPACE.lg, paddingVertical: SPACE.lg },
  splitBig: { fontSize: 44, fontWeight: "800", letterSpacing: -1, marginTop: SPACE.xs },
  splitMeta: { flexDirection: "row", alignItems: "center", gap: SPACE.xs, marginTop: SPACE.sm },

  aiBar: {
    flex: 1,
    paddingHorizontal: LAYOUT.cardPadding,
    paddingVertical: LAYOUT.cardPadding,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: LAYOUT.elementGap,
  },
  aiBarLeft: { flex: 1, flexDirection: "row", alignItems: "center", gap: LAYOUT.elementGap, minWidth: 0 },
  aiBarTextCol: { flex: 1, minWidth: 0 },
  aiBarBtn: {
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACE.xl,
    paddingVertical: SPACE.md,
    minHeight: BUTTON_SIZE.regular.height,
    justifyContent: "center",
    alignItems: "center",
  },

  dots: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: SPACE.sm,
    marginTop: LAYOUT.elementGap,
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
  },

  upcomingOuter: {
    marginTop: SPACE.sm,
    marginBottom: LAYOUT.elementGap,
    minHeight: UPCOMING_ROW_MIN_HEIGHT,
  },
  /** Outer white card — same tokens as dashboard metrics (`cardStyle`). */
  upcomingCardOuter: {
    marginHorizontal: SCREEN_PAD,
    padding: SPACE.lg,
  },
  upcomingCardOuterFilled: {
    padding: SPACE.md,
  },
  upcomingSectionShellEmpty: {
    alignItems: "center",
    minHeight: UPCOMING_ROW_MIN_HEIGHT + 24,
    justifyContent: "center",
  },
  upcomingFilledTouchable: {
    width: "100%",
  },
  /** Single gray block inside the white card (no nested white card). */
  upcomingContentBlock: {
    borderRadius: RADIUS.lg,
    padding: SPACE.md,
    gap: SPACE.sm,
  },
  upcomingRowInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.md,
  },
  upcomingIconCircle: {
    alignItems: "center",
    justifyContent: "center",
  },
  upcomingCardText: { flex: 1, minWidth: 0 },
  upcomingTrayFooter: {
    textAlign: "center",
    lineHeight: 18,
    marginTop: SPACE.xs,
    paddingBottom: SPACE.xs,
  },
  scheduledPill: {
    alignSelf: "flex-start",
    marginTop: SPACE.sm,
    paddingHorizontal: SPACE.sm,
    paddingVertical: SPACE.xs,
    borderRadius: SPACE.sm,
  },
  upcomingEmptyTitle: {
    marginTop: SPACE.sm,
    textAlign: "center",
  },
  upcomingEmptySub: {
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