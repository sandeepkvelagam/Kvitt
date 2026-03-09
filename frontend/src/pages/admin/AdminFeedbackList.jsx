import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft, MessageSquare, Bug, ChevronRight, RefreshCw
} from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL + "/api";

export default function AdminFeedbackList() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState([]);
  const [stats, setStats] = useState(null);
  const [days, setDays] = useState(30);

  const fetchData = useCallback(async () => {
    try {
      const [listRes, statsRes] = await Promise.all([
        axios.get(`${API}/admin/feedback?days=${days}&limit=50`),
        axios.get(`${API}/admin/feedback/stats?days=${days}`)
      ]);
      setFeedback(listRes.data?.feedback || []);
      setStats(statsRes.data);
    } catch (error) {
      console.error("Error fetching feedback:", error);
      setFeedback([]);
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#060918] flex items-center justify-center">
        <div className="w-12 h-12 rounded-full border-2 border-orange-500/30 border-t-orange-400 animate-spin" />
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

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <MessageSquare className="w-8 h-8 text-purple-400" />
              <div>
                <h1 className="text-2xl font-bold text-slate-100">User Reports</h1>
                <p className="text-sm text-slate-500">Feedback, bugs, and feature requests</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {[7, 30, 90].map((d) => (
                <button
                  key={d}
                  onClick={() => setDays(d)}
                  className={`px-3 py-1.5 text-xs font-mono rounded-lg ${
                    days === d ? "bg-orange-500/20 text-orange-400" : "text-slate-500 hover:text-slate-300"
                  }`}
                >
                  {d}d
                </button>
              ))}
              <Button variant="ghost" size="sm" onClick={fetchData} className="text-slate-400">
                <RefreshCw className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {stats && (
            <div className="grid grid-cols-3 gap-4 mt-6">
              <div className="rounded-xl border border-white/[0.06] p-4 bg-white/[0.02]">
                <p className="text-2xl font-bold text-slate-100">{stats.total || 0}</p>
                <p className="text-xs text-slate-500">Total</p>
              </div>
              <div className="rounded-xl border border-white/[0.06] p-4 bg-white/[0.02]">
                <p className="text-2xl font-bold text-purple-400">{stats.unresolved || 0}</p>
                <p className="text-xs text-slate-500">Open</p>
              </div>
              <div className="rounded-xl border border-white/[0.06] p-4 bg-white/[0.02]">
                <p className="text-2xl font-bold text-emerald-400">{stats.auto_fixed || 0}</p>
                <p className="text-xs text-slate-500">Auto-fixed</p>
              </div>
            </div>
          )}
        </div>

        <div className="space-y-2">
          {feedback.length > 0 ? (
            feedback.map((report) => (
              <button
                key={report.feedback_id}
                onClick={() => navigate(`/admin/feedback/${report.feedback_id}`)}
                className="w-full text-left p-4 rounded-xl border border-white/[0.06] hover:bg-white/[0.04] transition-colors flex items-center gap-4"
                style={{ background: "linear-gradient(135deg, rgba(15,23,42,0.8), rgba(15,23,42,0.4))" }}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`px-1.5 py-0.5 text-[10px] font-mono rounded ${
                      report.type === "bug" ? "bg-red-500/20 text-red-400" :
                      report.type === "complaint" ? "bg-orange-500/20 text-orange-400" :
                      report.type === "feature_request" ? "bg-blue-500/20 text-blue-400" :
                      "bg-slate-500/20 text-slate-400"
                    }`}>
                      {report.type || "feedback"}
                    </span>
                    <span className={`text-[10px] font-mono ${
                      report.status === "resolved" || report.status === "closed"
                        ? "text-emerald-400"
                        : report.status === "in_progress"
                          ? "text-yellow-400"
                          : "text-slate-500"
                    }`}>
                      {report.status || "pending"}
                    </span>
                    <span className="text-[10px] text-slate-600 font-mono">{report.feedback_id}</span>
                  </div>
                  <p className="text-sm text-slate-200 line-clamp-2">{report.content_preview}</p>
                  <p className="text-[10px] text-slate-500 mt-1">
                    {report.user_name || "Anonymous"} • {report.created_at && new Date(report.created_at).toLocaleDateString()}
                  </p>
                </div>
                <ChevronRight className="w-5 h-5 text-slate-500 flex-shrink-0" />
              </button>
            ))
          ) : (
            <div className="text-center py-12 rounded-xl border border-white/[0.06] bg-white/[0.02]">
              <MessageSquare className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <p className="text-slate-500">No user reports in the last {days} days</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
