import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
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
  useWindowDimensions,
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
  SPACING,
} from "../styles/liquidGlass";
import { SPACE, LAYOUT, RADIUS, FONT, BUTTON_SIZE, APPLE_TYPO } from "../styles/tokens";
import { appleCardShadowResting, appleTileShadow } from "../styles/appleShadows";
import { categoryIconForGame } from "../utils/gameCategoryIcon";
import { normalizeRsvpStats, pendingInviteCount } from "../utils/rsvpStats";
import { api } from "../api/client";
import {
  GlassSurface,
  GlassButton,
  GlassInput,
  Body,
  Headline,
  Subhead,
  Title1,
  Title2,
  Caption2,
  Footnote,
  Label,
  PokerAIFeatureCTA,
} from "../components/ui";
import type { RootStackParamList } from "../navigation/RootNavigator";

type Nav = NativeStackNavigationProp<RootStackParamList>;

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const SCREEN_PAD = LAYOUT.screenPadding;
const UPCOMING_CARD_WIDTH = Math.min(SCREEN_WIDTH * 0.78, 320);
const UPCOMING_CARD_MIN_HEIGHT = 128;
const UPCOMING_GAP = LAYOUT.elementGap;
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

interface EventRsvpStats {
  accepted: number;
  declined: number;
  maybe: number;
  invited: number;
  proposed_new_time?: number;
  no_response: number;
  total: number;
}

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
  rsvp_stats?: EventRsvpStats | null;
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
  proposed_new_time?: number;
}

interface QuickTile {
  id: string;
  title: string;
  subtitle: string;
  day: number | null;
  time: string | null;
  game: string;
  buyIn: number | null;
  icon: keyof typeof Ionicons.glyphMap;
}

const QUICK_TILES: QuickTile[] = [
  { id: "fri-poker", title: "Friday Poker", subtitle: "7 PM", day: 5, time: "19:00", game: "poker", buyIn: 20, icon: "diamond-outline" },
  { id: "sat-rummy", title: "Saturday Rummy", subtitle: "8 PM", day: 6, time: "20:00", game: "rummy", buyIn: 15, icon: "albums-outline" },
  { id: "sun-spades", title: "Sunday Spades", subtitle: "6 PM", day: 0, time: "18:00", game: "spades", buyIn: 10, icon: "leaf-outline" },
  { id: "custom", title: "Custom Game", subtitle: "Pick date & time", day: null, time: null, game: "other", buyIn: null, icon: "color-wand-outline" },
];

const CUSTOM_QUICK_TILE = QUICK_TILES.find((t) => t.id === "custom")!;

function templatePresetGradient(tileId: string, isDark: boolean): readonly [string, string] {
  if (isDark) {
    switch (tileId) {
      case "fri-poker": return ["rgba(245, 158, 11, 0.14)", "rgba(45, 45, 48, 0.96)"];
      case "sat-rummy": return ["rgba(52, 199, 89, 0.11)", "rgba(45, 45, 48, 0.96)"];
      case "sun-spades": return ["rgba(10, 132, 255, 0.12)", "rgba(45, 45, 48, 0.96)"];
      default: return ["rgba(45, 45, 48, 0.92)", "rgba(45, 45, 48, 0.96)"];
    }
  }
  switch (tileId) {
    case "fri-poker": return ["rgba(245, 158, 11, 0.16)", "rgba(255, 255, 255, 0.97)"];
    case "sat-rummy": return ["rgba(52, 199, 89, 0.12)", "rgba(255, 255, 255, 0.97)"];
    case "sun-spades": return ["rgba(0, 122, 255, 0.10)", "rgba(255, 255, 255, 0.97)"];
    default: return ["rgba(255, 255, 255, 0.95)", "rgba(255, 255, 255, 0.97)"];
  }
}

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

function schedulerRsvpPillLabel(
  myRsvp: string | null,
  tr: { accepted: string; declined: string; maybe: string; invited: string }
): string {
  switch (myRsvp) {
    case "accepted":
      return tr.accepted;
    case "declined":
      return tr.declined;
    case "maybe":
      return tr.maybe;
    default:
      return tr.invited;
  }
}

