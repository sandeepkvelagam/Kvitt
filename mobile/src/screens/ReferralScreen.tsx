import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Share,
  Clipboard,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { BottomSheetScreen } from "../components/BottomSheetScreen";
import { FONT, SPACE, RADIUS, LAYOUT, BUTTON_SIZE } from "../styles/tokens";

// Decorative avatar data — purely visual, matches Cal AI screenshot layout
const AVATARS = [
  { initial: "J", bg: "#5B8DEF" },
  { initial: "A", bg: "#4ADE80" },
  { initial: "M", bg: "#F97316" },
  { initial: "S", bg: "#3B82F6" },
  { initial: "K", bg: "#EF4444" },
  { initial: "R", bg: "#F59E0B" },
  { initial: "T", bg: "#A78BFA" },
  { initial: "L", bg: "#EC4899" },
];

// Positions for the scattered avatar cluster (matching Cal AI layout)
const AVATAR_POSITIONS: { top: number; left: number; size: number }[] = [
  { top: 0, left: 4, size: 56 },
  { top: -8, left: 72, size: 56 },
  { top: -16, left: 168, size: 64 },
  { top: 8, left: 256, size: 56 },
  { top: 44, left: 32, size: 48 },
  { top: 24, left: 120, size: 64 },
  { top: 44, left: 216, size: 56 },
];

function generateReferralCode(userId?: string): string {
  if (!userId) return "KVITT0";
  return userId.replace(/-/g, "").substring(0, 6).toUpperCase();
}

