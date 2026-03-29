import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Animated,
  LayoutAnimation,
  UIManager,
  Linking,
  Alert,
  type LayoutRectangle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { LinearGradient } from "expo-linear-gradient";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { api } from "../api/client";
import type { RootStackParamList } from "../navigation/RootNavigator";
import { useTheme } from "../context/ThemeContext";
import { useLanguage } from "../context/LanguageContext";
import { ANIMATION, PAGE_HERO_GRADIENT, pageHeroGradientColors } from "../styles/liquidGlass";
import { FONT, SPACE, LAYOUT, RADIUS, BUTTON_SIZE } from "../styles/tokens";
import { appleCardShadowResting } from "../styles/appleShadows";
import { KvittOrbMark } from "../components/ui/KvittOrbMark";
import {
  AssistantAvatar,
  PokerAIFeatureCTA,
  Headline,
  Title2,
  Title3,
  Subhead,
  Body,
  Footnote,
  Caption2,
  LiquidGlassPopup,
  type LiquidGlassPopupItem,
} from "../components/ui";
import { AnimatedModal } from "../components/AnimatedModal";
import {
  getPokerEntryDisclaimerAck,
  setPokerEntryDisclaimerAck,
} from "../utils/pokerAiAcknowledgements";
import { RichTextRenderer } from "../components/chat/RichTextRenderer";
import { MessageBubble } from "../components/chat/MessageBubble";
import { StructuredMessageRenderer } from "../components/chat/StructuredMessageRenderer";
import type { StructuredContent, FlowEvent } from "../components/chat/messageTypes";

// Enable LayoutAnimation on Android
if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

/** Frozen message body metrics (assistant/user bubbles) — do not change without sign-off */
const MESSAGE_BODY_FONT_SIZE = FONT.secondary.size;
const MESSAGE_BODY_LINE_HEIGHT = 20;

type Nav = NativeStackNavigationProp<RootStackParamList>;

type Message = {
  role: "user" | "assistant";
  content: string;
  error?: boolean;
  source?: string;
  navigation?: { screen: string; params?: Record<string, any> };
  followUps?: string[];
  structuredContent?: StructuredContent;
  agentActivity?: string;
  flowInteraction?: {
    selectedValue?: string;
    submittedText?: string;
    actedAction?: string;
  };
};

const CHAT_STORAGE_KEY = "kvitt_assistant_chat";

// Full pool of suggestions — shuffled per session, 5 shown at a time
const ALL_SUGGESTIONS = [
  "How do I create a group?",
  "How does buy-in work?",
  "How do I cash out?",
  "What is settlement?",
  "Poker hand rankings",
  "How do I start a game?",
  "What are my stats?",
  "Who owes me money?",
  "What do I owe?",
  "Any active games?",
  "Show my groups",
  "Any upcoming games?",
  "What's my total profit?",
  "How do rebuys work?",
  "How do I invite friends?",
  "Report an issue",
];

