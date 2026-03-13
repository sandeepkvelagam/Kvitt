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

// ── Types ─────────────────────────────────────────────────

type Automation = {
  automation_id: string;
  name: string;
  description?: string;
  trigger: { type: string; config?: any };
  actions: Array<{ type: string; params?: any }>;
  enabled: boolean;
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

  const handleToggle = async (
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
    } catch {
      Alert.alert("Update unavailable", "Please try again.");
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

            {/* ── Toggle Card ── */}
            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
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
                    onValueChange={(val) => handleToggle("auto_rsvp", autoRsvpAutomation, val)}
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
                    onValueChange={(val) => handleToggle("payment_reminder", paymentReminderAutomation, val)}
                    trackColor={{ false: COLORS.glass.bg, true: COLORS.orange }}
                    thumbColor="#fff"
                  />
                )}
              </View>
            </View>

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
    marginBottom: 16,
  },
  errorText: { fontSize: 14, flex: 1 },
  card: { borderRadius: 16, borderWidth: 1, overflow: "hidden" },
  toggleRow: { flexDirection: "row", alignItems: "flex-start", gap: 14, padding: 16 },
  toggleIcon: { width: 40, height: 40, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  toggleBody: { flex: 1 },
  toggleTitle: { fontSize: 16, fontWeight: "600", marginBottom: 4 },
  toggleDesc: { fontSize: 14, lineHeight: 18 },
  separator: { height: 1 },
});

export default AutomationsScreen;
