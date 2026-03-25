import React, { useCallback, useEffect, useMemo, useState } from "react";
import { View, StyleSheet, Pressable, ScrollView, TextInput, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../../api/client";
import { useTheme } from "../../context/ThemeContext";
import { useLanguage } from "../../context/LanguageContext";
import { Title2, Headline, Subhead, Footnote, Caption2, GlassButton, Label } from "../ui";
import { SPACE, LAYOUT, RADIUS, APPLE_TYPO } from "../../styles/tokens";

const BUY_IN_OPTIONS = [5, 10, 20, 50, 100];
const CHIPS_OPTIONS = [10, 20, 50, 100];

export type StartGameFormSmartDefaults = {
  games_analyzed?: number;
  buy_in_amount?: number;
  chips_per_buy_in?: number;
} | null;

type HubMember = {
  user_id: string;
  role?: string;
  user?: { name?: string; email?: string };
  name?: string;
  email?: string;
};

export type StartGameFormProps = {
  groupId: string;
  members: HubMember[];
  currentUserId?: string;
  smartDefaults?: StartGameFormSmartDefaults;
  onSuccess: (gameId: string) => void;
  onCancel?: () => void;
  /** hubSheet: Group Hub inner sheet (title “New Game”). groupsSheet: global modal (title is on shell). */
  variant: "hubSheet" | "groupsSheet";
};

export function StartGameForm({
  groupId,
  members,
  currentUserId,
  smartDefaults = null,
  onSuccess,
  onCancel,
  variant,
}: StartGameFormProps) {
  const { isDark, colors } = useTheme();
  const { t } = useLanguage();

  const [gameTitle, setGameTitle] = useState("");
  const [buyInAmount, setBuyInAmount] = useState(20);
  const [chipsPerBuyIn, setChipsPerBuyIn] = useState(20);
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

  useEffect(() => {
    if (smartDefaults && smartDefaults.games_analyzed && smartDefaults.games_analyzed > 0) {
      setBuyInAmount(smartDefaults.buy_in_amount ?? 20);
      setChipsPerBuyIn(smartDefaults.chips_per_buy_in ?? 20);
    }
  }, [smartDefaults?.games_analyzed, smartDefaults?.buy_in_amount, smartDefaults?.chips_per_buy_in]);

  const otherMembers = useMemo(
    () => members.filter((m) => m.user_id && m.user_id !== currentUserId),
    [members, currentUserId]
  );

  const chipValue = buyInAmount / chipsPerBuyIn;
  const isGroupsSheet = variant === "groupsSheet";

  const toggleMember = useCallback((id: string) => {
    setSelectedMemberIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }, []);

  const selectAllMembers = useCallback(() => {
    setSelectedMemberIds(otherMembers.map((m) => m.user_id));
  }, [otherMembers]);

  const deselectAllMembers = useCallback(() => {
    setSelectedMemberIds([]);
  }, []);

  const handleSubmit = async () => {
    setStarting(true);
    setStartError(null);
    try {
      const res = await api.post("/games", {
        group_id: groupId,
        title: gameTitle.trim() || undefined,
        buy_in_amount: buyInAmount,
        chips_per_buy_in: chipsPerBuyIn,
        initial_players: selectedMemberIds.length > 0 ? selectedMemberIds : undefined,
      });
      setGameTitle("");
      setSelectedMemberIds([]);
      if (res.data?.game_id) {
        onSuccess(res.data.game_id);
      }
    } catch (e: any) {
      setStartError(e?.response?.data?.detail || e?.message || t.game.startGameFailed);
    } finally {
      setStarting(false);
    }
  };

  const memberListMaxHeight = variant === "hubSheet" ? 200 : 220;

  const inputStyle = [
    isGroupsSheet ? styles.inputGroups : styles.inputHub,
    { backgroundColor: colors.inputBg, color: colors.textPrimary, borderColor: colors.border },
  ];

  const previewTintBg = isDark ? `${colors.buttonPrimary}18` : `${colors.buttonPrimary}14`;
  const previewTintBorder = isDark ? `${colors.buttonPrimary}44` : `${colors.buttonPrimary}33`;

  return (
    <View>
      {variant === "hubSheet" && <Title2 style={styles.sheetTitle}>{t.game.newGameSheetTitle}</Title2>}
      {smartDefaults && smartDefaults.games_analyzed && smartDefaults.games_analyzed > 0 && (
        <Footnote style={{ textAlign: "center", marginBottom: SPACE.md, color: colors.textMuted }}>
          {t.groups.smartDefaultsHint.replace("{n}", String(smartDefaults.games_analyzed))}
        </Footnote>
      )}

      {startError && (
        <View style={[styles.sheetError, { backgroundColor: isDark ? "rgba(255, 69, 58, 0.15)" : "rgba(255, 69, 58, 0.1)" }]}>
          <Footnote style={{ color: colors.danger }}>{startError}</Footnote>
        </View>
      )}

      {isGroupsSheet && (
        <Label style={{ marginBottom: SPACE.sm, marginTop: SPACE.xs }}>
          {t.game.gameTitleSection}
        </Label>
      )}
      <TextInput
        style={inputStyle}
        placeholder={t.game.gameTitlePlaceholder}
        placeholderTextColor={colors.textMuted}
        value={gameTitle}
        onChangeText={setGameTitle}
      />
      <Footnote style={{ color: colors.textMuted, marginTop: -SPACE.xs, marginBottom: SPACE.md }}>
        {t.game.gameTitleRandomHint}
      </Footnote>

      <View style={[styles.settingsBlock, { borderTopColor: colors.border }]}>
        {isGroupsSheet ? (
          <Label style={{ marginBottom: SPACE.md }}>{t.game.gameSettingsSection}</Label>
        ) : null}
        <Footnote style={[styles.fieldLabel, { color: colors.textSecondary }]}>{t.game.buyInAmountLabel}</Footnote>
        <View style={styles.optionRow}>
          {BUY_IN_OPTIONS.map((amount) => (
            <Pressable
              key={amount}
              style={({ pressed }) => [
                styles.optionBtn,
                {
                  borderColor: buyInAmount === amount ? colors.buttonPrimary : colors.border,
                  backgroundColor: buyInAmount === amount ? colors.buttonPrimary : "transparent",
                  opacity: pressed ? 0.88 : 1,
                },
              ]}
              onPress={() => setBuyInAmount(amount)}
            >
              <Headline style={{ color: buyInAmount === amount ? colors.buttonText : colors.textPrimary }}>${amount}</Headline>
            </Pressable>
          ))}
        </View>

        <Footnote style={[styles.fieldLabel, { color: colors.textSecondary, marginTop: SPACE.md }]}>
          {t.game.chipsPerBuyInLabel}
        </Footnote>
        <View style={styles.optionRow}>
          {CHIPS_OPTIONS.map((chips) => (
            <Pressable
              key={chips}
              style={({ pressed }) => [
                styles.optionBtn,
                {
                  borderColor: chipsPerBuyIn === chips ? colors.buttonPrimary : colors.border,
                  backgroundColor: chipsPerBuyIn === chips ? colors.buttonPrimary : "transparent",
                  opacity: pressed ? 0.88 : 1,
                },
              ]}
              onPress={() => setChipsPerBuyIn(chips)}
            >
              <Headline style={{ color: chipsPerBuyIn === chips ? colors.buttonText : colors.textPrimary }}>{chips}</Headline>
            </Pressable>
          ))}
        </View>

        <View
          style={[
            styles.previewCard,
            {
              backgroundColor: previewTintBg,
              borderColor: previewTintBorder,
            },
          ]}
        >
          <Footnote style={{ color: colors.textSecondary }}>{t.game.eachChipEquals}</Footnote>
          <Title2 style={{ color: colors.buttonPrimary, marginTop: SPACE.xs }}>${chipValue.toFixed(2)}</Title2>
        </View>
      </View>

      {otherMembers.length > 0 && (
        <View style={[styles.playersSection, { borderTopColor: colors.border }]}>
          {isGroupsSheet ? (
            <View style={styles.playersTitleRow}>
              <Label style={{ flex: 1 }}>{t.game.addPlayersSection}</Label>
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
            style={{ maxHeight: memberListMaxHeight }}
            nestedScrollEnabled
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator
          >
            {otherMembers.map((m) => {
              const name = m?.user?.name || m?.name || m?.user?.email || m?.email || "—";
              const selected = selectedMemberIds.includes(m.user_id);
              return (
                <Pressable
                  key={m.user_id}
                  style={({ pressed }) => [
                    styles.memberPickRow,
                    { borderBottomColor: colors.border, opacity: pressed ? 0.88 : 1 },
                  ]}
                  onPress={() => toggleMember(m.user_id)}
                >
                  <Ionicons
                    name={selected ? "checkmark-circle" : "ellipse-outline"}
                    size={22}
                    color={selected ? colors.buttonPrimary : colors.textMuted}
                  />
                  <View style={[styles.memberAvatar, { backgroundColor: colors.inputBg }]}>
                    <Subhead style={{ color: colors.textSecondary, fontWeight: "600" }}>{name[0]?.toUpperCase() ?? "?"}</Subhead>
                  </View>
                  <Headline numberOfLines={1} style={{ flex: 1 }}>
                    {name}
                  </Headline>
                </Pressable>
              );
            })}
          </ScrollView>
          <View style={styles.dayChipsRow}>
            <Pressable
              style={({ pressed }) => [
                styles.dayChip,
                { borderColor: colors.buttonPrimary, backgroundColor: "transparent", opacity: pressed ? 0.85 : 1 },
              ]}
              onPress={selectAllMembers}
            >
              <Caption2 style={{ color: colors.buttonPrimary }}>{t.game.selectAllPlayers}</Caption2>
            </Pressable>
            <Pressable
              style={({ pressed }) => [
                styles.dayChip,
                { borderColor: colors.border, backgroundColor: "transparent", opacity: pressed ? 0.85 : 1 },
              ]}
              onPress={deselectAllMembers}
            >
              <Caption2 style={{ color: colors.textPrimary }}>{t.game.deselectAllPlayers}</Caption2>
            </Pressable>
          </View>
          {selectedMemberIds.length > 0 && (
            <Footnote style={{ color: colors.textMuted, marginTop: SPACE.sm }}>
              {t.game.initialPlayersBuyInHint.replace("{buyIn}", String(buyInAmount)).replace("{chips}", String(chipsPerBuyIn))}
            </Footnote>
          )}
        </View>
      )}

      <View style={styles.sheetActions}>
        {onCancel && (
          <GlassButton variant="secondary" size="large" style={styles.sheetActionBtn} onPress={onCancel}>
            {t.common.cancel}
          </GlassButton>
        )}
        <GlassButton
          variant="primary"
          size="large"
          style={[styles.sheetActionBtn, !onCancel && styles.sheetActionBtnSingle]}
          loading={starting}
          onPress={handleSubmit}
        >
          {t.game.startGame}
        </GlassButton>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sheetTitle: {
    textAlign: "center",
    marginBottom: SPACE.lg,
  },
  sheetError: {
    padding: SPACE.md,
    borderRadius: RADIUS.md,
    marginBottom: SPACE.md,
  },
  inputHub: {
    borderWidth: 1,
    borderRadius: RADIUS.lg,
    padding: SPACE.md,
    fontSize: APPLE_TYPO.body.size,
    marginBottom: SPACE.sm,
  },
  inputGroups: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: RADIUS.lg,
    paddingHorizontal: SPACE.md,
    paddingVertical: Platform.OS === "ios" ? SPACE.md : SPACE.sm,
    fontSize: APPLE_TYPO.body.size,
    lineHeight: 22,
    marginBottom: SPACE.sm,
  },
  settingsBlock: {
    paddingTop: SPACE.lg,
    marginTop: SPACE.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  fieldLabel: {
    marginBottom: SPACE.sm,
  },
  optionRow: {
    flexDirection: "row",
    gap: SPACE.sm,
    marginBottom: SPACE.md,
  },
  optionBtn: {
    flex: 1,
    minHeight: LAYOUT.touchTarget,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  previewCard: {
    borderRadius: RADIUS.lg,
    padding: SPACE.lg,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    marginTop: SPACE.md,
  },
  playersSection: {
    marginTop: SPACE.lg,
    paddingTop: SPACE.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  playersTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: SPACE.sm,
    gap: SPACE.sm,
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
    paddingVertical: SPACE.sm,
    paddingHorizontal: SPACE.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  memberAvatar: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  dayChipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACE.xs,
    marginTop: SPACE.md,
  },
  dayChip: {
    paddingVertical: SPACE.sm,
    paddingHorizontal: SPACE.md,
    borderRadius: RADIUS.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  sheetActions: {
    flexDirection: "row",
    gap: SPACE.md,
    marginTop: SPACE.lg,
  },
  sheetActionBtn: {
    flex: 1,
  },
  sheetActionBtnSingle: {
    flex: 1,
    minWidth: "100%",
  },
});
