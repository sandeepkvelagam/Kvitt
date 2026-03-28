import React, { useState, useRef, useEffect } from "react";
import {
  Text,
  View,
  StyleSheet,
  Pressable,
  Platform,
  Animated as RNAnimated,
  ActivityIndicator,
} from "react-native";
import { TouchableOpacity } from "react-native-gesture-handler";
import Reanimated, {
  FadeInDown,
  FadeInUp,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "../api/client";
import { useTheme } from "../context/ThemeContext";
import { useLanguage } from "../context/LanguageContext";
import { usePokerAI } from "../context/PokerAIContext";
import {
  getThemedColors,
  SPACING,
  RADIUS,
  TYPOGRAPHY,
  SPRINGS,
  ANIMATION,
  PAGE_HERO_GRADIENT,
  pageHeroGradientColors,
} from "../styles/liquidGlass";
import { FONT, SPACE, BUTTON_SIZE, RADIUS as KV_RADIUS, LAYOUT } from "../styles/tokens";
import { appleCardShadowResting } from "../styles/appleShadows";
import { AnimatedModal } from "../components/AnimatedModal";
import { Headline, Caption2, Footnote, Label, Title3, Body, Caption } from "../components/ui/Typography";
import { recordPokerPlayConsentAck } from "../utils/pokerAiAcknowledgements";
import { SnakeGlowBorder } from "../components/ui";
import type { RootStackParamList } from "../navigation/RootNavigator";

type Nav = NativeStackNavigationProp<RootStackParamList>;

const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
const SUITS = [
  { symbol: "\u2660", name: "spades", color: "#000" },
  { symbol: "\u2665", name: "hearts", color: "#DC2626" },
  { symbol: "\u2666", name: "diamonds", color: "#DC2626" },
  { symbol: "\u2663", name: "clubs", color: "#000" },
];

const STRONG_HANDS = ["Royal Flush", "Straight Flush", "Four of a Kind", "Full House", "Flush", "Straight"];
const CONFETTI_COLORS = ["#EE6C29", "#FF6EA8", "#7848FF", "#3B82F6", "#22C55E"];

type Card = { rank: string; suit: string } | null;

/* ─── Animated Card Slot (spring press feedback) ─── */
function AnimatedCardSlot({ children, onPress, style }: { children: React.ReactNode; onPress: () => void; style: any }) {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <Reanimated.View style={animStyle}>
      <TouchableOpacity
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onPress();
        }}
        onPressIn={() => { scale.value = withSpring(ANIMATION.scale.cardPressed, SPRINGS.press); }}
        onPressOut={() => { scale.value = withSpring(1, SPRINGS.snap); }}
        activeOpacity={0.9}
        style={style}
      >
        {children}
      </TouchableOpacity>
    </Reanimated.View>
  );
}

/* ─── Animated Picker Button (spring press feedback) ─── */
function AnimatedPickerButton({ children, onPress, style }: { children: React.ReactNode; onPress: () => void; style: any }) {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <Reanimated.View style={animStyle}>
      <TouchableOpacity
        onPress={onPress}
        onPressIn={() => { scale.value = withSpring(ANIMATION.scale.pressed, SPRINGS.press); }}
        onPressOut={() => { scale.value = withSpring(1, SPRINGS.snap); }}
        activeOpacity={0.9}
        style={style}
      >
        {children}
      </TouchableOpacity>
    </Reanimated.View>
  );
}

