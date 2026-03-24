import React from "react";
import { View, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { GlassSurface } from "../ui/GlassSurface";
import { GlassButton } from "../ui/GlassButton";
import { Title3, Subhead, Footnote } from "../ui";
import { useTheme } from "../../context/ThemeContext";
import { SPACE, RADIUS } from "../../styles/tokens";
import type { InfoCardPayload } from "./messageTypes";

interface InfoCardProps {
  payload: InfoCardPayload;
  isLatest: boolean;
  onAction?: (action: string) => void;
}

export function InfoCard({ payload, isLatest, onAction }: InfoCardProps) {
  const { colors } = useTheme();

  return (
    <GlassSurface style={styles.card} blur={false}>
      <View style={styles.titleRow}>
        {payload.icon && (
          <Ionicons name={payload.icon as any} size={20} color={colors.orange} />
        )}
        <Title3 style={{ flex: 1, color: colors.textPrimary }}>{payload.title}</Title3>
      </View>

      <Subhead style={{ color: colors.textSecondary, marginBottom: SPACE.sm }}>{payload.body}</Subhead>

      {payload.footer && (
        <Footnote style={{ color: colors.textMuted, marginBottom: SPACE.md }}>{payload.footer}</Footnote>
      )}

      {payload.actions && payload.actions.length > 0 && isLatest && (
        <View style={styles.actionsContainer}>
          {payload.actions.map((action, i) => (
            <GlassButton
              key={i}
              onPress={() => onAction?.(action.action)}
              variant="ghost"
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
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.sm,
    marginBottom: SPACE.sm,
  },
  actionsContainer: {
    flexDirection: "row",
    gap: SPACE.sm,
    flexWrap: "wrap",
    marginTop: SPACE.sm,
  },
});
