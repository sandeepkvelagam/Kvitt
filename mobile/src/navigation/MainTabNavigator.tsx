import React, { useCallback, useState } from "react";
import { View } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { useAuth } from "../context/AuthContext";
import { TabShellContext } from "../context/TabShellContext";
import { HomeQuickActionsContext } from "../context/HomeQuickActionsContext";
import { MainAppTabBar } from "../components/BottomTabBar";
import { QuickActionsOverlay } from "../components/QuickActionsOverlay";
import { DashboardScreenV3 } from "../screens/DashboardScreenV3";
import { ChatsScreen } from "../screens/ChatsScreen";
import { GroupsScreen } from "../screens/GroupsScreen";
import { SettingsScreen } from "../screens/SettingsScreen";
import type { MainTabParamList } from "./mainTabTypes";

export type { MainTabParamList } from "./mainTabTypes";

const Tab = createBottomTabNavigator<MainTabParamList>();

export function MainTabNavigator() {
  const { user } = useAuth();
  const [quickActionsOpen, setQuickActionsOpen] = useState(false);
  const userName = user?.name || user?.email?.split("@")[0] || "Player";
  const userInitial = userName.charAt(0).toUpperCase();

  const onQuickActionsToggle = useCallback(() => {
    setQuickActionsOpen((o) => !o);
  }, []);

  const onTabIndexChange = useCallback((_index: number, routeName: string) => {
    if (routeName !== "Home") {
      setQuickActionsOpen(false);
    }
  }, []);

  return (
    <HomeQuickActionsContext.Provider value={{ quickActionsOpen, setQuickActionsOpen }}>
      <TabShellContext.Provider value={{ isMainTabShell: true }}>
        <View style={{ flex: 1 }}>
          <Tab.Navigator
            initialRouteName="Home"
            tabBar={(props) => (
              <MainAppTabBar
                {...props}
                quickActionsOpen={quickActionsOpen}
                onQuickActionsToggle={onQuickActionsToggle}
                userInitial={userInitial}
                onTabIndexChange={onTabIndexChange}
              />
            )}
            screenOptions={{
              headerShown: false,
              lazy: true,
            }}
          >
            <Tab.Screen name="Home" component={DashboardScreenV3} />
            <Tab.Screen name="Chats" component={ChatsScreen} />
            <Tab.Screen name="Groups" component={GroupsScreen} />
            <Tab.Screen name="Profile" component={SettingsScreen} />
          </Tab.Navigator>
          <QuickActionsOverlay />
        </View>
      </TabShellContext.Provider>
    </HomeQuickActionsContext.Provider>
  );
}
