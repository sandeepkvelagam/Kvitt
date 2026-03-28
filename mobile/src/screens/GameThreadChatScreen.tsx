import React, { useEffect, useState, useCallback, useMemo } from "react";
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { RouteProp, useRoute, useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "../context/ThemeContext";
import { useLanguage } from "../context/LanguageContext";
import { PAGE_HERO_GRADIENT, pageHeroGradientColors } from "../styles/liquidGlass";
import { appleCardShadowResting } from "../styles/appleShadows";
import { LAYOUT, SPACE, RADIUS, BUTTON_SIZE } from "../styles/tokens";
import type { RootStackParamList } from "../navigation/RootNavigator";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { getGame } from "../api/games";
import { getGroup } from "../api/groups";
import { GroupChatSettingsSheet } from "../components/GroupChatSettingsSheet";
import { GameThreadMessagesPanel } from "../components/game/GameThreadMessagesPanel";
import { formatGameWhenDisplay } from "../utils/formatGameThreadMeta";
import { Label, Title3, Headline, Footnote, Subhead, Caption } from "../components/ui";

type Nav = NativeStackNavigationProp<RootStackParamList>;
type R = RouteProp<RootStackParamList, "GameThreadChat">;

export function GameThreadChatScreen() {
  const route = useRoute<R>();
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const { t } = useLanguage();

  const { gameId, groupId: paramGroupId, groupName: paramGroupName } = route.params;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [groupId, setGroupId] = useState<string | null>(paramGroupId ?? null);
  const [groupName, setGroupName] = useState(paramGroupName ?? "");
  const [game, setGame] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [socketConnected, setSocketConnected] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    setIsAdmin(false);
    try {
      const g = await getGame(gameId);
      setGame(g);
      const gid = paramGroupId || g?.group_id || g?.group?.group_id;
      if (!gid) {
        setError(t.chatsScreen.gameThreadMissingGroup);
        setGroupId(null);
        setLoading(false);
        return;
      }
      setGroupId(gid);
      const gname =
        paramGroupName ||
        g?.group?.name ||
        g?.group_name ||
        "";
      setGroupName(gname);

      try {
        const grp = await getGroup(gid);
        setIsAdmin(grp?.user_role === "admin");
        if (grp?.name && !paramGroupName) setGroupName(grp.name);
      } catch {
        setIsAdmin(false);
      }
    } catch (e: any) {
      setError(e?.response?.data?.detail || e?.message || t.chatsScreen.gameThreadLoadError);
      setGroupId(null);
    } finally {
      setLoading(false);
    }
  }, [gameId, paramGroupId, paramGroupName, t]);

  useEffect(() => {
    load();
  }, [load]);

  const title =
    game?.title || game?.group_name || groupName || t.chatsScreen.gameThreadDefaultTitle;
  const status = game?.status ?? "";
  const pot = game?.total_pot != null ? Math.round(Number(game.total_pot)) : null;
  const playerCount = Array.isArray(game?.players)
    ? game.players.length
    : game?.player_count ?? 0;

  const locationLine = typeof game?.location === "string" ? game.location.trim() : "";
  const whenLine = useMemo(() => {
    if (!game) return null;
    return formatGameWhenDisplay(game);
  }, [game]);

  return (
    <View style={[styles.root, { backgroundColor: colors.pageBackground }]}>
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
      <KeyboardAvoidingView
        style={styles.keyboardAvoid}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={0}
      >
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + SPACE.sm,
            backgroundColor: "transparent",
          },
        ]}
      >
        <Pressable
          onPress={() => navigation.goBack()}
          style={({ pressed }) => [
            styles.headerBackPill,
            {
              backgroundColor: colors.inputBg,
              borderColor: colors.border,
              opacity: pressed ? 0.85 : 1,
            },
          ]}
          hitSlop={{ top: SPACE.sm, bottom: SPACE.sm, left: SPACE.sm, right: SPACE.sm }}
          accessibilityRole="button"
          accessibilityLabel={t.common.back}
        >
          <Ionicons name="chevron-back" size={22} color={colors.textSecondary} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Title3 numberOfLines={1}>{title}</Title3>
          <Footnote numberOfLines={1} style={{ marginTop: SPACE.xs }}>
            {t.chatsScreen.gameThreadSessionTimeline}
            {" · "}
            {socketConnected
              ? t.chatsScreen.gameThreadSocketOnline
              : t.chatsScreen.gameThreadSocketConnecting}
          </Footnote>
        </View>
        {groupId ? (
          <Pressable
            onPress={() => setShowSettings(true)}
            style={({ pressed }) => [
              styles.headerBackPill,
              {
                backgroundColor: colors.inputBg,
                borderColor: colors.border,
                opacity: pressed ? 0.85 : 1,
              },
            ]}
            hitSlop={{ top: SPACE.sm, bottom: SPACE.sm, left: SPACE.sm, right: SPACE.sm }}
            accessibilityRole="button"
            accessibilityLabel="Chat settings"
          >
            <Ionicons name="settings-outline" size={22} color={colors.textMuted} />
          </Pressable>
        ) : (
          <View style={styles.headerTrailingSpacer} />
        )}
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.trustBlue} />
        </View>
      ) : error || !groupId ? (
        <View style={styles.centered}>
          <Subhead style={{ textAlign: "center" }}>{error || t.chatsScreen.gameThreadMissingGroup}</Subhead>
          <TouchableOpacity style={styles.retry} onPress={load} hitSlop={12}>
            <Headline style={{ color: colors.trustBlue }}>{t.chatsScreen.retry}</Headline>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <ScrollView
            style={styles.contextScroll}
            contentContainerStyle={styles.contextScrollInner}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Label style={styles.sectionLabel}>{t.chatsScreen.gameThreadSectionGame}</Label>

            <View
              style={[
                styles.gameCard,
                {
                  backgroundColor: colors.surfaceBackground,
                  borderColor: colors.border,
                  ...appleCardShadowResting(isDark),
                },
              ]}
            >
              <View style={styles.pillRowInner}>
                <View
                  style={[
                    styles.pill,
                    { backgroundColor: colors.inputBg, borderColor: colors.border },
                  ]}
                >
                  <Caption color={colors.textPrimary}>
                    {status === "active"
                      ? t.chatsScreen.active
                      : status === "ended"
                        ? t.chatsScreen.ended
                        : status || "—"}
                  </Caption>
                </View>
                {groupName ? (
                  <Subhead numberOfLines={1} style={{ flex: 1, minWidth: 0 }}>
                    {groupName}
                  </Subhead>
                ) : null}
              </View>

              <View style={styles.metaLine}>
                <Ionicons name="location-outline" size={16} color={colors.textMuted} />
                <View style={styles.metaLineText}>
                  <Caption color={colors.textMuted}>{t.chatsScreen.gameThreadMetaLocation}: </Caption>
                  <Footnote
                    numberOfLines={2}
                    style={{
                      flexShrink: 1,
                      color: locationLine ? colors.textSecondary : colors.textMuted,
                    }}
                  >
                    {locationLine || t.chatsScreen.gameThreadMetaNotSpecified}
                  </Footnote>
                </View>
              </View>
              <View style={styles.metaLine}>
                <Ionicons name="calendar-outline" size={16} color={colors.textMuted} />
                <View style={styles.metaLineText}>
                  <Caption color={colors.textMuted}>{t.chatsScreen.gameThreadMetaWhen}: </Caption>
                  <Footnote
                    numberOfLines={2}
                    style={{
                      flexShrink: 1,
                      color: whenLine ? colors.textSecondary : colors.textMuted,
                    }}
                  >
                    {whenLine || t.chatsScreen.gameThreadMetaNotSpecified}
                  </Footnote>
                </View>
              </View>

              <View style={styles.statsLine}>
                <Footnote color={colors.textMuted}>
                  {playerCount} {t.groups.members}
                  {pot != null ? ` · $${pot} ${t.chatsScreen.pot}` : ""}
                </Footnote>
              </View>

              <View style={styles.actionsRow}>
                <TouchableOpacity
                  style={[
                    styles.actionBtnPrimary,
                    {
                      backgroundColor: colors.trustBlue,
                      minHeight: BUTTON_SIZE.compact.height,
                    },
                  ]}
                  onPress={() => navigation.navigate("GameNight", { gameId })}
                  activeOpacity={0.85}
                >
                  <Ionicons name="game-controller-outline" size={18} color={colors.textPrimary} />
                  <Headline style={{ color: colors.textPrimary }} numberOfLines={1}>
                    {t.chatsScreen.gameThreadOpenGame}
                  </Headline>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.actionBtnOutline,
                    {
                      borderColor: colors.border,
                      backgroundColor: colors.inputBg,
                      minHeight: BUTTON_SIZE.compact.height,
                    },
                  ]}
                  onPress={() =>
                    navigation.navigate("GroupHub", { groupId, groupName: groupName || undefined })
                  }
                  activeOpacity={0.85}
                >
                  <Ionicons name="people-outline" size={18} color={colors.textPrimary} />
                  <Headline numberOfLines={1}>{t.chatsScreen.gameThreadOpenGroup}</Headline>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>

          <View style={[styles.chatSectionOuter, { marginTop: SPACE.sm }]}>
            {/*
              Match Settings → Voice commands sheet: 32px top radii + surface on page bg.
              Outer chrome carries shadow; inner clips list/input to the curve (shadow + overflow:hidden on one view clips iOS shadow).
            */}
            <View
              style={[
                styles.chatSheetChrome,
                {
                  marginHorizontal: LAYOUT.screenPadding,
                  backgroundColor: colors.surface,
                  borderTopLeftRadius: RADIUS.sheet,
                  borderTopRightRadius: RADIUS.sheet,
                },
                Platform.OS === "ios" && { borderCurve: "continuous" as const },
                appleCardShadowResting(isDark),
              ]}
            >
              <View
                style={[
                  styles.chatSheetClip,
                  Platform.OS === "ios" && { borderCurve: "continuous" as const },
                ]}
              >
                <Label style={styles.chatSectionLabel}>{t.chatsScreen.gameThreadSessionTimeline}</Label>
                <GameThreadMessagesPanel
                  gameId={gameId}
                  gameStatus={status}
                  onConnectionChange={setSocketConnected}
                />
              </View>
            </View>
          </View>
        </>
      )}
      {groupId ? (
        <GroupChatSettingsSheet
          visible={showSettings}
          onClose={() => setShowSettings(false)}
          groupId={groupId}
          isAdmin={isAdmin}
        />
      ) : null}
      </KeyboardAvoidingView>
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
  keyboardAvoid: {
    flex: 1,
    zIndex: 1,
    backgroundColor: "transparent",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: LAYOUT.screenPadding,
    paddingBottom: SPACE.sm,
  },
  headerBackPill: {
    minWidth: LAYOUT.touchTarget,
    minHeight: LAYOUT.touchTarget,
    borderRadius: RADIUS.lg,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },
  headerCenter: {
    flex: 1,
    marginHorizontal: SPACE.sm,
    alignItems: "flex-start",
  },
  headerTrailingSpacer: {
    minWidth: LAYOUT.touchTarget,
    minHeight: LAYOUT.touchTarget,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: SPACE.xl,
  },
  retry: {
    marginTop: SPACE.md,
    padding: SPACE.sm,
  },
  contextScroll: {
    maxHeight: LAYOUT.gameThreadContextMaxHeight,
    flexGrow: 0,
  },
  contextScrollInner: {
    paddingHorizontal: LAYOUT.screenPadding,
    paddingTop: SPACE.xs,
    paddingBottom: SPACE.sm,
  },
  sectionLabel: {
    marginBottom: SPACE.xs,
  },
  gameCard: {
    paddingVertical: SPACE.sm,
    paddingHorizontal: LAYOUT.cardPadding,
    borderRadius: RADIUS.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  metaLine: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: SPACE.sm,
    marginTop: SPACE.sm,
  },
  metaLineText: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: SPACE.xs,
  },
  statsLine: {
    marginTop: SPACE.sm,
  },
  actionsRow: {
    flexDirection: "row",
    gap: SPACE.sm,
    marginTop: SPACE.sm,
  },
  actionBtnPrimary: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACE.xs,
    paddingHorizontal: SPACE.sm,
    borderRadius: RADIUS.lg,
    minWidth: 0,
  },
  actionBtnOutline: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACE.xs,
    paddingHorizontal: SPACE.sm,
    borderRadius: RADIUS.lg,
    borderWidth: StyleSheet.hairlineWidth,
    minWidth: 0,
  },
  pillRowInner: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: LAYOUT.elementGap,
  },
  pill: {
    paddingHorizontal: SPACE.sm,
    paddingVertical: SPACE.xs,
    borderRadius: RADIUS.full,
    borderWidth: StyleSheet.hairlineWidth,
  },
  chatSectionOuter: {
    flex: 1,
    minHeight: 0,
  },
  /** Rounded top sheet (same radius as Settings voice modal); shadow lives here. */
  chatSheetChrome: {
    flex: 1,
    minHeight: 0,
  },
  /** Clips messages/composer to the top arc without clipping the shadow on the parent. */
  chatSheetClip: {
    flex: 1,
    minHeight: 0,
    overflow: "hidden",
    borderTopLeftRadius: RADIUS.sheet,
    borderTopRightRadius: RADIUS.sheet,
  },
  chatSectionLabel: {
    paddingHorizontal: SPACE.sm,
    paddingTop: SPACE.xxl,
    paddingBottom: SPACE.xs,
  },
});
