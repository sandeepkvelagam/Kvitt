import React, { useEffect, useState } from "react";
import { View, StyleSheet, TouchableOpacity, KeyboardAvoidingView, Platform } from "react-native";
import { RouteProp, useRoute, useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../context/ThemeContext";
import { LAYOUT, SPACE } from "../styles/tokens";
import type { RootStackParamList } from "../navigation/RootNavigator";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { GroupChatSettingsSheet } from "../components/GroupChatSettingsSheet";
import { getGroup } from "../api/groups";
import { GroupChatMessagesPanel } from "../components/groupChat/GroupChatMessagesPanel";
import { Title3, Footnote } from "../components/ui";

type Nav = NativeStackNavigationProp<RootStackParamList>;
type R = RouteProp<RootStackParamList, "GroupChat">;

export function GroupChatScreen() {
  const route = useRoute<R>();
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  const { groupId, groupName: routeGroupName } = route.params;

  const [showSettings, setShowSettings] = useState(false);
  const [groupName, setGroupName] = useState(routeGroupName || "Group Chat");
  const [isAdmin, setIsAdmin] = useState(false);
  const [socketConnected, setSocketConnected] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const group = await getGroup(groupId);
        if (group?.name) setGroupName(group.name);
        if (group?.user_role === "admin") setIsAdmin(true);
      } catch {
        // defaults
      }
    })();
  }, [groupId]);

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.contentBg }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={0}
    >
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + SPACE.sm,
            backgroundColor: colors.navBarBackground,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.headerIconBtn}
          hitSlop={{ top: SPACE.sm, bottom: SPACE.sm, left: SPACE.sm, right: SPACE.sm }}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Title3 numberOfLines={1}>{groupName}</Title3>
          <Footnote numberOfLines={1} style={{ marginTop: 2 }}>
            {socketConnected ? "Online" : "Connecting…"}
          </Footnote>
        </View>
        <TouchableOpacity
          onPress={() => setShowSettings(true)}
          style={styles.headerIconBtn}
          hitSlop={{ top: SPACE.sm, bottom: SPACE.sm, left: SPACE.sm, right: SPACE.sm }}
          accessibilityRole="button"
          accessibilityLabel="Chat settings"
        >
          <Ionicons name="settings-outline" size={22} color={colors.textMuted} />
        </TouchableOpacity>
      </View>

      <GroupChatMessagesPanel
        groupId={groupId}
        showPrivacyBanner
        isAdmin={isAdmin}
        onConnectionChange={setSocketConnected}
      />

      <GroupChatSettingsSheet
        visible={showSettings}
        onClose={() => setShowSettings(false)}
        groupId={groupId}
        isAdmin={isAdmin}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: LAYOUT.screenPadding,
    paddingBottom: SPACE.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerIconBtn: {
    width: LAYOUT.touchTarget,
    height: LAYOUT.touchTarget,
    alignItems: "center",
    justifyContent: "center",
  },
  headerCenter: {
    flex: 1,
    marginHorizontal: SPACE.xs,
  },
});
