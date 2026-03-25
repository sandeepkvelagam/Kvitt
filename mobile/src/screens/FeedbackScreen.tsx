import React, { useState, useCallback, useEffect, useMemo } from "react";
import {
  View,
  Text,
  TextInput,
  ScrollView,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Pressable,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolateColor,
  FadeInDown,
  FadeIn,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useTheme } from "../context/ThemeContext";
import { useLanguage } from "../context/LanguageContext";
import { useAuth } from "../context/AuthContext";
import { useHaptics } from "../context/HapticsContext";
import { api } from "../api/client";
import { BottomSheetScreen } from "../components/BottomSheetScreen";
import { StarRating } from "../components/ui/StarRating";
import { COLORS, TYPOGRAPHY, SPACING, SHADOWS } from "../styles/liquidGlass";
import { LAYOUT, RADIUS, BUTTON_SIZE } from "../styles/tokens";
import { appleCardShadowResting } from "../styles/appleShadows";

// ── Copy map ─────────────────────────────────────────────────────────

const COPY = {
  header: {
    title: "Report an Issue",
    subtitle: "Every submission is reviewed by our team.",
  },
  type: {
    label: "CATEGORY",
    helper: "Select the option that best reflects your experience.",
  },
  details: {
    label: "DETAILS",
    helper: "Include steps to reproduce, expected behavior, and what occurred.",
  },
  severity: {
    label: "IMPACT",
    helper: "Rate the impact on your experience.",
  },
  submit: {
    button: "Submit Report",
    disclaimer: "Your report is linked to your account for follow-up.",
  },
  success: {
    title: "Thank You",
    body: "We've logged your report and routed it for review. If we need clarification, we'll reach out.",
    bodyPraise: "We appreciate the kind words — it means a lot to our team.",
    ticketLabel: "Reference ID",
    done: "Done",
  },
  errors: {
    noType: { title: "Select a category", msg: "Choose the type of feedback." },
    noContent: { title: "Add details", msg: "Please add a brief description before submitting." },
    generic: "We couldn't submit your report at this time. Please try again in a moment.",
  },
};

const MAX_CONTENT_LENGTH = 1000;
const MAX_REPLY_LENGTH = 2000;

const FEEDBACK_TYPES = [
  { key: "bug", label: "Bug Report", icon: "bug-outline" as const, color: COLORS.status.danger },
  { key: "feature_request", label: "Feature Request", icon: "bulb-outline" as const, color: COLORS.status.warning },
  { key: "ux_issue", label: "UX Issue", icon: "hand-left-outline" as const, color: COLORS.trustBlue },
  { key: "complaint", label: "Complaint", icon: "sad-outline" as const, color: "#9333EA" },
  { key: "praise", label: "Praise", icon: "heart-outline" as const, color: COLORS.status.success },
  { key: "other", label: "Other", icon: "chatbox-outline" as const, color: COLORS.moonstone },
];

const TYPE_META: Record<string, { label: string; icon: keyof typeof Ionicons.glyphMap; color: string }> = {
  bug: { label: "Bug", icon: "bug-outline", color: COLORS.status.danger },
  feature_request: { label: "Feature", icon: "bulb-outline", color: COLORS.status.warning },
  ux_issue: { label: "UX Issue", icon: "hand-left-outline", color: COLORS.trustBlue },
  complaint: { label: "Complaint", icon: "sad-outline", color: "#9333EA" },
  praise: { label: "Praise", icon: "heart-outline", color: COLORS.status.success },
  other: { label: "Other", icon: "chatbox-outline", color: COLORS.moonstone },
};

const STATUS_META: Record<string, { label: string; color: string }> = {
  new: { label: "New", color: COLORS.trustBlue },
  open: { label: "Open", color: COLORS.trustBlue },
  classified: { label: "Classified", color: "#6366F1" },
  in_progress: { label: "In Progress", color: COLORS.status.warning },
  needs_user_info: { label: "Needs Info", color: "#F97316" },
  needs_host_action: { label: "Needs Host", color: "#F97316" },
  auto_fixed: { label: "Auto Fixed", color: "#06B6D4" },
  resolved: { label: "Resolved", color: COLORS.status.success },
  wont_fix: { label: "Won't Fix", color: COLORS.text.muted },
  duplicate: { label: "Duplicate", color: COLORS.text.muted },
};

type ViewMode = "form" | "success" | "history" | "detail";

interface FeedbackItem {
  feedback_id: string;
  type?: string;
  feedback_type?: string;
  status: string;
  content?: string;
  content_preview?: string;
  created_at: string;
  priority?: string;
}

interface ThreadEvent {
  event_type?: string;
  action?: string;
  message?: string;
  actor_name?: string;
  actor_user_id?: string;
  details?: Record<string, any>;
  ts: string;
}

/**
 * FeedbackScreen - Feedback submission + history with threaded replies.
 *
 * Views: form → success, history → detail (with thread + reply)
 */
