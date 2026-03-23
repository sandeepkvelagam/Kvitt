import React, { useRef, useCallback, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Alert,
  Linking,
  Platform,
  Share,
  Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import * as FileSystem from "expo-file-system/legacy";
import Constants from "expo-constants";
import { useNavigation, useRoute } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RouteProp } from "@react-navigation/native";
import ViewShot from "react-native-view-shot";
import * as Sharing from "expo-sharing";
import * as MediaLibrary from "expo-media-library";
import { useTheme } from "../context/ThemeContext";
import { FONT, SPACE, RADIUS, LAYOUT } from "../styles/tokens";

type ShareCardParams = {
  ShareCard: {
    streak: number;
    streakStartDate: string | null;
  };
};

const { width: WIN_W, height: WIN_H } = Dimensions.get("window");
const SHEET_HEIGHT = Math.round(WIN_H * 0.82);
const CARD_MAX_H = Math.min(SHEET_HEIGHT * 0.52, WIN_W * 1.05);

export function ShareCardScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const route = useRoute<RouteProp<ShareCardParams, "ShareCard">>();
  const { colors, isDark } = useTheme();
  const viewShotRef = useRef<ViewShot>(null);

  const streak = route.params?.streak ?? 0;
  const streakStartDate = route.params?.streakStartDate;

  const scrim = useMemo(
    () => (isDark ? "rgba(0,0,0,0.55)" : "rgba(0,0,0,0.32)"),
    [isDark]
  );

  const actionStripBg = useMemo(
    () => (isDark ? "rgba(28,28,30,0.92)" : "rgba(255,255,255,0.94)"),
    [isDark]
  );

  const neutralTileBorder = isDark ? "rgba(255,255,255,0.22)" : "rgba(0,0,0,0.12)";
  const neutralTileBg = isDark ? "rgba(60,60,62,0.95)" : "#FFFFFF";

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  };

  const captureCard = useCallback(async (): Promise<string | null> => {
    try {
      const uri = await viewShotRef.current?.capture?.();
      return uri ?? null;
    } catch {
      Alert.alert("Error", "Could not capture the card.");
      return null;
    }
  }, []);

  const copyPngToClipboard = useCallback(async (uri: string) => {
    const b64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    await Clipboard.setImageAsync(b64);
  }, []);

  const openFallbackShare = useCallback(async (uri: string, title: string) => {
    try {
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: "image/png", dialogTitle: title });
      } else {
        Alert.alert("Sharing unavailable", "Try saving the image first.");
      }
    } catch {
      Alert.alert("Could not share", "Try saving the image first, then share from Photos.");
    }
  }, []);

  const handleInstagram = useCallback(async () => {
    const uri = await captureCard();
    if (!uri) return;

    const igStoryUrl = "instagram-stories://share?source_application=kvitt";

    if (Platform.OS === "ios") {
      try {
        await copyPngToClipboard(uri);
        const canOpen = await Linking.canOpenURL(igStoryUrl).catch(() => false);
        if (canOpen) {
          await Linking.openURL(igStoryUrl);
          return;
        }
      } catch {
        /* fall through */
      }
      await openFallbackShare(uri, "Share to Instagram");
      return;
    }

    // Android: no public story intent without native code — try opening app then share sheet
    const canIg = await Linking.canOpenURL("instagram://app").catch(() => false);
    if (canIg) {
      try {
        await Linking.openURL("instagram://app");
        Alert.alert(
          "Instagram",
          "Your streak image is ready. Use Share below if Stories did not open automatically.",
          [
            { text: "Share", onPress: () => openFallbackShare(uri, "Share to Instagram Stories") },
            { text: "OK", style: "cancel" },
          ]
        );
        return;
      } catch {
        /* fall through */
      }
    }
    await openFallbackShare(uri, "Share to Instagram");
  }, [captureCard, copyPngToClipboard, openFallbackShare]);

  const handleMessages = useCallback(async () => {
    const uri = await captureCard();
    if (!uri) return;
    try {
      await Share.share({
        url: uri,
        message: "My Kvitt streak",
        title: "Share streak",
      });
    } catch {
      await openFallbackShare(uri, "Share via Messages");
    }
  }, [captureCard, openFallbackShare]);

  const handleSave = useCallback(async () => {
    const uri = await captureCard();
    if (!uri) return;

    const { status } = await MediaLibrary.requestPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission Required", "Please allow access to save images to your photos.");
      return;
    }

    try {
      await MediaLibrary.saveToLibraryAsync(uri);
      Alert.alert("Saved", "Image saved to your photos.");
    } catch {
      Alert.alert("Error", "Could not save the image.");
    }
  }, [captureCard]);

  const handleMore = useCallback(async () => {
    const uri = await captureCard();
    if (!uri) return;
    await openFallbackShare(uri, "Share");
  }, [captureCard, openFallbackShare]);

  const handleCopy = useCallback(async () => {
    const uri = await captureCard();
    if (!uri) return;
    try {
      await copyPngToClipboard(uri);
      Alert.alert("Copied", "Image copied. Paste into Instagram, Messages, or Notes.");
    } catch {
      await openFallbackShare(uri, "Share image");
    }
  }, [captureCard, copyPngToClipboard, openFallbackShare]);

  const expoGoNote =
    Constants.appOwnership === "expo"
      ? " In Expo Go, some apps open the system share sheet instead."
      : "";

  return (
    <View style={[styles.rootFill, { backgroundColor: scrim }]}>
      <Pressable style={StyleSheet.absoluteFill} onPress={() => navigation.goBack()} accessibilityLabel="Close" />

      <View
        style={[
          styles.sheet,
          {
            height: SHEET_HEIGHT,
            backgroundColor: colors.surfaceBackground,
          },
        ]}
      >
        <LinearGradient
          colors={["#F5A623", "#FFD9A8", isDark ? "rgba(20,20,22,0.95)" : "rgba(255,250,245,0.98)"]}
          locations={[0, 0.45, 1]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <LinearGradient
          colors={["transparent", "transparent", isDark ? "rgba(12,12,14,0.88)" : "rgba(255,255,255,0.92)"]}
          locations={[0, 0.42, 1]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />

        <SafeAreaView style={styles.sheetInner} edges={["bottom"]}>
          <View style={styles.handleWrap}>
            <View style={[styles.handle, { backgroundColor: isDark ? "rgba(255,255,255,0.35)" : "rgba(0,0,0,0.2)" }]} />
          </View>

          <View style={styles.cardStage}>
            <ViewShot
              ref={viewShotRef}
              options={{ format: "png", quality: 1.0 }}
              style={[styles.viewShot, { maxHeight: CARD_MAX_H, width: WIN_W * 0.9 }]}
            >
              <LinearGradient
                colors={["#F5A623", "#E8871E", "#C45A22", "#6B3A1F"]}
                start={{ x: 0.5, y: 0 }}
                end={{ x: 0.5, y: 1 }}
                style={styles.gradientCard}
              >
                <Text style={[styles.sparkle, { top: "22%", left: "18%" }]}>{"\u2728"}</Text>
                <Text style={[styles.sparkle, { top: "18%", right: "16%" }]}>{"\u2728"}</Text>
                <Text style={[styles.sparkleSm, { top: "28%", left: "12%" }]}>{"\u2B50"}</Text>

                <View style={styles.fireContainer}>
                  <Text style={styles.fireEmoji}>{"\uD83D\uDD25"}</Text>
                  <View style={styles.streakNumOverlay}>
                    <Text style={styles.streakNum}>{streak}</Text>
                  </View>
                </View>

                <Text style={styles.dayStreakTitle}>DAY STREAK</Text>

                {streakStartDate ? (
                  <Text style={styles.startDate}>Started on {formatDate(streakStartDate)}</Text>
                ) : null}
              </LinearGradient>
            </ViewShot>
          </View>

          {Platform.OS === "ios" ? (
            <BlurView intensity={28} tint={isDark ? "dark" : "light"} style={[styles.actionsBlur, { borderColor: neutralTileBorder }]}>
              <View style={[styles.actionsInner, { backgroundColor: actionStripBg }]}>
                <ActionsRow
                  onInstagram={handleInstagram}
                  onMessages={handleMessages}
                  onSave={handleSave}
                  onMore={handleMore}
                  onCopy={handleCopy}
                  labelColor={colors.textSecondary}
                  neutralBorder={neutralTileBorder}
                  neutralBg={neutralTileBg}
                  expoGoNote={expoGoNote}
                />
              </View>
            </BlurView>
          ) : (
            <View style={[styles.actionsBlur, { backgroundColor: actionStripBg, borderColor: neutralTileBorder }]}>
              <ActionsRow
                onInstagram={handleInstagram}
                onMessages={handleMessages}
                onSave={handleSave}
                onMore={handleMore}
                onCopy={handleCopy}
                labelColor={colors.textSecondary}
                neutralBorder={neutralTileBorder}
                neutralBg={neutralTileBg}
                expoGoNote={expoGoNote}
              />
            </View>
          )}
        </SafeAreaView>
      </View>
    </View>
  );
}

function ActionsRow({
  onInstagram,
  onMessages,
  onSave,
  onMore,
  onCopy,
  labelColor,
  neutralBorder,
  neutralBg,
  expoGoNote,
}: {
  onInstagram: () => void;
  onMessages: () => void;
  onSave: () => void;
  onMore: () => void;
  onCopy: () => void;
  labelColor: string;
  neutralBorder: string;
  neutralBg: string;
  expoGoNote: string;
}) {
  return (
    <View style={styles.actionsRow}>
      {expoGoNote ? (
        <Text style={[styles.expoHint, { color: labelColor }]} numberOfLines={2}>
          {expoGoNote.trim()}
        </Text>
      ) : null}
      <View style={styles.actionsIcons}>
        <ActionBrand icon="logo-instagram" label="Instagram" brand="instagram" onPress={onInstagram} labelColor={labelColor} />
        <ActionBrand icon="chatbubble" label="Messages" brand="messages" onPress={onMessages} labelColor={labelColor} />
        <ActionNeutral icon="arrow-down-outline" label="Save" onPress={onSave} labelColor={labelColor} borderColor={neutralBorder} bg={neutralBg} />
        <ActionNeutral icon="ellipsis-horizontal" label="More" onPress={onMore} labelColor={labelColor} borderColor={neutralBorder} bg={neutralBg} />
        <ActionNeutral icon="copy-outline" label="Copy" onPress={onCopy} labelColor={labelColor} borderColor={neutralBorder} bg={neutralBg} />
      </View>
    </View>
  );
}

function ActionBrand({
  icon,
  label,
  brand,
  onPress,
  labelColor,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  brand: "instagram" | "messages";
  onPress: () => void;
  labelColor: string;
}) {
  return (
    <Pressable style={({ pressed }) => [styles.actionBtn, pressed && { opacity: 0.75 }]} onPress={onPress}>
      <View
        style={[
          styles.brandIconWrap,
          brand === "instagram" && styles.instagramRing,
          brand === "messages" && { backgroundColor: "#34C759" },
        ]}
      >
        {brand === "instagram" ? (
          <Ionicons name="logo-instagram" size={34} color="#E4405F" />
        ) : (
          <Ionicons name={icon as any} size={22} color="#fff" />
        )}
      </View>
      <Text style={[styles.actionLabel, { color: labelColor }]}>{label}</Text>
    </Pressable>
  );
}

function ActionNeutral({
  icon,
  label,
  onPress,
  labelColor,
  borderColor,
  bg,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  onPress: () => void;
  labelColor: string;
  borderColor: string;
  bg: string;
}) {
  return (
    <Pressable style={({ pressed }) => [styles.actionBtn, pressed && { opacity: 0.75 }]} onPress={onPress}>
      <View style={[styles.neutralTile, { borderColor, backgroundColor: bg }]}>
        <Ionicons name={icon as any} size={22} color={labelColor} />
      </View>
      <Text style={[styles.actionLabel, { color: labelColor }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  rootFill: {
    flex: 1,
    justifyContent: "flex-end",
  },
  sheet: {
    width: "100%",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: "hidden",
  },
  sheetInner: {
    flex: 1,
  },
  handleWrap: {
    alignItems: "center",
    paddingTop: SPACE.sm,
    paddingBottom: SPACE.xs,
  },
  handle: {
    width: 40,
    height: 5,
    borderRadius: 3,
  },
  cardStage: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: LAYOUT.screenPadding,
    paddingBottom: SPACE.sm,
  },
  viewShot: {
    borderRadius: RADIUS.xl,
    overflow: "hidden",
  },
  gradientCard: {
    width: "100%",
    minHeight: 220,
    aspectRatio: 0.75,
    borderRadius: RADIUS.xl,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    overflow: "hidden",
  },
  sparkle: {
    position: "absolute",
    fontSize: 22,
  },
  sparkleSm: {
    position: "absolute",
    fontSize: 15,
  },
  fireContainer: {
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    marginBottom: SPACE.md,
  },
  fireEmoji: {
    fontSize: 108,
  },
  streakNumOverlay: {
    position: "absolute",
    bottom: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  streakNum: {
    fontSize: 34,
    fontWeight: "800",
    color: "#fff",
    textShadowColor: "rgba(0,0,0,0.3)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  dayStreakTitle: {
    fontSize: 26,
    fontWeight: "800",
    color: "#F5A623",
    letterSpacing: 3,
    textShadowColor: "rgba(0,0,0,0.2)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  startDate: {
    fontSize: FONT.secondary.size,
    color: "rgba(255,255,255,0.75)",
    marginTop: SPACE.sm,
  },
  actionsBlur: {
    borderTopWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
  actionsInner: {
    paddingBottom: SPACE.sm,
  },
  actionsRow: {
    paddingTop: SPACE.md,
    paddingHorizontal: SPACE.sm,
  },
  expoHint: {
    fontSize: 11,
    textAlign: "center",
    marginBottom: SPACE.sm,
    paddingHorizontal: SPACE.md,
    opacity: 0.85,
  },
  actionsIcons: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    flexWrap: "wrap",
    gap: 8,
    paddingBottom: SPACE.md,
  },
  actionBtn: {
    alignItems: "center",
    width: "18%",
    minWidth: 58,
    minHeight: 76,
    justifyContent: "flex-start",
  },
  brandIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  instagramRing: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.06)",
  },
  neutralTile: {
    width: 52,
    height: 52,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  actionLabel: {
    fontSize: 11,
    marginTop: 6,
    textAlign: "center",
    fontWeight: "500",
  },
});
