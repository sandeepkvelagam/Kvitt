import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  Text,
  View,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useTheme } from "../../context/ThemeContext";
import { getThemedColors } from "../../styles/liquidGlass";
import { LAYOUT, SPACE, RADIUS, APPLE_TYPO, AVATAR_SIZE } from "../../styles/tokens";
import { Subhead, Footnote, Caption, Caption2 } from "../ui";
import { useAuth } from "../../context/AuthContext";
import {
  getGroupMessages,
  postGroupMessage,
  voteOnPoll,
  closePoll,
  getPoll,
} from "../../api/groupMessages";
import { useGroupSocket, type GroupMessage } from "../../hooks/useGroupSocket";
import { PollCard } from "../PollCard";

function KvittOrb({ size = 32 }: { size?: number }) {
  const showEyes = size >= 40;
  const eyeSize = Math.max(size * 0.08, 3);
  const eyeTop = size * 0.38;
  const eyeGap = size * 0.14;
  const highlightSize = size * 0.35;

  return (
    <View style={{ width: size, height: size }}>
      <LinearGradient
        colors={["#FF8C42", "#FF6EA8", "#EE6C29"]}
        start={{ x: 0.3, y: 0.3 }}
        end={{ x: 0.7, y: 0.9 }}
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
        }}
      >
        <View
          style={{
            position: "absolute",
            top: size * 0.12,
            left: size * 0.15,
            width: highlightSize,
            height: highlightSize,
            borderRadius: highlightSize / 2,
            backgroundColor: "rgba(255,255,255,0.25)",
            transform: [{ rotate: "-30deg" }, { scaleX: 0.8 }],
          }}
        />
        {showEyes && (
          <>
            <View
              style={{
                position: "absolute",
                top: eyeTop,
                left: size / 2 - eyeGap - eyeSize,
                width: eyeSize,
                height: eyeSize,
                backgroundColor: "#fff",
                transform: [{ rotate: "45deg" }],
              }}
            />
            <View
              style={{
                position: "absolute",
                top: eyeTop,
                left: size / 2 + eyeGap,
                width: eyeSize,
                height: eyeSize,
                backgroundColor: "#fff",
                transform: [{ rotate: "45deg" }],
              }}
            />
          </>
        )}
      </LinearGradient>
    </View>
  );
}

