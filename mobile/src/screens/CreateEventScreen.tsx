import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from "react-native";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
// @ts-ignore — optional dependency, may not have types
import DateTimePicker from "@react-native-community/datetimepicker";

import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import {
  COLORS,
  TYPOGRAPHY,
  SPACING,
  RADIUS,
  ANIMATION,
} from "../styles/liquidGlass";
import { api } from "../api/client";
import {
  PageHeader,
  GlassSurface,
  GlassButton,
  GlassInput,
} from "../components/ui";
import { BottomSheetScreen } from "../components/BottomSheetScreen";
import type { RootStackParamList } from "../navigation/RootNavigator";

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, "CreateEvent">;

interface GroupItem {
  group_id: string;
  name: string;
  member_count?: number;
}

const GAME_TYPES = [
  { value: "poker", label: "Poker" },
  { value: "rummy", label: "Rummy" },
  { value: "blackjack", label: "Blackjack" },
  { value: "spades", label: "Spades" },
  { value: "hearts", label: "Hearts" },
  { value: "bridge", label: "Bridge" },
  { value: "other", label: "Other" },
];

const BUY_IN_OPTIONS = [5, 10, 20, 50, 100];

export function CreateEventScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { isDark, colors } = useTheme();
  const { user } = useAuth();

  // Wizard state
  const [step, setStep] = useState(1);
  const totalSteps = 4; // Phase 1: skip recurrence (step 3 in spec)

  // Step 1: Group selection
  const [groups, setGroups] = useState<GroupItem[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<string>(
    (route.params as any)?.groupId || ""
  );

  // Step 2: Date & Time
  const [eventDate, setEventDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  // Step 3: Game details
  const [title, setTitle] = useState("");
  const [location, setLocation] = useState("");
  const [gameCategory, setGameCategory] = useState("poker");
  const [buyIn, setBuyIn] = useState(20);

  // Step 4: Review
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 350,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        ...ANIMATION.spring.bouncy,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  // Fetch user's groups
  useEffect(() => {
    const fetchGroups = async () => {
      try {
        const response = await api.get("/groups");
        setGroups(response.data.groups || response.data || []);
      } catch (err) {
        console.error("Failed to fetch groups:", err);
      }
    };
    fetchGroups();
  }, []);

  const stepTitles = ["Which group?", "When?", "Details", "Review"];

  const canProceed = (): boolean => {
    switch (step) {
      case 1:
        return !!selectedGroup;
      case 2:
        return eventDate > new Date();
      case 3:
        return !!title.trim();
      case 4:
        return true;
      default:
        return false;
    }
  };

  const handleNext = () => {
    if (step < totalSteps) {
      setStep(step + 1);
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    } else {
      navigation.goBack();
    }
  };

  const handleSubmit = async () => {
    try {
      setSubmitting(true);
      setError(null);

      const payload = {
        group_id: selectedGroup,
        title: title.trim(),
        starts_at: eventDate.toISOString(),
        duration_minutes: 180,
        location: location.trim() || null,
        game_category: gameCategory,
        recurrence: "none",
        default_buy_in: buyIn,
        default_chips_per_buy_in: 20,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "America/New_York",
      };

      await api.post("/events", payload);
      navigation.goBack();
    } catch (err: any) {
      const msg = err.response?.data?.detail || "Failed to create event";
      setError(typeof msg === "string" ? msg : JSON.stringify(msg));
    } finally {
      setSubmitting(false);
    }
  };

  const selectedGroupName =
    groups.find((g) => g.group_id === selectedGroup)?.name || "";

  const formatDateTime = (d: Date) => {
    return d.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <View>
            <Text
              style={[styles.stepQuestion, { color: colors.textPrimary }]}
            >
              Select a group
            </Text>
            {groups.map((group) => (
              <TouchableOpacity
                key={group.group_id}
                onPress={() => setSelectedGroup(group.group_id)}
                activeOpacity={0.7}
              >
                <GlassSurface
                  style={styles.optionCard}
                  glowVariant={
                    selectedGroup === group.group_id ? "orange" : undefined
                  }
                >
                  <View style={styles.optionRow}>
                    <View
                      style={[
                        styles.radio,
                        selectedGroup === group.group_id && styles.radioSelected,
                      ]}
                    >
                      {selectedGroup === group.group_id && (
                        <View style={styles.radioInner} />
                      )}
                    </View>
                    <Text
                      style={[
                        styles.optionText,
                        { color: colors.textPrimary },
                      ]}
                    >
                      {group.name}
                    </Text>
                  </View>
                </GlassSurface>
              </TouchableOpacity>
            ))}
            {groups.length === 0 && (
              <Text style={{ color: colors.textMuted, marginTop: SPACING.md }}>
                No groups found. Create a group first.
              </Text>
            )}
          </View>
        );

      case 2:
        return (
          <View>
            <Text
              style={[styles.stepQuestion, { color: colors.textPrimary }]}
            >
              Pick a date & time
            </Text>

            <TouchableOpacity onPress={() => setShowDatePicker(true)}>
              <GlassSurface style={styles.pickerCard}>
                <Ionicons
                  name="calendar-outline"
                  size={20}
                  color={COLORS.orange}
                />
                <Text style={[styles.pickerText, { color: colors.textPrimary }]}>
                  {eventDate.toLocaleDateString("en-US", {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })}
                </Text>
              </GlassSurface>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setShowTimePicker(true)}>
              <GlassSurface style={styles.pickerCard}>
                <Ionicons
                  name="time-outline"
                  size={20}
                  color={COLORS.orange}
                />
                <Text style={[styles.pickerText, { color: colors.textPrimary }]}>
                  {eventDate.toLocaleTimeString("en-US", {
                    hour: "numeric",
                    minute: "2-digit",
                    hour12: true,
                  })}
                </Text>
              </GlassSurface>
            </TouchableOpacity>

            {(showDatePicker || showTimePicker) && (
              <DateTimePicker
                value={eventDate}
                mode={showDatePicker ? "date" : "time"}
                display="spinner"
                minimumDate={new Date()}
                onChange={(_: any, selected: Date | undefined) => {
                  setShowDatePicker(false);
                  setShowTimePicker(false);
                  if (selected) setEventDate(selected);
                }}
              />
            )}
          </View>
        );

      case 3:
        return (
          <View>
            <Text
              style={[styles.stepQuestion, { color: colors.textPrimary }]}
            >
              Game details
            </Text>

            <GlassInput
              label="Title"
              placeholder="Friday Night Poker"
              value={title}
              onChangeText={setTitle}
            />

            <View style={{ height: SPACING.md }} />

            <GlassInput
              label="Location (optional)"
              placeholder="e.g., Jake's place"
              value={location}
              onChangeText={setLocation}
            />

            <View style={{ height: SPACING.lg }} />

            <Text
              style={[styles.fieldLabel, { color: colors.textSecondary }]}
            >
              Game type
            </Text>
            <View style={styles.chipRow}>
              {GAME_TYPES.map((gt) => (
                <TouchableOpacity
                  key={gt.value}
                  onPress={() => setGameCategory(gt.value)}
                  style={[
                    styles.chip,
                    gameCategory === gt.value && {
                      backgroundColor: COLORS.orange,
                    },
                    gameCategory !== gt.value && {
                      backgroundColor: colors.glassBg,
                      borderWidth: 1,
                      borderColor: colors.glassBorder,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.chipText,
                      {
                        color:
                          gameCategory === gt.value
                            ? "#fff"
                            : colors.textPrimary,
                      },
                    ]}
                  >
                    {gt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={{ height: SPACING.lg }} />

            <Text
              style={[styles.fieldLabel, { color: colors.textSecondary }]}
            >
              Buy-in
            </Text>
            <View style={styles.chipRow}>
              {BUY_IN_OPTIONS.map((amount) => (
                <TouchableOpacity
                  key={amount}
                  onPress={() => setBuyIn(amount)}
                  style={[
                    styles.chip,
                    buyIn === amount && { backgroundColor: COLORS.orange },
                    buyIn !== amount && {
                      backgroundColor: colors.glassBg,
                      borderWidth: 1,
                      borderColor: colors.glassBorder,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.chipText,
                      {
                        color:
                          buyIn === amount ? "#fff" : colors.textPrimary,
                      },
                    ]}
                  >
                    ${amount}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        );

      case 4:
        return (
          <View>
            <Text
              style={[styles.stepQuestion, { color: colors.textPrimary }]}
            >
              Review & schedule
            </Text>

            <GlassSurface style={styles.reviewCard} glowVariant="orange">
              <View style={styles.reviewRow}>
                <Ionicons
                  name="game-controller-outline"
                  size={18}
                  color={COLORS.orange}
                />
                <Text
                  style={[styles.reviewLabel, { color: colors.textPrimary }]}
                >
                  {title || "Untitled Game"}
                </Text>
              </View>
              <View style={styles.reviewRow}>
                <Ionicons
                  name="calendar-outline"
                  size={18}
                  color={COLORS.orange}
                />
                <Text
                  style={[styles.reviewValue, { color: colors.textSecondary }]}
                >
                  {formatDateTime(eventDate)}
                </Text>
              </View>
              {location ? (
                <View style={styles.reviewRow}>
                  <Ionicons
                    name="location-outline"
                    size={18}
                    color={COLORS.orange}
                  />
                  <Text
                    style={[
                      styles.reviewValue,
                      { color: colors.textSecondary },
                    ]}
                  >
                    {location}
                  </Text>
                </View>
              ) : null}
              <View style={styles.reviewRow}>
                <Ionicons
                  name="cash-outline"
                  size={18}
                  color={COLORS.orange}
                />
                <Text
                  style={[styles.reviewValue, { color: colors.textSecondary }]}
                >
                  ${buyIn} buy-in
                </Text>
              </View>
              <View style={styles.reviewRow}>
                <Ionicons
                  name="people-outline"
                  size={18}
                  color={COLORS.orange}
                />
                <Text
                  style={[styles.reviewValue, { color: colors.textSecondary }]}
                >
                  {selectedGroupName} (all members)
                </Text>
              </View>
            </GlassSurface>

            {error && (
              <GlassSurface glowVariant="red" style={{ marginTop: SPACING.md }}>
                <Text style={{ color: COLORS.status.danger }}>{error}</Text>
              </GlassSurface>
            )}
          </View>
        );
    }
  };

  return (
    <BottomSheetScreen>
      <View style={[styles.container, { backgroundColor: colors.contentBg }]}>
        <Animated.View
          style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}
        >
          <PageHeader
            title={stepTitles[step - 1]}
            subtitle={`Step ${step} of ${totalSteps}`}
            onClose={() => navigation.goBack()}
          />
        </Animated.View>

        {/* Step indicator */}
        <View style={styles.stepIndicator}>
          {Array.from({ length: totalSteps }).map((_, i) => (
            <View
              key={i}
              style={[
                styles.stepDot,
                {
                  backgroundColor:
                    i < step ? COLORS.orange : colors.glassBorder,
                },
              ]}
            />
          ))}
        </View>

        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1 }}
        >
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <Animated.View
              style={{
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }],
              }}
            >
              {renderStep()}
              <View style={{ height: 100 }} />
            </Animated.View>
          </ScrollView>
        </KeyboardAvoidingView>

        {/* Navigation buttons */}
        <View
          style={[
            styles.buttonRow,
            { paddingBottom: Math.max(20, 0) },
          ]}
        >
          {step > 1 && (
            <GlassButton
              onPress={handleBack}
              variant="secondary"
              size="medium"
              style={{ flex: 1, marginRight: SPACING.sm }}
            >
              Back
            </GlassButton>
          )}
          {step < totalSteps ? (
            <GlassButton
              onPress={handleNext}
              variant="primary"
              size="medium"
              disabled={!canProceed()}
              style={{ flex: step > 1 ? 1 : undefined }}
              fullWidth={step === 1}
            >
              Next
            </GlassButton>
          ) : (
            <GlassButton
              onPress={handleSubmit}
              variant="primary"
              size="large"
              loading={submitting}
              disabled={submitting}
              fullWidth
            >
              Schedule & Invite
            </GlassButton>
          )}
        </View>
      </View>
    </BottomSheetScreen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  stepIndicator: {
    flexDirection: "row",
    justifyContent: "center",
    gap: SPACING.sm,
    paddingVertical: SPACING.md,
  },
  stepDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  scroll: { flex: 1 },
  scrollContent: {
    padding: SPACING.container,
  },
  stepQuestion: {
    fontSize: TYPOGRAPHY.sizes.heading2,
    fontWeight: TYPOGRAPHY.weights.bold,
    marginBottom: SPACING.xl,
  },
  optionCard: {
    marginBottom: SPACING.sm,
  },
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: COLORS.text.muted,
    alignItems: "center",
    justifyContent: "center",
  },
  radioSelected: {
    borderColor: COLORS.orange,
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: COLORS.orange,
  },
  optionText: {
    fontSize: TYPOGRAPHY.sizes.body,
    fontWeight: TYPOGRAPHY.weights.medium,
  },
  pickerCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
    marginBottom: SPACING.md,
  },
  pickerText: {
    fontSize: TYPOGRAPHY.sizes.body,
  },
  fieldLabel: {
    fontSize: TYPOGRAPHY.sizes.bodySmall,
    fontWeight: TYPOGRAPHY.weights.medium,
    marginBottom: SPACING.sm,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.sm,
  },
  chip: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.full,
  },
  chipText: {
    fontSize: TYPOGRAPHY.sizes.bodySmall,
    fontWeight: TYPOGRAPHY.weights.medium,
  },
  reviewCard: {
    marginBottom: SPACING.md,
  },
  reviewRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
    marginBottom: SPACING.sm,
  },
  reviewLabel: {
    fontSize: TYPOGRAPHY.sizes.body,
    fontWeight: TYPOGRAPHY.weights.semiBold,
  },
  reviewValue: {
    fontSize: TYPOGRAPHY.sizes.bodySmall,
  },
  buttonRow: {
    flexDirection: "row",
    paddingHorizontal: SPACING.container,
    paddingTop: SPACING.md,
  },
});

export default CreateEventScreen;
