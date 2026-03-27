import React, { useCallback, useEffect, useState, useRef, useMemo } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Linking,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../api/client";
import { useTheme } from "../context/ThemeContext";
import { useLanguage } from "../context/LanguageContext";
import { ANIMATION } from "../styles/liquidGlass";
import { appleCardShadowResting } from "../styles/appleShadows";
import {
  APPLE_TYPO,
  AVATAR_SIZE,
  BUTTON_SIZE,
  LAYOUT,
  RADIUS,
  SPACE,
} from "../styles/tokens";
import { PageHeader, Label, Headline, Footnote } from "../components/ui";
import { BottomSheetScreen } from "../components/BottomSheetScreen";
import type { RootStackParamList } from "../navigation/RootNavigator";

type Nav = NativeStackNavigationProp<RootStackParamList>;

type ConsolidatedPerson = {
  user: { user_id: string; name: string; picture?: string };
  net_amount: number;
  direction: "owed_to_you" | "you_owe";
  display_amount: number;
  game_count?: number;
  game_breakdown?: Array<{
    game_id: string;
    game_title: string;
    game_date?: string;
    amount: number;
    direction: string;
    ledger_ids: string[];
  }>;
  offset_explanation?: {
    offset_amount: number;
    gross_you_owe: number;
    gross_they_owe: number;
  } | null;
  all_ledger_ids?: string[];
};

/** Inset for row content aligned to circular avatar + gap (divider, expanded block). */
const ROW_CONTENT_INSET = AVATAR_SIZE.md + SPACE.md;