export function FeedbackScreen() {
  const navigation = useNavigation();
  const { colors, isDark } = useTheme();
  const { t } = useLanguage();
  const { user } = useAuth();
  const { triggerHaptic } = useHaptics();

  const cardChrome = useMemo(
    () => ({
      backgroundColor: colors.surface,
      borderRadius: RADIUS.xl,
      borderWidth: 1,
      borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)",
      ...appleCardShadowResting(isDark),
    }),
    [colors.surface, isDark]
  );

  // View state
  const [viewMode, setViewMode] = useState<ViewMode>("form");

  // Form state
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [content, setContent] = useState("");
  const [severity, setSeverity] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [ticketId, setTicketId] = useState<string | null>(null);

  // History state
  const [historyItems, setHistoryItems] = useState<FeedbackItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyRefreshing, setHistoryRefreshing] = useState(false);

  // Detail state
  const [selectedFeedback, setSelectedFeedback] = useState<FeedbackItem | null>(null);
  const [threadEvents, setThreadEvents] = useState<ThreadEvent[]>([]);
  const [threadLoading, setThreadLoading] = useState(false);
  const [replyMessage, setReplyMessage] = useState("");
  const [replySubmitting, setReplySubmitting] = useState(false);

  // Textarea focus animation
  const focusProgress = useSharedValue(0);
  const animatedBorder = useAnimatedStyle(() => ({
    borderColor: interpolateColor(
      focusProgress.value,
      [0, 1],
      [colors.glassBorder, COLORS.input.focusBorder],
    ),
  }));

  // ── History ──────────────────────────────────────────────────────────

  const fetchHistory = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setHistoryRefreshing(true);
    } else {
      setHistoryLoading(true);
    }
    try {
      const res = await api.get("/feedback/my");
      const data = res.data;
      const items = Array.isArray(data) ? data : (data.items || data.feedback || []);
      setHistoryItems(items);
    } catch (err: any) {
      console.error("Error fetching feedback history:", err);
    } finally {
      setHistoryLoading(false);
      setHistoryRefreshing(false);
    }
  }, []);

  const openHistory = useCallback(() => {
    setViewMode("history");
    fetchHistory();
  }, [fetchHistory]);

  // ── Detail + Thread ──────────────────────────────────────────────────

  const openDetail = useCallback(async (item: FeedbackItem) => {
    setSelectedFeedback(item);
    setViewMode("detail");
    setThreadEvents([]);
    setReplyMessage("");
    setThreadLoading(true);
    try {
      const res = await api.get(`/feedback/${item.feedback_id}/thread`);
      const events = res.data?.events || [];
      setThreadEvents(events);
    } catch (err: any) {
      console.error("Error fetching thread:", err);
    } finally {
      setThreadLoading(false);
    }
  }, []);

  const handleReply = useCallback(async () => {
    if (!selectedFeedback || !replyMessage.trim()) return;
    setReplySubmitting(true);
    try {
      await api.post(`/feedback/${selectedFeedback.feedback_id}/reply`, {
        message: replyMessage.trim(),
      });
      triggerHaptic("medium");
      setReplyMessage("");
      // Refetch thread
      const res = await api.get(`/feedback/${selectedFeedback.feedback_id}/thread`);
      setThreadEvents(res.data?.events || []);
    } catch (err: any) {
      const msg = err?.response?.data?.detail || "Failed to send reply.";
      Alert.alert("Reply Failed", typeof msg === "string" ? msg : "Failed to send reply.");
    } finally {
      setReplySubmitting(false);
    }
  }, [selectedFeedback, replyMessage, triggerHaptic]);

  // ── Form Helpers ─────────────────────────────────────────────────────

  const getPlaceholder = () => {
    switch (selectedType) {
      case "bug":
        return "Describe what happened, what you expected, and what you observed\u2026";
      case "feature_request":
        return "What feature would you like to see? How would it help you?";
      case "ux_issue":
        return "What was confusing or difficult to use?";
      case "complaint":
        return "What went wrong? We want to make it right.";
      case "praise":
        return "What did you enjoy? We appreciate the feedback.";
      default:
        return "Tell us about your experience\u2026";
    }
  };

  const getCharCountColor = () => {
    if (content.length >= MAX_CONTENT_LENGTH) return COLORS.status.danger;
    if (content.length >= MAX_CONTENT_LENGTH * 0.8) return COLORS.status.warning;
    return colors.textMuted;
  };

  const handleSubmit = async () => {
    if (!selectedType) {
      Alert.alert(COPY.errors.noType.title, COPY.errors.noType.msg);
      return;
    }
    if (!content.trim()) {
      Alert.alert(COPY.errors.noContent.title, COPY.errors.noContent.msg);
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await api.post("/feedback", {
        feedback_type: selectedType,
        content: content.trim(),
        tags: severity > 0 ? [`severity_${severity}`] : [],
        context: {
          source: "mobile_feedback_screen",
          severity_rating: severity || undefined,
        },
      });

      const feedbackId = res.data?.data?.feedback_id;
      setTicketId(feedbackId || null);
      triggerHaptic("medium");
      setViewMode("success");
    } catch (err: any) {
      const msg = err?.response?.data?.detail || COPY.errors.generic;
      Alert.alert("Submission Failed", msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Relative time helper ─────────────────────────────────────────────

  const getRelativeTime = (dateStr: string) => {
    const now = new Date();
    const date = new Date(dateStr);
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 30) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  // ── Back handler ─────────────────────────────────────────────────────

  const handleBack = () => {
    if (viewMode === "detail") {
      setViewMode("history");
      setSelectedFeedback(null);
    } else if (viewMode === "history") {
      setViewMode("form");
    } else {
      navigation.goBack();
    }
  };

  // ── SUCCESS VIEW ─────────────────────────────────────────────────────

  if (viewMode === "success") {
    return (
      <BottomSheetScreen>
        <View style={[styles.container, { backgroundColor: colors.contentBg }]}>
          <View style={styles.successContainer}>
            <Animated.View entering={FadeIn.delay(100).springify()}>
              <View style={[styles.successIcon, { backgroundColor: COLORS.glass.glowGreen }]}>
                <Ionicons name="checkmark-circle" size={56} color={COLORS.status.success} />
              </View>
            </Animated.View>

            <Animated.View entering={FadeInDown.delay(250).springify().damping(12)}>
              <Text style={[styles.successTitle, { color: colors.textPrimary }]}>
                {COPY.success.title}
              </Text>
            </Animated.View>

            <Animated.View entering={FadeInDown.delay(400).springify().damping(12)}>
              <Text style={[styles.successSubtitle, { color: colors.textSecondary }]}>
                {selectedType === "praise" ? COPY.success.bodyPraise : COPY.success.body}
              </Text>
            </Animated.View>

            {ticketId && (
              <Animated.View entering={FadeInDown.delay(550).springify().damping(12)}>
                <View style={styles.ticketContainer}>
                  <Text style={[styles.ticketLabel, { color: colors.textMuted }]}>
                    {COPY.success.ticketLabel}
                  </Text>
                  <View style={[styles.ticketPill, { backgroundColor: colors.glassBg, borderColor: colors.glassBorder }]}>
                    <Ionicons name="document-text-outline" size={14} color={colors.textSecondary} />
                    <Text style={[styles.ticketId, { color: colors.textPrimary }]}>
                      {ticketId}
                    </Text>
                  </View>
                </View>
              </Animated.View>
            )}

            <Animated.View entering={FadeInDown.delay(700).springify().damping(12)} style={styles.successButtonWrap}>
              <TouchableOpacity
                style={[styles.primaryButton, { backgroundColor: colors.buttonPrimary }]}
                onPress={() => {
                  setViewMode("form");
                  setSelectedType(null);
                  setContent("");
                  setSeverity(0);
                  setTicketId(null);
                }}
                activeOpacity={0.85}
              >
                <Text style={[styles.primaryButtonText, { color: colors.buttonText }]}>{t.common.done}</Text>
              </TouchableOpacity>
            </Animated.View>
          </View>
        </View>
      </BottomSheetScreen>
    );
  }

  // ── HISTORY VIEW ─────────────────────────────────────────────────────

  if (viewMode === "history") {
    const renderHistoryItem = ({ item, index }: { item: FeedbackItem; index: number }) => {
      const feedbackType = item.type || item.feedback_type || "other";
      const meta = TYPE_META[feedbackType] || TYPE_META.other;
      const statusMeta = STATUS_META[item.status] || STATUS_META.open;

      return (
        <Animated.View entering={FadeInDown.delay(index * 50).springify().damping(14)}>
          <TouchableOpacity
            style={[styles.historyCard, cardChrome]}
            activeOpacity={0.7}
            onPress={() => openDetail(item)}
          >
            <View style={styles.historyCardHeader}>
              <View style={styles.historyBadges}>
                <View style={[styles.badge, { backgroundColor: meta.color + "20", borderColor: meta.color + "40" }]}>
                  <Ionicons name={meta.icon as any} size={12} color={meta.color} />
                  <Text style={[styles.badgeText, { color: meta.color }]}>{meta.label}</Text>
                </View>
                <View style={[styles.badge, { backgroundColor: statusMeta.color + "20" }]}>
                  <Text style={[styles.badgeText, { color: statusMeta.color }]}>{statusMeta.label}</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
            </View>
            <Text style={[styles.historyContent, { color: colors.textPrimary }]} numberOfLines={2}>
              {item.content_preview || item.content || "No content"}
            </Text>
            <Text style={[styles.historyDate, { color: colors.textMuted }]}>
              {getRelativeTime(item.created_at)}
            </Text>
          </TouchableOpacity>
        </Animated.View>
      );
    };

    return (
      <BottomSheetScreen>
        <View style={[styles.container, { backgroundColor: colors.contentBg }]}>
          {/* Header */}
          <View style={[styles.header, { paddingHorizontal: LAYOUT.screenPadding }]}>
            <Pressable
              style={({ pressed }) => [
                styles.headerCircle,
                { backgroundColor: colors.surface, ...appleCardShadowResting(isDark) },
                pressed && styles.headerCirclePressed,
              ]}
              onPress={handleBack}
            >
              <Ionicons name="chevron-back" size={22} color={colors.textPrimary} />
            </Pressable>
            <View style={styles.headerCenter}>
              <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
                My Reports
              </Text>
              <Text style={[styles.headerSubtitle, { color: colors.textMuted }]}>
                {historyItems.length} report{historyItems.length !== 1 ? "s" : ""}
              </Text>
            </View>
            <View style={{ width: 44 }} />
          </View>

          {historyLoading && !historyRefreshing ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.textPrimary} />
            </View>
          ) : historyItems.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="file-tray-outline" size={48} color={colors.textMuted} />
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                No reports yet
              </Text>
              <TouchableOpacity
                style={[
                  styles.primaryButton,
                  { backgroundColor: colors.buttonPrimary, marginTop: SPACING.lg, maxWidth: 280 },
                ]}
                onPress={() => setViewMode("form")}
                activeOpacity={0.85}
              >
                <Text style={[styles.primaryButtonText, { color: colors.buttonText }]}>Submit a Report</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <FlatList
              data={historyItems}
              keyExtractor={(item) => item.feedback_id}
              renderItem={renderHistoryItem}
              contentContainerStyle={styles.historyList}
              showsVerticalScrollIndicator={false}
              refreshControl={
                <RefreshControl
                  refreshing={historyRefreshing}
                  onRefresh={() => fetchHistory(true)}
                  tintColor={colors.textPrimary}
                />
              }
            />
          )}
        </View>
      </BottomSheetScreen>
    );
  }

  // ── DETAIL VIEW ──────────────────────────────────────────────────────

  if (viewMode === "detail" && selectedFeedback) {
    const feedbackType = selectedFeedback.type || selectedFeedback.feedback_type || "other";
    const meta = TYPE_META[feedbackType] || TYPE_META.other;
    const statusMeta = STATUS_META[selectedFeedback.status] || STATUS_META.open;
    const isClosed = selectedFeedback.status === "wont_fix" || selectedFeedback.status === "duplicate";

    return (
      <BottomSheetScreen>
        <View style={[styles.container, { backgroundColor: colors.contentBg }]}>
          {/* Header */}
          <View style={[styles.header, { paddingHorizontal: LAYOUT.screenPadding }]}>
            <Pressable
              style={({ pressed }) => [
                styles.headerCircle,
                { backgroundColor: colors.surface, ...appleCardShadowResting(isDark) },
                pressed && styles.headerCirclePressed,
              ]}
              onPress={handleBack}
            >
              <Ionicons name="chevron-back" size={22} color={colors.textPrimary} />
            </Pressable>
            <View style={styles.headerCenter}>
              <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
                Report Detail
              </Text>
            </View>
            <View style={{ width: 44 }} />
          </View>

          <ScrollView
            style={[styles.scrollView, { paddingHorizontal: LAYOUT.screenPadding }]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
          >
            {/* Report Info Card */}
            <Animated.View entering={FadeInDown.delay(50).springify().damping(14)}>
              <View style={[styles.sectionCard, cardChrome]}>
                <View style={styles.sectionInner}>
                  {/* Badges */}
                  <View style={styles.detailBadgeRow}>
                    <View style={[styles.badge, { backgroundColor: meta.color + "20", borderColor: meta.color + "40" }]}>
                      <Ionicons name={meta.icon as any} size={12} color={meta.color} />
                      <Text style={[styles.badgeText, { color: meta.color }]}>{meta.label}</Text>
                    </View>
                    <View style={[styles.badge, { backgroundColor: statusMeta.color + "20" }]}>
                      <Text style={[styles.badgeText, { color: statusMeta.color }]}>{statusMeta.label}</Text>
                    </View>
                  </View>

                  {/* Reference ID */}
                  <Text style={[styles.detailRefId, { color: colors.textMuted }]}>
                    {selectedFeedback.feedback_id}
                  </Text>

                  {/* Content */}
                  <Text style={[styles.detailContent, { color: colors.textPrimary }]}>
                    {selectedFeedback.content || selectedFeedback.content_preview || "No content"}
                  </Text>

                  {/* Date */}
                  <Text style={[styles.detailDate, { color: colors.textMuted }]}>
                    Submitted {getRelativeTime(selectedFeedback.created_at)}
                  </Text>
                </View>
              </View>
            </Animated.View>

            {/* Thread Timeline */}
            <Animated.View entering={FadeInDown.delay(150).springify().damping(14)}>
              <Text style={[styles.threadTitle, { color: colors.textSecondary }]}>
                CONVERSATION
              </Text>

              {threadLoading ? (
                <View style={styles.threadLoadingContainer}>
                  <ActivityIndicator size="small" color={colors.textMuted} />
                </View>
              ) : threadEvents.length === 0 ? (
                <View style={[styles.threadEmpty, { backgroundColor: colors.glassBg, borderColor: colors.glassBorder }]}>
                  <Ionicons name="chatbubbles-outline" size={24} color={colors.textMuted} />
                  <Text style={[styles.threadEmptyText, { color: colors.textMuted }]}>
                    No conversation yet
                  </Text>
                </View>
              ) : (
                <View style={styles.threadList}>
                  {threadEvents.map((event, index) => {
                    const eventType = event.event_type || event.action || "";
                    const isAdminResponse = eventType === "admin_response";
                    const isUserReply = eventType === "user_reply";
                    const isStatusChange = eventType === "status_change" || eventType === "status_updated";
                    const message = event.message || event.details?.message || "";

                    if (isStatusChange) {
                      const oldStatus = event.details?.old_status || event.details?.from;
                      const newStatus = event.details?.new_status || event.details?.to || event.details?.status;
                      const oldMeta = STATUS_META[oldStatus] || { label: oldStatus, color: colors.textMuted };
                      const newMeta = STATUS_META[newStatus] || { label: newStatus, color: colors.textMuted };

                      return (
                        <View key={index} style={styles.statusChangeRow}>
                          <View style={[styles.statusChangeDot, { backgroundColor: colors.glassBorder }]} />
                          <Text style={[styles.statusChangeText, { color: colors.textMuted }]}>
                            Status changed{oldStatus ? ` from ` : " to "}
                            {oldStatus && (
                              <Text style={{ color: oldMeta.color }}>{oldMeta.label}</Text>
                            )}
                            {oldStatus && " to "}
                            <Text style={{ color: newMeta.color }}>{newMeta.label}</Text>
                          </Text>
                          <Text style={[styles.eventTime, { color: colors.textMuted }]}>
                            {getRelativeTime(event.ts)}
                          </Text>
                        </View>
                      );
                    }

                    if (isAdminResponse) {
                      return (
                        <View key={index} style={[styles.threadEvent, styles.adminEvent, { borderColor: colors.glassBorder }]}>
                          <View style={styles.threadEventHeader}>
                            <View style={[styles.actorBadge, { backgroundColor: "#F97316" + "20" }]}>
                              <Ionicons name="shield-outline" size={10} color="#F97316" />
                              <Text style={[styles.actorName, { color: "#F97316" }]}>
                                {event.actor_name || "Admin"}
                              </Text>
                            </View>
                            <Text style={[styles.eventTime, { color: colors.textMuted }]}>
                              {getRelativeTime(event.ts)}
                            </Text>
                          </View>
                          <Text style={[styles.threadMessage, { color: colors.textPrimary }]}>
                            {message}
                          </Text>
                        </View>
                      );
                    }

                    if (isUserReply) {
                      return (
                        <View key={index} style={[styles.threadEvent, styles.userEvent, { borderColor: colors.glassBorder }]}>
                          <View style={styles.threadEventHeader}>
                            <View style={[styles.actorBadge, { backgroundColor: COLORS.trustBlue + "20" }]}>
                              <Ionicons name="person-outline" size={10} color={COLORS.trustBlue} />
                              <Text style={[styles.actorName, { color: COLORS.trustBlue }]}>
                                {event.actor_name || "You"}
                              </Text>
                            </View>
                            <Text style={[styles.eventTime, { color: colors.textMuted }]}>
                              {getRelativeTime(event.ts)}
                            </Text>
                          </View>
                          <Text style={[styles.threadMessage, { color: colors.textPrimary }]}>
                            {message}
                          </Text>
                        </View>
                      );
                    }

                    return null;
                  })}
                </View>
              )}
            </Animated.View>

            {/* Reply Form */}
            <Animated.View entering={FadeInDown.delay(250).springify().damping(14)}>
              {isClosed ? (
                <View style={[styles.closedNotice, { backgroundColor: colors.glassBg, borderColor: colors.glassBorder }]}>
                  <Ionicons name="lock-closed-outline" size={16} color={colors.textMuted} />
                  <Text style={[styles.closedNoticeText, { color: colors.textMuted }]}>
                    This report has been closed. No further replies can be sent.
                  </Text>
                </View>
              ) : (
                <View style={[styles.sectionCard, cardChrome]}>
                  <View style={styles.sectionInner}>
                    <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>
                      REPLY
                    </Text>
                    <View style={[styles.replyInputWrap, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
                      <TextInput
                        placeholder="Type your reply..."
                        placeholderTextColor={colors.textMuted}
                        value={replyMessage}
                        onChangeText={setReplyMessage}
                        multiline
                        maxLength={MAX_REPLY_LENGTH}
                        style={[styles.replyInput, { color: colors.textPrimary }]}
                        textAlignVertical="top"
                      />
                    </View>
                    <View style={styles.replyFooter}>
                      <Text style={[styles.charCount, { color: colors.textMuted }]}>
                        {replyMessage.length}/{MAX_REPLY_LENGTH}
                      </Text>
                      <TouchableOpacity
                        style={[
                          styles.replySendButton,
                          {
                            backgroundColor: colors.buttonPrimary,
                            opacity: !replyMessage.trim() || replySubmitting ? 0.45 : 1,
                          },
                        ]}
                        onPress={handleReply}
                        disabled={!replyMessage.trim() || replySubmitting}
                        activeOpacity={0.85}
                      >
                        {replySubmitting ? (
                          <ActivityIndicator size="small" color={colors.buttonText} />
                        ) : (
                          <Text style={[styles.replySendButtonText, { color: colors.buttonText }]}>Send Reply</Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              )}
            </Animated.View>

            <View style={{ height: 80 }} />
          </ScrollView>
        </View>
      </BottomSheetScreen>
    );
  }

  // ── MAIN FORM VIEW ───────────────────────────────────────────────────

  const showSeverity = selectedType === "bug" || selectedType === "complaint";

  return (
    <BottomSheetScreen>
        <View style={[styles.container, { backgroundColor: colors.contentBg }]}>
        {/* Header */}
        <View style={[styles.header, { paddingHorizontal: LAYOUT.screenPadding }]}>
          <Pressable
            style={({ pressed }) => [
              styles.headerCircle,
              { backgroundColor: colors.surface, ...appleCardShadowResting(isDark) },
              pressed && styles.headerCirclePressed,
            ]}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="chevron-back" size={22} color={colors.textPrimary} />
          </Pressable>
          <View style={styles.headerCenter}>
            <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
              {COPY.header.title}
            </Text>
            <Text style={[styles.headerSubtitle, { color: colors.textMuted }]}>
              {COPY.header.subtitle}
            </Text>
          </View>
          <Pressable
            style={({ pressed }) => [
              styles.headerCircle,
              { backgroundColor: colors.surface, ...appleCardShadowResting(isDark) },
              pressed && styles.headerCirclePressed,
            ]}
            onPress={openHistory}
          >
            <Ionicons name="time-outline" size={22} color={colors.textPrimary} />
          </Pressable>
        </View>

        <ScrollView
          style={[styles.scrollView, { paddingHorizontal: LAYOUT.screenPadding }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
        >
          {/* ── Card A: Category Selector ── */}
          <Animated.View entering={FadeInDown.delay(100).springify().damping(14)}>
            <View style={[styles.sectionCard, cardChrome]}>
              <View style={styles.sectionInner}>
                <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>
                  {COPY.type.label}
                </Text>
                <Text style={[styles.helperText, { color: colors.textMuted }]}>
                  {COPY.type.helper}
                </Text>
                <View style={styles.typeGrid}>
                  {FEEDBACK_TYPES.map((type) => {
                    const isSelected = selectedType === type.key;
                    return (
                      <TouchableOpacity
                        key={type.key}
                        style={[
                          styles.typeChip,
                          {
                            backgroundColor: isSelected ? type.color + "20" : colors.glassBg,
                            borderColor: isSelected ? type.color : colors.glassBorder,
                            borderWidth: isSelected ? 2 : 1.5,
                          },
                          isSelected && {
                            ...SHADOWS.subtle,
                            shadowColor: type.color,
                          },
                        ]}
                        activeOpacity={0.7}
                        onPress={() => {
                          setSelectedType(type.key);
                          triggerHaptic("selection");
                        }}
                      >
                        <Ionicons
                          name={type.icon}
                          size={18}
                          color={isSelected ? type.color : colors.textSecondary}
                        />
                        <Text
                          style={[
                            styles.typeLabel,
                            { color: isSelected ? type.color : colors.textPrimary },
                          ]}
                        >
                          {type.label}
                        </Text>
                        {isSelected && (
                          <View style={[styles.chipCheck, { backgroundColor: type.color }]}>
                            <Ionicons name="checkmark" size={10} color="#FFFFFF" />
                          </View>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            </View>
          </Animated.View>

          {/* ── Card B: Details TextArea ── */}
          <Animated.View entering={FadeInDown.delay(200).springify().damping(14)}>
            <View style={[styles.sectionCard, cardChrome]}>
              <View style={styles.sectionInner}>
                <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>
                  {COPY.details.label}
                </Text>
                <Text style={[styles.helperText, { color: colors.textMuted }]}>
                  {COPY.details.helper}
                </Text>
                <Animated.View
                  style={[
                    styles.textAreaWrap,
                    { backgroundColor: colors.inputBg },
                    animatedBorder,
                  ]}
                >
                  <TextInput
                    placeholder={getPlaceholder()}
                    placeholderTextColor={colors.textMuted}
                    value={content}
                    onChangeText={setContent}
                    multiline
                    maxLength={MAX_CONTENT_LENGTH}
                    style={[styles.textArea, { color: colors.textPrimary }]}
                    textAlignVertical="top"
                    onFocus={() => {
                      focusProgress.value = withTiming(1, { duration: 200 });
                    }}
                    onBlur={() => {
                      focusProgress.value = withTiming(0, { duration: 200 });
                    }}
                  />
                </Animated.View>
                <View style={styles.charCountRow}>
                  <Text style={[styles.charCount, { color: getCharCountColor() }]}>
                    {content.length.toLocaleString()}/{MAX_CONTENT_LENGTH.toLocaleString()}
                  </Text>
                </View>
              </View>
            </View>
          </Animated.View>

          {/* ── Card C: Impact / Severity (conditional) ── */}
          {showSeverity && (
            <Animated.View entering={FadeInDown.delay(300).springify().damping(14)}>
              <View style={[styles.sectionCard, cardChrome]}>
                <View style={[styles.sectionInner, styles.severityInner]}>
                  <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>
                    {COPY.severity.label}
                  </Text>
                  <Text style={[styles.helperText, { color: colors.textMuted }]}>
                    {COPY.severity.helper}
                  </Text>
                  <StarRating
                    rating={severity}
                    onRatingChange={setSeverity}
                    size="medium"
                    showLabel
                  />
                </View>
              </View>
            </Animated.View>
          )}

          {/* ── Submit Area ── */}
          <Animated.View entering={FadeInDown.delay(showSeverity ? 400 : 300).springify().damping(14)}>
            <View style={[styles.submitDivider, { backgroundColor: colors.border }]} />
            <TouchableOpacity
              style={[
                styles.primaryButton,
                styles.submitButton,
                {
                  backgroundColor: colors.buttonPrimary,
                  opacity: !selectedType || !content.trim() || isSubmitting ? 0.45 : 1,
                },
              ]}
              onPress={handleSubmit}
              disabled={!selectedType || !content.trim() || isSubmitting}
              activeOpacity={0.85}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color={colors.buttonText} />
              ) : (
                <Text style={[styles.primaryButtonText, { color: colors.buttonText }]}>{COPY.submit.button}</Text>
              )}
            </TouchableOpacity>
            <Text style={[styles.submitDisclaimer, { color: colors.textMuted }]}>
              {COPY.submit.disclaimer}
            </Text>
          </Animated.View>

          <View style={{ height: 80 }} />
        </ScrollView>
      </View>
    </BottomSheetScreen>
  );
}

// ── Styles ────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.lg,
  },
  headerCircle: {
    width: LAYOUT.touchTarget,
    height: LAYOUT.touchTarget,
    borderRadius: RADIUS.full,
    alignItems: "center",
    justifyContent: "center",
  },
  headerCirclePressed: {
    opacity: 0.85,
    transform: [{ scale: 0.96 }],
  },
  headerCenter: {
    alignItems: "center",
    flex: 1,
  },
  headerTitle: {
    fontSize: TYPOGRAPHY.sizes.heading3,
    fontWeight: TYPOGRAPHY.weights.semiBold,
  },
  headerSubtitle: {
    fontSize: TYPOGRAPHY.sizes.micro,
    marginTop: 2,
  },

  // Scroll
  scrollView: {
    flex: 1,
  },

  // Section cards
  sectionCard: {
    marginBottom: SPACING.lg,
  },
  sectionInner: {
    padding: SPACING.cardPadding,
  },
  sectionLabel: {
    fontSize: TYPOGRAPHY.sizes.caption,
    fontWeight: TYPOGRAPHY.weights.semiBold,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: SPACING.xs,
  },
  helperText: {
    fontSize: TYPOGRAPHY.sizes.caption,
    lineHeight: 18,
    marginBottom: SPACING.md,
  },

  // Type chips
  typeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.sm,
  },
  typeChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderRadius: RADIUS.lg,
    borderWidth: 1.5,
  },
  typeLabel: {
    fontSize: TYPOGRAPHY.sizes.bodySmall,
    fontWeight: TYPOGRAPHY.weights.medium,
  },
  chipCheck: {
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: -2,
  },

  // Custom textarea
  textAreaWrap: {
    minHeight: 160,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    overflow: "hidden",
  },
  textArea: {
    minHeight: 136,
    fontSize: TYPOGRAPHY.sizes.body,
    lineHeight: 24,
    padding: 0,
  },
  charCountRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: SPACING.xs,
  },
  charCount: {
    fontSize: TYPOGRAPHY.sizes.micro,
  },

  // Severity
  severityInner: {
    alignItems: "center",
  },

  // Submit
  submitDivider: {
    height: 1,
    marginBottom: SPACING.lg,
  },
  submitButton: {
    marginBottom: SPACING.md,
  },
  primaryButton: {
    width: "100%",
    minHeight: BUTTON_SIZE.large.height,
    borderRadius: RADIUS.full,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: SPACING.xl,
  },
  primaryButtonText: {
    fontSize: TYPOGRAPHY.sizes.body,
    fontWeight: TYPOGRAPHY.weights.semiBold,
  },
  replySendButton: {
    minHeight: BUTTON_SIZE.compact.height,
    paddingHorizontal: SPACING.lg,
    borderRadius: RADIUS.full,
    alignItems: "center",
    justifyContent: "center",
  },
  replySendButtonText: {
    fontSize: TYPOGRAPHY.sizes.bodySmall,
    fontWeight: TYPOGRAPHY.weights.semiBold,
  },
  submitDisclaimer: {
    fontSize: TYPOGRAPHY.sizes.micro,
    textAlign: "center",
  },

  // Success
  successContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: SPACING.container,
    gap: SPACING.lg,
  },
  successIcon: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  successTitle: {
    fontSize: TYPOGRAPHY.sizes.heading2,
    fontWeight: TYPOGRAPHY.weights.bold,
    textAlign: "center",
  },
  successSubtitle: {
    fontSize: TYPOGRAPHY.sizes.body,
    textAlign: "center",
    lineHeight: 24,
    paddingHorizontal: SPACING.xl,
  },
  successButtonWrap: {
    width: "100%",
    paddingHorizontal: SPACING.xl,
  },

  // Ticket pill
  ticketContainer: {
    alignItems: "center",
    gap: SPACING.sm,
  },
  ticketLabel: {
    fontSize: TYPOGRAPHY.sizes.caption,
    fontWeight: TYPOGRAPHY.weights.medium,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  ticketPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    borderRadius: RADIUS.full,
    borderWidth: 1,
  },
  ticketId: {
    fontSize: TYPOGRAPHY.sizes.bodySmall,
    fontWeight: TYPOGRAPHY.weights.semiBold,
    fontFamily: "monospace",
    letterSpacing: 0.5,
  },

  // Loading
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  // Empty
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.md,
  },
  emptyText: {
    fontSize: TYPOGRAPHY.sizes.body,
  },

  // History
  historyList: {
    paddingHorizontal: SPACING.container,
    paddingBottom: 80,
  },
  historyCard: {
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    padding: SPACING.cardPadding,
    marginBottom: SPACING.md,
  },
  historyCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: SPACING.sm,
  },
  historyBadges: {
    flexDirection: "row",
    gap: SPACING.sm,
  },
  historyContent: {
    fontSize: TYPOGRAPHY.sizes.body,
    lineHeight: 22,
    marginBottom: SPACING.sm,
  },
  historyDate: {
    fontSize: TYPOGRAPHY.sizes.micro,
  },

  // Badges
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: "transparent",
  },
  badgeText: {
    fontSize: TYPOGRAPHY.sizes.micro,
    fontWeight: TYPOGRAPHY.weights.semiBold,
    fontFamily: "monospace",
  },

  // Detail
  detailBadgeRow: {
    flexDirection: "row",
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  detailRefId: {
    fontSize: TYPOGRAPHY.sizes.micro,
    fontFamily: "monospace",
    marginBottom: SPACING.md,
  },
  detailContent: {
    fontSize: TYPOGRAPHY.sizes.body,
    lineHeight: 24,
    marginBottom: SPACING.md,
  },
  detailDate: {
    fontSize: TYPOGRAPHY.sizes.micro,
  },

  // Thread
  threadTitle: {
    fontSize: TYPOGRAPHY.sizes.caption,
    fontWeight: TYPOGRAPHY.weights.semiBold,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: SPACING.md,
  },
  threadLoadingContainer: {
    paddingVertical: SPACING.xl,
    alignItems: "center",
  },
  threadEmpty: {
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    padding: SPACING.xl,
    alignItems: "center",
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  threadEmptyText: {
    fontSize: TYPOGRAPHY.sizes.bodySmall,
  },
  threadList: {
    marginBottom: SPACING.lg,
    gap: SPACING.md,
  },

  // Thread events
  threadEvent: {
    borderRadius: RADIUS.md,
    padding: SPACING.cardPadding,
    borderLeftWidth: 3,
  },
  adminEvent: {
    backgroundColor: "rgba(249, 115, 22, 0.05)",
    borderLeftColor: "#F97316",
  },
  userEvent: {
    backgroundColor: "rgba(59, 130, 246, 0.05)",
    borderLeftColor: "#3B82F6",
  },
  threadEventHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: SPACING.sm,
  },
  actorBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: RADIUS.sm,
  },
  actorName: {
    fontSize: TYPOGRAPHY.sizes.micro,
    fontWeight: TYPOGRAPHY.weights.semiBold,
  },
  threadMessage: {
    fontSize: TYPOGRAPHY.sizes.body,
    lineHeight: 22,
  },
  eventTime: {
    fontSize: TYPOGRAPHY.sizes.micro,
  },

  // Status change row
  statusChangeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    paddingVertical: SPACING.sm,
  },
  statusChangeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusChangeText: {
    flex: 1,
    fontSize: TYPOGRAPHY.sizes.caption,
  },

  // Closed notice
  closedNotice: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    padding: SPACING.cardPadding,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    marginBottom: SPACING.lg,
  },
  closedNoticeText: {
    flex: 1,
    fontSize: TYPOGRAPHY.sizes.bodySmall,
  },

  // Reply
  replyInputWrap: {
    minHeight: 100,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    marginBottom: SPACING.sm,
  },
  replyInput: {
    minHeight: 80,
    fontSize: TYPOGRAPHY.sizes.body,
    lineHeight: 22,
    padding: 0,
  },
  replyFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
});
