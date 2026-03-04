import React, { useRef, useEffect, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  AccessibilityRole,
} from "react-native";
import { useTheme } from "../context/ThemeContext";
import {
  COLORS,
  TYPOGRAPHY,
  RADIUS,
  SPACING,
  SCHEDULE_STYLES,
} from "../styles/liquidGlass";

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

interface DateStripProps {
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  /** Set of ISO date strings (YYYY-MM-DD) that have events */
  eventDates?: Set<string>;
  /** Number of weeks to show (default: 4) */
  weeks?: number;
}

function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function DateStrip({
  selectedDate,
  onSelectDate,
  eventDates = new Set(),
  weeks = 4,
}: DateStripProps) {
  const { isDark, colors } = useTheme();
  const flatListRef = useRef<FlatList>(null);

  // Generate dates: from start of current week to N weeks ahead
  const dates = useMemo(() => {
    const today = new Date();
    // Find Monday of current week
    const dayOfWeek = today.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(today);
    monday.setDate(today.getDate() + mondayOffset);
    monday.setHours(0, 0, 0, 0);

    const result: Date[] = [];
    for (let i = 0; i < weeks * 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      result.push(d);
    }
    return result;
  }, [weeks]);

  // Scroll to selected date on mount
  useEffect(() => {
    const idx = dates.findIndex((d) => isSameDay(d, selectedDate));
    if (idx >= 0 && flatListRef.current) {
      setTimeout(() => {
        flatListRef.current?.scrollToIndex({
          index: Math.max(0, idx - 2),
          animated: true,
        });
      }, 100);
    }
  }, [selectedDate, dates]);

  const today = new Date();

  const renderDay = ({ item: date }: { item: Date }) => {
    const isSelected = isSameDay(date, selectedDate);
    const isToday = isSameDay(date, today);
    const dateStr = toISODate(date);
    const hasEvent = eventDates.has(dateStr);
    const dayLabel = DAY_LABELS[date.getDay() === 0 ? 6 : date.getDay() - 1];

    const dayName = date.toLocaleDateString("en-US", { weekday: "long" });
    const fullDate = date.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
    });

    return (
      <TouchableOpacity
        onPress={() => onSelectDate(date)}
        style={[
          styles.dayCell,
          isSelected && {
            backgroundColor: COLORS.orange,
            borderRadius: RADIUS.md,
          },
          isToday &&
            !isSelected && {
              borderWidth: 1,
              borderColor: COLORS.orange,
              borderRadius: RADIUS.md,
            },
        ]}
        accessibilityRole={"button" as AccessibilityRole}
        accessibilityLabel={`${fullDate}${hasEvent ? ", has events" : ""}`}
        accessibilityState={{ selected: isSelected }}
      >
        <Text
          style={[
            styles.dayText,
            { color: isSelected ? "#fff" : colors.textMuted },
          ]}
        >
          {dayLabel}
        </Text>
        <Text
          style={[
            styles.dateText,
            {
              color: isSelected ? "#fff" : colors.textPrimary,
            },
          ]}
        >
          {date.getDate()}
        </Text>
        {hasEvent && (
          <View
            style={[
              styles.eventDot,
              isSelected && { backgroundColor: "#fff" },
            ]}
          />
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View accessibilityRole={"list" as AccessibilityRole}>
      <FlatList
        ref={flatListRef}
        data={dates}
        renderItem={renderDay}
        keyExtractor={(item) => toISODate(item)}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        getItemLayout={(_, index) => ({
          length: 52,
          offset: 52 * index,
          index,
        })}
        onScrollToIndexFailed={() => {}}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  listContent: {
    paddingHorizontal: SPACING.container,
    gap: SPACING.sm,
  },
  dayCell: {
    ...SCHEDULE_STYLES.dateStrip.dayCell,
    paddingVertical: SPACING.sm,
  },
  dayText: {
    ...SCHEDULE_STYLES.dateStrip.dayText,
  },
  dateText: {
    ...SCHEDULE_STYLES.dateStrip.dateText,
  },
  eventDot: {
    ...SCHEDULE_STYLES.dateStrip.eventDot,
  },
});

export default DateStrip;
