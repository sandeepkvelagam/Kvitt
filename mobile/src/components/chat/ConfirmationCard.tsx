import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { GlassSurface } from "../ui/GlassSurface";
import { GlassButton } from "../ui/GlassButton";
import { Title3, Footnote } from "../ui";
import { useTheme } from "../../context/ThemeContext";
import { FONT, SPACE, RADIUS } from "../../styles/tokens";
import type { ConfirmationPayload } from "./messageTypes";

interface ConfirmationCardProps {
  payload: ConfirmationPayload;
  isLatest: boolean;
  onAction: (action: string) => void;
  actedAction?: string;
}

type GlowVariant = "green" | "blue" | "orange" | "red";

function variantVisual(
  variant: ConfirmationPayload["variant"],
  colors: ReturnType<typeof useTheme>["colors"]
): { glow: GlowVariant; icon: string; iconColor: string } {
  const v = variant || "info";
  const map: Record<
    ConfirmationPayload["variant"],
    { glow: GlowVariant; icon: string; iconColor: string }
  > = {
    success: { glow: "green", icon: "checkmark-circle", iconColor: colors.success },
    info: { glow: "blue", icon: "information-circle", iconColor: colors.trustBlue },
    warning: { glow: "orange", icon: "warning", iconColor: colors.warning },
    error: { glow: "red", icon: "close-circle", iconColor: colors.danger },
  };
  return map[v] || map.info;
}

const BUTTON_VARIANT_MAP: Record<string, "primary" | "secondary" | "ghost" | "destructive"> = {
  primary: "primary",
  secondary: "secondary",
  ghost: "ghost",
};

export function ConfirmationCard({
  payload,
  isLatest,
  onAction,
  actedAction,
}: ConfirmationCardProps) {
  const { colors } = useTheme();
  const config = variantVisual(payload.variant, colors);
  const showActions = isLatest && !actedAction && payload.actions && payload.actions.length > 0;

  return (
    <GlassSurface style={styles.card} glowVariant={config.glow} blur={false}>
      <View style={styles.header}>
        <Ionicons name={config.icon as any} size={24} color={config.iconColor} />
        <Title3 style={{ flex: 1, color: colors.textPrimary }}>{payload.title}</Title3>
      </View>

      <Text style={[styles.message, { color: colors.textSecondary }]}>{payload.message}</Text>

      {payload.details && payload.details.length > 0 && (
        <View style={[styles.detailsContainer, { borderTopColor: colors.border }]}>
          {payload.details.map((row, i) => (
            <View key={i} style={styles.detailRow}>
              <Footnote style={{ fontWeight: "500", color: colors.textMuted }}>{row.label}</Footnote>
              <Footnote style={{ fontWeight: "600", color: colors.textPrimary }}>{row.value}</Footnote>
            </View>
          ))}
        </View>
      )}

      {showActions && (
        <View style={styles.actionsContainer}>
          {payload.actions!.map((action, i) => (
            <GlassButton
              key={i}
              onPress={() => onAction(action.action)}
              variant={BUTTON_VARIANT_MAP[action.variant || "ghost"] || "ghost"}
              size="small"
            >
              {action.label}
            </GlassButton>
          ))}
        </View>
      )}
    </GlassSurface>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: RADIUS.lg,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.sm,
    marginBottom: SPACE.sm,
  },
  message: {
    fontSize: FONT.secondary.size,
    lineHeight: 20,
    marginBottom: SPACE.md,
  },
  detailsContainer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: SPACE.md,
    marginBottom: SPACE.md,
    gap: SPACE.sm,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: SPACE.sm,
  },
  actionsContainer: {
    flexDirection: "row",
    gap: SPACE.sm,
    flexWrap: "wrap",
  },
});
