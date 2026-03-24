import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import { io } from "socket.io-client";
import { useAuth } from "@/context/AuthContext";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  ArrowLeft,
  Send,
  Loader2,
  Settings2,
  Sparkles,
  Gamepad2,
  MessageCircle,
  CloudSun,
  Gift,
  Calendar,
  BarChart3,
  FileText,
  Shield,
  Gauge,
  Minus,
  Plus,
} from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL + "/api";
const SOCKET_URL = process.env.REACT_APP_BACKEND_URL?.replace("/api", "") || "";

const AI_RATE_MIN = 0;
const AI_RATE_MAX = 50;

const DEFAULT_AI_SETTINGS = {
  ai_enabled: true,
  auto_suggest_games: true,
  respond_to_chat: true,
  weather_alerts: true,
  holiday_alerts: true,
  smart_scheduling: true,
  auto_poll_suggestions: true,
  chat_summaries: true,
  safety_filters: true,
  max_messages_per_hour: 5,
};

const AI_TOGGLE_ROWS = [
  {
    key: "ai_enabled",
    label: "AI Assistant (Kvitt)",
    description: "Kvitt helps schedule games, run polls, summarize decisions, and keep plans on track.",
    Icon: Sparkles,
  },
  {
    key: "auto_suggest_games",
    label: "Auto Suggest Games",
    description: "Proactively suggest games when the group is planning.",
    Icon: Gamepad2,
  },
  {
    key: "respond_to_chat",
    label: "Respond in Chat",
    description: "Kvitt can reply in the group chat when relevant.",
    Icon: MessageCircle,
  },
  {
    key: "weather_alerts",
    label: "Weather Alerts",
    description: "Mention weather-based game opportunities.",
    Icon: CloudSun,
  },
  {
    key: "holiday_alerts",
    label: "Holiday Alerts",
    description: "Mention holiday-based game opportunities.",
    Icon: Gift,
  },
  {
    key: "smart_scheduling",
    label: "Smart Scheduling",
    description: "Detects availability talk and offers time suggestions & polls.",
    Icon: Calendar,
  },
  {
    key: "auto_poll_suggestions",
    label: "Auto Poll Suggestions",
    description: "When the group debates dates, Kvitt recommends a quick poll.",
    Icon: BarChart3,
  },
  {
    key: "chat_summaries",
    label: "Chat Summaries",
    description: "Kvitt posts brief recaps after busy threads.",
    Icon: FileText,
  },
  {
    key: "safety_filters",
    label: "Safety Filters",
    description: "Blocks offensive content and de-escalates conflicts.",
    Icon: Shield,
  },
];

function normalizeAiSettings(data) {
  if (!data || typeof data !== "object") return { ...DEFAULT_AI_SETTINGS };
  return {
    ai_enabled: data.ai_enabled ?? DEFAULT_AI_SETTINGS.ai_enabled,
    auto_suggest_games: data.auto_suggest_games ?? DEFAULT_AI_SETTINGS.auto_suggest_games,
    respond_to_chat: data.respond_to_chat ?? DEFAULT_AI_SETTINGS.respond_to_chat,
    weather_alerts: data.weather_alerts ?? DEFAULT_AI_SETTINGS.weather_alerts,
    holiday_alerts: data.holiday_alerts ?? DEFAULT_AI_SETTINGS.holiday_alerts,
    smart_scheduling: data.smart_scheduling ?? DEFAULT_AI_SETTINGS.smart_scheduling,
    auto_poll_suggestions: data.auto_poll_suggestions ?? DEFAULT_AI_SETTINGS.auto_poll_suggestions,
    chat_summaries: data.chat_summaries ?? DEFAULT_AI_SETTINGS.chat_summaries,
    safety_filters: data.safety_filters ?? DEFAULT_AI_SETTINGS.safety_filters,
    max_messages_per_hour: Math.max(
      AI_RATE_MIN,
      Math.min(
        AI_RATE_MAX,
        Number(data.max_messages_per_hour ?? DEFAULT_AI_SETTINGS.max_messages_per_hour)
      )
    ),
  };
}