function formatMessageTime(dateStr: string) {
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

export type GroupChatMessagesPanelProps = {
  groupId: string;
  /** When false, hides the privacy reminder banner (e.g. game thread screen). */
  showPrivacyBanner?: boolean;
  isAdmin: boolean;
  /** Input placeholder override */
  messagePlaceholder?: string;
  /** For parent header (e.g. GroupChat) without a second socket. */
  onConnectionChange?: (connected: boolean) => void;
};

export function GroupChatMessagesPanel({
  groupId,
  showPrivacyBanner = true,
  isAdmin,
  messagePlaceholder = "Type a message...",
  onConnectionChange,
}: GroupChatMessagesPanelProps) {
  const insets = useSafeAreaInsets();
  const { isDark, colors } = useTheme();
  const lc = getThemedColors(isDark, colors);
  const { user } = useAuth();
  const flatListRef = useRef<FlatList>(null);

  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [votingPoll, setVotingPoll] = useState<string | null>(null);
  const [bannerDismissed, setBannerDismissed] = useState(true);
  const [polls, setPolls] = useState<Record<string, any>>({});

  const onSocketMessage = useCallback((msg: GroupMessage) => {
    setMessages((prev) => {
      if (prev.some((m) => m.message_id === msg.message_id)) return prev;
      return [msg, ...prev];
    });
  }, []);

  const { connected, typingUsers, emitTyping } = useGroupSocket(groupId, onSocketMessage);

  useEffect(() => {
    onConnectionChange?.(connected);
  }, [connected, onConnectionChange]);

  useEffect(() => {
    loadMessages();
    checkBanner();
  }, [groupId]);

  async function checkBanner() {
    const key = `kvitt-banner-dismissed-${groupId}`;
    const dismissed = await AsyncStorage.getItem(key);
    setBannerDismissed(dismissed === "true");
  }

  async function dismissBanner() {
    const key = `kvitt-banner-dismissed-${groupId}`;
    await AsyncStorage.setItem(key, "true");
    setBannerDismissed(true);
  }

  async function loadMessages() {
    setLoadingMessages(true);
    let fetched: GroupMessage[] = [];
    try {
      const msgs = await getGroupMessages(groupId, 50);
      fetched = [...msgs].reverse();
      setMessages(fetched);
      setHasMore(msgs.length >= 50);
    } catch {
      // keep list empty / prior state
    } finally {
      setLoadingMessages(false);
    }

    // Don’t block the chat UI on poll hydration — loads in parallel after messages show.
    const pollMsgIds = [
      ...new Set(
        fetched
          .filter((m: any) => m.metadata?.poll_id)
          .map((m: any) => m.metadata.poll_id as string)
      ),
    ];
    if (pollMsgIds.length === 0) return;

    const results = await Promise.all(
      pollMsgIds.map(async (pollId) => {
        try {
          const poll = await getPoll(groupId, pollId);
          return [pollId, poll] as const;
        } catch {
          return null;
        }
      })
    );
    setPolls((prev) => {
      const next = { ...prev };
      for (const row of results) {
        if (row) next[row[0]] = row[1];
      }
      return next;
    });
  }

  async function loadOlderMessages() {
    if (loadingMore || !hasMore || messages.length === 0) return;
    const oldest = messages[messages.length - 1];
    try {
      setLoadingMore(true);
      const older = await getGroupMessages(groupId, 50, oldest.message_id);
      if (older.length < 50) setHasMore(false);
      setMessages((prev) => [...prev, ...older.reverse()]);
    } catch {
      // silent
    } finally {
      setLoadingMore(false);
    }
  }

  async function handleSend() {
    const content = newMessage.trim();
    if (!content || sendingMessage) return;

    setSendingMessage(true);
    setNewMessage("");
    try {
      const result = await postGroupMessage(groupId, content);
      const optimistic: GroupMessage = {
        message_id: result.message_id,
        group_id: groupId,
        user_id: user?.user_id ?? "",
        content,
        type: "user",
        created_at: new Date().toISOString(),
        user: { user_id: user?.user_id ?? "", name: user?.name ?? "You" },
      };
      setMessages((prev) => {
        if (prev.some((m) => m.message_id === result.message_id)) return prev;
        return [optimistic, ...prev];
      });
    } catch {
      setNewMessage(content);
    } finally {
      setSendingMessage(false);
    }
  }

  async function handleVote(pollId: string, optionId: string) {
    setVotingPoll(pollId);
    try {
      const result = await voteOnPoll(groupId, pollId, optionId);
      if (result.poll) {
        setPolls((prev) => ({ ...prev, [pollId]: result.poll }));
      }
    } catch {
      // silent
    } finally {
      setVotingPoll(null);
    }
  }

  async function handleClosePoll(pollId: string) {
    try {
      await closePoll(groupId, pollId);
      const poll = await getPoll(groupId, pollId);
      setPolls((prev) => ({ ...prev, [pollId]: poll }));
    } catch {
      // silent
    }
  }

  function handleTextChange(text: string) {
    setNewMessage(text);
    if (text.length > 0 && user?.name) {
      emitTyping(user.name);
    }
  }

  const activeTyping = typingUsers.filter((t) => t.user_id !== user?.user_id);

  const renderMessage = useCallback(
    ({ item: msg }: { item: GroupMessage }) => {
      const isOwn = msg.user_id === user?.user_id;
      const isAI = msg.user_id === "ai_assistant";
      const isSystem = msg.type === "system";

      if (isSystem) {
        return (
          <View style={styles.systemRow}>
            <Caption style={{ fontStyle: "italic", textAlign: "center" }} color={colors.textSecondary}>
              {msg.content}
            </Caption>
          </View>
        );
      }

      const pollId = msg.metadata?.poll_id;
      const pollData = pollId ? polls[pollId] : null;

      return (
        <View style={[styles.messageRow, isOwn && styles.messageRowOwn]}>
          {!isOwn && (
            <View style={styles.avatarContainer}>
              {isAI ? (
                <KvittOrb size={AVATAR_SIZE.sm} />
              ) : (
                <View style={[styles.messageAvatar, { backgroundColor: lc.glowBlue }]}>
                  <Text style={[styles.messageAvatarText, { color: lc.trustBlue }]}>
                    {(msg.user?.name || "?")[0].toUpperCase()}
                  </Text>
                </View>
              )}
            </View>
          )}

          <View
            style={[
              styles.messageBubble,
              isOwn
                ? { backgroundColor: lc.trustBlue }
                : {
                    backgroundColor: lc.liquidGlassBg,
                    borderColor: lc.liquidGlassBorder,
                    borderWidth: 1,
                  },
            ]}
          >
            {!isOwn && (
              <Footnote bold color={isAI ? colors.orange : colors.trustBlue} style={{ marginBottom: 2 }}>
                {isAI ? "Kvitt" : msg.user?.name || "Player"}
              </Footnote>
            )}
            <Subhead
              color={isOwn ? "#fff" : colors.textPrimary}
              style={styles.messageBodyLine}
            >
              {msg.content}
            </Subhead>

            {pollData && (
              <PollCard
                poll={pollData}
                groupId={groupId}
                currentUserId={user?.user_id || ""}
                isAdmin={isAdmin}
                onVote={handleVote}
                onClose={handleClosePoll}
                voting={votingPoll === pollId}
                compact
              />
            )}

            <Caption2
              style={{ marginTop: SPACE.xs, textAlign: "right" }}
              color={isOwn ? "rgba(255,255,255,0.72)" : colors.textMuted}
            >
              {formatMessageTime(msg.created_at)}
            </Caption2>
          </View>
        </View>
      );
    },
    [lc, colors, user, isAdmin, polls, votingPoll, groupId]
  );

  return (
    <View style={styles.flex}>
      {showPrivacyBanner && !bannerDismissed && (
        <View
          style={[
            styles.banner,
            { backgroundColor: colors.liquidGlassBg, borderColor: colors.border },
          ]}
        >
          <Ionicons name="shield-checkmark" size={16} color={colors.textSecondary} />
          <Footnote style={styles.bannerText} color={colors.textSecondary}>
            Avoid sharing sensitive info in chat. Kvitt can help without it.
          </Footnote>
          <TouchableOpacity onPress={dismissBanner} hitSlop={12} accessibilityLabel="Dismiss">
            <Ionicons name="close" size={20} color={colors.textMuted} />
          </TouchableOpacity>
        </View>
      )}

      {loadingMessages ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={colors.trustBlue} />
          <Caption style={{ marginTop: SPACE.sm }}>Loading messages…</Caption>
        </View>
      ) : messages.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="chatbubbles-outline" size={40} color={colors.textMuted} />
          <Subhead bold style={{ marginTop: SPACE.md, textAlign: "center", color: colors.textPrimary }}>
            No messages yet
          </Subhead>
          <Caption
            style={{ marginTop: SPACE.xs, textAlign: "center", paddingHorizontal: LAYOUT.screenPadding }}
            color={colors.textSecondary}
          >
            Start planning your next game!
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
          contentContainerStyle={styles.messageListContent}
          onEndReached={loadOlderMessages}
          onEndReachedThreshold={0.3}
          ListFooterComponent={
            loadingMore ? (
              <ActivityIndicator size="small" color={colors.trustBlue} style={{ padding: LAYOUT.cardPadding }} />
            ) : null
          }
        />
      )}

      {activeTyping.length > 0 && (
        <View style={[styles.typingBar, { backgroundColor: colors.liquidGlassBg }]}>
          <Caption style={{ fontStyle: "italic" }} color={colors.textSecondary}>
            {activeTyping.length === 1
              ? `${activeTyping[0].user_name} is typing…`
              : `${activeTyping.length} people typing…`}
          </Caption>
        </View>
      )}

      <View
        style={[
          styles.inputContainer,
          {
            backgroundColor: colors.surfaceBackground,
            borderTopColor: colors.border,
            paddingBottom: Math.max(insets.bottom, SPACE.md),
          },
        ]}
      >
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
          placeholder={messagePlaceholder}
          placeholderTextColor={colors.textMuted}
          value={newMessage}
          onChangeText={handleTextChange}
          multiline
          maxLength={500}
        />
        <TouchableOpacity
          style={[
            styles.sendButton,
            {
              backgroundColor: colors.trustBlue,
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
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Ionicons name="send" size={18} color="#fff" />
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    minHeight: 0,
  },
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: LAYOUT.elementGap,
    marginHorizontal: LAYOUT.screenPadding,
    marginTop: SPACE.sm,
    padding: LAYOUT.cardPadding,
    borderRadius: RADIUS.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  bannerText: {
    flex: 1,
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
    paddingHorizontal: LAYOUT.screenPadding,
  },
  messageList: {
    flex: 1,
  },
  messageListContent: {
    paddingHorizontal: LAYOUT.screenPadding,
    paddingVertical: SPACE.md,
  },
  systemRow: {
    alignItems: "center",
    paddingVertical: SPACE.sm,
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
  messageAvatar: {
    width: AVATAR_SIZE.sm,
    height: AVATAR_SIZE.sm,
    borderRadius: AVATAR_SIZE.sm / 2,
    alignItems: "center",
    justifyContent: "center",
  },
  messageAvatarText: {
    fontSize: APPLE_TYPO.footnote.size,
    fontWeight: "600",
  },
  messageBubble: {
    maxWidth: "75%",
    borderRadius: RADIUS.lg,
    padding: LAYOUT.cardPadding,
  },
  messageBodyLine: {
    lineHeight: 20,
  },
  typingBar: {
    paddingHorizontal: LAYOUT.screenPadding,
    paddingVertical: SPACE.xs,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
    padding: SPACE.md,
    paddingHorizontal: LAYOUT.screenPadding,
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
