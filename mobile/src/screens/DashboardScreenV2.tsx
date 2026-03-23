import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  ScrollView,
  Text,
  View,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
  Pressable,
  Animated,
  Alert,
} from "react-native";
import { DashboardSkeleton } from "../components/ui/DashboardSkeleton";
import { AnimatedModal } from "../components/AnimatedModal";
import { AnimatedButton } from "../components/AnimatedButton";
import { OnboardingAgent, hasCompletedOnboarding } from "../components/OnboardingAgent";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useDrawer } from "../context/DrawerContext";
import { useTheme } from "../context/ThemeContext";
import { getThemedColors, COLORS } from "../styles/liquidGlass";
import { FONT, SPACE, LAYOUT, RADIUS } from "../styles/tokens";
import { useLanguage } from "../context/LanguageContext";
import { AppDrawer } from "../components/AppDrawer";
import { AIChatFab } from "../components/AIChatFab";
import { AIGradientOrb } from "./AIAssistantScreen";
import { useReducedMotion } from "../hooks/useReducedMotion";
import type { RootStackParamList } from "../navigation/RootNavigator";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

// Liquid Glass Design System Colors

export function DashboardScreenV2() {
  const { isDark, colors } = useTheme();
  const { t } = useLanguage();
  const reduceMotion = useReducedMotion();

  const navigation = useNavigation<NavigationProp>();
  const { user } = useAuth();
  const { toggleDrawer } = useDrawer();
  const insets = useSafeAreaInsets();
  const [stats, setStats] = useState<any>(null);
  const [balances, setBalances] = useState<any>({ net_balance: 0, total_you_owe: 0, total_owed_to_you: 0 });
  const [recentGames, setRecentGames] = useState<any[]>([]);
  const [activeGames, setActiveGames] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [skeletonVisible, setSkeletonVisible] = useState(true);
  const skeletonOpacity = useRef(new Animated.Value(1)).current;
  const contentOpacity = useRef(new Animated.Value(0)).current;
  const [error, setError] = useState<string | null>(null);
  const [showOnboardingAgent, setShowOnboardingAgent] = useState(false);
  const [showStatModal, setShowStatModal] = useState<'profit' | 'winrate' | null>(null);
  const [showBalanceModal, setShowBalanceModal] = useState(false);
  const [showNotificationsPanel, setShowNotificationsPanel] = useState(false);
  const [aiUsage, setAiUsage] = useState<{ requests_remaining: number; daily_limit: number; is_premium: boolean } | null>(null);

  // Animated pulse for live indicator
  const pulseAnim = useState(new Animated.Value(1))[0];
  const glowAnim = useState(new Animated.Value(0.5))[0];

  // Entrance animations for staggered fade-in
  const entranceAnim = useState(new Animated.Value(0))[0];
  const statsEntrance = useState(new Animated.Value(0))[0];
  const aiCardEntrance = useState(new Animated.Value(0))[0];
  const perfEntrance = useState(new Animated.Value(0))[0];
  const sectionsEntrance = useState(new Animated.Value(0))[0];

  useEffect(() => {
    // When reduced motion is enabled, skip all looping/entrance animations
    if (reduceMotion) {
      pulseAnim.setValue(1);
      glowAnim.setValue(1);
      entranceAnim.setValue(1);
      statsEntrance.setValue(1);
      aiCardEntrance.setValue(1);
      perfEntrance.setValue(1);
      sectionsEntrance.setValue(1);
      return;
    }

    // Pulse animation for live games
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 0.4,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();

    // Glow animation for cards
    const glow = Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(glowAnim, {
          toValue: 0.5,
          duration: 2000,
          useNativeDriver: true,
        }),
      ])
    );
    glow.start();

    // Staggered entrance animations
    Animated.stagger(100, [
      Animated.spring(entranceAnim, { toValue: 1, useNativeDriver: true, tension: 50, friction: 8 }),
      Animated.spring(statsEntrance, { toValue: 1, useNativeDriver: true, tension: 50, friction: 8 }),
      Animated.spring(aiCardEntrance, { toValue: 1, useNativeDriver: true, tension: 50, friction: 8 }),
      Animated.spring(perfEntrance, { toValue: 1, useNativeDriver: true, tension: 50, friction: 8 }),
      Animated.spring(sectionsEntrance, { toValue: 1, useNativeDriver: true, tension: 50, friction: 8 }),
    ]).start();

    return () => {
      pulse.stop();
      glow.stop();
    };
  }, [reduceMotion, pulseAnim, glowAnim, entranceAnim, statsEntrance, aiCardEntrance, perfEntrance, sectionsEntrance]);

  const fetchDashboard = useCallback(async () => {
    const failures = { count: 0 };
    try {
      setError(null);
      const [statsRes, gamesRes, notifRes, groupsRes, balancesRes, aiUsageRes] = await Promise.all([
        api.get("/stats/me").catch(() => { failures.count++; return { data: null }; }),
        api.get("/games").catch(() => { failures.count++; return { data: [] }; }),
        api.get("/notifications").catch(() => { failures.count++; return { data: [] }; }),
        api.get("/groups").catch(() => { failures.count++; return { data: [] }; }),
        api.get("/ledger/consolidated").catch(() => { failures.count++; return { data: { net_balance: 0, total_you_owe: 0, total_owed_to_you: 0 } }; }),
        api.get("/assistant/usage").catch(() => { failures.count++; return { data: null }; }),
      ]);
      if (failures.count >= 4) {
        setError("We couldn't load your dashboard. Check your connection and pull to refresh.");
      }
      setStats(statsRes.data);
      setBalances(balancesRes.data);
      const games = Array.isArray(gamesRes.data) ? gamesRes.data : [];
      setActiveGames(games.filter((g: any) => g.status === "active" || g.status === "scheduled"));
      setRecentGames(games.slice(0, 5));
      const notifs = Array.isArray(notifRes.data) ? notifRes.data : [];
      setNotifications(notifs.filter((n: any) => !n.read));
      setGroups(Array.isArray(groupsRes.data) ? groupsRes.data : []);
      if (aiUsageRes.data) setAiUsage(aiUsageRes.data);
    } catch (e: any) {
      setError("We couldn't load your dashboard. Check your connection and pull to refresh.");
    } finally {
      setLoading(false);
      const minWait = setTimeout(() => {
        Animated.parallel([
          Animated.timing(skeletonOpacity, { toValue: 0, duration: 300, useNativeDriver: true }),
          Animated.timing(contentOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
        ]).start(() => setSkeletonVisible(false));
      }, 400);
      return () => clearTimeout(minWait);
    }
  }, [skeletonOpacity, contentOpacity]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  // Auto-show onboarding agent for first-time users
  useEffect(() => {
    hasCompletedOnboarding().then((done) => {
      if (!done) {
        // Small delay to let dashboard load first
        const t = setTimeout(() => setShowOnboardingAgent(true), 800);
        return () => clearTimeout(t);
      }
    });
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchDashboard();
    setRefreshing(false);
  }, [fetchDashboard]);

  const menuSections = [
    {
      key: "primary",
      items: [
        { icon: "home-outline" as const, label: t.nav.dashboard, onPress: () => {} },
        { icon: "people-outline" as const, label: t.nav.groups, onPress: () => navigation.navigate("MainTabs" as any, { screen: "Groups" }) },
        { icon: "chatbubbles-outline" as const, label: t.nav.chats, onPress: () => navigation.navigate("MainTabs" as any, { screen: "Chats" }) },
        { icon: "game-controller-outline" as const, label: t.nav.games, onPress: () => navigation.navigate("MainTabs" as any, { screen: "Groups" }) },
        { icon: "receipt-outline" as const, label: t.nav.settlements, onPress: () => navigation.navigate("SettlementHistory" as any) },
        { icon: "calendar-outline" as const, label: "Schedule", onPress: () => navigation.navigate("Scheduler") },
        {
          icon: "notifications-outline" as const,
          label: "Alerts",
          onPress: () => setShowNotificationsPanel(true),
          badge: notifications.length > 0 ? notifications.length : undefined,
        },
        { icon: "document-text-outline" as const, label: "View Requests", onPress: () => navigation.navigate("PendingRequests") },
      ],
    },
  ];

  const recentDrawerItems = recentGames.map((game) => ({
    id: game.game_id || game._id || String(Math.random()),
    title: game.title || game.group_name || "Game Night",
    subtitle: game.status === "active" ? "Live" : "Ended",
    onPress: () => navigation.navigate("GameNight", { gameId: game.game_id || game._id }),
  }));

  const userName = user?.name || user?.email?.split("@")[0] || "Player";

  // Calculate performance stats
  const netProfit = stats?.net_profit || 0;
  const totalGames = stats?.total_games || 0;
  const winRate = stats?.win_rate || 0;
  const wins = totalGames > 0 ? Math.round((winRate / 100) * totalGames) : 0;
  const losses = totalGames - wins;
  const avgProfit = totalGames > 0 ? netProfit / totalGames : 0;
  const bestWin = stats?.best_win || stats?.biggest_win || 0;
  const worstLoss = stats?.worst_loss || stats?.biggest_loss || 0;
  const totalBuyIns = stats?.total_buy_ins || 0;
  const roiPercent = totalBuyIns > 0 ? (netProfit / totalBuyIns) * 100 : 0;

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "Recent";
    const date = new Date(dateStr);
    return date.toLocaleDateString();
  };

  const formatNotifTime = (d: string) => {
    const diff = Date.now() - new Date(d).getTime();
    const h = diff / 3600000;
    if (h < 1) return "Just now";
    if (h < 24) return `${Math.floor(h)}h ago`;
    if (h < 48) return "Yesterday";
    return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const getNotifIcon = (type: string): { icon: string; color: string } => {
    const map: Record<string, { icon: string; color: string }> = {
      game_started: { icon: "play-circle", color: lc.success },
      game_ended: { icon: "stop-circle", color: lc.textMuted },
      settlement_generated: { icon: "calculator", color: "#F59E0B" },
      settlement: { icon: "calculator", color: "#F59E0B" },
      invite_accepted: { icon: "person-add", color: lc.success },
      wallet_received: { icon: "wallet", color: lc.success },
      group_invite: { icon: "people", color: lc.orange },
      group_invite_request: { icon: "people", color: "#A855F7" },
      game_invite: { icon: "game-controller", color: "#A855F7" },
      invite_declined: { icon: "close-circle", color: lc.danger },
      buy_in: { icon: "cash-outline", color: lc.orange },
      buy_in_request: { icon: "cash-outline", color: lc.orange },
      buy_in_approved: { icon: "checkmark-circle", color: lc.success },
      cash_out: { icon: "trending-up", color: lc.success },
      join_request: { icon: "person-add", color: "#3B82F6" },
      join_approved: { icon: "checkmark-circle", color: lc.success },
      join_rejected: { icon: "close-circle", color: lc.danger },
      payment_request: { icon: "card", color: "#3B82F6" },
      payment_received: { icon: "card", color: lc.success },
      reminder: { icon: "alarm", color: lc.moonstone },
      automation_disabled: { icon: "cog", color: lc.danger },
      automation_error: { icon: "cog", color: lc.danger },
      group_message: { icon: "chatbubbles", color: "#3B82F6" },
      group_chat: { icon: "chatbubbles", color: "#3B82F6" },
      feedback_update: { icon: "megaphone", color: "#A855F7" },
      issue_responded: { icon: "megaphone", color: "#A855F7" },
      post_game_survey: { icon: "clipboard", color: "#F59E0B" },
      admin_transferred: { icon: "shield", color: lc.orange },
      invite_sent: { icon: "mail", color: "#3B82F6" },
      chip_edit: { icon: "create", color: lc.moonstone },
      withdrawal_requested: { icon: "arrow-down-circle", color: "#F59E0B" },
    };
    return map[type] || { icon: "notifications", color: lc.moonstone };
  };

  const handleMarkAllRead = async () => {
    try {
      await api.put("/notifications/read-all");
      setNotifications([]);
    } catch {}
  };

  const handleDeleteNotification = async (notifId: string) => {
    try {
      await api.delete(`/notifications/${notifId}`);
      setNotifications(prev => prev.filter(n => n.notification_id !== notifId));
    } catch {}
  };

  const handleNotificationPress = async (notif: any) => {
    // Mark as read and remove from unread list
    try {
      await api.put(`/notifications/${notif.notification_id}/read`);
      setNotifications(prev => prev.filter(n => n.notification_id !== notif.notification_id));
    } catch {}

    setShowNotificationsPanel(false);

    const type = notif.type || "";
    const data = notif.data || {};

    switch (type) {
      case "game_started":
      case "game_ended":
      case "buy_in":
      case "buy_in_request":
      case "buy_in_approved":
      case "cash_out":
      case "chip_edit":
        if (data.game_id) navigation.navigate("GameNight", { gameId: data.game_id });
        break;

      case "settlement_generated":
      case "settlement":
      case "payment_received":
        if (data.game_id) navigation.navigate("Settlement" as any, { gameId: data.game_id });
        break;

      case "payment_request":
        navigation.navigate("RequestAndPay" as any);
        break;

      case "reminder":
        if (data.game_id && data.ledger_id) {
          navigation.navigate("Settlement" as any, { gameId: data.game_id });
        } else if (data.game_id) {
          navigation.navigate("GameNight", { gameId: data.game_id });
        }
        break;

      case "group_invite_request":
      case "group_invite":
      case "invite_accepted":
      case "invite_sent":
      case "admin_transferred":
        if (data.group_id) {
          navigation.navigate("GroupHub", { groupId: data.group_id });
        } else {
          navigation.navigate("MainTabs" as any, { screen: "Groups" });
        }
        break;

      case "game_invite":
      case "invite_declined":
        if (data.game_id) navigation.navigate("GameNight", { gameId: data.game_id });
        break;

      case "join_request":
      case "join_approved":
      case "join_rejected":
        if (data.group_id) navigation.navigate("GroupHub", { groupId: data.group_id });
        break;

      case "wallet_received":
      case "withdrawal_requested":
        navigation.navigate("Wallet");
        break;

      case "automation_disabled":
      case "automation_error":
        navigation.navigate("Automations" as any);
        break;

      case "group_message":
      case "group_chat":
        if (data.group_id) navigation.navigate("GroupChat" as any, { groupId: data.group_id });
        break;

      case "post_game_survey":
        if (data.game_id) navigation.navigate("Settlement" as any, { gameId: data.game_id });
        break;

      case "event_invite":
      case "event_reminder":
      case "rsvp_update":
        if (data.occurrence_id) {
          navigation.navigate("RSVP", { occurrenceId: data.occurrence_id });
        } else {
          navigation.navigate("Scheduler");
        }
        break;

      case "feedback_update":
      case "issue_responded":
        navigation.navigate("Feedback" as any);
        break;

      default:
        break;
    }
  };

  // Game invite action handlers
  const handleAcceptGameInvite = async (notif: any) => {
    try {
      await api.post(`/games/${notif.data.game_id}/accept-invite`);
      Alert.alert("Joined!", "You've joined the game.");
      setNotifications(prev => prev.filter(n => n.notification_id !== notif.notification_id));
      setShowNotificationsPanel(false);
      navigation.navigate("GameNight", { gameId: notif.data.game_id });
    } catch (e: any) {
      Alert.alert("Error", e?.response?.data?.detail || "Failed to accept invite");
    }
  };

  const handleDeclineGameInvite = async (notif: any) => {
    try {
      await api.post(`/games/${notif.data.game_id}/decline-invite`);
      Alert.alert("Declined", "Invite declined.");
      setNotifications(prev => prev.filter(n => n.notification_id !== notif.notification_id));
    } catch (e: any) {
      Alert.alert("Error", e?.response?.data?.detail || "Failed to decline invite");
    }
  };

  const lc = getThemedColors(isDark, colors);

  return (
    <AppDrawer
      menuSections={menuSections}
      recentItems={recentDrawerItems}
      userName={user?.name || user?.email || "Player"}
      userEmail={user?.email}
      onProfilePress={() => navigation.navigate("MainTabs" as any, { screen: "Profile" })}
      onNewPress={() => navigation.navigate("AIAssistant")}
      onAllGamesPress={() => navigation.navigate("MainTabs" as any, { screen: "Groups" })}
    >
      <View style={[styles.container, { paddingTop: insets.top, backgroundColor: lc.jetDark }]}>
        {/* Header Bar */}
        <View style={styles.header}>
          {/* Hamburger Button - Glass style with orange glow */}
          <Pressable
            style={({ pressed }) => [
              styles.glassButton,
              { backgroundColor: lc.liquidGlassBg, borderColor: lc.liquidGlassBorder },
              pressed && [styles.glassButtonPressed, { shadowColor: lc.orange }]
            ]}
            onPress={toggleDrawer}
            accessibilityLabel="Open menu"
            accessibilityRole="button"
          >
            <View style={styles.hamburgerLines}>
              <View style={[styles.hamburgerLine, { backgroundColor: lc.textSecondary }]} />
              <View style={[styles.hamburgerLine, { backgroundColor: lc.textSecondary }]} />
              <View style={[styles.hamburgerLine, { backgroundColor: lc.textSecondary }]} />
            </View>
          </Pressable>

          {/* Center - Logo with orange tagline */}
          <View style={styles.headerCenter}>
            <Text style={[styles.logoText, { color: lc.textPrimary }]}>Kvitt</Text>
            <Text style={[styles.logoSubtext, { color: lc.textSecondary }]}>Play <Text style={{ color: lc.orange }}>smarter</Text></Text>
          </View>

          {/* Notification Button - Glass style */}
          <Pressable
            style={({ pressed }) => [
              styles.glassButton,
              { backgroundColor: lc.liquidGlassBg, borderColor: lc.liquidGlassBorder },
              pressed && styles.glassButtonPressed
            ]}
            onPress={() => setShowNotificationsPanel(true)}
            accessibilityLabel={`Notifications${notifications.length > 0 ? `, ${notifications.length} unread` : ''}`}
            accessibilityRole="button"
          >
            <Ionicons name="notifications-outline" size={18} color={lc.textSecondary} />
            {notifications.length > 0 && <View style={[styles.notifDot, { backgroundColor: lc.orange }]} />}
          </Pressable>
        </View>

        {/* Welcome Section - Editorial Style */}
        <View style={[styles.welcomeRow, styles.welcomeRowSticky]}>
          <View style={styles.welcomeTextContainer}>
            <Text style={[styles.welcomeLabel, { color: lc.textMuted }]}>
              OVERVIEW
            </Text>
            <Text style={[styles.welcomeTitle, { color: lc.textPrimary }]}>
              Welcome back, <Text style={{ color: lc.orange }}>{userName.split(' ')[0]}</Text>
            </Text>
            <Text style={[styles.welcomeSubtitle, { color: lc.moonstone }]}>
              Here's your poker overview
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.helpButtonSmall, { backgroundColor: lc.liquidGlassBg, borderColor: lc.liquidGlassBorder }]}
            onPress={() => setShowOnboardingAgent(true)}
            activeOpacity={0.7}
            accessibilityLabel="Show help guide"
            accessibilityRole="button"
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="help-circle-outline" size={16} color={lc.moonstone} />
          </TouchableOpacity>
        </View>
        {/* Gradient divider line */}
        <LinearGradient
          colors={[`${lc.orange}66`, 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.gradientDivider}
        />

        {/* ── Skeleton overlay ────────────────────────────────────────── */}
        {skeletonVisible && (
          <Animated.View
            style={[StyleSheet.absoluteFill, { opacity: skeletonOpacity, backgroundColor: lc.jetDark, zIndex: 10 }]}
            pointerEvents="none"
          >
            <DashboardSkeleton />
          </Animated.View>
        )}

        <Animated.View style={{ flex: 1, opacity: contentOpacity }}>
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={lc.orange} />
          }
        >
          {error && (
            <View style={[styles.errorBanner, { borderColor: "rgba(239,68,68,0.3)" }]}>
              <Ionicons name="alert-circle" size={16} color={lc.danger} />
              <Text style={[styles.errorText, { color: lc.danger }]}>{error}</Text>
            </View>
          )}

          {/* Stats Cards - 3 Column Grid like Web */}
          <Animated.View style={[styles.statsRowThree, {
            opacity: statsEntrance,
            transform: [{
              translateY: statsEntrance.interpolate({
                inputRange: [0, 1],
                outputRange: [20, 0],
              })
            }]
          }]}>
            {/* Net Profit Card - Orange Glow */}
            <TouchableOpacity
              style={[styles.liquidCardThird, { backgroundColor: lc.liquidGlassBg, borderColor: lc.liquidGlassBorder }]}
              activeOpacity={0.8}
              onPress={() => setShowStatModal('profit')}
            >
              <View style={[styles.liquidInnerSmall, { backgroundColor: lc.liquidGlowOrange }]}>
                <View style={styles.statIconRowSmall}>
                  <Text style={[styles.statLabelSmall, { color: lc.moonstone }]}>NET PROFIT</Text>
                  <Ionicons
                    name={netProfit >= 0 ? "trending-up" : "trending-down"}
                    size={12}
                    color={netProfit >= 0 ? lc.success : lc.danger}
                  />
                </View>
                <Text style={[styles.statValueSmall, { color: netProfit >= 0 ? lc.success : lc.danger }]}>
                  {netProfit >= 0 ? '+' : ''}${Math.abs(netProfit).toFixed(0)}
                </Text>
                <Text style={[styles.statSubtextSmall, { color: lc.textMuted }]}>
                  {totalGames} games
                </Text>
              </View>
            </TouchableOpacity>

            {/* Win Rate Card - Blue Glow */}
            <TouchableOpacity
              style={[styles.liquidCardThird, { backgroundColor: lc.liquidGlassBg, borderColor: lc.liquidGlassBorder }]}
              activeOpacity={0.8}
              onPress={() => setShowStatModal('winrate')}
            >
              <View style={[styles.liquidInnerSmall, { backgroundColor: lc.liquidGlowBlue }]}>
                <View style={styles.statIconRowSmall}>
                  <Text style={[styles.statLabelSmall, { color: lc.moonstone }]}>WIN RATE</Text>
                  <Ionicons name="analytics-outline" size={12} color={lc.trustBlue} />
                </View>
                <Text style={[styles.statValueSmall, { color: lc.trustBlue }]}>
                  {winRate.toFixed(0)}%
                </Text>
                <Text style={[styles.statSubtextSmall, { color: lc.textMuted }]}>
                  {wins}W / {losses}L
                </Text>
              </View>
            </TouchableOpacity>

            {/* Balance Card - Green/Red Glow */}
            <TouchableOpacity
              style={[styles.liquidCardThird, { backgroundColor: lc.liquidGlassBg, borderColor: lc.liquidGlassBorder }]}
              activeOpacity={0.8}
              onPress={() => setShowBalanceModal(true)}
            >
              <View style={[styles.liquidInnerSmall, { backgroundColor: balances.net_balance >= 0 ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)" }]}>
                <View style={styles.statIconRowSmall}>
                  <Text style={[styles.statLabelSmall, { color: lc.moonstone }]}>BALANCE</Text>
                  <Ionicons name="wallet-outline" size={12} color={balances.net_balance >= 0 ? lc.success : lc.danger} />
                </View>
                <Text style={[styles.statValueSmall, { color: balances.net_balance >= 0 ? lc.success : lc.danger }]}>
                  {balances.net_balance >= 0 ? '+' : ''}${Math.abs(balances.net_balance || 0).toFixed(0)}
                </Text>
                <Text style={[styles.statSubtextSmall, { color: lc.textMuted }]}>
                  ${(balances.total_you_owe || 0).toFixed(0)} owed
                </Text>
              </View>
            </TouchableOpacity>
          </Animated.View>

          {/* AI Assistant Highlight Card */}
          <Animated.View style={[styles.liquidCardFull, {
            backgroundColor: lc.liquidGlassBg,
            borderColor: lc.liquidGlassBorder,
            opacity: aiCardEntrance,
            transform: [{
              translateY: aiCardEntrance.interpolate({
                inputRange: [0, 1],
                outputRange: [20, 0],
              })
            }]
          }]}>
            <View style={[styles.liquidInnerFull, { backgroundColor: lc.liquidInnerBg }]}>
              <View style={styles.aiCardRow}>
                <AIGradientOrb size={64} />
                <View style={styles.aiCardContent}>
                  <View style={styles.aiCardTopRow}>
                    <View style={styles.aiBetaBadge}>
                      <Text style={styles.aiBetaBadgeText}>BETA</Text>
                    </View>
                    {aiUsage && (
                      <Text style={[styles.aiRequestsLeft, { color: lc.textMuted }]}>
                        ✨ {aiUsage.requests_remaining} requests left
                      </Text>
                    )}
                  </View>
                  <Text style={[styles.aiCardHeading, { color: lc.textPrimary }]}>
                    Use AI at full power
                  </Text>
                  {aiUsage && !aiUsage.is_premium && (
                    <Text style={[styles.aiCardSub, { color: lc.textMuted }]}>
                      Upgrade to Pro for {aiUsage.daily_limit < 50 ? "50" : "more"} daily requests
                    </Text>
                  )}
                  <TouchableOpacity
                    style={styles.aiCardButton}
                    onPress={() => navigation.navigate("AIAssistant")}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.aiCardButtonText}>Try it →</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Animated.View>

          {/* Performance Card - Full Width Liquid Glass */}
          {totalGames > 0 && (
            <Animated.View style={[styles.liquidCardFull, {
              backgroundColor: lc.liquidGlassBg,
              borderColor: lc.liquidGlassBorder,
              opacity: perfEntrance,
              transform: [{
                translateY: perfEntrance.interpolate({
                  inputRange: [0, 1],
                  outputRange: [20, 0],
                })
              }]
            }]}>
              <View style={[styles.liquidInnerFull, { backgroundColor: lc.liquidInnerBg }]}>
                <View style={styles.performanceHeader}>
                  <View style={styles.performanceHeaderLeft}>
                    <Ionicons name="bar-chart-outline" size={16} color={lc.orange} />
                    <Text style={[styles.performanceTitle, { color: lc.moonstone }]}>PERFORMANCE</Text>
                  </View>
                  <Text style={[styles.gamesCount, { color: lc.textMuted }]}>{totalGames} games</Text>
                </View>

                <View style={styles.performanceGrid}>
                  <View style={[styles.perfItem, { backgroundColor: lc.liquidGlassBg }]}>
                    <Text style={[styles.perfValue, { color: avgProfit >= 0 ? lc.success : lc.danger }]}>
                      {avgProfit >= 0 ? '+' : ''}${Math.abs(avgProfit).toFixed(0)}
                    </Text>
                    <Text style={[styles.perfLabel, { color: lc.textMuted }]}>AVG</Text>
                  </View>
                  <View style={[styles.perfItem, { backgroundColor: lc.liquidGlassBg }]}>
                    <Text style={[styles.perfValue, { color: lc.success }]}>
                      +${bestWin.toFixed(0)}
                    </Text>
                    <Text style={[styles.perfLabel, { color: lc.textMuted }]}>BEST</Text>
                  </View>
                  <View style={[styles.perfItem, { backgroundColor: lc.liquidGlassBg }]}>
                    <Text style={[styles.perfValue, { color: lc.danger }]}>
                      -${Math.abs(worstLoss).toFixed(0)}
                    </Text>
                    <Text style={[styles.perfLabel, { color: lc.textMuted }]}>WORST</Text>
                  </View>
                  <View style={[styles.perfItem, { backgroundColor: lc.liquidGlassBg }]}>
                    <Text style={[styles.perfValue, { color: roiPercent >= 0 ? lc.success : lc.danger }]}>
                      {roiPercent >= 0 ? '+' : ''}{roiPercent.toFixed(0)}%
                    </Text>
                    <Text style={[styles.perfLabel, { color: lc.textMuted }]}>ROI</Text>
                  </View>
                </View>

                {/* ROI Progress Bar - like web app */}
                <View style={styles.roiBarContainer}>
                  <Text style={[styles.roiBarLabel, { color: lc.textMuted }]}>ROI:</Text>
                  <View style={[styles.roiBarTrack, { backgroundColor: lc.liquidGlassBg }]}>
                    <View
                      style={[
                        styles.roiBarFill,
                        {
                          width: `${Math.min(Math.max(roiPercent, 0), 100)}%`,
                          backgroundColor: lc.orange
                        }
                      ]}
                    />
                  </View>
                  <Text style={[styles.roiBarValue, { color: roiPercent >= 0 ? lc.success : lc.danger }]}>
                    {roiPercent.toFixed(0)}%
                  </Text>
                </View>
              </View>
            </Animated.View>
          )}

          {/* Live Games Section - Liquid Glass */}
          <Animated.View style={[styles.liquidCardFull, {
            backgroundColor: lc.liquidGlassBg,
            borderColor: lc.liquidGlassBorder,
            opacity: sectionsEntrance,
            transform: [{
              translateY: sectionsEntrance.interpolate({
                inputRange: [0, 1],
                outputRange: [20, 0],
              })
            }]
          }]}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionHeaderLeft}>
                <Animated.View style={{ opacity: pulseAnim }}>
                  <View style={[styles.liveDot, { backgroundColor: lc.success }]} />
                </Animated.View>
                <Text style={[styles.sectionTitle, { color: lc.moonstone }]}>LIVE GAMES</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={lc.textMuted} />
            </View>

            {activeGames.length === 0 ? (
              <View style={[styles.liquidInnerFull, { backgroundColor: lc.liquidInnerBg }]}>
                <Text style={[styles.emptyText, { color: lc.textSecondary }]}>
                  No games running right now
                </Text>
              </View>
            ) : (
              <View style={[styles.liquidInnerFull, { backgroundColor: lc.liquidInnerBg }]}>
                {activeGames.slice(0, 3).map((game, idx) => (
                  <TouchableOpacity
                    key={game.game_id || game._id}
                    style={[
                      styles.gameItem,
                      idx < activeGames.length - 1 && { borderBottomWidth: 1, borderBottomColor: lc.liquidGlassBorder }
                    ]}
                    onPress={() => navigation.navigate("GameNight", { gameId: game.game_id || game._id })}
                    activeOpacity={0.7}
                  >
                    <Animated.View style={[styles.liveIndicator, { opacity: pulseAnim, backgroundColor: lc.success }]} />
                    <View style={styles.gameInfo}>
                      <Text style={[styles.gameTitle, { color: lc.textPrimary }]}>
                        {game.title || game.group_name || "Game Night"}
                      </Text>
                      <Text style={[styles.gameMeta, { color: lc.textMuted }]}>
                        {game.player_count || 0} players{game.total_pot ? ` · $${game.total_pot} pot` : ''}
                      </Text>
                    </View>
                    {/* Trust Blue Join Button */}
                    <TouchableOpacity
                      style={[styles.joinButton, { backgroundColor: lc.trustBlue }]}
                      onPress={() => navigation.navigate("GameNight", { gameId: game.game_id || game._id })}
                    >
                      <Text style={styles.joinButtonText}>Join</Text>
                    </TouchableOpacity>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </Animated.View>

          {/* My Groups Section */}
          <Animated.View style={[styles.liquidCardFull, {
            backgroundColor: lc.liquidGlassBg,
            borderColor: lc.liquidGlassBorder,
            opacity: sectionsEntrance,
            transform: [{
              translateY: sectionsEntrance.interpolate({
                inputRange: [0, 1],
                outputRange: [20, 0],
              })
            }]
          }]}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionHeaderLeft}>
                <Ionicons name="people" size={16} color={lc.orange} />
                <Text style={[styles.sectionTitle, { color: lc.moonstone }]}>MY GROUPS</Text>
              </View>
              <Text style={[styles.countBadge, { color: lc.textMuted }]}>{groups.length}</Text>
            </View>

            {groups.length === 0 ? (
              <View style={[styles.liquidInnerFull, { backgroundColor: lc.liquidInnerBg }]}>
                <Text style={[styles.emptyText, { color: lc.textSecondary }]}>
                  You haven't joined a group yet
                </Text>
              </View>
            ) : (
              <View style={[styles.liquidInnerFull, { backgroundColor: lc.liquidInnerBg }]}>
                {groups.slice(0, 3).map((group, idx) => (
                  <TouchableOpacity
                    key={group.group_id || group._id}
                    style={[
                      styles.groupItem,
                      idx < groups.length - 1 && { borderBottomWidth: 1, borderBottomColor: lc.liquidGlassBorder }
                    ]}
                    onPress={() => navigation.navigate("GroupHub", { groupId: group.group_id, groupName: group.name })}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.groupAvatar, { backgroundColor: lc.liquidGlowOrange }]}>
                      <Text style={[styles.groupAvatarText, { color: lc.orange }]}>
                        {group.name?.[0]?.toUpperCase() || "G"}
                      </Text>
                    </View>
                    <View style={styles.groupInfo}>
                      <View style={styles.groupNameRow}>
                        <Text style={[styles.groupName, { color: lc.textPrimary }]}>{group.name}</Text>
                        {group.user_role === 'admin' && (
                          <View style={[styles.adminBadge, { backgroundColor: "rgba(234,179,8,0.15)" }]}>
                            <Ionicons name="shield" size={10} color="#eab308" />
                            <Text style={styles.adminText}>Admin</Text>
                          </View>
                        )}
                      </View>
                      <Text style={[styles.groupMeta, { color: lc.textMuted }]}>
                        {group.member_count || 0} members
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={lc.textMuted} />
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Darkened Brand Button */}
            <TouchableOpacity
              style={[styles.manageButton, { backgroundColor: lc.orangeDark }]}
              onPress={() => navigation.navigate("MainTabs" as any, { screen: "Groups" })}
              activeOpacity={0.8}
            >
              <Ionicons name="apps" size={18} color="#fff" />
              <Text style={styles.manageButtonText}>Manage Groups</Text>
            </TouchableOpacity>
          </Animated.View>

          {/* Recent Results Section */}
          {recentGames.length > 0 && (
            <Animated.View style={[styles.liquidCardFull, {
              backgroundColor: lc.liquidGlassBg,
              borderColor: lc.liquidGlassBorder,
              opacity: sectionsEntrance,
              transform: [{
                translateY: sectionsEntrance.interpolate({
                  inputRange: [0, 1],
                  outputRange: [20, 0],
                })
              }]
            }]}>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionHeaderLeft}>
                  <Ionicons name="time" size={16} color={lc.trustBlue} />
                  <Text style={[styles.sectionTitle, { color: lc.moonstone }]}>RECENT RESULTS</Text>
                </View>
                <TouchableOpacity onPress={() => navigation.navigate("MainTabs" as any, { screen: "Groups" })} activeOpacity={0.6}>
                  <Text style={[styles.seeAll, { color: lc.orange }]}>See all</Text>
                </TouchableOpacity>
              </View>

              <View style={[styles.liquidInnerFull, { backgroundColor: lc.liquidInnerBg }]}>
                {recentGames.map((game, index) => {
                  const gameResult = game.net_result || game.result || 0;
                  return (
                    <TouchableOpacity
                      key={game.game_id || game._id || index}
                      style={[
                        styles.resultItem,
                        index < recentGames.length - 1 && { borderBottomWidth: 1, borderBottomColor: lc.liquidGlassBorder }
                      ]}
                      onPress={() => navigation.navigate("GameNight", { gameId: game.game_id || game._id })}
                      activeOpacity={0.7}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.resultTitle, { color: lc.textPrimary }]}>
                          {game.title || game.group_name || "Game Night"}
                        </Text>
                        <Text style={[styles.resultDate, { color: lc.textMuted }]}>
                          {formatDate(game.ended_at || game.date)}
                        </Text>
                      </View>
                      <Text style={[styles.resultValue, { color: gameResult >= 0 ? lc.success : lc.danger }]}>
                        {gameResult >= 0 ? '+' : ''}${Math.abs(gameResult).toFixed(0)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </Animated.View>
          )}

          {/* Quick Actions with Trust Blue + Darkened Brand */}
          <Animated.View style={{
            opacity: sectionsEntrance,
            transform: [{
              translateY: sectionsEntrance.interpolate({
                inputRange: [0, 1],
                outputRange: [20, 0],
              })
            }]
          }}>
            <Text style={[styles.quickActionsTitle, { color: lc.moonstone }]}>Quick Actions</Text>
          </Animated.View>
          <Animated.View style={[styles.actionsRow, {
            opacity: sectionsEntrance,
            transform: [{
              translateY: sectionsEntrance.interpolate({
                inputRange: [0, 1],
                outputRange: [20, 0],
              })
            }]
          }]}>
            {/* Trust Blue - Start Game */}
            <TouchableOpacity
              style={[styles.actionCard, { backgroundColor: lc.trustBlue }]}
              onPress={() => navigation.navigate("MainTabs" as any, { screen: "Groups" })}
              activeOpacity={0.8}
            >
              <Ionicons name="play" size={28} color="#fff" />
              <Text style={styles.actionTextWhite}>Start Game</Text>
            </TouchableOpacity>

            {/* Darkened Brand - AI Chat */}
            <TouchableOpacity
              style={[styles.actionCard, { backgroundColor: lc.orangeDark }]}
              onPress={() => navigation.navigate("AIAssistant")}
              activeOpacity={0.8}
            >
              <Ionicons name="sparkles" size={28} color="#fff" />
              <Text style={styles.actionTextWhite}>AI Assistant</Text>
            </TouchableOpacity>
          </Animated.View>

          {/* Bottom spacing */}
          <View style={{ height: 100 }} />
        </ScrollView>
        </Animated.View>

        {/* Onboarding Agent - Conversational guide */}
        <OnboardingAgent
          visible={showOnboardingAgent}
          userName={userName}
          onComplete={() => setShowOnboardingAgent(false)}
          onNavigate={(screen: string) => navigation.navigate(screen as any)}
        />

        {/* Stat Details Modal - Enhanced with Gradient Hero */}
        <AnimatedModal
          visible={showStatModal !== null}
          onClose={() => setShowStatModal(null)}
          blurIntensity={60}
        >
          <View style={[styles.helpModalContent, { backgroundColor: lc.jetSurface }]}>
            {/* Color accent bar */}
            <View style={[styles.modalAccentBar, { backgroundColor: showStatModal === 'profit' ? '#EE6C29' : '#3B82F6' }]} />
            <View style={styles.helpModalHeader}>
              <Text style={[styles.helpModalTitle, { color: lc.textPrimary }]}>
                {showStatModal === 'profit' ? 'Net Profit Details' : 'Win Rate Details'}
              </Text>
              <TouchableOpacity
                style={[styles.closeButton, { backgroundColor: lc.glassBg }]}
                onPress={() => setShowStatModal(null)}
                activeOpacity={0.7}
              >
                <Ionicons name="close" size={22} color={lc.textMuted} />
              </TouchableOpacity>
            </View>

            {showStatModal === 'profit' ? (
              <>
                {/* Gradient Hero Card */}
                <LinearGradient
                  colors={netProfit >= 0 ? ['#166534', '#22C55E', '#4ADE80'] : ['#991B1B', '#EF4444', '#F87171']}
                  style={styles.statHeroCard}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <Ionicons
                    name={netProfit >= 0 ? "trending-up" : "trending-down"}
                    size={32}
                    color="rgba(255,255,255,0.9)"
                  />
                  <Text style={styles.statHeroValue}>
                    {netProfit >= 0 ? '+' : ''}${Math.abs(netProfit).toFixed(2)}
                  </Text>
                  <Text style={styles.statHeroLabel}>Total Profit/Loss</Text>
                </LinearGradient>

                {/* Stat Pills Grid */}
                <View style={styles.statPillsGrid}>
                  <View style={styles.statPill}>
                    <Text style={styles.statPillValue}>{totalGames}</Text>
                    <Text style={styles.statPillLabel}>Games</Text>
                  </View>
                  <View style={styles.statPill}>
                    <Text style={[styles.statPillValue, { color: avgProfit >= 0 ? lc.success : lc.danger }]}>
                      ${Math.abs(avgProfit).toFixed(0)}
                    </Text>
                    <Text style={styles.statPillLabel}>Avg</Text>
                  </View>
                  <View style={[styles.statPill, { backgroundColor: 'rgba(34,197,94,0.12)' }]}>
                    <Text style={[styles.statPillValue, { color: lc.success }]}>+${bestWin.toFixed(0)}</Text>
                    <Text style={styles.statPillLabel}>Best</Text>
                  </View>
                  <View style={[styles.statPill, { backgroundColor: 'rgba(239,68,68,0.12)' }]}>
                    <Text style={[styles.statPillValue, { color: lc.danger }]}>-${Math.abs(worstLoss).toFixed(0)}</Text>
                    <Text style={styles.statPillLabel}>Worst</Text>
                  </View>
                </View>

                {/* Additional Stats */}
                <View style={styles.statDetailSection}>
                  <View style={[styles.statDetailRow, { borderBottomColor: lc.liquidGlassBorder }]}>
                    <Text style={[styles.statDetailLabel, { color: lc.textSecondary }]}>Total Buy-ins</Text>
                    <Text style={[styles.statDetailValue, { color: lc.textPrimary }]}>${totalBuyIns.toFixed(2)}</Text>
                  </View>
                  <View style={[styles.statDetailRow, { borderBottomColor: 'transparent' }]}>
                    <Text style={[styles.statDetailLabel, { color: lc.textSecondary }]}>ROI</Text>
                    <Text style={[styles.statDetailValue, { color: roiPercent >= 0 ? lc.success : lc.danger }]}>
                      {roiPercent >= 0 ? '+' : ''}{roiPercent.toFixed(1)}%
                    </Text>
                  </View>
                </View>
              </>
            ) : (
              <>
                {/* Blue Gradient Hero for Win Rate */}
                <LinearGradient
                  colors={['#1E40AF', '#3B82F6', '#60A5FA']}
                  style={styles.statHeroCard}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <Ionicons name="analytics" size={32} color="rgba(255,255,255,0.9)" />
                  <Text style={styles.statHeroValue}>{winRate.toFixed(1)}%</Text>
                  <Text style={styles.statHeroLabel}>Win Rate</Text>
                </LinearGradient>

                {/* W/L Stat Pills */}
                <View style={styles.statPillsGrid}>
                  <View style={styles.statPill}>
                    <Text style={styles.statPillValue}>{totalGames}</Text>
                    <Text style={styles.statPillLabel}>Games</Text>
                  </View>
                  <View style={[styles.statPill, { backgroundColor: 'rgba(34,197,94,0.12)' }]}>
                    <Text style={[styles.statPillValue, { color: lc.success }]}>{wins}</Text>
                    <Text style={styles.statPillLabel}>Wins</Text>
                  </View>
                  <View style={[styles.statPill, { backgroundColor: 'rgba(239,68,68,0.12)' }]}>
                    <Text style={[styles.statPillValue, { color: lc.danger }]}>{losses}</Text>
                    <Text style={styles.statPillLabel}>Losses</Text>
                  </View>
                </View>

                {/* Additional Stats */}
                <View style={styles.statDetailSection}>
                  <View style={[styles.statDetailRow, { borderBottomColor: lc.liquidGlassBorder }]}>
                    <Text style={[styles.statDetailLabel, { color: lc.textSecondary }]}>Best Win</Text>
                    <Text style={[styles.statDetailValue, { color: lc.success }]}>+${bestWin.toFixed(2)}</Text>
                  </View>
                  <View style={[styles.statDetailRow, { borderBottomColor: 'transparent' }]}>
                    <Text style={[styles.statDetailLabel, { color: lc.textSecondary }]}>Worst Loss</Text>
                    <Text style={[styles.statDetailValue, { color: lc.danger }]}>-${Math.abs(worstLoss).toFixed(2)}</Text>
                  </View>
                </View>
              </>
            )}

            <TouchableOpacity
              style={[styles.helpModalButton, { backgroundColor: lc.trustBlue }]}
              onPress={() => setShowStatModal(null)}
              activeOpacity={0.8}
            >
              <Text style={styles.helpModalButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </AnimatedModal>

        {/* Balance Details Modal */}
        <AnimatedModal
          visible={showBalanceModal}
          onClose={() => setShowBalanceModal(false)}
          blurIntensity={60}
        >
          <View style={[styles.helpModalContent, { backgroundColor: lc.jetSurface }]}>
            {/* Color accent bar */}
            <View style={[styles.modalAccentBar, { backgroundColor: balances.net_balance >= 0 ? '#22C55E' : '#EF4444' }]} />
            <View style={styles.helpModalHeader}>
              <Text style={[styles.helpModalTitle, { color: lc.textPrimary }]}>Balance Details</Text>
              <TouchableOpacity
                style={[styles.closeButton, { backgroundColor: lc.glassBg }]}
                onPress={() => setShowBalanceModal(false)}
                activeOpacity={0.7}
              >
                <Ionicons name="close" size={22} color={lc.textMuted} />
              </TouchableOpacity>
            </View>

            {/* Gradient Hero */}
            <LinearGradient
              colors={balances.net_balance >= 0 ? ['#166534', '#22C55E', '#4ADE80'] : ['#991B1B', '#EF4444', '#F87171']}
              style={styles.statHeroCard}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Ionicons name="wallet" size={32} color="rgba(255,255,255,0.9)" />
              <Text style={styles.statHeroValue}>
                {balances.net_balance >= 0 ? '+' : ''}${Math.abs(balances.net_balance || 0).toFixed(2)}
              </Text>
              <Text style={styles.statHeroLabel}>Net Balance</Text>
            </LinearGradient>

            {/* Stat Pills */}
            <View style={styles.statPillsGrid}>
              <View style={[styles.statPill, { backgroundColor: 'rgba(239,68,68,0.12)' }]}>
                <Text style={[styles.statPillValue, { color: lc.danger }]}>
                  ${(balances.total_you_owe || 0).toFixed(0)}
                </Text>
                <Text style={styles.statPillLabel}>You Owe</Text>
              </View>
              <View style={[styles.statPill, { backgroundColor: 'rgba(34,197,94,0.12)' }]}>
                <Text style={[styles.statPillValue, { color: lc.success }]}>
                  ${(balances.total_owed_to_you || 0).toFixed(0)}
                </Text>
                <Text style={styles.statPillLabel}>Owed to You</Text>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.helpModalButton, { backgroundColor: lc.trustBlue }]}
              onPress={() => {
                setShowBalanceModal(false);
                navigation.navigate("Wallet");
              }}
              activeOpacity={0.8}
            >
              <Text style={styles.helpModalButtonText}>Open Wallet</Text>
            </TouchableOpacity>
          </View>
        </AnimatedModal>

        {/* Notifications Panel */}
        <AnimatedModal
          visible={showNotificationsPanel}
          onClose={() => setShowNotificationsPanel(false)}
          blurIntensity={60}
        >
          <View style={[styles.notificationsPanel, { backgroundColor: lc.jetSurface }]}>
            <View style={styles.helpModalHeader}>
              <Text style={[styles.helpModalTitle, { color: lc.textPrimary }]}>Notifications</Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                {notifications.length > 0 && (
                  <TouchableOpacity
                    style={[styles.markAllReadButton, { backgroundColor: lc.liquidGlassBg, borderColor: lc.liquidGlassBorder }]}
                    onPress={handleMarkAllRead}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="checkmark-done" size={16} color={lc.orange} />
                    <Text style={[styles.markAllReadText, { color: lc.orange }]}>Mark all read</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={[styles.closeButton, { backgroundColor: lc.glassBg }]}
                  onPress={() => setShowNotificationsPanel(false)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="close" size={22} color={lc.textMuted} />
                </TouchableOpacity>
              </View>
            </View>

            <ScrollView style={styles.notificationsScroll} showsVerticalScrollIndicator={false}>
              {notifications.length === 0 ? (
                <View style={styles.emptyNotifications}>
                  <Ionicons name="notifications-outline" size={48} color={lc.textMuted} />
                  <Text style={[styles.emptyNotifTitle, { color: lc.textSecondary }]}>All Caught Up</Text>
                  <Text style={[styles.emptyNotifSub, { color: lc.textMuted }]}>No new notifications</Text>
                </View>
              ) : (
                <View style={styles.notificationsList}>
                  {notifications.map((notif: any, idx: number) => {
                    const { icon, color } = getNotifIcon(notif.type);
                    const isGameInvite = notif.type === "game_invite" && notif.data?.game_id;
                    return (
                      <TouchableOpacity
                        key={notif.notification_id || idx}
                        style={[
                          styles.notificationItem,
                          { backgroundColor: lc.liquidGlassBg, borderColor: lc.liquidGlassBorder },
                        ]}
                        onPress={() => !isGameInvite && handleNotificationPress(notif)}
                        activeOpacity={isGameInvite ? 1 : 0.7}
                      >
                        <View style={[styles.notifIconWrap, { backgroundColor: color + "20" }]}>
                          <Ionicons name={icon as any} size={20} color={color} />
                        </View>
                        <View style={styles.notifContent}>
                          <Text style={[styles.notifTitle, { color: lc.textPrimary }]} numberOfLines={1}>
                            {notif.title}
                          </Text>
                          <Text style={[styles.notifMessage, { color: lc.textSecondary }]} numberOfLines={2}>
                            {notif.message}
                          </Text>
                          <Text style={[styles.notifTime, { color: lc.textMuted }]}>
                            {formatNotifTime(notif.created_at)}
                          </Text>
                          {isGameInvite && (
                            <View style={styles.notifActionButtons}>
                              <TouchableOpacity
                                style={[styles.notifActionBtn, { backgroundColor: lc.textMuted + "30" }]}
                                onPress={() => handleDeclineGameInvite(notif)}
                              >
                                <Text style={[styles.notifActionBtnText, { color: lc.textSecondary }]}>Decline</Text>
                              </TouchableOpacity>
                              <TouchableOpacity
                                style={[styles.notifActionBtn, { backgroundColor: lc.success }]}
                                onPress={() => handleAcceptGameInvite(notif)}
                              >
                                <Text style={[styles.notifActionBtnText, { color: "#fff" }]}>Accept</Text>
                              </TouchableOpacity>
                            </View>
                          )}
                        </View>
                        {!isGameInvite && (
                          <TouchableOpacity
                            onPress={() => handleDeleteNotification(notif.notification_id)}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                            style={styles.notifDeleteButton}
                          >
                            <Ionicons name="trash-outline" size={16} color={lc.textMuted} />
                          </TouchableOpacity>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </ScrollView>

            <TouchableOpacity
              style={[styles.notifSettingsButton, { backgroundColor: lc.liquidGlassBg, borderColor: lc.liquidGlassBorder }]}
              onPress={() => {
                setShowNotificationsPanel(false);
                navigation.navigate("Notifications");
              }}
              activeOpacity={0.7}
            >
              <Ionicons name="settings-outline" size={18} color={lc.textSecondary} />
              <Text style={[styles.notifSettingsText, { color: lc.textSecondary }]}>Notification Settings</Text>
            </TouchableOpacity>
          </View>
        </AnimatedModal>

        {/* AI Chat FAB */}
        <AIChatFab />
      </View>
    </AppDrawer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: SPACE.md,
  },
  glassButton: {
    width: 42,
    height: 42,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  glassButtonPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.95 }],
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
  },
  hamburgerLines: {
    gap: 5,
    alignItems: "center",
  },
  hamburgerLine: {
    width: 14,
    height: 2,
    borderRadius: 1,
  },
  headerCenter: {
    alignItems: "center",
  },
  logoText: {
    fontSize: 24,
    fontWeight: "800",
  },
  logoSubtext: {
    fontSize: 11,
    fontWeight: "600",
    marginTop: 2,
  },
  notifDot: {
    position: "absolute",
    top: 12,
    right: 12,
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  content: {
    padding: 20,
    paddingBottom: 32,
  },
  // Welcome
  welcomeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
  },
  welcomeRowSticky: {
    paddingHorizontal: 20,
    paddingBottom: 12,
    marginBottom: 0,
  },
  welcomeTextContainer: {
    flex: 1,
  },
  welcomeLabel: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 3,
    marginBottom: 4,
    fontFamily: undefined, // uses system monospace on each platform
  },
  welcomeTitle: {
    fontSize: 24,
    fontWeight: "700",
    lineHeight: 31,
  },
  welcomeSubtitle: {
    fontSize: FONT.secondary.size,
    marginTop: 4,
    lineHeight: 21,
  },
  gradientDivider: {
    height: 1.5,
    marginHorizontal: 20,
    marginBottom: 12,
    borderRadius: 1,
  },
  helpButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  helpButtonSmall: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(239,68,68,0.1)",
    padding: SPACE.md,
    borderRadius: 16,
    marginBottom: 16,
    gap: 10,
    borderWidth: 1,
  },
  errorText: {
    fontSize: FONT.secondary.size,
    flex: 1,
  },
  // Liquid Glass Cards - 3 Column
  statsRowThree: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 16,
  },
  liquidCardThird: {
    flex: 1,
    borderRadius: 16,
    padding: 3,
    borderWidth: 1.5,
    shadowColor: "rgba(255, 255, 255, 0.1)",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
    elevation: 8,
  },
  gradientCardWrapper: {
    flex: 1,
    borderRadius: 16,
    padding: 1.5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
  liquidCardThirdInner: {
    flex: 1,
    borderRadius: 16,
    overflow: "hidden",
  },
  liquidInnerSmall: {
    borderRadius: 15,
    padding: 12,
  },
  statIconRowSmall: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  statLabelSmall: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.5,
    lineHeight: 14,
  },
  statValueSmall: {
    fontSize: FONT.navTitle.size,
    fontWeight: "800",
    letterSpacing: -0.5,
    marginBottom: 2,
  },
  statSubtextSmall: {
    fontSize: 11,
    lineHeight: 14,
  },
  // Liquid Glass Cards - 2 Column (legacy)
  statsRow: {
    flexDirection: "row",
    gap: SPACE.md,
    marginBottom: 16,
  },
  liquidCard: {
    flex: 1,
    borderRadius: 24,
    padding: 4,
    borderWidth: 1.5,
    // Shadow for depth
    shadowColor: "rgba(255, 255, 255, 0.1)",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
    elevation: 8,
  },
  liquidInner: {
    borderRadius: 16,
    padding: 16,
  },
  liquidCardFull: {
    borderRadius: 24,
    padding: 4,
    marginBottom: 16,
    borderWidth: 1.5,
    shadowColor: "rgba(255, 255, 255, 0.1)",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
    elevation: 8,
  },
  liquidInnerFull: {
    borderRadius: 16,
    padding: 16,
  },
  // Stats
  statIconRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 1,
  },
  statValue: {
    fontSize: 28, // hero exception
    fontWeight: "700",
  },
  statSubtext: {
    fontSize: 11,
    marginTop: 4,
  },
  // Performance
  performanceHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  performanceHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  performanceTitle: {
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 1,
  },
  gamesCount: {
    fontSize: 11,
  },
  performanceGrid: {
    flexDirection: "row",
    gap: 10,
  },
  perfItem: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 12,
    borderRadius: 12,
  },
  perfValue: {
    fontSize: FONT.navTitle.size,
    fontWeight: "700",
  },
  perfLabel: {
    fontSize: 11,
    marginTop: 4,
    letterSpacing: 0.5,
    lineHeight: 14,
  },
  // ROI Progress Bar
  roiBarContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 12,
    paddingHorizontal: 4,
  },
  roiBarLabel: {
    fontSize: 12,
    fontWeight: "500",
    width: 30,
  },
  roiBarTrack: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    marginHorizontal: 8,
  },
  roiBarFill: {
    height: "100%",
    borderRadius: 3,
  },
  roiBarValue: {
    fontSize: 12,
    fontWeight: "600",
    width: 35,
    textAlign: "right",
  },
  // Section
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: SPACE.md,
  },
  sectionHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 1,
  },
  countBadge: {
    fontSize: 12,
    fontWeight: "500",
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  emptyText: {
    fontSize: FONT.secondary.size,
    textAlign: "center",
    paddingVertical: 20,
  },
  // Game items
  gameItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: SPACE.md,
    paddingHorizontal: 4,
  },
  liveIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 12,
  },
  gameInfo: {
    flex: 1,
  },
  gameTitle: {
    fontSize: 16,
    fontWeight: "600",
  },
  gameMeta: {
    fontSize: 12,
    marginTop: 2,
  },
  joinButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
  },
  joinButtonText: {
    color: "#fff",
    fontSize: FONT.secondary.size,
    fontWeight: "600",
  },
  // Groups
  groupItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 4,
    gap: 12,
  },
  groupAvatar: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  groupAvatarText: {
    fontSize: FONT.navTitle.size,
    fontWeight: "700",
  },
  groupInfo: {
    flex: 1,
  },
  groupNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  groupName: {
    fontSize: 16,
    fontWeight: "600",
  },
  groupMeta: {
    fontSize: 12,
    marginTop: 2,
  },
  adminBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  adminText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#eab308",
  },
  manageButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: SPACE.md,
    borderRadius: 12,
    marginHorizontal: 4,
    marginBottom: 4,
    marginTop: 8,
    gap: 8,
  },
  manageButtonText: {
    fontSize: FONT.secondary.size,
    fontWeight: "600",
    color: "#fff",
  },
  // Results
  resultItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 4,
  },
  resultTitle: {
    fontSize: FONT.secondary.size,
    fontWeight: "500",
  },
  resultDate: {
    fontSize: 11,
    marginTop: 2,
  },
  resultValue: {
    fontSize: 16,
    fontWeight: "700",
    fontFamily: "monospace",
  },
  seeAll: {
    fontSize: 12,
    fontWeight: "600",
  },
  // AI Highlight Card
  aiCardRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  aiCardContent: {
    flex: 1,
  },
  aiCardTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 6,
  },
  aiBetaBadge: {
    backgroundColor: "rgba(238,108,41,0.15)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  aiBetaBadgeText: {
    color: "#FFA05C",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  aiRequestsLeft: {
    fontSize: 12,
    fontWeight: "500",
  },
  aiCardHeading: {
    fontSize: FONT.navTitle.size,
    fontWeight: "700",
    marginBottom: 4,
  },
  aiCardSub: {
    fontSize: 12,
    marginBottom: 10,
  },
  aiCardButton: {
    backgroundColor: "#EE6C29",
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignSelf: "flex-start",
  },
  aiCardButtonText: {
    color: "#fff",
    fontSize: FONT.secondary.size,
    fontWeight: "600",
  },
  // Quick Actions
  quickActionsTitle: {
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 1,
    marginBottom: SPACE.md,
    marginTop: 8,
  },
  actionsRow: {
    flexDirection: "row",
    gap: SPACE.md,
  },
  actionCard: {
    flex: 1,
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  actionTextWhite: {
    fontSize: FONT.secondary.size,
    fontWeight: "600",
    color: "#fff",
  },
  // Help Modal
  helpModalContent: {
    borderRadius: 24,
    padding: 24,
    borderWidth: 1.5,
    borderColor: "rgba(255, 255, 255, 0.12)",
    width: "100%",
    maxWidth: 400,
    alignSelf: "center",
  },
  modalAccentBar: {
    height: 4,
    borderRadius: 2,
    width: 48,
    alignSelf: "center",
    marginBottom: 20,
  },
  // Notifications Panel - proper sizing
  notificationsPanel: {
    borderRadius: 24,
    padding: 24,
    borderWidth: 1.5,
    borderColor: "rgba(255, 255, 255, 0.12)",
    width: "100%",
    maxWidth: 400,
    alignSelf: "center",
  },
  notificationsScroll: {
    maxHeight: 450,
  },
  helpModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
  },
  helpModalTitle: {
    fontSize: 24,
    fontWeight: "700",
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  // Demo Card
  demoCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
  },
  demoHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  demoLogo: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  demoLogoText: {
    fontSize: FONT.secondary.size,
    fontWeight: "700",
  },
  demoLogoTitle: {
    fontSize: FONT.secondary.size,
    fontWeight: "600",
  },
  demoTagline: {
    fontSize: 24,
    fontWeight: "700",
  },
  helpTipsList: {
    gap: 12,
  },
  helpTipCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
  },
  helpTipIconLarge: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  helpTipContent: {
    flex: 1,
    marginLeft: 16,
    marginRight: 12,
  },
  helpTipTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 4,
  },
  helpTipDesc: {
    fontSize: FONT.secondary.size,
    lineHeight: 18,
  },
  helpModalButton: {
    marginTop: SPACE.xxl,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  helpModalButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  // Stat Details Modal - Enhanced
  statDetailsList: {
    gap: 4,
  },
  statDetailSection: {
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    borderRadius: 16,
    padding: 4,
    marginTop: 8,
  },
  statDetailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: SPACE.md,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  statDetailLabel: {
    fontSize: 16,
  },
  statDetailValue: {
    fontSize: FONT.navTitle.size,
    fontWeight: "700",
    fontFamily: "monospace",
  },
  // Gradient Hero Card
  statHeroCard: {
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 12,
  },
  statHeroValue: {
    fontSize: 42,
    fontWeight: "800",
    color: "#fff",
    marginTop: 12,
    letterSpacing: -1,
  },
  statHeroLabel: {
    fontSize: FONT.secondary.size,
    fontWeight: "600",
    color: "rgba(255,255,255,0.8)",
    marginTop: 4,
  },
  // Stat Pills Grid
  statPillsGrid: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 16,
  },
  statPill: {
    flex: 1,
    backgroundColor: COLORS.glass.bg,
    borderRadius: 12,
    paddingVertical: SPACE.md,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  statPillValue: {
    fontSize: FONT.navTitle.size,
    fontWeight: "700",
    color: "#F5F5F5",
  },
  statPillLabel: {
    fontSize: 11,
    color: "#7A7A7A",
    marginTop: 4,
    fontWeight: "500",
    letterSpacing: 0.3,
  },
  // Notifications Panel
  emptyNotifications: {
    alignItems: "center",
    paddingVertical: 40,
    gap: 8,
  },
  emptyNotifTitle: {
    fontSize: FONT.navTitle.size,
    fontWeight: "600",
    marginTop: 8,
  },
  emptyNotifSub: {
    fontSize: FONT.secondary.size,
  },
  notificationsList: {
    gap: 10,
  },
  notificationItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: SPACE.md,
    borderRadius: 16,
    borderWidth: 1,
    gap: 12,
  },
  notifIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  notifContent: {
    flex: 1,
  },
  notifTitle: {
    fontSize: FONT.secondary.size,
    fontWeight: "600",
    marginBottom: 2,
  },
  notifMessage: {
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 4,
  },
  notifTime: {
    fontSize: 11,
  },
  notifSettingsButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: SPACE.md,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 16,
  },
  notifSettingsText: {
    fontSize: FONT.secondary.size,
    fontWeight: "500",
  },
  markAllReadButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  markAllReadText: {
    fontSize: 12,
    fontWeight: "600",
  },
  notifDeleteButton: {
    padding: 4,
    marginLeft: 4,
  },
  notifActionButtons: {
    flexDirection: "row",
    gap: 8,
    marginTop: 8,
  },
  notifActionBtn: {
    paddingHorizontal: SPACE.md,
    paddingVertical: 6,
    borderRadius: 6,
  },
  notifActionBtnText: {
    fontSize: 12,
    fontWeight: "600",
  },
});
