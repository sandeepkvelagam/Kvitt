import React, { useCallback } from "react";
import { View, StyleSheet, TouchableOpacity, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { AnimatedModal } from "./AnimatedModal";
import { api } from "../api/client";
import { getThemedColors } from "../styles/liquidGlass";
import { LAYOUT, SPACE, RADIUS, AVATAR_SIZE } from "../styles/tokens";
import { useTheme } from "../context/ThemeContext";
import { useLanguage } from "../context/LanguageContext";
import type { RootStackParamList } from "../navigation/RootNavigator";
import { Title2, Title3, Headline, Subhead, Caption2 } from "./ui";

export type InboxNotification = {
  notification_id: string;
  type: string;
  title?: string;
  message?: string;
  created_at?: string;
  read?: boolean;
  data?: Record<string, any>;
};

type Nav = NativeStackNavigationProp<RootStackParamList>;

function formatNotifTime(d: string | undefined) {
  if (!d) return "";
  const diff = Date.now() - new Date(d).getTime();
  const h = diff / 3600000;
  if (h < 1) return "Just now";
  if (h < 24) return `${Math.floor(h)}h ago`;
  if (h < 48) return "Yesterday";
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

type Props = {
  visible: boolean;
  onClose: () => void;
  navigation: Nav;
  unreadItems: InboxNotification[];
  onRemoveFromUnread: (notificationId: string) => void;
};

export function NotificationsInboxModal({
  visible,
  onClose,
  navigation,
  unreadItems,
  onRemoveFromUnread,
}: Props) {
  const { isDark, colors } = useTheme();
  const { t } = useLanguage();
  const lc = getThemedColors(isDark, colors);

  const getNotifIcon = useCallback(
    (type: string): { icon: string; color: string } => {
      const map: Record<string, { icon: string; color: string }> = {
        game_started: { icon: "play-circle", color: lc.success },
        game_ended: { icon: "stop-circle", color: lc.textMuted },
        buy_in: { icon: "cash", color: lc.success },
        buy_in_request: { icon: "cash", color: lc.orange },
        buy_in_approved: { icon: "cash", color: lc.success },
        buy_in_added: { icon: "cash", color: lc.success },
        buy_in_request_rejected: { icon: "close-circle", color: lc.textMuted },
        cash_out: { icon: "wallet-outline", color: lc.moonstone },
        cash_out_request: { icon: "wallet-outline", color: lc.orange },
        cash_out_request_rejected: { icon: "close-circle", color: lc.textMuted },
        cashed_out: { icon: "wallet-outline", color: lc.success },
        join_request: { icon: "person-add", color: lc.orange },
        join_approved: { icon: "checkmark-circle", color: lc.success },
        join_rejected: { icon: "close-circle", color: lc.textMuted },
        settlement_generated: { icon: "calculator", color: colors.warning },
        invite_accepted: { icon: "person-add", color: lc.success },
        wallet_received: { icon: "wallet", color: lc.success },
        group_invite: { icon: "people", color: lc.orange },
      };
      return map[type] || { icon: "notifications", color: lc.moonstone };
    },
    [lc, colors.warning]
  );

  const handleNotificationPress = async (notif: InboxNotification) => {
    try {
      await api.put(`/notifications/${notif.notification_id}/read`);
      onRemoveFromUnread(notif.notification_id);
    } catch {
      // still navigate
    }

    onClose();

    const data = notif.data || {};
    if (
      notif.type === "game_started" ||
      notif.type === "game_ended" ||
      notif.type === "buy_in" ||
      notif.type === "buy_in_request" ||
      notif.type === "buy_in_approved" ||
      notif.type === "buy_in_added" ||
      notif.type === "buy_in_request_rejected" ||
      notif.type === "cash_out" ||
      notif.type === "cash_out_request" ||
      notif.type === "cash_out_request_rejected" ||
      notif.type === "cashed_out" ||
      notif.type === "join_request" ||
      notif.type === "join_approved" ||
      notif.type === "join_rejected"
    ) {
      if (data.game_id) {
        navigation.navigate("GameNight", { gameId: data.game_id });
      }
      return;
    }
    if (notif.type === "settlement_generated") {
      if (data.game_id) {
        navigation.navigate("Settlement", { gameId: data.game_id });
      }
      return;
    }
    if (notif.type === "group_invite" || notif.type === "invite_accepted") {
      if (data.group_id) {
        navigation.navigate("GroupHub", { groupId: data.group_id });
      }
      return;
    }
    if (notif.type === "wallet_received") {
      navigation.navigate("Wallet");
    }
  };

  const rowSurface = { backgroundColor: colors.liquidGlassBg, borderColor: colors.border };
  const closeBg = colors.inputBg;

  return (
    <AnimatedModal visible={visible} onClose={onClose} blurIntensity={60}>
      <View
        style={[
          styles.panel,
          {
            backgroundColor: colors.surfaceBackground,
            borderColor: colors.border,
          },
        ]}
      >
        <View style={styles.header}>
          <Title2 numberOfLines={1} style={styles.headerTitle}>
            {t.chatsScreen.notifInboxTitle}
          </Title2>
          <TouchableOpacity
            style={[
              styles.closeButton,
              { backgroundColor: closeBg, minWidth: LAYOUT.touchTarget, minHeight: LAYOUT.touchTarget },
            ]}
            onPress={onClose}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Close"
          >
            <Ionicons name="close" size={22} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
          {unreadItems.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons name="notifications-outline" size={48} color={colors.textMuted} />
              <Title3 style={{ marginTop: SPACE.sm, textAlign: "center" }}>
                {t.chatsScreen.notifEmptyTitle}
              </Title3>
              <Subhead style={{ marginTop: SPACE.xs, textAlign: "center" }}>
                {t.chatsScreen.notifEmptySub}
              </Subhead>
            </View>
          ) : (
            <View style={styles.list}>
              {unreadItems.slice(0, 10).map((notif, idx) => {
                const { icon, color } = getNotifIcon(notif.type);
                return (
                  <TouchableOpacity
                    key={notif.notification_id || String(idx)}
                    style={[styles.row, rowSurface]}
                    onPress={() => handleNotificationPress(notif)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.iconWrap, { backgroundColor: color + "20", width: AVATAR_SIZE.md, height: AVATAR_SIZE.md, borderRadius: AVATAR_SIZE.md / 2 }]}>
                      <Ionicons name={icon as any} size={20} color={color} />
                    </View>
                    <View style={styles.rowBody}>
                      <Headline numberOfLines={1}>{notif.title || "Notification"}</Headline>
                      <Subhead numberOfLines={2} style={{ marginTop: 2 }}>
                        {notif.message || ""}
                      </Subhead>
                      <Caption2 style={{ marginTop: SPACE.xs }} color={colors.textMuted}>
                        {formatNotifTime(notif.created_at)}
                      </Caption2>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </ScrollView>

        <TouchableOpacity
          style={[styles.settingsRow, rowSurface, { marginHorizontal: LAYOUT.screenPadding }]}
          onPress={() => {
            onClose();
            navigation.navigate("Notifications");
          }}
          activeOpacity={0.7}
        >
          <Ionicons name="settings-outline" size={18} color={colors.textSecondary} />
          <Headline style={{ flex: 1 }}>{t.chatsScreen.notifSettings}</Headline>
        </TouchableOpacity>
      </View>
    </AnimatedModal>
  );
}

const styles = StyleSheet.create({
  panel: {
    borderRadius: RADIUS.xl,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
    maxHeight: 480,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: LAYOUT.screenPadding,
    paddingTop: SPACE.md,
    paddingBottom: SPACE.sm,
  },
  headerTitle: {
    flex: 1,
    marginRight: SPACE.sm,
  },
  closeButton: {
    borderRadius: RADIUS.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  scroll: {
    maxHeight: 320,
  },
  empty: {
    alignItems: "center",
    paddingVertical: SPACE.xl,
    paddingHorizontal: LAYOUT.screenPadding,
  },
  list: {
    paddingHorizontal: LAYOUT.screenPadding,
    paddingBottom: SPACE.sm,
    gap: LAYOUT.elementGap,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    padding: LAYOUT.cardPadding,
    borderRadius: RADIUS.lg,
    borderWidth: StyleSheet.hairlineWidth,
    gap: LAYOUT.elementGap,
  },
  iconWrap: {
    alignItems: "center",
    justifyContent: "center",
  },
  rowBody: {
    flex: 1,
    minWidth: 0,
  },
  settingsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: LAYOUT.elementGap,
    marginBottom: SPACE.md,
    padding: LAYOUT.cardPadding,
    borderRadius: RADIUS.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
