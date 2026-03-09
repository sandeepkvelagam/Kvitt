import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  ArrowLeft,
  Bug,
  Lightbulb,
  Hand,
  Frown,
  Heart,
  MessageCircle,
  Star,
  CheckCircle,
  Clock,
  AlertCircle,
  Loader2,
  Send,
  ChevronDown,
  ChevronUp,
  ArrowRightLeft,
  User,
  XCircle,
} from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL + "/api";

const FEEDBACK_TYPES = [
  { key: "bug", label: "Bug Report", icon: Bug, color: "text-red-400", bgColor: "bg-red-400/10" },
  { key: "feature_request", label: "Feature Request", icon: Lightbulb, color: "text-amber-400", bgColor: "bg-amber-400/10" },
  { key: "ux_issue", label: "UX Issue", icon: Hand, color: "text-blue-400", bgColor: "bg-blue-400/10" },
  { key: "complaint", label: "Complaint", icon: Frown, color: "text-purple-400", bgColor: "bg-purple-400/10" },
  { key: "praise", label: "Praise", icon: Heart, color: "text-green-400", bgColor: "bg-green-400/10" },
  { key: "other", label: "Other", icon: MessageCircle, color: "text-muted-foreground", bgColor: "bg-secondary/50" },
];

const STATUS_ICONS = {
  open: { icon: Clock, color: "text-amber-400", label: "Open" },
  new: { icon: Clock, color: "text-amber-400", label: "New" },
  classified: { icon: AlertCircle, color: "text-indigo-400", label: "Classified" },
  in_progress: { icon: Loader2, color: "text-blue-400", label: "In Progress" },
  needs_user_info: { icon: MessageCircle, color: "text-orange-400", label: "Needs Your Reply" },
  needs_host_action: { icon: AlertCircle, color: "text-orange-400", label: "Under Review" },
  auto_fixed: { icon: CheckCircle, color: "text-cyan-400", label: "Auto Fixed" },
  resolved: { icon: CheckCircle, color: "text-green-400", label: "Resolved" },
  responded: { icon: MessageCircle, color: "text-primary", label: "Responded" },
  wont_fix: { icon: XCircle, color: "text-muted-foreground", label: "Closed" },
  duplicate: { icon: AlertCircle, color: "text-muted-foreground", label: "Duplicate" },
  closed: { icon: CheckCircle, color: "text-muted-foreground", label: "Closed" },
};

