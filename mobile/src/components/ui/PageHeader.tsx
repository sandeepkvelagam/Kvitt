/**
 * PageHeader — Consistent header used across all bottom-sheet sub-pages.
 * Matches SettingsScreen style: close button (circle), centered title, optional right element.
 */
import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../context/ThemeContext";
import { FONT, SPACE, LAYOUT, RADIUS } from "../../styles/tokens";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  onClose: () => void;
  rightElement?: React.ReactNode;
}

export function PageHeader({ title, subtitle, onClose, rightElement }: PageHeaderProps) {
  const { colors } = useTheme();
  return (
    <View style={styles.header}>
      <Pressable
        style={({ pressed }) => [
          styles.closeBtn,
          { backgroundColor: colors.glassBg, borderColor: colors.glassBorder },
          pressed && { opacity: 0.7, transform: [{ scale: 0.92 }] },
        ]}
        onPress={onClose}
        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
      >
        <Ionicons name="chevron-back" size={22} color={colors.textPrimary} />
      </Pressable>

      <View style={styles.centerBlock}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>{title}</Text>
        {subtitle ? <Text style={[styles.subtitle, { color: colors.textMuted }]}>{subtitle}</Text> : null}
      </View>

      <View style={styles.right}>{rightElement ?? <View style={{ width: LAYOUT.touchTarget }} />}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SPACE.lg,
    paddingVertical: SPACE.md,
    paddingTop: SPACE.lg,
  },
  closeBtn: {
    width: LAYOUT.touchTarget,
    height: LAYOUT.touchTarget,
    borderRadius: RADIUS.full,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  centerBlock: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: SPACE.sm,
  },
  title: {
    fontSize: FONT.navTitle.size,
    fontWeight: FONT.navTitle.weight,
  },
  subtitle: {
    fontSize: FONT.meta.size,
    marginTop: 2,
  },
  right: {
    width: LAYOUT.touchTarget,
    alignItems: "flex-end",
  },
});
