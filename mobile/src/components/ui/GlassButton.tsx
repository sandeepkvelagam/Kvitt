import React from "react";
import {
  TouchableOpacity,
  Text,
  View,
  StyleSheet,
  StyleProp,
  ViewStyle,
  TextStyle,
  ActivityIndicator,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from "react-native-reanimated";
import { COLORS, SHADOWS, SPRINGS, ANIMATION } from "../../styles/liquidGlass";
import { FONT, SPACE, LAYOUT, RADIUS, BUTTON_SIZE, ACTION_COLOR } from "../../styles/tokens";
import { useTheme } from "../../context/ThemeContext";

// New canonical types
type ButtonVariant = "primary" | "secondary" | "tertiary" | "destructive"
  // Legacy aliases (mapped internally)
  | "primaryDark" | "ghost";
type ButtonSize = "compact" | "regular" | "large"
  // Legacy aliases (mapped internally)
  | "small" | "medium";

interface GlassButtonProps {
  children: React.ReactNode;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  testID?: string;
}

/**
 * GlassButton - Premium button with spring press animation
 *
 * Uses react-native-reanimated for UI-thread animations.
 */
export function GlassButton({
  children,
  onPress,
  variant = "primary",
  size = "medium",
  disabled = false,
  loading = false,
  fullWidth = false,
  leftIcon,
  rightIcon,
  style,
  textStyle,
  testID,
}: GlassButtonProps) {
  const { colors } = useTheme();
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(ANIMATION.scale.pressed, SPRINGS.press);
  };

  const handlePressOut = () => {
    scale.value = withSpring(ANIMATION.scale.normal, SPRINGS.snap);
  };

  // Map legacy variant names to canonical ones
  const resolvedVariant = variant === "primaryDark" ? "primary"
    : variant === "ghost" ? "tertiary"
    : variant;

  const getVariantStyle = (): ViewStyle => {
    switch (resolvedVariant) {
      case "primary":
        return { backgroundColor: ACTION_COLOR.primary };
      case "secondary":
        return { backgroundColor: ACTION_COLOR.secondary };
      case "tertiary":
        return {
          backgroundColor: colors.glassBg,
          borderWidth: 1.5,
          borderColor: colors.glassBorder,
        };
      case "destructive":
        return { backgroundColor: ACTION_COLOR.destructive };
      default:
        return { backgroundColor: ACTION_COLOR.primary };
    }
  };

  // Map legacy size names to canonical ones
  const resolvedSize = size === "small" ? "compact"
    : size === "medium" ? "regular"
    : size;

  const getSizeStyle = (): ViewStyle & { fontSize: number } => {
    switch (resolvedSize) {
      case "large":
        return { height: BUTTON_SIZE.large.height, paddingHorizontal: LAYOUT.cardPadding, fontSize: FONT.body.size };
      case "regular":
        return { height: BUTTON_SIZE.regular.height, paddingHorizontal: SPACE.lg, fontSize: FONT.secondary.size };
      case "compact":
        return { height: BUTTON_SIZE.compact.height, paddingHorizontal: SPACE.md, fontSize: FONT.sectionLabel.size };
      default:
        return { height: BUTTON_SIZE.regular.height, paddingHorizontal: SPACE.lg, fontSize: FONT.secondary.size };
    }
  };

  const getTextColor = (): string => {
    if (resolvedVariant === "tertiary") {
      return colors.textPrimary;
    }
    return "#FFFFFF";
  };

  const sizeStyle = getSizeStyle();
  const isDisabled = disabled || loading;

  return (
    <Animated.View
      style={[
        animatedStyle,
        fullWidth && { width: "100%" },
      ]}
    >
      <TouchableOpacity
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={isDisabled}
        activeOpacity={0.9}
        testID={testID}
        accessibilityRole="button"
        style={[
          styles.base,
          getVariantStyle(),
          { height: sizeStyle.height, paddingHorizontal: sizeStyle.paddingHorizontal },
          fullWidth && { width: "100%" },
          isDisabled && styles.disabled,
          style,
        ]}
      >
        {loading ? (
          <ActivityIndicator size="small" color={getTextColor()} />
        ) : (
          <>
            {leftIcon && <View style={styles.iconLeft}>{leftIcon}</View>}
            {typeof children === "string" ? (
              <Text
                style={[
                  styles.text,
                  { fontSize: sizeStyle.fontSize, color: getTextColor() },
                  textStyle,
                ]}
              >
                {children}
              </Text>
            ) : (
              children
            )}
            {rightIcon && <View style={styles.iconRight}>{rightIcon}</View>}
          </>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}

/**
 * GlassIconButton - Circular icon button with glass styling
 */
interface GlassIconButtonProps {
  icon: React.ReactNode;
  onPress: () => void;
  variant?: "ghost" | "primary" | "secondary";
  size?: "small" | "medium" | "large";
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  accessibilityLabel?: string;
}

export function GlassIconButton({
  icon,
  onPress,
  variant = "ghost",
  size = "medium",
  disabled = false,
  style,
  testID,
  accessibilityLabel,
}: GlassIconButtonProps) {
  const { colors } = useTheme();
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(ANIMATION.scale.pressed, SPRINGS.press);
  };

  const handlePressOut = () => {
    scale.value = withSpring(ANIMATION.scale.normal, SPRINGS.snap);
  };

  const getSizeValue = (): number => {
    switch (size) {
      case "small":
        return 40;
      case "medium":
        return 48;
      case "large":
        return 56;
      default:
        return 48;
    }
  };

  const getVariantStyle = (): ViewStyle => {
    switch (variant) {
      case "primary":
        return { backgroundColor: COLORS.orange };
      case "secondary":
        return { backgroundColor: COLORS.trustBlue };
      case "ghost":
      default:
        return {
          backgroundColor: colors.glassBg,
          borderWidth: 1.5,
          borderColor: colors.glassBorder,
        };
    }
  };

  const sizeValue = getSizeValue();

  return (
    <Animated.View style={animatedStyle}>
      <TouchableOpacity
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled}
        activeOpacity={0.9}
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        style={[
          styles.iconButton,
          getVariantStyle(),
          { width: sizeValue, height: sizeValue },
          disabled && styles.disabled,
          style,
        ]}
      >
        {icon}
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: RADIUS.md,  // 12
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    ...SHADOWS.button,
  },
  text: {
    fontWeight: FONT.bodyStrong.weight,
  },
  iconLeft: {
    marginRight: SPACE.sm,
  },
  iconRight: {
    marginLeft: SPACE.sm,
  },
  disabled: {
    opacity: 0.5,
  },
  iconButton: {
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
});
