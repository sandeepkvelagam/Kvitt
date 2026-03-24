import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  FlatList,
  TouchableOpacity,
  Pressable,
  Modal,
  Animated,
  RefreshControl,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Dimensions,
  ActivityIndicator,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
// @ts-ignore — optional dependency
import DateTimePicker from "@react-native-community/datetimepicker";

import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import {
  COLORS,
  SCHEDULE_COLORS,
  PAGE_HERO_GRADIENT,
  pageHeroGradientColors,
  TYPOGRAPHY,
  SPACING,
} from "../styles/liquidGlass";
import { SPACE, LAYOUT, RADIUS, APPLE_TYPO, BUTTON_SIZE } from "../styles/tokens";
import { appleCardShadowResting } from "../styles/appleShadows";
import { api } from "../api/client";
import {
  PageHeader,
  GlassSurface,
  GlassButton,
  GlassInput,
  SectionHeader,
  Subhead,
} from "../components/ui";
import type { RootStackParamList } from "../navigation/RootNavigator";

type Nav = NativeStackNavigationProp<RootStackParamList>;

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const SCREEN_PAD = LAYOUT.screenPadding;
const TAB_BAR_RESERVE = 128 + Math.max(48, 0);
const UPCOMING_CARD_W = Math.min(SCREEN_WIDTH * 0.72, 280);
const STORAGE_LAST_GROUP = "kvitt_scheduler_last_group_id";
const STORAGE_DRAFT = "kvitt_scheduler_draft_v1";

export type PlannerIntent =
  | "schedule_now"
  | "rematch_last"
  | "plan_weekend"
  | "resume_draft"
  | "use_last_setup";

interface PlanProposal {
  group_id: string;
  title: string;
  starts_at: string;
  duration_minutes: number;
  location: string | null;
  game_category: string;
  recurrence: string;
  default_buy_in: number | null;
  default_chips_per_buy_in: number;
  timezone: string;
  invite_scope: string;
}

// ─── Types ───────────────────────────────────────────────────────
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

interface GroupItem {
  group_id: string;
  name: string;
  member_count?: number;
}

interface InviteItem {
  invite_id: string;
  user_id: string;
  user_name: string;
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

// ─── Quick Schedule Tiles ────────────────────────────────────────
interface QuickTile {
  id: string;
  title: string;
  subtitle: string;
  day: number | null;
  time: string | null;
  game: string;
  buyIn: number | null;
  tag: string;
  tone: "purple" | "mint" | "amber" | "rose" | "slate" | "orange" | "blue";
  icon: keyof typeof Ionicons.glyphMap;
  headerColors: readonly [string, string];
  buttonColor: string;
}

const QUICK_TILES: QuickTile[] = [
  {
    id: "fri-poker", title: "Friday Night Poker", subtitle: "Every Friday",
    day: 5, time: "19:00", game: "poker", buyIn: 20, tag: "Popular", tone: "amber",
    icon: "diamond-outline",
    headerColors: ["rgba(245,158,11,0.30)", "rgba(238,108,41,0.05)"] as const,
    buttonColor: "#EE6C29",
  },
  {
    id: "sat-rummy", title: "Saturday Rummy", subtitle: "Every Saturday",
    day: 6, time: "20:00", game: "rummy", buyIn: 15, tag: "Classic", tone: "mint",
    icon: "albums-outline",
    headerColors: ["rgba(34,197,94,0.30)", "rgba(16,185,129,0.05)"] as const,
    buttonColor: "#22C55E",
  },
  {
    id: "sun-spades", title: "Sunday Spades", subtitle: "Every Sunday",
    day: 0, time: "18:00", game: "spades", buyIn: 10, tag: "Chill", tone: "blue",
    icon: "leaf-outline",
    headerColors: ["rgba(59,130,246,0.30)", "rgba(96,165,250,0.05)"] as const,
    buttonColor: "#3B82F6",
  },
  {
    id: "custom", title: "Custom Game Night", subtitle: "Your rules",
    day: null, time: null, game: "other", buyIn: null, tag: "Custom", tone: "rose",
    icon: "color-wand-outline",
    headerColors: ["rgba(244,63,94,0.30)", "rgba(236,72,153,0.05)"] as const,
    buttonColor: "#F43F5E",
  },
];

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const BUY_IN_OPTIONS = [5, 10, 15, 20, 50, 100];
const GAME_TYPES = [
  { value: "poker", label: "Poker" },
  { value: "rummy", label: "Rummy" },
  { value: "blackjack", label: "Blackjack" },
  { value: "spades", label: "Spades" },
  { value: "hearts", label: "Hearts" },
  { value: "bridge", label: "Bridge" },
  { value: "other", label: "Other" },
];

// ─── Helpers ─────────────────────────────────────────────────────
function getNextDayDate(dayOfWeek: number): Date {
  const now = new Date();
  const current = now.getDay();
  let diff = dayOfWeek - current;
  if (diff <= 0) diff += 7;
  const result = new Date(now);
  result.setDate(result.getDate() + diff);
  return result;
}

function formatTime(isoStr: string): string {
  return new Date(isoStr).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
}

function formatDate(isoStr: string): string {
  return new Date(isoStr).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function formatTileTime(timeStr: string): string {
  const [h, m] = timeStr.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  return `${h > 12 ? h - 12 : h === 0 ? 12 : h}:${String(m).padStart(2, "0")} ${ampm}`;
}

// ─── Component ───────────────────────────────────────────────────
export function SchedulerScreen() {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { isDark, colors } = useTheme();
  const { user } = useAuth();
  const { t } = useLanguage();

  // Data
  const [events, setEvents] = useState<EventItem[]>([]);
  const [groups, setGroups] = useState<GroupItem[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Agent-style planning
  const [planPhase, setPlanPhase] = useState<"idle" | "planning" | "proposal" | "error">("idle");
  const [proposal, setProposal] = useState<PlanProposal | null>(null);
  const [proposalSummary, setProposalSummary] = useState<string>("");
  const [proposalRationale, setProposalRationale] = useState<string>("");
  const [planError, setPlanError] = useState<string | null>(null);

  // Group picker
  const [groupPickerOpen, setGroupPickerOpen] = useState(false);

  // Create modal
  const [createOpen, setCreateOpen] = useState(false);
  const [activeTile, setActiveTile] = useState<QuickTile | null>(null);
  const [formDay, setFormDay] = useState<number>(5);
  const [formDate, setFormDate] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [formTime, setFormTime] = useState<Date>(new Date());
  const [formTitle, setFormTitle] = useState("");
  const [formGame, setFormGame] = useState("poker");
  const [formBuyIn, setFormBuyIn] = useState(20);
  const [formLocation, setFormLocation] = useState("");
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Detail modal
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailEvent, setDetailEvent] = useState<EventItem | null>(null);
  const [detailInvites, setDetailInvites] = useState<InviteItem[]>([]);
  const [detailStats, setDetailStats] = useState<Stats | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [rsvpLoading, setRsvpLoading] = useState(false);
  const [startingGame, setStartingGame] = useState(false);

  // Staggered animations
  const entranceAnim = useRef(new Animated.Value(0)).current;
  const tilesAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.stagger(120, [
      Animated.spring(entranceAnim, { toValue: 1, tension: 50, friction: 8, useNativeDriver: true }),
      Animated.spring(tilesAnim, { toValue: 1, tension: 50, friction: 8, useNativeDriver: true }),
    ]).start();
  }, []);

