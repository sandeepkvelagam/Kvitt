import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import { io } from "socket.io-client";
import { useAuth } from "@/context/AuthContext";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { toast } from "sonner";
import {
  ArrowLeft,
  Send,
  Loader2,
} from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL + "/api";
const SOCKET_URL = process.env.REACT_APP_BACKEND_URL?.replace("/api", "") || "";

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
  const messagesEndRef = useRef(null);
  const socketRef = useRef(null);
  const typingTimeoutsRef = useRef({});

  // Fetch group info and messages
  useEffect(() => {
    if (!groupId) return;

    const fetchData = async () => {
      try {
        const [groupRes, messagesRes] = await Promise.all([
          axios.get(`${API}/groups/${groupId}`),
          axios.get(`${API}/groups/${groupId}/messages?limit=50`),
        ]);
        setGroup(groupRes.data);
        setMessages(messagesRes.data?.messages || messagesRes.data || []);
      } catch {
        toast.error("Failed to load chat");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [groupId]);

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
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate("/chats")}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h2 className="font-medium text-sm">{group?.name || "Group Chat"}</h2>
            <p className="text-xs text-muted-foreground">
              {group?.members?.length || 0} members
            </p>
          </div>
        </div>
      </div>

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
