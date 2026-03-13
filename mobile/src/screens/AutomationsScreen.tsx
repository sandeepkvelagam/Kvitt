import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Switch,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Animated,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useTheme } from "../context/ThemeContext";
import { useLanguage } from "../context/LanguageContext";
import { useAuth } from "../context/AuthContext";
import { api } from "../api/client";
import { BottomSheetScreen } from "../components/BottomSheetScreen";
import { PageHeader } from "../components/ui";
import { COLORS, ANIMATION } from "../styles/liquidGlass";
import { FONT, SPACE, LAYOUT, RADIUS } from "../styles/tokens";

// ── Types ─────────────────────────────────────────────────

type Automation = {
  automation_id: string;
  name: string;
  description?: string;
  trigger: { type: string; config?: any };
  actions: Array<{ type: string; params?: any }>;
  enabled: boolean;
  run_count?: number;
  error_count?: number;
  last_run?: string;
  health?: { status: string; score: number };
};

// ── Lookup Tables ─────────────────────────────────────────

const TRIGGER_META: Record<string, { emoji: string; label: string }> = {
  game_created: { emoji: "🎮", label: "Game Created" },
  game_ended: { emoji: "🏁", label: "Game Ended" },
  settlement_generated: { emoji: "💰", label: "Settlement Generated" },
  payment_due: { emoji: "💳", label: "Payment Due" },
  payment_overdue: { emoji: "⚠️", label: "Payment Overdue" },
  payment_received: { emoji: "✅", label: "Payment Received" },
  player_confirmed: { emoji: "👤", label: "Player Confirmed" },
  all_players_confirmed: { emoji: "👥", label: "All Confirmed" },
  schedule: { emoji: "🕐", label: "Scheduled" },
};

const ACTION_META: Record<string, string> = {
  send_notification: "Send Notification",
  send_email: "Send Email",
  send_payment_reminder: "Payment Reminder",
  auto_rsvp: "Auto-RSVP",
  create_game: "Create Game",
  generate_summary: "Generate Summary",
};

// Template data for creating automations via toggle
const AUTO_RSVP_TEMPLATE = {
  name: "Auto-RSVP to games",
  description: "Automatically confirm your attendance when a new game is created",
  trigger: { type: "game_created" },
  actions: [{ type: "auto_rsvp", params: { response: "confirmed" } }],
};

const PAYMENT_REMINDER_TEMPLATE = {
  name: "Payment reminder after 3 days",
  description: "Remind people who owe you if they haven't paid within 3 days",
  trigger: { type: "payment_overdue" },
  actions: [{ type: "send_payment_reminder", params: { urgency: "gentle" } }],
};

// ── Helpers ───────────────────────────────────────────────