export default function Feedback() {
  const navigate = useNavigate();
  const [view, setView] = useState("form"); // "form" | "success" | "history"
  const [feedbackType, setFeedbackType] = useState("");
  const [content, setContent] = useState("");
  const [severity, setSeverity] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [feedbackId, setFeedbackId] = useState("");
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Detail/thread state
  const [selectedFeedbackId, setSelectedFeedbackId] = useState(null);
  const [threadEvents, setThreadEvents] = useState([]);
  const [threadLoading, setThreadLoading] = useState(false);
  const [replyMessage, setReplyMessage] = useState("");
  const [replySubmitting, setReplySubmitting] = useState(false);

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    setHistoryLoading(true);
    try {
      const res = await axios.get(`${API}/feedback/my`);
      setHistory(res.data?.feedback || []);
    } catch {
      // Silently fail
    } finally {
      setHistoryLoading(false);
    }
  };

  const fetchThread = useCallback(async (fbId) => {
    setThreadLoading(true);
    try {
      const res = await axios.get(`${API}/feedback/${fbId}/thread`);
      setThreadEvents(res.data?.events || []);
    } catch {
      setThreadEvents([]);
    } finally {
      setThreadLoading(false);
    }
  }, []);

  const handleSelectFeedback = (fbId) => {
    if (selectedFeedbackId === fbId) {
      // Collapse
      setSelectedFeedbackId(null);
      setThreadEvents([]);
      setReplyMessage("");
    } else {
      setSelectedFeedbackId(fbId);
      fetchThread(fbId);
      setReplyMessage("");
    }
  };

  const handleSubmit = async () => {
    if (!feedbackType || !content.trim()) return;
    setSubmitting(true);

    try {
      const tags = severity > 0 ? [`severity_${severity}`] : [];
      const res = await axios.post(`${API}/feedback`, {
        feedback_type: feedbackType,
        content: content.trim(),
        tags,
        context: {
          source: "web_feedback_page",
          ...(severity > 0 && { severity_rating: severity }),
        },
      });
      setFeedbackId(res.data?.data?.feedback_id || res.data?.feedback_id || "");
      setView("success");
      fetchHistory();
    } catch {
      toast.error("Failed to submit feedback");
    } finally {
      setSubmitting(false);
    }
  };

  const handleReply = async (e) => {
    e.preventDefault();
    const message = replyMessage.trim();
    if (!message || !selectedFeedbackId) return;

    setReplySubmitting(true);
    try {
      await axios.post(`${API}/feedback/${selectedFeedbackId}/reply`, { message });
      toast.success("Reply sent");
      setReplyMessage("");
      fetchThread(selectedFeedbackId);
      fetchHistory(); // refresh status
    } catch (error) {
      const detail = error.response?.data?.detail || "Failed to send reply";
      toast.error(detail);
    } finally {
      setReplySubmitting(false);
    }
  };

  const resetForm = () => {
    setFeedbackType("");
    setContent("");
    setSeverity(0);
    setView("form");
  };

  const getRelativeTime = (dateStr) => {
    const now = new Date();
    const date = new Date(dateStr);
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 30) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const needsSeverity = feedbackType === "bug" || feedbackType === "complaint";

  return (
    <div className="min-h-screen bg-background">

      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center text-muted-foreground hover:text-foreground mb-4 transition-colors text-sm"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </button>

        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="font-heading text-2xl font-bold">Report an Issue</h1>
            <p className="text-sm text-muted-foreground mt-1">Every submission is reviewed by our team</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setView(view === "history" ? "form" : "history");
              setSelectedFeedbackId(null);
              setThreadEvents([]);
            }}
          >
            {view === "history" ? "New Report" : `History (${history.length})`}
          </Button>
        </div>

        {/* Form view */}
        {view === "form" && (
          <div className="space-y-4">
            {/* Category selector */}
            <Card className="bg-card border-border/50">
              <CardHeader className="px-4 py-3">
                <CardTitle className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                  Category
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {FEEDBACK_TYPES.map((type) => {
                    const selected = feedbackType === type.key;
                    return (
                      <button
                        key={type.key}
                        onClick={() => setFeedbackType(type.key)}
                        className={`flex items-center gap-2 p-3 rounded-lg border text-sm transition-colors ${
                          selected
                            ? "border-primary bg-primary/5 text-foreground"
                            : "border-border/50 hover:bg-secondary/30 text-muted-foreground"
                        }`}
                      >
                        <type.icon className={`w-4 h-4 ${selected ? type.color : ""}`} />
                        <span className="text-xs font-medium">{type.label}</span>
                        {selected && <CheckCircle className="w-3 h-3 ml-auto text-primary" />}
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Description */}
            <Card className="bg-card border-border/50">
              <CardHeader className="px-4 py-3">
                <CardTitle className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                  Details
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value.slice(0, 1000))}
                  placeholder={
                    feedbackType === "bug"
                      ? "Describe the bug — what happened, what you expected..."
                      : feedbackType === "feature_request"
                      ? "Describe the feature you'd like to see..."
                      : "Tell us more..."
                  }
                  className="w-full min-h-[120px] bg-secondary/30 border border-border/50 rounded-lg p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
                <p className={`text-[10px] text-right mt-1 ${
                  content.length > 800 ? (content.length > 950 ? "text-destructive" : "text-amber-500") : "text-muted-foreground"
                }`}>
                  {content.length}/1000
                </p>
              </CardContent>
            </Card>

            {/* Severity */}
            {needsSeverity && (
              <Card className="bg-card border-border/50">
                <CardHeader className="px-4 py-3">
                  <CardTitle className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                    Impact / Severity
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button
                        key={n}
                        onClick={() => setSeverity(n)}
                        className="p-1"
                      >
                        <Star
                          className={`w-6 h-6 transition-colors ${
                            n <= severity
                              ? "fill-primary text-primary"
                              : "text-muted-foreground/30"
                          }`}
                        />
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Submit */}
            <Button
              className="w-full"
              onClick={handleSubmit}
              disabled={!feedbackType || !content.trim() || submitting}
            >
              {submitting ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Send className="w-4 h-4 mr-2" />
              )}
              Submit Report
            </Button>
            <p className="text-[10px] text-muted-foreground text-center">
              Your report is linked to your account for follow-up
            </p>
          </div>
        )}

        {/* Success view */}
        {view === "success" && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <CheckCircle className="w-8 h-8 text-primary" />
            </div>
            <h2 className="text-xl font-bold mb-2">Thank You!</h2>
            <p className="text-sm text-muted-foreground max-w-sm mb-4">
              {feedbackType === "praise"
                ? "We really appreciate the kind words! It means a lot to the team."
                : "Your feedback has been received. We'll review it and take action."}
            </p>
            {feedbackId && (
              <div className="px-3 py-1.5 rounded-full bg-secondary/50 text-xs font-mono mb-6">
                Ref: {feedbackId}
              </div>
            )}
            <div className="flex gap-2">
              <Button variant="outline" onClick={resetForm}>
                Submit Another
              </Button>
              <Button onClick={() => navigate(-1)}>
                Done
              </Button>
            </div>
          </div>
        )}

        {/* History view */}
        {view === "history" && (
          <div>
            {historyLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : history.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <MessageCircle className="w-10 h-10 mx-auto mb-3 opacity-50" />
                <p className="text-sm">No feedback submitted yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {history.map((item) => {
                  const typeInfo = FEEDBACK_TYPES.find((t) => t.key === (item.feedback_type || item.type)) || FEEDBACK_TYPES[5];
                  const statusInfo = STATUS_ICONS[item.status] || STATUS_ICONS.open;
                  const StatusIcon = statusInfo.icon;
                  const isSelected = selectedFeedbackId === item.feedback_id;
                  const canReply = item.status !== "wont_fix" && item.status !== "duplicate";

                  return (
                    <div key={item.feedback_id}>
                      {/* Card header — clickable */}
                      <Card
                        className={`bg-card border-border/50 p-4 cursor-pointer transition-all hover:border-primary/30 ${
                          isSelected ? "border-primary/50 ring-1 ring-primary/20" : ""
                        }`}
                        onClick={() => handleSelectFeedback(item.feedback_id)}
                      >
                        <div className="flex items-start gap-3">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${typeInfo.bgColor}`}>
                            <typeInfo.icon className={`w-4 h-4 ${typeInfo.color}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <Badge variant="secondary" className="text-[10px]">
                                {typeInfo.label}
                              </Badge>
                              <Badge variant="outline" className={`text-[10px] ${statusInfo.color}`}>
                                <StatusIcon className="w-3 h-3 mr-1" />
                                {statusInfo.label}
                              </Badge>
                            </div>
                            <p className="text-sm line-clamp-2">{item.content}</p>
                            <p className="text-[10px] text-muted-foreground mt-1">
                              {item.created_at ? getRelativeTime(item.created_at) : ""}
                            </p>
                          </div>
                          <div className="ml-2 mt-1">
                            {isSelected ? (
                              <ChevronUp className="w-4 h-4 text-muted-foreground" />
                            ) : (
                              <ChevronDown className="w-4 h-4 text-muted-foreground" />
                            )}
                          </div>
                        </div>
                      </Card>

                      {/* Expanded detail — thread + reply */}
                      {isSelected && (
                        <div className="mt-1 rounded-lg border border-border/30 bg-card/50 overflow-hidden">
                          {/* Full content */}
                          <div className="px-4 py-3 border-b border-border/30">
                            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Full Report</p>
                            <p className="text-sm whitespace-pre-wrap">{item.content}</p>
                          </div>

                          {/* Thread */}
                          <div className="px-4 py-3">
                            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">Conversation</p>

                            {threadLoading ? (
                              <div className="flex items-center justify-center py-6">
                                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                              </div>
                            ) : threadEvents.length === 0 ? (
                              <p className="text-sm text-muted-foreground text-center py-4">
                                No responses yet. We'll get back to you soon.
                              </p>
                            ) : (
                              <div className="space-y-3">
                                {threadEvents.map((event, idx) => {
                                  const isAdminResponse = event.event_type === "admin_response";
                                  const isUserReply = event.event_type === "user_reply";
                                  const isStatusChange = event.event_type === "status_change" || event.event_type === "status_updated";

                                  return (
                                    <div key={idx} className="flex gap-3">
                                      <div className="flex flex-col items-center">
                                        <div className={`w-7 h-7 rounded-full flex items-center justify-center ${
                                          isAdminResponse ? "bg-primary/10" :
                                          isUserReply ? "bg-blue-500/10" :
                                          "bg-secondary/50"
                                        }`}>
                                          {isAdminResponse ? (
                                            <MessageCircle className="w-3.5 h-3.5 text-primary" />
                                          ) : isUserReply ? (
                                            <User className="w-3.5 h-3.5 text-blue-400" />
                                          ) : (
                                            <ArrowRightLeft className="w-3.5 h-3.5 text-muted-foreground" />
                                          )}
                                        </div>
                                        {idx < threadEvents.length - 1 && (
                                          <div className="w-px flex-1 bg-border/50 my-1" />
                                        )}
                                      </div>
                                      <div className="flex-1 pb-3">
                                        <div className="flex items-center gap-2 mb-1">
                                          <span className={`text-[10px] font-semibold uppercase ${
                                            isAdminResponse ? "text-primary" :
                                            isUserReply ? "text-blue-400" :
                                            "text-muted-foreground"
                                          }`}>
                                            {isAdminResponse ? "Team Response" :
                                             isUserReply ? "Your Reply" :
                                             "Status Update"}
                                          </span>
                                          <span className="text-[10px] text-muted-foreground">
                                            {getRelativeTime(event.ts)}
                                          </span>
                                        </div>
                                        {(isAdminResponse || isUserReply) && event.message && (
                                          <div className={`p-2.5 rounded-lg text-sm ${
                                            isAdminResponse
                                              ? "border-l-2 border-primary/50 bg-primary/5"
                                              : "border-l-2 border-blue-500/50 bg-blue-500/5"
                                          }`}>
                                            <p className="whitespace-pre-wrap">{event.message}</p>
                                          </div>
                                        )}
                                        {isStatusChange && event.details && (
                                          <p className="text-xs text-muted-foreground">
                                            {event.details.old_status && (
                                              <><span>{event.details.old_status}</span><span className="mx-1">→</span></>
                                            )}
                                            <span className="font-medium">{event.details.new_status || event.details.status || "updated"}</span>
                                          </p>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>

                          {/* Reply form */}
                          {canReply && (
                            <form onSubmit={handleReply} className="px-4 py-3 border-t border-border/30">
                              <textarea
                                value={replyMessage}
                                onChange={(e) => setReplyMessage(e.target.value.slice(0, 2000))}
                                placeholder="Type your reply..."
                                className="w-full min-h-[80px] bg-secondary/30 border border-border/50 rounded-lg p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/50"
                              />
                              <div className="flex items-center justify-between mt-2">
                                <span className="text-[10px] text-muted-foreground">
                                  {replyMessage.length}/2000
                                </span>
                                <Button
                                  type="submit"
                                  size="sm"
                                  disabled={replySubmitting || !replyMessage.trim()}
                                >
                                  {replySubmitting ? (
                                    <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                                  ) : (
                                    <Send className="w-3 h-3 mr-1" />
                                  )}
                                  Send Reply
                                </Button>
                              </div>
                            </form>
                          )}

                          {/* Wont_fix notice */}
                          {!canReply && (
                            <div className="px-4 py-3 border-t border-border/30 text-center">
                              <p className="text-xs text-muted-foreground">This report has been closed and cannot receive replies.</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
