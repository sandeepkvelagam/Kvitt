import React, { useEffect, useState, useCallback, useMemo } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  ScrollView,
  RefreshControl,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Switch,
  Alert,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { RouteProp, useRoute, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../api/client";
import { useTheme } from "../context/ThemeContext";
import { COLORS, PAGE_HERO_GRADIENT, pageHeroGradientColors } from "../styles/liquidGlass";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import {
  Title1,
  Title2,
  Headline,
  Subhead,
  Footnote,
  Caption2,
  GlassButton,
} from "../components/ui";
import { StartGameForm } from "../components/game/StartGameForm";
import { SPACE, LAYOUT, RADIUS, BUTTON_SIZE, APPLE_TYPO } from "../styles/tokens";
import { appleCardShadowResting } from "../styles/appleShadows";
import type { RootStackParamList } from "../navigation/RootNavigator";

type R = RouteProp<RootStackParamList, "GroupHub">;
type Nav = NativeStackNavigationProp<RootStackParamList>;

const SCREEN_PAD = LAYOUT.screenPadding;
const TAB_BAR_RESERVE_BASE = 90;

const GROUP_NUDGE_DAY_OPTIONS = [7, 10, 14, 21, 30];
const USER_NUDGE_DAY_OPTIONS = [14, 21, 30, 45, 60];

type HubGame = {
  game_id?: string;
  _id?: string;
  status?: string;
  title?: string;
  player_count?: number;
  total_pot?: number;
  is_player?: boolean;
  rsvp_status?: string | null;
};

/* ─────────────────────────────────────────────────────────────────────────────
   GroupHubScreen — Apple HIG Redesign v2
   
   Layout:
   ├── Bento Stats Row (Members | Games | Engagement + ⚙)
   ├── Quick Actions Card (live game / Start Game + secondary row)
   ├── Members + Leaderboard (side-by-side preview, tap to expand)
   ├── Members Section (full list)
   ├── Leaderboard Section (full list)
   └── Past Games Section
   ───────────────────────────────────────────────────────────────────────────── */

export function GroupHubScreen() {
  const { isDark, colors } = useTheme();
  const { user } = useAuth();
  const { t } = useLanguage();
  const route = useRoute<R>();
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { groupId, groupName: paramGroupName } = route.params;

  // ─── State ───
  const [group, setGroup] = useState<any>(null);
  const [games, setGames] = useState<HubGame[]>([]);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Start Game Sheet
  const [showStartGameSheet, setShowStartGameSheet] = useState(false);
  const [startGameFormKey, setStartGameFormKey] = useState(0);

  // Invite Members
  const [showInviteSheet, setShowInviteSheet] = useState(false);
  const [inviteMode, setInviteMode] = useState<"search" | "email">("search");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviting, setInviting] = useState<string | null>(null);
  const [pendingInvites, setPendingInvites] = useState<any[]>([]);

  // Transfer Admin
  const [showTransferSheet, setShowTransferSheet] = useState(false);
  const [selectedNewAdmin, setSelectedNewAdmin] = useState<string | null>(null);
  const [transferring, setTransferring] = useState(false);

  // Member Actions
  const [showMemberActions, setShowMemberActions] = useState<string | null>(null);
  const [removingMember, setRemovingMember] = useState(false);

  // Engagement
  const [groupStats, setGroupStats] = useState<{ total_games?: number } | null>(null);
  const [engSettings, setEngSettings] = useState<Record<string, any> | null>(null);
  const [engScore, setEngScore] = useState<Record<string, any> | null>(null);
  const [showEngSettingsSheet, setShowEngSettingsSheet] = useState(false);
  const [smartDefaults, setSmartDefaults] = useState<{
    games_analyzed?: number;
    buy_in_amount?: number;
    chips_per_buy_in?: number;
  } | null>(null);
  const [engSettingsError, setEngSettingsError] = useState<string | null>(null);
  const [requestingJoin, setRequestingJoin] = useState(false);

  // ─── Derived Values ───
  const isAdmin = group?.members?.find((m: any) => m.user_id === user?.user_id)?.role === "admin";
  const headerTitle = group?.name || paramGroupName || "…";
  const members = group?.members || [];
  const activeGames = useMemo(() => games.filter((g) => g.status === "active"), [games]);
  const pastGames = useMemo(() => games.filter((g) => g.status !== "active"), [games]);
  const primaryLiveGame = activeGames[0];
  const extraLiveCount = activeGames.length > 1 ? activeGames.length - 1 : 0;
  const primaryLiveGameId = primaryLiveGame?.game_id || primaryLiveGame?._id;
  const inLiveGame = !!(primaryLiveGame?.is_player && primaryLiveGame?.rsvp_status === "yes");
  const joinPending = !!(primaryLiveGame?.is_player && primaryLiveGame?.rsvp_status === "pending");
  const hasTransferCandidate = members.filter((m: any) => m.role !== "admin").length > 0;
  const totalGames = groupStats?.total_games ?? 0;
  const engScoreValue = engScore?.score ?? 0;

  // ─── Layout Calculations ───
  const backgroundColor = isDark ? COLORS.jetDark : colors.contentBg;
  const tabBarReserve = TAB_BAR_RESERVE_BASE + Math.max(insets.bottom, 8);
  const scrollBottomPad = tabBarReserve + LAYOUT.sectionGap;

  // ─── Memoized Styles ───

  /** Unified card style — matches Dashboard/Scheduler */
  const cardStyle = useMemo(
    () => ({
      backgroundColor: isDark ? "rgba(45, 45, 48, 0.9)" : "rgba(255, 255, 255, 0.95)",
      borderRadius: RADIUS.xl,
      borderWidth: 1,
      borderColor: isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.06)",
      ...appleCardShadowResting(isDark),
    }),
    [isDark]
  );

  /** Smaller card style */
  const cardSmStyle = useMemo(
    () => ({
      ...cardStyle,
      borderRadius: RADIUS.lg,
    }),
    [cardStyle]
  );

  /** Ring styling for bento stat icons */
  const ringPad = useMemo(
    () => ({
      bg: isDark ? "rgba(255, 255, 255, 0.06)" : "rgba(0, 0, 0, 0.04)",
      border: isDark ? "rgba(255, 255, 255, 0.09)" : "rgba(0, 0, 0, 0.07)",
    }),
    [isDark]
  );

  /** Secondary button background */
  const secondaryBg = isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)";

  // ─── Data Loading ───

  const load = useCallback(async () => {
    try {
      setError(null);
      setEngSettingsError(null);
      const [groupRes, gamesRes, statsRes, defaultsRes, engSettingsRes, engScoreRes] = await Promise.all([
        api.get(`/groups/${groupId}`),
        api.get(`/games?group_id=${groupId}`),
        api.get(`/stats/group/${groupId}`).catch(() => ({ data: { leaderboard: [], total_games: 0 } })),
        api.get(`/groups/${groupId}/smart-defaults`).catch(() => ({ data: null })),
        api.get(`/engagement/settings/${groupId}`).catch(() => ({ data: null })),
        api.get(`/engagement/scores/group/${groupId}`).catch(() => ({ data: null })),
      ]);
      setGroup(groupRes.data);
      setGames(Array.isArray(gamesRes.data) ? gamesRes.data : []);
      setLeaderboard(statsRes.data?.leaderboard || []);
      setGroupStats({ total_games: statsRes.data?.total_games });
      setEngSettings(engSettingsRes.data || null);
      setEngScore(engScoreRes.data && typeof engScoreRes.data === "object" ? engScoreRes.data : null);

      const def = defaultsRes.data;
      if (def && def.games_analyzed > 0) {
        setSmartDefaults(def);
      } else {
        setSmartDefaults(null);
      }
    } catch (e: any) {
      setError(e?.response?.data?.detail || e?.message || "Group unavailable.");
    }
  }, [groupId]);

  const updateEngSetting = useCallback(
    async (key: string, value: boolean | number) => {
      if (!engSettings) return;
      setEngSettingsError(null);
      const prev = { ...engSettings };
      setEngSettings({ ...engSettings, [key]: value });
      try {
        await api.put(`/engagement/settings/${groupId}`, { [key]: value });
      } catch {
        setEngSettings(prev);
        setEngSettingsError(t.groups.engagementUpdateFailed);
      }
    },
    [engSettings, groupId, t]
  );

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  // ─── Handlers ───

  const handleRequestJoin = useCallback(async () => {
    const gid = primaryLiveGame?.game_id || primaryLiveGame?._id;
    if (!gid) return;
    setRequestingJoin(true);
    try {
      await api.post(`/games/${gid}/join`);
      await load();
    } catch (e: any) {
      const msg = e?.response?.data?.detail ?? e?.message ?? t.game.hubJoinFailed;
      Alert.alert("", typeof msg === "string" ? msg : t.game.hubJoinFailed);
    } finally {
      setRequestingJoin(false);
    }
  }, [primaryLiveGame, load, t.game.hubJoinFailed]);

  const handleSearchUsers = async (query: string) => {
    setSearchQuery(query);
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    try {
      const res = await api.get(`/users/search?query=${encodeURIComponent(query)}`);
      setSearchResults(res.data || []);
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  const handleInvite = async (email: string) => {
    setInviting(email);
    try {
      await api.post(`/groups/${groupId}/invite`, { email });
      setSearchQuery("");
      setInviteEmail("");
      setSearchResults([]);
      fetchPendingInvites();
    } catch {
      // Silent
    } finally {
      setInviting(null);
    }
  };

  const fetchPendingInvites = async () => {
    try {
      const res = await api.get(`/groups/${groupId}/invites`);
      setPendingInvites((res.data || []).filter((i: any) => i.status === "pending"));
    } catch {
      // Not admin or no invites
    }
  };

  const handleTransferAdmin = async () => {
    if (!selectedNewAdmin) return;
    setTransferring(true);
    try {
      await api.put(`/groups/${groupId}/transfer-admin`, { new_admin_id: selectedNewAdmin });
      setShowTransferSheet(false);
      setSelectedNewAdmin(null);
      await load();
    } catch {
      // Silent
    } finally {
      setTransferring(false);
    }
  };

  const handleRemoveMember = async (userId: string) => {
    setRemovingMember(true);
    try {
      await api.delete(`/groups/${groupId}/members/${userId}`);
      setShowMemberActions(null);
      await load();
    } catch {
      // Silent
    } finally {
      setRemovingMember(false);
    }
  };

  // ─── Engagement score color (semantic only) ───
  const engScoreColor = engScoreValue >= 70 ? colors.success : engScoreValue >= 40 ? colors.warning : colors.danger;

  // ─── Render ───

  return (
    <View style={[styles.root, { backgroundColor }]} testID="group-hub-screen">
      {/* Hero gradient */}
      <LinearGradient
        pointerEvents="none"
        colors={pageHeroGradientColors(isDark)}
        locations={[...PAGE_HERO_GRADIENT.locations]}
        start={PAGE_HERO_GRADIENT.start}
        end={PAGE_HERO_GRADIENT.end}
        style={[
          styles.topGradient,
          { height: Math.min(PAGE_HERO_GRADIENT.maxHeight, insets.top + PAGE_HERO_GRADIENT.safeAreaPad) },
        ]}
      />

      {/* ─── Header ─── */}
      <View style={styles.topChrome} pointerEvents="box-none">
        <View style={{ height: insets.top }} />
        <View style={styles.headerRow}>
          <Pressable
            style={({ pressed }) => [
              styles.backPill,
              { backgroundColor: colors.glassBg, borderColor: colors.glassBorder, opacity: pressed ? 0.85 : 1 },
            ]}
            onPress={() => navigation.goBack()}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          >
            <Ionicons name="chevron-back" size={22} color={colors.textPrimary} />
          </Pressable>
          <Title1 style={styles.screenTitle} numberOfLines={2}>
            {headerTitle}
          </Title1>
          <View style={styles.headerTrailingBalance} />
        </View>
      </View>

      <ScrollView
        style={styles.body}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: scrollBottomPad }]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.textSecondary}
            colors={[colors.textSecondary]}
            progressBackgroundColor={colors.surfaceBackground}
            progressViewOffset={Platform.OS === "android" ? insets.top + 52 : undefined}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* ─── Error Banner ─── */}
        {error && (
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
        )}

        {/* ═══════════════════════════════════════════════════════════════════════
            BENTO STATS ROW — Your Role | Games | Engagement (with ⚙ for admin)
            ═══════════════════════════════════════════════════════════════════════ */}
        <View style={styles.bentoRow}>
          {/* Your Role */}
          <View style={[styles.bentoCard, cardSmStyle]}>
            <Footnote style={{ color: colors.textMuted }}>Your Role</Footnote>
            <Headline style={{ color: isAdmin ? colors.warning : colors.textPrimary, marginTop: SPACE.xs }}>
              {isAdmin ? t.groups.roleAdmin : t.groups.roleMember}
            </Headline>
            <View style={[styles.bentoRingOuter, { backgroundColor: ringPad.bg, borderColor: ringPad.border }]}>
              <View style={[styles.bentoRingInner, { backgroundColor: cardSmStyle.backgroundColor }]}>
                <Ionicons name={isAdmin ? "shield" : "person"} size={18} color={isAdmin ? colors.warning : colors.textSecondary} />
              </View>
            </View>
          </View>

          {/* Games */}
          <View style={[styles.bentoCard, cardSmStyle]}>
            <Footnote style={{ color: colors.textMuted }}>Games</Footnote>
            <Headline style={{ color: colors.textPrimary, marginTop: SPACE.xs }}>{totalGames}</Headline>
            <View style={[styles.bentoRingOuter, { backgroundColor: ringPad.bg, borderColor: ringPad.border }]}>
              <View style={[styles.bentoRingInner, { backgroundColor: cardSmStyle.backgroundColor }]}>
                <Ionicons name="game-controller" size={18} color={colors.textSecondary} />
              </View>
            </View>
          </View>

          {/* Engagement Score — with settings gear for admin */}
          <View style={[styles.bentoCard, cardSmStyle]}>
            {isAdmin && engSettings && (
              <Pressable
                style={({ pressed }) => [styles.bentoGear, { opacity: pressed ? 0.6 : 1 }]}
                onPress={() => setShowEngSettingsSheet(true)}
                hitSlop={8}
              >
                <Ionicons name="settings-outline" size={16} color={colors.textMuted} />
              </Pressable>
            )}
            <Footnote style={{ color: colors.textMuted }}>Score</Footnote>
            <Headline style={{ color: engScoreColor, marginTop: SPACE.xs, fontVariant: ["tabular-nums"] }}>
              {Math.round(engScoreValue)}
            </Headline>
            <View style={[styles.bentoRingOuter, { backgroundColor: ringPad.bg, borderColor: ringPad.border }]}>
              <View style={[styles.bentoRingInner, { backgroundColor: cardSmStyle.backgroundColor }]}>
                <Ionicons name="sparkles" size={18} color={colors.textSecondary} />
              </View>
            </View>
          </View>
        </View>

        {/* ═══════════════════════════════════════════════════════════════════════
            QUICK ACTIONS — Live game / join / pending / Start Game + secondary row
            ═══════════════════════════════════════════════════════════════════════ */}
        <View style={[cardStyle, styles.actionsCard]}>
          {activeGames.length === 0 ? (
            <Footnote style={[styles.actionsContextText, { color: colors.textMuted }]}>{t.game.hubNoLiveGame}</Footnote>
          ) : primaryLiveGame ? (
            <View style={styles.actionsLiveContext}>
              <View style={styles.actionsLiveTitleRow}>
                <View style={[styles.liveDot, { backgroundColor: colors.success }]} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Headline numberOfLines={2} style={{ color: colors.textPrimary }}>
                    {primaryLiveGame.title || "Game Night"}
                  </Headline>
                  <Footnote style={{ color: colors.textMuted, marginTop: 2 }}>
                    {primaryLiveGame.player_count ?? 0} {t.game.players}
                    {primaryLiveGame.total_pot ? ` · $${primaryLiveGame.total_pot} ${t.game.pot}` : ""}
                  </Footnote>
                </View>
              </View>
              {extraLiveCount > 0 ? (
                <Footnote style={{ color: colors.textMuted, marginTop: SPACE.xs }}>
                  {t.game.hubMoreLiveGames.replace("{n}", String(extraLiveCount))}
                </Footnote>
              ) : null}
            </View>
          ) : null}

          {activeGames.length === 0 ? (
            <Pressable
              style={({ pressed }) => [
                styles.primaryActionBtn,
                { backgroundColor: colors.buttonPrimary, opacity: pressed ? 0.92 : 1 },
              ]}
              onPress={() => {
                setStartGameFormKey((k) => k + 1);
                setShowStartGameSheet(true);
              }}
            >
              <Ionicons name="play" size={22} color={colors.buttonText} />
              <Headline style={{ color: colors.buttonText }}>{t.game.startGame}</Headline>
            </Pressable>
          ) : joinPending ? (
            <View
              style={[
                styles.primaryActionBtn,
                styles.primaryActionMuted,
                { backgroundColor: secondaryBg, borderColor: colors.border },
              ]}
            >
              <Ionicons name="time-outline" size={22} color={colors.textMuted} />
              <Footnote style={{ color: colors.textMuted, fontWeight: "600", flex: 1, textAlign: "center" }}>
                {t.game.hubJoinPending}
              </Footnote>
            </View>
          ) : inLiveGame ? (
            <Pressable
              style={({ pressed }) => [
                styles.primaryActionBtn,
                { backgroundColor: colors.buttonPrimary, opacity: pressed ? 0.92 : 1 },
              ]}
              onPress={() => {
                if (primaryLiveGameId) navigation.navigate("GameNight", { gameId: primaryLiveGameId });
              }}
            >
              <Ionicons name="play-circle-outline" size={22} color={colors.buttonText} />
              <Headline style={{ color: colors.buttonText }}>{t.game.hubOpenGame}</Headline>
            </Pressable>
          ) : (
            <Pressable
              style={({ pressed }) => [
                styles.primaryActionBtn,
                {
                  backgroundColor: colors.buttonPrimary,
                  opacity: requestingJoin || !primaryLiveGameId ? 0.55 : pressed ? 0.92 : 1,
                },
              ]}
              disabled={requestingJoin || !primaryLiveGameId}
              onPress={handleRequestJoin}
            >
              {requestingJoin ? (
                <ActivityIndicator color={colors.buttonText} />
              ) : (
                <>
                  <Ionicons name="person-add-outline" size={22} color={colors.buttonText} />
                  <Headline style={{ color: colors.buttonText }}>{t.game.hubRequestJoin}</Headline>
                </>
              )}
            </Pressable>
          )}

          <View style={styles.secondaryActionsRow}>
            <Pressable
              style={({ pressed }) => [
                styles.secondaryActionBtn,
                { backgroundColor: secondaryBg, borderColor: colors.border, opacity: pressed ? 0.88 : 1 },
              ]}
              onPress={() => navigation.navigate("GroupChat", { groupId, groupName: group?.name })}
            >
              <Ionicons name="chatbubbles-outline" size={20} color={colors.textPrimary} />
              <Subhead style={{ color: colors.textPrimary }}>{t.chatsScreen.gameThreadChatLabel}</Subhead>
            </Pressable>
            <Pressable
              style={({ pressed }) => [
                styles.secondaryActionBtn,
                { backgroundColor: secondaryBg, borderColor: colors.border, opacity: pressed ? 0.88 : 1 },
              ]}
              onPress={() => navigation.navigate("AIAssistant")}
            >
              <Ionicons name="sparkles-outline" size={20} color={colors.textPrimary} />
              <Subhead style={{ color: colors.textPrimary }}>{t.nav.aiAssistant}</Subhead>
            </Pressable>
          </View>
        </View>

        {/* ═══════════════════════════════════════════════════════════════════════
            MEMBERS SECTION — Full list
            ═══════════════════════════════════════════════════════════════════════ */}
        <View style={[cardStyle, styles.sectionCard]}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionHeaderLeft}>
              <Ionicons name="people" size={20} color={colors.textSecondary} />
              <Title2>Members</Title2>
            </View>
            <Caption2 style={{ color: colors.textMuted }}>{members.length}</Caption2>
          </View>

          {/* Admin Actions */}
          {isAdmin && (
            <View style={styles.adminActionsRow}>
              <Pressable
                style={({ pressed }) => [
                  styles.adminActionBtn,
                  { backgroundColor: secondaryBg, borderColor: colors.border, opacity: pressed ? 0.88 : 1 },
                ]}
                onPress={() => {
                  fetchPendingInvites();
                  setShowInviteSheet(true);
                }}
              >
                <Ionicons name="person-add-outline" size={18} color={colors.textPrimary} />
                <Subhead style={{ color: colors.textPrimary }}>{t.groups.invite}</Subhead>
              </Pressable>
              {hasTransferCandidate && (
                <Pressable
                  style={({ pressed }) => [
                    styles.adminActionBtn,
                    { backgroundColor: secondaryBg, borderColor: colors.border, opacity: pressed ? 0.88 : 1 },
                  ]}
                  onPress={() => setShowTransferSheet(true)}
                >
                  <Ionicons name="swap-horizontal-outline" size={18} color={colors.textPrimary} />
                  <Subhead style={{ color: colors.textPrimary }}>{t.groups.transfer}</Subhead>
                </Pressable>
              )}
            </View>
          )}

          <View style={styles.sectionBody}>
            {members.length > 0 ? (
              members.map((m: any, idx: number) => {
                const memberName = m?.user?.name || m?.name || m?.user?.email || m?.email || "Unknown";
                const isCurrentUser = m?.user_id === user?.user_id;
                const isMemberAdmin = m?.role === "admin";

                return (
                  <View
                    key={m?.user_id || idx}
                    style={[styles.memberRow, { borderBottomColor: idx < members.length - 1 ? colors.border : "transparent" }]}
                  >
                    <View style={[styles.memberAvatar, { backgroundColor: colors.inputBg }]}>
                      <Subhead style={{ color: colors.textSecondary, fontWeight: "600" }}>
                        {memberName[0].toUpperCase()}
                      </Subhead>
                    </View>
                    <View style={styles.memberInfo}>
                      <View style={styles.memberNameRow}>
                        <Headline numberOfLines={1} style={{ flexShrink: 1 }}>
                          {memberName}
                        </Headline>
                        {isCurrentUser && <Footnote style={{ color: colors.textMuted }}> (you)</Footnote>}
                      </View>
                      <View style={[styles.roleBadge, { backgroundColor: secondaryBg }]}>
                        <Ionicons name={isMemberAdmin ? "shield" : "person"} size={10} color={isMemberAdmin ? colors.warning : colors.textMuted} />
                        <Caption2 style={{ color: isMemberAdmin ? colors.warning : colors.textMuted }}>
                          {isMemberAdmin ? t.groups.roleAdmin : t.groups.roleMember}
                        </Caption2>
                      </View>
                    </View>
                    {isAdmin && !isCurrentUser && !isMemberAdmin && (
                      <Pressable
                        style={({ pressed }) => [styles.memberActionBtn, { opacity: pressed ? 0.7 : 1 }]}
                        onPress={() => setShowMemberActions(m?.user_id)}
                        hitSlop={8}
                      >
                        <Ionicons name="ellipsis-horizontal" size={20} color={colors.textMuted} />
                      </Pressable>
                    )}
                  </View>
                );
              })
            ) : (
              <Footnote style={{ color: colors.textMuted, textAlign: "center", paddingVertical: SPACE.md }}>
                Member info isn&apos;t available right now
              </Footnote>
            )}
          </View>
        </View>

        {/* ═══════════════════════════════════════════════════════════════════════
            LEADERBOARD — Full list
            ═══════════════════════════════════════════════════════════════════════ */}
        <View style={[cardStyle, styles.sectionCard]}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionHeaderLeft}>
              <Ionicons name="trophy" size={20} color={colors.warning} />
              <Title2>{t.groups.leaderboard}</Title2>
            </View>
            <Caption2 style={{ color: colors.textMuted }}>{leaderboard.length}</Caption2>
          </View>
          <View style={styles.sectionBody}>
            {leaderboard.length > 0 ? (
              leaderboard.map((entry: any, idx: number) => {
                const name = entry.user?.name || "Unknown";
                const profit = Number(entry.total_profit ?? 0);
                const rankStyle =
                  idx === 0 ? styles.rankGold : idx === 1 ? styles.rankSilver : idx === 2 ? styles.rankBronze : styles.rankDefault;
                return (
                  <View
                    key={entry.user_id || idx}
                    style={[styles.leaderboardRow, { borderBottomColor: idx < leaderboard.length - 1 ? colors.border : "transparent" }]}
                  >
                    <View style={styles.leaderboardLeft}>
                      <View style={[styles.rankBadge, rankStyle]}>
                        <Caption2 style={[styles.rankText, idx < 2 ? { color: "#111827" } : idx === 2 ? { color: "#FFF" } : { color: colors.textSecondary }]}>
                          {idx + 1}
                        </Caption2>
                      </View>
                      <Headline numberOfLines={1} style={{ flex: 1, minWidth: 0 }}>
                        {name}
                      </Headline>
                    </View>
                    <Subhead style={{ color: profit >= 0 ? colors.success : colors.danger, fontWeight: "600", fontVariant: ["tabular-nums"] }}>
                      {profit >= 0 ? "+" : ""}${profit.toFixed(0)}
                    </Subhead>
                  </View>
                );
              })
            ) : (
              <Footnote style={{ color: colors.textMuted, textAlign: "center", paddingVertical: SPACE.md }}>
                {t.groups.leaderboardEmpty}
              </Footnote>
            )}
          </View>
        </View>

        {/* ═══════════════════════════════════════════════════════════════════════
            PAST GAMES
            ═══════════════════════════════════════════════════════════════════════ */}
        <View style={[cardStyle, styles.sectionCard]}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionHeaderLeft}>
              <Ionicons name="time" size={20} color={colors.textMuted} />
              <Title2>Past Games</Title2>
            </View>
            <Caption2 style={{ color: colors.textMuted }}>{pastGames.length}</Caption2>
          </View>
          <View style={styles.sectionBody}>
            {pastGames.length > 0 ? (
              pastGames.slice(0, 5).map((g: any, idx: number) => (
                <Pressable
                  key={g.game_id || g._id}
                  style={({ pressed }) => [
                    styles.gameRow,
                    { borderBottomColor: idx < Math.min(pastGames.length, 5) - 1 ? colors.border : "transparent", opacity: pressed ? 0.85 : 1 },
                  ]}
                  onPress={() => navigation.navigate("GameNight", { gameId: g.game_id || g._id })}
                >
                  <View style={styles.gameInfo}>
                    <Headline numberOfLines={1}>{g.title || "Game Night"}</Headline>
                    <Footnote style={{ color: colors.textMuted, marginTop: 2 }}>
                      {g.player_count || 0} players{g.total_pot ? ` · $${g.total_pot} pot` : ""}
                    </Footnote>
                  </View>
                  <View style={[styles.statusPill, { backgroundColor: secondaryBg }]}>
                    <Caption2 style={{ color: colors.textMuted }}>Ended</Caption2>
                  </View>
                </Pressable>
              ))
            ) : (
              <View style={styles.emptyState}>
                <Ionicons name="game-controller-outline" size={28} color={colors.textMuted} />
                <Footnote style={{ color: colors.textMuted, marginTop: SPACE.sm }}>No games recorded yet</Footnote>
              </View>
            )}
          </View>
        </View>
      </ScrollView>

      {/* ═══════════════════════════════════════════════════════════════════════
          ENGAGEMENT SETTINGS MODAL — Triggered by gear icon
          ═══════════════════════════════════════════════════════════════════════ */}
      <Modal visible={showEngSettingsSheet} animationType="slide" transparent onRequestClose={() => setShowEngSettingsSheet(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setShowEngSettingsSheet(false)} />
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.modalOverlay} pointerEvents="box-none">
          <Pressable style={[styles.sheetContainer, { backgroundColor: colors.surface }]} onPress={(e) => e.stopPropagation()}>
            <View style={[styles.sheetHandle, { backgroundColor: isDark ? "rgba(255,255,255,0.22)" : "rgba(0,0,0,0.12)" }]} />
            <Title2 style={styles.sheetTitle}>{t.groups.engagementSettings}</Title2>

            {engSettings && (
              <View style={styles.engSettingsBody}>
                <View style={styles.engSwitchRow}>
                  <View style={{ flex: 1, paddingRight: SPACE.md }}>
                    <Subhead style={{ color: colors.textPrimary }}>{t.groups.engagementEnabled}</Subhead>
                    <Footnote style={{ color: colors.textMuted, marginTop: 2 }}>{t.groups.engagementEnabledHint}</Footnote>
                  </View>
                  <Switch
                    value={engSettings.engagement_enabled !== false}
                    onValueChange={(v) => updateEngSetting("engagement_enabled", v)}
                    trackColor={{ false: colors.border, true: colors.buttonPrimary }}
                    thumbColor="#FFFFFF"
                    ios_backgroundColor={colors.border}
                  />
                </View>

                {engSettings.engagement_enabled !== false && (
                  <>
                    {([
                      ["milestone_celebrations", t.groups.milestoneCelebrations],
                      ["big_winner_celebrations", t.groups.winnerCelebrations],
                      ["weekly_digest", t.groups.weeklyDigest],
                      ["show_amounts_in_celebrations", t.groups.showAmountsInCelebrations],
                    ] as const).map(([key, label]) => (
                      <View key={key} style={styles.engSwitchRowCompact}>
                        <Footnote style={{ color: colors.textSecondary, flex: 1 }}>{label}</Footnote>
                        <Switch
                          value={!!engSettings[key]}
                          onValueChange={(v) => updateEngSetting(key, v)}
                          trackColor={{ false: colors.border, true: colors.buttonPrimary }}
                          thumbColor="#FFFFFF"
                          ios_backgroundColor={colors.border}
                        />
                      </View>
                    ))}

                    <View style={[styles.engNudgeSection, { borderTopColor: colors.border }]}>
                      <Footnote style={{ color: colors.textMuted, marginBottom: SPACE.sm }}>{t.groups.groupInactivityNudge}</Footnote>
                      <View style={styles.dayChipsRow}>
                        {GROUP_NUDGE_DAY_OPTIONS.map((d) => {
                          const selected = (engSettings.inactive_group_nudge_days ?? 14) === d;
                          return (
                            <Pressable
                              key={d}
                              onPress={() => updateEngSetting("inactive_group_nudge_days", d)}
                              style={({ pressed }) => [
                                styles.dayChip,
                                { borderColor: selected ? colors.buttonPrimary : colors.border, backgroundColor: selected ? colors.buttonPrimary : "transparent", opacity: pressed ? 0.85 : 1 },
                              ]}
                            >
                              <Caption2 style={{ color: selected ? colors.buttonText : colors.textPrimary, fontVariant: ["tabular-nums"] }}>
                                {t.groups.daysCount.replace("{n}", String(d))}
                              </Caption2>
                            </Pressable>
                          );
                        })}
                      </View>
                      <Footnote style={{ color: colors.textMuted, marginBottom: SPACE.sm, marginTop: SPACE.md }}>{t.groups.userInactivityNudge}</Footnote>
                      <View style={styles.dayChipsRow}>
                        {USER_NUDGE_DAY_OPTIONS.map((d) => {
                          const selected = (engSettings.inactive_user_nudge_days ?? 30) === d;
                          return (
                            <Pressable
                              key={d}
                              onPress={() => updateEngSetting("inactive_user_nudge_days", d)}
                              style={({ pressed }) => [
                                styles.dayChip,
                                { borderColor: selected ? colors.buttonPrimary : colors.border, backgroundColor: selected ? colors.buttonPrimary : "transparent", opacity: pressed ? 0.85 : 1 },
                              ]}
                            >
                              <Caption2 style={{ color: selected ? colors.buttonText : colors.textPrimary, fontVariant: ["tabular-nums"] }}>
                                {t.groups.daysCount.replace("{n}", String(d))}
                              </Caption2>
                            </Pressable>
                          );
                        })}
                      </View>
                    </View>
                  </>
                )}
                {engSettingsError && <Footnote style={{ color: colors.danger, marginTop: SPACE.sm }}>{engSettingsError}</Footnote>}
              </View>
            )}

            <GlassButton variant="secondary" size="large" fullWidth onPress={() => setShowEngSettingsSheet(false)} style={{ marginTop: SPACE.lg }}>
              Done
            </GlassButton>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>

      {/* ═══════════════════════════════════════════════════════════════════════
          START GAME MODAL
          ═══════════════════════════════════════════════════════════════════════ */}
      <Modal visible={showStartGameSheet} animationType="slide" transparent onRequestClose={() => setShowStartGameSheet(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setShowStartGameSheet(false)} />
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.modalOverlay} pointerEvents="box-none">
          <Pressable style={[styles.sheetContainer, { backgroundColor: colors.surface }]} onPress={(e) => e.stopPropagation()}>
            <View style={[styles.sheetHandle, { backgroundColor: isDark ? "rgba(255,255,255,0.22)" : "rgba(0,0,0,0.12)" }]} />
            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              nestedScrollEnabled
              style={styles.startGameSheetScroll}
            >
              <StartGameForm
                key={startGameFormKey}
                variant="hubSheet"
                groupId={groupId}
                members={members}
                currentUserId={user?.user_id}
                smartDefaults={smartDefaults}
                onSuccess={(gameId) => {
                  setShowStartGameSheet(false);
                  navigation.navigate("GameNight", { gameId });
                }}
                onCancel={() => setShowStartGameSheet(false)}
              />
            </ScrollView>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>

      {/* ═══════════════════════════════════════════════════════════════════════
          INVITE MEMBERS MODAL
          ═══════════════════════════════════════════════════════════════════════ */}
      <Modal visible={showInviteSheet} animationType="slide" transparent onRequestClose={() => setShowInviteSheet(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.modalOverlay}>
          <Pressable style={styles.modalBackdrop} onPress={() => setShowInviteSheet(false)} />
          <Pressable style={[styles.sheetContainer, { backgroundColor: colors.surface }]} onPress={(e) => e.stopPropagation()}>
            <View style={[styles.sheetHandle, { backgroundColor: isDark ? "rgba(255,255,255,0.22)" : "rgba(0,0,0,0.12)" }]} />
            <Title2 style={styles.sheetTitle}>Invite Members</Title2>

            <View style={styles.modeToggle}>
              <Pressable
                style={({ pressed }) => [
                  styles.modeBtn,
                  { borderColor: inviteMode === "search" ? colors.buttonPrimary : colors.border, backgroundColor: inviteMode === "search" ? colors.buttonPrimary : "transparent", opacity: pressed ? 0.9 : 1 },
                ]}
                onPress={() => setInviteMode("search")}
              >
                <Ionicons name="search" size={16} color={inviteMode === "search" ? colors.buttonText : colors.textMuted} />
                <Caption2 style={{ color: inviteMode === "search" ? colors.buttonText : colors.textMuted }}>{t.common.search}</Caption2>
              </Pressable>
              <Pressable
                style={({ pressed }) => [
                  styles.modeBtn,
                  { borderColor: inviteMode === "email" ? colors.buttonPrimary : colors.border, backgroundColor: inviteMode === "email" ? colors.buttonPrimary : "transparent", opacity: pressed ? 0.9 : 1 },
                ]}
                onPress={() => setInviteMode("email")}
              >
                <Ionicons name="mail" size={16} color={inviteMode === "email" ? colors.buttonText : colors.textMuted} />
                <Caption2 style={{ color: inviteMode === "email" ? colors.buttonText : colors.textMuted }}>Email</Caption2>
              </Pressable>
            </View>

            {inviteMode === "search" ? (
              <>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.inputBg, color: colors.textPrimary, borderColor: colors.border }]}
                  placeholder="Search by name or email..."
                  placeholderTextColor={colors.textMuted}
                  value={searchQuery}
                  onChangeText={handleSearchUsers}
                />
                {searching && <ActivityIndicator size="small" color={colors.textSecondary} style={{ marginVertical: SPACE.sm }} />}
                {searchResults.length > 0 && (
                  <View style={styles.searchResults}>
                    {searchResults.map((u: any) => (
                      <View key={u.user_id} style={[styles.searchResultItem, { borderColor: colors.border }]}>
                        <View style={[styles.memberAvatar, { backgroundColor: colors.inputBg }]}>
                          <Subhead style={{ color: colors.textSecondary, fontWeight: "600" }}>{(u.name || u.email || "?")[0].toUpperCase()}</Subhead>
                        </View>
                        <View style={styles.searchResultInfo}>
                          <Headline numberOfLines={1}>{u.name}</Headline>
                          <Footnote style={{ color: colors.textMuted }} numberOfLines={1}>{u.email}</Footnote>
                        </View>
                        <GlassButton variant="primary" size="compact" onPress={() => handleInvite(u.email)} disabled={inviting === u.email} loading={inviting === u.email}>
                          {t.groups.invite}
                        </GlassButton>
                      </View>
                    ))}
                  </View>
                )}
              </>
            ) : (
              <>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.inputBg, color: colors.textPrimary, borderColor: colors.border }]}
                  placeholder="friend@example.com"
                  placeholderTextColor={colors.textMuted}
                  value={inviteEmail}
                  onChangeText={setInviteEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
                <Footnote style={{ color: colors.textMuted, marginBottom: SPACE.md }}>
                  If they&apos;re not registered, the invite will be waiting when they sign up!
                </Footnote>
                <GlassButton variant="primary" size="large" fullWidth disabled={!inviteEmail.trim()} loading={!!inviting} onPress={() => handleInvite(inviteEmail)}>
                  {t.groups.invite}
                </GlassButton>
              </>
            )}

            {pendingInvites.length > 0 && (
              <View style={[styles.pendingSection, { borderTopColor: colors.border }]}>
                <Footnote style={{ color: colors.textSecondary, marginBottom: SPACE.sm }}>Pending invites ({pendingInvites.length})</Footnote>
                {pendingInvites.map((inv: any) => (
                  <View key={inv.invite_id} style={[styles.pendingItem, { backgroundColor: colors.inputBg }]}>
                    <Footnote style={{ color: colors.textMuted, flex: 1 }} numberOfLines={1}>{inv.invited_email}</Footnote>
                    <View style={[styles.pendingBadge, { backgroundColor: isDark ? "rgba(255,204,0,0.15)" : "rgba(255,204,0,0.12)" }]}>
                      <Caption2 style={{ color: colors.warning }}>Pending</Caption2>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>

      {/* ═══════════════════════════════════════════════════════════════════════
          TRANSFER ADMIN MODAL
          ═══════════════════════════════════════════════════════════════════════ */}
      <Modal visible={showTransferSheet} animationType="slide" transparent onRequestClose={() => setShowTransferSheet(false)}>
        <View style={styles.modalOverlay}>
          <Pressable style={styles.modalBackdrop} onPress={() => setShowTransferSheet(false)} />
          <Pressable style={[styles.sheetContainer, { backgroundColor: colors.surface }]} onPress={(e) => e.stopPropagation()}>
            <View style={[styles.sheetHandle, { backgroundColor: isDark ? "rgba(255,255,255,0.22)" : "rgba(0,0,0,0.12)" }]} />
            <Title2 style={styles.sheetTitle}>{t.groups.transferAdmin}</Title2>
            <Footnote style={{ color: colors.textMuted, textAlign: "center", marginBottom: SPACE.lg }}>Select a member to become the new admin</Footnote>

            {members.filter((m: any) => m.role !== "admin").map((m: any) => {
              const memberName = m?.user?.name || m?.name || m?.user?.email || m?.email || "Unknown";
              const isSelected = selectedNewAdmin === m.user_id;
              return (
                <Pressable
                  key={m.user_id}
                  style={({ pressed }) => [
                    styles.transferItem,
                    { borderColor: isSelected ? colors.buttonPrimary : colors.border, borderWidth: isSelected ? 2 : 1, opacity: pressed ? 0.92 : 1 },
                  ]}
                  onPress={() => setSelectedNewAdmin(m.user_id)}
                >
                  <View style={[styles.memberAvatar, { backgroundColor: colors.inputBg }]}>
                    <Subhead style={{ color: colors.textSecondary, fontWeight: "600" }}>{memberName[0].toUpperCase()}</Subhead>
                  </View>
                  <Headline numberOfLines={1} style={{ flex: 1 }}>{memberName}</Headline>
                  {isSelected && <Ionicons name="checkmark-circle" size={22} color={colors.buttonPrimary} />}
                </Pressable>
              );
            })}

            <View style={styles.sheetActions}>
              <GlassButton variant="secondary" size="large" style={styles.sheetActionBtn} onPress={() => { setShowTransferSheet(false); setSelectedNewAdmin(null); }}>
                {t.common.cancel}
              </GlassButton>
              <GlassButton variant="primary" size="large" style={styles.sheetActionBtn} disabled={!selectedNewAdmin} loading={transferring} onPress={handleTransferAdmin}>
                {t.groups.transfer}
              </GlassButton>
            </View>
          </Pressable>
        </View>
      </Modal>

      {/* ═══════════════════════════════════════════════════════════════════════
          MEMBER ACTIONS MODAL
          ═══════════════════════════════════════════════════════════════════════ */}
      <Modal visible={!!showMemberActions} animationType="fade" transparent onRequestClose={() => setShowMemberActions(null)}>
        <View style={styles.actionModalOverlay}>
          <Pressable style={styles.modalBackdrop} onPress={() => setShowMemberActions(null)} />
          <View style={[styles.actionSheet, { backgroundColor: colors.surface }]}>
            <Pressable
              style={({ pressed }) => [styles.actionItem, { borderBottomColor: colors.border, opacity: pressed ? 0.85 : 1 }]}
              onPress={() => showMemberActions && handleRemoveMember(showMemberActions)}
              disabled={removingMember}
            >
              {removingMember ? (
                <ActivityIndicator size="small" color={colors.danger} />
              ) : (
                <>
                  <Ionicons name="person-remove" size={22} color={colors.danger} />
                  <Headline style={{ color: colors.danger }}>Remove member</Headline>
                </>
              )}
            </Pressable>
            <Pressable style={({ pressed }) => [styles.actionItem, { opacity: pressed ? 0.85 : 1 }]} onPress={() => setShowMemberActions(null)}>
              <Headline style={{ color: colors.textSecondary }}>Cancel</Headline>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   STYLES — Apple HIG spacing: 16pt margins, 20pt section gaps, 12pt element gaps
   ───────────────────────────────────────────────────────────────────────────── */

const styles = StyleSheet.create({
  root: { flex: 1 },
  topGradient: { position: "absolute", top: 0, left: 0, right: 0, zIndex: 0 },
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
  screenTitle: { flex: 1, minWidth: 0, textAlign: "left", letterSpacing: -0.5 },
  headerTrailingBalance: { width: LAYOUT.touchTarget, minHeight: LAYOUT.touchTarget },
  body: { flex: 1, zIndex: 1 },
  scrollContent: { paddingHorizontal: SCREEN_PAD, paddingTop: SPACE.sm },

  /* ─── Error ─── */
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    padding: SPACE.md,
    borderRadius: RADIUS.lg,
    borderWidth: StyleSheet.hairlineWidth,
    gap: SPACE.sm,
    marginBottom: LAYOUT.sectionGap,
  },

  /* ─── Bento Stats Row ─── */
  bentoRow: { flexDirection: "row", gap: SPACE.sm, marginBottom: LAYOUT.sectionGap },
  bentoCard: { flex: 1, paddingHorizontal: SPACE.md, paddingVertical: SPACE.md, position: "relative" },
  bentoGear: { position: "absolute", top: SPACE.sm, right: SPACE.sm, zIndex: 1, padding: SPACE.xs },
  bentoRingOuter: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth * 2,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginTop: SPACE.sm,
  },
  bentoRingInner: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },

  /* ─── Actions Card ─── */
  actionsCard: { padding: SPACE.md, marginBottom: LAYOUT.sectionGap, gap: SPACE.sm },
  primaryActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACE.sm,
    borderRadius: RADIUS.xl,
    minHeight: BUTTON_SIZE.large.height,
  },
  secondaryActionsRow: { flexDirection: "row", gap: SPACE.sm },
  secondaryActionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACE.sm,
    borderRadius: RADIUS.lg,
    borderWidth: StyleSheet.hairlineWidth,
    minHeight: BUTTON_SIZE.regular.height,
  },
  actionsContextText: { textAlign: "center", lineHeight: 20 },
  actionsLiveContext: { gap: SPACE.xs },
  actionsLiveTitleRow: { flexDirection: "row", alignItems: "flex-start", gap: SPACE.sm },
  primaryActionMuted: {
    borderWidth: StyleSheet.hairlineWidth,
  },
  liveDot: { width: 10, height: 10, borderRadius: 5, marginTop: 4 },

  /* ─── Section Cards ─── */
  sectionCard: { marginBottom: LAYOUT.sectionGap, overflow: "hidden" },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: LAYOUT.cardPadding,
    paddingVertical: SPACE.md,
  },
  sectionHeaderLeft: { flexDirection: "row", alignItems: "center", gap: SPACE.sm },
  sectionBody: { paddingHorizontal: LAYOUT.cardPadding, paddingBottom: SPACE.md },

  /* ─── Admin Actions ─── */
  adminActionsRow: { flexDirection: "row", gap: SPACE.sm, paddingHorizontal: LAYOUT.cardPadding, marginBottom: SPACE.sm },
  adminActionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACE.sm,
    borderRadius: RADIUS.lg,
    borderWidth: StyleSheet.hairlineWidth,
    minHeight: BUTTON_SIZE.regular.height,
  },

  /* ─── Members ─── */
  memberRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: SPACE.md,
    gap: SPACE.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  memberAvatar: { width: 40, height: 40, borderRadius: 12, justifyContent: "center", alignItems: "center" },
  memberInfo: { flex: 1, gap: 4 },
  memberNameRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap" },
  roleBadge: { flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start", paddingHorizontal: SPACE.sm, paddingVertical: 2, borderRadius: RADIUS.sm },
  memberActionBtn: { width: LAYOUT.touchTarget, height: LAYOUT.touchTarget, borderRadius: RADIUS.lg, justifyContent: "center", alignItems: "center" },

  /* ─── Games ─── */
  gameRow: { flexDirection: "row", alignItems: "center", paddingVertical: SPACE.md, borderBottomWidth: StyleSheet.hairlineWidth },
  gameInfo: { flex: 1, minWidth: 0 },
  statusPill: { paddingHorizontal: SPACE.md, paddingVertical: SPACE.xs, borderRadius: RADIUS.sm, flexDirection: "row", alignItems: "center", gap: SPACE.xs },

  /* ─── Leaderboard ─── */
  leaderboardRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: SPACE.sm, borderBottomWidth: StyleSheet.hairlineWidth, gap: SPACE.sm },
  leaderboardLeft: { flexDirection: "row", alignItems: "center", gap: SPACE.sm, flex: 1, minWidth: 0 },
  rankBadge: { width: 24, height: 24, borderRadius: RADIUS.full, alignItems: "center", justifyContent: "center" },
  rankText: { fontSize: 11, fontWeight: "700" },
  rankGold: { backgroundColor: "#EAB308" },
  rankSilver: { backgroundColor: "#9CA3AF" },
  rankBronze: { backgroundColor: "#B45309" },
  rankDefault: { backgroundColor: "rgba(128,128,128,0.25)" },

  /* ─── Empty State ─── */
  emptyState: { alignItems: "center", paddingVertical: SPACE.xl },

  /* ─── Engagement Settings (inside modal) ─── */
  engSettingsBody: { gap: SPACE.md },
  engSwitchRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: SPACE.sm },
  engSwitchRowCompact: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: SPACE.xs, gap: SPACE.md },
  engNudgeSection: { marginTop: SPACE.sm, paddingTop: SPACE.md, borderTopWidth: StyleSheet.hairlineWidth },
  dayChipsRow: { flexDirection: "row", flexWrap: "wrap", gap: SPACE.xs },
  dayChip: { paddingVertical: SPACE.sm, paddingHorizontal: SPACE.md, borderRadius: RADIUS.lg, borderWidth: StyleSheet.hairlineWidth },

  /* ─── Modals ─── */
  modalOverlay: { flex: 1, justifyContent: "flex-end" },
  modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.5)" },
  sheetContainer: { borderTopLeftRadius: RADIUS.sheet, borderTopRightRadius: RADIUS.sheet, padding: SPACE.xxl, paddingBottom: 40, maxHeight: "92%" },
  startGameSheetScroll: { maxHeight: 560 },
  sheetHandle: { width: 36, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: SPACE.lg },
  sheetTitle: { textAlign: "center", marginBottom: SPACE.lg },
  sheetError: { padding: SPACE.md, borderRadius: RADIUS.md, marginBottom: SPACE.md },
  sheetActions: { flexDirection: "row", gap: SPACE.md, marginTop: SPACE.lg },
  sheetActionBtn: { flex: 1 },
  input: { borderWidth: 1, borderRadius: RADIUS.lg, padding: SPACE.md, fontSize: APPLE_TYPO.body.size, marginBottom: SPACE.md },
  optionRow: { flexDirection: "row", gap: SPACE.sm, marginBottom: SPACE.md },
  optionBtn: { flex: 1, minHeight: LAYOUT.touchTarget, borderRadius: RADIUS.lg, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  previewCard: { borderRadius: RADIUS.lg, padding: SPACE.lg, borderWidth: 1, alignItems: "center", marginTop: SPACE.md },

  /* ─── Invite Modal ─── */
  modeToggle: { flexDirection: "row", gap: SPACE.sm, marginBottom: SPACE.lg },
  modeBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: SPACE.xs, minHeight: LAYOUT.touchTarget, borderRadius: RADIUS.lg, borderWidth: 1 },
  searchResults: { maxHeight: 200, marginTop: SPACE.sm },
  searchResultItem: { flexDirection: "row", alignItems: "center", padding: SPACE.md, borderRadius: RADIUS.lg, marginBottom: SPACE.sm, borderWidth: 1, gap: SPACE.sm },
  searchResultInfo: { flex: 1, gap: 2 },
  pendingSection: { marginTop: SPACE.lg, paddingTop: SPACE.lg, borderTopWidth: 1 },
  pendingItem: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: SPACE.sm, borderRadius: RADIUS.md, marginBottom: SPACE.xs },
  pendingBadge: { paddingHorizontal: SPACE.sm, paddingVertical: 2, borderRadius: RADIUS.sm },

  /* ─── Transfer Modal ─── */
  transferItem: { flexDirection: "row", alignItems: "center", padding: SPACE.md, borderRadius: RADIUS.lg, marginBottom: SPACE.sm, gap: SPACE.sm },

  /* ─── Action Modal ─── */
  actionModalOverlay: { flex: 1, justifyContent: "center", alignItems: "center" },
  actionSheet: { width: "80%", borderRadius: RADIUS.xl, overflow: "hidden" },
  actionItem: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: SPACE.sm, paddingVertical: SPACE.md, paddingHorizontal: SPACE.lg, minHeight: LAYOUT.touchTarget, borderBottomWidth: 1 },
});