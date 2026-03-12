import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  FlatList,
  TouchableOpacity,
  Modal,
  Animated,
  RefreshControl,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from "react-native";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
// @ts-ignore — optional dependency
import DateTimePicker from "@react-native-community/datetimepicker";

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
import {
  PageHeader,
  GlassSurface,
  GlassButton,
  GlassInput,
  GlassTile,
} from "../components/ui";
import type { GlassTileTone } from "../components/ui/GlassTile";
import type { RootStackParamList } from "../navigation/RootNavigator";

type Nav = NativeStackNavigationProp<RootStackParamList>;

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
  tone: GlassTileTone;
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

  // Data
  const [events, setEvents] = useState<EventItem[]>([]);
  const [groups, setGroups] = useState<GroupItem[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Group picker
  const [groupPickerOpen, setGroupPickerOpen] = useState(false);

  // Create modal
  const [createOpen, setCreateOpen] = useState(false);
  const [activeTile, setActiveTile] = useState<QuickTile | null>(null);
  const [formDay, setFormDay] = useState<number>(5);
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

  // ─── Data fetching ───────────────────────────────────────────
  const fetchGroups = useCallback(async () => {
    try {
      const res = await api.get("/groups");
      const list = res.data.groups || res.data || [];
      setGroups(list);
      if (list.length > 0 && !selectedGroupId) {
        setSelectedGroupId(list[0].group_id);
      }
    } catch (err) {
      console.error("Failed to fetch groups:", err);
    }
  }, [selectedGroupId]);

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
      const eventDate = getNextDayDate(formDay);
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

  // ─── Helpers ─────────────────────────────────────────────────
  const selectedGroupName = groups.find(g => g.group_id === selectedGroupId)?.name || "Select group";
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

  // ─── Render ──────────────────────────────────────────────────
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Animated.View style={{
        opacity: entranceAnim,
        transform: [{ translateY: entranceAnim.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }],
        paddingTop: insets.top,
      }}>
        <PageHeader title="Schedule" onClose={() => navigation.goBack()} />
      </Animated.View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* ── Group Selector ── */}
        <Animated.View style={{
          opacity: entranceAnim,
          transform: [{ translateY: entranceAnim.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }],
        }}>
          <TouchableOpacity
            style={[styles.groupSelector, { borderColor: colors.glassBorder, backgroundColor: colors.glassBg }]}
            onPress={() => setGroupPickerOpen(true)}
            activeOpacity={0.7}
          >
            <Ionicons name="people-outline" size={18} color={COLORS.orange} />
            <Text style={[styles.groupSelectorText, { color: colors.textPrimary }]} numberOfLines={1}>
              {selectedGroupName}
            </Text>
            <Ionicons name="chevron-down" size={16} color={colors.textMuted} />
          </TouchableOpacity>
        </Animated.View>

        {/* ── Upcoming Games ── */}
        {events.length > 0 && (
          <Animated.View style={{
            opacity: entranceAnim,
            transform: [{ translateY: entranceAnim.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }],
          }}>
            <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>UPCOMING</Text>
            <FlatList
              horizontal
              data={events.slice(0, 10)}
              keyExtractor={(item) => item.occurrence_id}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingRight: SPACING.md }}
              renderItem={({ item }) => (
                <TouchableOpacity onPress={() => openDetail(item)} activeOpacity={0.7}>
                  <GlassSurface style={styles.upcomingCard}>
                    <Text style={[styles.upcomingLabel, { color: COLORS.orange }]}>
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
                        {item.my_rsvp || "Invited"}
                      </Text>
                    </View>
                  </GlassSurface>
                </TouchableOpacity>
              )}
            />
          </Animated.View>
        )}

        {/* ── Quick Schedule Tiles (Full-width) ── */}
        <Animated.View style={{
          opacity: tilesAnim,
          transform: [{ translateY: tilesAnim.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }],
        }}>
          <Text style={[styles.sectionLabel, { color: colors.textMuted, marginTop: SPACING.xl }]}>
            QUICK SCHEDULE
          </Text>

          {QUICK_TILES.map((tile) => (
            <GlassTile
              key={tile.id}
              tone={tile.tone}
              size="hero"
              elevated
              style={styles.quickTile}
              onPress={() => openCreate(tile)}
            >
              {/* Gradient header zone */}
              <View style={styles.tileHeader}>
                <LinearGradient
                  colors={tile.headerColors}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={StyleSheet.absoluteFill}
                />
                <View style={styles.tileHeaderContent}>
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
                  <Ionicons
                    name={tile.icon}
                    size={40}
                    color="rgba(255,255,255,0.20)"
                    style={{ marginTop: SPACING.sm }}
                  />
                </View>
              </View>

              {/* Body */}
              <View style={styles.tileBody}>
                <Text style={[styles.tileTitle, { color: colors.textPrimary }]}>
                  {tile.title}
                </Text>
                <Text style={[styles.tileSubtitle, { color: colors.textMuted }]}>
                  {tile.subtitle}
                  {tile.time ? ` \u00b7 ${formatTileTime(tile.time)}` : ""}
                </Text>

                <TouchableOpacity
                  style={[styles.tileButton, { backgroundColor: tile.buttonColor }]}
                  onPress={() => openCreate(tile)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.tileButtonText}>
                    {tile.id === "custom" ? "Customize" : "Schedule Now"}
                  </Text>
                </TouchableOpacity>
              </View>
            </GlassTile>
          ))}

          {/* Empty state */}
          {!loading && events.length === 0 && (
            <GlassSurface style={{ marginTop: SPACING.md }}>
              <Text style={{ color: colors.textMuted, textAlign: "center" }}>
                No upcoming games. Tap a tile above to schedule one!
              </Text>
            </GlassSurface>
          )}

          <View style={{ height: 100 }} />
        </Animated.View>
      </ScrollView>

      {/* ─── Group Picker Modal ─── */}
      <Modal visible={groupPickerOpen} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { backgroundColor: colors.contentBg }]}>
            <View style={styles.modalHandle} />
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Select Group</Text>
            <ScrollView style={{ maxHeight: 400 }}>
              {groups.map((group) => (
                <TouchableOpacity
                  key={group.group_id}
                  onPress={() => { setSelectedGroupId(group.group_id); setGroupPickerOpen(false); }}
                  activeOpacity={0.7}
                >
                  <GlassSurface
                    style={styles.groupOption}
                    glowVariant={selectedGroupId === group.group_id ? "orange" : undefined}
                  >
                    <View style={styles.groupOptionRow}>
                      <View style={[styles.radio, selectedGroupId === group.group_id && styles.radioSelected]}>
                        {selectedGroupId === group.group_id && <View style={styles.radioInner} />}
                      </View>
                      <Text style={[styles.groupOptionText, { color: colors.textPrimary }]}>{group.name}</Text>
                    </View>
                  </GlassSurface>
                </TouchableOpacity>
              ))}
              {groups.length === 0 && (
                <Text style={{ color: colors.textMuted, textAlign: "center", marginTop: SPACING.lg }}>
                  No groups found. Create a group first.
                </Text>
              )}
            </ScrollView>
            <GlassButton onPress={() => setGroupPickerOpen(false)} variant="secondary" size="medium" fullWidth style={{ marginTop: SPACING.lg }}>
              Cancel
            </GlassButton>
          </View>
        </View>
      </Modal>

      {/* ─── Create Event Modal ─── */}
      <Modal visible={createOpen} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ width: "100%" }}>
            <View style={[styles.modalSheet, { backgroundColor: colors.contentBg, maxHeight: "90%" }]}>
              <View style={styles.modalHandle} />
              <ScrollView showsVerticalScrollIndicator={false}>
                <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
                  {activeTile?.title || "Schedule Game"}
                </Text>

                {/* Day chips (all 7) */}
                <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>DAY</Text>
                <View style={styles.chipRow}>
                  {DAY_LABELS.map((label, idx) => (
                    <TouchableOpacity
                      key={idx}
                      onPress={() => setFormDay(idx)}
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
          <View style={[styles.modalSheet, { backgroundColor: colors.contentBg, maxHeight: "85%" }]}>
            <View style={styles.modalHandle} />
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
const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flex: 1 },
  content: { padding: SPACING.container },

  // Group selector
  groupSelector: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 2,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    marginBottom: SPACING.lg,
  },
  groupSelectorText: {
    flex: 1,
    fontSize: TYPOGRAPHY.sizes.body,
    fontWeight: TYPOGRAPHY.weights.medium,
  },

  // Section label (font-dot style)
  sectionLabel: {
    fontSize: 10,
    fontWeight: TYPOGRAPHY.weights.semiBold,
    letterSpacing: 2,
    textTransform: "uppercase",
    marginBottom: SPACING.md,
  },

  // Upcoming cards
  upcomingCard: { width: 160, marginRight: SPACING.md },
  upcomingLabel: {
    fontSize: 9,
    fontWeight: TYPOGRAPHY.weights.bold,
    letterSpacing: 1.5,
    marginBottom: SPACING.xs,
  },
  upcomingTitle: {
    fontSize: TYPOGRAPHY.sizes.body,
    fontWeight: TYPOGRAPHY.weights.semiBold,
    marginBottom: 2,
  },
  upcomingTime: {
    fontSize: TYPOGRAPHY.sizes.caption,
    marginBottom: SPACING.xs,
  },
  rsvpBadge: { flexDirection: "row", alignItems: "center", gap: SPACING.xs },
  rsvpDot: { width: 8, height: 8, borderRadius: 4 },
  rsvpText: { fontSize: TYPOGRAPHY.sizes.caption, textTransform: "capitalize" },

  // Quick schedule tiles (full-width)
  quickTile: {
    marginBottom: SPACING.md,
    overflow: "hidden",
  },

  // Tile header (gradient zone)
  tileHeader: {
    height: 110,
    overflow: "hidden",
    borderTopLeftRadius: RADIUS.xxl - 2,
    borderTopRightRadius: RADIUS.xxl - 2,
    marginTop: -24,   // counteract GlassTile padding
    marginLeft: -24,
    marginRight: -24,
  },
  tileHeaderContent: {
    flex: 1,
    padding: SPACING.lg,
    paddingTop: SPACING.xl + 24,
  },
  tileHeaderTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  tileChip: {
    paddingHorizontal: SPACING.sm + 2,
    paddingVertical: 3,
    borderRadius: RADIUS.full,
  },
  tileChipText: {
    fontSize: 10,
    fontWeight: TYPOGRAPHY.weights.medium,
  },
  tilePriceText: {
    fontSize: 11,
    fontWeight: TYPOGRAPHY.weights.bold,
    fontVariant: ["tabular-nums"],
  },

  // Tile body
  tileBody: {
    paddingTop: SPACING.md,
  },
  tileTitle: {
    fontSize: TYPOGRAPHY.sizes.heading2,
    fontWeight: TYPOGRAPHY.weights.bold,
    marginBottom: SPACING.xs,
  },
  tileSubtitle: {
    fontSize: TYPOGRAPHY.sizes.bodySmall,
    marginBottom: SPACING.md,
  },
  tileButton: {
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  tileButtonText: {
    color: "#fff",
    fontSize: TYPOGRAPHY.sizes.bodySmall,
    fontWeight: TYPOGRAPHY.weights.semiBold,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-end",
    alignItems: "center",
  },
  modalSheet: {
    width: "100%",
    borderTopLeftRadius: RADIUS.xxl,
    borderTopRightRadius: RADIUS.xxl,
    padding: SPACING.container,
    paddingBottom: 40,
  },
  modalHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignSelf: "center",
    marginBottom: SPACING.lg,
  },
  modalTitle: {
    fontSize: TYPOGRAPHY.sizes.heading2,
    fontWeight: TYPOGRAPHY.weights.bold,
    marginBottom: SPACING.lg,
  },
  modalActions: {
    flexDirection: "row",
    paddingTop: SPACING.md,
  },

  // Form fields
  fieldLabel: {
    fontSize: 10,
    fontWeight: TYPOGRAPHY.weights.semiBold,
    letterSpacing: 1.5,
    textTransform: "uppercase",
    marginBottom: SPACING.sm,
  },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.sm },
  chip: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.lg,
  },
  chipText: {
    fontSize: TYPOGRAPHY.sizes.caption,
    fontWeight: TYPOGRAPHY.weights.medium,
  },
  pickerCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
    marginBottom: SPACING.md,
  },
  pickerText: { fontSize: TYPOGRAPHY.sizes.body },

  // Schedule button (tone-matched)
  scheduleButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.sm,
    paddingVertical: SPACING.lg,
    borderRadius: RADIUS.lg,
    flex: 2,
  },
  scheduleButtonText: {
    color: "#fff",
    fontSize: TYPOGRAPHY.sizes.body,
    fontWeight: TYPOGRAPHY.weights.semiBold,
  },

  // RSVP buttons
  rsvpButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.sm,
    paddingVertical: SPACING.lg,
    borderRadius: RADIUS.lg,
  },
  rsvpButtonText: {
    color: "#fff",
    fontSize: TYPOGRAPHY.sizes.body,
    fontWeight: TYPOGRAPHY.weights.semiBold,
  },

  // Group picker
  groupOption: { marginBottom: SPACING.sm },
  groupOptionRow: { flexDirection: "row", alignItems: "center", gap: SPACING.md },
  groupOptionText: { fontSize: TYPOGRAPHY.sizes.body, fontWeight: TYPOGRAPHY.weights.medium },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: COLORS.text.muted,
    alignItems: "center",
    justifyContent: "center",
  },
  radioSelected: { borderColor: COLORS.orange },
  radioInner: { width: 12, height: 12, borderRadius: 6, backgroundColor: COLORS.orange },

  // Detail stats
  statsRow: { flexDirection: "row", justifyContent: "space-around" },
  statItem: { alignItems: "center", gap: SPACING.xs },
  statDot: { width: 10, height: 10, borderRadius: 5 },
  statCount: { fontSize: TYPOGRAPHY.sizes.heading2, fontWeight: TYPOGRAPHY.weights.bold },
  statLabel: { fontSize: TYPOGRAPHY.sizes.caption },
});

export default SchedulerScreen;
