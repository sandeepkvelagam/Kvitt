import React, { useState, useRef, useEffect, useMemo } from "react";
import {
  ScrollView,
  Text,
  View,
  StyleSheet,
  Alert,
  Animated,
  TouchableOpacity,
  Clipboard,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { useLanguage } from "../context/LanguageContext";
import { useHaptics } from "../context/HapticsContext";
import { api } from "../api/client";
import { COLORS, ANIMATION } from "../styles/liquidGlass";
import { GlassInput, GlassButton, PageHeader } from "../components/ui";
import { BottomSheetScreen } from "../components/BottomSheetScreen";
import type { RootStackParamList } from "../navigation/RootNavigator";
import { FONT, SPACE, LAYOUT, RADIUS, SECTION_LABEL_LETTER_SPACING } from "../styles/tokens";
import { appleCardShadowResting } from "../styles/appleShadows";

const SCREEN_PAD = LAYOUT.screenPadding;

type Nav = NativeStackNavigationProp<RootStackParamList, "AccountProfile">;

export function ProfileScreen() {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { user, refreshUser } = useAuth();
  const { colors, isDark } = useTheme();
  const { t } = useLanguage();
  const { triggerHaptic } = useHaptics();
  const ap = t.accountProfile;

  const [fullName, setFullName] = useState(user?.name || "");
  const [nickname, setNickname] = useState(user?.nickname || user?.name?.split(" ")[0] || "");
  const [isUpdating, setIsUpdating] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

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

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 350, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, ...ANIMATION.spring.bouncy }),
    ]).start();
  }, [fadeAnim, slideAnim]);

  const handleUpdate = async () => {
    if (!fullName.trim()) return;
    setIsUpdating(true);
    try {
      await api.put("/users/me", { name: fullName.trim(), nickname: nickname.trim() });
      await refreshUser?.();
      Alert.alert(ap.saveSuccessTitle, ap.saveSuccessBody);
    } catch (e: any) {
      const detail = e?.response?.data?.detail;
      Alert.alert(ap.updateErrorTitle, typeof detail === "string" ? detail : ap.updateErrorFallback);
    } finally {
      setIsUpdating(false);
    }
  };

  const copyMemberId = () => {
    if (!user?.user_id) return;
    Clipboard.setString(user.user_id);
    triggerHaptic("light");
    Alert.alert(ap.copySuccessTitle, ap.copySuccessBody);
  };

  const changed = fullName !== (user?.name || "") || nickname !== (user?.nickname || user?.name?.split(" ")[0] || "");

  return (
    <BottomSheetScreen>
      <View style={[styles.root, { backgroundColor }]}>
        <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
          <PageHeader
            title={ap.title}
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
            <View style={[styles.card, cardChrome]}>
              <View style={[styles.readRow, { borderBottomColor: colors.border }]}>
                <Ionicons name="mail-outline" size={20} color={colors.textSecondary} />
                <View style={styles.readRowText}>
                  <Text style={[styles.readLabel, { color: colors.textMuted }]}>{ap.emailLabel}</Text>
                  <Text style={[styles.readValue, { color: colors.textPrimary }]} numberOfLines={2}>
                    {user?.email || "—"}
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.readRow}
                onPress={copyMemberId}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={ap.copyMemberIdA11y}
              >
                <Ionicons name="finger-print-outline" size={20} color={colors.textSecondary} />
                <View style={styles.readRowText}>
                  <Text style={[styles.readLabel, { color: colors.textMuted }]}>{ap.memberIdLabel}</Text>
                  <Text style={[styles.readValue, { color: colors.textPrimary }]} numberOfLines={1} selectable>
                    {user?.user_id || "—"}
                  </Text>
                </View>
                <Ionicons name="copy-outline" size={18} color={colors.orange} />
              </TouchableOpacity>
            </View>

            <Text style={[sectionLabelText, styles.sectionHeading]}>{ap.sectionDetails}</Text>
            <View style={[styles.card, cardChrome]}>
              <GlassInput
                label={ap.fullNameLabel}
                placeholder={ap.fullNamePlaceholder}
                value={fullName}
                onChangeText={setFullName}
                containerStyle={{ marginBottom: 12 }}
              />
              <GlassInput
                label={ap.nicknameLabel}
                placeholder={ap.nicknamePlaceholder}
                value={nickname}
                onChangeText={setNickname}
                containerStyle={{ marginBottom: 16 }}
              />
              <GlassButton
                variant={changed ? "primary" : "ghost"}
                size="large"
                fullWidth
                onPress={handleUpdate}
                loading={isUpdating}
                disabled={!changed}
              >
                {t.common.save}
              </GlassButton>
            </View>
          </Animated.View>
        </ScrollView>
      </View>
    </BottomSheetScreen>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
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
    padding: LAYOUT.cardPadding,
    overflow: "hidden",
    marginBottom: SPACE.sm,
  },
  readRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.md,
    paddingVertical: SPACE.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  readRowText: {
    flex: 1,
    minWidth: 0,
  },
  readLabel: {
    fontSize: FONT.caption.size,
    marginBottom: 2,
  },
  readValue: {
    fontSize: FONT.secondary.size,
  },
});

export default ProfileScreen;