export default function GroupChat() {
  const navigate = useNavigate();
  const { groupId } = useParams();
  const { user } = useAuth();
  const [group, setGroup] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [typingUsers, setTypingUsers] = useState([]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [aiSettings, setAiSettings] = useState(() => ({ ...DEFAULT_AI_SETTINGS }));
  const [savingAiKey, setSavingAiKey] = useState(null);
  const messagesEndRef = useRef(null);
  const socketRef = useRef(null);
  const typingTimeoutsRef = useRef({});

  const isGroupAdmin = group?.user_role === "admin";

  // Fetch group info, messages, and AI settings
  useEffect(() => {
    if (!groupId) return;

    const fetchData = async () => {
      try {
        const [groupRes, messagesRes, aiRes] = await Promise.all([
          axios.get(`${API}/groups/${groupId}`),
          axios.get(`${API}/groups/${groupId}/messages?limit=50`),
          axios.get(`${API}/groups/${groupId}/ai-settings`).catch(() => ({ data: null })),
        ]);
        setGroup(groupRes.data);
        setMessages(messagesRes.data?.messages || messagesRes.data || []);
        setAiSettings(normalizeAiSettings(aiRes?.data));
      } catch {
        toast.error("Failed to load chat");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [groupId]);

  const updateAiToggle = useCallback(
    async (key, value) => {
      if (!groupId || !isGroupAdmin) return;
      if (key === "ai_enabled" && !value) {
        const ok = window.confirm(
          "Do you want to disable Kvitt AI for this group?"
        );
        if (!ok) return;
      }
      const prev = aiSettings[key];
      setAiSettings((s) => ({ ...s, [key]: value }));
      setSavingAiKey(key);
      try {
        await axios.put(`${API}/groups/${groupId}/ai-settings`, { [key]: value });
      } catch {
        toast.error("Failed to update setting");
        setAiSettings((s) => ({ ...s, [key]: prev }));
      } finally {
        setSavingAiKey(null);
      }
    },
    [groupId, isGroupAdmin, aiSettings]
  );

  const adjustMaxAiRate = useCallback(
    async (delta) => {
      if (!groupId || !isGroupAdmin || !aiSettings.ai_enabled) return;
      const next = Math.max(
        AI_RATE_MIN,
        Math.min(AI_RATE_MAX, aiSettings.max_messages_per_hour + delta)
      );
      if (next === aiSettings.max_messages_per_hour) return;
      const prev = aiSettings.max_messages_per_hour;
      setAiSettings((s) => ({ ...s, max_messages_per_hour: next }));
      setSavingAiKey("max_messages_per_hour");
      try {
        await axios.put(`${API}/groups/${groupId}/ai-settings`, {
          max_messages_per_hour: next,
        });
      } catch {
        toast.error("Failed to update setting");
        setAiSettings((s) => ({ ...s, max_messages_per_hour: prev }));
      } finally {
        setSavingAiKey(null);
      }
    },
    [groupId, isGroupAdmin, aiSettings.ai_enabled, aiSettings.max_messages_per_hour]
  );

  const aiStatusLabel = useMemo(() => {
    if (!aiSettings) return "";
    return aiSettings.ai_enabled ? "Kvitt is active" : "Kvitt is disabled";
  }, [aiSettings]);

  // Socket connection
  useEffect(() => {
    if (!user?.user_id || !groupId) return;

    const connectSocket = async () => {
      let authPayload = { user_id: user.user_id };

      if (isSupabaseConfigured() && supabase) {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.access_token) {
            authPayload = { token: session.access_token };
          }
        } catch {
          // Use fallback
        }
      }

      const socket = io(SOCKET_URL, {
        auth: authPayload,
        transports: ["websocket", "polling"],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
      });

      socketRef.current = socket;

      socket.on("connect", () => {
        socket.emit("join_group", { group_id: groupId });
      });

      socket.on("group_message", (msg) => {
        setMessages((prev) => {
          if (prev.some((m) => m.message_id === msg.message_id)) return prev;
          return [...prev, msg];
        });
      });

      socket.on("group_typing", (data) => {
        if (data.user_id === user.user_id) return;
        setTypingUsers((prev) => {
          if (prev.some((u) => u.user_id === data.user_id)) return prev;
          return [...prev, { user_id: data.user_id, user_name: data.user_name }];
        });

        // Clear after 3 seconds
        if (typingTimeoutsRef.current[data.user_id]) {
          clearTimeout(typingTimeoutsRef.current[data.user_id]);
        }
        typingTimeoutsRef.current[data.user_id] = setTimeout(() => {
          setTypingUsers((prev) => prev.filter((u) => u.user_id !== data.user_id));
          delete typingTimeoutsRef.current[data.user_id];
        }, 3000);
      });
    };

    connectSocket();

    return () => {
      if (socketRef.current) {
        socketRef.current.emit("leave_group", { group_id: groupId });
        socketRef.current.disconnect();
      }
      Object.values(typingTimeoutsRef.current).forEach(clearTimeout);
    };
  }, [user?.user_id, groupId]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || sending) return;
    const content = input.trim();
    setInput("");
    setSending(true);

    // Optimistic insert
    const optimisticMsg = {
      message_id: `temp_${Date.now()}`,
      group_id: groupId,
      user_id: user.user_id,
      content,
      type: "user",
      created_at: new Date().toISOString(),
      user: { user_id: user.user_id, name: user.name },
    };
    setMessages((prev) => [...prev, optimisticMsg]);

    try {
      const res = await axios.post(`${API}/groups/${groupId}/messages`, { content });
      // Replace optimistic message with real one
      setMessages((prev) =>
        prev.map((m) =>
          m.message_id === optimisticMsg.message_id
            ? { ...res.data, user: optimisticMsg.user }
            : m
        )
      );
    } catch {
      toast.error("Failed to send message");
      setMessages((prev) => prev.filter((m) => m.message_id !== optimisticMsg.message_id));
      setInput(content);
    } finally {
      setSending(false);
    }
  };

  const handleInputChange = (e) => {
    setInput(e.target.value);
    if (socketRef.current && e.target.value) {
      socketRef.current.emit("group_typing", {
        group_id: groupId,
        user_name: user?.name,
      });
    }
  };

  const getInitials = (name) => {
    if (!name) return "?";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const formatTime = (dateStr) => {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">

      {/* Chat header */}
      <div className="border-b border-border/50 px-4 py-3 bg-card/80 backdrop-blur-sm">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => navigate("/chats")}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="flex-1 min-w-0">
            <h2 className="font-medium text-sm truncate">{group?.name || "Group Chat"}</h2>
            <p className="text-xs text-muted-foreground">
              {group?.members?.length || 0} members
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 text-muted-foreground"
            aria-label="Chat settings"
            onClick={() => setSettingsOpen(true)}
          >
            <Settings2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings2 className="w-4 h-4" />
              Chat settings
            </DialogTitle>
            <DialogDescription>
              Control how Kvitt behaves in this group. Only admins can change these options.
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-center gap-2 rounded-md border border-border/60 bg-secondary/30 px-3 py-2 text-sm">
            <span
              className={`h-2 w-2 rounded-full shrink-0 ${
                aiSettings.ai_enabled ? "bg-emerald-500" : "bg-destructive"
              }`}
              aria-hidden
            />
            <span className="text-muted-foreground">{aiStatusLabel}</span>
          </div>

          <div className="space-y-1 pt-2">
            <p className="text-xs font-semibold tracking-wide text-muted-foreground">KVITT AI</p>
            <div className="rounded-lg border border-border/50 divide-y divide-border/50">
              {AI_TOGGLE_ROWS.map(({ key, label, description, Icon }) => {
                const isSub = key !== "ai_enabled";
                const disabled =
                  !isGroupAdmin || (isSub && !aiSettings.ai_enabled) || savingAiKey === key;
                const on = !!aiSettings[key];
                return (
                  <div key={key} className="flex items-start gap-3 p-3">
                    <div className="mt-0.5 text-muted-foreground">
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium leading-tight">{label}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
                        {description}
                      </p>
                      {!isGroupAdmin && (
                        <p className="text-[10px] italic text-muted-foreground mt-1">Admin only</p>
                      )}
                    </div>
                    <div className="shrink-0 pt-0.5">
                      {savingAiKey === key ? (
                        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                      ) : (
                        <button
                          type="button"
                          disabled={disabled}
                          onClick={() => updateAiToggle(key, !on)}
                          className={`w-9 h-5 rounded-full transition-colors relative disabled:opacity-40 ${
                            on ? "bg-primary" : "bg-secondary"
                          }`}
                          aria-pressed={on}
                          aria-label={label}
                        >
                          <span
                            className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform shadow-sm ${
                              on ? "translate-x-4" : "translate-x-0.5"
                            }`}
                          />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}

              <div className="flex items-start gap-3 p-3">
                <div className="mt-0.5 text-muted-foreground">
                  <Gauge className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium leading-tight">Max AI messages / hour</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
                    Rate limit for Kvitt messages ({AI_RATE_MIN}–{AI_RATE_MAX}).
                  </p>
                  {!isGroupAdmin && (
                    <p className="text-[10px] italic text-muted-foreground mt-1">Admin only</p>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    disabled={
                      !isGroupAdmin ||
                      !aiSettings.ai_enabled ||
                      savingAiKey === "max_messages_per_hour"
                    }
                    onClick={() => adjustMaxAiRate(-1)}
                    aria-label="Decrease max messages per hour"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </Button>
                  {savingAiKey === "max_messages_per_hour" ? (
                    <Loader2 className="w-4 h-4 animate-spin text-muted-foreground mx-1" />
                  ) : (
                    <span className="w-8 text-center text-sm font-semibold tabular-nums">
                      {aiSettings.max_messages_per_hour}
                    </span>
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    disabled={
                      !isGroupAdmin ||
                      !aiSettings.ai_enabled ||
                      savingAiKey === "max_messages_per_hour"
                    }
                    onClick={() => adjustMaxAiRate(1)}
                    aria-label="Increase max messages per hour"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="max-w-3xl mx-auto space-y-3">
          {messages.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <p className="text-sm">No messages yet. Start the conversation!</p>
            </div>
          )}

          {messages.map((msg) => {
            const isOwn = msg.user_id === user?.user_id;
            const isSystem = msg.type === "system";
            const isAI = msg.user_id === "ai_assistant";
            const senderName = msg.user?.name || (isAI ? "Kvitt AI" : "Unknown");

            if (isSystem) {
              return (
                <div key={msg.message_id} className="text-center">
                  <span className="text-xs text-muted-foreground italic">{msg.content}</span>
                </div>
              );
            }

            return (
              <div
                key={msg.message_id}
                className={`flex gap-2 ${isOwn ? "flex-row-reverse" : "flex-row"}`}
              >
                {!isOwn && (
                  <Avatar className="h-7 w-7 mt-1">
                    <AvatarFallback
                      className={`text-[10px] font-bold ${
                        isAI
                          ? "bg-gradient-to-br from-primary to-orange-400 text-white"
                          : "bg-primary/20 text-primary"
                      }`}
                    >
                      {isAI ? "AI" : getInitials(senderName)}
                    </AvatarFallback>
                  </Avatar>
                )}
                <div className={`max-w-[70%] ${isOwn ? "items-end" : "items-start"}`}>
                  {!isOwn && (
                    <p className="text-[10px] text-muted-foreground mb-0.5 ml-1">{senderName}</p>
                  )}
                  <div
                    className={`px-3 py-2 rounded-2xl text-sm ${
                      isOwn
                        ? "bg-primary text-primary-foreground rounded-br-md"
                        : isAI
                        ? "bg-gradient-to-br from-primary/10 to-orange-400/10 border border-primary/20 rounded-bl-md"
                        : "bg-secondary/50 rounded-bl-md"
                    }`}
                  >
                    <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                  </div>
                  <p className={`text-[10px] text-muted-foreground mt-0.5 ${isOwn ? "text-right mr-1" : "ml-1"}`}>
                    {formatTime(msg.created_at)}
                  </p>
                </div>
              </div>
            );
          })}

          {/* Typing indicator */}
          {typingUsers.length > 0 && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <div className="flex gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
              <span>
                {typingUsers.length === 1
                  ? `${typingUsers[0].user_name} is typing...`
                  : `${typingUsers.length} people typing...`}
              </span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      <div className="border-t border-border/50 bg-card/80 backdrop-blur-sm px-4 py-3">
        <div className="max-w-3xl mx-auto flex gap-2">
          <Input
            placeholder="Type a message..."
            value={input}
            onChange={handleInputChange}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
            maxLength={500}
            className="flex-1"
          />
          <Button
            size="icon"
            onClick={handleSend}
            disabled={!input.trim() || sending}
          >
            {sending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
