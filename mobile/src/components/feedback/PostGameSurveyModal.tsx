import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import Animated, { FadeInDown, FadeIn } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../context/ThemeContext";
import { useHaptics } from "../../context/HapticsContext";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../api/client";
import { GlassModal } from "../ui/GlassModal";
import { GlassButton } from "../ui/GlassButton";
import { GlassInput } from "../ui/GlassInput";
import { GlassSurface } from "../ui/GlassSurface";
import { COLORS } from "../../styles/liquidGlass";
import { FONT, SPACE, LAYOUT, RADIUS } from "../../styles/tokens";

interface PostGameSurveyModalProps {
  visible: boolean;
  onClose: () => void;
  gameId: string;
  groupId?: string;
}

type IoniconsName = React.ComponentProps<typeof Ionicons>["name"];

const MOOD_OPTIONS: { value: number; icon: IoniconsName; label: string }[] = [
  { value: 1, icon: "sad",                   label: "Rough" },
  { value: 2, icon: "sad-outline",           label: "Meh" },
  { value: 3, icon: "remove-circle-outline", label: "Okay" },
  { value: 4, icon: "happy-outline",         label: "Great" },
  { value: 5, icon: "happy",                 label: "Loved It" },
];

/**
 * PostGameSurveyModal — Post-game feedback with face rating icons,
 * optional comment box, and animated confirmation screen.
 */
