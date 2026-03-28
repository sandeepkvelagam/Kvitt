/**
 * PageHeader — Modal / bottom-sheet stack screens only (Wallet, Billing, Request & Pay, etc.).
 * Title default: Headline (17pt semibold) — not for main tab roots (those use Title1).
 * Title prominent: 24pt bold (`PAGE_HEADER_PROMINENT_TITLE`) — Voice Commands sheet style; used on Profile, Billing, Wallet, Request & Pay, etc.
 * Title title2: 22pt bold (`APPLE_TYPO.title2`) — same as `Title2`; use with `titleAlign="left"` for profile-style sheets.
 * Back control: 44×44 pt minimum tap target.
 */
import React from "react";
import { View, Text, StyleSheet, Pressable, type TextStyle } from "react-native";
import { AppIcon } from "../icons";
import { useTheme } from "../../context/ThemeContext";
import { SPACE, LAYOUT, RADIUS, PAGE_HEADER_PROMINENT_TITLE, APPLE_TYPO, hitSlopExpandToMinSize } from "../../styles/tokens";
import { Headline, Footnote, Subhead } from "./Typography";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  /** Default `center` matches sheet sub-pages; use `left` for profile-style headers. */
  titleAlign?: "center" | "left";
  /** `prominent` = 24pt bold; `title2` = 22pt bold (same as `Title2`); default = 17pt Headline. */
  titleVariant?: "default" | "prominent" | "title2";
  onClose: () => void;
  rightElement?: React.ReactNode;
  /** Defaults to `SPACE.lg`; use `LAYOUT.screenPadding` to align with screen content gutters. */
  paddingHorizontal?: number;
  /** Override header top padding (e.g. `SPACE.sm` or `0` under a sheet grabber to avoid double spacing). */
  paddingTop?: number;
  /** Override header bottom padding. */
  paddingBottom?: number;
  /** Secondary line under title — `subhead` matches Dashboard V3 under Title1 (15pt); default `footnote` is 13pt. */
  subtitleVariant?: "footnote" | "subhead";
  /** Align back control with the top of the title block (avoids looking vertically “low” vs multi-line titles). */
  alignBackWithTitle?: boolean;
}

export function PageHeader({
  title,
  subtitle,
  titleAlign = "center",
  titleVariant = "default",
  onClose,
  rightElement,
  paddingHorizontal,
  paddingTop,
  paddingBottom,
  subtitleVariant = "footnote",
  alignBackWithTitle = false,
}: PageHeaderProps) {
  const { colors } = useTheme();
  const isLeft = titleAlign === "left";
  const isProminent = titleVariant === "prominent";
  const isTitle2 = titleVariant === "title2";
  const SubtitleText = subtitleVariant === "subhead" ? Subhead : Footnote;
  return (
    <View
      style={[
        styles.header,
        alignBackWithTitle && styles.headerAlignTop,
        paddingHorizontal !== undefined && { paddingHorizontal },
        paddingTop !== undefined && { paddingTop },
        paddingBottom !== undefined && { paddingBottom },
      ]}
    >
      <Pressable
        style={({ pressed }) => [
          styles.closeBtn,
          alignBackWithTitle && styles.closeBtnAlignTitle,
          { backgroundColor: colors.glassBg, borderColor: colors.glassBorder },
          pressed && { opacity: 0.7, transform: [{ scale: 0.92 }] },
        ]}
        onPress={onClose}
        hitSlop={hitSlopExpandToMinSize(LAYOUT.touchTarget)}
      >
        <AppIcon name="chevronBack" size={22} color={colors.textPrimary} />
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
        ) : isTitle2 ? (
          <Text
            numberOfLines={2}
            style={[
              styles.titleTitle2,
              {
                color: colors.textPrimary,
                fontSize: APPLE_TYPO.title2.size,
                fontWeight: APPLE_TYPO.title2.weight as TextStyle["fontWeight"],
              },
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
          <SubtitleText
            color={colors.textMuted}
            style={[styles.subtitle, subtitleVariant === "subhead" && styles.subtitleSubhead, isLeft && styles.subtitleLeft]}
            numberOfLines={2}
          >
            {subtitle}
          </SubtitleText>
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
    paddingBottom: SPACE.md,
    paddingTop: SPACE.lg,
  },
  headerAlignTop: {
    alignItems: "flex-start",
  },
  closeBtn: {
    width: LAYOUT.touchTarget,
    height: LAYOUT.touchTarget,
    borderRadius: RADIUS.full,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  /** Optical alignment with first line of title2 / prominent titles */
  closeBtnAlignTitle: {
    marginTop: 2,
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
  titleTitle2: {
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
  subtitleSubhead: {
    marginTop: SPACE.xs,
    opacity: 0.7,
  },
  subtitleLeft: {
    textAlign: "left",
  },
  right: {
    width: LAYOUT.touchTarget,
    alignItems: "flex-end",
  },
});
