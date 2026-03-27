/**
 * PageHeader — Modal / bottom-sheet stack screens only (Wallet, Billing, Request & Pay, etc.).
 * Title default: Headline (17pt semibold) — not for main tab roots (those use Title1).
 * Title prominent: 24pt bold (`PAGE_HEADER_PROMINENT_TITLE`) — Voice Commands sheet style; used on Profile, Billing, Wallet, Request & Pay, etc.
 * Back control: 44×44 pt minimum tap target.
 */
import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../context/ThemeContext";
import { SPACE, LAYOUT, RADIUS, PAGE_HEADER_PROMINENT_TITLE, hitSlopExpandToMinSize } from "../../styles/tokens";
import { Headline, Footnote } from "./Typography";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  /** Default `center` matches sheet sub-pages; use `left` for profile-style headers. */
  titleAlign?: "center" | "left";
  /** `prominent` = 24pt bold (Voice Commands modal); default = 17pt Headline. */
  titleVariant?: "default" | "prominent";
  onClose: () => void;
  rightElement?: React.ReactNode;
}

export function PageHeader({
  title,
  subtitle,
  titleAlign = "center",
  titleVariant = "default",
  onClose,
  rightElement,
}: PageHeaderProps) {
  const { colors } = useTheme();
  const isLeft = titleAlign === "left";
  const isProminent = titleVariant === "prominent";
  return (
    <View style={styles.header}>
      <Pressable
        style={({ pressed }) => [
          styles.closeBtn,
          { backgroundColor: colors.glassBg, borderColor: colors.glassBorder },
          pressed && { opacity: 0.7, transform: [{ scale: 0.92 }] },
        ]}
        onPress={onClose}
        hitSlop={hitSlopExpandToMinSize(LAYOUT.touchTarget)}
      >
        <Ionicons name="chevron-back" size={22} color={colors.textPrimary} />
      </Pressable>

      <View style={[styles.centerBlock, isLeft && styles.titleBlockLeft]}>
        {isProminent ? (
          <Text
            numberOfLines={2}
            style={[
              styles.titleProminent,
              { color: colors.textPrimary, fontSize: PAGE_HEADER_PROMINENT_TITLE.size, fontWeight: PAGE_HEADER_PROMINENT_TITLE.weight },
              !isLeft && styles.titleProminentCenter,
              isLeft && styles.titleLeft,
            ]}
          >
            {title}
          </Text>
        ) : (
          <Headline numberOfLines={1} style={[styles.title, isLeft && styles.titleLeft]}>
            {title}
          </Headline>
        )}
        {subtitle ? (
          <Footnote
            style={[
              styles.subtitle,
              { color: colors.textMuted },
              isLeft && styles.subtitleLeft,
            ]}
            numberOfLines={2}
          >
            {subtitle}
          </Footnote>
        ) : null}
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
  titleBlockLeft: {
    alignItems: "flex-start",
  },
  title: {
    letterSpacing: -0.25,
    textAlign: "center",
    width: "100%",
  },
  titleLeft: {
    textAlign: "left",
  },
  titleProminent: {
    letterSpacing: -0.35,
    width: "100%",
  },
  titleProminentCenter: {
    textAlign: "center",
  },
  subtitle: {
    marginTop: 2,
    textAlign: "center",
    width: "100%",
  },
  subtitleLeft: {
    textAlign: "left",
  },
  right: {
    width: LAYOUT.touchTarget,
    alignItems: "flex-end",
  },
});
