import React, { useEffect, useMemo } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, type ColorValue } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { COLORS, SPRINGS } from "../styles/liquidGlass";
import { FONT, SPACE, LAYOUT, RADIUS, BILLING_PAGE, SECTION_LABEL_LETTER_SPACING } from "../styles/tokens";
import { PageHeader } from "../components/ui";
import { BottomSheetScreen } from "../components/BottomSheetScreen";
import { useTheme } from "../context/ThemeContext";
import { useLanguage } from "../context/LanguageContext";
import { useHaptics } from "../context/HapticsContext";
import type { RootStackParamList } from "../navigation/RootNavigator";
import { appleCardShadowResting } from "../styles/appleShadows";

type Nav = NativeStackNavigationProp<RootStackParamList, "Billing">;

export function BillingScreen() {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const { t } = useLanguage();
  const { triggerHaptic } = useHaptics();
  const bs = t.billingScreen;

  const fade = useSharedValue(0);
  const slideY = useSharedValue(20);

  const backgroundColor = isDark ? COLORS.jetDark : colors.contentBg;

  const cardChrome = useMemo(
    () => ({
      backgroundColor: colors.surface,
      borderRadius: BILLING_PAGE.card.radius,
      borderWidth: BILLING_PAGE.card.borderWidth,
      borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)",
      ...appleCardShadowResting(isDark),
    }),
    [colors.surface, isDark]
  );

  const bannerChrome = useMemo(
    () => ({
      ...cardChrome,
      borderColor: isDark ? "rgba(238, 108, 41, 0.35)" : "rgba(238, 108, 41, 0.28)",
      backgroundColor: isDark ? "rgba(238, 108, 41, 0.08)" : "rgba(238, 108, 41, 0.06)",
    }),
    [cardChrome, isDark]
  );

  /** Same neutral rim + pad as Dashboard V3 metric rings */
  const metricRingPad = useMemo(
    () => ({
      padBg: isDark ? "rgba(168, 182, 215, 0.1)" : "rgba(88, 102, 138, 0.07)",
      rimBorder: isDark ? "rgba(255, 255, 255, 0.09)" : "rgba(0, 0, 0, 0.07)",
    }),
    [isDark]
  );

  const sectionLabelStyle = useMemo(
    () => ({
      color: colors.textMuted,
      fontSize: FONT.sectionLabel.size,
      fontWeight: "600" as const,
      letterSpacing: SECTION_LABEL_LETTER_SPACING,
      textTransform: "uppercase" as const,
    }),
    [colors.textMuted]
  );

  const planFeatures = useMemo(
    () =>
      [
        { icon: "people-outline" as const, text: bs.featureGroups },
        { icon: "game-controller-outline" as const, text: bs.featureGames },
        { icon: "sparkles-outline" as const, text: bs.featureAi },
        { icon: "wallet-outline" as const, text: bs.featureWallet },
      ] as const,
    [bs.featureAi, bs.featureGames, bs.featureGroups, bs.featureWallet]
  );

  const menuItems = useMemo(
    () =>
      [
        {
          icon: "card-outline" as const,
          color: COLORS.trustBlue,
          label: bs.manageSubscription,
          sub: bs.manageSubscriptionSub,
        },
        {
          icon: "refresh-outline" as const,
          color: "#A855F7",
          label: bs.restorePurchases,
          sub: bs.restorePurchasesSub,
        },
      ] as const,
    [bs.manageSubscription, bs.manageSubscriptionSub, bs.restorePurchases, bs.restorePurchasesSub]
  );

  useEffect(() => {
    fade.value = withTiming(1, { duration: 350 });
    slideY.value = withSpring(0, SPRINGS.bouncy);
  }, [fade, slideY]);

  const animStyle = useAnimatedStyle(() => ({
    opacity: fade.value,
    transform: [{ translateY: slideY.value }],
  }));

  const ring = (spec: { outer: number; inner: number; ringPadding: number }, innerBg: ColorValue, children: React.ReactNode) => (
    <View
      style={[
        styles.ringOuter,
        {
          width: spec.outer,
          height: spec.outer,
          borderRadius: spec.outer / 2,
          padding: spec.ringPadding,
          backgroundColor: metricRingPad.padBg,
          borderColor: metricRingPad.rimBorder,
        },
      ]}
    >
      <View
        style={[
          styles.ringInner,
          {
            width: spec.inner,
            height: spec.inner,
            borderRadius: spec.inner / 2,
            backgroundColor: innerBg,
          },
        ]}
      >
        {children}
      </View>
    </View>
  );

  return (
    <BottomSheetScreen>
      <View style={[styles.container, { backgroundColor }]}>
        <Animated.View style={animStyle}>
          <PageHeader
            title={t.settings.billing}
            titleAlign="left"
            titleVariant="prominent"
            onClose={() => {
              triggerHaptic("light");
              navigation.goBack();
            }}
          />
        </Animated.View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[
            styles.content,
            { paddingBottom: insets.bottom + SPACE.xxxl, paddingHorizontal: BILLING_PAGE.padH },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <Animated.View style={animStyle}>
            <View style={[styles.bannerCard, bannerChrome]}>
              {ring(BILLING_PAGE.banner, bannerChrome.backgroundColor, (
                <Ionicons name="time-outline" size={24} color={COLORS.orange} />
              ))}
              <View style={styles.bannerText}>
                <Text style={[styles.bannerTitle, { color: colors.textPrimary }]}>{bs.comingSoonTitle}</Text>
                <Text style={[styles.bannerDesc, { color: colors.textMuted }]}>{bs.comingSoonBody}</Text>
              </View>
            </View>

            <View style={[styles.planHero, cardChrome, { marginTop: BILLING_PAGE.gapAfterBanner }]}>
              <View style={styles.planHeroTop}>
                {ring(BILLING_PAGE.plan, cardChrome.backgroundColor, (
                  <Ionicons name="diamond" size={26} color={COLORS.status.success} />
                ))}
                <View style={styles.planHeroInfo}>
                  <View style={styles.planNameRow}>
                    <Text style={[styles.planName, { color: colors.textPrimary }]}>{bs.freePlanName}</Text>
                    <View style={[styles.activePill, { backgroundColor: COLORS.glass.glowGreen }]}>
                      <Text style={[styles.activePillText, { color: COLORS.status.success }]}>{bs.activeLabel}</Text>
                    </View>
                  </View>
                  <Text style={[styles.planPrice, { color: colors.textMuted }]}>{bs.priceLine}</Text>
                </View>
              </View>
              <View style={[styles.divider, { backgroundColor: colors.border }]} />
              <View style={styles.featureGrid}>
                {planFeatures.map((f, i) => (
                  <View key={i} style={styles.featureRow}>
                    <Ionicons name="checkmark-circle" size={16} color={COLORS.status.success} />
                    <Text style={[styles.featureText, { color: colors.textSecondary }]}>{f.text}</Text>
                  </View>
                ))}
              </View>
            </View>

            <Text style={[sectionLabelStyle, styles.sectionLabel]}>{bs.sectionSubscriptionOptions}</Text>
            <View style={[styles.card, cardChrome]}>
              {menuItems.map((item, i, arr) => (
                <TouchableOpacity
                  key={item.label}
                  style={[
                    styles.menuRow,
                    { minHeight: BILLING_PAGE.menu.rowMinHeight },
                    i < arr.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
                  ]}
                  disabled
                  activeOpacity={0.7}
                >
                  {ring(BILLING_PAGE.menu, cardChrome.backgroundColor, (
                    <Ionicons name={item.icon} size={18} color={item.color} />
                  ))}
                  <View style={styles.menuText}>
                    <Text style={[styles.menuLabel, { color: colors.textMuted }]}>{item.label}</Text>
                    <Text style={[styles.menuSub, { color: colors.textMuted }]}>{item.sub}</Text>
                  </View>
                  <View style={[styles.soonPill, { borderColor: colors.border, backgroundColor: colors.glassBg ?? COLORS.glass.bg }]}>
                    <Text style={[styles.soonText, { color: colors.textMuted }]}>{bs.soonBadge}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </Animated.View>
        </ScrollView>
      </View>
    </BottomSheetScreen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flex: 1 },
  content: {
    paddingTop: SPACE.xs,
  },

  ringOuter: {
    borderWidth: StyleSheet.hairlineWidth * 2,
    alignItems: "center",
    justifyContent: "center",
  },
  ringInner: {
    alignItems: "center",
    justifyContent: "center",
  },

  bannerCard: {
    padding: BILLING_PAGE.card.padding,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: SPACE.md,
    overflow: "hidden",
  },
  bannerText: { flex: 1 },
  bannerTitle: { fontSize: FONT.title.size, fontWeight: "700", marginBottom: SPACE.xs },
  bannerDesc: { fontSize: FONT.secondary.size, lineHeight: 20 },

  planHero: {
    padding: BILLING_PAGE.card.padding,
    marginBottom: SPACE.sm,
  },
  planHeroTop: { flexDirection: "row", alignItems: "center", gap: SPACE.md, marginBottom: SPACE.lg },
  planHeroInfo: { flex: 1 },
  planNameRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: SPACE.xs },
  planName: { fontSize: FONT.navTitle.size, fontWeight: "700" },
  activePill: {
    borderRadius: BILLING_PAGE.pill.radius,
    paddingHorizontal: BILLING_PAGE.pill.padH,
    paddingVertical: BILLING_PAGE.pill.padV,
  },
  activePillText: { fontSize: FONT.caption.size, fontWeight: "700" },
  planPrice: { fontSize: FONT.secondary.size },
  divider: { height: StyleSheet.hairlineWidth, marginBottom: SPACE.lg },
  featureGrid: { gap: 10 },
  featureRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  featureText: { fontSize: FONT.secondary.size },

  sectionLabel: {
    marginTop: BILLING_PAGE.gapBetweenSections,
    marginBottom: SPACE.sm,
  },
  card: {
    overflow: "hidden",
  },
  menuRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: BILLING_PAGE.card.padding,
    gap: SPACE.md,
  },
  menuText: { flex: 1 },
  menuLabel: { fontSize: FONT.body.size, fontWeight: "500" },
  menuSub: { fontSize: FONT.caption.size, marginTop: 2 },
  soonPill: {
    borderRadius: RADIUS.sm,
    paddingHorizontal: SPACE.sm,
    paddingVertical: 3,
    borderWidth: 1,
  },
  soonText: { fontSize: FONT.caption.size, fontWeight: "600" },
});

export default BillingScreen;