function shuffleArray<T>(arr: T[]): T[] {
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// Shuffled once per module load (= per session / page refresh)
const SUGGESTIONS = shuffleArray(ALL_SUGGESTIONS).slice(0, 5);

const WELCOME_MESSAGE =
  "Hi! I'm your Kvitt assistant. Ask me anything about the app — creating groups, games, buy-ins, settlements, or poker rules!";

/* ─── Gradient Orb Character ─── */
export function AIGradientOrb({ size = 28 }: { size?: number }) {
  return <KvittOrbMark size={size} variant="messaging" />;
}

/* ─── Typing Text Component ─── */
function TypingText({ text, style, onComplete }: { text: string; style?: any; onComplete?: () => void }) {
  const [displayedLength, setDisplayedLength] = useState(0);
  const cursorOpacity = useRef(new Animated.Value(1)).current;
  const isComplete = displayedLength >= text.length;

  useEffect(() => {
    const interval = setInterval(() => {
      setDisplayedLength((prev) => {
        if (prev >= text.length) {
          clearInterval(interval);
          return prev;
        }
        return prev + 1;
      });
    }, 25);

    return () => clearInterval(interval);
  }, [text]);

  // Fire onComplete AFTER render, when typing finishes
  useEffect(() => {
    if (isComplete) {
      onComplete?.();
    }
  }, [isComplete]);

  useEffect(() => {
    const blink = Animated.loop(
      Animated.sequence([
        Animated.timing(cursorOpacity, { toValue: 0, duration: 400, useNativeDriver: true }),
        Animated.timing(cursorOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
      ])
    );
    if (!isComplete) blink.start();
    return () => blink.stop();
  }, [isComplete]);

  return (
    <Text style={style}>
      {text.slice(0, displayedLength)}
      {!isComplete && (
        <Animated.Text style={{ opacity: cursorOpacity }}>|</Animated.Text>
      )}
    </Text>
  );
}

export function AIAssistantScreen() {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const { t } = useLanguage();
  const scrollRef = useRef<ScrollView>(null);

  // Welcome → Chat transition
  const [hasStarted, setHasStarted] = useState(false);
  const [welcomeTyped, setWelcomeTyped] = useState(false);

  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: WELCOME_MESSAGE,
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [requestsRemaining, setRequestsRemaining] = useState<number | null>(null);

  const lastAssistant = useMemo(
    () => [...messages].reverse().find((m) => m.role === "assistant" && !m.error),
    [messages]
  );
  const suggestionPool = useMemo(
    () => (lastAssistant?.followUps?.length ? lastAssistant.followUps! : SUGGESTIONS),
    [lastAssistant]
  );
  const suggestionSectionLabel = useMemo(() => {
    if (lastAssistant?.followUps?.length) return "Try asking:";
    return messages.length <= 2 ? "Quick questions:" : "Need help with:";
  }, [lastAssistant, messages.length]);

  const userBubbleBg = useMemo(
    () => (isDark ? "rgba(10, 132, 255, 0.42)" : "rgba(0, 122, 255, 0.2)"),
    [isDark]
  );

  // Visibility toggle state
  const [chatVisible, setChatVisible] = useState(true);

  // Entrance animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  // Welcome stagger
  const welcomeBubble = useRef(new Animated.Value(0)).current;
  const welcomeOrb = useRef(new Animated.Value(0)).current;
  const welcomeText = useRef(new Animated.Value(0)).current;
  const welcomeCta = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, ...ANIMATION.spring.bouncy }),
    ]).start();

    // Stagger welcome elements
    Animated.stagger(120, [
      Animated.spring(welcomeBubble, { toValue: 1, useNativeDriver: true, tension: 50, friction: 8 }),
      Animated.spring(welcomeOrb, { toValue: 1, useNativeDriver: true, tension: 50, friction: 8 }),
      Animated.spring(welcomeText, { toValue: 1, useNativeDriver: true, tension: 50, friction: 8 }),
      Animated.spring(welcomeCta, { toValue: 1, useNativeDriver: true, tension: 50, friction: 8 }),
    ]).start();
  }, []);

  // Fetch usage on mount
  useEffect(() => {
    api.get("/assistant/usage").then((res) => {
      setRequestsRemaining(res.data.requests_remaining);
    }).catch(() => {});
  }, []);

  // Restore chat history from storage
  useEffect(() => {
    AsyncStorage.getItem(CHAT_STORAGE_KEY).then((stored) => {
      if (!stored) return;
      try {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 1) {
          setMessages(parsed);
          setHasStarted(true);
          setWelcomeTyped(true);
        }
      } catch {
        // ignore corrupt data
      }
    });
  }, []);

  // Persist chat history (filter out error messages)
  useEffect(() => {
    if (messages.length <= 1) return;
    const safe = messages.filter((m) => !m.error);
    AsyncStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(safe));
  }, [messages]);

  useEffect(() => {
    if (chatVisible) {
      scrollRef.current?.scrollToEnd({ animated: true });
    }
  }, [messages, chatVisible]);

  const toggleChatVisibility = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setChatVisible((v) => !v);
  }, []);

  const sendMessage = async (text: string, flowEvent?: FlowEvent) => {
    if ((!text.trim() && !flowEvent) || loading) return;
    if (!hasStarted) setHasStarted(true);

    // For flow actions, mark the previous card's interaction state (read-only)
    if (flowEvent) {
      setMessages((prev) => {
        const updated = [...prev];
        const lastIdx = updated.length - 1;
        if (lastIdx >= 0 && updated[lastIdx].structuredContent) {
          updated[lastIdx] = {
            ...updated[lastIdx],
            flowInteraction: {
              selectedValue: flowEvent.action === "option_selected" ? flowEvent.value : undefined,
              submittedText: flowEvent.action === "text_submitted" ? flowEvent.value : undefined,
              actedAction: ["submit", "cancel"].includes(flowEvent.action) ? flowEvent.action : undefined,
            },
          };
        }
        return updated;
      });
    } else {
      const userMessage: Message = { role: "user", content: text };
      setMessages((prev) => [...prev, userMessage]);
    }

    setInput("");
    setLoading(true);

    if (!chatVisible) {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setChatVisible(true);
    }

    try {
      const conversationHistory = messages
        .filter((m) => !m.error)
        .slice(-20)
        .map((m) => ({ role: m.role, content: m.content }));

      const response = await api.post("/assistant/ask", {
        message: text,
        context: { current_page: "mobile_app" },
        conversation_history: conversationHistory,
        ...(flowEvent && { flow_event: flowEvent }),
      });
      const data = response.data;
      if (!data?.response) throw new Error("Invalid assistant response");

      // Thinking delay only for non-flow fast responses
      if (!flowEvent && (data.source === "quick_answer" || data.source === "fast_answer")) {
        await new Promise((r) => setTimeout(r, 1200));
      }

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: data.response,
          source: data.source,
          navigation: data.navigation,
          followUps: data.follow_ups,
          structuredContent: data.structured_content || undefined,
          agentActivity: data.agent_activity || undefined,
        },
      ]);
      if (data.requests_remaining !== undefined) {
        setRequestsRemaining(data.requests_remaining);
      }
    } catch (err: any) {
      if (err?.response?.status === 429) {
        const upgradeMsg = err.response.data?.upgrade_message || "Daily limit reached. Upgrade to Premium for more.";
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: upgradeMsg, error: true },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: "Sorry, I couldn't process that. Please try again later.",
            error: true,
          },
        ]);
      }
    } finally {
      setLoading(false);
    }
  };

  // Schema-driven param validation — prevents crashes on screens that require params
  const NAV_REQUIREMENTS: Record<string, string[]> = {
    GameNight: ["gameId"],
    GameThreadChat: ["gameId"],
    Settlement: ["gameId"],
    GroupHub: ["groupId"],
    GroupChat: ["groupId"],
  };

  const handleNavigation = (nav: { screen: string; params?: Record<string, any> }) => {
    const required = NAV_REQUIREMENTS[nav.screen];
    if (required) {
      const ok = required.every((k) => nav.params?.[k]);
      if (!ok) {
        navigation.navigate("MainTabs" as any, { screen: "Groups" });
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: "Opening Groups — pick a game from there to continue." },
        ]);
        return;
      }
    }
    navigation.navigate(nav.screen as any, nav.params as any);
  };

  const clearChat = useCallback(async () => {
    await AsyncStorage.removeItem(CHAT_STORAGE_KEY);
    setMessages([{ role: "assistant", content: WELCOME_MESSAGE }]);
    setHasStarted(false);
    setWelcomeTyped(false);
  }, []);

  const [chatOptionsOpen, setChatOptionsOpen] = useState(false);
  const [chatOptionsAnchor, setChatOptionsAnchor] = useState<LayoutRectangle | null>(null);
  const chatOptionsMeasureRef = useRef<View>(null);
  const [pokerGateVisible, setPokerGateVisible] = useState(false);

  const requestNewChat = useCallback(() => {
    if (messages.length > 1) {
      Alert.alert("New chat?", "This clears the current conversation.", [
        { text: "Cancel", style: "cancel" },
        { text: "Start over", style: "destructive", onPress: () => void clearChat() },
      ]);
    } else {
      void clearChat();
    }
  }, [messages.length, clearChat]);

  const openChatOptionsMenu = useCallback(() => {
    chatOptionsMeasureRef.current?.measureInWindow((x, y, width, height) => {
      setChatOptionsAnchor({ x, y, width, height });
      setChatOptionsOpen(true);
    });
  }, []);

  const chatOptionsItems: LiquidGlassPopupItem[] = useMemo(
    () => [
      { icon: "refresh-outline", label: "New chat", onPress: requestNewChat },
      {
        icon: chatVisible ? "eye-off-outline" : "eye-outline",
        label: chatVisible ? "Hide conversation" : "Show conversation",
        onPress: toggleChatVisibility,
        testID: "ai-chat-visibility-toggle",
      },
    ],
    [chatVisible, requestNewChat, toggleChatVisibility]
  );

  /** Poker gate: shown only until the user taps Proceed once (persisted per device). */
  const openPokerAIFromAssistant = useCallback(async () => {
    const ack = await getPokerEntryDisclaimerAck();
    if (ack) {
      navigation.navigate("PokerAI");
      return;
    }
    setPokerGateVisible(true);
  }, [navigation]);

  const confirmPokerEntryDisclaimer = useCallback(async () => {
    await setPokerEntryDisclaimerAck();
    setPokerGateVisible(false);
    navigation.navigate("PokerAI");
  }, [navigation]);

  return (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: colors.contentBg }]}>
      <LinearGradient
        pointerEvents="none"
        colors={pageHeroGradientColors(isDark)}
        locations={[...PAGE_HERO_GRADIENT.locations]}
        start={PAGE_HERO_GRADIENT.start}
        end={PAGE_HERO_GRADIENT.end}
        style={[
          styles.topGradient,
          {
            height: Math.min(PAGE_HERO_GRADIENT.maxHeight, insets.top + PAGE_HERO_GRADIENT.safeAreaPad),
          },
        ]}
      />

      {/* ── Header + featured Poker Agent row ── */}
      <Animated.View
        style={[
          styles.headerChrome,
          { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
        ]}
      >
        <View style={styles.headerRow}>
          <Pressable
            style={({ pressed }) => [
              styles.backPill,
              {
                backgroundColor: colors.glassBg,
                borderColor: colors.glassBorder,
                opacity: pressed ? 0.85 : 1,
              },
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
                  {t.ai.title}
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
              <Footnote style={{ color: colors.textMuted, marginTop: 2 }} numberOfLines={1}>
                {requestsRemaining !== null
                  ? `${requestsRemaining} requests left`
                  : chatVisible
                    ? "Ask me anything"
                    : `${messages.length - 1} message${messages.length - 1 !== 1 ? "s" : ""}`}
              </Footnote>
            </View>
          </View>

          {hasStarted ? (
            <View style={styles.headerTrailing}>
              <View ref={chatOptionsMeasureRef} collapsable={false}>
                <Pressable
                  onPress={openChatOptionsMenu}
                  style={({ pressed }) => [
                    styles.chatOptionsIconButton,
                    {
                      backgroundColor: pressed ? colors.inputBg : colors.glassBg,
                      borderColor: colors.glassBorder,
                    },
                    Platform.OS === "ios" && { borderCurve: "continuous" as const },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="More options"
                  testID="ai-chat-options-trigger"
                >
                  <Ionicons name="ellipsis-horizontal" size={22} color={colors.textPrimary} />
                </Pressable>
              </View>
            </View>
          ) : null}
        </View>

        <View style={styles.pokerFeatureRow}>
          <PokerAIFeatureCTA
            onPress={() => void openPokerAIFromAssistant()}
            title={t.ai.pokerFeatureTitle}
            subtitle={t.ai.pokerFeatureSubtitle}
            testID="ai-poker-ai-button"
          />
        </View>
      </Animated.View>

      {/* ── Welcome Screen ── */}
      {!hasStarted ? (
        <View style={styles.welcomeContainer}>
          {/* Speech bubble */}
          <Animated.View
            style={{
              opacity: welcomeBubble,
              transform: [
                {
                  translateY: welcomeBubble.interpolate({
                    inputRange: [0, 1],
                    outputRange: [10, 0],
                  }),
                },
              ],
            }}
          >
            <View
              style={[
                styles.speechBubble,
                { backgroundColor: colors.surface },
                appleCardShadowResting(isDark),
              ]}
            >
              <Headline style={{ color: colors.textPrimary }}>Hello!</Headline>
              <View style={[styles.speechBubbleTail, { backgroundColor: colors.surface }]} />
            </View>
          </Animated.View>

          {/* Assistant mark */}
          <Animated.View
            style={{
              opacity: welcomeOrb,
            }}
          >
            <AssistantAvatar size={120} breathAnim />
          </Animated.View>

          {/* Heading + subtitle */}
          <Animated.View
            style={{
              opacity: welcomeText,
              transform: [
                {
                  translateY: welcomeText.interpolate({
                    inputRange: [0, 1],
                    outputRange: [10, 0],
                  }),
                },
              ],
              alignItems: "center",
            }}
          >
            <Title2 style={{ textAlign: "center", color: colors.textPrimary }}>
              Your <Text style={{ color: colors.orange }}>Smart</Text> Assistant
            </Title2>
            <Title2 style={{ textAlign: "center", color: colors.textPrimary, marginTop: SPACE.xs }}>
              for Any Task
            </Title2>
            <Footnote style={{ textAlign: "center", color: colors.textMuted, marginTop: SPACE.sm }}>
              Instant help for planning, questions, and quick decisions.
            </Footnote>
          </Animated.View>

          {/* CTA */}
          <Animated.View
            style={{
              opacity: welcomeCta,
              transform: [
                {
                  translateY: welcomeCta.interpolate({
                    inputRange: [0, 1],
                    outputRange: [10, 0],
                  }),
                },
              ],
              width: "100%",
              paddingHorizontal: LAYOUT.screenPadding,
            }}
          >
            <TouchableOpacity
              style={[
                styles.ctaButton,
                {
                  backgroundColor: colors.buttonPrimary,
                  minHeight: LAYOUT.touchTarget,
                },
              ]}
              onPress={() => setHasStarted(true)}
              activeOpacity={0.9}
            >
              <Headline style={{ color: colors.buttonText }}>Get started</Headline>
              <Ionicons name="arrow-forward" size={18} color={colors.buttonText} />
            </TouchableOpacity>
          </Animated.View>
        </View>
      ) : (
        <>
          {/* ── Minimized bar ── */}
          {!chatVisible && (
            <TouchableOpacity
              style={[
                styles.minimizedBar,
                { backgroundColor: colors.inputBg, borderColor: colors.border },
              ]}
              onPress={toggleChatVisibility}
              activeOpacity={0.8}
              testID="ai-chat-show-bar"
            >
              <Ionicons name="chatbubble-ellipses-outline" size={18} color={colors.textSecondary} />
              <Subhead style={{ flex: 1, color: colors.textPrimary }}>
                {loading ? "Thinking..." : "Tap to show conversation"}
              </Subhead>
              {loading && <ActivityIndicator size="small" color={colors.textSecondary} />}
            </TouchableOpacity>
          )}

          {/* ── Chat body ── */}
          {chatVisible && (
            <KeyboardAvoidingView
              style={styles.keyboardView}
              behavior={Platform.OS === "ios" ? "padding" : undefined}
              keyboardVerticalOffset={0}
            >
              <LiquidGlassPopup
                visible={chatOptionsOpen}
                onClose={() => setChatOptionsOpen(false)}
                anchorLayout={chatOptionsAnchor}
                anchorSide="right"
                items={chatOptionsItems}
                width={268}
              />

              {/* Messages */}
              <ScrollView
                ref={scrollRef}
                style={styles.messagesContainer}
                contentContainerStyle={styles.messagesContent}
                showsVerticalScrollIndicator={false}
              >
                {messages.map((msg, i) => (
                  <View key={i}>
                    <Animated.View
                      style={[
                        styles.messageRow,
                        msg.role === "user" ? styles.messageRowUser : styles.messageRowAssistant,
                        { opacity: fadeAnim },
                      ]}
                    >
                      {msg.role === "assistant" && (
                        <View style={styles.avatarBot}>
                          <AssistantAvatar size={28} breathAnim={false} subtlePulse />
                        </View>
                      )}
                      <MessageBubble
                        role={
                          msg.error ? "error" : msg.role === "user" ? "user" : "assistant"
                        }
                        backgroundColor={
                          msg.error
                            ? isDark
                              ? "rgba(255, 59, 48, 0.12)"
                              : "rgba(255, 59, 48, 0.08)"
                            : msg.role === "user"
                              ? userBubbleBg
                              : colors.inputBg
                        }
                        borderColor={msg.error ? `${colors.danger}55` : undefined}
                        elevated={!msg.error && msg.role === "assistant"}
                      >
                        {i === 0 && msg.role === "assistant" && !welcomeTyped ? (
                          <TypingText
                            text={msg.content}
                            style={[styles.messageText, { color: colors.textPrimary }]}
                            onComplete={() => setWelcomeTyped(true)}
                          />
                        ) : msg.role === "assistant" && !msg.error ? (
                          <RichTextRenderer
                            text={msg.content}
                            baseStyle={[styles.messageText, { color: colors.textPrimary }]}
                            highlightColor={isDark ? "#5AC8FA" : colors.trustBlue}
                          />
                        ) : (
                          <Text
                            style={[
                              styles.messageText,
                              {
                                color:
                                  msg.role === "user"
                                    ? isDark
                                      ? "#FFFFFF"
                                      : colors.textPrimary
                                    : colors.textPrimary,
                              },
                            ]}
                          >
                            {msg.content}
                          </Text>
                        )}
                        {(msg.source === "quick_answer" || msg.source === "fast_answer") && (
                          <Caption2 style={{ marginTop: SPACE.xs, color: colors.textMuted }}>⚡ Instant</Caption2>
                        )}
                      </MessageBubble>
                      {msg.role === "user" && (
                        <View style={[styles.avatarUser, { backgroundColor: colors.trustBlue }]}>
                          <Ionicons name="person" size={12} color="#FFFFFF" />
                        </View>
                      )}
                    </Animated.View>

                    {/* Agent activity chip */}
                    {msg.agentActivity && (
                      <View
                        style={[
                          styles.agentActivityChip,
                          {
                            backgroundColor: isDark ? "rgba(10, 132, 255, 0.2)" : "rgba(0, 122, 255, 0.12)",
                          },
                        ]}
                      >
                        <Ionicons name="chatbubble-ellipses-outline" size={12} color={colors.trustBlue} />
                        <Caption2 style={{ fontWeight: "600", color: colors.trustBlue }}>{msg.agentActivity}</Caption2>
                      </View>
                    )}

                    {/* Structured content card */}
                    {msg.structuredContent && (
                      <View style={styles.structuredCardContainer}>
                        <StructuredMessageRenderer
                          content={msg.structuredContent}
                          isLatest={i === messages.length - 1 && !loading}
                          onFlowAction={(event) => {
                            // Handle email/link actions directly
                            if (event.action.startsWith("email:")) {
                              Linking.openURL(`mailto:${event.action.replace("email:", "")}`);
                              return;
                            }
                            if (event.action.startsWith("link:")) {
                              Linking.openURL(event.action.replace("link:", ""));
                              return;
                            }
                            sendMessage(event.value, event);
                          }}
                          selectedValue={msg.flowInteraction?.selectedValue}
                          submittedText={msg.flowInteraction?.submittedText}
                          actedAction={msg.flowInteraction?.actedAction}
                        />
                      </View>
                    )}

                    {/* Navigation button */}
                    {msg.navigation && (
                      <TouchableOpacity
                        style={[
                          styles.navButton,
                          {
                            backgroundColor: isDark ? "rgba(10, 132, 255, 0.2)" : "rgba(0, 122, 255, 0.12)",
                            borderColor: colors.border,
                          },
                        ]}
                        onPress={() => handleNavigation(msg.navigation!)}
                        activeOpacity={0.7}
                      >
                        <Ionicons name="arrow-forward-circle" size={18} color={colors.trustBlue} />
                        <Caption2 style={{ fontWeight: "600", color: colors.trustBlue }}>
                          Go to {msg.navigation.screen} →
                        </Caption2>
                      </TouchableOpacity>
                    )}

                  </View>
                ))}

                {loading && (
                  <View style={[styles.messageRow, styles.messageRowAssistant]}>
                    <View style={styles.avatarBot}>
                      <AssistantAvatar size={28} breathAnim />
                    </View>
                    <MessageBubble role="assistant" backgroundColor={colors.inputBg} elevated>
                      <ActivityIndicator size="small" color={colors.textSecondary} />
                    </MessageBubble>
                  </View>
                )}
              </ScrollView>

              {/* Suggestions + API follow-ups — fixed above composer */}
              {!loading && (
                <View style={[styles.suggestionsContainer, { borderTopColor: colors.border }]}>
                  <Caption2
                    style={{
                      letterSpacing: 0.2,
                      fontWeight: "600",
                      color: colors.textSecondary,
                      marginBottom: SPACE.sm,
                    }}
                  >
                    {suggestionSectionLabel}
                  </Caption2>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.suggestionsList}
                  >
                    {suggestionPool.map((s, idx) => (
                      <TouchableOpacity
                        key={`${idx}-${s}`}
                        style={[
                          styles.suggestionChip,
                          {
                            backgroundColor: "transparent",
                            borderColor: colors.border,
                            minHeight: LAYOUT.touchTarget,
                          },
                          Platform.OS === "ios" && { borderCurve: "continuous" as const },
                        ]}
                        onPress={() => sendMessage(s)}
                        activeOpacity={0.85}
                      >
                        <Subhead
                          numberOfLines={2}
                          style={{ color: colors.textPrimary, maxWidth: 220 }}
                        >
                          {s}
                        </Subhead>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}

              {/* Input */}
              <View style={[styles.composerTopRule, { backgroundColor: colors.border }]} />
              <View
                style={[
                  styles.inputContainer,
                  { paddingBottom: insets.bottom + SPACE.lg, backgroundColor: colors.contentBg },
                ]}
              >
                <View
                  style={[
                    styles.inputWrapper,
                    {
                      backgroundColor: colors.surface,
                      borderColor: isDark ? "rgba(255,255,255,0.22)" : "#C7C7CC",
                      borderWidth: 1.5,
                      ...Platform.select({
                        ios: {
                          shadowColor: "#000",
                          shadowOffset: { width: 0, height: 1 },
                          shadowOpacity: isDark ? 0.35 : 0.1,
                          shadowRadius: 4,
                        },
                        android: { elevation: 4 },
                      }),
                    },
                  ]}
                >
                  <TextInput
                    style={[styles.input, { color: colors.textPrimary }]}
                    value={input}
                    onChangeText={setInput}
                    placeholder="Message Kvitt..."
                    placeholderTextColor={colors.textMuted}
                    editable={!loading}
                    onSubmitEditing={() => sendMessage(input)}
                    returnKeyType="send"
                  />
                  <TouchableOpacity
                    style={[
                      styles.sendButton,
                      {
                        width: BUTTON_SIZE.regular.height,
                        height: BUTTON_SIZE.regular.height,
                        borderRadius: RADIUS.lg,
                        backgroundColor: colors.buttonPrimary,
                      },
                      (!input.trim() || loading) && {
                        backgroundColor: colors.inputBg,
                      },
                    ]}
                    onPress={() => sendMessage(input)}
                    disabled={!input.trim() || loading}
                    activeOpacity={0.8}
                  >
                    <Ionicons
                      name="send"
                      size={20}
                      color={!input.trim() || loading ? colors.textMuted : colors.buttonText}
                    />
                  </TouchableOpacity>
                </View>
              </View>
            </KeyboardAvoidingView>
          )}
        </>
      )}

      <AnimatedModal visible={pokerGateVisible} onClose={() => setPokerGateVisible(false)}>
        <View
          style={[
            styles.pokerGateCard,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
            },
            appleCardShadowResting(isDark),
            Platform.OS === "ios" && { borderCurve: "continuous" as const },
          ]}
        >
          <Title3 style={{ color: colors.textPrimary }}>{t.ai.pokerGateTitle}</Title3>
          <ScrollView
            style={styles.pokerGateScroll}
            showsVerticalScrollIndicator={false}
            nestedScrollEnabled
          >
            <Body style={{ color: colors.textSecondary }}>{t.ai.pokerGateBody}</Body>
          </ScrollView>
          <Pressable
            onPress={() => void confirmPokerEntryDisclaimer()}
            style={({ pressed }) => [
              styles.pokerGatePrimary,
              {
                backgroundColor: colors.buttonPrimary,
                opacity: pressed ? 0.88 : 1,
              },
              Platform.OS === "ios" && { borderCurve: "continuous" as const },
            ]}
            accessibilityRole="button"
            accessibilityLabel={t.ai.pokerGateContinue}
          >
            <Headline style={{ color: colors.buttonText, textAlign: "center" }} numberOfLines={3}>
              {t.ai.pokerGateContinue}
            </Headline>
          </Pressable>
        </View>
      </AnimatedModal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  pokerGateCard: {
    borderRadius: RADIUS.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: SPACE.lg,
    gap: SPACE.md,
  },
  pokerGateScroll: {
    maxHeight: 280,
  },
  pokerGatePrimary: {
    minHeight: LAYOUT.touchTarget,
    borderRadius: RADIUS.lg,
    paddingHorizontal: SPACE.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  topGradient: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 0,
  },
  headerChrome: {
    zIndex: 1,
    paddingBottom: SPACE.md,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: LAYOUT.screenPadding,
    paddingTop: SPACE.md,
    gap: SPACE.sm,
  },
  pokerFeatureRow: {
    paddingHorizontal: LAYOUT.screenPadding,
    paddingTop: SPACE.lg,
    marginTop: SPACE.sm,
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
    flexDirection: "column",
    alignItems: "stretch",
    justifyContent: "center",
    minWidth: 0,
  },
  headerTitleBlock: {
    flex: 1,
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
  headerTrailing: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.sm,
  },
  chatOptionsIconButton: {
    width: LAYOUT.touchTarget,
    height: LAYOUT.touchTarget,
    borderRadius: RADIUS.full,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },
  composerTopRule: {
    height: StyleSheet.hairlineWidth,
    width: "100%",
  },

  /* ── Welcome Screen ── */
  welcomeContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: SPACE.xxxl,
    paddingHorizontal: LAYOUT.screenPadding,
  },
  speechBubble: {
    paddingHorizontal: SPACE.lg,
    paddingVertical: SPACE.sm + SPACE.xs,
    borderRadius: RADIUS.lg,
    marginBottom: SPACE.lg,
  },
  speechBubbleTail: {
    position: "absolute",
    bottom: -6,
    left: "50%",
    marginLeft: -6,
    width: 12,
    height: 12,
    transform: [{ rotate: "45deg" }],
  },
  ctaButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACE.sm,
    paddingVertical: SPACE.md,
    borderRadius: RADIUS.full,
    width: "100%",
  },

  /* ── Minimized state ── */
  minimizedBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.sm,
    margin: LAYOUT.screenPadding,
    padding: SPACE.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: RADIUS.xl,
    minHeight: LAYOUT.touchTarget,
  },

  /* ── Chat ── */
  keyboardView: { flex: 1 },
  messagesContainer: { flex: 1 },
  messagesContent: {
    paddingHorizontal: LAYOUT.screenPadding,
    paddingTop: SPACE.sm,
    paddingBottom: SPACE.xxl,
    gap: LAYOUT.elementGap,
  },
  messageRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: SPACE.sm,
  },
  messageRowUser: { justifyContent: "flex-end" },
  messageRowAssistant: { justifyContent: "flex-start" },
  avatarBot: {
    width: 28,
    height: 28,
    borderRadius: RADIUS.md,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarUser: {
    width: 28,
    height: 28,
    borderRadius: RADIUS.md,
    alignItems: "center",
    justifyContent: "center",
  },
  messageText: {
    fontSize: MESSAGE_BODY_FONT_SIZE,
    lineHeight: MESSAGE_BODY_LINE_HEIGHT,
  },
  structuredCardContainer: {
    marginTop: SPACE.sm,
    marginLeft: 36,
    maxWidth: "88%",
  },
  agentActivityChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.xs,
    marginLeft: 36,
    marginTop: SPACE.sm,
    paddingVertical: SPACE.xs,
    paddingHorizontal: SPACE.sm,
    borderRadius: RADIUS.full,
    alignSelf: "flex-start",
  },
  navButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.sm,
    marginLeft: 36,
    marginTop: SPACE.sm,
    paddingVertical: SPACE.sm,
    paddingHorizontal: SPACE.md,
    borderRadius: RADIUS.full,
    alignSelf: "flex-start",
    borderWidth: StyleSheet.hairlineWidth,
    minHeight: LAYOUT.touchTarget,
  },
  /* ── Suggestions ── */
  suggestionsContainer: {
    paddingHorizontal: LAYOUT.screenPadding,
    paddingTop: SPACE.md,
    paddingBottom: SPACE.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  suggestionsList: {
    gap: SPACE.sm,
    alignItems: "stretch",
    paddingVertical: SPACE.xs,
    paddingRight: LAYOUT.screenPadding,
  },
  suggestionChip: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: RADIUS.xl,
    paddingVertical: SPACE.md,
    paddingHorizontal: SPACE.lg,
    justifyContent: "center",
    maxWidth: 280,
  },

  /* ── Input ── */
  inputContainer: {
    paddingHorizontal: LAYOUT.screenPadding,
    paddingTop: SPACE.md,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: RADIUS.xl,
    paddingLeft: SPACE.lg,
    paddingRight: SPACE.xs,
    minHeight: LAYOUT.touchTarget,
  },
  input: {
    flex: 1,
    fontSize: FONT.body.size,
    paddingVertical: SPACE.md,
  },
  sendButton: {
    alignItems: "center",
    justifyContent: "center",
    marginVertical: SPACE.xs,
  },
});

export default AIAssistantScreen;
