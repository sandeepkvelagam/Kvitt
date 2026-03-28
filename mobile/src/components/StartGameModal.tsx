/**
 * Start Game — same bottom-sheet shell as Groups “Create group” (modalRoot, sheetShell, RADIUS.sheet).
 * Two steps: prepare group (search + pick group, member peek & players) → game settings (StartGameForm).
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  Platform,
  ScrollView,
  TextInput,
  ActivityIndicator,
  useWindowDimensions,
  TouchableOpacity,
  type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../api/client";
import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import { useHaptics } from "../context/HapticsContext";
import { useStartGameModal } from "../context/StartGameModalContext";
import { navigationRef } from "../navigation/RootNavigator";
import { Title2, Title3, Headline, Subhead, Footnote, Caption2, GlassButton } from "./ui";
import { StartGameForm, type StartGameFormSmartDefaults } from "./game/StartGameForm";
import { StartGamePlayerSelection } from "./game/StartGamePlayerSelection";
import {
  LAYOUT,
  SPACE,
  RADIUS,
  APPLE_TYPO,
  BUTTON_SIZE,
  BILLING_PAGE,
  BILLING_MENU_ICON_SIZE,
  BOTTOM_SHEET,
  FONT,
  ICON_WELL,
  MEMBER_AVATAR_STACK,
  hitSlopExpandToMinSize,
} from "../styles/tokens";
import {
  appleCardShadowResting,
  appleCardShadowProminent,
  appleTileShadow,
} from "../styles/appleShadows";
import { memberAvatarBackground } from "../utils/memberAvatarTints";

type GroupItem = { group_id: string; name: string; member_count?: number; role?: string };

type StartGameStep = "prepareGame" | "gameSettings";

const MEMBER_STACK_MAX = 5;
const MEMBER_GLANCE_PREVIEW = 3;

/** Group Hub–style bento ring — canonical `BILLING_PAGE.menu` well */
const ROLE_RING_WELL = BILLING_PAGE.menu;

function displayNameForMember(m: any): string {
  const u = m?.user;
  const s = (u?.name || m?.name || u?.email || m?.email || "").trim();
  return s || "?";
}

/** API returns DB column `email`; legacy/client may use `invited_email`. */
function pendingInviteEmail(inv: any): string {
  const s = inv?.email ?? inv?.invited_email ?? "";
  return typeof s === "string" ? s.trim() : "";
}

type MemberAvatarStackProps = {
  members: any[];
  colors: ReturnType<typeof useTheme>["colors"];
  borderColor: string;
  isDark: boolean;
  /** Avatars to show before +N (default 5). Use with totalCount when previewing a subset. */
  maxVisible?: number;
  /** Total members for +N overflow; defaults to members.length */
  totalCount?: number;
  /** Override row container (e.g. marginTop: 0 when flush with sibling) */
  containerStyle?: ViewStyle;
};

