import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  Switch,
  ActivityIndicator,
  StyleSheet,
  Alert,
  Pressable,
} from "react-native";
import Animated, {
  FadeInDown,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { GlassBottomSheet } from "./ui/GlassModal";
import { GlassListSection, GlassListDivider } from "./ui/GlassListItem";
import { COLORS, TYPOGRAPHY, SPACING, RADIUS, SPRINGS } from "../styles/liquidGlass";
import { getGroupAISettings, updateGroupAISettings } from "../api/groupMessages";
import { useLanguage } from "../context/LanguageContext";
import { KvittOrbMark } from "./ui/KvittOrbMark";

type Props = {
  visible: boolean;
  onClose: () => void;
  groupId: string;
  isAdmin: boolean;
};

type GroupAISettingsState = {
  ai_enabled: boolean;
  auto_suggest_games: boolean;
  respond_to_chat: boolean;
  weather_alerts: boolean;
  holiday_alerts: boolean;
  smart_scheduling: boolean;
  auto_poll_suggestions: boolean;
  chat_summaries: boolean;
  safety_filters: boolean;
  max_messages_per_hour: number;
};

type BooleanSettingKey = Exclude<keyof GroupAISettingsState, "max_messages_per_hour">;

const DEFAULT_SETTINGS: GroupAISettingsState = {
  ai_enabled: true,
  auto_suggest_games: true,
  respond_to_chat: true,
  weather_alerts: true,
  holiday_alerts: true,
  smart_scheduling: true,
  auto_poll_suggestions: true,
  chat_summaries: true,
  safety_filters: true,
  max_messages_per_hour: 5,
};

const MAX_RATE_MIN = 0;
const MAX_RATE_MAX = 50;

const TOGGLE_CONFIG: {
  key: BooleanSettingKey;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  description: string;
  color: string;
}[] = [
  {
    key: "ai_enabled",
    icon: "sparkles",
    label: "",
    description:
      "Kvitt helps schedule games, run polls, summarize decisions, and keep plans on track.",
    color: "#EE6C29",
  },
  {
    key: "auto_suggest_games",
    icon: "game-controller-outline",
    label: "Auto Suggest Games",
    description: "Proactively suggest games when the group is planning.",
    color: "#A855F7",
  },
  {
    key: "respond_to_chat",
    icon: "chatbubbles-outline",
    label: "Respond in Chat",
    description: "Kvitt can reply in the group chat when relevant.",
    color: "#06B6D4",
  },
  {
    key: "weather_alerts",
    icon: "partly-sunny-outline",
    label: "Weather Alerts",
    description: "Mention weather-based game opportunities.",
    color: "#38BDF8",
  },
  {
    key: "holiday_alerts",
    icon: "gift-outline",
    label: "Holiday Alerts",
    description: "Mention holiday-based game opportunities.",
    color: "#EC4899",
  },
  {
    key: "smart_scheduling",
    icon: "calendar",
    label: "Smart Scheduling",
    description: "Detects availability talk and offers time suggestions & polls.",
    color: "#3B82F6",
  },
  {
    key: "auto_poll_suggestions",
    icon: "bar-chart",
    label: "Auto Poll Suggestions",
    description: "When the group debates dates, Kvitt recommends a quick poll.",
    color: "#7AA6B3",
  },
  {
    key: "chat_summaries",
    icon: "document-text",
    label: "Chat Summaries",
    description: "Kvitt posts brief recaps after busy threads.",
    color: "#22C55E",
  },
  {
    key: "safety_filters",
    icon: "shield-checkmark",
    label: "Safety Filters",
    description: "Blocks offensive content and de-escalates conflicts.",
    color: "#F59E0B",
  },
];

function mapApiToState(data: Record<string, unknown>): GroupAISettingsState {
  return {
    ai_enabled: (data.ai_enabled as boolean) ?? DEFAULT_SETTINGS.ai_enabled,
    auto_suggest_games: (data.auto_suggest_games as boolean) ?? DEFAULT_SETTINGS.auto_suggest_games,
    respond_to_chat: (data.respond_to_chat as boolean) ?? DEFAULT_SETTINGS.respond_to_chat,
    weather_alerts: (data.weather_alerts as boolean) ?? DEFAULT_SETTINGS.weather_alerts,
    holiday_alerts: (data.holiday_alerts as boolean) ?? DEFAULT_SETTINGS.holiday_alerts,
    smart_scheduling: (data.smart_scheduling as boolean) ?? DEFAULT_SETTINGS.smart_scheduling,
    auto_poll_suggestions:
      (data.auto_poll_suggestions as boolean) ?? DEFAULT_SETTINGS.auto_poll_suggestions,
    chat_summaries: (data.chat_summaries as boolean) ?? DEFAULT_SETTINGS.chat_summaries,
    safety_filters: (data.safety_filters as boolean) ?? DEFAULT_SETTINGS.safety_filters,
    max_messages_per_hour: Math.max(
      MAX_RATE_MIN,
      Math.min(
        MAX_RATE_MAX,
        Number(data.max_messages_per_hour ?? DEFAULT_SETTINGS.max_messages_per_hour)
      )
    ),
  };
}

export function GroupChatSettingsSheet({ visible, onClose, groupId, isAdmin }: Props) {
  const { t } = useLanguage();
  const [settings, setSettings] = useState<GroupAISettingsState>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      loadSettings();
    }
  }, [visible, groupId]);

  async function loadSettings() {
    try {
      setLoading(true);
      const data = await getGroupAISettings(groupId);
      setSettings(mapApiToState(data));
    } catch {
      // Keep defaults on error
    } finally {
      setLoading(false);
    }
  }

  async function handleToggle(key: BooleanSettingKey, value: boolean) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    if (key === "ai_enabled" && !value) {
      Alert.alert(
        "Disable Kvitt AI",
        "Do you want to disable Kvitt AI for this group?",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Disable",
            style: "destructive",
            onPress: () => saveToggle("ai_enabled", false),
          },
        ]
      );
      return;
    }

    await saveToggle(key, value);
  }

  async function saveToggle(key: BooleanSettingKey, value: boolean) {
    const prev = settings[key];
    setSettings((s) => ({ ...s, [key]: value }));
    setSaving(key);
    try {
      await updateGroupAISettings(groupId, { [key]: value });
    } catch {
      setSettings((s) => ({ ...s, [key]: prev }));
      Alert.alert("Error", "Failed to update setting. Please try again.");
    } finally {
      setSaving(null);
    }
  }

  async function adjustMaxRate(delta: number) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const next = Math.max(
      MAX_RATE_MIN,
      Math.min(MAX_RATE_MAX, settings.max_messages_per_hour + delta)
    );
    if (next === settings.max_messages_per_hour) return;
    await saveMaxRate(next);
  }

  async function saveMaxRate(value: number) {
    const clamped = Math.max(MAX_RATE_MIN, Math.min(MAX_RATE_MAX, Math.round(value)));
    const prev = settings.max_messages_per_hour;
    setSettings((s) => ({ ...s, max_messages_per_hour: clamped }));
    setSaving("max_messages_per_hour");
    try {
      await updateGroupAISettings(groupId, { max_messages_per_hour: clamped });
    } catch {
      setSettings((s) => ({ ...s, max_messages_per_hour: prev }));
      Alert.alert("Error", "Failed to update setting. Please try again.");
    } finally {
      setSaving(null);
    }
  }

  const rateDisabled = !isAdmin || !settings.ai_enabled;

  return (
      <GlassBottomSheet visible={visible} onClose={onClose} title="Chat Settings">
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={COLORS.trustBlue} />
          </View>
        ) : (
          <>
            <View style={styles.statusRow}>
              <KvittOrbMark size={24} variant="messaging" />
              <View
                style={[
                  styles.statusDot,
                  { backgroundColor: settings.ai_enabled ? COLORS.status.success : COLORS.status.danger },
                ]}
              />
              <Text
                style={[
                  styles.statusText,
                  { color: settings.ai_enabled ? COLORS.moonstone : COLORS.text.muted },
                ]}
              >
                {settings.ai_enabled ? "Kvitt is active" : "Kvitt is disabled"}
              </Text>
            </View>

            <GlassListSection title="KVITT AI">
              {TOGGLE_CONFIG.map((toggle, idx) => {
                const displayLabel = toggle.key === "ai_enabled" ? t.ai.title : toggle.label;
                const isSubToggle = toggle.key !== "ai_enabled";
                const disabled = !isAdmin || (isSubToggle && !settings.ai_enabled);

                return (
                  <React.Fragment key={toggle.key}>
                    <Animated.View
                      entering={FadeInDown.delay(idx * 40)
                        .springify()
                        .damping(SPRINGS.layout.damping)}
                      style={[
                        styles.toggleRow,
                        disabled && isSubToggle && styles.toggleRowDisabled,
                      ]}
                    >
                      <View style={[styles.toggleIcon, { backgroundColor: toggle.color + "18" }]}>
                        <Ionicons name={toggle.icon} size={18} color={toggle.color} />
                      </View>
                      <View style={styles.toggleBody}>
                        <Text style={styles.toggleLabel}>{displayLabel}</Text>
                        <Text style={styles.toggleDesc}>{toggle.description}</Text>
                        {!isAdmin && (
                          <Text style={styles.adminOnly}>Admin only</Text>
                        )}
                      </View>
                      {saving === toggle.key ? (
                        <ActivityIndicator size="small" color={COLORS.trustBlue} />
                      ) : (
                        <Switch
                          value={settings[toggle.key]}
                          onValueChange={(val) => handleToggle(toggle.key, val)}
                          disabled={disabled}
                          trackColor={{ false: "rgba(255,255,255,0.1)", true: COLORS.orange }}
                          thumbColor="#fff"
                        />
                      )}
                    </Animated.View>
                    {idx < TOGGLE_CONFIG.length - 1 && <GlassListDivider />}
                  </React.Fragment>
                );
              })}
              <GlassListDivider />
              <Animated.View
                entering={FadeInDown.delay(TOGGLE_CONFIG.length * 40)
                  .springify()
                  .damping(SPRINGS.layout.damping)}
                style={[
                  styles.toggleRow,
                  rateDisabled && styles.toggleRowDisabled,
                ]}
              >
                <View style={[styles.toggleIcon, { backgroundColor: "#6366F118" }]}>
                  <Ionicons name="speedometer-outline" size={18} color="#6366F1" />
                </View>
                <View style={styles.toggleBody}>
                  <Text style={styles.toggleLabel}>Max AI messages / hour</Text>
                  <Text style={styles.toggleDesc}>
                    Rate limit for Kvitt messages in this group ({MAX_RATE_MIN}–{MAX_RATE_MAX}).
                  </Text>
                  {!isAdmin && (
                    <Text style={styles.adminOnly}>Admin only</Text>
                  )}
                </View>
                <View style={styles.rateStepper}>
                  <Pressable
                    onPress={() => adjustMaxRate(-1)}
                    disabled={rateDisabled || saving === "max_messages_per_hour"}
                    style={({ pressed }) => [
                      styles.rateStepBtn,
                      (rateDisabled || pressed) && { opacity: rateDisabled ? 0.4 : 0.7 },
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel="Decrease max messages per hour"
                  >
                    <Ionicons name="remove" size={20} color={COLORS.text.primary} />
                  </Pressable>
                  {saving === "max_messages_per_hour" ? (
                    <ActivityIndicator size="small" color={COLORS.trustBlue} style={styles.rateValue} />
                  ) : (
                    <Text style={styles.rateValue}>{settings.max_messages_per_hour}</Text>
                  )}
                  <Pressable
                    onPress={() => adjustMaxRate(1)}
                    disabled={rateDisabled || saving === "max_messages_per_hour"}
                    style={({ pressed }) => [
                      styles.rateStepBtn,
                      (rateDisabled || pressed) && { opacity: rateDisabled ? 0.4 : 0.7 },
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel="Increase max messages per hour"
                  >
                    <Ionicons name="add" size={20} color={COLORS.text.primary} />
                  </Pressable>
                </View>
              </Animated.View>
            </GlassListSection>

            <View style={{ height: SPACING.xl }} />
          </>
        )}
      </GlassBottomSheet>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    paddingVertical: 60,
    alignItems: "center",
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: TYPOGRAPHY.sizes.caption,
    fontWeight: TYPOGRAPHY.weights.medium,
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: SPACING.lg,
    gap: SPACING.md,
  },
  toggleRowDisabled: {
    opacity: 0.5,
  },
  toggleIcon: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.md,
    alignItems: "center",
    justifyContent: "center",
  },
  toggleBody: {
    flex: 1,
    minWidth: 0,
  },
  toggleLabel: {
    fontSize: TYPOGRAPHY.sizes.bodySmall,
    fontWeight: TYPOGRAPHY.weights.semiBold,
    color: COLORS.text.primary,
    marginBottom: 2,
  },
  toggleDesc: {
    fontSize: TYPOGRAPHY.sizes.caption,
    lineHeight: 16,
    color: COLORS.text.muted,
  },
  adminOnly: {
    fontSize: TYPOGRAPHY.sizes.micro,
    fontStyle: "italic",
    marginTop: 2,
    color: COLORS.text.muted,
  },
  rateStepper: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
  },
  rateStepBtn: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.md,
    backgroundColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  rateValue: {
    minWidth: 28,
    textAlign: "center",
    fontSize: TYPOGRAPHY.sizes.bodySmall,
    fontWeight: TYPOGRAPHY.weights.semiBold,
    color: COLORS.text.primary,
  },
});
