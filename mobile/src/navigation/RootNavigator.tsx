import React, { useEffect, useState, useRef } from "react";
import { NavigationContainer, createNavigationContainerRef, type NavigatorScreenParams } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { View } from "react-native";
import * as Linking from "expo-linking";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { setupNotificationListeners } from "../services/pushNotifications";
import { SplashScreen as BrandedSplashScreen } from "../screens/onboarding/SplashScreen";

// Screens
import LoginScreen from "../screens/LoginScreen";
import { GroupHubScreen } from "../screens/GroupHubScreen";
import { GameNightScreen } from "../screens/GameNightScreen";
import { GameThreadChatScreen } from "../screens/GameThreadChatScreen";
import { ProfileScreen } from "../screens/ProfileScreen";
import { NotificationsScreen } from "../screens/NotificationsScreen";
import { PrivacyScreen } from "../screens/PrivacyScreen";
import { BillingScreen } from "../screens/BillingScreen";
import { LanguageScreen } from "../screens/LanguageScreen";
import { AIAssistantScreen } from "../screens/AIAssistantScreen";
import { GroupChatScreen } from "../screens/GroupChatScreen";
import { SettlementScreen } from "../screens/SettlementScreen";
import { PokerAIScreen } from "../screens/PokerAIScreen";
import { AIToolkitScreen } from "../screens/AIToolkitScreen";
import { WalletScreen } from "../screens/WalletScreen";
import { FeedbackScreen } from "../screens/FeedbackScreen";
import { AutomationsScreen } from "../screens/AutomationsScreen";
import { MainTabNavigator } from "./MainTabNavigator";
import type { MainTabParamList } from "./mainTabTypes";
import { PendingRequestsScreen } from "../screens/PendingRequestsScreen";
import { SettlementHistoryScreen } from "../screens/SettlementHistoryScreen";
import { RequestAndPayScreen } from "../screens/RequestAndPayScreen";
import { DashboardLiquidGlassScreen } from "../screens/DashboardLiquidGlassScreen";
import { SchedulerScreen } from "../screens/SchedulerScreen";
import { RSVPScreen } from "../screens/RSVPScreen";
import { OnboardingFlow } from "../screens/onboarding/OnboardingFlow";
import { MilestonesScreen } from "../screens/MilestonesScreen";
import { ShareCardScreen } from "../screens/ShareCardScreen";
import { ReferralScreen } from "../screens/ReferralScreen";
import { FeatureRequestsScreen } from "../screens/FeatureRequestsScreen";
import { StartGameModalProvider } from "../context/StartGameModalContext";
import { StartGameModal } from "../components/StartGameModal";

