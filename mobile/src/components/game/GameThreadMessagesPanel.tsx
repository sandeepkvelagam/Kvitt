import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  View,
  FlatList,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  Pressable,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useTheme } from "../../context/ThemeContext";
import { useAuth } from "../../context/AuthContext";
import { useLanguage } from "../../context/LanguageContext";
import { COLORS } from "../../styles/liquidGlass";
import { LAYOUT, SPACE, RADIUS, APPLE_TYPO, AVATAR_SIZE } from "../../styles/tokens";
import { Subhead, Footnote, Caption2, Caption } from "../ui";
import { getGameThread, postGameThreadMessage } from "../../api/games";
import { useGameThreadSocket, type GameThreadSocketMessage } from "../../hooks/useGameThreadSocket";
import type { RootStackParamList } from "../../navigation/RootNavigator";

type Nav = NativeStackNavigationProp<RootStackParamList>;

export type GameThreadRow = GameThreadSocketMessage & {
  message_id: string;
  game_id?: string;
  user_id?: string;
  content?: string;
  type?: string;
  created_at?: string;
  user?: { user_id?: string; name?: string; picture?: string | null };
};

function formatMessageTime(dateStr?: string) {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  if (isToday) {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  return (
    date.toLocaleDateString([], { month: "short", day: "numeric" }) +
    " " +
    date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  );
}

export type GameThreadMessagesPanelProps = {
  gameId: string;
  gameStatus: string;
  /** When true, horizontal padding matches a parent sheet (e.g. GameNight modal) that already applies screen padding. */
  sheetEmbedded?: boolean;
  onConnectionChange?: (connected: boolean) => void;
};

export function GameThreadMessagesPanel({
  gameId,
  gameStatus,
  sheetEmbedded = false,
  onConnectionChange,
}: GameThreadMessagesPanelProps) {
  const insets = useSafeAreaInsets();
  const { isDark, colors } = useTheme();
  const { user } = useAuth();
  const { t } = useLanguage();
  const navigation = useNavigation<Nav>();
  const flatListRef = useRef<FlatList>(null);

  const [messages, setMessages] = useState<GameThreadRow[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);

  const hPad = sheetEmbedded ? 0 : LAYOUT.screenPadding;

  const archived = gameStatus === "settled";
  const showSettlementCta = gameStatus === "ended" || gameStatus === "settled";

  const onThreadMessage = useCallback((msg: GameThreadSocketMessage) => {
    const row = msg as GameThreadRow;
    if (!row?.message_id) return;
    setMessages((prev) => {
      if (prev.some((m) => m.message_id === row.message_id)) return prev;
      return [row, ...prev];
    });
  }, []);

  const { connected } = useGameThreadSocket(gameId, onThreadMessage);

  useEffect(() => {
    onConnectionChange?.(connected);
  }, [connected, onConnectionChange]);

  const loadMessages = useCallback(async () => {
    setLoadError(null);
    setLoadingMessages(true);
    try {
      const rows = await getGameThread(gameId);
      const list = rows as GameThreadRow[];
      setMessages([...list].reverse());
      setSendError(null);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } }; message?: string };
      setLoadError(
        err?.response?.data?.detail || err?.message || t.chatsScreen.gameThreadMessagesError
      );
      setMessages([]);
    } finally {
      setLoadingMessages(false);
    }
  }, [gameId, t]);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  async function handleSend() {
    const content = newMessage.trim();
    if (!content || sendingMessage || archived) return;

    setSendingMessage(true);
    setNewMessage("");
    setSendError(null);
    try {
      await postGameThreadMessage(gameId, content);
      await loadMessages();
    } catch {
      setNewMessage(content);
      setLoadError(null);
      setSendError(t.chatsScreen.gameThreadMessagesError);
    } finally {
      setSendingMessage(false);
    }
  }

  const renderMessage = useCallback(
    ({ item: msg }: { item: GameThreadRow }) => {
      const isOwn = msg.user_id === user?.user_id;
      const isAI = msg.user_id === "ai_assistant";
      const isSystem = msg.type === "system";

      if (isSystem) {
        return (
          <View style={styles.systemWrap}>
            <View
              style={[
                styles.systemCard,
                {
                  backgroundColor: COLORS.glass.glowOrange,
                  borderColor: colors.border,
                },
              ]}
            >
              <Ionicons name="git-commit-outline" size={18} color={colors.warning} style={{ marginTop: 2 }} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Subhead style={{ color: colors.textPrimary, lineHeight: 22 }}>{msg.content}</Subhead>
                <Caption2 style={{ color: colors.textMuted, marginTop: SPACE.xs }}>
                  {formatMessageTime(msg.created_at)}
                </Caption2>
              </View>
            </View>
          </View>
        );
      }

      return (
        <View style={[styles.messageRow, isOwn && styles.messageRowOwn]}>
          {!isOwn && (
            <View style={styles.avatarContainer}>
              {isAI ? (
                <View style={[styles.aiAvatar, { backgroundColor: COLORS.glass.glowBlue }]}>
                  <Ionicons name="sparkles" size={16} color={colors.trustBlue} />
                </View>
              ) : (
                <View style={[styles.messageAvatar, { backgroundColor: COLORS.glass.glowBlue }]}>
                  <Caption2 style={{ color: colors.trustBlue, fontWeight: "700" }}>
                    {(msg.user?.name || "?")[0].toUpperCase()}
                  </Caption2>
                </View>
              )}
            </View>
          )}

          <View
            style={[
              styles.messageBubble,
              isOwn
                ? { backgroundColor: colors.buttonPrimary }
                : {
                    backgroundColor: isDark ? COLORS.glass.bg : colors.surfaceBackground,
                    borderColor: colors.border,
                    borderWidth: StyleSheet.hairlineWidth,
                  },
            ]}
          >
            {!isOwn && (
              <Footnote style={{ color: isAI ? colors.trustBlue : colors.textSecondary, marginBottom: 4, fontWeight: "600" }}>
                {isAI ? "Kvitt" : msg.user?.name || "Player"}
              </Footnote>
            )}
            <Subhead
              style={{
                color: isOwn ? colors.buttonText : colors.textPrimary,
                lineHeight: 22,
              }}
            >
              {msg.content}
            </Subhead>
            <Caption2
              style={{
                marginTop: SPACE.xs,
                textAlign: "right",
                color: isOwn ? colors.buttonText : colors.textMuted,
                opacity: isOwn ? 0.75 : 1,
              }}
            >
              {formatMessageTime(msg.created_at)}
            </Caption2>
          </View>
        </View>
      );
    },
    [colors, isDark, user?.user_id]
  );

  return (
    <View style={styles.flex}>
      {sendError && messages.length > 0 && (
        <View
          style={[
            styles.sendErrorBanner,
            {
              backgroundColor: COLORS.glass.glowRed,
              borderColor: colors.danger,
              marginHorizontal: sheetEmbedded ? 0 : SPACE.sm,
            },
          ]}
        >
          <Ionicons name="alert-circle-outline" size={18} color={colors.danger} style={{ marginTop: 1 }} />
          <Caption style={{ flex: 1, color: colors.textPrimary, lineHeight: 18 }}>{sendError}</Caption>
          <Pressable onPress={() => setSendError(null)} hitSlop={10} accessibilityLabel="Dismiss error">
            <Ionicons name="close" size={20} color={colors.textMuted} />
          </Pressable>
        </View>
      )}

      {showSettlementCta && (
        <Pressable
          onPress={() => navigation.navigate("Settlement", { gameId })}
          style={({ pressed }) => [
            styles.settlementCta,
            {
              borderColor: colors.border,
              backgroundColor: colors.inputBg,
              opacity: pressed ? 0.9 : 1,
              marginHorizontal: sheetEmbedded ? 0 : SPACE.sm,
            },
          ]}
        >
          <Ionicons name="receipt-outline" size={20} color={colors.trustBlue} />
          <Subhead style={{ color: colors.trustBlue, flex: 1 }}>{t.chatsScreen.gameThreadViewSettlement}</Subhead>
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </Pressable>
      )}

      {loadingMessages ? (
        <View style={[styles.loadingContainer, { paddingHorizontal: hPad }]}>
          <ActivityIndicator size="small" color={colors.trustBlue} />
          <Caption style={{ marginTop: SPACE.sm, color: colors.textSecondary }}>Loading timeline…</Caption>
        </View>
      ) : loadError && messages.length === 0 ? (
        <View style={[styles.emptyContainer, { paddingHorizontal: hPad }]}>
          <Ionicons name="cloud-offline-outline" size={40} color={colors.textMuted} />
          <Subhead style={{ marginTop: SPACE.md, textAlign: "center", color: colors.textPrimary }}>{loadError}</Subhead>
          <TouchableOpacity onPress={loadMessages} style={{ marginTop: SPACE.md }} hitSlop={12}>
            <Subhead style={{ color: colors.trustBlue }}>{t.chatsScreen.retry}</Subhead>
          </TouchableOpacity>
        </View>
      ) : messages.length === 0 ? (
        <View style={[styles.emptyContainer, { paddingHorizontal: hPad }]}>
          <Ionicons name="time-outline" size={44} color={colors.textMuted} />
          <Subhead style={{ marginTop: SPACE.md, textAlign: "center", color: colors.textPrimary }}>
            {t.chatsScreen.gameThreadEmptyTitle}
          </Subhead>
          <Caption
            style={{ marginTop: SPACE.sm, textAlign: "center", paddingHorizontal: sheetEmbedded ? 0 : LAYOUT.screenPadding }}
            color={colors.textSecondary}
          >
            {t.chatsScreen.gameThreadEmptyBody}
          </Caption>
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.message_id}
          renderItem={renderMessage}
          inverted
          style={styles.messageList}
          contentContainerStyle={[styles.messageListContent, { paddingHorizontal: hPad }]}
        />
      )}

      <View
        style={[
          styles.inputContainer,
          {
            backgroundColor: colors.surfaceBackground,
            borderTopColor: colors.border,
            paddingBottom: Math.max(insets.bottom, SPACE.md),
            paddingHorizontal: hPad,
          },
        ]}
      >
        {archived ? (
          <Caption style={{ textAlign: "center", paddingVertical: SPACE.sm, color: colors.textMuted }}>
            {t.chatsScreen.gameThreadArchived}
          </Caption>
        ) : (
          <>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: colors.inputBg,
                  color: colors.textPrimary,
                  borderColor: colors.border,
                  fontSize: APPLE_TYPO.subhead.size,
                  fontWeight: APPLE_TYPO.subhead.weight as "400",
                  lineHeight: Platform.OS === "ios" ? 20 : 20,
                },
              ]}
              placeholder={t.chatsScreen.gameThreadPlaceholder}
              placeholderTextColor={colors.textMuted}
              value={newMessage}
              onChangeText={(text) => {
                setNewMessage(text);
                if (sendError) setSendError(null);
              }}
              multiline
              maxLength={500}
              editable={!sendingMessage}
            />
            <TouchableOpacity
              style={[
                styles.sendButton,
                {
                  backgroundColor: colors.buttonPrimary,
                  width: LAYOUT.touchTarget,
                  height: LAYOUT.touchTarget,
                  borderRadius: LAYOUT.touchTarget / 2,
                },
                (!newMessage.trim() || sendingMessage) && styles.buttonDisabled,
              ]}
              onPress={handleSend}
              disabled={!newMessage.trim() || sendingMessage}
              activeOpacity={0.8}
              accessibilityLabel="Send message"
            >
              {sendingMessage ? (
                <ActivityIndicator size="small" color={colors.buttonText} />
              ) : (
                <Ionicons name="send" size={18} color={colors.buttonText} />
              )}
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    minHeight: 0,
  },
  settlementCta: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.sm,
    marginBottom: SPACE.sm,
    padding: SPACE.md,
    borderRadius: RADIUS.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  sendErrorBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: SPACE.sm,
    marginBottom: SPACE.sm,
    paddingVertical: SPACE.sm,
    paddingHorizontal: SPACE.md,
    borderRadius: RADIUS.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: LAYOUT.elementGap,
  },
  messageList: {
    flex: 1,
  },
  messageListContent: {
    paddingVertical: SPACE.md,
  },
  systemWrap: {
    marginBottom: SPACE.md,
    width: "100%",
  },
  systemCard: {
    flexDirection: "row",
    gap: SPACE.sm,
    padding: SPACE.md,
    borderRadius: RADIUS.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  messageRow: {
    flexDirection: "row",
    marginBottom: SPACE.md,
    alignItems: "flex-end",
  },
  messageRowOwn: {
    justifyContent: "flex-end",
  },
  avatarContainer: {
    marginRight: SPACE.sm,
  },
  aiAvatar: {
    width: AVATAR_SIZE.sm,
    height: AVATAR_SIZE.sm,
    borderRadius: AVATAR_SIZE.sm / 2,
    alignItems: "center",
    justifyContent: "center",
  },
  messageAvatar: {
    width: AVATAR_SIZE.sm,
    height: AVATAR_SIZE.sm,
    borderRadius: AVATAR_SIZE.sm / 2,
    alignItems: "center",
    justifyContent: "center",
  },
  messageBubble: {
    maxWidth: "78%",
    borderRadius: RADIUS.lg,
    padding: LAYOUT.cardPadding,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingVertical: SPACE.md,
    gap: LAYOUT.elementGap,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  input: {
    flex: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: RADIUS.lg,
    paddingHorizontal: LAYOUT.cardPadding,
    paddingVertical: SPACE.sm + 2,
    maxHeight: 100,
  },
  sendButton: {
    alignItems: "center",
    justifyContent: "center",
  },
  buttonDisabled: {
    opacity: 0.5,
  },
});