const formatDate = (dateStr?: string) => {
  if (!dateStr) return "Never";
  const d = new Date(dateStr);
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

// ── Main Component ────────────────────────────────────────

export function AutomationsScreen() {
  const navigation = useNavigation();
  const { colors } = useTheme();
  const { t } = useLanguage();
  const { user } = useAuth();

  const [automations, setAutomations] = useState<Automation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 350, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, ...ANIMATION.spring.bouncy }),
    ]).start();
  }, []);

  useEffect(() => {
    fetchAutomations();
  }, []);

  const fetchAutomations = async (isRetry = false) => {
    try {
      const res = await api.get("/automations");
      setAutomations(res.data?.data?.automations || []);
      setError(false);
    } catch (err: any) {
      const status = err?.response?.status;
      if (!isRetry && !status) {
        setTimeout(() => fetchAutomations(true), 1000);
        return;
      }
      setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchAutomations();
  }, []);

  const findAutomationByAction = (actionType: string) =>
    automations.find(a => a.actions?.some(act => act.type === actionType));

  const autoRsvpAutomation = findAutomationByAction("auto_rsvp");
  const paymentReminderAutomation = findAutomationByAction("send_payment_reminder");

  // Quick toggle for Auto-RSVP / Payment Reminders
  const handleQuickToggle = async (
    type: "auto_rsvp" | "payment_reminder",
    currentAutomation: Automation | undefined,
    newValue: boolean,
  ) => {
    const toggleKey = type === "auto_rsvp" ? "rsvp" : "reminder";
    setTogglingId(toggleKey);
    try {
      if (!currentAutomation && newValue) {
        const template = type === "auto_rsvp" ? AUTO_RSVP_TEMPLATE : PAYMENT_REMINDER_TEMPLATE;
        await api.post("/automations", template);
      } else if (currentAutomation) {
        await api.post(`/automations/${currentAutomation.automation_id}/toggle`, { enabled: newValue });
      }
      await fetchAutomations();
    } catch (err: any) {
      const detail = err?.response?.data?.detail || err?.message || "Please try again.";
      Alert.alert("Update unavailable", detail);
    } finally {
      setTogglingId(null);
    }
  };

  // Toggle for automation cards
  const handleCardToggle = async (automationId: string, currentEnabled: boolean) => {
    setTogglingId(automationId);
    try {
      await api.post(`/automations/${automationId}/toggle`, { enabled: !currentEnabled });
      await fetchAutomations();
    } catch (err: any) {
      const detail = err?.response?.data?.detail || err?.message || "Please try again.";
      Alert.alert("Update unavailable", detail);
    } finally {
      setTogglingId(null);
    }
  };

  if (loading) {
    return (
      <BottomSheetScreen>
        <View style={[styles.loadingContainer, { backgroundColor: colors.contentBg }]}>
          <ActivityIndicator size="large" color={COLORS.orange} />
          <Text style={[styles.loadingText, { color: colors.textMuted }]}>
            Loading flows...
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
            title={t.nav.automations}
            subtitle="Automated workflows"
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
                <Text style={[styles.errorText, { color: COLORS.status.danger }]}>
                  Couldn't load your flows. Pull to retry.
                </Text>
              </View>
            )}

            {/* ── Quick Toggles ── */}
            <View style={[styles.toggleCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              {/* Auto-RSVP */}
              <View style={styles.toggleRow}>
                <View style={[styles.toggleIcon, { backgroundColor: COLORS.glass.glowOrange }]}>
                  <Text style={{ fontSize: 20 }}>🤚</Text>
                </View>
                <View style={styles.toggleBody}>
                  <Text style={[styles.toggleTitle, { color: colors.textPrimary }]}>
                    {t.automations.autoRsvp}
                  </Text>
                  <Text style={[styles.toggleDesc, { color: colors.textMuted }]}>
                    {t.automations.autoRsvpDesc}
                  </Text>
                </View>
                {togglingId === "rsvp" ? (
                  <ActivityIndicator size="small" color={COLORS.orange} />
                ) : (
                  <Switch
                    value={autoRsvpAutomation?.enabled ?? false}
                    onValueChange={(val) => handleQuickToggle("auto_rsvp", autoRsvpAutomation, val)}
                    trackColor={{ false: COLORS.glass.bg, true: COLORS.orange }}
                    thumbColor="#fff"
                  />
                )}
              </View>

              <View style={[styles.separator, { backgroundColor: colors.border }]} />

              {/* Payment Reminders */}
              <View style={styles.toggleRow}>
                <View style={[styles.toggleIcon, { backgroundColor: COLORS.glass.glowOrange }]}>
                  <Text style={{ fontSize: 20 }}>💸</Text>
                </View>
                <View style={styles.toggleBody}>
                  <Text style={[styles.toggleTitle, { color: colors.textPrimary }]}>
                    {t.automations.paymentReminders}
                  </Text>
                  <Text style={[styles.toggleDesc, { color: colors.textMuted }]}>
                    {t.automations.paymentRemindersDesc}
                  </Text>
                </View>
                {togglingId === "reminder" ? (
                  <ActivityIndicator size="small" color={COLORS.orange} />
                ) : (
                  <Switch
                    value={paymentReminderAutomation?.enabled ?? false}
                    onValueChange={(val) => handleQuickToggle("payment_reminder", paymentReminderAutomation, val)}
                    trackColor={{ false: COLORS.glass.bg, true: COLORS.orange }}
                    thumbColor="#fff"
                  />
                )}
              </View>
            </View>

            {/* ── Your Flows ── */}
            {automations.length > 0 && (
              <>
                <Text style={[styles.sectionLabel, { color: colors.moonstone }]}>YOUR FLOWS</Text>
                {automations.map((auto) => {
                  const triggerInfo = TRIGGER_META[auto.trigger?.type] || { emoji: "⚡", label: auto.trigger?.type };
                  return (
                    <View
                      key={auto.automation_id}
                      style={[
                        styles.card,
                        {
                          backgroundColor: colors.surface,
                          borderColor: colors.border,
                          opacity: auto.enabled ? 1 : 0.55,
                        },
                      ]}
                    >
                      {/* Card Header */}
                      <View style={styles.cardHeader}>
                        <View style={styles.cardTitleRow}>
                          <Text style={{ fontSize: 20 }}>{triggerInfo.emoji}</Text>
                          <Text
                            style={[styles.cardTitle, { color: colors.textPrimary }]}
                            numberOfLines={1}
                          >
                            {auto.name}
                          </Text>
                        </View>
                        <Switch
                          value={auto.enabled}
                          onValueChange={() => handleCardToggle(auto.automation_id, auto.enabled)}
                          trackColor={{ false: "rgba(0,0,0,0.1)", true: COLORS.orange }}
                          thumbColor="#fff"
                          disabled={togglingId === auto.automation_id}
                        />
                      </View>

                      {/* Description */}
                      {auto.description ? (
                        <Text
                          style={[styles.cardDescription, { color: colors.textSecondary }]}
                          numberOfLines={2}
                        >
                          {auto.description}
                        </Text>
                      ) : null}

                      {/* Trigger → Action badges */}
                      <View style={styles.badgeRow}>
                        <View style={[styles.badge, { backgroundColor: COLORS.orange + "12" }]}>
                          <Text style={[styles.badgeText, { color: COLORS.orange }]}>
                            {triggerInfo.label}
                          </Text>
                        </View>
                        <Ionicons name="arrow-forward" size={14} color={colors.textMuted} />
                        {auto.actions?.map((a, i) => (
                          <View key={i} style={[styles.badge, { backgroundColor: COLORS.trustBlue + "12" }]}>
                            <Text style={[styles.badgeText, { color: COLORS.trustBlue }]}>
                              {ACTION_META[a.type] || a.type}
                            </Text>
                          </View>
                        ))}
                      </View>

                      {/* Stats */}
                      {(auto.run_count || 0) > 0 && (
                        <Text style={[styles.statsText, { color: colors.textMuted }]}>
                          {auto.run_count} runs
                          {(auto.error_count || 0) > 0 ? ` · ${auto.error_count} errors` : ""}
                          {auto.last_run ? ` · Last: ${formatDate(auto.last_run)}` : ""}
                        </Text>
                      )}
                    </View>
                  );
                })}
              </>
            )}

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
    padding: SPACE.md,
    borderRadius: 16,
    borderWidth: 1,
    gap: 10,
    marginBottom: 16,
  },
  errorText: { fontSize: FONT.secondary.size, flex: 1 },

  // Quick toggle card
  toggleCard: { borderRadius: 16, borderWidth: 1, overflow: "hidden" },
  toggleRow: { flexDirection: "row", alignItems: "flex-start", gap: SPACE.md, padding: 16 },
  toggleIcon: { width: 40, height: 40, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  toggleBody: { flex: 1 },
  toggleTitle: { fontSize: 16, fontWeight: "600", marginBottom: 4 },
  toggleDesc: { fontSize: FONT.secondary.size, lineHeight: 18 },
  separator: { height: 1 },

  // Section label
  sectionLabel: {
    fontSize: 11, fontWeight: "600", letterSpacing: 1,
    marginTop: 24, marginBottom: 10, textTransform: "uppercase",
  },

  // Automation cards
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  cardTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
    marginRight: 8,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "600",
    flex: 1,
  },
  cardDescription: {
    fontSize: FONT.secondary.size,
    marginBottom: 8,
    lineHeight: 18,
  },
  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
    marginTop: 4,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "600",
  },
  statsText: {
    fontSize: 11,
    marginTop: 8,
  },
});

export default AutomationsScreen;