  useEffect(() => {
    if (selectedGroupId) {
      void AsyncStorage.setItem(STORAGE_LAST_GROUP, selectedGroupId);
    }
  }, [selectedGroupId]);

  // ─── Data fetching ───────────────────────────────────────────
  const fetchGroups = useCallback(async () => {
    try {
      const res = await api.get("/groups");
      const list = res.data.groups || res.data || [];
      setGroups(list);
      if (list.length === 0) return;
      const stored = await AsyncStorage.getItem(STORAGE_LAST_GROUP);
      setSelectedGroupId((prev) => {
        const inList = (id: string) => !!id && list.some((g: GroupItem) => g.group_id === id);
        if (inList(prev)) return prev;
        if (stored && inList(stored)) return stored;
        return list[0].group_id;
      });
    } catch (err) {
      console.error("Failed to fetch groups:", err);
    }
  }, []);

  const fetchEvents = useCallback(async () => {
    try {
      const res = await api.get("/events");
      setEvents(res.data.events || []);
    } catch (err) {
      console.error("Failed to fetch events:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { fetchGroups(); fetchEvents(); }, [fetchGroups, fetchEvents]));

  const onRefresh = () => { setRefreshing(true); fetchEvents(); };

  // ─── Create modal ────────────────────────────────────────────
  const openCreate = (tile: QuickTile) => {
    setActiveTile(tile);
    setFormTitle(tile.title);
    setFormGame(tile.game);
    setFormBuyIn(tile.buyIn ?? 20);
    setFormDay(tile.day ?? 5);
    setFormDate(getNextDayDate(tile.day ?? 5));
    setShowDatePicker(false);
    setFormLocation("");
    if (tile.time) {
      const [h, m] = tile.time.split(":").map(Number);
      const d = new Date(); d.setHours(h, m, 0, 0);
      setFormTime(d);
    } else {
      const d = new Date(); d.setHours(19, 0, 0, 0);
      setFormTime(d);
    }
    setCreateOpen(true);
  };

  const handleSchedule = async () => {
    if (!selectedGroupId) {
      Alert.alert("Select a group", "Please select a group first.");
      return;
    }
    try {
      setSubmitting(true);
      const eventDate = formDate ? new Date(formDate) : getNextDayDate(formDay);
      eventDate.setHours(formTime.getHours(), formTime.getMinutes(), 0, 0);

      await api.post("/events", {
        group_id: selectedGroupId,
        title: formTitle.trim() || "Game Night",
        starts_at: eventDate.toISOString(),
        duration_minutes: 180,
        location: formLocation.trim() || null,
        game_category: formGame,
        recurrence: "none",
        default_buy_in: formBuyIn,
        default_chips_per_buy_in: 20,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "America/New_York",
      });
      setCreateOpen(false);
      Alert.alert("Scheduled!", "Invites sent to all group members.");
      fetchEvents();
    } catch (err: any) {
      const msg = err.response?.data?.detail || "Failed to schedule";
      Alert.alert("Error", typeof msg === "string" ? msg : JSON.stringify(msg));
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Detail modal ────────────────────────────────────────────
  const openDetail = async (event: EventItem) => {
    setDetailEvent(event);
    setDetailOpen(true);
    setDetailLoading(true);
    try {
      const res = await api.get(`/occurrences/${event.occurrence_id}/invites`);
      setDetailInvites(res.data.invites || []);
      setDetailStats(res.data.stats || null);
    } catch (err) {
      console.error("Failed to fetch detail:", err);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleRSVP = async (status: string) => {
    if (!detailEvent) return;
    try {
      setRsvpLoading(true);
      await api.post(`/occurrences/${detailEvent.occurrence_id}/rsvp`, { status });
      Alert.alert("Done", `You responded: ${status}`);
      setDetailOpen(false);
      fetchEvents();
    } catch (err: any) {
      Alert.alert("Error", err.response?.data?.detail || "Failed to RSVP");
    } finally {
      setRsvpLoading(false);
    }
  };

  const handleStartGame = async () => {
    if (!detailEvent) return;
    try {
      setStartingGame(true);
      const res = await api.post(`/occurrences/${detailEvent.occurrence_id}/start-game`);
      setDetailOpen(false);
      navigation.navigate("GameNight" as any, { gameId: res.data.game_id });
    } catch (err: any) {
      Alert.alert("Error", err.response?.data?.detail || "Failed to start game");
    } finally {
      setStartingGame(false);
    }
  };

  const persistDraft = useCallback(async (p: PlanProposal) => {
    try {
      await AsyncStorage.setItem(STORAGE_DRAFT, JSON.stringify(p));
    } catch { /* ignore */ }
  }, []);

  const runIntent = useCallback(
    async (intent: PlannerIntent) => {
      if (!selectedGroupId) {
        Alert.alert(t.scheduler.selectGroup, t.scheduler.selectGroupFirst);
        return;
      }
      setPlanPhase("planning");
      setPlanError(null);
      setProposal(null);
      try {
        let draftPayload: Record<string, unknown> | null = null;
        if (intent === "resume_draft") {
          const raw = await AsyncStorage.getItem(STORAGE_DRAFT);
          if (raw) draftPayload = JSON.parse(raw) as Record<string, unknown>;
        }
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "America/New_York";
        const res = await api.post("/scheduler/plan", {
          intent,
          group_id: selectedGroupId,
          timezone: tz,
          draft: draftPayload,
        });
        const prop = res.data.proposal as PlanProposal;
        setProposal(prop);
        setProposalSummary(String(res.data.summary || ""));
        setProposalRationale(String(res.data.rationale || ""));
        setPlanPhase("proposal");
        await persistDraft(prop);
      } catch (err: unknown) {
        const ax = err as { response?: { data?: { detail?: string } } };
        const msg = ax.response?.data?.detail || t.scheduler.planError;
        setPlanError(typeof msg === "string" ? msg : t.scheduler.planError);
        setPlanPhase("error");
      }
    },
    [selectedGroupId, t.scheduler, persistDraft]
  );

  const confirmProposal = useCallback(async () => {
    if (!proposal) return;
    try {
      setSubmitting(true);
      await api.post("/events", {
        ...proposal,
        default_buy_in: proposal.default_buy_in ?? 20,
      });
      await AsyncStorage.removeItem(STORAGE_DRAFT);
      setProposal(null);
      setPlanPhase("idle");
      setProposalSummary("");
      setProposalRationale("");
      Alert.alert(t.scheduler.title, t.scheduler.scheduleAndInvite);
      fetchEvents();
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { detail?: string } } };
      const msg = ax.response?.data?.detail || "Failed";
      Alert.alert("Error", typeof msg === "string" ? msg : JSON.stringify(msg));
    } finally {
      setSubmitting(false);
    }
  }, [proposal, fetchEvents, t.scheduler]);

  const openAdjustFromProposal = useCallback(() => {
    if (!proposal) return;
    setActiveTile(null);
    setFormTitle(proposal.title);
    setFormGame(proposal.game_category || "poker");
    setFormBuyIn(proposal.default_buy_in != null ? Math.round(proposal.default_buy_in) : 20);
    setFormLocation(proposal.location || "");
    const d = new Date(proposal.starts_at);
    if (!Number.isNaN(d.getTime())) {
      setFormDate(d);
      setFormDay(d.getDay());
      setFormTime(d);
    }
    setCreateOpen(true);
    setProposal(null);
    setPlanPhase("idle");
    setProposalSummary("");
    setProposalRationale("");
  }, [proposal]);

  // ─── Helpers ─────────────────────────────────────────────────
  const selectedGroupName = groups.find(g => g.group_id === selectedGroupId)?.name || t.scheduler.selectGroup;
  const isHost = (event: EventItem) => event.host_id === user?.user_id;

  const getRsvpColor = (status: string | null): string => {
    switch (status) {
      case "accepted": return SCHEDULE_COLORS.accepted;
      case "declined": return SCHEDULE_COLORS.declined;
      case "maybe": return SCHEDULE_COLORS.maybe;
      default: return SCHEDULE_COLORS.invited;
    }
  };

  const getStatusIcon = (status: string): { name: keyof typeof Ionicons.glyphMap; color: string } => {
    switch (status) {
      case "accepted": return { name: "checkmark-circle", color: SCHEDULE_COLORS.accepted };
      case "declined": return { name: "close-circle", color: SCHEDULE_COLORS.declined };
      case "maybe": return { name: "help-circle", color: SCHEDULE_COLORS.maybe };
      default: return { name: "ellipse-outline", color: SCHEDULE_COLORS.invited };
    }
  };

  const backgroundColor = isDark ? COLORS.jetDark : colors.contentBg;
  const scrollBottomPad = TAB_BAR_RESERVE + Math.max(insets.bottom, 8) + SPACE.xl;
  const cardSurface = useMemo(
    () => ({
      backgroundColor: isDark ? "rgba(45, 45, 48, 0.9)" : "rgba(255, 255, 255, 0.95)",
      borderRadius: RADIUS.xl,
      borderWidth: 1,
      borderColor: isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.06)",
      ...appleCardShadowResting(isDark),
    }),
    [isDark]
  );
  const modalHandleBg = isDark ? "rgba(255,255,255,0.22)" : "rgba(0,0,0,0.12)";

  const intentRows: { intent: PlannerIntent; icon: keyof typeof Ionicons.glyphMap; label: string }[] = [
    { intent: "schedule_now", icon: "flash-outline", label: t.scheduler.intentScheduleNow },
    { intent: "rematch_last", icon: "repeat-outline", label: t.scheduler.intentRematch },
    { intent: "plan_weekend", icon: "calendar-outline", label: t.scheduler.intentWeekend },
    { intent: "resume_draft", icon: "document-text-outline", label: t.scheduler.intentResumeDraft },
    { intent: "use_last_setup", icon: "settings-outline", label: t.scheduler.intentLastSetup },
  ];

  // ─── Render ──────────────────────────────────────────────────
  return (
    <View style={[styles.container, { backgroundColor }]}>
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
      <View style={styles.bodyLift}>
      <Animated.View style={{
        opacity: entranceAnim,
        transform: [{ translateY: entranceAnim.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }],
        paddingTop: insets.top,
      }}>
        <PageHeader title={t.scheduler.title} onClose={() => navigation.goBack()} />
      </Animated.View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: scrollBottomPad }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* ── Group Selector ── */}
        <Animated.View style={{
          opacity: entranceAnim,
          transform: [{ translateY: entranceAnim.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }],
        }}>
          <Pressable
            style={({ pressed }) => [
              styles.groupSelector,
              cardSurface,
              { opacity: pressed ? 0.88 : 1, transform: [{ scale: pressed ? 0.99 : 1 }] },
            ]}
            onPress={() => setGroupPickerOpen(true)}
          >
            <Ionicons name="people-outline" size={20} color={colors.orange} />
            <Text style={[styles.groupSelectorText, { color: colors.textPrimary }]} numberOfLines={1}>
              {selectedGroupName}
            </Text>
            <Ionicons name="chevron-down" size={18} color={colors.textMuted} />
          </Pressable>
        </Animated.View>

        {/* ── Upcoming Games ── */}
        {events.length > 0 && (
          <Animated.View style={{
            opacity: entranceAnim,
            transform: [{ translateY: entranceAnim.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }],
          }}>
            <SectionHeader title={t.scheduler.upcoming} color={colors.textMuted} style={{ marginBottom: SPACE.md }} />
            <FlatList
              horizontal
              data={events.slice(0, 10)}
              keyExtractor={(item) => item.occurrence_id}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingRight: SPACE.md, gap: LAYOUT.elementGap }}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => openDetail(item)}
                  style={({ pressed }) => [
                    styles.upcomingCard,
                    cardSurface,
                    { width: UPCOMING_CARD_W, opacity: pressed ? 0.9 : 1 },
                  ]}
                  accessibilityLabel={`${item.title}, ${formatDate(item.starts_at)}, ${formatTime(item.starts_at)}`}
                >
                  <Text style={[styles.upcomingLabel, { color: colors.orange }]}>
                    {formatDate(item.starts_at).toUpperCase()}
                  </Text>
                  <Text style={[styles.upcomingTitle, { color: colors.textPrimary }]} numberOfLines={1}>
                    {item.title}
                  </Text>
                  <Text style={[styles.upcomingTime, { color: colors.textMuted }]}>
                    {formatTime(item.starts_at)}
                  </Text>
                  <View style={styles.rsvpBadge}>
                    <View style={[styles.rsvpDot, { backgroundColor: getRsvpColor(item.my_rsvp) }]} />
                    <Text style={[styles.rsvpText, { color: colors.textSecondary }]}>
                      {item.my_rsvp || t.scheduler.invited}
                    </Text>
                  </View>
                </Pressable>
              )}
            />
          </Animated.View>
        )}

        {/* ── Plan (agent-style) ── */}
        <Animated.View style={{
          opacity: tilesAnim,
          transform: [{ translateY: tilesAnim.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }],
          marginTop: LAYOUT.sectionGap,
        }}>
          <SectionHeader title={t.scheduler.planActions} color={colors.textMuted} style={{ marginBottom: SPACE.sm }} />
          <Subhead style={{ color: colors.textSecondary, marginBottom: SPACE.md, lineHeight: 22 }}>
            {t.scheduler.planChooseHint}
          </Subhead>

          {planPhase === "planning" && (
            <View style={{ paddingVertical: SPACE.lg, alignItems: "center", marginBottom: SPACE.md }}>
              <ActivityIndicator color={colors.orange} size="small" />
              <Text style={{ marginTop: SPACE.sm, color: colors.textMuted, fontSize: APPLE_TYPO.subhead.size }}>
                {t.scheduler.planning}
              </Text>
            </View>
          )}

          {planPhase === "error" && planError ? (
            <View style={[cardSurface, { padding: SPACE.lg, marginBottom: SPACE.md }]}>
              <Text style={{ color: colors.textSecondary, fontSize: APPLE_TYPO.body.size }}>{planError}</Text>
              <Pressable
                onPress={() => { setPlanPhase("idle"); setPlanError(null); }}
                style={({ pressed }) => [{ marginTop: SPACE.md, opacity: pressed ? 0.7 : 1 }]}
              >
                <Text style={{ color: colors.orange, fontSize: APPLE_TYPO.headline.size, fontWeight: "600" }}>OK</Text>
              </Pressable>
            </View>
          ) : null}

          {planPhase === "proposal" && proposal ? (
            <View style={[cardSurface, { padding: SPACE.lg, marginBottom: SPACE.lg }]}>
              <Text style={{ fontSize: APPLE_TYPO.caption.size, fontWeight: "600", color: colors.textMuted, textTransform: "uppercase", letterSpacing: 1 }}>
                {t.scheduler.proposalReady}
              </Text>
              <Text style={{ marginTop: SPACE.sm, fontSize: APPLE_TYPO.title3.size, fontWeight: "700", color: colors.textPrimary }}>
                {proposalSummary || proposal.title}
              </Text>
              {proposalRationale ? (
                <Subhead style={{ marginTop: SPACE.xs, opacity: 0.8 }}>{proposalRationale}</Subhead>
              ) : null}
              <Pressable
                onPress={confirmProposal}
                disabled={submitting}
                style={({ pressed }) => [
                  styles.primaryCta,
                  {
                    backgroundColor: colors.buttonPrimary,
                    marginTop: SPACE.lg,
                    opacity: submitting ? 0.5 : pressed ? 0.92 : 1,
                  },
                ]}
              >
                <Text style={[styles.primaryCtaText, { color: colors.buttonText }]}>
                  {submitting ? "…" : t.scheduler.confirmAndSend}
                </Text>
              </Pressable>
              <Pressable
                onPress={openAdjustFromProposal}
                style={({ pressed }) => [{ marginTop: SPACE.md, paddingVertical: SPACE.sm, opacity: pressed ? 0.7 : 1 }]}
              >
                <Text style={{ color: colors.orange, fontSize: APPLE_TYPO.headline.size, fontWeight: "600", textAlign: "center" }}>
                  {t.scheduler.adjust}
                </Text>
              </Pressable>
            </View>
          ) : null}

          <View style={styles.intentGrid}>
            {intentRows.map((row) => (
              <Pressable
                key={row.intent}
                onPress={() => runIntent(row.intent)}
                disabled={planPhase === "planning"}
                style={({ pressed }) => [
                  styles.intentCell,
                  cardSurface,
                  {
                    opacity: planPhase === "planning" ? 0.45 : pressed ? 0.88 : 1,
                    transform: [{ scale: pressed ? 0.98 : 1 }],
                  },
                ]}
              >
                <Ionicons name={row.icon} size={24} color={colors.textPrimary} />
                <Text style={[styles.intentLabel, { color: colors.textPrimary }]} numberOfLines={2}>
                  {row.label}
                </Text>
              </Pressable>
            ))}
          </View>

          <Pressable
            onPress={() => navigation.navigate("Automations" as never)}
            style={({ pressed }) => [
              cardSurface,
              {
                marginTop: SPACE.lg,
                paddingVertical: SPACE.md,
                paddingHorizontal: SPACE.lg,
                flexDirection: "row",
                alignItems: "center",
                gap: SPACE.sm,
                opacity: pressed ? 0.88 : 1,
              },
            ]}
          >
            <Ionicons name="sparkles-outline" size={22} color={colors.orange} />
            <Text style={{ flex: 1, fontSize: APPLE_TYPO.headline.size, fontWeight: "600", color: colors.textPrimary }}>
              {t.scheduler.automateFlows}
            </Text>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </Pressable>
        </Animated.View>

        {/* ── More options (templates) ── */}
        <Animated.View style={{
          opacity: tilesAnim,
          transform: [{ translateY: tilesAnim.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }],
          marginTop: LAYOUT.sectionGap,
        }}>
          <SectionHeader title={t.scheduler.moreOptions} color={colors.textMuted} style={{ marginBottom: SPACE.md }} />

          {QUICK_TILES.map((tile) => (
            <Pressable
              key={tile.id}
              onPress={() => openCreate(tile)}
              style={({ pressed }) => [{ marginBottom: SPACE.md, opacity: pressed ? 0.92 : 1 }]}
            >
              <View style={[styles.quickTileWrap, cardSurface, { overflow: "hidden" }]}>
                <LinearGradient
                  colors={[...tile.headerColors]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.tileHeaderBand}
                >
                  <View style={styles.tileHeaderTop}>
                    <View style={[styles.tileChip, { backgroundColor: "rgba(255,255,255,0.10)" }]}>
                      <Text style={[styles.tileChipText, { color: "rgba(255,255,255,0.7)" }]}>{tile.tag}</Text>
                    </View>
                    {tile.buyIn != null && (
                      <View style={[styles.tileChip, { backgroundColor: "rgba(255,255,255,0.10)" }]}>
                        <Text style={[styles.tilePriceText, { color: "rgba(255,255,255,0.9)" }]}>${tile.buyIn}</Text>
                      </View>
                    )}
                  </View>
                  <Ionicons name={tile.icon} size={36} color="rgba(255,255,255,0.20)" style={{ marginTop: SPACE.sm }} />
                </LinearGradient>
                <View style={styles.tileBody}>
                  <Text style={[styles.tileTitle, { color: colors.textPrimary }]}>{tile.title}</Text>
                  <Text style={[styles.tileSubtitle, { color: colors.textMuted }]}>
                    {tile.subtitle}
                    {tile.time ? ` · ${formatTileTime(tile.time)}` : ""}
                  </Text>
                  <View style={[styles.tileButton, { backgroundColor: tile.buttonColor }]}>
                    <Text style={styles.tileButtonText}>
                      {tile.id === "custom" ? t.scheduler.adjust : t.scheduler.intentScheduleNow}
                    </Text>
                  </View>
                </View>
              </View>
            </Pressable>
          ))}

          {!loading && events.length === 0 ? (
            <View style={[cardSurface, { padding: SPACE.lg, marginTop: SPACE.sm }]}>
              <Text style={{ color: colors.textMuted, textAlign: "center", fontSize: APPLE_TYPO.subhead.size }}>
                {t.scheduler.noUpcomingHint}
              </Text>
            </View>
          ) : null}

          <View style={{ height: scrollBottomPad > 120 ? 40 : 24 }} />
        </Animated.View>
      </ScrollView>
      </View>

      {/* ─── Group Picker Modal ─── */}
      <Modal visible={groupPickerOpen} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { backgroundColor: colors.contentBg, paddingBottom: insets.bottom + SPACE.lg }]}>
            <View style={[styles.modalHandle, { backgroundColor: modalHandleBg }]} />
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>{t.scheduler.selectGroup}</Text>
            <ScrollView style={{ maxHeight: 400 }}>
              {groups.map((group) => (
                <Pressable
                  key={group.group_id}
                  onPress={() => { setSelectedGroupId(group.group_id); setGroupPickerOpen(false); }}
                  style={({ pressed }) => [{ opacity: pressed ? 0.85 : 1 }]}
                >
                  <GlassSurface
                    style={styles.groupOption}
                    glowVariant={selectedGroupId === group.group_id ? "orange" : undefined}
                  >
                    <View style={styles.groupOptionRow}>
                      <View style={[styles.radio, selectedGroupId === group.group_id && styles.radioSelected, { borderColor: selectedGroupId === group.group_id ? COLORS.orange : colors.textMuted }]}>
                        {selectedGroupId === group.group_id && <View style={styles.radioInner} />}
                      </View>
                      <Text style={[styles.groupOptionText, { color: colors.textPrimary }]}>{group.name}</Text>
                    </View>
                  </GlassSurface>
                </Pressable>
              ))}
              {groups.length === 0 && (
                <Text style={{ color: colors.textMuted, textAlign: "center", marginTop: SPACE.lg, fontSize: APPLE_TYPO.subhead.size }}>
                  No groups found. Create a group first.
                </Text>
              )}
            </ScrollView>
            <GlassButton onPress={() => setGroupPickerOpen(false)} variant="secondary" size="medium" fullWidth style={{ marginTop: SPACE.lg }}>
              Cancel
            </GlassButton>
          </View>
        </View>
      </Modal>

      {/* ─── Create Event Modal ─── */}
      <Modal visible={createOpen} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ width: "100%" }}>
            <View style={[styles.modalSheet, { backgroundColor: colors.contentBg, maxHeight: "90%", paddingBottom: insets.bottom + SPACE.md }]}>
              <View style={[styles.modalHandle, { backgroundColor: modalHandleBg }]} />
              <ScrollView showsVerticalScrollIndicator={false}>
                <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
                  {activeTile?.title || "Schedule Game"}
                </Text>

                {/* Day chips (all 7) + calendar picker */}
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                  <Text style={[styles.fieldLabel, { color: colors.textMuted, marginBottom: 0 }]}>DAY</Text>
                  <TouchableOpacity
                    onPress={() => setShowDatePicker(true)}
                    style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingVertical: 4, paddingHorizontal: 8, borderRadius: RADIUS.lg, backgroundColor: colors.glassBg }}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="calendar-outline" size={16} color={activeTile?.buttonColor || COLORS.orange} />
                    <Text style={{ color: activeTile?.buttonColor || COLORS.orange, fontSize: TYPOGRAPHY.sizes.caption, fontWeight: TYPOGRAPHY.weights.medium }}>
                      Pick Date
                    </Text>
                  </TouchableOpacity>
                </View>
                <View style={[styles.chipRow, { marginTop: SPACING.sm }]}>
                  {DAY_LABELS.map((label, idx) => (
                    <TouchableOpacity
                      key={idx}
                      onPress={() => {
                        setFormDay(idx);
                        setFormDate(getNextDayDate(idx));
                      }}
                      style={[
                        styles.chip,
                        formDay === idx
                          ? { backgroundColor: activeTile?.buttonColor || COLORS.orange }
                          : { backgroundColor: colors.glassBg, borderWidth: 1, borderColor: colors.glassBorder },
                      ]}
                    >
                      <Text style={[styles.chipText, { color: formDay === idx ? "#fff" : colors.textPrimary }]}>{label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                {formDate && (
                  <Text style={{ color: colors.textSecondary, fontSize: TYPOGRAPHY.sizes.bodySmall, marginTop: SPACING.sm }}>
                    {formDate.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                  </Text>
                )}
                {showDatePicker && (
                  <DateTimePicker
                    value={formDate || new Date()}
                    mode="date"
                    display="spinner"
                    minimumDate={new Date()}
                    onChange={(_: any, selected: Date | undefined) => {
                      setShowDatePicker(false);
                      if (selected) {
                        setFormDate(selected);
                        setFormDay(selected.getDay());
                      }
                    }}
                  />
                )}

                {/* Time */}
                <Text style={[styles.fieldLabel, { color: colors.textMuted, marginTop: SPACING.lg }]}>TIME</Text>
                <TouchableOpacity onPress={() => setShowTimePicker(true)}>
                  <GlassSurface style={styles.pickerCard}>
                    <Ionicons name="time-outline" size={20} color={activeTile?.buttonColor || COLORS.orange} />
                    <Text style={[styles.pickerText, { color: colors.textPrimary }]}>
                      {formTime.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })}
                    </Text>
                  </GlassSurface>
                </TouchableOpacity>
                {showTimePicker && (
                  <DateTimePicker
                    value={formTime}
                    mode="time"
                    display="spinner"
                    onChange={(_: any, selected: Date | undefined) => {
                      setShowTimePicker(false);
                      if (selected) setFormTime(selected);
                    }}
                  />
                )}

                {/* Title */}
                <GlassInput label="Title" placeholder="Friday Night Poker" value={formTitle} onChangeText={setFormTitle} />

                {/* Game type */}
                <Text style={[styles.fieldLabel, { color: colors.textMuted, marginTop: SPACING.lg }]}>GAME TYPE</Text>
                <View style={styles.chipRow}>
                  {GAME_TYPES.map((gt) => (
                    <TouchableOpacity
                      key={gt.value}
                      onPress={() => setFormGame(gt.value)}
                      style={[
                        styles.chip,
                        formGame === gt.value
                          ? { backgroundColor: activeTile?.buttonColor || COLORS.orange }
                          : { backgroundColor: colors.glassBg, borderWidth: 1, borderColor: colors.glassBorder },
                      ]}
                    >
                      <Text style={[styles.chipText, { color: formGame === gt.value ? "#fff" : colors.textPrimary }]}>{gt.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Buy-in */}
                <Text style={[styles.fieldLabel, { color: colors.textMuted, marginTop: SPACING.lg }]}>BUY-IN</Text>
                <View style={styles.chipRow}>
                  {BUY_IN_OPTIONS.map((amount) => (
                    <TouchableOpacity
                      key={amount}
                      onPress={() => setFormBuyIn(amount)}
                      style={[
                        styles.chip,
                        formBuyIn === amount
                          ? { backgroundColor: activeTile?.buttonColor || COLORS.orange }
                          : { backgroundColor: colors.glassBg, borderWidth: 1, borderColor: colors.glassBorder },
                      ]}
                    >
                      <Text style={[styles.chipText, { color: formBuyIn === amount ? "#fff" : colors.textPrimary }]}>${amount}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Location */}
                <View style={{ marginTop: SPACING.md }}>
                  <GlassInput label="Location (optional)" placeholder="e.g., Jake's place" value={formLocation} onChangeText={setFormLocation} />
                </View>

                {/* Group preview */}
                <GlassSurface style={{ marginTop: SPACING.lg }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: SPACING.sm }}>
                    <Ionicons name="people-outline" size={18} color={activeTile?.buttonColor || COLORS.orange} />
                    <Text style={{ color: colors.textSecondary, fontSize: TYPOGRAPHY.sizes.bodySmall }}>
                      Invites sent to: {selectedGroupName}
                    </Text>
                  </View>
                </GlassSurface>

                <View style={{ height: SPACING.xl }} />
              </ScrollView>

              {/* Actions */}
              <View style={styles.modalActions}>
                <GlassButton onPress={() => setCreateOpen(false)} variant="secondary" size="medium" style={{ flex: 1, marginRight: SPACING.sm }}>
                  Cancel
                </GlassButton>
                <TouchableOpacity
                  onPress={handleSchedule}
                  disabled={submitting}
                  style={[styles.scheduleButton, { backgroundColor: activeTile?.buttonColor || COLORS.orange, opacity: submitting ? 0.5 : 1 }]}
                  activeOpacity={0.8}
                >
                  <Text style={styles.scheduleButtonText}>
                    {submitting ? "Scheduling..." : "Schedule & Invite"}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* ─── Event Detail Modal ─── */}
      <Modal visible={detailOpen} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { backgroundColor: colors.contentBg, maxHeight: "85%", paddingBottom: insets.bottom + SPACE.lg }]}>
            <View style={[styles.modalHandle, { backgroundColor: modalHandleBg }]} />
            {detailEvent && (
              <ScrollView showsVerticalScrollIndicator={false}>
                <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
                  {detailEvent.title}
                </Text>
                <View style={{ flexDirection: "row", gap: SPACING.md, marginBottom: SPACING.md }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: SPACING.xs }}>
                    <Ionicons name="calendar-outline" size={16} color={COLORS.orange} />
                    <Text style={{ color: colors.textSecondary, fontSize: TYPOGRAPHY.sizes.bodySmall }}>
                      {formatDate(detailEvent.starts_at)}
                    </Text>
                  </View>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: SPACING.xs }}>
                    <Ionicons name="time-outline" size={16} color={COLORS.orange} />
                    <Text style={{ color: colors.textSecondary, fontSize: TYPOGRAPHY.sizes.bodySmall }}>
                      {formatTime(detailEvent.starts_at)}
                    </Text>
                  </View>
                </View>
                {detailEvent.location && (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: SPACING.xs, marginBottom: SPACING.md }}>
                    <Ionicons name="location-outline" size={16} color={COLORS.orange} />
                    <Text style={{ color: colors.textMuted, fontSize: TYPOGRAPHY.sizes.bodySmall }}>
                      {detailEvent.location}
                    </Text>
                  </View>
                )}

                {detailLoading ? (
                  <GlassSurface>
                    <Text style={{ color: colors.textMuted }}>Loading...</Text>
                  </GlassSurface>
                ) : isHost(detailEvent) ? (
                  <>
                    {detailStats && (
                      <GlassSurface style={{ marginBottom: SPACING.lg }}>
                        <View style={styles.statsRow}>
                          {([
                            { label: "In", count: detailStats.accepted, color: SCHEDULE_COLORS.accepted },
                            { label: "Maybe", count: detailStats.maybe, color: SCHEDULE_COLORS.maybe },
                            { label: "Out", count: detailStats.declined, color: SCHEDULE_COLORS.declined },
                            { label: "Pending", count: detailStats.invited + (detailStats.no_response || 0), color: SCHEDULE_COLORS.invited },
                          ]).map((s) => (
                            <View key={s.label} style={styles.statItem}>
                              <View style={[styles.statDot, { backgroundColor: s.color }]} />
                              <Text style={[styles.statCount, { color: colors.textPrimary }]}>{s.count}</Text>
                              <Text style={[styles.statLabel, { color: colors.textMuted }]}>{s.label}</Text>
                            </View>
                          ))}
                        </View>
                      </GlassSurface>
                    )}

                    <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>RESPONSES</Text>
                    {detailInvites.map((inv) => {
                      const icon = getStatusIcon(inv.status);
                      return (
                        <GlassSurface key={inv.invite_id} style={{ marginBottom: SPACING.xs }}>
                          <View style={{ flexDirection: "row", alignItems: "center", gap: SPACING.md }}>
                            <Ionicons name={icon.name} size={20} color={icon.color} />
                            <Text style={{ flex: 1, color: colors.textPrimary, fontSize: TYPOGRAPHY.sizes.body }}>
                              {inv.user_name}
                            </Text>
                            <Text style={{ color: icon.color, fontSize: TYPOGRAPHY.sizes.caption, textTransform: "capitalize" }}>
                              {inv.status}
                            </Text>
                          </View>
                        </GlassSurface>
                      );
                    })}

                    <TouchableOpacity
                      onPress={handleStartGame}
                      disabled={startingGame}
                      style={[styles.scheduleButton, { backgroundColor: COLORS.orange, marginTop: SPACING.xl, opacity: startingGame ? 0.5 : 1 }]}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="play" size={20} color="#fff" />
                      <Text style={styles.scheduleButtonText}>
                        {startingGame ? "Starting..." : "Start Game"}
                      </Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <>
                    <Text style={[styles.fieldLabel, { color: colors.textMuted, marginBottom: SPACING.md }]}>
                      YOUR RESPONSE
                    </Text>
                    <View style={{ gap: SPACING.sm }}>
                      <TouchableOpacity
                        onPress={() => handleRSVP("accepted")}
                        style={[styles.rsvpButton, { backgroundColor: "#22C55E" }]}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="checkmark-circle" size={20} color="#fff" />
                        <Text style={styles.rsvpButtonText}>I'm In</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => handleRSVP("maybe")}
                        style={[styles.rsvpButton, { backgroundColor: "#F59E0B" }]}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="help-circle-outline" size={20} color="#fff" />
                        <Text style={styles.rsvpButtonText}>Maybe</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => handleRSVP("declined")}
                        style={[styles.rsvpButton, { backgroundColor: "#EF4444" }]}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="close-circle-outline" size={20} color="#fff" />
                        <Text style={styles.rsvpButtonText}>Can't Make It</Text>
                      </TouchableOpacity>
                    </View>
                  </>
                )}
                <View style={{ height: SPACING.xl }} />
              </ScrollView>
            )}
            <GlassButton onPress={() => setDetailOpen(false)} variant="secondary" size="medium" fullWidth>
              Close
            </GlassButton>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────