export function ReferralScreen() {
  const navigation = useNavigation();
  const { user } = useAuth();
  const { colors } = useTheme();
  const [copied, setCopied] = useState(false);

  const referralCode = generateReferralCode(user?.user_id);

  const handleCopy = () => {
    Clipboard.setString(referralCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Join me on Kvitt! Use my promo code ${referralCode} to sign up and we both earn $10. Download now: https://kvitt.app`,
      });
    } catch {
      // User cancelled share sheet — no action needed
    }
  };

  return (
    <BottomSheetScreen>
      <View style={[styles.container, { backgroundColor: colors.contentBg }]}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable
            style={({ pressed }) => [
              styles.backButton,
              { backgroundColor: colors.glassBg, borderColor: colors.glassBorder },
              pressed && styles.backButtonPressed,
            ]}
            onPress={() => navigation.goBack()}
            accessibilityLabel="Go back"
            accessibilityRole="button"
          >
            <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
            Refer your friend
          </Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Hero Title */}
          <Text style={[styles.heroTitle, { color: colors.textPrimary }]}>
            Refer your friend
          </Text>

          {/* Avatar Cluster */}
          <View style={styles.avatarCluster}>
            {AVATARS.slice(0, AVATAR_POSITIONS.length).map((avatar, i) => {
              const pos = AVATAR_POSITIONS[i];
              return (
                <View
                  key={i}
                  style={[
                    styles.avatarCircle,
                    {
                      backgroundColor: avatar.bg,
                      width: pos.size,
                      height: pos.size,
                      borderRadius: pos.size / 2,
                      top: pos.top,
                      left: pos.left,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.avatarInitial,
                      { fontSize: pos.size * 0.4 },
                    ]}
                  >
                    {avatar.initial}
                  </Text>
                </View>
              );
            })}
          </View>

          {/* Tagline */}
          <Text style={[styles.tagline, { color: colors.textPrimary }]}>
            Empower your friends
          </Text>
          <Text style={[styles.taglineSub, { color: colors.textMuted }]}>
            & play together
          </Text>

          {/* Promo Code Card */}
          <View
            style={[
              styles.promoCard,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <View style={styles.promoContent}>
              <Text style={[styles.promoLabel, { color: colors.textMuted }]}>
                Your personal promo code
              </Text>
              <Text style={[styles.promoCode, { color: colors.textPrimary }]}>
                {referralCode}
              </Text>
            </View>
            <Pressable
              style={({ pressed }) => [
                styles.copyButton,
                pressed && { opacity: 0.6 },
              ]}
              onPress={handleCopy}
              accessibilityLabel="Copy promo code"
              accessibilityRole="button"
            >
              <Ionicons
                name={copied ? "checkmark" : "copy-outline"}
                size={22}
                color={copied ? colors.orange : colors.textMuted}
              />
            </Pressable>
          </View>

          {/* Share Button */}
          <Pressable
            style={({ pressed }) => [
              styles.shareButton,
              pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
            ]}
            onPress={handleShare}
            accessibilityLabel="Share referral code"
            accessibilityRole="button"
          >
            <Text style={styles.shareButtonText}>Share</Text>
          </Pressable>

          {/* How to Earn Card */}
          <View
            style={[
              styles.earnCard,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <Text style={[styles.earnTitle, { color: colors.textPrimary }]}>
              How to earn 💰
            </Text>
            <Text style={[styles.earnBullet, { color: colors.textSecondary }]}>
              ✳  Share your promo code to your friends
            </Text>
            <Text style={[styles.earnBullet, { color: colors.textSecondary }]}>
              ✳  Earn $10 per friend that signs up with your code
            </Text>
          </View>

          <View style={{ height: 48 }} />
        </ScrollView>
      </View>
    </BottomSheetScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: LAYOUT.screenPadding,
    paddingTop: SPACE.lg,
    paddingBottom: SPACE.md,
  },
  backButton: {
    width: LAYOUT.touchTarget,
    height: LAYOUT.touchTarget,
    borderRadius: LAYOUT.touchTarget / 2,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  backButtonPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.92 }],
  },
  headerTitle: {
    fontSize: FONT.navTitle.size,
    fontWeight: FONT.navTitle.weight,
  },
  headerSpacer: {
    width: LAYOUT.touchTarget,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: LAYOUT.screenPadding,
  },
  heroTitle: {
    fontSize: FONT.screenTitle.size,
    fontWeight: FONT.screenTitle.weight,
    marginTop: SPACE.sm,
    marginBottom: SPACE.lg,
  },
  avatarCluster: {
    height: 120,
    marginBottom: SPACE.xxl,
    position: "relative",
  },
  avatarCircle: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitial: {
    fontWeight: "700",
    color: "rgba(255,255,255,0.9)",
  },
  tagline: {
    fontSize: FONT.body.size,
    fontWeight: "600",
    textAlign: "center",
    marginBottom: SPACE.xs,
  },
  taglineSub: {
    fontSize: FONT.secondary.size,
    textAlign: "center",
    marginBottom: SPACE.xxxl,
  },
  promoCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    padding: LAYOUT.cardPadding,
    marginBottom: SPACE.lg,
  },
  promoContent: {
    flex: 1,
  },
  promoLabel: {
    fontSize: FONT.meta.size,
    fontWeight: FONT.meta.weight,
    marginBottom: SPACE.xs,
  },
  promoCode: {
    fontSize: FONT.navTitle.size,
    fontWeight: "700",
  },
  copyButton: {
    width: LAYOUT.touchTarget,
    height: LAYOUT.touchTarget,
    alignItems: "center",
    justifyContent: "center",
  },
  shareButton: {
    height: BUTTON_SIZE.large.height,
    backgroundColor: "#FFFFFF",
    borderRadius: RADIUS.lg,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: SPACE.xxl,
  },
  shareButtonText: {
    fontSize: FONT.bodyStrong.size,
    fontWeight: FONT.bodyStrong.weight,
    color: "#000000",
  },
  earnCard: {
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    padding: LAYOUT.cardPadding,
  },
  earnTitle: {
    fontSize: FONT.bodyStrong.size,
    fontWeight: FONT.bodyStrong.weight,
    marginBottom: SPACE.md,
  },
  earnBullet: {
    fontSize: FONT.secondary.size,
    lineHeight: 24,
  },
});
