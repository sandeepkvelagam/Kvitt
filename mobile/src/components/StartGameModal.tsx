/**
 * Start Game — same bottom-sheet shell as Groups “Create group” (modalRoot, sheetShell, RADIUS.sheet).
 * Single scroll surface: pick group (search + rows) then StartGameForm; no stack route.
 */
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  StyleSheet,
  Modal,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TextInput,
  ActivityIndicator,
  useWindowDimensions,
  TouchableOpacity,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../api/client";
import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import { useStartGameModal } from "../context/StartGameModalContext";
import { navigationRef } from "../navigation/RootNavigator";
import { Title2, Title3, Headline, Subhead, Footnote, GlassButton } from "./ui";
import { StartGameForm, type StartGameFormSmartDefaults } from "./game/StartGameForm";
import { SPACE, RADIUS, APPLE_TYPO } from "../styles/tokens";
import { appleCardShadowResting, appleTileShadow } from "../styles/appleShadows";

type GroupItem = { group_id: string; name: string; member_count?: number; role?: string };

export function StartGameModal() {
  const { isDark, colors } = useTheme();
  const { user } = useAuth();
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const { visible, openOptions, closeStartGame } = useStartGameModal();

  const [formKey, setFormKey] = useState(0);
  const [groupSelectionLocked, setGroupSelectionLocked] = useState(false);

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

  const sheetMaxHeight = Math.round(windowHeight * 0.88);
  const scrollBottomPad = Math.max(insets.bottom, SPACE.lg) + SPACE.md;

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
      } catch (e: any) {
        setDetailError(e?.response?.data?.detail || e?.message || t.game.startGameFailed);
      } finally {
        setDetailLoading(false);
      }
    },
    [t.game.startGameFailed]
  );

  useEffect(() => {
    if (!visible) {
      setSearchQuery("");
      setListError(null);
      setDetailError(null);
      return;
    }

    setFormKey((k) => k + 1);
    const gid = openOptions?.groupId;
    const gname = openOptions?.groupName ?? "";
    if (gid) {
      setGroupSelectionLocked(true);
      setSelectedGroupId(gid);
      setSelectedGroupName(gname);
      loadGroupDetail(gid);
    } else {
      setGroupSelectionLocked(false);
      setSelectedGroupId(null);
      setSelectedGroupName("");
      setGroupDetail(null);
      setSmartDefaults(null);
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
    setSelectedGroupId(null);
    setSelectedGroupName("");
    setGroupDetail(null);
    setSmartDefaults(null);
    setDetailError(null);
    if (groups.length === 0) loadGroups();
  };

  const goGameNight = (gameId: string) => {
    closeStartGame();
    if (navigationRef.isReady()) {
      navigationRef.navigate("GameNight", { gameId });
    }
  };

  const goGroupHub = () => {
    if (!selectedGroupId) return;
    closeStartGame();
    if (navigationRef.isReady()) {
      navigationRef.navigate("GroupHub", {
        groupId: selectedGroupId,
        groupName: groupDetail?.name || selectedGroupName,
      });
    }
  };

  const goMainGroups = () => {
    closeStartGame();
    if (navigationRef.isReady()) {
      navigationRef.navigate("MainTabs", { screen: "Groups" });
    }
  };

  const showPicker = !groupSelectionLocked && !selectedGroupId;
  const showForm = !!selectedGroupId && groupDetail && !detailLoading && !detailError;

  const sheetScrollContent = useMemo(
    () => [styles.sheetScrollContent, { paddingBottom: scrollBottomPad }],
    [scrollBottomPad]
  );

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={closeStartGame}>
      <View style={styles.modalRoot}>
        <Pressable style={styles.modalBackdrop} onPress={closeStartGame} />
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.modalKeyboardWrap} pointerEvents="box-none">
          <Pressable
            style={[
              styles.sheetShell,
              {
                backgroundColor: colors.surface,
                borderTopLeftRadius: RADIUS.sheet,
                borderTopRightRadius: RADIUS.sheet,
                maxHeight: sheetMaxHeight,
                ...appleTileShadow(isDark),
              },
              Platform.OS === "ios" && { borderCurve: "continuous" as const },
            ]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={[styles.sheetHandle, { backgroundColor: colors.border }]} />
            <Title2 style={styles.sheetTitle}>{t.game.startGameScreenTitle}</Title2>

            <ScrollView
              style={styles.sheetScroll}
              contentContainerStyle={sheetScrollContent}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
              showsVerticalScrollIndicator
              nestedScrollEnabled
            >
              {showPicker && (
                <View style={styles.sheetFieldGroup}>
                  <Footnote style={[styles.sheetFieldLabel, { color: colors.textSecondary }]}>{t.game.chooseGroup}</Footnote>
                  <TextInput
                    style={[
                      styles.sheetInput,
                      { backgroundColor: colors.inputBg, color: colors.textPrimary, borderColor: colors.border },
                    ]}
                    placeholder={t.game.searchGroupsPlaceholder}
                    placeholderTextColor={colors.textMuted}
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                  />
                  {listLoading && <ActivityIndicator style={{ marginVertical: SPACE.md }} color={colors.textSecondary} />}
                  {listError && <Footnote style={{ color: colors.danger, marginBottom: SPACE.sm }}>{listError}</Footnote>}
                  {!listLoading && !listError && filteredGroups.length === 0 && (
                    <View style={[cardStyle, styles.emptyCard]}>
                      <Footnote style={{ color: colors.textSecondary, textAlign: "center" }}>{t.game.noGroupsForStart}</Footnote>
                      <GlassButton variant="primary" size="large" fullWidth style={{ marginTop: SPACE.lg }} onPress={goMainGroups}>
                        {t.game.goToGroups}
                      </GlassButton>
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
                        <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
                      </TouchableOpacity>
                    ))}
                </View>
              )}

              {selectedGroupId && !showPicker && (
                <>
                  <View style={[styles.selectedRow, cardStyle]}>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Footnote style={{ color: colors.textMuted }}>{t.groups.hubTitle}</Footnote>
                      <Headline numberOfLines={1} style={{ marginTop: 2 }}>
                        {groupDetail?.name || selectedGroupName || "…"}
                      </Headline>
                    </View>
                    {!groupSelectionLocked && (
                      <TouchableOpacity onPress={onChangeGroup} hitSlop={12} activeOpacity={0.7}>
                        <Subhead style={{ color: colors.buttonPrimary, fontWeight: "600" }}>{t.game.changeGroup}</Subhead>
                      </TouchableOpacity>
                    )}
                  </View>
                  <TouchableOpacity style={styles.inviteRow} onPress={goGroupHub} activeOpacity={0.75}>
                    <Ionicons name="person-add-outline" size={18} color={colors.buttonPrimary} />
                    <Subhead style={{ color: colors.buttonPrimary, fontWeight: "600" }}>{t.game.invitePlayersCta}</Subhead>
                  </TouchableOpacity>
                </>
              )}

              {detailLoading && (
                <ActivityIndicator style={{ marginVertical: SPACE.xl }} color={colors.textSecondary} size="large" />
              )}
              {detailError && (
                <View style={{ marginTop: SPACE.md }}>
                  <Footnote style={{ color: colors.danger }}>{detailError}</Footnote>
                  <GlassButton
                    variant="secondary"
                    size="large"
                    style={{ marginTop: SPACE.md }}
                    onPress={() => selectedGroupId && loadGroupDetail(selectedGroupId)}
                  >
                    {t.common.retry}
                  </GlassButton>
                </View>
              )}

              {showForm && (
                <StartGameForm
                  key={formKey}
                  variant="groupsSheet"
                  groupId={selectedGroupId!}
                  members={groupDetail?.members || []}
                  currentUserId={user?.user_id}
                  smartDefaults={smartDefaults}
                  onSuccess={goGameNight}
                  onCancel={closeStartGame}
                />
              )}
            </ScrollView>
          </Pressable>
        </KeyboardAvoidingView>
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
  },
  sheetScroll: { flex: 1, minHeight: 0 },
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
  sheetFieldGroup: { gap: SPACE.sm, marginBottom: SPACE.md },
  sheetFieldLabel: { marginBottom: 2 },
  sheetInput: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: RADIUS.lg,
    paddingHorizontal: SPACE.md,
    paddingVertical: Platform.OS === "ios" ? SPACE.md : SPACE.sm,
    fontSize: APPLE_TYPO.body.size,
    lineHeight: 22,
    marginBottom: SPACE.sm,
  },
  emptyCard: { padding: SPACE.xl, marginTop: SPACE.xs },
  groupRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: SPACE.md,
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
    padding: SPACE.md,
    marginBottom: SPACE.sm,
    gap: SPACE.md,
  },
  inviteRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.sm,
    marginBottom: SPACE.lg,
    paddingVertical: SPACE.xs,
  },
});
