import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
  RefreshControl,
  Alert,
} from "react-native";
import { useNavigation, useRoute, RouteProp, useFocusEffect } from "@react-navigation/native";
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
import { PageHeader, GlassSurface, GlassButton } from "../components/ui";
import type { RootStackParamList } from "../navigation/RootNavigator";

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, "EventDashboard">;

interface InviteItem {
  invite_id: string;
  user_id: string;
  user_name: string;
  user_picture: string | null;
  status: string;
  responded_at: string | null;
  notes: string | null;
}

interface Stats {
  accepted: number;
  declined: number;
  maybe: number;
  invited: number;
  no_response: number;
  total: number;
}

export function EventDashboardScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { user } = useAuth();

  const occurrenceId = (route.params as any)?.occurrenceId;

  const [invites, setInvites] = useState<InviteItem[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [eventTitle, setEventTitle] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [startingGame, setStartingGame] = useState(false);

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

  const fetchInvites = useCallback(async () => {
    if (!occurrenceId) return;
    try {
      const response = await api.get(
        `/occurrences/${occurrenceId}/invites`
      );
      const data = response.data;
      setInvites(data.invites || []);
      setStats(data.stats || null);
      if (data.event_id) {
        try {
          const eventRes = await api.get(`/events/${data.event_id}`);
          setEventTitle(eventRes.data.title || "Game Night");
        } catch {}
      }
    } catch (err) {
      console.error("Failed to fetch invites:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [occurrenceId]);

  useFocusEffect(
    useCallback(() => {
      fetchInvites();
    }, [fetchInvites])
  );

  const handleStartGame = async () => {
    try {
      setStartingGame(true);
      const response = await api.post(
        `/occurrences/${occurrenceId}/start-game`
      );
      const gameId = response.data.game_id;
      Alert.alert("Game Started", "The game has been created.", [
        {
          text: "Go to Game",
          onPress: () =>
            navigation.navigate("GameNight" as any, { gameId }),
        },
      ]);
    } catch (err: any) {
      const msg = err.response?.data?.detail || "Failed to start game";
      Alert.alert("Error", typeof msg === "string" ? msg : JSON.stringify(msg));
    } finally {
      setStartingGame(false);
    }
  };

  const getStatusIcon = (
    status: string
  ): { name: string; color: string } => {
    switch (status) {
      case "accepted":
        return { name: "checkmark-circle", color: SCHEDULE_COLORS.accepted };
      case "declined":
        return { name: "close-circle", color: SCHEDULE_COLORS.declined };
      case "maybe":
        return { name: "help-circle", color: SCHEDULE_COLORS.maybe };
      case "proposed_new_time":
        return { name: "time", color: SCHEDULE_COLORS.proposed };
      default:
        return { name: "ellipse-outline", color: SCHEDULE_COLORS.invited };
    }
  };

  const statusLabel = (status: string): string => {
    switch (status) {
      case "accepted": return "Accepted";
      case "declined": return "Declined";
      case "maybe": return "Maybe";
      case "proposed_new_time": return "Proposed time";
      case "no_response": return "No response";
      default: return "Invited";
    }
  };

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: colors.background, paddingTop: insets.top },
      ]}
    >
      <Animated.View
        style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}
      >
        <PageHeader
          title={eventTitle || "Event Dashboard"}
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
            onRefresh={() => {
              setRefreshing(true);
              fetchInvites();
            }}
          />
        }
      >
        <Animated.View
          style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}
        >
          {/* Stats summary */}
          {stats && (
            <GlassSurface style={styles.statsCard}>
              <View style={styles.statsRow}>
                <View style={styles.statItem}>
                  <View
                    style={[
                      styles.statDot,
                      { backgroundColor: SCHEDULE_COLORS.accepted },
                    ]}
                  />
                  <Text style={[styles.statCount, { color: colors.textPrimary }]}>
                    {stats.accepted}
                  </Text>
                  <Text style={[styles.statLabel, { color: colors.textMuted }]}>
                    Accepted
                  </Text>
                </View>
                <View style={styles.statItem}>
                  <View
                    style={[
                      styles.statDot,
                      { backgroundColor: SCHEDULE_COLORS.maybe },
                    ]}
                  />
                  <Text style={[styles.statCount, { color: colors.textPrimary }]}>
                    {stats.maybe}
                  </Text>
                  <Text style={[styles.statLabel, { color: colors.textMuted }]}>
                    Maybe
                  </Text>
                </View>
                <View style={styles.statItem}>
                  <View
                    style={[
                      styles.statDot,
                      { backgroundColor: SCHEDULE_COLORS.declined },
                    ]}
                  />
                  <Text style={[styles.statCount, { color: colors.textPrimary }]}>
                    {stats.declined}
                  </Text>
                  <Text style={[styles.statLabel, { color: colors.textMuted }]}>
                    Declined
                  </Text>
                </View>
                <View style={styles.statItem}>
                  <View
                    style={[
                      styles.statDot,
                      { backgroundColor: SCHEDULE_COLORS.invited },
                    ]}
                  />
                  <Text style={[styles.statCount, { color: colors.textPrimary }]}>
                    {stats.invited + (stats.no_response || 0)}
                  </Text>
                  <Text style={[styles.statLabel, { color: colors.textMuted }]}>
                    Waiting
                  </Text>
                </View>
              </View>
            </GlassSurface>
          )}

          {/* Invite list */}
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
            Responses
          </Text>

          {loading ? (
            <GlassSurface>
              <Text style={{ color: colors.textMuted }}>Loading...</Text>
            </GlassSurface>
          ) : (
            invites.map((invite) => {
              const icon = getStatusIcon(invite.status);
              return (
                <GlassSurface key={invite.invite_id} style={styles.inviteCard}>
                  <View style={styles.inviteRow}>
                    <Ionicons
                      name={icon.name as any}
                      size={22}
                      color={icon.color}
                    />
                    <View style={{ flex: 1 }}>
                      <Text
                        style={[
                          styles.inviteName,
                          { color: colors.textPrimary },
                        ]}
                      >
                        {invite.user_name}
                      </Text>
                      {invite.notes && (
                        <Text
                          style={[
                            styles.inviteNote,
                            { color: colors.textMuted },
                          ]}
                        >
                          "{invite.notes}"
                        </Text>
                      )}
                    </View>
                    <Text
                      style={[
                        styles.inviteStatus,
                        { color: icon.color },
                      ]}
                    >
                      {statusLabel(invite.status)}
                    </Text>
                  </View>
                </GlassSurface>
              );
            })
          )}

          {/* Action buttons */}
          <View style={styles.actions}>
            <GlassButton
              onPress={handleStartGame}
              variant="primary"
              size="large"
              fullWidth
              loading={startingGame}
              disabled={startingGame}
              leftIcon={
                <Ionicons name="play" size={20} color="#fff" />
              }
            >
              Start Game
            </GlassButton>
          </View>

          <View style={{ height: 50 }} />
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flex: 1 },
  content: { padding: SPACING.container },
  statsCard: { marginBottom: SPACING.lg },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
  },
  statItem: {
    alignItems: "center",
    gap: SPACING.xs,
  },
  statDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  statCount: {
    fontSize: TYPOGRAPHY.sizes.heading2,
    fontWeight: TYPOGRAPHY.weights.bold,
  },
  statLabel: {
    fontSize: TYPOGRAPHY.sizes.caption,
  },
  sectionTitle: {
    fontSize: TYPOGRAPHY.sizes.heading3,
    fontWeight: TYPOGRAPHY.weights.semiBold,
    marginBottom: SPACING.md,
  },
  inviteCard: {
    marginBottom: SPACING.sm,
  },
  inviteRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
  },
  inviteName: {
    fontSize: TYPOGRAPHY.sizes.body,
    fontWeight: TYPOGRAPHY.weights.medium,
  },
  inviteNote: {
    fontSize: TYPOGRAPHY.sizes.caption,
    fontStyle: "italic",
    marginTop: 2,
  },
  inviteStatus: {
    fontSize: TYPOGRAPHY.sizes.caption,
    fontWeight: TYPOGRAPHY.weights.semiBold,
  },
  actions: {
    marginTop: SPACING.xl,
    gap: SPACING.md,
  },
});

export default EventDashboardScreen;
