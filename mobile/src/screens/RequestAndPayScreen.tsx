import React, { useCallback, useEffect, useState, useRef } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Linking,
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
import { useAuth } from "../context/AuthContext";
import { COLORS, ANIMATION } from "../styles/liquidGlass";
import { PageHeader } from "../components/ui";
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

export function RequestAndPayScreen() {
  const { colors } = useTheme();
  const { t } = useLanguage();
  const { user } = useAuth();
  const navigation = useNavigation<Nav>();

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

  const activeList = activeTab === "owed" ? owedToYou : youOwe;

  if (loading) {
    return (
      <BottomSheetScreen>
        <View style={[styles.loadingContainer, { backgroundColor: colors.contentBg }]}>
          <ActivityIndicator size="large" color={COLORS.orange} />
          <Text style={[styles.loadingText, { color: colors.textMuted }]}>
            Loading balances...
          </Text>
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
            subtitle="Balances & payments"
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
              tintColor={COLORS.orange}
            />
          }
        >
          <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>

            {error && (
              <View style={[styles.errorBanner, { borderColor: "rgba(239,68,68,0.3)" }]}>
                <Ionicons name="alert-circle" size={16} color={COLORS.status.danger} />
                <Text style={[styles.errorText, { color: COLORS.status.danger }]}>{error}</Text>
              </View>
            )}

            {/* ── Balances ── */}
            <Text style={[styles.sectionLabel, { color: colors.moonstone, marginTop: 0 }]}>BALANCES</Text>
            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, marginBottom: 8 }]}>
              <Text style={[styles.cardSectionTitle, { color: colors.moonstone }]}>
                NET BALANCE
              </Text>
              <View style={styles.balanceRow}>
                <View style={styles.balanceItem}>
                  <Ionicons name="arrow-up-outline" size={18} color={COLORS.status.danger} />
                  <Text style={[styles.balanceLabel, { color: colors.textMuted }]}>
                    You Owe
                  </Text>
                  <Text style={[styles.balanceValue, { color: COLORS.status.danger }]}>
                    ${totalOwes.toFixed(2)}
                  </Text>
                </View>
                <View style={[styles.balanceDivider, { backgroundColor: colors.border }]} />
                <View style={styles.balanceItem}>
                  <Ionicons name="arrow-down-outline" size={18} color={COLORS.status.success} />
                  <Text style={[styles.balanceLabel, { color: colors.textMuted }]}>
                    Owed to You
                  </Text>
                  <Text style={[styles.balanceValue, { color: COLORS.status.success }]}>
                    ${totalOwed.toFixed(2)}
                  </Text>
                </View>
              </View>
              <View
                style={[
                  styles.netRow,
                  {
                    backgroundColor: netBalance >= 0 ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)",
                    borderColor: netBalance >= 0 ? "rgba(34,197,94,0.25)" : "rgba(239,68,68,0.25)",
                  },
                ]}
              >
                <Text style={[styles.netLabel, { color: colors.textMuted }]}>NET</Text>
                <Text style={[styles.netValue, { color: netBalance >= 0 ? COLORS.status.success : COLORS.status.danger }]}>
                  {netBalance >= 0 ? "+" : ""}${netBalance.toFixed(2)}
                </Text>
              </View>
            </View>

            {/* ── Transactions ── */}
            <Text style={[styles.sectionLabel, { color: colors.moonstone }]}>TRANSACTIONS</Text>
            <View style={[styles.tabRow, { backgroundColor: colors.surface, borderColor: colors.border, marginBottom: 12 }]}>
              <TouchableOpacity
                style={[
                  styles.tab,
                  activeTab === "owed" && {
                    backgroundColor: COLORS.status.success + "20",
                    borderColor: COLORS.status.success + "40",
                  },
                ]}
                onPress={() => setActiveTab("owed")}
                activeOpacity={0.7}
              >
                <Text style={[styles.tabText, { color: activeTab === "owed" ? COLORS.status.success : colors.textMuted }]}>
                  Owed to You ({owedToYou.length})
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.tab,
                  activeTab === "owes" && {
                    backgroundColor: COLORS.status.danger + "20",
                    borderColor: COLORS.status.danger + "40",
                  },
                ]}
                onPress={() => setActiveTab("owes")}
                activeOpacity={0.7}
              >
                <Text style={[styles.tabText, { color: activeTab === "owes" ? COLORS.status.danger : colors.textMuted }]}>
                  You Owe ({youOwe.length})
                </Text>
              </TouchableOpacity>
            </View>

            {/* Entries List */}
            <View
              style={[
                styles.card,
                {
                  backgroundColor: colors.surface,
                  borderColor: activeTab === "owed" ? "rgba(34,197,94,0.25)" : "rgba(239,68,68,0.25)",
                  marginBottom: 16,
                  paddingHorizontal: 16,
                  paddingVertical: 4,
                },
              ]}
            >
              {activeList.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Ionicons
                    name={activeTab === "owed" ? "checkmark-circle-outline" : "wallet-outline"}
                    size={48}
                    color={colors.textMuted}
                  />
                  <Text style={[styles.emptyTitle, { color: colors.textSecondary }]}>
                    {activeTab === "owed" ? "No one owes you" : "You don't owe anyone"}
                  </Text>
                  <Text style={[styles.emptySubtext, { color: colors.textMuted }]}>
                    {activeTab === "owed"
                      ? "Outstanding debts owed to you will appear here"
                      : "Your outstanding debts will appear here"}
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
                      >
                        <View
                          style={[
                            styles.entryAvatar,
                            {
                              backgroundColor:
                                activeTab === "owed" ? "rgba(239,68,68,0.15)" : "rgba(59,130,246,0.15)",
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.entryAvatarText,
                              { color: activeTab === "owed" ? COLORS.status.danger : COLORS.trustBlue },
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
                            { color: activeTab === "owed" ? COLORS.status.success : COLORS.status.danger },
                          ]}
                        >
                          ${person.display_amount.toFixed(2)}
                        </Text>
                        <Ionicons name={isExpanded ? "chevron-up" : "chevron-down"} size={16} color={colors.textMuted} />
                      </TouchableOpacity>

                      {isExpanded && (
                        <View style={{ paddingLeft: 52, paddingBottom: 12 }}>
                          {person.offset_explanation && (
                            <View style={{ backgroundColor: "rgba(245,158,11,0.1)", borderColor: "rgba(245,158,11,0.25)", borderWidth: 1, borderRadius: 10, padding: 10, marginBottom: 8 }}>
                              <Text style={{ color: "#f59e0b", fontWeight: "600", fontSize: 11 }}>Auto-netted across {person.game_count} games</Text>
                              <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 3 }}>
                                You owed ${person.offset_explanation.gross_you_owe.toFixed(2)} {"\u00b7"} They owed ${person.offset_explanation.gross_they_owe.toFixed(2)} {"\u00b7"} Offset ${person.offset_explanation.offset_amount.toFixed(2)}
                              </Text>
                            </View>
                          )}

                          {person.game_breakdown?.map((game, gi) => (
                            <View key={game.game_id || gi} style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 6 }}>
                              <View style={{ flex: 1, marginRight: 8 }}>
                                <Text style={{ color: colors.textPrimary, fontSize: 12, fontWeight: "500" }}>{game.game_title}</Text>
                                <Text style={{ color: colors.textMuted, fontSize: 11 }}>
                                  {game.game_date ? new Date(game.game_date).toLocaleDateString() : "Recent"}
                                </Text>
                              </View>
                              <Text style={{ fontVariant: ["tabular-nums"], fontWeight: "700", fontSize: 12, color: game.direction === "you_owe" ? COLORS.status.danger : COLORS.status.success }}>
                                {game.direction === "you_owe" ? "-" : "+"}${game.amount.toFixed(2)}
                              </Text>
                            </View>
                          ))}

                          <View style={styles.entryActions}>
                            {activeTab === "owed" ? (
                              <TouchableOpacity
                                style={[styles.actionButton, { backgroundColor: COLORS.orange }]}
                                onPress={() => handleRequestPayment(person)}
                                disabled={requestingPayment === person.user.user_id}
                                activeOpacity={0.7}
                              >
                                {requestingPayment === person.user.user_id ? (
                                  <ActivityIndicator size="small" color="#fff" />
                                ) : (
                                  <>
                                    <Ionicons name="notifications-outline" size={14} color="#fff" />
                                    <Text style={styles.actionButtonText}>Request ${person.display_amount.toFixed(0)}</Text>
                                  </>
                                )}
                              </TouchableOpacity>
                            ) : (
                              <TouchableOpacity
                                style={[styles.actionButton, { backgroundColor: "#635bff" }]}
                                onPress={() => handlePayNet(person)}
                                disabled={payingUserId === person.user.user_id}
                                activeOpacity={0.7}
                              >
                                {payingUserId === person.user.user_id ? (
                                  <ActivityIndicator size="small" color="#fff" />
                                ) : (
                                  <>
                                    <Ionicons name="card-outline" size={14} color="#fff" />
                                    <Text style={styles.actionButtonText}>Pay Net ${person.display_amount.toFixed(0)}</Text>
                                  </>
                                )}
                              </TouchableOpacity>
                            )}
                          </View>
                        </View>
                      )}

                      {idx < activeList.length - 1 && (
                        <View style={[styles.divider, { backgroundColor: colors.border }]} />
                      )}
                    </View>
                  );
                })
              )}
            </View>

            {/* Send Money via Wallet */}
            <TouchableOpacity
              style={[
                styles.sendMoneyButton,
                {
                  backgroundColor: colors.surface,
                  borderColor: COLORS.trustBlue + "40",
                  marginTop: 8,
                },
              ]}
              onPress={() => navigation.navigate("Wallet")}
              activeOpacity={0.8}
            >
              <Ionicons name="send-outline" size={18} color={COLORS.trustBlue} />
              <Text style={[styles.sendMoneyText, { color: COLORS.trustBlue }]}>
                Send Money via Wallet
              </Text>
              <Ionicons name="chevron-forward" size={14} color={COLORS.trustBlue} />
            </TouchableOpacity>

          </Animated.View>
          <View style={{ height: 50 }} />
        </ScrollView>
      </View>
    </BottomSheetScreen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flex: 1 },
  content: { padding: 20, paddingBottom: 32 },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 16,
  },
  loadingText: { fontSize: 16 },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(239,68,68,0.1)",
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    gap: 10,
    marginBottom: 8,
  },
  errorText: { fontSize: 14, flex: 1 },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    overflow: "hidden",
  },
  sectionLabel: {
    fontSize: 11, fontWeight: "600", letterSpacing: 1,
    marginTop: 24, marginBottom: 10, textTransform: "uppercase",
  },
  cardSectionTitle: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1,
    marginBottom: 12,
  },
  balanceRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    paddingTop: 12,
  },
  balanceItem: { alignItems: "center", gap: 4, flex: 1 },
  balanceDivider: { width: 1, height: 44 },
  balanceLabel: { fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5 },
  balanceValue: { fontSize: 18, fontWeight: "700" },
  netRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    marginTop: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  netLabel: { fontSize: 12, fontWeight: "600", letterSpacing: 1 },
  netValue: { fontSize: 18, fontWeight: "700" },
  tabRow: {
    flexDirection: "row",
    borderRadius: 16,
    padding: 4,
    borderWidth: 1,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "transparent",
  },
  tabText: { fontSize: 14, fontWeight: "600" },
  entryRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    gap: 12,
  },
  entryAvatar: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  entryAvatarText: { fontSize: 16, fontWeight: "700" },
  entryInfo: { flex: 1, gap: 3 },
  entryName: { fontSize: 14, fontWeight: "600" },
  entryMeta: { fontSize: 12 },
  entryAmount: { fontSize: 18, fontWeight: "700" },
  entryActions: {
    flexDirection: "row",
    gap: 8,
    paddingTop: 8,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    flex: 1,
  },
  actionButtonText: { color: "#fff", fontSize: 12, fontWeight: "600" },
  divider: { height: 1, marginLeft: 52 },
  emptyContainer: { alignItems: "center", paddingVertical: 32, gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: "600" },
  emptySubtext: { fontSize: 14, textAlign: "center" },
  sendMoneyButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  sendMoneyText: { fontSize: 14, fontWeight: "600" },
});