/* ─── Confetti Burst Component ─── */
function ConfettiBurst({ active }: { active: boolean }) {
  const particles = useRef(
    Array.from({ length: 24 }, () => ({
      x: new RNAnimated.Value(0),
      y: new RNAnimated.Value(0),
      rotate: new RNAnimated.Value(0),
      opacity: new RNAnimated.Value(0),
      color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
      targetX: (Math.random() - 0.5) * 300,
      targetY: (Math.random() - 0.7) * 400,
      size: 6 + Math.random() * 6,
    }))
  ).current;

  useEffect(() => {
    if (!active) return;

    particles.forEach((p) => {
      p.x.setValue(0);
      p.y.setValue(0);
      p.rotate.setValue(0);
      p.opacity.setValue(1);
    });

    RNAnimated.parallel(
      particles.map((p) =>
        RNAnimated.parallel([
          RNAnimated.timing(p.x, { toValue: p.targetX, duration: 1200, useNativeDriver: true }),
          RNAnimated.timing(p.y, { toValue: p.targetY, duration: 1200, useNativeDriver: true }),
          RNAnimated.timing(p.rotate, { toValue: 360, duration: 1200, useNativeDriver: true }),
          RNAnimated.timing(p.opacity, { toValue: 0, duration: 1200, useNativeDriver: true }),
        ])
      )
    ).start();
  }, [active]);

  if (!active) return null;

  return (
    <View style={confettiStyles.container} pointerEvents="none">
      {particles.map((p, i) => (
        <RNAnimated.View
          key={i}
          style={[
            confettiStyles.particle,
            {
              width: p.size,
              height: p.size,
              backgroundColor: p.color,
              borderRadius: Math.random() > 0.5 ? p.size / 2 : 2,
              opacity: p.opacity,
              transform: [
                { translateX: p.x },
                { translateY: p.y },
                {
                  rotate: p.rotate.interpolate({
                    inputRange: [0, 360],
                    outputRange: ["0deg", "360deg"],
                  }),
                },
              ],
            },
          ]}
        />
      ))}
    </View>
  );
}

const confettiStyles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
  },
  particle: {
    position: "absolute",
  },
});

