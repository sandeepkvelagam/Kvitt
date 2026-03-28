import React, { useRef, useEffect, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Animated,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppIcon } from "../components/icons";
import { useLanguage } from "../context/LanguageContext";
import { useTheme } from "../context/ThemeContext";
import { useHaptics } from "../context/HapticsContext";
import { COLORS, ANIMATION } from "../styles/liquidGlass";
import { FONT, SPACE, LAYOUT, RADIUS, SECTION_LABEL_LETTER_SPACING } from "../styles/tokens";
import { appleCardShadowResting } from "../styles/appleShadows";
import { PageHeader } from "../components/ui";
import { BottomSheetScreen } from "../components/BottomSheetScreen";

const SCREEN_PAD = LAYOUT.screenPadding;

export function LanguageScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { language, setLanguage, supportedLanguages, t } = useLanguage();
  const { colors, isDark } = useTheme();
  const { triggerHaptic } = useHaptics();

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

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 350, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, ...ANIMATION.spring.bouncy }),
    ]).start();
  }, []);

  return (
    <BottomSheetScreen>
      <View style={[styles.container, { backgroundColor }]}>
        <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
          <PageHeader
            title={t.settings.language}
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
            { paddingBottom: insets.bottom + SPACE.xxxl },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
            <Text style={[sectionLabelText, styles.sectionHeading]}>AVAILABLE LANGUAGES</Text>
            <View style={[styles.card, cardChrome]}>
              {supportedLanguages.map((lang, index) => {
                const isSelected = language === lang.code;
                return (
                  <TouchableOpacity
                    key={lang.code}
                    testID={`language-option-${lang.code}`}
                    style={[
                      styles.langRow,
                      isSelected && { backgroundColor: COLORS.glass.glowOrange },
                      index < supportedLanguages.length - 1 && {
                        borderBottomWidth: StyleSheet.hairlineWidth,
                        borderBottomColor: colors.border,
                      },
                    ]}
                    onPress={() => setLanguage(lang.code)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.flag}>{lang.flag}</Text>
                    <View style={styles.langInfo}>
                      <Text
                        style={[styles.langName, { color: isSelected ? COLORS.orange : colors.textPrimary }]}
                      >
                        {lang.nativeName}
                      </Text>
                      {lang.name !== lang.nativeName && (
                        <Text style={[styles.langNameEn, { color: colors.textMuted }]}>{lang.name}</Text>
                      )}
                    </View>
                    {isSelected ? (
                      <AppIcon name="successCheckLarge" size={22} color={COLORS.orange} />
                    ) : (
                      <AppIcon name="chevronForward" size={16} color={colors.textMuted} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={[styles.note, cardChrome]}>
              <AppIcon name="infoCircle" size={15} color={colors.textMuted} />
              <Text style={[styles.noteText, { color: colors.textMuted }]}>
                Language affects all text in the app. Restart may be needed for full effect.
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
  sectionHeading: {
    marginBottom: SPACE.xs,
    marginTop: SPACE.md,
  },
  card: {
    overflow: "hidden",
    marginBottom: SPACE.sm,
  },
  langRow: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: LAYOUT.touchTarget,
    paddingVertical: SPACE.sm,
    paddingHorizontal: LAYOUT.cardPadding,
    gap: SPACE.md,
  },
  flag: { fontSize: 28, width: 36, textAlign: "center" },
  langInfo: { flex: 1 },
  langName: { fontSize: FONT.body.size, fontWeight: "500" },
  langNameEn: { fontSize: FONT.caption.size, marginTop: 2 },

  note: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: SPACE.sm,
    marginTop: SPACE.xl,
    padding: LAYOUT.cardPadding,
  },
  noteText: { flex: 1, fontSize: FONT.caption.size, lineHeight: 18 },
});

export default LanguageScreen;
