import { useState, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import axios from "axios";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  ArrowLeft, RefreshCw, Filter, MessageSquare, Bug, Lightbulb,
  AlertTriangle, ThumbsUp, HelpCircle, CheckCircle, Inbox,
  TrendingUp, TrendingDown, Clock, AlertCircle, BarChart3
} from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL + "/api";

const TYPE_CONFIG = {
  bug: { label: "Bug", color: "bg-red-500/20 text-red-400 border-red-500/30", icon: Bug },
  complaint: { label: "Complaint", color: "bg-orange-500/20 text-orange-400 border-orange-500/30", icon: AlertTriangle },
  feature_request: { label: "Feature", color: "bg-blue-500/20 text-blue-400 border-blue-500/30", icon: Lightbulb },
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

const PRIORITY_CONFIG = {
  critical: "bg-red-500/20 text-red-400 border-red-500/30",
  high: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  medium: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  low: "bg-slate-500/20 text-slate-400 border-slate-500/30",
  normal: "bg-slate-500/20 text-slate-400 border-slate-500/30",
};

export default function UserReportsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [reports, setReports] = useState([]);
  const [stats, setStats] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const LIMIT = 50;

  const statusFilter = searchParams.get("status") || "all";
  const typeFilter = searchParams.get("type") || "all";
  const priorityFilter = searchParams.get("priority") || "all";

  const fetchReports = useCallback(async (loadMore = false) => {
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.append("status", statusFilter);
      if (typeFilter !== "all") params.append("feedback_type", typeFilter);
      params.append("limit", String(LIMIT));
      const currentOffset = loadMore ? offset : 0;
      params.append("offset", String(currentOffset));
      params.append("days", "90");

      const response = await axios.get(`${API}/admin/feedback?${params.toString()}`);
      const data = response.data || [];
      const items = Array.isArray(data) ? data : (data.items || data.feedback || []);

      if (loadMore) {
        setReports(prev => [...prev, ...items]);
      } else {
        setReports(items);
      }
      setHasMore(items.length === LIMIT);
      setOffset(currentOffset + items.length);
    } catch (error) {
      console.error("Error fetching reports:", error);
      toast.error("Failed to load user reports");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [statusFilter, typeFilter, offset]);

  const fetchStats = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/admin/feedback/stats?days=90`);
      setStats(res.data);
    } catch (err) {
      console.error("Error fetching stats:", err);
    }
  }, []);

  useEffect(() => {
    setOffset(0);
    fetchReports(false);
    fetchStats();
  }, [statusFilter, typeFilter, priorityFilter]);

  const handleRefresh = () => {
    setRefreshing(true);
    setOffset(0);
    fetchReports(false);
  };

  const handleLoadMore = () => {
    fetchReports(true);
  };

  const updateFilter = (key, value) => {
    const newParams = new URLSearchParams(searchParams);
    if (value === "all") {
      newParams.delete(key);
    } else {
      newParams.set(key, value);
    }
    setSearchParams(newParams);
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

  const formatHours = (hours) => {
    if (hours == null) return "—";
    if (hours < 1) return `${Math.round(hours * 60)}m`;
    if (hours < 24) return `${hours.toFixed(1)}h`;
    return `${(hours / 24).toFixed(1)}d`;
  };

  const AGING_COLORS = {
    "0-24h": "bg-emerald-500",
    "1-3d": "bg-yellow-500",
    "3-7d": "bg-orange-500",
    "7d+": "bg-red-500",
  };

  // Filter by priority client-side (backend may not support priority filter directly)
  const filteredReports = priorityFilter === "all"
    ? reports
    : reports.filter(r => r.priority === priorityFilter);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#060918] flex items-center justify-center">
        <div className="w-12 h-12 rounded-full border-2 border-orange-500/30 border-t-orange-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#060918] text-slate-100">
      {/* Background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
        <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full opacity-[0.05]"
          style={{ background: 'radial-gradient(circle, #f97316, transparent 70%)' }} />
      </div>

      <main className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
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
            <div>
              <h1 className="text-2xl font-bold text-slate-100">User Reports</h1>
              <p className="text-sm text-slate-400 mt-1">
                {filteredReports.length} report{filteredReports.length !== 1 ? "s" : ""} found
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRefresh}
              disabled={refreshing}
              className="text-slate-400"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>

        {/* Stats Header */}
        {stats && !stats.error && (
          <div className="mb-6 space-y-4">
            {/* Metric Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Total Reports */}
              <div className="rounded-xl border border-white/[0.06] p-4"
                style={{ background: 'linear-gradient(135deg, rgba(15,23,42,0.8), rgba(15,23,42,0.4))' }}>
                <div className="flex items-center gap-2 mb-1">
                  <BarChart3 className="w-3.5 h-3.5 text-slate-500" />
                  <span className="text-xs text-slate-500">Total Reports</span>
                </div>
                <div className="flex items-end gap-2">
                  <span className="text-2xl font-bold text-slate-100">{stats.total}</span>
                  {stats.trend && stats.trend.change_pct !== 0 && (
                    <span className={`flex items-center gap-0.5 text-xs mb-1 ${
                      stats.trend.change_pct > 0 ? "text-red-400" : "text-emerald-400"
                    }`}>
                      {stats.trend.change_pct > 0
                        ? <TrendingUp className="w-3 h-3" />
                        : <TrendingDown className="w-3 h-3" />
                      }
                      {Math.abs(stats.trend.change_pct)}%
                    </span>
                  )}
                </div>
              </div>

              {/* Unresolved */}
              <div className="rounded-xl border border-white/[0.06] p-4"
                style={{ background: 'linear-gradient(135deg, rgba(15,23,42,0.8), rgba(15,23,42,0.4))' }}>
                <div className="flex items-center gap-2 mb-1">
                  <AlertCircle className="w-3.5 h-3.5 text-orange-500" />
                  <span className="text-xs text-slate-500">Unresolved</span>
                </div>
                <span className="text-2xl font-bold text-orange-400">{stats.unresolved}</span>
              </div>

              {/* Avg Response Time */}
              <div className="rounded-xl border border-white/[0.06] p-4"
                style={{ background: 'linear-gradient(135deg, rgba(15,23,42,0.8), rgba(15,23,42,0.4))' }}>
                <div className="flex items-center gap-2 mb-1">
                  <Clock className="w-3.5 h-3.5 text-blue-500" />
                  <span className="text-xs text-slate-500">Avg Response</span>
                </div>
                <span className="text-2xl font-bold text-blue-400">
                  {formatHours(stats.avg_first_response_hours)}
                </span>
              </div>

              {/* Avg Resolution Time */}
              <div className="rounded-xl border border-white/[0.06] p-4"
                style={{ background: 'linear-gradient(135deg, rgba(15,23,42,0.8), rgba(15,23,42,0.4))' }}>
                <div className="flex items-center gap-2 mb-1">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                  <span className="text-xs text-slate-500">Avg Resolution</span>
                </div>
                <span className="text-2xl font-bold text-emerald-400">
                  {formatHours(stats.avg_resolution_hours)}
                </span>
              </div>
            </div>

            {/* Aging Buckets Bar */}
            {stats.aging_buckets && stats.aging_buckets.length > 0 && (() => {
              const totalAging = stats.aging_buckets.reduce((sum, b) => sum + (b.count || 0), 0);
              if (totalAging === 0) return null;
              return (
                <div className="rounded-xl border border-white/[0.06] p-4"
                  style={{ background: 'linear-gradient(135deg, rgba(15,23,42,0.8), rgba(15,23,42,0.4))' }}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-slate-500">Unresolved Age Distribution</span>
                    <span className="text-xs text-slate-600">{totalAging} open</span>
                  </div>
                  <div className="flex rounded-full overflow-hidden h-2.5 bg-white/[0.03]">
                    {stats.aging_buckets.map((bucket) => {
                      const pct = totalAging > 0 ? (bucket.count / totalAging) * 100 : 0;
                      if (pct === 0) return null;
                      return (
                        <div
                          key={bucket.bucket}
                          className={`${AGING_COLORS[bucket.bucket] || "bg-slate-500"} transition-all`}
                          style={{ width: `${pct}%` }}
                          title={`${bucket.bucket}: ${bucket.count}`}
                        />
                      );
                    })}
                  </div>
                  <div className="flex gap-4 mt-2">
                    {stats.aging_buckets.map((bucket) => (
                      <div key={bucket.bucket} className="flex items-center gap-1.5">
                        <div className={`w-2 h-2 rounded-full ${AGING_COLORS[bucket.bucket] || "bg-slate-500"}`} />
                        <span className="text-xs text-slate-500">{bucket.bucket}</span>
                        <span className="text-xs text-slate-400 font-mono">{bucket.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-wrap gap-4 mb-6">
          {/* Status Filter */}
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-500" />
            <span className="text-xs text-slate-500">Status:</span>
            <div className="flex flex-wrap bg-white/[0.02] rounded-lg p-1">
              {["all", "open", "classified", "in_progress", "needs_user_info", "resolved", "wont_fix"].map((s) => (
                <button
                  key={s}
                  onClick={() => updateFilter("status", s)}
                  className={`px-2.5 py-1 text-xs font-mono rounded-md transition-all ${
                    statusFilter === s
                      ? "bg-orange-500/20 text-orange-400"
                      : "text-slate-500 hover:text-slate-300"
                  }`}
                >
                  {s === "all" ? "all" : (STATUS_CONFIG[s]?.label || s)}
                </button>
              ))}
            </div>
          </div>

          {/* Type Filter */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">Type:</span>
            <div className="flex flex-wrap bg-white/[0.02] rounded-lg p-1">
              {["all", "bug", "complaint", "feature_request", "ux_issue", "praise", "other"].map((t) => (
                <button
                  key={t}
                  onClick={() => updateFilter("type", t)}
                  className={`px-2.5 py-1 text-xs font-mono rounded-md transition-all ${
                    typeFilter === t
                      ? "bg-orange-500/20 text-orange-400"
                      : "text-slate-500 hover:text-slate-300"
                  }`}
                >
                  {t === "all" ? "all" : (TYPE_CONFIG[t]?.label || t)}
                </button>
              ))}
            </div>
          </div>

          {/* Priority Filter */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">Priority:</span>
            <div className="flex bg-white/[0.02] rounded-lg p-1">
              {["all", "critical", "high", "medium", "low"].map((p) => (
                <button
                  key={p}
                  onClick={() => updateFilter("priority", p)}
                  className={`px-2.5 py-1 text-xs font-mono rounded-md transition-all ${
                    priorityFilter === p
                      ? "bg-orange-500/20 text-orange-400"
                      : "text-slate-500 hover:text-slate-300"
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Reports List */}
        <div className="space-y-3">
          {filteredReports.length > 0 ? (
            <>
              {filteredReports.map((report) => {
                const typeConf = TYPE_CONFIG[report.type] || TYPE_CONFIG.other;
                const statusConf = STATUS_CONFIG[report.status] || STATUS_CONFIG.open;
                const priorityColor = PRIORITY_CONFIG[report.priority] || PRIORITY_CONFIG.normal;
                const TypeIcon = typeConf.icon;

                return (
                  <div
                    key={report.feedback_id}
                    className="rounded-xl border border-white/[0.06] p-5 cursor-pointer hover:border-orange-500/20 transition-all"
                    style={{ background: 'linear-gradient(135deg, rgba(15,23,42,0.8), rgba(15,23,42,0.4))' }}
                    onClick={() => navigate(`/admin/feedback/${report.feedback_id}`)}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        {/* Badges row */}
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-mono rounded border ${typeConf.color}`}>
                            <TypeIcon className="w-3 h-3" />
                            {typeConf.label}
                          </span>
                          <span className={`px-2 py-0.5 text-xs font-mono rounded ${statusConf.color}`}>
                            {statusConf.label}
                          </span>
                          {report.priority && report.priority !== "normal" && (
                            <span className={`px-2 py-0.5 text-xs font-mono rounded border ${priorityColor}`}>
                              {report.priority}
                            </span>
                          )}
                          <span className="text-xs text-slate-600 font-mono">
                            {report.feedback_id}
                          </span>
                        </div>

                        {/* Content preview */}
                        <p className="text-sm text-slate-200 mb-2 line-clamp-2">
                          {report.content_preview || report.content || "No content"}
                        </p>

                        {/* Meta */}
                        <div className="flex items-center gap-3 text-xs text-slate-500">
                          {report.user_name && (
                            <span className="flex items-center gap-1">
                              <span className="w-4 h-4 rounded-full bg-white/[0.05] flex items-center justify-center text-[10px] text-slate-400">
                                {(report.user_name || "?")[0].toUpperCase()}
                              </span>
                              {report.user_name}
                            </span>
                          )}
                          <span>{getRelativeTime(report.created_at)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Load More */}
              {hasMore && (
                <div className="flex justify-center pt-4">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleLoadMore}
                    className="text-orange-400 hover:text-orange-300"
                  >
                    Load More
                  </Button>
                </div>
              )}
            </>
          ) : (
            <div className="rounded-xl border border-white/[0.06] p-12 text-center"
              style={{ background: 'linear-gradient(135deg, rgba(15,23,42,0.8), rgba(15,23,42,0.4))' }}>
              <Inbox className="w-12 h-12 text-slate-500/50 mx-auto mb-4" />
              <p className="text-slate-400">No reports match your filters</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
