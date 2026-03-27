import React from "react";
import { View, StyleSheet } from "react-native";
import { Skeleton } from "./SkeletonLoader";
import { useTheme } from "../../context/ThemeContext";
import { LAYOUT, RADIUS, SPACE } from "../../styles/tokens";
import { appleCardShadowResting } from "../../styles/appleShadows";

const VOTE_BOX = 44;

/**
 * List-shaped skeleton for FeatureRequestsScreen initial load (matches card + vote column).
 */
export function FeatureRequestsListSkeleton() {
  const { isDark } = useTheme();
  const cardChrome = {
    backgroundColor: isDark ? "rgba(45, 45, 48, 0.9)" : "rgba(255, 255, 255, 0.95)",
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)",
    ...appleCardShadowResting(isDark),
  };

  return (
    <View style={styles.wrap}>
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <View key={i} style={[styles.card, cardChrome]}>
          <View style={styles.cardContent}>
            <Skeleton width="88%" height={18} borderRadius={8} style={{ marginBottom: SPACE.xs }} />
            <Skeleton width="100%" height={14} borderRadius={7} style={{ marginBottom: 4 }} />
            <Skeleton width="65%" height={14} borderRadius={7} />
            <View style={styles.metaRow}>
              <Skeleton width={36} height={12} borderRadius={6} />
              <Skeleton width={56} height={18} borderRadius={RADIUS.full} />
            </View>
          </View>
          <Skeleton width={VOTE_BOX} height={VOTE_BOX} borderRadius={RADIUS.sm} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: LAYOUT.screenPadding,
    paddingBottom: 48,
    flexGrow: 1,
  },
  card: {
    flexDirection: "row",
    alignItems: "stretch",
    padding: SPACE.md,
    marginBottom: SPACE.sm,
  },
  cardContent: {
    flex: 1,
    marginRight: SPACE.sm,
    justifyContent: "center",
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.sm,
    marginTop: SPACE.xs,
  },
});