function MemberAvatarStack({
  members,
  colors,
  borderColor,
  isDark,
  maxVisible = MEMBER_STACK_MAX,
  totalCount,
  containerStyle,
}: MemberAvatarStackProps) {
  const list = Array.isArray(members) ? members : [];
  const cap = Math.min(maxVisible, MEMBER_STACK_MAX);
  const slice = list.slice(0, cap);
  const total = totalCount ?? list.length;
  const overflow = Math.max(0, total - slice.length);
  return (
    <View style={[memberStackStyles.row, containerStyle]}>
      {slice.map((m, i) => (
        <View
          key={String(m?.user_id ?? i)}
          style={[
            memberStackStyles.slot,
            { marginLeft: i === 0 ? 0 : -MEMBER_AVATAR_STACK.overlap, zIndex: slice.length - i },
          ]}
        >
          <View
            style={[
              memberStackStyles.disc,
              { backgroundColor: memberAvatarBackground(i, isDark), borderColor },
            ]}
          >
            <Text style={[memberStackStyles.initial, { color: colors.textPrimary }]}>
              {displayNameForMember(m)[0]?.toUpperCase() ?? "?"}
            </Text>
          </View>
        </View>
      ))}
      {overflow > 0 ? (
        <View
          style={[
            memberStackStyles.slot,
            { marginLeft: slice.length === 0 ? 0 : -MEMBER_AVATAR_STACK.overlap, zIndex: 0 },
          ]}
        >
          <View style={[memberStackStyles.disc, { backgroundColor: colors.inputBg, borderColor }]}>
            <Text style={[memberStackStyles.overflow, { color: colors.textPrimary }]}>+{overflow}</Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const memberStackStyles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", flexWrap: "nowrap", marginTop: SPACE.sm },
  slot: {},
  disc: {
    width: MEMBER_AVATAR_STACK.discDiameter,
    height: MEMBER_AVATAR_STACK.discDiameter,
    borderRadius: MEMBER_AVATAR_STACK.discDiameter / 2,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  initial: { fontSize: APPLE_TYPO.subhead.size, fontWeight: "600" },
  overflow: { fontSize: APPLE_TYPO.footnote.size, fontWeight: "700", fontVariant: ["tabular-nums"] },
});

export function StartGameModal() {
  const { isDark, colors } = useTheme();
  const { user } = useAuth();
  const { t } = useLanguage();
  const { triggerHaptic } = useHaptics();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const { visible, openOptions, closeStartGame } = useStartGameModal();

  const searchInputRef = useRef<TextInput>(null);

  const [formKey, setFormKey] = useState(0);
  const [groupSelectionLocked, setGroupSelectionLocked] = useState(false);
  const [step, setStep] = useState<StartGameStep>("prepareGame");
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);

  const [searchQuery, setSearchQuery] = useState("");
  const [groups, setGroups] = useState<GroupItem[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);

  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [selectedGroupName, setSelectedGroupName] = useState("");
  const [groupDetail, setGroupDetail] = useState<any | null>(null);
  const [smartDefaults, setSmartDefaults] = useState<StartGameFormSmartDefaults>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const [inviteExpanded, setInviteExpanded] = useState(false);
  const [inviteMode, setInviteMode] = useState<"search" | "email">("search");
  const [inviteSearchQuery, setInviteSearchQuery] = useState("");
  const [inviteSearchResults, setInviteSearchResults] = useState<any[]>([]);
  const [inviteSearching, setInviteSearching] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [invitingEmail, setInvitingEmail] = useState<string | null>(null);
  const [pendingInvites, setPendingInvites] = useState<any[]>([]);
  const [memberGlanceExpanded, setMemberGlanceExpanded] = useState(false);

  const sheetMaxHeight = Math.round(windowHeight * 0.88);
  const scrollBottomPad = Math.max(insets.bottom, SPACE.lg) + SPACE.md;
  /** Space for floating Continue + shadow lift + safe area */
  const prepareFooterReserve =
    BUTTON_SIZE.large.height + SPACE.lg + SPACE.md + Math.max(insets.bottom, SPACE.sm);

  const prepareScrollBottomPad = useMemo(
    () => prepareFooterReserve + SPACE.sm,
    [prepareFooterReserve]
  );

  const sheetOuterStyle = useMemo(
    () => ({
      height: sheetMaxHeight,
      maxHeight: sheetMaxHeight,
    }),
    [sheetMaxHeight]
  );

  const cardChrome = useMemo(
    () => ({
      backgroundColor: colors.surface,
      borderRadius: RADIUS.lg,
      borderWidth: 1,
      borderColor: isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.06)",
      ...appleCardShadowResting(isDark),
    }),
    [colors.surface, isDark]
  );

  /**
   * Member peek + “Who’s playing” — shadow must read as lift, not a hard outline.
   * Do not combine with overflow:hidden on the same view (clips iOS shadows).
   */
  const sectionCardChrome = useMemo(
    () => ({
      backgroundColor: colors.surface,
      borderRadius: RADIUS.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: isDark ? "rgba(255, 255, 255, 0.07)" : "rgba(0, 0, 0, 0.05)",
      ...appleCardShadowProminent(isDark),
    }),
    [colors.surface, isDark]
  );

  /** Inner invite panels — same lift as cards; use where parent no longer clips shadows */
  const innerPanelChrome = cardChrome;

  /** Group Hub bento — same ring pad + tile chrome as [GroupHubScreen](mobile/src/screens/GroupHubScreen.tsx) */
  const ringPadBento = useMemo(
    () => ({
      bg: isDark ? "rgba(255, 255, 255, 0.06)" : "rgba(0, 0, 0, 0.04)",
      border: isDark ? "rgba(255, 255, 255, 0.09)" : "rgba(0, 0, 0, 0.07)",
    }),
    [isDark]
  );

  const bentoRoleTileStyle = useMemo(
    () => ({
      backgroundColor: isDark ? "rgba(45, 45, 48, 0.9)" : "rgba(255, 255, 255, 0.95)",
      borderRadius: RADIUS.lg,
      borderWidth: 1,
      borderColor: isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.06)",
      ...appleCardShadowResting(isDark),
    }),
    [isDark]
  );

  /** Dashboard V3 tri-card metric rings — same cool-neutral pad */
  const metricRingPad = useMemo(
    () => ({
      padBg: isDark ? "rgba(168, 182, 215, 0.1)" : "rgba(88, 102, 138, 0.07)",
      rimBorder: isDark ? "rgba(255, 255, 255, 0.09)" : "rgba(0, 0, 0, 0.07)",
    }),
    [isDark]
  );

  const loadGroups = useCallback(async () => {
    setListError(null);
    setListLoading(true);
    try {
      const res = await api.get("/groups");
      const raw = res.data?.groups ?? res.data;
      const data = Array.isArray(raw) ? raw : [];
      setGroups(data);
    } catch (e: any) {
      setListError(e?.response?.data?.detail || e?.message || t.game.startGameFailed);
    } finally {
      setListLoading(false);
    }
  }, [t.game.startGameFailed]);

  const loadGroupDetail = useCallback(
    async (gid: string) => {
      setDetailError(null);
      setDetailLoading(true);
      setGroupDetail(null);
      try {
        const [groupRes, defRes] = await Promise.all([
          api.get(`/groups/${gid}`),
          api.get(`/groups/${gid}/smart-defaults`).catch(() => ({ data: null })),
        ]);
        setGroupDetail(groupRes.data);
        const def = defRes.data;
        if (def && def.games_analyzed > 0) setSmartDefaults(def);
        else setSmartDefaults(null);
        const rawMembers = groupRes.data?.members ?? [];
        const otherIds = rawMembers
          .filter((m: any) => m.user_id && m.user_id !== user?.user_id)
          .map((m: any) => m.user_id);
        setSelectedMemberIds(otherIds);
      } catch (e: any) {
        setDetailError(e?.response?.data?.detail || e?.message || t.game.startGameFailed);
      } finally {
        setDetailLoading(false);
      }
    },
    [t.game.startGameFailed, user?.user_id]
  );

  useEffect(() => {
    if (!visible) {
      setSearchQuery("");
      setListError(null);
      setDetailError(null);
      setStep("prepareGame");
      setSelectedMemberIds([]);
      setInviteExpanded(false);
      setInviteMode("search");
      setInviteSearchQuery("");
      setInviteSearchResults([]);
      setInviteSearching(false);
      setInviteEmail("");
      setInvitingEmail(null);
      setPendingInvites([]);
      setMemberGlanceExpanded(false);
      return;
    }

    setFormKey((k) => k + 1);
    const gid = openOptions?.groupId;
    const gname = openOptions?.groupName ?? "";
    if (gid) {
      setGroupSelectionLocked(true);
      setSelectedGroupId(gid);
      setSelectedGroupName(gname);
      setStep("prepareGame");
      loadGroupDetail(gid);
    } else {
      setGroupSelectionLocked(false);
      setSelectedGroupId(null);
      setSelectedGroupName("");
      setGroupDetail(null);
      setSmartDefaults(null);
      setStep("prepareGame");
      loadGroups();
    }
  }, [visible, openOptions?.groupId, openOptions?.groupName, loadGroupDetail, loadGroups]);

  const filteredGroups = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return groups;
    return groups.filter((g) => g.name?.toLowerCase().includes(q));
  }, [groups, searchQuery]);

  const onPickGroup = (g: GroupItem) => {
    setSelectedGroupId(g.group_id);
    setSelectedGroupName(g.name);
    loadGroupDetail(g.group_id);
  };

  const onChangeGroup = () => {
    setSelectedMemberIds([]);
    setSelectedGroupId(null);
    setSelectedGroupName("");
    setGroupDetail(null);
    setSmartDefaults(null);
    setDetailError(null);
    setInviteExpanded(false);
    setInviteSearchQuery("");
    setInviteSearchResults([]);
    setInviteEmail("");
    setMemberGlanceExpanded(false);
    if (groups.length === 0) loadGroups();
  };

  useEffect(() => {
    if (!visible || !inviteExpanded || inviteMode !== "search" || !selectedGroupId) return;
    const q = inviteSearchQuery.trim();
    if (q.length < 2) {
      setInviteSearchResults([]);
      return;
    }
    const tm = setTimeout(() => {
      (async () => {
        setInviteSearching(true);
        try {
          const res = await api.get(`/users/search?query=${encodeURIComponent(q)}`);
          const raw = res.data;
          setInviteSearchResults(Array.isArray(raw) ? raw.slice(0, 8) : []);
        } catch {
          setInviteSearchResults([]);
        } finally {
          setInviteSearching(false);
        }
      })();
    }, 350);
    return () => clearTimeout(tm);
  }, [inviteSearchQuery, inviteExpanded, inviteMode, visible, selectedGroupId]);

  useEffect(() => {
    setPendingInvites([]);
  }, [selectedGroupId]);

  const fetchPendingInvites = useCallback(async () => {
    if (!selectedGroupId) return;
    try {
      const res = await api.get(`/groups/${selectedGroupId}/invites`);
      setPendingInvites((res.data || []).filter((i: any) => i.status === "pending"));
    } catch {
      setPendingInvites([]);
    }
  }, [selectedGroupId]);

  const handleInviteToGroup = useCallback(
    async (email: string) => {
      if (!selectedGroupId || !email.trim()) return;
      setInvitingEmail(email.trim());
      try {
        await api.post(`/groups/${selectedGroupId}/invite`, { email: email.trim() });
        await loadGroupDetail(selectedGroupId);
        await fetchPendingInvites();
        setInviteSearchQuery("");
        setInviteSearchResults([]);
        setInviteEmail("");
        triggerHaptic("light");
      } catch {
        // invite failed — user can retry from Group Hub
      } finally {
        setInvitingEmail(null);
      }
    },
    [selectedGroupId, loadGroupDetail, fetchPendingInvites, triggerHaptic]
  );

  const goGameNight = (gameId: string) => {
    closeStartGame();
    if (navigationRef.isReady()) {
      navigationRef.navigate("GameNight", { gameId });
    }
  };

  const isGroupAdmin = useMemo(() => {
    if (!user?.user_id || !groupDetail?.members) return false;
    return groupDetail.members.some((m: any) => m.user_id === user.user_id && m.role === "admin");
  }, [groupDetail, user?.user_id]);

  useEffect(() => {
    if (!visible || !inviteExpanded || !selectedGroupId || !isGroupAdmin) return;
    fetchPendingInvites();
  }, [visible, inviteExpanded, selectedGroupId, isGroupAdmin, fetchPendingInvites]);

  const goMainGroups = () => {
    closeStartGame();
    if (navigationRef.isReady()) {
      navigationRef.navigate("MainTabs", { screen: "Groups" });
    }
  };

  const showGroupFlow =
    !!selectedGroupId && !!groupDetail && !detailLoading && !detailError;

  const prepareScrollContentStyle = useMemo(
    () => [
      styles.sheetScrollContent,
      {
        paddingHorizontal: LAYOUT.screenPadding,
        paddingBottom: prepareScrollBottomPad,
      },
    ],
    [prepareScrollBottomPad]
  );

  const members = groupDetail?.members ?? [];
  const memberTotal = Array.isArray(members) ? members.length : 0;

  const memberUserIdSet = useMemo(() => {
    const s = new Set<string>();
    for (const m of members) {
      if (m?.user_id) s.add(m.user_id);
    }
    return s;
  }, [members]);

  const memberEmailLowerSet = useMemo(() => {
    const s = new Set<string>();
    for (const m of members) {
      const em = (m?.user?.email || m?.email || "").trim().toLowerCase();
      if (em) s.add(em);
    }
    return s;
  }, [members]);

  const pendingEmailLowerSet = useMemo(() => {
    const s = new Set<string>();
    for (const inv of pendingInvites) {
      const e = pendingInviteEmail(inv).toLowerCase();
      if (e) s.add(e);
    }
    return s;
  }, [pendingInvites]);

  const inviteEmailFieldState = useMemo(() => {
    const e = inviteEmail.trim().toLowerCase();
    if (!e) return "empty" as const;
    if (memberEmailLowerSet.has(e)) return "inGroup" as const;
    if (pendingEmailLowerSet.has(e)) return "pending" as const;
    return "ok" as const;
  }, [inviteEmail, memberEmailLowerSet, pendingEmailLowerSet]);

  const getInviteSearchRowState = useCallback(
    (u: any) => {
      const email = (u?.email || "").trim().toLowerCase();
      const uid = u?.user_id as string | undefined;
      const isMember = !!(uid && memberUserIdSet.has(uid));
      const isPending = !!(email && pendingEmailLowerSet.has(email));
      const inLineup = !!(uid && isMember && selectedMemberIds.includes(uid));
      if (inLineup) return "lineup" as const;
      if (isMember) return "member" as const;
      if (isPending) return "pending" as const;
      return "invite" as const;
    },
    [memberUserIdSet, pendingEmailLowerSet, selectedMemberIds]
  );

  const renderDetailError = () => (
    <View style={{ marginTop: SPACE.md }}>
      <Footnote style={{ color: colors.danger }}>{detailError}</Footnote>
      <TouchableOpacity
        style={[styles.secondaryCtaOutline, { borderColor: colors.border, marginTop: SPACE.md }]}
        onPress={() => selectedGroupId && loadGroupDetail(selectedGroupId)}
        activeOpacity={0.88}
        accessibilityRole="button"
      >
        <Text style={[styles.primaryCtaLabel, { color: colors.textPrimary }]}>{t.common.retry}</Text>
      </TouchableOpacity>
    </View>
  );

  const renderGroupPickerSection = () => (
    <View style={styles.sheetFieldGroup}>
      <Footnote style={[styles.sheetFieldLabel, { color: colors.textSecondary }]}>{t.game.chooseGroup}</Footnote>
      <View style={[styles.searchBar, cardChrome, { borderRadius: RADIUS.full }]}>
        <Ionicons name="search-outline" size={18} color={colors.textMuted} />
        <TextInput
          ref={searchInputRef}
          style={[styles.searchInput, { color: colors.textPrimary }]}
          placeholder={t.game.searchGroupsPlaceholder}
          placeholderTextColor={colors.textMuted}
          value={searchQuery}
          onChangeText={setSearchQuery}
          returnKeyType="search"
        />
        {searchQuery.length > 0 ? (
          <TouchableOpacity onPress={() => setSearchQuery("")} activeOpacity={0.7}>
            <Ionicons name="close-circle" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        ) : null}
      </View>
      {listLoading && <ActivityIndicator style={{ marginVertical: SPACE.md }} color={colors.textSecondary} />}
      {listError && <Footnote style={{ color: colors.danger, marginBottom: SPACE.sm }}>{listError}</Footnote>}
      {!listLoading && !listError && filteredGroups.length === 0 && (
        <View style={[cardChrome, styles.emptyCard]}>
          <Footnote style={{ color: colors.textSecondary, textAlign: "center" }}>{t.game.noGroupsForStart}</Footnote>
          <TouchableOpacity
            style={[styles.primaryCtaFill, { backgroundColor: colors.buttonPrimary, marginTop: SPACE.lg }]}
            onPress={() => {
              triggerHaptic("light");
              goMainGroups();
            }}
            activeOpacity={0.88}
            accessibilityRole="button"
          >
            <Text style={[styles.primaryCtaLabel, { color: colors.buttonText }]}>{t.game.goToGroups}</Text>
          </TouchableOpacity>
        </View>
      )}
      {!listLoading &&
        filteredGroups.map((g, index) => (
          <TouchableOpacity
            key={g.group_id}
            style={[
              styles.groupRow,
              { borderBottomColor: colors.border },
              index === filteredGroups.length - 1 && styles.groupRowLast,
            ]}
            onPress={() => onPickGroup(g)}
            activeOpacity={0.7}
          >
            <View style={[styles.groupAvatar, { backgroundColor: colors.inputBg }]}>
              <Title3 style={{ color: colors.textPrimary }}>{g.name?.[0]?.toUpperCase() || "G"}</Title3>
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Headline numberOfLines={1}>{g.name}</Headline>
              <Footnote style={{ color: colors.textMuted, marginTop: 2 }}>
                {g.member_count ?? 0} {t.groups.members}
              </Footnote>
            </View>
          </TouchableOpacity>
        ))}
    </View>
  );

  const renderReviewPlayersBody = () => (
    <>
      <View style={[styles.selectedRow, cardChrome]}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Footnote style={{ color: colors.textMuted }}>{t.groups.hubTitle}</Footnote>
          <Headline numberOfLines={1} style={{ marginTop: 2 }}>
            {groupDetail?.name || selectedGroupName || "…"}
          </Headline>
        </View>
        {!groupSelectionLocked && (
          <TouchableOpacity
            style={styles.changeGroupBtn}
            onPress={() => {
              triggerHaptic("light");
              onChangeGroup();
            }}
            hitSlop={hitSlopExpandToMinSize(22)}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={t.game.changeGroup}
          >
            <Subhead style={{ color: colors.buttonPrimary, fontWeight: "600" }}>{t.game.changeGroup}</Subhead>
          </TouchableOpacity>
        )}
      </View>

      {showGroupFlow && (
        <View style={[styles.memberGlanceCard, sectionCardChrome]}>
          <View style={styles.memberGlanceRow}>
            <View style={styles.memberGlanceColLeft}>
              <View style={[styles.memberGlanceBentoCard, bentoRoleTileStyle]}>
                <Footnote style={{ color: colors.textMuted, textAlign: "center" }}>{t.game.memberGlanceYourRole}</Footnote>
                <Headline
                  style={{
                    color: isGroupAdmin ? colors.warning : colors.textPrimary,
                    marginTop: SPACE.xs,
                    textAlign: "center",
                  }}
                >
                  {isGroupAdmin ? t.groups.roleAdmin : t.groups.roleMember}
                </Headline>
                <View
                  style={[
                    styles.memberGlanceBentoRingOuter,
                    { backgroundColor: ringPadBento.bg, borderColor: ringPadBento.border },
                  ]}
                >
                  <View
                    style={[
                      styles.memberGlanceBentoRingInner,
                      { backgroundColor: bentoRoleTileStyle.backgroundColor },
                    ]}
                  >
                    <Ionicons
                      name={isGroupAdmin ? "shield" : "person"}
                      size={BILLING_MENU_ICON_SIZE}
                      color={isGroupAdmin ? colors.warning : colors.textSecondary}
                    />
                  </View>
                </View>
              </View>
              {members.length > 0 ? (
                <View style={styles.memberGlanceStackWrap}>
                  <MemberAvatarStack
                    members={members}
                    colors={colors}
                    borderColor={colors.surface}
                    isDark={isDark}
                    maxVisible={memberGlanceExpanded ? MEMBER_STACK_MAX : MEMBER_GLANCE_PREVIEW}
                    totalCount={memberTotal}
                    containerStyle={styles.memberAvatarStackRowFlush}
                  />
                  {memberTotal > MEMBER_GLANCE_PREVIEW ? (
                    <TouchableOpacity
                      style={styles.memberGlanceSeeAllRowCenter}
                      onPress={() => {
                        triggerHaptic("light");
                        setMemberGlanceExpanded((v) => !v);
                      }}
                      activeOpacity={0.7}
                      accessibilityRole="button"
                      accessibilityLabel={
                        memberGlanceExpanded
                          ? t.chatsScreen.showLess
                          : `${t.chatsScreen.seeAll}, ${memberTotal}`
                      }
                    >
                      <Footnote style={{ fontWeight: "600", color: colors.orange }}>
                        {memberGlanceExpanded ? t.chatsScreen.showLess : `${t.chatsScreen.seeAll} · ${memberTotal}`}
                      </Footnote>
                      <Ionicons name={memberGlanceExpanded ? "chevron-up" : "chevron-down"} size={18} color={colors.orange} />
                    </TouchableOpacity>
                  ) : null}
                </View>
              ) : (
                <Footnote style={styles.memberGlanceEmpty}>{t.game.noMembersYet}</Footnote>
              )}
            </View>
            <View style={styles.memberGlanceColRight}>
              <View style={styles.memberGlanceHeroWrap}>
                <View
                  style={[
                    styles.heroRingOuter,
                    {
                      width: ICON_WELL.hero.outer,
                      height: ICON_WELL.hero.outer,
                      borderRadius: ICON_WELL.hero.outer / 2,
                      padding: ICON_WELL.hero.ringPadding,
                      backgroundColor: metricRingPad.padBg,
                      borderColor: metricRingPad.rimBorder,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.heroRingInner,
                      {
                        width: ICON_WELL.hero.inner,
                        height: ICON_WELL.hero.inner,
                        borderRadius: ICON_WELL.hero.inner / 2,
                        backgroundColor: colors.surface,
                      },
                    ]}
                  >
                    <Text style={styles.suitEmoji}>♠️</Text>
                  </View>
                </View>
              </View>
              <Headline style={[styles.memberGlanceTitle, { color: colors.textPrimary }]}>{t.game.memberGlanceHeading}</Headline>
              <Footnote style={[styles.memberGlanceSub, { color: colors.textMuted }]}>
                {memberTotal} {t.groups.members}
              </Footnote>
            </View>
          </View>
        </View>
      )}

      {showGroupFlow && isGroupAdmin && (
        <View style={[styles.inviteCard, cardChrome]}>
          <TouchableOpacity
            style={styles.inviteExpandRow}
            onPress={() => {
              triggerHaptic("light");
              setInviteExpanded((v) => !v);
            }}
            activeOpacity={0.75}
            accessibilityRole="button"
          >
            <Ionicons name="person-add-outline" size={22} color={colors.buttonPrimary} />
            <Subhead style={{ color: colors.buttonPrimary, fontWeight: "600", flex: 1 }}>{t.game.invitePlayersCta}</Subhead>
            <Ionicons name={inviteExpanded ? "chevron-up" : "chevron-down"} size={20} color={colors.textMuted} />
          </TouchableOpacity>
          {inviteExpanded ? (
            <View style={styles.inviteExpandedBody}>
              <View style={[styles.inviteSegmentOuter, innerPanelChrome]}>
                <View style={[styles.inviteSegmentTrack, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
                  <TouchableOpacity
                    style={[
                      styles.inviteSegmentInner,
                      inviteMode === "search" && { backgroundColor: colors.buttonPrimary },
                    ]}
                    onPress={() => {
                      triggerHaptic("light");
                      setInviteMode("search");
                    }}
                    activeOpacity={0.85}
                    accessibilityRole="button"
                    accessibilityState={{ selected: inviteMode === "search" }}
                  >
                    <Caption2 style={{ color: inviteMode === "search" ? colors.buttonText : colors.textMuted, fontWeight: "600" }}>
                      {t.common.search}
                    </Caption2>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.inviteSegmentInner,
                      inviteMode === "email" && { backgroundColor: colors.buttonPrimary },
                    ]}
                    onPress={() => {
                      triggerHaptic("light");
                      setInviteMode("email");
                    }}
                    activeOpacity={0.85}
                    accessibilityRole="button"
                    accessibilityState={{ selected: inviteMode === "email" }}
                  >
                    <Caption2 style={{ color: inviteMode === "email" ? colors.buttonText : colors.textMuted, fontWeight: "600" }}>
                      {t.game.inviteModeEmail}
                    </Caption2>
                  </TouchableOpacity>
                </View>
              </View>
              {inviteMode === "search" ? (
                <>
                  <View style={[styles.searchBar, innerPanelChrome, { borderRadius: RADIUS.full }]}>
                    <Ionicons name="search-outline" size={18} color={colors.textMuted} />
                    <TextInput
                      style={[styles.searchInput, { color: colors.textPrimary }]}
                      placeholder={t.game.inviteSearchPlaceholder}
                      placeholderTextColor={colors.textMuted}
                      value={inviteSearchQuery}
                      onChangeText={setInviteSearchQuery}
                      autoCapitalize="none"
                      autoCorrect={false}
                      returnKeyType="search"
                    />
                    {inviteSearchQuery.length > 0 ? (
                      <TouchableOpacity onPress={() => setInviteSearchQuery("")} activeOpacity={0.7} hitSlop={hitSlopExpandToMinSize(32)}>
                        <Ionicons name="close-circle" size={18} color={colors.textMuted} />
                      </TouchableOpacity>
                    ) : null}
                  </View>
                  {inviteSearching ? (
                    <ActivityIndicator size="small" color={colors.textSecondary} style={{ marginVertical: SPACE.sm }} />
                  ) : null}
                  {inviteSearchResults.map((u: any, idx: number) => {
                    const rowState = getInviteSearchRowState(u);
                    const canInvite = rowState === "invite" && u.email;
                    return (
                      <View key={u.user_id || u.email || String(idx)} style={[styles.inviteResultRow, { borderColor: colors.border }]}>
                        <View
                          style={[
                            styles.inviteResultAvatar,
                            { backgroundColor: memberAvatarBackground(idx, isDark) },
                          ]}
                        >
                          <Subhead style={{ color: colors.textPrimary, fontWeight: "600" }}>
                            {(u.name || u.email || "?")[0].toUpperCase()}
                          </Subhead>
                        </View>
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Headline numberOfLines={1}>{u.name || u.email}</Headline>
                          {u.email ? <Footnote numberOfLines={1} style={{ color: colors.textMuted }}>{u.email}</Footnote> : null}
                        </View>
                        {canInvite ? (
                          <GlassButton
                            variant="primary"
                            size="compact"
                            onPress={() => handleInviteToGroup(u.email)}
                            disabled={invitingEmail === u.email}
                            loading={invitingEmail === u.email}
                          >
                            {t.groups.invite}
                          </GlassButton>
                        ) : (
                          <View style={styles.inviteRowStatus}>
                            <Footnote style={{ color: colors.textMuted, fontWeight: "600", textAlign: "right" }} numberOfLines={2}>
                              {rowState === "lineup"
                                ? t.game.inviteRowInThisGame
                                : rowState === "member"
                                  ? t.game.inviteRowInGroup
                                  : t.game.inviteRowInvitePending}
                            </Footnote>
                          </View>
                        )}
                      </View>
                    );
                  })}
                </>
              ) : (
                <>
                  <View style={[styles.searchBar, innerPanelChrome, { borderRadius: RADIUS.full }]}>
                    <Ionicons name="mail-outline" size={18} color={colors.textMuted} />
                    <TextInput
                      style={[styles.searchInput, { color: colors.textPrimary }]}
                      placeholder={t.game.inviteEmailPlaceholder}
                      placeholderTextColor={colors.textMuted}
                      value={inviteEmail}
                      onChangeText={setInviteEmail}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                    {inviteEmail.length > 0 ? (
                      <TouchableOpacity onPress={() => setInviteEmail("")} activeOpacity={0.7} hitSlop={hitSlopExpandToMinSize(32)}>
                        <Ionicons name="close-circle" size={18} color={colors.textMuted} />
                      </TouchableOpacity>
                    ) : null}
                  </View>
                  <Footnote style={{ color: colors.textMuted, marginBottom: SPACE.sm }}>{t.game.inviteEmailHint}</Footnote>
                  {inviteEmailFieldState === "inGroup" ? (
                    <Footnote style={{ color: colors.warning, marginBottom: SPACE.sm }}>{t.game.inviteEmailAlreadyInGroup}</Footnote>
                  ) : null}
                  {inviteEmailFieldState === "pending" ? (
                    <Footnote style={{ color: colors.warning, marginBottom: SPACE.sm }}>{t.game.inviteEmailAlreadyPending}</Footnote>
                  ) : null}
                  <GlassButton
                    variant="primary"
                    size="large"
                    fullWidth
                    disabled={!inviteEmail.trim() || inviteEmailFieldState !== "ok"}
                    loading={!!invitingEmail}
                    onPress={() => handleInviteToGroup(inviteEmail)}
                  >
                    {t.groups.invite}
                  </GlassButton>
                </>
              )}
              {pendingInvites.length > 0 ? (
                <View style={[styles.pendingSection, { borderTopColor: colors.border }]}>
                  <Footnote style={{ color: colors.textSecondary, marginBottom: SPACE.sm }}>
                    {t.game.pendingInvitesHeading.replace("{n}", String(pendingInvites.length))}
                  </Footnote>
                  {pendingInvites.map((inv: any) => (
                    <View
                      key={inv.invite_id || pendingInviteEmail(inv) || String(inv?.id)}
                      style={[styles.pendingItem, innerPanelChrome]}
                    >
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Subhead numberOfLines={2} style={{ color: colors.textPrimary, fontWeight: "600" }}>
                          {pendingInviteEmail(inv) || "—"}
                        </Subhead>
                        {inv.inviter_name ? (
                          <Footnote numberOfLines={1} style={{ color: colors.textMuted, marginTop: 2 }}>
                            {t.game.inviteInvitedBy.replace("{name}", String(inv.inviter_name))}
                          </Footnote>
                        ) : null}
                      </View>
                      <View style={[styles.pendingBadge, { backgroundColor: isDark ? "rgba(255,204,0,0.15)" : "rgba(255,204,0,0.12)" }]}>
                        <Caption2 style={{ color: colors.warning }}>{t.game.invitePendingBadge}</Caption2>
                      </View>
                    </View>
                  ))}
                </View>
              ) : null}
            </View>
          ) : null}
        </View>
      )}

      {showGroupFlow && !isGroupAdmin ? (
        <Footnote style={[styles.inviteNonAdminHint, { color: colors.textMuted }]}>{t.game.inviteOnlyAdminsHint}</Footnote>
      ) : null}

      {showGroupFlow ? (
        <View style={[styles.playersSectionCard, cardChrome]}>
          <StartGamePlayerSelection
            members={groupDetail?.members || []}
            currentUserId={user?.user_id}
            selectedMemberIds={selectedMemberIds}
            onChangeSelectedIds={setSelectedMemberIds}
            listMaxHeight={220}
            variant="groupsSheet"
          />
        </View>
      ) : null}
    </>
  );

  const renderPrepareGameBody = () => {
    if (groupSelectionLocked) {
      if (detailLoading) {
        return <ActivityIndicator style={{ marginVertical: SPACE.xl }} color={colors.textSecondary} size="large" />;
      }
      if (detailError) return renderDetailError();
      if (showGroupFlow) return renderReviewPlayersBody();
      return null;
    }

    if (!selectedGroupId) {
      return renderGroupPickerSection();
    }

    if (detailLoading) {
      return <ActivityIndicator style={{ marginVertical: SPACE.xl }} color={colors.textSecondary} size="large" />;
    }

    if (detailError) return renderDetailError();

    if (showGroupFlow) return renderReviewPlayersBody();

    return null;
  };

  const renderGameSettingsBody = () =>
    showGroupFlow ? (
      <StartGameForm
        key={formKey}
        variant="groupsSheet"
        groupId={selectedGroupId!}
        members={groupDetail?.members || []}
        currentUserId={user?.user_id}
        smartDefaults={smartDefaults}
        omitPlayerSelection
        initialSelectedMemberIds={selectedMemberIds}
        onSuccess={goGameNight}
        onCancel={closeStartGame}
      />
    ) : null;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={closeStartGame}>
      <View style={styles.modalRoot}>
        <Pressable style={styles.modalBackdrop} onPress={closeStartGame} />
        <View style={styles.modalKeyboardWrap} pointerEvents="box-none">
          <View
            style={[
              styles.sheetShell,
              sheetOuterStyle,
              {
                backgroundColor: colors.surface,
                borderTopLeftRadius: RADIUS.sheet,
                borderTopRightRadius: RADIUS.sheet,
                ...appleTileShadow(isDark),
              },
              Platform.OS === "ios" && { borderCurve: "continuous" as const },
            ]}
          >
            <View style={[styles.sheetHandle, { backgroundColor: colors.border }]} />
            <Title2 style={styles.sheetTitle}>{t.game.startGameScreenTitle}</Title2>

            {step === "prepareGame" && (
              <View style={styles.sheetBodyPrepare}>
                <ScrollView
                  style={styles.sheetScroll}
                  contentContainerStyle={prepareScrollContentStyle}
                  keyboardShouldPersistTaps="handled"
                  keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
                  showsVerticalScrollIndicator
                  nestedScrollEnabled
                  automaticallyAdjustKeyboardInsets={Platform.OS === "ios"}
                >
                  {renderPrepareGameBody()}
                </ScrollView>
                <View
                  pointerEvents="box-none"
                  style={[
                    styles.prepareContinueFloatWrap,
                    { bottom: Math.max(insets.bottom, SPACE.sm), paddingHorizontal: LAYOUT.screenPadding },
                  ]}
                >
                  <TouchableOpacity
                    style={[
                      styles.primaryCtaFill,
                      appleCardShadowProminent(isDark),
                      {
                        backgroundColor: colors.buttonPrimary,
                        opacity: !showGroupFlow ? 0.5 : 1,
                        borderRadius: RADIUS.xl,
                      },
                    ]}
                    onPress={() => {
                      if (!showGroupFlow) return;
                      triggerHaptic("light");
                      setStep("gameSettings");
                    }}
                    disabled={!showGroupFlow}
                    activeOpacity={0.88}
                    accessibilityRole="button"
                  >
                    <Headline style={{ color: colors.buttonText }}>{t.common.continue}</Headline>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {step === "gameSettings" && (
              <View style={styles.sheetBody}>
                <ScrollView
                  style={styles.sheetScroll}
                  contentContainerStyle={[
                    styles.sheetScrollContent,
                    {
                      paddingHorizontal: LAYOUT.screenPadding,
                      paddingBottom: scrollBottomPad,
                    },
                  ]}
                  keyboardShouldPersistTaps="handled"
                  keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
                  showsVerticalScrollIndicator
                  nestedScrollEnabled
                  automaticallyAdjustKeyboardInsets={Platform.OS === "ios"}
                >
                  {renderGameSettingsBody()}
                </ScrollView>
              </View>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalRoot: { flex: 1 },
  modalKeyboardWrap: { flex: 1, justifyContent: "flex-end" },
  modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.45)" },
  sheetShell: {
    width: "100%",
    flexDirection: "column",
    overflow: "hidden",
    paddingTop: SPACE.lg,
    flexShrink: 0,
  },
  sheetBody: {
    flex: 1,
    minHeight: 0,
  },
  sheetBodyPrepare: {
    flex: 1,
    minHeight: 0,
    position: "relative",
  },
  prepareContinueFloatWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    zIndex: 10,
  },
  sheetScroll: { flex: 1, minHeight: 0 },
  sheetScrollContent: {
    paddingTop: SPACE.sm,
    flexGrow: 1,
  },
  sheetHandle: {
    width: BOTTOM_SHEET.grabberWidth,
    height: BOTTOM_SHEET.grabberHeight,
    borderRadius: BOTTOM_SHEET.grabberRadius,
    alignSelf: "center",
    marginBottom: SPACE.sm,
  },
  sheetTitle: {
    textAlign: "center",
    marginBottom: SPACE.md,
    paddingHorizontal: LAYOUT.screenPadding,
  },
  sheetFieldGroup: { gap: SPACE.sm, marginBottom: SPACE.md },
  sheetFieldLabel: { marginBottom: SPACE.xs },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: SPACE.sm,
    minHeight: 40,
    paddingHorizontal: SPACE.sm,
    gap: SPACE.xs,
  },
  searchInput: {
    flex: 1,
    fontSize: FONT.secondary.size,
    paddingVertical: Platform.OS === "ios" ? 6 : 4,
  },
  emptyCard: { padding: SPACE.xl, marginTop: SPACE.xs },
  groupRow: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: LAYOUT.touchTarget,
    paddingVertical: SPACE.sm,
    gap: SPACE.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  groupRowLast: { borderBottomWidth: 0 },
  groupAvatar: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  selectedRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: LAYOUT.cardPadding,
    marginBottom: SPACE.sm,
    gap: SPACE.md,
  },
  changeGroupBtn: {
    minHeight: LAYOUT.touchTarget,
    minWidth: LAYOUT.touchTarget,
    justifyContent: "center",
    alignItems: "flex-end",
    paddingHorizontal: SPACE.xs,
  },
  inviteNonAdminHint: {
    marginBottom: SPACE.lg,
    lineHeight: 18,
  },
  memberGlanceRow: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: SPACE.sm,
  },
  memberGlanceColLeft: {
    flex: 1,
    minWidth: 0,
    justifyContent: "space-between",
    alignItems: "center",
  },
  memberGlanceColRight: {
    flex: 1,
    minWidth: 0,
    alignItems: "center",
    alignSelf: "stretch",
  },
  /** Group Hub bento “Your Role” tile — compact for Start Game column */
  memberGlanceBentoCard: {
    width: "100%",
    paddingHorizontal: SPACE.sm,
    paddingVertical: SPACE.sm,
    alignItems: "center",
  },
  memberGlanceBentoRingOuter: {
    width: ROLE_RING_WELL.outer,
    height: ROLE_RING_WELL.outer,
    borderRadius: ROLE_RING_WELL.outer / 2,
    borderWidth: StyleSheet.hairlineWidth * 2,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginTop: SPACE.sm,
  },
  memberGlanceBentoRingInner: {
    width: ROLE_RING_WELL.inner,
    height: ROLE_RING_WELL.inner,
    borderRadius: ROLE_RING_WELL.inner / 2,
    alignItems: "center",
    justifyContent: "center",
  },
  memberGlanceStackWrap: {
    alignSelf: "stretch",
    alignItems: "center",
    justifyContent: "flex-end",
  },
  memberAvatarStackRowFlush: {
    marginTop: 0,
  },
  memberGlanceSeeAllRowCenter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACE.xs,
    paddingTop: SPACE.xs,
  },
  memberGlanceHeroWrap: {
    alignItems: "center",
    marginBottom: SPACE.xs,
  },
  heroRingOuter: {
    borderWidth: StyleSheet.hairlineWidth,
  },
  heroRingInner: {
    alignItems: "center",
    justifyContent: "center",
  },
  suitEmoji: {
    fontSize: 32,
  },
  memberGlanceTitle: {
    textAlign: "center",
    marginTop: 0,
    alignSelf: "stretch",
  },
  memberGlanceSub: {
    textAlign: "center",
    marginTop: SPACE.xs,
    alignSelf: "stretch",
  },
  inviteCard: {
    marginBottom: SPACE.lg,
  },
  inviteExpandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.md,
    minHeight: LAYOUT.touchTarget,
    paddingVertical: SPACE.sm,
    paddingHorizontal: LAYOUT.cardPadding,
  },
  inviteExpandedBody: {
    paddingHorizontal: LAYOUT.cardPadding,
    paddingBottom: LAYOUT.cardPadding,
    gap: SPACE.sm,
  },
  inviteSegmentOuter: {
    padding: 3,
    borderRadius: RADIUS.lg,
    marginBottom: SPACE.sm,
  },
  inviteSegmentTrack: {
    flexDirection: "row",
    borderRadius: RADIUS.lg,
    padding: 3,
    gap: 4,
    borderWidth: StyleSheet.hairlineWidth,
  },
  inviteSegmentInner: {
    flex: 1,
    minHeight: LAYOUT.touchTarget,
    borderRadius: RADIUS.md,
    alignItems: "center",
    justifyContent: "center",
  },
  inviteResultRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.sm,
    paddingVertical: SPACE.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  inviteResultAvatar: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  pendingSection: { marginTop: SPACE.lg, paddingTop: SPACE.lg, borderTopWidth: StyleSheet.hairlineWidth },
  pendingItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: SPACE.sm,
    borderRadius: RADIUS.md,
    marginBottom: SPACE.xs,
  },
  pendingBadge: { paddingHorizontal: SPACE.sm, paddingVertical: 2, borderRadius: RADIUS.sm },
  playersSectionCard: {
    padding: LAYOUT.cardPadding,
    marginBottom: SPACE.md,
  },
  primaryCtaFill: {
    height: BUTTON_SIZE.large.height,
    borderRadius: RADIUS.xl,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "stretch",
    paddingHorizontal: SPACE.lg,
  },
  primaryCtaLabel: {
    fontSize: APPLE_TYPO.body.size,
    fontWeight: "600",
  },
  secondaryCtaOutline: {
    minHeight: BUTTON_SIZE.large.height,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "stretch",
    paddingHorizontal: SPACE.lg,
  },
  memberGlanceCard: {
    padding: LAYOUT.cardPadding,
    marginBottom: SPACE.lg,
    gap: SPACE.xs,
  },
  memberGlanceEmpty: {
    marginTop: SPACE.sm,
    textAlign: "center",
    alignSelf: "center",
  },
  inviteRowStatus: {
    minWidth: 96,
    maxWidth: 140,
    justifyContent: "center",
  },
});