export function RequestAndPayScreen() {
  const { isDark, colors } = useTheme();
  const { t } = useLanguage();
  const navigation = useNavigation<Nav>();

  const cardStyle = useMemo(
    () => ({
      backgroundColor: isDark ? "rgba(45, 45, 48, 0.9)" : "rgba(255, 255, 255, 0.95)",
      borderRadius: RADIUS.xl,
      borderWidth: 1,
      borderColor: isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.06)",
      ...appleCardShadowResting(isDark),
    }),
    [isDark]
  );

  const cardSmStyle = useMemo(() => ({ ...cardStyle, borderRadius: RADIUS.lg }), [cardStyle]);

  const metricRingPad = useMemo(
    () => ({
      padBg: isDark ? "rgba(168, 182, 215, 0.1)" : "rgba(88, 102, 138, 0.07)",
      rimBorder: isDark ? "rgba(255, 255, 255, 0.09)" : "rgba(0, 0, 0, 0.07)",
    }),
    [isDark]
  );

  const profitColor = useCallback(
    (val: number) => {
      if (val === 0) return colors.textSecondary;
      return val > 0
        ? (isDark ? "rgba(52, 199, 89, 0.9)" : "#1B7340")
        : (isDark ? "rgba(255, 69, 58, 0.9)" : "#C41E3A");
    },
    [colors.textSecondary, isDark]
  );

  const [balances, setBalances] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"owed" | "owes">("owed");
  const [requestingPayment, setRequestingPayment] = useState<string | null>(null);
  const [payingUserId, setPayingUserId] = useState<string | null>(null);
  const [expandedUser, setExpandedUser] = useState<string | null>(null);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 350, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, ...ANIMATION.spring.bouncy }),
    ]).start();
  }, []);

  const fetchBalances = useCallback(async () => {
    try {
      setError(null);
      const res = await api.get("/ledger/consolidated-detailed");
      setBalances(res.data);
    } catch (e: any) {
      setError(e?.response?.data?.detail || e?.message || "Balances unavailable.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBalances();
  }, [fetchBalances]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchBalances();
    setRefreshing(false);
  }, [fetchBalances]);

  const handleRequestPayment = async (person: ConsolidatedPerson) => {
    const firstLedgerId = person.game_breakdown?.[0]?.ledger_ids?.[0] ||
      person.all_ledger_ids?.[0];
    if (!firstLedgerId) {
      Alert.alert("No entry available", "No pending ledger entry to request.");
      return;
    }
    setRequestingPayment(person.user.user_id);
    try {
      await api.post(`/ledger/${firstLedgerId}/request-payment`);
      Alert.alert("All set", "Payment request sent.");
    } catch (e: any) {
      Alert.alert("Request unavailable", e?.response?.data?.detail || "Please try again.");
    } finally {
      setRequestingPayment(null);
    }
  };

  const handlePayNet = async (person: ConsolidatedPerson) => {
    setPayingUserId(person.user.user_id);
    try {
      const allLedgerIds = person.all_ledger_ids ||
        person.game_breakdown?.flatMap(g => g.ledger_ids) || [];
      const originUrl = process.env.EXPO_PUBLIC_SOCKET_URL || "https://kvitt.duckdns.org";
      const res = await api.post("/ledger/pay-net/prepare", {
        other_user_id: person.user.user_id,
        ledger_ids: allLedgerIds,
        origin_url: originUrl,
      });
      if (res.data?.checkout_url) {
        await Linking.openURL(res.data.checkout_url);
      } else {
        Alert.alert("Payment link unavailable", "Please try again.");
      }
    } catch (e: any) {
      Alert.alert("Payment unavailable", e?.response?.data?.detail || "Please try again.");
    } finally {
      setPayingUserId(null);
    }
  };

  const allEntries: ConsolidatedPerson[] = balances?.consolidated || [];
  const owedToYou = allEntries.filter(e => e.direction === "owed_to_you");
  const youOwe = allEntries.filter(e => e.direction === "you_owe");
  const totalOwed = balances?.total_owed_to_you || 0;
  const totalOwes = balances?.total_you_owe || 0;
  const netBalance = balances?.net_balance || 0;

  const netTint = useMemo(() => {
    if (netBalance >= 0) {
      return {
        backgroundColor: isDark ? "rgba(52, 199, 89, 0.12)" : "rgba(27, 115, 64, 0.1)",
        borderColor: isDark ? "rgba(52, 199, 89, 0.28)" : "rgba(27, 115, 64, 0.22)",
      };
    }
    return {
      backgroundColor: isDark ? "rgba(255, 69, 58, 0.12)" : "rgba(196, 30, 58, 0.1)",
      borderColor: isDark ? "rgba(255, 69, 58, 0.28)" : "rgba(196, 30, 58, 0.22)",
    };
  }, [netBalance, isDark]);

  const tabTintOwed = useMemo(
    () => ({
      backgroundColor: isDark ? "rgba(52, 199, 89, 0.15)" : "rgba(27, 115, 64, 0.12)",
      borderColor: isDark ? "rgba(52, 199, 89, 0.35)" : "rgba(27, 115, 64, 0.25)",
    }),
    [isDark]
  );

  const tabTintOwes = useMemo(
    () => ({
      backgroundColor: isDark ? "rgba(255, 69, 58, 0.15)" : "rgba(196, 30, 58, 0.12)",
      borderColor: isDark ? "rgba(255, 69, 58, 0.35)" : "rgba(196, 30, 58, 0.25)",
    }),
    [isDark]
  );

  const activeList = activeTab === "owed" ? owedToYou : youOwe;

  if (loading) {
    return (
      <BottomSheetScreen>
        <View style={[styles.loadingContainer, { backgroundColor: colors.contentBg }]}>
          <ActivityIndicator size="large" color={colors.orange} />
          <Text style={[styles.loadingText, { color: colors.textMuted }]}>{t.requestPayScreen.loading}</Text>
        </View>
      </BottomSheetScreen>
    );
  }

  return (
    <BottomSheetScreen>
      <View style={[styles.container, { backgroundColor: colors.contentBg }]}>
        <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
          <PageHeader
            title={t.nav.requestPay}
            titleAlign="left"
            titleVariant="prominent"
            onClose={() => navigation.goBack()}
          />
        </Animated.View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.orange}
              titleColor={colors.textSecondary}
              colors={[colors.orange]}
              progressBackgroundColor={isDark ? "#3A3A3C" : "#FFFFFF"}
            />
          }
        >
          <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>

            {error && (
              <View
                style={[
                  cardSmStyle,
                  styles.errorBanner,
                  {
                    borderColor: isDark ? "rgba(255, 69, 58, 0.35)" : "rgba(196, 30, 58, 0.3)",
                    backgroundColor: isDark ? "rgba(255, 69, 58, 0.12)" : "rgba(196, 30, 58, 0.08)",
                  },
                ]}
              >
                <Ionicons name="alert-circle" size={18} color={colors.danger} />
                <Text style={[styles.errorText, { color: colors.danger }]}>{error}</Text>
              </View>
            )}

            <Label style={{ marginTop: 0, marginBottom: SPACE.sm }}>{t.requestPayScreen.balancesSection}</Label>
            <View style={[styles.card, cardStyle, { marginBottom: LAYOUT.sectionGap }]}>
              <Label style={{ marginBottom: SPACE.md }}>{t.requestPayScreen.netBalanceLabel}</Label>
              <View style={styles.balanceRow}>
                <View style={styles.balanceItem}>
                  <Ionicons name="arrow-up-outline" size={20} color={profitColor(-1)} />
                  <Text style={[styles.balanceLabel, { color: colors.textMuted }]}>
                    {t.requestPayScreen.balanceYouOwe}
                  </Text>
                  <Text
                    style={[
                      styles.balanceValue,
                      { color: profitColor(-1) },
                      Platform.OS === "ios" ? styles.tabularAmount : null,
                    ]}
                  >
                    ${totalOwes.toFixed(2)}
                  </Text>
                </View>
                <View style={[styles.balanceDivider, { backgroundColor: colors.border }]} />
                <View style={styles.balanceItem}>
                  <Ionicons name="arrow-down-outline" size={20} color={profitColor(1)} />
                  <Text style={[styles.balanceLabel, { color: colors.textMuted }]}>
                    {t.requestPayScreen.balanceOwedToYou}
                  </Text>
                  <Text
                    style={[
                      styles.balanceValue,
                      { color: profitColor(1) },
                      Platform.OS === "ios" ? styles.tabularAmount : null,
                    ]}
                  >
                    ${totalOwed.toFixed(2)}
                  </Text>
                </View>
              </View>
              <View style={[styles.netRow, netTint]}>
                <Text style={[styles.netLabel, { color: colors.textMuted }]}>{t.settlementsScreen.net}</Text>
                <Text
                  style={[
                    styles.netValue,
                    {
                      color:
                        netBalance === 0 ? colors.textSecondary : profitColor(netBalance > 0 ? 1 : -1),
                    },
                    Platform.OS === "ios" ? styles.tabularAmount : null,
                  ]}
                >
                  {netBalance >= 0 ? "+" : ""}${netBalance.toFixed(2)}
                </Text>
              </View>
            </View>

            <Label style={{ marginTop: LAYOUT.sectionGap, marginBottom: SPACE.sm }}>
              {t.requestPayScreen.transactionsSection}
            </Label>
            <View style={[styles.tabRow, cardSmStyle, { marginBottom: LAYOUT.elementGap }]}>
              <TouchableOpacity
                style={[styles.tab, activeTab === "owed" && tabTintOwed]}
                onPress={() => setActiveTab("owed")}
                activeOpacity={0.7}
                accessibilityRole="tab"
                accessibilityState={{ selected: activeTab === "owed" }}
              >
                <Text
                  style={[
                    styles.tabText,
                    { color: activeTab === "owed" ? profitColor(1) : colors.textMuted },
                  ]}
                >
                  {t.requestPayScreen.tabOwedToYou.replace("{count}", String(owedToYou.length))}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tab, activeTab === "owes" && tabTintOwes]}
                onPress={() => setActiveTab("owes")}
                activeOpacity={0.7}
                accessibilityRole="tab"
                accessibilityState={{ selected: activeTab === "owes" }}
              >
                <Text
                  style={[
                    styles.tabText,
                    { color: activeTab === "owes" ? profitColor(-1) : colors.textMuted },
                  ]}
                >
                  {t.requestPayScreen.tabYouOwe.replace("{count}", String(youOwe.length))}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={[styles.card, styles.listCard, cardSmStyle, { marginBottom: LAYOUT.sectionGap }]}>
              {activeList.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Ionicons
                    name={activeTab === "owed" ? "checkmark-done-outline" : "arrow-down-circle-outline"}
                    size={40}
                    color={colors.textMuted}
                  />
                  <Text style={[styles.emptyTitle, { color: colors.textSecondary }]}>
                    {activeTab === "owed" ? t.requestPayScreen.emptyOwedTitle : t.requestPayScreen.emptyOweTitle}
                  </Text>
                  <Text style={[styles.emptySubtext, { color: colors.textMuted }]}>
                    {activeTab === "owed" ? t.requestPayScreen.emptyOwedSub : t.requestPayScreen.emptyOweSub}
                  </Text>
                </View>
              ) : (
                activeList.map((person: ConsolidatedPerson, idx: number) => {
                  const otherName = person.user?.name || "Player";
                  const initial = (otherName || "?")[0].toUpperCase();
                  const isExpanded = expandedUser === person.user?.user_id;

                  return (
                    <View key={person.user?.user_id || idx}>
                      <TouchableOpacity
                        style={styles.entryRow}
                        onPress={() => setExpandedUser(isExpanded ? null : person.user?.user_id)}
                        activeOpacity={0.7}
                        accessibilityRole="button"
                        accessibilityLabel={`${otherName}, ${person.display_amount.toFixed(2)} dollars`}
                        hitSlop={{ top: SPACE.xs, bottom: SPACE.xs, left: 0, right: 0 }}
                      >
                        <View
                          style={[
                            styles.entryAvatar,
                            {
                              backgroundColor: metricRingPad.padBg,
                              borderColor: metricRingPad.rimBorder,
                              borderWidth: StyleSheet.hairlineWidth * 2,
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.entryAvatarText,
                              { color: activeTab === "owed" ? profitColor(1) : profitColor(-1) },
                            ]}
                          >
                            {initial}
                          </Text>
                        </View>
                        <View style={styles.entryInfo}>
                          <Text style={[styles.entryName, { color: colors.textPrimary }]} numberOfLines={1}>
                            {otherName}
                          </Text>
                          <Text style={[styles.entryMeta, { color: colors.textMuted }]} numberOfLines={1}>
                            {person.game_count || 1} game{(person.game_count || 1) > 1 ? "s" : ""}
                            {person.offset_explanation ? " \u00b7 auto-netted" : ""}
                          </Text>
                        </View>
                        <Text
                          style={[
                            styles.entryAmount,
                            {
                              color: activeTab === "owed" ? profitColor(1) : profitColor(-1),
                            },
                            Platform.OS === "ios" ? styles.tabularAmount : null,
                          ]}
                        >
                          ${person.display_amount.toFixed(2)}
                        </Text>
                        <Ionicons name={isExpanded ? "chevron-up" : "chevron-down"} size={20} color={colors.textMuted} />
                      </TouchableOpacity>

                      {isExpanded && (
                        <View style={[styles.expandedBlock, { paddingLeft: ROW_CONTENT_INSET }]}>
                          {person.offset_explanation && (
                            <View
                              style={[
                                styles.offsetCallout,
                                {
                                  backgroundColor: isDark ? "rgba(255, 159, 10, 0.12)" : "rgba(255, 159, 10, 0.1)",
                                  borderColor: isDark ? "rgba(255, 159, 10, 0.3)" : "rgba(255, 159, 10, 0.25)",
                                },
                              ]}
                            >
                              <Text style={[styles.offsetCalloutTitle, { color: colors.warning }]}>
                                Auto-netted across {person.game_count} games
                              </Text>
                              <Footnote style={styles.offsetCalloutBody}>
                                You owed ${person.offset_explanation.gross_you_owe.toFixed(2)} {"\u00b7"} They owed $
                                {person.offset_explanation.gross_they_owe.toFixed(2)} {"\u00b7"} Offset $
                                {person.offset_explanation.offset_amount.toFixed(2)}
                              </Footnote>
                            </View>
                          )}

                          {person.game_breakdown?.map((game, gi) => (
                            <View key={game.game_id || gi} style={styles.gameRow}>
                              <View style={styles.gameRowText}>
                                <Text style={[styles.gameTitle, { color: colors.textPrimary }]}>{game.game_title}</Text>
                                <Text style={[styles.gameDate, { color: colors.textMuted }]}>
                                  {game.game_date ? new Date(game.game_date).toLocaleDateString() : "Recent"}
                                </Text>
                              </View>
                              <Text
                                style={[
                                  styles.gameAmount,
                                  {
                                    color: game.direction === "you_owe" ? profitColor(-1) : profitColor(1),
                                  },
                                  Platform.OS === "ios" ? styles.tabularAmount : null,
                                ]}
                              >
                                {game.direction === "you_owe" ? "-" : "+"}${game.amount.toFixed(2)}
                              </Text>
                            </View>
                          ))}

                          <View style={styles.entryActions}>
                            {activeTab === "owed" ? (
                              <TouchableOpacity
                                style={[
                                  styles.primaryCta,
                                  styles.primaryCtaInRow,
                                  { backgroundColor: colors.buttonPrimary },
                                  appleCardShadowResting(isDark),
                                  requestingPayment === person.user.user_id ? styles.ctaDisabled : null,
                                ]}
                                onPress={() => handleRequestPayment(person)}
                                disabled={requestingPayment === person.user.user_id}
                                activeOpacity={0.85}
                                accessibilityRole="button"
                                accessibilityLabel={`Request ${person.display_amount.toFixed(2)} dollars`}
                              >
                                {requestingPayment === person.user.user_id ? (
                                  <ActivityIndicator size="small" color={colors.buttonText} />
                                ) : (
                                  <>
                                    <Ionicons name="notifications-outline" size={20} color={colors.buttonText} />
                                    <Headline style={{ color: colors.buttonText }}>
                                      Request ${person.display_amount.toFixed(0)}
                                    </Headline>
                                  </>
                                )}
                              </TouchableOpacity>
                            ) : (
                              <TouchableOpacity
                                style={[
                                  styles.primaryCta,
                                  styles.primaryCtaInRow,
                                  { backgroundColor: colors.buttonPrimary },
                                  appleCardShadowResting(isDark),
                                  payingUserId === person.user.user_id ? styles.ctaDisabled : null,
                                ]}
                                onPress={() => handlePayNet(person)}
                                disabled={payingUserId === person.user.user_id}
                                activeOpacity={0.85}
                                accessibilityRole="button"
                                accessibilityLabel={`Pay net ${person.display_amount.toFixed(2)} dollars`}
                              >
                                {payingUserId === person.user.user_id ? (
                                  <ActivityIndicator size="small" color={colors.buttonText} />
                                ) : (
                                  <>
                                    <Ionicons name="card-outline" size={20} color={colors.buttonText} />
                                    <Headline style={{ color: colors.buttonText }}>
                                      Pay Net ${person.display_amount.toFixed(0)}
                                    </Headline>
                                  </>
                                )}
                              </TouchableOpacity>
                            )}
                          </View>
                        </View>
                      )}

                      {idx < activeList.length - 1 && (
                        <View style={[styles.divider, { marginLeft: ROW_CONTENT_INSET, backgroundColor: colors.border }]} />
                      )}
                    </View>
                  );
                })
              )}
            </View>

            <View style={[cardSmStyle, styles.walletCtaShell]}>
              <TouchableOpacity
                style={[
                  styles.primaryCta,
                  styles.primaryCtaFullWidth,
                  { backgroundColor: colors.buttonPrimary },
                ]}
                onPress={() => navigation.navigate("Wallet")}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel={t.requestPayScreen.sendMoneyViaWallet}
              >
                <Ionicons name="send-outline" size={20} color={colors.buttonText} />
                <Headline style={{ color: colors.buttonText }}>
                  {t.requestPayScreen.sendMoneyViaWallet}
                </Headline>
              </TouchableOpacity>
            </View>

          </Animated.View>
          <View style={styles.scrollFooterSpacer} />
        </ScrollView>
      </View>
    </BottomSheetScreen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flex: 1 },
  content: {
    paddingHorizontal: LAYOUT.screenPadding,
    paddingTop: LAYOUT.elementGap,
    /** Extra bottom room so last card shadows are not clipped by ScrollView */
    paddingBottom: SPACE.xxxl + LAYOUT.sectionGap,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: SPACE.md,
  },
  loadingText: { fontSize: APPLE_TYPO.subhead.size, lineHeight: 22 },
  scrollFooterSpacer: { height: LAYOUT.sectionGap },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    padding: SPACE.md,
    gap: SPACE.sm,
    marginBottom: LAYOUT.elementGap,
  },
  errorText: { fontSize: APPLE_TYPO.footnote.size, flex: 1, lineHeight: 18 },
  /** Do not use overflow:hidden — it clips `appleCardShadowResting` on iOS. */
  card: {
    padding: LAYOUT.cardPadding,
  },
  listCard: {
    paddingHorizontal: LAYOUT.cardPadding,
    paddingVertical: SPACE.xs,
  },
  /** Wallet CTA — outer glass card carries main elevation; inner button adds a second lift. */
  walletCtaShell: {
    padding: SPACE.md,
    marginBottom: LAYOUT.elementGap,
  },
  balanceRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    paddingTop: SPACE.md,
  },
  balanceItem: { alignItems: "center", gap: SPACE.xs, flex: 1 },
  balanceDivider: { width: 1, height: LAYOUT.touchTarget },
  balanceLabel: {
    fontSize: APPLE_TYPO.caption2.size,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  balanceValue: { fontSize: APPLE_TYPO.title2.size, fontWeight: "700" },
  tabularAmount: { fontVariant: ["tabular-nums"] },
  netRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACE.sm,
    marginTop: SPACE.md,
    paddingVertical: SPACE.sm,
    borderRadius: RADIUS.md,
    borderWidth: 1,
  },
  netLabel: { fontSize: APPLE_TYPO.caption.size, fontWeight: "600", letterSpacing: 1 },
  netValue: { fontSize: APPLE_TYPO.title2.size, fontWeight: "700" },
  tabRow: {
    flexDirection: "row",
    padding: SPACE.xs,
  },
  tab: {
    flex: 1,
    minHeight: LAYOUT.touchTarget,
    paddingVertical: SPACE.sm,
    borderRadius: RADIUS.md,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "transparent",
  },
  tabText: { fontSize: APPLE_TYPO.subhead.size, fontWeight: "600" },
  entryRow: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: LAYOUT.touchTarget,
    paddingVertical: SPACE.sm,
    gap: SPACE.md,
  },
  entryAvatar: {
    width: AVATAR_SIZE.md,
    height: AVATAR_SIZE.md,
    borderRadius: AVATAR_SIZE.md / 2,
    justifyContent: "center",
    alignItems: "center",
  },
  entryAvatarText: { fontSize: APPLE_TYPO.body.size, fontWeight: "700" },
  entryInfo: { flex: 1, gap: 2 },
  entryName: { fontSize: APPLE_TYPO.body.size, fontWeight: "600" },
  entryMeta: { fontSize: APPLE_TYPO.footnote.size },
  entryAmount: { fontSize: APPLE_TYPO.title3.size, fontWeight: "700" },
  entryActions: {
    flexDirection: "row",
    gap: SPACE.sm,
    paddingTop: SPACE.sm,
  },
  /** Filled primary — `colors.buttonPrimary` / `colors.buttonText` (black·white light, white·black dark). Matches Dashboard / Groups CTAs. */
  primaryCta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACE.sm,
    minHeight: BUTTON_SIZE.regular.height,
    paddingHorizontal: SPACE.xl,
    paddingVertical: SPACE.md,
    borderRadius: RADIUS.lg,
  },
  /** Inside expanded row — share width with sibling actions. */
  primaryCtaInRow: {
    flex: 1,
  },
  /** Standalone below list — full width; avoids `flex:1` stretching oddly in ScrollView. */
  primaryCtaFullWidth: {
    alignSelf: "stretch",
  },
  ctaDisabled: {
    opacity: 0.55,
  },
  divider: { height: StyleSheet.hairlineWidth },
  expandedBlock: {
    paddingBottom: SPACE.md,
  },
  offsetCallout: {
    borderWidth: 1,
    borderRadius: RADIUS.md,
    padding: SPACE.sm,
    marginBottom: SPACE.sm,
  },
  offsetCalloutTitle: {
    fontWeight: "600",
    fontSize: APPLE_TYPO.caption2.size,
  },
  offsetCalloutBody: {
    marginTop: SPACE.xs,
    lineHeight: 16,
  },
  gameRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: SPACE.sm,
    minHeight: LAYOUT.touchTarget,
  },
  gameRowText: { flex: 1, marginRight: SPACE.sm },
  gameTitle: { fontSize: APPLE_TYPO.subhead.size, fontWeight: "500" },
  gameDate: { fontSize: APPLE_TYPO.caption2.size, marginTop: 2 },
  gameAmount: {
    fontSize: APPLE_TYPO.caption.size,
    fontWeight: "700",
  },
  emptyContainer: { alignItems: "center", paddingVertical: SPACE.xxl, gap: SPACE.sm },
  emptyTitle: { fontSize: APPLE_TYPO.headline.size, fontWeight: "600" },
  emptySubtext: { fontSize: APPLE_TYPO.subhead.size, textAlign: "center", lineHeight: 22, paddingHorizontal: SPACE.md },
});
