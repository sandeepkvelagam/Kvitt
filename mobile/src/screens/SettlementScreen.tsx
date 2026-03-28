import React, { useEffect, useState, useCallback, useMemo } from "react";
import {
  ScrollView,
  Text,
  View,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Linking,
  Alert,
  TextInput,
  Platform,
  Pressable,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { RouteProp, useRoute, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../api/client";
import { useTheme } from "../context/ThemeContext";
import { COLORS, PAGE_HERO_GRADIENT, pageHeroGradientColors } from "../styles/liquidGlass";
import { appleCardShadowResting } from "../styles/appleShadows";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import type { RootStackParamList } from "../navigation/RootNavigator";
import { PostGameSurveyModal } from "../components/feedback/PostGameSurveyModal";
import { GlassModal } from "../components/ui/GlassModal";
import { Title1, Title2, Headline, Footnote, Subhead, Caption2 } from "../components/ui";
import { SPACE, LAYOUT, RADIUS, APPLE_TYPO, BUTTON_SIZE } from "../styles/tokens";

type R = RouteProp<RootStackParamList, "Settlement">;

const SCREEN_PAD = LAYOUT.screenPadding;
const RESULTS_LIMIT = 25;
const PAYMENTS_LIMIT = 25;

export function SettlementScreen() {
  const { isDark, colors } = useTheme();
  const { user } = useAuth();
  const { t } = useLanguage();
  const route = useRoute<R>();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const insets = useSafeAreaInsets();
  const { gameId } = route.params;

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

  const innerWell = useMemo(
    () => ({
      backgroundColor: isDark ? "rgba(255, 255, 255, 0.06)" : "rgba(0, 0, 0, 0.04)",
      borderRadius: RADIUS.lg,
    }),
    [isDark]
  );

  const [settlement, setSettlement] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [markingPaid, setMarkingPaid] = useState<string | null>(null);
  const [payingStripe, setPayingStripe] = useState<string | null>(null);
  const [showSurvey, setShowSurvey] = useState(false);
  const [surveyChecked, setSurveyChecked] = useState(false);
  const [dispute, setDispute] = useState<any>(null);
  const [showDisputeModal, setShowDisputeModal] = useState(false);
  const [disputeCategory, setDisputeCategory] = useState("wrong_cashout");
  const [disputeMessage, setDisputeMessage] = useState("");
  const [submittingDispute, setSubmittingDispute] = useState(false);

  const load = useCallback(async () => {
    try {
      setError(null);
      const res = await api.get(`/games/${gameId}/settlement`);
      setSettlement(res.data);

      // Fetch disputes
      try {
        const disputeRes = await api.get(`/games/${gameId}/settlement/disputes`);
        const openDispute = (disputeRes.data?.disputes || []).find(
          (d: any) => d.status === "open" || d.status === "reviewing"
        );
        setDispute(openDispute || null);
      } catch {
        // non-critical
      }
    } catch (e: any) {
      setError(e?.response?.data?.detail || e?.message || "Settlement unavailable.");
    } finally {
      setLoading(false);
    }
  }, [gameId]);

  useEffect(() => {
    if (!settlement || surveyChecked) return;
    setSurveyChecked(true);
    api.get(`/feedback/surveys/${gameId}`)
      .then((res) => {
        const surveys = res.data?.surveys || res.data || [];
        const already = surveys.some((s: any) => s.user_id === user?.user_id);
        if (!already) {
          const timer = setTimeout(() => setShowSurvey(true), 1500);
          return () => clearTimeout(timer);
        }
      })
      .catch(() => {});
  }, [settlement, gameId, user?.user_id, surveyChecked]);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const handleMarkPaid = async (ledgerId: string, currentPaid: boolean) => {
    setMarkingPaid(ledgerId);
    try {
      await api.put(`/ledger/${ledgerId}/paid`, { paid: !currentPaid });
      await load();
    } catch (e: any) {
      setError(e?.response?.data?.detail || e?.message || "Payment update unavailable.");
    } finally {
      setMarkingPaid(null);
    }
  };

  const handlePayWithStripe = async (ledgerId: string) => {
    setPayingStripe(ledgerId);
    try {
      const originUrl = process.env.EXPO_PUBLIC_SOCKET_URL || "https://kvitt.duckdns.org";
      const res = await api.post(`/settlements/${ledgerId}/pay`, { origin_url: originUrl });
      if (res.data?.url) {
        const canOpen = await Linking.canOpenURL(res.data.url);
        if (canOpen) {
          await Linking.openURL(res.data.url);
        } else {
          Alert.alert("Payment page unavailable", "Please try again.");
        }
      } else {
        Alert.alert("Payment link unavailable", "Please try again.");
      }
    } catch (e: any) {
      Alert.alert("Payment unavailable", e?.response?.data?.detail || "Please try again.");
    } finally {
      setPayingStripe(null);
    }
  };

  const handleSubmitDispute = async () => {
    if (!disputeMessage.trim()) {
      Alert.alert("Missing details", "Describe the issue.");
      return;
    }
    setSubmittingDispute(true);
    try {
      await api.post(`/games/${gameId}/settlement/dispute`, {
        category: disputeCategory,
        message: disputeMessage.trim(),
      });
      Alert.alert("Reported", "Issue reported. Host has been notified.");
      setShowDisputeModal(false);
      setDisputeMessage("");
      await load();
    } catch (e: any) {
      Alert.alert("Report unavailable", e?.response?.data?.detail || "Please try again.");
    } finally {
      setSubmittingDispute(false);
    }
  };

  const results = settlement?.results ?? [];
  const payments = settlement?.payments ?? [];

  /** Match GET /games/{id} and GET /games/{id}/settlement: cash_out − total_buy_in */
  const deriveResultNet = useCallback((r: any) => {
    const co = parseFloat(String(r?.cash_out ?? 0));
    const bi = parseFloat(String(r?.total_buy_in ?? 0));
    if (!Number.isFinite(co) || !Number.isFinite(bi)) return 0;
    return co - bi;
  }, []);

  const sortedResults = useMemo(
    () =>
      [...results].sort(
        (a: any, b: any) => deriveResultNet(b) - deriveResultNet(a)
      ),
    [results, deriveResultNet]
  );
  const displayedResults = useMemo(
    () => sortedResults.slice(0, RESULTS_LIMIT),
    [sortedResults]
  );
  const displayedPayments = useMemo(() => payments.slice(0, PAYMENTS_LIMIT), [payments]);
  const resultsTruncated = sortedResults.length > displayedResults.length;
  const paymentsTruncated = payments.length > displayedPayments.length;

  const totalPot = results.reduce((sum: number, r: any) => sum + (r.total_buy_in || 0), 0);
  const totalOut = results.reduce((sum: number, r: any) => sum + (r.cash_out || 0), 0);
  const winnersCount = results.filter((r: any) => deriveResultNet(r) > 0).length;
  const losersCount = results.filter((r: any) => deriveResultNet(r) < 0).length;
  const hasDiscrepancy = Math.abs(totalPot - totalOut) > 0.01;

  const hasMaterialNetAcrossResults = useMemo(
    () => results.some((r: any) => Math.abs(deriveResultNet(r)) > 0.01),
    [results, deriveResultNet]
  );

  // Personalized hero: match by Kvitt user_id, or by email when Auth used Supabase id fallback
  const uid = user?.user_id;
  const currentPlayer = useMemo(() => {
    if (!results.length) return undefined;
    const byId =
      uid && results.find((r: any) => String(r.user_id) === String(uid));
    if (byId) return byId;
    const em = user?.email?.trim().toLowerCase();
    if (em) {
      const byEmail = results.find(
        (r: any) => r.email && String(r.email).trim().toLowerCase() === em
      );
      if (byEmail) return byEmail;
    }
    return undefined;
  }, [results, uid, user?.email]);

  const netResult = currentPlayer ? deriveResultNet(currentPlayer) : 0;
  const effectiveUserIdForPayments = currentPlayer?.user_id ?? uid;
  const myDebts = payments.filter(
    (p: any) => String(p.from_user_id) === String(effectiveUserIdForPayments)
  );
  const myCredits = payments.filter(
    (p: any) => String(p.to_user_id) === String(effectiveUserIdForPayments)
  );
  const activePlayers = winnersCount + losersCount;
  const possiblePayments = activePlayers > 1 ? Math.floor(activePlayers * (activePlayers - 1) / 2) : 0;
  const hasDisputeOpen = !!dispute;

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor }]}>
        <ActivityIndicator size="large" color={colors.orange} />
        <Footnote style={{ marginTop: SPACE.md }}>{t.settlementsScreen.loadingDetail}</Footnote>
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
            <Ionicons name="chevron-back" size={22} color={colors.textPrimary} />
          </Pressable>
          <View style={styles.headerCenter}>
            <Title1 style={styles.headerTitleMain} numberOfLines={1}>
              {t.game.settlementDetailTitle}
            </Title1>
            {settlement?.game_title ? (
              <Footnote numberOfLines={1} style={styles.headerGameTitle}>
                {settlement.game_title}
              </Footnote>
            ) : null}
          </View>
          <View style={styles.headerEndSpacer} />
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(SPACE.xxl, insets.bottom + SPACE.lg) },
        ]}
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
            <Ionicons name="alert-circle" size={18} color={colors.danger} />
            <Footnote style={{ flex: 1, color: colors.danger }}>{error}</Footnote>
          </View>
        ) : null}

        {hasDisputeOpen ? (
          <View
            style={[
              styles.disputeBanner,
              {
                backgroundColor: isDark ? "rgba(245, 158, 11, 0.12)" : "rgba(245, 158, 11, 0.08)",
                borderColor: isDark ? "rgba(245, 158, 11, 0.35)" : "rgba(245, 158, 11, 0.25)",
              },
            ]}
          >
            <Ionicons name="flag" size={18} color={colors.warning} />
            <View style={{ flex: 1 }}>
              <Subhead bold style={{ color: colors.warning }}>Settlement under review</Subhead>
              <Footnote style={{ marginTop: 2 }}>
                {dispute.category?.replace("_", " ")} — payments paused until resolved.
              </Footnote>
            </View>
          </View>
        ) : null}

        <View style={[cardStyle, styles.cardPadTightTop]}>
          <Title2 style={[styles.sectionTitle, { color: colors.textPrimary }]}>
            {t.settlementsScreen.gameSummary}
          </Title2>
          <View style={[styles.innerWellPad, innerWell]}>
            <View style={styles.summaryGrid}>
              <View style={styles.summaryItem}>
                <Ionicons name="cash-outline" size={22} color={colors.orange} />
                <Subhead bold style={{ color: colors.textPrimary, fontVariant: ["tabular-nums"] }}>
                  ${totalPot.toFixed(0)}
                </Subhead>
                <Caption2 style={{ color: colors.textMuted }}>{t.settlementsScreen.totalPot}</Caption2>
              </View>
              <View style={[styles.summaryDivider, { backgroundColor: colors.border }]} />
              <View style={styles.summaryItem}>
                <Ionicons name="trending-up" size={22} color={colors.success} />
                <Subhead bold style={{ color: colors.success }}>{winnersCount}</Subhead>
                <Caption2 style={{ color: colors.textMuted }}>{t.settlementsScreen.winners}</Caption2>
              </View>
              <View style={[styles.summaryDivider, { backgroundColor: colors.border }]} />
              <View style={styles.summaryItem}>
                <Ionicons name="trending-down" size={22} color={colors.danger} />
                <Subhead bold style={{ color: colors.danger }}>{losersCount}</Subhead>
                <Caption2 style={{ color: colors.textMuted }}>{t.settlementsScreen.losers}</Caption2>
              </View>
            </View>
          </View>
        </View>

        {currentPlayer ? (
          <View
            style={[
              cardStyle,
              styles.heroCard,
              {
                backgroundColor:
                  netResult > 0.01
                    ? isDark
                      ? "rgba(52, 199, 89, 0.12)"
                      : "rgba(52, 199, 89, 0.08)"
                    : netResult < -0.01
                      ? isDark
                        ? "rgba(255, 59, 48, 0.12)"
                        : "rgba(255, 59, 48, 0.08)"
                      : cardStyle.backgroundColor,
                borderColor:
                  netResult > 0.01
                    ? "rgba(52, 199, 89, 0.35)"
                    : netResult < -0.01
                      ? "rgba(255, 59, 48, 0.35)"
                      : cardStyle.borderColor,
              },
            ]}
          >
            <View style={styles.heroInner}>
              <Title2 style={[styles.sectionTitle, { color: colors.textPrimary, textAlign: "center", width: "100%" }]}>
                {t.settlementsScreen.yourResult}
              </Title2>
              <Text
                style={[
                  styles.heroNet,
                  {
                    color:
                      netResult > 0.01
                        ? colors.success
                        : netResult < -0.01
                          ? colors.danger
                          : colors.textPrimary,
                  },
                ]}
              >
                {netResult > 0 ? "+" : ""}
                {netResult !== 0 ? `$${Math.abs(netResult).toFixed(0)}` : "$0"}
              </Text>
              <Subhead style={{ color: colors.textMuted, marginTop: SPACE.xs, textAlign: "center" }}>
                {netResult > 0.01 ? "You won." : netResult < -0.01 ? "You lost." : "You broke even."}
              </Subhead>
              {netResult > 0.01 && myCredits.length > 0 ? (
                <Caption2 style={{ color: colors.textMuted, marginTop: SPACE.xs, textAlign: "center" }}>
                  {myCredits.map((c: any) => `${c.from_name || "Player"} owes you $${(c.amount || 0).toFixed(0)}`).join(" · ")}
                </Caption2>
              ) : null}
              {netResult < -0.01 && myDebts.length > 0 ? (
                <Caption2 style={{ color: colors.textMuted, marginTop: SPACE.xs, textAlign: "center" }}>
                  {myDebts.map((d: any) => `You owe ${d.to_name || "Player"} $${(d.amount || 0).toFixed(0)}`).join(" · ")}
                </Caption2>
              ) : null}
            </View>
          </View>
        ) : null}

        {hasDiscrepancy ? (
          <View
            style={[
              styles.discrepancyBanner,
              {
                backgroundColor: isDark ? "rgba(234, 179, 8, 0.12)" : "rgba(234, 179, 8, 0.08)",
                borderColor: isDark ? "rgba(234, 179, 8, 0.35)" : "rgba(234, 179, 8, 0.25)",
              },
            ]}
          >
            <Ionicons name="warning-outline" size={18} color={colors.warning} />
            <View style={{ flex: 1 }}>
              <Subhead bold style={{ color: colors.warning }}>Chip discrepancy detected</Subhead>
              <Footnote style={{ marginTop: 2 }}>
                Buy-ins: ${totalPot.toFixed(2)} · Cash-outs: ${totalOut.toFixed(2)} · Diff: $
                {Math.abs(totalPot - totalOut).toFixed(2)}
              </Footnote>
            </View>
          </View>
        ) : null}

        <View style={[cardStyle, styles.cardPadTightTop]}>
          <Title2 style={[styles.sectionTitle, { color: colors.textPrimary }]}>
            {t.settlementsScreen.results}
          </Title2>
          <View style={[styles.innerWellPad, innerWell]}>
            {sortedResults.length === 0 ? (
              <Footnote style={{ textAlign: "center", paddingVertical: SPACE.md }}>
                {t.settlementsScreen.noResultsAvailable}
              </Footnote>
            ) : (
              displayedResults.map((result: any, idx: number) => {
                  const resultNet = deriveResultNet(result);
                  const isWinner = resultNet > 0;
                  const isLoser = resultNet < 0;
                  const isCurrentUser = String(result.user_id) === String(uid);

                  return (
                    <View key={result.user_id || idx}>
                      <View style={styles.resultRow}>
                        <Caption2 style={{ width: 28, textAlign: "center", color: colors.textMuted }}>#{idx + 1}</Caption2>
                        <View
                          style={[
                            styles.resultAvatar,
                            {
                              backgroundColor: isCurrentUser
                                ? "rgba(255, 149, 0, 0.15)"
                                : "rgba(0, 122, 255, 0.12)",
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.resultAvatarText,
                              { color: isCurrentUser ? colors.orange : colors.trustBlue },
                            ]}
                          >
                            {(result.name || result.email || "?")[0].toUpperCase()}
                          </Text>
                        </View>
                        <View style={styles.resultInfo}>
                          <Headline numberOfLines={1}>
                            {(result.name || result.email || "Player") +
                              (isCurrentUser ? " (You)" : "")}
                          </Headline>
                          <Footnote style={{ marginTop: 2 }} numberOfLines={1}>
                            ${result.total_buy_in || 0} in · ${result.cash_out || 0} out
                          </Footnote>
                        </View>
                        <View style={styles.resultNet}>
                          <Subhead
                            bold
                            style={{
                              color: isWinner ? colors.success : isLoser ? colors.danger : colors.textMuted,
                              fontVariant: ["tabular-nums"],
                            }}
                          >
                            {resultNet >= 0 ? "+" : ""}${resultNet.toFixed(0)}
                          </Subhead>
                          {isWinner ? <Ionicons name="arrow-up" size={14} color={colors.success} /> : null}
                          {isLoser ? <Ionicons name="arrow-down" size={14} color={colors.danger} /> : null}
                        </View>
                      </View>
                      {idx < displayedResults.length - 1 ? (
                        <View style={[styles.divider, { backgroundColor: colors.border }]} />
                      ) : null}
                    </View>
                  );
                })
            )}
          </View>
          {resultsTruncated ? (
            <Footnote style={[styles.partialListNote, { color: colors.textMuted }]}>
              {t.chatsScreen.showingCount
                .replace("{shown}", String(displayedResults.length))
                .replace("{total}", String(sortedResults.length))}
            </Footnote>
          ) : null}
        </View>

        <View
          style={[
            cardStyle,
            styles.cardPadTightTop,
            payments.length > 0
              ? { borderColor: isDark ? "rgba(0, 122, 255, 0.35)" : "rgba(0, 122, 255, 0.22)" }
              : null,
          ]}
        >
          <View style={styles.smartSettlementHeading}>
            <Title2 style={[styles.smartSettlementTitle, { color: colors.textPrimary }]}>
              {t.settlementsScreen.smartSettlement}
            </Title2>
            {payments.length > 0 && possiblePayments > payments.length ? (
              <View
                style={[
                  styles.optimizeBadge,
                  { backgroundColor: isDark ? "rgba(52, 199, 89, 0.15)" : "rgba(52, 199, 89, 0.12)" },
                ]}
              >
                <Caption2 style={{ fontWeight: "600", color: colors.success }}>
                  {possiblePayments} possible → {payments.length}
                </Caption2>
              </View>
            ) : null}
          </View>
          <View style={[styles.innerWellPad, innerWell]}>
            {payments.length === 0 && !hasMaterialNetAcrossResults ? (
              <View style={styles.emptyPayments}>
                <Ionicons name="checkmark-circle" size={40} color={colors.success} />
                <Subhead style={{ color: colors.success, marginTop: SPACE.sm, textAlign: "center" }}>
                  {t.settlementsScreen.everyoneEven}
                </Subhead>
              </View>
            ) : payments.length === 0 && hasMaterialNetAcrossResults ? (
              <View style={styles.emptyPayments}>
                <Ionicons name="alert-circle-outline" size={40} color={colors.warning} />
                <Subhead style={{ color: colors.textPrimary, marginTop: SPACE.sm, textAlign: "center" }}>
                  Payment transfers are not on file for this game yet.
                </Subhead>
                <Footnote style={{ color: colors.textMuted, marginTop: SPACE.xs, textAlign: "center" }}>
                  Pull to refresh, or ask the host to regenerate settlement if this persists.
                </Footnote>
              </View>
            ) : (
              displayedPayments.map((payment: any, idx: number) => {
                const isFromUser =
                  String(payment.from_user_id) === String(effectiveUserIdForPayments);
                const isToUser =
                  String(payment.to_user_id) === String(effectiveUserIdForPayments);
                const canMarkPaid = isFromUser || isToUser;
                const isPaid = payment.paid === true;
                const contextLabel = isFromUser
                  ? `You pay ${payment.to_name}`
                  : isToUser
                    ? `${payment.from_name} pays you`
                    : `${payment.from_name} pays ${payment.to_name}`;

                return (
                  <View key={payment.ledger_id || idx}>
                    <View style={[styles.paymentEntry, hasDisputeOpen && { opacity: 0.6 }]}>
                      <View style={styles.paymentFlow}>
                        <View style={[styles.paymentAvatar, { backgroundColor: "rgba(239,68,68,0.15)" }]}>
                          <Text style={[styles.paymentAvatarText, { color: colors.danger }]}>
                            {(payment.from_name || "?")[0].toUpperCase()}
                          </Text>
                        </View>
                        <View style={styles.paymentArrow}>
                          <View style={[styles.arrowLine, { backgroundColor: colors.border }]} />
                          <Ionicons name="arrow-forward" size={16} color={colors.textMuted} />
                          <View style={[styles.arrowLine, { backgroundColor: colors.border }]} />
                        </View>
                        <View style={[styles.paymentAvatar, { backgroundColor: "rgba(34,197,94,0.15)" }]}>
                          <Text style={[styles.paymentAvatarText, { color: colors.success }]}>
                            {(payment.to_name || "?")[0].toUpperCase()}
                          </Text>
                        </View>
                      </View>
                      <View style={styles.paymentDetails}>
                        <Headline style={{ textAlign: "center" }} numberOfLines={2}>
                          {payment.from_name || "Player"} → {payment.to_name || "Player"}
                        </Headline>
                        <Text
                          style={[
                            styles.paymentAmount,
                            { color: colors.orange, fontVariant: ["tabular-nums"] },
                          ]}
                        >
                          ${payment.amount?.toFixed(2)}
                        </Text>
                        <Caption2
                          style={{
                            marginTop: 2,
                            textAlign: "center",
                            color: isFromUser ? colors.danger : isToUser ? colors.success : colors.textMuted,
                          }}
                        >
                          {contextLabel}
                        </Caption2>
                        {isPaid ? (
                          <Caption2 style={{ color: colors.success, marginTop: 2 }}>✓ Settled</Caption2>
                        ) : null}
                      </View>
                      <View style={styles.paymentActions}>
                        {(() => {
                          const showPayStripe = isFromUser && !isPaid && !hasDisputeOpen;
                          const showMarkPaidBtn = canMarkPaid && !hasDisputeOpen;
                          const pairedActions = showPayStripe && showMarkPaidBtn;

                          if (pairedActions) {
                            return (
                              <View style={styles.actionsButtonRow}>
                                <TouchableOpacity
                                  style={[
                                    styles.actionButtonHalf,
                                    {
                                      backgroundColor: "#635bff",
                                      minHeight: BUTTON_SIZE.large.height,
                                    },
                                  ]}
                                  onPress={() => handlePayWithStripe(payment.ledger_id)}
                                  disabled={payingStripe === payment.ledger_id}
                                  activeOpacity={0.88}
                                >
                                  {payingStripe === payment.ledger_id ? (
                                    <ActivityIndicator size="small" color="#fff" />
                                  ) : (
                                    <>
                                      <Ionicons name="card-outline" size={22} color="#fff" />
                                      <Text style={styles.paymentActionLabelLight}>Pay</Text>
                                    </>
                                  )}
                                </TouchableOpacity>
                                <TouchableOpacity
                                  style={[
                                    styles.actionButtonHalf,
                                    styles.actionButtonSecondary,
                                    {
                                      backgroundColor: colors.inputBg,
                                      borderColor: colors.border,
                                      minHeight: BUTTON_SIZE.large.height,
                                    },
                                  ]}
                                  onPress={() => handleMarkPaid(payment.ledger_id, isPaid)}
                                  disabled={markingPaid === payment.ledger_id}
                                  activeOpacity={0.88}
                                >
                                  {markingPaid === payment.ledger_id ? (
                                    <ActivityIndicator size="small" color={colors.textMuted} />
                                  ) : (
                                    <>
                                      <Ionicons
                                        name="checkmark-circle-outline"
                                        size={22}
                                        color={colors.textMuted}
                                      />
                                      <Text
                                        style={[
                                          styles.paymentActionLabelDark,
                                          { color: colors.textPrimary },
                                        ]}
                                      >
                                        Mark Paid
                                      </Text>
                                    </>
                                  )}
                                </TouchableOpacity>
                              </View>
                            );
                          }

                          if (showMarkPaidBtn) {
                            return (
                              <TouchableOpacity
                                style={[
                                  styles.paymentSingleButton,
                                  styles.actionButtonSecondary,
                                  isPaid
                                    ? {
                                        backgroundColor: "rgba(34,197,94,0.15)",
                                        borderColor: "rgba(34,197,94,0.3)",
                                      }
                                    : {
                                        backgroundColor: colors.inputBg,
                                        borderColor: colors.border,
                                      },
                                  { minHeight: BUTTON_SIZE.large.height },
                                ]}
                                onPress={() => handleMarkPaid(payment.ledger_id, isPaid)}
                                disabled={markingPaid === payment.ledger_id}
                                activeOpacity={0.88}
                              >
                                {markingPaid === payment.ledger_id ? (
                                  <ActivityIndicator size="small" color={colors.textMuted} />
                                ) : (
                                  <>
                                    <Ionicons
                                      name={isPaid ? "checkmark-circle" : "checkmark-circle-outline"}
                                      size={22}
                                      color={isPaid ? colors.success : colors.textMuted}
                                    />
                                    <Text
                                      style={[
                                        styles.paymentActionLabelDark,
                                        { color: isPaid ? colors.success : colors.textPrimary },
                                      ]}
                                    >
                                      {isPaid ? "Paid" : "Mark Paid"}
                                    </Text>
                                  </>
                                )}
                              </TouchableOpacity>
                            );
                          }

                          return null;
                        })()}
                      </View>
                    </View>
                    {idx < displayedPayments.length - 1 && (
                      <View style={[styles.divider, { backgroundColor: colors.border }]} />
                    )}
                  </View>
                );
              })
            )}
          </View>
          {paymentsTruncated ? (
            <Footnote style={[styles.partialListNote, { color: colors.textMuted }]}>
              {t.chatsScreen.showingCount
                .replace("{shown}", String(displayedPayments.length))
                .replace("{total}", String(payments.length))}
            </Footnote>
          ) : null}
        </View>

        {/* Report Issue Button */}
        {!hasDisputeOpen && payments.length > 0 && (
          <TouchableOpacity
            style={{ alignItems: "center", paddingVertical: 12 }}
            onPress={() => setShowDisputeModal(true)}
            activeOpacity={0.7}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: SPACE.xs }}>
              <Ionicons name="flag-outline" size={16} color={colors.textMuted} />
              <Footnote>Report an issue with this settlement</Footnote>
            </View>
          </TouchableOpacity>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Dispute Modal */}
      <GlassModal
        visible={showDisputeModal}
        onClose={() => setShowDisputeModal(false)}
        title="Report Settlement Issue"
        size="medium"
      >
        <Footnote style={{ marginBottom: SPACE.sm }}>What&apos;s wrong?</Footnote>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
          {[
            { key: "wrong_buyin", label: "Wrong buy-in" },
            { key: "wrong_cashout", label: "Wrong cash-out" },
            { key: "missing_player", label: "Missing player" },
            { key: "other", label: "Other" },
          ].map(opt => (
            <TouchableOpacity
              key={opt.key}
              style={{
                paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, borderWidth: 1,
                backgroundColor: disputeCategory === opt.key ? "rgba(245,158,11,0.15)" : colors.inputBg,
                borderColor: disputeCategory === opt.key ? "rgba(245,158,11,0.4)" : colors.border,
              }}
              onPress={() => setDisputeCategory(opt.key)}
            >
              <Caption2
                style={{
                  color: disputeCategory === opt.key ? colors.warning : colors.textSecondary,
                  fontWeight: disputeCategory === opt.key ? "600" : "400",
                }}
              >
                {opt.label}
              </Caption2>
            </TouchableOpacity>
          ))}
        </View>

        <Footnote style={{ marginBottom: SPACE.sm }}>Describe the issue</Footnote>
        <TextInput
          value={disputeMessage}
          onChangeText={setDisputeMessage}
          placeholder="E.g., My cash-out was $40 not $30..."
          placeholderTextColor={colors.textMuted}
          multiline
          style={{
            backgroundColor: colors.inputBg,
            borderColor: colors.border,
            borderWidth: StyleSheet.hairlineWidth,
            borderRadius: RADIUS.lg,
            padding: SPACE.md,
            color: colors.textPrimary,
            fontSize: APPLE_TYPO.subhead.size,
            minHeight: 80,
            textAlignVertical: "top",
          }}
        />

        <View style={{ flexDirection: "row", gap: SPACE.sm, marginTop: SPACE.lg }}>
          <TouchableOpacity
            style={[
              styles.modalBtnSecondary,
              {
                borderColor: colors.border,
                minHeight: BUTTON_SIZE.regular.height,
              },
            ]}
            onPress={() => setShowDisputeModal(false)}
          >
            <Subhead bold style={{ color: colors.textSecondary }}>Cancel</Subhead>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.modalBtnPrimary,
              {
                backgroundColor: colors.warning,
                minHeight: BUTTON_SIZE.regular.height,
                opacity: submittingDispute ? 0.7 : 1,
              },
            ]}
            onPress={handleSubmitDispute}
            disabled={submittingDispute}
          >
            {submittingDispute ? (
              <ActivityIndicator size="small" color="#1a1a1a" />
            ) : (
              <Subhead bold style={{ color: "#1a1a1a" }}>Report issue</Subhead>
            )}
          </TouchableOpacity>
        </View>
      </GlassModal>

      <PostGameSurveyModal
        visible={showSurvey}
        onClose={() => setShowSurvey(false)}
        gameId={gameId}
        groupId={settlement?.group_id}
      />
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
  headerCenter: {
    flex: 1,
    minWidth: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitleMain: {
    textAlign: "center",
    letterSpacing: -0.5,
    width: "100%",
  },
  headerGameTitle: {
    textAlign: "center",
    marginTop: 2,
    width: "100%",
  },
  scroll: { flex: 1, zIndex: 1 },
  scrollContent: {
    paddingHorizontal: SCREEN_PAD,
    paddingTop: SPACE.xs,
    gap: LAYOUT.elementGap,
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
  disputeBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
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
  innerWellPad: {
    paddingHorizontal: SPACE.md,
    paddingVertical: SPACE.sm,
    marginTop: SPACE.xs,
  },
  heroCard: {
    padding: SPACE.lg,
  },
  heroInner: {
    alignItems: "center",
    paddingVertical: SPACE.lg,
  },
  heroNet: {
    fontSize: 40,
    lineHeight: 44,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  sectionTitle: {
    marginBottom: SPACE.sm,
  },
  smartSettlementHeading: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: SPACE.sm,
  },
  smartSettlementTitle: {
    flex: 1,
    marginBottom: SPACE.sm,
    marginRight: SPACE.xs,
  },
  partialListNote: {
    marginTop: SPACE.sm,
    textAlign: "center",
  },
  optimizeBadge: {
    marginLeft: "auto",
    paddingHorizontal: SPACE.sm,
    paddingVertical: 3,
    borderRadius: RADIUS.full,
  },
  discrepancyBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: SPACE.sm,
    padding: SPACE.md,
    borderRadius: RADIUS.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  summaryGrid: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    paddingTop: SPACE.sm,
  },
  summaryItem: {
    alignItems: "center",
    gap: SPACE.xs,
    flex: 1,
  },
  summaryDivider: {
    width: StyleSheet.hairlineWidth,
    height: 48,
  },
  resultRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: SPACE.md,
    gap: SPACE.md,
  },
  resultAvatar: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.md,
    justifyContent: "center",
    alignItems: "center",
  },
  resultAvatarText: {
    fontSize: APPLE_TYPO.subhead.size,
    fontWeight: "700",
  },
  resultInfo: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  resultNet: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.xs,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 80,
  },
  emptyPayments: {
    alignItems: "center",
    paddingVertical: SPACE.xl,
    paddingHorizontal: SPACE.md,
  },
  paymentEntry: {
    paddingVertical: SPACE.md,
    gap: SPACE.md,
  },
  paymentFlow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACE.sm,
  },
  paymentAvatar: {
    width: 42,
    height: 42,
    borderRadius: RADIUS.md,
    justifyContent: "center",
    alignItems: "center",
  },
  paymentAvatarText: {
    fontSize: APPLE_TYPO.subhead.size,
    fontWeight: "700",
  },
  paymentArrow: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    maxWidth: 80,
  },
  arrowLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
  },
  paymentDetails: {
    alignItems: "center",
    gap: 2,
  },
  paymentAmount: {
    fontSize: APPLE_TYPO.title2.size,
    fontWeight: "700",
    marginTop: SPACE.xs,
  },
  paymentActions: {
    width: "100%",
    alignItems: "stretch",
  },
  actionsButtonRow: {
    flexDirection: "row",
    gap: SPACE.md,
    width: "100%",
  },
  actionButtonHalf: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACE.sm,
    borderRadius: RADIUS.xl,
    paddingHorizontal: SPACE.md,
  },
  actionButtonSecondary: {
    borderWidth: 1,
  },
  paymentSingleButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACE.sm,
    borderRadius: RADIUS.xl,
    paddingHorizontal: SPACE.md,
    alignSelf: "stretch",
    width: "100%",
  },
  paymentActionLabelLight: {
    fontSize: APPLE_TYPO.body.size,
    fontWeight: "600",
    color: "#fff",
  },
  paymentActionLabelDark: {
    fontSize: APPLE_TYPO.body.size,
    fontWeight: "600",
  },
  modalBtnSecondary: {
    flex: 1,
    borderRadius: RADIUS.lg,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },
  modalBtnPrimary: {
    flex: 1,
    borderRadius: RADIUS.lg,
    alignItems: "center",
    justifyContent: "center",
  },
});