const INTENT_CELL_W = (SCREEN_WIDTH - LAYOUT.screenPadding * 2 - LAYOUT.elementGap) / 2;

const styles = StyleSheet.create({
  container: { flex: 1 },
  topGradient: { position: "absolute", top: 0, left: 0, right: 0, zIndex: 0 },
  bodyLift: { flex: 1, zIndex: 1 },
  scroll: { flex: 1 },
  content: { paddingHorizontal: SCREEN_PAD },

  groupSelector: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.sm,
    paddingHorizontal: SPACE.lg,
    minHeight: LAYOUT.touchTarget,
    paddingVertical: SPACE.sm,
    borderRadius: RADIUS.lg,
    marginBottom: LAYOUT.sectionGap,
  },
  groupSelectorText: {
    flex: 1,
    fontSize: APPLE_TYPO.body.size,
    fontWeight: "500",
  },

  upcomingCard: {
    padding: SPACE.lg,
    minHeight: 120,
  },
  upcomingLabel: {
    fontSize: APPLE_TYPO.caption2.size,
    fontWeight: "700",
    letterSpacing: 1.2,
    marginBottom: SPACE.xs,
  },
  upcomingTitle: {
    fontSize: APPLE_TYPO.headline.size,
    fontWeight: "600",
    marginBottom: 2,
  },
  upcomingTime: {
    fontSize: APPLE_TYPO.footnote.size,
    marginBottom: SPACE.xs,
  },
  rsvpBadge: { flexDirection: "row", alignItems: "center", gap: SPACE.xs },
  rsvpDot: { width: 8, height: 8, borderRadius: 4 },
  rsvpText: { fontSize: APPLE_TYPO.caption.size, textTransform: "capitalize" },

  intentGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: LAYOUT.elementGap,
  },
  intentCell: {
    width: INTENT_CELL_W,
    minHeight: BUTTON_SIZE.compact.height + SPACE.md,
    paddingVertical: SPACE.md,
    paddingHorizontal: SPACE.sm,
    borderRadius: RADIUS.xl,
    alignItems: "center",
    justifyContent: "center",
    gap: SPACE.sm,
  },
  intentLabel: {
    fontSize: APPLE_TYPO.footnote.size,
    fontWeight: "600",
    textAlign: "center",
  },

  primaryCta: {
    minHeight: BUTTON_SIZE.regular.height,
    borderRadius: RADIUS.lg,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: SPACE.lg,
  },
  primaryCtaText: {
    fontSize: APPLE_TYPO.headline.size,
    fontWeight: "600",
  },

  quickTileWrap: {
    borderRadius: RADIUS.xl,
  },
  tileHeaderBand: {
    height: 100,
    paddingHorizontal: SPACE.lg,
    paddingTop: SPACE.lg,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
  },
  tileHeaderTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  tileChip: {
    paddingHorizontal: SPACE.sm + 2,
    paddingVertical: 3,
    borderRadius: RADIUS.full,
  },
  tileChipText: {
    fontSize: APPLE_TYPO.caption2.size,
    fontWeight: "500",
  },
  tilePriceText: {
    fontSize: APPLE_TYPO.caption2.size,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  tileBody: {
    padding: SPACE.lg,
    paddingTop: SPACE.md,
  },
  tileTitle: {
    fontSize: APPLE_TYPO.title3.size,
    fontWeight: "700",
    marginBottom: SPACE.xs,
  },
  tileSubtitle: {
    fontSize: APPLE_TYPO.subhead.size,
    marginBottom: SPACE.md,
  },
  tileButton: {
    paddingVertical: SPACE.md,
    borderRadius: RADIUS.lg,
    alignItems: "center",
    justifyContent: "center",
    minHeight: LAYOUT.touchTarget,
  },
  tileButtonText: {
    color: "#fff",
    fontSize: APPLE_TYPO.subhead.size,
    fontWeight: "600",
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
    alignItems: "center",
  },
  modalSheet: {
    width: "100%",
    borderTopLeftRadius: RADIUS.sheet,
    borderTopRightRadius: RADIUS.sheet,
    paddingHorizontal: LAYOUT.screenPadding,
    paddingTop: SPACE.md,
  },
  modalHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: SPACE.lg,
  },
  modalTitle: {
    fontSize: APPLE_TYPO.title2.size,
    fontWeight: "700",
    marginBottom: SPACE.lg,
  },
  modalActions: {
    flexDirection: "row",
    paddingTop: SPACE.md,
    gap: SPACE.sm,
  },

  fieldLabel: {
    fontSize: APPLE_TYPO.caption2.size,
    fontWeight: "600",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginBottom: SPACE.sm,
  },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: SPACE.sm },
  chip: {
    minHeight: LAYOUT.touchTarget,
    paddingHorizontal: SPACE.md,
    paddingVertical: SPACE.sm,
    borderRadius: RADIUS.lg,
    justifyContent: "center",
  },
  chipText: {
    fontSize: APPLE_TYPO.caption.size,
    fontWeight: "500",
  },
  pickerCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.md,
    marginBottom: SPACE.md,
    minHeight: LAYOUT.touchTarget,
  },
  pickerText: { fontSize: APPLE_TYPO.body.size },

  scheduleButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACE.sm,
    paddingVertical: SPACE.lg,
    borderRadius: RADIUS.lg,
    flex: 2,
    minHeight: LAYOUT.touchTarget,
  },
  scheduleButtonText: {
    color: "#fff",
    fontSize: APPLE_TYPO.body.size,
    fontWeight: "600",
  },

  rsvpButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACE.sm,
    paddingVertical: SPACE.lg,
    borderRadius: RADIUS.lg,
    minHeight: LAYOUT.touchTarget,
  },
  rsvpButtonText: {
    color: "#fff",
    fontSize: APPLE_TYPO.body.size,
    fontWeight: "600",
  },

  groupOption: { marginBottom: SPACE.sm, minHeight: LAYOUT.touchTarget, justifyContent: "center" },
  groupOptionRow: { flexDirection: "row", alignItems: "center", gap: SPACE.md },
  groupOptionText: { fontSize: APPLE_TYPO.body.size, fontWeight: "500" },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  radioSelected: {},
  radioInner: { width: 12, height: 12, borderRadius: 6, backgroundColor: COLORS.orange },

  statsRow: { flexDirection: "row", justifyContent: "space-around" },
  statItem: { alignItems: "center", gap: SPACE.xs },
  statDot: { width: 10, height: 10, borderRadius: 5 },
  statCount: { fontSize: APPLE_TYPO.title2.size, fontWeight: "700" },
  statLabel: { fontSize: APPLE_TYPO.caption.size },
});

export default SchedulerScreen;
