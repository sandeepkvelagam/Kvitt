import React, { useState, useCallback, useEffect, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useTheme } from "../context/ThemeContext";
import { useHaptics } from "../context/HapticsContext";
import { api } from "../api/client";
import { BottomSheetScreen } from "../components/BottomSheetScreen";
import { FONT, SPACE, LAYOUT, RADIUS, BUTTON_SIZE } from "../styles/tokens";

interface FeatureRequest {
  id: string;
  title: string;
  description: string;
  status: string;
  vote_count: number;
  comment_count: number;
  user_voted: boolean;
  created_at: string;
}

const STATUS_COLORS: Record<string, string> = {
  planned: "#3B82F6",
  in_progress: "#9333EA",
  completed: "#22C55E",
  declined: "#6B7280",
};

const STATUS_LABELS: Record<string, string> = {
  planned: "Planned",
  in_progress: "In-Progress",
  completed: "Completed",
  declined: "Declined",
};

export function FeatureRequestsScreen() {
  const navigation = useNavigation();
  const { colors } = useTheme();
  const { triggerHaptic } = useHaptics();

  const [viewMode, setViewMode] = useState<"list" | "create">("list");
  const [sortMode, setSortMode] = useState<"votes" | "newest">("votes");
  const [search, setSearch] = useState("");
  const [items, setItems] = useState<FeatureRequest[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Create form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchRequests = useCallback(
    async (opts?: { refresh?: boolean }) => {
      if (opts?.refresh) setRefreshing(true);
      else setLoading(true);
      try {
        const res = await api.get("/feature-requests", {
          params: { sort: sortMode, search: search.trim(), offset: 0, limit: 50 },
        });
        setItems(res.data.items || []);
        setTotal(res.data.total || 0);
      } catch {
        // Silently fail — user sees empty state
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [sortMode, search],
  );

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const handleSearchChange = (text: string) => {
    setSearch(text);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => {
      // fetchRequests will re-run via useEffect when search changes
    }, 300);
  };

  const handleVote = async (item: FeatureRequest) => {
    triggerHaptic("light");
    // Optimistic update
    setItems((prev) =>
      prev.map((r) =>
        r.id === item.id
          ? {
              ...r,
              user_voted: !r.user_voted,
              vote_count: r.user_voted ? r.vote_count - 1 : r.vote_count + 1,
            }
          : r,
      ),
    );
    try {
      await api.post(`/feature-requests/${item.id}/vote`);
    } catch {
      // Revert on error
      setItems((prev) =>
        prev.map((r) =>
          r.id === item.id
            ? { ...r, user_voted: item.user_voted, vote_count: item.vote_count }
            : r,
        ),
      );
    }
  };

  const handleSubmit = async () => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      Alert.alert("Title required", "Please enter a title for your feature request.");
      return;
    }
    setSubmitting(true);
    try {
      await api.post("/feature-requests", {
        title: trimmedTitle,
        description: description.trim(),
      });
      triggerHaptic("success");
      setTitle("");
      setDescription("");
      setViewMode("list");
      fetchRequests({ refresh: true });
    } catch (err: any) {
      const msg = err?.response?.data?.detail || "Failed to submit. Please try again.";
      Alert.alert("Error", msg);
    } finally {
      setSubmitting(false);
    }
  };

  const renderCard = ({ item, index }: { item: FeatureRequest; index: number }) => {
    const statusColor = STATUS_COLORS[item.status];
    const statusLabel = STATUS_LABELS[item.status];

    return (
      <Animated.View entering={FadeInDown.delay(index * 50).springify().damping(16)}>
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.cardContent}>
            <Text style={[styles.cardTitle, { color: colors.textPrimary }]} numberOfLines={1}>
              {item.title}
            </Text>
            {item.description ? (
              <Text style={[styles.cardDesc, { color: colors.textSecondary }]} numberOfLines={2}>
                {item.description}
              </Text>
            ) : null}
            <View style={styles.cardMeta}>
              <Ionicons name="chatbubble-outline" size={14} color={colors.textMuted} />
              <Text style={[styles.cardMetaText, { color: colors.textMuted }]}>
                {item.comment_count}
              </Text>
              {statusLabel && statusColor && item.status !== "open" && (
                <View style={[styles.statusBadge, { borderColor: statusColor }]}>
                  <Text style={[styles.statusText, { color: statusColor }]}>{statusLabel}</Text>
                </View>
              )}
            </View>
          </View>
          <TouchableOpacity
            style={styles.voteButton}
            onPress={() => handleVote(item)}
            activeOpacity={0.6}
            accessibilityLabel={`Vote for ${item.title}`}
          >
            <Ionicons
              name="chevron-up"
              size={24}
              color={item.user_voted ? colors.orange : colors.textMuted}
            />
            <Text
              style={[
                styles.voteCount,
                { color: item.user_voted ? colors.orange : colors.textMuted },
              ]}
            >
              {item.vote_count}
            </Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    );
  };

  const renderEmpty = () => {
    if (loading) return null;
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="bulb-outline" size={48} color={colors.textMuted} />
        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
          No feature requests yet
        </Text>
        <TouchableOpacity
          style={[styles.emptyCta, { backgroundColor: colors.orange }]}
          onPress={() => setViewMode("create")}
          activeOpacity={0.7}
        >
          <Text style={styles.emptyCtaText}>Be the first to suggest one</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <BottomSheetScreen>
      <View style={[styles.container, { backgroundColor: colors.contentBg }]}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={[styles.backButton, { backgroundColor: colors.glassBg, borderColor: colors.glassBorder }]}
            onPress={() => {
              if (viewMode === "create") {
                setViewMode("list");
              } else {
                navigation.goBack();
              }
            }}
            activeOpacity={0.7}
            accessibilityLabel="Go back"
          >
            <Ionicons
              name={viewMode === "create" ? "chevron-back" : "arrow-back"}
              size={22}
              color={colors.textPrimary}
            />
          </TouchableOpacity>

          <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
            Feature Requests
          </Text>

          <TouchableOpacity
            style={[styles.createPill, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => {
              triggerHaptic("light");
              setViewMode("create");
            }}
            activeOpacity={0.7}
            accessibilityLabel="Create feature request"
          >
            <Ionicons name="pencil-outline" size={16} color={colors.textPrimary} />
            <Text style={[styles.createPillText, { color: colors.textPrimary }]}>Create</Text>
          </TouchableOpacity>
        </View>

        {viewMode === "list" ? (
          <>
            {/* Tabs */}
            <View style={styles.tabBar}>
              <TouchableOpacity
                style={[styles.tab, sortMode === "votes" && styles.tabActive]}
                onPress={() => {
                  triggerHaptic("light");
                  setSortMode("votes");
                }}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.tabText,
                    { color: sortMode === "votes" ? colors.textPrimary : colors.textMuted },
                    sortMode === "votes" && styles.tabTextActive,
                  ]}
                >
                  Most Voted
                </Text>
                {sortMode === "votes" && (
                  <View style={[styles.tabIndicator, { backgroundColor: colors.orange }]} />
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tab, sortMode === "newest" && styles.tabActive]}
                onPress={() => {
                  triggerHaptic("light");
                  setSortMode("newest");
                }}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.tabText,
                    { color: sortMode === "newest" ? colors.textPrimary : colors.textMuted },
                    sortMode === "newest" && styles.tabTextActive,
                  ]}
                >
                  Newest
                </Text>
                {sortMode === "newest" && (
                  <View style={[styles.tabIndicator, { backgroundColor: colors.orange }]} />
                )}
              </TouchableOpacity>
            </View>

            {/* Search */}
            <View style={[styles.searchBar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Ionicons name="search-outline" size={18} color={colors.textMuted} />
              <TextInput
                style={[styles.searchInput, { color: colors.textPrimary }]}
                placeholder="Search feature requests..."
                placeholderTextColor={colors.textMuted}
                value={search}
                onChangeText={handleSearchChange}
                returnKeyType="search"
              />
              {search.length > 0 && (
                <TouchableOpacity onPress={() => setSearch("")} activeOpacity={0.7}>
                  <Ionicons name="close-circle" size={18} color={colors.textMuted} />
                </TouchableOpacity>
              )}
            </View>

            {/* List */}
            {loading && items.length === 0 ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.orange} />
              </View>
            ) : (
              <FlatList
                data={items}
                keyExtractor={(item) => item.id}
                renderItem={renderCard}
                ListEmptyComponent={renderEmpty}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
                refreshControl={
                  <RefreshControl
                    refreshing={refreshing}
                    onRefresh={() => fetchRequests({ refresh: true })}
                    tintColor={colors.orange}
                  />
                }
              />
            )}
          </>
        ) : (
          /* Create View */
          <KeyboardAvoidingView
            style={styles.createContainer}
            behavior={Platform.OS === "ios" ? "padding" : undefined}
          >
            <View style={[styles.createCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.createHeading, { color: colors.textPrimary }]}>
                Suggest a feature
              </Text>

              <TextInput
                style={[
                  styles.createTitleInput,
                  { color: colors.textPrimary, borderColor: colors.border },
                ]}
                placeholder="Short, descriptive title"
                placeholderTextColor={colors.textMuted}
                value={title}
                onChangeText={(t) => setTitle(t.slice(0, 120))}
                maxLength={120}
                returnKeyType="next"
              />

              <TextInput
                style={[
                  styles.createDescInput,
                  { color: colors.textPrimary, borderColor: colors.border },
                ]}
                placeholder="Any additional details..."
                placeholderTextColor={colors.textMuted}
                value={description}
                onChangeText={(t) => setDescription(t.slice(0, 2000))}
                maxLength={2000}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />

              <View style={styles.createActions}>
                <TouchableOpacity
                  style={[
                    styles.submitButton,
                    {
                      backgroundColor: title.trim()
                        ? colors.textMuted
                        : colors.border,
                    },
                    !title.trim() && { opacity: 0.5 },
                  ]}
                  onPress={handleSubmit}
                  disabled={!title.trim() || submitting}
                  activeOpacity={0.7}
                >
                  {submitting ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.submitButtonText}>Submit</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        )}
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
  headerTitle: {
    fontSize: FONT.screenTitle.size,
    fontWeight: FONT.screenTitle.weight,
  },
  createPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: SPACE.lg,
    height: LAYOUT.touchTarget,
    borderRadius: LAYOUT.touchTarget / 2,
    borderWidth: 1,
  },
  createPillText: {
    fontSize: FONT.secondary.size,
    fontWeight: "600",
  },

  // Tabs
  tabBar: {
    flexDirection: "row",
    paddingHorizontal: LAYOUT.screenPadding,
    marginBottom: SPACE.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255,255,255,0.08)",
  },
  tab: {
    marginRight: SPACE.xl,
    paddingBottom: SPACE.sm,
    position: "relative",
  },
  tabActive: {},
  tabText: {
    fontSize: FONT.body.size,
    fontWeight: FONT.body.weight,
  },
  tabTextActive: {
    fontWeight: "600",
  },
  tabIndicator: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 2,
    borderRadius: 1,
  },

  // Search
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: LAYOUT.screenPadding,
    marginBottom: SPACE.lg,
    height: LAYOUT.touchTarget,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACE.md,
    gap: SPACE.sm,
    borderWidth: 1,
  },
  searchInput: {
    flex: 1,
    fontSize: FONT.body.size,
    height: "100%",
  },

  // List
  listContent: {
    paddingHorizontal: LAYOUT.screenPadding,
    paddingBottom: 48,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },

  // Card
  card: {
    flexDirection: "row",
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    padding: LAYOUT.cardPadding,
    marginBottom: SPACE.md,
  },
  cardContent: {
    flex: 1,
    gap: SPACE.xs,
  },
  cardTitle: {
    fontSize: FONT.bodyStrong.size,
    fontWeight: FONT.bodyStrong.weight,
  },
  cardDesc: {
    fontSize: FONT.secondary.size,
    lineHeight: 21,
  },
  cardMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: SPACE.xs,
  },
  cardMetaText: {
    fontSize: FONT.meta.size,
    fontWeight: FONT.meta.weight,
  },
  statusBadge: {
    borderWidth: 1,
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACE.sm,
    paddingVertical: 2,
    marginLeft: SPACE.sm,
  },
  statusText: {
    fontSize: FONT.micro.size,
    fontWeight: "600",
  },

  // Vote button
  voteButton: {
    width: LAYOUT.touchTarget + 8,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  voteCount: {
    fontSize: FONT.secondary.size,
    fontWeight: "600",
  },

  // Empty state
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 80,
    gap: SPACE.md,
  },
  emptyText: {
    fontSize: FONT.body.size,
  },
  emptyCta: {
    paddingHorizontal: SPACE.xl,
    height: BUTTON_SIZE.compact.height,
    borderRadius: RADIUS.md,
    alignItems: "center",
    justifyContent: "center",
    marginTop: SPACE.sm,
  },
  emptyCtaText: {
    fontSize: FONT.secondary.size,
    fontWeight: "600",
    color: "#fff",
  },

  // Create view
  createContainer: {
    flex: 1,
    paddingHorizontal: LAYOUT.screenPadding,
    paddingTop: SPACE.lg,
  },
  createCard: {
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    padding: LAYOUT.cardPadding + 4,
  },
  createHeading: {
    fontSize: FONT.navTitle.size,
    fontWeight: FONT.navTitle.weight,
    marginBottom: SPACE.lg,
  },
  createTitleInput: {
    fontSize: FONT.body.size,
    borderBottomWidth: 1,
    paddingVertical: SPACE.md,
    marginBottom: SPACE.md,
  },
  createDescInput: {
    fontSize: FONT.body.size,
    borderWidth: 1,
    borderRadius: RADIUS.sm,
    padding: SPACE.md,
    minHeight: 100,
    marginBottom: SPACE.lg,
  },
  createActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  submitButton: {
    paddingHorizontal: SPACE.xl,
    height: BUTTON_SIZE.compact.height,
    borderRadius: RADIUS.md,
    alignItems: "center",
    justifyContent: "center",
  },
  submitButtonText: {
    fontSize: FONT.secondary.size,
    fontWeight: "600",
    color: "#fff",
  },
});
