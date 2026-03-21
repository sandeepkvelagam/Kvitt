/**
 * Apple-style card shadows for React Native.
 * iOS supports one shadow per view; values approximate layered CSS shadows:
 * 0 1px 3px rgba(0,0,0,0.12), 0 4px 12px rgba(0,0,0,0.08)
 */
import { Platform, ViewStyle } from "react-native";

/** Resting elevation for dashboard cards, pills, and panels */
export function appleCardShadowResting(isDark: boolean): ViewStyle {
  if (Platform.OS === "android") {
    return { elevation: isDark ? 5 : 3 };
  }
  return {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: isDark ? 0.4 : 0.1,
    shadowRadius: isDark ? 16 : 12,
  };
}

/** Slightly stronger shadow for larger hero / recent sections */
export function appleCardShadowProminent(isDark: boolean): ViewStyle {
  if (Platform.OS === "android") {
    return { elevation: isDark ? 8 : 5 };
  }
  return {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: isDark ? 0.45 : 0.12,
    shadowRadius: isDark ? 20 : 16,
  };
}

/** Modal / overlay tiles — a bit more lift */
export function appleTileShadow(isDark: boolean): ViewStyle {
  if (Platform.OS === "android") {
    return { elevation: isDark ? 6 : 4 };
  }
  return {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: isDark ? 0.35 : 0.12,
    shadowRadius: 14,
  };
}
