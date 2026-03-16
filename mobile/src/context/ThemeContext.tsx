import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useColorScheme } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

type ThemeMode = "light" | "dark" | "system";

type ThemeContextType = {
  themeMode: ThemeMode;
  isDark: boolean;
  setThemeMode: (mode: ThemeMode) => void;
  colors: typeof LIGHT_COLORS;
};

// Light theme colors — Apple-style grayscale (dark-on-light)
export const LIGHT_COLORS = {
  // Backgrounds & surfaces
  background: "#FFFFFF",
  bgPrimary: "#FFFFFF",
  bgSecondary: "#F5F5F7",
  surface: "#FFFFFF",
  inputBg: "#F5F5F7",
  contentBg: "#FFFFFF",
  navBg: "#F5F5F7",
  profileBg: "#FFFFFF",
  popupBg: "#FFFFFF",

  // Glass effects (keep for Liquid Glass)
  glassBg: "rgba(0, 0, 0, 0.04)",
  glassBorder: "rgba(0, 0, 0, 0.08)",
  glassCardBg: "rgba(255, 255, 255, 0.75)",
  glassCardBorder: "rgba(255, 255, 255, 0.6)",
  liquidGlassBg: "rgba(0, 0, 0, 0.04)",
  liquidGlassInner: "rgba(0, 0, 0, 0.02)",
  liquidGlowOrange: "rgba(0, 0, 0, 0.04)",
  liquidGlowBlue: "rgba(0, 0, 0, 0.04)",

  // Text
  textPrimary: "#111111",
  textSecondary: "#6E6E73",
  textMuted: "#A1A1A6",

  // Borders
  border: "#E5E5EA",

  // Buttons (dark on light)
  buttonPrimary: "#111111",
  buttonText: "#FFFFFF",
  buttonBg: "#111111",         // Legacy alias
  buttonDisabled: "#D1D1D6",

  // Semantic
  success: "#34C759",
  warning: "#FF9F0A",
  danger: "#FF3B30",
  error: "#FF3B30",

  // Brand (logo only — not for general UI)
  orange: "#EE6C29",
  orangeDark: "#C45A22",

  // Legacy compatibility (mapped to grayscale)
  trustBlue: "#007AFF",        // → semantic info
  moonstone: "#6E6E73",        // → textSecondary
  jetDark: "#F5F5F7",
  jetSurface: "#FFFFFF",
};

// Dark theme colors — Apple-style grayscale (light-on-dark)
export const DARK_COLORS = {
  // Backgrounds & surfaces
  background: "#000000",
  bgPrimary: "#000000",
  bgSecondary: "#1C1C1E",
  surface: "#1C1C1E",
  inputBg: "#2C2C2E",
  contentBg: "#000000",
  navBg: "#000000",
  profileBg: "#1C1C1E",
  popupBg: "#1C1C1E",

  // Glass effects (keep for Liquid Glass)
  glassBg: "rgba(255, 255, 255, 0.06)",
  glassBorder: "rgba(255, 255, 255, 0.12)",
  glassCardBg: "rgba(255, 255, 255, 0.06)",
  glassCardBorder: "rgba(255, 255, 255, 0.12)",
  liquidGlassBg: "rgba(255, 255, 255, 0.06)",
  liquidGlassInner: "rgba(255, 255, 255, 0.03)",
  liquidGlowOrange: "rgba(255, 255, 255, 0.06)",
  liquidGlowBlue: "rgba(255, 255, 255, 0.06)",

  // Text
  textPrimary: "#FFFFFF",
  textSecondary: "#98989F",
  textMuted: "#636366",

  // Borders
  border: "#2C2C2E",

  // Buttons (light on dark)
  buttonPrimary: "#FFFFFF",
  buttonText: "#000000",
  buttonBg: "#FFFFFF",         // Legacy alias
  buttonDisabled: "#48484A",

  // Semantic
  success: "#34C759",
  warning: "#FF9F0A",
  danger: "#FF3B30",
  error: "#FF3B30",

  // Brand (logo only — not for general UI)
  orange: "#EE6C29",
  orangeDark: "#C45A22",

  // Legacy compatibility (mapped to grayscale)
  trustBlue: "#007AFF",        // → semantic info
  moonstone: "#98989F",        // → textSecondary
  jetDark: "#1C1C1E",
  jetSurface: "#2C2C2E",
};

// Spacing constants removed — use SPACE/LAYOUT from tokens.ts instead.

const THEME_STORAGE_KEY = "@kvitt_theme_mode";

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemColorScheme = useColorScheme();
  const [themeMode, setThemeModeState] = useState<ThemeMode>("system");

  // Load saved theme preference
  useEffect(() => {
    AsyncStorage.getItem(THEME_STORAGE_KEY).then((savedMode) => {
      if (savedMode && ["light", "dark", "system"].includes(savedMode)) {
        setThemeModeState(savedMode as ThemeMode);
      }
    });
  }, []);

  // Save theme preference when changed
  const setThemeMode = (mode: ThemeMode) => {
    setThemeModeState(mode);
    AsyncStorage.setItem(THEME_STORAGE_KEY, mode);
  };

  // Determine if dark mode based on theme mode and system preference
  const isDark = themeMode === "system"
    ? systemColorScheme === "dark"
    : themeMode === "dark";

  const colors = isDark ? DARK_COLORS : LIGHT_COLORS;

  // Don't return null - always render with default system theme
  return (
    <ThemeContext.Provider value={{ themeMode, isDark, setThemeMode, colors }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
}
