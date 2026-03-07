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

type IoniconsName = React.ComponentProps<typeof Ionicons>["name"];

const MOOD_OPTIONS: { value: number; icon: IoniconsName; label: string }[] = [
  { value: 1, icon: "sad",             label: "Very Bad" },
  { value: 2, icon: "sad-outline",     label: "Poor" },
  { value: 3, icon: "remove-circle-outline", label: "Medium" },
  { value: 4, icon: "happy-outline",   label: "Good" },
  { value: 5, icon: "happy",           label: "Excellent" },
];

/**
 * PostGameSurveyModal - Post-game feedback with face rating icons,
 * comment box, and confirmation screen.
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
      setError("Please select a rating");
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
    const selectedMood = MOOD_OPTIONS.find((m) => m.value === rating);
    return (
      <GlassModal visible={visible} onClose={handleClose} size="small">
        <View style={styles.confirmContainer}>
          <View style={[styles.confirmIconWrap, { backgroundColor: COLORS.glass.glowGreen }]}>
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
          {selectedMood && (
            <View style={styles.confirmRatingRow}>
              <Ionicons name={selectedMood.icon} size={22} color={COLORS.orange} />
              <Text style={[styles.confirmRatingText, { color: colors.textSecondary }]}>
                You rated: {selectedMood.label}
              </Text>
            </View>
          )}
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
      size="medium"
      avoidKeyboard
      showCloseButton={false}
    >
      <View style={styles.content}>
        {/* Title centered */}
        <Text style={[styles.title, { color: colors.textPrimary }]}>
          Your Feedback
        </Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          How would you rate your game experience?
        </Text>

        {/* Face Icons Row */}
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
                        ? COLORS.orange + "18"
                        : "transparent",
                      borderColor: isSelected
                        ? COLORS.orange
                        : colors.textMuted + "40",
                    },
                  ]}
                >
                  <Ionicons
                    name={mood.icon}
                    size={32}
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

        {/* Actions */}
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
    alignItems: "center",
  },
  title: {
    fontSize: TYPOGRAPHY.sizes.heading2,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: SPACING.xs,
  },
  subtitle: {
    fontSize: TYPOGRAPHY.sizes.bodySmall,
    textAlign: "center",
    marginBottom: SPACING.xl,
  },
  // Face icons row
  facesRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    marginBottom: SPACING.xl,
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
    marginBottom: SPACING.xs,
  },
  faceLabel: {
    fontSize: 11,
    textAlign: "center",
  },
  // Comment
  commentContainer: {
    marginBottom: SPACING.lg,
    width: "100%",
  },
  commentInput: {
    height: 80,
    textAlignVertical: "top",
    paddingTop: SPACING.md,
  },
  // Error
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    marginBottom: SPACING.lg,
    width: "100%",
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
  confirmIconWrap: {
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
  confirmRatingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    marginTop: SPACING.xs,
  },
  confirmRatingText: {
    fontSize: TYPOGRAPHY.sizes.bodySmall,
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
