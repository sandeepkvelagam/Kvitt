import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import * as SplashScreen from "expo-splash-screen";

// Keep native splash visible until custom JS splash is ready
SplashScreen.preventAutoHideAsync();
import { AuthProvider } from "./src/context/AuthContext";
import { DrawerProvider } from "./src/context/DrawerContext";
import { ThemeProvider, useTheme } from "./src/context/ThemeContext";
import { LanguageProvider } from "./src/context/LanguageContext";
import { HapticsProvider } from "./src/context/HapticsContext";
import { PokerAIProvider } from "./src/context/PokerAIContext";
import RootNavigator from "./src/navigation/RootNavigator";

function AppContent() {
  const { isDark } = useTheme();
  return (
    <>
      <RootNavigator />
      <StatusBar style={isDark ? "light" : "dark"} />
    </>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <LanguageProvider>
            <AuthProvider>
              <DrawerProvider>
                <HapticsProvider>
                  <PokerAIProvider>
                    <AppContent />
                  </PokerAIProvider>
                </HapticsProvider>
              </DrawerProvider>
            </AuthProvider>
          </LanguageProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
