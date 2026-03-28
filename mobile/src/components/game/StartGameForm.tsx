import React, { useEffect, useState } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  TextInput,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from "react-native";
import { api } from "../../api/client";
import { useTheme } from "../../context/ThemeContext";
import { useLanguage } from "../../context/LanguageContext";
import { Title2, Headline, Footnote, Label } from "../ui";
import { SPACE, LAYOUT, RADIUS, APPLE_TYPO, BUTTON_SIZE } from "../../styles/tokens";
import { StartGamePlayerSelection, type StartGamePlayerMember } from "./StartGamePlayerSelection";

const BUY_IN_OPTIONS = [5, 10, 20, 50, 100];
const CHIPS_OPTIONS = [10, 20, 50, 100];

export type StartGameFormSmartDefaults = {
  games_analyzed?: number;
  buy_in_amount?: number;
  chips_per_buy_in?: number;
} | null;

export type HubMember = StartGamePlayerMember;

export type StartGameFormProps = {
  groupId: string;
  members: HubMember[];
  currentUserId?: string;
  smartDefaults?: StartGameFormSmartDefaults;
  onSuccess: (gameId: string) => void;
  onCancel?: () => void;
  /** hubSheet: Group Hub inner sheet (title “New Game”). groupsSheet: global modal (title is on shell). */
  variant: "hubSheet" | "groupsSheet";
  /** When true (modal step 3), player checklist is omitted; submit uses `initialSelectedMemberIds`. */
  omitPlayerSelection?: boolean;
  initialSelectedMemberIds?: string[];
};

export function StartGameForm({
  groupId,
  members,
  currentUserId,
  smartDefaults = null,
  onSuccess,
  onCancel,
  variant,
  omitPlayerSelection = false,
  initialSelectedMemberIds = [],
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

  const chipValue = buyInAmount / chipsPerBuyIn;
  const isGroupsSheet = variant === "groupsSheet";

  const handleSubmit = async () => {
    setStarting(true);
    setStartError(null);
    const playersForApi = omitPlayerSelection ? initialSelectedMemberIds : selectedMemberIds;
    try {
      const res = await api.post("/games", {
        group_id: groupId,
        title: gameTitle.trim() || undefined,
        buy_in_amount: buyInAmount,
        chips_per_buy_in: chipsPerBuyIn,
        initial_players: playersForApi.length > 0 ? playersForApi : undefined,
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

      {!omitPlayerSelection &&
        members.some((m) => m.user_id && m.user_id !== currentUserId) && (
        <>
          <StartGamePlayerSelection
            members={members}
            currentUserId={currentUserId}
            selectedMemberIds={selectedMemberIds}
            onChangeSelectedIds={setSelectedMemberIds}
            listMaxHeight={memberListMaxHeight}
            variant={variant}
          />
          {selectedMemberIds.length > 0 && (
            <Footnote style={{ color: colors.textMuted, marginTop: SPACE.sm }}>
              {t.game.initialPlayersBuyInHint.replace("{buyIn}", String(buyInAmount)).replace("{chips}", String(chipsPerBuyIn))}
            </Footnote>
          )}
        </>
      )}

      <View style={styles.sheetActions}>
        {onCancel && (
          <TouchableOpacity
            style={[
              styles.sheetActionBtn,
              styles.secondaryCtaOutline,
              { borderColor: colors.border },
            ]}
            onPress={onCancel}
            activeOpacity={0.88}
            accessibilityRole="button"
          >
            <Text style={[styles.ctaLabel, { color: colors.textPrimary }]}>{t.common.cancel}</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[
            styles.sheetActionBtn,
            styles.primaryCtaFill,
            { backgroundColor: colors.buttonPrimary },
            !onCancel && styles.sheetActionBtnSingle,
            starting && styles.ctaDisabled,
          ]}
          onPress={handleSubmit}
          disabled={starting}
          activeOpacity={0.88}
          accessibilityRole="button"
        >
          {starting ? (
            <ActivityIndicator size="small" color={colors.buttonText} />
          ) : (
            <Text style={[styles.ctaLabel, { color: colors.buttonText }]}>{t.game.startGame}</Text>
          )}
        </TouchableOpacity>
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
  primaryCtaFill: {
    minHeight: BUTTON_SIZE.large.height,
    borderRadius: RADIUS.xl,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: SPACE.md,
  },
  secondaryCtaOutline: {
    minHeight: BUTTON_SIZE.large.height,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: SPACE.md,
    backgroundColor: "transparent",
  },
  ctaLabel: {
    fontSize: APPLE_TYPO.body.size,
    fontWeight: "600",
  },
  ctaDisabled: {
    opacity: 0.6,
  },
});
