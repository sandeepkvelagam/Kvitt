import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StyleProp,
  ViewStyle,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  FadeInDown,
  FadeOutDown,
  Layout,
} from "react-native-reanimated";
import { SPRINGS, ANIMATION } from "../../styles/liquidGlass";
import { FONT, SPACE, RADIUS } from "../../styles/tokens";
import { useTheme } from "../../context/ThemeContext";

interface GlassListItemProps {
  title: string;
  subtitle?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  rightText?: string;
  rightTextColor?: string;
  onPress?: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  showChevron?: boolean;
  danger?: boolean;
  /** Pass list index to enable staggered enter/exit animations */
  animationIndex?: number;
}

/**
 * GlassListItem - Glass styled list row with press animation
 *
 * Uses react-native-reanimated for UI-thread press feedback
 * and optional entering/exiting layout animations.
 */
export function GlassListItem({
  title,
  subtitle,
  leftIcon,
  rightIcon,
  rightText,
  rightTextColor,
  onPress,
  disabled = false,
  style,
  showChevron = false,
  danger = false,
  animationIndex,
}: GlassListItemProps) {
  const { colors } = useTheme();
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    if (!onPress) return;
    scale.value = withSpring(ANIMATION.scale.cardPressed, SPRINGS.press);
  };

  const handlePressOut = () => {
    if (!onPress) return;
    scale.value = withSpring(ANIMATION.scale.normal, SPRINGS.snap);
  };

  const content = (
    <View style={styles.content}>
      {leftIcon && <View style={styles.leftIcon}>{leftIcon}</View>}
      <View style={styles.textContainer}>
        <Text style={[styles.title, { color: danger ? colors.error : colors.textPrimary }]}>{title}</Text>
        {subtitle && <Text style={[styles.subtitle, { color: colors.textMuted }]}>{subtitle}</Text>}
      </View>
      <View style={styles.rightContainer}>
        {rightText && (
          <Text style={[styles.rightText, { color: rightTextColor ?? colors.textSecondary }]}>
            {rightText}
          </Text>
        )}
        {rightIcon}
        {showChevron && !rightIcon && (
          <Text style={[styles.chevron, { color: colors.textMuted }]}>›</Text>
        )}
      </View>
    </View>
  );

  // Layout animation props (only when animationIndex is provided)
  const enteringAnim = animationIndex !== undefined
    ? FadeInDown.delay(animationIndex * 40).springify().damping(SPRINGS.layout.damping)
    : undefined;
  const exitingAnim = animationIndex !== undefined
    ? FadeOutDown.duration(200)
    : undefined;
  const layoutAnim = animationIndex !== undefined
    ? Layout.springify().damping(SPRINGS.layout.damping)
    : undefined;

  const containerStyle = [
    styles.container,
    { backgroundColor: colors.glassBg },
    style,
  ];

  if (!onPress) {
    return (
      <Animated.View
        style={containerStyle}
        entering={enteringAnim}
        exiting={exitingAnim}
        layout={layoutAnim}
      >
        {content}
      </Animated.View>
    );
  }

  return (
    <Animated.View
      style={[animatedStyle, style]}
      entering={enteringAnim}
      exiting={exitingAnim}
      layout={layoutAnim}
    >
      <TouchableOpacity
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled}
        activeOpacity={0.9}
        style={[styles.container, { backgroundColor: colors.glassBg }, disabled && styles.disabled]}
      >
        {content}
      </TouchableOpacity>
    </Animated.View>
  );
}

/**
 * GlassListSection - Section wrapper for list items with optional title
 */
export function GlassListSection({
  title,
  children,
  style,
}: {
  title?: string;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();

  return (
    <View style={[styles.section, style]}>
      {title && <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>{title}</Text>}
      <View style={[styles.sectionContent, { backgroundColor: colors.glassBg, borderColor: colors.glassBorder }]}>
        {children}
      </View>
    </View>
  );
}

/**
 * GlassListDivider - Visual separator between list items
 */
export function GlassListDivider() {
  const { colors } = useTheme();
  return <View style={[styles.divider, { backgroundColor: colors.glassBorder }]} />;
}

const styles = StyleSheet.create({
  container: {
    borderRadius: RADIUS.md,
    padding: SPACE.lg,
    marginVertical: SPACE.xs,
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
  },
  leftIcon: {
    marginRight: SPACE.md,
    width: 24,
    alignItems: "center",
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: FONT.body.size,
    fontWeight: "500",
  },
  subtitle: {
    fontSize: FONT.caption.size,
    marginTop: 2,
  },
  rightContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.sm,
  },
  rightText: {
    fontSize: FONT.secondary.size,
  },
  chevron: {
    fontSize: FONT.title.size,
    fontWeight: "300",
  },
  disabled: {
    opacity: 0.5,
  },
  // Section styles
  section: {
    marginBottom: SPACE.lg,
  },
  sectionTitle: {
    fontSize: FONT.caption.size,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: SPACE.sm,
    paddingHorizontal: SPACE.xs,
  },
  sectionContent: {
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    overflow: "hidden",
  },
  // Divider
  divider: {
    height: 1,
    marginHorizontal: SPACE.lg,
  },
});
