import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppIcon } from "../components/icons";
import { api } from "../api/client";
import { useTheme } from "../context/ThemeContext";
import { useLanguage } from "../context/LanguageContext";
import { COLORS, PAGE_HERO_GRADIENT, pageHeroGradientColors } from "../styles/liquidGlass";
import { appleCardShadowResting } from "../styles/appleShadows";
import { SPACE, LAYOUT, RADIUS, BUTTON_SIZE, APPLE_TYPO } from "../styles/tokens";
import { Title1, Title2, Headline, Footnote, Subhead, Caption2 } from "../components/ui";
import type { RootStackParamList } from "../navigation/RootNavigator";

type Nav = NativeStackNavigationProp<RootStackParamList>;

const SCREEN_PAD = LAYOUT.screenPadding;
/** Collapsed list — keeps summary + CTA visible without scrolling typical screens */
const PAST_GAMES_RECENT = 5;

export function SettlementHistoryScreen() {
  const { isDark, colors } = useTheme();
  const { t } = useLanguage();
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();

  const backgroundColor = isDark ? COLORS.jetDark : colors.contentBg;

  const cardStyle = useMemo(
    () => ({
      backgroundColor: isDark ? "rgba(45, 45, 48, 0.9)" : "rgba(255, 255, 255, 0.95)",
      borderRadius: RADIUS.xl,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.06)",
      ...appleCardShadowResting(isDark),
    }),
    [isDark]
  );

  const [consolidated, setConsolidated] = useState<any>(null);
  const [settledGames, setSettledGames] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAllPastGames, setShowAllPastGames] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setError(null);
      const [consolidatedRes, gamesRes] = await Promise.all([
        api
          .get("/ledger/consolidated")
          .catch(() => ({
            data: { net_balance: 0, total_you_owe: 0, total_owed_to_you: 0 },
          })),
        api.get("/games").catch(() => ({ data: [] })),
      ]);
      setConsolidated(consolidatedRes.data);
      const allGames = Array.isArray(gamesRes.data) ? gamesRes.data : [];
      setSettledGames(
        allGames
          .filter((g: any) => g.status === "ended" || g.status === "settled")
          .sort(
            (a: any, b: any) =>
              new Date(b.ended_at || b.created_at || 0).getTime() -
              new Date(a.ended_at || a.created_at || 0).getTime()
          )
      );
    } catch (e: any) {
      setError(e?.message || "Settlement history unavailable.");
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

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const youOwe = consolidated?.total_you_owe || 0;
  const owedToYou = consolidated?.total_owed_to_you || 0;
  const netBalance = owedToYou - youOwe;

  const hasMorePastGames = settledGames.length > PAST_GAMES_RECENT;
  const displayedGames = useMemo(
    () =>
      showAllPastGames || !hasMorePastGames
        ? settledGames
        : settledGames.slice(0, PAST_GAMES_RECENT),
    [settledGames, showAllPastGames, hasMorePastGames]
  );
  const showManageBalances = youOwe > 0 || owedToYou > 0;

  const listWellStyle = useMemo(
    () => ({
      backgroundColor: isDark ? "rgba(255, 255, 255, 0.06)" : "rgba(0, 0, 0, 0.04)",
      borderRadius: RADIUS.lg,
    }),
    [isDark]
  );

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor }]}>
        <ActivityIndicator size="large" color={colors.orange} />
        <Footnote style={{ marginTop: SPACE.md }}>{t.settlementsScreen.loadingHistory}</Footnote>
      </View>
    );
  }

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
            height: Math.min(PAGE_HERO_GRADIENT.maxHeight, insets.top + PAGE_HERO_GRADIENT.safeAreaPad),
          },
        ]}
      />

      <View style={styles.topChrome} pointerEvents="box-none">
        <View style={{ height: insets.top }} />
        <View style={styles.headerRow}>
          <Pressable
            style={({ pressed }) => [
              styles.headerPill,
              {
                backgroundColor: colors.glassBg,
                borderColor: colors.glassBorder,
                opacity: pressed ? 0.85 : 1,
              },
            ]}
            onPress={() => navigation.goBack()}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          >
            <AppIcon name="chevronBack" size={22} color={colors.textPrimary} />
          </Pressable>
          <Title1 style={styles.screenTitle} numberOfLines={2}>
            {t.nav.settlementHistory}
          </Title1>
          <View style={styles.headerEndSpacer} />
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.orange}
            titleColor={colors.textSecondary}
            colors={[colors.orange]}
            progressBackgroundColor={isDark ? "#3A3A3C" : "#FFFFFF"}
            progressViewOffset={Platform.OS === "android" ? insets.top + 52 : undefined}
          />
        }
      >
        {error ? (
          <View
            style={[
              styles.errorBanner,
              {
                backgroundColor: isDark ? "rgba(255, 69, 58, 0.15)" : "rgba(255, 69, 58, 0.1)",
                borderColor: isDark ? "rgba(255, 69, 58, 0.4)" : "rgba(255, 69, 58, 0.3)",
              },
            ]}
          >
            <AppIcon name="alertCircle" size={18} color={colors.danger} />
            <Footnote style={{ flex: 1, color: colors.danger }}>{error}</Footnote>
          </View>
        ) : null}

        <View style={[cardStyle, styles.cardPadTightTop]}>
          <View style={styles.sectionHeadingRow}>
            <Title2 style={[styles.sectionTitle, { flex: 1, color: colors.textPrimary }]}>
              {t.settlementsScreen.pastGames}
            </Title2>
            {settledGames.length > 0 ? (
              <Caption2 style={{ color: colors.textMuted }}>{settledGames.length}</Caption2>
            ) : null}
          </View>
          <View style={[styles.listInner, listWellStyle]}>
            {settledGames.length === 0 ? (
              <View style={styles.emptyBlock}>
                <AppIcon name="txEmptyReceipt" size={40} color={colors.textMuted} />
                <Title2 style={{ marginTop: SPACE.sm, textAlign: "center", color: colors.textPrimary }}>
                  {t.settlementsScreen.noSettlementsYet}
                </Title2>
                <Footnote style={{ textAlign: "center", marginTop: SPACE.xs, color: colors.textSecondary }}>
                  {t.settlementsScreen.completedGamesHint}
                </Footnote>
              </View>
            ) : (
              displayedGames.map((game: any, idx: number) => {
                const netResult = game.user_net_result || 0;
                const isWin = netResult > 0;
                const isLoss = netResult < 0;
                return (
                  <View key={game.game_id || idx}>
                    <TouchableOpacity
                      style={styles.gameRow}
                      onPress={() =>
                        navigation.navigate("Settlement", {
                          gameId: game.game_id,
                        })
                      }
                      activeOpacity={0.7}
                    >
                      <View
                        style={[
                          styles.gameIcon,
                          {
                            backgroundColor: isWin
                              ? "rgba(52, 199, 89, 0.15)"
                              : isLoss
                                ? "rgba(255, 59, 48, 0.12)"
                                : isDark
                                  ? "rgba(255,255,255,0.08)"
                                  : "rgba(0,0,0,0.05)",
                          },
                        ]}
                      >
                        <AppIcon
                          name={isWin ? "settlementGameWin" : isLoss ? "settlementGameLoss" : "settlementNeutral"}
                          size={18}
                          color={isWin ? colors.success : isLoss ? colors.danger : colors.textMuted}
                        />
                      </View>
                      <View style={styles.gameInfo}>
                        <Headline numberOfLines={1}>
                          {game.name || game.title || game.group_name || "Game Night"}
                        </Headline>
                        <Footnote style={{ marginTop: 2 }} numberOfLines={1}>
                          {formatDate(game.ended_at || game.created_at)}
                          {game.player_count ? ` · ${game.player_count} ${t.game.players}` : ""}
                        </Footnote>
                      </View>
                      <View style={styles.gameResult}>
                        {netResult !== 0 ? (
                          <Subhead
                            bold
                            style={{
                              color: isWin ? colors.success : isLoss ? colors.danger : colors.textMuted,
                              fontVariant: ["tabular-nums"],
                            }}
                          >
                            {netResult >= 0 ? "+" : ""}${netResult.toFixed(0)}
                          </Subhead>
                        ) : null}
                        <AppIcon name="chevronForward" size={18} color={colors.textMuted} />
                      </View>
                    </TouchableOpacity>
                    {idx < displayedGames.length - 1 ? (
                      <View style={[styles.divider, { backgroundColor: colors.border }]} />
                    ) : null}
                  </View>
                );
              })
            )}
          </View>
          {hasMorePastGames ? (
            <TouchableOpacity
              style={styles.seeAllRow}
              onPress={() => setShowAllPastGames((v) => !v)}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={
                showAllPastGames
                  ? t.chatsScreen.showLess
                  : `${t.chatsScreen.seeAll}, ${settledGames.length}`
              }
            >
              <Footnote style={{ fontWeight: "600", color: colors.orange }}>
                {showAllPastGames
                  ? t.chatsScreen.showLess
                  : `${t.chatsScreen.seeAll} · ${settledGames.length}`}
              </Footnote>
              <AppIcon
                name={showAllPastGames ? "chevronUp" : "chevronDown"}
                size={18}
                color={colors.orange}
              />
            </TouchableOpacity>
          ) : null}
        </View>
      </ScrollView>

      <View
        style={[
          styles.bottomStack,
          {
            paddingBottom: Math.max(SPACE.md, insets.bottom + SPACE.sm),
            backgroundColor,
          },
        ]}
      >
        <View style={[cardStyle, styles.cardPadTightTop]}>
          <Title2 style={[styles.sectionTitle, { color: colors.textPrimary }]}>
            {t.settlementsScreen.outstandingBalance}
          </Title2>
          <View style={[styles.balanceWell, listWellStyle]}>
            <View style={styles.summaryGrid}>
              <View style={styles.summaryItem}>
                <AppIcon name="summaryYouOwe" size={20} color={colors.danger} />
                <Subhead bold style={{ color: colors.danger, fontVariant: ["tabular-nums"] }}>
                  ${youOwe.toFixed(0)}
                </Subhead>
                <Caption2 style={{ color: colors.textMuted }}>{t.settlementsScreen.youOwe}</Caption2>
              </View>
              <View style={[styles.summaryDivider, { backgroundColor: colors.border }]} />
              <View style={styles.summaryItem}>
                <AppIcon name="summaryOwedToYou" size={20} color={colors.success} />
                <Subhead bold style={{ color: colors.success, fontVariant: ["tabular-nums"] }}>
                  ${owedToYou.toFixed(0)}
                </Subhead>
                <Caption2 style={{ color: colors.textMuted }}>{t.settlementsScreen.owedToYou}</Caption2>
              </View>
              <View style={[styles.summaryDivider, { backgroundColor: colors.border }]} />
              <View style={styles.summaryItem}>
                <AppIcon
                  name="summaryNet"
                  size={20}
                  color={netBalance >= 0 ? colors.success : colors.danger}
                />
                <Subhead
                  bold
                  style={{
                    color: netBalance >= 0 ? colors.success : colors.danger,
                    fontVariant: ["tabular-nums"],
                  }}
                >
                  {netBalance >= 0 ? "+" : ""}${netBalance.toFixed(0)}
                </Subhead>
                <Caption2 style={{ color: colors.textMuted }}>{t.settlementsScreen.net}</Caption2>
              </View>
            </View>
          </View>
        </View>

        {showManageBalances ? (
          <View style={[cardStyle, styles.actionsFooterCard]}>
            <View style={styles.actionsFooterInner}>
              <TouchableOpacity
                style={[
                  styles.primaryCta,
                  styles.primaryCtaFull,
                  {
                    backgroundColor: colors.buttonPrimary,
                    minHeight: BUTTON_SIZE.large.height,
                  },
                ]}
                onPress={() => navigation.navigate("RequestAndPay" as any)}
                activeOpacity={0.88}
              >
                <AppIcon name="cashCta" size={22} color={colors.buttonText} />
                <Text style={[styles.primaryCtaLabel, { color: colors.buttonText }]}>
                  {t.settlementsScreen.manageBalances}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}
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
  topChrome: { zIndex: 2 },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: SCREEN_PAD,
    paddingTop: SPACE.md,
    paddingBottom: SPACE.sm,
    gap: SPACE.sm,
  },
  headerPill: {
    width: LAYOUT.touchTarget,
    height: LAYOUT.touchTarget,
    borderRadius: RADIUS.full,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },
  headerEndSpacer: {
    width: LAYOUT.touchTarget,
    height: LAYOUT.touchTarget,
  },
  screenTitle: {
    flex: 1,
    textAlign: "center",
    letterSpacing: -0.5,
  },
  scroll: { flex: 1, zIndex: 1 },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: SCREEN_PAD,
    paddingTop: SPACE.xs,
    paddingBottom: SPACE.sm,
    gap: LAYOUT.elementGap,
  },
  bottomStack: {
    paddingHorizontal: SCREEN_PAD,
    paddingTop: SPACE.sm,
    gap: LAYOUT.elementGap,
    zIndex: 1,
  },
  seeAllRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACE.xs,
    paddingVertical: SPACE.md,
    marginTop: SPACE.xs,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.sm,
    padding: SPACE.md,
    borderRadius: RADIUS.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  cardPadTightTop: {
    paddingHorizontal: SPACE.lg,
    paddingBottom: SPACE.lg,
    paddingTop: SPACE.md,
    gap: SPACE.sm,
  },
  sectionHeadingRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: SPACE.sm,
  },
  sectionTitle: {
    marginBottom: SPACE.sm,
  },
  balanceWell: {
    paddingHorizontal: SPACE.md,
    paddingVertical: SPACE.sm,
  },
  summaryGrid: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    paddingTop: SPACE.sm,
  },
  summaryItem: { alignItems: "center", gap: SPACE.xs, flex: 1 },
  summaryDivider: { width: StyleSheet.hairlineWidth, height: 48 },
  actionsFooterCard: {
    marginBottom: 0,
    overflow: "hidden",
  },
  actionsFooterInner: {
    padding: LAYOUT.cardPadding,
  },
  primaryCta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACE.sm,
    borderRadius: RADIUS.xl,
    paddingHorizontal: SPACE.xl,
  },
  primaryCtaFull: {
    alignSelf: "stretch",
    width: "100%",
  },
  primaryCtaLabel: {
    fontSize: APPLE_TYPO.body.size,
    fontWeight: "600",
  },
  listInner: {
    paddingHorizontal: SPACE.md,
    paddingVertical: SPACE.sm,
    marginTop: SPACE.xs,
  },
  emptyBlock: {
    alignItems: "center",
    paddingVertical: SPACE.xl,
    paddingHorizontal: SPACE.md,
    gap: SPACE.xs,
  },
  gameRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: SPACE.md,
    gap: SPACE.md,
  },
  gameIcon: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.md,
    justifyContent: "center",
    alignItems: "center",
  },
  gameInfo: { flex: 1, minWidth: 0 },
  gameResult: { flexDirection: "row", alignItems: "center", gap: SPACE.xs },
  divider: { height: StyleSheet.hairlineWidth, marginLeft: 52 },
});
