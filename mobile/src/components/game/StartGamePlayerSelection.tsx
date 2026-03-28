import React, { useCallback, useMemo } from "react";
import { View, StyleSheet, Pressable, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../context/ThemeContext";
import { useLanguage } from "../../context/LanguageContext";
import { Headline, Subhead, Footnote, Caption2 } from "../ui";
import { SPACE, LAYOUT, RADIUS, hitSlopExpandToMinSize } from "../../styles/tokens";
import { memberAvatarBackground } from "../../utils/memberAvatarTints";

export type StartGamePlayerMember = {
  user_id: string;
  role?: string;
  user?: { name?: string; email?: string };
  name?: string;
  email?: string;
};

type Props = {
  members: StartGamePlayerMember[];
  currentUserId?: string;
  selectedMemberIds: string[];
  onChangeSelectedIds: (ids: string[]) => void;
  /** Default 220 for modal step; hub uses 200 */
  listMaxHeight?: number;
  /** groupsSheet: Label + count row; hubSheet: Footnote header */
  variant: "hubSheet" | "groupsSheet";
};

export function StartGamePlayerSelection({
  members,
  currentUserId,
  selectedMemberIds,
  onChangeSelectedIds,
  listMaxHeight = 220,
  variant,
}: Props) {
  const { colors, isDark } = useTheme();
  const { t } = useLanguage();

  const otherMembers = useMemo(
    () => members.filter((m) => m.user_id && m.user_id !== currentUserId),
    [members, currentUserId]
  );

  const toggleMember = useCallback(
    (id: string) => {
      onChangeSelectedIds(
        selectedMemberIds.includes(id)
          ? selectedMemberIds.filter((x) => x !== id)
          : [...selectedMemberIds, id]
      );
    },
    [selectedMemberIds, onChangeSelectedIds]
  );

  const selectAllMembers = useCallback(() => {
    onChangeSelectedIds(otherMembers.map((m) => m.user_id));
  }, [otherMembers, onChangeSelectedIds]);

  const deselectAllMembers = useCallback(() => {
    onChangeSelectedIds([]);
  }, [onChangeSelectedIds]);

  if (otherMembers.length === 0) return null;

  const isGroupsSheet = variant === "groupsSheet";

  return (
    <View
      style={[
        isGroupsSheet ? styles.playersSectionFlat : styles.playersSection,
        !isGroupsSheet && { borderTopColor: colors.border },
      ]}
    >
      {isGroupsSheet ? (
        <View style={styles.playersTitleRow}>
          <Headline style={styles.playersSectionTitle}>{t.game.addPlayersSection}</Headline>
          <Caption2 style={{ color: colors.textMuted, fontVariant: ["tabular-nums"] }}>
            {t.game.playersSelectedOfTotal
              .replace("{selected}", String(selectedMemberIds.length))
              .replace("{total}", String(otherMembers.length))}
          </Caption2>
        </View>
      ) : (
        <View style={styles.playersHeaderRow}>
          <Footnote style={{ color: colors.textSecondary, fontWeight: "600" }}>{t.game.addPlayersSection}</Footnote>
          <Caption2 style={{ color: colors.textMuted, fontVariant: ["tabular-nums"] }}>
            {t.game.playersSelectedOfTotal
              .replace("{selected}", String(selectedMemberIds.length))
              .replace("{total}", String(otherMembers.length))}
          </Caption2>
        </View>
      )}
      <ScrollView
        style={{ maxHeight: listMaxHeight }}
        nestedScrollEnabled
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator
      >
        {otherMembers.map((m, index) => {
          const name = m?.user?.name || m?.name || m?.user?.email || m?.email || "—";
          const selected = selectedMemberIds.includes(m.user_id);
          const bg = memberAvatarBackground(index, isDark);
          return (
            <Pressable
              key={m.user_id}
              style={({ pressed }) => [
                styles.memberPickRow,
                { borderBottomColor: colors.border, opacity: pressed ? 0.88 : 1 },
              ]}
              onPress={() => toggleMember(m.user_id)}
            >
              <View style={[styles.memberAvatar, { backgroundColor: bg }]}>
                <Subhead style={{ color: colors.textPrimary, fontWeight: "600" }}>{name[0]?.toUpperCase() ?? "?"}</Subhead>
              </View>
              <View style={styles.memberTextCol}>
                <Headline numberOfLines={1}>{name}</Headline>
              </View>
              <Ionicons
                name={selected ? "checkmark-circle" : "ellipse-outline"}
                size={24}
                color={selected ? colors.buttonPrimary : colors.textMuted}
              />
            </Pressable>
          );
        })}
      </ScrollView>
      <View style={styles.bulkActionsRow}>
        <Pressable
          onPress={selectAllMembers}
          hitSlop={hitSlopExpandToMinSize(44)}
          style={({ pressed }) => [styles.textActionHit, { opacity: pressed ? 0.65 : 1 }]}
          accessibilityRole="button"
          accessibilityLabel={t.game.selectAllPlayers}
        >
          <Subhead style={{ color: colors.buttonPrimary, fontWeight: "600" }}>{t.game.selectAllPlayers}</Subhead>
        </Pressable>
        <Pressable
          onPress={deselectAllMembers}
          hitSlop={hitSlopExpandToMinSize(44)}
          style={({ pressed }) => [styles.textActionHit, { opacity: pressed ? 0.65 : 1 }]}
          accessibilityRole="button"
          accessibilityLabel={t.game.deselectAllPlayers}
        >
          <Subhead style={{ color: colors.textSecondary, fontWeight: "600" }}>{t.game.deselectAllPlayers}</Subhead>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  playersSection: {
    marginTop: SPACE.lg,
    paddingTop: SPACE.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  /** Wrapped in card on Start Game modal — no extra top rule */
  playersSectionFlat: {
    marginTop: 0,
    paddingTop: 0,
  },
  playersTitleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: SPACE.md,
    gap: SPACE.md,
  },
  playersSectionTitle: {
    flex: 1,
    minWidth: 0,
    paddingRight: SPACE.sm,
  },
  playersHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: SPACE.sm,
    gap: SPACE.sm,
  },
  memberPickRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.md,
    minHeight: LAYOUT.touchTarget,
    paddingVertical: SPACE.md,
    paddingHorizontal: 0,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  memberTextCol: {
    flex: 1,
    minWidth: 0,
    justifyContent: "center",
  },
  memberAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  bulkActionsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: SPACE.lg,
    marginTop: SPACE.md,
    paddingVertical: SPACE.xs,
  },
  textActionHit: {
    minHeight: LAYOUT.touchTarget,
    justifyContent: "center",
    paddingHorizontal: SPACE.sm,
  },
});
