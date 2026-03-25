import React, { useState, useCallback, useEffect, useMemo } from "react";
import {
  View,
  Text,
  TextInput,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useTheme } from "../context/ThemeContext";
import { useLanguage } from "../context/LanguageContext";
import { useHaptics } from "../context/HapticsContext";
import { api } from "../api/client";
import { BottomSheetScreen } from "../components/BottomSheetScreen";
import { FONT, SPACE, LAYOUT, RADIUS, BUTTON_SIZE, AVATAR_SIZE } from "../styles/tokens";
import { appleCardShadowResting } from "../styles/appleShadows";
import { Title3, Headline, Footnote, Caption2 } from "../components/ui";

const VOTE_BOX = 52;

interface FeatureRequest {
  id: string;
  title: string;
  description: string;
  status: string;
  vote_count: number;
  comment_count: number;
  user_voted: boolean;
  created_at: string;
  author_name?: string | null;
}

interface FeatureComment {
  id: string;
  user_id: string;
  body: string;
  created_at: string;
  author_name?: string | null;
}

const STATUS_LABELS: Record<string, string> = {
  planned: "Planned",
  in_progress: "In-Progress",
  completed: "Completed",
  declined: "Declined",
};

function localeForLanguage(lang: string): string {
  const m: Record<string, string> = {
    en: "en-US",
    es: "es-ES",
    fr: "fr-FR",
    de: "de-DE",
    hi: "hi-IN",
    pt: "pt-BR",
    zh: "zh-CN",
  };
  return m[lang] || "en-US";
}

function formatShortDate(iso: string, locale: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(locale, { month: "short", day: "numeric", year: "numeric" });
}

function authorInitial(name?: string | null): string {
  if (!name?.trim()) return "?";
  return name.trim().charAt(0).toUpperCase();
}

