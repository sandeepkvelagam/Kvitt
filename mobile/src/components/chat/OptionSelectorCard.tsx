import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { GlassSurface } from "../ui/GlassSurface";
import { Subhead, Footnote } from "../ui";
import { SPRINGS, ANIMATION } from "../../styles/liquidGlass";
import { useTheme } from "../../context/ThemeContext";
import { FONT, SPACE, RADIUS } from "../../styles/tokens";
import type { OptionSelectorPayload, OptionItem } from "./messageTypes";

interface OptionSelectorCardProps {
  payload: OptionSelectorPayload;
  isLatest: boolean;
  onSelect: (value: string) => void;
  selectedValue?: string;
}

function OptionRow({
  option,
  isInteractive,
  isSelected,
  isDimmed,
  onPress,
}: {
  option: OptionItem;
  isInteractive: boolean;
  isSelected: boolean;
  isDimmed: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={animStyle}>
      <TouchableOpacity
        onPress={onPress}
        onPressIn={() => { scale.value = withSpring(ANIMATION.scale.pressed, SPRINGS.press); }}
        onPressOut={() => { scale.value = withSpring(ANIMATION.scale.normal, SPRINGS.snap); }}
        disabled={!isInteractive}
        activeOpacity={0.8}
        style={[
          styles.optionRow,
          {
            backgroundColor: isSelected ? `${colors.orange}28` : colors.inputBg,
            borderColor: isSelected ? `${colors.orange}99` : colors.border,
            opacity: isDimmed ? 0.4 : 1,
          },
        ]}
      >
        {option.icon && (
          <Ionicons
            name={option.icon as any}
            size={20}
            color={isSelected ? colors.orange : colors.textSecondary}
            style={styles.optionIcon}
          />
        )}
        <View style={styles.optionText}>
          <Text
            style={[
              styles.optionLabel,
              { color: isSelected ? colors.orange : colors.textPrimary },
            ]}
          >
            {option.label}
          </Text>
          {option.description && (
            <Footnote style={{ marginTop: 2, color: colors.textMuted }}>{option.description}</Footnote>
          )}
        </View>
        {isSelected && (
          <Ionicons name="checkmark-circle" size={20} color={colors.orange} />
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}

export function OptionSelectorCard({
  payload,
  isLatest,
  onSelect,
  selectedValue,
}: OptionSelectorCardProps) {
  const { colors } = useTheme();
  const isInteractive = isLatest && !selectedValue;

  return (
    <GlassSurface style={styles.card} blur={false}>
      <Subhead bold style={{ marginBottom: SPACE.md, color: colors.textPrimary }}>
        {payload.prompt}
      </Subhead>
      <View style={styles.optionsList}>
        {payload.options.map((option) => (
          <OptionRow
            key={option.value}
            option={option}
            isInteractive={isInteractive}
            isSelected={selectedValue === option.value}
            isDimmed={!!selectedValue && selectedValue !== option.value}
            onPress={() => onSelect(option.value)}
          />
        ))}
      </View>
    </GlassSurface>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: RADIUS.lg,
  },
  optionsList: {
    gap: SPACE.sm,
  },
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: SPACE.md,
    paddingHorizontal: SPACE.lg,
    borderRadius: RADIUS.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  optionIcon: {
    marginRight: SPACE.md,
  },
  optionText: {
    flex: 1,
  },
  optionLabel: {
    fontSize: FONT.secondary.size,
    fontWeight: "600",
  },
});