export function SchedulerScreen() {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const { isDark, colors } = useTheme();
  const { user } = useAuth();
  const { t } = useLanguage();

  /** Fixed sheet height so ScrollView + footer layout like iOS form sheets (scroll middle, sticky actions). */
  const createEventSheetHeight = useMemo(
    () => Math.round(Math.min(windowHeight * 0.88, windowHeight - insets.top - 16)),
    [windowHeight, insets.top]
  );

  const [events, setEvents] = useState<EventItem[]>([]);
  const [groups, setGroups] = useState<GroupItem[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [planPhase, setPlanPhase] = useState<"idle" | "planning" | "proposal" | "error">("idle");
  const [proposal, setProposal] = useState<PlanProposal | null>(null);
  const [proposalSummary, setProposalSummary] = useState<string>("");
  const [planError, setPlanError] = useState<string | null>(null);

  const [groupPickerOpen, setGroupPickerOpen] = useState(false);

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

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailEvent, setDetailEvent] = useState<EventItem | null>(null);
  const [detailInvites, setDetailInvites] = useState<InviteItem[]>([]);
  const [detailStats, setDetailStats] = useState<Stats | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [rsvpLoading, setRsvpLoading] = useState(false);
  const [startingGame, setStartingGame] = useState(false);

  const entranceAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(entranceAnim, { toValue: 1, tension: 50, friction: 8, useNativeDriver: true }).start();
  }, []);

  useEffect(() => {
    if (selectedGroupId) {
      void AsyncStorage.setItem(STORAGE_LAST_GROUP, selectedGroupId);
    }
  }, [selectedGroupId]);

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
      const raw = (res.data.events || []) as Array<
        EventItem & { rsvp_stats?: unknown; rsvpStats?: unknown }
      >;
      setEvents(
        raw.map((ev) => {
          const normalized = normalizeRsvpStats(ev.rsvp_stats ?? ev.rsvpStats);
          return {
            ...ev,
            rsvp_stats: normalized ?? null,
          };
        })
      );
    } catch (err) {
      console.error("Failed to fetch events:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void fetchGroups();
      void fetchEvents();
    }, [fetchGroups, fetchEvents]),
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void fetchEvents();
  }, [fetchEvents]);

  const openCreate = (tile: QuickTile) => {
    setActiveTile(tile);
    setFormTitle(tile.id === "custom" ? "" : tile.title);
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
      Alert.alert("Select a Group", "Choose which group to invite.");
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
      Alert.alert("Scheduled", "Invites sent to all members.");
      fetchEvents();
    } catch (err: any) {
      const msg = err.response?.data?.detail || "Failed to schedule";
      Alert.alert("Error", typeof msg === "string" ? msg : JSON.stringify(msg));
    } finally {
      setSubmitting(false);
    }
  };

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
        Alert.alert("Select a Group", "Choose which group to schedule for.");
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
        setPlanPhase("proposal");
        await persistDraft(prop);
      } catch (err: unknown) {
        const ax = err as { response?: { data?: { detail?: string } } };
        const msg = ax.response?.data?.detail || "Unable to generate suggestion";
        setPlanError(typeof msg === "string" ? msg : "Something went wrong");
        setPlanPhase("error");
      }
    },
    [selectedGroupId, persistDraft]
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
      Alert.alert("Scheduled", "Invites sent to all members.");
      fetchEvents();
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { detail?: string } } };
      const msg = ax.response?.data?.detail || "Failed";
      Alert.alert("Error", typeof msg === "string" ? msg : JSON.stringify(msg));
    } finally {
      setSubmitting(false);
    }
  }, [proposal, fetchEvents]);

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
  }, [proposal]);

  const selectedGroupName = groups.find(g => g.group_id === selectedGroupId)?.name || "Select Group";
  const isHost = (event: EventItem) => event.host_id === user?.user_id;

  const getStatusIcon = (status: string): { name: keyof typeof Ionicons.glyphMap; color: string } => {
    switch (status) {
      case "accepted": return { name: "checkmark-circle", color: SCHEDULE_COLORS.accepted };
      case "declined": return { name: "close-circle", color: SCHEDULE_COLORS.declined };
      case "maybe": return { name: "help-circle", color: SCHEDULE_COLORS.maybe };
      default: return { name: "ellipse-outline", color: SCHEDULE_COLORS.invited };
    }
  };

  const backgroundColor = isDark ? COLORS.jetDark : colors.contentBg;
  const scrollBottomPad = insets.bottom + LAYOUT.sectionGap + SPACE.lg;

  const cardSurface = useMemo(() => ({
    backgroundColor: isDark ? "rgba(45, 45, 48, 0.9)" : "rgba(255, 255, 255, 0.95)",
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.06)",
    ...appleCardShadowResting(isDark),
  }), [isDark]);

  const cardSmStyle = useMemo(() => ({
    ...cardSurface,
    borderRadius: RADIUS.lg,
  }), [cardSurface]);

  const quickActionTileStyle = useMemo(
    () => ({
      borderRadius: RADIUS.xl,
      borderWidth: 1,
      borderColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.08)",
      backgroundColor: isDark ? "rgba(45,45,48,0.98)" : "rgba(255,255,255,0.98)",
      ...appleTileShadow(isDark),
    }),
    [isDark]
  );

  /** Same neutral ring pad as Dashboard V3 metrics (`triRingOuter` / `metricRingPad`). */
  const metricRingPad = useMemo(
    () => ({
      padBg: isDark ? "rgba(168, 182, 215, 0.1)" : "rgba(88, 102, 138, 0.07)",
      rimBorder: isDark ? "rgba(255, 255, 255, 0.09)" : "rgba(0, 0, 0, 0.07)",
    }),
    [isDark]
  );

  const modalHandleBg = isDark ? "rgba(255,255,255,0.22)" : "rgba(0,0,0,0.12)";

  // Simplified quick actions
  const quickActions: { intent: PlannerIntent; icon: keyof typeof Ionicons.glyphMap; label: string }[] = [
    { intent: "schedule_now", icon: "flash-outline", label: "Quick Game" },
    { intent: "rematch_last", icon: "repeat-outline", label: "Rematch" },
    { intent: "plan_weekend", icon: "sunny-outline", label: "Weekend" },
  ];

  return (
    <View style={[styles.container, { backgroundColor }]}>
      <LinearGradient
        pointerEvents="none"
        colors={pageHeroGradientColors(isDark)}
        locations={[...PAGE_HERO_GRADIENT.locations]}
        start={PAGE_HERO_GRADIENT.start}
        end={PAGE_HERO_GRADIENT.end}
        style={[styles.topGradient, { height: Math.min(PAGE_HERO_GRADIENT.maxHeight, insets.top + PAGE_HERO_GRADIENT.safeAreaPad) }]}
      />
      
      <View style={styles.bodyLift}>
        <Animated.View
          style={{
            opacity: entranceAnim,
            transform: [{ translateY: entranceAnim.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }],
          }}
        >
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
                accessibilityRole="button"
                accessibilityLabel="Back"
              >
                <Ionicons name="chevron-back" size={22} color={colors.textPrimary} />
              </Pressable>
              <Title1 style={styles.screenTitle} numberOfLines={1}>
                {t.scheduler.title}
              </Title1>
              <View style={styles.headerFlexSpacer} />
            </View>
          </View>
        </Animated.View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.content, { paddingBottom: scrollBottomPad }]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.orange}
              colors={[colors.orange]}
              progressBackgroundColor={isDark ? "#3A3A3C" : "#FFFFFF"}
            />
          }
        >
          {/* ── Group Selector ── */}
          <Animated.View style={{ opacity: entranceAnim }}>
            <Pressable
              style={({ pressed }) => [
                styles.groupSelector,
                cardSmStyle,
                { opacity: pressed ? 0.88 : 1 },
              ]}
              onPress={() => setGroupPickerOpen(true)}
            >
              <Ionicons name="people-outline" size={20} color={colors.textSecondary} />
              <Headline numberOfLines={1} style={{ flex: 1, color: colors.textPrimary }}>
                {selectedGroupName}
              </Headline>
              <Ionicons name="chevron-down" size={18} color={colors.textMuted} />
            </Pressable>
          </Animated.View>

          {/* ── Quick Actions ── */}
          <Animated.View style={{ opacity: entranceAnim, marginTop: SPACE.xl }}>
            <Title2 style={[styles.sectionTitle, { color: colors.textPrimary }]}>Quick Schedule</Title2>

            {planPhase === "planning" ? (
              <View style={[cardSurface, styles.planningCard]}>
                <ActivityIndicator color={colors.orange} size="small" />
                <Subhead style={{ color: colors.textSecondary }}>Finding the best time…</Subhead>
              </View>
            ) : planPhase === "proposal" && proposal ? (
              <View style={[cardSurface, styles.proposalCard]}>
                <View style={styles.proposalHeader}>
                  <Ionicons name="sparkles" size={16} color={colors.orange} />
                  <Caption2 style={{ color: colors.orange }}>SUGGESTED</Caption2>
                </View>
                <Headline style={{ color: colors.textPrimary }}>{proposalSummary || proposal.title}</Headline>
                <Footnote style={{ color: colors.textSecondary, marginTop: SPACE.xs }}>
                  {formatDate(proposal.starts_at)} · {formatTime(proposal.starts_at)}
                </Footnote>
                <View style={styles.proposalActions}>
                  <Pressable
                    onPress={confirmProposal}
                    disabled={submitting}
                    style={({ pressed }) => [
                      styles.proposalConfirm,
                      { backgroundColor: colors.buttonPrimary, opacity: submitting ? 0.5 : pressed ? 0.9 : 1 },
                    ]}
                  >
                    <Subhead bold style={{ color: colors.buttonText }}>
                      {submitting ? "Sending…" : "Confirm"}
                    </Subhead>
                  </Pressable>
                  <Pressable
                    onPress={openAdjustFromProposal}
                    style={({ pressed }) => [
                      styles.proposalAdjust,
                      { borderColor: colors.border, opacity: pressed ? 0.8 : 1 },
                    ]}
                  >
                    <Subhead bold style={{ color: colors.textPrimary }}>Adjust</Subhead>
                  </Pressable>
                </View>
              </View>
            ) : planPhase === "error" ? (
              <Pressable
                onPress={() => { setPlanPhase("idle"); setPlanError(null); }}
                style={[cardSmStyle, styles.errorCard]}
              >
                <Footnote style={{ color: colors.textSecondary }}>{planError}</Footnote>
              </Pressable>
            ) : (
              <View style={styles.quickActionsRow}>
                {quickActions.map((action, qIdx) => (
                  <Pressable
                    key={action.intent}
                    onPress={() => runIntent(action.intent)}
                    style={({ pressed }) => [
                      styles.quickActionCell,
                      quickActionTileStyle,
                      { opacity: pressed ? 0.85 : 1 },
                    ]}
                  >
                    <View
                      style={[
                        styles.metricIconRingOuter,
                        {
                          backgroundColor: metricRingPad.padBg,
                          borderColor: metricRingPad.rimBorder,
                        },
                      ]}
                    >
                      <View
                        style={[
                          styles.metricIconRingInner,
                          { backgroundColor: quickActionTileStyle.backgroundColor as string },
                        ]}
                      >
                        <Ionicons
                          name={action.icon}
                          size={18}
                          color={
                            qIdx === 1
                              ? isDark
                                ? "rgba(255, 149, 0, 0.95)"
                                : "#FF9500"
                              : colors.textSecondary
                          }
                        />
                      </View>
                    </View>
                    <Headline style={{ color: colors.textPrimary, textAlign: "center" }}>{action.label}</Headline>
                  </Pressable>
                ))}
              </View>
            )}
          </Animated.View>

          {/* ── Upcoming Events ── */}
          {events.length > 0 && (
            <Animated.View style={{ opacity: entranceAnim, marginTop: SPACE.xl }}>
              <Title2 style={[styles.sectionTitle, { color: colors.textPrimary }]}>{t.scheduler.upcoming}</Title2>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                decelerationRate="fast"
                snapToInterval={UPCOMING_CARD_WIDTH + UPCOMING_GAP}
                snapToAlignment="start"
                contentContainerStyle={styles.upcomingScrollContent}
              >
                {events.slice(0, 8).map((item) => {
                  const upcomingInnerBg = isDark ? "rgba(255,255,255,0.08)" : "#F2F2F7";
                  return (
                  <Pressable
                    key={item.occurrence_id}
                    onPress={() => openDetail(item)}
                    style={({ pressed }) => [
                      styles.upcomingCard,
                      cardSmStyle,
                      {
                        width: UPCOMING_CARD_WIDTH,
                        minHeight: UPCOMING_CARD_MIN_HEIGHT,
                        opacity: pressed ? 0.9 : 1,
                        padding: SPACE.md,
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.upcomingInnerBlock,
                        { backgroundColor: upcomingInnerBg },
                      ]}
                    >
                      <View style={styles.upcomingRowInner}>
                        <View
                          style={[
                            styles.metricIconRingOuter,
                            {
                              backgroundColor: metricRingPad.padBg,
                              borderColor: metricRingPad.rimBorder,
                            },
                          ]}
                        >
                          <View
                            style={[
                              styles.metricIconRingInner,
                              { backgroundColor: upcomingInnerBg },
                            ]}
                          >
                            <Ionicons
                              name={categoryIconForGame(item.game_category)}
                              size={18}
                              color={colors.textSecondary}
                            />
                          </View>
                        </View>
                        <View style={styles.upcomingCardTextCol}>
                          <Headline numberOfLines={1} style={{ color: colors.textPrimary }}>
                            {item.title}
                          </Headline>
                          <Footnote numberOfLines={2} style={{ color: colors.textSecondary, marginTop: SPACE.xs }}>
                            {[formatDate(item.starts_at), formatTime(item.starts_at), item.location?.trim() || null]
                              .filter(Boolean)
                              .join(" · ")}
                          </Footnote>
                          {(() => {
                            const s = item.rsvp_stats;
                            if (!s) return null;
                            const hasInvites =
                              s.total > 0 ||
                              s.accepted > 0 ||
                              s.declined > 0 ||
                              s.maybe > 0 ||
                              s.invited > 0 ||
                              s.no_response > 0;
                            if (!hasInvites) return null;
                            const pending = pendingInviteCount(s);
                            return (
                              <View style={styles.rsvpCountsRow}>
                                <Text
                                  style={{
                                    fontSize: APPLE_TYPO.footnote.size,
                                    lineHeight: 18,
                                    fontWeight: "600",
                                    color: SCHEDULE_COLORS.accepted,
                                  }}
                                >
                                  {s.accepted}
                                </Text>
                                <Text
                                  style={{
                                    fontSize: APPLE_TYPO.footnote.size,
                                    lineHeight: 18,
                                    color: colors.textSecondary,
                                  }}
                                >
                                  {` ${t.scheduler.upcomingRsvpAcceptedWord} · `}
                                </Text>
                                <Text
                                  style={{
                                    fontSize: APPLE_TYPO.footnote.size,
                                    lineHeight: 18,
                                    color: colors.textMuted,
                                  }}
                                >
                                  {pending}
                                </Text>
                                <Text
                                  style={{
                                    fontSize: APPLE_TYPO.footnote.size,
                                    lineHeight: 18,
                                    color: colors.textMuted,
                                  }}
                                >
                                  {` ${t.scheduler.upcomingRsvpPendingWord}`}
                                </Text>
                              </View>
                            );
                          })()}
                          <View
                            style={[
                              styles.upcomingStatusPill,
                              {
                                backgroundColor:
                                  item.my_rsvp === "accepted"
                                    ? "rgba(52,199,89,0.15)"
                                    : isDark
                                      ? "rgba(255,149,0,0.15)"
                                      : "rgba(255,149,0,0.12)",
                              },
                            ]}
                          >
                            <Caption2
                              style={{
                                color:
                                  item.my_rsvp === "accepted"
                                    ? SCHEDULE_COLORS.accepted
                                    : colors.textSecondary,
                              }}
                            >
                              {schedulerRsvpPillLabel(item.my_rsvp, t.scheduler).toUpperCase()}
                            </Caption2>
                          </View>
                        </View>
                      </View>
                    </View>
                  </Pressable>
                  );
                })}
              </ScrollView>
            </Animated.View>
          )}

          {/* ── Templates ── */}
          <Animated.View style={{ opacity: entranceAnim, marginTop: SPACE.lg }}>
            <Title2 style={[styles.sectionTitle, { color: colors.textPrimary }]}>New Game</Title2>
            <View style={styles.templateGrid}>
              {QUICK_TILES.map((tile) => (
                <Pressable
                  key={tile.id}
                  onPress={() => openCreate(tile)}
                  style={({ pressed }) => [
                    styles.templateCell,
                    cardSmStyle,
                    { opacity: pressed ? 0.88 : 1 },
                  ]}
                >
                  <LinearGradient
                    pointerEvents="none"
                    colors={[...templatePresetGradient(tile.id, isDark)]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={StyleSheet.absoluteFillObject}
                  />
                  <View style={styles.templateCellInner}>
                    <View
                      style={[
                        styles.metricIconRingOuter,
                        styles.templateIconRingWrap,
                        {
                          backgroundColor: metricRingPad.padBg,
                          borderColor: metricRingPad.rimBorder,
                        },
                      ]}
                    >
                      <View
                        style={[
                          styles.metricIconRingInner,
                          { backgroundColor: cardSurface.backgroundColor as string },
                        ]}
                      >
                        <Ionicons name={tile.icon} size={18} color={colors.textSecondary} />
                      </View>
                    </View>
                    <Headline numberOfLines={1} style={{ color: colors.textPrimary, textAlign: "center" }}>
                      {tile.title}
                    </Headline>
                    <Caption2 numberOfLines={1} style={{ color: colors.textMuted, textAlign: "center", marginTop: 1 }}>
                      {tile.subtitle}
                    </Caption2>
                  </View>
                </Pressable>
              ))}
            </View>
          </Animated.View>

          {/* ── Automations (same scroll as rest of screen) ── */}
          <Animated.View style={{ opacity: entranceAnim, marginTop: SPACE.lg }}>
            <PokerAIFeatureCTA
              onPress={() => navigation.navigate("Automations", { fromScheduler: true })}
              title="Automations"
              subtitle="Recurring games & auto-invites"
              icon="sparkles-outline"
              testID="scheduler-smart-flows"
            />
          </Animated.View>

          {/* ── Empty State ── */}
          {!loading && events.length === 0 && (
            <Animated.View style={{ opacity: entranceAnim, marginTop: SPACE.lg }}>
              <View style={[cardSmStyle, styles.emptyState]}>
                <Ionicons name="calendar-outline" size={28} color={colors.textMuted} />
                <Footnote style={{ color: colors.textSecondary, textAlign: "center" }}>No upcoming games</Footnote>
              </View>
            </Animated.View>
          )}
        </ScrollView>
      </View>

      {/* ─── Group Picker Modal ─── */}
      <Modal visible={groupPickerOpen} animationType="slide" transparent>
        <Pressable style={styles.modalOverlay} onPress={() => setGroupPickerOpen(false)}>
          <Pressable style={[styles.modalSheet, { backgroundColor: colors.contentBg, paddingBottom: insets.bottom + SPACE.lg }]} onPress={(e) => e.stopPropagation()}>
            <View style={[styles.modalHandle, { backgroundColor: modalHandleBg }]} />
            <Title2 style={[styles.modalTitle, { color: colors.textPrimary }]}>Select Group</Title2>
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
                      <Headline style={{ flex: 1, color: colors.textPrimary }} numberOfLines={1}>
                        {group.name}
                      </Headline>
                    </View>
                  </GlassSurface>
                </Pressable>
              ))}
              {groups.length === 0 && (
                <Footnote style={{ color: colors.textMuted, textAlign: "center", marginTop: SPACE.lg }}>
                  No groups found
                </Footnote>
              )}
            </ScrollView>
            <GlassButton onPress={() => setGroupPickerOpen(false)} variant="secondary" size="medium" fullWidth style={{ marginTop: SPACE.lg }}>
              Cancel
            </GlassButton>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ─── Create Event Modal (New Game templates) — scrollable form + sticky footer (Apple HIG-style) ─── */}
      <Modal visible={createOpen} animationType="slide" transparent onRequestClose={() => setCreateOpen(false)}>
        <View style={styles.createModalRoot}>
          <Pressable
            style={StyleSheet.absoluteFillObject}
            accessibilityLabel="Dismiss"
            accessibilityRole="button"
            onPress={() => setCreateOpen(false)}
          >
            <View style={[StyleSheet.absoluteFillObject, styles.createModalBackdrop]} />
          </Pressable>
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={styles.createModalKav}
            keyboardVerticalOffset={Platform.OS === "ios" ? insets.top : 0}
          >
            <View
              style={[
                styles.createEventSheetShell,
                {
                  height: createEventSheetHeight,
                  backgroundColor: colors.contentBg,
                },
              ]}
            >
              <View style={[styles.modalHandle, { backgroundColor: modalHandleBg }]} />
              <ScrollView
                style={styles.createEventScroll}
                showsVerticalScrollIndicator
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={[
                  styles.createModalScroll,
                  { paddingHorizontal: LAYOUT.screenPadding },
                ]}
              >
                <Title2 style={[styles.modalTitle, { color: colors.textPrimary }]}>
                  {activeTile?.id === "custom" ? t.scheduler.createEvent : activeTile?.title || t.scheduler.title}
                </Title2>

                <View style={styles.fieldRow}>
                  <Label color={colors.textSecondary}>Day</Label>
                  <Pressable
                    onPress={() => setShowDatePicker(true)}
                    hitSlop={12}
                    accessibilityRole="button"
                    accessibilityLabel={t.scheduler.selectDate}
                  >
                    <Ionicons name="calendar-outline" size={20} color={colors.textSecondary} />
                  </Pressable>
                </View>
                <View style={styles.chipRow}>
                  {DAY_LABELS.map((label, idx) => {
                    const selected = formDay === idx;
                    return (
                      <Pressable
                        key={label}
                        onPress={() => {
                          setFormDay(idx);
                          setFormDate(getNextDayDate(idx));
                        }}
                        style={({ pressed }) => [
                          styles.formChip,
                          {
                            borderColor: selected ? colors.buttonPrimary : colors.border,
                            backgroundColor: selected ? colors.buttonPrimary : colors.inputBg,
                            opacity: pressed ? 0.88 : 1,
                          },
                        ]}
                      >
                        <Subhead
                          bold={selected}
                          style={{
                            color: selected ? colors.buttonText : colors.textPrimary,
                            textAlign: "center",
                          }}
                        >
                          {label}
                        </Subhead>
                      </Pressable>
                    );
                  })}
                </View>
                {formDate ? (
                  <Footnote style={[styles.datePreview, { color: colors.textMuted }]}>
                    {formDate.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}
                  </Footnote>
                ) : null}
                {showDatePicker ? (
                  <DateTimePicker
                    value={formDate || new Date()}
                    mode="date"
                    display="spinner"
                    minimumDate={new Date()}
                    onChange={(_: unknown, selected: Date | undefined) => {
                      setShowDatePicker(false);
                      if (selected) {
                        setFormDate(selected);
                        setFormDay(selected.getDay());
                      }
                    }}
                  />
                ) : null}

                <Label style={styles.createModalSectionLabel} color={colors.textSecondary}>
                  Time
                </Label>
                <Pressable
                  onPress={() => setShowTimePicker(true)}
                  style={({ pressed }) => [
                    styles.formSurfaceRow,
                    {
                      borderColor: colors.border,
                      backgroundColor: colors.inputBg,
                      opacity: pressed ? 0.92 : 1,
                    },
                  ]}
                >
                  <Ionicons name="time-outline" size={20} color={colors.textSecondary} />
                  <Body style={{ color: colors.textPrimary, flex: 1 }}>
                    {formTime.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })}
                  </Body>
                  <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                </Pressable>
                {showTimePicker ? (
                  <DateTimePicker
                    value={formTime}
                    mode="time"
                    display="spinner"
                    onChange={(_: unknown, selected: Date | undefined) => {
                      setShowTimePicker(false);
                      if (selected) setFormTime(selected);
                    }}
                  />
                ) : null}

                <View style={{ marginTop: SPACE.lg }}>
                  <GlassInput label="Title" placeholder="Game Night" value={formTitle} onChangeText={setFormTitle} />
                </View>

                <Label style={styles.createModalSectionLabel} color={colors.textSecondary}>
                  Game
                </Label>
                <View style={styles.chipRow}>
                  {GAME_TYPES.map((gt) => {
                    const selected = formGame === gt.value;
                    return (
                      <Pressable
                        key={gt.value}
                        onPress={() => setFormGame(gt.value)}
                        style={({ pressed }) => [
                          styles.formChip,
                          {
                            borderColor: selected ? colors.buttonPrimary : colors.border,
                            backgroundColor: selected ? colors.buttonPrimary : colors.inputBg,
                            opacity: pressed ? 0.88 : 1,
                          },
                        ]}
                      >
                        <Subhead
                          bold={selected}
                          style={{
                            color: selected ? colors.buttonText : colors.textPrimary,
                            textAlign: "center",
                          }}
                        >
                          {gt.label}
                        </Subhead>
                      </Pressable>
                    );
                  })}
                </View>

                <Label style={styles.createModalSectionLabel} color={colors.textSecondary}>
                  Buy-in
                </Label>
                <View style={styles.chipRow}>
                  {BUY_IN_OPTIONS.map((amount) => {
                    const selected = formBuyIn === amount;
                    return (
                      <Pressable
                        key={amount}
                        onPress={() => setFormBuyIn(amount)}
                        style={({ pressed }) => [
                          styles.formChip,
                          {
                            borderColor: selected ? colors.buttonPrimary : colors.border,
                            backgroundColor: selected ? colors.buttonPrimary : colors.inputBg,
                            opacity: pressed ? 0.88 : 1,
                          },
                        ]}
                      >
                        <Subhead
                          bold={selected}
                          style={{
                            color: selected ? colors.buttonText : colors.textPrimary,
                            textAlign: "center",
                          }}
                        >
                          ${amount}
                        </Subhead>
                      </Pressable>
                    );
                  })}
                </View>

                <View style={{ marginTop: SPACE.md }}>
                  <GlassInput label="Location" placeholder="Optional" value={formLocation} onChangeText={setFormLocation} />
                </View>

                <View
                  style={[
                    styles.groupIndicator,
                    {
                      borderColor: colors.border,
                      backgroundColor: colors.inputBg,
                    },
                  ]}
                >
                  <Ionicons name="people-outline" size={18} color={colors.textSecondary} />
                  <Footnote style={{ color: colors.textSecondary, flex: 1 }} numberOfLines={1}>
                    {selectedGroupName}
                  </Footnote>
                </View>

                <View style={{ height: SPACE.xl }} />
              </ScrollView>

              <View
                style={[
                  styles.createEventFooter,
                  {
                    borderTopColor: colors.border,
                    backgroundColor: colors.contentBg,
                    paddingBottom: insets.bottom + SPACE.md,
                    paddingHorizontal: LAYOUT.screenPadding,
                  },
                ]}
              >
                <GlassButton
                  onPress={() => setCreateOpen(false)}
                  variant="secondary"
                  size="large"
                  fullWidth
                >
                  Cancel
                </GlassButton>
                <GlassButton
                  onPress={handleSchedule}
                  variant="primary"
                  size="large"
                  disabled={submitting}
                  loading={submitting}
                  fullWidth
                >
                  {t.scheduler.scheduleAndInvite}
                </GlassButton>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* ─── Event Detail Modal ─── */}
      <Modal visible={detailOpen} animationType="slide" transparent>
        <Pressable style={styles.modalOverlay} onPress={() => setDetailOpen(false)}>
          <Pressable style={[styles.modalSheet, { backgroundColor: colors.contentBg, maxHeight: "85%", paddingBottom: insets.bottom + SPACE.lg }]} onPress={(e) => e.stopPropagation()}>
            <View style={[styles.modalHandle, { backgroundColor: modalHandleBg }]} />
            {detailEvent && (
              <ScrollView showsVerticalScrollIndicator={false}>
                <Title2 style={[styles.modalTitle, { color: colors.textPrimary }]}>{detailEvent.title}</Title2>
                <View style={styles.detailMeta}>
                  <View style={styles.detailMetaItem}>
                    <Ionicons name="calendar-outline" size={16} color={colors.textSecondary} />
                    <Footnote style={{ color: colors.textSecondary }}>{formatDate(detailEvent.starts_at)}</Footnote>
                  </View>
                  <View style={styles.detailMetaItem}>
                    <Ionicons name="time-outline" size={16} color={colors.textSecondary} />
                    <Footnote style={{ color: colors.textSecondary }}>{formatTime(detailEvent.starts_at)}</Footnote>
                  </View>
                </View>
                {detailEvent.location && (
                  <View style={[styles.detailMetaItem, { marginBottom: SPACING.md }]}>
                    <Ionicons name="location-outline" size={16} color={colors.textMuted} />
                    <Footnote style={{ color: colors.textMuted }}>{detailEvent.location}</Footnote>
                  </View>
                )}

                {detailLoading ? (
                  <GlassSurface style={{ alignItems: "center", paddingVertical: SPACE.lg }}>
                    <ActivityIndicator color={colors.orange} size="small" />
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
                              <Text style={[styles.statMetric, { color: colors.textPrimary }]}>{s.count}</Text>
                              <Caption2 style={{ color: colors.textMuted }}>{s.label}</Caption2>
                            </View>
                          ))}
                        </View>
                      </GlassSurface>
                    )}

                    {detailInvites.map((inv) => {
                      const icon = getStatusIcon(inv.status);
                      return (
                        <GlassSurface key={inv.invite_id} style={{ marginBottom: SPACING.xs }}>
                          <View style={{ flexDirection: "row", alignItems: "center", gap: SPACING.md }}>
                            <Ionicons name={icon.name} size={20} color={icon.color} />
                            <Headline style={{ flex: 1, color: colors.textPrimary }} numberOfLines={1}>
                              {inv.user_name}
                            </Headline>
                            <Caption2 style={{ color: icon.color, textTransform: "capitalize" }}>{inv.status}</Caption2>
                          </View>
                        </GlassSurface>
                      );
                    })}

                    <TouchableOpacity
                      onPress={handleStartGame}
                      disabled={startingGame}
                      style={[styles.scheduleButton, { backgroundColor: colors.buttonPrimary, marginTop: SPACING.xl, opacity: startingGame ? 0.5 : 1 }]}
                      activeOpacity={0.85}
                    >
                      <Ionicons name="play" size={20} color={colors.buttonText} />
                      <Subhead bold style={{ color: colors.buttonText }}>
                        {startingGame ? "Starting…" : "Start Game"}
                      </Subhead>
                    </TouchableOpacity>
                  </>
                ) : (
                  <View style={{ gap: SPACING.sm }}>
                    <TouchableOpacity
                      onPress={() => handleRSVP("accepted")}
                      style={[styles.rsvpBtn, { backgroundColor: colors.buttonPrimary }]}
                      activeOpacity={0.85}
                    >
                      <Ionicons name="checkmark" size={20} color={colors.buttonText} />
                      <Subhead bold style={{ color: colors.buttonText }}>I'm In</Subhead>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => handleRSVP("maybe")}
                      style={[styles.rsvpBtn, { backgroundColor: "transparent", borderWidth: 1, borderColor: colors.border }]}
                      activeOpacity={0.85}
                    >
                      <Ionicons name="help" size={20} color={colors.textPrimary} />
                      <Subhead bold style={{ color: colors.textPrimary }}>Maybe</Subhead>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => handleRSVP("declined")}
                      style={[styles.rsvpBtn, { backgroundColor: "transparent", borderWidth: 1, borderColor: colors.border }]}
                      activeOpacity={0.85}
                    >
                      <Ionicons name="close" size={20} color={colors.textPrimary} />
                      <Subhead bold style={{ color: colors.textPrimary }}>Can't Make It</Subhead>
                    </TouchableOpacity>
                  </View>
                )}
                <View style={{ height: SPACING.lg }} />
              </ScrollView>
            )}
            <GlassButton onPress={() => setDetailOpen(false)} variant="secondary" size="medium" fullWidth>
              Close
            </GlassButton>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topGradient: { position: "absolute", top: 0, left: 0, right: 0, zIndex: 0 },
  bodyLift: { flex: 1, zIndex: 1 },
  topChrome: { zIndex: 2 },
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
    letterSpacing: -0.5,
  },
  headerFlexSpacer: {
    flex: 1,
  },
  scroll: { flex: 1 },
  content: { paddingHorizontal: SCREEN_PAD, paddingTop: SPACE.xs },

  sectionTitle: {
    marginBottom: SPACE.sm,
  },

  // Group selector
  groupSelector: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.sm,
    paddingHorizontal: SPACE.lg,
    minHeight: LAYOUT.touchTarget,
    paddingVertical: SPACE.sm,
  },

  // Quick actions
  quickActionsRow: {
    flexDirection: "row",
    gap: LAYOUT.elementGap,
  },
  quickActionCell: {
    flex: 1,
    minHeight: BUTTON_SIZE.regular.height + SPACE.lg * 2 + 44,
    paddingVertical: SPACE.lg,
    paddingHorizontal: SPACE.sm,
    alignItems: "center",
    justifyContent: "center",
    gap: SPACE.sm,
  },
  /** Dashboard V3 `triRingOuter` / `triRingInner` — icon sits on tile-matched inner, not solid orange. */
  metricIconRingOuter: {
    width: 44,
    height: 44,
    borderRadius: 22,
    padding: SPACE.xs,
    borderWidth: StyleSheet.hairlineWidth * 2,
    alignItems: "center",
    justifyContent: "center",
  },
  metricIconRingInner: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  templateIconRingWrap: {
    marginBottom: SPACE.xs,
  },

  // Planning
  planningCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACE.md,
    paddingVertical: SPACE.xl,
  },

  // Proposal
  proposalCard: {
    padding: SPACE.lg,
  },
  proposalHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.xs,
    marginBottom: SPACE.sm,
  },
  proposalActions: {
    flexDirection: "row",
    gap: SPACE.sm,
    marginTop: SPACE.lg,
  },
  proposalConfirm: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    minHeight: BUTTON_SIZE.large.height,
    paddingVertical: SPACE.md,
    paddingHorizontal: SPACE.md,
    borderRadius: RADIUS.xl,
  },
  proposalAdjust: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: BUTTON_SIZE.regular.height,
    paddingVertical: SPACE.md,
    paddingHorizontal: SPACE.lg,
    borderRadius: RADIUS.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },

  // Error
  errorCard: {
    padding: SPACE.lg,
    alignItems: "center",
  },

  // Upcoming
  upcomingScrollContent: {
    paddingRight: SCREEN_PAD,
  },
  upcomingCard: {
    marginRight: UPCOMING_GAP,
    justifyContent: "center",
  },
  upcomingInnerBlock: {
    borderRadius: RADIUS.lg,
    padding: SPACE.md,
    flex: 1,
    justifyContent: "center",
  },
  upcomingRowInner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: SPACE.md,
  },
  upcomingCardTextCol: {
    flex: 1,
    minWidth: 0,
  },
  rsvpCountsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    marginTop: SPACE.xs,
  },
  upcomingStatusPill: {
    alignSelf: "flex-start",
    marginTop: SPACE.sm,
    paddingHorizontal: SPACE.sm,
    paddingVertical: 3,
    borderRadius: SPACE.sm,
  },

  // Templates
  templateGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: LAYOUT.elementGap,
  },
  templateCell: {
    width: (SCREEN_WIDTH - SCREEN_PAD * 2 - LAYOUT.elementGap) / 2,
    /** Taller ratio = shorter cells — keeps Automations pinned row visible */
    aspectRatio: 1.42,
    overflow: "hidden",
  },
  templateCellInner: {
    flex: 1,
    paddingVertical: SPACE.sm,
    paddingHorizontal: SPACE.sm,
    alignItems: "center",
    justifyContent: "center",
  },

  // Empty
  emptyState: {
    padding: SPACE.xl,
    alignItems: "center",
    gap: SPACE.sm,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
    alignItems: "center",
  },
  /** Create-event sheet: dimmer + sheet are siblings so taps don’t fight ScrollView. */
  createModalRoot: {
    flex: 1,
    justifyContent: "flex-end",
  },
  createModalBackdrop: {
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  createModalKav: {
    width: "100%",
    maxWidth: "100%",
  },
  createEventSheetShell: {
    width: "100%",
    borderTopLeftRadius: RADIUS.sheet,
    borderTopRightRadius: RADIUS.sheet,
    overflow: "hidden",
    flexDirection: "column",
  },
  createEventScroll: {
    flex: 1,
    minHeight: 0,
    width: "100%",
  },
  createEventFooter: {
    flexShrink: 0,
    flexGrow: 0,
    paddingTop: SPACE.lg,
    gap: SPACE.md,
    borderTopWidth: StyleSheet.hairlineWidth,
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
    marginBottom: SPACE.lg,
    letterSpacing: -0.35,
  },
  modalActions: {
    flexDirection: "row",
    paddingTop: SPACE.md,
    gap: SPACE.sm,
  },
  createModalScroll: {
    flexGrow: 1,
    paddingTop: SPACE.xs,
    paddingBottom: SPACE.lg,
  },
  createModalSectionLabel: {
    marginTop: SPACE.xl,
    marginBottom: SPACE.sm,
  },

  // Form
  fieldRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: SPACE.sm,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACE.xs,
  },
  formChip: {
    minHeight: BUTTON_SIZE.compact.height,
    paddingHorizontal: SPACE.md,
    paddingVertical: SPACE.sm,
    borderRadius: RADIUS.md,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: StyleSheet.hairlineWidth,
  },
  datePreview: {
    marginTop: SPACE.sm,
  },
  formSurfaceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.md,
    minHeight: BUTTON_SIZE.regular.height,
    paddingHorizontal: SPACE.lg,
    borderRadius: RADIUS.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  groupIndicator: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.sm,
    marginTop: SPACE.lg,
    paddingVertical: SPACE.md,
    paddingHorizontal: SPACE.lg,
    borderRadius: RADIUS.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  scheduleButton: {
    flex: 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACE.sm,
    paddingVertical: SPACE.md,
    borderRadius: RADIUS.lg,
    minHeight: LAYOUT.touchTarget,
  },

  // Group picker
  groupOption: {
    marginBottom: SPACE.sm,
    minHeight: LAYOUT.touchTarget,
    justifyContent: "center",
  },
  groupOptionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.md,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  radioSelected: {},
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: COLORS.orange,
  },

  // Detail
  detailMeta: {
    flexDirection: "row",
    gap: SPACE.lg,
    marginBottom: SPACE.md,
  },
  detailMetaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.xs,
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
  },
  statItem: {
    alignItems: "center",
    gap: 2,
  },
  statDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginBottom: 2,
  },
  statMetric: {
    fontSize: FONT.h2.size,
    fontWeight: FONT.h2.weight,
    letterSpacing: -0.3,
    fontVariant: ["tabular-nums"],
  },
  rsvpBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACE.sm,
    paddingVertical: SPACE.md,
    borderRadius: RADIUS.lg,
    minHeight: LAYOUT.touchTarget,
  },
});

export default SchedulerScreen;