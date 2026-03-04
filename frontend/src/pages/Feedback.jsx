import { useState, useEffect } from "react";
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
} from "lucide-react";
import Navbar from "@/components/Navbar";

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
  in_progress: { icon: Loader2, color: "text-blue-400", label: "In Progress" },
  resolved: { icon: CheckCircle, color: "text-green-400", label: "Resolved" },
  responded: { icon: MessageCircle, color: "text-primary", label: "Responded" },
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

  const resetForm = () => {
    setFeedbackType("");
    setContent("");
    setSeverity(0);
    setView("form");
  };

  const needsSeverity = feedbackType === "bug" || feedbackType === "complaint";

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

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
            onClick={() => setView(view === "history" ? "form" : "history")}
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
              <Button onClick={() => navigate("/dashboard")}>
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
                  const typeInfo = FEEDBACK_TYPES.find((t) => t.key === item.feedback_type) || FEEDBACK_TYPES[5];
                  const statusInfo = STATUS_ICONS[item.status] || STATUS_ICONS.open;
                  const StatusIcon = statusInfo.icon;
                  return (
                    <Card key={item.feedback_id} className="bg-card border-border/50 p-4">
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
                            {item.created_at ? new Date(item.created_at).toLocaleDateString() : ""}
                          </p>
                        </div>
                      </div>
                    </Card>
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
