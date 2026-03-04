import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
  RefreshControl,
} from "react-native";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import {
  COLORS,
  TYPOGRAPHY,
  SPACING,
  RADIUS,
  ANIMATION,
  SCHEDULE_COLORS,
} from "../styles/liquidGlass";
import { api } from "../api/client";
import { DateStrip } from "../components/DateStrip";
import { PageHeader, GlassSurface, GlassButton } from "../components/ui";
import type { RootStackParamList } from "../navigation/RootNavigator";

type Nav = NativeStackNavigationProp<RootStackParamList>;

interface EventItem {
  event_id: string;
  occurrence_id: string;
  title: string;
  starts_at: string;
  duration_minutes: number;
  location: string | null;
  game_category: string;
  recurrence: string;
  group_id: string;
  host_id: string;
  status: string;
  my_rsvp: string | null;
}

export function SchedulerScreen() {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { isDark, colors } = useTheme();
  const { user } = useAuth();

  const [selectedDate, setSelectedDate] = useState(new Date());
  const [events, setEvents] = useState<EventItem[]>([]);
  const [eventDates, setEventDates] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 350,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        ...ANIMATION.spring.bouncy,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const fetchEvents = useCallback(async () => {
    try {
      const response = await api.get("/events");
      const data = response.data;
      setEvents(data.events || []);

      // Build eventDates set
      const dates = new Set<string>();
      for (const evt of data.events || []) {
        if (evt.starts_at) {
          const d = new Date(evt.starts_at);
          const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
          dates.add(iso);
        }
      }
      setEventDates(dates);
    } catch (err) {
      console.error("Failed to fetch events:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchEvents();
    }, [fetchEvents])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchEvents();
  };

  const formatTime = (isoStr: string) => {
    const d = new Date(isoStr);
    return d.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  const formatDate = (isoStr: string) => {
    const d = new Date(isoStr);
    return d.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  };

  const getRsvpColor = (status: string | null): string => {
    switch (status) {
      case "accepted":
        return SCHEDULE_COLORS.accepted;
      case "declined":
        return SCHEDULE_COLORS.declined;
      case "maybe":
        return SCHEDULE_COLORS.maybe;
      default:
        return SCHEDULE_COLORS.invited;
    }
  };

  const handleEventPress = (event: EventItem) => {
    if (event.host_id === user?.user_id) {
      navigation.navigate("EventDashboard" as any, {
        occurrenceId: event.occurrence_id,
      });
    } else {
      navigation.navigate("RSVP" as any, {
        occurrenceId: event.occurrence_id,
      });
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Animated.View
        style={{
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
          paddingTop: insets.top,
        }}
      >
        <PageHeader
          title="Schedule"
          onClose={() => navigation.goBack()}
        />
      </Animated.View>

      <Animated.View
        style={[
          styles.dateStripContainer,
          { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
        ]}
      >
        <DateStrip
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
          eventDates={eventDates}
        />
      </Animated.View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <Animated.View
          style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}
        >
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
            Upcoming
          </Text>

          {loading ? (
            <GlassSurface style={styles.card}>
              <Text style={{ color: colors.textMuted }}>Loading...</Text>
            </GlassSurface>
          ) : events.length === 0 ? (
            <GlassSurface style={styles.card}>
              <Text style={{ color: colors.textMuted }}>
                No upcoming games scheduled
              </Text>
            </GlassSurface>
          ) : (
            events.map((event) => (
              <TouchableOpacity
                key={event.occurrence_id}
                onPress={() => handleEventPress(event)}
                activeOpacity={0.7}
              >
                <GlassSurface style={styles.card}>
                  <View style={styles.cardHeader}>
                    <View style={styles.cardTitleRow}>
                      <Ionicons
                        name="game-controller-outline"
                        size={18}
                        color={COLORS.orange}
                      />
                      <Text
                        style={[
                          styles.cardTitle,
                          { color: colors.textPrimary },
                        ]}
                      >
                        {event.title}
                      </Text>
                    </View>
                    {event.recurrence !== "none" && (
                      <Ionicons
                        name="repeat"
                        size={14}
                        color={colors.textMuted}
                      />
                    )}
                  </View>

                  <Text
                    style={[styles.cardDate, { color: colors.textSecondary }]}
                  >
                    {formatDate(event.starts_at)} · {formatTime(event.starts_at)}
                  </Text>

                  {event.location && (
                    <Text
                      style={[
                        styles.cardLocation,
                        { color: colors.textMuted },
                      ]}
                    >
                      {event.location}
                    </Text>
                  )}

                  <View style={styles.cardFooter}>
                    <View style={styles.rsvpBadge}>
                      <View
                        style={[
                          styles.rsvpDot,
                          { backgroundColor: getRsvpColor(event.my_rsvp) },
                        ]}
                      />
                      <Text
                        style={[
                          styles.rsvpText,
                          { color: colors.textSecondary },
                        ]}
                      >
                        {event.my_rsvp || "Invited"}
                      </Text>
                    </View>
                    <Ionicons
                      name="chevron-forward"
                      size={16}
                      color={colors.textMuted}
                    />
                  </View>
                </GlassSurface>
              </TouchableOpacity>
            ))
          )}

          <View style={{ height: 100 }} />
        </Animated.View>
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity
        style={[styles.fab, { bottom: insets.bottom + 24 }]}
        onPress={() => navigation.navigate("CreateEvent" as any, {})}
        activeOpacity={0.8}
        accessibilityLabel="Schedule a game"
        accessibilityRole="button"
      >
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  dateStripContainer: {
    paddingVertical: SPACING.md,
  },
  scroll: { flex: 1 },
  content: {
    padding: SPACING.container,
  },
  sectionTitle: {
    fontSize: TYPOGRAPHY.sizes.heading3,
    fontWeight: TYPOGRAPHY.weights.semiBold,
    marginBottom: SPACING.lg,
  },
  card: {
    marginBottom: SPACING.gap,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: SPACING.xs,
  },
  cardTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
  },
  cardTitle: {
    fontSize: TYPOGRAPHY.sizes.body,
    fontWeight: TYPOGRAPHY.weights.semiBold,
  },
  cardDate: {
    fontSize: TYPOGRAPHY.sizes.bodySmall,
    marginBottom: SPACING.xs,
  },
  cardLocation: {
    fontSize: TYPOGRAPHY.sizes.caption,
    marginBottom: SPACING.sm,
  },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: SPACING.xs,
  },
  rsvpBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.xs,
  },
  rsvpDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  rsvpText: {
    fontSize: TYPOGRAPHY.sizes.caption,
    textTransform: "capitalize",
  },
  fab: {
    position: "absolute",
    right: SPACING.container,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.orange,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
});

export default SchedulerScreen;
