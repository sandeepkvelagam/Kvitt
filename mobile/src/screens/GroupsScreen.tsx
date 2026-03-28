import React, { useEffect, useState, useCallback, useRef, useMemo } from "react";
import {
  ScrollView,
  RefreshControl,
  View,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  Modal,
  TextInput,
  Platform,
  ActivityIndicator,
  Animated,
  useWindowDimensions,
  Keyboard,
  Alert,
  KeyboardAvoidingView,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { GroupsSkeleton } from "../components/ui/GroupsSkeleton";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../api/client";
import { useTheme } from "../context/ThemeContext";
import { useLanguage } from "../context/LanguageContext";
import {
  SPACE,
  LAYOUT,
  RADIUS,
  BUTTON_SIZE,
  AVATAR_SIZE,
  APPLE_TYPO,
  hitSlopExpandToMinSize,
} from "../styles/tokens";
import { COLORS, PAGE_HERO_GRADIENT, pageHeroGradientColors } from "../styles/liquidGlass";
import { appleCardShadowResting, appleTileShadow } from "../styles/appleShadows";
import {
  Title1,
  Title2,
  Title3,
  Headline,
  Subhead,
  Footnote,
  Caption2,
} from "../components/ui";
import type { RootStackParamList } from "../navigation/RootNavigator";
import { useTabShell } from "../context/TabShellContext";

type Nav = NativeStackNavigationProp<RootStackParamList>;

type GroupItem = {
  group_id: string;
  name: string;
  member_count?: number;
  role?: string;
};

const SCREEN_PAD = LAYOUT.screenPadding;
const TAB_BAR_RESERVE_BASE = 128;
const GROUPS_SKELETON_HOLD_MS = 100;
const GROUPS_SKELETON_FADE_MS = 200;
const INVITE_SEARCH_DEBOUNCE_MS = 350;
const INVITE_SEARCH_MIN_QUERY = 2;
const INVITE_SEARCH_MAX_RESULTS = 6;

const GROUP_ADJECTIVES = ["Lucky", "Wild", "Golden", "Royal", "Midnight", "Epic", "Thunder", "Cosmic"];
const GROUP_NOUNS = ["Aces", "Kings", "Sharks", "Wolves", "Dragons", "Legends", "Champions", "Raiders"];

function generateRandomName() {
  const adj = GROUP_ADJECTIVES[Math.floor(Math.random() * GROUP_ADJECTIVES.length)];
  const noun = GROUP_NOUNS[Math.floor(Math.random() * GROUP_NOUNS.length)];
  return `${adj} ${noun}`;
}

/* ─────────────────────────────────────────────────────────────────────────────
   GroupRow — List item with proper HIG typography
   ───────────────────────────────────────────────────────────────────────────── */

type GroupRowProps = {
  item: GroupItem;
  favorites: string[];
  toggleFavorite: (id: string) => void;
  onPress: () => void;
  colors: ReturnType<typeof useTheme>["colors"];
  isDark: boolean;
  isLast: boolean;
  membersWord: string;
};

function GroupRow({
  item,
  favorites,
  toggleFavorite,
  onPress,
  colors,
  isDark,
  isLast,
  membersWord,
}: GroupRowProps) {
  const isFav = favorites.includes(item.group_id);
  const adminBgColor = isDark ? "rgba(255, 159, 10, 0.16)" : "rgba(255, 159, 10, 0.12)";

  return (
    <TouchableOpacity
      style={[
        styles.groupRow,
        { borderBottomColor: isLast ? "transparent" : colors.border },
      ]}
      onPress={onPress}
      activeOpacity={0.7}
      testID={`group-card-${item.group_id}`}
    >
      <View style={[styles.groupAvatar, { backgroundColor: colors.inputBg }]}>
        <Title3 style={{ color: colors.textPrimary }}>
          {item.name?.[0]?.toUpperCase() || "G"}
        </Title3>
      </View>

      <View style={styles.groupInfo}>
        <View style={styles.groupNameRow}>
          {/* HIG: Headline (17/600) for list row primary title */}
          <Headline numberOfLines={1} style={{ flexShrink: 1 }}>
            {item.name}
          </Headline>
          {item.role === "admin" ? (
            <View style={[styles.roleBadge, { backgroundColor: adminBgColor }]}>
              <Ionicons name="shield" size={10} color={colors.warning} />
              <Caption2 style={{ color: colors.warning }}>Admin</Caption2>
            </View>
          ) : (
            <View style={[styles.roleBadge, { backgroundColor: colors.inputBg }]}>
              <Ionicons name="person" size={10} color={colors.textMuted} />
              <Caption2 style={{ color: colors.textMuted }}>Member</Caption2>
            </View>
          )}
        </View>
        {/* HIG: Footnote for secondary/meta */}
        <Footnote style={{ marginTop: 2, color: colors.textMuted }}>
          {item.member_count ?? 0} {membersWord}
        </Footnote>
      </View>

      <TouchableOpacity
        style={styles.heartButton}
        onPress={(e) => {
          e.stopPropagation();
          toggleFavorite(item.group_id);
        }}
        hitSlop={hitSlopExpandToMinSize(18)}
        activeOpacity={0.7}
        accessibilityLabel={isFav ? `Remove ${item.name} from favourites` : `Add ${item.name} to favourites`}
      >
        <Ionicons
          name={isFav ? "heart" : "heart-outline"}
          size={18}
          color={isFav ? colors.orange : colors.textMuted}
        />
      </TouchableOpacity>
      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
    </TouchableOpacity>
  );
}

type SearchUser = { user_id: string; name?: string; email?: string };
type SelectedInvite = { email: string; name?: string; userId?: string };

/* ─────────────────────────────────────────────────────────────────────────────
   GroupsScreen — Main component
   ───────────────────────────────────────────────────────────────────────────── */

export function GroupsScreen() {
  const { isDark, colors } = useTheme();
  const { t } = useLanguage();
  const navigation = useNavigation<Nav>();
  const { isMainTabShell } = useTabShell();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();

  const [groups, setGroups] = useState<GroupItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showCreateSheet, setShowCreateSheet] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupDescription, setNewGroupDescription] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [inviteSearchQuery, setInviteSearchQuery] = useState("");
  const [inviteSearchResults, setInviteSearchResults] = useState<SearchUser[]>([]);
  const [inviteSearching, setInviteSearching] = useState(false);
  const [selectedInvites, setSelectedInvites] = useState<SelectedInvite[]>([]);
  const inviteSearchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const createGroupNameInputRef = useRef<TextInput>(null);

  const [favorites, setFavorites] = useState<string[]>([]);

  const [skeletonVisible, setSkeletonVisible] = useState(true);
  const skeletonOpacity = useRef(new Animated.Value(1)).current;
  const contentOpacity = useRef(new Animated.Value(0)).current;

  const entranceAnim = useRef(new Animated.Value(0)).current;

  const backgroundColor = isDark ? COLORS.jetDark : colors.contentBg;
  const tabBarReserve = TAB_BAR_RESERVE_BASE + Math.max(insets.bottom, 8);
  /** Scroll padding so content clears the floating tab bar (matches Dashboard) */
  const scrollBottomPad = tabBarReserve + LAYOUT.sectionGap;

  /** Unified card style — matches Scheduler/Dashboard elevated cards */
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

  // ─── Effects ───

  useEffect(() => {
    Animated.spring(entranceAnim, {
      toValue: 1,
      useNativeDriver: true,
      tension: 50,
      friction: 8,
    }).start();
  }, [entranceAnim]);

  useEffect(() => {
    AsyncStorage.getItem("group_favorites")
      .then((val) => {
        if (val) setFavorites(JSON.parse(val));
      })
      .catch(() => {});
  }, []);

  const toggleFavorite = useCallback(async (groupId: string) => {
    setFavorites((prev) => {
      const next = prev.includes(groupId) ? prev.filter((id) => id !== groupId) : [...prev, groupId];
      AsyncStorage.setItem("group_favorites", JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await api.get("/groups");
      const data = Array.isArray(res.data) ? res.data : [];
      setGroups(data);
    } catch (e: any) {
      setError(e?.response?.data?.detail || e?.message || "Groups aren't available right now.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (showCreateSheet) return;
    Keyboard.dismiss();
    setInviteSearchQuery("");
    setInviteSearchResults([]);
    setSelectedInvites([]);
    setInviteSearching(false);
    setCreateError(null);
    setNewGroupName("");
    setNewGroupDescription("");
    setCreating(false);
    if (inviteSearchDebounceRef.current) {
      clearTimeout(inviteSearchDebounceRef.current);
      inviteSearchDebounceRef.current = null;
    }
  }, [showCreateSheet]);

  useEffect(() => {
    if (!showCreateSheet) return;
    const id = setTimeout(() => createGroupNameInputRef.current?.focus(), 380);
    return () => clearTimeout(id);
  }, [showCreateSheet]);

  useEffect(() => {
    if (!showCreateSheet) return;
    if (inviteSearchDebounceRef.current) clearTimeout(inviteSearchDebounceRef.current);
    if (inviteSearchQuery.trim().length < INVITE_SEARCH_MIN_QUERY) {
      setInviteSearchResults([]);
      setInviteSearching(false);
      return;
    }
    inviteSearchDebounceRef.current = setTimeout(async () => {
      setInviteSearching(true);
      try {
        const res = await api.get(`/users/search?query=${encodeURIComponent(inviteSearchQuery.trim())}`);
        const raw = Array.isArray(res.data) ? res.data : [];
        setInviteSearchResults(raw.slice(0, INVITE_SEARCH_MAX_RESULTS));
      } catch {
        setInviteSearchResults([]);
      } finally {
        setInviteSearching(false);
      }
    }, INVITE_SEARCH_DEBOUNCE_MS);
    return () => {
      if (inviteSearchDebounceRef.current) clearTimeout(inviteSearchDebounceRef.current);
    };
  }, [inviteSearchQuery, showCreateSheet]);

  useEffect(() => {
    if (loading || !skeletonVisible) return;
    const minWait = setTimeout(() => {
      Animated.parallel([
        Animated.timing(skeletonOpacity, { toValue: 0, duration: GROUPS_SKELETON_FADE_MS, useNativeDriver: true }),
        Animated.timing(contentOpacity, { toValue: 1, duration: GROUPS_SKELETON_FADE_MS, useNativeDriver: true }),
      ]).start(() => setSkeletonVisible(false));
    }, GROUPS_SKELETON_HOLD_MS);
    return () => clearTimeout(minWait);
  }, [loading, skeletonVisible, skeletonOpacity, contentOpacity]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  // ─── Invite handlers ───

  const addSelectedInvite = useCallback((user: SearchUser) => {
    const e = (user.email || "").trim().toLowerCase();
    if (!e) return;
    setSelectedInvites((prev) => {
      if (prev.some((x) => x.email === e)) return prev;
      return [...prev, { email: e, name: user.name, userId: user.user_id }];
    });
    setInviteSearchQuery("");
    setInviteSearchResults([]);
  }, []);

  const removeSelectedInvite = useCallback((email: string) => {
    setSelectedInvites((prev) => prev.filter((x) => x.email !== email));
  }, []);

  const handleCreateGroup = async () => {
    if (!newGroupName.trim()) return;
    setCreating(true);
    setCreateError(null);
    try {
      const res = await api.post("/groups", {
        name: newGroupName.trim(),
        description: newGroupDescription.trim() || undefined,
      });
      const groupId = res.data?.group_id as string | undefined;
      const createdName = (res.data?.name as string | undefined) || newGroupName.trim();

      let inviteFailCount = 0;
      if (groupId && selectedInvites.length > 0) {
        const inviteResults = await Promise.allSettled(
          selectedInvites.map((x) => api.post(`/groups/${groupId}/invite`, { email: x.email }))
        );
        inviteFailCount = inviteResults.filter((r) => r.status === "rejected").length;
      }

      setShowCreateSheet(false);
      await load();
      if (groupId) {
        navigation.navigate("GroupHub", { groupId, groupName: createdName });
        if (inviteFailCount > 0) {
          Alert.alert(
            "Group created",
            `${inviteFailCount} invite(s) could not be sent. You can invite people again from the group hub.`,
            [{ text: "OK" }]
          );
        }
      }
    } catch (e: any) {
      setCreateError(e?.response?.data?.detail || e?.message || "Group creation unavailable.");
    } finally {
      setCreating(false);
    }
  };

  const handleRandomName = () => setNewGroupName(generateRandomName());

  const navigateHub = (item: GroupItem) =>
    navigation.navigate("GroupHub", { groupId: item.group_id, groupName: item.name });

  const favoriteGroups = useMemo(
    () => groups.filter((g) => favorites.includes(g.group_id)),
    [groups, favorites]
  );

  const HEADER_ROW_APPROX = 52;
  const skeletonTop = insets.top + HEADER_ROW_APPROX;
  const createSheetMaxHeight = Math.round(windowHeight * 0.85);

  const createSheetOuterStyle = useMemo(
    () => ({
      height: createSheetMaxHeight,
      maxHeight: createSheetMaxHeight,
    }),
    [createSheetMaxHeight]
  );

  const sheetScrollContentCombined = useMemo(
    () => [styles.sheetScrollContent, { paddingBottom: SPACE.lg }],
    []
  );

  return (
    <View style={[styles.root, { backgroundColor }]} testID="groups-screen">
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
          {!isMainTabShell && (
            <Pressable
              style={({ pressed }) => [
                styles.backPill,
                { backgroundColor: colors.glassBg, borderColor: colors.glassBorder, opacity: pressed ? 0.85 : 1 },
              ]}
              onPress={() => navigation.goBack()}
              hitSlop={hitSlopExpandToMinSize(LAYOUT.touchTarget)}
            >
              <Ionicons name="chevron-back" size={22} color={colors.textPrimary} />
            </Pressable>
          )}
          {/* HIG: Title1 for page title */}
          <Title1 style={styles.screenTitle} numberOfLines={1}>
            {t.nav.groups}
          </Title1>
          <View style={{ flex: 1 }} />
          <Pressable
            style={({ pressed }) => [
              styles.headerInvitesPill,
              { backgroundColor: colors.inputBg, borderColor: colors.border, opacity: pressed ? 0.85 : 1 },
            ]}
            onPress={() => navigation.navigate("PendingRequests")}
            hitSlop={hitSlopExpandToMinSize(LAYOUT.touchTarget)}
          >
            <Ionicons name="mail-open-outline" size={20} color={colors.orange} />
          </Pressable>
        </View>
      </View>

      {/* ─── Skeleton ─── */}
      {skeletonVisible && (
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            { opacity: skeletonOpacity, backgroundColor, top: skeletonTop, zIndex: 10 },
          ]}
          pointerEvents="none"
        >
          <GroupsSkeleton />
        </Animated.View>
      )}

      <Animated.View style={[styles.body, { opacity: contentOpacity }]}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: scrollBottomPad }]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.textSecondary}
              colors={[colors.textSecondary]}
              progressBackgroundColor={colors.surfaceBackground}
              progressViewOffset={Platform.OS === "android" ? skeletonTop + 8 : undefined}
            />
          }
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

          {/* ═══════════════════════════════════════════════════════════════════
              FAVORITES SECTION
              ═══════════════════════════════════════════════════════════════════ */}
          {favoriteGroups.length > 0 && (
            <Animated.View
              style={[
                styles.sectionCard,
                cardStyle,
                {
                  opacity: entranceAnim,
                  transform: [{ translateY: entranceAnim.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }],
                },
              ]}
            >
              <View style={[styles.sectionHeader, { borderBottomColor: colors.border }]}>
                <View style={styles.sectionHeaderLeft}>
                  <Ionicons name="heart" size={20} color={colors.orange} />
                  {/* HIG: Title2 for section headers */}
                  <Title2>Favorites</Title2>
                </View>
                <Caption2 style={{ color: colors.textMuted }}>{favoriteGroups.length}</Caption2>
              </View>
              <View style={styles.listBody}>
                {favoriteGroups.map((item, index) => (
                  <GroupRow
                    key={item.group_id}
                    item={item}
                    favorites={favorites}
                    toggleFavorite={toggleFavorite}
                    onPress={() => navigateHub(item)}
                    colors={colors}
                    isDark={isDark}
                    isLast={index === favoriteGroups.length - 1}
                    membersWord={t.groups.members}
                  />
                ))}
              </View>
            </Animated.View>
          )}

          {/* ═══════════════════════════════════════════════════════════════════
              ALL GROUPS SECTION
              ═══════════════════════════════════════════════════════════════════ */}
          <Animated.View
            style={[
              styles.sectionCard,
              cardStyle,
              {
                opacity: entranceAnim,
                transform: [{ translateY: entranceAnim.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }],
              },
            ]}
          >
            <View style={[styles.sectionHeader, { borderBottomColor: colors.border }]}>
              <View style={styles.sectionHeaderLeft}>
                <Ionicons name="people" size={20} color={colors.textSecondary} />
                <Title2>Your Groups</Title2>
              </View>
              <Caption2 style={{ color: colors.textMuted }}>{groups.length}</Caption2>
            </View>

            <View style={styles.listBody}>
              {loading && groups.length === 0 ? (
                <View style={styles.emptyBlock}>
                  <ActivityIndicator size="large" color={colors.textSecondary} />
                  <Footnote style={{ color: colors.textMuted }}>Loading groups…</Footnote>
                </View>
              ) : groups.length === 0 ? (
                <View style={styles.emptyBlock}>
                  <View
                    style={[
                      styles.emptyIconWrap,
                      { backgroundColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)" },
                    ]}
                  >
                    <Ionicons name="people-outline" size={32} color={colors.textMuted} />
                  </View>
                  <Headline style={{ textAlign: "center" }}>{t.groups.noGroups}</Headline>
                  <Footnote style={{ textAlign: "center", color: colors.textSecondary, paddingHorizontal: SPACE.lg }}>
                    Create a group or accept an invite to start playing
                  </Footnote>
                </View>
              ) : (
                groups.map((item, index) => (
                  <GroupRow
                    key={item.group_id}
                    item={item}
                    favorites={favorites}
                    toggleFavorite={toggleFavorite}
                    onPress={() => navigateHub(item)}
                    colors={colors}
                    isDark={isDark}
                    isLast={index === groups.length - 1}
                    membersWord={t.groups.members}
                  />
                ))
              )}
            </View>

            {/* View Invites Button */}
            {!loading && groups.length > 0 && (
              <View style={styles.viewInvitesContainer}>
                <Pressable
                  style={({ pressed }) => [
                    styles.viewInvitesButton,
                    { backgroundColor: colors.inputBg, borderColor: colors.border, opacity: pressed ? 0.85 : 1 },
                  ]}
                  onPress={() => navigation.navigate("PendingRequests")}
                >
                  <Ionicons name="mail-outline" size={18} color={colors.orange} />
                  <Subhead style={{ color: colors.textPrimary, fontWeight: "600" }}>View invites</Subhead>
                </Pressable>
              </View>
            )}
          </Animated.View>

          {/* ═══════════════════════════════════════════════════════════════════════
              BOTTOM ACTIONS — New Group + AI Chat
              ═══════════════════════════════════════════════════════════════════════ */}
          <Animated.View
            style={[
              styles.actionsFooterCard,
              cardStyle,
              {
                opacity: entranceAnim,
                transform: [{ translateY: entranceAnim.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }],
              },
            ]}
          >
            <View style={styles.actionsButtonRow}>
              <Pressable
                style={({ pressed }) => [
                  styles.actionButtonHalf,
                  styles.actionButtonSecondary,
                  { backgroundColor: colors.inputBg, borderColor: colors.border, opacity: pressed ? 0.88 : 1 },
                ]}
                onPress={() => navigation.navigate("AIAssistant")}
              >
                <Ionicons name="sparkles-outline" size={22} color={colors.textSecondary} />
                <Subhead style={{ color: colors.textPrimary, fontWeight: "600" }}>AI Chat</Subhead>
              </Pressable>
              <Pressable
                style={({ pressed }) => [
                  styles.actionButtonHalf,
                  styles.actionButtonPrimary,
                  { backgroundColor: colors.buttonPrimary, opacity: pressed ? 0.92 : 1 },
                ]}
                onPress={() => setShowCreateSheet(true)}
              >
                <Ionicons name="add-circle-outline" size={22} color={colors.buttonText} />
                <Subhead style={{ color: colors.buttonText, fontWeight: "600" }}>New Group</Subhead>
              </Pressable>
            </View>
          </Animated.View>
        </ScrollView>
      </Animated.View>

      {/* ═══════════════════════════════════════════════════════════════════════
          CREATE GROUP MODAL
          ═══════════════════════════════════════════════════════════════════════ */}
      <Modal
        visible={showCreateSheet}
        animationType="slide"
        transparent
        onRequestClose={() => setShowCreateSheet(false)}
      >
        <View style={styles.modalRoot}>
          <Pressable
            style={styles.modalBackdrop}
            onPress={() => setShowCreateSheet(false)}
          />
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            style={styles.modalKeyboardWrap}
            pointerEvents="box-none"
          >
            <View
              style={[
                styles.sheetShell,
                createSheetOuterStyle,
                {
                  backgroundColor: colors.surface,
                  borderTopLeftRadius: RADIUS.sheet,
                  borderTopRightRadius: RADIUS.sheet,
                  ...appleTileShadow(isDark),
                },
                Platform.OS === "ios" && { borderCurve: "continuous" as const },
              ]}
            >
              {/* Handle */}
              <View style={[styles.sheetHandle, { backgroundColor: colors.border }]} />

              {/* Title */}
              <Title2 style={styles.sheetTitle}>{t.groups.createGroup}</Title2>

              {/* Scrollable Content */}
              <ScrollView
                style={styles.sheetScroll}
                contentContainerStyle={sheetScrollContentCombined}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
                showsVerticalScrollIndicator
              >
                {createError && (
                  <View
                    style={[
                      styles.sheetError,
                      { backgroundColor: isDark ? "rgba(255, 69, 58, 0.15)" : "rgba(255, 69, 58, 0.1)" },
                    ]}
                  >
                    <Footnote style={{ color: colors.danger }}>{createError}</Footnote>
                  </View>
                )}

                <View style={styles.sheetFieldGroup}>
                  <Footnote style={[styles.sheetFieldLabel, { color: colors.textSecondary }]}>
                    {t.groups.groupName}
                  </Footnote>
                  <View style={styles.inputRow}>
                    <TextInput
                      ref={createGroupNameInputRef}
                      style={[
                        styles.input,
                        { backgroundColor: colors.inputBg, color: colors.textPrimary, borderColor: colors.border },
                      ]}
                      placeholder={t.groups.groupName}
                      placeholderTextColor={colors.textMuted}
                      value={newGroupName}
                      onChangeText={setNewGroupName}
                    />
                    <TouchableOpacity
                      style={[
                        styles.randomButton,
                        {
                          backgroundColor: colors.inputBg,
                          borderColor: colors.border,
                          width: BUTTON_SIZE.regular.height,
                          height: BUTTON_SIZE.regular.height,
                        },
                      ]}
                      onPress={handleRandomName}
                      activeOpacity={0.7}
                      accessibilityLabel="Random group name"
                    >
                      <Ionicons name="dice" size={22} color={colors.textSecondary} />
                    </TouchableOpacity>
                  </View>

                  <Footnote style={[styles.sheetFieldLabel, { color: colors.textSecondary }]}>
                    Description
                  </Footnote>
                  <TextInput
                    style={[
                      styles.input,
                      styles.textArea,
                      { backgroundColor: colors.inputBg, color: colors.textPrimary, borderColor: colors.border },
                    ]}
                    placeholder="Optional"
                    placeholderTextColor={colors.textMuted}
                    value={newGroupDescription}
                    onChangeText={setNewGroupDescription}
                    multiline
                    numberOfLines={3}
                  />

                  <Footnote style={{ color: colors.textMuted, marginTop: SPACE.sm }}>
                    Invite people (optional)
                  </Footnote>

                  {selectedInvites.length > 0 && (
                    <View
                      style={[
                        styles.inviteSelectedBlock,
                        { backgroundColor: colors.inputBg, borderColor: colors.success },
                      ]}
                    >
                      <Footnote style={{ color: colors.textSecondary, fontWeight: "600" }}>
                        Selected ({selectedInvites.length})
                      </Footnote>
                      <View style={styles.inviteSelectedList}>
                        {selectedInvites.map((inv) => {
                          const displayName = inv.name || inv.email;
                          return (
                            <View key={inv.email} style={styles.inviteSelectedRow}>
                              <View style={[styles.inviteResultAvatar, { backgroundColor: colors.surface }]}>
                                <Caption2 style={{ color: colors.textPrimary }}>
                                  {(displayName[0] || "?").toUpperCase()}
                                </Caption2>
                              </View>
                              <View style={styles.inviteResultText}>
                                <Subhead numberOfLines={1} style={{ color: colors.textPrimary }}>
                                  {displayName}
                                </Subhead>
                                <Caption2 numberOfLines={1} style={{ color: colors.textMuted }}>
                                  {inv.email}
                                </Caption2>
                              </View>
                              <TouchableOpacity
                                onPress={() => removeSelectedInvite(inv.email)}
                                hitSlop={hitSlopExpandToMinSize(22)}
                              >
                                <Ionicons name="close-circle" size={22} color={colors.textMuted} />
                              </TouchableOpacity>
                            </View>
                          );
                        })}
                      </View>
                    </View>
                  )}

                  <TextInput
                    style={[
                      styles.input,
                      { backgroundColor: colors.inputBg, color: colors.textPrimary, borderColor: colors.border, marginTop: SPACE.sm },
                    ]}
                    placeholder="Search by name or email…"
                    placeholderTextColor={colors.textMuted}
                    value={inviteSearchQuery}
                    onChangeText={setInviteSearchQuery}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  {inviteSearching && (
                    <ActivityIndicator size="small" color={colors.textSecondary} style={{ marginVertical: SPACE.xs }} />
                  )}
                  {inviteSearchResults.length > 0 && (
                    <View style={styles.inviteResultsWrap}>
                      {inviteSearchResults.map((u) => {
                        const email = (u.email || "").trim().toLowerCase();
                        const label = u.name || u.email || "?";
                        const alreadySelected = !!email && selectedInvites.some((x) => x.email === email);
                        const disabled = !email || alreadySelected;
                        return (
                          <TouchableOpacity
                            key={u.user_id}
                            style={[
                              styles.inviteResultRow,
                              {
                                borderColor: alreadySelected ? colors.success : colors.border,
                                backgroundColor: alreadySelected ? `${colors.success}12` : "transparent",
                              },
                            ]}
                            onPress={() => !disabled && addSelectedInvite(u)}
                            disabled={disabled}
                            activeOpacity={0.7}
                          >
                            <View style={[styles.inviteResultAvatar, { backgroundColor: colors.inputBg }]}>
                              <Caption2 style={{ color: colors.textPrimary }}>
                                {(label[0] || "?").toUpperCase()}
                              </Caption2>
                            </View>
                            <View style={styles.inviteResultText}>
                              <Subhead numberOfLines={1} style={{ color: colors.textPrimary }}>
                                {u.name || u.email}
                              </Subhead>
                              {u.email && (
                                <Caption2 numberOfLines={1} style={{ color: colors.textMuted }}>
                                  {u.email}
                                </Caption2>
                              )}
                            </View>
                            {alreadySelected ? (
                              <Ionicons name="checkmark-circle" size={24} color={colors.success} />
                            ) : (
                              <Ionicons name="add-circle-outline" size={22} color={colors.textSecondary} />
                            )}
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  )}
                </View>
              </ScrollView>

              {/* Fixed Footer */}
              <View
                style={[
                  styles.sheetFooterFixed,
                  { borderTopColor: colors.border, paddingBottom: Math.max(insets.bottom, SPACE.md) },
                ]}
              >
                <View style={styles.sheetActions}>
                  <TouchableOpacity
                    style={[
                      styles.sheetCancelButton,
                      {
                        backgroundColor: colors.inputBg,
                        borderColor: colors.border,
                        minHeight: BUTTON_SIZE.regular.height,
                      },
                    ]}
                    onPress={() => setShowCreateSheet(false)}
                    activeOpacity={0.7}
                  >
                    <Headline style={{ color: colors.textSecondary }}>Cancel</Headline>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.sheetCreateButton,
                      { backgroundColor: colors.buttonPrimary, minHeight: BUTTON_SIZE.regular.height },
                      (!newGroupName.trim() || creating) && styles.sheetButtonDisabled,
                    ]}
                    onPress={handleCreateGroup}
                    disabled={!newGroupName.trim() || creating}
                    activeOpacity={0.85}
                  >
                    {creating ? (
                      <ActivityIndicator size="small" color={colors.buttonText} />
                    ) : (
                      <Headline style={{ color: colors.buttonText }}>{t.groups.createGroup}</Headline>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </View>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   STYLES
   ───────────────────────────────────────────────────────────────────────────── */

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
    letterSpacing: -0.5,
  },
  headerInvitesPill: {
    width: LAYOUT.touchTarget,
    height: LAYOUT.touchTarget,
    borderRadius: RADIUS.lg,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },
  body: {
    flex: 1,
    zIndex: 1,
  },
  scrollContent: {
    paddingHorizontal: SCREEN_PAD,
    paddingTop: SPACE.sm,
  },

  /* ─── Error ─── */
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.sm,
    padding: SPACE.md,
    borderRadius: RADIUS.lg,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: LAYOUT.sectionGap,
  },

  /* ─── Section Cards ─── */
  sectionCard: {
    marginBottom: LAYOUT.sectionGap,
    overflow: "hidden",
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: LAYOUT.cardPadding,
    paddingVertical: SPACE.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  sectionHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.sm,
  },
  listBody: {
    paddingHorizontal: LAYOUT.cardPadding - SPACE.xs,
    paddingVertical: SPACE.sm,
  },

  /* ─── Group Row ─── */
  groupRow: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: LAYOUT.touchTarget,
    paddingVertical: SPACE.sm,
    paddingHorizontal: SPACE.xs,
    gap: LAYOUT.elementGap,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  groupAvatar: {
    width: AVATAR_SIZE.md,
    height: AVATAR_SIZE.md,
    borderRadius: AVATAR_SIZE.md / 2,
    alignItems: "center",
    justifyContent: "center",
  },
  groupInfo: {
    flex: 1,
    minWidth: 0,
  },
  groupNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.sm,
    flexWrap: "wrap",
  },
  roleBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: SPACE.sm,
    paddingVertical: 2,
    borderRadius: RADIUS.sm,
  },
  heartButton: {
    padding: SPACE.xs,
  },

  /* ─── Empty State ─── */
  emptyBlock: {
    alignItems: "center",
    paddingVertical: SPACE.xxxl,
    gap: SPACE.sm,
  },
  emptyIconWrap: {
    width: AVATAR_SIZE.lg,
    height: AVATAR_SIZE.lg,
    borderRadius: RADIUS.lg,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: SPACE.sm,
  },

  /* ─── View Invites ─── */
  viewInvitesContainer: {
    paddingHorizontal: LAYOUT.cardPadding,
    paddingTop: SPACE.sm,
    paddingBottom: SPACE.md,
  },
  viewInvitesButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACE.sm,
    paddingVertical: SPACE.md,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
  },

  /* ─── Bottom Actions ─── */
  actionsFooterCard: {
    marginBottom: 0,
    overflow: "hidden",
    padding: LAYOUT.cardPadding,
  },
  actionsButtonRow: {
    flexDirection: "row",
    gap: SPACE.md,
  },
  actionButtonHalf: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACE.sm,
    borderRadius: RADIUS.xl,
    minHeight: BUTTON_SIZE.large.height,
  },
  actionButtonSecondary: {
    borderWidth: 1,
  },
  actionButtonPrimary: {},

  /* ─── Modal ─── */
  modalRoot: {
    flex: 1,
  },
  modalKeyboardWrap: {
    flex: 1,
    justifyContent: "flex-end",
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  sheetShell: {
    width: "100%",
    flexDirection: "column",
    overflow: "hidden",
    paddingTop: SPACE.lg,
    flexShrink: 0,
  },
  sheetScroll: {
    flex: 1,
    minHeight: 0,
  },
  sheetScrollContent: {
    paddingHorizontal: SPACE.xxl,
    paddingTop: SPACE.sm,
    flexGrow: 1,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: SPACE.sm,
  },
  sheetTitle: {
    textAlign: "center",
    marginBottom: SPACE.md,
    paddingHorizontal: SPACE.xxl,
  },
  sheetError: {
    padding: SPACE.sm,
    borderRadius: RADIUS.md,
    marginBottom: SPACE.sm,
  },
  sheetFieldGroup: {
    gap: SPACE.sm,
    paddingBottom: 0,
  },
  sheetFieldLabel: {
    marginBottom: 2,
  },
  inputRow: {
    flexDirection: "row",
    gap: SPACE.md,
    alignItems: "center",
  },
  input: {
    flex: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: RADIUS.lg,
    paddingHorizontal: SPACE.md,
    paddingVertical: Platform.OS === "ios" ? SPACE.md : SPACE.sm,
    fontSize: APPLE_TYPO.body.size,
    lineHeight: 22,
  },
  textArea: {
    minHeight: 72,
    textAlignVertical: "top",
  },
  randomButton: {
    borderRadius: RADIUS.lg,
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: "center",
    alignItems: "center",
  },
  inviteSelectedBlock: {
    marginTop: SPACE.sm,
    borderRadius: RADIUS.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: SPACE.sm,
    gap: SPACE.sm,
  },
  inviteSelectedList: {
    gap: SPACE.xs,
  },
  inviteSelectedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.sm,
    paddingVertical: SPACE.xs,
    paddingHorizontal: SPACE.xs,
  },
  inviteResultsWrap: {
    marginTop: SPACE.xs,
    gap: SPACE.xs,
  },
  inviteResultRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.sm,
    paddingVertical: SPACE.xs,
    paddingHorizontal: SPACE.sm,
    borderRadius: RADIUS.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  inviteResultAvatar: {
    width: AVATAR_SIZE.sm,
    height: AVATAR_SIZE.sm,
    borderRadius: AVATAR_SIZE.sm / 2,
    alignItems: "center",
    justifyContent: "center",
  },
  inviteResultText: {
    flex: 1,
    minWidth: 0,
  },
  sheetFooterFixed: {
    flexShrink: 0,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: SPACE.xxl,
    paddingTop: SPACE.md,
  },
  sheetActions: {
    flexDirection: "row",
    gap: SPACE.md,
  },
  sheetCancelButton: {
    flex: 1,
    borderRadius: RADIUS.lg,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },
  sheetCreateButton: {
    flex: 2,
    borderRadius: RADIUS.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  sheetButtonDisabled: {
    opacity: 0.5,
  },
});