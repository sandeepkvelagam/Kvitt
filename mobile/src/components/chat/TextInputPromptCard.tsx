import React, { useState } from "react";
import { View, Text, TextInput, StyleSheet } from "react-native";
import { GlassSurface } from "../ui/GlassSurface";
import { GlassButton } from "../ui/GlassButton";
import { Subhead, Footnote } from "../ui";
import { useTheme } from "../../context/ThemeContext";
import { FONT, SPACE, RADIUS } from "../../styles/tokens";
import type { TextInputPromptPayload } from "./messageTypes";

interface TextInputPromptCardProps {
  payload: TextInputPromptPayload;
  isLatest: boolean;
  onSubmit: (text: string) => void;
  submittedText?: string;
}

// Simple check for common PII patterns
const PII_PATTERN = /(\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b|\b\d{3}[-.]?\d{3}[-.]?\d{4}\b)/;

export function TextInputPromptCard({
  payload,
  isLatest,
  onSubmit,
  submittedText,
}: TextInputPromptCardProps) {
  const { colors } = useTheme();
  const [text, setText] = useState("");
  const minLen = payload.min_length || 0;
  const maxLen = payload.max_length || 1000;
  const isEditable = isLatest && !submittedText;
  const hasPII = PII_PATTERN.test(text);
  const canSubmit = text.length >= minLen && text.length <= maxLen;

  if (!isEditable) {
    return (
      <GlassSurface style={styles.card} blur={false}>
        <Subhead bold style={{ marginBottom: SPACE.md, color: colors.textPrimary }}>
          {payload.prompt}
        </Subhead>
        <View
          style={[
            styles.readOnlyBox,
            { backgroundColor: colors.inputBg, borderColor: colors.border },
          ]}
        >
          <Text style={[styles.readOnlyText, { color: colors.textSecondary }]}>
            {submittedText || "..."}
          </Text>
        </View>
      </GlassSurface>
    );
  }

  return (
    <GlassSurface style={styles.card} blur={false}>
      <Subhead bold style={{ marginBottom: SPACE.md, color: colors.textPrimary }}>
        {payload.prompt}
      </Subhead>

      <TextInput
        style={[
          styles.input,
          {
            color: colors.textPrimary,
            backgroundColor: colors.inputBg,
            borderColor: text.length > 0 ? `${colors.orange}99` : colors.border,
          },
        ]}
        value={text}
        onChangeText={setText}
        placeholder={payload.placeholder || "Type here..."}
        placeholderTextColor={colors.textMuted}
        multiline
        maxLength={maxLen}
        textAlignVertical="top"
      />

      <View style={styles.metaRow}>
        <Footnote
          style={{
            color: text.length < minLen ? colors.warning : colors.textMuted,
          }}
        >
          {text.length}/{maxLen}
          {text.length < minLen ? ` (min ${minLen})` : ""}
        </Footnote>
        {hasPII && (
          <Footnote style={{ fontWeight: "500", color: colors.warning }}>
            Avoid sharing personal info
          </Footnote>
        )}
      </View>

      <GlassButton
        onPress={() => onSubmit(text)}
        variant="primary"
        size="medium"
        disabled={!canSubmit}
        fullWidth
      >
        {payload.submit_label || "Submit"}
      </GlassButton>
    </GlassSurface>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: RADIUS.lg,
  },
  input: {
    minHeight: 100,
    maxHeight: 200,
    borderRadius: RADIUS.md,
    borderWidth: StyleSheet.hairlineWidth,
    padding: SPACE.md,
    fontSize: FONT.secondary.size,
    lineHeight: 20,
    marginBottom: SPACE.sm,
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: SPACE.md,
    gap: SPACE.sm,
    flexWrap: "wrap",
  },
  readOnlyBox: {
    borderRadius: RADIUS.md,
    borderWidth: StyleSheet.hairlineWidth,
    padding: SPACE.md,
  },
  readOnlyText: {
    fontSize: FONT.secondary.size,
    lineHeight: 20,
  },
});
