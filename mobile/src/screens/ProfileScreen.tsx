import React, { useState, useRef, useEffect } from "react";
import {
  ScrollView, Text, View, StyleSheet, TouchableOpacity,
  Alert, Animated,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { useLanguage } from "../context/LanguageContext";
import { api } from "../api/client";
import { COLORS, ANIMATION } from "../styles/liquidGlass";
import { GlassInput, GlassButton, PageHeader } from "../components/ui";
import { BottomSheetScreen } from "../components/BottomSheetScreen";

export function ProfileScreen() {
  const navigation = useNavigation();
  const { user, refreshUser } = useAuth();
  const { colors } = useTheme();
  const { t } = useLanguage();

  const [fullName, setFullName] = useState(user?.name || "");
  const [nickname, setNickname] = useState(user?.nickname || user?.name?.split(" ")[0] || "");
  const [isUpdating, setIsUpdating] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 350, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, ...ANIMATION.spring.bouncy }),
    ]).start();
  }, []);

  const handleUpdate = async () => {
    if (!fullName.trim()) return;
    setIsUpdating(true);
    try {
      await api.put("/users/me", { name: fullName.trim(), nickname: nickname.trim() });
      await refreshUser?.();
      Alert.alert("All set", "Profile updated.");
    } catch (e: any) {
      Alert.alert("Update unavailable", e?.response?.data?.detail || "Please try again.");
    } finally { setIsUpdating(false); }
  };

  const handleDelete = () => {
    Alert.alert("Delete Account", "This action cannot be undone. All your data will be permanently deleted.", [
      { text: t.common.cancel, style: "cancel" },
      {
        text: t.common.delete, style: "destructive",
        onPress: async () => {
          try { await api.delete("/users/me"); }
          catch (e: any) { Alert.alert("Not available right now", e?.response?.data?.detail || "Please try again."); }
        },
      },
    ]);
  };

  const changed = fullName !== (user?.name || "") || nickname !== (user?.nickname || user?.name?.split(" ")[0] || "");

  return (
    <BottomSheetScreen>
      <View style={[styles.container, { backgroundColor: colors.contentBg }]}>
        <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
          <PageHeader
            title={t.nav.profile}
            onClose={() => navigation.goBack()}
          />
        </Animated.View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>

            {/* ── Profile Details ── */}
            <Text style={[styles.sectionLabel, { color: colors.moonstone, marginTop: 0 }]}>PROFILE DETAILS</Text>
            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <GlassInput
                label="Full Name"
                placeholder="Enter your full name"
                value={fullName}
                onChangeText={setFullName}
                containerStyle={{ marginBottom: 12 }}
              />
              <GlassInput
                label="Nickname"
                placeholder="Enter your nickname"
                value={nickname}
                onChangeText={setNickname}
                containerStyle={{ marginBottom: 16 }}
              />
              <GlassButton
                variant={changed ? "primary" : "ghost"}
                size="large"
                fullWidth
                onPress={handleUpdate}
                loading={isUpdating}
                disabled={!changed}
              >
                {t.common.save}
              </GlassButton>
            </View>

            {/* ── Danger Zone ── */}
            <Text style={[styles.sectionLabel, { color: COLORS.status.danger + "CC" }]}>DANGER ZONE</Text>
            <View style={[styles.card, { backgroundColor: "rgba(239,68,68,0.06)", borderColor: "rgba(239,68,68,0.2)" }]}>
              <TouchableOpacity style={styles.dangerRow} onPress={handleDelete} activeOpacity={0.7}>
                <Ionicons name="trash-outline" size={20} color={COLORS.status.danger} />
                <View style={styles.dangerText}>
                  <Text style={styles.dangerTitle}>Delete Account</Text>
                  <Text style={[styles.dangerSub, { color: colors.textMuted }]}>Permanently delete all data. Cannot be undone.</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={COLORS.status.danger} />
              </TouchableOpacity>
            </View>

          </Animated.View>
          <View style={{ height: 50 }} />
        </ScrollView>
      </View>
    </BottomSheetScreen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flex: 1 },
  content: { padding: 20, paddingBottom: 32 },

  sectionLabel: {
    fontSize: 11, fontWeight: "600", letterSpacing: 1,
    marginTop: 24, marginBottom: 10, textTransform: "uppercase",
  },
  card: { borderRadius: 16, borderWidth: 1, overflow: "hidden", padding: 16, marginBottom: 4 },

  dangerRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 4 },
  dangerText: { flex: 1 },
  dangerTitle: { color: COLORS.status.danger, fontSize: 16, fontWeight: "600" },
  dangerSub: { fontSize: 12, marginTop: 2 },
});

export default ProfileScreen;
