import React from "react";
import { View, StyleSheet } from "react-native";
import { Skeleton } from "./SkeletonLoader";
import { useTheme } from "../../context/ThemeContext";
import { LAYOUT, RADIUS, SPACE, AVATAR_SIZE } from "../../styles/tokens";
import { appleCardShadowResting } from "../../styles/appleShadows";

/**
 * GroupsSkeleton — Shimmer skeleton matching GroupsScreen (hero card + list card + rows).
 */
export function GroupsSkeleton() {
  const { isDark } = useTheme();
  const cardSurface = isDark ? "rgba(45, 45, 48, 0.9)" : "rgba(255, 255, 255, 0.95)";
  const cardBorder = isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.06)";
  const cardChrome = {
    backgroundColor: cardSurface,
    borderColor: cardBorder,
    ...appleCardShadowResting(isDark),
  };

  return (
    <View style={[styles.container, { paddingHorizontal: LAYOUT.screenPadding }]}>
      <View style={[styles.heroCard, cardChrome]}>
        <Skeleton width="55%" height={12} borderRadius={6} style={{ marginBottom: SPACE.sm }} />
        <Skeleton width="85%" height={14} borderRadius={7} />
      </View>

      <View style={[styles.listCard, cardChrome]}>
        <View style={[styles.cardHeader, { borderBottomColor: cardBorder }]}>
          <Skeleton width={100} height={12} borderRadius={6} />
          <Skeleton width={24} height={12} borderRadius={6} />
        </View>
        {[0, 1, 2, 3, 4].map((i) => (
          <View key={i} style={[styles.row, i < 4 && { borderBottomColor: cardBorder }]}>
            <Skeleton width={AVATAR_SIZE.md} height={AVATAR_SIZE.md} borderRadius={RADIUS.md} />
            <View style={styles.rowText}>
              <Skeleton width={140} height={14} borderRadius={7} style={{ marginBottom: 6 }} />
              <Skeleton width={80} height={10} borderRadius={5} />
            </View>
            <Skeleton width={56} height={20} borderRadius={RADIUS.sm} />
            <Skeleton width={20} height={20} borderRadius={10} style={styles.heartSkeleton} />
            <Skeleton width={14} height={14} borderRadius={4} />
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: SPACE.xs,
  },
  heroCard: {
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    padding: LAYOUT.cardPadding,
    marginBottom: LAYOUT.sectionGap,
    overflow: "hidden",
  },
  listCard: {
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    overflow: "hidden",
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: LAYOUT.cardPadding,
    paddingVertical: SPACE.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: LAYOUT.cardPadding,
    paddingVertical: SPACE.md,
    gap: LAYOUT.elementGap,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowText: {
    flex: 1,
  },
  heartSkeleton: {
    marginLeft: SPACE.xs,
  },
});
