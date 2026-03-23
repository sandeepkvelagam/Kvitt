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
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Animated,
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
} from "../styles/tokens";
import { COLORS, PAGE_HERO_GRADIENT, pageHeroGradientColors } from "../styles/liquidGlass";
import { appleCardShadowResting } from "../styles/appleShadows";
import {
  Title1,
  Title2,
  Title3,
  Headline,
  Subhead,
  Footnote,
  Caption2,
  Label,
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

const GROUP_ADJECTIVES = ["Lucky", "Wild", "Golden", "Royal", "Midnight", "Epic", "Thunder", "Cosmic"];
const GROUP_NOUNS = ["Aces", "Kings", "Sharks", "Wolves", "Dragons", "Legends", "Champions", "Raiders"];

function generateRandomName() {
  const adj = GROUP_ADJECTIVES[Math.floor(Math.random() * GROUP_ADJECTIVES.length)];
  const noun = GROUP_NOUNS[Math.floor(Math.random() * GROUP_NOUNS.length)];
  return `${adj} ${noun}`;
}

type GroupRowProps = {
  item: GroupItem;
  favorites: string[];
  toggleFavorite: (id: string) => void;
  onPress: () => void;
  colors: ReturnType<typeof useTheme>["colors"];
  adminBgColor: string;
  isLast: boolean;
  membersWord: string;
};

function GroupRow({
  item,
  favorites,
  toggleFavorite,
  onPress,
  colors,
  adminBgColor,
  isLast,
  membersWord,
}: GroupRowProps) {
  const isFav = favorites.includes(item.group_id);
  return (
    <TouchableOpacity
      style={[
        styles.groupItem,
        { borderBottomColor: isLast ? "transparent" : colors.border },
      ]}
      onPress={onPress}
      activeOpacity={0.7}
      testID={`group-card-${item.group_id}`}
    >
      <View
        style={[
          styles.groupAvatar,
          {
            backgroundColor: colors.inputBg,
            borderRadius: RADIUS.md,
          },
        ]}
      >
        <Title3 style={{ color: colors.textPrimary }}>{item.name?.[0]?.toUpperCase() || "G"}</Title3>
      </View>
      <View style={styles.groupInfo}>
        <View style={styles.groupNameRow}>
          <Headline numberOfLines={1} style={{ flexShrink: 1 }}>
            {item.name}
          </Headline>
          {item.role === "admin" ? (
            <View style={[styles.adminBadge, { backgroundColor: adminBgColor }]}>
              <Ionicons name="shield" size={10} color={colors.warning} />
              <Caption2 style={{ fontWeight: "600", color: colors.warning }}>Admin</Caption2>
            </View>
          ) : (
            <View style={[styles.adminBadge, { backgroundColor: colors.inputBg }]}>
              <Ionicons name="person" size={10} color={colors.textSecondary} />
              <Caption2 style={{ fontWeight: "600", color: colors.textSecondary }}>Member</Caption2>
            </View>
          )}
        </View>
        <Footnote style={{ marginTop: SPACE.xs / 2, color: colors.textMuted }}>
          {item.member_count ?? 0} {membersWord}
        </Footnote>
      </View>
      <TouchableOpacity
        style={styles.heartButton}
        onPress={(e) => {
          e.stopPropagation();
          toggleFavorite(item.group_id);
        }}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={
          isFav ? `Remove ${item.name} from favourites` : `Add ${item.name} to favourites`
        }
      >
        <Ionicons
          name={isFav ? "heart" : "heart-outline"}
          size={18}
          color={isFav ? colors.textPrimary : colors.textMuted}
        />
      </TouchableOpacity>
      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
    </TouchableOpacity>
  );
}

export function GroupsScreen() {
  const { isDark, colors } = useTheme();
  const { t } = useLanguage();
  const navigation = useNavigation<Nav>();
  const { isMainTabShell } = useTabShell();
  const insets = useSafeAreaInsets();
  const [groups, setGroups] = useState<GroupItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showCreateSheet, setShowCreateSheet] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupDescription, setNewGroupDescription] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [favorites, setFavorites] = useState<string[]>([]);

  const [skeletonVisible, setSkeletonVisible] = useState(true);
  const skeletonOpacity = useRef(new Animated.Value(1)).current;
  const contentOpacity = useRef(new Animated.Value(0)).current;

  const headerEntrance = useState(new Animated.Value(0))[0];
  const listEntrance = useState(new Animated.Value(0))[0];

  const backgroundColor = isDark ? COLORS.jetDark : colors.contentBg;

  /** Semantic warning (Apple amber) — not raw hex */
  const adminBgColor = isDark ? "rgba(255, 159, 10, 0.16)" : "rgba(255, 159, 10, 0.12)";

  const tabBarReserve = TAB_BAR_RESERVE_BASE + Math.max(insets.bottom, 8);
  /** Scroll padding only — CTAs live inside the list (no overlay dock). */
  const bottomContentReserve = tabBarReserve + LAYOUT.sectionGap + SPACE.lg;

  /** Match DashboardScreenV3 elevated cards (blur stack + hairline border). */
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

  const favoritesCardStyle = cardStyle;

  useEffect(() => {
    Animated.stagger(100, [
      Animated.spring(headerEntrance, { toValue: 1, useNativeDriver: true, tension: 50, friction: 8 }),
      Animated.spring(listEntrance, { toValue: 1, useNativeDriver: true, tension: 50, friction: 8 }),
    ]).start();
  }, [headerEntrance, listEntrance]);

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

  const handleCreateGroup = async () => {
    if (!newGroupName.trim()) return;

    setCreating(true);
    setCreateError(null);
    try {
      const res = await api.post("/groups", {
        name: newGroupName.trim(),
        description: newGroupDescription.trim() || undefined,
      });
      setShowCreateSheet(false);
      setNewGroupName("");
      setNewGroupDescription("");
      await load();
      if (res.data?.group_id) {
        navigation.navigate("GroupHub", {
          groupId: res.data.group_id,
          groupName: res.data.name || newGroupName,
        });
      }
    } catch (e: any) {
      setCreateError(e?.response?.data?.detail || e?.message || "Group creation unavailable.");
    } finally {
      setCreating(false);
    }
  };

  const handleRandomName = () => {
    setNewGroupName(generateRandomName());
  };

  const navigateHub = (item: GroupItem) =>
    navigation.navigate("GroupHub", { groupId: item.group_id, groupName: item.name });

  const favoriteGroups = useMemo(
    () => groups.filter((g) => favorites.includes(g.group_id)),
    [groups, favorites]
  );

  const HEADER_ROW_APPROX = 52;
  const skeletonTop = insets.top + HEADER_ROW_APPROX;

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
          {
            height: Math.min(PAGE_HERO_GRADIENT.maxHeight, insets.top + PAGE_HERO_GRADIENT.safeAreaPad),
          },
        ]}
      />

      <View style={styles.topChrome} pointerEvents="box-none">
        <View style={{ height: insets.top }} />
        <View style={styles.headerRow}>
          {!isMainTabShell ? (
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
          ) : null}
          <Title1 style={styles.screenTitle} numberOfLines={1}>
            {t.nav.groups}
          </Title1>
          <View style={styles.headerFlexSpacer} />
          <Pressable
            style={({ pressed }) => [
              styles.invitesPill,
              {
                minWidth: LAYOUT.touchTarget,
                minHeight: LAYOUT.touchTarget,
                backgroundColor: colors.inputBg,
                borderColor: colors.border,
                opacity: pressed ? 0.85 : 1,
              },
            ]}
            onPress={() => navigation.navigate("PendingRequests")}
            accessibilityRole="button"
            accessibilityLabel="Invites"
          >
            <Ionicons name="mail-open-outline" size={20} color={colors.orange} />
          </Pressable>
        </View>
      </View>

      {skeletonVisible && (
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            {
              opacity: skeletonOpacity,
              backgroundColor,
              top: skeletonTop,
              zIndex: 10,
            },
          ]}
          pointerEvents="none"
        >
          <GroupsSkeleton />
        </Animated.View>
      )}

      <Animated.View style={[styles.body, { opacity: contentOpacity }]}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: bottomContentReserve },
          ]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.textSecondary}
              titleColor={colors.textMuted}
              colors={[colors.textSecondary]}
              progressBackgroundColor={colors.surfaceBackground}
              progressViewOffset={Platform.OS === "android" ? skeletonTop + 8 : undefined}
            />
          }
        >
          <Animated.View
            style={[
              styles.heroSummaryCard,
              cardStyle,
              {
                opacity: headerEntrance,
                transform: [
                  {
                    translateY: headerEntrance.interpolate({
                      inputRange: [0, 1],
                      outputRange: [-12, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            <View style={styles.heroSummaryRow}>
              <View style={styles.heroSummaryLeft}>
                <View style={styles.heroTitleRow}>
                  <Ionicons name="people" size={20} color={colors.textSecondary} />
                  <Label style={{ letterSpacing: 0.8, color: colors.textSecondary }}>{t.groups.myGroups}</Label>
                </View>
                <Subhead style={[styles.heroSubtitle, { color: colors.textMuted }]}>
                  Manage your poker circles
                </Subhead>
              </View>
              <TouchableOpacity
                style={[
                  styles.heroInvitesButton,
                  {
                    backgroundColor: colors.inputBg,
                    borderColor: colors.border,
                  },
                ]}
                onPress={() => navigation.navigate("PendingRequests")}
                activeOpacity={0.75}
              >
                <Ionicons name="mail-open-outline" size={16} color={colors.orange} />
                <Subhead bold style={{ color: colors.textPrimary }}>
                  Invites
                </Subhead>
              </TouchableOpacity>
            </View>
          </Animated.View>

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

          {favoriteGroups.length > 0 ? (
            <Animated.View
              style={[
                styles.sectionCard,
                favoritesCardStyle,
                {
                  opacity: listEntrance,
                  transform: [
                    {
                      translateY: listEntrance.interpolate({
                        inputRange: [0, 1],
                        outputRange: [16, 0],
                      }),
                    },
                  ],
                },
              ]}
            >
              <View style={[styles.sectionHeader, { borderBottomColor: colors.border }]}>
                <View style={styles.sectionHeaderLeft}>
                  <Ionicons name="heart" size={16} color={colors.textSecondary} />
                  <Label style={{ letterSpacing: 0.6, color: colors.textSecondary }}>Favorites</Label>
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
                    adminBgColor={adminBgColor}
                    isLast={index === favoriteGroups.length - 1}
                    membersWord={t.groups.members}
                  />
                ))}
              </View>
            </Animated.View>
          ) : null}

          <Animated.View
            style={[
              styles.sectionCard,
              cardStyle,
              favoriteGroups.length > 0 ? styles.sectionCardAfter : null,
              {
                opacity: listEntrance,
                transform: [
                  {
                    translateY: listEntrance.interpolate({
                      inputRange: [0, 1],
                      outputRange: [16, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            <View style={[styles.sectionHeader, { borderBottomColor: colors.border }]}>
              <View style={styles.sectionHeaderLeft}>
                <Ionicons name="people" size={18} color={colors.textSecondary} />
                <Label style={{ letterSpacing: 0.6, color: colors.textSecondary }}>Your groups</Label>
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
                    <Ionicons name="people-outline" size={28} color={colors.textMuted} />
                  </View>
                  <Title2 style={{ textAlign: "center" }}>{t.groups.noGroups}</Title2>
                  <Subhead style={{ textAlign: "center", color: colors.textSecondary, paddingHorizontal: SPACE.lg }}>
                    Create a group or accept an invite to start playing.
                  </Subhead>
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
                    adminBgColor={adminBgColor}
                    isLast={index === groups.length - 1}
                    membersWord={t.groups.members}
                  />
                ))
              )}
            </View>

            {!loading && groups.length > 0 ? (
              <View style={styles.quickActionsContainer}>
                <TouchableOpacity
                  style={[
                    styles.quickActionButton,
                    {
                      backgroundColor: colors.inputBg,
                      borderColor: colors.border,
                      borderWidth: 1,
                      minHeight: BUTTON_SIZE.compact.height,
                    },
                  ]}
                  onPress={() => navigation.navigate("PendingRequests")}
                  activeOpacity={0.85}
                >
                  <Ionicons name="mail-outline" size={18} color={colors.orange} />
                  <Subhead bold style={{ color: colors.textPrimary }}>
                    View invites
                  </Subhead>
                </TouchableOpacity>
              </View>
            ) : null}
          </Animated.View>

          {/* In-page primary actions (same scroll surface as groups — no overlap with tab bar) */}
          <Animated.View
            style={[
              styles.sectionCard,
              styles.actionsFooterCard,
              cardStyle,
              {
                opacity: listEntrance,
                transform: [
                  {
                    translateY: listEntrance.interpolate({
                      inputRange: [0, 1],
                      outputRange: [12, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            <View style={styles.actionsFooterInner}>
              <View style={styles.actionsButtonRow}>
                <TouchableOpacity
                  style={[
                    styles.actionButtonHalf,
                    styles.actionButtonSecondary,
                    {
                      backgroundColor: colors.inputBg,
                      borderColor: colors.border,
                      minHeight: BUTTON_SIZE.large.height,
                    },
                  ]}
                  onPress={() => navigation.navigate("AIAssistant")}
                  activeOpacity={0.88}
                >
                  <Ionicons name="sparkles-outline" size={22} color={colors.orange} />
                  <Subhead bold style={{ color: colors.textPrimary }}>
                    AI Chat
                  </Subhead>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.actionButtonHalf,
                    styles.actionButtonPrimary,
                    {
                      backgroundColor: colors.buttonPrimary,
                      minHeight: BUTTON_SIZE.large.height,
                    },
                  ]}
                  onPress={() => setShowCreateSheet(true)}
                  activeOpacity={0.88}
                >
                  <Ionicons name="add-circle-outline" size={22} color={colors.buttonText} />
                  <Subhead bold style={{ color: colors.buttonText }}>
                    New Group
                  </Subhead>
                </TouchableOpacity>
              </View>
            </View>
          </Animated.View>
        </ScrollView>
      </Animated.View>

      <Modal
        visible={showCreateSheet}
        animationType="slide"
        transparent
        onRequestClose={() => setShowCreateSheet(false)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setShowCreateSheet(false)}
        />
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.modalOverlay}
          pointerEvents="box-none"
        >
          <View
            style={[
              styles.sheetContainer,
              {
                backgroundColor: colors.surface,
                paddingBottom: Math.max(insets.bottom, SPACE.xxl),
              },
              Platform.OS === "ios" && { borderCurve: "continuous" as const },
            ]}
          >
            <View style={[styles.sheetHandle, { backgroundColor: colors.border }]} />
            <Title2 style={styles.sheetTitle}>{t.groups.createGroup}</Title2>

            {createError ? (
              <View
                style={[
                  styles.sheetError,
                  { backgroundColor: isDark ? "rgba(255, 69, 58, 0.15)" : "rgba(255, 69, 58, 0.1)" },
                ]}
              >
                <Footnote style={{ color: colors.danger }}>{createError}</Footnote>
              </View>
            ) : null}

            <View style={styles.sheetFieldGroup}>
              <View style={styles.inputRow}>
                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: colors.inputBg,
                      color: colors.textPrimary,
                      borderColor: colors.border,
                    },
                  ]}
                  placeholder={t.groups.groupName}
                  placeholderTextColor={colors.textMuted}
                  value={newGroupName}
                  onChangeText={setNewGroupName}
                  autoFocus
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
                >
                  <Ionicons name="dice" size={22} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>

              <TextInput
                style={[
                  styles.input,
                  styles.textArea,
                  {
                    backgroundColor: colors.inputBg,
                    color: colors.textPrimary,
                    borderColor: colors.border,
                  },
                ]}
                placeholder="Description (optional)"
                placeholderTextColor={colors.textMuted}
                value={newGroupDescription}
                onChangeText={setNewGroupDescription}
                multiline
                numberOfLines={3}
              />
            </View>

            <View style={styles.sheetActions}>
              <TouchableOpacity
                style={[
                  styles.cancelButton,
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
                  styles.createButton,
                  {
                    backgroundColor: colors.buttonPrimary,
                    minHeight: BUTTON_SIZE.regular.height,
                  },
                  (!newGroupName.trim() || creating) && styles.buttonDisabled,
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
        </KeyboardAvoidingView>
      </Modal>
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
    letterSpacing: -0.5,
  },
  headerFlexSpacer: {
    flex: 1,
  },
  invitesPill: {
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
    paddingTop: SPACE.xs,
  },
  heroSummaryCard: {
    marginBottom: LAYOUT.sectionGap,
    padding: LAYOUT.cardPadding,
    overflow: "hidden",
  },
  heroSummaryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: SPACE.md,
  },
  heroSummaryLeft: {
    flex: 1,
    minWidth: 0,
  },
  heroTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.sm,
  },
  heroSubtitle: {
    marginTop: SPACE.sm,
    marginLeft: 28,
    lineHeight: 20,
  },
  heroInvitesButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: RADIUS.lg,
    paddingVertical: SPACE.sm,
    paddingHorizontal: SPACE.md,
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.sm,
    padding: SPACE.md,
    borderRadius: RADIUS.lg,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: LAYOUT.sectionGap,
  },
  sectionCard: {
    marginBottom: LAYOUT.sectionGap,
    overflow: "hidden",
  },
  sectionCardAfter: {
    marginTop: 0,
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
  groupItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: SPACE.md,
    paddingHorizontal: SPACE.xs,
    gap: LAYOUT.elementGap,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  groupAvatar: {
    width: AVATAR_SIZE.md,
    height: AVATAR_SIZE.md,
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
  adminBadge: {
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
  emptyBlock: {
    alignItems: "center",
    paddingVertical: SPACE.xxxl,
    gap: SPACE.md,
  },
  emptyIconWrap: {
    width: 56,
    height: 56,
    borderRadius: RADIUS.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  quickActionsContainer: {
    paddingHorizontal: SPACE.sm,
    paddingTop: SPACE.sm,
    paddingBottom: SPACE.md,
  },
  quickActionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: SPACE.md,
    borderRadius: RADIUS.xl,
    gap: SPACE.sm,
  },
  actionsFooterCard: {
    marginBottom: 0,
    overflow: "hidden",
  },
  actionsFooterInner: {
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
    paddingHorizontal: SPACE.md,
  },
  actionButtonSecondary: {
    borderWidth: 1,
  },
  actionButtonPrimary: {},
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  sheetContainer: {
    borderTopLeftRadius: RADIUS.sheet,
    borderTopRightRadius: RADIUS.sheet,
    paddingHorizontal: SPACE.xxl,
    paddingTop: SPACE.md,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: SPACE.lg,
  },
  sheetTitle: {
    textAlign: "center",
    marginBottom: SPACE.lg,
  },
  sheetError: {
    padding: SPACE.md,
    borderRadius: RADIUS.md,
    marginBottom: SPACE.md,
  },
  sheetFieldGroup: {
    gap: SPACE.md,
    marginBottom: SPACE.xl,
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
    minHeight: 88,
    textAlignVertical: "top",
  },
  randomButton: {
    borderRadius: RADIUS.lg,
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: "center",
    alignItems: "center",
  },
  sheetActions: {
    flexDirection: "row",
    gap: SPACE.md,
  },
  cancelButton: {
    flex: 1,
    borderRadius: RADIUS.lg,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },
  createButton: {
    flex: 2,
    borderRadius: RADIUS.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonDisabled: {
    opacity: 0.5,
  },
});
