import React, { useState } from "react";
import {
  TextInput,
  View,
  Text,
  StyleSheet,
  StyleProp,
  ViewStyle,
  TextInputProps,
  TouchableOpacity,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolateColor,
} from "react-native-reanimated";
import { COLORS, TYPOGRAPHY } from "../../styles/liquidGlass";
import { FONT, SPACE, RADIUS } from "../../styles/tokens";
import { useTheme } from "../../context/ThemeContext";

interface GlassInputProps extends TextInputProps {
  label?: string;
  error?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  onRightIconPress?: () => void;
  containerStyle?: StyleProp<ViewStyle>;
}

/**
 * GlassInput - Premium text input with glass styling
 *
 * Uses react-native-reanimated for UI-thread border color animation.
 */
export function GlassInput({
  label,
  error,
  leftIcon,
  rightIcon,
  onRightIconPress,
  containerStyle,
  ...props
}: GlassInputProps) {
  const { colors } = useTheme();
  const [isFocused, setIsFocused] = useState(false);
  const focusProgress = useSharedValue(0);

  const animatedBorderStyle = useAnimatedStyle(() => ({
    borderColor: interpolateColor(
      focusProgress.value,
      [0, 1],
      [colors.glassBorder, COLORS.input.focusBorder],
    ),
  }));

  const handleFocus = (e: any) => {
    setIsFocused(true);
    focusProgress.value = withTiming(1, { duration: 200 });
    props.onFocus?.(e);
  };

  const handleBlur = (e: any) => {
    setIsFocused(false);
    focusProgress.value = withTiming(0, { duration: 200 });
    props.onBlur?.(e);
  };

  return (
    <View style={containerStyle}>
      {label && <Text style={[styles.label, { color: colors.textPrimary }]}>{label}</Text>}
      <Animated.View
        style={[
          styles.container,
          { backgroundColor: colors.inputBg },
          animatedBorderStyle,
          error && styles.errorBorder,
        ]}
      >
        {leftIcon && <View style={styles.leftIcon}>{leftIcon}</View>}
        <TextInput
          {...props}
          style={[
            styles.input,
            { color: colors.textPrimary },
            leftIcon ? { paddingLeft: 0 } : undefined,
            rightIcon ? { paddingRight: 0 } : undefined,
            props.style,
          ]}
          placeholderTextColor={colors.textMuted}
          onFocus={handleFocus}
          onBlur={handleBlur}
        />
        {rightIcon && (
          <TouchableOpacity
            onPress={onRightIconPress}
            style={styles.rightIcon}
            disabled={!onRightIconPress}
          >
            {rightIcon}
          </TouchableOpacity>
        )}
      </Animated.View>
      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

/**
 * GlassSearchInput - Search input variant with built-in icon
 */
interface GlassSearchInputProps extends Omit<TextInputProps, "style"> {
  containerStyle?: StyleProp<ViewStyle>;
}

export function GlassSearchInput({
  containerStyle,
  ...props
}: GlassSearchInputProps) {
  const { colors } = useTheme();
  const [isFocused, setIsFocused] = useState(false);

  return (
    <View style={[
      styles.searchContainer,
      { backgroundColor: colors.inputBg, borderColor: colors.glassBorder },
      isFocused && styles.searchFocused,
      containerStyle
    ]}>
      <View style={styles.searchIcon}>
        <Text style={{ color: colors.textMuted, fontSize: 16 }}>🔍</Text>
      </View>
      <TextInput
        {...props}
        style={[styles.searchInput, { color: colors.textPrimary }]}
        placeholderTextColor={colors.textMuted}
        onFocus={(e) => {
          setIsFocused(true);
          props.onFocus?.(e);
        }}
        onBlur={(e) => {
          setIsFocused(false);
          props.onBlur?.(e);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    color: COLORS.text.primary,
    fontSize: FONT.sectionLabel.size,   // 12
    fontWeight: FONT.meta.weight,       // 500
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: SPACE.sm,
  },
  container: {
    backgroundColor: COLORS.input.bg,
    borderWidth: 1,
    borderRadius: RADIUS.md,            // 12 (was 16)
    height: 52,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: SPACE.lg,
  },
  input: {
    flex: 1,
    color: COLORS.text.primary,
    fontSize: FONT.body.size,           // 16
    height: "100%",
  },
  leftIcon: {
    marginRight: SPACE.md,
  },
  rightIcon: {
    marginLeft: SPACE.md,
    padding: SPACE.xs,
  },
  errorBorder: {
    borderColor: COLORS.status.danger,
  },
  error: {
    color: COLORS.status.danger,
    fontSize: FONT.sectionLabel.size,   // 12
    marginTop: SPACE.xs,
  },
  // Search variant
  searchContainer: {
    backgroundColor: COLORS.input.bg,
    borderWidth: 1,
    borderColor: COLORS.input.border,
    borderRadius: RADIUS.full,
    height: 44,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: SPACE.md,
  },
  searchFocused: {
    borderColor: COLORS.input.focusBorder,
  },
  searchIcon: {
    marginRight: SPACE.sm,
  },
  searchInput: {
    flex: 1,
    color: COLORS.text.primary,
    fontSize: FONT.secondary.size,      // 14
    height: "100%",
  },
});
