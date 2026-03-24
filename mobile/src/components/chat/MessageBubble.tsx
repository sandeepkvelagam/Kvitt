import React from "react";
import { View, StyleSheet, type ViewStyle } from "react-native";
import { RADIUS, LAYOUT } from "../../styles/tokens";
import { useTheme } from "../../context/ThemeContext";
import { appleCardShadowResting } from "../../styles/appleShadows";

type BubbleRole = "assistant" | "user" | "error";

type MessageBubbleProps = {
  role: BubbleRole;
  backgroundColor: string;
  borderColor?: string;
  /** Apple-style resting shadow on the bubble body (assistant only; tails unchanged). */
  elevated?: boolean;
  children: React.ReactNode;
  style?: ViewStyle;
};

const TAIL_SIZE = 6;
const TAIL_INSET = 14;

/**
 * iMessage-style bubble with a small triangular tail toward the avatar side.
 */
export function MessageBubble({
  role,
  backgroundColor,
  borderColor,
  elevated = false,
  children,
  style,
}: MessageBubbleProps) {
  const { isDark } = useTheme();
  const bodyElevation =
    elevated && role === "assistant" ? appleCardShadowResting(isDark) : undefined;

  if (role === "error") {
    return (
      <View style={[styles.shell, styles.shellAssistant, style]}>
        <View
          style={[
            styles.body,
            styles.bodyErrorRadius,
            {
              backgroundColor,
              borderWidth: StyleSheet.hairlineWidth * 2,
              borderColor: borderColor ?? "transparent",
            },
          ]}
        >
          {children}
        </View>
      </View>
    );
  }

  const hasBorder = !!borderColor;

  return (
    <View
      style={[
        styles.shell,
        role === "user" ? styles.shellUser : styles.shellAssistant,
        style,
      ]}
    >
      {role === "assistant" && (
        <View
          pointerEvents="none"
          style={[
            styles.tailAssistant,
            {
              borderRightColor: backgroundColor,
              borderTopWidth: TAIL_SIZE,
              borderBottomWidth: TAIL_SIZE,
              borderRightWidth: TAIL_SIZE + 2,
            },
          ]}
        />
      )}
      {role === "user" && (
        <View
          pointerEvents="none"
          style={[
            styles.tailUser,
            {
              borderLeftColor: backgroundColor,
              borderTopWidth: TAIL_SIZE,
              borderBottomWidth: TAIL_SIZE,
              borderLeftWidth: TAIL_SIZE + 2,
            },
          ]}
        />
      )}
      <View
        style={[
          styles.body,
          {
            backgroundColor,
            borderWidth: hasBorder ? StyleSheet.hairlineWidth : 0,
            borderColor: borderColor ?? "transparent",
          },
          role === "assistant" && styles.bodyAssistantRadius,
          role === "user" && styles.bodyUserRadius,
          bodyElevation,
        ]}
      >
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    maxWidth: "75%",
    position: "relative",
    overflow: "visible",
  },
  shellAssistant: {
    alignSelf: "flex-start",
  },
  shellUser: {
    alignSelf: "flex-end",
  },
  tailAssistant: {
    position: "absolute",
    left: -TAIL_SIZE - 1,
    bottom: TAIL_INSET,
    width: 0,
    height: 0,
    borderTopColor: "transparent",
    borderBottomColor: "transparent",
    zIndex: 0,
  },
  tailUser: {
    position: "absolute",
    right: -TAIL_SIZE - 1,
    bottom: TAIL_INSET,
    width: 0,
    height: 0,
    borderTopColor: "transparent",
    borderBottomColor: "transparent",
    zIndex: 0,
  },
  body: {
    paddingVertical: LAYOUT.cardPadding / 2,
    paddingHorizontal: LAYOUT.cardPadding,
    zIndex: 1,
  },
  bodyAssistantRadius: {
    borderTopLeftRadius: 4,
    borderTopRightRadius: RADIUS.lg,
    borderBottomRightRadius: RADIUS.lg,
    borderBottomLeftRadius: RADIUS.lg,
  },
  bodyUserRadius: {
    borderTopLeftRadius: RADIUS.lg,
    borderTopRightRadius: 4,
    borderBottomLeftRadius: RADIUS.lg,
    borderBottomRightRadius: RADIUS.lg,
  },
  bodyErrorRadius: {
    borderRadius: RADIUS.lg,
  },
});
