import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Clipboard,
  Alert,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { COLORS, SPACING, RADIUS } from "../../styles/liquidGlass";
import { ICON_WELL, LAYOUT, APPLE_TYPO } from "../../styles/tokens";
import { useTheme } from "../../context/ThemeContext";

interface WalletHeroCardProps {
  balance_cents: number;
  wallet_id: string | null;
  currency?: string;
  daily_transfer_limit_cents?: number;
  daily_transferred_cents?: number;
  has_pin?: boolean;
}

export function WalletHeroCard({
  balance_cents,
  wallet_id,
  currency = "USD",
  daily_transfer_limit_cents,
  daily_transferred_cents = 0,
}: WalletHeroCardProps) {
  const [balanceVisible, setBalanceVisible] = useState(true);
  const { isDark } = useTheme();

  /** Same neutral rim + pad as Dashboard V3 metrics carousel (first tab live-games ring) */
  const metricRingPad = useMemo(
    () => ({
      padBg: isDark ? "rgba(168, 182, 215, 0.1)" : "rgba(88, 102, 138, 0.07)",
      rimBorder: isDark ? "rgba(255, 255, 255, 0.09)" : "rgba(0, 0, 0, 0.07)",
    }),
    [isDark]
  );

  /** Light chip like Dashboard’s inner disc — black wallet icon (same idea as ♠️ on white) */
  const innerDisc = "rgba(255, 255, 255, 0.96)";
  const walletIconColor = "#111111";

  const ring = ICON_WELL.heroXl;

  const formatBalance = (cents: number) => {
    const dollars = cents / 100;
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
    }).format(dollars);
  };

  const handleCopyWalletId = () => {
    if (wallet_id) {
      Clipboard.setString(wallet_id);
      Alert.alert("Copied!", "Wallet ID copied to clipboard");
    }
  };

  const limitPercent =
    daily_transfer_limit_cents && daily_transfer_limit_cents > 0
      ? Math.min(daily_transferred_cents / daily_transfer_limit_cents, 1)
      : null;

  return (
    <View style={styles.wrapper}>
      <LinearGradient
        colors={["#F07230", "#EE6C29", "#C45A22"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.card}
      >
        {/* Gloss highlight overlay */}
        <View style={styles.glossOverlay} />

        {/* Hero row — matches Dashboard V3 live-games card: left stats + right large ring */}
        <View style={styles.heroMainRow}>
          <View style={styles.heroLeftCol}>
            <View style={styles.headerLabelRow}>
              <Text style={styles.balanceLabel}>Available balance</Text>
              <TouchableOpacity
                style={styles.eyeButton}
                onPress={() => setBalanceVisible((v) => !v)}
                accessibilityRole="button"
                accessibilityLabel={balanceVisible ? "Hide balance" : "Show balance"}
              >
                <Ionicons
                  name={balanceVisible ? "eye-outline" : "eye-off-outline"}
                  size={22}
                  color="rgba(255,255,255,0.85)"
                />
              </TouchableOpacity>
            </View>
            <Text style={styles.balanceValue}>
              {balanceVisible ? formatBalance(balance_cents) : "••••••••"}
            </Text>
          </View>
          <View
            style={[
              styles.iconRingOuter,
              {
                width: ring.outer,
                height: ring.outer,
                borderRadius: ring.outer / 2,
                padding: ring.ringPadding,
                backgroundColor: metricRingPad.padBg,
                borderColor: metricRingPad.rimBorder,
              },
            ]}
          >
            <View
              style={[
                styles.iconRingInner,
                {
                  width: ring.inner,
                  height: ring.inner,
                  borderRadius: ring.inner / 2,
                  backgroundColor: innerDisc,
                },
              ]}
            >
              <Ionicons name="wallet" size={44} color={walletIconColor} />
            </View>
          </View>
        </View>

        {/* Wallet ID row */}
        <TouchableOpacity
          style={styles.walletIdRow}
          onPress={handleCopyWalletId}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Copy wallet ID"
        >
          <Ionicons name="card-outline" size={13} color="rgba(255,255,255,0.65)" />
          <Text style={styles.walletIdText} numberOfLines={1}>
            {wallet_id || "—"}
          </Text>
          <View style={styles.copyBadge}>
            <Ionicons name="copy-outline" size={12} color="rgba(255,255,255,0.9)" />
          </View>
        </TouchableOpacity>

        {/* Daily limit bar */}
        {limitPercent !== null && (
          <View style={styles.limitSection}>
            <View style={styles.limitLabelRow}>
              <Text style={styles.limitLabel}>Daily limit</Text>
              <Text style={styles.limitLabel}>
                {formatBalance(daily_transferred_cents)} / {formatBalance(daily_transfer_limit_cents!)}
              </Text>
            </View>
            <View style={styles.limitTrack}>
              <View style={[styles.limitFill, { width: `${Math.round(limitPercent * 100)}%` }]} />
            </View>
          </View>
        )}

        {/* Card chip decoration */}
        <View style={styles.chipDecoration}>
          <View style={styles.chipCircle1} />
          <View style={styles.chipCircle2} />
        </View>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    borderRadius: RADIUS.xxxl,
    marginBottom: SPACING.xl,
    shadowColor: COLORS.orange,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 16,
  },
  card: {
    borderRadius: RADIUS.xxxl,
    padding: SPACING.xxl,
    minHeight: 200,
    overflow: "hidden",
  },
  glossOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: RADIUS.xxxl,
    backgroundColor: "rgba(255,255,255,0.08)",
    top: 0,
    left: 0,
    right: 0,
    height: "45%",
  },
  heroMainRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: SPACING.md,
    marginBottom: SPACING.md,
  },
  heroLeftCol: {
    flex: 1,
    minWidth: 0,
  },
  headerLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: SPACING.xs,
  },
  iconRingOuter: {
    borderWidth: StyleSheet.hairlineWidth * 2,
    alignItems: "center",
    justifyContent: "center",
  },
  iconRingInner: {
    alignItems: "center",
    justifyContent: "center",
  },
  balanceLabel: {
    color: "rgba(255,255,255,0.75)",
    fontSize: APPLE_TYPO.subhead.size,
    fontWeight: "500",
    letterSpacing: 0.15,
  },
  eyeButton: {
    width: LAYOUT.touchTarget,
    height: LAYOUT.touchTarget,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: RADIUS.full,
  },
  balanceValue: {
    color: "#FFFFFF",
    fontSize: APPLE_TYPO.largeTitle.size,
    fontWeight: "700",
    letterSpacing: -0.5,
    lineHeight: APPLE_TYPO.largeTitle.size + 4,
    marginBottom: 0,
    ...(Platform.OS === "ios" ? { fontVariant: ["tabular-nums" as const] } : {}),
  },
  walletIdRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(0,0,0,0.18)",
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    minHeight: LAYOUT.touchTarget,
    paddingVertical: SPACING.sm,
    alignSelf: "flex-start",
    marginBottom: SPACING.md,
  },
  walletIdText: {
    color: "rgba(255,255,255,0.90)",
    fontSize: APPLE_TYPO.footnote.size,
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    letterSpacing: 0.3,
    maxWidth: 180,
  },
  copyBadge: {
    marginLeft: 2,
  },
  limitSection: {
    marginTop: SPACING.xs,
  },
  limitLabelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  limitLabel: {
    color: "rgba(255,255,255,0.65)",
    fontSize: APPLE_TYPO.footnote.size,
    fontWeight: "500",
  },
  limitTrack: {
    height: 4,
    backgroundColor: "rgba(0,0,0,0.2)",
    borderRadius: RADIUS.full,
    overflow: "hidden",
  },
  limitFill: {
    height: "100%",
    backgroundColor: "rgba(255,255,255,0.85)",
    borderRadius: RADIUS.full,
  },
  chipDecoration: {
    position: "absolute",
    right: SPACING.xxl,
    bottom: SPACING.xxl,
    flexDirection: "row",
    gap: -8,
  },
  chipCircle1: {
    width: 28,
    height: 28,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.15)",
  },
  chipCircle2: {
    width: 28,
    height: 28,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.25)",
    marginLeft: -10,
  },
});
