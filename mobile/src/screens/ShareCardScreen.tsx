import React, { useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Alert,
  Linking,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RouteProp } from "@react-navigation/native";
import ViewShot from "react-native-view-shot";
import * as Sharing from "expo-sharing";
import * as MediaLibrary from "expo-media-library";
import { COLORS } from "../styles/liquidGlass";
import { FONT, SPACE, RADIUS, LAYOUT } from "../styles/tokens";

type ShareCardParams = {
  ShareCard: {
    streak: number;
    streakStartDate: string | null;
  };
};

export function ShareCardScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const route = useRoute<RouteProp<ShareCardParams, "ShareCard">>();
  const viewShotRef = useRef<ViewShot>(null);

  const streak = route.params?.streak ?? 0;
  const streakStartDate = route.params?.streakStartDate;

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

  const handleInstagram = useCallback(async () => {
    const uri = await captureCard();
    if (!uri) return;

    // Try Instagram Stories deep link
    const igUrl = `instagram-stories://share?source_application=kvitt`;
    const canOpen = await Linking.canOpenURL(igUrl).catch(() => false);

    if (canOpen) {
      // On iOS, pass the image via the share sheet to Instagram Stories
      // The deep link opens Instagram Stories, then we share the image
      await Sharing.shareAsync(uri, {
        mimeType: "image/png",
        UTI: "com.instagram.exclusivegram",
      }).catch(() => {
        // Fallback to regular share
        Sharing.shareAsync(uri, { mimeType: "image/png" });
      });
    } else {
      Alert.alert(
        "Instagram Not Found",
        "Instagram is not installed. Opening share sheet instead.",
        [
          {
            text: "Share",
            onPress: () => Sharing.shareAsync(uri, { mimeType: "image/png" }),
          },
          { text: "Cancel", style: "cancel" },
        ]
      );
    }
  }, [captureCard]);

  const handleMessages = useCallback(async () => {
    const uri = await captureCard();
    if (!uri) return;
    await Sharing.shareAsync(uri, {
      mimeType: "image/png",
      dialogTitle: "Share your streak",
    });
  }, [captureCard]);

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
    await Sharing.shareAsync(uri, { mimeType: "image/png" });
  }, [captureCard]);

  const handleCopy = useCallback(async () => {
    // Copy shares the image via the share sheet (clipboard image copy varies by OS)
    const uri = await captureCard();
    if (!uri) return;
    await Sharing.shareAsync(uri, { mimeType: "image/png" });
  }, [captureCard]);

  return (
    <View style={styles.root}>
      <SafeAreaView style={{ flex: 1 }} edges={["top", "bottom"]}>
        {/* Drag handle */}
        <View style={styles.handleWrap}>
          <View style={styles.handle} />
        </View>

        {/* Card */}
        <View style={styles.cardContainer}>
          <ViewShot
            ref={viewShotRef}
            options={{ format: "png", quality: 1.0 }}
            style={styles.viewShot}
          >
            <LinearGradient
              colors={["#F5A623", "#E8871E", "#C45A22", "#6B3A1F"]}
              start={{ x: 0.5, y: 0 }}
              end={{ x: 0.5, y: 1 }}
              style={styles.gradientCard}
            >
              {/* Sparkle decorations */}
              <Text style={[styles.sparkle, { top: "25%", left: "20%" }]}>{"\u2728"}</Text>
              <Text style={[styles.sparkle, { top: "20%", right: "18%" }]}>{"\u2728"}</Text>
              <Text style={[styles.sparkleSm, { top: "30%", left: "15%" }]}>{"\u2B50"}</Text>

              {/* Fire icon with streak number */}
              <View style={styles.fireContainer}>
                <Text style={styles.fireEmoji}>{"\uD83D\uDD25"}</Text>
                <View style={styles.streakNumOverlay}>
                  <Text style={styles.streakNum}>{streak}</Text>
                </View>
              </View>

              {/* Title */}
              <Text style={styles.dayStreakTitle}>DAY STREAK</Text>

              {/* Start date */}
              {streakStartDate && (
                <Text style={styles.startDate}>Started on {formatDate(streakStartDate)}</Text>
              )}
            </LinearGradient>
          </ViewShot>
        </View>

        {/* Action buttons */}
        <View style={styles.actionsRow}>
          <ActionButton icon="logo-instagram" label="Instagram" onPress={handleInstagram} />
          <ActionButton icon="chatbubble-ellipses" label="Messages" onPress={handleMessages} color="#34C759" />
          <ActionButton icon="download-outline" label="Save" onPress={handleSave} />
          <ActionButton icon="ellipsis-horizontal" label="More" onPress={handleMore} />
          <ActionButton icon="copy-outline" label="Copy" onPress={handleCopy} />
        </View>
      </SafeAreaView>
    </View>
  );
}

function ActionButton({
  icon,
  label,
  onPress,
  color,
}: {
  icon: string;
  label: string;
  onPress: () => void;
  color?: string;
}) {
  const isInstagram = icon === "logo-instagram";

  return (
    <Pressable
      style={({ pressed }) => [styles.actionBtn, pressed && { opacity: 0.7 }]}
      onPress={onPress}
    >
      <View
        style={[
          styles.actionIconWrap,
          isInstagram && styles.instagramBg,
          color ? { backgroundColor: color } : null,
        ]}
      >
        <Ionicons name={icon as any} size={24} color="#fff" />
      </View>
      <Text style={styles.actionLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.deepBlack,
  },
  handleWrap: {
    alignItems: "center",
    paddingTop: SPACE.sm,
    paddingBottom: SPACE.lg,
  },
  handle: {
    width: 36,
    height: 5,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.3)",
  },
  cardContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: LAYOUT.screenPadding,
  },
  viewShot: {
    width: "100%",
    borderRadius: RADIUS.xl,
    overflow: "hidden",
  },
  gradientCard: {
    width: "100%",
    aspectRatio: 0.75,
    borderRadius: RADIUS.xl,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    overflow: "hidden",
  },
  sparkle: {
    position: "absolute",
    fontSize: 24,
  },
  sparkleSm: {
    position: "absolute",
    fontSize: 16,
  },
  fireContainer: {
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    marginBottom: SPACE.lg,
  },
  fireEmoji: {
    fontSize: 120,
  },
  streakNumOverlay: {
    position: "absolute",
    bottom: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  streakNum: {
    fontSize: 36,
    fontWeight: "800",
    color: "#fff",
    textShadowColor: "rgba(0,0,0,0.3)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  dayStreakTitle: {
    fontSize: 28,
    fontWeight: "800",
    color: "#F5A623",
    letterSpacing: 3,
    textShadowColor: "rgba(0,0,0,0.2)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  startDate: {
    fontSize: FONT.secondary.size,
    color: "rgba(255,255,255,0.7)",
    marginTop: SPACE.sm,
  },
  actionsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingHorizontal: LAYOUT.screenPadding,
    paddingVertical: SPACE.xxl,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.1)",
  },
  actionBtn: {
    alignItems: "center",
    gap: SPACE.sm,
  },
  actionIconWrap: {
    width: 52,
    height: 52,
    borderRadius: RADIUS.md,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  instagramBg: {
    backgroundColor: "#E4405F",
  },
  actionLabel: {
    fontSize: FONT.micro.size,
    color: COLORS.text.secondary,
  },
});
