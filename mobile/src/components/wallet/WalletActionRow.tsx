import React, { useMemo } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS, SPACING } from "../../styles/liquidGlass";
import { APPLE_TYPO, ICON_WELL, LAYOUT, hitSlopExpandToMinSize } from "../../styles/tokens";
import { useTheme } from "../../context/ThemeContext";

interface ThemeColors {
  textSecondary: string;
  glassBg: string;
  glassBorder: string;
}

interface WalletActionRowProps {
  onSend: () => void;
  onReceive: () => void;
  onDeposit: () => void;
  onMore: () => void;
  tc: ThemeColors;
}

/** Same double-ring + icon treatment as Dashboard V3 metric tri-cards */
export function WalletActionRow({ onSend, onReceive, onDeposit, onMore, tc }: WalletActionRowProps) {
  const { colors, isDark } = useTheme();

  const metricRingPad = useMemo(
    () => ({
      padBg: isDark ? "rgba(168, 182, 215, 0.1)" : "rgba(88, 102, 138, 0.07)",
      rimBorder: isDark ? "rgba(255, 255, 255, 0.09)" : "rgba(0, 0, 0, 0.07)",
    }),
    [isDark]
  );

  const actions = [
    {
      icon: "arrow-up-outline" as const,
      label: "Send",
      onPress: onSend,
      iconColor: COLORS.orange,
    },
    {
      icon: "arrow-down-outline" as const,
      label: "Receive",
      onPress: onReceive,
      iconColor: COLORS.trustBlue,
    },
    {
      icon: "card-outline" as const,
      label: "Deposit",
      onPress: onDeposit,
      iconColor: COLORS.status.success,
    },
    {
      icon: "ellipsis-horizontal" as const,
      label: "More",
      onPress: onMore,
      iconColor: tc.textSecondary,
    },
  ];

  const spec = ICON_WELL.tri;

  return (
    <View style={styles.container}>
      {actions.map((action) => (
        <View key={action.label} style={styles.actionItem}>
          <TouchableOpacity
            onPress={action.onPress}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={action.label}
            hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
          >
            <View
              style={[
                styles.ringOuter,
                {
                  width: spec.outer,
                  height: spec.outer,
                  borderRadius: spec.outer / 2,
                  padding: spec.ringPadding,
                  backgroundColor: metricRingPad.padBg,
                  borderColor: metricRingPad.rimBorder,
                },
              ]}
            >
              <View
                style={[
                  styles.ringInner,
                  {
                    width: spec.inner,
                    height: spec.inner,
                    borderRadius: spec.inner / 2,
                    backgroundColor: colors.surface,
                  },
                ]}
              >
                <Ionicons name={action.icon} size={20} color={action.iconColor} />
              </View>
            </View>
          </TouchableOpacity>
          <Text style={[styles.label, { color: tc.textSecondary }]}>{action.label}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: SPACING.xxl,
  },
  actionItem: {
    alignItems: "center",
    gap: SPACING.sm,
  },
  /** Ensures at least 44×44 pt tap area even if ring sizing changes */
  actionHit: {
    minWidth: LAYOUT.touchTarget,
    minHeight: LAYOUT.touchTarget,
    alignItems: "center",
    justifyContent: "center",
  },
  ringOuter: {
    borderWidth: StyleSheet.hairlineWidth * 2,
    alignItems: "center",
    justifyContent: "center",
  },
  ringInner: {
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    color: COLORS.text.secondary,
    fontSize: APPLE_TYPO.caption.size,
    fontWeight: "600",
  },
});
