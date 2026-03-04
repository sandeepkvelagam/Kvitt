import { useState, useRef, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  ArrowLeft,
  Send,
  User,
  Loader2,
  ArrowRight,
  Sparkles,
} from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL + "/api";

const SUGGESTIONS = [
  "How many groups am I in?",
  "Any active games?",
  "Who owes me money?",
  "What are my stats?",
  "Show my recent games",
  "How does buy-in work?",
];

function GradientOrb({ size = "md", animate = false }) {
  const dims = useMemo(() => {
    if (size === "lg") return "h-[80px] w-[80px]";
    if (size === "sm") return "h-[32px] w-[32px]";
    return "h-[28px] w-[28px]";
  }, [size]);

  return (
    <div className="relative grid place-items-center">
      <div className={cn("ai-orb rounded-full", dims, animate ? "animate-orb-breathe" : "")} />
    </div>
  );
}

export default function AIAssistantPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSend = async (text) => {
    const messageText = text || input.trim();
    if (!messageText || isLoading) return;

    setInput("");
    const userMessage = { role: "user", content: messageText };
    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);

    try {
      const response = await axios.post(`${API}/ai/chat`, {
        message: messageText,
        conversation_history: messages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
      });

      const aiResponse = response.data?.response || response.data?.message || "I couldn't process that.";
      const actions = response.data?.actions || [];

      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: aiResponse, actions },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Sorry, I encountered an error. Please try again." },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAction = (action) => {
    const routeMap = {
      Dashboard: "/dashboard",
      Groups: "/groups",
      GroupHub: "/groups",
      GameNight: "/games",
      Wallet: "/wallet",
      Settings: "/settings",
      Chats: "/chats",
      Notifications: "/settings/notifications",
      Automations: "/automations",
      Profile: "/profile",
    };

    if (action.screen && routeMap[action.screen]) {
      let path = routeMap[action.screen];
      if (action.params?.groupId) path = `/groups/${action.params.groupId}`;
      if (action.params?.gameId) path = `/games/${action.params.gameId}`;
      navigate(path);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">

      {/* Header */}
      <div className="border-b border-border/50 px-4 py-3 bg-card/80 backdrop-blur-sm">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <GradientOrb size="sm" animate />
          <div>
            <h2 className="font-medium text-sm">Kvitt AI Assistant</h2>
            <p className="text-xs text-muted-foreground">Ask anything about your games & stats</p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-3xl mx-auto">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12">
              <GradientOrb size="lg" animate />
              <h3 className="text-lg font-bold mt-6 mb-2">Hi{user?.name ? `, ${user.name.split(" ")[0]}` : ""}!</h3>
              <p className="text-sm text-muted-foreground text-center max-w-md mb-8">
                I can help you with game stats, group info, balances, and more. What would you like to know?
              </p>
              <div className="flex flex-wrap gap-2 justify-center max-w-lg">
                {SUGGESTIONS.map((s) => (
                  <Button
                    key={s}
                    variant="outline"
                    size="sm"
                    className="text-xs h-8"
                    onClick={() => handleSend(s)}
                  >
                    {s}
                  </Button>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-4">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}
              >
                {msg.role === "assistant" && (
                  <div className="w-7 h-7 mt-1">
                    <GradientOrb size="sm" />
                  </div>
                )}
                <div className={`max-w-[75%] ${msg.role === "user" ? "items-end" : "items-start"}`}>
                  <div
                    className={`px-4 py-3 rounded-2xl text-sm ${
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground rounded-br-md"
                        : "bg-secondary/50 rounded-bl-md"
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  </div>
                  {msg.actions?.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {msg.actions.map((action, j) => (
                        <Button
                          key={j}
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs text-primary"
                          onClick={() => handleAction(action)}
                        >
                          {action.label || action.screen}
                          <ArrowRight className="w-3 h-3 ml-1" />
                        </Button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex gap-3">
                <div className="w-7 h-7 mt-1">
                  <GradientOrb size="sm" animate />
                </div>
                <div className="bg-secondary/50 rounded-2xl rounded-bl-md px-4 py-3">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              </div>
            )}
          </div>

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      <div className="border-t border-border/50 bg-card/80 backdrop-blur-sm px-4 py-3">
        <div className="max-w-3xl mx-auto flex gap-2">
          <Input
            ref={inputRef}
            placeholder="Ask anything..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
            className="flex-1"
          />
          <Button
            size="icon"
            onClick={() => handleSend()}
            disabled={!input.trim() || isLoading}
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
