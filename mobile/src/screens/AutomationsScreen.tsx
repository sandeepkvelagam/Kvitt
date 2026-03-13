import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Switch,
  Alert,
  ActivityIndicator,
  Animated,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useTheme } from "../context/ThemeContext";
import { useLanguage } from "../context/LanguageContext";
import { useAuth } from "../context/AuthContext";
import { api } from "../api/client";
import { COLORS, ANIMATION } from "../styles/liquidGlass";
import { PageHeader } from "../components/ui";
import { BottomSheetScreen } from "../components/BottomSheetScreen";

type Automation = {
  automation_id: string;
  name: string;
  description?: string;
  trigger: { type: string; config?: any };
  actions: Array<{ type: string; params?: any }>;
  enabled: boolean;
};

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

export function AutomationsScreen() {
  const navigation = useNavigation();
  const { colors } = useTheme();
  const { t } = useLanguage();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [autoRsvp, setAutoRsvp] = useState<Automation | null>(null);
  const [paymentReminder, setPaymentReminder] = useState<Automation | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 350, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, ...ANIMATION.spring.bouncy }),
    ]).start();
    fetchAutomations();
  }, []);

  const fetchAutomations = async () => {
    try {
      const res = await api.get("/automations");
      const automations: Automation[] = res.data?.data?.automations || [];
      const rsvp = automations.find(a => a.actions?.some(act => act.type === "auto_rsvp")) || null;
      const reminder = automations.find(a => a.actions?.some(act => act.type === "send_payment_reminder")) || null;
      setAutoRsvp(rsvp);
      setPaymentReminder(reminder);
      setError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (
    type: "auto_rsvp" | "payment_reminder",
    currentAutomation: Automation | null,
    newValue: boolean,
  ) => {
    const id = currentAutomation?.automation_id;
    const toggleKey = type === "auto_rsvp" ? "rsvp" : "reminder";
    setTogglingId(toggleKey);

    try {
      if (!currentAutomation && newValue) {
        // Create new automation
        const template = type === "auto_rsvp" ? AUTO_RSVP_TEMPLATE : PAYMENT_REMINDER_TEMPLATE;
        await api.post("/automations", template);
      } else if (currentAutomation) {
        // Toggle existing
        await api.post(`/automations/${id}/toggle`, { enabled: newValue });
      }
      await fetchAutomations();
    } catch {
      Alert.alert("Update unavailable", "Please try again.");
    } finally {
      setTogglingId(null);
    }
  };

  const autoRsvpEnabled = autoRsvp?.enabled ?? false;
  const paymentReminderEnabled = paymentReminder?.enabled ?? false;

  return (
    <BottomSheetScreen>
      <View style={[styles.container, { backgroundColor: colors.contentBg }]}>
        <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
          <PageHeader
            title={t.nav.automations}
            subtitle="Automate your workflows"
            onClose={() => navigation.goBack()}
          />
        </Animated.View>

        <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>

            {loading && (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={COLORS.orange} />
              </View>
            )}

            {!loading && error && (
              <View style={styles.loadingContainer}>
                <Ionicons name="cloud-offline-outline" size={32} color={colors.textMuted} />
                <Text style={[styles.errorText, { color: colors.textMuted }]}>
                  Can't load your flows right now
                </Text>
              </View>
            )}

            {!loading && !error && (
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
                      value={autoRsvpEnabled}
                      onValueChange={(val) => handleToggle("auto_rsvp", autoRsvp, val)}
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
                      value={paymentReminderEnabled}
                      onValueChange={(val) => handleToggle("payment_reminder", paymentReminder, val)}
                      trackColor={{ false: COLORS.glass.bg, true: COLORS.orange }}
                      thumbColor="#fff"
                    />
                  )}
                </View>
              </View>
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
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 48,
    gap: 12,
  },
  errorText: { fontSize: 15, marginTop: 8 },
  card: { borderRadius: 20, borderWidth: 1, overflow: "hidden" },
  toggleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 14,
    padding: 16,
  },
  toggleIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  toggleBody: { flex: 1 },
  toggleTitle: { fontSize: 15, fontWeight: "600", marginBottom: 4 },
  toggleDesc: { fontSize: 13, lineHeight: 18 },
  separator: { height: 1 },
});

export default AutomationsScreen;
