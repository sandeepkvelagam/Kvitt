import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import debounce from "lodash.debounce";
import { useAdminFeedbackSocket } from "@/hooks/useAdminFeedbackSocket";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  ArrowLeft, RefreshCw, Send, User, Clock, AlertCircle,
  MessageSquare, Bug, Lightbulb, AlertTriangle, ThumbsUp,
  HelpCircle, ArrowRightLeft, Sparkles, Copy, FileText, CheckCircle
} from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL + "/api";

const TYPE_CONFIG = {
  bug: { label: "Bug", color: "bg-red-500/20 text-red-400 border-red-500/30", icon: Bug },
  complaint: { label: "Complaint", color: "bg-orange-500/20 text-orange-400 border-orange-500/30", icon: AlertTriangle },
  feature_request: { label: "Feature Request", color: "bg-blue-500/20 text-blue-400 border-blue-500/30", icon: Lightbulb },
  ux_issue: { label: "UX Issue", color: "bg-purple-500/20 text-purple-400 border-purple-500/30", icon: HelpCircle },
  praise: { label: "Praise", color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30", icon: ThumbsUp },
  other: { label: "Other", color: "bg-slate-500/20 text-slate-400 border-slate-500/30", icon: MessageSquare },
};

const STATUS_CONFIG = {
  new: { label: "New", color: "bg-blue-500/20 text-blue-400" },
  open: { label: "Open", color: "bg-blue-500/20 text-blue-400" },
  classified: { label: "Classified", color: "bg-indigo-500/20 text-indigo-400" },
  in_progress: { label: "In Progress", color: "bg-yellow-500/20 text-yellow-400" },
  needs_user_info: { label: "Needs Info", color: "bg-orange-500/20 text-orange-400" },
  needs_host_action: { label: "Needs Host", color: "bg-orange-500/20 text-orange-400" },
  auto_fixed: { label: "Auto Fixed", color: "bg-cyan-500/20 text-cyan-400" },
  resolved: { label: "Resolved", color: "bg-emerald-500/20 text-emerald-400" },
  wont_fix: { label: "Won't Fix", color: "bg-slate-500/20 text-slate-400" },
  duplicate: { label: "Duplicate", color: "bg-slate-500/20 text-slate-400" },
};

// Allowed transitions for the status dropdown
const ALLOWED_TRANSITIONS = {
  new: ["in_progress", "needs_user_info", "resolved", "wont_fix"],
  open: ["in_progress", "needs_user_info", "resolved", "wont_fix"],
  classified: ["in_progress", "needs_user_info", "resolved", "wont_fix"],
  in_progress: ["needs_user_info", "resolved", "wont_fix"],
  needs_user_info: ["in_progress", "resolved", "wont_fix"],
  needs_host_action: ["in_progress", "resolved", "wont_fix"],
  resolved: ["in_progress"],
};

// Simple classification-based suggestions
const STATUS_SUGGESTIONS = {
  bug: "in_progress",
  complaint: "in_progress",
  feature_request: "classified",
  ux_issue: "in_progress",
  praise: "resolved",
  other: "in_progress",
};

/** Human-readable status change label for timeline */
function formatStatusChange(event) {
  const { old_status, new_status, status } = event?.details || {};
  const from = old_status || status;
  const to = new_status || status || "updated";
  const fromLabel = STATUS_CONFIG[from]?.label || from;
  const toLabel = STATUS_CONFIG[to]?.label || to;

  if (!from && to) return `Marked as ${toLabel}`;
  if (from === "resolved" && (to === "in_progress" || to === "needs_user_info"))
    return `Reopened to ${toLabel}`;
  if (to === "resolved") return `Marked as Resolved`;
  if (to === "wont_fix") return `Marked as Won't Fix`;
  if (from && to) return `${fromLabel} → ${toLabel}`;
  return toLabel;
}

const DRAFT_TEMPLATES = {
  bug: "Thank you for reporting this bug. We've identified the issue and our team is working on a fix. We'll update you once it's resolved.",
  complaint: "We appreciate you bringing this to our attention. We take your feedback seriously and are reviewing the situation. We'll follow up with next steps shortly.",
  feature_request: "Thanks for the feature suggestion! We've logged this for our product team to review. We'll keep you updated on any progress.",
  ux_issue: "Thank you for flagging this UX issue. We're looking into ways to improve this experience. Your feedback helps us make the app better.",
  praise: "Thank you for the kind words! We're glad you're enjoying the experience. Your feedback motivates our team.",
  other: "Thank you for reaching out. We've received your report and will review it. We'll get back to you if we need any additional information.",
};

export default function UserReportDetail() {
  const { feedbackId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState(null);
  const [thread, setThread] = useState([]);
  const [responseMessage, setResponseMessage] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showAssist, setShowAssist] = useState(true);
  const [aiDraft, setAiDraft] = useState(null);
  const [aiDraftLoading, setAiDraftLoading] = useState(false);
  const [similarReports, setSimilarReports] = useState([]);
  const [similarLoading, setSimilarLoading] = useState(false);
  const [fetchError, setFetchError] = useState(null);
  const textareaRef = useRef(null);

  const fetchReport = useCallback(async () => {
    try {
      setFetchError(null);
      const [reportRes, threadRes] = await Promise.all([
        axios.get(`${API}/admin/feedback/${feedbackId}`),
        axios.get(`${API}/feedback/${feedbackId}/thread`).catch(() => ({ data: { events: [] } })),
      ]);
      setReport(reportRes.data);
      setThread(threadRes.data?.events || []);
    } catch (error) {
      const status = error.response?.status;
      const detail = error.response?.data?.detail || "Failed to load report";
      console.error("Error fetching report:", status, detail);
      setFetchError({ status, detail });
      toast.error(detail);
    } finally {
      setLoading(false);
    }
  }, [feedbackId]);

  // Fetch AI draft and similar reports on mount (non-blocking)
  const fetchAiDraft = useCallback(async () => {
    setAiDraftLoading(true);
    try {
      const res = await axios.post(`${API}/admin/feedback/${feedbackId}/ai-draft`);
      setAiDraft(res.data);
    } catch (err) {
      console.error("AI draft fetch failed:", err);
      // Fallback handled by template display
    } finally {
      setAiDraftLoading(false);
    }
  }, [feedbackId]);

  const fetchSimilar = useCallback(async () => {
    setSimilarLoading(true);
    try {
      const res = await axios.get(`${API}/admin/feedback/${feedbackId}/similar`);
      setSimilarReports(res.data?.similar || []);
    } catch (err) {
      console.error("Similar reports fetch failed:", err);
    } finally {
      setSimilarLoading(false);
    }
  }, [feedbackId]);

  // Debounced refresh for real-time updates (avoid redundant requests on rapid events)
  const debouncedFetchReport = useMemo(
    () => debounce(() => fetchReport(), 400),
    [fetchReport]
  );

  // Real-time: subscribe to feedback room, refresh on updates
  useAdminFeedbackSocket(feedbackId, debouncedFetchReport);

  useEffect(() => {
    return () => debouncedFetchReport.cancel();
  }, [debouncedFetchReport]);

  useEffect(() => {
    fetchReport();
    fetchAiDraft();
    fetchSimilar();
  }, [fetchReport]);

  const handleSendResponse = async (e) => {
    e.preventDefault();
    const message = responseMessage.trim();
    if (!message) return;

    setSubmitting(true);
    try {
      const payload = { message };
      if (selectedStatus) {
        payload.new_status = selectedStatus;
      }
      payload.idempotency_key = `${feedbackId}_${Date.now()}`;

      await axios.post(`${API}/admin/feedback/${feedbackId}/respond`, payload);
      toast.success("Response sent");
      setResponseMessage("");
      setSelectedStatus("");
      fetchReport();
    } catch (error) {
      const detail = error.response?.data?.detail ?? "Failed to send response";
      const status = error.response?.status;
      console.error("Send response failed:", status, detail, error);
      const msg = typeof detail === "string" ? detail : Array.isArray(detail) ? detail.map((d) => d?.msg || d).join("; ") : String(detail);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleUseDraft = (draft) => {
    setResponseMessage(draft);
    textareaRef.current?.focus();
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

  if (loading) {
    return (
      <div className="min-h-screen bg-[#060918] flex items-center justify-center">
        <div className="w-12 h-12 rounded-full border-2 border-orange-500/30 border-t-orange-400 animate-spin" />
      </div>
    );
  }

  if (!report) {
    return (
      <div className="min-h-screen bg-[#060918] flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          {fetchError ? (
            <>
              <p className="text-slate-400 mb-2">
                {fetchError.status === 404 ? "Report not found" : `Error ${fetchError.status || ""}`}
              </p>
              {fetchError.detail && fetchError.status !== 404 && (
                <p className="text-xs text-slate-500 max-w-md mx-auto mb-4 font-mono bg-slate-800/50 p-2 rounded">
                  {fetchError.detail}
                </p>
              )}
            </>
          ) : (
            <p className="text-slate-400">Report not found</p>
          )}
          <Button variant="ghost" className="mt-4" onClick={() => navigate("/admin/feedback")}>
            Back to Reports
          </Button>
        </div>
      </div>
    );
  }

  const typeConf = TYPE_CONFIG[report.type] || TYPE_CONFIG.other;
  const statusConf = STATUS_CONFIG[report.status] || STATUS_CONFIG.open;
  const TypeIcon = typeConf.icon;
  const allowedTransitions = ALLOWED_TRANSITIONS[report.status] || [];
  const suggestedStatus = STATUS_SUGGESTIONS[report.type] || "in_progress";
  const draftReply = DRAFT_TEMPLATES[report.type] || DRAFT_TEMPLATES.other;

  return (
    <div className="min-h-screen bg-[#060918] text-slate-100">
      {/* Background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
        <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full opacity-[0.05]"
          style={{ background: 'radial-gradient(circle, #f97316, transparent 70%)' }} />
      </div>

      <main className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/admin/feedback")}
            className="text-slate-400 hover:text-slate-200 mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to Reports
          </Button>

          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2 flex-wrap">
                <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-mono rounded border ${typeConf.color}`}>
                  <TypeIcon className="w-3 h-3" />
                  {typeConf.label}
                </span>
                <span className={`px-2 py-1 text-xs font-mono rounded ${statusConf.color}`}>
                  {statusConf.label}
                </span>
                {report.priority && report.priority !== "normal" && (
                  <span className="px-2 py-1 text-xs font-mono rounded border bg-orange-500/20 text-orange-400 border-orange-500/30">
                    {report.priority}
                  </span>
                )}
                <span className="text-xs text-slate-500 font-mono">
                  {report.feedback_id}
                </span>
              </div>
              <p className="text-sm text-slate-400 mt-2">
                Submitted {new Date(report.created_at).toLocaleString()}
                {report.resolved_at && ` · Resolved ${new Date(report.resolved_at).toLocaleString()}`}
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={fetchReport}
              className="text-slate-400"
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Main content grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left column — Report details + timeline + response form */}
          <div className="lg:col-span-2 space-y-6">
            {/* Reporter Info */}
            <div className="rounded-xl border border-white/[0.06] p-5"
              style={{ background: 'linear-gradient(135deg, rgba(15,23,42,0.8), rgba(15,23,42,0.4))' }}>
              <h2 className="text-sm font-medium text-slate-400 mb-3">Reporter</h2>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-white/[0.05] flex items-center justify-center">
                  <User className="w-4 h-4 text-slate-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-200">{report.user_name || "Unknown User"}</p>
                  {report.user_email && (
                    <p className="text-xs text-slate-500">{report.user_email}</p>
                  )}
                </div>
                {report.group_name && (
                  <span className="ml-auto text-xs text-slate-500 bg-white/[0.03] px-2 py-1 rounded">
                    {report.group_name}
                  </span>
                )}
              </div>
            </div>

            {/* Report Content */}
            <div className="rounded-xl border border-white/[0.06] p-5"
              style={{ background: 'linear-gradient(135deg, rgba(15,23,42,0.8), rgba(15,23,42,0.4))' }}>
              <h2 className="text-sm font-medium text-slate-400 mb-3">Report Content</h2>
              <p className="text-sm text-slate-200 whitespace-pre-wrap leading-relaxed">{report.content || "No content provided"}</p>
              {report.rating && (
                <div className="mt-3 pt-3 border-t border-white/[0.04]">
                  <span className="text-xs text-slate-500">Severity Rating: </span>
                  <span className="text-xs text-orange-400 font-mono">{report.rating}/5</span>
                </div>
              )}
            </div>

            {/* Classification (if available) */}
            {report.classification && (
              <div className="rounded-xl border border-white/[0.06] p-5"
                style={{ background: 'linear-gradient(135deg, rgba(15,23,42,0.8), rgba(15,23,42,0.4))' }}>
                <h2 className="text-sm font-medium text-slate-400 mb-3">AI Classification</h2>
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="px-2 py-1 text-xs font-mono rounded bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                    {report.classification}
                  </span>
                  {report.auto_fix_attempted && (
                    <span className={`px-2 py-1 text-xs font-mono rounded ${
                      report.auto_fix_result === "success"
                        ? "bg-emerald-500/20 text-emerald-400"
                        : "bg-slate-500/20 text-slate-400"
                    }`}>
                      Auto-fix: {report.auto_fix_result || "attempted"}
                    </span>
                  )}
                  {report.resolution_code && (
                    <span className="px-2 py-1 text-xs font-mono rounded bg-slate-500/20 text-slate-400">
                      Resolution: {report.resolution_code}
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Event Timeline */}
            <div className="rounded-xl border border-white/[0.06] overflow-hidden"
              style={{ background: 'linear-gradient(135deg, rgba(15,23,42,0.8), rgba(15,23,42,0.4))' }}>
              <div className="px-5 py-4 border-b border-white/[0.04]">
                <h2 className="text-sm font-medium">Activity Timeline</h2>
              </div>
              <div className="p-5">
                {thread.length > 0 ? (
                  <div className="space-y-4">
                    {thread.map((event, index) => {
                      const isCreated = event.event_type === "created";
                      const isAdminResponse = event.event_type === "admin_response";
                      const isUserReply = event.event_type === "user_reply";
                      const isStatusChange = event.event_type === "status_change" || event.event_type === "status_updated";

                      return (
                        <div key={index} className="flex gap-4">
                          {/* Timeline connector */}
                          <div className="flex flex-col items-center">
                            <div className={`p-2 rounded-full ${
                              isCreated ? "bg-emerald-500/10" :
                              isAdminResponse ? "bg-orange-500/10" :
                              isUserReply ? "bg-blue-500/10" :
                              "bg-white/[0.05]"
                            }`}>
                              {isCreated ? (
                                <FileText className="w-4 h-4 text-emerald-400" />
                              ) : isAdminResponse ? (
                                <MessageSquare className="w-4 h-4 text-orange-400" />
                              ) : isUserReply ? (
                                <User className="w-4 h-4 text-blue-400" />
                              ) : (
                                <ArrowRightLeft className="w-4 h-4 text-slate-400" />
                              )}
                            </div>
                            {index < thread.length - 1 && (
                              <div className="w-px h-full bg-white/[0.06] my-2" />
                            )}
                          </div>

                          {/* Event content */}
                          <div className="flex-1 pb-4">
                            <div className="flex items-center gap-2 mb-1">
                              <span className={`text-xs font-mono uppercase ${
                                isCreated ? "text-emerald-400" :
                                isAdminResponse ? "text-orange-400" :
                                isUserReply ? "text-blue-400" :
                                "text-slate-500"
                              }`}>
                                {isCreated ? "Ticket Received" :
                                 isAdminResponse ? "Admin Response" :
                                 isUserReply ? "User Reply" :
                                 "Status Change"}
                              </span>
                              <span className="text-xs text-slate-600">
                                {getRelativeTime(event.ts)}
                              </span>
                            </div>

                            {/* Message content for responses/replies */}
                            {(isAdminResponse || isUserReply) && event.message && (
                              <div className={`p-3 rounded-lg mt-1 ${
                                isAdminResponse
                                  ? "border-l-2 border-orange-500/50 bg-orange-500/[0.04]"
                                  : "border-l-2 border-blue-500/50 bg-blue-500/[0.04]"
                              }`}>
                                <p className="text-sm text-slate-200 whitespace-pre-wrap">{event.message}</p>
                              </div>
                            )}

                            {/* Created: show feedback type if available */}
                            {isCreated && event.details?.feedback_type && (
                              <p className="text-sm text-slate-400 mt-1">
                                Type: <span className="text-slate-300">{TYPE_CONFIG[event.details.feedback_type]?.label || event.details.feedback_type}</span>
                              </p>
                            )}

                            {/* Status change details */}
                            {isStatusChange && (
                              <p className="text-sm text-slate-400 mt-1">
                                <span className="text-slate-300">{formatStatusChange(event)}</span>
                              </p>
                            )}

                            {/* Actor */}
                            {event.actor_name && event.actor_name !== "system" && (
                              <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                                <User className="w-3 h-3" /> {event.actor_name}
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-center text-slate-500 py-4">No activity yet</p>
                )}
              </div>
            </div>

            {/* Admin Response Form */}
            <div className="rounded-xl border border-white/[0.06] overflow-hidden"
              style={{ background: 'linear-gradient(135deg, rgba(15,23,42,0.8), rgba(15,23,42,0.4))' }}>
              <div className="px-5 py-4 border-b border-white/[0.04]">
                <h2 className="text-sm font-medium">Send Response</h2>
              </div>
              <form onSubmit={handleSendResponse} className="p-5">
                {/* Status selector */}
                {allowedTransitions.length > 0 && (
                  <div className="mb-4">
                    <label className="text-xs text-slate-500 mb-2 block">Update Status (optional)</label>
                    <div className="flex gap-2 flex-wrap">
                      <button
                        type="button"
                        onClick={() => setSelectedStatus("")}
                        className={`px-3 py-1.5 text-xs font-mono rounded-lg transition-all ${
                          selectedStatus === ""
                            ? "bg-orange-500/20 text-orange-400 border border-orange-500/30"
                            : "bg-white/[0.02] text-slate-500 border border-white/[0.04] hover:text-slate-300"
                        }`}
                      >
                        No change
                      </button>
                      {allowedTransitions.map((status) => (
                        <button
                          key={status}
                          type="button"
                          onClick={() => setSelectedStatus(status)}
                          className={`px-3 py-1.5 text-xs font-mono rounded-lg transition-all ${
                            selectedStatus === status
                              ? "bg-orange-500/20 text-orange-400 border border-orange-500/30"
                              : "bg-white/[0.02] text-slate-500 border border-white/[0.04] hover:text-slate-300"
                          }`}
                        >
                          {STATUS_CONFIG[status]?.label || status}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Response textarea */}
                <textarea
                  ref={textareaRef}
                  value={responseMessage}
                  onChange={(e) => setResponseMessage(e.target.value)}
                  placeholder="Type your response to the user..."
                  maxLength={5000}
                  className="w-full h-32 px-4 py-3 bg-white/[0.02] border border-white/[0.06] rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-orange-500/50 resize-none"
                />
                <div className="flex items-center justify-between mt-3">
                  <span className="text-xs text-slate-600">
                    {responseMessage.length}/5000
                  </span>
                  <Button
                    type="submit"
                    disabled={submitting || !responseMessage.trim()}
                    className="bg-orange-500 hover:bg-orange-600 text-white"
                  >
                    <Send className="w-4 h-4 mr-2" />
                    {submitting ? "Sending..." : "Send Response"}
                  </Button>
                </div>
              </form>
            </div>
          </div>

          {/* Right column — AI Assist panel */}
          <div className="space-y-6">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-orange-400" />
                <span className="text-sm font-medium text-slate-300">AI Assist</span>
              </div>
              <button
                onClick={() => setShowAssist(!showAssist)}
                className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
              >
                {showAssist ? "Hide" : "Show"}
              </button>
            </div>

            {showAssist && (
              <>
                {/* Summary Card */}
                <div className="rounded-xl border border-white/[0.06] p-4"
                  style={{ background: 'linear-gradient(135deg, rgba(15,23,42,0.8), rgba(15,23,42,0.4))' }}>
                  <div className="flex items-center gap-2 mb-3">
                    <FileText className="w-3.5 h-3.5 text-blue-400" />
                    <span className="text-xs font-medium text-slate-400">Summary</span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    {report.classification
                      ? `${typeConf.label} report classified as "${report.classification}". ${
                          report.auto_fix_attempted
                            ? `Auto-fix was attempted (${report.auto_fix_result || "pending"}).`
                            : "No auto-fix attempted."
                        }`
                      : `${typeConf.label} report from ${report.user_name || "unknown user"}${
                          report.group_name ? ` in group "${report.group_name}"` : ""
                        }. Currently ${statusConf.label.toLowerCase()}.`
                    }
                  </p>
                </div>

                {/* Draft Reply Card (AI-powered) */}
                <div className="rounded-xl border border-white/[0.06] p-4"
                  style={{ background: 'linear-gradient(135deg, rgba(15,23,42,0.8), rgba(15,23,42,0.4))' }}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <MessageSquare className="w-3.5 h-3.5 text-orange-400" />
                      <span className="text-xs font-medium text-slate-400">Suggested Reply</span>
                      {aiDraft?.model && (
                        <span className="px-1.5 py-0.5 text-[10px] rounded bg-orange-500/10 text-orange-400/70">AI</span>
                      )}
                    </div>
                    <button
                      onClick={() => handleUseDraft(aiDraft?.draft || draftReply)}
                      disabled={aiDraftLoading}
                      className="flex items-center gap-1 text-xs text-orange-400 hover:text-orange-300 transition-colors disabled:opacity-50"
                    >
                      <Copy className="w-3 h-3" /> Use
                    </button>
                  </div>
                  {aiDraftLoading ? (
                    <div className="flex items-center gap-2 py-2">
                      <div className="w-3 h-3 rounded-full border border-orange-500/30 border-t-orange-400 animate-spin" />
                      <span className="text-xs text-slate-500">Generating draft...</span>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 leading-relaxed italic">
                      "{aiDraft?.draft || draftReply}"
                    </p>
                  )}
                </div>

                {/* Recommended Status Card */}
                {allowedTransitions.includes(suggestedStatus) && report.status !== suggestedStatus && (
                  <div className="rounded-xl border border-white/[0.06] p-4"
                    style={{ background: 'linear-gradient(135deg, rgba(15,23,42,0.8), rgba(15,23,42,0.4))' }}>
                    <div className="flex items-center gap-2 mb-3">
                      <ArrowRightLeft className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-xs font-medium text-slate-400">Recommended Status</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 text-xs font-mono rounded ${statusConf.color}`}>
                          {statusConf.label}
                        </span>
                        <span className="text-xs text-slate-600">→</span>
                        <span className={`px-2 py-0.5 text-xs font-mono rounded ${STATUS_CONFIG[suggestedStatus]?.color || ""}`}>
                          {STATUS_CONFIG[suggestedStatus]?.label || suggestedStatus}
                        </span>
                      </div>
                      <button
                        onClick={() => setSelectedStatus(suggestedStatus)}
                        className="text-xs text-emerald-400 hover:text-emerald-300 transition-colors"
                      >
                        Apply
                      </button>
                    </div>
                  </div>
                )}

                {/* Similar Reports Card */}
                <div className="rounded-xl border border-white/[0.06] p-4"
                  style={{ background: 'linear-gradient(135deg, rgba(15,23,42,0.8), rgba(15,23,42,0.4))' }}>
                  <div className="flex items-center gap-2 mb-3">
                    <CheckCircle className="w-3.5 h-3.5 text-cyan-400" />
                    <span className="text-xs font-medium text-slate-400">Similar Reports</span>
                  </div>
                  {similarLoading ? (
                    <div className="flex items-center gap-2 py-1">
                      <div className="w-3 h-3 rounded-full border border-cyan-500/30 border-t-cyan-400 animate-spin" />
                      <span className="text-xs text-slate-500">Searching...</span>
                    </div>
                  ) : similarReports.length > 0 ? (
                    <div className="space-y-2">
                      {similarReports.map((sim) => (
                        <button
                          key={sim.feedback_id}
                          onClick={() => navigate(`/admin/feedback/${sim.feedback_id}`)}
                          className="w-full text-left rounded-lg border border-white/[0.04] p-2.5 hover:border-cyan-500/20 transition-all"
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`px-1.5 py-0.5 text-[10px] font-mono rounded ${
                              sim.match_reason === "exact_hash"
                                ? "bg-red-500/20 text-red-400"
                                : "bg-cyan-500/10 text-cyan-400/70"
                            }`}>
                              {sim.match_reason === "exact_hash" ? "Exact Match" : "Similar"}
                            </span>
                            <span className={`px-1.5 py-0.5 text-[10px] font-mono rounded ${
                              STATUS_CONFIG[sim.status]?.color || "bg-slate-500/20 text-slate-400"
                            }`}>
                              {STATUS_CONFIG[sim.status]?.label || sim.status}
                            </span>
                          </div>
                          <p className="text-xs text-slate-400 line-clamp-1">{sim.content_preview || "—"}</p>
                          <span className="text-[10px] text-slate-600 font-mono">{sim.feedback_id}</span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500">No similar reports found</p>
                  )}
                  {/* Still show linked report if it exists and wasn't in similar results */}
                  {report.linked_feedback_id && !similarReports.some(s => s.feedback_id === report.linked_feedback_id) && (
                    <div className="mt-2 pt-2 border-t border-white/[0.04]">
                      <span className="text-[10px] text-slate-500">Linked: </span>
                      <button
                        onClick={() => navigate(`/admin/feedback/${report.linked_feedback_id}`)}
                        className="text-xs text-cyan-400 hover:text-cyan-300 font-mono transition-colors"
                      >
                        {report.linked_feedback_id} →
                      </button>
                    </div>
                  )}
                </div>

                {/* Tags */}
                {report.tags && report.tags.length > 0 && (
                  <div className="rounded-xl border border-white/[0.06] p-4"
                    style={{ background: 'linear-gradient(135deg, rgba(15,23,42,0.8), rgba(15,23,42,0.4))' }}>
                    <span className="text-xs font-medium text-slate-400 mb-2 block">Tags</span>
                    <div className="flex flex-wrap gap-1.5">
                      {report.tags.map((tag, i) => (
                        <span key={i} className="px-2 py-0.5 text-xs rounded bg-white/[0.04] text-slate-400 border border-white/[0.06]">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
