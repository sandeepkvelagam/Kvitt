import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import {
  Text,
  View,
  ScrollView,
  AppState,
  AppStateStatus,
  StyleSheet,
  Pressable,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Animated,
  Alert,
  Dimensions,
  RefreshControl,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Path, Defs, LinearGradient as SvgLinearGradient, Stop, Circle, Line as SvgLine } from "react-native-svg";
import { RouteProp, useRoute, useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { api, getGame, getGameThread } from "../api/games";
import { GameThreadMessagesPanel } from "../components/game/GameThreadMessagesPanel";
import { useTheme } from "../context/ThemeContext";
import { COLORS, PAGE_HERO_GRADIENT, pageHeroGradientColors } from "../styles/liquidGlass";
import { SPACE, LAYOUT, RADIUS, BUTTON_SIZE, ICON_WELL, APPLE_TYPO } from "../styles/tokens";
import { appleCardShadowResting } from "../styles/appleShadows";
import {
  Title1,
  Title2,
  Headline,
  Subhead,
  Footnote,
  Caption2,
  Label,
} from "../components/ui";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import type { RootStackParamList } from "../navigation/RootNavigator";
import type { Socket } from "socket.io-client";
import { createSocket } from "../lib/socket";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

type Nav = NativeStackNavigationProp<RootStackParamList>;
type R = RouteProp<RootStackParamList, "GameNight">;

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const SCREEN_PAD = LAYOUT.screenPadding;
const BUY_IN_OPTIONS = [5, 10, 20, 50, 100];
const TAB_BAR_RESERVE_BASE = 90;
/** Android RefreshControl offset — matches Dashboard V3 */
const HEADER_ROW_APPROX = 52;

const SUIT_SYMBOLS = ["♠", "♥", "♦", "♣"] as const;

// Poker hand rankings data
const HAND_RANKINGS = [
  { rank: 1, name: "Royal Flush", desc: "A, K, Q, J, 10, all same suit", example: "A♠ K♠ Q♠ J♠ 10♠" },
  { rank: 2, name: "Straight Flush", desc: "Five consecutive cards, same suit", example: "9♥ 8♥ 7♥ 6♥ 5♥" },
  { rank: 3, name: "Four of a Kind", desc: "Four cards of same rank", example: "K♠ K♥ K♦ K♣ 2♠" },
  { rank: 4, name: "Full House", desc: "Three of a kind + a pair", example: "J♠ J♥ J♦ 8♣ 8♠" },
  { rank: 5, name: "Flush", desc: "Five cards of same suit", example: "A♣ J♣ 8♣ 6♣ 2♣" },
  { rank: 6, name: "Straight", desc: "Five consecutive cards", example: "10♠ 9♥ 8♦ 7♣ 6♠" },
  { rank: 7, name: "Three of a Kind", desc: "Three cards of same rank", example: "7♠ 7♥ 7♦ K♣ 2♠" },
  { rank: 8, name: "Two Pair", desc: "Two different pairs", example: "Q♠ Q♥ 5♦ 5♣ 2♠" },
  { rank: 9, name: "One Pair", desc: "Two cards of same rank", example: "10♠ 10♥ A♦ 8♣ 4♠" },
  { rank: 10, name: "High Card", desc: "Highest card plays", example: "A♠ J♥ 8♦ 6♣ 2♠" },
];

export function GameNightScreen() {
  const { isDark, colors } = useTheme();
  const { user } = useAuth();
  const { t } = useLanguage();
  const route = useRoute<R>();
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { gameId } = route.params;

  const socketRef = useRef<Socket | null>(null);
  const [snapshot, setSnapshot] = useState<any>(null);
  const [connected, setConnected] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Duration timer
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Buy-in sheet state
  const [showBuyInSheet, setShowBuyInSheet] = useState(false);
  const [buyInAmount, setBuyInAmount] = useState(20);
  const [submittingBuyIn, setSubmittingBuyIn] = useState(false);

  // Cash-out sheet state
  const [showCashOutSheet, setShowCashOutSheet] = useState(false);
  const [cashOutChips, setCashOutChips] = useState("");
  const [submittingCashOut, setSubmittingCashOut] = useState(false);

  // Admin buy-in dialog state
  const [showAdminBuyInSheet, setShowAdminBuyInSheet] = useState(false);
  const [selectedPlayerForBuyIn, setSelectedPlayerForBuyIn] = useState<string | null>(null);
  const [adminBuyInAmount, setAdminBuyInAmount] = useState(20);
  const [submittingAdminBuyIn, setSubmittingAdminBuyIn] = useState(false);

  // Admin cash-out dialog state
  const [showAdminCashOutSheet, setShowAdminCashOutSheet] = useState(false);
  const [selectedPlayerForCashOut, setSelectedPlayerForCashOut] = useState<string | null>(null);
  const [adminCashOutChips, setAdminCashOutChips] = useState("");
  const [submittingAdminCashOut, setSubmittingAdminCashOut] = useState(false);

  // Add player dialog state
  const [showAddPlayerSheet, setShowAddPlayerSheet] = useState(false);
  const [playerSearchQuery, setPlayerSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchingPlayers, setSearchingPlayers] = useState(false);
  const [submittingAddPlayer, setSubmittingAddPlayer] = useState(false);

  // Edit chips dialog state
  const [showEditChipsSheet, setShowEditChipsSheet] = useState(false);
  const [editChipsPlayer, setEditChipsPlayer] = useState<any>(null);
  const [editChipsValue, setEditChipsValue] = useState("");
  const [submittingEditChips, setSubmittingEditChips] = useState(false);

  // Remove player state
  const [submittingRemovePlayer, setSubmittingRemovePlayer] = useState(false);

  // Settlement preview animation state
  const [showSettlementPreview, setShowSettlementPreview] = useState(false);
  const [settlementPhase, setSettlementPhase] = useState(0);
  const [settlementData, setSettlementData] = useState<any>(null);
  const [playerAnimValues] = useState(() =>
    Array.from({ length: 10 }, () => new Animated.Value(0))
  );
  const [paymentAnimValues] = useState(() =>
    Array.from({ length: 10 }, () => new Animated.Value(0))
  );

  // Hand rankings modal
  const [showHandRankings, setShowHandRankings] = useState(false);

  // Game thread — badge count + modal uses shared GameThreadMessagesPanel
  const [showGameThread, setShowGameThread] = useState(false);
  const [threadCount, setThreadCount] = useState(0);

  // Resync state
  const resyncInFlight = useRef(false);
  const pendingResync = useRef(false);
  const lastReqId = useRef(0);
  const lastResyncAt = useRef(0);

  // ─── Layout (align with Dashboard V3) ───
  const backgroundColor = isDark ? COLORS.jetDark : colors.contentBg;
  const headerTop = insets.top;
  const refreshProgressOffset = headerTop + HEADER_ROW_APPROX;
  const tabBarReserve = TAB_BAR_RESERVE_BASE + Math.max(insets.bottom, 8);
  /** In-scroll actions only (no sticky footer) — match Chats / Groups bottom clearance */
  const scrollBottomPad = tabBarReserve + LAYOUT.sectionGap;

  /** Tri / metric rings — same pad as Dashboard V3 horizontal metric cards */
  const metricRingPad = useMemo(
    () => ({
      padBg: isDark ? "rgba(168, 182, 215, 0.1)" : "rgba(88, 102, 138, 0.07)",
      rimBorder: isDark ? "rgba(255, 255, 255, 0.09)" : "rgba(0, 0, 0, 0.07)",
    }),
    [isDark]
  );

  // ��� Memoized Styles ���
  const cardStyle = useMemo(
    () => ({
      backgroundColor: isDark ? "rgba(45, 45, 48, 0.9)" : "rgba(255, 255, 255, 0.95)",
      borderRadius: RADIUS.xl,
      borderWidth: 1,
      borderColor: isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.06)",
      ...appleCardShadowResting(isDark),
    }),
    [isDark]
  );

  const cardSmStyle = useMemo(
    () => ({ ...cardStyle, borderRadius: RADIUS.lg }),
    [cardStyle]
  );

  const ringPad = useMemo(
    () => ({
      bg: isDark ? "rgba(255, 255, 255, 0.06)" : "rgba(0, 0, 0, 0.04)",
      border: isDark ? "rgba(255, 255, 255, 0.09)" : "rgba(0, 0, 0, 0.07)",
    }),
    [isDark]
  );

  const secondaryBg = isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)";

  // Profit — semantic theme colors only (same family as Dashboard / Group Hub)
  const profitColor = useCallback(
    (val: number) => {
      if (val === 0) return colors.textSecondary;
      return val > 0 ? colors.success : colors.danger;
    },
    [colors.textSecondary, colors.success, colors.danger]
  );

  const resyncGameState = useCallback(async () => {
    const now = Date.now();
    if (resyncInFlight.current) {
      pendingResync.current = true;
      return;
    }
    if (now - lastResyncAt.current < 750) {
      pendingResync.current = true;
      return;
    }

    resyncInFlight.current = true;
    lastResyncAt.current = now;
    const reqId = ++lastReqId.current;

    try {
      const data = await getGame(gameId);
      if (reqId === lastReqId.current) {
        setSnapshot(data);
        setError(null);
      }
    } catch (e: any) {
      if (reqId === lastReqId.current) {
        setError(e?.message ?? "Game sync unavailable.");
      }
    } finally {
      resyncInFlight.current = false;
      if (pendingResync.current) {
        pendingResync.current = false;
        setTimeout(() => resyncGameState(), 0);
      }
    }
  }, [gameId]);

  const loadThreadCount = useCallback(async () => {
    try {
      const rows = await getGameThread(gameId);
      setThreadCount(Array.isArray(rows) ? rows.length : 0);
    } catch {
      /* badge is best-effort */
    }
  }, [gameId]);

  const setupSocket = useCallback(async () => {
    try {
      const s = await createSocket();
      socketRef.current = s;

      s.on("connect", async () => {
        setConnected(true);
        setReconnecting(false);
        await resyncGameState();
      });

      s.on("disconnect", () => {
        setConnected(false);
        setReconnecting(true);
      });

      s.on("game_update", (data: any) => {
        if (data?.type === "thread_message" && data.message) {
          loadThreadCount();
          return;
        }
        if (data?.type === "message") {
          loadThreadCount();
        } else {
          resyncGameState();
        }
      });

      s.emit("join_game", { game_id: gameId }, (ack: any) => {
        if (ack?.error) {
          setError(`join_game failed: ${ack.error}`);
        }
      });
    } catch (e: any) {
      setError(e?.message ?? "Connection unavailable.");
    }
  }, [gameId, resyncGameState, loadThreadCount]);

  // Initial load
  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!mounted) return;
      await resyncGameState();
      await setupSocket();
    })();

    return () => {
      mounted = false;
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [gameId, resyncGameState, setupSocket]);

  useEffect(() => {
    loadThreadCount();
  }, [loadThreadCount]);

  useEffect(() => {
    if (showGameThread) loadThreadCount();
  }, [showGameThread, loadThreadCount]);

  // Duration timer
  useEffect(() => {
    if (snapshot?.started_at && snapshot?.status === "active") {
      const startTime = new Date(snapshot.started_at).getTime();
      const updateTimer = () => {
        const now = Date.now();
        setElapsedSeconds(Math.floor((now - startTime) / 1000));
      };
      updateTimer();
      timerRef.current = setInterval(updateTimer, 1000);
      return () => {
        if (timerRef.current) clearInterval(timerRef.current);
      };
    }
  }, [snapshot?.started_at, snapshot?.status]);

  // Handle app state changes
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === "active") {
        resyncGameState();
        if (socketRef.current && !socketRef.current.connected) {
          setReconnecting(true);
        }
      }
    };
    const subscription = AppState.addEventListener("change", handleAppStateChange);
    return () => subscription.remove();
  }, [resyncGameState]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await resyncGameState();
    setRefreshing(false);
  }, [resyncGameState]);

  // Search players
  const searchPlayers = async (query: string) => {
    if (!query || query.length < 2) {
      setSearchResults([]);
      return;
    }
    setSearchingPlayers(true);
    try {
      const res = await api.get(`/users/search?query=${encodeURIComponent(query)}`);
      const currentPlayerIds = players.map((p: any) => p.user_id);
      const filtered = (res.data || []).filter((u: any) => !currentPlayerIds.includes(u.user_id));
      setSearchResults(filtered);
    } catch (e) {
      console.error("Search failed:", e);
    } finally {
      setSearchingPlayers(false);
    }
  };

  // Game data
  const players = snapshot?.players ?? [];
  const isHost = snapshot?.is_host ?? (snapshot?.host_id === user?.user_id);
  const currentPlayer = snapshot?.current_player ?? players.find((p: any) => p.user_id === user?.user_id);
  const isInGame = !!currentPlayer;
  const hasCashedOut = currentPlayer?.cashed_out === true;
  const gameStatus = snapshot?.status || "unknown";
  const isActive = gameStatus === "active";
  const isScheduled = gameStatus === "scheduled";
  const isEnded = gameStatus === "ended";

  const totalPot = players.reduce((sum: number, p: any) => sum + (p.total_buy_in || 0), 0);
  const totalChips = players.reduce((sum: number, p: any) => sum + (p.chips || 0), 0);
  const chipValue = snapshot?.chip_value || (snapshot?.buy_in_amount && snapshot?.chips_per_buy_in ? snapshot.buy_in_amount / snapshot.chips_per_buy_in : 1);
  const defaultBuyIn = snapshot?.buy_in_amount || 20;
  const chipsPerBuyIn = snapshot?.chips_per_buy_in || 20;

  // Players grouped by status
  const activePlayers = players.filter((p: any) => !p.cashed_out);
  const cashedOutPlayers = players.filter((p: any) => p.cashed_out);
  const allPlayersCashedOut = players.length > 0 && players.every((p: any) => p.cashed_out);

  // Game Pulse chart data
  const chartPlayers = [...activePlayers, ...cashedOutPlayers]
    .filter((p: any) => (p.total_buy_in || 0) > 0);
  const CHART_W = Math.max(120, SCREEN_WIDTH - 2 * SCREEN_PAD - 2 * LAYOUT.cardPadding - 24);
  /** Compact pulse strip (bottom card) */
  const PULSE_CHART_H = 44;

  const makeEcgPath = () => {
    if (chartPlayers.length === 0) return "";
    const pts = chartPlayers.map((p: any, i: number) => {
      const currentVal = p.cashed_out ? (p.cash_out_value || 0) : (p.chips || 0) * chipValue;
      const ratio = (p.total_buy_in || 1) > 0 ? currentVal / p.total_buy_in : 1;
      const clampedRatio = Math.max(0.1, Math.min(2.5, ratio));
      const x = chartPlayers.length === 1 ? CHART_W / 2 : (i / (chartPlayers.length - 1)) * CHART_W;
      const y = PULSE_CHART_H - ((clampedRatio - 0.1) / 2.4) * PULSE_CHART_H;
      return { x, y, ratio };
    });
    if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y} L ${pts[0].x + 1} ${pts[0].y}`;
    let d = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 1; i < pts.length; i++) {
      const mid = (pts[i - 1].x + pts[i].x) / 2;
      const spikeDir = pts[i].ratio >= 1 ? -10 : 8;
      d += ` L ${mid - 2} ${pts[i - 1].y} L ${mid} ${pts[i - 1].y + spikeDir} L ${mid + 2} ${pts[i].y} L ${pts[i].x} ${pts[i].y}`;
    }
    return d;
  };

  const makeFillPath = () => {
    const line = makeEcgPath();
    if (!line) return "";
    const lastX = chartPlayers.length === 1 ? CHART_W / 2 : CHART_W;
    return `${line} L ${lastX} ${PULSE_CHART_H} L 0 ${PULSE_CHART_H} Z`;
  };

  // Format duration
  const formatDuration = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hrs > 0) {
      return `${hrs}h ${mins}m`;
    }
    return `${mins}m ${secs}s`;
  };

  // Handle start game
  const handleStartGame = async () => {
    try {
      await api.post(`/games/${gameId}/start`);
      await resyncGameState();
    } catch (e: any) {
      setError(e?.response?.data?.detail || "Couldn't start the game.");
    }
  };

  // Handle end game
  const handleEndGame = async () => {
    try {
      await api.post(`/games/${gameId}/end`);
      await resyncGameState();
      setSettlementPhase(0);
      setShowSettlementPreview(true);
      runSettlementAnimation();
    } catch (e: any) {
      setError(e?.response?.data?.detail || "Couldn't end the game.");
    }
  };

  // Handle join game
  const handleJoinGame = async () => {
    try {
      await api.post(`/games/${gameId}/join`);
      await resyncGameState();
    } catch (e: any) {
      setError(e?.response?.data?.detail || "Couldn't join the game.");
    }
  };

  // Handle buy-in
  const handleBuyIn = async () => {
    setSubmittingBuyIn(true);
    try {
      await api.post(`/games/${gameId}/buy-in`, { amount: buyInAmount });
      setShowBuyInSheet(false);
      await resyncGameState();
    } catch (e: any) {
      setError(e?.response?.data?.detail || e?.message || "Buy-in failed");
    } finally {
      setSubmittingBuyIn(false);
    }
  };

  // Handle cash-out
  const handleCashOut = async () => {
    const chips = parseInt(cashOutChips, 10);
    if (isNaN(chips) || chips < 0) {
      setError("Please enter a valid chip count");
      return;
    }
    setSubmittingCashOut(true);
    try {
      await api.post(`/games/${gameId}/cash-out`, { chips_returned: chips });
      setShowCashOutSheet(false);
      setCashOutChips("");
      await resyncGameState();
    } catch (e: any) {
      setError(e?.response?.data?.detail || e?.message || "Cash-out failed");
    } finally {
      setSubmittingCashOut(false);
    }
  };

  // Admin: Handle buy-in for a player
  const handleAdminBuyIn = async () => {
    if (!selectedPlayerForBuyIn) return;
    setSubmittingAdminBuyIn(true);
    try {
      await api.post(`/games/${gameId}/admin-buy-in`, {
        user_id: selectedPlayerForBuyIn,
        amount: adminBuyInAmount,
      });
      setShowAdminBuyInSheet(false);
      setSelectedPlayerForBuyIn(null);
      await resyncGameState();
    } catch (e: any) {
      setError(e?.response?.data?.detail || e?.message || "Admin buy-in failed");
    } finally {
      setSubmittingAdminBuyIn(false);
    }
  };

  // Admin: Handle cash-out for a player
  const handleAdminCashOut = async () => {
    if (!selectedPlayerForCashOut) return;
    const chips = parseInt(adminCashOutChips, 10);
    if (isNaN(chips) || chips < 0) {
      setError("Please enter a valid chip count");
      return;
    }
    setSubmittingAdminCashOut(true);
    try {
      await api.post(`/games/${gameId}/admin-cash-out`, {
        user_id: selectedPlayerForCashOut,
        chips_count: chips,
      });
      setShowAdminCashOutSheet(false);
      setSelectedPlayerForCashOut(null);
      setAdminCashOutChips("");
      await resyncGameState();
    } catch (e: any) {
      setError(e?.response?.data?.detail || e?.message || "Admin cash-out failed");
    } finally {
      setSubmittingAdminCashOut(false);
    }
  };

  // Invite player to game
  const handleAddPlayer = async (playerId: string) => {
    setSubmittingAddPlayer(true);
    try {
      await api.post(`/games/${gameId}/invite-player`, { user_id: playerId });
      setShowAddPlayerSheet(false);
      setPlayerSearchQuery("");
      setSearchResults([]);
      Alert.alert("Invite Sent", "They'll receive a notification to accept.");
      await resyncGameState();
    } catch (e: any) {
      setError(e?.response?.data?.detail || "Couldn't send invite.");
    } finally {
      setSubmittingAddPlayer(false);
    }
  };

  // Remove player from game
  const handleRemovePlayer = (playerId: string, playerName: string) => {
    Alert.alert(
      "Remove Player",
      `Remove ${playerName} from the game? Only players with no buy-ins can be removed.`,
      [
        { text: t.common.cancel, style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            setSubmittingRemovePlayer(true);
            try {
              await api.post(`/games/${gameId}/remove-player`, { user_id: playerId });
              await resyncGameState();
            } catch (e: any) {
              setError(e?.response?.data?.detail || "Couldn't remove player.");
            } finally {
              setSubmittingRemovePlayer(false);
            }
          },
        },
      ]
    );
  };

  // Run settlement preview animation
  const runSettlementAnimation = useCallback(async () => {
    setSettlementPhase(0);
    playerAnimValues.forEach(v => v.setValue(0));
    Animated.stagger(100, playerAnimValues.map(v =>
      Animated.timing(v, { toValue: 1, duration: 400, useNativeDriver: true })
    )).start();

    setTimeout(() => setSettlementPhase(1), 2000);

    setTimeout(async () => {
      try {
        const res = await api.get(`/games/${gameId}/settlement`);
        setSettlementData(res.data);
      } catch {}
      setSettlementPhase(2);
      paymentAnimValues.forEach(v => v.setValue(0));
      Animated.stagger(80, paymentAnimValues.map(v =>
        Animated.timing(v, { toValue: 1, duration: 350, useNativeDriver: true })
      )).start();
    }, 3500);

    setTimeout(() => setSettlementPhase(3), 5500);
  }, [gameId, playerAnimValues, paymentAnimValues]);

  // Edit chips for cashed out player
  const handleEditChips = async () => {
    if (!editChipsPlayer) return;
    const chips = parseInt(editChipsValue, 10);
    if (isNaN(chips) || chips < 0) {
      setError("Please enter a valid chip count");
      return;
    }
    setSubmittingEditChips(true);
    try {
      await api.post(`/games/${gameId}/edit-player-chips`, {
        user_id: editChipsPlayer.user_id,
        chips_count: chips,
      });
      setShowEditChipsSheet(false);
      setEditChipsPlayer(null);
      setEditChipsValue("");
      await resyncGameState();
    } catch (e: any) {
      setError(e?.response?.data?.detail || "Couldn't update chips.");
    } finally {
      setSubmittingEditChips(false);
    }
  };

  // Cash-out preview
  const cashOutChipsNum = parseInt(cashOutChips, 10) || 0;
  const cashOutValue = cashOutChipsNum * chipValue;
  const netResult = cashOutValue - (currentPlayer?.total_buy_in || 0);

  // Selected player info for admin cash-out
  const selectedCashOutPlayer = players.find((p: any) => p.user_id === selectedPlayerForCashOut);
  const adminCashOutChipsNum = parseInt(adminCashOutChips, 10) || 0;
  const adminCashOutValue = adminCashOutChipsNum * chipValue;

  const gameStatusLabel =
    gameStatus.length > 0 ? gameStatus.charAt(0).toUpperCase() + gameStatus.slice(1) : gameStatus;

  const headerTitle = snapshot?.name?.trim() ? snapshot.name.trim() : t.game.nightScreenTitle;

  // Your position calculations
  const yourChips = currentPlayer?.chips || 0;
  const yourBuyIn = currentPlayer?.total_buy_in || 0;
  const yourValue = yourChips * chipValue;
  const yourNet = yourValue - yourBuyIn;

  return (
    <View style={[styles.root, { backgroundColor }]} testID="game-night-screen">
      {/* Hero gradient */}
      <LinearGradient
        pointerEvents="none"
        colors={pageHeroGradientColors(isDark)}
        locations={[...PAGE_HERO_GRADIENT.locations]}
        start={PAGE_HERO_GRADIENT.start}
        end={PAGE_HERO_GRADIENT.end}
        style={[
          styles.topGradient,
          {
            height: Math.min(PAGE_HERO_GRADIENT.maxHeight, headerTop + PAGE_HERO_GRADIENT.safeAreaPad),
          },
        ]}
      />

      {/* ��� Header ��� */}
      <View style={styles.topChrome} pointerEvents="box-none">
        <View style={{ height: insets.top }} />
        <View style={styles.headerRow}>
          <Pressable
            style={({ pressed }) => [
              styles.backPill,
              { backgroundColor: colors.glassBg, borderColor: colors.glassBorder, opacity: pressed ? 0.85 : 1 },
            ]}
            onPress={() => navigation.goBack()}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          >
            <Ionicons name="chevron-back" size={22} color={colors.textPrimary} />
          </Pressable>
          <View style={styles.headerCenter}>
            <Title1 style={styles.screenTitle} numberOfLines={1}>
              {headerTitle}
            </Title1>
            <View style={styles.headerBadges}>
              <View style={[styles.statusPill, { backgroundColor: connected ? COLORS.glass.glowGreen : COLORS.glass.glowRed }]}>
                <View style={[styles.statusDot, { backgroundColor: connected ? colors.success : colors.danger }]} />
                <Caption2 style={{ color: connected ? colors.success : colors.danger, fontWeight: "600" }}>
                  {connected ? "Live" : "Offline"}
                </Caption2>
              </View>
              <View style={[
                styles.statusPill,
                {
                  backgroundColor: isActive ? COLORS.glass.glowGreen : isScheduled ? COLORS.glass.glowOrange : secondaryBg,
                },
              ]}>
                <Caption2 style={{ color: isActive ? colors.success : isScheduled ? colors.warning : colors.textMuted, fontWeight: "600" }}>
                  {gameStatusLabel}
                </Caption2>
              </View>
            </View>
          </View>
          <Pressable
            style={({ pressed }) => [
              styles.backPill,
              { backgroundColor: colors.glassBg, borderColor: colors.glassBorder, opacity: pressed ? 0.85 : 1 },
            ]}
            onPress={() => setShowHandRankings(true)}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          >
            <Ionicons name="help-circle-outline" size={22} color={colors.textSecondary} />
          </Pressable>
        </View>
      </View>

      <View style={[styles.body, styles.bodyAboveGradient]}>
      <ScrollView
        style={styles.bodyScroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: scrollBottomPad }]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.orange}
            titleColor={colors.textSecondary}
            colors={[colors.orange]}
            progressBackgroundColor={colors.surfaceBackground}
            progressViewOffset={Platform.OS === "android" ? refreshProgressOffset + 8 : undefined}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* ��� Error Banner ��� */}
        {error && (
          <View style={[styles.errorBanner, { backgroundColor: COLORS.glass.glowRed, borderColor: colors.danger }]}>
            <Ionicons name="alert-circle" size={18} color={colors.danger} />
            <Footnote style={{ flex: 1, color: colors.danger }}>{error}</Footnote>
            <Pressable onPress={() => setError(null)} hitSlop={8}>
              <Ionicons name="close" size={18} color={colors.danger} />
            </Pressable>
          </View>
        )}

        {/* ��� Reconnecting Banner ��� */}
        {reconnecting && (
          <View style={[styles.errorBanner, { backgroundColor: COLORS.glass.glowWarning, borderColor: colors.warning }]}>
            <Ionicons name="sync" size={16} color={colors.warning} />
            <Footnote style={{ flex: 1, color: colors.warning }}>Reconnecting...</Footnote>
          </View>
        )}

        {/* �����������������������������������������������������������������������
            BENTO STATS ROW - Duration | Players | Chips | Pot
            ����������������������������������������������������������������������� */}
        <View style={styles.bentoRow}>
          <View style={[styles.bentoCard, cardSmStyle]}>
            <Footnote style={{ color: colors.textMuted }}>Duration</Footnote>
            <Headline style={{ color: colors.textPrimary, marginTop: SPACE.xs, fontVariant: ["tabular-nums"] }}>
              {formatDuration(elapsedSeconds)}
            </Headline>
            <View style={[styles.bentoRingOuter, { backgroundColor: ringPad.bg, borderColor: ringPad.border }]}>
              <View style={[styles.bentoRingInner, { backgroundColor: cardSmStyle.backgroundColor }]}>
                <Ionicons name="time-outline" size={18} color={colors.textSecondary} />
              </View>
            </View>
          </View>

          <View style={[styles.bentoCard, cardSmStyle]}>
            <Footnote style={{ color: colors.textMuted }}>{t.game.players}</Footnote>
            <Headline style={{ color: colors.textPrimary, marginTop: SPACE.xs }}>{players.length}</Headline>
            <View style={[styles.bentoRingOuter, { backgroundColor: ringPad.bg, borderColor: ringPad.border }]}>
              <View style={[styles.bentoRingInner, { backgroundColor: cardSmStyle.backgroundColor }]}>
                <Ionicons name="people-outline" size={18} color={colors.textSecondary} />
              </View>
            </View>
          </View>

          <View style={[styles.bentoCard, cardSmStyle]}>
            <Footnote style={{ color: colors.textMuted }}>Chips</Footnote>
            <Headline style={{ color: colors.textPrimary, marginTop: SPACE.xs, fontVariant: ["tabular-nums"] }}>{totalChips}</Headline>
            <View style={[styles.bentoRingOuter, { backgroundColor: ringPad.bg, borderColor: ringPad.border }]}>
              <View style={[styles.bentoRingInner, { backgroundColor: cardSmStyle.backgroundColor }]}>
                <Ionicons name="disc-outline" size={18} color={colors.textSecondary} />
              </View>
            </View>
          </View>

          <View style={[styles.bentoCard, cardSmStyle]}>
            <Footnote style={{ color: colors.textMuted }}>{t.game.pot}</Footnote>
            <Headline style={{ color: colors.warning, marginTop: SPACE.xs, fontVariant: ["tabular-nums"] }}>${totalPot}</Headline>
            <View style={[styles.bentoRingOuter, { backgroundColor: ringPad.bg, borderColor: ringPad.border }]}>
              <View style={[styles.bentoRingInner, { backgroundColor: cardSmStyle.backgroundColor }]}>
                <Ionicons name="cash-outline" size={18} color={colors.warning} />
              </View>
            </View>
          </View>
        </View>

        {/* �����������������������������������������������������������������������
            HOST INFO + CHIP VALUE - Hero Card
            ����������������������������������������������������������������������� */}
        <View style={[cardStyle, styles.heroCard]}>
          <View style={styles.heroCardContent}>
            <View style={styles.heroCardLeft}>
              <View style={[styles.hostBadge, { backgroundColor: COLORS.glass.glowOrange }]}>
                <Ionicons name="shield" size={12} color={colors.warning} />
                <Caption2 style={{ color: colors.warning, fontWeight: "600" }}>
                  {snapshot?.host?.name || "Host"} Admin
                </Caption2>
              </View>
              <View style={styles.chipInfoRow}>
                <View style={styles.chipInfoItem}>
                  <Ionicons name="disc-outline" size={14} color={colors.warning} />
                  <Subhead style={{ color: colors.textPrimary }}>${defaultBuyIn} = {chipsPerBuyIn} chips</Subhead>
                </View>
                <View style={[styles.chipInfoDivider, { backgroundColor: colors.border }]} />
                <Subhead style={{ color: colors.textMuted }}>${chipValue.toFixed(2)}/chip</Subhead>
              </View>
            </View>
            <View style={styles.suitsRow}>
              {SUIT_SYMBOLS.map((suit) => (
                <View
                  key={suit}
                  style={[
                    styles.suitRingOuter,
                    {
                      backgroundColor: metricRingPad.padBg,
                      borderColor: metricRingPad.rimBorder,
                    },
                  ]}
                >
                  <View style={[styles.suitRingInner, { backgroundColor: cardStyle.backgroundColor }]}>
                    <Text
                      style={{
                        fontSize: ICON_WELL.tri.iconSize,
                        color: suit === "♥" || suit === "♦" ? colors.danger : colors.textPrimary,
                      }}
                    >
                      {suit}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        </View>

        {/* �����������������������������������������������������������������������
            HOST CONTROLS - Quick Actions Card
            ����������������������������������������������������������������������� */}
        {isHost && (
          <View style={[cardStyle, styles.actionsCard]}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionHeaderLeft}>
                <Ionicons name="shield" size={20} color={colors.warning} />
                <Title2>{t.game.hostControlsSection}</Title2>
              </View>
            </View>

            {isScheduled && (
              <Pressable
                style={({ pressed }) => [
                  styles.primaryActionBtn,
                  { backgroundColor: colors.success, opacity: pressed ? 0.92 : 1 },
                ]}
                onPress={handleStartGame}
              >
                <Ionicons name="play" size={22} color={colors.textPrimary} />
                <Headline style={{ color: colors.textPrimary }}>{t.game.startGame}</Headline>
              </Pressable>
            )}

            {isActive && (
              <>
                <View style={styles.hostActionsGrid}>
                  <Pressable
                    style={({ pressed }) => [
                      styles.hostActionBtn,
                      {
                        backgroundColor: COLORS.glass.glowGreen,
                        borderColor: colors.success,
                        opacity: pressed ? 0.88 : 1,
                      },
                    ]}
                    onPress={() => setShowAdminBuyInSheet(true)}
                  >
                    <Ionicons name="add-circle" size={20} color={colors.success} />
                    <Subhead style={{ color: colors.success }}>{t.game.buyIn}</Subhead>
                  </Pressable>
                  <Pressable
                    style={({ pressed }) => [
                      styles.hostActionBtn,
                      {
                        backgroundColor: COLORS.glass.glowOrange,
                        borderColor: colors.warning,
                        opacity: pressed ? 0.88 : 1,
                      },
                    ]}
                    onPress={() => setShowAdminCashOutSheet(true)}
                  >
                    <Ionicons name="remove-circle" size={20} color={colors.warning} />
                    <Subhead style={{ color: colors.warning }}>{t.game.cashOut}</Subhead>
                  </Pressable>
                  <Pressable
                    style={({ pressed }) => [
                      styles.hostActionBtn,
                      { backgroundColor: secondaryBg, borderColor: colors.border, opacity: pressed ? 0.88 : 1 },
                    ]}
                    onPress={() => setShowAddPlayerSheet(true)}
                  >
                    <Ionicons name="person-add" size={20} color={colors.textPrimary} />
                    <Subhead style={{ color: colors.textPrimary }}>Invite</Subhead>
                  </Pressable>
                </View>
                <Pressable
                  style={({ pressed }) => [
                    styles.endGameBtn,
                    { backgroundColor: colors.danger, opacity: pressed ? 0.92 : 1 },
                  ]}
                  onPress={() => {
                    if (!allPlayersCashedOut) {
                      Alert.alert(
                        "End Game?",
                        "Some players haven't cashed out yet. End game anyway?",
                        [
                          { text: t.common.cancel, style: "cancel" },
                          { text: t.game.endGame, style: "destructive", onPress: handleEndGame },
                        ]
                      );
                    } else {
                      handleEndGame();
                    }
                  }}
                >
                  <Ionicons name="stop-circle" size={20} color={colors.textPrimary} />
                  <Subhead style={{ color: colors.textPrimary, fontWeight: "600" }}>{t.game.endGame}</Subhead>
                </Pressable>
              </>
            )}

            {isEnded && (
              <Pressable
                style={({ pressed }) => [
                  styles.primaryActionBtn,
                  { backgroundColor: colors.buttonPrimary, opacity: pressed ? 0.92 : 1 },
                ]}
                onPress={() => navigation.navigate("Settlement" as any, { gameId })}
              >
                <Ionicons name="calculator" size={22} color={colors.buttonText} />
                <Headline style={{ color: colors.buttonText }}>{t.game.settlement}</Headline>
              </Pressable>
            )}
          </View>
        )}

        {/* �����������������������������������������������������������������������
            YOUR POSITION - Split Cards
            ����������������������������������������������������������������������� */}
        {isInGame && (
          <View style={styles.splitRow}>
            <View style={[styles.splitCard, cardStyle]}>
              <Footnote style={{ color: colors.textMuted }}>Your Chips</Footnote>
              <Text style={[styles.splitBig, { color: colors.textPrimary }]}>{yourChips}</Text>
              <View style={styles.splitMeta}>
                <Ionicons name="disc" size={APPLE_TYPO.caption.size} color={colors.textMuted} />
                <Caption2 style={{ color: colors.textMuted }}>${yourValue.toFixed(0)} value</Caption2>
              </View>
              {hasCashedOut && (
                <View style={[styles.cashedOutBadge, { backgroundColor: COLORS.glass.glowGreen }]}>
                  <Ionicons name="checkmark-circle" size={12} color={colors.success} />
                  <Caption2 style={{ color: colors.success, fontWeight: "600" }}>Cashed Out</Caption2>
                </View>
              )}
            </View>
            <View style={[styles.splitCard, cardStyle]}>
              <Footnote style={{ color: colors.textMuted }}>Your Net</Footnote>
              <Text style={[styles.splitBig, { color: profitColor(yourNet) }]}>
                {yourNet >= 0 ? "+" : ""}${yourNet.toFixed(0)}
              </Text>
              <View style={styles.splitMeta}>
                <Ionicons name="cash" size={APPLE_TYPO.caption.size} color={colors.textMuted} />
                <Caption2 style={{ color: colors.textMuted }}>${yourBuyIn} buy-in</Caption2>
              </View>
            </View>
          </View>
        )}

        {/* In-scroll buy-in / cash-out (host grid covers admin; no duplicate sticky footer) */}
        {isActive && isInGame && !hasCashedOut && (
          <View style={[cardStyle, styles.playerTradeRow]}>
            <Pressable
              style={({ pressed }) => [
                styles.playerTradeBtn,
                styles.playerTradeBtnOutline,
                { borderColor: colors.warning, opacity: pressed ? 0.88 : 1 },
              ]}
              onPress={() => setShowBuyInSheet(true)}
            >
              <Ionicons name="add-circle-outline" size={20} color={colors.warning} />
              <Headline style={{ color: colors.warning }}>{t.game.buyIn}</Headline>
            </Pressable>
            <Pressable
              style={({ pressed }) => [
                styles.playerTradeBtn,
                { backgroundColor: colors.buttonPrimary, opacity: pressed ? 0.92 : 1 },
              ]}
              onPress={() => {
                setCashOutChips(String(currentPlayer?.chips || 0));
                setShowCashOutSheet(true);
              }}
            >
              <Ionicons name="exit-outline" size={20} color={colors.buttonText} />
              <Headline style={{ color: colors.buttonText }}>{t.game.cashOut}</Headline>
            </Pressable>
          </View>
        )}

        {/* �����������������������������������������������������������������������
            JOIN GAME - For non-players
            ����������������������������������������������������������������������� */}
        {!isInGame && isActive && (
          <View style={[cardStyle, styles.joinCard]}>
            <Ionicons name="enter-outline" size={32} color={colors.textMuted} />
            <Headline style={{ marginTop: SPACE.sm }}>You haven't joined yet</Headline>
            <Footnote style={{ color: colors.textMuted, marginTop: SPACE.xs }}>Join the game to start playing</Footnote>
            <Pressable
              style={({ pressed }) => [
                styles.joinBtn,
                { backgroundColor: colors.buttonPrimary, opacity: pressed ? 0.92 : 1 },
              ]}
              onPress={handleJoinGame}
            >
              <Ionicons name="enter" size={20} color={colors.buttonText} />
              <Headline style={{ color: colors.buttonText }}>Join Game</Headline>
            </Pressable>
          </View>
        )}

        {/* �����������������������������������������������������������������������
            ACTIVE PLAYERS
            ����������������������������������������������������������������������� */}
        {activePlayers.length > 0 && (
          <View style={[cardStyle, styles.sectionCard]}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionHeaderLeft}>
                <View style={[styles.liveDot, { backgroundColor: colors.success }]} />
                <Title2>{t.game.activePlayersSection}</Title2>
              </View>
              <Caption2 style={{ color: colors.textMuted }}>{activePlayers.length}</Caption2>
            </View>
            <View style={styles.sectionBody}>
              {activePlayers.map((p: any, idx: number) => {
                const playerNet = (p.chips || 0) * chipValue - (p.total_buy_in || 0);
                const isCurrentUser = p.user_id === user?.user_id;
                const isPlayerHost = p.user_id === snapshot?.host_id;
                const playerName = p?.user?.name || p?.name || p?.email || `Player ${idx + 1}`;

                return (
                  <View
                    key={p?.user_id || idx}
                    style={[styles.playerRow, { borderBottomColor: idx < activePlayers.length - 1 ? colors.border : "transparent" }]}
                  >
                    <View style={[styles.playerAvatar, { backgroundColor: isCurrentUser ? COLORS.glass.glowOrange : secondaryBg }]}>
                      <Subhead style={{ color: isCurrentUser ? colors.warning : colors.textSecondary, fontWeight: "600" }}>
                        {playerName[0].toUpperCase()}
                      </Subhead>
                    </View>
                    <View style={styles.playerInfo}>
                      <View style={styles.playerNameRow}>
                        <Headline numberOfLines={1} style={{ flexShrink: 1 }}>{playerName}</Headline>
                        {isCurrentUser && <Footnote style={{ color: colors.textMuted }}> (you)</Footnote>}
                        {isPlayerHost && <Ionicons name="shield" size={14} color={colors.warning} style={{ marginLeft: 4 }} />}
                      </View>
                      <Footnote style={{ color: colors.textMuted, marginTop: 2 }}>
                        {p.chips || 0} chips · ${p.total_buy_in || 0} buy-in
                      </Footnote>
                    </View>

                    {isHost && isActive && !isCurrentUser && (
                      <View style={styles.playerActions}>
                        <Pressable
                          style={({ pressed }) => [styles.playerActionBtn, { backgroundColor: COLORS.glass.glowGreen, opacity: pressed ? 0.7 : 1 }]}
                          onPress={() => { setSelectedPlayerForBuyIn(p.user_id); setShowAdminBuyInSheet(true); }}
                        >
                          <Ionicons name="add" size={16} color={colors.success} />
                        </Pressable>
                        <Pressable
                          style={({ pressed }) => [styles.playerActionBtn, { backgroundColor: COLORS.glass.glowOrange, opacity: pressed ? 0.7 : 1 }]}
                          onPress={() => { setSelectedPlayerForCashOut(p.user_id); setAdminCashOutChips(String(p.chips || 0)); setShowAdminCashOutSheet(true); }}
                        >
                          <Ionicons name="remove" size={16} color={colors.warning} />
                        </Pressable>
                        {(p.total_buy_in || 0) === 0 && (
                          <Pressable
                            style={({ pressed }) => [styles.playerActionBtn, { backgroundColor: COLORS.glass.glowRed, opacity: pressed ? 0.7 : 1 }]}
                            onPress={() => handleRemovePlayer(p.user_id, playerName)}
                          >
                            <Ionicons name="person-remove" size={14} color={colors.danger} />
                          </Pressable>
                        )}
                      </View>
                    )}

                    {!isHost && (
                      <Subhead style={{ color: profitColor(playerNet), fontWeight: "600", fontVariant: ["tabular-nums"] }}>
                        {playerNet >= 0 ? "+" : ""}${playerNet.toFixed(0)}
                      </Subhead>
                    )}
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* �����������������������������������������������������������������������
            CASHED OUT PLAYERS
            ����������������������������������������������������������������������� */}
        {cashedOutPlayers.length > 0 && (
          <View style={[cardStyle, styles.sectionCard]}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionHeaderLeft}>
                <Ionicons name="checkmark-circle" size={20} color={colors.success} />
                <Title2 style={{ color: colors.success }}>{t.game.cashedOutSection}</Title2>
              </View>
              <Caption2 style={{ color: colors.textMuted }}>{cashedOutPlayers.length}</Caption2>
            </View>
            <View style={styles.sectionBody}>
              {cashedOutPlayers.map((p: any, idx: number) => {
                const playerNet = (p.cash_out_value || 0) - (p.total_buy_in || 0);
                const isCurrentUser = p.user_id === user?.user_id;
                const isPlayerHost = p.user_id === snapshot?.host_id;
                const playerName = p?.user?.name || p?.name || p?.email || `Player ${idx + 1}`;

                return (
                  <View
                    key={p?.user_id || idx}
                    style={[styles.playerRow, { borderBottomColor: idx < cashedOutPlayers.length - 1 ? colors.border : "transparent" }]}
                  >
                    <View style={[styles.playerAvatar, { backgroundColor: COLORS.glass.glowGreen }]}>
                      <Ionicons name="checkmark" size={20} color={colors.success} />
                    </View>
                    <View style={styles.playerInfo}>
                      <View style={styles.playerNameRow}>
                        <Headline numberOfLines={1} style={{ flexShrink: 1 }}>{playerName}</Headline>
                        {isCurrentUser && <Footnote style={{ color: colors.textMuted }}> (you)</Footnote>}
                        {isPlayerHost && <Ionicons name="shield" size={14} color={colors.warning} style={{ marginLeft: 4 }} />}
                      </View>
                      <Footnote style={{ color: colors.textMuted, marginTop: 2 }}>
                        ${p.cash_out_value || 0} returned · ${p.total_buy_in || 0} buy-in
                      </Footnote>
                    </View>

                    {isHost && (
                      <Pressable
                        style={({ pressed }) => [styles.editBtn, { backgroundColor: secondaryBg, opacity: pressed ? 0.7 : 1 }]}
                        onPress={() => { setEditChipsPlayer(p); setEditChipsValue(String(p.chips_returned || p.chips || 0)); setShowEditChipsSheet(true); }}
                      >
                        <Ionicons name="pencil" size={14} color={colors.textMuted} />
                      </Pressable>
                    )}

                    <Subhead style={{ color: profitColor(playerNet), fontWeight: "600", fontVariant: ["tabular-nums"] }}>
                      {playerNet >= 0 ? "+" : ""}${playerNet.toFixed(0)}
                    </Subhead>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* �����������������������������������������������������������������������
            QUICK LINKS - Thread + AI Assistant
            ����������������������������������������������������������������������� */}
        <View style={styles.quickLinksRow}>
          <Pressable
            style={({ pressed }) => [styles.quickLinkCard, cardSmStyle, { opacity: pressed ? 0.88 : 1 }]}
            onPress={() => {
              loadThreadCount();
              setShowGameThread(true);
            }}
          >
            <View style={[styles.quickLinkIcon, { backgroundColor: COLORS.glass.glowBlue }]}>
              <Ionicons name="chatbubbles" size={22} color={colors.trustBlue} />
            </View>
            <Headline style={{ marginTop: SPACE.sm }}>Game Thread</Headline>
            <Footnote style={{ color: colors.textMuted, marginTop: SPACE.xs }}>Chat with players</Footnote>
            {threadCount > 0 && (
              <View style={[styles.quickLinkBadge, { backgroundColor: colors.trustBlue }]}>
                <Caption2 style={{ color: colors.textPrimary, fontWeight: "700" }}>{threadCount}</Caption2>
              </View>
            )}
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.quickLinkCard, cardSmStyle, { opacity: pressed ? 0.88 : 1 }]}
            onPress={() => navigation.navigate("AIAssistant")}
          >
            <View style={[styles.quickLinkIcon, { backgroundColor: COLORS.glass.glowOrange }]}>
              <Ionicons name="sparkles" size={22} color={colors.warning} />
            </View>
            <Headline style={{ marginTop: SPACE.sm }}>AI Assistant</Headline>
            <Footnote style={{ color: colors.textMuted, marginTop: SPACE.xs }}>Get poker tips</Footnote>
            <View style={[styles.quickLinkBadge, { backgroundColor: colors.warning }]}>
              <Caption2 style={{ color: colors.textPrimary, fontWeight: "700" }}>BETA</Caption2>
            </View>
          </Pressable>
        </View>

        {/* Game Pulse — compact strip at bottom of scroll */}
        {isActive && chartPlayers.length > 0 && (
          <View style={[cardStyle, styles.gamePulseCard]}>
            <View style={styles.gamePulseHeader}>
              <View style={styles.sectionHeaderLeft}>
                <Ionicons name="pulse" size={16} color={colors.success} />
                <Subhead style={{ color: colors.success, fontWeight: "600" }}>{t.game.gamePulseSection}</Subhead>
              </View>
              <Caption2 style={{ color: colors.textMuted }}>
                {activePlayers.length} active · {cashedOutPlayers.length} out
              </Caption2>
            </View>
            <View style={styles.chartContainerCompact}>
              <Svg width={CHART_W} height={PULSE_CHART_H + 8} style={{ overflow: "visible" }}>
                <Defs>
                  <SvgLinearGradient id="pulseGradGn" x1="0" y1="0" x2="0" y2="1">
                    <Stop offset="0%" stopColor={colors.success} stopOpacity={0.2} />
                    <Stop offset="100%" stopColor={colors.success} stopOpacity={0.02} />
                  </SvgLinearGradient>
                </Defs>
                <SvgLine
                  x1={0}
                  y1={PULSE_CHART_H * 0.55}
                  x2={CHART_W}
                  y2={PULSE_CHART_H * 0.55}
                  stroke={colors.border}
                  strokeWidth={1}
                  strokeDasharray="4 4"
                />
                <Path d={makeFillPath()} fill="url(#pulseGradGn)" />
                <Path
                  d={makeEcgPath()}
                  stroke={colors.success}
                  strokeWidth={1.5}
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                {chartPlayers.map((p: any, i: number) => {
                  const currentVal = p.cashed_out ? (p.cash_out_value || 0) : (p.chips || 0) * chipValue;
                  const ratio = Math.max(0.1, Math.min(2.5, (p.total_buy_in || 1) > 0 ? currentVal / p.total_buy_in : 1));
                  const x = chartPlayers.length === 1 ? CHART_W / 2 : (i / (chartPlayers.length - 1)) * CHART_W;
                  const y = PULSE_CHART_H - ((ratio - 0.1) / 2.4) * PULSE_CHART_H;
                  const dotColor = ratio >= 1 ? colors.success : colors.danger;
                  return <Circle key={p.user_id} cx={x} cy={y} r={3} fill={dotColor} />;
                })}
              </Svg>
              <View style={styles.chartLabelsCompact}>
                {chartPlayers.map((p: any) => {
                  const currentVal = p.cashed_out ? (p.cash_out_value || 0) : (p.chips || 0) * chipValue;
                  const delta = currentVal - (p.total_buy_in || 0);
                  return (
                    <View key={p.user_id} style={styles.chartLabel}>
                      <Caption2 style={{ color: colors.textMuted, fontSize: 10 }} numberOfLines={1}>
                        {(p?.user?.name || p?.name || "?").split(" ")[0]}
                      </Caption2>
                      <Caption2 style={{ color: profitColor(delta), fontWeight: "700", fontSize: 11 }}>
                        {delta >= 0 ? "+" : ""}
                        {delta.toFixed(0)}
                      </Caption2>
                    </View>
                  );
                })}
              </View>
            </View>
          </View>
        )}
      </ScrollView>
      </View>

      {/* �����������������������������������������������������������������������
          MODALS
          ����������������������������������������������������������������������� */}

      {/* Buy-In Sheet */}
      <Modal visible={showBuyInSheet} animationType="slide" transparent onRequestClose={() => setShowBuyInSheet(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setShowBuyInSheet(false)} />
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.modalOverlay} pointerEvents="box-none">
          <Pressable style={[styles.sheetContainer, { backgroundColor: colors.surface }]} onPress={(e) => e.stopPropagation()}>
            <View style={[styles.sheetHandle, { backgroundColor: colors.textMuted }]} />
            <Title2 style={styles.sheetTitle}>{t.game.buyIn}</Title2>

            <Label style={{ color: colors.textSecondary, marginBottom: SPACE.sm }}>SELECT AMOUNT</Label>
            <View style={styles.optionRow}>
              {BUY_IN_OPTIONS.map((amount) => (
                <Pressable
                  key={amount}
                  style={({ pressed }) => [
                    styles.optionBtn,
                    { borderColor: buyInAmount === amount ? colors.warning : colors.border, backgroundColor: buyInAmount === amount ? COLORS.glass.glowOrange : "transparent", opacity: pressed ? 0.88 : 1 },
                  ]}
                  onPress={() => setBuyInAmount(amount)}
                >
                  <Headline style={{ color: buyInAmount === amount ? colors.warning : colors.textPrimary }}>${amount}</Headline>
                </Pressable>
              ))}
            </View>

            <View style={[styles.previewCard, { backgroundColor: secondaryBg, borderColor: colors.border }]}>
              <Footnote style={{ color: colors.textMuted }}>You'll receive</Footnote>
              <Title1 style={{ color: colors.warning, marginTop: SPACE.xs }}>{Math.floor(buyInAmount / chipValue)} chips</Title1>
            </View>

            <Pressable
              style={({ pressed }) => [styles.submitBtn, { backgroundColor: colors.buttonPrimary, opacity: submittingBuyIn ? 0.5 : pressed ? 0.92 : 1 }]}
              onPress={handleBuyIn}
              disabled={submittingBuyIn}
            >
              {submittingBuyIn ? <ActivityIndicator color={colors.buttonText} /> : <Headline style={{ color: colors.buttonText }}>Confirm Buy In</Headline>}
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>

      {/* Cash-Out Sheet */}
      <Modal visible={showCashOutSheet} animationType="slide" transparent onRequestClose={() => setShowCashOutSheet(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setShowCashOutSheet(false)} />
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.modalOverlay} pointerEvents="box-none">
          <Pressable style={[styles.sheetContainer, { backgroundColor: colors.surface }]} onPress={(e) => e.stopPropagation()}>
            <View style={[styles.sheetHandle, { backgroundColor: colors.textMuted }]} />
            <Title2 style={styles.sheetTitle}>{t.game.cashOut}</Title2>

            <Label style={{ color: colors.textSecondary, marginBottom: SPACE.sm }}>YOUR CHIPS</Label>
            <TextInput
              style={[styles.chipInput, { backgroundColor: secondaryBg, color: colors.textPrimary, borderColor: colors.border }]}
              value={cashOutChips}
              onChangeText={setCashOutChips}
              keyboardType="number-pad"
              placeholder="Enter chip count"
              placeholderTextColor={colors.textMuted}
            />

            <View style={[styles.summaryCard, { backgroundColor: secondaryBg, borderColor: colors.border }]}>
              <View style={styles.summaryRow}>
                <Footnote style={{ color: colors.textMuted }}>Your chips</Footnote>
                <Subhead style={{ color: colors.textPrimary, fontVariant: ["tabular-nums"] }}>{cashOutChipsNum}</Subhead>
              </View>
              <View style={styles.summaryRow}>
                <Footnote style={{ color: colors.textMuted }}>Cash value</Footnote>
                <Subhead style={{ color: colors.textPrimary, fontVariant: ["tabular-nums"] }}>${cashOutValue.toFixed(2)}</Subhead>
              </View>
              <View style={styles.summaryRow}>
                <Footnote style={{ color: colors.textMuted }}>Total buy-in</Footnote>
                <Subhead style={{ color: colors.textPrimary, fontVariant: ["tabular-nums"] }}>${currentPlayer?.total_buy_in || 0}</Subhead>
              </View>
              <View style={[styles.summaryDivider, { backgroundColor: colors.border }]} />
              <View style={styles.summaryRow}>
                <Headline>Net Result</Headline>
                <Title2 style={{ color: profitColor(netResult), fontVariant: ["tabular-nums"] }}>
                  {netResult >= 0 ? "+" : ""}${netResult.toFixed(2)}
                </Title2>
              </View>
            </View>

            <Pressable
              style={({ pressed }) => [styles.submitBtn, { backgroundColor: colors.buttonPrimary, opacity: submittingCashOut ? 0.5 : pressed ? 0.92 : 1 }]}
              onPress={handleCashOut}
              disabled={submittingCashOut}
            >
              {submittingCashOut ? <ActivityIndicator color={colors.buttonText} /> : <Headline style={{ color: colors.buttonText }}>Confirm Cash Out</Headline>}
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>

      {/* Admin Buy-In Sheet */}
      <Modal visible={showAdminBuyInSheet} animationType="slide" transparent onRequestClose={() => setShowAdminBuyInSheet(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setShowAdminBuyInSheet(false)} />
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.modalOverlay} pointerEvents="box-none">
          <Pressable style={[styles.sheetContainer, { backgroundColor: colors.surface }]} onPress={(e) => e.stopPropagation()}>
            <View style={[styles.sheetHandle, { backgroundColor: colors.textMuted }]} />
            <Title2 style={styles.sheetTitle}>Add Buy-In</Title2>
            <Footnote style={{ color: colors.textMuted, textAlign: "center", marginBottom: SPACE.lg }}>Select a player and buy-in amount</Footnote>

            <Label style={{ color: colors.textSecondary, marginBottom: SPACE.sm }}>SELECT PLAYER</Label>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.playerSelectScroll}>
              {activePlayers.map((p: any) => (
                <Pressable
                  key={p.user_id}
                  style={({ pressed }) => [
                    styles.playerSelectBtn,
                    { borderColor: selectedPlayerForBuyIn === p.user_id ? colors.warning : colors.border, backgroundColor: selectedPlayerForBuyIn === p.user_id ? COLORS.glass.glowOrange : "transparent", opacity: pressed ? 0.88 : 1 },
                  ]}
                  onPress={() => setSelectedPlayerForBuyIn(p.user_id)}
                >
                  <View style={[styles.playerSelectAvatar, { backgroundColor: secondaryBg }]}>
                    <Subhead style={{ color: colors.textSecondary, fontWeight: "600" }}>{(p?.user?.name || p?.name || "?")[0].toUpperCase()}</Subhead>
                  </View>
                  <Footnote style={{ color: selectedPlayerForBuyIn === p.user_id ? colors.warning : colors.textPrimary, fontWeight: "600" }} numberOfLines={1}>
                    {p?.user?.name || p?.name || "Player"}
                  </Footnote>
                  <Caption2 style={{ color: colors.textMuted }}>{p.chips} chips</Caption2>
                </Pressable>
              ))}
            </ScrollView>

            <Label style={{ color: colors.textSecondary, marginTop: SPACE.lg, marginBottom: SPACE.sm }}>SELECT AMOUNT</Label>
            <View style={styles.optionRow}>
              {BUY_IN_OPTIONS.map((amount) => (
                <Pressable
                  key={amount}
                  style={({ pressed }) => [
                    styles.optionBtn,
                    { borderColor: adminBuyInAmount === amount ? colors.warning : colors.border, backgroundColor: adminBuyInAmount === amount ? COLORS.glass.glowOrange : "transparent", opacity: pressed ? 0.88 : 1 },
                  ]}
                  onPress={() => setAdminBuyInAmount(amount)}
                >
                  <Headline style={{ color: adminBuyInAmount === amount ? colors.warning : colors.textPrimary }}>${amount}</Headline>
                </Pressable>
              ))}
            </View>

            <Pressable
              style={({ pressed }) => [styles.submitBtn, { backgroundColor: colors.success, opacity: !selectedPlayerForBuyIn || submittingAdminBuyIn ? 0.5 : pressed ? 0.92 : 1 }]}
              onPress={handleAdminBuyIn}
              disabled={!selectedPlayerForBuyIn || submittingAdminBuyIn}
            >
              {submittingAdminBuyIn ? <ActivityIndicator color={colors.textPrimary} /> : <Headline style={{ color: colors.textPrimary }}>Confirm Buy-In</Headline>}
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>

      {/* Admin Cash-Out Sheet */}
      <Modal visible={showAdminCashOutSheet} animationType="slide" transparent onRequestClose={() => setShowAdminCashOutSheet(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setShowAdminCashOutSheet(false)} />
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.modalOverlay} pointerEvents="box-none">
          <Pressable style={[styles.sheetContainer, { backgroundColor: colors.surface }]} onPress={(e) => e.stopPropagation()}>
            <View style={[styles.sheetHandle, { backgroundColor: colors.textMuted }]} />
            <Title2 style={styles.sheetTitle}>Cash Out Player</Title2>

            <Label style={{ color: colors.textSecondary, marginBottom: SPACE.sm }}>SELECT PLAYER</Label>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.playerSelectScroll}>
              {activePlayers.map((p: any) => (
                <Pressable
                  key={p.user_id}
                  style={({ pressed }) => [
                    styles.playerSelectBtn,
                    { borderColor: selectedPlayerForCashOut === p.user_id ? colors.warning : colors.border, backgroundColor: selectedPlayerForCashOut === p.user_id ? COLORS.glass.glowOrange : "transparent", opacity: pressed ? 0.88 : 1 },
                  ]}
                  onPress={() => { setSelectedPlayerForCashOut(p.user_id); setAdminCashOutChips(String(p.chips || 0)); }}
                >
                  <View style={[styles.playerSelectAvatar, { backgroundColor: secondaryBg }]}>
                    <Subhead style={{ color: colors.textSecondary, fontWeight: "600" }}>{(p?.user?.name || p?.name || "?")[0].toUpperCase()}</Subhead>
                  </View>
                  <Footnote style={{ color: selectedPlayerForCashOut === p.user_id ? colors.warning : colors.textPrimary, fontWeight: "600" }} numberOfLines={1}>
                    {p?.user?.name || p?.name || "Player"}
                  </Footnote>
                  <Caption2 style={{ color: colors.textMuted }}>{p.chips} chips</Caption2>
                </Pressable>
              ))}
            </ScrollView>

            <Label style={{ color: colors.textSecondary, marginTop: SPACE.lg, marginBottom: SPACE.sm }}>CHIPS TO RETURN</Label>
            <TextInput
              style={[styles.chipInput, { backgroundColor: secondaryBg, color: colors.textPrimary, borderColor: colors.border }]}
              value={adminCashOutChips}
              onChangeText={setAdminCashOutChips}
              keyboardType="number-pad"
              placeholder="Enter chip count"
              placeholderTextColor={colors.textMuted}
            />

            {selectedCashOutPlayer && (
              <View style={[styles.summaryCard, { backgroundColor: secondaryBg, borderColor: colors.border }]}>
                <View style={styles.summaryRow}>
                  <Footnote style={{ color: colors.textMuted }}>Cash value</Footnote>
                  <Subhead style={{ color: colors.textPrimary, fontVariant: ["tabular-nums"] }}>${adminCashOutValue.toFixed(2)}</Subhead>
                </View>
                <View style={styles.summaryRow}>
                  <Footnote style={{ color: colors.textMuted }}>Total buy-in</Footnote>
                  <Subhead style={{ color: colors.textPrimary, fontVariant: ["tabular-nums"] }}>${selectedCashOutPlayer?.total_buy_in || 0}</Subhead>
                </View>
                <View style={[styles.summaryDivider, { backgroundColor: colors.border }]} />
                <View style={styles.summaryRow}>
                  <Headline>Net Result</Headline>
                  <Title2 style={{ color: profitColor(adminCashOutValue - (selectedCashOutPlayer?.total_buy_in || 0)), fontVariant: ["tabular-nums"] }}>
                    {(adminCashOutValue - (selectedCashOutPlayer?.total_buy_in || 0)) >= 0 ? "+" : ""}${(adminCashOutValue - (selectedCashOutPlayer?.total_buy_in || 0)).toFixed(2)}
                  </Title2>
                </View>
              </View>
            )}

            <Pressable
              style={({ pressed }) => [styles.submitBtn, { backgroundColor: colors.warning, opacity: !selectedPlayerForCashOut || submittingAdminCashOut ? 0.5 : pressed ? 0.92 : 1 }]}
              onPress={handleAdminCashOut}
              disabled={!selectedPlayerForCashOut || submittingAdminCashOut}
            >
              {submittingAdminCashOut ? <ActivityIndicator color={colors.textPrimary} /> : <Headline style={{ color: colors.textPrimary }}>Confirm Cash Out</Headline>}
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>

      {/* Invite Player Sheet */}
      <Modal visible={showAddPlayerSheet} animationType="slide" transparent onRequestClose={() => setShowAddPlayerSheet(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setShowAddPlayerSheet(false)} />
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.modalOverlay} pointerEvents="box-none">
          <Pressable style={[styles.sheetContainer, { backgroundColor: colors.surface }]} onPress={(e) => e.stopPropagation()}>
            <View style={[styles.sheetHandle, { backgroundColor: colors.textMuted }]} />
            <Title2 style={styles.sheetTitle}>Invite Player</Title2>
            <Footnote style={{ color: colors.textMuted, textAlign: "center", marginBottom: SPACE.lg }}>Search by email or name to invite</Footnote>

            <TextInput
              style={[styles.searchInput, { backgroundColor: secondaryBg, color: colors.textPrimary, borderColor: colors.border }]}
              value={playerSearchQuery}
              onChangeText={(text) => { setPlayerSearchQuery(text); searchPlayers(text); }}
              placeholder="Search by email or name..."
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
            />

            {searchingPlayers && <ActivityIndicator size="small" color={colors.warning} style={{ marginVertical: SPACE.md }} />}

            <ScrollView style={styles.searchResultsScroll} showsVerticalScrollIndicator={false}>
              {searchResults.map((player: any) => (
                <Pressable
                  key={player.user_id}
                  style={({ pressed }) => [styles.searchResultItem, { backgroundColor: secondaryBg, borderColor: colors.border, opacity: pressed ? 0.88 : 1 }]}
                  onPress={() => handleAddPlayer(player.user_id)}
                  disabled={submittingAddPlayer}
                >
                  <View style={[styles.playerAvatar, { backgroundColor: colors.inputBg }]}>
                    <Subhead style={{ color: colors.textSecondary, fontWeight: "600" }}>{(player.name || "?")[0].toUpperCase()}</Subhead>
                  </View>
                  <View style={styles.searchResultInfo}>
                    <Headline numberOfLines={1}>{player.name}</Headline>
                    <Footnote style={{ color: colors.textMuted }} numberOfLines={1}>{player.email}</Footnote>
                  </View>
                  <View style={[styles.inviteBtn, { backgroundColor: colors.buttonPrimary }]}>
                    <Caption2 style={{ color: colors.buttonText, fontWeight: "600" }}>Invite</Caption2>
                  </View>
                </Pressable>
              ))}

              {playerSearchQuery && searchResults.length === 0 && !searchingPlayers && (
                <Footnote style={{ color: colors.textMuted, textAlign: "center", paddingVertical: SPACE.lg }}>
                  No users found matching "{playerSearchQuery}"
                </Footnote>
              )}
            </ScrollView>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>

      {/* Edit Chips Sheet */}
      <Modal visible={showEditChipsSheet} animationType="slide" transparent onRequestClose={() => setShowEditChipsSheet(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setShowEditChipsSheet(false)} />
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.modalOverlay} pointerEvents="box-none">
          <Pressable style={[styles.sheetContainer, { backgroundColor: colors.surface }]} onPress={(e) => e.stopPropagation()}>
            <View style={[styles.sheetHandle, { backgroundColor: colors.textMuted }]} />
            <Title2 style={styles.sheetTitle}>Edit Chips</Title2>
            <Footnote style={{ color: colors.textMuted, textAlign: "center", marginBottom: SPACE.lg }}>
              {editChipsPlayer?.user?.name || editChipsPlayer?.name || "Player"}
            </Footnote>

            <Label style={{ color: colors.textSecondary, marginBottom: SPACE.sm }}>NEW CHIP COUNT</Label>
            <TextInput
              style={[styles.chipInput, { backgroundColor: secondaryBg, color: colors.textPrimary, borderColor: colors.border }]}
              value={editChipsValue}
              onChangeText={setEditChipsValue}
              keyboardType="number-pad"
              placeholder="Enter chip count"
              placeholderTextColor={colors.textMuted}
            />

            <Pressable
              style={({ pressed }) => [styles.submitBtn, { backgroundColor: colors.buttonPrimary, opacity: submittingEditChips ? 0.5 : pressed ? 0.92 : 1 }]}
              onPress={handleEditChips}
              disabled={submittingEditChips}
            >
              {submittingEditChips ? <ActivityIndicator color={colors.buttonText} /> : <Headline style={{ color: colors.buttonText }}>Save Changes</Headline>}
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>

      {/* Hand Rankings Modal */}
      <Modal visible={showHandRankings} animationType="slide" transparent onRequestClose={() => setShowHandRankings(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setShowHandRankings(false)} />
        <View style={styles.modalOverlay} pointerEvents="box-none">
          <Pressable style={[styles.sheetContainer, styles.handRankingsSheet, { backgroundColor: colors.surface }]} onPress={(e) => e.stopPropagation()}>
            <View style={[styles.sheetHandle, { backgroundColor: colors.textMuted }]} />
            <View style={styles.handRankingsHeader}>
              <Title2>Poker Hand Rankings</Title2>
              <Pressable onPress={() => setShowHandRankings(false)} hitSlop={8}>
                <Ionicons name="close" size={24} color={colors.textMuted} />
              </Pressable>
            </View>
            <Footnote style={{ color: colors.textMuted, textAlign: "center", marginBottom: SPACE.md }}>Best to worst, top to bottom</Footnote>

            <ScrollView style={styles.handRankingsList} showsVerticalScrollIndicator={false}>
              {HAND_RANKINGS.map((hand) => (
                <View key={hand.rank} style={[styles.handRankItem, { borderBottomColor: colors.border }]}>
                  <View style={[styles.rankBadge, { backgroundColor: COLORS.glass.glowOrange }]}>
                    <Caption2 style={{ color: colors.warning, fontWeight: "700" }}>{hand.rank}</Caption2>
                  </View>
                  <View style={styles.handRankInfo}>
                    <Headline>{hand.name}</Headline>
                    <Footnote style={{ color: colors.textMuted, marginTop: 2 }}>{hand.desc}</Footnote>
                    <Subhead style={{ color: colors.textSecondary, marginTop: SPACE.xs, letterSpacing: 1 }}>{hand.example}</Subhead>
                  </View>
                </View>
              ))}
            </ScrollView>
          </Pressable>
        </View>
      </Modal>

      {/* Game thread — same panel as GameThreadChat (timeline + chat + empty/error states) */}
      <Modal visible={showGameThread} animationType="slide" transparent onRequestClose={() => setShowGameThread(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setShowGameThread(false)} />
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.modalOverlay} pointerEvents="box-none">
          <Pressable style={[styles.sheetContainer, styles.threadSheet, { backgroundColor: colors.surface }]} onPress={(e) => e.stopPropagation()}>
            <View style={[styles.sheetHandle, { backgroundColor: colors.textMuted }]} />
            <View style={styles.threadHeader}>
              <Title2>{t.chatsScreen.gameThreadSessionTimeline}</Title2>
              <Pressable onPress={() => setShowGameThread(false)} hitSlop={8}>
                <Ionicons name="close" size={24} color={colors.textMuted} />
              </Pressable>
            </View>
            <View style={styles.threadPanelBody}>
              <GameThreadMessagesPanel
                gameId={gameId}
                gameStatus={snapshot?.status ?? ""}
                sheetEmbedded
              />
            </View>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>

      {/* Settlement Preview Animation Modal */}
      <Modal visible={showSettlementPreview} animationType="fade" transparent onRequestClose={() => setShowSettlementPreview(false)}>
        <Pressable style={styles.modalBackdrop} />
        <View style={styles.modalOverlay} pointerEvents="box-none">
          <Pressable style={[styles.sheetContainer, styles.settlementSheet, { backgroundColor: colors.surface }]} onPress={(e) => e.stopPropagation()}>
            <View style={[styles.sheetHandle, { backgroundColor: colors.textMuted }]} />

            <Title2 style={styles.sheetTitle}>
              {settlementPhase === 0 && "Collecting Player Data..."}
              {settlementPhase === 1 && "Calculating Settlement..."}
              {settlementPhase === 2 && "Settlement optimized!"}
              {settlementPhase >= 3 && "Settlement Ready!"}
            </Title2>
            <Footnote style={{ color: colors.textMuted, textAlign: "center", marginBottom: SPACE.lg }}>
              {settlementPhase === 0 && "Reviewing player results"}
              {settlementPhase === 1 && "Finding minimum number of transactions"}
              {settlementPhase === 2 && "Optimized payment flow"}
              {settlementPhase >= 3 && "View the full breakdown below"}
            </Footnote>

            {settlementPhase === 0 && (
              <ScrollView showsVerticalScrollIndicator={false}>
                {players.filter((p: any) => (p.total_buy_in || 0) > 0).slice(0, 10).map((p: any, i: number) => {
                  const currentVal = p.cashed_out ? (p.cash_out_value || 0) : (p.chips || 0) * chipValue;
                  const net = currentVal - (p.total_buy_in || 0);
                  const animVal = playerAnimValues[Math.min(i, 9)];
                  return (
                    <Animated.View
                      key={p.user_id}
                      style={[styles.settlementPlayerCard, { backgroundColor: secondaryBg, borderColor: colors.border, opacity: animVal, transform: [{ translateY: animVal.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }] }]}
                    >
                      <View style={[styles.settlementAvatar, { backgroundColor: net >= 0 ? COLORS.glass.glowGreen : COLORS.glass.glowRed }]}>
                        <Subhead style={{ color: net >= 0 ? colors.success : colors.danger, fontWeight: "700" }}>
                          {(p?.user?.name || p?.name || "?")[0].toUpperCase()}
                        </Subhead>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Headline>{p?.user?.name || p?.name || "Player"}</Headline>
                        <Footnote style={{ color: colors.textMuted }}>Buy-in: ${p.total_buy_in || 0} · Cash-out: ${currentVal.toFixed(0)}</Footnote>
                      </View>
                      <Headline style={{ color: profitColor(net), fontVariant: ["tabular-nums"] }}>{net >= 0 ? "+" : ""}{net.toFixed(0)}</Headline>
                    </Animated.View>
                  );
                })}
              </ScrollView>
            )}

            {settlementPhase === 1 && (
              <View style={{ alignItems: "center", paddingVertical: SPACE.xxl }}>
                <ActivityIndicator size="large" color={colors.buttonPrimary} />
                <Footnote style={{ color: colors.textMuted, marginTop: SPACE.lg }}>Kvitt is optimizing payments...</Footnote>
              </View>
            )}

            {settlementPhase >= 2 && (
              <ScrollView showsVerticalScrollIndicator={false}>
                {(settlementData?.payments?.length ?? 0) > 0 && (
                  <View style={styles.settlementBadgeRow}>
                    <View style={[styles.settlementBadge, { backgroundColor: COLORS.glass.glowRed }]}>
                      <Caption2 style={{ color: colors.danger, fontWeight: "600" }}>
                        Up to {players.filter((p: any) => (p.total_buy_in || 0) > 0).length} payments
                      </Caption2>
                    </View>
                    <Ionicons name="arrow-forward" size={16} color={colors.textMuted} />
                    <View style={[styles.settlementBadge, { backgroundColor: COLORS.glass.glowGreen }]}>
                      <Caption2 style={{ color: colors.success, fontWeight: "600" }}>
                        {settlementData?.payments?.length ?? 0} payments
                      </Caption2>
                    </View>
                  </View>
                )}

                {(settlementData?.payments?.length ?? 0) === 0 && (
                  <View style={{ alignItems: "center", paddingVertical: SPACE.xl }}>
                    <Ionicons name="checkmark-circle" size={48} color={colors.success} />
                    <Headline style={{ marginTop: SPACE.md }}>Everyone broke even!</Headline>
                    <Footnote style={{ color: colors.textMuted, marginTop: SPACE.xs }}>No payments needed</Footnote>
                  </View>
                )}

                {(settlementData?.payments || []).map((pay: any, i: number) => {
                  const animVal = paymentAnimValues[Math.min(i, 9)];
                  return (
                    <Animated.View
                      key={pay.ledger_id || i}
                      style={[styles.settlementPaymentRow, { backgroundColor: secondaryBg, borderColor: colors.border, opacity: animVal, transform: [{ translateY: animVal.interpolate({ inputRange: [0, 1], outputRange: [15, 0] }) }] }]}
                    >
                      <View style={[styles.settlementAvatar, { backgroundColor: COLORS.glass.glowRed }]}>
                        <Caption2 style={{ color: colors.danger, fontWeight: "700" }}>{(pay.from_name || "?")[0].toUpperCase()}</Caption2>
                      </View>
                      <View style={{ flex: 1, marginHorizontal: SPACE.sm }}>
                        <Subhead>{pay.from_name || "Player"} → {pay.to_name || "Player"}</Subhead>
                      </View>
                      <Headline style={{ color: colors.warning, fontVariant: ["tabular-nums"] }}>${pay.amount?.toFixed(2)}</Headline>
                      <View style={[styles.settlementAvatar, { backgroundColor: COLORS.glass.glowGreen, marginLeft: SPACE.sm }]}>
                        <Caption2 style={{ color: colors.success, fontWeight: "700" }}>{(pay.to_name || "?")[0].toUpperCase()}</Caption2>
                      </View>
                    </Animated.View>
                  );
                })}
              </ScrollView>
            )}

            {settlementPhase >= 3 && (
              <Pressable
                style={({ pressed }) => [styles.submitBtn, { backgroundColor: colors.buttonPrimary, marginTop: SPACE.lg, opacity: pressed ? 0.92 : 1 }]}
                onPress={() => { setShowSettlementPreview(false); navigation.navigate("Settlement", { gameId }); }}
              >
                <Ionicons name="calculator" size={18} color={colors.buttonText} />
                <Headline style={{ color: colors.buttonText, marginLeft: SPACE.sm }}>View Full Settlement</Headline>
              </Pressable>
            )}

            <Pressable style={{ alignSelf: "center", marginTop: SPACE.lg, padding: SPACE.sm }} onPress={() => setShowSettlementPreview(false)}>
              <Footnote style={{ color: colors.textMuted }}>Dismiss</Footnote>
            </Pressable>
          </Pressable>
        </View>
      </Modal>
    </View>
  );
}

/* �����������������������������������������������������������������������������
   STYLES - Apple HIG spacing
   ����������������������������������������������������������������������������� */

const styles = StyleSheet.create({
  root: { flex: 1 },
  topGradient: { position: "absolute", top: 0, left: 0, right: 0, zIndex: 0 },
  bodyAboveGradient: { zIndex: 1 },
  bodyScroll: { flex: 1 },
  topChrome: { zIndex: 3 },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: SCREEN_PAD,
    paddingTop: SPACE.md,
    paddingBottom: SPACE.sm,
    gap: SPACE.sm,
  },
  backPill: {
    width: LAYOUT.touchTarget,
    height: LAYOUT.touchTarget,
    borderRadius: RADIUS.full,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },
  headerCenter: { flex: 1, minWidth: 0 },
  screenTitle: { letterSpacing: -0.5 },
  headerBadges: { flexDirection: "row", alignItems: "center", gap: SPACE.sm, marginTop: SPACE.xs },
  statusPill: { flexDirection: "row", alignItems: "center", gap: SPACE.xs, paddingHorizontal: SPACE.sm, paddingVertical: SPACE.xs, borderRadius: SPACE.sm },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  body: { flex: 1 },
  scrollContent: { paddingHorizontal: SCREEN_PAD, paddingTop: SPACE.sm },

  /* ��� Error ��� */
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    padding: SPACE.md,
    borderRadius: RADIUS.lg,
    borderWidth: StyleSheet.hairlineWidth,
    gap: SPACE.sm,
    marginBottom: LAYOUT.sectionGap,
  },

  /* ��� Bento Stats Row ��� */
  bentoRow: { flexDirection: "row", gap: SPACE.sm, marginBottom: LAYOUT.sectionGap },
  bentoCard: { flex: 1, paddingHorizontal: SPACE.md, paddingVertical: SPACE.md },
  bentoRingOuter: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth * 2,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginTop: SPACE.sm,
  },
  bentoRingInner: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },

  /* ��� Hero Card ��� */
  heroCard: { padding: LAYOUT.cardPadding, marginBottom: LAYOUT.sectionGap },
  heroCardContent: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  heroCardLeft: { flex: 1, gap: SPACE.md },
  hostBadge: { flexDirection: "row", alignItems: "center", alignSelf: "flex-start", gap: SPACE.xs, paddingHorizontal: SPACE.sm, paddingVertical: SPACE.xs, borderRadius: SPACE.sm },
  chipInfoRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: SPACE.sm },
  chipInfoItem: { flexDirection: "row", alignItems: "center", gap: SPACE.xs },
  chipInfoDivider: { width: 1, height: 16 },
  suitsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: SPACE.xs,
    flexShrink: 0,
  },
  suitRingOuter: {
    width: ICON_WELL.tri.outer,
    height: ICON_WELL.tri.outer,
    borderRadius: ICON_WELL.tri.outer / 2,
    padding: ICON_WELL.tri.ringPadding,
    borderWidth: StyleSheet.hairlineWidth * 2,
    alignItems: "center",
    justifyContent: "center",
  },
  suitRingInner: {
    width: ICON_WELL.tri.inner,
    height: ICON_WELL.tri.inner,
    borderRadius: ICON_WELL.tri.inner / 2,
    alignItems: "center",
    justifyContent: "center",
  },

  /* ��� Actions Card ��� */
  actionsCard: { padding: LAYOUT.cardPadding, marginBottom: LAYOUT.sectionGap, gap: SPACE.md },
  primaryActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACE.sm,
    borderRadius: RADIUS.xl,
    minHeight: BUTTON_SIZE.large.height,
  },
  hostActionsGrid: { flexDirection: "row", gap: SPACE.sm },
  hostActionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACE.xs,
    borderRadius: RADIUS.lg,
    borderWidth: StyleSheet.hairlineWidth,
    minHeight: BUTTON_SIZE.regular.height,
  },
  endGameBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACE.sm,
    borderRadius: RADIUS.lg,
    minHeight: BUTTON_SIZE.regular.height,
  },

  /* ��� Split Row (Your Position) ��� */
  splitRow: { flexDirection: "row", gap: SPACE.sm, marginBottom: LAYOUT.sectionGap },
  splitCard: { flex: 1, paddingHorizontal: LAYOUT.cardPadding, paddingVertical: LAYOUT.cardPadding },
  splitBig: { fontSize: 44, fontWeight: "800", letterSpacing: -1, marginTop: SPACE.xs },
  splitMeta: { flexDirection: "row", alignItems: "center", gap: SPACE.xs, marginTop: SPACE.sm },
  cashedOutBadge: { flexDirection: "row", alignItems: "center", alignSelf: "flex-start", gap: SPACE.xs, paddingHorizontal: SPACE.sm, paddingVertical: SPACE.xs, borderRadius: SPACE.sm, marginTop: SPACE.sm },

  /* ��� Join Card ��� */
  joinCard: { padding: LAYOUT.cardPadding, alignItems: "center", marginBottom: LAYOUT.sectionGap },
  joinBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACE.sm,
    borderRadius: RADIUS.xl,
    paddingHorizontal: SPACE.xxl,
    minHeight: BUTTON_SIZE.large.height,
    marginTop: SPACE.lg,
  },

  /* ��� Section Cards ��� */
  sectionCard: { marginBottom: LAYOUT.sectionGap, overflow: "hidden" },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: LAYOUT.cardPadding,
    paddingVertical: SPACE.md,
  },
  sectionHeaderLeft: { flexDirection: "row", alignItems: "center", gap: SPACE.sm },
  sectionBody: { paddingHorizontal: LAYOUT.cardPadding, paddingBottom: SPACE.md },
  liveDot: { width: 10, height: 10, borderRadius: 5 },

  /* Chart */
  chartContainer: { paddingHorizontal: LAYOUT.cardPadding, paddingBottom: LAYOUT.cardPadding },
  chartContainerCompact: { paddingHorizontal: LAYOUT.cardPadding, paddingBottom: SPACE.sm },
  chartLabels: { flexDirection: "row", marginTop: SPACE.sm },
  chartLabelsCompact: { flexDirection: "row", marginTop: SPACE.xs },
  chartLabel: { flex: 1, alignItems: "center" },
  gamePulseCard: {
    marginBottom: LAYOUT.sectionGap,
    overflow: "hidden",
    paddingBottom: SPACE.sm,
  },
  gamePulseHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: LAYOUT.cardPadding,
    paddingTop: SPACE.sm,
    paddingBottom: SPACE.xs,
  },

  /* ��� Players ��� */
  playerRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: SPACE.md,
    gap: SPACE.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  playerAvatar: { width: 44, height: 44, borderRadius: 12, justifyContent: "center", alignItems: "center" },
  playerInfo: { flex: 1, minWidth: 0 },
  playerNameRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap" },
  playerActions: { flexDirection: "row", gap: SPACE.sm },
  playerActionBtn: { width: 36, height: 36, borderRadius: 10, justifyContent: "center", alignItems: "center" },
  editBtn: { width: 32, height: 32, borderRadius: 8, justifyContent: "center", alignItems: "center", marginRight: SPACE.sm },

  /* ��� Quick Links ��� */
  quickLinksRow: { flexDirection: "row", gap: SPACE.sm, marginBottom: LAYOUT.sectionGap },
  quickLinkCard: { flex: 1, padding: LAYOUT.cardPadding, alignItems: "center", position: "relative" },
  quickLinkIcon: { width: 48, height: 48, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  quickLinkBadge: { position: "absolute", top: SPACE.md, right: SPACE.md, paddingHorizontal: SPACE.sm, paddingVertical: 2, borderRadius: SPACE.sm },

  /* In-scroll player buy-in / cash-out row (replaces sticky footer) */
  playerTradeRow: {
    marginBottom: LAYOUT.sectionGap,
    flexDirection: "row",
    gap: SPACE.sm,
    padding: LAYOUT.cardPadding,
    alignItems: "stretch",
  },
  playerTradeBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACE.sm,
    minHeight: BUTTON_SIZE.large.height,
    borderRadius: RADIUS.xl,
  },
  playerTradeBtnOutline: { backgroundColor: "transparent", borderWidth: 2 },

  /* ��� Modals ��� */
  modalOverlay: { flex: 1, justifyContent: "flex-end" },
  modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.5)" },
  sheetContainer: { borderTopLeftRadius: RADIUS.sheet, borderTopRightRadius: RADIUS.sheet, paddingHorizontal: SCREEN_PAD, paddingTop: SPACE.md, paddingBottom: SPACE.xxl, maxHeight: "85%" },
  sheetHandle: { width: 36, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: SPACE.lg },
  sheetTitle: { textAlign: "center", marginBottom: SPACE.md },

  /* ��� Form Elements ��� */
  optionRow: { flexDirection: "row", gap: SPACE.sm, marginBottom: SPACE.lg },
  optionBtn: { flex: 1, minHeight: LAYOUT.touchTarget, borderRadius: RADIUS.lg, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  previewCard: { borderRadius: RADIUS.lg, padding: SPACE.lg, borderWidth: 1, alignItems: "center", marginBottom: SPACE.lg },
  chipInput: { borderWidth: 1, borderRadius: RADIUS.lg, padding: SPACE.md, fontSize: 24, fontWeight: "600", textAlign: "center", marginBottom: SPACE.md },
  searchInput: { borderWidth: 1, borderRadius: RADIUS.lg, padding: SPACE.md, fontSize: APPLE_TYPO.body.size, marginBottom: SPACE.sm },
  summaryCard: { borderRadius: RADIUS.lg, padding: SPACE.lg, borderWidth: 1, gap: SPACE.sm, marginBottom: SPACE.lg },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  summaryDivider: { height: StyleSheet.hairlineWidth, marginVertical: SPACE.xs },
  submitBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: SPACE.sm, minHeight: BUTTON_SIZE.large.height, borderRadius: RADIUS.xl },

  /* ��� Player Select ��� */
  playerSelectScroll: { marginBottom: SPACE.sm },
  playerSelectBtn: { alignItems: "center", padding: SPACE.md, borderRadius: RADIUS.lg, borderWidth: 1, marginRight: SPACE.sm, width: 90 },
  playerSelectAvatar: { width: 40, height: 40, borderRadius: 12, justifyContent: "center", alignItems: "center", marginBottom: SPACE.xs },

  /* ��� Search Results ��� */
  searchResultsScroll: { maxHeight: 300 },
  searchResultItem: { flexDirection: "row", alignItems: "center", padding: SPACE.md, borderRadius: RADIUS.lg, borderWidth: 1, marginBottom: SPACE.sm, gap: SPACE.sm },
  searchResultInfo: { flex: 1, gap: 2 },
  inviteBtn: { paddingHorizontal: SPACE.md, paddingVertical: SPACE.sm, borderRadius: RADIUS.md },

  /* ��� Hand Rankings ��� */
  handRankingsSheet: { maxHeight: "85%" },
  handRankingsHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: SPACE.xs },
  handRankingsList: { marginTop: SPACE.sm },
  handRankItem: { flexDirection: "row", alignItems: "center", paddingVertical: SPACE.md, borderBottomWidth: StyleSheet.hairlineWidth, gap: SPACE.md },
  rankBadge: { width: 32, height: 32, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  handRankInfo: { flex: 1 },

  /* Game thread modal — body hosts GameThreadMessagesPanel */
  threadSheet: { minHeight: "62%", maxHeight: "88%" },
  threadHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: SPACE.sm },
  threadPanelBody: { flex: 1, minHeight: 280, minWidth: 0 },

  /* ��� Settlement ��� */
  settlementSheet: { minHeight: 460 },
  settlementPlayerCard: { flexDirection: "row", alignItems: "center", padding: SPACE.md, borderRadius: RADIUS.lg, borderWidth: 1, marginBottom: SPACE.sm, gap: SPACE.md },
  settlementAvatar: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  settlementBadgeRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: SPACE.sm, marginBottom: SPACE.lg },
  settlementBadge: { paddingVertical: SPACE.sm, paddingHorizontal: SPACE.md, borderRadius: RADIUS.lg },
  settlementPaymentRow: { flexDirection: "row", alignItems: "center", padding: SPACE.md, borderRadius: RADIUS.lg, borderWidth: 1, marginBottom: SPACE.sm },
});
