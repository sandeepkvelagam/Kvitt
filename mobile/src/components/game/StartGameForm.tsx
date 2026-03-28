import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useState } from "react";
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
import { Title2, Headline, Footnote } from "../ui";
import { SPACE, LAYOUT, RADIUS, APPLE_TYPO, BUTTON_SIZE } from "../../styles/tokens";
import { appleCardShadowResting } from "../../styles/appleShadows";
import { StartGamePlayerSelection, type StartGamePlayerMember } from "./StartGamePlayerSelection";

const BUY_IN_OPTIONS = [5, 10, 20, 50, 100];
const CHIPS_OPTIONS = [10, 20, 50, 100];

export type StartGameFormSmartDefaults = {
  games_analyzed?: number;
  buy_in_amount?: number;
  chips_per_buy_in?: number;
} | null;

export type HubMember = StartGamePlayerMember;

export type StartGameFormHandle = {
  submit: () => void;
};

/** Parent-owned game settings draft — persists when navigating away from the form (e.g. Start Game modal steps). */
export type GameSettingsDraft = {
  gameTitle: string;
  buyInAmount: number;
  chipsPerBuyIn: number;
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
  /** When true (modal step 3), player checklist is omitted; submit uses `initialSelectedMemberIds`. */
  omitPlayerSelection?: boolean;
  initialSelectedMemberIds?: string[];
  /** When true, footer actions are omitted (parent provides floating CTA). */
  hideFooter?: boolean;
  onSubmittingChange?: (busy: boolean) => void;
  /** With `onDraftChange`, parent owns title / buy-in / chips (survives modal step changes). */
  draft?: GameSettingsDraft;
  onDraftChange?: (d: GameSettingsDraft) => void;
};

export const StartGameForm = forwardRef<StartGameFormHandle, StartGameFormProps>(function StartGameForm(
  {
    groupId,
    members,
    currentUserId,
    smartDefaults = null,
    onSuccess,
    onCancel,
    variant,
    omitPlayerSelection = false,
    initialSelectedMemberIds = [],
    hideFooter = false,
    onSubmittingChange,
    draft,
    onDraftChange,
  },
  ref
) {
  const { isDark, colors } = useTheme();
  const { t } = useLanguage();

  const controlled = draft != null && onDraftChange != null;

  const [internalTitle, setInternalTitle] = useState("");
  const [internalBuyIn, setInternalBuyIn] = useState(20);
  const [internalChips, setInternalChips] = useState(20);
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

  const gameTitle = controlled ? draft.gameTitle : internalTitle;
  const buyInAmount = controlled ? draft.buyInAmount : internalBuyIn;
  const chipsPerBuyIn = controlled ? draft.chipsPerBuyIn : internalChips;

  const setGameTitle = (v: string) => {
    if (controlled && draft && onDraftChange) {
      onDraftChange({ ...draft, gameTitle: v });
    } else {
      setInternalTitle(v);
    }
  };
  const setBuyInAmount = (v: number) => {
    if (controlled && draft && onDraftChange) {
      onDraftChange({ ...draft, buyInAmount: v });
    } else {
      setInternalBuyIn(v);
    }
  };
  const setChipsPerBuyIn = (v: number) => {
    if (controlled && draft && onDraftChange) {
      onDraftChange({ ...draft, chipsPerBuyIn: v });
    } else {
      setInternalChips(v);
    }
  };

  useEffect(() => {
    if (controlled) return;
    if (smartDefaults && smartDefaults.games_analyzed && smartDefaults.games_analyzed > 0) {
      setInternalBuyIn(smartDefaults.buy_in_amount ?? 20);
      setInternalChips(smartDefaults.chips_per_buy_in ?? 20);
    }
  }, [controlled, smartDefaults?.games_analyzed, smartDefaults?.buy_in_amount, smartDefaults?.chips_per_buy_in]);

  useEffect(() => {
    onSubmittingChange?.(starting);
  }, [starting, onSubmittingChange]);

  const chipValue = buyInAmount / chipsPerBuyIn;
  const isGroupsSheet = variant === "groupsSheet";

  const elevatedCard = useMemo(
    () => ({
      backgroundColor: isDark ? "rgba(45, 45, 48, 0.9)" : "rgba(255, 255, 255, 0.95)",
      borderRadius: RADIUS.lg,
      borderWidth: 1,
      borderColor: isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.06)",
      ...appleCardShadowResting(isDark),
    }),
    [isDark]
  );

  const handleSubmit = useCallback(async () => {
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
  }, [
    groupId,
    omitPlayerSelection,
    initialSelectedMemberIds,
    selectedMemberIds,
    gameTitle,
    buyInAmount,
    chipsPerBuyIn,
    onSuccess,
    t.game.startGameFailed,
  ]);

  useImperativeHandle(
    ref,
    () => ({
      submit: () => {
        void handleSubmit();
      },
    }),
    [handleSubmit]
  );

  const memberListMaxHeight = variant === "hubSheet" ? 200 : 220;

  const inputStyle = [
    isGroupsSheet ? styles.inputGroups : styles.inputHub,
    { backgroundColor: colors.inputBg, color: colors.textPrimary, borderColor: colors.border },
  ];

  const previewTintBg = isDark ? `${colors.buttonPrimary}18` : `${colors.buttonPrimary}14`;
  const previewTintBorder = isDark ? `${colors.buttonPrimary}44` : `${colors.buttonPrimary}33`;

  const stakesPreviewStyle = [
    styles.previewCard,
    {
      backgroundColor: previewTintBg,
      borderColor: previewTintBorder,
    },
    !isGroupsSheet && appleCardShadowResting(isDark),
  ];

  const stakesFields = (
    <>
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

      <View style={stakesPreviewStyle}>
        <Footnote style={{ color: colors.textSecondary }}>{t.game.eachChipEquals}</Footnote>
        <Title2 style={{ color: colors.buttonPrimary, marginTop: SPACE.xs }}>${chipValue.toFixed(2)}</Title2>
      </View>
    </>
  );

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

      {isGroupsSheet ? (
        <>
          <View style={[elevatedCard, styles.cardPad]}>
            <Footnote style={[styles.fieldLabel, { color: colors.textSecondary }]}>{t.game.gameTitleSection}</Footnote>
            <TextInput
              style={[
                styles.inputGroupsInCard,
                { backgroundColor: colors.inputBg, color: colors.textPrimary, borderColor: colors.border },
              ]}
              placeholder={t.game.gameTitlePlaceholder}
              placeholderTextColor={colors.textMuted}
              value={gameTitle}
              onChangeText={setGameTitle}
            />
            <Footnote style={{ color: colors.textMuted, marginTop: SPACE.xs, marginBottom: 0 }}>
              {t.game.gameTitleRandomHint}
            </Footnote>
          </View>
          <View style={[elevatedCard, styles.cardPad, { marginTop: SPACE.md }]}>{stakesFields}</View>
        </>
      ) : (
        <>
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

          <View style={[styles.settingsBlock, { borderTopColor: colors.border }]}>{stakesFields}</View>
        </>
      )}

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

      {!hideFooter && (
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
              <Headline style={{ color: colors.buttonText }}>{t.game.startGame}</Headline>
            )}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
});

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
  cardPad: {
    padding: LAYOUT.cardPadding,
  },
  inputGroupsInCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: RADIUS.lg,
    paddingHorizontal: SPACE.md,
    paddingVertical: Platform.OS === "ios" ? SPACE.md : SPACE.sm,
    fontSize: APPLE_TYPO.body.size,
    lineHeight: 22,
    marginTop: SPACE.sm,
    marginBottom: SPACE.xs,
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
