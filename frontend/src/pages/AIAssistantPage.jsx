import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  ArrowLeft,
  Send,
  User,
  Loader2,
  ExternalLink,
  Sparkles,
} from "lucide-react";
import { RichTextRenderer } from "@/components/chat/RichTextRenderer";
import { StructuredMessageRenderer } from "@/components/chat/StructuredMessageRenderer";
import { useTypingAnimation } from "@/components/chat/useTypingAnimation";

const API = process.env.REACT_APP_BACKEND_URL + "/api";
const STORAGE_KEY = "kvitt_assistant_page_chat";

// Pool of 16 suggestions — 5 randomly chosen per session
const SUGGESTION_POOL = [
  "How many groups am I in?",
  "Any active games?",
  "Who owes me money?",
  "What are my stats?",
  "How does buy-in work?",
  "Show my recent games",
  "How do I create a group?",
  "How do I invite friends?",
  "How does settlement work?",
  "What is cash out?",
  "How do I start a game?",
  "How does rebuy work?",
  "Show my groups",
  "What are poker hand rankings?",
  "How do I report an issue?",
  "What are my badges?",
];

// Route map for navigation from AI responses
const WEB_NAV_MAP = {
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
  SettlementHistory: "/settlements",
  RequestAndPay: "/request-pay",
  PendingRequests: "/pending-requests",
};

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
  const [requestsRemaining, setRequestsRemaining] = useState(null);
  const [flowInteractions, setFlowInteractions] = useState({});
  const [typingIdx, setTypingIdx] = useState(-1);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Randomly pick 5 suggestions per session
  const suggestions = useMemo(() => {
    const shuffled = [...SUGGESTION_POOL].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, 5);
  }, []);

  // Typing animation for latest assistant message
  const latestMsg = typingIdx >= 0 ? messages[typingIdx] : null;
  const { displayedText, isTyping } = useTypingAnimation(
    latestMsg?.content || "",
    typingIdx >= 0,
    25
  );

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, displayedText]);

  useEffect(() => {
    if (!isLoading && !isTyping) inputRef.current?.focus();
  }, [isLoading, isTyping]);

  // Restore chat from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setMessages(parsed);
        }
      }
    } catch {}
  }, []);

  // Persist chat to localStorage
  useEffect(() => {
    if (messages.length > 0) {
      try {
        const toSave = messages.filter((m) => !m.error);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
      } catch {}
    }
  }, [messages]);

  // Fetch usage on mount
  useEffect(() => {
    axios.get(`${API}/assistant/usage`).then((res) => {
      setRequestsRemaining(res.data.requests_remaining);
    }).catch(() => {});
  }, []);

  const addAssistantMessage = useCallback((msgData, thinkingDelay = false) => {
    const delay = thinkingDelay ? 1200 : 0;
    setTimeout(() => {
      setMessages((prev) => {
        const newMessages = [...prev, msgData];
        setTypingIdx(newMessages.length - 1);
        const charCount = (msgData.content || "").length;
        setTimeout(() => setTypingIdx(-1), charCount * 25 + 200);
        return newMessages;
      });
    }, delay);
  }, []);

  const handleSend = async (text, flowEvent = null) => {
    const messageText = (text || input).trim();
    if (!messageText || isLoading) return;

    setInput("");
    const userMessage = { role: "user", content: messageText };
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setIsLoading(true);

    try {
      const history = updatedMessages
        .slice(-20)
        .map(({ role, content }) => ({ role, content }));

      const payload = {
        message: messageText,
        context: { current_page: "ai" },
        conversation_history: history,
      };
      if (flowEvent) {
        payload.flow_event = flowEvent;
      }

      const response = await axios.post(`${API}/assistant/ask`, payload);
      const data = response.data;
      const isFast = data.source === "quick_answer" || data.source === "fast_answer";

      const assistantMsg = {
        role: "assistant",
        content: data.response || data.message || "I couldn't process that.",
        source: data.source,
        navigation: data.navigation || null,
        followUps: data.follow_ups || [],
        structuredContent: data.structured_content || null,
        agentActivity: data.agent_activity || null,
      };

      if (data.requests_remaining !== undefined) {
        setRequestsRemaining(data.requests_remaining);
      }

      addAssistantMessage(assistantMsg, isFast);
    } catch (error) {
      if (error?.response?.status === 429) {
        const upgradeMsg = error.response.data?.upgrade_message || "Daily limit reached. Upgrade to Premium for more.";
        setMessages((prev) => [...prev, { role: "assistant", content: upgradeMsg, error: true }]);
      } else {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: "Sorry, I encountered an error. Please try again.", error: true },
        ]);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleFlowAction = useCallback((flowEvent, msgIndex) => {
    setFlowInteractions((prev) => ({
      ...prev,
      [msgIndex]: {
        selectedValue: flowEvent.action === "option_selected" ? flowEvent.value : prev[msgIndex]?.selectedValue,
        submittedText: flowEvent.action === "text_submitted" ? flowEvent.value : prev[msgIndex]?.submittedText,
        actedAction: !["option_selected", "text_submitted"].includes(flowEvent.action) ? flowEvent.action : prev[msgIndex]?.actedAction,
      },
    }));
    const actionLabel = flowEvent.action === "option_selected" || flowEvent.action === "text_submitted"
      ? flowEvent.value : flowEvent.action;
    handleSend(actionLabel, flowEvent);
  }, [messages]);

  const handleNavigation = (nav) => {
    if (nav?.screen && WEB_NAV_MAP[nav.screen]) {
      navigate(WEB_NAV_MAP[nav.screen]);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="border-b border-border/50 px-4 py-3 bg-card/80 backdrop-blur-sm">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate(-1)}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <GradientOrb size="sm" animate />
            <div>
              <div className="flex items-center gap-1.5">
                <h2 className="font-medium text-sm">Kvitt AI Assistant</h2>
                <span className="text-[9px] font-bold tracking-wide bg-violet-500/15 text-violet-400 px-1.5 py-0.5 rounded">BETA</span>
              </div>
              <p className="text-xs text-muted-foreground">
                {requestsRemaining !== null ? `${requestsRemaining} requests left` : "Ask anything about your games & stats"}
              </p>
            </div>
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
                {suggestions.map((s) => (
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
            {messages.map((msg, i) => {
              const isLastAssistant = msg.role === "assistant" && !msg.error &&
                i === [...messages].reduce((last, m, idx) => m.role === "assistant" && !m.error ? idx : last, -1);

              return (
                <div
                  key={i}
                  className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}
                >
                  {msg.role === "assistant" && (
                    <div className="w-7 h-7 mt-1 flex-shrink-0">
                      <GradientOrb size="sm" />
                    </div>
                  )}
                  <div className={`max-w-[75%] ${msg.role === "user" ? "items-end" : "items-start"}`}>
                    <div
                      className={cn(
                        "px-4 py-3 rounded-2xl text-sm",
                        msg.role === "user"
                          ? "bg-primary text-primary-foreground rounded-br-md"
                          : msg.error
                          ? "bg-destructive/10 text-destructive rounded-bl-md"
                          : "bg-secondary/50 rounded-bl-md"
                      )}
                    >
                      {msg.role === "user" ? (
                        <p className="whitespace-pre-wrap">{msg.content}</p>
                      ) : i === typingIdx && isTyping ? (
                        <span className="whitespace-pre-wrap">
                          <RichTextRenderer text={displayedText} />
                          <span className="inline-block w-0.5 h-4 bg-foreground animate-blink ml-0.5 align-middle" />
                        </span>
                      ) : (
                        <>
                          <RichTextRenderer text={msg.content} className="whitespace-pre-wrap" />
                          {(msg.source === "quick_answer" || msg.source === "fast_answer") && (
                            <p className="text-[10px] opacity-50 mt-1">⚡ Instant</p>
                          )}
                        </>
                      )}
                    </div>

                    {/* Agent activity chip */}
                    {msg.agentActivity && (
                      <div className="flex items-center gap-1.5 mt-2 mb-1">
                        <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-[11px] font-medium">
                          <Sparkles className="w-3 h-3" />
                          {msg.agentActivity}
                        </div>
                      </div>
                    )}

                    {/* Structured content cards */}
                    {msg.structuredContent && (
                      <div className="mt-2">
                        <StructuredMessageRenderer
                          content={msg.structuredContent}
                          isLatest={isLastAssistant}
                          onFlowAction={(event) => handleFlowAction(event, i)}
                          selectedValue={flowInteractions[i]?.selectedValue}
                          submittedText={flowInteractions[i]?.submittedText}
                          actedAction={flowInteractions[i]?.actedAction}
                        />
                      </div>
                    )}

                    {/* Navigation CTA */}
                    {msg.navigation && WEB_NAV_MAP[msg.navigation.screen] && (
                      <div className="mt-2">
                        <button
                          onClick={() => handleNavigation(msg.navigation)}
                          className="inline-flex items-center gap-1.5 text-xs font-medium text-violet-600 dark:text-violet-400 bg-violet-500/10 hover:bg-violet-500/20 px-3 py-1.5 rounded-full transition-colors"
                        >
                          <ExternalLink className="w-3 h-3" />
                          Go to {msg.navigation.screen}
                        </button>
                      </div>
                    )}

                    {/* Follow-up chips */}
                    {isLastAssistant && msg.followUps?.length > 0 && !isLoading && !isTyping && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {msg.followUps.map((s, j) => (
                          <button
                            key={j}
                            onClick={() => handleSend(s)}
                            className="text-xs px-2.5 py-1 bg-secondary/50 hover:bg-secondary rounded-full text-muted-foreground hover:text-foreground transition-colors"
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {msg.role === "user" && (
                    <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                      <User className="w-3.5 h-3.5 text-primary-foreground" />
                    </div>
                  )}
                </div>
              );
            })}

            {isLoading && (
              <div className="flex gap-3">
                <div className="w-7 h-7 mt-1 flex-shrink-0">
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
            placeholder="Message Kvitt..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
            className="flex-1"
            disabled={isLoading}
          />
          <Button
            size="icon"
            onClick={() => handleSend()}
            disabled={!input.trim() || isLoading}
            className="bg-violet-600 text-white hover:bg-violet-700"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
