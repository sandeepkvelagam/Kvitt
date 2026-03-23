import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../api/client";
import { useTheme } from "../context/ThemeContext";
import {
  SPACE,
  LAYOUT,
  RADIUS,
  BUTTON_SIZE,
  AVATAR_SIZE,
  APPLE_TYPO,
} from "../styles/tokens";
import { COLORS, PAGE_HERO_GRADIENT, pageHeroGradientColors } from "../styles/liquidGlass";
import { appleCardShadowResting } from "../styles/appleShadows";
import { Title1, Title2, Headline, Subhead, Footnote, Caption2 } from "../components/ui";
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

const SCREEN_PAD = LAYOUT.screenPadding;

export function PendingRequestsScreen() {
  const { isDark, colors } = useTheme();
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();

  const [invites, setInvites] = useState<Invite[]>([]);
  const [eventInvites, setEventInvites] = useState<EventInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [responding, setResponding] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const backgroundColor = isDark ? COLORS.jetDark : colors.contentBg;

  const cardStyle = useMemo(
    () => ({
      backgroundColor: isDark ? "rgba(45, 45, 48, 0.9)" : "rgba(255, 255, 255, 0.95)",
      borderRadius: RADIUS.xl,
      borderWidth: 1,
      borderColor: isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.06)",
      ...appleCardShadowResting(isDark),
      padding: LAYOUT.cardPadding,
    }),
    [isDark]
  );

  const groupTint = useMemo(
    () => ({
      bg: isDark ? "rgba(10, 132, 255, 0.2)" : "rgba(0, 122, 255, 0.12)",
      fg: colors.trustBlue,
    }),
    [colors.trustBlue, isDark]
  );

  const eventTint = useMemo(
    () => ({
      bg: isDark ? "rgba(255, 159, 10, 0.2)" : "rgba(255, 159, 10, 0.14)",
      fg: colors.warning,
    }),
    [colors.warning, isDark]
  );

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

  React.useEffect(() => {
    fetchInvites();
  }, [fetchInvites]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await fetchInvites();
    } finally {
      setRefreshing(false);
    }
  }, [fetchInvites]);

  const respondGroup = useCallback(async (invite_id: string, action: "accept" | "decline") => {
    setResponding((prev) => ({ ...prev, [invite_id]: action }));
    try {
      await api.post(`/users/invites/${invite_id}/respond`, { action });
      setInvites((prev) => prev.filter((i) => i.invite_id !== invite_id));
    } catch {
      // optimistic rollback handled by clearing responding
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

  const allItems: ListItem[] = [
    ...invites.map((i) => ({ type: "group" as const, data: i })),
    ...eventInvites.map((i) => ({ type: "event" as const, data: i })),
  ];

  const formatEventDate = (iso: string) => {
    return new Date(iso).toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const renderGroupCard = (item: Invite) => {
    const groupInitial = (item.group_name || "G")[0].toUpperCase();
    const inviterName = item.inviter?.name || item.inviter?.email || "Someone";
    const isPending = responding[item.invite_id];

    return (
      <View style={cardStyle}>
        <View style={styles.cardGrid}>
          <View style={styles.avatarCol}>
            <View
              style={[
                styles.avatar,
                { backgroundColor: groupTint.bg, borderRadius: RADIUS.md },
              ]}
            >
              <Text style={[styles.avatarText, { color: groupTint.fg }]}>{groupInitial}</Text>
            </View>
          </View>

          <View style={styles.contentCol}>
            <View style={styles.titleRow}>
              <Headline numberOfLines={1} style={styles.titleFlex}>
                {item.group_name || "Unknown Group"}
              </Headline>
              <View style={[styles.badge, { backgroundColor: groupTint.bg }]}>
                <Ionicons name="people" size={10} color={groupTint.fg} />
                <Caption2 style={{ fontWeight: "600", color: groupTint.fg }}>Group</Caption2>
              </View>
            </View>

            <Footnote style={{ color: colors.textMuted }}>Invited by {inviterName}</Footnote>

            <View style={styles.actionRow}>
              <TouchableOpacity
                style={[
                  styles.declineBtn,
                  {
                    borderColor: colors.border,
                    backgroundColor: colors.inputBg,
                    minHeight: BUTTON_SIZE.compact.height,
                  },
                ]}
                onPress={() => respondGroup(item.invite_id, "decline")}
                activeOpacity={0.85}
                disabled={!!isPending}
              >
                {isPending === "decline" ? (
                  <ActivityIndicator size="small" color={colors.danger} />
                ) : (
                  <>
                    <Ionicons name="close" size={16} color={colors.danger} />
                    <Text style={[styles.btnText, { color: colors.danger }]}>Decline</Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.acceptBtn,
                  {
                    backgroundColor: colors.buttonPrimary,
                    minHeight: BUTTON_SIZE.compact.height,
                  },
                  !!isPending && styles.btnDisabled,
                ]}
                onPress={() => respondGroup(item.invite_id, "accept")}
                activeOpacity={0.85}
                disabled={!!isPending}
              >
                {isPending === "accept" ? (
                  <ActivityIndicator size="small" color={colors.buttonText} />
                ) : (
                  <>
                    <Ionicons name="checkmark" size={16} color={colors.buttonText} />
                    <Text style={[styles.btnText, { color: colors.buttonText }]}>Accept</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    );
  };

  const renderEventCard = (item: EventInvite) => {
    const key = `event_${item.invite_id}`;
    const isPending = responding[key];

    return (
      <View style={cardStyle}>
        <View style={styles.cardGrid}>
          <View style={styles.avatarCol}>
            <View
              style={[
                styles.avatar,
                { backgroundColor: eventTint.bg, borderRadius: RADIUS.md },
              ]}
            >
              <Ionicons name="game-controller" size={20} color={eventTint.fg} />
            </View>
          </View>

          <View style={styles.contentCol}>
            <View style={styles.titleRow}>
              <Headline numberOfLines={1} style={styles.titleFlex}>
                {item.title}
              </Headline>
              <View style={[styles.badge, { backgroundColor: eventTint.bg }]}>
                <Ionicons name="calendar-outline" size={10} color={eventTint.fg} />
                <Caption2 style={{ fontWeight: "600", color: eventTint.fg }}>Game</Caption2>
              </View>
            </View>

            <Footnote style={{ color: colors.textMuted }} numberOfLines={2}>
              {item.host_name} · {formatEventDate(item.starts_at)}
            </Footnote>

            <View style={styles.actionRow}>
              <TouchableOpacity
                style={[
                  styles.declineBtn,
                  {
                    borderColor: colors.border,
                    backgroundColor: colors.inputBg,
                    minHeight: BUTTON_SIZE.compact.height,
                  },
                ]}
                onPress={() => respondEvent(item, "declined")}
                activeOpacity={0.85}
                disabled={!!isPending}
              >
                {isPending === "declined" ? (
                  <ActivityIndicator size="small" color={colors.danger} />
                ) : (
                  <>
                    <Ionicons name="close" size={16} color={colors.danger} />
                    <Text style={[styles.btnText, { color: colors.danger }]}>Decline</Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.acceptBtn,
                  {
                    backgroundColor: colors.success,
                    minHeight: BUTTON_SIZE.compact.height,
                  },
                  !!isPending && styles.btnDisabled,
                ]}
                onPress={() => respondEvent(item, "accepted")}
                activeOpacity={0.85}
                disabled={!!isPending}
              >
                {isPending === "accepted" ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                    <Text style={[styles.btnText, { color: "#FFFFFF" }]}>{"I'm in"}</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    );
  };

  const renderItem = ({ item }: { item: ListItem }) =>
    item.type === "group" ? renderGroupCard(item.data) : renderEventCard(item.data);

  return (
    <View style={[styles.root, { backgroundColor }]} testID="pending-requests-screen">
      <LinearGradient
        pointerEvents="none"
        colors={pageHeroGradientColors(isDark)}
        locations={[...PAGE_HERO_GRADIENT.locations]}
        start={PAGE_HERO_GRADIENT.start}
        end={PAGE_HERO_GRADIENT.end}
        style={[
          styles.topGradient,
          {
            height: Math.min(PAGE_HERO_GRADIENT.maxHeight, insets.top + PAGE_HERO_GRADIENT.safeAreaPad),
          },
        ]}
      />

      <View style={styles.topChrome} pointerEvents="box-none">
        <View style={{ height: insets.top }} />
        <View style={styles.headerRow}>
          <Pressable
            style={({ pressed }) => [
              styles.backPill,
              {
                backgroundColor: colors.glassBg,
                borderColor: colors.glassBorder,
                opacity: pressed ? 0.85 : 1,
              },
            ]}
            onPress={() => navigation.goBack()}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          >
            <Ionicons name="chevron-back" size={22} color={colors.textPrimary} />
          </Pressable>
          <Title1 style={styles.screenTitle} numberOfLines={1}>
            Pending requests
          </Title1>
          <View style={styles.headerSpacer} />
        </View>
      </View>

      {error ? (
        <View
          style={[
            styles.errorBanner,
            {
              backgroundColor: isDark ? "rgba(255, 69, 58, 0.15)" : "rgba(255, 69, 58, 0.1)",
              borderColor: isDark ? "rgba(255, 69, 58, 0.4)" : "rgba(255, 69, 58, 0.3)",
            },
          ]}
        >
          <Ionicons name="alert-circle" size={18} color={colors.danger} />
          <Footnote style={{ flex: 1, color: colors.danger }}>{error}</Footnote>
        </View>
      ) : null}

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.orange} />
          <Footnote style={{ color: colors.textMuted, marginTop: SPACE.sm }}>Loading requests…</Footnote>
        </View>
      ) : allItems.length === 0 ? (
        <View style={styles.centered}>
          <View
            style={[
              styles.emptyIconWrap,
              { backgroundColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)" },
            ]}
          >
            <Ionicons name="mail-open-outline" size={32} color={colors.textMuted} />
          </View>
          <Title2 style={{ textAlign: "center", marginTop: SPACE.md }}>No pending requests</Title2>
          <Subhead style={{ textAlign: "center", color: colors.textSecondary, paddingHorizontal: SPACE.xl }}>
            Group and game invites will show up here.
          </Subhead>
        </View>
      ) : (
        <FlatList
          style={styles.listFlex}
          data={allItems}
          keyExtractor={(item) =>
            item.type === "group" ? item.data.invite_id : `evt_${item.data.invite_id}`
          }
          renderItem={renderItem}
          contentContainerStyle={[
            styles.list,
            { paddingBottom: Math.max(insets.bottom, SPACE.lg) + LAYOUT.sectionGap },
          ]}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={{ height: LAYOUT.elementGap }} />}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.orange}
              titleColor={colors.textSecondary}
              colors={[colors.orange]}
              progressBackgroundColor={isDark ? "#3A3A3C" : "#FFFFFF"}
              progressViewOffset={Platform.OS === "android" ? insets.top + 56 : undefined}
            />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  topGradient: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 0,
  },
  topChrome: {
    zIndex: 2,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: SCREEN_PAD,
    paddingTop: SPACE.md,
    paddingBottom: SPACE.sm,
  },
  backPill: {
    width: LAYOUT.touchTarget,
    height: LAYOUT.touchTarget,
    borderRadius: RADIUS.full,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
    marginRight: SPACE.sm,
  },
  screenTitle: {
    flex: 1,
    letterSpacing: -0.5,
  },
  headerSpacer: {
    width: LAYOUT.touchTarget,
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.sm,
    padding: SPACE.md,
    marginHorizontal: SCREEN_PAD,
    marginTop: SPACE.sm,
    borderRadius: RADIUS.lg,
    borderWidth: StyleSheet.hairlineWidth,
    zIndex: 1,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: SPACE.xl,
    zIndex: 1,
  },
  emptyIconWrap: {
    width: 64,
    height: 64,
    borderRadius: RADIUS.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  listFlex: {
    flex: 1,
    zIndex: 1,
  },
  list: {
    paddingHorizontal: SCREEN_PAD,
    paddingTop: SPACE.sm,
  },
  cardGrid: {
    flexDirection: "row",
    gap: LAYOUT.elementGap,
  },
  avatarCol: {
    alignSelf: "flex-start",
    paddingTop: 2,
  },
  avatar: {
    width: AVATAR_SIZE.md,
    height: AVATAR_SIZE.md,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    fontSize: APPLE_TYPO.title3.size,
    fontWeight: "700",
  },
  contentCol: {
    flex: 1,
    gap: SPACE.sm,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.sm,
  },
  titleFlex: {
    flex: 1,
    minWidth: 0,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: SPACE.sm,
    paddingVertical: 3,
    borderRadius: RADIUS.sm,
  },
  actionRow: {
    flexDirection: "row",
    gap: SPACE.md,
    marginTop: SPACE.xs,
  },
  declineBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    gap: SPACE.xs,
  },
  acceptBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: RADIUS.lg,
    gap: SPACE.xs,
  },
  btnText: {
    fontSize: APPLE_TYPO.subhead.size,
    fontWeight: "600",
  },
  btnDisabled: {
    opacity: 0.5,
  },
});
