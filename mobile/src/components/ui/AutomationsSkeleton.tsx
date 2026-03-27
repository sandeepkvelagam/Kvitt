import React from "react";
import { View, StyleSheet } from "react-native";
import { Skeleton } from "./SkeletonLoader";
import { useTheme } from "../../context/ThemeContext";
import { RADIUS, SPACE } from "../../styles/tokens";

/**
 * Card-shaped skeleton rows for AutomationsScreen initial load.
 */
export function AutomationsSkeleton() {
  const { colors, isDark } = useTheme();
  const border = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)";

  return (
    <View style={styles.wrap}>
      {[0, 1, 2, 3].map((i) => (
        <View
          key={i}
          style={[
            styles.card,
            {
              backgroundColor: colors.surface,
              borderColor: border,
            },
          ]}
        >
          <View style={styles.cardHeader}>
            <View style={styles.titleRow}>
              <Skeleton width={24} height={24} borderRadius={6} />
              <Skeleton width="55%" height={18} borderRadius={8} />
              <Skeleton width={72} height={22} borderRadius={RADIUS.full} />
            </View>
            <Skeleton width={48} height={28} borderRadius={14} />
          </View>
          <Skeleton width="92%" height={14} borderRadius={7} style={{ marginBottom: SPACE.sm }} />
          <View style={styles.badgeRow}>
            <Skeleton width={100} height={26} borderRadius={RADIUS.sm} />
            <Skeleton width={12} height={12} borderRadius={3} />
            <Skeleton width={88} height={26} borderRadius={RADIUS.sm} />
          </View>
          <View style={styles.statsRow}>
            <Skeleton width={80} height={12} borderRadius={6} />
            <Skeleton width={64} height={12} borderRadius={6} />
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 16,
    gap: 0,
  },
  card: {
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    padding: SPACE.lg,
    marginBottom: SPACE.md,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: SPACE.sm,
  },
  titleRow: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.sm,
    marginRight: SPACE.sm,
  },
  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.sm,
    flexWrap: "wrap",
    marginBottom: SPACE.md,
  },
  statsRow: {
    flexDirection: "row",
    gap: SPACE.lg,
  },
});
