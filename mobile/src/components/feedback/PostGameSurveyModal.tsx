import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../context/ThemeContext";
import { useHaptics } from "../../context/HapticsContext";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../api/client";
import { GlassModal } from "../ui/GlassModal";
import { GlassButton } from "../ui/GlassButton";
import { GlassInput } from "../ui/GlassInput";
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from "../../styles/liquidGlass";

interface PostGameSurveyModalProps {
  visible: boolean;
  onClose: () => void;
  gameId: string;
  groupId?: string;
}

const MOOD_OPTIONS = [
  { value: 1, emoji: "😤", label: "Rough" },
  { value: 2, emoji: "😕", label: "Meh" },
  { value: 3, emoji: "😊", label: "Good" },
  { value: 4, emoji: "🔥", label: "Great" },
  { value: 5, emoji: "🤑", label: "Amazing" },
];

/**
 * PostGameSurveyModal - Shown after a game ends to collect player feedback.
 *
 * Flow:
 * 1. Tap a mood option (emoji cards)
 * 2. Optional comment text input for details
 * 3. Submit -> POST /feedback/survey
 * 4. Confirmation screen with contextual message
 */
export function PostGameSurveyModal({
  visible,
  onClose,
  gameId,
  groupId,
}: PostGameSurveyModalProps) {
  const { colors } = useTheme();
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
      setError("Tap a mood to rate your game");
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

  // Confirmation screen
  if (submitted) {
    return (
      <GlassModal visible={visible} onClose={handleClose} size="small">
        <View style={styles.confirmContainer}>
          <View style={[styles.confirmIcon, { backgroundColor: COLORS.glass.glowGreen }]}>
            <Ionicons name="checkmark-circle" size={56} color={COLORS.status.success} />
          </View>
          <Text style={[styles.confirmTitle, { color: colors.textPrimary }]}>
            {rating <= 2 ? "We hear you" : "Thanks for the feedback!"}
          </Text>
          <Text style={[styles.confirmMessage, { color: colors.textSecondary }]}>
            {rating <= 2
              ? "Sorry it didn't go smoothly. We'll look into it."
              : rating === 3
              ? "Thanks for the honest take. We're always improving."
              : "Glad you had a good time!"}
          </Text>
          {comment.trim() ? (
            <View style={[styles.confirmCommentBox, { borderColor: colors.textMuted + "30" }]}>
              <Ionicons name="chatbubble-outline" size={14} color={colors.textMuted} />
              <Text style={[styles.confirmCommentText, { color: colors.textMuted }]} numberOfLines={2}>
                "{comment.trim()}"
              </Text>
            </View>
          ) : null}
          <GlassButton variant="primary" onPress={handleClose} fullWidth>
            Done
          </GlassButton>
        </View>
      </GlassModal>
    );
  }

  return (
    <GlassModal
      visible={visible}
      onClose={handleClose}
      title="How was your game?"
      subtitle="Tap to rate your experience"
      size="medium"
      avoidKeyboard
    >
      <View style={styles.content}>
        {/* Mood Selection */}
        <View style={styles.moodRow}>
          {MOOD_OPTIONS.map((mood) => {
            const isSelected = rating === mood.value;
            return (
              <TouchableOpacity
                key={mood.value}
                onPress={() => handleSelectMood(mood.value)}
                activeOpacity={0.7}
                style={[
                  styles.moodCard,
                  {
                    backgroundColor: isSelected
                      ? COLORS.orange + "20"
                      : colors.textMuted + "10",
                    borderColor: isSelected
                      ? COLORS.orange
                      : colors.textMuted + "20",
                  },
                ]}
              >
                <Text style={styles.moodEmoji}>{mood.emoji}</Text>
                <Text
                  style={[
                    styles.moodLabel,
                    {
                      color: isSelected ? COLORS.orange : colors.textSecondary,
                      fontWeight: isSelected ? "700" : "500",
                    },
                  ]}
                >
                  {mood.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Comment Box */}
        <GlassInput
          label="DETAILS (OPTIONAL)"
          placeholder={
            rating <= 2 && rating > 0
              ? "What went wrong? We want to fix it..."
              : "Any thoughts, highlights, or suggestions..."
          }
          value={comment}
          onChangeText={setComment}
          multiline
          numberOfLines={3}
          style={styles.commentInput}
          containerStyle={styles.commentContainer}
        />

        {/* Error */}
        {error ? (
          <View style={[styles.errorBox, { backgroundColor: COLORS.glass.glowRed }]}>
            <Ionicons name="alert-circle" size={16} color={COLORS.status.danger} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {/* Submit */}
        <GlassButton
          variant="primary"
          size="large"
          fullWidth
          onPress={handleSubmit}
          loading={isSubmitting}
          disabled={rating === 0}
        >
          Submit Feedback
        </GlassButton>

        {/* Skip */}
        <GlassButton
          variant="ghost"
          size="small"
          onPress={handleClose}
          style={styles.skipButton}
        >
          Skip for now
        </GlassButton>
      </View>
    </GlassModal>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: SPACING.sm,
  },
  moodRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  moodCard: {
    flex: 1,
    alignItems: "center",
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xs,
    borderRadius: RADIUS.lg,
    borderWidth: 1.5,
  },
  moodEmoji: {
    fontSize: 28,
    marginBottom: SPACING.xs,
  },
  moodLabel: {
    fontSize: TYPOGRAPHY.sizes.caption,
    textAlign: "center",
  },
  commentContainer: {
    marginBottom: SPACING.lg,
  },
  commentInput: {
    height: 80,
    textAlignVertical: "top",
    paddingTop: SPACING.md,
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    marginBottom: SPACING.lg,
  },
  errorText: {
    color: COLORS.status.danger,
    fontSize: TYPOGRAPHY.sizes.caption,
    flex: 1,
  },
  skipButton: {
    alignSelf: "center",
    marginTop: SPACING.md,
  },
  // Confirmation screen
  confirmContainer: {
    alignItems: "center",
    paddingVertical: SPACING.xl,
    gap: SPACING.md,
  },
  confirmIcon: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: SPACING.sm,
  },
  confirmTitle: {
    fontSize: TYPOGRAPHY.sizes.heading3,
    fontWeight: "700",
    textAlign: "center",
  },
  confirmMessage: {
    fontSize: TYPOGRAPHY.sizes.bodySmall,
    textAlign: "center",
    paddingHorizontal: SPACING.lg,
    lineHeight: 20,
  },
  confirmCommentBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    marginTop: SPACING.xs,
    width: "100%",
  },
  confirmCommentText: {
    fontSize: TYPOGRAPHY.sizes.caption,
    fontStyle: "italic",
    flex: 1,
  },
});
