import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Alert,
} from "react-native";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import {
  COLORS,
  TYPOGRAPHY,
  SPACING,
  RADIUS,
  ANIMATION,
  SCHEDULE_COLORS,
  SCHEDULE_STYLES,
} from "../styles/liquidGlass";
import { api } from "../api/client";
import {
  PageHeader,
  GlassSurface,
  GlassButton,
} from "../components/ui";
import { BottomSheetScreen } from "../components/BottomSheetScreen";
import type { RootStackParamList } from "../navigation/RootNavigator";

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, "RSVP">;

interface OccurrenceDetail {
  occurrence_id: string;
  event_id: string;
  title: string;
  starts_at: string;
  duration_minutes: number;
  location: string | null;
  game_category: string;
  host_name?: string;
  default_buy_in?: number;
  my_rsvp: string | null;
  stats?: {
    accepted: number;
    declined: number;
    maybe: number;
    invited: number;
    total: number;
  };
}

export function RSVPScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { colors } = useTheme();
  const { user } = useAuth();

  const occurrenceId = (route.params as any)?.occurrenceId;

  const [detail, setDetail] = useState<OccurrenceDetail | null>(null);
  const [currentRsvp, setCurrentRsvp] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState<string | null>(null);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        ...ANIMATION.spring.bouncy,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  useEffect(() => {
    const fetchDetail = async () => {
      if (!occurrenceId) return;
      try {
        // Fetch invites to get stats, then fetch event for details
        const invRes = await api.get(
          `/occurrences/${occurrenceId}/invites`
        );
        const invData = invRes.data;

        // Find user's invite
        const myInvite = (invData.invites || []).find(
          (i: any) => i.user_id === user?.user_id
        );

        // Fetch event details
        let eventData: any = {};
        if (invData.event_id) {
          try {
            const evtRes = await api.get(`/events/${invData.event_id}`);
            eventData = evtRes.data;
          } catch {}
        }

        // Find the occurrence in event occurrences
        const occ = (eventData.occurrences || []).find(
          (o: any) => o.occurrence_id === occurrenceId
        );

        setDetail({
          occurrence_id: occurrenceId,
          event_id: invData.event_id || "",
          title: eventData.title || "Game Night",
          starts_at: occ?.starts_at || "",
          duration_minutes: occ?.duration_minutes || 180,
          location: eventData.location || occ?.location || null,
          game_category: eventData.game_category || "poker",
          default_buy_in: eventData.default_buy_in,
          my_rsvp: myInvite?.status || null,
          stats: invData.stats,
        });
        setCurrentRsvp(myInvite?.status || null);
      } catch (err) {
        console.error("Failed to fetch occurrence detail:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchDetail();
  }, [occurrenceId, user?.user_id]);

  const handleRsvp = async (status: string) => {
    try {
      setSubmitting(status);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      const response = await api.post(
        `/occurrences/${occurrenceId}/rsvp`,
        { status }
      );
      setCurrentRsvp(status);

      if (response.data.stats) {
        setDetail((prev) =>
          prev ? { ...prev, stats: response.data.stats, my_rsvp: status } : prev
        );
      }

      const messages: Record<string, string> = {
        accepted: "You're in! See you there.",
        declined: "Got it. We'll miss you!",
        maybe: "Noted. We'll keep your spot.",
      };
      Alert.alert("RSVP Updated", messages[status] || "Response recorded.");
    } catch (err: any) {
      const msg = err.response?.data?.detail || "Failed to RSVP";
      Alert.alert("Error", typeof msg === "string" ? msg : JSON.stringify(msg));
    } finally {
      setSubmitting(null);
    }
  };

  const formatDate = (isoStr: string) => {
    if (!isoStr) return "";
    const d = new Date(isoStr);
    return d.toLocaleDateString("en-US", {
      weekday: "long",
      month: "short",
      day: "numeric",
    });
  };

  const formatTime = (isoStr: string) => {
    if (!isoStr) return "";
    const d = new Date(isoStr);
    return d.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  if (loading) {
    return (
      <BottomSheetScreen>
        <View style={[styles.container, { backgroundColor: colors.contentBg }]}>
          <PageHeader title="Loading..." onClose={() => navigation.goBack()} />
          <View style={styles.center}>
            <Text style={{ color: colors.textMuted }}>Loading event details...</Text>
          </View>
        </View>
      </BottomSheetScreen>
    );
  }

  return (
    <BottomSheetScreen>
      <View style={[styles.container, { backgroundColor: colors.contentBg }]}>
        <Animated.View
          style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}
        >
          <PageHeader
            title="You're invited!"
            onClose={() => navigation.goBack()}
          />
        </Animated.View>

        <Animated.View
          style={[
            styles.body,
            { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
          ]}
        >
          {/* Event details card */}
          <GlassSurface style={styles.detailCard} glowVariant="orange">
            <Text style={[styles.eventTitle, { color: colors.textPrimary }]}>
              {detail?.title}
            </Text>

            <View style={styles.detailRow}>
              <Ionicons
                name="calendar-outline"
                size={18}
                color={COLORS.orange}
              />
              <Text style={[styles.detailText, { color: colors.textSecondary }]}>
                {formatDate(detail?.starts_at || "")} at{" "}
                {formatTime(detail?.starts_at || "")}
              </Text>
            </View>

            {detail?.location && (
              <View style={styles.detailRow}>
                <Ionicons
                  name="location-outline"
                  size={18}
                  color={COLORS.orange}
                />
                <Text
                  style={[styles.detailText, { color: colors.textSecondary }]}
                >
                  {detail.location}
                </Text>
              </View>
            )}

            {detail?.default_buy_in && (
              <View style={styles.detailRow}>
                <Ionicons
                  name="cash-outline"
                  size={18}
                  color={COLORS.orange}
                />
                <Text
                  style={[styles.detailText, { color: colors.textSecondary }]}
                >
                  ${detail.default_buy_in} buy-in
                </Text>
              </View>
            )}

            {detail?.stats && (
              <View style={styles.detailRow}>
                <Ionicons
                  name="people-outline"
                  size={18}
                  color={COLORS.orange}
                />
                <Text
                  style={[styles.detailText, { color: colors.textSecondary }]}
                >
                  {detail.stats.accepted} going · {detail.stats.maybe} maybe ·{" "}
                  {detail.stats.invited} waiting
                </Text>
              </View>
            )}
          </GlassSurface>

          {/* Current RSVP status */}
          {currentRsvp && (
            <Text style={[styles.currentStatus, { color: colors.textMuted }]}>
              Your current response:{" "}
              <Text style={{ fontWeight: "600", textTransform: "capitalize" }}>
                {currentRsvp}
              </Text>
            </Text>
          )}

          {/* RSVP buttons: 2x2 grid */}
          <View style={styles.rsvpGrid}>
            <View style={styles.rsvpRow}>
              <GlassButton
                onPress={() => handleRsvp("accepted")}
                variant="primary"
                size="large"
                loading={submitting === "accepted"}
                disabled={!!submitting}
                style={[
                  styles.rsvpButton,
                  { backgroundColor: SCHEDULE_STYLES.rsvpButton.accept.backgroundColor },
                ]}
              >
                I'm in
              </GlassButton>
              <GlassButton
                onPress={() => handleRsvp("declined")}
                variant="primary"
                size="large"
                loading={submitting === "declined"}
                disabled={!!submitting}
                style={[
                  styles.rsvpButton,
                  { backgroundColor: SCHEDULE_STYLES.rsvpButton.decline.backgroundColor },
                ]}
              >
                Can't make it
              </GlassButton>
            </View>
            <View style={styles.rsvpRow}>
              <GlassButton
                onPress={() => handleRsvp("maybe")}
                variant="primary"
                size="large"
                loading={submitting === "maybe"}
                disabled={!!submitting}
                style={[
                  styles.rsvpButton,
                  { backgroundColor: SCHEDULE_STYLES.rsvpButton.maybe.backgroundColor },
                ]}
              >
                Maybe
              </GlassButton>
              <GlassButton
                onPress={() =>
                  Alert.alert(
                    "Coming Soon",
                    "Proposing a new time will be available in a future update."
                  )
                }
                variant="secondary"
                size="large"
                disabled={!!submitting}
                style={styles.rsvpButton}
              >
                Suggest time
              </GlassButton>
            </View>
          </View>
        </Animated.View>
      </View>
    </BottomSheetScreen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  body: {
    flex: 1,
    padding: SPACING.container,
  },
  detailCard: {
    marginBottom: SPACING.xl,
  },
  eventTitle: {
    fontSize: TYPOGRAPHY.sizes.heading2,
    fontWeight: TYPOGRAPHY.weights.bold,
    marginBottom: SPACING.lg,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
    marginBottom: SPACING.sm,
  },
  detailText: {
    fontSize: TYPOGRAPHY.sizes.bodySmall,
  },
  currentStatus: {
    fontSize: TYPOGRAPHY.sizes.bodySmall,
    textAlign: "center",
    marginBottom: SPACING.lg,
  },
  rsvpGrid: {
    gap: SPACING.md,
  },
  rsvpRow: {
    flexDirection: "row",
    gap: SPACING.md,
  },
  rsvpButton: {
    flex: 1,
    minHeight: 56,
  },
});

export default RSVPScreen;
