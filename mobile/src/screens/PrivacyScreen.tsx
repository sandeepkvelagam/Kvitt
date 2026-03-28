import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  Switch,
  Linking,
  Alert,
  ActivityIndicator,
  ScrollView,
  TouchableOpacity,
  Animated,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppIcon, type IconName } from "../components/icons";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { useLanguage } from "../context/LanguageContext";
import { useHaptics } from "../context/HapticsContext";
import { api } from "../api/client";
import { COLORS, ANIMATION } from "../styles/liquidGlass";
import { FONT, SPACE, LAYOUT, RADIUS, SECTION_LABEL_LETTER_SPACING, ICON_WELL } from "../styles/tokens";
import { appleCardShadowResting } from "../styles/appleShadows";
import { PageHeader } from "../components/ui";
import { BottomSheetScreen } from "../components/BottomSheetScreen";

const SCREEN_PAD = LAYOUT.screenPadding;

export function PrivacyScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { user, refreshUser } = useAuth();
  const { colors, isDark } = useTheme();
  const { t } = useLanguage();
  const { triggerHaptic } = useHaptics();
  const [helpImprove, setHelpImprove] = useState(user?.help_improve_ai ?? true);
  const [isSaving, setIsSaving] = useState(false);

  const backgroundColor = isDark ? COLORS.jetDark : colors.contentBg;

  const cardChrome = useMemo(
    () => ({
      backgroundColor: colors.surface,
      borderRadius: RADIUS.lg,
      borderWidth: 1,
      borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)",
      ...appleCardShadowResting(isDark),
    }),
    [colors.surface, isDark]
  );

  const sectionLabelText = useMemo(
    () => ({
      color: colors.textMuted,
      fontSize: FONT.sectionLabel.size,
      fontWeight: "600" as const,
      letterSpacing: SECTION_LABEL_LETTER_SPACING,
      textTransform: "uppercase" as const,
    }),
    [colors.textMuted]
  );

  /** Same double-ring icon wells as WalletActionRow / Dashboard V3 */
  const metricRingPad = useMemo(
    () => ({
      padBg: isDark ? "rgba(168, 182, 215, 0.1)" : "rgba(88, 102, 138, 0.07)",
      rimBorder: isDark ? "rgba(255, 255, 255, 0.09)" : "rgba(0, 0, 0, 0.07)",
    }),
    [isDark]
  );

  const triSpec = ICON_WELL.tri;

  const triIconWell = (name: IconName, iconColor: string) => (
    <View
      style={[
        styles.ringOuter,
        {
          width: triSpec.outer,
          height: triSpec.outer,
          borderRadius: triSpec.outer / 2,
          padding: triSpec.ringPadding,
          backgroundColor: metricRingPad.padBg,
          borderColor: metricRingPad.rimBorder,
        },
      ]}
    >
      <View
        style={[
          styles.ringInner,
          {
            width: triSpec.inner,
            height: triSpec.inner,
            borderRadius: triSpec.inner / 2,
            backgroundColor: colors.surface,
          },
        ]}
      >
        <AppIcon name={name} size={20} color={iconColor} />
      </View>
    </View>
  );

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 350, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, ...ANIMATION.spring.bouncy }),
    ]).start();
  }, []);

  useEffect(() => {
    if (user?.help_improve_ai !== undefined) setHelpImprove(user.help_improve_ai);
  }, [user?.help_improve_ai]);

  const handleToggle = async (value: boolean) => {
    setHelpImprove(value);
    setIsSaving(true);
    try {
      await api.put("/users/me", { help_improve_ai: value });
      await refreshUser?.();
    } catch (e: any) {
      setHelpImprove(!value);
      Alert.alert("Not available right now", e?.response?.data?.detail || "Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const divider = (show: boolean) =>
    show ? { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border } : {};

  return (
    <BottomSheetScreen>
      <View style={[styles.container, { backgroundColor }]}>
        <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
          <PageHeader
            title={t.settings.privacy}
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
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + SPACE.xxxl }]}
          showsVerticalScrollIndicator={false}
        >
          <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
            <View style={[styles.trustCard, cardChrome]}>
              <View style={styles.trustHeader}>
                {triIconWell("shieldCheck", COLORS.trustBlue)}
                <View style={styles.trustText}>
                  <Text style={[styles.trustTitle, { color: colors.textPrimary }]}>Your data is safe</Text>
                  <Text style={[styles.trustDesc, { color: colors.textMuted }]}>
                    Encrypted at rest and in transit. Never sold to third parties.
                  </Text>
                </View>
              </View>
              <View style={styles.linksRow}>
                {[
                  { label: "Privacy Center", url: "https://kvitt.app/privacy" },
                  { label: "Privacy Policy", url: "https://kvitt.app/privacy-policy" },
                ].map((l) => (
                  <TouchableOpacity
                    key={l.label}
                    style={[
                      styles.linkChip,
                      { backgroundColor: colors.glassBg, borderColor: colors.glassBorder },
                    ]}
                    onPress={() => Linking.openURL(l.url)}
                    activeOpacity={0.7}
                  >
                    <AppIcon name="openExternal" size={13} color={COLORS.orange} />
                    <Text style={styles.linkText}>{l.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <Text style={[sectionLabelText, styles.sectionAfterTrust]}>DATA USAGE</Text>
            <View style={[styles.card, cardChrome]}>
              <View style={styles.toggleRow}>
                {triIconWell("analytics", COLORS.orange)}
                <View style={styles.toggleBody}>
                  <Text style={[styles.toggleTitle, { color: colors.textPrimary }]}>Help improve Kvitt</Text>
                  <Text style={[styles.toggleDesc, { color: colors.textMuted }]}>
                    Share anonymised game data to improve AI features and app performance.
                  </Text>
                  <TouchableOpacity
                    onPress={() => Linking.openURL("https://kvitt.app/learn-more")}
                    style={styles.learnMore}
                  >
                    <Text style={styles.learnMoreText}>Learn More</Text>
                    <AppIcon name="chevronForward" size={12} color={COLORS.orange} />
                  </TouchableOpacity>
                </View>
                {isSaving ? (
                  <ActivityIndicator size="small" color={COLORS.orange} />
                ) : (
                  <Switch
                    value={helpImprove}
                    onValueChange={handleToggle}
                    trackColor={{ false: colors.glassBg, true: COLORS.orange }}
                    thumbColor="#fff"
                  />
                )}
              </View>
            </View>

            <Text style={[sectionLabelText, styles.sectionBetween]}>YOUR RIGHTS</Text>
            <View style={[styles.card, cardChrome]}>
              {[
                {
                  icon: "dataExport" as const,
                  color: COLORS.trustBlue,
                  title: "Export your data",
                  desc: "Download all your Kvitt data",
                  url: "https://kvitt.app/data-export",
                },
                {
                  icon: "deleteAccount" as const,
                  color: COLORS.status.danger,
                  title: "Request deletion",
                  desc: "Permanently delete all your data",
                  url: "https://kvitt.app/delete-data",
                },
              ].map((item, i, arr) => (
                <TouchableOpacity
                  key={item.title}
                  style={[styles.rightRow, divider(i < arr.length - 1)]}
                  onPress={() => Linking.openURL(item.url)}
                  activeOpacity={0.7}
                >
                  {triIconWell(item.icon, item.color)}
                  <View style={styles.rightText}>
                    <Text style={[styles.rightTitle, { color: colors.textPrimary }]}>{item.title}</Text>
                    <Text style={[styles.rightDesc, { color: colors.textMuted }]}>{item.desc}</Text>
                  </View>
                  <AppIcon name="openExternal" size={14} color={colors.textMuted} />
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[sectionLabelText, styles.sectionBetween]}>{t.settings.legal}</Text>
            <View style={[styles.card, cardChrome]}>
              {[
                { icon: "termsDocument" as const, label: t.privacy.termsOfService, url: "https://kvitt.app/terms" },
                { icon: "privacyShield" as const, label: t.privacy.privacyPolicy, url: "https://kvitt.app/privacy" },
                { icon: "acceptableUseDoc" as const, label: t.privacy.acceptableUse, url: "https://kvitt.app/acceptable-use" },
              ].map((item, i, arr) => (
                <TouchableOpacity
                  key={item.url}
                  style={[styles.rightRow, divider(i < arr.length - 1)]}
                  onPress={() => Linking.openURL(item.url)}
                  activeOpacity={0.7}
                >
                  {triIconWell(item.icon, COLORS.orange)}
                  <Text style={[styles.rightTextSingle, { color: colors.textPrimary, flex: 1 }]}>{item.label}</Text>
                  <AppIcon name="openExternal" size={14} color={colors.textMuted} />
                </TouchableOpacity>
              ))}
            </View>

            <View style={[styles.footerNote, cardChrome]}>
              <AppIcon name="infoCircle" size={15} color={colors.textMuted} />
              <Text style={[styles.footerText, { color: colors.textMuted }]}>
                To request account deletion, contact support through Report an Issue in Preferences.
              </Text>
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
    paddingHorizontal: SCREEN_PAD,
    paddingTop: SPACE.xs,
  },

  trustCard: { padding: LAYOUT.cardPadding, marginBottom: SPACE.sm },
  trustHeader: { flexDirection: "row", alignItems: "flex-start", gap: SPACE.md, marginBottom: SPACE.md },
  ringOuter: {
    borderWidth: StyleSheet.hairlineWidth * 2,
    alignItems: "center",
    justifyContent: "center",
  },
  ringInner: {
    alignItems: "center",
    justifyContent: "center",
  },
  trustText: { flex: 1 },
  trustTitle: { fontSize: FONT.body.size, fontWeight: "600", marginBottom: 4 },
  trustDesc: { fontSize: FONT.secondary.size, lineHeight: 18 },
  linksRow: { flexDirection: "row", flexWrap: "wrap", gap: SPACE.sm },
  linkChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    minHeight: LAYOUT.touchTarget,
    paddingVertical: SPACE.sm,
    paddingHorizontal: SPACE.md,
    borderRadius: RADIUS.full,
    borderWidth: 1,
  },
  linkText: { color: COLORS.orange, fontSize: FONT.caption.size, fontWeight: "500" },

  sectionAfterTrust: {
    marginBottom: SPACE.xs,
    marginTop: SPACE.lg,
  },
  sectionBetween: {
    marginBottom: SPACE.xs,
    marginTop: SPACE.xl,
  },
  card: {
    overflow: "hidden",
    marginBottom: SPACE.sm,
  },

  toggleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: SPACE.md,
    padding: LAYOUT.cardPadding,
    minHeight: LAYOUT.touchTarget,
  },
  toggleBody: { flex: 1, minWidth: 0 },
  toggleTitle: { fontSize: FONT.body.size, fontWeight: "600", marginBottom: 4 },
  toggleDesc: { fontSize: FONT.secondary.size, lineHeight: 18 },
  learnMore: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: SPACE.sm },
  learnMoreText: { color: COLORS.orange, fontSize: FONT.caption.size, fontWeight: "500" },

  rightRow: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: LAYOUT.touchTarget,
    paddingVertical: SPACE.sm,
    paddingHorizontal: LAYOUT.cardPadding,
    gap: SPACE.md,
  },
  rightText: { flex: 1 },
  rightTextSingle: { fontSize: FONT.body.size, fontWeight: "500" },
  rightTitle: { fontSize: FONT.body.size, fontWeight: "500" },
  rightDesc: { fontSize: FONT.caption.size, marginTop: 2 },

  footerNote: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: SPACE.sm,
    marginTop: SPACE.xl,
    padding: LAYOUT.cardPadding,
  },
  footerText: { flex: 1, fontSize: FONT.caption.size, lineHeight: 18 },
});

export default PrivacyScreen;
