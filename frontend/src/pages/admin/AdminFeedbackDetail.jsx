import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  ArrowLeft, MessageSquare, User, RefreshCw, Bug, FileText,
  CheckCircle, Clock, AlertCircle
} from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL + "/api";

export default function AdminFeedbackDetail() {
  const { feedbackId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState(null);

  const fetchReport = useCallback(async () => {
    if (!feedbackId) return;
    try {
      const response = await axios.get(`${API}/admin/feedback/${feedbackId}`);
      setReport(response.data);
    } catch (error) {
      console.error("Error fetching report:", error.response?.status, error.response?.data?.detail || error.message);
      const msg = error.response?.data?.detail || error.response?.status === 404 ? "Report not found" : "Failed to load report";
      toast.error(msg);
      setReport(null);
    } finally {
      setLoading(false);
    }
  }, [feedbackId]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const getTypeColor = (type) => {
    switch (type) {
      case "bug": return "bg-red-500/20 text-red-400 border-red-500/30";
      case "complaint": return "bg-orange-500/20 text-orange-400 border-orange-500/30";
      case "feature_request": return "bg-blue-500/20 text-blue-400 border-blue-500/30";
      default: return "bg-slate-500/20 text-slate-400 border-slate-500/30";
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "resolved":
      case "closed": return "bg-emerald-500/20 text-emerald-400";
      case "in_progress": return "bg-yellow-500/20 text-yellow-400";
      default: return "bg-slate-500/20 text-slate-500";
    }
  };

  const getTypeIcon = (type) => {
    switch (type) {
      case "bug": return <Bug className="w-4 h-4" />;
      default: return <MessageSquare className="w-4 h-4" />;
    }
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
          <p className="text-slate-400">Report not found</p>
          <Button variant="ghost" className="mt-4" onClick={() => navigate("/admin")}>
            Back to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#060918] text-slate-100">
      <div className="fixed inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
        <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full opacity-[0.05]"
          style={{ background: "radial-gradient(circle, #8B5CF6, transparent 70%)" }} />
      </div>

      <main className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/admin")}
            className="text-slate-400 hover:text-slate-200 mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to Dashboard
          </Button>

          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <span className={`px-2 py-1 text-xs font-mono rounded border flex items-center gap-1 ${getTypeColor(report.type)}`}>
                  {getTypeIcon(report.type)}
                  {report.type || "feedback"}
                </span>
                <span className={`px-2 py-1 text-xs font-mono rounded ${getStatusColor(report.status)}`}>
                  {report.status || "pending"}
                </span>
                <span className="text-xs text-slate-500 font-mono">{report.feedback_id}</span>
              </div>
              <h1 className="text-xl font-bold text-slate-100 line-clamp-2">
                {report.content?.slice(0, 80) || "Feedback"}
              </h1>
              <p className="text-sm text-slate-400 mt-2 flex items-center gap-2">
                <Clock className="w-4 h-4" />
                {report.created_at && new Date(report.created_at).toLocaleString()}
                {report.user_name && (
                  <span className="flex items-center gap-1 ml-4">
                    <User className="w-4 h-4" />
                    {report.user_name}
                  </span>
                )}
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={fetchReport} className="text-slate-400">
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <div className="rounded-xl border border-white/[0.06] p-5 mb-6"
          style={{ background: "linear-gradient(135deg, rgba(15,23,42,0.8), rgba(15,23,42,0.4))" }}>
          <h2 className="text-sm font-medium text-slate-400 mb-2">Content</h2>
          <p className="text-slate-200 whitespace-pre-wrap">{report.content || "—"}</p>
        </div>

        {(report.classification || report.resolution_code) && (
          <div className="rounded-xl border border-white/[0.06] p-5 mb-6"
            style={{ background: "linear-gradient(135deg, rgba(15,23,42,0.8), rgba(15,23,42,0.4))" }}>
            <h2 className="text-sm font-medium text-slate-400 mb-2">Details</h2>
            <div className="space-y-2 text-sm">
              {report.classification && (
                <p><span className="text-slate-500">Classification:</span> {report.classification}</p>
              )}
              {report.resolution_code && (
                <p><span className="text-slate-500">Resolution:</span> {report.resolution_code}</p>
              )}
              {report.resolved_at && (
                <p className="flex items-center gap-1 text-emerald-400">
                  <CheckCircle className="w-4 h-4" />
                  Resolved {new Date(report.resolved_at).toLocaleString()}
                </p>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