export function FeatureRequestsScreen() {
  const navigation = useNavigation();
  const { colors, isDark } = useTheme();
  const { t, language } = useLanguage();
  const { triggerHaptic } = useHaptics();
  const ft = t.featureRequests;
  const dateLocale = localeForLanguage(language);

  const cardChrome = useMemo(
    () => ({
      backgroundColor: colors.surface,
      borderRadius: RADIUS.lg,
      borderWidth: 1,
      borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)",
      ...appleCardShadowResting(isDark),
    }),
    [colors.surface, isDark]
  );

  const [viewMode, setViewMode] = useState<"list" | "detail" | "create">("list");
  const [sortMode, setSortMode] = useState<"votes" | "newest">("votes");
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [items, setItems] = useState<FeatureRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [detailId, setDetailId] = useState<string | null>(null);
  const [detail, setDetail] = useState<FeatureRequest | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [comments, setComments] = useState<FeatureComment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentDraft, setCommentDraft] = useState("");
  const [commentSubmitting, setCommentSubmitting] = useState(false);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const tm = setTimeout(() => setDebouncedSearch(searchInput.trim()), 300);
    return () => clearTimeout(tm);
  }, [searchInput]);

  const fetchRequests = useCallback(
    async (opts?: { refresh?: boolean }) => {
      if (opts?.refresh) setRefreshing(true);
      else setLoading(true);
      try {
        const res = await api.get("/feature-requests", {
          params: { sort: sortMode, search: debouncedSearch, offset: 0, limit: 50 },
        });
        setItems(res.data.items || []);
      } catch {
        // keep prior items
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [sortMode, debouncedSearch]
  );

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const syncVote = useCallback((id: string, voted: boolean, voteCount: number) => {
    const sid = String(id);
    setItems((prev) =>
      prev.map((r) => (String(r.id) === sid ? { ...r, user_voted: voted, vote_count: voteCount } : r))
    );
    setDetail((d) => (d && String(d.id) === sid ? { ...d, user_voted: voted, vote_count: voteCount } : d));
  }, []);

  const handleVote = async (item: FeatureRequest) => {
    const rid = String(item.id);
    triggerHaptic("light");
    const prev = { user_voted: item.user_voted, vote_count: item.vote_count };
    const nextVoted = !item.user_voted;
    const nextCount = nextVoted ? item.vote_count + 1 : Math.max(0, item.vote_count - 1);
    syncVote(rid, nextVoted, nextCount);
    try {
      const res = await api.post(`/feature-requests/${rid}/vote`);
      syncVote(rid, res.data.voted, res.data.vote_count);
    } catch {
      syncVote(rid, prev.user_voted, prev.vote_count);
    }
  };

  const loadDetail = useCallback(async (id: string) => {
    const rid = String(id);
    setDetailLoading(true);
    setCommentsLoading(true);
    setDetail(null);
    setComments([]);
    try {
      const dRes = await api.get(`/feature-requests/${rid}`);
      setDetail(dRes.data);
    } catch {
      Alert.alert(ft.submitErrorTitle, ft.detailLoadError);
      setViewMode("list");
      setDetailId(null);
      setDetail(null);
      setComments([]);
      setDetailLoading(false);
      setCommentsLoading(false);
      return;
    }
    setDetailLoading(false);
    try {
      const cRes = await api.get(`/feature-requests/${rid}/comments`, {
        params: { limit: 100, offset: 0 },
      });
      const list = cRes.data?.items;
      setComments(Array.isArray(list) ? list : []);
    } catch {
      setComments([]);
    } finally {
      setCommentsLoading(false);
    }
  }, [ft.detailLoadError, ft.submitErrorTitle]);

  const openDetail = useCallback(
    (item: FeatureRequest) => {
      const rid = String(item.id);
      triggerHaptic("light");
      setDetailId(rid);
      setViewMode("detail");
      loadDetail(rid);
    },
    [loadDetail, triggerHaptic]
  );

  const handleSubmit = async () => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      Alert.alert(ft.titleRequiredTitle, ft.titleRequiredBody);
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
      Alert.alert(ft.submitErrorTitle, typeof msg === "string" ? msg : ft.submitErrorTitle);
    } finally {
      setSubmitting(false);
    }
  };

  const submitComment = async () => {
    const body = commentDraft.trim();
    const rid = String(detailId ?? detail?.id ?? "");
    if (!body || !rid) return;
    setCommentSubmitting(true);
    try {
      const res = await api.post(`/feature-requests/${rid}/comments`, { body });
      triggerHaptic("success");
      setCommentDraft("");
      const row = res.data;
      setComments((prev) => [...prev, row]);
      setDetail((d) => (d ? { ...d, comment_count: (d.comment_count || 0) + 1 } : d));
      setItems((prev) =>
        prev.map((r) => (String(r.id) === rid ? { ...r, comment_count: (r.comment_count || 0) + 1 } : r))
      );
    } catch (err: any) {
      const msg = err?.response?.data?.detail || "Could not post comment.";
      Alert.alert(ft.submitErrorTitle, typeof msg === "string" ? msg : ft.submitErrorTitle);
    } finally {
      setCommentSubmitting(false);
    }
  };

  const goBack = () => {
    if (viewMode === "create") {
      setViewMode("list");
      return;
    }
    if (viewMode === "detail") {
      setViewMode("list");
      setDetailId(null);
      setDetail(null);
      setComments([]);
      return;
    }
    navigation.goBack();
  };

  const statusPillStyle = (status: string) => {
    if (status === "in_progress") {
      return {
        backgroundColor: isDark ? "rgba(167, 139, 250, 0.22)" : "#F5E6FF",
        textColor: isDark ? "#C4B5FD" : "#9B51E0",
      };
    }
    if (status === "planned") {
      return {
        backgroundColor: isDark ? "rgba(59, 130, 246, 0.2)" : "rgba(59, 130, 246, 0.12)",
        textColor: isDark ? "#93C5FD" : "#2563EB",
      };
    }
    if (status === "completed") {
      return {
        backgroundColor: isDark ? "rgba(34, 197, 94, 0.2)" : "rgba(34, 197, 94, 0.12)",
        textColor: isDark ? "#86EFAC" : "#15803D",
      };
    }
    if (status === "declined") {
      return {
        backgroundColor: isDark ? "rgba(156, 163, 175, 0.2)" : "rgba(107, 114, 128, 0.12)",
        textColor: isDark ? "#D1D5DB" : "#4B5563",
      };
    }
    return null;
  };

  const renderVoteBox = (item: FeatureRequest, opts: { emphasized: boolean; onPress: () => void }) => {
    const strong = opts.emphasized || item.user_voted;
    const borderColor = strong ? colors.textPrimary : colors.border;
    const fg = strong ? colors.textPrimary : colors.textMuted;
    return (
      <TouchableOpacity
        style={[styles.voteBox, { borderColor }]}
        onPress={opts.onPress}
        activeOpacity={0.65}
        accessibilityLabel={`${ft.voteAccessibility}: ${item.title}`}
      >
        <Ionicons name="chevron-up" size={20} color={fg} />
        <Text style={[styles.voteBoxCount, { color: fg }]}>{item.vote_count}</Text>
      </TouchableOpacity>
    );
  };

  const renderCard = ({ item, index }: { item: FeatureRequest; index: number }) => {
    const statusLabel = STATUS_LABELS[item.status];
    const pill = item.status !== "open" && statusLabel ? statusPillStyle(item.status) : null;
    const emphasized = sortMode === "votes" && index < 2;

    return (
      <View style={[styles.card, cardChrome]}>
        <View style={styles.cardContent} pointerEvents="box-none">
          <TouchableOpacity
            onPress={() => openDetail(item)}
            activeOpacity={0.85}
            style={styles.cardTextTap}
            accessibilityRole="button"
            accessibilityLabel={ft.openDetailAccessibility}
          >
            <Text style={[styles.cardTitle, { color: colors.textPrimary }]} numberOfLines={1}>
              {item.title}
            </Text>
            {item.description ? (
              <Text
                style={[styles.cardDesc, { color: colors.textSecondary }]}
                numberOfLines={2}
              >
                {item.description}
              </Text>
            ) : null}
          </TouchableOpacity>
          <View style={styles.cardMeta} pointerEvents="box-none">
            <TouchableOpacity
              onPress={() => openDetail(item)}
              activeOpacity={0.7}
              style={styles.commentTap}
              hitSlop={{ top: 14, bottom: 14, left: 8, right: 14 }}
              accessibilityRole="button"
              accessibilityLabel={`${ft.viewComments}: ${item.comment_count}`}
            >
              <Ionicons name="chatbubble-outline" size={13} color={colors.textMuted} />
              <Text style={[styles.cardMetaCount, { color: colors.textMuted }]}>
                {item.comment_count}
              </Text>
            </TouchableOpacity>
            {pill && statusLabel ? (
              <View style={[styles.statusBadgeFill, { backgroundColor: pill.backgroundColor }]}>
                <Text style={[styles.statusBadgeText, { color: pill.textColor }]}>{statusLabel}</Text>
              </View>
            ) : null}
          </View>
        </View>
        {renderVoteBox(item, {
          emphasized,
          onPress: () => handleVote(item),
        })}
      </View>
    );
  };

  const renderEmpty = () => {
    if (loading) return null;
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="bulb-outline" size={48} color={colors.textMuted} />
        <Footnote style={{ color: colors.textSecondary, textAlign: "center" }}>{ft.emptyTitle}</Footnote>
        <TouchableOpacity
          style={[styles.emptyCta, { backgroundColor: colors.buttonPrimary }]}
          onPress={() => setViewMode("create")}
          activeOpacity={0.7}
        >
          <Text style={styles.emptyCtaText}>{ft.emptyCta}</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderCreatePill = () => (
    <TouchableOpacity
      style={[styles.createPill, { backgroundColor: colors.buttonPrimary }]}
      onPress={() => {
        triggerHaptic("light");
        setViewMode("create");
      }}
      activeOpacity={0.75}
      accessibilityLabel={ft.create}
    >
      <Ionicons name="pencil-outline" size={16} color={colors.buttonText} />
      <Text style={[styles.createPillText, { color: colors.buttonText }]}>{ft.create}</Text>
    </TouchableOpacity>
  );

  const renderHeader = () => {
    const backBtn = (
      <Pressable
        style={({ pressed }) => [
          styles.backButton,
          {
            backgroundColor: colors.surface,
            ...appleCardShadowResting(isDark),
          },
          pressed && { opacity: 0.85, transform: [{ scale: 0.96 }] },
        ]}
        onPress={goBack}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={t.common.back}
      >
        <Ionicons name="chevron-back" size={22} color={colors.textPrimary} />
      </Pressable>
    );

    if (viewMode === "detail") {
      return (
        <View style={[styles.headerBlock, { paddingHorizontal: LAYOUT.screenPadding }]}>
          <View style={styles.headerBackRow}>{backBtn}</View>
          <View style={styles.headerSubNavRow}>
            <Pressable
              onPress={goBack}
              style={({ pressed }) => [styles.subNavChevronWrap, pressed && { opacity: 0.5 }]}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel={t.common.back}
            >
              <Ionicons name="chevron-back" size={20} color={colors.textPrimary} />
            </Pressable>
            <Headline
              numberOfLines={1}
              style={[styles.headerSubNavTitle, { color: colors.textPrimary }]}
            >
              {ft.title}
            </Headline>
            {renderCreatePill()}
          </View>
          <View style={[styles.headerDivider, { backgroundColor: colors.border }]} />
        </View>
      );
    }

    return (
      <View style={[styles.headerBlock, { paddingHorizontal: LAYOUT.screenPadding }]}>
        <View style={styles.headerBackRow}>{backBtn}</View>
        <View style={styles.headerTitleRow}>
          <Title3 numberOfLines={1} style={[styles.headerScreenTitle, { color: colors.textPrimary }]}>
            {ft.title}
          </Title3>
          {renderCreatePill()}
        </View>
      </View>
    );
  };

  const renderList = () => (
    <>
      <View
        style={[
          styles.tabBar,
          { borderBottomColor: colors.border },
        ]}
      >
        <TouchableOpacity
          style={styles.tab}
          onPress={() => {
            triggerHaptic("light");
            setSortMode("votes");
          }}
          activeOpacity={0.7}
        >
          <Text
            style={[
              styles.tabLabel,
              {
                color: sortMode === "votes" ? colors.textPrimary : colors.textMuted,
                fontWeight: sortMode === "votes" ? "600" : "400",
              },
            ]}
          >
            {ft.tabMostVoted}
          </Text>
          {sortMode === "votes" ? (
            <View style={[styles.tabIndicator, { backgroundColor: colors.textPrimary }]} />
          ) : null}
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.tab}
          onPress={() => {
            triggerHaptic("light");
            setSortMode("newest");
          }}
          activeOpacity={0.7}
        >
          <Text
            style={[
              styles.tabLabel,
              {
                color: sortMode === "newest" ? colors.textPrimary : colors.textMuted,
                fontWeight: sortMode === "newest" ? "600" : "400",
              },
            ]}
          >
            {ft.tabNewest}
          </Text>
          {sortMode === "newest" ? (
            <View style={[styles.tabIndicator, { backgroundColor: colors.textPrimary }]} />
          ) : null}
        </TouchableOpacity>
      </View>

      <View
        style={[
          styles.searchBar,
          {
            backgroundColor: colors.inputBg,
            borderColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)",
          },
        ]}
      >
        <Ionicons name="search-outline" size={18} color={colors.textMuted} />
        <TextInput
          style={[styles.searchInput, { color: colors.textPrimary }]}
          placeholder={ft.searchPlaceholder}
          placeholderTextColor={colors.textMuted}
          value={searchInput}
          onChangeText={setSearchInput}
          returnKeyType="search"
        />
        {searchInput.length > 0 ? (
          <TouchableOpacity onPress={() => setSearchInput("")} activeOpacity={0.7}>
            <Ionicons name="close-circle" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        ) : null}
      </View>

      {loading && items.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.textPrimary} />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          renderItem={({ item, index }) => renderCard({ item, index })}
          ListEmptyComponent={renderEmpty}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => fetchRequests({ refresh: true })}
              tintColor={colors.textPrimary}
            />
          }
        />
      )}
    </>
  );

  const renderDetail = () => {
    const d = detail;
    const author = d?.author_name?.trim() || ft.anonymousAuthor;
    const rankIndex = d ? items.findIndex((x) => x.id === d.id) : -1;
    const emphasized =
      sortMode === "votes" && rankIndex >= 0 && rankIndex < 2;

    return (
      <KeyboardAvoidingView
        style={styles.flex1}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={0}
      >
        {detailLoading && !d ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.textPrimary} />
          </View>
        ) : d ? (
          <ScrollView
            style={styles.flex1}
            contentContainerStyle={styles.detailScroll}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            showsVerticalScrollIndicator={false}
          >
            <View style={[styles.detailMainCard, cardChrome]}>
              <View style={styles.detailTopRow}>
                {renderVoteBox(d, {
                  emphasized: emphasized || d.user_voted,
                  onPress: () => handleVote(d),
                })}
                <View style={styles.detailTitleCol}>
                  <Text style={[styles.detailRequestTitle, { color: colors.textPrimary }]}>{d.title}</Text>
                  <View style={styles.authorRow}>
                    <View
                      style={[
                        styles.avatar,
                        {
                          backgroundColor: colors.buttonPrimary,
                        },
                      ]}
                    >
                      <Text style={[styles.avatarLetter, { color: colors.buttonText }]}>
                        {authorInitial(d.author_name)}
                      </Text>
                    </View>
                    <Footnote
                      numberOfLines={1}
                      style={{
                        color: colors.textPrimary,
                        fontWeight: "600",
                        textTransform: "uppercase",
                        flex: 1,
                        letterSpacing: 0.3,
                      }}
                    >
                      {author}
                    </Footnote>
                  </View>
                </View>
              </View>
              {d.description ? (
                <Text style={[styles.detailBody, { color: colors.textPrimary, marginTop: SPACE.md }]}>
                  {d.description}
                </Text>
              ) : null}
              <Footnote style={{ color: colors.textMuted, marginTop: SPACE.lg }}>
                {formatShortDate(d.created_at, dateLocale)}
              </Footnote>
            </View>

            <View style={[styles.commentComposer, cardChrome]}>
              <TextInput
                style={[
                  styles.commentInput,
                  {
                    color: colors.textPrimary,
                    borderColor: colors.border,
                    backgroundColor: colors.inputBg,
                  },
                ]}
                placeholder={ft.commentPlaceholder}
                placeholderTextColor={colors.textMuted}
                value={commentDraft}
                onChangeText={(x) => setCommentDraft(x.slice(0, 2000))}
                multiline
                textAlignVertical="top"
              />
              <View style={styles.composerActions}>
                <TouchableOpacity
                  style={[
                    styles.submitPill,
                    {
                      backgroundColor: commentDraft.trim()
                        ? colors.textMuted
                        : colors.border,
                      opacity: commentDraft.trim() ? 1 : 0.55,
                    },
                  ]}
                  onPress={submitComment}
                  disabled={!commentDraft.trim() || commentSubmitting}
                  activeOpacity={0.75}
                >
                  {commentSubmitting ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.submitPillText}>{ft.submit}</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>

            {commentsLoading ? (
              <View style={styles.threadLoading}>
                <ActivityIndicator size="small" color={colors.textMuted} />
              </View>
            ) : comments.length === 0 ? (
              <Footnote style={{ color: colors.textMuted, paddingHorizontal: SPACE.sm, marginBottom: SPACE.md }}>
                {ft.noComments}
              </Footnote>
            ) : (
              comments.map((c) => {
                const cAuthor = c.author_name?.trim() || ft.anonymousAuthor;
                return (
                  <View key={c.id} style={[styles.commentCard, cardChrome]}>
                    <View style={styles.authorRow}>
                      <View style={[styles.avatarSm, { backgroundColor: colors.buttonPrimary }]}>
                        <Caption2 style={{ color: colors.buttonText, fontWeight: "700" }}>
                          {authorInitial(c.author_name)}
                        </Caption2>
                      </View>
                      <Text
                        numberOfLines={1}
                        style={[styles.commentAuthorName, { color: colors.textPrimary, flex: 1 }]}
                      >
                        {cAuthor}
                      </Text>
                    </View>
                    <Text style={[styles.commentBody, { color: colors.textPrimary, marginTop: SPACE.sm }]}>
                      {c.body}
                    </Text>
                    <Footnote style={{ color: colors.textMuted, marginTop: SPACE.md }}>
                      {formatShortDate(c.created_at, dateLocale)}
                    </Footnote>
                  </View>
                );
              })
            )}
            <View style={{ height: 48 }} />
          </ScrollView>
        ) : null}
      </KeyboardAvoidingView>
    );
  };

  const renderCreate = () => (
    <KeyboardAvoidingView
      style={styles.flex1}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.createOuter}>
        <View style={[styles.createCard, cardChrome]}>
          <Text style={[styles.createHeading, { color: colors.textPrimary, marginBottom: SPACE.lg }]}>
            {ft.suggestHeading}
          </Text>
          <TextInput
            style={[
              styles.createField,
              { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.surface },
            ]}
            placeholder={ft.titlePlaceholder}
            placeholderTextColor={colors.textMuted}
            value={title}
            onChangeText={(x) => setTitle(x.slice(0, 120))}
            maxLength={120}
            returnKeyType="next"
          />
          <TextInput
            style={[
              styles.createFieldMultiline,
              { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.surface },
            ]}
            placeholder={ft.detailsPlaceholder}
            placeholderTextColor={colors.textMuted}
            value={description}
            onChangeText={(x) => setDescription(x.slice(0, 2000))}
            maxLength={2000}
            multiline
            textAlignVertical="top"
          />
          <View style={styles.composerActions}>
            <TouchableOpacity
              style={[
                styles.submitPill,
                {
                  backgroundColor: title.trim() ? colors.textMuted : colors.border,
                  opacity: title.trim() ? 1 : 0.5,
                },
              ]}
              onPress={handleSubmit}
              disabled={!title.trim() || submitting}
              activeOpacity={0.75}
            >
              {submitting ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.submitPillText}>{ft.submit}</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </KeyboardAvoidingView>
  );

  return (
    <BottomSheetScreen>
      <View style={[styles.container, { backgroundColor: colors.contentBg }]}>
        {renderHeader()}

        {viewMode === "list" ? renderList() : null}
        {viewMode === "detail" ? renderDetail() : null}
        {viewMode === "create" ? renderCreate() : null}
      </View>
    </BottomSheetScreen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex1: { flex: 1 },
  headerBlock: {
    paddingTop: SPACE.lg,
    paddingBottom: SPACE.sm,
  },
  headerBackRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: SPACE.lg,
  },
  headerTitleRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: SPACE.md,
  },
  headerScreenTitle: {
    flex: 1,
    minWidth: 0,
    letterSpacing: -0.6,
  },
  headerSubNavRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: SPACE.md,
    gap: SPACE.xs,
  },
  subNavChevronWrap: {
    paddingVertical: 4,
    paddingRight: 2,
    justifyContent: "center",
  },
  headerSubNavTitle: {
    flex: 1,
    minWidth: 0,
    letterSpacing: -0.4,
  },
  headerDivider: {
    height: StyleSheet.hairlineWidth,
    width: "100%",
    marginBottom: SPACE.sm,
  },
  backButton: {
    width: LAYOUT.touchTarget,
    height: LAYOUT.touchTarget,
    borderRadius: RADIUS.full,
    alignItems: "center",
    justifyContent: "center",
  },
  createPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: SPACE.lg,
    height: LAYOUT.touchTarget,
    borderRadius: RADIUS.full,
    justifyContent: "center",
  },
  createPillText: {
    fontSize: FONT.caption.size,
    fontWeight: "600",
  },
  tabBar: {
    flexDirection: "row",
    paddingHorizontal: LAYOUT.screenPadding,
    marginBottom: SPACE.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  tab: {
    marginRight: SPACE.xl,
    paddingBottom: SPACE.sm,
    position: "relative",
  },
  tabIndicator: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 2,
    borderRadius: 1,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: LAYOUT.screenPadding,
    marginBottom: SPACE.lg,
    minHeight: 48,
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACE.md,
    gap: SPACE.sm,
    borderWidth: StyleSheet.hairlineWidth,
  },
  searchInput: {
    flex: 1,
    fontSize: FONT.secondary.size,
    paddingVertical: Platform.OS === "ios" ? 8 : 6,
  },
  tabLabel: {
    fontSize: FONT.secondary.size,
  },
  cardTitle: {
    fontSize: FONT.title.size,
    fontWeight: FONT.title.weight,
  },
  cardDesc: {
    fontSize: FONT.caption.size,
    lineHeight: 18,
    marginTop: 4,
  },
  cardMetaCount: {
    fontSize: FONT.caption.size,
    fontWeight: "600",
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: "600",
  },
  listContent: {
    paddingHorizontal: LAYOUT.screenPadding,
    paddingBottom: 48,
    flexGrow: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  card: {
    flexDirection: "row",
    alignItems: "stretch",
    padding: LAYOUT.cardPadding,
    marginBottom: SPACE.md,
  },
  cardContent: {
    flex: 1,
    marginRight: SPACE.md,
    justifyContent: "center",
  },
  cardTextTap: {
    marginBottom: SPACE.xs,
  },
  commentTap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    paddingVertical: 8,
    paddingHorizontal: 4,
    paddingRight: SPACE.sm,
    zIndex: 2,
  },
  cardMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: SPACE.xs,
    flexWrap: "wrap",
  },
  statusBadgeFill: {
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACE.sm,
    paddingVertical: 3,
    marginLeft: SPACE.xs,
  },
  voteBox: {
    width: VOTE_BOX,
    height: VOTE_BOX,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
  },
  voteBoxCount: {
    fontSize: FONT.caption.size,
    fontWeight: "700",
    marginTop: -2,
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 72,
    gap: SPACE.md,
    paddingHorizontal: SPACE.lg,
  },
  emptyCta: {
    paddingHorizontal: SPACE.xl,
    height: BUTTON_SIZE.compact.height,
    borderRadius: RADIUS.full,
    alignItems: "center",
    justifyContent: "center",
    marginTop: SPACE.sm,
  },
  emptyCtaText: {
    fontSize: FONT.secondary.size,
    fontWeight: "600",
    color: "#fff",
  },
  detailScroll: {
    paddingHorizontal: LAYOUT.screenPadding,
    paddingBottom: 24,
  },
  detailMainCard: {
    padding: LAYOUT.cardPadding + 2,
    marginBottom: SPACE.lg,
  },
  detailTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: SPACE.md,
  },
  detailTitleCol: {
    flex: 1,
    minWidth: 0,
  },
  detailRequestTitle: {
    fontSize: FONT.title.size,
    fontWeight: "600",
    lineHeight: 24,
  },
  detailBody: {
    fontSize: FONT.secondary.size,
    lineHeight: 20,
  },
  commentAuthorName: {
    fontSize: FONT.secondary.size,
    fontWeight: "600",
  },
  commentBody: {
    fontSize: FONT.secondary.size,
    lineHeight: 20,
  },
  createHeading: {
    fontSize: FONT.title.size,
    fontWeight: "600",
  },
  authorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.sm,
    marginTop: SPACE.sm,
  },
  avatar: {
    width: AVATAR_SIZE.sm,
    height: AVATAR_SIZE.sm,
    borderRadius: AVATAR_SIZE.sm / 2,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarSm: {
    width: AVATAR_SIZE.sm,
    height: AVATAR_SIZE.sm,
    borderRadius: AVATAR_SIZE.sm / 2,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarLetter: {
    fontSize: FONT.secondary.size,
    fontWeight: "700",
  },
  commentComposer: {
    padding: LAYOUT.cardPadding,
    marginBottom: SPACE.lg,
  },
  commentInput: {
    borderWidth: 1,
    borderRadius: RADIUS.sm,
    minHeight: 88,
    padding: SPACE.md,
    fontSize: FONT.secondary.size,
  },
  composerActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: SPACE.md,
  },
  submitPill: {
    paddingHorizontal: SPACE.xl,
    minWidth: 100,
    height: BUTTON_SIZE.compact.height,
    borderRadius: RADIUS.full,
    alignItems: "center",
    justifyContent: "center",
  },
  submitPillText: {
    color: "#fff",
    fontSize: FONT.caption.size,
    fontWeight: "600",
  },
  threadLoading: {
    paddingVertical: SPACE.lg,
    alignItems: "center",
  },
  commentCard: {
    padding: LAYOUT.cardPadding,
    marginBottom: SPACE.md,
  },
  createOuter: {
    flex: 1,
    paddingHorizontal: LAYOUT.screenPadding,
    paddingTop: SPACE.lg,
  },
  createCard: {
    padding: LAYOUT.cardPadding + 4,
  },
  createField: {
    borderWidth: 1,
    borderRadius: RADIUS.sm,
    paddingHorizontal: SPACE.md,
    paddingVertical: SPACE.md,
    fontSize: FONT.secondary.size,
    marginBottom: SPACE.md,
  },
  createFieldMultiline: {
    borderWidth: 1,
    borderRadius: RADIUS.sm,
    paddingHorizontal: SPACE.md,
    paddingVertical: SPACE.md,
    fontSize: FONT.secondary.size,
    minHeight: 120,
    marginBottom: SPACE.lg,
  },
});