/* ─── PokerAI Screen ─── */
export function PokerAIScreen() {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();
  const { colors, isDark } = useTheme();
  const lc = getThemedColors(isDark, colors);

  // Persistent state from context (survives navigation)
  const {
    handCards, setHandCards,
    communityCards, setCommunityCards,
    consentChecked, setConsentChecked,
    suggestion, setSuggestion,
    showHand, setShowHand,
    resetAll,
  } = usePokerAI();

  // Transient UI state (local only)
  const [selectedSlot, setSelectedSlot] = useState<{ type: "hand" | "community"; index: number } | null>(null);
  const [selectedRank, setSelectedRank] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showResultModal, setShowResultModal] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);

  // Auto-hide timer for hand privacy
  const revealTimer = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (revealTimer.current) clearTimeout(revealTimer.current);
    };
  }, []);

  const revealHand = () => {
    setShowHand(true);
    if (revealTimer.current) clearTimeout(revealTimer.current);
    revealTimer.current = setTimeout(() => setShowHand(false), 5000);
  };

  const toggleHandVisibility = () => {
    if (showHand) {
      setShowHand(false);
      if (revealTimer.current) clearTimeout(revealTimer.current);
    } else {
      revealHand();
    }
  };

  // Check for duplicate cards
  const allCards = [...handCards, ...communityCards].filter(Boolean) as { rank: string; suit: string }[];
  const cardStrings = allCards.map((c) => `${c.rank}${c.suit}`);
  const hasDuplicates = new Set(cardStrings).size !== cardStrings.length;

  // Validation
  const handComplete = handCards.every((c) => c !== null);
  const communityCount = communityCards.filter((c) => c !== null).length;
  const canAnalyze = handComplete && communityCount >= 3 && consentChecked && !hasDuplicates;

  // Get suit color — black suits always dark (#1a1a1a) since card bg is white
  const getSuitColor = (color: string | undefined) => {
    if (!color) return lc.suitBlack;
    return color === "#000" ? lc.suitBlack : color;
  };

  // Set card at selected slot
  const setCard = (rank: string, suit: string) => {
    if (!selectedSlot) return;

    const newCard = { rank, suit };
    if (selectedSlot.type === "hand") {
      const newHand = [...handCards];
      newHand[selectedSlot.index] = newCard;
      setHandCards(newHand);
    } else {
      const newCommunity = [...communityCards];
      newCommunity[selectedSlot.index] = newCard;
      setCommunityCards(newCommunity);
    }

    // Auto-advance to next empty slot
    const allSlots = [
      { type: "hand" as const, cards: selectedSlot.type === "hand" ? [...handCards].map((c, i) => i === selectedSlot.index ? newCard : c) : handCards },
      { type: "community" as const, cards: selectedSlot.type === "community" ? [...communityCards].map((c, i) => i === selectedSlot.index ? newCard : c) : communityCards },
    ];

    for (const { type, cards } of allSlots) {
      for (let i = 0; i < cards.length; i++) {
        if (cards[i] === null && !(type === selectedSlot.type && i === selectedSlot.index)) {
          setSelectedSlot({ type, index: i });
          setSelectedRank(null);
          return;
        }
      }
    }
    setSelectedSlot(null);
    setSelectedRank(null);
  };

  // Clear all cards
  const handleReset = () => {
    resetAll();
    setSelectedSlot(null);
    setSelectedRank(null);
    setError(null);
  };

  // Analyze hand
  const handleAnalyze = async () => {
    if (!canAnalyze) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setAnalyzing(true);
    setError(null);
    setSuggestion(null);

    try {
      const yourHand = handCards.map((c) => `${c!.rank} of ${c!.suit}`);
      const community = communityCards.filter(Boolean).map((c) => `${c!.rank} of ${c!.suit}`);

      const res = await api.post("/poker/analyze", {
        your_hand: yourHand,
        community_cards: community,
      });
      const raw = res.data;
      // Backend returns hand_details (deterministic evaluator); map for UI + confetti
      const handStrength =
        raw?.hand_strength ??
        raw?.hand_details?.hand_name ??
        raw?.hand_details?.description ??
        "";
      setSuggestion({ ...raw, hand_strength: handStrength });
      setShowResultModal(true);

      const strength = handStrength;
      if (STRONG_HANDS.some((h) => strength.toLowerCase().includes(h.toLowerCase()))) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setShowConfetti(true);
        setTimeout(() => setShowConfetti(false), 1500);
      }
    } catch (e: any) {
      setError(e?.response?.data?.detail || e?.message || "Analysis failed");
    } finally {
      setAnalyzing(false);
    }
  };

  // Cancel picker
  const cancelPicker = () => {
    setSelectedSlot(null);
    setSelectedRank(null);
  };

  // Render card slot
  const renderCardSlot = (card: Card, type: "hand" | "community", index: number, hidden: boolean = false) => {
    const isSelected = selectedSlot?.type === type && selectedSlot?.index === index;
    const suitData = card ? SUITS.find((s) => s.name === card.suit) : null;

    return (
      <AnimatedCardSlot
        key={`${type}-${index}`}
        style={[
          styles.cardSlot,
          {
            borderColor: isSelected ? colors.orange : colors.border,
            backgroundColor: colors.inputBg,
          },
          isSelected && { borderWidth: 2, borderStyle: "solid" as const },
        ]}
        onPress={() => {
          if (type === "hand" && !showHand) revealHand();
          setSelectedSlot({ type, index });
          setSelectedRank(null);
        }}
      >
        {card ? (
          hidden ? (
            <View style={styles.cardContent}>
              <Ionicons name="eye-off" size={20} color={colors.textMuted} />
            </View>
          ) : (
            <View style={styles.cardContent}>
              <Text style={[styles.cardRank, { color: getSuitColor(suitData?.color) }]}>
                {card.rank}
              </Text>
              <Text style={[styles.cardSuit, { color: getSuitColor(suitData?.color) }]}>
                {suitData?.symbol}
              </Text>
            </View>
          )
        ) : (
          <Text style={[styles.cardPlaceholder, { color: colors.textMuted }]}>Tap</Text>
        )}
      </AnimatedCardSlot>
    );
  };

  // Suggestion modal content (reused in modal and inline)
  const renderSuggestionContent = (inModal: boolean) => (
    <View
      style={[
        styles.suggestionCardOuter,
        { backgroundColor: colors.surface, borderColor: colors.border },
        appleCardShadowResting(isDark),
      ]}
    >
      <View
        style={[
          styles.liquidInner,
          { backgroundColor: colors.inputBg, borderRadius: RADIUS.xl },
        ]}
      >
        <View style={styles.suggestionHeader}>
          <Ionicons name="bulb" size={20} color={colors.orange} />
          <Title3 style={{ flex: 1 }} numberOfLines={1}>
            AI Suggestion
          </Title3>
        </View>

        <View style={styles.suggestionContent}>
          {/* Action Badge */}
          <View style={[
            styles.actionBadge,
            suggestion?.action === "FOLD" && { backgroundColor: lc.glowRed },
            suggestion?.action === "CALL" && { backgroundColor: lc.glowBlue },
            suggestion?.action === "RAISE" && { backgroundColor: lc.glowGreen },
            suggestion?.action === "CHECK" && { backgroundColor: colors.glassBg },
          ]}>
            <Text style={[
              styles.actionText,
              suggestion?.action === "FOLD" && { color: lc.danger },
              suggestion?.action === "CALL" && { color: lc.trustBlue },
              suggestion?.action === "RAISE" && { color: lc.success },
              suggestion?.action === "CHECK" && { color: colors.textMuted },
            ]}>
              {suggestion?.action}
            </Text>
          </View>

          {/* Potential */}
          <View style={styles.potentialRow}>
            <Text style={[styles.potentialLabel, { color: colors.textSecondary }]}>Potential:</Text>
            <Text style={[
              styles.potentialValue,
              suggestion?.potential === "High" && { color: colors.success },
              suggestion?.potential === "Medium" && { color: colors.warning },
              suggestion?.potential === "Low" && { color: colors.textMuted },
            ]}>
              {suggestion?.potential}
            </Text>
          </View>

          {/* Reasoning */}
          <Body style={[styles.reasoningText, { color: colors.textPrimary, textAlign: "center" }]}>
            {suggestion?.reasoning}
          </Body>

          {/* Hand Strength */}
          {suggestion?.hand_strength && (
            <View style={[styles.handStrengthBadge, { backgroundColor: colors.glassBg }]}>
              <Text style={[styles.handStrengthText, { color: colors.textPrimary }]}>
                {suggestion.hand_strength}
              </Text>
            </View>
          )}
        </View>

        {/* "Got it" button — only in modal */}
        {inModal && (
          <View style={{ marginTop: SPACING.xl }}>
            <TouchableOpacity
              style={[
                styles.systemPrimaryBtn,
                {
                  backgroundColor: colors.buttonPrimary,
                  minHeight: BUTTON_SIZE.regular.height,
                },
                Platform.OS === "ios" && { borderCurve: "continuous" as const },
              ]}
              onPress={() => setShowResultModal(false)}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Got it"
            >
              <Headline style={{ color: colors.buttonText }}>Got it</Headline>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );

  const dashedSnakeColor = isDark ? "rgba(255,255,255,0.14)" : "rgba(0,0,0,0.12)";

  return (
    <View style={[styles.wrapper, { paddingTop: insets.top, backgroundColor: colors.contentBg }]}>
      <LinearGradient
        pointerEvents="none"
        colors={pageHeroGradientColors(isDark)}
        locations={[...PAGE_HERO_GRADIENT.locations]}
        start={PAGE_HERO_GRADIENT.start}
        end={PAGE_HERO_GRADIENT.end}
        style={[
          styles.topGradient,
          {
            height: Math.min(
              PAGE_HERO_GRADIENT.maxHeight,
              insets.top + PAGE_HERO_GRADIENT.safeAreaPad
            ),
          },
        ]}
      />
      <View style={[styles.wrapper, { flex: 1, zIndex: 1 }]}>
        {/* Header chrome aligned with AI Assistant (safe area on screen root + header row padding) */}
        <View style={styles.headerChrome}>
          <View style={styles.headerRow}>
            <Pressable
              style={({ pressed }) => [
                styles.backPill,
                {
                  backgroundColor: colors.glassBg,
                  borderColor: colors.glassBorder,
                  opacity: pressed ? 0.85 : 1,
                },
                Platform.OS === "ios" && { borderCurve: "continuous" as const },
              ]}
              onPress={() => navigation.goBack()}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              accessibilityRole="button"
              accessibilityLabel="Go back"
            >
              <Ionicons name="chevron-back" size={22} color={colors.textPrimary} />
            </Pressable>

            <View style={styles.headerCenter}>
              <View style={styles.headerTitleBlock}>
                <View style={styles.headerTitleRow}>
                  <Headline numberOfLines={1} style={{ color: colors.textPrimary, flexShrink: 1 }}>
                    {t.ai.pokerFeatureTitle}
                  </Headline>
                  <View
                    style={[
                      styles.betaBadge,
                      {
                        borderColor: colors.border,
                        backgroundColor: colors.inputBg,
                      },
                    ]}
                  >
                    <View style={[styles.betaDot, { backgroundColor: colors.orange }]} />
                    <Caption2 style={{ fontWeight: "600", letterSpacing: 0.4, color: colors.textSecondary }}>
                      BETA
                    </Caption2>
                  </View>
                </View>
                <Footnote style={{ color: colors.textMuted, marginTop: 2 }} numberOfLines={2}>
                  Educational suggestions only — not financial or gambling advice
                </Footnote>
              </View>
            </View>

            <View style={styles.headerTrailingSpacer} />
          </View>
        </View>

        <Reanimated.ScrollView
          style={styles.container}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Disclaimer Banner */}
          <View>
            <View
              style={[
                styles.disclaimerCard,
                {
                  borderColor: colors.border,
                  backgroundColor: colors.surface,
                },
                appleCardShadowResting(isDark),
                Platform.OS === "ios" && { borderCurve: "continuous" as const },
              ]}
            >
              <View
                style={[
                  styles.disclaimerInner,
                  {
                    backgroundColor: isDark ? "rgba(255, 159, 10, 0.12)" : "rgba(255, 159, 10, 0.08)",
                  },
                ]}
              >
                <View style={styles.disclaimerRow}>
                  <Ionicons name="warning" size={18} color={colors.warning} />
                  <Footnote style={{ flex: 1, color: colors.warning }}>
                    Suggestions are educational and for entertainment only. They do not guarantee outcomes.
                  </Footnote>
                </View>
              </View>
            </View>
          </View>

          {/* Card Selection Area */}
          <View>
            <SnakeGlowBorder
              borderRadius={RADIUS.xl}
              dashedColor={dashedSnakeColor}
              backgroundColor={colors.surface}
              glowColors={["#EE6C29", "#FF6EA8", "#7848FF"]}
            >
              <View
                style={[
                  styles.liquidInner,
                  { backgroundColor: colors.inputBg, borderRadius: RADIUS.xl },
                ]}
              >
                {/* Your Hand */}
                <View style={styles.section}>
                  <View style={styles.sectionHeaderRow}>
                    <Label color={colors.textPrimary}>Your Hand</Label>
                    <Pressable
                      onPress={toggleHandVisibility}
                      style={({ pressed }) => [
                        styles.iconPill,
                        {
                          backgroundColor: pressed ? colors.inputBg : colors.glassBg,
                          borderColor: colors.glassBorder,
                        },
                        Platform.OS === "ios" && { borderCurve: "continuous" as const },
                      ]}
                      hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                      accessibilityRole="button"
                      accessibilityLabel="Toggle hand visibility"
                    >
                      <Ionicons
                        name={showHand ? "eye-outline" : "eye-off-outline"}
                        size={20}
                        color={colors.textMuted}
                      />
                    </Pressable>
                  </View>
                  <View style={styles.cardRow}>
                    {handCards.map((card, idx) => renderCardSlot(card, "hand", idx, !showHand))}
                  </View>
                </View>

                {/* Community Cards */}
                <View style={styles.section}>
                  <Label color={colors.textPrimary}>Community Cards</Label>
                  <View style={styles.cardRow}>
                    {communityCards.map((card, idx) => renderCardSlot(card, "community", idx))}
                  </View>
                </View>

                {/* Duplicate Warning */}
                {hasDuplicates && (
                  <View
                    style={[
                      styles.warningBanner,
                      {
                        backgroundColor: isDark ? "rgba(255, 59, 48, 0.18)" : "rgba(255, 59, 48, 0.1)",
                        borderColor: colors.danger + "40",
                      },
                    ]}
                  >
                    <Ionicons name="alert-circle" size={16} color={colors.danger} />
                    <Text style={[styles.warningText, { color: colors.danger }]}>Duplicate card detected</Text>
                  </View>
                )}

              </View>
            </SnakeGlowBorder>
          </View>

          {/* Consent Checkbox */}
          <View>
            <TouchableOpacity
              style={styles.consentRow}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                const next = !consentChecked;
                setConsentChecked(next);
                if (next) {
                  void recordPokerPlayConsentAck();
                }
              }}
              activeOpacity={0.7}
            >
              <View
                style={[
                  styles.checkbox,
                  {
                    borderColor: consentChecked ? colors.orange : colors.border,
                    backgroundColor: consentChecked ? colors.orange : "transparent",
                  },
                ]}
              >
                {consentChecked && <Ionicons name="checkmark" size={16} color="#fff" />}
              </View>
              <Caption style={[styles.consentText, { color: colors.textMuted }]}>
                AI suggestions only — I decide my actions
              </Caption>
            </TouchableOpacity>
          </View>

          {/* Action Buttons */}
          <View>
            <View style={styles.actionRow}>
              <View style={{ flex: 1 }}>
            <TouchableOpacity
              style={[
                styles.systemOutlineBtn,
                {
                  borderColor: colors.border,
                  minHeight: BUTTON_SIZE.regular.height,
                },
                Platform.OS === "ios" && { borderCurve: "continuous" as const },
              ]}
              onPress={handleReset}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Reset"
            >
              <Ionicons name="refresh" size={20} color={colors.textPrimary} />
              <Headline style={{ color: colors.textPrimary }}>Reset</Headline>
            </TouchableOpacity>
              </View>
              <View style={{ flex: 2 }}>
                <TouchableOpacity
                  style={[
                    styles.systemPrimaryBtn,
                    {
                      backgroundColor: colors.buttonPrimary,
                      minHeight: BUTTON_SIZE.regular.height,
                      opacity: !canAnalyze || analyzing ? 0.5 : 1,
                    },
                    Platform.OS === "ios" && { borderCurve: "continuous" as const },
                  ]}
                  onPress={handleAnalyze}
                  disabled={!canAnalyze || analyzing}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                  accessibilityLabel="Get suggestion"
                >
                  {analyzing ? (
                    <ActivityIndicator color={colors.buttonText} />
                  ) : (
                    <>
                      <Ionicons name="sparkles" size={20} color={colors.buttonText} />
                      <Headline style={{ color: colors.buttonText }}>Get Suggestion</Headline>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Validation Hints */}
          {!canAnalyze && !suggestion && (
            <View style={styles.hintsContainer}>
              {!handComplete && (
                <Caption style={{ color: colors.textSecondary }}>
                  • Need {2 - handCards.filter(Boolean).length} more hand card(s)
                </Caption>
              )}
              {communityCount < 3 && (
                <Caption style={{ color: colors.textSecondary }}>
                  • Need {3 - communityCount} more community card(s) (minimum: flop)
                </Caption>
              )}
              {!consentChecked && handComplete && communityCount >= 3 && (
                <Caption style={{ color: colors.textSecondary }}>
                  • Please accept the consent checkbox
                </Caption>
              )}
            </View>
          )}

          {/* Error */}
          {error && (
            <Reanimated.View entering={FadeInDown.duration(200).springify()}>
              <View
                style={[
                  styles.errorBanner,
                  {
                    backgroundColor: isDark ? "rgba(255, 59, 48, 0.18)" : "rgba(255, 59, 48, 0.1)",
                  },
                ]}
              >
                <Ionicons name="alert-circle" size={16} color={colors.danger} />
                <Text style={[styles.errorText, { color: colors.danger }]}>{error}</Text>
              </View>
            </Reanimated.View>
          )}

          {/* Inline Suggestion Result (persistent, shown after modal dismissal) */}
          {suggestion && !showResultModal && (
            <Reanimated.View entering={FadeInUp.springify().damping(SPRINGS.layout.damping)}>
              {renderSuggestionContent(false)}
            </Reanimated.View>
          )}

          {/* Footer Note */}
          <Footnote style={[styles.footerNote, { color: colors.textSecondary }]}>
            For learning and practice only
          </Footnote>

          <View style={{ height: 40 }} />
        </Reanimated.ScrollView>

        {/* Rank / suit picker: full-screen dim; tap outside sheet closes (rank step) or returns to ranks (suit step) */}
        {selectedSlot && (
          <View
            style={[styles.pickerOverlayRoot, { paddingBottom: Math.max(insets.bottom, SPACE.md) }]}
            pointerEvents="box-none"
          >
            <Pressable
              style={[
                styles.pickerBackdrop,
                {
                  backgroundColor: isDark ? "rgba(0,0,0,0.58)" : "rgba(0,0,0,0.36)",
                },
              ]}
              onPress={() => {
                if (selectedRank) setSelectedRank(null);
                else cancelPicker();
              }}
              accessibilityRole="button"
              accessibilityLabel={selectedRank ? "Back to rank selection" : "Close card picker"}
            />
            <View style={styles.pickerSheetWrap} pointerEvents="box-none">
              <View
                style={[
                  styles.pickerSheet,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                  },
                  appleCardShadowResting(isDark),
                  Platform.OS === "ios" && { borderCurve: "continuous" as const },
                ]}
              >
                {!selectedRank ? (
                  <>
                    <Label color={colors.textPrimary} style={styles.inputTitleLabel}>
                      Select rank
                    </Label>
                    <View style={styles.rankGrid}>
                      {RANKS.map((rank) => (
                        <AnimatedPickerButton
                          key={rank}
                          style={[
                            styles.rankButton,
                            { borderColor: colors.border, backgroundColor: colors.inputBg },
                          ]}
                          onPress={() => setSelectedRank(rank)}
                        >
                          <Body bold style={{ color: colors.textPrimary }}>
                            {rank}
                          </Body>
                        </AnimatedPickerButton>
                      ))}
                    </View>
                  </>
                ) : (
                  <>
                    <View style={styles.pickerHeaderRow}>
                      <Pressable
                        onPress={() => setSelectedRank(null)}
                        hitSlop={12}
                        accessibilityRole="button"
                        accessibilityLabel="Back to rank selection"
                      >
                        <Ionicons name="chevron-back" size={22} color={colors.textSecondary} />
                      </Pressable>
                      <Title3 style={{ marginBottom: 0, textAlign: "center", flex: 1 }} numberOfLines={1}>
                        Suit for {selectedRank}
                      </Title3>
                    </View>
                    <View style={styles.suitRow}>
                      {SUITS.map((suit) => (
                        <AnimatedPickerButton
                          key={suit.name}
                          style={[
                            styles.suitButton,
                            { borderColor: colors.border, backgroundColor: colors.inputBg },
                          ]}
                          onPress={() => setCard(selectedRank, suit.name)}
                        >
                          <Text style={[styles.suitSymbol, { color: getSuitColor(suit.color) }]}>
                            {suit.symbol}
                          </Text>
                        </AnimatedPickerButton>
                      ))}
                    </View>
                  </>
                )}
              </View>
            </View>
          </View>
        )}

        {/* Suggestion Preview Modal */}
        <AnimatedModal
          visible={showResultModal}
          onClose={() => setShowResultModal(false)}
        >
          <View style={{ position: "relative" }}>
            <ConfettiBurst active={showConfetti} />
            {renderSuggestionContent(true)}
          </View>
        </AnimatedModal>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  topGradient: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 0,
  },
  wrapper: {
    flex: 1,
  },
  systemPrimaryBtn: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACE.sm,
    borderRadius: KV_RADIUS.lg,
    paddingHorizontal: SPACE.lg,
  },
  systemOutlineBtn: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACE.xs,
    borderRadius: KV_RADIUS.lg,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: SPACE.md,
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: LAYOUT.screenPadding,
    paddingTop: SPACE.sm,
    paddingBottom: 40,
    gap: LAYOUT.sectionGap,
  },
  headerChrome: {
    zIndex: 2,
    paddingBottom: SPACE.sm,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: LAYOUT.screenPadding,
    paddingTop: SPACE.xs,
    gap: SPACE.sm,
  },
  backPill: {
    width: LAYOUT.touchTarget,
    height: LAYOUT.touchTarget,
    borderRadius: RADIUS.full,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },
  headerCenter: {
    flex: 1,
    minWidth: 0,
    justifyContent: "center",
  },
  headerTitleBlock: {
    minWidth: 0,
  },
  headerTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.sm,
    flexWrap: "wrap",
  },
  betaBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.xs,
    paddingHorizontal: SPACE.sm,
    paddingVertical: 3,
    borderRadius: RADIUS.sm,
    borderWidth: StyleSheet.hairlineWidth,
  },
  betaDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  headerTrailingSpacer: {
    width: LAYOUT.touchTarget,
    height: LAYOUT.touchTarget,
  },
  iconPill: {
    width: LAYOUT.touchTarget,
    height: LAYOUT.touchTarget,
    borderRadius: RADIUS.full,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },

  disclaimerCard: {
    borderRadius: KV_RADIUS.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  disclaimerInner: {
    padding: SPACE.md,
  },

  suggestionCardOuter: {
    borderRadius: KV_RADIUS.xl,
    borderWidth: StyleSheet.hairlineWidth,
  },
  liquidInner: {
    borderRadius: KV_RADIUS.xl,
    padding: LAYOUT.cardPadding,
  },

  // Disclaimer
  disclaimerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: SPACING.md,
  },
  disclaimerText: {
    flex: 1,
    fontSize: TYPOGRAPHY.sizes.caption,
    lineHeight: 20,
  },

  // Sections
  section: {
    marginBottom: LAYOUT.sectionGap,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: SPACING.gap,
  },

  // Card slots
  cardRow: {
    flexDirection: "row",
    gap: 10,
    justifyContent: "center",
  },
  cardSlot: {
    width: 52,
    height: 76,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderStyle: "dashed",
    justifyContent: "center",
    alignItems: "center",
  },
  cardContent: {
    alignItems: "center",
  },
  cardRank: {
    fontSize: FONT.navTitle.size,
    fontWeight: TYPOGRAPHY.weights.bold,
  },
  cardSuit: {
    fontSize: TYPOGRAPHY.sizes.heading3,
  },
  cardPlaceholder: {
    fontSize: TYPOGRAPHY.sizes.micro,
  },

  // Warnings
  warningBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    marginBottom: SPACING.md,
  },
  warningText: {
    fontSize: TYPOGRAPHY.sizes.bodySmall,
  },

  pickerOverlayRoot: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 40,
  },
  pickerBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  pickerSheetWrap: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: LAYOUT.screenPadding,
  },
  pickerSheet: {
    width: "100%",
    maxWidth: 400,
    alignSelf: "center",
    borderRadius: KV_RADIUS.xl,
    borderWidth: StyleSheet.hairlineWidth,
    padding: SPACE.lg,
    gap: SPACE.md,
  },
  pickerHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    marginBottom: SPACING.gap,
    justifyContent: "center",
  },
  inputTitleLabel: {
    marginBottom: SPACING.gap,
    textAlign: "center",
  },
  rankGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.sm,
    justifyContent: "center",
  },
  rankButton: {
    width: 48,
    height: 48,
    borderRadius: KV_RADIUS.md,
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: "center",
    alignItems: "center",
  },
  suitRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: SPACING.lg,
  },
  suitButton: {
    width: 68,
    height: 68,
    borderRadius: KV_RADIUS.md,
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: "center",
    alignItems: "center",
  },
  suitSymbol: {
    fontSize: 34,
  },

  // Consent
  consentRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.gap,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: RADIUS.sm,
    borderWidth: 2,
    justifyContent: "center",
    alignItems: "center",
  },
  consentText: {
    flex: 1,
  },

  // Actions
  actionRow: {
    flexDirection: "row",
    gap: SPACING.gap,
  },

  // Hints
  hintsContainer: {
    gap: SPACE.xs,
  },

  // Error
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    padding: SPACING.gap,
    borderRadius: RADIUS.md,
    gap: 10,
  },
  errorText: {
    fontSize: TYPOGRAPHY.sizes.bodySmall,
    flex: 1,
  },

  // Suggestion
  suggestionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: SPACING.lg,
  },
  suggestionContent: {
    alignItems: "center",
    gap: SPACING.lg,
  },
  actionBadge: {
    paddingHorizontal: SPACING.xxl,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.md,
  },
  actionText: {
    fontSize: TYPOGRAPHY.sizes.heading2,
    fontWeight: TYPOGRAPHY.weights.bold,
  },
  potentialRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
  },
  potentialLabel: {
    fontSize: TYPOGRAPHY.sizes.bodySmall,
  },
  potentialValue: {
    fontSize: TYPOGRAPHY.sizes.body,
    fontWeight: TYPOGRAPHY.weights.semiBold,
  },
  reasoningText: {
    fontSize: TYPOGRAPHY.sizes.bodySmall,
    lineHeight: 22,
    textAlign: "center",
  },
  handStrengthBadge: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.sm,
  },
  handStrengthText: {
    fontSize: TYPOGRAPHY.sizes.bodySmall,
    fontWeight: TYPOGRAPHY.weights.semiBold,
  },
  footerNote: {
    textAlign: "center",
    marginTop: SPACE.sm,
  },
});
