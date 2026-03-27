import React, { useEffect, useState, useCallback, useRef, useMemo } from "react";
import {
  FlatList,
  RefreshControl,
  Text,
  View,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  Animated,
  Platform,
  TextInput,
  Keyboard,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { ChatsSkeleton } from "../components/ui/ChatsSkeleton";
import { useNavigation, useRoute, useFocusEffect, type CompositeNavigationProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import type { RouteProp } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../api/client";
import { useTheme } from "../context/ThemeContext";
import { useLanguage } from "../context/LanguageContext";
import { SPACE, LAYOUT, RADIUS, APPLE_TYPO, BUTTON_SIZE, AVATAR_SIZE, hitSlopExpandToMinSize } from "../styles/tokens";
import { COLORS, PAGE_HERO_GRADIENT, pageHeroGradientColors } from "../styles/liquidGlass";
import { appleCardShadowResting } from "../styles/appleShadows";
import { Title1, Title2, Subhead, Footnote, Caption2, Headline } from "../components/ui";
import type { RootStackParamList } from "../navigation/RootNavigator";
import type { MainTabParamList } from "../navigation/mainTabTypes";
import { NotificationsInboxModal, type InboxNotification } from "../components/NotificationsInboxModal";
import { useStartGameModal } from "../context/StartGameModalContext";

const SCREEN_PAD = LAYOUT.screenPadding;
/** Match DashboardScreenV3 floating tab bar + FAB clearance */
const TAB_BAR_RESERVE_BASE = 128;
const HEADER_ROW_H = 52;
const SEARCH_BAR_H = 48;
/** Curated “recent” — Apple-style inbox: preview, not the full archive */
const RECENT_LIMIT = 5;
/** Chats initial skeleton: brief hold after /games, then cross-fade (avoids long artificial delay). */
const CHATS_SKELETON_HOLD_MS = 100;
const CHATS_SKELETON_FADE_MS = 200;

type ChatsNav = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, "Chats">,
  NativeStackNavigationProp<RootStackParamList>
>;

type GameItem = {
  game_id: string;
  group_id?: string;
  title?: string;
  group_name?: string;
  status: string;
  ended_at?: string;
  date?: string;
  player_count?: number;
  players?: unknown[];
  created_at?: string;
  updated_at?: string;
  total_pot?: number;
};

function sortGamesForInbox(a: GameItem, b: GameItem): number {
  const aActive = a.status === "active";
  const bActive = b.status === "active";
  if (aActive && !bActive) return -1;
  if (bActive && !aActive) return 1;
  const ta = new Date(a.updated_at || a.ended_at || a.created_at || 0).getTime();
  const tb = new Date(b.updated_at || b.ended_at || b.created_at || 0).getTime();
  return tb - ta;
}

export function ChatsScreen() {
  const { isDark, colors } = useTheme();
  const { t } = useLanguage();
  const { openStartGame } = useStartGameModal();
  const navigation = useNavigation<ChatsNav>();
  const route = useRoute<RouteProp<MainTabParamList, "Chats">>();
  const insets = useSafeAreaInsets();

  const [games, setGames] = useState<GameItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAllRecent, setShowAllRecent] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<TextInput>(null);

  const [skeletonVisible, setSkeletonVisible] = useState(true);
  const skeletonOpacity = useRef(new Animated.Value(1)).current;
  const contentOpacity = useRef(new Animated.Value(0)).current;

  const [unreadNotifications, setUnreadNotifications] = useState<InboxNotification[]>([]);
  const [notifModalVisible, setNotifModalVisible] = useState(false);

  const backgroundColor = isDark ? COLORS.jetDark : colors.contentBg;

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

  const sortedGames = useMemo(() => [...games].sort(sortGamesForInbox), [games]);

  const tabBarReserve = TAB_BAR_RESERVE_BASE + Math.max(insets.bottom, 8);
  /**
   * FlatList + in-scroll footer needs more clearance than Groups’ ScrollView so the CTA
   * and floating tab bar (pill + trailing search/FAB, shadows) don’t visually collide.
   */
  const bottomContentReserve = useMemo(
    () => tabBarReserve + LAYOUT.sectionGap * 2 + SPACE.lg + SPACE.xl,
    [tabBarReserve]
  );

  useEffect(() => {
    if (route.params?.focusSearch) {
      setSearchOpen(true);
      setTimeout(() => searchInputRef.current?.focus(), 100);
      navigation.setParams({ focusSearch: undefined });
    }
  }, [route.params?.focusSearch, navigation]);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await api.get("/games");
      const all = Array.isArray(res.data) ? res.data : [];
      setGames(all.filter((g: any) => g.status !== "scheduled"));
    } catch (e: any) {
      setError(e?.response?.data?.detail || e?.message || "Chats aren't available right now.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  /** Cross-fade skeleton → content when initial fetch finishes (not tied to `load` identity / no double fetch). */
  useEffect(() => {
    if (loading || !skeletonVisible) return;
    const minWait = setTimeout(() => {
      Animated.parallel([
        Animated.timing(skeletonOpacity, { toValue: 0, duration: CHATS_SKELETON_FADE_MS, useNativeDriver: true }),
        Animated.timing(contentOpacity, { toValue: 1, duration: CHATS_SKELETON_FADE_MS, useNativeDriver: true }),
      ]).start(() => setSkeletonVisible(false));
    }, CHATS_SKELETON_HOLD_MS);
    return () => clearTimeout(minWait);
  }, [loading, skeletonVisible, skeletonOpacity, contentOpacity]);

  const fetchUnreadNotifications = useCallback(async () => {
    try {
      const res = await api.get("/notifications");
      const list = Array.isArray(res.data) ? res.data : [];
      setUnreadNotifications(list.filter((n: InboxNotification) => !n.read));
    } catch {
      setUnreadNotifications([]);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchUnreadNotifications();
    }, [fetchUnreadNotifications])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  const formatDate = (game: GameItem) => {
    if (game.status === "active") {
      const c = game.created_at;
      if (!c) return "";
      const date = new Date(c);
      const diffH = (Date.now() - date.getTime()) / 3600000;
      if (diffH < 1) return "Just now";
      if (diffH < 24) return `${Math.floor(diffH)}h ago`;
      if (diffH < 48) return "Yesterday";
      return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    }
    const d = game.ended_at || game.date || game.created_at;
    if (!d) return "";
    const date = new Date(d);
    const diffH = (Date.now() - date.getTime()) / 3600000;
    if (diffH < 1) return "Just now";
    if (diffH < 24) return `${Math.floor(diffH)}h ago`;
    if (diffH < 48) return "Yesterday";
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const memberCount = (item: GameItem) =>
    item.player_count ?? (Array.isArray(item.players) ? item.players.length : 0);

  const detailLine = (item: GameItem) => {
    const parts: string[] = [];
    const n = memberCount(item);
    if (n > 0) parts.push(`${n} ${t.groups.members}`);
    if (item.total_pot != null && Number(item.total_pot) > 0) {
      parts.push(`$${Math.round(Number(item.total_pot))} ${t.chatsScreen.pot}`);
    }
    const title = item.title || "";
    const g = item.group_name || "";
    if (g && g !== title) parts.push(g);
    return parts.join(" · ");
  };

  const filteredGames = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return sortedGames;
    return sortedGames.filter((item) => {
      const active = item.status === "active";
      const meta = detailLine(item);
      const title = (item.title || item.group_name || "").toLowerCase();
      const gn = (item.group_name || "").toLowerCase();
      const hay = `${title} ${gn} ${meta} ${active ? t.chatsScreen.active : t.chatsScreen.ended}`.toLowerCase();
      return hay.includes(q);
    });
  }, [sortedGames, searchQuery, t]);

  const displayedGames = useMemo(() => {
    if (showAllRecent || filteredGames.length <= RECENT_LIMIT) return filteredGames;
    return filteredGames.slice(0, RECENT_LIMIT);
  }, [filteredGames, showAllRecent]);

  const hasMoreThanRecent = filteredGames.length > RECENT_LIMIT;

  const iconBg = (active: boolean) =>
    active
      ? isDark
        ? "rgba(52, 199, 89, 0.18)"
        : "rgba(52, 199, 89, 0.12)"
      : isDark
        ? "rgba(255, 255, 255, 0.06)"
        : "rgba(0, 0, 0, 0.04)";

  const pillStyle = (active: boolean) => ({
    paddingHorizontal: SPACE.sm,
    paddingVertical: 3,
    borderRadius: RADIUS.full,
    backgroundColor: active
      ? isDark
        ? "rgba(52, 199, 89, 0.2)"
        : "rgba(52, 199, 89, 0.14)"
      : isDark
        ? "rgba(255, 255, 255, 0.08)"
        : "rgba(0, 0, 0, 0.05)",
  });

  const renderItem = ({ item }: { item: GameItem }) => {
    const active = item.status === "active";
    const meta = detailLine(item);
    const timeLabel = formatDate(item);
    return (
      <TouchableOpacity
        style={[styles.chatCard, cardStyle]}
        onPress={() =>
          navigation.navigate("GameThreadChat", {
            gameId: item.game_id,
            groupId: item.group_id,
            groupName: item.group_name,
          })
        }
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={`${item.title || item.group_name || "Game"}, ${active ? t.chatsScreen.active : t.chatsScreen.ended}`}
      >
        <View style={[styles.leadIcon, { backgroundColor: iconBg(active) }]}>
          {active ? (
            <View style={[styles.liveDot, { backgroundColor: isDark ? "rgba(52, 199, 89, 0.95)" : "#1B7340" }]} />
          ) : (
            <Ionicons name="chatbubbles-outline" size={22} color={colors.textSecondary} />
          )}
        </View>
        <View style={styles.chatBody}>
          <Headline numberOfLines={2}>{item.title || item.group_name || "Game Night"}</Headline>
          <View style={styles.statusRow}>
            <View style={pillStyle(active)}>
              <Caption2 style={{ color: active ? colors.textPrimary : colors.textSecondary }}>
                {active ? t.chatsScreen.active : t.chatsScreen.ended}
              </Caption2>
            </View>
            {timeLabel ? <Footnote style={{ color: colors.textMuted }}> · {timeLabel}</Footnote> : null}
          </View>
          {meta ? (
            <Caption2 style={{ marginTop: SPACE.xs, color: colors.textMuted }} numberOfLines={2}>
              {meta}
            </Caption2>
          ) : null}
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
      </TouchableOpacity>
    );
  };

  const skeletonTop = insets.top + HEADER_ROW_H + (searchOpen ? SEARCH_BAR_H : 0);

  const listHeader = !loading ? (
    <View style={styles.listHeaderBlock}>
      <Subhead style={[styles.pageSubtitle, { color: colors.textSecondary }]}>{t.chatsScreen.subtitle}</Subhead>
      {filteredGames.length > 0 && hasMoreThanRecent && !showAllRecent ? (
        <Footnote style={[styles.showingCountLine, { color: colors.textMuted }]}>
          {t.chatsScreen.showingCount
            .replace("{shown}", String(displayedGames.length))
            .replace("{total}", String(filteredGames.length))}
        </Footnote>
      ) : null}
      {searchQuery.trim() && filteredGames.length === 0 ? (
        <Footnote style={[styles.showingCountLine, { color: colors.textMuted }]}>{t.chatsScreen.noSearchResults}</Footnote>
      ) : null}
    </View>
  ) : null;

  const primaryCta = (
    onPress: () => void,
    opts?: { fullWidth?: boolean }
  ) => (
    <TouchableOpacity
      style={[
        styles.primaryCta,
        {
          backgroundColor: colors.buttonPrimary,
          minHeight: BUTTON_SIZE.large.height,
        },
        opts?.fullWidth && styles.primaryCtaFull,
      ]}
      onPress={onPress}
      activeOpacity={0.88}
    >
      <Ionicons name="add-circle-outline" size={22} color={colors.buttonText} />
      <Text style={[styles.primaryCtaLabel, { color: colors.buttonText }]}>{t.chatsScreen.primaryCta}</Text>
    </TouchableOpacity>
  );

  const listFooter = !loading ? (
    <View style={styles.listFooterWrap}>
      {filteredGames.length > 0 && hasMoreThanRecent ? (
        <TouchableOpacity
          style={styles.seeAllRow}
          onPress={() => setShowAllRecent((v) => !v)}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={showAllRecent ? t.chatsScreen.showLess : `${t.chatsScreen.seeAll}, ${filteredGames.length}`}
        >
          <Footnote style={{ fontWeight: "600", color: colors.orange }}>
            {showAllRecent ? t.chatsScreen.showLess : `${t.chatsScreen.seeAll} · ${filteredGames.length}`}
          </Footnote>
          <Ionicons name={showAllRecent ? "chevron-up" : "chevron-down"} size={18} color={colors.orange} />
        </TouchableOpacity>
      ) : null}
      <View
        style={[
          styles.actionsFooterCard,
          cardStyle,
          filteredGames.length > 0 && hasMoreThanRecent ? styles.actionsFooterCardAfterSeeAll : null,
        ]}
      >
        <View style={styles.actionsFooterInner}>
          {primaryCta(() => openStartGame(), { fullWidth: true })}
          <Footnote style={[styles.ctaHintFooter, { color: colors.textMuted }]}>{t.chatsScreen.primaryCtaHint}</Footnote>
        </View>
      </View>
    </View>
  ) : null;

  return (
    <View style={[styles.root, { backgroundColor }]}>
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
          <Title1 style={{ letterSpacing: -0.5 }}>{t.nav.chats}</Title1>
          <View style={styles.headerSpacer} />
          <Pressable
            style={({ pressed }) => [
              styles.notifButton,
              {
                minWidth: LAYOUT.touchTarget,
                minHeight: LAYOUT.touchTarget,
                backgroundColor: colors.inputBg,
                borderColor: colors.border,
                opacity: pressed ? 0.85 : 1,
              },
            ]}
            onPress={() => {
              fetchUnreadNotifications();
              setNotifModalVisible(true);
            }}
            hitSlop={hitSlopExpandToMinSize(LAYOUT.touchTarget)}
            accessibilityRole="button"
            accessibilityLabel={`${t.chatsScreen.notifInboxTitle}${
              unreadNotifications.length > 0 ? `, ${unreadNotifications.length} unread` : ""
            }`}
          >
            <Ionicons name="notifications-outline" size={22} color={colors.textSecondary} />
            {unreadNotifications.length > 0 ? (
              <View style={[styles.notifDot, { backgroundColor: colors.orange }]} />
            ) : null}
          </Pressable>
        </View>
        {searchOpen ? (
          <View style={[styles.searchWrap, { paddingHorizontal: SCREEN_PAD }]}>
            <View
              style={[
                styles.searchField,
                {
                  backgroundColor: colors.inputBg,
                  borderColor: colors.border,
                },
              ]}
            >
              <Ionicons name="search" size={18} color={colors.textMuted} style={styles.searchIcon} />
              <TextInput
                ref={searchInputRef}
                style={[styles.searchInput, { color: colors.textPrimary }]}
                placeholder={t.chatsScreen.searchPlaceholder}
                placeholderTextColor={colors.textMuted}
                value={searchQuery}
                onChangeText={setSearchQuery}
                returnKeyType="search"
                autoCorrect={false}
                autoCapitalize="none"
                clearButtonMode="while-editing"
              />
            </View>
            <TouchableOpacity
              onPress={() => {
                setSearchOpen(false);
                setSearchQuery("");
                Keyboard.dismiss();
              }}
              hitSlop={hitSlopExpandToMinSize(22)}
              accessibilityRole="button"
              accessibilityLabel={t.chatsScreen.cancelSearch}
            >
              <Subhead style={{ color: colors.orange, fontWeight: "600" }}>{t.chatsScreen.cancelSearch}</Subhead>
            </TouchableOpacity>
          </View>
        ) : null}
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
          <ChatsSkeleton rows={3} />
        </Animated.View>
      )}

      <Animated.View style={[styles.listWrap, { opacity: contentOpacity }]}>
        <FlatList
          data={displayedGames}
          renderItem={renderItem}
          keyExtractor={(item) => item.game_id}
          ListHeaderComponent={listHeader}
          ListFooterComponent={listFooter}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: loading ? insets.bottom + SPACE.xl : bottomContentReserve },
            games.length === 0 && !loading && !searchQuery.trim() && styles.listContentEmpty,
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
              progressViewOffset={
                Platform.OS === "android"
                  ? insets.top + HEADER_ROW_H + (searchOpen ? SEARCH_BAR_H : 0) + SPACE.sm
                  : undefined
              }
            />
          }
          ListEmptyComponent={
            loading ? null : searchQuery.trim() && games.length > 0 ? (
              <View style={styles.emptyStack}>
                {listHeader}
              </View>
            ) : games.length === 0 ? (
              <View style={styles.emptyStack}>
                {listHeader}
                <View style={[styles.emptyCard, cardStyle]}>
                  <View style={[styles.emptyIconWrap, { backgroundColor: iconBg(false) }]}>
                    <Ionicons name="chatbubbles-outline" size={28} color={colors.textMuted} />
                  </View>
                  <Title2 style={[styles.emptyTitle, { color: colors.textPrimary }]}>{t.chatsScreen.emptyTitle}</Title2>
                  <Subhead style={[styles.emptySub, { color: colors.textSecondary }]}>{t.chatsScreen.emptyBody}</Subhead>
                </View>
              </View>
            ) : null
          }
        />
      </Animated.View>

      {error ? (
        <View
          style={[
            styles.errorBanner,
            {
              bottom: !loading ? tabBarReserve + SPACE.md : insets.bottom + SPACE.xl,
              backgroundColor: isDark ? "rgba(255, 69, 58, 0.15)" : "rgba(255, 69, 58, 0.1)",
              borderColor: isDark ? "rgba(255, 69, 58, 0.4)" : "rgba(255, 69, 58, 0.3)",
            },
          ]}
        >
          <Footnote style={{ color: colors.textSecondary, textAlign: "center" }}>{error}</Footnote>
        </View>
      ) : null}

      <NotificationsInboxModal
        visible={notifModalVisible}
        onClose={() => setNotifModalVisible(false)}
        navigation={navigation as unknown as NativeStackNavigationProp<RootStackParamList>}
        unreadItems={unreadNotifications}
        onRemoveFromUnread={(id) =>
          setUnreadNotifications((prev) => prev.filter((n) => n.notification_id !== id))
        }
      />
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
  headerSpacer: {
    flex: 1,
  },
  notifButton: {
    borderRadius: RADIUS.lg,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },
  notifDot: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.sm,
    marginBottom: SPACE.sm,
  },
  searchField: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: RADIUS.lg,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: LAYOUT.cardPadding,
    minHeight: LAYOUT.touchTarget,
  },
  searchIcon: {
    marginRight: SPACE.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: APPLE_TYPO.body.size,
    paddingVertical: Platform.OS === "ios" ? SPACE.sm : SPACE.xs,
  },
  listWrap: {
    flex: 1,
    zIndex: 1,
  },
  listContent: {
    paddingHorizontal: SCREEN_PAD,
    paddingTop: SPACE.xs,
  },
  listContentEmpty: {
    flexGrow: 1,
  },
  listHeaderBlock: {
    marginBottom: SPACE.md,
  },
  pageSubtitle: {
    lineHeight: 22,
    marginBottom: SPACE.sm,
  },
  showingCountLine: {
    lineHeight: 18,
    marginBottom: SPACE.xs,
  },
  chatCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    minHeight: LAYOUT.touchTarget,
    paddingHorizontal: LAYOUT.cardPadding,
    paddingVertical: SPACE.md,
    gap: LAYOUT.elementGap,
  },
  leadIcon: {
    width: 48,
    height: 48,
    borderRadius: RADIUS.md,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  liveDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  chatBody: {
    flex: 1,
    minWidth: 0,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    marginTop: SPACE.xs,
  },
  listFooterWrap: {
    paddingTop: LAYOUT.sectionGap,
    marginBottom: SPACE.md,
  },
  seeAllRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACE.xs,
    paddingVertical: SPACE.md,
  },
  actionsFooterCard: {
    marginBottom: 0,
    overflow: "hidden",
  },
  actionsFooterCardAfterSeeAll: {
    marginTop: SPACE.md,
  },
  actionsFooterInner: {
    padding: LAYOUT.cardPadding,
  },
  primaryCta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACE.sm,
    borderRadius: RADIUS.xl,
    paddingHorizontal: SPACE.md,
  },
  primaryCtaFull: {
    alignSelf: "stretch",
    width: "100%",
  },
  primaryCtaLabel: {
    fontSize: APPLE_TYPO.body.size,
    fontWeight: "600",
  },
  ctaHintFooter: {
    textAlign: "center",
    marginTop: SPACE.sm,
    lineHeight: 18,
  },
  emptyStack: {
    flex: 1,
    paddingTop: SPACE.sm,
  },
  emptyCard: {
    alignItems: "center",
    paddingHorizontal: SPACE.xl,
    paddingVertical: SPACE.xxxl,
    marginTop: SPACE.lg,
  },
  emptyIconWrap: {
    width: AVATAR_SIZE.lg,
    height: AVATAR_SIZE.lg,
    borderRadius: RADIUS.lg,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: SPACE.md,
  },
  emptyTitle: {
    textAlign: "center",
    marginBottom: SPACE.sm,
  },
  emptySub: {
    textAlign: "center",
    lineHeight: 22,
    paddingHorizontal: SPACE.sm,
    marginBottom: SPACE.lg,
  },
  errorBanner: {
    position: "absolute",
    left: SCREEN_PAD,
    right: SCREEN_PAD,
    padding: SPACE.md,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    zIndex: 20,
  },
});
