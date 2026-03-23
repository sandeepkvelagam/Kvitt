import React from "react";
import { View, StyleSheet } from "react-native";
import { Skeleton } from "./SkeletonLoader";
import { useTheme } from "../../context/ThemeContext";
import { SPACE, LAYOUT, RADIUS } from "../../styles/tokens";
import { appleCardShadowResting } from "../../styles/appleShadows";

const SCREEN_PAD = LAYOUT.screenPadding;

type ChatsSkeletonProps = {
  /** Fewer rows when matching “recent” preview */
  rows?: number;
};

/**
 * ChatsSkeleton — Shimmer rows aligned with ChatsScreen V3 cards (tokens + light/dark).
 */
export function ChatsSkeleton({ rows = 5 }: ChatsSkeletonProps) {
  const { isDark } = useTheme();

  const cardShell = {
    backgroundColor: isDark ? "rgba(45, 45, 48, 0.9)" : "rgba(255, 255, 255, 0.95)",
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.06)",
    ...appleCardShadowResting(isDark),
  };

  const count = Math.max(1, Math.min(rows, 8));

  return (
    <View style={[styles.container, { paddingHorizontal: SCREEN_PAD }]}>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={[styles.card, cardShell]}>
          <Skeleton width={48} height={48} borderRadius={RADIUS.md} />
          <View style={styles.rowText}>
            <Skeleton width="72%" height={14} borderRadius={7} style={{ marginBottom: SPACE.sm }} />
            <Skeleton width="45%" height={11} borderRadius={5} style={{ marginBottom: SPACE.xs }} />
            <Skeleton width="88%" height={10} borderRadius={5} />
          </View>
          <Skeleton width={18} height={18} borderRadius={4} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: SPACE.sm,
    gap: SPACE.sm,
  },
  card: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: SPACE.lg,
    paddingVertical: SPACE.md,
    gap: LAYOUT.elementGap,
  },
  rowText: {
    flex: 1,
  },
});
