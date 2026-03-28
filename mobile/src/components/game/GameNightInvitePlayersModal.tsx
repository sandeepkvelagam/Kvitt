/**
 * Invite flow aligned with Start Game player selection — group member toggles + user search.
 */
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../../api/client";
import { useTheme } from "../../context/ThemeContext";
import { useLanguage } from "../../context/LanguageContext";
import { PageHeader } from "../ui/PageHeader";
import { Footnote, Headline, Subhead, Caption2 } from "../ui";
import { StartGamePlayerSelection } from "./StartGamePlayerSelection";
import { SPACE, LAYOUT, RADIUS, BUTTON_SIZE, APPLE_TYPO } from "../../styles/tokens";
import { appleCardShadowResting } from "../../styles/appleShadows";

type Props = {
  visible: boolean;
  onClose: () => void;
  gameId: string;
  groupId: string | undefined;
  currentPlayerUserIds: string[];
  currentUserId?: string;
  onInvited: () => Promise<void> | void;
};

export function GameNightInvitePlayersModal({
  visible,
  onClose,
  gameId,
  groupId,
  currentPlayerUserIds,
  currentUserId,
  onInvited,
}: Props) {
  const { isDark, colors } = useTheme();
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();

  const [groupDetail, setGroupDetail] = useState<any | null>(null);
  const [groupLoading, setGroupLoading] = useState(false);
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [playerSearchQuery, setPlayerSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchingPlayers, setSearchingPlayers] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const cardStyle = useMemo(
    () => ({
      backgroundColor: isDark ? "rgba(45, 45, 48, 0.95)" : "rgba(255, 255, 255, 0.98)",
      borderRadius: RADIUS.lg,
      borderWidth: 1,
      borderColor: isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.06)",
      ...appleCardShadowResting(isDark),
    }),
    [isDark]
  );

  useEffect(() => {
    if (!visible) return;
    setSelectedMemberIds([]);
    setPlayerSearchQuery("");
    setSearchResults([]);
    if (!groupId) {
      setGroupDetail(null);
      return;
    }
    let cancelled = false;
    (async () => {
      setGroupLoading(true);
      try {
        const res = await api.get(`/groups/${groupId}`);
        if (!cancelled) setGroupDetail(res.data);
      } catch {
        if (!cancelled) setGroupDetail(null);
      } finally {
        if (!cancelled) setGroupLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [visible, groupId]);

  const members = Array.isArray(groupDetail?.members) ? groupDetail.members : [];
  const invitableMembers = useMemo(
    () => members.filter((m: any) => m?.user_id && !currentPlayerUserIds.includes(m.user_id)),
    [members, currentPlayerUserIds]
  );

  const searchPlayers = useCallback(
    async (query: string) => {
      if (!query || query.length < 2) {
        setSearchResults([]);
        return;
      }
      setSearchingPlayers(true);
      try {
        const res = await api.get(`/users/search?query=${encodeURIComponent(query)}`);
        const rows = res.data || [];
        const filtered = rows.filter(
          (u: any) => !currentPlayerUserIds.includes(u.user_id) && !selectedMemberIds.includes(u.user_id)
        );
        setSearchResults(filtered);
      } catch {
        setSearchResults([]);
      } finally {
        setSearchingPlayers(false);
      }
    },
    [currentPlayerUserIds, selectedMemberIds]
  );

  const inviteUser = useCallback(
    async (userId: string) => {
      await api.post(`/games/${gameId}/invite-player`, { user_id: userId });
    },
    [gameId]
  );

  const handleInviteSelected = useCallback(async () => {
    if (selectedMemberIds.length === 0) {
      Alert.alert(t.game.inviteGameNightTitle, t.game.selectPlayersFirstHint);
      return;
    }
    setSubmitting(true);
    try {
      for (const uid of selectedMemberIds) {
        await inviteUser(uid);
      }
      await onInvited();
      Alert.alert(t.common.success, t.game.invitesSentBatch.replace("{n}", String(selectedMemberIds.length)));
      onClose();
    } catch (e: any) {
      Alert.alert(t.common.error, e?.response?.data?.detail || t.game.startGameFailed);
    } finally {
      setSubmitting(false);
    }
  }, [selectedMemberIds, inviteUser, onInvited, onClose, t]);

  const handleSearchInvite = useCallback(
    async (playerId: string) => {
      setSubmitting(true);
      try {
        await inviteUser(playerId);
        await onInvited();
        Alert.alert(t.common.success, t.game.inviteSentOne);
        setPlayerSearchQuery("");
        setSearchResults([]);
        onClose();
      } catch (e: any) {
        Alert.alert(t.common.error, e?.response?.data?.detail || t.game.startGameFailed);
      } finally {
        setSubmitting(false);
      }
    },
    [inviteUser, onInvited, onClose, t]
  );

  const noGroup = !groupId;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      {...(Platform.OS === "ios" ? ({ presentationStyle: "fullScreen" as const } as const) : {})}
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={[styles.root, { backgroundColor: colors.contentBg, paddingTop: insets.top }]}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <PageHeader
          title={t.game.inviteGameNightTitle}
          subtitle={groupDetail?.name ? `${t.groups.hubTitle}: ${groupDetail.name}` : undefined}
          onClose={onClose}
          paddingHorizontal={LAYOUT.screenPadding}
          titleAlign="left"
          titleVariant="title2"
        />

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={{
            paddingHorizontal: LAYOUT.screenPadding,
            paddingBottom: insets.bottom + BUTTON_SIZE.large.height + SPACE.xl,
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {noGroup && (
            <Footnote style={{ color: colors.textMuted, marginBottom: SPACE.md }}>
              {t.game.inviteNoGroupHint}
            </Footnote>
          )}

          {groupLoading && <ActivityIndicator style={{ marginVertical: SPACE.lg }} color={colors.orange} />}

          {!groupLoading && !noGroup && invitableMembers.length > 0 && (
            <View style={[styles.card, cardStyle]}>
              <StartGamePlayerSelection
                variant="groupsSheet"
                members={invitableMembers}
                currentUserId={currentUserId}
                selectedMemberIds={selectedMemberIds}
                onChangeSelectedIds={setSelectedMemberIds}
                listMaxHeight={260}
              />
            </View>
          )}

          {!groupLoading && !noGroup && invitableMembers.length === 0 && (
            <View style={[styles.card, cardStyle, styles.emptyPad]}>
              <Footnote style={{ color: colors.textSecondary, textAlign: "center" }}>
                {t.game.inviteAllMembersAtTable}
              </Footnote>
            </View>
          )}

          <Footnote style={{ color: colors.textSecondary, fontWeight: "600", marginTop: SPACE.lg, marginBottom: SPACE.sm }}>
            {t.game.inviteSearchPlaceholder}
          </Footnote>
          <TextInput
            style={[
              styles.searchInput,
              {
                backgroundColor: colors.inputBg,
                color: colors.textPrimary,
                borderColor: colors.border,
              },
            ]}
            value={playerSearchQuery}
            onChangeText={(text) => {
              setPlayerSearchQuery(text);
              searchPlayers(text);
            }}
            placeholder={t.game.inviteSearchPlaceholder}
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
          />

          {searchingPlayers && <ActivityIndicator size="small" color={colors.orange} style={{ marginVertical: SPACE.md }} />}

          <View style={{ marginTop: SPACE.sm }}>
            {searchResults.map((player: any) => (
              <Pressable
                key={player.user_id}
                style={({ pressed }) => [
                  styles.searchRow,
                  { backgroundColor: colors.inputBg, borderColor: colors.border, opacity: pressed ? 0.88 : 1 },
                ]}
                onPress={() => handleSearchInvite(player.user_id)}
                disabled={submitting}
              >
                <View style={[styles.avatar, { backgroundColor: colors.surface }]}>
                  <Subhead style={{ color: colors.textSecondary, fontWeight: "600" }}>
                    {(player.name || "?")[0].toUpperCase()}
                  </Subhead>
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Headline numberOfLines={1}>{player.name}</Headline>
                  <Footnote style={{ color: colors.textMuted }} numberOfLines={1}>
                    {player.email}
                  </Footnote>
                </View>
                <Ionicons name="mail-outline" size={20} color={colors.buttonPrimary} />
              </Pressable>
            ))}
          </View>

          {playerSearchQuery.length >= 2 && searchResults.length === 0 && !searchingPlayers && (
            <Footnote style={{ color: colors.textMuted, textAlign: "center", marginTop: SPACE.md }}>
              {t.common.noResults}
            </Footnote>
          )}
        </ScrollView>

        {!noGroup && invitableMembers.length > 0 && (
          <View
            style={[
              styles.footer,
              {
                paddingBottom: Math.max(insets.bottom, 12),
                borderTopColor: colors.border,
                backgroundColor: colors.contentBg,
              },
            ]}
          >
            <Pressable
              style={({ pressed }) => [
                styles.primaryBtn,
                { backgroundColor: colors.buttonPrimary, opacity: submitting || selectedMemberIds.length === 0 ? 0.5 : pressed ? 0.92 : 1 },
              ]}
              onPress={handleInviteSelected}
              disabled={submitting || selectedMemberIds.length === 0}
            >
              {submitting ? (
                <ActivityIndicator color={colors.buttonText} />
              ) : (
                <Headline style={{ color: colors.buttonText }}>
                  {t.game.inviteSelectedCta.replace("{n}", String(selectedMemberIds.length))}
                </Headline>
              )}
            </Pressable>
          </View>
        )}
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { flex: 1 },
  card: { padding: LAYOUT.cardPadding, marginBottom: SPACE.md },
  emptyPad: { paddingVertical: SPACE.xl },
  searchInput: {
    borderWidth: 1,
    borderRadius: RADIUS.lg,
    paddingHorizontal: SPACE.md,
    paddingVertical: SPACE.md,
    fontSize: APPLE_TYPO.body.size,
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.md,
    padding: SPACE.md,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    marginBottom: SPACE.sm,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  footer: {
    paddingHorizontal: LAYOUT.screenPadding,
    paddingTop: SPACE.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  primaryBtn: {
    minHeight: BUTTON_SIZE.large.height,
    borderRadius: RADIUS.xl,
    alignItems: "center",
    justifyContent: "center",
  },
});