export type RootStackParamList = {
  Onboarding: undefined;
  Login: undefined;
  /** Primary app shell: Home, Chats, Groups, Profile (settings) */
  MainTabs: NavigatorScreenParams<MainTabParamList> | undefined;
  PendingRequests: undefined;
  GroupHub: { groupId: string; groupName?: string; openInviteSheet?: boolean };
  GroupChat: { groupId: string; groupName?: string };
  GameNight: { gameId: string };
  /** Game context + group chat; deep link: kvitt://thread/:gameId */
  GameThreadChat: { gameId: string; groupId?: string; groupName?: string };
  Settlement: { gameId: string };
  PokerAI: undefined;
  /** Name/nickname editor — distinct from tab `Profile` (Preferences) */
  AccountProfile: undefined;
  Wallet: undefined;
  Notifications: undefined;
  Privacy: undefined;
  Billing: undefined;
  Language: undefined;
  AIAssistant: undefined;
  AIToolkit: undefined;
  Feedback: undefined;
  Automations: { fromScheduler?: boolean } | undefined;
  SettlementHistory: undefined;
  RequestAndPay: undefined;
  DashboardLiquidGlass: undefined;
  Scheduler: undefined;
  RSVP: { occurrenceId: string };
  Milestones: undefined;
  ShareCard: { streak: number; streakStartDate: string | null };
  Referral: undefined;
  FeatureRequests: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

const linking = {
  prefixes: [Linking.createURL("/"), "kvitt://"],
  config: {
    screens: {
      Onboarding: "onboarding",
      Login: "login",
      MainTabs: {
        path: "",
        screens: {
          Home: "home",
          Chats: "chats",
          Groups: "groups",
          Profile: "profile",
        },
      },
      GameThreadChat: "thread/:gameId",
      GameNight: "game/:gameId",
      GroupHub: "group/:groupId",
      GroupChat: "group-chat/:groupId",
    },
  },
};

// Global navigation ref for use outside React components (e.g. push notification handler)
export const navigationRef = createNavigationContainerRef<RootStackParamList>();

/**
 * Routes a notification tap to the correct screen based on notification data.type
 */
function handleNotificationDeepLink(data: Record<string, any>) {
  if (!navigationRef.isReady()) return;

  const type: string = data?.type || "";

  switch (type) {
    case "game_started":
    case "game_ended":
    case "buy_in":
    case "cash_out":
      if (data.game_id) {
        navigationRef.navigate("GameThreadChat", {
          gameId: data.game_id,
          groupId: data.group_id,
        });
      }
      break;

    case "settlement_generated":
      if (data.game_id) {
        navigationRef.navigate("Settlement", { gameId: data.game_id });
      }
      break;

    case "wallet_received":
    case "withdrawal_requested":
      navigationRef.navigate("Wallet");
      break;

    case "group_invite_request":
    case "invite_accepted":
      navigationRef.navigate("Notifications");
      break;

    case "admin_transferred":
    case "invite_sent":
      if (data.group_id) {
        navigationRef.navigate("GroupHub", { groupId: data.group_id });
      } else {
        navigationRef.navigate("MainTabs", { screen: "Groups" });
      }
      break;

    case "post_game_survey":
      // Survey notification — go to settlement (survey modal auto-triggers there)
      if (data.game_id) {
        navigationRef.navigate("Settlement", { gameId: data.game_id });
      }
      break;

    case "settlement":
    case "payment_received":
      // Payment/settlement notifications — go to settlement screen
      if (data.game_id) {
        navigationRef.navigate("Settlement", { gameId: data.game_id });
      } else {
        navigationRef.navigate("Notifications");
      }
      break;

    case "payment_request":
      navigationRef.navigate("RequestAndPay" as any);
      break;

    case "reminder":
      // Payment or game reminders — route to settlement if ledger, else game
      if (data.game_id && data.ledger_id) {
        navigationRef.navigate("Settlement", { gameId: data.game_id });
      } else if (data.game_id) {
        navigationRef.navigate("GameNight", { gameId: data.game_id });
      } else {
        navigationRef.navigate("Notifications");
      }
      break;

    case "feedback_update":
    case "issue_responded":
      navigationRef.navigate("Notifications");
      break;

    case "automation_disabled":
    case "automation_error":
      navigationRef.navigate("Automations");
      break;

    case "group_message":
    case "group_chat":
      if (data.group_id) {
        navigationRef.navigate("GroupChat", { groupId: data.group_id });
      }
      break;

    case "event_invite":
    case "event_reminder":
    case "rsvp_update":
      if (data.occurrence_id) {
        navigationRef.navigate("RSVP", { occurrenceId: data.occurrence_id });
      } else {
        navigationRef.navigate("Scheduler");
      }
      break;

    default:
      // Fallback: go to Notifications inbox
      navigationRef.navigate("Notifications");
      break;
  }
}

/** Minimum time the branded launch splash stays visible (cold start), even if auth resolves faster. */
const MIN_BRANDED_SPLASH_MS = 3200;

export default function RootNavigator() {
  const { session, isLoading } = useAuth();
  const { colors } = useTheme();
  const launchStartedAtRef = useRef(Date.now());
  const [minSplashElapsed, setMinSplashElapsed] = useState(false);
  const [onboardingSeen, setOnboardingSeen] = useState<boolean | null>(null);

  const bootReady = !isLoading && onboardingSeen !== null;

  useEffect(() => {
    if (!bootReady) return;
    const elapsed = Date.now() - launchStartedAtRef.current;
    const remaining = Math.max(0, MIN_BRANDED_SPLASH_MS - elapsed);
    if (remaining <= 0) {
      setMinSplashElapsed(true);
      return;
    }
    const id = setTimeout(() => setMinSplashElapsed(true), remaining);
    return () => clearTimeout(id);
  }, [bootReady]);

  useEffect(() => {
    AsyncStorage.getItem("kvitt_onboarding_seen_v1")
      .then((v) => setOnboardingSeen(v === "true"))
      .catch(() => {
        console.warn("Failed to read onboarding state, defaulting to seen");
        setOnboardingSeen(true);
      });
  }, []);

  // Setup push notification deep link listener (only when logged in)
  useEffect(() => {
    if (!session) return;

    const cleanup = setupNotificationListeners(
      // Foreground notification received — no navigation, just show
      undefined,
      // User tapped notification
      (response) => {
        const data = response.notification.request.content.data as Record<string, any>;
        handleNotificationDeepLink(data);
      }
    );

    return cleanup;
  }, [session]);

  const showLaunchSplash = !(bootReady && minSplashElapsed);

  if (showLaunchSplash) {
    return <BrandedSplashScreen />;
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <NavigationContainer ref={navigationRef} linking={linking}>
        <StartGameModalProvider>
          <View style={{ flex: 1 }}>
            <Stack.Navigator
              screenOptions={{
                headerStyle: { backgroundColor: colors.background },
                headerTintColor: colors.textPrimary,
                headerTitleStyle: { fontWeight: "600" },
                contentStyle: { backgroundColor: colors.background },
              }}
            >
              {!session ? (
                <>
                  {!onboardingSeen && (
                    <Stack.Screen name="Onboarding" component={OnboardingFlow} options={{ headerShown: false, animation: "fade" }} />
                  )}
                  <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
                </>
              ) : (
                <>
                  <Stack.Screen name="MainTabs" component={MainTabNavigator} options={{ headerShown: false }} />
              <Stack.Screen name="GroupHub" component={GroupHubScreen} options={{ headerShown: false }} />
              <Stack.Screen name="GroupChat" component={GroupChatScreen} options={{ headerShown: false }} />
              <Stack.Screen name="GameNight" component={GameNightScreen} options={{ headerShown: false }} />
              <Stack.Screen name="GameThreadChat" component={GameThreadChatScreen} options={{ headerShown: false }} />
              <Stack.Screen name="Settlement" component={SettlementScreen} options={{ headerShown: false }} />
              <Stack.Screen name="PokerAI" component={PokerAIScreen} options={{ headerShown: false }} />
              <Stack.Screen name="AccountProfile" component={ProfileScreen} options={{ headerShown: false, animation: "slide_from_bottom", presentation: "transparentModal", contentStyle: { backgroundColor: "transparent" } }} />
              <Stack.Screen name="Wallet" component={WalletScreen} options={{ headerShown: false, animation: "slide_from_bottom", presentation: "transparentModal", contentStyle: { backgroundColor: "transparent" } }} />
              <Stack.Screen name="Notifications" component={NotificationsScreen} options={{ headerShown: false, animation: "slide_from_bottom", presentation: "transparentModal", contentStyle: { backgroundColor: "transparent" } }} />
              <Stack.Screen name="Privacy" component={PrivacyScreen} options={{ headerShown: false, animation: "slide_from_bottom", presentation: "transparentModal", contentStyle: { backgroundColor: "transparent" } }} />
              <Stack.Screen name="Billing" component={BillingScreen} options={{ headerShown: false, animation: "slide_from_bottom", presentation: "transparentModal", contentStyle: { backgroundColor: "transparent" } }} />
              <Stack.Screen name="Language" component={LanguageScreen} options={{ headerShown: false, animation: "slide_from_bottom", presentation: "transparentModal", contentStyle: { backgroundColor: "transparent" } }} />
              <Stack.Screen name="AIAssistant" component={AIAssistantScreen} options={{ headerShown: false, animation: "slide_from_bottom", presentation: "transparentModal", contentStyle: { backgroundColor: "transparent" } }} />
              <Stack.Screen name="AIToolkit" component={AIToolkitScreen} options={{ headerShown: false, animation: "slide_from_bottom", presentation: "transparentModal", contentStyle: { backgroundColor: "transparent" } }} />
              <Stack.Screen name="Feedback" component={FeedbackScreen} options={{ headerShown: false, animation: "slide_from_bottom", presentation: "transparentModal", contentStyle: { backgroundColor: "transparent" } }} />
              <Stack.Screen name="Automations" component={AutomationsScreen} options={{ headerShown: false, animation: "slide_from_bottom", presentation: "transparentModal", contentStyle: { backgroundColor: "transparent" } }} />
              <Stack.Screen name="PendingRequests" component={PendingRequestsScreen} options={{ headerShown: false }} />
              <Stack.Screen name="SettlementHistory" component={SettlementHistoryScreen} options={{ headerShown: false }} />
              <Stack.Screen
                name="RequestAndPay"
                component={RequestAndPayScreen}
                options={{
                  headerShown: false,
                  animation: "slide_from_bottom",
                  presentation: "transparentModal",
                  contentStyle: { backgroundColor: "transparent" },
                }}
              />
              <Stack.Screen name="DashboardLiquidGlass" component={DashboardLiquidGlassScreen} options={{ headerShown: false }} />
              <Stack.Screen name="Scheduler" component={SchedulerScreen} options={{ headerShown: false }} />
              <Stack.Screen name="RSVP" component={RSVPScreen} options={{ headerShown: false, animation: "slide_from_bottom", presentation: "transparentModal", contentStyle: { backgroundColor: "transparent" } }} />
              <Stack.Screen name="Milestones" component={MilestonesScreen} options={{ headerShown: false }} />
              <Stack.Screen
                name="ShareCard"
                component={ShareCardScreen}
                options={{
                  headerShown: false,
                  animation: "slide_from_bottom",
                  presentation: "transparentModal",
                  contentStyle: { backgroundColor: "transparent" },
                }}
              />
              <Stack.Screen name="Referral" component={ReferralScreen} options={{ headerShown: false, animation: "slide_from_bottom", presentation: "transparentModal", contentStyle: { backgroundColor: "transparent" } }} />
              <Stack.Screen name="FeatureRequests" component={FeatureRequestsScreen} options={{ headerShown: false, animation: "slide_from_bottom", presentation: "transparentModal", contentStyle: { backgroundColor: "transparent" } }} />
                </>
              )}
            </Stack.Navigator>
            <StartGameModal />
          </View>
        </StartGameModalProvider>
      </NavigationContainer>
    </View>
  );
}
