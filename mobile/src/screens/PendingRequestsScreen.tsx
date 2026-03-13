import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  SectionList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../api/client";
import { useTheme } from "../context/ThemeContext";
import { useLanguage } from "../context/LanguageContext";
import { getThemedColors } from "../styles/liquidGlass";
import { PageHeader, GlassSurface } from "../components/ui";
import type { RootStackParamList } from "../navigation/RootNavigator";

type Nav = NativeStackNavigationProp<RootStackParamList>;

type Invite = {
  invite_id: string;
  group_id: string;
  group_name?: string;
  inviter?: { name?: string; email?: string };
  status: string;
};

type EventInvite = {
  invite_id: string;
  occurrence_id: string;
  event_id: string;
  title: string;
  starts_at: string;
  host_name: string;
  group_id: string;
  status: string;
};

type ListItem =
  | { type: "group"; data: Invite }
  | { type: "event"; data: EventInvite };


export function PendingRequestsScreen() {
  const { isDark, colors } = useTheme();
  const { t } = useLanguage();
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();

  const lc = getThemedColors(isDark, colors);

  const [invites, setInvites] = useState<Invite[]>([]);
  const [eventInvites, setEventInvites] = useState<EventInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [responding, setResponding] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const fetchInvites = useCallback(async () => {
    try {
      setError(null);
      const [groupRes, eventRes] = await Promise.all([
        api.get("/users/invites").catch(() => ({ data: [] })),
        api.get("/events/my-invites").catch(() => ({ data: [] })),
      ]);
      setInvites(groupRes.data || []);
      setEventInvites(eventRes.data || []);
    } catch (e: any) {
      setError(e?.response?.data?.detail || e?.message || "Requests unavailable.");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => { fetchInvites(); }, [fetchInvites]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchInvites();
    setRefreshing(false);
  }, [fetchInvites]);

  const respondGroup = useCallback(async (invite_id: string, action: "accept" | "decline") => {
    setResponding((prev) => ({ ...prev, [invite_id]: action }));
    try {
      await api.post(`/users/invites/${invite_id}/respond`, { action });
      setInvites((prev) => prev.filter((i) => i.invite_id !== invite_id));
    } catch (e: any) {
      // silently remove optimistic state on error
    } finally {
      setResponding((prev) => {
        const next = { ...prev };
        delete next[invite_id];
        return next;
      });
    }
  }, []);

  const respondEvent = useCallback(async (item: EventInvite, status: "accepted" | "declined") => {
    const key = `event_${item.invite_id}`;
    setResponding((prev) => ({ ...prev, [key]: status }));
    try {
      await api.post(`/occurrences/${item.occurrence_id}/rsvp`, { status });
      setEventInvites((prev) => prev.filter((i) => i.invite_id !== item.invite_id));
    } catch (e: any) {
      Alert.alert("Error", e?.response?.data?.detail || "Failed to respond");
    } finally {
      setResponding((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  }, []);

  // Merge into a single list with type tags
  const allItems: ListItem[] = [
    ...invites.map((i) => ({ type: "group" as const, data: i })),
    ...eventInvites.map((i) => ({ type: "event" as const, data: i })),
  ];

  const formatEventDate = (iso: string) => {
    return new Date(iso).toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  const renderItem = ({ item }: { item: ListItem }) => {
    if (item.type === "group") {
      return renderGroupCard(item.data);
    }
    return renderEventCard(item.data);
  };

  // ── reui grid layout: avatar left column spanning rows, content right ──
  const renderGroupCard = (item: Invite) => {
    const groupInitial = (item.group_name || "G")[0].toUpperCase();
    const inviterName = item.inviter?.name || item.inviter?.email || "Someone";
    const isPending = responding[item.invite_id];

    return (
      <GlassSurface style={styles.card}>
        <View style={styles.cardGrid}>
          {/* Avatar — left column, spans full height */}
          <View style={styles.avatarCol}>
            <View style={[styles.avatar, { backgroundColor: "rgba(59,130,246,0.15)" }]}>
              <Text style={[styles.avatarText, { color: lc.trustBlue }]}>{groupInitial}</Text>
            </View>
          </View>

          {/* Content — right column */}
          <View style={styles.contentCol}>
            {/* Row 1: Title + Badge */}
            <View style={styles.titleRow}>
              <Text style={[styles.title, { color: lc.textPrimary }]} numberOfLines={1}>
                {item.group_name || "Unknown Group"}
              </Text>
              <View style={[styles.badge, { backgroundColor: "rgba(59,130,246,0.15)" }]}>
                <Ionicons name="people" size={10} color={lc.trustBlue} />
                <Text style={[styles.badgeText, { color: lc.trustBlue }]}>Group Invite</Text>
              </View>
            </View>

            {/* Row 2: Description */}
            <Text style={[styles.description, { color: lc.textMuted }]}>
              Invited by {inviterName}
            </Text>

            {/* Row 3: Actions */}
            <View style={styles.actionRow}>
              <TouchableOpacity
                style={[styles.declineBtn, { borderColor: "rgba(239,68,68,0.4)" }]}
                onPress={() => respondGroup(item.invite_id, "decline")}
                activeOpacity={0.8}
                disabled={!!isPending}
              >
                {isPending === "decline" ? (
                  <ActivityIndicator size="small" color={lc.danger} />
                ) : (
                  <>
                    <Ionicons name="close" size={14} color={lc.danger} />
                    <Text style={[styles.btnText, { color: lc.danger }]}>Decline</Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.acceptBtn, { backgroundColor: lc.trustBlue }, !!isPending && styles.btnDisabled]}
                onPress={() => respondGroup(item.invite_id, "accept")}
                activeOpacity={0.8}
                disabled={!!isPending}
              >
                {isPending === "accept" ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons name="checkmark" size={14} color="#fff" />
                    <Text style={[styles.btnText, { color: "#fff" }]}>Accept</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </GlassSurface>
    );
  };

  const renderEventCard = (item: EventInvite) => {
    const eventInitial = (item.title || "G")[0].toUpperCase();
    const key = `event_${item.invite_id}`;
    const isPending = responding[key];

    return (
      <GlassSurface style={styles.card}>
        <View style={styles.cardGrid}>
          {/* Avatar — left column */}
          <View style={styles.avatarCol}>
            <View style={[styles.avatar, { backgroundColor: "rgba(245,158,11,0.15)" }]}>
              <Ionicons name="game-controller" size={20} color="#F59E0B" />
            </View>
          </View>

          {/* Content — right column */}
          <View style={styles.contentCol}>
            {/* Row 1: Title + Badge */}
            <View style={styles.titleRow}>
              <Text style={[styles.title, { color: lc.textPrimary }]} numberOfLines={1}>
                {item.title}
              </Text>
              <View style={[styles.badge, { backgroundColor: "rgba(245,158,11,0.15)" }]}>
                <Ionicons name="game-controller-outline" size={10} color="#F59E0B" />
                <Text style={[styles.badgeText, { color: "#F59E0B" }]}>Game Invite</Text>
              </View>
            </View>

            {/* Row 2: Description */}
            <Text style={[styles.description, { color: lc.textMuted }]}>
              {item.host_name} scheduled for {formatEventDate(item.starts_at)}
            </Text>

            {/* Row 3: Actions */}
            <View style={styles.actionRow}>
              <TouchableOpacity
                style={[styles.declineBtn, { borderColor: "rgba(239,68,68,0.4)" }]}
                onPress={() => respondEvent(item, "declined")}
                activeOpacity={0.8}
                disabled={!!isPending}
              >
                {isPending === "declined" ? (
                  <ActivityIndicator size="small" color={lc.danger} />
                ) : (
                  <>
                    <Ionicons name="close" size={14} color={lc.danger} />
                    <Text style={[styles.btnText, { color: lc.danger }]}>Decline</Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.acceptBtn, { backgroundColor: "#22C55E" }, !!isPending && styles.btnDisabled]}
                onPress={() => respondEvent(item, "accepted")}
                activeOpacity={0.8}
                disabled={!!isPending}
              >
                {isPending === "accepted" ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons name="checkmark" size={14} color="#fff" />
                    <Text style={[styles.btnText, { color: "#fff" }]}>I'm In</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </GlassSurface>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: lc.jetDark, paddingTop: insets.top }]}>
      <PageHeader title="Pending Requests" onClose={() => navigation.goBack()} />

      {error && (
        <View style={[styles.errorBanner, { borderColor: "rgba(239,68,68,0.3)" }]}>
          <Ionicons name="alert-circle" size={16} color={lc.danger} />
          <Text style={[styles.errorText, { color: lc.danger }]}>{error}</Text>
        </View>
      )}

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={lc.orange} />
          <Text style={[styles.loadingText, { color: lc.textMuted }]}>Loading requests...</Text>
        </View>
      ) : allItems.length === 0 ? (
        <View style={styles.centered}>
          <Ionicons name="mail-open-outline" size={56} color={lc.textMuted} />
          <Text style={[styles.emptyTitle, { color: lc.textSecondary }]}>No Pending Requests</Text>
          <Text style={[styles.emptySubtext, { color: lc.textMuted }]}>
            Group invites and game invites will appear here
          </Text>
        </View>
      ) : (
        <FlatList
          data={allItems}
          keyExtractor={(item) =>
            item.type === "group" ? item.data.invite_id : `evt_${item.data.invite_id}`
          }
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={lc.orange} />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(239,68,68,0.1)",
    padding: 14,
    marginHorizontal: 20,
    marginTop: 12,
    borderRadius: 16,
    gap: 10,
    borderWidth: 1,
  },
  errorText: { fontSize: 13, flex: 1 },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 32,
  },
  loadingText: { fontSize: 14, marginTop: 8 },
  emptyTitle: { fontSize: 20, fontWeight: "600", marginTop: 8 },
  emptySubtext: { fontSize: 14, textAlign: "center", lineHeight: 20 },
  list: { padding: 16, gap: 12 },

  // ── reui grid card ──
  card: {
    padding: 0,
  },
  cardGrid: {
    flexDirection: "row",
    gap: 12,
  },
  avatarCol: {
    alignSelf: "flex-start",
    paddingTop: 2,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: { fontSize: 18, fontWeight: "700" },
  contentCol: {
    flex: 1,
    gap: 6,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: "600",
    flexShrink: 1,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  badgeText: { fontSize: 10, fontWeight: "600" },
  description: {
    fontSize: 13,
    lineHeight: 18,
  },
  actionRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 4,
  },
  declineBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1.5,
    gap: 5,
  },
  acceptBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: 10,
    gap: 5,
  },
  btnText: { fontSize: 13, fontWeight: "600" },
  btnDisabled: { opacity: 0.5 },
});
