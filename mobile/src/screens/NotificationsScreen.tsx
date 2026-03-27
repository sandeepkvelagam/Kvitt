import React, { useState, useRef, useEffect, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  Switch,
  Alert,
  Linking,
  Platform,
  ScrollView,
  Animated,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { COLORS, ANIMATION } from "../styles/liquidGlass";
import { FONT, SPACE, LAYOUT, RADIUS, SECTION_LABEL_LETTER_SPACING, ICON_WELL } from "../styles/tokens";
import { appleCardShadowResting } from "../styles/appleShadows";
import { PageHeader } from "../components/ui";
import { BottomSheetScreen } from "../components/BottomSheetScreen";
import { useTheme } from "../context/ThemeContext";
import { useLanguage } from "../context/LanguageContext";
import { useHaptics } from "../context/HapticsContext";
import { api } from "../api/client";
import type { RootStackParamList } from "../navigation/RootNavigator";

type Nav = NativeStackNavigationProp<RootStackParamList>;

const SCREEN_PAD = LAYOUT.screenPadding;

export function NotificationsScreen() {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const { t } = useLanguage();
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

  /** Same double-ring icon wells as WalletActionRow / Dashboard V3 */
  const metricRingPad = useMemo(
    () => ({
      padBg: isDark ? "rgba(168, 182, 215, 0.1)" : "rgba(88, 102, 138, 0.07)",
      rimBorder: isDark ? "rgba(255, 255, 255, 0.09)" : "rgba(0, 0, 0, 0.07)",
    }),
    [isDark]
  );

  const triSpec = ICON_WELL.tri;

  const triIconWell = (name: React.ComponentProps<typeof Ionicons>["name"], iconColor: string) => (
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
        <Ionicons name={name} size={20} color={iconColor} />
      </View>
    </View>
  );

  const [pushEnabled, setPushEnabled] = useState(true);
  const [gameUpdates, setGameUpdates] = useState(true);
  const [settlements, setSettlements] = useState(true);
  const [groupInvites, setGroupInvites] = useState(true);

  const [engMutedAll, setEngMutedAll] = useState(false);
  const [engMutedCategories, setEngMutedCategories] = useState<string[]>([]);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 350, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, ...ANIMATION.spring.bouncy }),
    ]).start();
    fetchNotificationPrefs();
    fetchEngagementPrefs();
  }, []);

  const fetchNotificationPrefs = async () => {
    try {
      const res = await api.get("/notifications/preferences");
      if (res.data) {
        setPushEnabled(res.data.push_enabled ?? true);
        setGameUpdates(res.data.game_updates_enabled ?? true);
        setSettlements(res.data.settlements_enabled ?? true);
        setGroupInvites(res.data.group_invites_enabled ?? true);
      }
    } catch {}
  };

  const updateNotifPref = async (key: string, value: boolean) => {
    try {
      await api.put("/notifications/preferences", { [key]: value });
    } catch {}
  };

  const fetchEngagementPrefs = async () => {
    try {
      const res = await api.get("/engagement/preferences");
      if (res.data) {
        setEngMutedAll(res.data.muted_all || false);
        setEngMutedCategories(res.data.muted_categories || []);
      }
    } catch {}
  };

  const updateEngPref = async (key: string, value: unknown) => {
    try {
      await api.put("/engagement/preferences", { [key]: value });
    } catch {}
  };

  const toggleEngMuteAll = (v: boolean) => {
    setEngMutedAll(v);
    updateEngPref("muted_all", v);
  };

  const toggleEngCategory = (cat: string) => {
    const updated = engMutedCategories.includes(cat)
      ? engMutedCategories.filter((c) => c !== cat)
      : [...engMutedCategories, cat];
    setEngMutedCategories(updated);
    updateEngPref("muted_categories", updated);
  };

  const handlePushToggle = (v: boolean) => {
    if (v && Platform.OS !== "web") {
      Alert.alert("Enable Alerts", "Open device settings to enable.", [
        { text: t.common.cancel, style: "cancel" },
        {
          text: "Open Settings",
          onPress: () => (Platform.OS === "ios" ? Linking.openURL("app-settings:") : Linking.openSettings()),
        },
      ]);
    }
    setPushEnabled(v);
    updateNotifPref("push_enabled", v);
  };

  const handleGameUpdatesToggle = (v: boolean) => {
    setGameUpdates(v);
    updateNotifPref("game_updates_enabled", v);
  };

  const handleSettlementsToggle = (v: boolean) => {
    setSettlements(v);
    updateNotifPref("settlements_enabled", v);
  };

  const handleGroupInvitesToggle = (v: boolean) => {
    setGroupInvites(v);
    updateNotifPref("group_invites_enabled", v);
  };

  const divider = (show: boolean) =>
    show ? { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border } : {};

  return (
    <BottomSheetScreen>
      <View style={[styles.container, { backgroundColor }]}>
        <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
          <PageHeader
            title={t.settings.notifications}
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
            <Text style={[sectionLabelText, styles.sectionHeading]}>PUSH NOTIFICATIONS</Text>

            <View style={[styles.card, cardChrome]}>
              <View style={[styles.toggleRow, divider(true)]}>
                {triIconWell("notifications", COLORS.orange)}
                <View style={styles.toggleBody}>
                  <Text style={[styles.toggleTitle, { color: colors.textPrimary }]}>Push Notifications</Text>
                  <Text style={[styles.toggleDesc, { color: colors.textMuted }]}>
                    Alerts for games, settlements & more
                  </Text>
                </View>
                <Switch
                  value={pushEnabled}
                  onValueChange={handlePushToggle}
                  trackColor={{ false: colors.glassBg, true: COLORS.orange }}
                  thumbColor="#fff"
                />
              </View>

              {[
                {
                  key: "game_updates_enabled",
                  icon: "game-controller-outline",
                  color: COLORS.trustBlue,
                  title: "Game Updates",
                  desc: "Buy-ins, cash-outs, game status",
                  value: gameUpdates,
                  onToggle: handleGameUpdatesToggle,
                },
                {
                  key: "settlements_enabled",
                  icon: "wallet-outline",
                  color: COLORS.status.success,
                  title: "Settlements & Wallet",
                  desc: "Payment requests & wallet activity",
                  value: settlements,
                  onToggle: handleSettlementsToggle,
                },
                {
                  key: "group_invites_enabled",
                  icon: "people-outline",
                  color: "#A855F7",
                  title: "Group Invites",
                  desc: "Invitations to join groups",
                  value: groupInvites,
                  onToggle: handleGroupInvitesToggle,
                },
              ].map((item, i, arr) => (
                <View key={item.key} style={[styles.toggleRow, divider(i < arr.length - 1)]}>
                  {triIconWell(item.icon as React.ComponentProps<typeof Ionicons>["name"], item.color)}
                  <View style={styles.toggleBody}>
                    <Text style={[styles.toggleTitle, { color: colors.textPrimary }]}>{item.title}</Text>
                    <Text style={[styles.toggleDesc, { color: colors.textMuted }]}>{item.desc}</Text>
                  </View>
                  <Switch
                    value={item.value}
                    onValueChange={item.onToggle}
                    trackColor={{ false: colors.glassBg, true: COLORS.orange }}
                    thumbColor="#fff"
                  />
                </View>
              ))}
            </View>

            <Text style={[sectionLabelText, styles.sectionAfterCard]}>ENGAGEMENT NOTIFICATIONS</Text>

            <View style={[styles.card, cardChrome]}>
              <View style={[styles.toggleRow, divider(true)]}>
                {triIconWell("sparkles", COLORS.orange)}
                <View style={styles.toggleBody}>
                  <Text style={[styles.toggleTitle, { color: colors.textPrimary }]}>Mute All Engagement</Text>
                  <Text style={[styles.toggleDesc, { color: colors.textMuted }]}>
                    Pause nudges, celebrations & digests
                  </Text>
                </View>
                <Switch
                  value={engMutedAll}
                  onValueChange={toggleEngMuteAll}
                  trackColor={{ false: colors.glassBg, true: "#ef4444" }}
                  thumbColor="#fff"
                />
              </View>

              {!engMutedAll &&
                [
                  {
                    cat: "inactive_group",
                    icon: "calendar-outline",
                    color: COLORS.trustBlue,
                    title: "Inactive Nudges",
                    desc: "Game scheduling reminders",
                  },
                  {
                    cat: "milestone",
                    icon: "trophy-outline",
                    color: "#EAB308",
                    title: "Milestones",
                    desc: "Game count celebrations",
                  },
                  {
                    cat: "big_winner",
                    icon: "flame-outline",
                    color: "#F97316",
                    title: "Winner Celebrations",
                    desc: "Big win announcements",
                  },
                  {
                    cat: "digest",
                    icon: "bar-chart-outline",
                    color: "#A855F7",
                    title: "Weekly Digest",
                    desc: "Group activity summaries",
                  },
                ].map((item, i, arr) => (
                  <View key={item.cat} style={[styles.toggleRow, divider(i < arr.length - 1)]}>
                    {triIconWell(item.icon as React.ComponentProps<typeof Ionicons>["name"], item.color)}
                    <View style={styles.toggleBody}>
                      <Text
                        style={[
                          styles.toggleTitle,
                          {
                            color: engMutedCategories.includes(item.cat) ? colors.textMuted : colors.textPrimary,
                          },
                        ]}
                      >
                        {item.title}
                      </Text>
                      <Text style={[styles.toggleDesc, { color: colors.textMuted }]}>{item.desc}</Text>
                    </View>
                    <Switch
                      value={!engMutedCategories.includes(item.cat)}
                      onValueChange={() => toggleEngCategory(item.cat)}
                      trackColor={{ false: colors.glassBg, true: COLORS.orange }}
                      thumbColor="#fff"
                    />
                  </View>
                ))}
            </View>

            <Text style={[styles.infoText, { color: colors.textMuted }]}>
              Manage which notifications you receive. You can also configure notifications in your device settings.
            </Text>
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
  sectionAfterCard: {
    marginBottom: SPACE.xs,
    marginTop: SPACE.xl,
  },
  card: {
    overflow: "hidden",
    marginBottom: SPACE.sm,
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

  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: LAYOUT.touchTarget,
    gap: SPACE.md,
    paddingVertical: SPACE.sm,
    paddingHorizontal: LAYOUT.cardPadding,
  },
  toggleBody: { flex: 1, minWidth: 0 },
  toggleTitle: { fontSize: FONT.body.size, fontWeight: "500" },
  toggleDesc: { fontSize: FONT.caption.size, marginTop: 2 },

  infoText: {
    fontSize: FONT.caption.size,
    marginTop: SPACE.lg,
    textAlign: "center",
    lineHeight: 18,
  },
});

export default NotificationsScreen;