export function PostGameSurveyModal({
  visible,
  onClose,
  gameId,
  groupId,
}: PostGameSurveyModalProps) {
  const { colors, isDark } = useTheme();
  const { triggerHaptic } = useHaptics();
  const { user } = useAuth();

  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const handleSelectMood = (value: number) => {
    triggerHaptic("light");
    setRating(value);
    setError("");
  };

  const handleSubmit = async () => {
    if (rating === 0) {
      setError("Tap a face to rate your experience");
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      await api.post("/feedback/survey", {
        game_id: gameId,
        group_id: groupId,
        rating,
        comment: comment.trim(),
      });

      triggerHaptic("medium");
      setSubmitted(true);
    } catch (err: any) {
      const msg = err?.response?.data?.detail || "Failed to submit. Please try again.";
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setRating(0);
    setComment("");
    setSubmitted(false);
    setError("");
    onClose();
  };

  // ── Confirmation screen ─────────────────────────────────────
  if (submitted) {
    const selectedMood = MOOD_OPTIONS.find((m) => m.value === rating);
    return (
      <GlassModal visible={visible} onClose={handleClose} size="small">
        <View style={styles.confirmContainer}>
          <Animated.View entering={FadeIn.delay(100).springify()}>
            <View style={[styles.confirmIconWrap, { backgroundColor: COLORS.glass.glowGreen }]}>
              <Ionicons name="checkmark-circle" size={56} color={COLORS.status.success} />
            </View>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(250).springify().damping(12)}>
            <Text style={[styles.confirmTitle, { color: colors.textPrimary }]}>
              {rating <= 2 ? "We Hear You" : "Thanks for Sharing!"}
            </Text>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(400).springify().damping(12)}>
            <Text style={[styles.confirmMessage, { color: colors.textSecondary }]}>
              {rating <= 2
                ? "Sorry it wasn't great — we'll work on making it better."
                : rating === 3
                ? "Appreciate the honest take. We're always refining things."
                : "Glad you had a great time! See you next round."}
            </Text>
          </Animated.View>

          {selectedMood && (
            <Animated.View entering={FadeInDown.delay(550).springify().damping(12)}>
              <View style={[styles.confirmRatingRow, { backgroundColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)", borderColor: colors.glassBorder }]}>
                <Ionicons name={selectedMood.icon} size={22} color={COLORS.orange} />
                <Text style={[styles.confirmRatingText, { color: colors.textSecondary }]}>
                  Your rating: {selectedMood.label}
                </Text>
              </View>
            </Animated.View>
          )}

          {comment.trim() ? (
            <Animated.View entering={FadeInDown.delay(650).springify().damping(12)} style={{ width: "100%" }}>
              <View style={[styles.confirmCommentBox, { borderColor: colors.glassBorder, backgroundColor: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)" }]}>
                <Ionicons name="chatbubble-outline" size={14} color={colors.textMuted} />
                <Text style={[styles.confirmCommentText, { color: colors.textMuted }]} numberOfLines={2}>
                  "{comment.trim()}"
                </Text>
              </View>
            </Animated.View>
          ) : null}

          <Animated.View entering={FadeInDown.delay(750).springify().damping(12)} style={{ width: "100%" }}>
            <GlassButton variant="primary" onPress={handleClose} fullWidth>
              Close
            </GlassButton>
          </Animated.View>
        </View>
      </GlassModal>
    );
  }

  // ── Survey form ─────────────────────────────────────────────
  return (
    <GlassModal
      visible={visible}
      onClose={handleClose}
      size="medium"
      avoidKeyboard
      showCloseButton={false}
    >
      <View style={styles.content}>
        {/* Header */}
        <Animated.View entering={FadeInDown.delay(100).springify().damping(14)}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>
            How Was the Game?
          </Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Your feedback helps us make every game night better.
          </Text>
        </Animated.View>

        {/* Card A: Mood Rating */}
        <Animated.View entering={FadeInDown.delay(200).springify().damping(14)}>
          <GlassSurface noPadding style={styles.sectionCard}>
            <View style={styles.sectionInner}>
              <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>
                HOW DID IT FEEL?
              </Text>
              <View style={styles.facesRow}>
                {MOOD_OPTIONS.map((mood) => {
                  const isSelected = rating === mood.value;
                  return (
                    <TouchableOpacity
                      key={mood.value}
                      onPress={() => handleSelectMood(mood.value)}
                      activeOpacity={0.7}
                      style={styles.faceItem}
                    >
                      <View
                        style={[
                          styles.faceCircle,
                          {
                            backgroundColor: isSelected
                              ? COLORS.orange + "20"
                              : isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)",
                            borderColor: isSelected
                              ? COLORS.orange
                              : isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.10)",
                          },
                        ]}
                      >
                        <Ionicons
                          name={mood.icon}
                          size={28}
                          color={isSelected ? COLORS.orange : colors.textMuted}
                        />
                      </View>
                      <Text
                        style={[
                          styles.faceLabel,
                          {
                            color: isSelected ? COLORS.orange : colors.textMuted,
                            fontWeight: isSelected ? "600" : "400",
                          },
                        ]}
                      >
                        {mood.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </GlassSurface>
        </Animated.View>

        {/* Card B: Comment Box */}
        <Animated.View entering={FadeInDown.delay(300).springify().damping(14)}>
          <GlassSurface noPadding style={styles.sectionCard}>
            <View style={styles.sectionInner}>
              <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>
                ANYTHING ELSE? (OPTIONAL)
              </Text>
              <Text style={[styles.helperText, { color: colors.textMuted }]}>
                {rating <= 2 && rating > 0
                  ? "Tell us what could have gone better."
                  : "Highlights, suggestions, or anything on your mind."}
              </Text>
              <GlassInput
                placeholder={
                  rating <= 2 && rating > 0
                    ? "It felt off because..."
                    : "Best part was..."
                }
                value={comment}
                onChangeText={setComment}
                multiline
                numberOfLines={3}
                style={styles.commentInput}
                containerStyle={styles.commentContainer}
              />
            </View>
          </GlassSurface>
        </Animated.View>

        {/* Error */}
        {error ? (
          <Animated.View entering={FadeInDown.springify().damping(14)} style={{ width: "100%" }}>
            <View style={[styles.errorBox, { backgroundColor: COLORS.glass.glowRed }]}>
              <Ionicons name="alert-circle" size={16} color={COLORS.status.danger} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          </Animated.View>
        ) : null}

        {/* Actions */}
        <Animated.View entering={FadeInDown.delay(400).springify().damping(14)} style={{ width: "100%" }}>
          <GlassButton
            variant="primary"
            size="large"
            fullWidth
            onPress={handleSubmit}
            loading={isSubmitting}
            disabled={rating === 0}
          >
            Send Feedback
          </GlassButton>

          <GlassButton
            variant="ghost"
            size="small"
            onPress={handleClose}
            style={styles.skipButton}
          >
            Maybe Later
          </GlassButton>
        </Animated.View>
      </View>
    </GlassModal>
  );
}

const styles = StyleSheet.create({
  // ── Survey form ─────────────────────────────────
  content: {
    alignItems: "center",
    gap: SPACE.lg,
  },
  title: {
    fontSize: FONT.screenTitle.size,
    fontWeight: FONT.screenTitle.weight,
    textAlign: "center",
    marginBottom: SPACE.xs,
  },
  subtitle: {
    fontSize: FONT.secondary.size,
    textAlign: "center",
    lineHeight: 20,
  },

  // Section cards (matches FeedbackScreen pattern)
  sectionCard: {
    width: "100%",
  },
  sectionInner: {
    padding: LAYOUT.cardPadding,
  },
  sectionLabel: {
    fontSize: FONT.sectionLabel.size,
    fontWeight: FONT.sectionLabel.weight,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: SPACE.md,
  },
  helperText: {
    fontSize: FONT.sectionLabel.size,
    lineHeight: 18,
    marginBottom: SPACE.md,
  },

  // Face icons
  facesRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
  },
  faceItem: {
    alignItems: "center",
    flex: 1,
  },
  faceCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: SPACE.xs,
  },
  faceLabel: {
    fontSize: FONT.micro.size,
    textAlign: "center",
  },

  // Comment
  commentContainer: {
    width: "100%",
  },
  commentInput: {
    height: 80,
    textAlignVertical: "top",
    paddingTop: SPACE.sm,
  },

  // Error
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.sm,
    padding: SPACE.md,
    borderRadius: RADIUS.md,
    width: "100%",
  },
  errorText: {
    color: COLORS.status.danger,
    fontSize: FONT.sectionLabel.size,
    flex: 1,
  },

  // Actions
  skipButton: {
    alignSelf: "center",
    marginTop: SPACE.sm,
  },

  // ── Confirmation screen ─────────────────────────
  confirmContainer: {
    alignItems: "center",
    paddingVertical: SPACE.xl,
    gap: SPACE.lg,
  },
  confirmIconWrap: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  confirmTitle: {
    fontSize: FONT.navTitle.size,
    fontWeight: FONT.navTitle.weight,
    textAlign: "center",
  },
  confirmMessage: {
    fontSize: FONT.secondary.size,
    textAlign: "center",
    paddingHorizontal: SPACE.lg,
    lineHeight: 22,
  },
  confirmRatingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.sm,
    paddingHorizontal: SPACE.lg,
    paddingVertical: SPACE.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
  },
  confirmRatingText: {
    fontSize: FONT.secondary.size,
    fontWeight: "500",
  },
  confirmCommentBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.sm,
    paddingHorizontal: SPACE.md,
    paddingVertical: SPACE.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    width: "100%",
  },
  confirmCommentText: {
    fontSize: FONT.sectionLabel.size,
    fontStyle: "italic",
    flex: 1,
  },
});
